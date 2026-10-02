import { readFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { PAYLOAD_CAP, cellCount, exportFixture, frame, sha, sorted } from './fixture-export.mjs';
import { BASE, LAB, writeOwned } from './stage-source.mjs';
import { replay } from './synthetic.mjs';

export const CROP = { dimensions: [192, 80, 192], originMeters: [-8, -2, -8], sourceOffset: [64, 48, 64] };
const vec = value => [value.x, value.y, value.z];
const cellId = (part, cell) => `${part}/${cell.join('/')}`;
function nativeMaterial(id, role, profile) {
  return { id, role, colorLinearRgb: [profile.baseColor.r, profile.baseColor.g, profile.baseColor.b],
    opacity: profile.opacity, depthWrite: profile.depthWrite, doubleSided: profile.doubleSided };
}
export function extractCameras(text) {
  const block = text.slice(text.indexOf('const HVP_CAMERA_PRESETS:'), text.indexOf('const MIN_PITCH'));
  const xyz = '\\s*x:\\s*([-\\d.]+),\\s*y:\\s*([-\\d.]+),\\s*z:\\s*([-\\d.]+)\\s*';
  const pattern = new RegExp(`"(C\\d{2}-[A-Z]+)"\\s*:\\s*\\{\\s*position:\\s*\\{${xyz}\\},\\s*target:\\s*\\{${xyz}\\},\\s*fov:\\s*([\\d.]+)\\s*\\}`, 'g');
  const cameras = [...block.matchAll(pattern)].map(m => ({ id: m[1], positionMeters: m.slice(2, 5).map(Number),
    targetMeters: m.slice(5, 8).map(Number), up: [0, 1, 0], verticalFovDegrees: Number(m[8]) }));
  if (cameras.length !== 6) { throw new Error('Pinned camera literal extraction incomplete'); }
  return cameras;
}
export function extractVegetationPalettes(text) {
  const block = text.slice(text.indexOf('const colors = {'), text.indexOf('} as const;', text.indexOf('const colors = {')));
  const palettes = Object.fromEntries([...block.matchAll(/\b(wood|tree|reed|broadleaf|violet|amber):\s*(\[\[.*?\]\])/g)]
    .map(m => [m[1], JSON.parse(m[2])]));
  if (Object.keys(palettes).length !== 6 || Object.values(palettes).some(palette => !Array.isArray(palette)
    || palette.some(rgb => !Array.isArray(rgb) || rgb.length !== 3 || rgb.some(v => !Number.isFinite(v) || v < 0 || v > 1)))) {
    throw new Error('Pinned native linear vegetation palette extraction incomplete');
  }
  return palettes;
}
function nearestOccupied(volume, target) {
  let best = Infinity; let cell;
  const [sx, sy] = volume.dimensions;
  for (let i = 0; i < volume.slots.length; i += 1) {
    if (!volume.slots[i]) { continue; }
    const point = [i % sx, Math.floor(i / sx) % sy, Math.floor(i / (sx * sy))];
    const distance = point.reduce((sum, v, axis) => sum + (v - target[axis]) ** 2, 0);
    if (distance < best) { best = distance; cell = point; }
  }
  if (!cell) { throw new Error('Empty native decoration source'); }
  return cell;
}
function assertOccupied(volume, cell) {
  const [x, y, z] = cell; const [sx, sy, sz] = volume.dimensions;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz || !volume.slots[x + sx * (y + sy * z)]) {
    throw new Error('Native support does not resolve to occupied source cell');
  }
}
export function nativeMeshes(id, mesh, materialIds) {
  // Preserve native positions/normals/linear vertex colors. Only split the
  // existing ranges by material. A native range is a run, not a new Lab mesh:
  // repeated runs must not duplicate whole vertex buffers or manifest records.
  if (mesh.indices.byteLength > PAYLOAD_CAP) { throw new Error('Scene payload exceeds 128 MiB'); }
  const slots = [...new Set(mesh.materialRanges.map(r => r.slot))].sort((a, b) => a - b);
  return slots.map(slot => {
    const ranges = mesh.materialRanges.filter(r => r.slot === slot);
    const count = ranges.reduce((sum, r) => sum + r.indexCount, 0);
    const indices = new mesh.indices.constructor(count); let offset = 0;
    for (const range of ranges) {
      indices.set(mesh.indices.subarray(range.startIndex, range.startIndex + range.indexCount), offset); offset += range.indexCount;
    }
    return { id: `${id}-slot-${slot}`, materialId: materialIds[slot - 1], positions: mesh.positions, normals: mesh.normals,
      colors: mesh.colors, indices };
  });
}
export async function makeProductFixture(staged, proofDirectory, reverseOrder = false) {
  const started = performance.now();
  const { coast, mesher, vegetation, look } = staged.product;
  cellCount([coast.HVP_SOURCE_SIZE_X, coast.HVP_SOURCE_SIZE_Y, coast.HVP_SOURCE_SIZE_Z]);
  const source = coast.materializeHvpCoastSource(); coast.assertHvpSourceComplete(source);
  const nativeSlots = source.copySlots(); const nativeSha = sha(nativeSlots);
  writeOwned(path.join(proofDirectory, 'native-coast-slots.bin'), nativeSlots);
  const count = cellCount(CROP.dimensions);
  const slots = new Uint8Array(count); const coverage = new Uint8Array(count).fill(1);
  const [sx, sy, sz] = CROP.dimensions; const [ox, oy, oz] = CROP.sourceOffset;
  for (let step = 0; step < count; step += 1) {
    const i = reverseOrder ? count - 1 - step : step;
    const x = i % sx; const y = Math.floor(i / sx) % sy; const z = Math.floor(i / (sx * sy));
    slots[i] = nativeSlots[x + ox + source.sizeX * (y + oy + source.sizeY * (z + oz))];
  }
  const profile = look.createHvpLookProfile('readable');
  const materials = profile.materials.map(entry => nativeMaterial(`hvp-${entry.role}`, entry.role, entry.materialProfile));
  const materialIds = materials.map(m => m.id);
  const volume = { id: 'coast-crop', ...CROP, slots, coverage, materialIds,
    coveragePolicy: 'all crop cells from validated native source are known; outside unknown; NO analytical ghost/join' };
  const occupancy = { sizeX: sx, sizeY: sy, sizeZ: sz, cellMeters: 0.125,
    originMeters: { x: -8, y: -2, z: -8 }, slotAt: (x, y, z) => x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz
      ? 0 : slots[x + sx * (y + sy * z)] };
  const terrainMesh = mesher.meshHvpOccupancy(occupancy, undefined, source.sourceDigest,
    mesher.HVP_COAST_MESH_ALGORITHM_VERSION, { ao: true });
  const terrain = { ownerId: 'hvp:terrain', sourceRevision: 0, sourceNamespace: 'hvp-source-global-slot-v5', sourceIds: ['crop-volume'],
    frame: frame('hvp:terrain'), volumes: [volume], meshes: nativeMeshes('coast', terrainMesh, materialIds) };
  const objects = [terrain]; const attachments = []; const bindings = []; const plantProofs = [];
  const allPlants = vegetation.planHvpVegetation();
  const selected = ['tree', 'reed', 'broadleaf', 'violet', 'amber'].map(kind => {
    const margin = kind === 'tree' ? 6 : 11 * 0.125;
    const candidate = allPlants.find(p => p.kind === kind && (kind !== 'tree' || p.id === 'hvp:flora:hero')
      && p.position.x >= CROP.originMeters[0] + margin && p.position.x <= CROP.originMeters[0] + CROP.dimensions[0] * 0.125 - margin
      && p.position.z >= CROP.originMeters[2] + margin && p.position.z <= CROP.originMeters[2] + CROP.dimensions[2] * 0.125 - margin);
    if (!candidate) { throw new Error(`Missing native plant kind in crop: ${kind}`); }
    return candidate;
  });
  if (vegetation.estimateHvpVegetationSourceBytes(selected) + count * 3 > 134_217_728) { throw new Error('Scene payload exceeds 128 MiB'); }
  const visit = reverseOrder ? [...selected].reverse() : selected;
  for (const instance of visit) {
    const index = selected.indexOf(instance); const plant = vegetation.buildHvpPlant(instance);
    const before = [plant.wood, plant.decoration].filter(Boolean).map(v => ({ bytes: v.byteLength, sha256: sha(v.copySlots()) }));
    const products = vegetation.meshHvpVegetation(plant);
    const sourceIds = []; const volumes = []; const meshes = [];
    for (const [part, nativeVolume] of [['wood', plant.wood], ['decor', plant.decoration]]) {
      if (!nativeVolume) { continue; }
      const product = products[part === 'wood' ? 0 : products.length - 1]; const materialId = product.profiles[0].id;
      if (!materials.some(m => m.id === materialId)) {
        materials.push(nativeMaterial(materialId, part === 'wood' ? 'wood' : ['violet', 'amber'].includes(instance.kind) ? 'accent' : 'foliage', product.profiles[0]));
      }
      const partSlots = nativeVolume.copySlots(); let maxSlot = 0;
      for (const slot of partSlots) { maxSlot = Math.max(maxSlot, slot); }
      const component = { id: `plant-${index}-${part}`, dimensions: [nativeVolume.sizeX, nativeVolume.sizeY, nativeVolume.sizeZ],
        originMeters: vec(nativeVolume.originMeters), slots: partSlots, coverage: partSlots.map(v => v > 0 ? 1 : 0),
        materialIds: Array.from({ length: maxSlot }, () => materialId), coveragePolicy: 'occupied-component-only; native slot0 is NOT global KnownAir' };
      volumes.push(component); meshes.push(...nativeMeshes(`plant-${index}-${part}`, product.mesh, [materialId]));
    }
    const decor = volumes.find(v => v.id.endsWith('-decor')); const wood = volumes.find(v => v.id.endsWith('-wood'));
    for (const anchor of plant.anchors) {
      assertOccupied(wood, anchor.cell); const id = cellId('wood', anchor.cell); sourceIds.push(id);
      bindings.push({ ownerId: instance.id, sourceId: id, region: wood.id, cell: anchor.cell, nativeAnchorId: anchor.id });
    }
    for (const attachment of plant.attachments) {
      let supportOwnerId; let supportId; let target;
      if (attachment.supportKind === 'wood') {
        assertOccupied(wood, attachment.supportCell); supportOwnerId = instance.id; supportId = cellId('wood', attachment.supportCell);
        sourceIds.push(supportId); target = attachment.supportCell;
        bindings.push({ ownerId: instance.id, sourceId: supportId, region: wood.id, cell: attachment.supportCell });
      } else {
        const global = attachment.supportCell; const local = global.map((v, axis) => v - CROP.sourceOffset[axis]);
        assertOccupied(volume, local); supportOwnerId = terrain.ownerId; supportId = cellId('slot', global); terrain.sourceIds.push(supportId);
        bindings.push({ ownerId: terrain.ownerId, sourceId: supportId, region: volume.id, cell: local, nativeGlobalCell: global });
        target = [Math.floor(decor.dimensions[0] / 2), 16, Math.floor(decor.dimensions[2] / 2)];
      }
      const decorCell = nearestOccupied(decor, target); const decorId = cellId('decor', decorCell); sourceIds.push(decorId);
      bindings.push({ ownerId: instance.id, sourceId: decorId, region: decor.id, cell: decorCell, nativeAttachmentId: attachment.id });
      attachments.push({ id: attachment.id, ownerId: instance.id, sourceIds: [decorId], supportOwnerId, supportIds: [supportId] });
    }
    objects.push({ ownerId: instance.id, sourceRevision: 0, sourceNamespace: 'hvp-plant-component-local-slot-v3',
      sourceIds: [...new Set(sourceIds)], frame: frame(instance.id, vec(instance.position)), volumes, meshes });
    const after = [plant.wood, plant.decoration].filter(Boolean).map(v => ({ bytes: v.byteLength, sha256: sha(v.copySlots()) }));
    if (JSON.stringify(before) !== JSON.stringify(after)) { throw new Error('Native plant source mutation/detach'); }
    plantProofs.push({ id: instance.id, kind: instance.kind, positionMeters: vec(instance.position), nativeSemanticDigest: plant.digest,
      sourceBuffersBefore: before, sourceBuffersAfter: after, nativeDecorationPhysics: plant.decorationPhysics,
      meshes: products.map(p => ({ positionsSha256: sha(new Uint8Array(p.mesh.positions.buffer, p.mesh.positions.byteOffset, p.mesh.positions.byteLength)),
        nativeArtifactSourceRevision: p.artifact.sourceRevision, nativeArtifactRevision: p.artifact.artifactRevision,
        normalsSha256: sha(new Uint8Array(p.mesh.normals.buffer, p.mesh.normals.byteOffset, p.mesh.normals.byteLength)),
        colorsSha256: sha(new Uint8Array(p.mesh.colors.buffer, p.mesh.colors.byteOffset, p.mesh.colors.byteLength)),
        unitFaces: p.mesh.unitFaceCount, greedyFaces: p.mesh.faceCount })) });
  }
  terrain.sourceIds = [...new Set(terrain.sourceIds)];
  // Same native top-below-sea policy, evaluated only on the crop's columns. No
  // far/join mask or unknown source becomes coverage through this water mesh.
  const waterCells = new Uint8Array(sx * sz);
  for (let z = 0; z < sz; z += 1) {
    for (let x = 0; x < sx; x += 1) {
      let top = 0;
      for (let y = source.sizeY - 1; y >= 0; y -= 1) {
        if (nativeSlots[x + ox + source.sizeX * (y + source.sizeY * (z + oz))]) { top = y + 1; break; }
      }
      if (top > 0 && source.originMeters.y + top * 0.125 < -1e-9) { waterCells[x + sx * z] = 1; }
    }
  }
  const water = mesher.meshHvpWaterPatch(waterCells, sx, sz, 0.125, { x: -8, z: -8 }, source.sourceDigest);
  materials.push(nativeMaterial('hvp-water', 'water-presentation', profile.water.materialProfile));
  if (water.positions.length) {
    objects.push({ ownerId: 'hvp:water', sourceRevision: 0, sourceNamespace: 'hvp-water-crop-presentation-v2', sourceIds: ['crop-water-mask'],
      frame: frame('hvp:water'), volumes: [], meshes: [{ id: 'coast-water', materialId: 'hvp-water', positions: water.positions,
        normals: water.normals, indices: water.indices, presentationOnly: true }] });
  }
  const cameraSource = staged.sources.find(s => s.path.endsWith('/hvpCamera.ts'));
  const effectsSource = staged.sources.find(s => s.path.endsWith('/visualEffects.ts'));
  const effects = effectsSource.bytes.toString('utf8');
  if (!/toneMapping\s*=\s*THREE\.ACESFilmicToneMapping/.test(effects)) { throw new Error('Native tone mapping not resolved'); }
  const exposure = Number(effects.match(/toneMappingExposure\s*=\s*([\d.]+)/)?.[1]);
  if (!(exposure > 0)) { throw new Error('Native exposure not resolved'); }
  const rendererBytes = readFileSync(path.join(LAB, 'node_modules/three/src/renderers/WebGLRenderer.js'));
  if (!/_outputColorSpace\s*=\s*SRGBColorSpace/.test(rendererBytes.toString('utf8'))) { throw new Error('Pinned Three output color space not resolved'); }
  const presentation = { id: profile.id, sourcePaths: [staged.sources.find(s => s.path.endsWith('/look.ts')).path, effectsSource.path],
    materialColorSpace: 'linear-srgb', outputColorSpace: 'srgb', toneMapping: 'aces-filmic', exposure,
    lighting: Object.fromEntries(Object.entries(profile.lighting).map(([role, light]) => [role, { colorSrgb24: light.color,
      ...(role === 'ambient' ? { groundColorSrgb24: light.groundColor } : {}), intensity: light.intensity, positionMeters: vec(light.position) }])),
    background: { colorSrgb24: profile.background.color, fogNearMeters: profile.background.fogNear, fogFarMeters: profile.background.fogFar } };
  const input = { id: 'F01-HVP-COAST', kind: 'product-derived', sourceRevision: 0, quantumMeters: 0.125, frame: frame('hvp:coast-frame'),
    sourceRefs: [{ kind: 'product', repository: 'BenjaminHornung/Weltraum-Spiel', commit: BASE,
      files: sorted(staged.sources.map(({ bytes, ...ref }) => ref), ref => ref.path),
      generatorVersion: `${source.version}+${vegetation.HVP_VEGETATION_VERSION}`, sourceDigest: source.sourceDigest }],
    materials, presentation, objects, attachments, cameras: extractCameras(cameraSource.bytes.toString('utf8')) };
  const bundle = { ...await exportFixture(input, staged.contracts), group: 'F01-HVP-COAST', revisionLabel: 'native-crop', mode: 'presentation-replay',
    cases: { nativeCoastVersion: source.version, nativeSeed: source.seedName, nativeSemanticDigest: source.sourceDigest,
      nativeRegistryDigest: source.registryDigest, nativeSourceSlotBytes: nativeSlots.byteLength, nativeSourceSlotSha256: nativeSha,
      crop: CROP, cropMaterialSlotSha256: sha(slots), boundaryPolicy: 'open-mesh-presentation; no-ghost/no-join; outside-unknown',
      nativePlantBindings: sorted(bindings, b => `${b.ownerId}/${b.sourceId}/${b.nativeAttachmentId ?? ''}`),
      nativeVegetationPalettesLinearRgb: extractVegetationPalettes(staged.sources.find(s => s.path.endsWith('/vegetation.ts')).bytes.toString('utf8')),
      rawPlantMaterialSlots: 'wood material slot or decoration tone index into its native species palette; occupancy and vertex colors are separate payloads',
      plants: sorted(plantProofs, p => p.id), terrainMesh: { unitFaces: terrainMesh.unitFaceCount, greedyFaces: terrainMesh.faceCount,
        algorithmVersion: terrainMesh.algorithmVersion }, water: { presentationOnly: true, maskSha256: sha(waterCells), joinAndFarExcluded: true },
      rendererDefaults: { library: 'three', pinnedVersion: '0.185.1', WebGLRendererSha256: sha(rendererBytes), outputColorSpace: 'srgb' },
      projectionLimits: ['profile is data, not implemented PCF/sky/water passes', 'native crop not complete HVP runtime', 'no solver/mass/save/cut authority'] } };
  const afterNative = source.copySlots();
  if (sha(afterNative) !== nativeSha || afterNative.byteLength !== nativeSlots.byteLength || nativeSlots.buffer.byteLength === 0) {
    throw new Error('Native coast source mutation/detach');
  }
  return { bundle, scenario: await replay(bundle.group, [bundle], staged.contracts),
    diagnostic: { wallMilliseconds: performance.now() - started, nativeSourceSha256: nativeSha, nativeSourceBytes: nativeSlots.byteLength,
      afterNativeSourceSha256: sha(afterNative), sourceMutation: false, sourceDetached: false, payloadBytes: bundle.payloadBytes } };
}
