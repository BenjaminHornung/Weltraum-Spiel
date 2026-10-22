import manifestBytes from "../../../public/factory/play-2026-10-12/manifest.json?raw";
import surfaceManifestBytes from "../../../public/factory/play-2026-10-12/manifest-surface-v2.json?raw";
import cargoSurfaceManifestBytes from "../../../public/factory/play-2026-10-12/manifest-cargo-surface-v2.json?raw";
import distributorSurfaceManifestBytes from "../../../public/factory/play-2026-10-12/manifest-distribution-surface-v2.json?raw";
import storageSurfaceManifestBytes from "../../../public/factory/play-2026-10-12/manifest-storage-surface-v2.json?raw";
import {
  artifactRevision, createMaterialProfile, createMeshArtifact, deepFreezeMetadata, frameId, materialProfileId,
  representationKey, sourceRevision, validateSemanticId, type AxisAlignedBounds, type MaterialProfile, type MeshArtifact
} from "../../presentation";
import { computeSaveContentHash } from "../../browser-storage/checksum";
import { canonicalJson } from "../../resources/serialization";
import type { HvpCollisionSector } from "../../hestia-prototype/physics/terrainColliders";
import type { HullManifest, HullMetadataCosts, HullProjectionCosts } from "./hullMetadata";
import { getFactoryAssetSource } from "./factoryAssets";

export interface PlayDefinitionRef { readonly sourceId:string; readonly version:number; readonly digest:string }
export type PlayExpectedBinding = Readonly<{definitionRef:PlayDefinitionRef;visualOnlyAnchor?:never}> |
  Readonly<{visualOnlyAnchor:Readonly<Record<string,unknown>>;definitionRef?:never}>;
export type PlayAssetRenderMode = "palette" | "vertex-colors";
export interface PlayAssetProjection {
  readonly assetId:string; readonly glbSha256:string; readonly sourceFileSha256:string;
  readonly definitionRef:PlayDefinitionRef|null; readonly visualOnlyAnchor:Readonly<Record<string,unknown>>|null;
  readonly frameId:string; readonly bounds:AxisAlignedBounds;
  readonly parts:readonly Readonly<{partId:string;role:string;artifact:MeshArtifact;materialProfiles:readonly MaterialProfile[]}>[];
  readonly visualVariant?:Readonly<{baseAssetId:string;kind:string;pose:string;requiresConfirmedLocalAccess:boolean}>;
}
export interface LoadPlayAssetInput {
  readonly assetId:string; readonly instanceId:string; readonly expectedBinding:PlayExpectedBinding;
  readonly signal?:AbortSignal; readonly fetch?:typeof globalThis.fetch; readonly renderMode?:PlayAssetRenderMode;
}
export interface LoadFactoryHullInput {
  readonly instanceId:string; readonly signal?:AbortSignal; readonly fetch?:typeof globalThis.fetch;
}
export interface FactoryHullProjection extends PlayAssetProjection {
  readonly anchorMeters:readonly [6.5,1.5,7.5];
  readonly nativeSectors:readonly HvpCollisionSector[];
  readonly collisionDigest:string;
  readonly costs:HullProjectionCosts&HullMetadataCosts;
}
export interface FactoryHullMetadata extends HullManifest {readonly metadataCosts:HullMetadataCosts}
interface Entry {
  assetId:string;slug:string;family:string;units:string;runtimeAxes:string;partIds:readonly string[];
  parentPartIds:Readonly<Record<string,string|null>>;definitionRef:PlayDefinitionRef|null;visualOnlyAnchor:Readonly<Record<string,unknown>>|null;
  sourceFile:{sha256:string};sourceRuntimeGlb?:{path:string;bytes:number;sha256:string};runtimeGlb:{url:string;bytes:number;sha256:string};nativeBoundsM:{min:readonly number[];max:readonly number[]};
  visualVariant?:PlayAssetProjection["visualVariant"];
}
interface Document {
  asset:{version:string;generator?:string;extras?:unknown};
  scene:number;scenes:readonly {nodes:readonly number[];extras?:unknown}[];
  nodes:readonly {name:string;mesh:number;matrix?:readonly number[];translation?:readonly number[];rotation?:readonly number[];scale?:readonly number[];
    children?:readonly number[];skin?:number;extensions?:unknown;extras?:unknown}[];
  meshes:readonly {primitives:readonly {attributes:{POSITION:number;NORMAL:number};indices:number;material:number;mode?:number;targets?:unknown;extensions?:unknown}[]}[];
  materials:readonly {name:string;pbrMetallicRoughness:{baseColorFactor:readonly number[];baseColorTexture?:unknown;metallicRoughnessTexture?:unknown};
    normalTexture?:unknown;occlusionTexture?:unknown;emissiveTexture?:unknown;alphaMode?:string;extensions?:unknown}[];
  accessors:readonly {bufferView:number;byteOffset?:number;componentType:number;count:number;type:string;normalized?:boolean;sparse?:unknown}[];
  bufferViews:readonly {buffer:number;byteOffset?:number;byteLength:number;byteStride?:number;extensions?:unknown}[];
  buffers:readonly {byteLength:number;uri?:string}[];
  extensionsUsed?:unknown;extensionsRequired?:unknown;extensions?:unknown;images?:unknown;textures?:unknown;skins?:unknown;animations?:unknown;cameras?:unknown;
}
const MANIFEST_SHA256="f76c9cb6e504555446d3bafe7b8ef7a95bdb3b9242df51a2ef836aec548f03e1";
const FRAME="fp02_east_north_height_xyz_v1";
const palette=Object.freeze({"EX-STRUCT":"30383D","EX-SHELL":"B6BDB8","EX-FUNCTION":"407A79","EX-HAZARD":"D8A94E","EX-PV":"1D2E3C"});
const linear=(v:number)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
// Existing accepted Factory BasicLit palette/IDs/flags; GLB PBR numbers are
// checked linear values, never interpreted as physical material or density.
const profiles=new Map(Object.entries(palette).map(([role,hex])=>[role,createMaterialProfile({
  id:materialProfileId(`fp06_${role.toLowerCase().replace("-","_")}`),kind:"BasicLit",
  baseColor:{r:linear(parseInt(hex.slice(0,2),16)/255),g:linear(parseInt(hex.slice(2,4),16)/255),b:linear(parseInt(hex.slice(4,6),16)/255)},
  opacity:1,doubleSided:false,wireframe:false,depthWrite:true
})]));
const vertexColorProfile=createMaterialProfile({id:materialProfileId("fp06_vertex_color"),kind:"BasicLit",
  baseColor:{r:1,g:1,b:1},opacity:1,doubleSided:false,wireframe:false,depthWrite:true});
// Actual sealed export census, in vertices/indices/primitives per file. These
// local caps precede output allocation; aggregate scene admission remains Host-owned.
const census:Readonly<Record<string,readonly [number,number,number]>>=Object.freeze({
  play_belt_v1:[1296,1944,22],play_brace_v1:[120,180,4],play_carrier_heavy_v1:[360,540,8],play_carrier_light_v1:[360,540,8],play_carrier_medium_v1:[360,540,8],
  play_cutter_v1:[1680,2520,21],play_former_v1:[1704,2556,24],play_cutter_v2:[1680,2520,21],play_former_v2:[1704,2556,24],play_offcut_v1:[216,324,3],play_profile_v1:[144,216,2],play_semi_v1:[96,144,1],
  play_sheet_v1:[120,180,1],play_steel_v1:[96,144,2],play_battery_v1:[480,720,7],play_cable_end_v1:[72,108,3],play_cable_link_v1:[24,36,1],
  play_distribution_v1:[480,720,7],play_distribution_v2:[480,720,7],play_pv_v1:[3720,5580,8],play_wind_v1:[384,576,9],play_storage_v1:[600,900,7],play_workbench_v1:[648,972,15],
  play_wreck_cargo_v1:[360,540,4],play_wreck_cargo_open_v1:[312,468,4],play_wreck_cargo_v2:[360,540,4],play_wreck_cargo_open_v2:[312,468,4],
  play_storage_inspection_open_v1:[600,900,7],play_storage_v2:[600,900,7],play_storage_inspection_open_v2:[600,900,7]
});
const HULL_ASSET_ID="hestia_crashsite_walkable_v1" as const;
const HULL_URL="/factory/crashsite-walkable-v1-2026-10-19/crashsite-walkable-v1.glb" as const;
const HULL_ANCHOR=[6.5,1.5,7.5] as const;
function fail(reason:string):never{throw Error(`Play asset ${reason}`);}
const aborted=(signal?:AbortSignal):void=>{if(signal?.aborted)throw new DOMException("Play asset load aborted","AbortError");};
const sha256=async(bytes:Uint8Array)=>String(await computeSaveContentHash(bytes)).slice(7);
let checkedManifest:Promise<readonly Entry[]>|undefined;
const readManifest=():Promise<readonly Entry[]>=>checkedManifest??=(async()=>{
  const bytes=new TextEncoder().encode(manifestBytes);
  if(bytes.byteLength!==83_735 || await sha256(bytes)!==MANIFEST_SHA256)fail("manifest bytes/hash mismatch");
  const manifest=JSON.parse(manifestBytes) as {schema:string;assets:Entry[];palette:unknown};
  if(manifest.schema!=="hestia.factory.play-assets/v1" || manifest.assets.length!==23 || new Set(manifest.assets.map(a=>a.assetId)).size!==23
    || canonicalJson(manifest.palette)!==canonicalJson(palette))fail("manifest schema/palette mismatch");
  const surfaceBytes=new TextEncoder().encode(surfaceManifestBytes);
  if(surfaceBytes.byteLength!==9_721 || await sha256(surfaceBytes)!=="cb1ceaf9b05b738418ebaff95104efad61fea93eac0c8009bc271f23f000d2b9")fail("surface manifest bytes/hash mismatch");
  const surface=JSON.parse(surfaceManifestBytes) as {schema:string;assets:Entry[];palette:unknown};
  if(surface.schema!=="hestia.factory.play-assets/v1" || canonicalJson(surface.assets.map(a=>a.assetId).sort())!==canonicalJson(["play_cutter_v2","play_former_v2"])
    || canonicalJson(surface.palette)!==canonicalJson(palette))fail("surface manifest schema/palette mismatch");
  const cargoSurfaceBytes=new TextEncoder().encode(cargoSurfaceManifestBytes);
  if(cargoSurfaceBytes.byteLength!==10_782 || await sha256(cargoSurfaceBytes)!=="c64d731756c04aa8ea79bc0a77b2ea587331a7e4c93c50399a4696c0c2ab7e52")fail("Cargo surface manifest bytes/hash mismatch");
  const cargoSurface=JSON.parse(cargoSurfaceManifestBytes) as {schema:string;assets:Entry[];palette:unknown};
  if(cargoSurface.schema!=="hestia.factory.play-assets/v1" || canonicalJson(cargoSurface.assets.map(a=>a.assetId).sort())!==canonicalJson(["play_wreck_cargo_open_v2","play_wreck_cargo_v2"])
    || canonicalJson(cargoSurface.palette)!==canonicalJson(palette))fail("Cargo surface manifest schema/palette mismatch");
  const distributorSurfaceBytes=new TextEncoder().encode(distributorSurfaceManifestBytes);
  if(distributorSurfaceBytes.byteLength!==5_520 || await sha256(distributorSurfaceBytes)!=="e8bc24fa80459d28547f3494d18db6a5d2695b5c37aae38c7c845f28c94cdd8d")
    fail("Distributor surface manifest bytes/hash mismatch");
  const distributorSurface=JSON.parse(distributorSurfaceManifestBytes) as {schema:string;assets:Entry[];palette:unknown};
  if(distributorSurface.schema!=="hestia.factory.play-assets/v1" || canonicalJson(distributorSurface.assets.map(a=>a.assetId).sort())!==canonicalJson(["play_distribution_v2"])
    || canonicalJson(distributorSurface.palette)!==canonicalJson(palette))fail("Distributor surface manifest schema/palette mismatch");
  const storageSurfaceBytes=new TextEncoder().encode(storageSurfaceManifestBytes);
  if(storageSurfaceBytes.byteLength!==14_007 || await sha256(storageSurfaceBytes)!=="c22bc226d26692ddc1c83ed6bb33bf9ac56424edd840c8ec753020d88b37bd3f")
    fail("Storage surface manifest bytes/hash mismatch");
  const storageSurface=JSON.parse(storageSurfaceManifestBytes) as {schema:string;assets:Entry[];palette:unknown};
  if(storageSurface.schema!=="hestia.factory.play-assets/v1"
    || canonicalJson(storageSurface.assets.map(a=>a.assetId).sort())!==canonicalJson(["play_storage_inspection_open_v2","play_storage_v2"])
    || canonicalJson(storageSurface.palette)!==canonicalJson(palette))fail("Storage surface manifest schema/palette mismatch");
  const allAssets=[...manifest.assets,...surface.assets,...cargoSurface.assets,...distributorSurface.assets,...storageSurface.assets];
  if(allAssets.length!==30 || new Set(allAssets.map(a=>a.assetId)).size!==allAssets.length)fail("manifest asset IDs overlap");
  return deepFreezeMetadata(allAssets);
})();

/** Reads only the sealed file's byte budget, cancels failed/aborted streams. */
const readReviewedBytes=async(response:Response,size:number,signal?:AbortSignal):Promise<Uint8Array>=>{
  if(!response.ok || !response.body){await response.body?.cancel().catch(()=>{});fail(`fetch response ${response.status}`);}
  const reader=response.body.getReader(),bytes=new Uint8Array(size);let offset=0;
  const onAbort=()=>{void reader.cancel().catch(()=>{});};
  signal?.addEventListener("abort",onAbort,{once:true});
  try{
    aborted(signal);
    while(true){
      const chunk=await reader.read();aborted(signal);
      if(chunk.done)break;
      if(!(chunk.value instanceof Uint8Array)||offset+chunk.value.byteLength>size)fail("byte size BudgetExceeded");
      bytes.set(chunk.value,offset);offset+=chunk.value.byteLength;
    }
    if(offset!==size)fail("byte size mismatch");
    return bytes;
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{signal?.removeEventListener("abort",onAbort);reader.releaseLock();}
};
const equal=(actual:readonly number[]|undefined,expected:readonly number[])=>actual===undefined || canonicalJson(actual)===canonicalJson(expected);
const integer=(v:number)=>Number.isSafeInteger(v)&&v>=0;
const vector=(values:readonly number[])=>({x:values[0]!,y:values[1]!,z:values[2]!});
const rejectExtensions=(value:unknown):void=>{
  if(value===null || typeof value!=="object")return;
  for(const [key,child] of Object.entries(value)){
    if(["extensions","extensionsUsed","extensionsRequired","uri"].includes(key))fail("external/unsupported extension");
    rejectExtensions(child);
  }
};
type JsonRecord=Record<string,unknown>;
const record=(value:unknown):JsonRecord|undefined=>value!==null&&typeof value==="object"&&!Array.isArray(value)?value as JsonRecord:undefined;
const sourceSha256=(entry:Entry)=>entry.sourceFile.sha256;
const byteView=(value:Float32Array|Uint16Array|Uint32Array)=>new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
let checkedHullMetadata:Promise<FactoryHullMetadata>|undefined;
const HULL_METADATA_RETAINED_BYTES=42_578;
/** Includes pending and rejected cached reads; the leaf and parsed graph remain retained for this module lifetime. */
export const readLoadedHullMetadataBytes=():number=>checkedHullMetadata===undefined?0:HULL_METADATA_RETAINED_BYTES;
/** Returns the single hash-pinned metadata leaf without fetching or importing Hull payload bytes. */
export const readFactoryHullMetadata=():Promise<FactoryHullMetadata>=>checkedHullMetadata??=(async()=>{
  const leaf=await import("./hullMetadata");
  const sidecarBytes=new TextEncoder().encode(leaf.HULL_MANIFEST_BYTES);
  if(sidecarBytes.byteLength!==leaf.HULL_MANIFEST_BYTE_LENGTH||await sha256(sidecarBytes)!==leaf.HULL_MANIFEST_SHA256)
    fail("Hull metadata bytes/hash mismatch");
  const manifest=JSON.parse(leaf.HULL_MANIFEST_BYTES) as HullManifest;
  const ids=["cargo_bay","cockpit","debris","hull","rear","spine","turret_aft","turret_fore"];
  const nativeBytes=manifest.parts.reduce((sum,part)=>sum+part.native.vertexBytes+part.native.indexBytes,0);
  const nativeHashCopyPeakBytes=Math.max(...manifest.parts.flatMap(part=>[part.native.vertexBytes,part.native.indexBytes]));
  if(manifest.schema!=="hestia.factory.closed-hull/v1"||manifest.assetId!==HULL_ASSET_ID||manifest.assetRevision!==1
    ||manifest.runtimeGlb.url!==HULL_URL||manifest.runtimeGlb.bytes!==1_073_548||manifest.runtimeGlb.sha256!=="91d27929383cf3d3edfee3a2e44ab6d722de026837336e5dd6313c51bca7a2ed"
    ||manifest.source.sourceAssetId!=="hestia_crashsite_hybrid_v2"||manifest.frame!==FRAME||manifest.metersPerUnit!==1
    ||canonicalJson(manifest.anchorMeters)!==canonicalJson(HULL_ANCHOR)||canonicalJson(manifest.parts.map(part=>part.partId))!==canonicalJson(ids)
    ||manifest.palette.length!==6||manifest.census.jsonChunkBytes!==20_604||manifest.census.jsonUtf16Bytes!==41_208
    ||manifest.census.jsonGraphBytes!==70_144||manifest.census.vertices!==39_072||manifest.census.indices!==58_608
    ||manifest.census.primitives!==34||manifest.census.renderPaletteBytes!==1_054_944||manifest.census.renderVertexColorBytes!==1_523_808
    ||manifest.census.nativeVertexIndexBytes!==703_296||manifest.census.nativeCollisionDigest!=="7a63fed9"
    ||nativeBytes!==manifest.census.nativeVertexIndexBytes||manifest.costs.sourceBytes!==manifest.runtimeGlb.bytes
    ||manifest.costs.sourceSha256CopyBytes!==manifest.runtimeGlb.bytes||manifest.costs.jsonUtf16Bytes!==manifest.census.jsonUtf16Bytes
    ||manifest.costs.jsonGraphBytes!==manifest.census.jsonGraphBytes||manifest.costs.renderScratchBytes!==manifest.census.renderVertexColorBytes
    ||manifest.costs.renderArtifactBytes!==manifest.census.renderVertexColorBytes||manifest.costs.stagedRenderArtifactBytes!==manifest.census.renderVertexColorBytes
    ||manifest.costs.nativeSectorBytes!==manifest.census.nativeVertexIndexBytes||manifest.costs.nativeHashCopyPeakBytes!==nativeHashCopyPeakBytes)
    fail("Hull manifest profile mismatch");
  const result:FactoryHullMetadata={...manifest,metadataCosts:{sidecarUtf8Bytes:leaf.HULL_MANIFEST_BYTE_LENGTH,
    sidecarHashCopyBytes:leaf.HULL_MANIFEST_BYTE_LENGTH,sidecarRawUtf16Bytes:leaf.HULL_MANIFEST_UTF16_BYTES,
    sidecarParsedUtf16Bytes:leaf.HULL_MANIFEST_PARSED_UTF16_BYTES,sidecarParsedGraphBytes:leaf.HULL_MANIFEST_PARSED_GRAPH_BYTES}};
  return deepFreezeMetadata(result);
})();

/**
 * Imports only the 23 original and seven versioned hash-sealed Play exports' embedded, indexed float VEC3
 * primitives. No scene/extension engine, Three objects, GPU or World is created.
 * Caller binding is explicit; current Native presence/profile and selection of
 * inspection variants remain Host responsibilities, not inferred from triangles.
 */
export const loadPlayAssetProjection=async(input:LoadPlayAssetInput):Promise<PlayAssetProjection>=>{
  // TypeScript readonly does not freeze a caller's DTO. Bind this invocation
  // before the first await while retaining the original signal's live abort state.
  const {assetId,instanceId,signal,fetch:capturedFetch}=input,renderMode=input.renderMode??"palette";
  const fetcher=capturedFetch??globalThis.fetch;
  aborted(signal);
  if(renderMode!=="palette"&&renderMode!=="vertex-colors")fail("unsupported render mode");
  const expectedBindingJson=canonicalJson(input.expectedBinding);
  if(!validateSemanticId(instanceId).valid)fail("instance key mismatch");
  const entries=await readManifest();aborted(signal);
  const entry=entries.find(a=>a.assetId===assetId);
  if(!entry || !census[entry.assetId])fail("asset ID mismatch");
  const expected=entry.definitionRef?{definitionRef:entry.definitionRef}:{visualOnlyAnchor:entry.visualOnlyAnchor};
  if(expectedBindingJson!==canonicalJson(expected))fail("binding mismatch");
  if(entry.runtimeGlb.bytes>108_824 || !integer(entry.runtimeGlb.bytes) || entry.runtimeGlb.bytes<28
    || entry.runtimeGlb.url!==`/factory/play-2026-10-12/${entry.slug}.glb`)fail("manifest file budget mismatch");
  const response=await fetcher(entry.runtimeGlb.url,{signal});
  const bytes=await readReviewedBytes(response,entry.runtimeGlb.bytes,signal);
  return decodeClosedGlb(bytes,{kind:"play",entry,instanceId,renderMode},signal);
};

/** Load the one hash-sealed V6 Hull. Its metadata chunk is deliberately lazy so V5 never imports it. */
export const loadFactoryHullProjection=async(input:LoadFactoryHullInput):Promise<FactoryHullProjection>=>{
  const {instanceId,signal,fetch:capturedFetch}=input,fetcher=capturedFetch??globalThis.fetch;
  aborted(signal);
  if(!validateSemanticId(instanceId).valid)fail("instance key mismatch");
  const manifest=await readFactoryHullMetadata();aborted(signal);
  const response=await fetcher(manifest.runtimeGlb.url,{signal});
  const bytes=await readReviewedBytes(response,manifest.runtimeGlb.bytes,signal);
  return decodeClosedGlb(bytes,{kind:"hull",manifest,instanceId},signal);
};

type DecodeProfile=Readonly<{kind:"play";entry:Entry;instanceId:string;renderMode:PlayAssetRenderMode}>|
  Readonly<{kind:"hull";manifest:FactoryHullMetadata;instanceId:string}>;
interface DecodedPrimitive {
  readonly positions:Readonly<{count:number;start:number;stride:number}>;
  readonly normals:Readonly<{count:number;start:number;stride:number}>;
  readonly index:Readonly<{count:number;start:number;stride:number}>;
  readonly profile:MaterialProfile;
}
interface DecodedPart {
  readonly partId:string;readonly role:string;readonly primitives:readonly DecodedPrimitive[];
  readonly partVertices:number;readonly partIndices:number;
}
const createHullProfiles=(manifest:HullManifest)=>new Map(manifest.palette.map(material=>[material.name,createMaterialProfile({
  id:materialProfileId(`fp06_hull_${material.name}`),kind:"BasicLit",
  baseColor:{r:material.color[0],g:material.color[1],b:material.color[2]},opacity:1,doubleSided:false,wireframe:false,depthWrite:true
})] as const));

/** Shared closed-asset GLB decoder; only the two local profile variants above can reach it. */
function decodeClosedGlb(bytes:Uint8Array,profile:Extract<DecodeProfile,{kind:"play"}>,signal?:AbortSignal):Promise<PlayAssetProjection>;
function decodeClosedGlb(bytes:Uint8Array,profile:Extract<DecodeProfile,{kind:"hull"}>,signal?:AbortSignal):Promise<FactoryHullProjection>;
async function decodeClosedGlb(bytes:Uint8Array,profile:DecodeProfile,signal?:AbortSignal):Promise<PlayAssetProjection|FactoryHullProjection>{
  const isHull=profile.kind==="hull",instanceId=profile.instanceId;
  const renderMode=profile.kind==="hull"?"vertex-colors":profile.renderMode;
  const manifest=profile.kind==="hull"?profile.manifest:undefined,entry=profile.kind==="play"?profile.entry:undefined;
  const assetId=isHull?manifest!.assetId:entry!.assetId,expectedSha=isHull?manifest!.runtimeGlb.sha256:entry!.runtimeGlb.sha256;
  if(await sha256(bytes)!==expectedSha)fail("GLB hash mismatch");
  aborted(signal);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)fail("unsupported GLB header");
  const jsonLength=view.getUint32(12,true),binHeader=20+jsonLength;
  if(jsonLength%4!==0||binHeader+8>bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a)fail("unsupported GLB JSON chunk");
  const binLength=view.getUint32(binHeader,true),binStart=binHeader+8;
  if(view.getUint32(binHeader+4,true)!==0x004e4942||binLength%4!==0||binStart+binLength!==bytes.byteLength)fail("unsupported GLB BIN chunk");
  if(profile.kind==="hull"&&jsonLength!==profile.manifest.census.jsonChunkBytes)fail("Hull JSON chunk census mismatch");
  const doc=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes.subarray(20,binHeader))) as Document;
  rejectExtensions(doc);
  if(doc.asset.version!=="2.0")fail("asset meter/frame binding mismatch");
  if(isHull){
    if(doc.asset.generator!=="Khronos glTF Blender I/O v5.2.40"||doc.asset.extras!==undefined
      ||canonicalJson(doc.scenes[0]?.extras)!==canonicalJson(manifest!.sceneExtras))fail("Hull scene metadata mismatch");
  }else{
    const metadata=record(record(doc.asset.extras)?.hestia);
    if(!metadata||metadata.assetId!==assetId||metadata.assetRevision!==1||metadata.metersPerUnit!==1
      ||canonicalJson(metadata.coordinateFrame)!==canonicalJson({upAxis:"+Y",forwardAxis:"+Z",handedness:"RIGHT"}))fail("asset meter/frame binding mismatch");
  }
  if([doc.extensionsUsed,doc.extensionsRequired,doc.extensions,doc.images,doc.textures,doc.skins,doc.animations,doc.cameras].some(v=>v!==undefined))fail("unsupported GLB feature");
  if(doc.buffers.length!==1||doc.buffers[0]!.uri!==undefined||doc.buffers[0]!.byteLength>binLength||binLength-doc.buffers[0]!.byteLength>3)fail("external/unsupported buffer");
  const expectedParts=isHull?manifest!.parts:undefined,partIds=isHull?manifest!.parts.map(p=>p.partId):entry!.partIds;
  const roots=doc.scenes[doc.scene]?.nodes;
  if(doc.scene!==0||doc.scenes.length!==1||!roots||roots.length!==partIds.length||new Set(roots).size!==roots.length
    ||doc.nodes.length!==partIds.length||doc.meshes.length!==partIds.length||roots.some(n=>!integer(n)||n>=doc.nodes.length))fail("part root set mismatch");
  if(isHull&&roots.some((index,order)=>index!==order))fail("Hull part order mismatch");
  const nativeSource=entry?.definitionRef?getFactoryAssetSource(entry.definitionRef.sourceId):undefined;
  const visualSourceSlug=entry?.sourceRuntimeGlb?.path.match(/^apps\/weltraum-browser\/public\/factory\/play-2026-10-12\/([a-z0-9-]+)\.glb$/)?.[1];
  if(entry?.sourceRuntimeGlb&&!visualSourceSlug)fail("source GLB identity mismatch");
  const definitionId=entry?.definitionRef?.sourceId??(entry?`visual_anchor_${(visualSourceSlug??entry.slug).replaceAll("-","_")}`:"");
  const sourceAssetId=nativeSource?.assetId??definitionId;
  const selectedProfiles=isHull?createHullProfiles(manifest!):profiles;
  if(isHull&&canonicalJson(doc.materials.map(material=>({name:material.name,color:material.pbrMetallicRoughness.baseColorFactor})))
    !==canonicalJson(manifest!.palette.map(material=>({name:material.name,color:material.color}))))fail("Hull palette census mismatch");
  const materials=doc.materials.map(material=>{
    const materialProfile=selectedProfiles.get(material.name),factor=material.pbrMetallicRoughness.baseColorFactor;
    if(!materialProfile||factor.length!==4||!factor.every(Number.isFinite)||factor[3]!==1
      ||[materialProfile.baseColor.r,materialProfile.baseColor.g,materialProfile.baseColor.b].some((v,i)=>Math.abs(v-factor[i]!)>1e-6)
      ||material.pbrMetallicRoughness.baseColorTexture!==undefined||material.pbrMetallicRoughness.metallicRoughnessTexture!==undefined
      ||[material.normalTexture,material.occlusionTexture,material.emissiveTexture,material.extensions].some(v=>v!==undefined)
      ||(material.alphaMode??"OPAQUE")!=="OPAQUE")fail("palette/material mismatch");
    return materialProfile;
  });
  const accessor=(index:number,type:"VEC3"|"SCALAR",maximum:number)=>{
    const a=doc.accessors[index],b=a&&doc.bufferViews[a.bufferView],components=type==="VEC3"?3:1,width=type==="VEC3"?4:2;
    if(!integer(index)||!a||a.type!==type||a.componentType!==(type==="VEC3"?5126:5123)||a.sparse!==undefined||a.normalized===true
      ||!integer(a.count)||a.count===0||a.count>maximum||!b||b.buffer!==0||b.extensions!==undefined)fail("unsupported accessor/budget");
    const base=b.byteOffset??0,offset=a.byteOffset??0,stride=b.byteStride??components*width;
    if(![base,offset,b.byteLength,stride].every(integer)||stride<components*width||stride%width!==0||base%width!==0||offset%width!==0
      ||base+b.byteLength>doc.buffers[0]!.byteLength||offset+(a.count-1)*stride+components*width>b.byteLength)fail("accessor byte bounds mismatch");
    return {count:a.count,start:binStart+base+offset,stride};
  };
  const boundsMin=isHull?manifest!.boundsM.min:entry!.nativeBoundsM.min,boundsMax=isHull?manifest!.boundsM.max:entry!.nativeBoundsM.max;
  const seen=new Set<string>(),usedMeshes=new Set<number>();let vertices=0,indices=0,primitiveCount=0;
  const descriptors:DecodedPart[]=roots.map((index,order)=>{
    const node=doc.nodes[index]!,outer=record(node.extras),expected=expectedParts?.[order];
    let partId:string;
    if(isHull){
      if(!expected||node.name!==expected.partId||canonicalJson(node.extras)!==canonicalJson({...manifest!.nodeExtras,partId:expected.partId}))fail("Hull node metadata mismatch");
      partId=expected.partId;
    }else{
      const binding=record(outer?.playBinding),nodeHestia=record(outer?.hestia);
      const candidate=binding?.partId;
      if(typeof candidate!=="string"||!binding||!nodeHestia||!partIds.includes(candidate)||seen.has(candidate)||node.name!==candidate
        ||nodeHestia.partId!==candidate||binding.sourceSHA256!==sourceSha256(entry!)||binding.sourceAssetId!==sourceAssetId
        ||binding.definitionId!==definitionId||(binding.parentPartId??null)!==entry!.parentPartIds[candidate]
        ||!validateSemanticId(candidate).valid)fail("part identity/source binding mismatch");
      partId=candidate;
    }
    if(seen.has(partId))fail("part identity/source binding mismatch");
    seen.add(partId);
    if(!equal(node.translation,[0,0,0])||!equal(node.rotation,[0,0,0,1])||!equal(node.scale,[1,1,1])
      ||!equal(node.matrix,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])||node.children!==undefined||node.skin!==undefined||node.extensions!==undefined)fail("part transform/unsupported hierarchy");
    if(!integer(node.mesh)||usedMeshes.has(node.mesh)||!doc.meshes[node.mesh])fail("part mesh binding mismatch");
    usedMeshes.add(node.mesh);
    const maxPositionAccessor=expected?.maxPositionAccessor??3720,maxIndexAccessor=expected?.maxIndexAccessor??5580;
    let partVertices=0,partIndices=0;
    const primitives:DecodedPrimitive[]=doc.meshes[node.mesh]!.primitives.map(p=>{
      if((p.mode??4)!==4||p.targets!==undefined||p.extensions!==undefined||canonicalJson(Object.keys(p.attributes).sort())!==canonicalJson(["NORMAL","POSITION"]))fail("unsupported primitive");
      const positions=accessor(p.attributes.POSITION,"VEC3",maxPositionAccessor),normals=accessor(p.attributes.NORMAL,"VEC3",maxPositionAccessor),index=accessor(p.indices,"SCALAR",maxIndexAccessor),materialProfile=materials[p.material];
      if(normals.count!==positions.count||index.count%3!==0||!integer(p.material)||!materialProfile)fail("attribute/index/material mismatch");
      partVertices+=positions.count;partIndices+=index.count;primitiveCount++;
      for(let i=0;i<positions.count;i++)for(let axis=0;axis<3;axis++){
        const position=view.getFloat32(positions.start+i*positions.stride+axis*4,true),normal=view.getFloat32(normals.start+i*normals.stride+axis*4,true);
        if(!Number.isFinite(position)||!Number.isFinite(normal))fail("nonfinite position/normal attribute");
        if(position<Math.fround(boundsMin[axis]!)||position>Math.fround(boundsMax[axis]!))fail("source-local position bounds mismatch");
      }
      for(let i=0;i<index.count;i++)if(view.getUint16(index.start+i*index.stride,true)>=positions.count)fail("index out of range");
      return {positions,normals,index,profile:materialProfile};
    });
    if(primitives.length===0||expected&&(partVertices!==expected.vertices||partIndices!==expected.indices||primitives.length!==expected.primitives))fail("Hull part census mismatch");
    vertices+=partVertices;indices+=partIndices;
    return {partId,role:nativeSource?.parts.find(p=>p.partId===partId)?.role??partId,primitives,partVertices,partIndices};
  });
  const cap=isHull?([manifest!.census.vertices,manifest!.census.indices,manifest!.census.primitives] as const):census[entry!.assetId]!;
  if(vertices!==cap[0]||indices!==cap[1]||primitiveCount!==cap[2])fail("mesh census BudgetExceeded");
  if(isHull&&seen.size!==manifest!.parts.length)fail("Hull part set mismatch");

  let renderScratchBytes=0,renderArtifactBytes=0,nativeSectorBytes=0;
  const nativeSectors:HvpCollisionSector[]=[];
  const parts=descriptors.map(part=>{
    const positions=new Float32Array(part.partVertices*3),normals=new Float32Array(part.partVertices*3),renderIndices=new Uint16Array(part.partIndices),
      colors=renderMode==="vertex-colors"?new Float32Array(part.partVertices*3):undefined;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let vertexOffset=0,indexOffset=0;
    const materialRanges=part.primitives.map(p=>{
      for(let i=0;i<p.positions.count;i++)for(let axis=0;axis<3;axis++){
        const position=view.getFloat32(p.positions.start+i*p.positions.stride+axis*4,true);
        positions[(vertexOffset+i)*3+axis]=position;normals[(vertexOffset+i)*3+axis]=view.getFloat32(p.normals.start+i*p.normals.stride+axis*4,true);
        min[axis]=Math.min(min[axis]!,position);max[axis]=Math.max(max[axis]!,position);
      }
      if(colors)for(let i=0;i<p.positions.count;i++){
        const offset=(vertexOffset+i)*3;colors[offset]=p.profile.baseColor.r;colors[offset+1]=p.profile.baseColor.g;colors[offset+2]=p.profile.baseColor.b;
      }
      for(let i=0;i<p.index.count;i++)renderIndices[indexOffset+i]=vertexOffset+view.getUint16(p.index.start+i*p.index.stride,true);
      const range={materialProfileId:p.profile.id,startIndex:indexOffset,indexCount:p.index.count};vertexOffset+=p.positions.count;indexOffset+=p.index.count;return range;
    });
    renderScratchBytes+=positions.byteLength+normals.byteLength+renderIndices.byteLength+(colors?.byteLength??0);
    const ranges=colors?[{materialProfileId:vertexColorProfile.id,startIndex:0,indexCount:part.partIndices}]:materialRanges;
    const artifact=createMeshArtifact({representationKey:representationKey(`factory-play:${instanceId}:${assetId}:${part.partId}`),sourceRevision:sourceRevision(1),artifactRevision:artifactRevision(1),
      algorithmVersion:colors?"factory-play-glb-vertex-colors-v1":"factory-play-glb-v1",frameId:frameId(FRAME),positions,normals,indices:renderIndices,
      attributes:colors?{color:colors}:undefined,materialRanges:ranges,bounds:{min:vector(min),max:vector(max)}});
    renderArtifactBytes+=artifact.positions.byteLength+artifact.normals.byteLength+artifact.indices.byteLength+(artifact.attributes?.color?.byteLength??0);
    if(isHull){
      const worldVertices=new Float32Array(positions.length),nativeIndices=new Uint32Array(renderIndices.length);
      for(let i=0;i<positions.length;i++)worldVertices[i]=Math.fround(positions[i]!+HULL_ANCHOR[i%3]!);
      nativeIndices.set(renderIndices);
      nativeSectorBytes+=worldVertices.byteLength+nativeIndices.byteLength;
      nativeSectors.push({vertices:worldVertices,indices:nativeIndices});
    }
    return Object.freeze({partId:part.partId,role:part.role,artifact,materialProfiles:Object.freeze(colors?[vertexColorProfile]:[...new Set(part.primitives.map(p=>p.profile))])});
  });
  const bounds={min:{x:Infinity,y:Infinity,z:Infinity},max:{x:-Infinity,y:-Infinity,z:-Infinity}};
  for(const part of parts)for(const axis of ["x","y","z"] as const){bounds.min[axis]=Math.min(bounds.min[axis],part.artifact.bounds.min[axis]);bounds.max[axis]=Math.max(bounds.max[axis],part.artifact.bounds.max[axis]);}
  if(isHull){
    if(canonicalJson([[bounds.min.x,bounds.min.y,bounds.min.z],[bounds.max.x,bounds.max.y,bounds.max.z]])
      !==canonicalJson([manifest!.boundsM.min,manifest!.boundsM.max]))fail("Hull bounds census mismatch");
    if(parts.length!==manifest!.parts.length||nativeSectors.length!==manifest!.parts.length||nativeSectorBytes!==manifest!.census.nativeVertexIndexBytes
      ||renderScratchBytes!==manifest!.census.renderVertexColorBytes||renderArtifactBytes!==manifest!.census.renderVertexColorBytes)fail("Hull output census mismatch");
    let nativeHashCopyPeakBytes=0,nativeBytes=0;
    for(let i=0;i<nativeSectors.length;i++){
      const sector=nativeSectors[i]!,pin=manifest!.parts[i]!.native;
      if(sector.vertices.byteLength!==pin.vertexBytes||sector.indices.byteLength!==pin.indexBytes)fail("Hull Native part byte census mismatch");
      nativeBytes+=sector.vertices.byteLength+sector.indices.byteLength;
      nativeHashCopyPeakBytes=Math.max(nativeHashCopyPeakBytes,pin.vertexBytes,pin.indexBytes);
      if(await computeSaveContentHash(byteView(sector.vertices))!==pin.verticesSha256)fail("Hull Native part SHA-256 mismatch");
      aborted(signal);
      if(await computeSaveContentHash(byteView(sector.indices))!==pin.indicesSha256)fail("Hull Native part SHA-256 mismatch");
      aborted(signal);
    }
    if(nativeBytes!==manifest!.census.nativeVertexIndexBytes)fail("Hull Native total byte census mismatch");
    if(renderScratchBytes!==manifest!.costs.renderScratchBytes||renderArtifactBytes!==manifest!.costs.renderArtifactBytes
      ||nativeBytes!==manifest!.costs.nativeSectorBytes||nativeHashCopyPeakBytes!==manifest!.costs.nativeHashCopyPeakBytes)fail("Hull cost census mismatch");
    const result:FactoryHullProjection=deepFreezeMetadata({assetId,glbSha256:manifest!.runtimeGlb.sha256,sourceFileSha256:manifest!.source.sourceGlbSha256,
      definitionRef:null,visualOnlyAnchor:null,frameId:FRAME,bounds,parts,anchorMeters:HULL_ANCHOR,nativeSectors,
      collisionDigest:manifest!.census.nativeCollisionDigest,costs:{...manifest!.costs,...manifest!.metadataCosts}});
    return result;
  }
  return deepFreezeMetadata({assetId,glbSha256:entry!.runtimeGlb.sha256,sourceFileSha256:sourceSha256(entry!),
    definitionRef:entry!.definitionRef,visualOnlyAnchor:entry!.visualOnlyAnchor,frameId:FRAME,bounds,parts,...(entry!.visualVariant?{visualVariant:entry!.visualVariant}:{})});
}
