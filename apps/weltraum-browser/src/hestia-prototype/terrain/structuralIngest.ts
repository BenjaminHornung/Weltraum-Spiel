import {
  ADAPTIVE_BRICK_ESTIMATED_BYTES, ADAPTIVE_BRICK_ESTIMATED_WORK, authorityRevision,
  createAdaptiveAuthorityRetention, createAdaptiveBaseFieldDescriptor, createAdaptiveBrickKey,
  createAdaptiveEditJournal, createAdaptiveResidentValidationProofs, materializeAdaptiveBrick,
  stableAuthorityId, type AdaptiveEditInput, type AdaptivePlannerSnapshot
} from "../../voxel/adaptive";
import { createStructuralMaterialTable, createStructuralObjectFromAdaptive, createStructuralCellAddress, STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION } from "../../voxel/structural";
import {measureHvpCut,type HvpCutSpan,type HvpCutTrace} from "../runtime/cutTrace";
import {adaptiveDrainSteps,adaptiveDenseArraySteps,adaptiveMapSteps,adaptiveSortSteps,adaptiveFreezeArraySteps} from "../../voxel/adaptive/validation";
import {adaptiveEditJournalSteps,type AdaptiveOwnedJournalOptions} from "../../voxel/adaptive/edits";
import {structuralMaterialTableSteps,createStructuralOwnerLedger,ownedStructuralAdaptiveIngestSteps} from "../../voxel/structural/model";
import {structuralNonNegativeSafeInteger,structuralPositiveBudget,structuralFail,type StructuralOwnedReserve} from "../../voxel/structural/validation";
import type {StructuralCursorStep} from "../../voxel/structural/occupiedEntries";
import {createOwnedCanonicalHashCursor} from "../../voxel/adaptive/ownedCanonicalHashSteps";
import {adaptiveMaterializeBrickSteps} from "../../voxel/adaptive/materialization";
import {adaptiveResidentValidationProofsSteps} from "../../voxel/adaptive/canonical";

export interface HvpStructuralCell { readonly x:number;readonly y:number;readonly z:number;readonly materialId:number }

type IngestMeasure = <T>(phase:string,run:()=>T)=>T;
type IngestRun = HvpStructuralCell & {end:number};
type SortedRuns = {cells:HvpStructuralCell[];origins:Map<string,{x:number;y:number;z:number}>;runs:IngestRun[]};
type JournalPreparation = {
  frame:Readonly<{schemaVersion:typeof STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION;bodyId:string;surfaceFrameId:string;
    regionId:string;generatorVersion:string;objectOriginQuantum:Readonly<{x:number;y:number;z:number}>}>;
  baseField:ReturnType<typeof createAdaptiveBaseFieldDescriptor>;
  editJournal:ReturnType<typeof createAdaptiveEditJournal>;
};
type IngestPrefix = SortedRuns & JournalPreparation & {materials:ReturnType<typeof createStructuralMaterialTable>};
const noMeasure:IngestMeasure=(_phase,run)=>run();

function* sortedRunSteps(input:readonly HvpStructuralCell[],ids:ReadonlySet<number>,owned?:AdaptiveOwnedJournalOptions):Generator<void,SortedRuns,void>{
  const reserve=owned?.reserve;
  reserve?.(1_024);
  const values=reserve===undefined?input:(yield* adaptiveDenseArraySteps(input,"ingest/cells","InvalidCanonicalValue",
    {maximumLength:32_768},reserve)) as HvpStructuralCell[];
  const cells=yield* adaptiveSortSteps(yield* adaptiveMapSteps(values,cell=>{
    reserve?.(1_024,true);
    if(!cell||![cell.x,cell.y,cell.z].every(value=>Number.isSafeInteger(value)&&Math.abs(value)<=1_000_000)
      ||!ids.has(cell.materialId)){throw new Error("Invalid canonical HVP cell/material");}
    return {x:cell.x,y:cell.y,z:cell.z,materialId:cell.materialId};
  },reserve),(a,b)=>a.z-b.z||a.y-b.y||a.x-b.x,reserve);
  reserve?.(128);
  const origins=new Map<string,{x:number;y:number;z:number}>();
  const runs:IngestRun[]=[];
  for(let i=0;i<cells.length;i+=1){
    const cell=cells[i]!,previous=cells[i-1];
    if(previous&&previous.x===cell.x&&previous.y===cell.y&&previous.z===cell.z){throw new Error("Duplicate HVP cell");}
    reserve?.(1_024,true);
    const origin={x:Math.floor(cell.x/16)*16,y:Math.floor(cell.y/16)*16,z:Math.floor(cell.z/16)*16};
    origins.set(`${origin.x},${origin.y},${origin.z}`,origin);
    if(origins.size*ADAPTIVE_BRICK_ESTIMATED_BYTES>16*1024*1024){throw new Error("HVP ingest BudgetExceeded: brick working set");}
    const run=runs.at(-1);
    if(run&&run.y===cell.y&&run.z===cell.z&&run.end===cell.x&&run.materialId===cell.materialId){run.end+=1;}
    else{
      if(runs.length===4096){throw new Error("HVP ingest BudgetExceeded: 4096 AddBox runs");}
      runs.push({...cell,end:cell.x+1});
    }
    if(reserve!==undefined){yield;}
  }
  return {cells,origins,runs};
}

function* journalPreparationSteps(id:string,runs:readonly IngestRun[],owned?:AdaptiveOwnedJournalOptions):Generator<void,JournalPreparation,void>{
  const reserve=owned?.reserve;
  reserve?.(8_192,true);
  const frame={schemaVersion:STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,bodyId:"body.hestia",surfaceFrameId:"frame.hvp",
    regionId:`region.${id}`,generatorVersion:"hvp-rigid-ingest-v1",objectOriginQuantum:{x:0,y:0,z:0}} as const;
  const baseField=createAdaptiveBaseFieldDescriptor({kind:"constant-v1",identity:stableAuthorityId(`base.${id}`),
    version:stableAuthorityId(frame.generatorVersion),sourceRevision:authorityRevision(1),sample:{density:0,occupancy:0,materialId:null}});
  if(reserve!==undefined){yield;}
  const edits:AdaptiveEditInput[]=yield* adaptiveMapSteps(runs,(run,i)=>{
    reserve?.(2_048);
    return {editId:`${id}.run.${i}`,sequence:i+1,expectedRegionRevision:i,resultRegionRevision:i+1,
      actorId:"hvp.ingest",sourceId:`hvp.source.${id}`,operation:"AddBox" as const,
      box:{min:{x:run.x,y:run.y,z:run.z},max:{x:run.end,y:run.y+1,z:run.z+1}},materialId:`hvp.material.${run.materialId}`};
  },reserve);
  const editJournal=owned===undefined?createAdaptiveEditJournal(edits):yield* adaptiveEditJournalSteps(edits,0,owned);
  return {frame,baseField,editJournal};
}

/** Shared prefix only; every production caller still takes the native generic route. */
function* ingestJournalPrefixSteps(id:string,input:readonly HvpStructuralCell[],materialInput:readonly unknown[],
  owned?:AdaptiveOwnedJournalOptions,measure:IngestMeasure=noMeasure):Generator<void,IngestPrefix,void>{
  const reserve=owned?.reserve;
  reserve?.(8_192);
  if(!/^[a-zA-Z0-9_.:-]{1,96}$/.test(id)){throw new Error("Invalid HVP structural ID");}
  if(input.length===0||input.length>32_768){throw new Error("HVP ingest BudgetExceeded: 1..32768 cells required");}
  const materials=reserve===undefined?createStructuralMaterialTable(materialInput):yield* structuralMaterialTableSteps(materialInput,reserve);
  let ids:Set<number>;
  if(reserve===undefined){ids=new Set(materials.map(material=>Number(material.materialId)));}
  else{
    reserve(64);
    ids=new Set();
    for(const material of materials){reserve(128);ids.add(Number(material.materialId));yield;}
  }
  const sorted=owned===undefined?measure("ingestSortRunsMs",()=>adaptiveDrainSteps(sortedRunSteps(input,ids)))
    :yield* sortedRunSteps(input,ids,owned);
  const journal=owned===undefined?measure("ingestJournalMs",()=>adaptiveDrainSteps(journalPreparationSteps(id,sorted.runs)))
    :yield* journalPreparationSteps(id,sorted.runs,owned);
  return {materials,...sorted,...journal};
}

/** Internal three-field journal envelope only; existing canonical/FNV authority remains unchanged. */
export function* hvpIngestJournalHashSteps(payload:unknown,reserve:StructuralOwnedReserve,hashUnits=1):Generator<void,string,void>{
  reserve(32_768,false,"hash");
  const cursor=createOwnedCanonicalHashCursor(payload,undefined,hashUnits===128);
  try{
    for(;;){
      // The owner still yields on its 2ms task quantum; fold a bounded block here
      // instead of forwarding every scalar through the entire nested plan stack.
      const result=cursor.advance(hashUnits);
      if(result!==undefined){return result.contentHash;}
      yield;
    }
  }finally{cursor.dispose();}
}

type OwnedIngestPrefix = Omit<IngestPrefix,"cells"|"origins"|"runs"> & {
  cells:readonly HvpStructuralCell[];
  origins:readonly Readonly<{x:number;y:number;z:number}>[];
  runs:readonly Readonly<IngestRun>[];
};

/** INACTIVE DATA-only borrowed form. Producer retains plain/index-only input literals immutable
 * for this lifetime and charges ALL retained inputs/old/results in its ONE aggregate ledger. */
export function* prepareHvpStructuralIngestJournalOwnedSteps(id:string,input:readonly HvpStructuralCell[],
  materialInput:readonly unknown[],reserve:StructuralOwnedReserve,
  hash:AdaptiveOwnedJournalOptions["hash"]=payload=>hvpIngestJournalHashSteps(payload,reserve)):Generator<void,OwnedIngestPrefix,void>{
  reserve(2_048);
  const owned:AdaptiveOwnedJournalOptions={reserve,hash};
  const raw=yield* ingestJournalPrefixSteps(id,input,materialInput,owned);
  // No mutable Map is published. Work arrays/records are private until every index is locked.
  reserve(64+raw.origins.size*128,true);
  const origins:Array<Readonly<{x:number;y:number;z:number}>>=[];
  for(const origin of raw.origins.values()){origins.push(Object.freeze(origin));yield;}
  for(const cell of raw.cells){Object.freeze(cell);yield;}
  for(const run of raw.runs){Object.freeze(run);yield;}
  const cells=yield* adaptiveFreezeArraySteps(raw.cells,reserve);
  const runs=yield* adaptiveFreezeArraySteps(raw.runs,reserve);
  const frozenOrigins=yield* adaptiveFreezeArraySteps(origins,reserve);
  reserve(2_048,true);
  Object.freeze(raw.frame.objectOriginQuantum);
  Object.freeze(raw.frame);
  return Object.freeze({materials:raw.materials,cells,origins:frozenOrigins,runs,frame:raw.frame,
    baseField:raw.baseField,editJournal:raw.editJournal});
}

/** Direct-module only, NO Worker/public-root caller or issuer. Counts bounds, not physical/time proof. */
export const createOwnedHvpStructuralIngestJournalCursor=(id:string,input:readonly HvpStructuralCell[],
  materialInput:readonly unknown[],residentBytesValue:number,prepareLimitBytes=96*1024*1024)=>{
  // Admit bootstrap control storage BEFORE allocating the ledger/cursor closures and records.
  const residentBytes=structuralNonNegativeSafeInteger(residentBytesValue,"cursor/residentBytes");
  const prepareBytes=structuralPositiveBudget(prepareLimitBytes,"cursor/prepareLimitBytes");
  if(prepareBytes>96*1024*1024||prepareBytes<16_384||residentBytes>256*1024*1024-16_384){
    return structuralFail("InvalidBudget","cursor/prepareBytes","Owned ingress exceeds Prepare96MiB or CPU256MiB bootstrap coexistence.");
  }
  const ledger=createStructuralOwnerLedger(residentBytes,prepareBytes);
  ledger.reserve(16_384);
  let steps:Generator<void,OwnedIngestPrefix,void>|undefined;
  let state:"open"|"done"|"failed"|"disposed"="open",failure:unknown;
  let consumedUnits=0;
  const stop=():void=>{try{steps?.return(undefined as never);}catch{/* first failure wins */}steps=undefined;};
  return {
    advance(maxUnitsValue:number):StructuralCursorStep<OwnedIngestPrefix>{
      if(state==="failed"){throw failure;}
      if(state!=="open"){throw new Error(`HVP ingest prefix cursor is ${state}; result issuance is once-only.`);}
      try{
        const maxUnits=structuralPositiveBudget(maxUnitsValue,"cursor/maxUnits");
        steps??=prepareHvpStructuralIngestJournalOwnedSteps(id,input,materialInput,ledger.reserve);
        for(let unit=0;unit<maxUnits;unit+=1){
          consumedUnits+=1;
          const step=steps.next();
          if(step.done){state="done";stop();ledger.release(true);return {done:true,value:step.value};}
        }
        return {done:false};
      }catch(error){failure=error;state="failed";stop();ledger.release();throw error;}
    },
    dispose():void{if(state!=="failed"){state="disposed";}stop();ledger.release();},
    get consumedUnits(){return consumedUnits;},
    get resources(){return ledger.resources;}
  };
};

type CompletePrefix=IngestPrefix|OwnedIngestPrefix;
type IngestBricks=readonly ReturnType<typeof materializeAdaptiveBrick>[];
type IngestAnchor=Readonly<{x:number;y:number;z:number}>;
type IngestProofs={snapshot:AdaptivePlannerSnapshot;resident:AdaptivePlannerSnapshot["resident"];
  proofs:ReturnType<typeof createAdaptiveResidentValidationProofs>};

function* ingestBricksSteps(prefix:CompletePrefix,owned?:AdaptiveOwnedJournalOptions):Generator<void,IngestBricks,void>{
  const reserve=owned?.reserve,{frame,baseField,editJournal}=prefix;
  reserve?.(8_192);
  let origins:Array<Readonly<{x:number;y:number;z:number}>>;
  if(owned===undefined){origins=[...prefix.origins.values()];}
  else{
    const values=prefix.origins as OwnedIngestPrefix["origins"];
    owned.reserve(64+values.length*128);
    origins=[];
    for(let index=0;index<values.length;index+=1){origins.push(values[index]!);yield;}
  }
  yield* adaptiveSortSteps(origins,(a,b)=>a.z-b.z||a.y-b.y||a.x-b.x,reserve);
  const inputFor=(originQuantum:Readonly<{x:number;y:number;z:number}>)=>{
    reserve?.(8_192);
    const input={key:createAdaptiveBrickKey({bodyId:frame.bodyId,surfaceFrameId:frame.surfaceFrameId,regionId:frame.regionId,
      generatorVersion:frame.generatorVersion,level:4,originQuantum}),baseField,editJournal};
    return owned===undefined?input:Object.freeze(input);
  };
  if(owned===undefined){return origins.map(origin=>materializeAdaptiveBrick(inputFor(origin)));}
  yield* adaptiveFreezeArraySteps(origins,owned.reserve);
  owned.reserve(64+origins.length*128,true);
  const bricks:ReturnType<typeof materializeAdaptiveBrick>[]=[];
  for(let index=0;index<origins.length;index+=1){
    bricks.push(yield* adaptiveMaterializeBrickSteps(inputFor(origins[index]!),owned));
    yield;
  }
  return yield* adaptiveFreezeArraySteps(bricks,owned.reserve);
}

function* ingestProofsSteps(prefix:CompletePrefix,bricks:IngestBricks,owned?:AdaptiveOwnedJournalOptions):Generator<void,IngestProofs,void>{
  const reserve=owned?.reserve,{frame,baseField,editJournal}=prefix;
  reserve?.(16_384,true);
  const brickRevision=authorityRevision(0);
  const resident=yield* adaptiveMapSteps(bricks,brick=>{
    reserve?.(8_192,true);
    const entry={key:brick.key,readiness:"ready" as const,byteSize:ADAPTIVE_BRICK_ESTIMATED_BYTES,work:ADAPTIVE_BRICK_ESTIMATED_WORK,
      contentHash:brick.contentHash,provenanceHash:brick.provenance.provenanceHash,baseFieldDescriptorDigest:brick.baseFieldDescriptorDigest,
      journalDigest:brick.provenance.journalDigest,sourceRevision:brick.sourceRevision,editRevision:brick.editRevision,brickRevision};
    return owned===undefined?entry:Object.freeze(entry);
  },reserve);
  const snapshot:AdaptivePlannerSnapshot={schemaVersion:"adaptive-microvoxel-planner-snapshot-v1",bodyId:stableAuthorityId(frame.bodyId),
    surfaceFrameId:stableAuthorityId(frame.surfaceFrameId),regionId:stableAuthorityId(frame.regionId),generatorVersion:stableAuthorityId(frame.generatorVersion),
    authority:{schemaVersion:"adaptive-microvoxel-planner-authority-v1",baseField,editJournal,brickRevision},planningEpoch:authorityRevision(1),
    resident:owned===undefined?resident:yield* adaptiveFreezeArraySteps(resident,owned.reserve),activeCoverage:[],refinementRequests:[],
    budgets:{maxBricks:128,maxBytes:16*1024*1024,maxWork:128*ADAPTIVE_BRICK_ESTIMATED_WORK,maxCoverageQuantum:128*4096}};
  if(owned!==undefined){
    Object.freeze(snapshot.authority);Object.freeze(snapshot.activeCoverage);Object.freeze(snapshot.refinementRequests);
    Object.freeze(snapshot.budgets);Object.freeze(snapshot);
  }
  reserve?.(1_024);
  const input={bricks,brickRevision,snapshot};
  const proofs=owned===undefined?createAdaptiveResidentValidationProofs(input)
    :yield* adaptiveResidentValidationProofsSteps(Object.freeze(input),owned);
  return {snapshot,resident,proofs};
}

function* ingestAnchorSteps(id:string,anchor:IngestAnchor,index:number,cells:readonly HvpStructuralCell[],bricks:IngestBricks,
  owned?:AdaptiveOwnedJournalOptions):Generator<void,{anchorId:string;cell:ReturnType<typeof createStructuralCellAddress>},void>{
  const reserve=owned?.reserve;
  reserve?.(8_192,true);
  const matchesCell=(cell:HvpStructuralCell)=>cell.x===anchor.x&&cell.y===anchor.y&&cell.z===anchor.z;
  const matchesBrick=(item:IngestBricks[number])=>item.key.originQuantum.x===Math.floor(anchor.x/16)*16
    &&item.key.originQuantum.y===Math.floor(anchor.y/16)*16&&item.key.originQuantum.z===Math.floor(anchor.z/16)*16;
  let occupied=false,brick:IngestBricks[number]|undefined;
  if(owned===undefined){occupied=cells.some(matchesCell);}
  else{
    for(let at=0;at<cells.length;at+=1){if(matchesCell(cells[at]!)){occupied=true;break;}yield;}
  }
  if(!occupied){throw new Error("Anchor requires an occupied canonical cell");}
  if(owned===undefined){brick=bricks.find(matchesBrick);}
  else{
    for(let at=0;at<bricks.length;at+=1){if(matchesBrick(bricks[at]!)){brick=bricks[at];break;}yield;}
  }
  const result={anchorId:`${id}.anchor.${index}`,cell:createStructuralCellAddress(brick!.key,
    {x:anchor.x-brick!.key.originQuantum.x,y:anchor.y-brick!.key.originQuantum.y,z:anchor.z-brick!.key.originQuantum.z})};
  return owned===undefined?result:Object.freeze(result);
}

function* ingestStructuralSteps(id:string,prefix:CompletePrefix,bricks:IngestBricks,{snapshot,resident,proofs}:IngestProofs,
  anchorInput:readonly IngestAnchor[],owned?:AdaptiveOwnedJournalOptions){
  const reserve=owned?.reserve,{cells,materials,frame,baseField,editJournal}=prefix;
  reserve?.(16_384);
  if(anchorInput.length>cells.length){throw new Error("Invalid HVP anchor count");}
  let anchors:Array<{anchorId:string;cell:ReturnType<typeof createStructuralCellAddress>}>;
  if(owned===undefined){anchors=anchorInput.map((anchor,index)=>adaptiveDrainSteps(ingestAnchorSteps(id,anchor,index,cells,bricks)));}
  else{
    owned.reserve(64+anchorInput.length*128,true);
    anchors=[];
    for(let index=0;index<anchorInput.length;index+=1){
      anchors.push(yield* ingestAnchorSteps(id,anchorInput[index]!,index,cells,bricks,owned));yield;
    }
    yield* adaptiveFreezeArraySteps(anchors,owned.reserve);
  }
  reserve?.(16_384,true);
  // The final Structural issuer constructs and fully validates this fresh immutable authority.
  const authority=owned===undefined?createAdaptiveAuthorityRetention({baseField,editJournal})
    :Object.freeze({baseField,editJournal});
  const attached=yield* adaptiveMapSteps(resident,(entry,index)=>{
    reserve?.(8_192,true);
    const value={...entry,validationProof:proofs[index]!};
    return owned===undefined?value:Object.freeze(value);
  },reserve);
  const attachedSnapshot={...snapshot,resident:owned===undefined?attached:yield* adaptiveFreezeArraySteps(attached,owned.reserve)};
  const materialBindings=yield* adaptiveMapSteps(materials,material=>{
    reserve?.(4_096,true);
    const binding={adaptiveMaterialId:`hvp.material.${material.materialId}`,structuralMaterialId:material.materialId};
    return owned===undefined?binding:Object.freeze(binding);
  },reserve);
  reserve?.(16_384,true);
  const input={objectId:id,frame,authority,snapshot:owned===undefined?attachedSnapshot:Object.freeze(attachedSnapshot),materials,
    materialBindings:owned===undefined?materialBindings:yield* adaptiveFreezeArraySteps(materialBindings,owned.reserve),
    bricks,anchors,joints:owned===undefined?[]:Object.freeze([]),objectRevision:0,editRevision:0,
    commandEvidence:owned===undefined?[]:Object.freeze([])};
  return owned===undefined?createStructuralObjectFromAdaptive(input)
    :yield* ownedStructuralAdaptiveIngestSteps(Object.freeze(input),owned.reserve);
}

function* ingestHvpStructuralSteps(id:string,input:readonly HvpStructuralCell[],materialInput:readonly unknown[],anchorInput:readonly IngestAnchor[],
  owned?:AdaptiveOwnedJournalOptions,measure:IngestMeasure=noMeasure,onPhase?:(phase:string)=>void){
  onPhase?.("ownerIngestPrefix");
  const prefix=owned===undefined?adaptiveDrainSteps(ingestJournalPrefixSteps(id,input,materialInput,undefined,measure))
    :yield* prepareHvpStructuralIngestJournalOwnedSteps(id,input,materialInput,owned.reserve,owned.hash);
  onPhase?.("ownerIngestBricks");
  const bricks=owned===undefined?measure("ingestMaterializeMs",()=>adaptiveDrainSteps(ingestBricksSteps(prefix)))
    :yield* ingestBricksSteps(prefix,owned);
  onPhase?.("ownerIngestProofs");
  const proofs=owned===undefined?measure("ingestProofsMs",()=>adaptiveDrainSteps(ingestProofsSteps(prefix,bricks)))
    :yield* ingestProofsSteps(prefix,bricks,owned);
  onPhase?.("ownerIngestStructural");
  return owned===undefined?measure("ingestStructuralMs",()=>adaptiveDrainSteps(ingestStructuralSteps(id,prefix,bricks,proofs,anchorInput)))
    :yield* ingestStructuralSteps(id,prefix,bricks,proofs,anchorInput,owned);
}

/** Real air + bounded AddBox journal -> materialization/proofs -> the original full Structural issuer.
 * The generic synchronous route retains native observers and the existing trace phase ordering. */
export const ingestHvpStructuralCells = (id:string, input:readonly HvpStructuralCell[], materialInput:readonly unknown[],
  anchorInput:readonly IngestAnchor[] = [],
  traceContext?:Readonly<{trace:HvpCutTrace;commandId:string;thread:HvpCutSpan["thread"]}>) => {
  const measure=<T>(phase:string,run:()=>T):T=>traceContext?
    measureHvpCut(traceContext.trace,traceContext.commandId,traceContext.thread,phase,run):run();
  return measure("ingestTotalMs",()=>adaptiveDrainSteps(ingestHvpStructuralSteps(id,input,materialInput,anchorInput,undefined,measure)));
};

/** INACTIVE direct-module form. The producer owns first-party fixed-schema/index-only inputs
 * immutable for the actual generator lifetime, including material and anchor records. All live
 * inputs/old/results belong to ONE higher aggregate ledger; this nested form never releases it.
 * Only the existing full proof/Structural issuers run. No plan, recipe, World or caller activation. */
export function* prepareHvpStructuralIngestOwnedSteps(id:string,input:readonly HvpStructuralCell[],materialInput:readonly unknown[],
  anchorInput:readonly IngestAnchor[],reserve:StructuralOwnedReserve,onPhase?:(phase:string)=>void){
  reserve(16_384);
  const owned:AdaptiveOwnedJournalOptions=Object.freeze({reserve,hash:(payload:unknown)=>hvpIngestJournalHashSteps(payload,reserve,128)});
  return yield* ingestHvpStructuralSteps(id,input,materialInput,anchorInput,owned,noMeasure,onPhase);
}
