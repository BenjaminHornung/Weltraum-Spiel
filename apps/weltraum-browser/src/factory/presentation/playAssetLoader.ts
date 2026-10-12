import manifestBytes from "../../../public/factory/play-2026-10-12/manifest.json?raw";
import surfaceManifestBytes from "../../../public/factory/play-2026-10-12/manifest-surface-v2.json?raw";
import {
  artifactRevision, createMaterialProfile, createMeshArtifact, deepFreezeMetadata, frameId, materialProfileId,
  representationKey, sourceRevision, validateSemanticId, type AxisAlignedBounds, type MaterialProfile, type MeshArtifact
} from "../../presentation";
import { computeSaveContentHash } from "../../browser-storage/checksum";
import { canonicalJson } from "../../resources/serialization";
import { getFactoryAssetSource } from "./factoryAssets";

export interface PlayDefinitionRef { readonly sourceId:string; readonly version:number; readonly digest:string }
export type PlayExpectedBinding = Readonly<{definitionRef:PlayDefinitionRef;visualOnlyAnchor?:never}> |
  Readonly<{visualOnlyAnchor:Readonly<Record<string,unknown>>;definitionRef?:never}>;
export interface PlayAssetProjection {
  readonly assetId:string; readonly glbSha256:string; readonly sourceFileSha256:string;
  readonly definitionRef:PlayDefinitionRef|null; readonly visualOnlyAnchor:Readonly<Record<string,unknown>>|null;
  readonly frameId:string; readonly bounds:AxisAlignedBounds;
  readonly parts:readonly Readonly<{partId:string;role:string;artifact:MeshArtifact;materialProfiles:readonly MaterialProfile[]}>[];
  readonly visualVariant?:Readonly<{baseAssetId:string;kind:string;pose:string;requiresConfirmedLocalAccess:boolean}>;
}
export interface LoadPlayAssetInput {
  readonly assetId:string; readonly instanceId:string; readonly expectedBinding:PlayExpectedBinding;
  readonly signal?:AbortSignal; readonly fetch?:typeof globalThis.fetch;
}
interface Entry {
  assetId:string;slug:string;family:string;units:string;runtimeAxes:string;partIds:readonly string[];
  parentPartIds:Readonly<Record<string,string|null>>;definitionRef:PlayDefinitionRef|null;visualOnlyAnchor:Readonly<Record<string,unknown>>|null;
  sourceFile:{sha256:string};runtimeGlb:{url:string;bytes:number;sha256:string};nativeBoundsM:{min:readonly number[];max:readonly number[]};
  visualVariant?:PlayAssetProjection["visualVariant"];
}
interface Document {
  asset:{version:string;extras:{hestia:{assetId:string;assetRevision:number;metersPerUnit:number;coordinateFrame:unknown}}};
  scene:number;scenes:readonly {nodes:readonly number[]}[];
  nodes:readonly {name:string;mesh:number;matrix?:readonly number[];translation?:readonly number[];rotation?:readonly number[];scale?:readonly number[];
    children?:readonly number[];skin?:number;extensions?:unknown;
    extras:{hestia:{partId:string};playBinding:{partId:string;parentPartId?:string|null;definitionId:string;sourceAssetId:string;sourceSHA256:string}}}[];
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
// Actual sealed export census, in vertices/indices/primitives per file. These
// local caps precede output allocation; aggregate scene admission remains Host-owned.
const census:Readonly<Record<string,readonly [number,number,number]>>=Object.freeze({
  play_belt_v1:[1296,1944,22],play_brace_v1:[120,180,4],play_carrier_heavy_v1:[360,540,8],play_carrier_light_v1:[360,540,8],play_carrier_medium_v1:[360,540,8],
  play_cutter_v1:[1680,2520,21],play_former_v1:[1704,2556,24],play_cutter_v2:[1680,2520,21],play_former_v2:[1704,2556,24],play_offcut_v1:[216,324,3],play_profile_v1:[144,216,2],play_semi_v1:[96,144,1],
  play_sheet_v1:[120,180,1],play_steel_v1:[96,144,2],play_battery_v1:[480,720,7],play_cable_end_v1:[72,108,3],play_cable_link_v1:[24,36,1],
  play_distribution_v1:[480,720,7],play_pv_v1:[3720,5580,8],play_wind_v1:[384,576,9],play_storage_v1:[600,900,7],play_workbench_v1:[648,972,15],
  play_wreck_cargo_v1:[360,540,4],play_wreck_cargo_open_v1:[312,468,4],play_storage_inspection_open_v1:[600,900,7]
});
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
  return deepFreezeMetadata([...manifest.assets,...surface.assets]);
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

/**
 * Imports only the 23 original and two versioned hash-sealed Play exports' embedded, indexed float VEC3
 * primitives. No scene/extension engine, Three objects, GPU or World is created.
 * Caller binding is explicit; current Native presence/profile and selection of
 * inspection variants remain Host responsibilities, not inferred from triangles.
 */
export const loadPlayAssetProjection=async(input:LoadPlayAssetInput):Promise<PlayAssetProjection>=>{
  // TypeScript readonly does not freeze a caller's DTO. Bind this invocation
  // before the first await while retaining the original signal's live abort state.
  const {assetId,instanceId,signal,fetch:capturedFetch}=input;
  const fetcher=capturedFetch??globalThis.fetch;
  aborted(signal);
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
  if(await sha256(bytes)!==entry.runtimeGlb.sha256)fail("GLB hash mismatch");
  aborted(signal);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==0x46546c67 || view.getUint32(4,true)!==2 || view.getUint32(8,true)!==bytes.byteLength)fail("unsupported GLB header");
  const jsonLength=view.getUint32(12,true),binHeader=20+jsonLength;
  if(jsonLength%4!==0 || binHeader+8>bytes.byteLength || view.getUint32(16,true)!==0x4e4f534a)fail("unsupported GLB JSON chunk");
  const binLength=view.getUint32(binHeader,true),binStart=binHeader+8;
  if(view.getUint32(binHeader+4,true)!==0x004e4942 || binLength%4!==0 || binStart+binLength!==bytes.byteLength)fail("unsupported GLB BIN chunk");
  const doc=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes.subarray(20,binHeader))) as Document;
  rejectExtensions(doc);
  const metadata=doc.asset.extras.hestia;
  if(doc.asset.version!=="2.0" || metadata.assetId!==entry.assetId || metadata.assetRevision!==1 || metadata.metersPerUnit!==1
    || canonicalJson(metadata.coordinateFrame)!==canonicalJson({upAxis:"+Y",forwardAxis:"+Z",handedness:"RIGHT"}))fail("asset meter/frame binding mismatch");
  if([doc.extensionsUsed,doc.extensionsRequired,doc.extensions,doc.images,doc.textures,doc.skins,doc.animations,doc.cameras].some(v=>v!==undefined))fail("unsupported GLB feature");
  if(doc.buffers.length!==1 || doc.buffers[0]!.uri!==undefined || doc.buffers[0]!.byteLength>binLength || binLength-doc.buffers[0]!.byteLength>3)fail("external/unsupported buffer");
  const roots=doc.scenes[doc.scene]?.nodes;
  if(doc.scenes.length!==1 || !roots || roots.length!==entry.partIds.length || new Set(roots).size!==roots.length
    || doc.nodes.length!==entry.partIds.length || doc.meshes.length!==entry.partIds.length || roots.some(n=>!integer(n)||n>=doc.nodes.length))fail("part root set mismatch");
  const nativeSource=entry.definitionRef?getFactoryAssetSource(entry.definitionRef.sourceId):undefined;
  const definitionId=entry.definitionRef?.sourceId??`visual_anchor_${entry.slug.replaceAll("-","_")}`;
  const sourceAssetId=nativeSource?.assetId??definitionId;
  const materials=doc.materials.map(material=>{
    const profile=profiles.get(material.name),factor=material.pbrMetallicRoughness.baseColorFactor;
    if(!profile || factor.length!==4 || !factor.every(Number.isFinite) || factor[3]!==1
      || [profile.baseColor.r,profile.baseColor.g,profile.baseColor.b].some((v,i)=>Math.abs(v-factor[i]!)>1e-6)
      || material.pbrMetallicRoughness.baseColorTexture!==undefined || material.pbrMetallicRoughness.metallicRoughnessTexture!==undefined
      || [material.normalTexture,material.occlusionTexture,material.emissiveTexture,material.extensions].some(v=>v!==undefined)
      || (material.alphaMode??"OPAQUE")!=="OPAQUE")fail("palette/material mismatch");
    return profile;
  });
  const accessor=(index:number,type:"VEC3"|"SCALAR")=>{
    const a=doc.accessors[index],b=a&&doc.bufferViews[a.bufferView],components=type==="VEC3"?3:1,width=type==="VEC3"?4:2;
    if(!integer(index)||!a||a.type!==type||a.componentType!==(type==="VEC3"?5126:5123)||a.sparse!==undefined||a.normalized===true
      || !integer(a.count)||a.count===0||a.count>(type==="VEC3"?3720:5580)||!b||b.buffer!==0||b.extensions!==undefined)fail("unsupported accessor/budget");
    const base=b.byteOffset??0,offset=a.byteOffset??0,stride=b.byteStride??components*width;
    if(![base,offset,b.byteLength,stride].every(integer) || stride<components*width || stride%width!==0 || base%width!==0 || offset%width!==0
      || base+b.byteLength>doc.buffers[0]!.byteLength || offset+(a.count-1)*stride+components*width>b.byteLength)fail("accessor byte bounds mismatch");
    return {count:a.count,start:binStart+base+offset,stride,components};
  };
  const seen=new Set<string>(),usedMeshes=new Set<number>();let vertices=0,indices=0,primitiveCount=0;
  const descriptors=roots.map(index=>{
    const node=doc.nodes[index]!,binding=node.extras.playBinding,partId=binding.partId;
    if(!entry.partIds.includes(partId)||seen.has(partId)||node.name!==partId||node.extras.hestia.partId!==partId
      || binding.sourceSHA256!==entry.sourceFile.sha256||binding.sourceAssetId!==sourceAssetId||binding.definitionId!==definitionId
      || (binding.parentPartId??null)!==entry.parentPartIds[partId] || !validateSemanticId(partId).valid)fail("part identity/source binding mismatch");
    seen.add(partId);
    if(!equal(node.translation,[0,0,0])||!equal(node.rotation,[0,0,0,1])||!equal(node.scale,[1,1,1])
      || !equal(node.matrix,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])||node.children!==undefined||node.skin!==undefined||node.extensions!==undefined)fail("part transform/unsupported hierarchy");
    if(!integer(node.mesh)||usedMeshes.has(node.mesh)||!doc.meshes[node.mesh])fail("part mesh binding mismatch");
    usedMeshes.add(node.mesh);
    let partVertices=0,partIndices=0;
    const primitives=doc.meshes[node.mesh]!.primitives.map(p=>{
      if((p.mode??4)!==4||p.targets!==undefined||p.extensions!==undefined||canonicalJson(Object.keys(p.attributes).sort())!==canonicalJson(["NORMAL","POSITION"]))fail("unsupported primitive");
      const positions=accessor(p.attributes.POSITION,"VEC3"),normals=accessor(p.attributes.NORMAL,"VEC3"),index=accessor(p.indices,"SCALAR"),profile=materials[p.material];
      if(normals.count!==positions.count||index.count%3!==0||!integer(p.material)||!profile)fail("attribute/index/material mismatch");
      partVertices+=positions.count;partIndices+=index.count;primitiveCount++;
      for(let i=0;i<positions.count;i++)for(let axis=0;axis<3;axis++){
        const position=view.getFloat32(positions.start+i*positions.stride+axis*4,true),normal=view.getFloat32(normals.start+i*normals.stride+axis*4,true);
        if(!Number.isFinite(position)||!Number.isFinite(normal))fail("nonfinite position/normal attribute");
        if(position<Math.fround(entry.nativeBoundsM.min[axis]!)||position>Math.fround(entry.nativeBoundsM.max[axis]!))fail("source-local position bounds mismatch");
      }
      for(let i=0;i<index.count;i++)if(view.getUint16(index.start+i*index.stride,true)>=positions.count)fail("index out of range");
      return {positions,normals,index,profile};
    });
    if(primitives.length===0)fail("part primitive missing");
    vertices+=partVertices;indices+=partIndices;
    return {partId,role:nativeSource?.parts.find(p=>p.partId===partId)?.role??partId,primitives,partVertices,partIndices};
  });
  const cap=census[entry.assetId]!;
  if(vertices!==cap[0]||indices!==cap[1]||primitiveCount!==cap[2])fail("mesh census BudgetExceeded");
  // Every index, finite value, palette, root, bounds and file count was checked
  // before these bounded output arrays. createMeshArtifact takes copied ownership.
  const parts=descriptors.map(part=>{
    const positions=new Float32Array(part.partVertices*3),normals=new Float32Array(part.partVertices*3),indices=new Uint16Array(part.partIndices);
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let vertexOffset=0,indexOffset=0;
    const materialRanges=part.primitives.map(p=>{
      for(let i=0;i<p.positions.count;i++)for(let axis=0;axis<3;axis++){
        const position=view.getFloat32(p.positions.start+i*p.positions.stride+axis*4,true);
        positions[(vertexOffset+i)*3+axis]=position;normals[(vertexOffset+i)*3+axis]=view.getFloat32(p.normals.start+i*p.normals.stride+axis*4,true);
        min[axis]=Math.min(min[axis]!,position);max[axis]=Math.max(max[axis]!,position);
      }
      for(let i=0;i<p.index.count;i++)indices[indexOffset+i]=vertexOffset+view.getUint16(p.index.start+i*p.index.stride,true);
      const range={materialProfileId:p.profile.id,startIndex:indexOffset,indexCount:p.index.count};vertexOffset+=p.positions.count;indexOffset+=p.index.count;return range;
    });
    const artifact=createMeshArtifact({representationKey:representationKey(`factory-play:${instanceId}:${entry.assetId}:${part.partId}`),sourceRevision:sourceRevision(1),artifactRevision:artifactRevision(1),
      algorithmVersion:"factory-play-glb-v1",frameId:frameId(FRAME),positions,normals,indices,materialRanges,bounds:{min:vector(min),max:vector(max)}});
    return Object.freeze({partId:part.partId,role:part.role,artifact,materialProfiles:Object.freeze([...new Set(part.primitives.map(p=>p.profile))])});
  });
  const bounds={min:{x:Infinity,y:Infinity,z:Infinity},max:{x:-Infinity,y:-Infinity,z:-Infinity}};
  for(const part of parts)for(const axis of ["x","y","z"] as const){bounds.min[axis]=Math.min(bounds.min[axis],part.artifact.bounds.min[axis]);bounds.max[axis]=Math.max(bounds.max[axis],part.artifact.bounds.max[axis]);}
  return deepFreezeMetadata({assetId:entry.assetId,glbSha256:entry.runtimeGlb.sha256,sourceFileSha256:entry.sourceFile.sha256,
    definitionRef:entry.definitionRef,visualOnlyAnchor:entry.visualOnlyAnchor,frameId:FRAME,bounds,parts,...(entry.visualVariant?{visualVariant:entry.visualVariant}:{})});
};
