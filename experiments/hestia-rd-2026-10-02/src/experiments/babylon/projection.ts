import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Material } from '@babylonjs/core/Materials/material.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import type { Light } from '@babylonjs/core/Lights/light.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { copyFixturePayload, getFixtureDigest, type LabFrame, type LabFixtureV1, type Vec3 } from '../../contracts/fixture';
import { requireValue } from '../../contracts/validation';
export const FLOAT32_TOLERANCE = 1e-5;
export const UNSUPPORTED_FEATURES = ['native-pcf-shadow-parity', 'native-ao-recompute-parity', 'native-water-shader-parity', 'native-sky-shader-parity', 'native-material-shader-hooks', 'native-weather-hook-parity', 'lambert-brdf-parity', 'output-color-equivalence', 'effective-sample-equivalence', 'canvas-alpha-equivalence'];
export interface BabylonProjection {
  readonly root: TransformNode; readonly meshes: Mesh[]; readonly materials: StandardMaterial[]; readonly lights: Light[];
  readonly bufferBytes: number; readonly triangles: number; readonly presentation: ReturnType<typeof presentationFor>;
  setEnabled(enabled: boolean): void; setLightsEnabled(enabled: boolean): void; dispose(): void;
}
interface OwnedMeshMetadata { ownerId: string; meshIndex: number; sourceNamespace: string; sourceRevision: number; sourceIds: string[]; materialId: string; fixtureDigest: string; sourceColors: boolean }
// 9.29.0 forceCompilationAsync owns an uncancellable 16ms poll, and dispose
// does not clear Material._scene. Stop its NEXT check after owner disposal.
// This sentinel only settles discarded compile work; the host cannot adopt it.
class OwnedStandardMaterial extends StandardMaterial {
  private closed = false;
  override isReadyForSubMesh(...args: Parameters<StandardMaterial['isReadyForSubMesh']>): boolean { return this.closed || super.isReadyForSubMesh(...args); }
  override dispose(...args: Parameters<StandardMaterial['dispose']>): void { if (!this.closed) { this.closed = true; super.dispose(...args); } }
}
function floats(fixture: LabFixtureV1, payload: string): Float32Array {
  const source = copyFixturePayload(fixture, payload); requireValue(source instanceof Float32Array || source instanceof Float64Array, 'Floating source payload required');
  const projected = new Float32Array(source);
  for (let index = 0; index < source.length; index += 1) { requireValue(Math.abs(source[index] - projected[index]) <= FLOAT32_TOLERANCE, 'Float32 projection exceeds 1e-5 source-unit tolerance'); }
  return projected;
}
function transform(node: TransformNode, frame: LabFrame): void {
  node.position.copyFromFloats(...frame.originMeters); node.rotationQuaternion = new Quaternion(...frame.rotationXyzw); // Exact supplied quaternion, no normalize/mirror.
}
export function srgb24Linear(value: number): Color3 {
  const channel = (byte: number) => { const value01 = byte / 255; return value01 <= 0.04045 ? value01 / 12.92 : ((value01 + 0.055) / 1.055) ** 2.4; };
  return new Color3(channel(value >>> 16 & 255), channel(value >>> 8 & 255), channel(value & 255));
}
function presentationFor(fixture: LabFixtureV1) {
  const profile = fixture.presentation;
  return { profileId: profile?.id ?? 'synthetic-control-defaults', toneMapping: profile?.toneMapping ?? 'none', exposure: profile?.exposure ?? 1,
    materialColorSpace: 'linear-srgb', outputColorSpace: 'srgb', outputEquivalence: 'UNSUPPORTED',
    sdkToneMapper: profile?.toneMapping === 'aces-filmic' ? 'Babylon-ACES-approximation' : profile?.toneMapping === 'reinhard' ? 'UNSUPPORTED-reinhard' : 'none',
    fog: profile ? { near: profile.background.fogNearMeters, far: profile.background.fogFarMeters } : null,
    background: profile?.background.colorSrgb24 ?? 0x192430,
    lights: [
      { role: 'ambient', ...(profile?.lighting.ambient ?? { colorSrgb24: 0xffffff, groundColorSrgb24: 0x444444, intensity: 0.85, positionMeters: [0, 1, 0] as Vec3 }) },
      { role: 'key', ...(profile?.lighting.key ?? { colorSrgb24: 0xffffff, intensity: 2, positionMeters: [-10, 20, -10] as Vec3 }) },
      { role: 'fill', ...(profile?.lighting.fill ?? { colorSrgb24: 0xffffff, intensity: 0.5, positionMeters: [10, 8, 10] as Vec3 }) },
    ],
  };
}
export function applyPresentation(scene: Scene, presentation: BabylonProjection['presentation']): void {
  const background = srgb24Linear(presentation.background);
  // Engine.clear / WebGPU clearValue bypass material image processing. These
  // output channels retain the declared sRGB24; shader fog/lights stay linear.
  const output = Color3.FromInts(presentation.background >>> 16 & 255, presentation.background >>> 8 & 255, presentation.background & 255);
  scene.clearColor = new Color4(output.r, output.g, output.b, 1);
  scene.fogMode = presentation.fog ? Scene.FOGMODE_LINEAR : Scene.FOGMODE_NONE; scene.fogColor = background;
  if (presentation.fog) { scene.fogStart = presentation.fog.near; scene.fogEnd = presentation.fog.far; }
  const image = scene.imageProcessingConfiguration; image.applyByPostProcess = false; image.exposure = presentation.exposure;
  image.toneMappingEnabled = presentation.toneMapping === 'aces-filmic'; image.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  // Packaged stock WGSL/GLSL image processing declares gamma output. Its BRDF,
  // vertex-color linearization and ACES curve are NOT proven C0 equivalence.
}
export function buildBabylonProjection(fixture: LabFixtureV1, scene: Scene, signal: AbortSignal): BabylonProjection {
  getFixtureDigest(fixture); signal.throwIfAborted();
  const root = new TransformNode(`RD12:${fixture.id}`, scene); root.setEnabled(false); transform(root, fixture.frame);
  const meshes: Mesh[] = []; const materials: StandardMaterial[] = []; const lights: Light[] = [];
  let disposed = false; let bufferBytes = 0; let triangles = 0; const presentation = presentationFor(fixture);
  const projection: BabylonProjection = { root, meshes, materials, lights, get bufferBytes() { return bufferBytes; }, get triangles() { return triangles; }, presentation,
    setEnabled(enabled) { requireValue(!disposed, 'Projection disposed'); root.setEnabled(enabled); for (const mesh of meshes) { mesh.setEnabled(enabled); } projection.setLightsEnabled(enabled); },
    setLightsEnabled(enabled) { for (const light of lights) { light.setEnabled(enabled); } },
    dispose() { if (!disposed) { disposed = true; root.dispose(false, false); for (const material of materials) { material.dispose(true, true); } for (const light of lights) { light.dispose(); } } },
  };
  try {
    for (const declared of fixture.materials) {
      const material = new OwnedStandardMaterial(declared.id, scene); materials.push(material);
      material.diffuseColor = new Color3(...declared.colorLinearRgb); material.specularColor = Color3.Black(); material.alpha = declared.opacity ?? 1;
      material.disableDepthWrite = !(declared.depthWrite ?? true); material.backFaceCulling = !declared.doubleSided;
      material.transparencyMode = material.alpha < 1 || declared.role === 'water-presentation' ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_OPAQUE;
      if (declared.role === 'emission') { material.emissiveColor = new Color3(...declared.colorLinearRgb); }
    }
    for (const owner of fixture.objects) {
      signal.throwIfAborted(); const ownerNode = new TransformNode(owner.ownerId, scene); ownerNode.parent = root; transform(ownerNode, owner.frame);
      for (const [meshIndex, source] of owner.meshes.entries()) {
        const mesh = new Mesh(`${owner.ownerId}:${meshIndex}`, scene); meshes.push(mesh); mesh.setEnabled(false); mesh.parent = ownerNode;
        mesh.sideOrientation = Material.CounterClockWiseSideOrientation;
        mesh.metadata = { ownerId: owner.ownerId, meshIndex, sourceNamespace: owner.sourceNamespace, sourceRevision: owner.sourceRevision,
          sourceIds: [...owner.sourceIds], materialId: source.materialId, fixtureDigest: getFixtureDigest(fixture), sourceColors: Boolean(source.colors) } satisfies OwnedMeshMetadata;
        const vertices = new VertexData(); vertices.positions = floats(fixture, source.positions);
        const indices = copyFixturePayload(fixture, source.indices); requireValue(indices instanceof Uint16Array || indices instanceof Uint32Array, 'Source index width required'); vertices.indices = indices;
        if (source.normals) { vertices.normals = floats(fixture, source.normals); }
        else { const normals: number[] = []; VertexData.ComputeNormals(vertices.positions, indices, normals, { useRightHandedSystem: true }); vertices.normals = new Float32Array(normals); }
        if (source.colors) {
          const rgb = floats(fixture, source.colors); const rgba = new Float32Array(rgb.length / 3 * 4);
          for (let vertex = 0; vertex < rgb.length / 3; vertex += 1) { rgba.set(rgb.subarray(vertex * 3, vertex * 3 + 3), vertex * 4); rgba[vertex * 4 + 3] = 1; }
          vertices.colors = rgba; // Babylon's stock color attribute is RGBA. Alpha=1; declared opacity remains material-owned.
        }
        vertices.applyToMesh(mesh, false); mesh.useVertexColors = Boolean(source.colors); mesh.hasVertexAlpha = false;
        mesh.material = materials.find((material) => material.name === source.materialId)!;
        const declared = fixture.materials.find((material) => material.id === source.materialId)!;
        mesh.alphaIndex = declared.role === 'water-presentation' ? 1 + meshes.length : 0;
        bufferBytes += vertices.positions.byteLength + indices.byteLength + (vertices.normals as Float32Array).byteLength + ((vertices.colors as Float32Array | undefined)?.byteLength ?? 0); triangles += indices.length / 3;
      }
    }
    for (const declared of presentation.lights) {
      const vector = new Vector3(...declared.positionMeters); const light = declared.role === 'ambient' ? new HemisphericLight('RD12:ambient', vector, scene) : new DirectionalLight(`RD12:${declared.role}`, vector.negate(), scene);
      lights.push(light); light.setEnabled(false); light.diffuse = srgb24Linear(declared.colorSrgb24); light.specular = Color3.Black(); light.intensity = declared.intensity;
      if (light instanceof HemisphericLight) { light.groundColor = srgb24Linear('groundColorSrgb24' in declared ? declared.groundColorSrgb24 : 0x444444); }
      else { light.position.copyFrom(vector); }
    }
    return projection;
  } catch (error) { projection.dispose(); throw error; }
}
export function retainedBufferFacts(projection: BabylonProjection) {
  return projection.meshes.map((mesh) => ({ ...mesh.metadata as OwnedMeshMetadata, vertices: mesh.getTotalVertices(), indices: mesh.getTotalIndices(),
    normals: mesh.getVertexBuffer(VertexBuffer.NormalKind)?.getSize() ?? 0, colorStride: mesh.getVertexBuffer(VertexBuffer.ColorKind)?.getSize() ?? 0,
    ownerPose: { positionMeters: (mesh.parent as TransformNode).position.asArray(), rotationXyzw: (mesh.parent as TransformNode).rotationQuaternion!.asArray() },
    rootPose: { positionMeters: projection.root.position.asArray(), rotationXyzw: projection.root.rotationQuaternion!.asArray() },
    evidence: 'SDK-retained-attributes/owner transforms; NOT native mapped GPU readback' as const,
  }));
}
