import { createHash } from 'node:crypto';

export const MANIFEST_CAP = 1_048_576;
export const PAYLOAD_CAP = 134_217_728;
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const sorted = (items, key) => [...items].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
export const frame = (id, originMeters = [0, 0, 0], rotationXyzw = [0, 0, 0, 1]) =>
  ({ id, originMeters, rotationXyzw, basis: 'right-handed-y-up' });
export function cellCount(dimensions) {
  const count = dimensions.reduce((a, b) => a * b, 1);
  if (dimensions.length !== 3 || dimensions.some(v => !Number.isSafeInteger(v) || v <= 0)
    || !Number.isSafeInteger(count) || count * 3 > PAYLOAD_CAP) {
    throw new Error('Scene payload exceeds 128 MiB');
  }
  return count;
}
function cap(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes > PAYLOAD_CAP) { throw new Error('Scene payload exceeds 128 MiB'); }
}
const scalarTypes = new Map([[Uint8Array, ['uint8', 'setUint8']], [Uint16Array, ['uint16', 'setUint16']],
  [Uint32Array, ['uint32', 'setUint32']], [Int32Array, ['int32', 'setInt32']],
  [Float32Array, ['float32', 'setFloat32']], [Float64Array, ['float64', 'setFloat64']]]);
export function encodeTyped(values, byteOrder = 'little') {
  cap(values.byteLength);
  const type = scalarTypes.get(values.constructor);
  if (!type) { throw new Error('Unsupported typed payload'); }
  const bytes = new Uint8Array(values.byteLength);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i += 1) { view[type[1]](i * values.BYTES_PER_ELEMENT, values[i], byteOrder === 'little'); }
  return bytes;
}
export function boundedJson(value, canonicalJson) {
  const json = canonicalJson(value);
  if (Buffer.byteLength(json, 'utf8') > MANIFEST_CAP) { throw new Error('Manifest exceeds 1 MiB'); }
  return new TextEncoder().encode(json);
}

function at(volume, x, y, z) {
  const [sx, sy, sz] = volume.dimensions;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) { return 0; }
  return volume.slots[x + sx * (y + sy * z)];
}
function faces(volume, visit) {
  const [sx, sy, sz] = volume.dimensions;
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        const slot = at(volume, x, y, z);
        if (!slot) { continue; }
        for (let axis = 0; axis < 3; axis += 1) {
          for (const sign of [-1, 1]) {
            const neighbor = [x, y, z]; neighbor[axis] += sign;
            if (!at(volume, ...neighbor)) { visit(slot, x, y, z, axis, sign); }
          }
        }
      }
    }
  }
}
function faceCounts(volume) {
  const counts = new Map();
  faces(volume, slot => counts.set(slot, (counts.get(slot) ?? 0) + 1));
  return counts;
}
// ponytail: unit faces for small synthetic controls; use a separately measured
// greedy candidate when these labeled controls cease to fit the frozen lab cap.
function meshUnitFaces(volume, quantum, counts) {
  const meshes = new Map([...counts].map(([slot, count]) => [slot, { id: `${volume.id}-slot-${slot}`,
    materialId: volume.materialIds[slot - 1], positions: new Float32Array(count * 12),
    normals: new Float32Array(count * 12), indices: new Uint32Array(count * 6), offset: 0 }]));
  faces(volume, (slot, x, y, z, axis, sign) => {
    const mesh = meshes.get(slot); const first = mesh.offset * 4;
    const u = (axis + 1) % 3; const v = (axis + 2) % 3;
    const corners = sign === 1 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
    for (let i = 0; i < 4; i += 1) {
      const p = [x, y, z]; p[axis] += sign === 1 ? 1 : 0; p[u] += corners[i][0]; p[v] += corners[i][1];
      for (let j = 0; j < 3; j += 1) {
        mesh.positions[(first + i) * 3 + j] = volume.originMeters[j] + p[j] * quantum;
        mesh.normals[(first + i) * 3 + j] = axis === j ? sign : 0;
      }
    }
    mesh.indices.set([first, first + 1, first + 2, first, first + 2, first + 3], mesh.offset * 6);
    mesh.offset += 1;
  });
  return [...meshes.values()];
}

/**
 * @param {any} input
 * @param {any} contracts
 * @returns {Promise<{manifest: import('../src/contracts/fixture').LabFixtureV1, manifestBytes: Uint8Array,
 * payloads: Map<string, Uint8Array>, fixture: import('../src/contracts/fixture').LabFixtureV1,
 * recipeRegions: any[], payloadBytes: number, fixtureDigest: string}>}
 */
export async function exportFixture(input, contracts) {
  contracts.validateSourceRefs(input.sourceRefs, input.kind);
  const objects = sorted(input.objects, o => o.ownerId);
  let advertisedBytes = 0; let meshCount = 0; let volumeCount = 0;
  const borrowedMeshArrays = new Set();
  const plans = new Map();
  for (const object of objects) {
    for (const volume of object.volumes ?? []) {
      const count = cellCount(volume.dimensions); advertisedBytes += count * 3; cap(advertisedBytes);
      if (!(volume.slots instanceof Uint8Array) || !(volume.coverage instanceof Uint8Array)
        || volume.slots.length !== count || volume.coverage.length !== count) { throw new Error('Volume size mismatch'); }
      for (let i = 0; i < count; i += 1) {
        if (volume.coverage[i] > 1 || (volume.slots[i] > 0 && volume.coverage[i] !== 1)
          || volume.slots[i] > volume.materialIds.length) { throw new Error('Invalid source occupancy/coverage/material slot'); }
      }
      volumeCount += 1;
      if (!object.meshes) {
        const counts = faceCounts(volume); plans.set(volume, counts); meshCount += counts.size;
        advertisedBytes += [...counts.values()].reduce((a, b) => a + b, 0) * 120; cap(advertisedBytes);
      }
    }
    for (const mesh of object.meshes ?? []) {
      meshCount += 1;
      for (const type of ['positions', 'normals', 'indices', 'colors']) {
        if (mesh[type] && !borrowedMeshArrays.has(mesh[type])) {
          borrowedMeshArrays.add(mesh[type]); advertisedBytes += mesh[type].byteLength; cap(advertisedBytes);
        }
      }
    }
  }
  // Conservative manifest reservation precedes generated mesh/occupancy/encoded
  // buffers. Actual canonical manifest is checked again before encoding/copying.
  const metadata = { ...input, objects: objects.map(({ volumes, meshes, ...o }) => o) };
  if (Buffer.byteLength(contracts.canonicalJson(metadata)) + volumeCount * 1500 + meshCount * 2500 > MANIFEST_CAP) {
    throw new Error('Manifest exceeds 1 MiB');
  }
  const payloads = new Map(); const descriptors = []; const regions = []; const recipeRegions = [];
  const meshPayloadIds = new Map();
  let actualBytes = 0;
  function add(id, values) {
    contracts.id(id);
    if (payloads.has(id)) { throw new Error('Duplicate payload ID'); }
    actualBytes += values.byteLength; cap(actualBytes);
    const bytes = encodeTyped(values);
    payloads.set(id, bytes);
    descriptors.push({ id, path: `payloads/${id}.bin`, elementType: scalarTypes.get(values.constructor)[0],
      byteOrder: 'little', length: values.length, byteLength: values.byteLength, sha256: sha(bytes) });
    return id;
  }
  function addMesh(id, values) {
    if (meshPayloadIds.has(values)) { return meshPayloadIds.get(values); }
    const payloadId = add(id, values); meshPayloadIds.set(values, payloadId); return payloadId;
  }
  const projectedObjects = objects.map(object => {
    for (const volume of sorted(object.volumes ?? [], v => v.id)) {
      const occupancy = new Uint8Array(volume.slots.length);
      for (let i = 0; i < occupancy.length; i += 1) { occupancy[i] = volume.slots[i] > 0 ? 1 : 0; }
      regions.push({ id: volume.id, ownerId: object.ownerId, dimensions: volume.dimensions, originMeters: volume.originMeters,
        occupancyPayload: add(`${volume.id}-occupancy`, occupancy), knownCoveragePayload: add(`${volume.id}-coverage`, volume.coverage) });
      const slotsId = add(`${volume.id}-material-slots`, volume.slots);
      recipeRegions.push({ id: volume.id, materialSlotsPayload: slotsId, materialIds: volume.materialIds,
        coveragePolicy: volume.coveragePolicy ?? 'explicit-known-source-box; outside-unknown', addressing: 'X-fast: x+sx*(y+sy*z)' });
    }
    const projectedMeshes = object.meshes ?? (object.volumes ?? []).flatMap(volume => meshUnitFaces(volume, input.quantumMeters, plans.get(volume)));
    const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
    const meshes = sorted(projectedMeshes, m => m.id).map(mesh => {
      for (let i = 0; i < mesh.positions.length; i += 1) {
        min[i % 3] = Math.min(min[i % 3], mesh.positions[i]); max[i % 3] = Math.max(max[i % 3], mesh.positions[i]);
      }
      return { positions: addMesh(`${mesh.id}-positions`, mesh.positions), indices: addMesh(`${mesh.id}-indices`, mesh.indices),
        materialId: mesh.materialId, ...(mesh.normals ? { normals: addMesh(`${mesh.id}-normals`, mesh.normals) } : {}),
        ...(mesh.colors ? { colors: addMesh(`${mesh.id}-colors`, mesh.colors), colorSpace: 'linear-srgb' } : {}),
        ...(mesh.presentationOnly ? { presentationOnly: true } : {}) };
    });
    return { ownerId: object.ownerId, sourceRevision: object.sourceRevision, sourceNamespace: object.sourceNamespace,
      sourceIds: [...object.sourceIds].sort(), frame: object.frame,
      materialRoles: [...new Set(meshes.map(m => input.materials.find(material => material.id === m.materialId)?.role))].sort(),
      meshes, bounds: meshes.length ? { min, max } : { min: [0, 0, 0], max: [0, 0, 0] } };
  });
  const manifest = { schema: 'hestia-rd-fixture-v1', id: input.id, kind: input.kind, sourceRefs: input.sourceRefs,
    sourceRevision: input.sourceRevision, units: 'meter', quantumMeters: input.quantumMeters, frame: input.frame,
    ...(input.presentation ? { presentation: input.presentation } : {}), materials: sorted(input.materials, m => m.id),
    objects: projectedObjects, payloads: sorted(descriptors, p => p.id), voxelRegions: sorted(regions, r => r.id),
    attachments: sorted(input.attachments ?? [], a => a.id), cameras: sorted(input.cameras, c => c.id) };
  const manifestBytes = boundedJson(manifest, contracts.canonicalJson);
  const fixture = await contracts.importFixture(manifestBytes, payloads);
  return { manifest, manifestBytes, payloads, fixture, recipeRegions, payloadBytes: actualBytes,
    fixtureDigest: contracts.getFixtureDigest(fixture) };
}

export function exportImportedFixture(fixture, contracts) {
  contracts.getFixtureDigest(fixture);
  return { manifest: fixture, manifestBytes: boundedJson(fixture, contracts.canonicalJson),
    payloads: new Map(fixture.payloads.map(p => [p.id, encodeTyped(contracts.copyFixturePayload(fixture, p.id), p.byteOrder)])) };
}
