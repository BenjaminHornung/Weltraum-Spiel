import {expect,it} from "vitest";
import {createOwnedCanonicalHashCursor as numericPreimage} from "../reference/hvp-r70-ownedCanonicalHashSteps";
import * as root from "../../src/voxel/adaptive";
import * as canonical from "../../src/voxel/adaptive/canonical";
import * as materialization from "../../src/voxel/adaptive/materialization";
import * as validation from "../../src/voxel/adaptive/validation";
import * as edits from "../../src/voxel/adaptive/edits";
import {createOwnedCanonicalHashCursor,OWNED_RECORD_MAX_KEYS} from "../../src/voxel/adaptive/ownedCanonicalHashSteps";
import {createStructuralOwnerLedger,isIssuedStructuralObject} from "../../src/voxel/structural/model";
import {structuralPositiveBudget} from "../../src/voxel/structural/validation";
import type {AdaptiveCanonicalValue,AdaptiveValidatedRefinementRequest,ValidateAdaptivePlannerSnapshotSemanticsOptions,
  CreateAdaptiveResidentValidationProofInput,CreateAdaptiveResidentValidationProofsInput,MaterializeAdaptiveBrickInput,MaterializedAdaptiveBrick} from "../../src/voxel/adaptive";

const {deepFreeze,hashAdaptiveCanonical,canonicalAdaptiveJson}=root;
const resident=32*1024*1024; // Conservative retained inputs/oracles/old/new/results, NOT physical/GC proof.
const key=root.createAdaptiveBrickKey({bodyId:"body.hestia",surfaceFrameId:"frame.hvp",regionId:"region.materialize",
  generatorVersion:"hvp-rigid-ingest-v1",level:4,originQuantum:{x:-16,y:0,z:0}});
const base=root.createAdaptiveBaseFieldDescriptor({kind:"constant-v1",identity:root.stableAuthorityId("base.materialize"),
  version:root.stableAuthorityId("hvp-rigid-ingest-v1"),sourceRevision:root.authorityRevision(1),
  sample:{density:0.1,occupancy:0.3,materialId:root.stableAuthorityId("hvp.material.256"),semanticId:root.stableAuthorityId("semantic.base")}});
const inputs:readonly edits.AdaptiveEditInput[]=deepFreeze([
  {editId:"edit.1",sequence:1,expectedRegionRevision:0,resultRegionRevision:1,actorId:"actor.test",sourceId:"source.test",
    operation:"SubtractSphere",sphere:{center:{x:-17,y:0,z:0},radiusQuantum:1}},
  {editId:"edit.2",sequence:2,expectedRegionRevision:1,resultRegionRevision:2,actorId:"actor.test",sourceId:"source.test",
    operation:"AddSphere",sphere:{center:{x:-17,y:0,z:0},radiusQuantum:1},materialId:"hvp.material.65535",semanticId:"semantic.add"},
  {editId:"edit.3",sequence:3,expectedRegionRevision:2,resultRegionRevision:3,actorId:"actor.test",sourceId:"source.test",
    operation:"SubtractBox",box:{min:{x:-15,y:0,z:0},max:{x:-14,y:1,z:1}}},
  {editId:"edit.4",sequence:4,expectedRegionRevision:3,resultRegionRevision:4,actorId:"actor.test",sourceId:"source.test",
    operation:"AddBox",box:{min:{x:-14,y:0,z:0},max:{x:-13,y:1,z:1}},materialId:"hvp.material.1",semanticId:"semantic.box"},
  {editId:"edit.5",sequence:5,expectedRegionRevision:4,resultRegionRevision:5,actorId:"actor.test",sourceId:"source.test",
    operation:"SetMaterialBox",box:{min:{x:-14,y:0,z:0},max:{x:-12,y:1,z:1}},materialId:"hvp.material.7",semanticId:"semantic.set"}
]);
const input=deepFreeze({key,baseField:base,editJournal:root.createAdaptiveEditJournal(inputs)});
const literalChannels=()=>({density:new Array<number>(4096).fill(0.1),occupancy:new Array<number>(4096).fill(0.3),
  material:new Array<string|null>(4096).fill("hvp.material.256"),semantic:new Array<string|null>(4096).fill("semantic.base")});
const channels=literalChannels();
// Handwritten exact tangent/box/order oracle, not produced by either materialization route.
channels.density[0]=-1;channels.occupancy[0]=1;channels.material[0]="hvp.material.65535";channels.semantic[0]="semantic.add";
channels.density[1]=1;channels.occupancy[1]=0;
channels.density[2]=-1;channels.occupancy[2]=1;channels.material[2]="hvp.material.7";channels.semantic[2]="semantic.set";
channels.material[3]="hvp.material.7";channels.semantic[3]="semantic.set";
// Retained preimage185-224/330-370 complete hash projections; unchanged canonical/FNV oracle.
const literalBrick=(value:MaterializeAdaptiveBrickInput,values:ReturnType<typeof literalChannels>)=>{
  const descriptorDigest=hashAdaptiveCanonical({schemaVersion:root.ADAPTIVE_BASE_FIELD_DESCRIPTOR_DIGEST_SCHEMA_VERSION,descriptor:value.baseField});
  const metadata={baseFieldIdentity:value.baseField.identity,baseFieldVersion:value.baseField.version,baseFieldDescriptorDigest:descriptorDigest,
    sourceRevision:value.baseField.sourceRevision,editRevision:value.editJournal.revision,journalDigest:value.editJournal.digest};
  const authorityInputDigest=hashAdaptiveCanonical({schemaVersion:"adaptive-microvoxel-authority-input-v1",
    brickSchemaVersion:root.ADAPTIVE_BRICK_SCHEMA_VERSION,materializationVersion:root.ADAPTIVE_MATERIALIZATION_VERSION,key:value.key,...metadata});
  const size=2**(4-value.key.level);
  const contentHash=hashAdaptiveCanonical({schemaVersion:"adaptive-microvoxel-content-hash-input-v1",authorityInputDigest,
    cellSizeQuantum:size,cellSizeMeters:0.125*size,cellCount:4096,...values});
  const parent=value.key.level===0?null:{...value.key,level:3,originQuantum:{x:value.key.originQuantum.x===0?0:-32,y:0,z:0}};
  const parentHash=parent===null?null:hashAdaptiveCanonical({schemaVersion:"adaptive-microvoxel-parent-provenance-v1",
    brickSchemaVersion:root.ADAPTIVE_BRICK_SCHEMA_VERSION,materializationVersion:root.ADAPTIVE_MATERIALIZATION_VERSION,key:parent,...metadata});
  const provenance={schemaVersion:"adaptive-microvoxel-provenance-v1",...metadata,hierarchyKeyHash:hashAdaptiveCanonical(value.key),
    materializationVersion:root.ADAPTIVE_MATERIALIZATION_VERSION,parentProvenanceHash:parentHash};
  return deepFreeze({schemaVersion:root.ADAPTIVE_BRICK_SCHEMA_VERSION,materializationVersion:root.ADAPTIVE_MATERIALIZATION_VERSION,
    key:value.key,cellSizeQuantum:size,cellSizeMeters:0.125*size,cellCount:4096,...values,baseFieldDescriptorDigest:descriptorDigest,
    sourceRevision:metadata.sourceRevision,editRevision:metadata.editRevision,originQuantum:value.key.originQuantum,level:value.key.level,
    contentHash,provenance:{...provenance,provenanceHash:hashAdaptiveCanonical(provenance)}});
};
const expected=literalBrick(input,channels),expectedBytes=canonicalAdaptiveJson(expected);
const numericBytes=(values:readonly number[])=>Buffer.from(new Float64Array(values).buffer);
const failureOf=(run:()=>unknown)=>{try{run();}catch(error){return error;}throw new Error("Expected literal failure");};
const drain=<T>(steps:Generator<void,T,void>)=>{try{for(;;){const step=steps.next();if(step.done){return step.value;}}}finally{steps.return(undefined as never);}};
const hashOptions=(ledger:ReturnType<typeof createStructuralOwnerLedger>)=>{
  let started=0,closed=0,maxKeys=0;
  const options:edits.AdaptiveOwnedJournalOptions=Object.freeze({reserve:ledger.reserve,
    hash:function*(payload:unknown):Generator<void,string,void>{
      ledger.reserve(32_768,false,"hash");started+=1;
      maxKeys=Math.max(maxKeys,Object.keys(payload as object).length);
      if(maxKeys>16){throw new Error("Never hash the17-field brick through the16-key cursor");}
      const cursor=createOwnedCanonicalHashCursor(payload);
      try{for(;;){const step=cursor.advance(1);if(step!==undefined){return step.contentHash;}yield;}}
      finally{cursor.dispose();closed+=1;}
    }});
  return {options,get started(){return started;},get closed(){return closed;},get maxKeys(){return maxKeys;}};
};
it("measures exact witnessed numeric kernels on the actual complete materialization content envelope",()=>{
  const ledger=createStructuralOwnerLedger(resident,96*1024*1024,128);let envelope:unknown;
  const options:edits.AdaptiveOwnedJournalOptions={reserve:ledger.reserve,hash:function*(payload:unknown):Generator<void,string,void>{
    if((payload as {schemaVersion?:string}).schemaVersion==="adaptive-microvoxel-content-hash-input-v1")envelope=payload;
    ledger.reserve(32768,false,"hash");const cursor=createOwnedCanonicalHashCursor(payload,undefined,true);
    try{for(;;){const result=cursor.advance(128);if(result!==undefined)return result.contentHash;yield;}}
    finally{cursor.dispose();}
  }};
  try{
    const brick=drain(materialization.adaptiveMaterializeBrickSteps(input,options));
    expect(canonicalAdaptiveJson(brick)).toBe(expectedBytes);
    for(const channel of ["density","occupancy","material","semantic"] as const)expect(validation.isValidatedFrozenDenseArray(brick[channel])).toBe(true);
    expect(envelope).toBeDefined();const bytes=canonicalAdaptiveJson(envelope),digest=hashAdaptiveCanonical(envelope),samples={baseline:[] as number[],candidate:[] as number[]};
    const run=(factory:typeof numericPreimage)=>{
      const cursor=factory(envelope,undefined,true),start=performance.now();let result;
      try{do{result=cursor.advance(128);}while(result===undefined);}finally{cursor.dispose();}
      const duration=performance.now()-start;expect(result.contentHash).toBe(digest);return duration;
    };
    for(let warm=0;warm<4;warm+=1){run(numericPreimage);run(createOwnedCanonicalHashCursor);}
    for(let pair=0;pair<9;pair+=1)for(const kind of pair%2===0?["baseline","candidate"] as const:["candidate","baseline"] as const){
      let total=0;for(let repeat=0;repeat<4;repeat+=1)total+=run(kind==="baseline"?numericPreimage:createOwnedCanonicalHashCursor);samples[kind].push(total/4);
    }
    expect(canonicalAdaptiveJson(envelope)).toBe(bytes);
    console.info("R70_NUMERIC_KERNEL",JSON.stringify({classification:"DIAGNOSTIC_NOT_GAME_ACCEPTANCE",batchSize:4,samples}));
  }finally{ledger.release();}
});
it("retains only completely validated immutable plain channels and preserves numeric normalization and copy fallbacks",()=>{
  const original=root.materializeAdaptiveBrick(input);
  const validate=(brick:MaterializedAdaptiveBrick)=>{
    const ledger=createStructuralOwnerLedger(resident),hashes=hashOptions(ledger);
    try{return drain(materialization.adaptiveValidateMaterializedBrickSteps(brick,hashes.options));}
    finally{ledger.release();}
  };
  const retained=validate(original);
  for(const channel of ["density","occupancy","material","semantic"] as const){expect(retained[channel]).toBe(original[channel]);}
  expect(retained).not.toBe(original);expect(retained.provenance).not.toBe(original.provenance);
  expect(canonicalAdaptiveJson(retained)).toBe(canonicalAdaptiveJson(root.validateMaterializedAdaptiveBrick(original)));
  const mutable={...original,density:[...original.density]};
  const copied=validate(mutable);expect(copied.density).not.toBe(mutable.density);expect(Object.isFrozen(copied.density)).toBe(true);
  expect(canonicalAdaptiveJson(copied)).toBe(canonicalAdaptiveJson(root.validateMaterializedAdaptiveBrick(mutable)));
  class Derived extends Array<number>{}
  const subclassed={...original,density:Object.freeze(Derived.from(original.density))};
  expect(validate(subclassed).density).not.toBe(subclassed.density);
  const zero=root.materializeAdaptiveBrick({key,baseField:root.createAdaptiveBaseFieldDescriptor({kind:"constant-v1",
    identity:root.stableAuthorityId("base.zero-normalization"),version:root.stableAuthorityId("hvp-rigid-ingest-v1"),
    sourceRevision:root.authorityRevision(1),sample:{density:0,occupancy:0,materialId:null,semanticId:null}}),
    editJournal:root.createAdaptiveEditJournal([])});
  const density=[...zero.density];density[5]=-0;
  const signed=deepFreeze({...zero,density}),normalized=validate(signed);
  expect(Object.is(signed.density[5],-0)).toBe(true);expect(Object.is(normalized.density[5],0)).toBe(true);
  expect(normalized.density).not.toBe(signed.density);expect(normalized.contentHash).toBe(signed.contentHash);
  expect(numericBytes(normalized.density)).toEqual(numericBytes(root.validateMaterializedAdaptiveBrick(signed).density));
  const invalid=deepFreeze({...original,occupancy:original.occupancy.map((value,index)=>index===0?2:value),
    material:original.material.map((value,index)=>index===0?" invalid ":value)}) as unknown as MaterializedAdaptiveBrick;
  const expected=failureOf(()=>root.validateMaterializedAdaptiveBrick(invalid)),actual=failureOf(()=>validate(invalid));
  expect(actual).toMatchObject({code:(expected as validation.AdaptiveAuthorityError).code,path:"brick/occupancy/0"});
});
// This higher fixture owns the WHOLE parent job (including cancellation). Borrowed source steps
// never release it. One tiny driver, no production scheduler/factory or second ledger.
const job=(value:MaterializeAdaptiveBrickInput=input,prepareLimit=96*1024*1024)=>{
  const ledger=createStructuralOwnerLedger(resident,prepareLimit);ledger.reserve(16_384);
  const hashes=hashOptions(ledger);
  const steps=(function*(){const brick=yield* materialization.adaptiveMaterializeBrickSteps(value,hashes.options);
    return yield* materialization.adaptiveValidateMaterializedBrickSteps(brick,hashes.options);})();
  let state:"open"|"done"|"failed"|"disposed"="open",failure:unknown,consumed=0;
  const close=()=>{try{steps.return(undefined as never);}catch{/* first error wins */}ledger.release(state==="done");};
  return {advance(unitsValue:number){
    if(state==="failed"){throw failure;}if(state!=="open"){throw new Error("Once-only materialization job");}
    try{const units=structuralPositiveBudget(unitsValue,"cursor/maxUnits");for(let index=0;index<units;index+=1){
      consumed+=1;const step=steps.next();if(step.done){state="done";close();return {done:true as const,value:step.value};}
    }return {done:false as const};}catch(error){failure=error;state="failed";close();throw error;}
  },dispose(){if(state!=="failed"){state="disposed";}close();},get consumed(){return consumed;},get resources(){return ledger.resources;},hashes};
};
const finish=(cursor:ReturnType<typeof job>,units:number)=>{
  let maxAdvance=0,last=cursor.resources.reservedBytes;
  for(;;){const before=cursor.consumed,step=cursor.advance(units);maxAdvance=Math.max(maxAdvance,cursor.consumed-before);
    if(maxAdvance>units||(!step.done&&cursor.resources.reservedBytes<last)){throw new Error("Work or aggregate reservation bound");}
    last=cursor.resources.reservedBytes;if(step.done){return {value:step.value,maxAdvance};}
  }
};

it("preserves literal complete materialized bytes, original native namespaces and borrowed owned lifetimes",()=>{
  const typeAliases:[AdaptiveCanonicalValue|null,AdaptiveValidatedRefinementRequest|null,ValidateAdaptivePlannerSnapshotSemanticsOptions|null,
    CreateAdaptiveResidentValidationProofInput|null,CreateAdaptiveResidentValidationProofsInput|null,MaterializeAdaptiveBrickInput|null]=[null,null,null,null,null,null];
  expect(typeAliases).toHaveLength(6);
  for(const name of ["ADAPTIVE_MAX_RESIDENT_SUMMARIES","ADAPTIVE_MAX_ACTIVE_COVERAGE_ENTRIES","ADAPTIVE_MAX_REFINEMENT_REQUESTS",
    "ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES","ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES","canonicalAdaptiveJson","hashAdaptiveCanonical",
    "validateAdaptiveBaseFieldDescriptor","createAdaptiveBaseFieldDescriptor","evaluateAdaptiveBaseFieldDescriptor","hashAdaptiveBaseFieldDescriptor",
    "serializeAdaptiveKey","serializeAdaptiveEditJournal","serializeMaterializedAdaptiveBrick","createAdaptivePlannerSnapshotProjection",
    "hashAdaptivePlannerSnapshotProjection","validateAdaptivePlannerSnapshotSemantics","createAdaptiveResidentValidationProof",
    "createAdaptiveResidentValidationProofs","hasAdaptiveResidentValidationProofBrand","validateAdaptivePlanResult","serializeAdaptivePlan"] as const){expect(root[name]).toBe(canonical[name]);}
  for(const name of ["materializeAdaptiveBrick","validateMaterializedAdaptiveBrick"] as const){expect(root[name]).toBe(materialization[name]);}
  for(const name of ["AdaptiveAuthorityError","fail","adaptiveLevel","adaptiveRefinementLevel","globalQuantumCoordinate","authorityRevision",
    "adaptiveBrickRevision","adaptivePlanningEpoch","adaptiveEditRevision","editSequence","requireCanonicalString","compareCanonicalCodeUnits",
    "requireDenseDataPropertyArray","stableAuthorityId","adaptiveRegionId","adaptiveEditId","requireFinite","requirePlainRecord","requireExactKeys",
    "deepFreeze","isDeepFrozen"] as const){expect(root[name]).toBe(validation[name]);}
  for(const name of ["ADAPTIVE_MAX_JOURNAL_RECORDS","createAdaptiveEdit","createAdaptiveEditJournal","appendAdaptiveEdit","validateAdaptiveEditJournal"] as const){expect(root[name]).toBe(edits[name]);}
  expect(root.createAdaptiveBaseFieldDescriptor).toBe(root.validateAdaptiveBaseFieldDescriptor);
  for(const name of ["adaptiveBaseFieldDescriptorHashSteps","adaptiveMaterializeBrickSteps","adaptiveValidateMaterializedBrickSteps",
    "adaptiveDrainSteps","adaptiveDenseArraySteps","adaptiveMapSteps","adaptiveSortSteps","adaptiveFreezeArraySteps","adaptiveEditJournalSteps",
    "adaptiveValidateEditJournalSteps","AdaptiveOwnedJournalOptions","OWNED_RECORD_MAX_KEYS","createOwnedCanonicalHashCursor"]){expect(root).not.toHaveProperty(name);}
  expect(OWNED_RECORD_MAX_KEYS).toBe(16);expect(Reflect.ownKeys(expected)).toHaveLength(17);
  const retainedInput=canonicalAdaptiveJson(input),evidence:unknown[]=[];
  const densityBytes=numericBytes(expected.density),occupancyBytes=numericBytes(expected.occupancy);
  let whole=0;
  for(const units of [1,7,16,32,64,257]){
    const cursor=job(),done=finish(cursor,units);whole=cursor.consumed;
    expect(numericBytes(done.value.density)).toEqual(densityBytes);expect(numericBytes(done.value.occupancy)).toEqual(occupancyBytes);
    expect(done.value.material).toEqual(expected.material);expect(done.value.semantic).toEqual(expected.semantic);
    expect(canonicalAdaptiveJson(done.value)).toBe(expectedBytes);expect(root.isDeepFrozen(done.value)).toBe(true);
    expect(isIssuedStructuralObject(done.value)).toBe(false);expect(root.hasAdaptiveResidentValidationProofBrand(done.value)).toBe(false);
    expect(done.value).not.toHaveProperty("validationProof");expect(done.value).not.toHaveProperty("rigidRecipe");
    expect(cursor.resources.reservedBytes).toBe(0);expect(cursor.resources.retainedEstimateBytes).toBe(0);
    expect(cursor.resources.transferredResultEstimateBytes).toBeGreaterThan(0);expect(cursor.hashes.closed).toBe(cursor.hashes.started);
    expect(cursor.hashes.maxKeys).toBeLessThanOrEqual(10);expect(()=>cursor.advance(1)).toThrow("Once-only");
    const bytes=canonicalAdaptiveJson(done.value);cursor.dispose();cursor.dispose();expect(canonicalAdaptiveJson(done.value)).toBe(bytes);
    evidence.push({units,wholeUnits:whole,maxAdvanceUnits:done.maxAdvance,resources:cursor.resources,hashStarted:cursor.hashes.started,
      hashClosed:cursor.hashes.closed,maxHashEnvelopeKeys:cursor.hashes.maxKeys});
  }
  const generic=root.materializeAdaptiveBrick(input);
  expect(canonicalAdaptiveJson(generic)).toBe(expectedBytes);expect(root.serializeMaterializedAdaptiveBrick(generic)).toBe(expectedBytes);
  const zeroKey=root.createAdaptiveBrickKey({bodyId:key.bodyId,surfaceFrameId:key.surfaceFrameId,regionId:key.regionId,
    generatorVersion:key.generatorVersion,level:0,originQuantum:{x:0,y:0,z:0}});
  const rootInput=deepFreeze({...input,key:zeroKey,editJournal:root.createAdaptiveEditJournal([])});
  expect(canonicalAdaptiveJson(finish(job(rootInput),257).value)).toBe(canonicalAdaptiveJson(literalBrick(rootInput,literalChannels())));
  const minusZero=deepFreeze({...input,baseField:{...base,sample:{density:-0,occupancy:-0,materialId:null,semanticId:null}},editJournal:root.createAdaptiveEditJournal([])});
  const zeroChannels={density:new Array<number>(4096).fill(0),occupancy:new Array<number>(4096).fill(0),
    material:new Array<string|null>(4096).fill(null),semantic:new Array<string|null>(4096).fill(null)};
  const zero=finish(job(minusZero),257).value;
  expect(numericBytes(zero.density)).toEqual(numericBytes(zeroChannels.density));expect(numericBytes(zero.occupancy)).toEqual(numericBytes(zeroChannels.occupancy));
  expect(canonicalAdaptiveJson(zero)).toBe(canonicalAdaptiveJson(literalBrick(minusZero,zeroChannels)));
  const positiveKey=root.createAdaptiveBrickKey({bodyId:key.bodyId,surfaceFrameId:key.surfaceFrameId,regionId:key.regionId,
    generatorVersion:key.generatorVersion,level:4,originQuantum:{x:0,y:0,z:0}});
  for(const [fixtureKey,sphere] of [[key,{center:{x:1,y:0,z:0},radiusQuantum:1}],
    [positiveKey,{center:{x:-Number.MAX_SAFE_INTEGER,y:-1,z:0},radiusQuantum:Number.MAX_SAFE_INTEGER}]] as const){
    const value=deepFreeze({...input,key:fixtureKey,editJournal:root.createAdaptiveEditJournal([{...inputs[0]!,sphere}])});
    expect(canonicalAdaptiveJson(finish(job(value),257).value)).toBe(canonicalAdaptiveJson(literalBrick(value,literalChannels())));
  }
  const largeInputs=deepFreeze(Array.from({length:4096},(_,index)=>({...inputs[4]!,editId:`large.${index}`,sequence:index+1,
    expectedRegionRevision:index,resultRegionRevision:index+1,box:{min:{x:4096,y:0,z:0},max:{x:4097,y:1,z:1}}})));
  const largeInput=deepFreeze({...input,editJournal:root.createAdaptiveEditJournal(largeInputs)}),largeJob=job(largeInput);
  const large=finish(largeJob,257);
  expect(canonicalAdaptiveJson(large.value)).toBe(canonicalAdaptiveJson(literalBrick(largeInput,literalChannels())));
  expect(largeJob.hashes.closed).toBe(largeJob.hashes.started);expect(largeJob.resources.reservedBytes).toBe(0);
  const changedRecords=largeInput.editJournal.records.map((record,index)=>index===4095?{...record,sourceId:root.stableAuthorityId("source.changed")}:record);
  const badBinding=deepFreeze({...largeInput,editJournal:{...largeInput.editJournal,records:changedRecords}}),badJob=job(badBinding);
  expect(failureOf(()=>finish(badJob,257))).toMatchObject({code:"InvalidEditJournal",path:"journal"});expect(badJob.resources.reservedBytes).toBe(0);
  for(const [value,path] of [
    [{...input,key:{...key,bodyId:" bad"},baseField:{...base,kind:"unsupported"}},"bodyId"],
    [{...input,baseField:{...base,kind:"unsupported"}},"baseField/kind"],
    [{...input,baseField:{...base,sample:{...base.sample,occupancy:2}},editJournal:{...input.editJournal,digest:"invalid"}},"baseField/sample/occupancy"]
  ] as const){
    const fixture=deepFreeze(value) as unknown as MaterializeAdaptiveBrickInput,cursor=job(fixture);
    const first=failureOf(()=>finish(cursor,257)),original=failureOf(()=>root.materializeAdaptiveBrick(fixture));
    expect(first).toMatchObject({code:(original as validation.AdaptiveAuthorityError).code,path,message:(original as Error).message});
    expect(cursor.resources.reservedBytes).toBe(0);expect(failureOf(()=>cursor.advance(1))).toBe(first);cursor.dispose();expect(failureOf(()=>cursor.advance(1))).toBe(first);
  }
  for(const [value,path] of [
    [{...generic,cellCount:4095},"brick"],
    [{...generic,density:[NaN,...generic.density.slice(1)],occupancy:[2,...generic.occupancy.slice(1)]},"brick/density/0"],
    [{...generic,occupancy:[2,...generic.occupancy.slice(1)]},"brick/occupancy/0"],
    [{...generic,material:[" ",...generic.material.slice(1)]},"brick/material/0"],
    [{...generic,provenance:{...generic.provenance,journalDigest:"fnv1a64-v1:0000000000000000"}},"brick/provenance"],
    [{...generic,key:{...key,regionId:root.stableAuthorityId("region.other")}},"brick/provenance"]
  ] as const){
    const fixture=deepFreeze(value) as unknown as root.MaterializedAdaptiveBrick,ledger=createStructuralOwnerLedger(resident),hashes=hashOptions(ledger);
    const original=failureOf(()=>root.validateMaterializedAdaptiveBrick(fixture));
    const actual=failureOf(()=>drain(materialization.adaptiveValidateMaterializedBrickSteps(fixture,hashes.options)));
    expect(actual).toMatchObject({code:(original as validation.AdaptiveAuthorityError).code,path,message:(original as Error).message});
    expect(hashes.closed).toBe(hashes.started);ledger.release();expect(ledger.resources.reservedBytes).toBe(0);
  }
  const observation:string[]=[],proxy=new Proxy(input,{get(target,property,receiver){observation.push(String(property));return Reflect.get(target,property,receiver);}});
  expect(canonicalAdaptiveJson(root.materializeAdaptiveBrick(proxy))).toBe(expectedBytes);expect(observation).toEqual(["key","baseField","editJournal"]);
  let getters=0;const sparse=new Array(4096);Object.defineProperty(sparse,"0",{enumerable:true,get(){getters+=1;return 0;}});
  expect(failureOf(()=>root.validateMaterializedAdaptiveBrick({...generic,density:sparse}))).toMatchObject({path:"brick/density/0"});expect(getters).toBe(0);
  const saved=Object.getOwnPropertyDescriptor(Array.prototype,"constructor")!,sentinel=new Error("native Species prefix"),native:string[]=[];
  let nativeFailure:unknown;
  try{Object.defineProperty(Array.prototype,"constructor",{configurable:true,get(){native.push("constructor");return {get [Symbol.species](){native.push("Species");throw sentinel;}};}});
    try{root.materializeAdaptiveBrick(input);}catch(error){nativeFailure=error;}
  }finally{Object.defineProperty(Array.prototype,"constructor",saved);}
  expect(nativeFailure).toBe(sentinel);expect(native).toEqual(["constructor","Species"]);
  const tight=job(input,20_000),first=failureOf(()=>finish(tight,1));expect(first).toMatchObject({code:"InvalidBudget",path:"cursor/prepareBytes"});
  expect(tight.resources.reservedBytes).toBe(0);tight.dispose();expect(failureOf(()=>tight.advance(257))).toBe(first);
  const boundaries=[0,1,64,20_000,Math.floor(whole/2),whole-1];
  for(const boundary of boundaries){
    const canceled=job();if(boundary>0){expect(canceled.advance(boundary).done).toBe(false);}canceled.dispose();canceled.dispose();
    expect(canceled.resources.reservedBytes).toBe(0);expect(canceled.hashes.closed).toBe(canceled.hashes.started);
    const host=job();try{if(boundary>0){host.advance(boundary);}throw sentinel;}catch(error){expect(error).toBe(sentinel);}finally{host.dispose();}
    expect(host.resources.reservedBytes).toBe(0);expect(host.hashes.closed).toBe(host.hashes.started);
    const invalid=job();if(boundary>0){invalid.advance(boundary);}const error=failureOf(()=>invalid.advance(0));expect(error).toMatchObject({path:"cursor/maxUnits"});
    expect(invalid.resources.reservedBytes).toBe(0);invalid.dispose();expect(failureOf(()=>invalid.advance(1))).toBe(error);expect(invalid.hashes.closed).toBe(invalid.hashes.started);
  }
  const parent=createStructuralOwnerLedger(resident);parent.reserve(4_096);const borrowed=hashOptions(parent);
  const borrowedValue=drain(materialization.adaptiveMaterializeBrickSteps(input,borrowed.options));
  expect(canonicalAdaptiveJson(borrowedValue)).toBe(expectedBytes);expect(parent.resources.reservedBytes).toBeGreaterThan(4_096);
  parent.release();expect(parent.resources.reservedBytes).toBe(0);expect(canonicalAdaptiveJson(borrowedValue)).toBe(expectedBytes);
  expect(canonicalAdaptiveJson(input)).toBe(retainedInput);
  console.log("OWNED_MATERIALIZATION_EVIDENCE",JSON.stringify({cases:evidence,wholeUnits:whole,large4096:{units:largeJob.consumed,
    maxAdvanceUnits:large.maxAdvance,resources:largeJob.resources},cancelBoundaries:boundaries.length,hostFinallyBoundaries:boundaries.length,
    invalidBudgetBoundaries:boundaries.length,finalReservations:0,originalCanonicalRuntime:22,originalCanonicalTypes:5,
    originalMaterializationRuntime:2,originalMaterializationTypes:1,originalValidationEditRuntime:26,privateHelpersAbsent:true,
    hashBackingBytes:4096,pendingUtf16Units:1024,finalBrickKeys:17,kernelRecordCap:16,productionActivation:"OFF",physicalGC:"NOT_PROVEN",whole8ms:"NOT_PROVEN"}));
});
