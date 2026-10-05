import {expect,it} from "vitest";
import * as adaptive from "../../src/voxel/adaptive";
import * as structural from "../../src/voxel/structural";
import {serializeStructuralObject,type StructuralObject} from "../../src/voxel/structural";
import {createStructuralOwnerLedger,isIssuedStructuralObject} from "../../src/voxel/structural/model";
import {structuralPositiveBudget} from "../../src/voxel/structural/validation";
import {ingestHvpStructuralCells,prepareHvpStructuralIngestOwnedSteps} from "../../src/hestia-prototype/terrain/structuralIngest";
import type {HvpStructuralCell} from "../../src/hestia-prototype/terrain/structuralIngest";
import type {HvpCutSpan} from "../../src/hestia-prototype/runtime/cutTrace";

const {deepFreeze,canonicalAdaptiveJson,hashAdaptiveCanonical,serializeAdaptiveKey}=adaptive;
const id="terrain.child.literal";
const material=(materialId:number)=>({materialId,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null});
const materials=deepFreeze([material(65535),material(7),material(1),material(256)]);
const cells=deepFreeze([{x:1,y:-16,z:16,materialId:65535},{x:-16,y:-16,z:16,materialId:1},
  {x:0,y:-16,z:16,materialId:256},{x:-15,y:-16,z:16,materialId:1}]);
const anchors=deepFreeze([{x:-16,y:-16,z:16}]);

// Literal original terrain/model/canonical schemas and sparse cells, never an ingest output.
// The unchanged accepted Adaptive kernel supplies only the actual materialized source fixtures.
const literalFixture=()=>{
  const frame={schemaVersion:"structural-microvoxel-frame-binding-v1",bodyId:"body.hestia",surfaceFrameId:"frame.hvp",
    regionId:`region.${id}`,generatorVersion:"hvp-rigid-ingest-v1",objectOriginQuantum:{x:0,y:0,z:0}};
  const baseField=adaptive.createAdaptiveBaseFieldDescriptor({kind:"constant-v1",identity:adaptive.stableAuthorityId(`base.${id}`),
    version:adaptive.stableAuthorityId(frame.generatorVersion),sourceRevision:adaptive.authorityRevision(1),
    sample:{density:0,occupancy:0,materialId:null}});
  const runs=[{x:-16,end:-14,materialId:1},{x:0,end:1,materialId:256},{x:1,end:2,materialId:65535}];
  const inputs=runs.map((run,index)=>({editId:`${id}.run.${index}`,sequence:index+1,expectedRegionRevision:index,
    resultRegionRevision:index+1,actorId:"hvp.ingest",sourceId:`hvp.source.${id}`,operation:"AddBox" as const,
    box:{min:{x:run.x,y:-16,z:16},max:{x:run.end,y:-15,z:17}},materialId:`hvp.material.${run.materialId}`}));
  const records=inputs.map(input=>({schemaVersion:adaptive.ADAPTIVE_EDIT_SCHEMA_VERSION,...input}));
  const journal={schemaVersion:adaptive.ADAPTIVE_JOURNAL_SCHEMA_VERSION,initialRegionRevision:0,revision:3,records,
    digest:hashAdaptiveCanonical({schemaVersion:adaptive.ADAPTIVE_JOURNAL_SCHEMA_VERSION,initialRegionRevision:0,records})};
  const editJournal=adaptive.createAdaptiveEditJournal(deepFreeze(inputs));
  expect(canonicalAdaptiveJson(editJournal)).toBe(canonicalAdaptiveJson(journal));
  const bricks=deepFreeze([-16,0].map(x=>adaptive.materializeAdaptiveBrick({key:adaptive.createAdaptiveBrickKey({bodyId:frame.bodyId,
    surfaceFrameId:frame.surfaceFrameId,regionId:frame.regionId,generatorVersion:frame.generatorVersion,level:4,
    originQuantum:{x,y:-16,z:16}}),baseField,editJournal})));
  const resident=bricks.map(brick=>({key:brick.key,readiness:"ready",byteSize:adaptive.ADAPTIVE_BRICK_ESTIMATED_BYTES,
    work:adaptive.ADAPTIVE_BRICK_ESTIMATED_WORK,contentHash:brick.contentHash,provenanceHash:brick.provenance.provenanceHash,
    baseFieldDescriptorDigest:brick.baseFieldDescriptorDigest,journalDigest:editJournal.digest,sourceRevision:1,editRevision:3,brickRevision:0}));
  const baseFieldDescriptorDigest=hashAdaptiveCanonical({schemaVersion:adaptive.ADAPTIVE_BASE_FIELD_DESCRIPTOR_DIGEST_SCHEMA_VERSION,descriptor:baseField});
  const projection={schemaVersion:adaptive.ADAPTIVE_SNAPSHOT_PROJECTION_SCHEMA_VERSION,authority:{
    schemaVersion:"adaptive-microvoxel-planner-authority-v1",bodyId:frame.bodyId,surfaceFrameId:frame.surfaceFrameId,
    regionId:frame.regionId,generatorVersion:frame.generatorVersion,baseField,baseFieldDescriptorDigest,editJournal,
    journalDigest:editJournal.digest,sourceRevision:1,editRevision:3,brickRevision:0,planningEpoch:1},resident,activeCoverage:[],
    refinementRequests:[],budgets:{maxBricks:128,maxBytes:16*1024*1024,maxWork:128*adaptive.ADAPTIVE_BRICK_ESTIMATED_WORK,maxCoverageQuantum:128*4096}};
  const snapshotProjectionDigest=hashAdaptiveCanonical(projection);
  const proofDigests=bricks.map(brick=>hashAdaptiveCanonical({schemaVersion:adaptive.ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION,
    proofVersion:adaptive.ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION,key:brick.key,contentHash:brick.contentHash,
    provenanceHash:brick.provenance.provenanceHash,baseFieldDescriptorDigest,journalDigest:editJournal.digest,sourceRevision:1,
    editRevision:3,brickRevision:0,planningEpoch:1,snapshotProjectionDigest})).sort();
  const source={schemaVersion:"structural-microvoxel-source-binding-v1",baseFieldIdentity:`base.${id}`,baseFieldVersion:frame.generatorVersion,
    baseFieldDescriptorDigest,journalDigest:editJournal.digest,snapshotProjectionDigest,proofDigests,sourceRevision:1,editRevision:3,
    brickRevision:0,planningEpoch:1};
  const state=(materialId:number)=>({materialId,partId:null,semanticKey:null,damageKey:null});
  const content={schemaVersion:"structural-microvoxel-object-v1",objectId:id,frame,source,
    materials:[material(1),material(7),material(256),material(65535)],bricks:bricks.map((brick,index)=>({
      schemaVersion:"structural-microvoxel-brick-v1",key:serializeAdaptiveKey(brick.key),cells:[
        {localIndex:0,state:state(index===0?1:256)},{localIndex:1,state:state(index===0?1:65535)}]})),
    anchors:[{anchorId:`${id}.anchor.0`,cell:{brickKey:serializeAdaptiveKey(bricks[0]!.key),localIndex:0}}],joints:[]};
  const expected={...content,objectRevision:0,editRevision:0,contentHash:hashAdaptiveCanonical(content),commandEvidence:[],evidenceHash:hashAdaptiveCanonical([])};
  return {expected,bytes:canonicalAdaptiveJson(expected)};
};

const own=(input:readonly HvpStructuralCell[]=cells,materialInput:readonly unknown[]=materials,
  anchorInput:readonly Readonly<{x:number;y:number;z:number}>[]=anchors,idValue=id,limit=96*1024*1024)=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,limit);ledger.reserve(16384);
  let steps:ReturnType<typeof prepareHvpStructuralIngestOwnedSteps>|undefined=
    prepareHvpStructuralIngestOwnedSteps(idValue,input,materialInput,anchorInput,ledger.reserve);
  let state:"open"|"done"|"failed"|"disposed"="open",first:unknown,units=0,maxAdvanceMilliseconds=0;
  const stop=()=>{try{steps?.return(undefined as never);}catch{/* cleanup never replaces the first failure */}steps=undefined;};
  return {advance(value:number){
    if(state==="failed"){throw first;}if(state!=="open"){throw new Error("Once-only terrain ingest result");}
    const started=performance.now();
    try{
      const budget=structuralPositiveBudget(value,"cursor/maxUnits");
      for(let index=0;index<budget;index+=1){
        units+=1;const step=steps!.next();
        if(step.done){state="done";stop();ledger.release(true);return {done:true as const,value:step.value};}
      }
      return {done:false as const};
    }catch(error){state="failed";first=error;stop();ledger.release();throw error;}
    finally{maxAdvanceMilliseconds=Math.max(maxAdvanceMilliseconds,performance.now()-started);}
  },dispose(){if(state!=="failed"){state="disposed";}stop();ledger.release();},
  get units(){return units;},get maxAdvanceMilliseconds(){return maxAdvanceMilliseconds;},get resources(){return ledger.resources;}};
};
const finish=(cursor:ReturnType<typeof own>,budgets:readonly number[])=>{
  const counts=new Map<number,number>();let index=0,maxAdvance=0;
  for(;;){
    const budget=budgets[index%budgets.length]!,before=cursor.units,step=cursor.advance(budget);index+=1;
    const consumed=cursor.units-before;maxAdvance=Math.max(maxAdvance,consumed);counts.set(budget,(counts.get(budget)??0)+1);
    if(consumed>budget||cursor.units>1_000_000){throw new Error("Terrain ingest work/progress bound exceeded");}
    if(step.done){return {value:step.value,maxAdvance,budgetCounts:[...counts]};}
  }
};
const failureOf=(run:()=>unknown)=>{try{run();}catch(error){return error;}throw new Error("Expected terrain ingest failure");};

it("preserves complete literal terrain source, high materials, negative seam and anchor bytes in one inactive borrowed ingest",()=>{
  const literal=literalFixture(),before=canonicalAdaptiveJson({cells,materials,anchors}),samples:unknown[]=[];
  expect(literal.expected.contentHash).toBe("fnv1a64-v1:15144d9cc3551a6a");expect(Buffer.byteLength(literal.bytes)).toBe(2794);
  for(let index=0;index<3;index+=1){
    const spans:HvpCutSpan[]=[],start=performance.now();
    const result=ingestHvpStructuralCells(id,cells,materials,anchors,{trace:span=>spans.push(span),commandId:"literal.baseline",thread:"body"});
    const milliseconds=performance.now()-start;
    expect(serializeStructuralObject(result)).toBe(literal.bytes);expect(isIssuedStructuralObject(result)).toBe(true);
    expect(result.bricks.map(brick=>brick.cells.length)).toEqual([2,2]);
    samples.push({milliseconds,spans:spans.map(({phase,duration})=>({phase,duration}))});
  }
  const reads:string[]=[],anchor={get x(){reads.push("x");return -16;},get y(){reads.push("y");return -16;},get z(){reads.push("z");return 16;}};
  expect(serializeStructuralObject(ingestHvpStructuralCells(id,cells,materials,[anchor]))).toBe(literal.bytes);
  expect(reads).toEqual(["x","y","z","x","y","z","x","y","z"]);
  const ownedSamples:unknown[]=[];let whole=0,result:StructuralObject|undefined;
  for(const budgets of [[1,7,16,32,64,257],[257],[257]]){
    const start=performance.now(),cursor=own(),done=finish(cursor,budgets),milliseconds=performance.now()-start;
    whole=cursor.units;result=done.value;
    expect(serializeStructuralObject(result)).toBe(literal.bytes);expect(isIssuedStructuralObject(result)).toBe(true);
    expect(adaptive.isDeepFrozen(result)).toBe(true);expect(isIssuedStructuralObject(deepFreeze({...result}))).toBe(false);
    expect(cursor.resources.reservedBytes).toBe(0);expect(cursor.resources.retainedEstimateBytes).toBe(0);
    expect(cursor.resources.hashReservations).toBeGreaterThan(2);expect(cursor.resources.peakEstimateBytes).toBeLessThanOrEqual(256*1024*1024);
    ownedSamples.push({budgets,units:whole,maxAdvance:done.maxAdvance,budgetCounts:done.budgetCounts,milliseconds,
      maxAdvanceMilliseconds:cursor.maxAdvanceMilliseconds,resources:cursor.resources});
    expect(()=>cursor.advance(1)).toThrow("Once-only");cursor.dispose();cursor.dispose();
    expect(serializeStructuralObject(result)).toBe(literal.bytes);expect(isIssuedStructuralObject(result)).toBe(true);
  }
  expect(result).toBeDefined();expect(structural).not.toHaveProperty("prepareHvpStructuralIngestOwnedSteps");
  const negatives:readonly [string,readonly HvpStructuralCell[],readonly unknown[],readonly Readonly<{x:number;y:number;z:number}>[]][]=[
    ["invalid id",cells,materials,anchors],[id,[],materials,[]],[id,new Array(32769),materials,[]],
    [id,deepFreeze([cells[0]!,cells[0]!]),materials,[]],[id,deepFreeze([{...cells[0]!,x:1000001}]),materials,[]],
    [id,cells,deepFreeze([material(7)]),[]],[id,cells,materials,deepFreeze([{x:99,y:0,z:0}])],
    [id,cells,materials,deepFreeze(Array.from({length:5},()=>anchors[0]!))]
  ];
  for(const [name,input,table,points] of negatives){
    const expected=failureOf(()=>ingestHvpStructuralCells(name,input,table,points)),cursor=own(input,table,points,name);
    const actual=failureOf(()=>finish(cursor,[257]));expect(actual).toMatchObject({name:(expected as Error).name,message:(expected as Error).message});
    expect(cursor.resources.reservedBytes).toBe(0);cursor.dispose();expect(failureOf(()=>cursor.advance(1))).toBe(actual);
  }
  const tight=own(cells,materials,anchors,id,20_000),first=failureOf(()=>finish(tight,[1]));
  expect(first).toMatchObject({path:"cursor/prepareBytes"});tight.dispose();expect(failureOf(()=>tight.advance(257))).toBe(first);
  expect(tight.resources.reservedBytes).toBe(0);
  const boundaries=[0,1,64,Math.floor(whole/3),Math.floor(whole/2),whole-1];
  for(const boundary of boundaries){
    const cursor=own();if(boundary>0){expect(cursor.advance(boundary).done).toBe(false);}cursor.dispose();cursor.dispose();
    expect(cursor.resources.reservedBytes).toBe(0);expect(()=>cursor.advance(1)).toThrow("Once-only");
  }
  const host=own(),sentinel=new Error("host-finally sentinel");
  try{host.advance(Math.floor(whole/2));throw sentinel;}catch(error){expect(error).toBe(sentinel);}finally{host.dispose();}
  expect(host.resources.reservedBytes).toBe(0);
  const invalid=own();expect(invalid.advance(Math.floor(whole/2)).done).toBe(false);
  const budgetFailure=failureOf(()=>invalid.advance(0));expect(budgetFailure).toMatchObject({path:"cursor/maxUnits"});
  invalid.dispose();expect(failureOf(()=>invalid.advance(1))).toBe(budgetFailure);expect(invalid.resources.reservedBytes).toBe(0);
  const parent=createStructuralOwnerLedger(32*1024*1024);parent.reserve(4096);
  const steps=prepareHvpStructuralIngestOwnedSteps(id,cells,materials,anchors,parent.reserve);let borrowed:StructuralObject|undefined;
  try{for(;;){const step=steps.next();if(step.done){borrowed=step.value;break;}}}finally{steps.return(undefined as never);}
  expect(serializeStructuralObject(borrowed!)).toBe(literal.bytes);expect(parent.resources.reservedBytes).toBeGreaterThan(4096);
  parent.release();expect(parent.resources.reservedBytes).toBe(0);expect(isIssuedStructuralObject(borrowed!)).toBe(true);
  expect(canonicalAdaptiveJson({cells,materials,anchors})).toBe(before);
  console.info("TERRAIN_INGEST_GENERIC_BASELINE_EVIDENCE",JSON.stringify({id,cells:4,bricks:2,channelValues:32768,
    completeLiteralBytes:Buffer.byteLength(literal.bytes),contentHash:literal.expected.contentHash,samples,
    doNotUseForAcceptance:true,productionActivation:"OFF",physicalHeap:"NOT_PROVEN",whole8ms:"NOT_PROVEN"}));
  console.info("TERRAIN_INGEST_OWNED_EVIDENCE",JSON.stringify({id,ownedSamples,wholeUnits:whole,
    budgetCoverage:"Six budgets cycled in ONE complete lifetime; two additional257 complete diagnostic samples, not six full drains",
    cancelBoundaries:boundaries.length,hostFinallyChecks:1,invalidBudgetChecks:1,negativeChecks:negatives.length,
    genuineStructuralObject:true,worldAuthority:false,finalReservations:0,physicalHeap:"NOT_PROVEN",whole8ms:"NOT_PROVEN",productionActivation:"OFF"}));
});
