import { Matrix4, Quaternion, Vector3 } from 'three';
import { copyFixturePayload, getFixtureDigest, type LabFixtureV1, type LabVoxelRegion, type Vec3 } from '../../contracts/fixture';
import { MAX_MANIFEST_BYTES, array, digest, integer, parseBoundedJson, record, relativePath, requireValue, sha256 } from '../../contracts/validation';
import { PINNED_INVENTORY_SHA256, readBoundedResponse } from '../../runner/assets';
import { ownerPose } from '../../runner/threeHost';
import { meshHvpOccupancy } from '../../../../../apps/weltraum-browser/src/hvp/hvpCoastMesher';

export const F01_SELECTION = Object.freeze({ lower: Object.freeze([32,0,16]) as Vec3, upper: Object.freeze([96,64,80]) as Vec3,
  cameraId: 'C02-SHORE', nativeOffset: Object.freeze([96,48,80]) as Vec3 });
export const LIMITS = Object.freeze({ axis:64, cpu:268435456, mesh:134217728, prepare:96*1024*1024,
  output:8*1024*1024, triangles:500000, draws:300, diagnostics:512*1024 });
export interface RayCaps { readonly max3D:number; readonly maxTexture:number; readonly maxViewport:readonly [number,number];
  readonly fragmentSamplers:number; readonly rgba8ui:boolean; readonly contextLost:boolean; }
interface RecipeRegion { readonly id:string; readonly addressing:string; readonly coveragePolicy:string;
  readonly materialIds:readonly string[]; readonly materialSlotsPayload:string; }
export interface RayRecipe { readonly fixtureDigest:string; readonly fixtureId:string; readonly sourceRevision:number;
  readonly recipeSha256:string; readonly recipePath:string; readonly regions:readonly RecipeRegion[];
  readonly sourceIdMeaning:Readonly<Record<string,{readonly region:string; readonly cell:Vec3}>>; }
export interface RayVolume { readonly dimensions:Vec3; readonly offset:Vec3; readonly originMeters:Vec3; readonly quantumMeters:number;
  readonly slots:Uint8Array; readonly coverage:Uint8Array; readonly packed:Uint8Array<ArrayBuffer>;
  readonly worldFromGrid:Matrix4; readonly gridFromWorld:Matrix4; readonly materialIds:readonly string[];
  readonly materials:readonly LabFixtureV1['materials'][number][]; readonly sourceSlotSha256:string;
  readonly source:{readonly ownerId:string; readonly sourceNamespace:string; readonly sourceRevision:number; readonly regionId:string;
    readonly fixtureDigest:string; readonly recipeSha256:string; readonly sourceIds:readonly string[];
    readonly sourceIdMeaning:RayRecipe['sourceIdMeaning']; readonly originalDimensions:Vec3; readonly originalOriginMeters:Vec3}; }
export interface RayAdmission { readonly fixtureDigest:string; readonly recipeSha256:string;
  readonly plans:readonly {readonly region:LabVoxelRegion; readonly recipe:RecipeRegion; readonly offset:Vec3; readonly dimensions:Vec3}[];
  readonly costs:{readonly canonicalPayloadBytes:number; readonly wholeRegionCopyBytes:number; readonly selectedCpuBytes:number;
    readonly cpuPeakEstimateBytes:number; readonly projectionBytes:number}; }
function safeSum(...values:number[]) { const n=values.reduce((a,b)=>a+b,0); requireValue(Number.isSafeInteger(n)&&n>=0,'Byte budget arithmetic overflow'); return n; }
function count(dimensions:Vec3) { dimensions.forEach((n)=>integer(n,1)); const n=dimensions.reduce((a,b)=>a*b,1);
  requireValue(Number.isSafeInteger(n),'Cell count overflow'); return n; }
async function boundBytes(path:string,root:URL,fetcher:typeof fetch,signal?:AbortSignal) {
  relativePath(path); const url=new URL(path,root);
  requireValue(url.origin===root.origin && url.pathname.startsWith(root.pathname) && !url.search && !url.hash,'Recipe outside public root');
  signal?.throwIfAborted(); const bytes=await readBoundedResponse(await fetcher(url.href,{signal,redirect:'error',credentials:'omit'}),MAX_MANIFEST_BYTES);
  signal?.throwIfAborted(); return bytes;
}
/** The shared inventory view deliberately omits recipes; bind its original bytes privately. */
export async function loadRayRecipe(fixture:LabFixtureV1,root:URL,fetcher:typeof fetch=fetch,signal?:AbortSignal):Promise<RayRecipe> {
  const fixtureDigest=getFixtureDigest(fixture); const inventoryBytes=await boundBytes('inventory.json',root,fetcher,signal);
  requireValue(await sha256(inventoryBytes)===PINNED_INVENTORY_SHA256,'Inventory SHA mismatch');
  const inventory=record(parseBoundedJson(inventoryBytes)); array(inventory.fixtures);
  const entry=inventory.fixtures.map(record).find((e)=>e.fixtureDigest===fixtureDigest);
  requireValue(entry && entry.id===fixture.id,'Recipe not bound to frozen fixture'); relativePath(entry.recipePath); digest(entry.recipeSha256);
  const bytes=await boundBytes(entry.recipePath,root,fetcher,signal);
  requireValue(await sha256(bytes)===entry.recipeSha256,'Recipe SHA-256 mismatch'); const raw=record(parseBoundedJson(bytes));
  requireValue(raw.schema==='rd02-fixture-recipe-v1' && raw.productIntegrated===false && raw.mode==='presentation-replay'
    && raw.fixtureDigest===fixtureDigest && raw.fixtureId===fixture.id && raw.sourceRevision===fixture.sourceRevision,'Recipe source binding mismatch');
  array(raw.regions); const regions=raw.regions.map((value):RecipeRegion=>{
    const r=record(value); requireValue(typeof r.id==='string' && typeof r.coveragePolicy==='string','Invalid recipe region');
    requireValue(r.addressing==='X-fast: x+sx*(y+sy*z)','Unsupported recipe addressing'); relativePath(r.materialSlotsPayload); array(r.materialIds);
    requireValue(r.materialIds.length>0 && r.materialIds.every((id)=>typeof id==='string'),'Invalid material slot mapping');
    return Object.freeze({id:r.id,addressing:r.addressing,coveragePolicy:r.coveragePolicy,materialIds:Object.freeze([...r.materialIds]) as string[],materialSlotsPayload:r.materialSlotsPayload});
  });
  requireValue(new Set(regions.map((r)=>r.id)).size===regions.length,'Duplicate recipe region');
  const meanings:Record<string,{region:string;cell:Vec3}>={}; const cases=record(raw.cases);
  if (cases.sourceIdMeaning!==undefined) {
    for (const [id,value] of Object.entries(record(cases.sourceIdMeaning))) {
      const meaning=record(value); array(meaning.cell); requireValue(meaning.cell.length===3 && typeof meaning.region==='string','Invalid source-ID meaning');
      meaning.cell.forEach((n)=>integer(n)); meanings[id]={region:meaning.region,cell:Object.freeze([...meaning.cell]) as unknown as Vec3};
    }
  }
  return Object.freeze({fixtureDigest,fixtureId:fixture.id,sourceRevision:fixture.sourceRevision,recipeSha256:entry.recipeSha256,
    recipePath:entry.recipePath,regions:Object.freeze(regions),sourceIdMeaning:Object.freeze(meanings)});
}
/** No payload copies or texture/buffer/target allocation here. Native caps must come from this canvas, not RD10 history. */
export function admitProjection(fixture:LabFixtureV1,recipe:RayRecipe,caps:RayCaps,
  previous={cpuBytes:0,projectionBytes:0},options={fullF01:false},resolution={width:1280,height:720,dpr:1}):RayAdmission {
  const fixtureDigest=getFixtureDigest(fixture);
  requireValue(fixtureDigest===recipe.fixtureDigest && fixture.id===recipe.fixtureId && fixture.sourceRevision===recipe.sourceRevision,'Stale recipe/source');
  requireValue(!caps.contextLost && caps.rgba8ui,'UNSUPPORTED: RGBA8UI volume format/context');
  [caps.max3D,caps.maxTexture,caps.fragmentSamplers,...caps.maxViewport].forEach((n)=>integer(n,1));
  integer(resolution.width,1); integer(resolution.height,1); requireValue(Number.isFinite(resolution.dpr)&&resolution.dpr>=1&&resolution.dpr<=4,'Invalid DPR');
  requireValue(resolution.width*resolution.dpr<=Math.min(caps.maxTexture,caps.maxViewport[0])
    && resolution.height*resolution.dpr<=Math.min(caps.maxTexture,caps.maxViewport[1]) && caps.fragmentSamplers>=1,'Viewport/sampler format limit');
  const selected=fixture.id==='F01-HVP-COAST'&&!options.fullF01;
  const regions=(fixture.voxelRegions??[]).filter((r)=>!selected||r.id==='coast-crop');
  requireValue(regions.length>0 && regions.length<=LIMITS.draws,'Missing/over-budget voxel regions');
  let wholeRegionCopyBytes=0; let selectedCpuBytes=0; let projectionBytes=0;
  const plans=regions.map((region)=>{
    const r=recipe.regions.find((r)=>r.id===region.id); requireValue(r,'Missing exact recipe region');
    requireValue(r.addressing==='X-fast: x+sx*(y+sy*z)' && r.materialIds.length<=7,'Addressing/material slot limit (1..7)');
    for (const id of r.materialIds) {
      const m=fixture.materials.find((m)=>m.id===id); requireValue(m,'Missing material reference');
      requireValue((m.opacity??1)===1 && (m.depthWrite??true),'UNSUPPORTED: transparent/non-depth-writing voxel material');
    }
    const originalCount=count(region.dimensions);
    for (const id of [region.occupancyPayload,region.knownCoveragePayload,r.materialSlotsPayload]) {
      const p=fixture.payloads.find((p)=>p.id===id); requireValue(p?.elementType==='uint8' && p.length===originalCount && p.byteLength===originalCount,'Payload length/type mismatch');
    }
    requireValue(new Set([region.occupancyPayload,region.knownCoveragePayload,r.materialSlotsPayload]).size===3,'Coverage/occupancy/slots must remain separate');
    const offset:Vec3=selected?F01_SELECTION.lower:[0,0,0];
    const dimensions:Vec3=selected?F01_SELECTION.upper.map((n,a)=>n-offset[a]) as unknown as Vec3:region.dimensions;
    dimensions.forEach((n,a)=>{ integer(n,1); integer(offset[a]); requireValue(n<=LIMITS.axis && n<=caps.max3D,'64-axis volume/device dimension limit');
      requireValue(offset[a]+n<=region.dimensions[a],'Selection outside source'); });
    const cells=count(dimensions); wholeRegionCopyBytes=safeSum(wholeRegionCopyBytes,originalCount*3);
    selectedCpuBytes=safeSum(selectedCpuBytes,cells*6); projectionBytes=safeSum(projectionBytes,cells*4);
    return {region,recipe:r,offset,dimensions};
  });
  const canonicalPayloadBytes=safeSum(...fixture.payloads.map((p)=>p.byteLength));
  // Includes transport/private import coexistence and whole F01 copies, not just the crop.
  const cpuPeakEstimateBytes=safeSum(canonicalPayloadBytes*3,wholeRegionCopyBytes,selectedCpuBytes,previous.cpuBytes);
  requireValue(cpuPeakEstimateBytes<=LIMITS.cpu && safeSum(wholeRegionCopyBytes,selectedCpuBytes)<=LIMITS.prepare,'CPU/prepare byte budget exceeded');
  requireValue(safeSum(projectionBytes,previous.projectionBytes)<=LIMITS.output,'Projection/output byte budget exceeded');
  return Object.freeze({fixtureDigest,recipeSha256:recipe.recipeSha256,plans:Object.freeze(plans),
    costs:Object.freeze({canonicalPayloadBytes,wholeRegionCopyBytes,selectedCpuBytes,cpuPeakEstimateBytes,projectionBytes})});
}
export function prepareVolumes(fixture:LabFixtureV1,recipe:RayRecipe,admission:RayAdmission):RayVolume[] {
  requireValue(getFixtureDigest(fixture)===admission.fixtureDigest && recipe.recipeSha256===admission.recipeSha256,'Stale admission');
  return admission.plans.map(({region,recipe:r,offset,dimensions})=>{
    const occupied=copyFixturePayload(fixture,region.occupancyPayload); const known=copyFixturePayload(fixture,region.knownCoveragePayload);
    const original=copyFixturePayload(fixture,r.materialSlotsPayload); const originalCount=count(region.dimensions);
    requireValue(occupied instanceof Uint8Array && known instanceof Uint8Array && original instanceof Uint8Array
      && occupied.length===originalCount && known.length===originalCount && original.length===originalCount,'Payload copy mismatch');
    for (let i=0;i<originalCount;i+=1) {
      requireValue(known[i]<=1 && occupied[i]<=1 && (original[i]===0)===(occupied[i]===0)
        && (occupied[i]===0||known[i]===1) && original[i]<=7 && original[i]<=r.materialIds.length,'Invalid occupancy/coverage/material slot');
    }
    const cells=count(dimensions); const slots=new Uint8Array(cells); const coverage=new Uint8Array(cells); const packed=new Uint8Array(cells*4);
    const [sx,sy,sz]=dimensions; const [ox,oy,oz]=offset; const [rx,ry]=region.dimensions;
    for (let z=0;z<sz;z+=1) { for (let y=0;y<sy;y+=1) { for (let x=0;x<sx;x+=1) {
      const i=x+sx*(y+sy*z); const j=x+ox+rx*(y+oy+ry*(z+oz)); slots[i]=original[j]; coverage[i]=known[j];
      packed[i*4]=occupied[j]; packed[i*4+1]=known[j]; packed[i*4+2]=original[j];
    } } }
    const pose=ownerPose(fixture,region.ownerId); requireValue(pose,'Missing composed world owner'); const q=fixture.quantumMeters;
    const originMeters=region.originMeters.map((n,a)=>n+offset[a]*q) as unknown as Vec3;
    const owner=new Matrix4().compose(new Vector3(...pose.originMeters),new Quaternion(...pose.rotationXyzw),new Vector3(1,1,1));
    const worldFromGrid=owner.multiply(new Matrix4().compose(new Vector3(...originMeters),new Quaternion(),new Vector3(q,q,q)));
    const object=fixture.objects.find((o)=>o.ownerId===region.ownerId)!;
    return {dimensions,offset,originMeters,quantumMeters:q,slots,coverage,packed,worldFromGrid,gridFromWorld:worldFromGrid.clone().invert(),
      materialIds:r.materialIds,materials:r.materialIds.map((id)=>fixture.materials.find((m)=>m.id===id)!),
      sourceSlotSha256:fixture.payloads.find((p)=>p.id===r.materialSlotsPayload)!.sha256,
      source:{ownerId:pose.ownerId,sourceNamespace:pose.sourceNamespace,sourceRevision:pose.sourceRevision,regionId:region.id,
        fixtureDigest:admission.fixtureDigest,recipeSha256:recipe.recipeSha256,sourceIds:object.sourceIds,sourceIdMeaning:recipe.sourceIdMeaning,
        originalDimensions:region.dimensions,originalOriginMeters:region.originMeters}};
  });
}
export function slotAt(v:RayVolume,x:number,y:number,z:number) {
  const [sx,sy,sz]=v.dimensions; return x<0||y<0||z<0||x>=sx||y>=sy||z>=sz?0:v.slots[x+sx*(y+sy*z)];
}
export function buildGreedy(v:RayVolume) {
  requireValue(v.slots.length===count(v.dimensions) && v.slots.every((slot)=>slot<=7 && slot<=v.materialIds.length),'Greedy material slot limit');
  const [sizeX,sizeY,sizeZ]=v.dimensions; const [x,y,z]=v.originMeters;
  const mesh=meshHvpOccupancy({sizeX,sizeY,sizeZ,cellMeters:v.quantumMeters,originMeters:{x,y,z},slotAt:(x,y,z)=>slotAt(v,x,y,z)},
    {maxVisitedCells:64**3,maxQuads:Math.floor(LIMITS.output/120),maxVertices:4*Math.floor(LIMITS.output/120),maxIndices:6*Math.floor(LIMITS.output/120)},
    v.source.fixtureDigest,'rd13-common-greedy-no-ao-v1',{ao:false});
  // Pure projection batching: original slot numbers, vertices and winding stay unchanged.
  // Product mesher emits face-order ranges; drawing every range exceeds the frozen draw cap.
  const indices=new (mesh.indices instanceof Uint32Array?Uint32Array:Uint16Array)(mesh.indices.length);
  const materialRanges:{slot:number;startIndex:number;indexCount:number}[]=[]; let cursor=0;
  for (let slot=1;slot<=v.materialIds.length;slot+=1) {
    const startIndex=cursor;
    for (const r of mesh.materialRanges) { if (r.slot===slot) {indices.set(mesh.indices.subarray(r.startIndex,r.startIndex+r.indexCount),cursor);cursor+=r.indexCount;} }
    if (cursor>startIndex) {materialRanges.push({slot,startIndex,indexCount:cursor-startIndex});}
  }
  requireValue(cursor===indices.length,'Greedy slot coverage mismatch');
  return {...mesh,indices,materialRanges,tempEstimateBytes:mesh.tempEstimateBytes+mesh.indices.byteLength};
}
