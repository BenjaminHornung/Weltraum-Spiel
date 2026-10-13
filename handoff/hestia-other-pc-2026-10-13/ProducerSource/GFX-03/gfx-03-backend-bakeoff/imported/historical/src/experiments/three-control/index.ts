import { BufferAttribute, BufferGeometry, Color, DoubleSide, FrontSide, Group, LinearSRGBColorSpace, Mesh, MeshLambertMaterial } from 'three';
import { copyFixturePayload, fixtureRevision, getFixtureDigest, type LabFixtureV1, type LabTypedPayload } from '../../contracts/fixture';
import { createFrameInput, validateFacts, type LabExperimentContext, type LabPreset } from '../../contracts/experiment';
import type { LabMetric } from '../../contracts/result';
import { requireValue } from '../../contracts/validation';
import { createThreeLabHost, type ThreeLabEffect, type ThreeLabEffectContext } from '../../runner/threeHost';

// Projection only: canonical Float64 bytes (including the 1.8 m F05 marker) remain private and unchanged.
export const GPU_PROJECTION_TOLERANCE_METERS = 1e-5;
export function projectFloat32(values: LabTypedPayload): Float32Array<ArrayBuffer> {
  requireValue(values instanceof Float32Array || values instanceof Float64Array, 'Expected floating-point projection input');
  const projected = new Float32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    projected[index] = values[index];
    requireValue(Number.isFinite(projected[index]) && Math.abs(projected[index] - values[index]) <= GPU_PROJECTION_TOLERANCE_METERS, 'Float32 GPU projection exceeds declared 1e-5 tolerance');
  }
  return projected;
}
const measured = (value: number, unit = 'count'): LabMetric => ({ status: 'measured', value, unit });

function buildProjection(fixture: LabFixtureV1, signal: AbortSignal, projection: 'all'|'solid'|'decor'='all') {
  getFixtureDigest(fixture); signal.throwIfAborted(); const root = new Group();
  root.position.set(...fixture.frame.originMeters); root.quaternion.set(...fixture.frame.rotationXyzw);
  const geometries: BufferGeometry[] = []; const materials: MeshLambertMaterial[] = []; let bufferBytes = 0; let triangles = 0;
  function dispose() { root.removeFromParent(); root.clear(); geometries.forEach((geometry) => { geometry.dispose(); }); materials.forEach((material) => { material.dispose(); }); }
  try {
    for (const object of fixture.objects) {
      signal.throwIfAborted(); const owner = new Group(); owner.name = object.ownerId;
      owner.userData = { ownerId: object.ownerId, sourceNamespace: object.sourceNamespace, sourceRevision: object.sourceRevision };
      owner.position.set(...object.frame.originMeters); owner.quaternion.set(...object.frame.rotationXyzw); root.add(owner);
      for (const source of object.meshes) {
        const role=fixture.materials.find((material)=>material.id===source.materialId)!.role;
        const decor=['foliage','accent','reed'].includes(role);
        if((projection==='solid'&&decor)||(projection==='decor'&&!decor))continue;
        const geometry = new BufferGeometry(); geometries.push(geometry);
        const positions = projectFloat32(copyFixturePayload(fixture, source.positions));
        const indices = copyFixturePayload(fixture, source.indices);
        requireValue(indices instanceof Uint16Array || indices instanceof Uint32Array, 'Expected unsigned mesh indices');
        geometry.setAttribute('position', new BufferAttribute(positions, 3)); geometry.setIndex(new BufferAttribute(indices, 1));
        bufferBytes += positions.byteLength + indices.byteLength; triangles += indices.length / 3;
        if (source.normals) {
          const normals = projectFloat32(copyFixturePayload(fixture, source.normals)); geometry.setAttribute('normal', new BufferAttribute(normals, 3)); bufferBytes += normals.byteLength;
        } else { geometry.computeVertexNormals(); bufferBytes += geometry.getAttribute('normal').array.byteLength; }
        if (source.colors) {
          requireValue(source.colorSpace === 'linear-srgb', 'Vertex colors must be linear-sRGB');
          const colors = projectFloat32(copyFixturePayload(fixture, source.colors)); geometry.setAttribute('color', new BufferAttribute(colors, 3)); bufferBytes += colors.byteLength;
        }
        geometry.addGroup(0, indices.length, 0); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const declared = fixture.materials.find((material) => material.id === source.materialId)!;
        const material = new MeshLambertMaterial({ color: new Color().setRGB(...declared.colorLinearRgb, LinearSRGBColorSpace),
          vertexColors: Boolean(source.colors), opacity: declared.opacity ?? 1, transparent: (declared.opacity ?? 1) < 1,
          depthWrite: declared.depthWrite ?? true, side: declared.doubleSided ? DoubleSide : FrontSide });
        if (declared.role === 'emission') { material.emissive.copy(material.color); }
        materials.push(material); const mesh = new Mesh(geometry, [material]); mesh.name = `${object.ownerId}:${source.materialId}`;
        if (declared.role === 'water-presentation') { mesh.renderOrder = 1; }
        mesh.userData.presentationOnly = source.presentationOnly ?? false; owner.add(mesh);
      }
    }
    return { root, geometries, materials, bufferBytes, triangles, dispose };
  } catch (error) { dispose(); throw error; }
}

/** The future effect seam: use context.root; do not create a renderer, camera, loop or shader-hook chain. */
export async function mountThreeEffect(context: ThreeLabEffectContext, preset: LabPreset): Promise<ThreeLabEffect> {
  requireValue(preset.id === 'fixture-control', 'Unknown Three control variant; no quality fallback');
  const selection=preset.parameters?.projection??'all';requireValue(selection==='all'||selection==='solid'||selection==='decor','Unknown projection ownership');
  let fixture = context.fixture; let projection = buildProjection(fixture, context.signal,selection); let generation = 0; let disposed = false;
  context.root.add(projection.root);
  return {
    setFrame(input) {
      context.signal.throwIfAborted(); requireValue(!disposed, 'Effect disposed'); const frame = createFrameInput(input);
      requireValue(frame.sourceRevision === fixtureRevision(fixture), 'Stale effect frame');
      // Static projection: resetTick/backward seek has no historical cache to carry over.
    },
    async replaceFixture(next) {
      context.signal.throwIfAborted(); requireValue(!disposed, 'Effect disposed'); const version = ++generation;
      const candidate = buildProjection(next, context.signal,selection);
      // An async boundary tests late cancellation without ever attaching a half-built candidate.
      await Promise.resolve();
      try { context.signal.throwIfAborted(); requireValue(!disposed && version === generation, 'Stale/aborted effect replacement'); }
      catch (error) { candidate.dispose(); throw error; }
      context.root.add(candidate.root); projection.dispose(); projection = candidate; fixture = next;
    },
    readFacts() {
      requireValue(!disposed, 'Effect disposed');
      return validateFacts({ experimentId: 'RD-03', variantId: preset.id, backend: 'Three-WebGLRenderer-WebGL2',
        fixtureDigest: getFixtureDigest(fixture), sourceRevision: fixtureRevision(fixture),
        liveResources: { geometries: measured(projection.geometries.length), materials: measured(projection.materials.length), textures: measured(0) },
        logicalCosts: { projectionBufferBytes: { status: 'estimated', value: projection.bufferBytes, unit: 'byte', reason: 'Typed attribute/index bytes; excludes GPU allocator, driver and shaders' },
          triangles: measured(projection.triangles), gpuBytes: { status: 'unsupported', unit: 'byte', reason: 'Native GPU memory is not exposed by WebGL' } },
        unsupportedFeatures: ['native-pcf-shadow-parity', 'native-sky-shader-parity', 'native-water-shader-parity', 'native-material-shader-hooks'], errors: [] });
    },
    async dispose() { if (!disposed) { disposed = true; generation += 1; projection.dispose(); } },
  };
}

export async function createThreeControlExperiment(context: LabExperimentContext) {
  requireValue(Object.keys(context.preset.parameters ?? {}).every((key) => ['width', 'height', 'dpr'].includes(key)), 'Unsupported control parameters; no quality fallback');
  return createThreeLabHost(context, [{ mount: mountThreeEffect, preset: context.preset }]);
}
