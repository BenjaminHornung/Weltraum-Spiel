import {fnv1aHash} from "../../core/hash";
import {HVP_COAST_MATERIAL_REGISTRY} from "../../hvp/hvpCoastSource";
import {prepareHvpRigidBody,prepareHvpRigidBodyOwnedHashSteps,hvpRigidColliderBoxes,type HvpRigidRecipeSpans,type HvpTransferredColliderBox} from "../physics/rigidRecipe";
import {ingestHvpStructuralCells,prepareHvpStructuralIngestOwnedSteps,type HvpStructuralCell} from "./structuralIngest";
import {borrowedHvpPlanSteps} from "../physics/hvpPlanSteps";
import {structuralSortSteps,type StructuralOwnedReserve} from "../../voxel/structural/validation";
import type {HvpPreparedCut,HvpTerrainSnapshot} from "./cutPlan";
import type {HvpCell,HvpCellReader} from "./picking";

export interface HvpTerrainFragment {
  readonly id:string;readonly digest:string;readonly cells:readonly HvpStructuralCell[];
  readonly min:HvpCell;readonly max:HvpCell;readonly massKg:number;readonly colliders:number;
  readonly affectedLeaves:readonly string[];readonly colliderBoxes:readonly HvpTransferredColliderBox[];
}
/** Optional wall-clock sub-spans; only the support worker populates them. */
export interface HvpSupportTimings {
  readonly seedsMs:number;readonly supportMs:number;readonly ingestMs:number;readonly recipeMs:number;
  readonly fragmentCount:number;readonly fragmentCells:number;readonly totalMs:number;
  readonly recipeBreakdown?:{readonly massMs:number;readonly classifyMs:number;readonly transitionMs:number;readonly axesMs:number};
}
export interface HvpSupportTimingsCollector {
  mark:(phase:"seeds"|"support"|"ingest"|"recipe")=>void;
  recipe:(spans:HvpRigidRecipeSpans)=>void;
  done:(fragmentCount:number,fragmentCells:number)=>HvpSupportTimings;
}
/** Accumulates named wall-clock spans; nested/overlapping marks are not supported. */
export const createHvpSupportTimingsCollector=(now:()=>number=()=>performance.now()):HvpSupportTimingsCollector=>{
  const marks:{seeds?:number;support?:number;ingest?:number;recipe?:number}={};
  const breakdown={massMs:0,classifyMs:0,transitionMs:0,axesMs:0};let recipes=0;
  let open:("seeds"|"support"|"ingest"|"recipe")|undefined,start=0;
  return {
    mark:(phase)=>{
      const end=now();
      if(open!==undefined){marks[open]=(marks[open]??0)+end-start;}
      open=phase;start=end;
    },
    recipe:(spans)=>{
      recipes+=1;
      breakdown.massMs+=spans.massMs??0;breakdown.classifyMs+=spans.classifyMs??0;
      breakdown.transitionMs+=spans.transitionMs??0;breakdown.axesMs+=spans.axesMs??0;
    },
    done:(fragmentCount,fragmentCells)=>{
      const end=now();
      if(open!==undefined){marks[open]=(marks[open]??0)+end-start;}
      open=undefined;start=0;
      const total=(marks.seeds??0)+(marks.support??0)+(marks.ingest??0)+(marks.recipe??0);
      return Object.freeze({seedsMs:marks.seeds??0,supportMs:marks.support??0,ingestMs:marks.ingest??0,recipeMs:marks.recipe??0,
        fragmentCount,fragmentCells,totalMs:Math.round(total*1000)/1000,
        ...(recipes===0?{}:{recipeBreakdown:Object.freeze({...breakdown})})});
    }
  };
};
export interface HvpSupportReport {
  readonly status:"Ready"|"NoChange"|"UnknownBoundary"|"OverBudget"|"FragmentOverBudget";
  readonly reason:string;readonly probes:number;readonly anchoredWitnesses:number;
  readonly fragments:readonly HvpTerrainFragment[];readonly workingBytes:number;
  readonly timings?:HvpSupportTimings;
}
export interface HvpSupportPlan extends HvpSupportReport {readonly cut:HvpPreparedCut}
const issued=new WeakSet<HvpSupportPlan>();
export const createHvpSupportPhaseCredits=(persistentBytes:number,residentAtAdmission:number)=>{
  const limit=96*1024*1024;
  if(!Number.isSafeInteger(persistentBytes)||persistentBytes<0||persistentBytes>limit||!Number.isSafeInteger(residentAtAdmission)
    ||residentAtAdmission<0||residentAtAdmission+limit>256*1024*1024){throw new Error("Invalid support Prepare96/CPU256 phase credits");}
  let retained=persistentBytes,released=false,native=false,failure:Error|undefined;
  const lanes=new Map<object,number>();
  const fail=(message:string):never=>{failure??=new Error(message);throw failure;};
  const current=()=>{if(failure){throw failure;}if(released){throw new Error("Support phase credits released");}};
  const remaining=()=>limit-retained-[...lanes.values()].reduce((n,v)=>n+v,0);
  return {
    residentAtAdmission,
    get remainingBytes(){current();return remaining();},
    beginLane(parallel:number){
      current();if(native||!Number.isSafeInteger(parallel)||parallel<1||parallel>2||lanes.size>=parallel){return fail("Support derivative phase pending or invalid lanes");}
      const bytes=Math.floor(remaining()/parallel);if(bytes<=0){return fail("Support derivative Prepare budget exhausted");}
      const token=Object.freeze({bytes});lanes.set(token,bytes);return token;
    },
    endLane(token:{readonly bytes:number},productBytes:number):void{
      current();const grant=lanes.get(token);if(grant===undefined){return fail("Foreign support lane grant");}
      if(!Number.isSafeInteger(productBytes)||productBytes<0||productBytes>grant){return fail("Support retained product exceeds lane grant");}
      lanes.delete(token);retained+=productBytes;
    },
    nativeGrant(copyBytes:number):number{
      current();if(lanes.size!==0||native){throw new Error("Support derivative or Native phase active/pending");}
      if(!Number.isSafeInteger(copyBytes)||copyBytes<0||copyBytes>=remaining()){return fail("Invalid or exhausted support Native copy budget");}
      retained+=copyBytes;native=true;return remaining();
    },
    release():void{released=true;lanes.clear();retained=0;}
  };
};
export type HvpSupportPhaseCredits=ReturnType<typeof createHvpSupportPhaseCredits>;
const ownedLifetimes=new WeakMap<HvpSupportPlan,{release:()=>void;credits?:HvpSupportPhaseCredits;current?:HvpPreparedCut}>();
/** Credits follow the exact issued plan through transfer/commit/rollback, never a look-alike report. */
export const releaseHvpOwnedSupportPlan=(plan:HvpSupportPlan):void=>{const own=ownedLifetimes.get(plan);ownedLifetimes.delete(plan);own?.credits?.release();own?.release();};
export const bindHvpOwnedSupportCut=(support:HvpSupportPlan,current:HvpPreparedCut):HvpSupportPhaseCredits|undefined=>{
  const own=ownedLifetimes.get(support);if(own===undefined){return undefined;}
  if(current.before!==support.cut.before||current.request!==support.cut.request||(own.current!==undefined&&own.current!==current)){
    throw new Error("Foreign support transfer/cut phase binding");
  }own.current=current;return own.credits;
};
const directions:readonly HvpCell[]=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
const materials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,
  structuralClass:m.role,destructible:true,tags:null}));

/** The same JSON cell order and FNV32 UTF16 kernel; fixed-schema cells never need a bulk string. */
export function* hvpSupportCellDigestSteps(cells:readonly HvpStructuralCell[]):Generator<string,string,unknown>{
  let hash=0x811c9dc5;
  const append=(text:string)=>{for(let i=0;i<text.length;i+=1){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193);}};
  append("[");
  for(let i=0;i<cells.length;i+=1){if(i!==0){append(",");}append(JSON.stringify(cells[i]));yield "supportDigest";}
  append("]");return (hash>>>0).toString(16).padStart(8,"0");
}

/** Actual candidate occupancy only: no generator heights or chunk-edge anchors. */
export const analyzeHvpSupportSnapshot=(source:HvpCellReader,changed:readonly HvpCell[],budgets:{maxProbes?:number;maxFragmentCells?:number}={},clock?:HvpSupportTimingsCollector):HvpSupportReport=>{
  const steps=supportSnapshotSteps(source,changed,budgets,clock);
  for(;;){const step=steps.next();if(step.done){return step.value;}}
};
/** Direct-module first-party worker entry. One caller owns all allocations and fragment lifetimes. */
export interface HvpOwnedSupportWork {
  readonly reserve:StructuralOwnedReserve;readonly retain:(bytes:number)=>void;
  readonly beginFragment:()=>void;readonly endFragment:()=>void;
}
export function* analyzeHvpSupportSnapshotOwnedSteps(source:HvpCellReader,changed:readonly HvpCell[],
  budgets:{maxProbes?:number;maxFragmentCells?:number},clock:HvpSupportTimingsCollector|undefined,work:HvpOwnedSupportWork){
  return yield* supportSnapshotSteps(source,changed,budgets,clock,work);
}
function* supportSnapshotSteps(source:HvpCellReader,changed:readonly HvpCell[],budgets:{maxProbes?:number;maxFragmentCells?:number},
  clock?:HvpSupportTimingsCollector,owned?:HvpOwnedSupportWork):Generator<string,HvpSupportReport,unknown>{
  const maxProbes=budgets.maxProbes??262_144,maxFragment=budgets.maxFragmentCells??32_768;
  if(source.cellMeters!==.125||![source.sizeX,source.sizeY,source.sizeZ].every(n=>Number.isSafeInteger(n)&&n>0&&n<=256)
    ||!Number.isSafeInteger(maxProbes)||maxProbes<1||maxProbes>262_144
    ||!Number.isSafeInteger(maxFragment)||maxFragment<1||maxFragment>32_768
    ||changed.length>512||changed.some(p=>p.length!==3||p.some((v,a)=>!Number.isSafeInteger(v)||v<0||v>=[source.sizeX,source.sizeY,source.sizeZ][a]!))){
    throw new Error("Invalid bounded support input");
  }
  if(changed.length===0){return Object.freeze({status:"NoChange",reason:"",probes:0,anchoredWitnesses:0,fragments:Object.freeze([]),workingBytes:0});}
  const sizeX=source.sizeX,sizeY=source.sizeY,plane=sizeX*sizeY;
  // One byte per source cell and one bounded queue: no cell-object graph for terrain.
  owned?.retain(plane*source.sizeZ+maxProbes*4+4096+changed.length*6*64);
  const marks=new Uint8Array(plane*source.sizeZ),queue=new Uint32Array(maxProbes);
  let probes=0,anchoredWitnesses=0;
  const fragments:HvpTerrainFragment[]=[];
  const key=(x:number,y:number,z:number)=>x+y*sizeX+z*plane;
  const cell=(id:number):HvpCell=>[id%sizeX,Math.floor(id/sizeX)%sizeY,Math.floor(id/plane)];
  const inside=(x:number,y:number,z:number)=>x>=0&&x<sizeX&&y>=0&&y<sizeY&&z>=0&&z<source.sizeZ;
  const read=(x:number,y:number,z:number):number|undefined=>{
    if(!inside(x,y,z)){return undefined;}
    const id=key(x,y,z);
    if((marks[id]!&1)===0){
      if(probes===maxProbes){throw new Error("SupportProbeBudget");}
      probes+=1;marks[id]!|=1;
    }
    const slot=source.readSlot(x,y,z);
    if(slot!==undefined&&(!Number.isInteger(slot)||slot<0||slot>4)){throw new Error("Invalid support material");}
    return slot;
  };
  const finish=(status:HvpSupportReport["status"],reason=""):HvpSupportReport=>{
    return Object.freeze({status,reason,probes,anchoredWitnesses,
      fragments:Object.freeze(status==="Ready"?fragments:[]),
      workingBytes:marks.byteLength+queue.byteLength+fragments.reduce((n,f)=>n+f.cells.length*32,0)});
  };
  try{
    clock?.mark("seeds");
    const seeds=new Set<number>();
    for(const [x,y,z] of changed){for(const [dx,dy,dz] of directions){
      const p: HvpCell=[x+dx,y+dy,z+dz];
      if(!inside(...p)){return finish("UnknownBoundary","Cut touches unknown coverage");}
      const slot=read(...p);
      if(slot===undefined){return finish("UnknownBoundary","Cut touches unknown coverage");}
      if(slot!==0){seeds.add(key(...p));}
      if(owned){yield "supportSeeds";}
    }}
    clock?.mark("support");
    const sortedSeeds=[...seeds];
    if(owned){yield* borrowedHvpPlanSteps(structuralSortSteps(sortedSeeds,(a,b)=>a-b,owned.retain),"supportSeeds");}
    else{sortedSeeds.sort((a,b)=>a-b);}
    for(const seed of sortedSeeds){
      if((marks[seed]!&6)!==0){continue;}
      const [sx,sy,sz]=cell(seed);
      // A currently occupied straight chain ending in the explicit y=0 base
      // is a sufficient witness, not an assumption about unvisited source.
      let supported=true;
      for(let y=sy;y>=0;y-=1){const slot=read(sx,y,sz);if(slot===undefined||slot===0){supported=false;break;}if(owned){yield "supportColumn";}}
      if(supported){for(let y=sy;y>=0;y-=1){marks[key(sx,y,sz)]!|=2;if(owned){yield "supportMarks";}}anchoredWitnesses+=1;continue;}
      let count=1,head=0,anchored=false,unknown=false;
      queue[0]=seed;marks[seed]!|=8;
      while(head<count&&!anchored){
        const id=queue[head++]!,[x,y,z]=cell(id);
        if(y===0||(marks[id]!&2)!==0){anchored=true;break;}
        for(const [dx,dy,dz] of directions){
          const nx=x+dx,ny=y+dy,nz=z+dz,slot=read(nx,ny,nz);
          if(owned){yield "supportSearch";}
          if(slot===undefined){unknown=true;continue;}
          if(slot===0){continue;}
          const next=key(nx,ny,nz);
          if((marks[next]!&2)!==0){anchored=true;break;}
          if((marks[next]!&8)!==0){continue;}
          if(count===queue.length){return finish("OverBudget","Component queue exceeded probe budget");}
          marks[next]!|=8;queue[count++]=next;
        }
      }
      if(anchored){for(let i=0;i<count;i+=1){marks[queue[i]!]!|=2;if(owned){yield "supportMarks";}}anchoredWitnesses+=1;continue;}
      if(unknown){return finish("UnknownBoundary","Component boundary is not fully known");}
      if(count>maxFragment||fragments.length===32){return finish("FragmentOverBudget","Detached component exceeds bounded fragment admission");}
      owned?.retain(4096+count*256+64*256+count*96);
      let ids:number[];
      if(owned){ids=[];for(let i=0;i<count;i+=1){ids.push(queue[i]!);yield "supportCells";}
        yield* borrowedHvpPlanSteps(structuralSortSteps(ids,(a,b)=>a-b,owned.retain),"supportCells");}
      else{ids=[...queue.subarray(0,count)].sort((a,b)=>a-b);}
      let cells:readonly HvpStructuralCell[];
      if(owned){const entries:HvpStructuralCell[]=[];for(const id of ids){const [x,y,z]=cell(id);marks[id]!|=4;
        entries.push(Object.freeze({x,y,z,materialId:read(x,y,z)!}));yield "supportCells";}cells=Object.freeze(entries);}
      else{cells=Object.freeze(ids.map(id=>{const [x,y,z]=cell(id);marks[id]!|=4;
        return Object.freeze({x,y,z,materialId:read(x,y,z)!});}));}
      const digest=owned===undefined?fnv1aHash(JSON.stringify(cells)):yield* hvpSupportCellDigestSteps(cells);
      let massKg:number,colliders:number,colliderBoxes:readonly HvpTransferredColliderBox[];
      owned?.beginFragment();
      try{
        clock?.mark("ingest");
        const source=owned===undefined?ingestHvpStructuralCells(`hvp-terrain-fragment-${digest}`,cells,materials)
          :yield* borrowedHvpPlanSteps(prepareHvpStructuralIngestOwnedSteps(`hvp-terrain-fragment-${digest}`,cells,materials,[],owned.reserve),"supportIngest");
        clock?.mark("recipe");
        const spans:HvpRigidRecipeSpans={};
        const recipe=owned===undefined?prepareHvpRigidBody(source,clock?spans:undefined)
          :yield* prepareHvpRigidBodyOwnedHashSteps(source,clock?spans:undefined,undefined,owned.reserve);
        if(clock){clock.recipe(spans);}
        massKg=recipe.mass.totalMassKg;colliders=recipe.colliders.length;
        colliderBoxes=hvpRigidColliderBoxes(recipe);
        clock?.mark("support");
      }catch(error){
        if(error instanceof Error&&(error.message.includes("BudgetExceeded")||(error as Error&{code?:string}).code==="BudgetExceeded")){
          return finish("FragmentOverBudget",`Exact ingest/collision admission: ${String(error)}`);
        }
        throw error;
      }finally{owned?.endFragment();}
      const lower=[Infinity,Infinity,Infinity],upper=[-Infinity,-Infinity,-Infinity];
      for(const c of cells){for(const [a,v] of [c.x,c.y,c.z].entries()){lower[a]=Math.min(lower[a]!,v);upper[a]=Math.max(upper[a]!,v+1);}if(owned){yield "supportBounds";}}
      const min=Object.freeze(lower) as unknown as HvpCell,max=Object.freeze(upper) as unknown as HvpCell;
      let leaves:string[];
      if(owned){const keys=new Set<string>();for(const c of cells){keys.add(`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}:${Math.floor(c.z/16)}`);yield "supportLeaves";}
        leaves=[...keys];yield* borrowedHvpPlanSteps(structuralSortSteps(leaves,(a,b)=>a<b?-1:a>b?1:0,owned.retain),"supportLeaves");}
      else{leaves=[...new Set(cells.map(c=>`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}:${Math.floor(c.z/16)}`))].sort();}
      fragments.push(Object.freeze({id:`hvp-terrain-fragment-${digest}`,digest,cells,min,max,massKg,colliders,affectedLeaves:Object.freeze(leaves),colliderBoxes}));
    }
    return finish("Ready");
  }catch(error){if(error instanceof Error&&error.message==="SupportProbeBudget"){return finish("OverBudget","Support probes exhausted; no artificial break");}throw error;}
}

/** Only an accepted, identity-bound worker report is passed here by the compiler. */
export const bindHvpSupportPlan=(cut:HvpPreparedCut,report:HvpSupportReport,releaseOwned?:()=>void,credits?:HvpSupportPhaseCredits):HvpSupportPlan=>{
  if(cut.after.sessionId!==cut.before.sessionId||cut.after.epoch!==cut.before.epoch
    ||cut.after.revision!==cut.before.revision+(cut.changed.length>0?1:0)){throw new Error("Invalid support generation");}
  const result=Object.freeze({...report,cut});issued.add(result);if(releaseOwned){ownedLifetimes.set(result,{release:releaseOwned,credits});}return result;
};
export const analyzeHvpTerrainSupport=(cut:HvpPreparedCut,budgets:{maxProbes?:number;maxFragmentCells?:number}={}):HvpSupportPlan=>
  bindHvpSupportPlan(cut,analyzeHvpSupportSnapshot(cut.after,cut.changed.map(c=>c.cell),budgets));

export const assertHvpSupportCurrent=(plan:HvpSupportPlan,current:HvpTerrainSnapshot):void=>{
  if(!issued.has(plan)||plan.cut.before!==current||plan.status!=="Ready"){throw new Error("Stale or incomplete support plan");}
};
