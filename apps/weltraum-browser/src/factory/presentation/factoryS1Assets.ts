import type { FactoryAssetDefinitionRef } from "./factoryAssets";
import type { FactoryPartCellProjection } from "./factoryPartCells";
import type { LoadPlayAssetInput, PlayAssetProjection } from "./playAssetLoader";
import { sampleMachinePose, type MachinePose } from "./machinePose";
import { createFactoryPartCellProjection } from "./factoryPartCells";
import { loadPlayAssetProjection } from "./playAssetLoader";
import { deepFreezeMetadata, validateMeshArtifact } from "../../presentation";
import { createFp02CatalogInput, loadFactoryCatalog } from "../catalog/fp02Catalog";
import { canonicalSignature } from "../../resources/serialization";
import { isSaveSafeResourceId } from "../../resources/ids";
import type { FactoryNativePartObservation } from "../../hestia-prototype/physics/factoryFacilitySession";
import type { HvpPhysicsSnapshot } from "../../hestia-prototype/physics/physicsWorker";
const catalog=loadFactoryCatalog(createFp02CatalogInput());
export interface FactoryS1WorkRead {
 readonly sessionId:string;readonly epoch:number;readonly publicationRevision:number;readonly nativeTick:number;
 readonly catalogDigest:string;readonly instanceId:string;readonly definitionRef:FactoryAssetDefinitionRef;
 readonly sourceDigest:string;readonly profileDigest:string;readonly installationRevision:number;readonly terrainRevision:number;readonly facilityRevision:number;
 readonly confirmed:boolean;readonly status:string;readonly confirmedWorkMs:number;readonly jobId:string|null;
 readonly recipeRef:Readonly<{sourceId:string;version:number;digest:string}>|null;
 readonly custody:Readonly<{inputContainerId:string;wipContainerId:string;outputContainerId:string;offcutContainerId:string;installedContainerId:string}>;
}
export interface FactoryS1NativeParts {
 readonly sessionId:string;readonly epoch:number;readonly nativeTick:number;
 readonly rawObservation:FactoryNativePartObservation;
}
export interface FactoryS1Assets {
 readonly instanceId:string;readonly cells:FactoryPartCellProjection;readonly render:PlayAssetProjection;
 readonly cost:Readonly<{cpu:number;mesh:number;triangles:number;draws:number}>;
}
export interface FactoryS1Sample {
 readonly sessionId:string;readonly epoch:number;readonly nativeTick:number;readonly terrainRevision:number;readonly facilityRevision:number;
 /** The private Host passes its actual current physics.read() object, never a UI copy. */
 readonly currentPhysicsSnapshot:Readonly<Pick<HvpPhysicsSnapshot,"ticks"|"status"|"factoryFacilities">>;
 readonly native:FactoryS1NativeParts;readonly work:FactoryS1WorkRead;
}
const owned=new WeakSet<FactoryS1Assets>(),disposed=new WeakSet<FactoryS1Assets>();
const assetIds=Object.freeze({B06:"play_cutter_v2",B07:"play_former_v2"});
const bytes=(artifact:import("../../presentation").MeshArtifact)=>artifact.positions.byteLength+(artifact.normals?.byteLength??0)+artifact.indices.byteLength+(artifact.attributes?.color?.byteLength??0);
const sameRef=(a:FactoryAssetDefinitionRef,b:FactoryAssetDefinitionRef)=>a.sourceId===b.sourceId&&a.version===b.version&&a.digest===b.digest;
function invalid(reason:string):never{throw Error(`FactoryS1 ${reason}`);}
const heldPose:MachinePose=deepFreezeMetadata({status:"FAULT",phase:"held",paused:true,partPoses:[]});

/** Closed cell/native geometry derivative plus an actual hash-checked GLB.
 * No World, work, inventory, GPU scene or physical material authority is created.
 */
export const loadFactoryS1Assets=async(ref:FactoryAssetDefinitionRef&{instanceId:string},options:Pick<LoadPlayAssetInput,"fetch"|"signal"|"renderMode">={}):Promise<FactoryS1Assets>=>{
 const definitionRef=Object.freeze({sourceId:ref.sourceId,version:ref.version,digest:ref.digest}),instanceId=ref.instanceId;
 const {fetch,signal,renderMode}=options;if(definitionRef.sourceId!=="B06"&&definitionRef.sourceId!=="B07")invalid("closed definition binding mismatch");
 const cells=createFactoryPartCellProjection({...definitionRef,instanceId});
 const render=await loadPlayAssetProjection({assetId:assetIds[definitionRef.sourceId],instanceId,expectedBinding:{definitionRef},fetch,signal,renderMode});
 if(signal?.aborted)throw new DOMException("FactoryS1 load aborted","AbortError");
 if(!render.definitionRef||!sameRef(render.definitionRef,definitionRef)||render.frameId!==cells.frameId||render.sourceFileSha256!==cells.sourceFileSha256
  ||render.parts.length!==cells.parts.length||render.parts.some(p=>!cells.parts.some(c=>c.partId===p.partId)))invalid("render/cell binding mismatch");
 for(const part of render.parts){
  const source=cells.source.parts.find(p=>p.partId===part.partId)!;
  if(!validateMeshArtifact(part.artifact).valid)invalid("render artifact binding mismatch");
  // The Float32 export remains inside the unchanged per-part Native box union.
  // Triangle colors do not supply structural cells, density, BOM or inventory.
  for(let i=0;i<part.artifact.positions.length;i+=3){
   const position=part.artifact.positions;
   if(!source.boxes.some(box=>[0,1,2].every(axis=>Math.abs(position[i+axis]!-box.centerM[axis]!)<=box.sizeM[axis]!/2+0.000003)))invalid("render part outside native cell envelope");
  }
 }
 const mesh=render.parts.reduce((n,p)=>n+bytes(p.artifact),0),cellMesh=cells.parts.reduce((n,p)=>n+bytes(p.artifact),0);
 const occupancy=cells.parts.reduce((n,p)=>n+p.sizeX*p.sizeY*p.sizeZ,0);
 const cost=Object.freeze({cpu:cellMesh+occupancy+mesh*2,mesh:mesh*2,triangles:render.parts.reduce((n,p)=>n+p.artifact.indices.length/3,0),draws:render.parts.reduce((n,p)=>n+p.artifact.materialRanges.length,0)});
 const result=Object.freeze({instanceId,cells,render,cost});owned.add(result);return result;
};

/** Native presence and the existing owner's committed paid-job read are joined
 * on every sample. The Host owns snapshot freshness and domain read production;
 * this module cannot manufacture either proof from IDs or advance their clocks.
 */
export const sampleFactoryS1Assets=(assets:FactoryS1Assets,read:FactoryS1Sample):MachinePose=>{
 if(disposed.has(assets))invalid("disposed owned assets");if(!owned.has(assets))invalid("unadmitted assets binding");
 const {cells}=assets,{work,currentPhysicsSnapshot:snapshot}=read,native=read.native?.rawObservation,facilities=snapshot?.factoryFacilities;
 if(!native||!facilities||snapshot.ticks!==read.nativeTick||facilities.revision!==read.facilityRevision
  ||read.native.sessionId!==read.sessionId||read.native.epoch!==read.epoch||read.native.nativeTick!==read.nativeTick)invalid("current native snapshot binding mismatch");
 const rows=facilities.partObservations?.filter(p=>p.instanceId===assets.instanceId)??[],owners=facilities.owners.filter(o=>o.instanceId===assets.instanceId),owner=owners[0];
 if(rows.length!==1||rows[0]!==native||owners.length!==1||!owner
  ||!sameRef(owner.definitionRef,cells.definitionRef)||owner.sourceDigest!==cells.sourceDigest||owner.profileDigest!==cells.profileDigest
  ||native.installationRevision!==owner.installationRevision||work.installationRevision!==owner.installationRevision)invalid("current native owner binding mismatch");
 const {observationDigest,...observation}=native;
 if(observationDigest!==canonicalSignature(observation))invalid("native observation digest binding mismatch");
 if(![read.epoch,read.nativeTick,read.terrainRevision,read.facilityRevision,native.installationRevision,work.publicationRevision,work.confirmedWorkMs].every(n=>Number.isSafeInteger(n)&&n>=0)
  ||native.instanceId!==assets.instanceId||work.instanceId!==assets.instanceId||!sameRef(native.definitionRef,cells.definitionRef)||!sameRef(work.definitionRef,cells.definitionRef)
  ||native.sourceDigest!==cells.sourceDigest||work.sourceDigest!==cells.sourceDigest||native.profileDigest!==cells.profileDigest||work.profileDigest!==cells.profileDigest
  ||work.sessionId!==read.sessionId||work.epoch!==read.epoch||work.nativeTick!==read.nativeTick
  ||native.terrainRevision!==read.terrainRevision||work.terrainRevision!==read.terrainRevision||native.facilityRevision!==read.facilityRevision||work.facilityRevision!==read.facilityRevision
  ||work.catalogDigest!==catalog.catalogDigest)invalid("native/work binding mismatch");
 for(const role of ["input","wip","output","offcut","installed"] as const)if(work.custody[`${role}ContainerId`]!==`${role}_${assets.instanceId}`)invalid("paid custody binding mismatch");
 if((work.jobId!==null&&!isSaveSafeResourceId(work.jobId))||(work.status==="RUNNING"&&work.jobId===null))invalid("current paid job binding missing");
 if(work.recipeRef){
  const recipe=catalog.recipes.find(r=>r.sourceId===work.recipeRef!.sourceId),definition=catalog.devices.find(d=>d.sourceId===cells.definitionRef.sourceId)!;
  if(!recipe||recipe.version!==work.recipeRef.version||recipe.digest!==work.recipeRef.digest
   ||!recipe.processes.some(p=>p.kind==="electric"&&definition.capabilities.includes(p.capability)))invalid("active recipe binding mismatch");
 }else if(work.jobId!==null||work.confirmedWorkMs!==0)invalid("active recipe binding missing");
 const ids=new Set(native.parts.map(p=>p.partId));
 if(ids.size!==native.parts.length||native.parts.length!==cells.parts.length||native.parts.some(p=>!cells.parts.some(c=>c.partId===p.partId)))invalid("native part binding mismatch");
 const present=new Set(native.confirmed&&native.published?native.parts.filter(p=>p.status==="Present"&&p.colliderHandles.length>0).map(p=>p.partId):[]);
 // Authored semantic parents survive independently of neutral GLB sibling roots.
 for(const [child,parent] of Object.entries(cells.semanticParents))if(!present.has(parent))present.delete(child);
 const complete=native.complete&&native.parts.every(p=>p.status==="Present"&&p.colliderHandles.length>0);
 // Suppress before evaluating motion: substituted unconfirmed/Hold milliseconds
 // never move surviving parts, and no zero-work reset or cached part resurrection occurs.
 if(!native.confirmed||!native.published||!complete||!work.confirmed||snapshot.status!=="Running"||facilities.state!=="Idle"||work.status==="FAULT")return heldPose;
 const status=work.status;
 const semanticProjection={definitionRef:cells.definitionRef,source:cells.source,sourceDigest:cells.sourceDigest,kind:cells.source.kind,frameId:cells.frameId,bounds:cells.bounds,parts:cells.parts,ports:cells.source.ports};
 const pose=sampleMachinePose({projection:semanticProjection,status,confirmedWorkMs:work.confirmedWorkMs,presentPartIds:[...present],damageRevision:native.facilityRevision},0);
 // Production completion is truthful paid history; the existing motion sampler
 // predates this domain status and otherwise labels it UNKNOWN.
 return status==="COMPLETED"?deepFreezeMetadata({...pose,status}):pose;
};
export const disposeFactoryS1Assets=(assets:FactoryS1Assets):void=>{if(!owned.has(assets))invalid("unadmitted assets binding");disposed.add(assets);};
