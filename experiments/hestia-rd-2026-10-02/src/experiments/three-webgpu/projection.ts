import { ACESFilmicToneMapping, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, Fog,
  FrontSide, Group, HemisphereLight, LinearSRGBColorSpace, Mesh, NoToneMapping, ReinhardToneMapping, Scene } from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { materialColor, materialEmissive, materialOpacity } from 'three/tsl';
import { copyFixturePayload, getFixtureDigest, type LabFixtureV1 } from '../../contracts/fixture';
import { requireValue } from '../../contracts/validation';
import { projectFloat32 } from '../three-control';

export const UNSUPPORTED_FEATURES = Object.freeze(['native-pcf-shadow-parity', 'native-sky-shader-parity',
  'native-water-shader-parity', 'native-material-shader-hooks', 'native-ao-recompute-parity', 'weather-material-shader-parity']);

/** Detached presentation only; immutable canonical bytes never become renderer-owned buffers. */
export function buildNodeProjection(fixture: LabFixtureV1, signal: AbortSignal) {
  getFixtureDigest(fixture); signal.throwIfAborted();
  const root = new Group(); root.position.set(...fixture.frame.originMeters); root.quaternion.set(...fixture.frame.rotationXyzw);
  const geometries: BufferGeometry[] = []; const materials: MeshLambertNodeMaterial[] = [];
  let bufferBytes = 0; let triangles = 0; let disposed = false;
  function dispose() {
    if (disposed) { return; } disposed = true; root.removeFromParent(); root.clear();
    for (const geometry of geometries) { geometry.dispose(); }
    for (const material of materials) { material.dispose(); }
  }
  try {
    for (const sourceOwner of fixture.objects) {
      signal.throwIfAborted(); const owner = new Group(); owner.name = sourceOwner.ownerId;
      owner.userData = { ownerId: sourceOwner.ownerId, sourceNamespace: sourceOwner.sourceNamespace, sourceRevision: sourceOwner.sourceRevision };
      owner.position.set(...sourceOwner.frame.originMeters); owner.quaternion.set(...sourceOwner.frame.rotationXyzw); root.add(owner);
      for (const source of sourceOwner.meshes) {
        const geometry = new BufferGeometry(); geometries.push(geometry);
        const positions = projectFloat32(copyFixturePayload(fixture, source.positions)); const indices = copyFixturePayload(fixture, source.indices);
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
        const declared = fixture.materials.find((entry) => entry.id === source.materialId)!;
        const material = new MeshLambertNodeMaterial({ color: new Color().setRGB(...declared.colorLinearRgb, LinearSRGBColorSpace),
          vertexColors: Boolean(source.colors), opacity: declared.opacity ?? 1, transparent: (declared.opacity ?? 1) < 1,
          depthWrite: declared.depthWrite ?? true, side: declared.doubleSided ? DoubleSide : FrontSide });
        // NodeMaterial multiplies this by vertexColor once; no full-color/shader substitute.
        material.colorNode = materialColor; material.opacityNode = materialOpacity;
        if (declared.role === 'emission') { material.emissive.copy(material.color); material.emissiveNode = materialEmissive; }
        materials.push(material); const mesh = new Mesh(geometry, [material]); mesh.name = `${sourceOwner.ownerId}:${source.materialId}`;
        mesh.userData = { materialId: source.materialId, role: declared.role, presentationOnly: source.presentationOnly ?? false };
        if (declared.role === 'water-presentation') { mesh.renderOrder = 1; } owner.add(mesh);
      }
    }
    return { root, geometries, materials, bufferBytes, triangles, dispose, get disposed() { return disposed; } };
  } catch (error) { dispose(); throw error; }
}

export function buildLights(fixture: LabFixtureV1) {
  const root = new Group(); root.position.set(...fixture.frame.originMeters); root.quaternion.set(...fixture.frame.rotationXyzw);
  const profile = fixture.presentation; const ambient = profile?.lighting.ambient;
  const hemisphere = new HemisphereLight(ambient?.colorSrgb24 ?? 0xffffff, ambient?.groundColorSrgb24 ?? 0x444444, ambient?.intensity ?? 0.85);
  hemisphere.position.set(...(ambient?.positionMeters ?? [0, 1, 0])); root.add(hemisphere);
  for (const role of ['key', 'fill'] as const) {
    const source = profile?.lighting[role]; const light = new DirectionalLight(source?.colorSrgb24 ?? 0xffffff, source?.intensity ?? (role === 'key' ? 2 : 0.5));
    light.position.set(...(source?.positionMeters ?? (role === 'key' ? [-10, 20, -10] : [10, 8, 10]))); root.add(light, light.target);
  }
  return root;
}

export function configurePresentation(fixture: LabFixtureV1, scene: Scene, renderer: { toneMapping: number; toneMappingExposure: number }) {
  const profile = fixture.presentation;
  renderer.toneMapping = profile?.toneMapping === 'aces-filmic' ? ACESFilmicToneMapping : profile?.toneMapping === 'reinhard' ? ReinhardToneMapping : NoToneMapping;
  renderer.toneMappingExposure = profile?.exposure ?? 1;
  scene.background = new Color(profile?.background.colorSrgb24 ?? 0x192430);
  scene.fog = profile ? new Fog(profile.background.colorSrgb24, profile.background.fogNearMeters, profile.background.fogFarMeters) : null;
}

export function projectionSnapshot(projection: ReturnType<typeof buildNodeProjection>) {
  return projection.root.children.map((owner) => ({ ...owner.userData, position: owner.position.toArray(), rotation: owner.quaternion.toArray(),
    meshes: owner.children.map((object) => {
      const mesh = object as Mesh<BufferGeometry, MeshLambertNodeMaterial[]>; const material = mesh.material[0];
      return { name: mesh.name, ...mesh.userData, renderOrder: mesh.renderOrder, triangles: mesh.geometry.index!.count / 3,
        attributes: Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([id, value]) => [id, { count: value.count, version: (value as BufferAttribute).version }])),
        material: { type: material.type, color: material.color.toArray(), vertexColors: material.vertexColors, opacity: material.opacity,
          transparent: material.transparent, depthWrite: material.depthWrite, depthTest: material.depthTest, side: material.side,
          emissive: material.emissive.toArray(), fog: material.fog, colorNode: material.colorNode !== null, opacityNode: material.opacityNode !== null } };
    }) }));
}
