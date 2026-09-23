import {fnv1aHash} from "../../core/hash";
import {HVP_COAST_MATERIAL_REGISTRY} from "../../hvp/hvpCoastSource";
import {prepareHvpRigidBody,hvpRigidColliderBoxes,type HvpRigidRecipeSpans,type HvpTransferredColliderBox} from "../physics/rigidRecipe";
import {ingestHvpStructuralCells,type HvpStructuralCell} from "./structuralIngest";
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
const directions:readonly HvpCell[]=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
const materials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,
  structuralClass:m.role,destructible:true,tags:null}));

/** Actual candidate occupancy only: no generator heights or chunk-edge anchors. */
export const analyzeHvpSupportSnapshot=(source:HvpCellReader,changed:readonly HvpCell[],budgets:{maxProbes?:number;maxFragmentCells?:number}={},clock?:HvpSupportTimingsCollector):HvpSupportReport=>{
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
    }}
    clock?.mark("support");
    for(const seed of [...seeds].sort((a,b)=>a-b)){
      if((marks[seed]!&6)!==0){continue;}
      const [sx,sy,sz]=cell(seed);
      // A currently occupied straight chain ending in the explicit y=0 base
      // is a sufficient witness, not an assumption about unvisited source.
      let supported=true;
      for(let y=sy;y>=0;y-=1){const slot=read(sx,y,sz);if(slot===undefined||slot===0){supported=false;break;}}
      if(supported){for(let y=sy;y>=0;y-=1){marks[key(sx,y,sz)]!|=2;}anchoredWitnesses+=1;continue;}
      let count=1,head=0,anchored=false,unknown=false;
      queue[0]=seed;marks[seed]!|=8;
      while(head<count&&!anchored){
        const id=queue[head++]!,[x,y,z]=cell(id);
        if(y===0||(marks[id]!&2)!==0){anchored=true;break;}
        for(const [dx,dy,dz] of directions){
          const nx=x+dx,ny=y+dy,nz=z+dz,slot=read(nx,ny,nz);
          if(slot===undefined){unknown=true;continue;}
          if(slot===0){continue;}
          const next=key(nx,ny,nz);
          if((marks[next]!&2)!==0){anchored=true;break;}
          if((marks[next]!&8)!==0){continue;}
          if(count===queue.length){return finish("OverBudget","Component queue exceeded probe budget");}
          marks[next]!|=8;queue[count++]=next;
        }
      }
      if(anchored){for(let i=0;i<count;i+=1){marks[queue[i]!]!|=2;}anchoredWitnesses+=1;continue;}
      if(unknown){return finish("UnknownBoundary","Component boundary is not fully known");}
      if(count>maxFragment||fragments.length===32){return finish("FragmentOverBudget","Detached component exceeds bounded fragment admission");}
      const ids=[...queue.subarray(0,count)].sort((a,b)=>a-b);
      const cells=Object.freeze(ids.map(id=>{const [x,y,z]=cell(id);marks[id]!|=4;
        return Object.freeze({x,y,z,materialId:read(x,y,z)!});}));
      const digest=fnv1aHash(JSON.stringify(cells));
      let massKg:number,colliders:number,colliderBoxes:readonly HvpTransferredColliderBox[];
      try{
        clock?.mark("ingest");
        const source=ingestHvpStructuralCells(`hvp-terrain-fragment-${digest}`,cells,materials);
        clock?.mark("recipe");
        const spans:HvpRigidRecipeSpans={};
        const recipe=prepareHvpRigidBody(source,clock?spans:undefined);
        if(clock){clock.recipe(spans);}
        massKg=recipe.mass.totalMassKg;colliders=recipe.colliders.length;
        colliderBoxes=hvpRigidColliderBoxes(recipe);
        clock?.mark("support");
      }catch(error){
        if(error instanceof Error&&(error.message.includes("BudgetExceeded")||(error as Error&{code?:string}).code==="BudgetExceeded")){
          return finish("FragmentOverBudget",`Exact ingest/collision admission: ${String(error)}`);
        }
        throw error;
      }
      const lower=[Infinity,Infinity,Infinity],upper=[-Infinity,-Infinity,-Infinity];
      for(const c of cells){for(const [a,v] of [c.x,c.y,c.z].entries()){lower[a]=Math.min(lower[a]!,v);upper[a]=Math.max(upper[a]!,v+1);}}
      const min=Object.freeze(lower) as unknown as HvpCell,max=Object.freeze(upper) as unknown as HvpCell;
      const leaves=[...new Set(cells.map(c=>`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}:${Math.floor(c.z/16)}`))].sort();
      fragments.push(Object.freeze({id:`hvp-terrain-fragment-${digest}`,digest,cells,min,max,massKg,colliders,affectedLeaves:Object.freeze(leaves),colliderBoxes}));
    }
    return finish("Ready");
  }catch(error){if(error instanceof Error&&error.message==="SupportProbeBudget"){return finish("OverBudget","Support probes exhausted; no artificial break");}throw error;}
};

/** Only an accepted, identity-bound worker report is passed here by the compiler. */
export const bindHvpSupportPlan=(cut:HvpPreparedCut,report:HvpSupportReport):HvpSupportPlan=>{
  if(cut.after.sessionId!==cut.before.sessionId||cut.after.epoch!==cut.before.epoch
    ||cut.after.revision!==cut.before.revision+(cut.changed.length>0?1:0)){throw new Error("Invalid support generation");}
  const result=Object.freeze({...report,cut});issued.add(result);return result;
};
export const analyzeHvpTerrainSupport=(cut:HvpPreparedCut,budgets:{maxProbes?:number;maxFragmentCells?:number}={}):HvpSupportPlan=>
  bindHvpSupportPlan(cut,analyzeHvpSupportSnapshot(cut.after,cut.changed.map(c=>c.cell),budgets));

export const assertHvpSupportCurrent=(plan:HvpSupportPlan,current:HvpTerrainSnapshot):void=>{
  if(!issued.has(plan)||plan.cut.before!==current||plan.status!=="Ready"){throw new Error("Stale or incomplete support plan");}
};
