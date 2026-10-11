import cutter from "../../../../../art/factory/fp02/cutter/source.scene.json";
import former from "../../../../../art/factory/fp02/former/source.scene.json";
import powerKit from "../../../../../art/factory/fp01/power-kit/source.scene.json";
import {
  artifactRevision, canonicalSignature, createMeshArtifact, createMaterialProfile, deepFreezeMetadata,
  frameId, materialProfileId, representationKey, sourceRevision,
  type MeshArtifact, type MaterialProfile, type AxisAlignedBounds
} from "../../presentation";
import { createFp02CatalogInput, loadFactoryCatalog } from "../catalog/fp02Catalog";

export interface FactoryAssetDefinitionRef { readonly sourceId: string; readonly version: number; readonly digest: string; readonly instanceId?: string }
export interface FactoryAssetBox { readonly centerM: readonly number[]; readonly sizeM: readonly number[]; readonly material: string; readonly rotationZRadians?: number }
export interface FactoryAssetPart { readonly partId: string; readonly role: string; readonly boxes: readonly FactoryAssetBox[] }
export interface FactoryAssetPort { readonly sourceId: string; readonly role: string; readonly centerM: readonly number[]; readonly normal: readonly number[]; readonly sizeM: readonly number[]; readonly binding: "source-solid" | "authoring-only" }
export interface FactoryAssetSource {
  readonly assetId: string; readonly definitionId: string; readonly revision: number;
  readonly kind: "S0-proxy"; readonly frameId: string; readonly origin: "ground-center";
  readonly metersPerUnit: 1; readonly authoringGridM: 0.25; readonly terrainCellM: 0.125;
  readonly dimensionsM: readonly number[]; readonly parts: readonly FactoryAssetPart[];
  readonly ports: readonly FactoryAssetPort[]; readonly sourceRefs: readonly string[];
  readonly supportsM: readonly (readonly number[])[];
  readonly supportPatchesM: readonly Readonly<{ partId: string; centerM: readonly number[]; sizeM: readonly number[]; normal: readonly number[] }>[];
  readonly serviceBoundsM: Readonly<{ min: readonly number[]; max: readonly number[] }>;
  readonly joints: readonly Readonly<{ partId: string; pivotM: readonly number[]; axis: readonly number[]; limitsM: readonly number[]; sweepBoundsM: Readonly<{ min: readonly number[]; max: readonly number[] }> }>[];
  readonly phaseMotionProfile?: Readonly<{ version: 1; phaseEndsMs: readonly number[]; toolCycles: number;
    channels: readonly Readonly<{ partId: string; axis: readonly number[];
      segments: readonly Readonly<{ startMs: number; endMs: number; fromM: number; toM: number }>[] }>[] }>;
}
export interface FactoryAssetProjection {
  readonly definitionRef: FactoryAssetDefinitionRef; readonly source: FactoryAssetSource;
  readonly sourceDigest: string; readonly kind: "S0-proxy"; readonly frameId: string;
  readonly bounds: AxisAlignedBounds;
  readonly parts: readonly Readonly<{ partId: string; role: string; artifact: MeshArtifact; materialProfiles: readonly MaterialProfile[] }>[];
  readonly ports: readonly FactoryAssetPort[];
}

const sources = deepFreezeMetadata([...cutter.assets, ...former.assets, ...powerKit.assets]) as unknown as readonly FactoryAssetSource[];
const catalog = loadFactoryCatalog(createFp02CatalogInput());
const sourceBytes = new Map(sources.map(source => [source.definitionId, JSON.stringify(source)]));
const palette: Readonly<Record<string, string>> = { "EX-STRUCT": "30383D", "EX-SHELL": "B6BDB8", "EX-FUNCTION": "407A79", "EX-HAZARD": "D8A94E", "EX-PV": "1D2E3C" };
const linear = (value: number): number => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const profiles = Object.fromEntries(Object.entries(palette).map(([family, hex]) => [family, createMaterialProfile({
  id: materialProfileId(`fp06_${family.toLowerCase().replace("-", "_")}`), kind: "BasicLit",
  baseColor: { r: linear(parseInt(hex.slice(0, 2), 16) / 255), g: linear(parseInt(hex.slice(2, 4), 16) / 255), b: linear(parseInt(hex.slice(4, 6), 16) / 255) },
  opacity: 1, doubleSided: false, wireframe: false, depthWrite: true
})]));

/** Frozen original S0 source; no compiled HVOX, cargo or structural authority. */
export const getFactoryAssetSource = (sourceId: string): FactoryAssetSource => {
  const source = sources.find(value => value.definitionId === sourceId);
  if (!source) throw new Error("Unknown factory asset source");
  return source;
};

const vector = (values: readonly number[]) => ({ x: values[0]!, y: values[1]!, z: values[2]! });
const faces = [
  { n: [1, 0, 0], v: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]] },
  { n: [0, 0, 1], v: [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]] },
  { n: [0, 0, -1], v: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]] }
] as const;

const partArtifact = (source: FactoryAssetSource, part: FactoryAssetPart, instanceId: string) => {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const materialRanges: { materialProfileId: MaterialProfile["id"]; startIndex: number; indexCount: number }[] = [];
  const used = new Map<string, MaterialProfile>();
  for (const box of part.boxes) {
    const material = profiles[box.material];
    if (!material) throw new Error("Unknown factory material family");
    used.set(box.material, material);
    const sin = Math.sin(box.rotationZRadians ?? 0), cos = Math.cos(box.rotationZRadians ?? 0);
    const startIndex = indices.length;
    for (const face of faces) {
      const first = positions.length / 3;
      for (const corner of face.v) {
        const x = corner[0] * box.sizeM[0]! / 2, y = corner[1] * box.sizeM[1]! / 2;
        positions.push(box.centerM[0]! + cos * x - sin * y, box.centerM[1]! + sin * x + cos * y, box.centerM[2]! + corner[2] * box.sizeM[2]! / 2);
        normals.push(cos * face.n[0] - sin * face.n[1], sin * face.n[0] + cos * face.n[1], face.n[2]);
      }
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
    const previous = materialRanges.at(-1);
    if (previous?.materialProfileId === material.id) previous.indexCount += indices.length - startIndex;
    else materialRanges.push({ materialProfileId: material.id, startIndex, indexCount: indices.length - startIndex });
  }
  const typedPositions = new Float32Array(positions), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < typedPositions.length; index += 1) {
    const axis = index % 3; min[axis] = Math.min(min[axis]!, typedPositions[index]!); max[axis] = Math.max(max[axis]!, typedPositions[index]!);
  }
  const artifact = createMeshArtifact({ representationKey: representationKey(`factory:${instanceId}:${part.partId}`),
    sourceRevision: sourceRevision(source.revision), artifactRevision: artifactRevision(1), algorithmVersion: "factory_s0_boxes_v1",
    frameId: frameId("fp02_east_north_height_xyz_v1"), positions: typedPositions, normals: new Float32Array(normals), indices: new Uint16Array(indices),
    materialRanges, bounds: { min: vector(min), max: vector(max) } });
  return Object.freeze({ partId: part.partId, role: part.role, artifact, materialProfiles: Object.freeze([...used.values()]) });
};

/** MeshArtifacts are derived once per mount; subsequent poses never remesh. */
export const createFactoryAssetProjection = (definitionRef: FactoryAssetDefinitionRef, source: FactoryAssetSource): FactoryAssetProjection => {
  const definition = [...catalog.devices, ...catalog.items].find(value => value.sourceId === definitionRef.sourceId);
  if (!definition || definitionRef.sourceId !== source.definitionId || definitionRef.version !== definition.version || definitionRef.digest !== definition.digest) throw new Error("Factory asset definition binding mismatch");
  if (sourceBytes.get(source.definitionId) !== JSON.stringify(source)) throw new Error("Factory asset source binding mismatch");
  const parts = source.parts.map(part => partArtifact(source, part, definitionRef.instanceId ?? source.assetId));
  const bounds = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
  for (const part of parts) for (const axis of ["x", "y", "z"] as const) {
    bounds.min[axis] = Math.min(bounds.min[axis], part.artifact.bounds.min[axis]); bounds.max[axis] = Math.max(bounds.max[axis], part.artifact.bounds.max[axis]);
  }
  const boundRef = { sourceId: definitionRef.sourceId, version: definitionRef.version, digest: definitionRef.digest,
    ...(definitionRef.instanceId === undefined ? {} : { instanceId: definitionRef.instanceId }) };
  return deepFreezeMetadata({ definitionRef: boundRef, source, sourceDigest: canonicalSignature(source), kind: "S0-proxy" as const,
    frameId: "fp02_east_north_height_xyz_v1", bounds, parts, ports: source.ports });
};
