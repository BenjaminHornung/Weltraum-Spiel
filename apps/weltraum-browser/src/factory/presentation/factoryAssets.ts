import {readCargoHandlingProfile} from "../construction/cargoHandlingProfile";
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

/** Technical S0 bindings: source dimensions/BOM stay catalog-owned; brace cross-section is explicitly a proxy. */
const technicalSources:FactoryAssetSource[]=["B05","B09","fp02.comp.small_brace"].map(id=>{
 const brace=id==="fp02.comp.small_brace",bench=id==="B05",size=brace?[1,.25,.25]:bench?[2,1.1,1]:[2,1.5,2],footX=brace?.375:.75,footZ=brace?0:bench?.25:.75;
 const supports=brace?[[-footX,0,0],[footX,0,0]]:[[-footX,0,-footZ],[-footX,0,footZ],[footX,0,-footZ],[footX,0,footZ]];
 const footSize=brace?[.125,.125,.25]:bench?[.25,.9,.25]:[.25,.25,.25];
 const body=brace?{centerM:[0,.1875,0],sizeM:[1,.125,.25],material:"EX-STRUCT"}:bench?{centerM:[0,1,0],sizeM:[2,.2,1],material:"EX-FUNCTION"}:{centerM:[0,.875,0],sizeM:[2,1.25,2],material:"EX-SHELL"};
 return {assetId:`fp06_s0_${id.toLowerCase().replaceAll(".","_")}`,definitionId:id,revision:1,kind:"S0-proxy",frameId:"fp02_east_north_height_xyz_v1",origin:"ground-center",metersPerUnit:1,authoringGridM:.25,terrainCellM:.125,dimensionsM:size,
  parts:[{partId:"body",role:bench?"basic_mechanical_bench":brace?"usable_brace":"finite_material_storage",boxes:[body]},...supports.map((point,i)=>({partId:`support_${i}`,role:"support",boxes:[{centerM:[point[0]!,footSize[1]!/2,point[2]!],sizeM:footSize,material:"EX-STRUCT"}]}))],
  ports:id==="B09"?[{sourceId:"B09:MAT-IN",role:"SolidBatchIn",centerM:[-1,1,0],normal:[-1,0,0],sizeM:[.75,.75],binding:"source-solid"},{sourceId:"B09:MAT-OUT",role:"SolidBatchOut",centerM:[1,1,0],normal:[1,0,0],sizeM:[.75,.75],binding:"source-solid"}]:[],
  sourceRefs:[brace?"FP02:5.2:REC-05-BRACE":`FP02:7:${id}`,brace?"FP03:brace-1m-family":"W01:device-dimensions","fp06-technical-s0-local-factory-v1"],supportsM:supports,
  supportPatchesM:supports.map((point,i)=>({partId:`support_${i}`,centerM:point,sizeM:[footSize[0]!,footSize[2]!],normal:[0,-1,0]})),
  serviceBoundsM:{min:[-size[0]!/2,0,size[2]!/2],max:[size[0]!/2,Math.max(1,size[1]!),size[2]!/2+1]},joints:[]};
});
const beltSource:FactoryAssetSource={assetId:"fp06_s0_paid_belt_4m",definitionId:"fp06.line.belt_4m",revision:1,kind:"S0-proxy",frameId:"fp02_east_north_height_xyz_v1",origin:"ground-center",metersPerUnit:1,authoringGridM:.25,terrainCellM:.125,dimensionsM:[4,1,.75],
 parts:[...[-1.5,-.5,.5,1.5].map((x,index)=>({partId:`segment_${index}`,role:"paid_passive_metre",boxes:[{centerM:[x,.9375,0],sizeM:[1,.125,.75],material:"EX-FUNCTION"}]})),{partId:"drive",role:"paid_dedicated_C23_drive",boxes:[{centerM:[-1.75,.75,.25],sizeM:[.25,.25,.25],material:"EX-HAZARD"}]},...[-1.75,1.75].flatMap(x=>[-.25,.25].map(z=>({partId:`support_${x<0?0:1}_${z<0?0:1}`,role:"support",boxes:[{centerM:[x,.4375,z],sizeM:[.125,.875,.125],material:"EX-STRUCT"}]})))],
 ports:[{sourceId:"fp06.line.belt_4m:POWER-IN",role:"PowerConsumer",centerM:[-1.75,.75,.375],normal:[0,0,1],sizeM:[.125,.125],binding:"authoring-only"}],sourceRefs:["FP02:C14:finite-passive-1m-modules","FP02:C23:dedicated-belt-drive","fp06-technical-s0-paid-belt-4m-v1"],supportsM:[[-1.75,0,-.25],[-1.75,0,.25],[1.75,0,-.25],[1.75,0,.25]],supportPatchesM:[-1.75,1.75].flatMap(x=>[-.25,.25].map(z=>({partId:`support_${x<0?0:1}_${z<0?0:1}`,centerM:[x,0,z],sizeM:[.125,.125],normal:[0,-1,0]}))),serviceBoundsM:{min:[-2,0,.375],max:[2,1,1.375]},joints:[]};
const sources = deepFreezeMetadata([...cutter.assets, ...former.assets, ...powerKit.assets,...technicalSources,beltSource]) as unknown as readonly FactoryAssetSource[];
const catalog = loadFactoryCatalog(createFp02CatalogInput());
/** Closed composed definition; this never adds a catalog item or creates cargo. */
const paidBelt=readCargoHandlingProfile(catalog,"BELT4")!;
const beltDefinition=deepFreezeMetadata({sourceId:"fp06.line.belt_4m",version:1,digest:canonicalSignature({version:"fp06-paid-belt-definition-v1",catalogDigest:catalog.catalogDigest,handlingDigest:paidBelt.digest,source:beltSource}),bom:paidBelt.terms,massMg:paidBelt.massMg});
export const readFactoryAssetDefinition=(sourceId:string)=>sourceId===beltDefinition.sourceId?beltDefinition:[...catalog.devices,...catalog.items].find(value=>value.sourceId===sourceId);
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

const partArtifact = (source: Pick<FactoryAssetSource,"revision">, part: FactoryAssetPart, instanceId: string) => {
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
  const definition = readFactoryAssetDefinition(definitionRef.sourceId);
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

/** Closed, derived transport representation; quantities and poses remain Native/Resources-owned. */
export const createFactoryCarrierProjection = (profileId:string,profileDigest:string,revision:number) => {
  const profile=readCargoHandlingProfile(catalog,profileId);
  if(!profile||profile.digest!==profileDigest||!Number.isSafeInteger(revision)||revision<1)throw Error("CarrierProjectionBindingMismatch");
  const offset=profile.sizeMm[0]===500?.0625:.25;
  const parts:FactoryAssetPart[]=[{partId:"payload",role:"paid_payload",boxes:[{centerM:[0,.75,0],sizeM:profile.sizeMm.map(v=>v/1000),material:"EX-HAZARD"}]},
    ...[-offset,offset].flatMap(x=>[-offset,offset].map(z=>({partId:`support_${x<0?0:1}_${z<0?0:1}`,role:"support",boxes:[{centerM:[x,.125,z],sizeM:[.125,.25,.125],material:"EX-STRUCT"}]})))];
  const source={revision:1};
  return Object.freeze(parts.map(part=>{const derived=partArtifact(source,part,"carrier:slot");return Object.freeze({...derived,artifact:createMeshArtifact({...derived.artifact,artifactRevision:artifactRevision(revision),algorithmVersion:"fp06_carrier_s0_v1"})});}));
};
