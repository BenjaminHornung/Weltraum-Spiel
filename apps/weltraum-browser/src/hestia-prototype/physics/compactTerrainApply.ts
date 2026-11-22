import {checkedCompactSpans} from "../../voxel/structural/componentIndex/fragment";
import {matchesHvpFragmentSourceDigest,supportsCompactArchive} from "./compactFragmentIdentity";
import type {HvpTerrainFragmentRequest} from "./terrainFragment";
import type {HvpCollisionSector} from "./terrainColliders";
import type {HvpPhysicsSnapshot} from "./physicsWorkerHost";
import {requireExactKeys,requirePlainRecord} from "../../voxel/adaptive/validation";

export type TerrainReplacements=readonly {index:number;mesh:HvpCollisionSector}[];
export type TerrainViews=Readonly<HvpPhysicsSnapshot["preparedTerrainFragments"]>;

/** Fixed amount of native validation per single-command turn. Larger work retains the sliced path. */
export function admitsCompactTerrainApply(replacements:TerrainReplacements,fragments:readonly HvpTerrainFragmentRequest[]) {
  const f=fragments[0];
  return fragments.length===1 && !!f?.compactSource && supportsCompactArchive(f.compactSource)
    && (f.cells.length===0 || f.cells.length===f.compactSource.cellCount) && !f.sourceSubset && !f.sourceRegion && f.colliderBoxes.length>0 && f.colliderBoxes.length<=64
    && f.colliderBoxes.every(b=>Array.isArray(b.min)&&b.min.length===3&&Array.isArray(b.max)&&b.max.length===3)
    && replacements.length>0 && replacements.length<=8
    && replacements.reduce((n,r)=>n+r.mesh.vertices.byteLength+r.mesh.indices.byteLength,0)<=256*1024;
}

export function readTerrainSourceViews(values:unknown,requests:readonly HvpTerrainFragmentRequest[]):TerrainViews {
  if(!Array.isArray(values)||values.length!==requests.length)throw new Error("Invalid Native terrain source views");
  return Object.freeze(values.map((value,index)=>{
    const view=requirePlainRecord(value,"terrainPlan/sourceViews"),request=requests[index]!;
    requireExactKeys(view,["ownerId","sourceDigest","centerOfMass","cellCount","massKg","colliders","sourceBytes"],"terrainPlan/sourceViews");
    const center=requirePlainRecord(view.centerOfMass,"terrainPlan/sourceViews/centerOfMass");
    requireExactKeys(center,["x","y","z"],"terrainPlan/sourceViews/centerOfMass");
    const cellCount=request.compactSource?.cellCount??request.cells.length;
    if(request.cells.length>0&&request.cells.length!==cellCount || view.ownerId!==request.ownerId||!matchesHvpFragmentSourceDigest(view.sourceDigest,request)
      ||![center.x,center.y,center.z].every(v=>typeof v==="number"&&Number.isFinite(v))||view.cellCount!==cellCount
      ||typeof view.massKg!=="number"||!Number.isFinite(view.massKg)||view.massKg<=0||Math.abs(view.massKg-request.massKg)>1e-8
      ||!Number.isSafeInteger(view.colliders)||view.colliders!==request.colliderBoxes.length
      ||!Number.isSafeInteger(view.sourceBytes)||(view.sourceBytes as number)<131072||(view.sourceBytes as number)>256*1024*1024){
      throw new Error("Invalid Native terrain source view binding");
    }
    return Object.freeze({ownerId:request.ownerId,sourceDigest:view.sourceDigest,centerOfMass:Object.freeze({x:center.x as number,y:center.y as number,z:center.z as number}),
      cellCount,massKg:view.massKg,colliders:view.colliders as number,sourceBytes:view.sourceBytes as number});
  }));
}

export const compactWorldBudget=(counts:{bodyCount:number;colliderCount:number})=>counts.bodyCount<=32&&counts.colliderCount<=1024;

export function sameCompactBinding(a:import("./session").HvpTerrainBinding|undefined,b:import("./session").HvpTerrainBinding|undefined){
  return !!a&&!!b&&a.sessionId===b.sessionId&&a.epoch===b.epoch&&a.commandId===b.commandId&&a.baseRevision===b.baseRevision
    &&a.baseDigest===b.baseDigest&&a.targetDigest===b.targetDigest;
}

/** Native accepts runs. Any additional rendering cells must describe exactly the same material at the same coordinates. */
export function assertCompactDisplayCells(fragment:HvpTerrainFragmentRequest){
  const wire=fragment.compactSource,cells=fragment.cells;
  if(!wire||!cells.length)return;
  if(cells.length!==wire.cellCount)throw new Error("Compact/display membership count mismatch");
  const cmp=(a:typeof cells[number],b:typeof cells[number])=>a.z-b.z||a.y-b.y||a.x-b.x;
  const ordered=cells.some((c,i)=>i>0&&cmp(cells[i-1]!,c)>0)?[...cells].sort(cmp):cells;
  let at=0;
  for(const run of checkedCompactSpans(wire)){
    for(let x=run.x;x<run.end;x++){
      const c=ordered[at++];
      if(!c||c.x!==x||c.y!==run.y||c.z!==run.z||c.materialId!==run.material)throw new Error("Compact/display membership mismatch");
    }
  }
  if(at!==cells.length)throw new Error("Compact/display membership mismatch");
}

type RecoveryMotion=import("./session").HvpTerrainMotion;
export type CompactWitness={base?:RecoveryMotion;forward?:RecoveryMotion;sealedAt?:number;views?:TerrainViews;rejected?:true;delivered:number};
export function readCompactWitness(port:MessagePort,id:number,incarnation:string,binding:import("./session").HvpTerrainBinding,worldId:string):Promise<CompactWitness>{
  return new Promise((resolve,reject)=>{
    const stored:CompactWitness={delivered:0};
    const finish=(reason?:string)=>{
      clearTimeout(timer);port.onmessage=null;port.removeEventListener("close",closed);
      if(reason)reject(new Error("RecoveryHold: "+reason));else resolve(stored);
    };
    const closed=()=>{if(stored.base||stored.forward||stored.rejected)finish();else finish("base tick unavailable before compact seal");};
    // Silence cannot prove non-publication. Only ordered sender closure or an explicit native disposition can prove a base-only result.
    const timer=setTimeout(()=>finish("compact publication witness did not terminate"),2000);
    port.addEventListener("close",closed);
    port.onmessage=({data})=>{
      if(data?.id!==id||data?.incarnation!==incarnation||++stored.delivered>2){finish("invalid compact witness envelope");return;}
      if(data.kind==="Rejected"&&sameCompactBinding(binding,data.binding)){stored.rejected=true;finish();return;}
      const m=data.motion as RecoveryMotion|undefined;
      if(!m||!sameCompactBinding(binding,m.binding)||m.worldId!==worldId||!(m.tick.status==="Paused"||m.tick.status==="SimulationHold"&&!m.running)){
        finish("invalid compact witness motion");return;
      }
      if(data.kind==="Base"&&!stored.base&&m.revision===binding.baseRevision){stored.base=m;return;}
      if(data.kind==="Forward"&&stored.base&&m.revision===binding.baseRevision+1&&m.tick.ticks===stored.base.tick.ticks&&Number.isFinite(data.sealedAt)&&data.sealedAt>0&&Array.isArray(data.views)){
        stored.forward=m;stored.sealedAt=data.sealedAt;stored.views=data.views;finish();return;
      }
      finish("invalid compact witness order");
    };
  });
}

export const compactFragmentSignature=(f:HvpTerrainFragmentRequest)=>JSON.stringify([
  f.ownerId,f.massKg,[f.origin.x,f.origin.y,f.origin.z],f.colliderBoxes.map(b=>[b.min,b.max]),
  f.compactSource!.generation,f.compactSource!.cellCount,
  f.compactSource!.parts.map(p=>[p.origin,p.leafRevision,p.label,p.runs])
]);
