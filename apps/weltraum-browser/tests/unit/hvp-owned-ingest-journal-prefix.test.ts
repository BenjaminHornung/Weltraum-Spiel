import {expect,it} from "vitest";
import * as root from "../../src/voxel/adaptive";
import * as validation from "../../src/voxel/adaptive/validation";
import * as edits from "../../src/voxel/adaptive/edits";
import * as structuralRoot from "../../src/voxel/structural";
import * as model from "../../src/voxel/structural/model";
import {createOwnedHvpStructuralIngestJournalCursor,prepareHvpStructuralIngestJournalOwnedSteps,
  hvpIngestJournalHashSteps,ingestHvpStructuralCells,type HvpStructuralCell} from "../../src/hestia-prototype/terrain/structuralIngest";
import {ADAPTIVE_EDIT_SCHEMA_VERSION,ADAPTIVE_JOURNAL_SCHEMA_VERSION} from "../../src/voxel/adaptive/types";
import type {AdaptiveAuthorityErrorCode,DenseDataPropertyArrayOptions,AdaptiveEditInput} from "../../src/voxel/adaptive";

const {canonicalAdaptiveJson,hashAdaptiveCanonical,deepFreeze}=root;
const resident=32*1024*1024; // Retained fixture inputs/oracles/old/new/results; modeled, NOT physical proof.
const id="child.literal";
const material=(materialId:number)=>({materialId,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null});
const materials=deepFreeze([material(65_535),material(7),material(1),material(256)]);
const cells=deepFreeze([{x:1,y:-16,z:16,materialId:65_535},{x:-16,y:-16,z:16,materialId:1},
  {x:0,y:-16,z:16,materialId:256},{x:-15,y:-16,z:16,materialId:1}]);
// Independent literal schema/run/frame/journal oracle from retained preimages4, NOT new outputs.
const sortedCells=[{x:-16,y:-16,z:16,materialId:1},{x:-15,y:-16,z:16,materialId:1},
  {x:0,y:-16,z:16,materialId:256},{x:1,y:-16,z:16,materialId:65_535}];
const runs=[{x:-16,y:-16,z:16,materialId:1,end:-14},{x:0,y:-16,z:16,materialId:256,end:1},
  {x:1,y:-16,z:16,materialId:65_535,end:2}];
const prefixRecords=runs.map((run,index)=>({schemaVersion:ADAPTIVE_EDIT_SCHEMA_VERSION,editId:`${id}.run.${index}`,
  sequence:index+1,expectedRegionRevision:index,resultRegionRevision:index+1,actorId:"hvp.ingest",sourceId:`hvp.source.${id}`,
  operation:"AddBox",box:{min:{x:run.x,y:run.y,z:run.z},max:{x:run.end,y:run.y+1,z:run.z+1}},materialId:`hvp.material.${run.materialId}`}));
const literalJournal=(records:readonly unknown[],initialRegionRevision=0)=>({schemaVersion:ADAPTIVE_JOURNAL_SCHEMA_VERSION,
  initialRegionRevision,revision:initialRegionRevision+records.length,records,
  digest:hashAdaptiveCanonical({schemaVersion:ADAPTIVE_JOURNAL_SCHEMA_VERSION,initialRegionRevision,records})});
const expectedPrefix=deepFreeze({materials:[material(1),material(7),material(256),material(65_535)],cells:sortedCells,
  origins:[{x:-16,y:-16,z:16},{x:0,y:-16,z:16}],runs,
  frame:{schemaVersion:"structural-microvoxel-frame-binding-v1",bodyId:"body.hestia",surfaceFrameId:"frame.hvp",regionId:`region.${id}`,
    generatorVersion:"hvp-rigid-ingest-v1",objectOriginQuantum:{x:0,y:0,z:0}},
  baseField:{kind:"constant-v1",identity:`base.${id}`,version:"hvp-rigid-ingest-v1",sourceRevision:1,
    sample:{density:0,occupancy:0,materialId:null,semanticId:null}},editJournal:literalJournal(prefixRecords)});
const box={min:{x:-17,y:0,z:0},max:{x:-15,y:1,z:1}},sphere={center:{x:-16,y:0,z:0},radiusQuantum:1};
const fiveInputs:readonly AdaptiveEditInput[]=deepFreeze([
  {editId:"edit.1",sequence:1,expectedRegionRevision:0,resultRegionRevision:1,actorId:"actor.test",sourceId:"source.test",operation:"SubtractSphere",sphere},
  {editId:"edit.2",sequence:2,expectedRegionRevision:1,resultRegionRevision:2,actorId:"actor.test",sourceId:"source.test",operation:"AddSphere",sphere,materialId:"hvp.material.65535"},
  {editId:"edit.3",sequence:3,expectedRegionRevision:2,resultRegionRevision:3,actorId:"actor.test",sourceId:"source.test",operation:"SubtractBox",box},
  {editId:"edit.4",sequence:4,expectedRegionRevision:3,resultRegionRevision:4,actorId:"actor.test",sourceId:"source.test",operation:"AddBox",box,materialId:"hvp.material.256",semanticId:"semantic.test"},
  {editId:"edit.5",sequence:5,expectedRegionRevision:4,resultRegionRevision:5,actorId:"actor.test",sourceId:"source.test",operation:"SetMaterialBox",box,materialId:"hvp.material.7"}
]);
const fiveRecords=deepFreeze(fiveInputs.map(input=>({schemaVersion:ADAPTIVE_EDIT_SCHEMA_VERSION,...input})));
type Cursor=ReturnType<typeof createOwnedHvpStructuralIngestJournalCursor>;
const finish=(cursor:Cursor,units:number)=>{
  let last=cursor.resources.reservedBytes,peak=cursor.resources.peakEstimateBytes,maxAdvance=0;
  for(let advances=0;advances<100_000;advances+=1){
    const before=cursor.consumedUnits,step=cursor.advance(units),resource=cursor.resources;
    maxAdvance=Math.max(maxAdvance,cursor.consumedUnits-before);
    if(maxAdvance>units||resource.peakEstimateBytes<peak||(!step.done&&resource.reservedBytes<last)){
      throw new Error("Non-monotonic work/aggregate reservation or excessive unit count");
    }
    last=resource.reservedBytes;peak=resource.peakEstimateBytes;
    if(step.done){return {value:step.value,maxAdvance};}
  }
  throw new Error("Prefix did not progress");
};
const drain=<T>(steps:Generator<void,T,void>,units:number)=>{
  let whole=0,maxAdvance=0;
  try{for(;;){
    for(let count=1;count<=units;count+=1){whole+=1;const step=steps.next();maxAdvance=Math.max(maxAdvance,count);if(step.done){return {value:step.value,whole,maxAdvance};}}
  }}finally{steps.return(undefined as never);}
};
const journalOptions=(reserve:Parameters<typeof hvpIngestJournalHashSteps>[1]):edits.AdaptiveOwnedJournalOptions=>
  ({reserve,hash:payload=>hvpIngestJournalHashSteps(payload,reserve)});
const failureOf=(run:()=>unknown)=>{try{run();}catch(error){return error;}throw new Error("Expected literal failure");};
const checkArray=(array:readonly unknown[])=>{
  expect(Object.getPrototypeOf(array)).toBe(Array.prototype);expect(Object.isFrozen(array)).toBe(true);
  expect(Reflect.ownKeys(array)).toEqual([...Array.from({length:array.length},(_,index)=>String(index)),"length"]);
};

it("keeps literal ingest/journal bytes, original namespaces/observers and one inactive aggregate cursor lifetime",()=>{
  const errorCode:AdaptiveAuthorityErrorCode="InvalidEditJournal",arrayOptions:DenseDataPropertyArrayOptions={maximumLength:4096};
  expect(errorCode).toBe("InvalidEditJournal");expect(arrayOptions.maximumLength).toBe(4096);
  for(const name of ["AdaptiveAuthorityError","fail","adaptiveLevel","adaptiveRefinementLevel","globalQuantumCoordinate",
    "authorityRevision","adaptiveBrickRevision","adaptivePlanningEpoch","adaptiveEditRevision","editSequence","requireCanonicalString",
    "compareCanonicalCodeUnits","requireDenseDataPropertyArray","stableAuthorityId","adaptiveRegionId","adaptiveEditId","requireFinite",
    "requirePlainRecord","requireExactKeys","deepFreeze","isDeepFrozen"] as const){expect(root[name]).toBe(validation[name]);}
  for(const name of ["ADAPTIVE_MAX_JOURNAL_RECORDS","createAdaptiveEdit","createAdaptiveEditJournal","appendAdaptiveEdit","validateAdaptiveEditJournal"] as const){expect(root[name]).toBe(edits[name]);}
  for(const name of ["adaptiveDrainSteps","adaptiveDenseArraySteps","adaptiveMapSteps","adaptiveSortSteps","adaptiveFreezeArraySteps",
    "adaptiveEditJournalSteps","adaptiveValidateEditJournalSteps","AdaptiveOwnedJournalOptions","AdaptiveOwnedReserve"]){expect(root).not.toHaveProperty(name);}
  expect(typeof model.structuralMaterialTableSteps).toBe("function");expect(structuralRoot).not.toHaveProperty("structuralMaterialTableSteps");
  expect(structuralRoot).not.toHaveProperty("createOwnedHvpStructuralIngestJournalCursor");
  const inputBefore=canonicalAdaptiveJson({cells,materials,fiveInputs}),records:unknown[]=[];
  let wholePrefix=0;
  for(const units of [1,7,16,32,64,257]){
    const cursor=createOwnedHvpStructuralIngestJournalCursor(id,cells,materials,resident),done=finish(cursor,units);
    expect(canonicalAdaptiveJson(done.value)).toBe(canonicalAdaptiveJson(expectedPrefix));expect(model.isIssuedStructuralObject(done.value)).toBe(false);
    expect(done.value).not.toHaveProperty("contentHash");expect(done.value).not.toHaveProperty("validationProof");
    expect(cursor.resources.reservedBytes).toBe(0);expect(cursor.resources.retainedEstimateBytes).toBe(0);
    expect(cursor.resources.transferredResultEstimateBytes).toBeGreaterThan(0);expect(cursor.resources.hashReservations).toBe(1);
    for(const array of [done.value.cells,done.value.runs,done.value.origins,done.value.materials,done.value.editJournal.records]){checkArray(array);}
    expect(root.isDeepFrozen(done.value)).toBe(true);const retained=canonicalAdaptiveJson(done.value);
    expect(()=>cursor.advance(1)).toThrow("once-only");cursor.dispose();cursor.dispose();expect(canonicalAdaptiveJson(done.value)).toBe(retained);
    wholePrefix=cursor.consumedUnits;records.push({units,wholeUnits:wholePrefix,maxAdvance:done.maxAdvance,resources:cursor.resources});
    const ledger=model.createStructuralOwnerLedger(resident),owned=journalOptions(ledger.reserve);
    const created=drain(edits.adaptiveEditJournalSteps([...fiveInputs].reverse(),0,owned),units);
    expect(canonicalAdaptiveJson(created.value)).toBe(canonicalAdaptiveJson(literalJournal(fiveRecords)));
    expect(created.value).toEqual(root.createAdaptiveEditJournal([...fiveInputs].reverse()));
    const afterCreate=ledger.resources.reservedBytes;
    const rebuilt=drain(edits.adaptiveValidateEditJournalSteps(created.value,owned),units);
    expect(rebuilt.value).toEqual(created.value);expect(ledger.resources.reservedBytes).toBeGreaterThan(afterCreate);
    expect(created.maxAdvance).toBeLessThanOrEqual(units);expect(rebuilt.maxAdvance).toBeLessThanOrEqual(units);
    ledger.release(true);expect(ledger.resources.reservedBytes).toBe(0);expect(ledger.resources.retainedEstimateBytes).toBe(0);
  }
  const generic=ingestHvpStructuralCells(id,cells,materials);
  expect(generic.materials).toEqual(expectedPrefix.materials);expect(generic.frame).toEqual(expectedPrefix.frame);
  expect(generic.source.journalDigest).toBe(expectedPrefix.editJournal.digest);expect(generic.source.baseFieldIdentity).toBe(`base.${id}`);
  for(const values of [[],[fiveInputs[0]!]]){
    const ledger=model.createStructuralOwnerLedger(resident),owned=journalOptions(ledger.reserve);
    const created=drain(edits.adaptiveEditJournalSteps(values,0,owned),1).value;
    expect(created).toEqual(literalJournal(values.map(input=>({schemaVersion:ADAPTIVE_EDIT_SCHEMA_VERSION,...input}))));
    expect(drain(edits.adaptiveValidateEditJournalSteps(created,owned),7).value).toEqual(created);ledger.release();expect(ledger.resources.reservedBytes).toBe(0);
  }
  const largeInputs=deepFreeze(Array.from({length:4096},(_,index)=>({...fiveInputs[3]!,editId:`large.${index}`,sequence:index+1,
    expectedRegionRevision:index,resultRegionRevision:index+1})));
  const largeExpected=literalJournal(largeInputs.map(input=>({schemaVersion:ADAPTIVE_EDIT_SCHEMA_VERSION,...input})));
  const largeLedger=model.createStructuralOwnerLedger(resident),largeOptions=journalOptions(largeLedger.reserve);
  const large=drain(edits.adaptiveEditJournalSteps(largeInputs,0,largeOptions),257);
  expect(canonicalAdaptiveJson(large.value)).toBe(canonicalAdaptiveJson(largeExpected));expect(large.value).toEqual(root.createAdaptiveEditJournal(largeInputs));
  expect(drain(edits.adaptiveValidateEditJournalSteps(large.value,largeOptions),257).value).toEqual(large.value);
  const largePeak=largeLedger.resources.peakEstimateBytes;largeLedger.release();expect(largeLedger.resources.reservedBytes).toBe(0);
  const over=[...largeInputs,largeInputs[0]!];
  expect(failureOf(()=>root.createAdaptiveEditJournal(over))).toMatchObject({code:"InvalidEditJournal",path:"records"});
  for(const [values,initial,path] of [
    [[{...fiveInputs[0]!,operation:"unknown"}],0,"operation"],
    [[{...fiveInputs[0]!,sequence:2}],0,"records/0/sequence"],
    [[fiveInputs[0]!],1,"records/0/expectedRegionRevision"],
    [[fiveInputs[0]!,{...fiveInputs[1]!,editId:"edit.1"}],0,"records/1/editId"],
    [over,0,"records"]
  ] as const){
    const inputs=values as unknown as readonly AdaptiveEditInput[],ledger=model.createStructuralOwnerLedger(resident);
    const expected=failureOf(()=>root.createAdaptiveEditJournal(inputs,initial));
    expect(expected).toMatchObject({path});
    const actual=failureOf(()=>drain(edits.adaptiveEditJournalSteps(inputs,initial,journalOptions(ledger.reserve)),7));
    expect(actual).toMatchObject({code:(expected as validation.AdaptiveAuthorityError).code,path});ledger.release();expect(ledger.resources.reservedBytes).toBe(0);
  }
  for(const changed of [{revision:99},{digest:"fnv1a64-v1:0000000000000000"}]){
    const journal={...expectedPrefix.editJournal,...changed} as ReturnType<typeof root.createAdaptiveEditJournal>;
    const ledger=model.createStructuralOwnerLedger(resident);expect(failureOf(()=>drain(edits.adaptiveValidateEditJournalSteps(journal,journalOptions(ledger.reserve)),16))).toMatchObject({code:"InvalidEditJournal",path:"journal"});ledger.release();expect(ledger.resources.reservedBytes).toBe(0);
  }
  const observation:string[]=[];
  const proxy=new Proxy([fiveInputs[0]!],{ownKeys(target){observation.push("ownKeys");return Reflect.ownKeys(target);},
    getOwnPropertyDescriptor(target,key){observation.push(`descriptor:${String(key)}`);return Reflect.getOwnPropertyDescriptor(target,key);},
    get(target,key,receiver){observation.push(`get:${String(key)}`);return Reflect.get(target,key,receiver);}});
  root.createAdaptiveEditJournal(proxy);expect(observation).toEqual(["descriptor:length","ownKeys","descriptor:0","descriptor:0"]);
  let getterReads=0;const sparse=new Array(2);Object.defineProperty(sparse,"1",{enumerable:true,get(){getterReads+=1;return fiveInputs[0];}});
  expect(failureOf(()=>root.createAdaptiveEditJournal(sparse))).toMatchObject({code:"InvalidEditJournal",path:"records/1"});expect(getterReads).toBe(0);
  const constructor=Object.getOwnPropertyDescriptor(Array.prototype,"constructor")!,sentinel=new Error("literal native Species sentinel"),nativeReads:string[]=[];
  let nativeFailure:unknown;
  try{
    Object.defineProperty(Array.prototype,"constructor",{configurable:true,get(){nativeReads.push("constructor");return {get [Symbol.species](){nativeReads.push("Species");throw sentinel;}};}});
    try{root.createAdaptiveEditJournal([fiveInputs[0]!]);}catch(error){nativeFailure=error;}
  }finally{Object.defineProperty(Array.prototype,"constructor",constructor);}
  expect(nativeFailure).toBe(sentinel);expect(nativeReads).toEqual(["constructor","Species"]);
  const runOverflow=Array.from({length:4097},(_,index)=>({x:index%16,y:Math.floor(index/16)%16,z:Math.floor(index/256),materialId:index%2?7:1}));
  const originOverflow=Array.from({length:129},(_,index)=>({x:index*16,y:0,z:0,materialId:1}));
  for(const [value,message] of [[[],"1..32768"],[new Array(32769),"1..32768"],[[cells[0]!,cells[0]!],"Duplicate HVP cell"],
    [[{...cells[0]!,x:1_000_001}],"Invalid canonical"],[runOverflow,"4096 AddBox runs"],[originOverflow,"brick working set"]] as const){
    const cursor=createOwnedHvpStructuralIngestJournalCursor(id,value as readonly HvpStructuralCell[],materials,resident);
    const first=failureOf(()=>finish(cursor,257));expect((first as Error).message).toContain(message);
    expect(cursor.resources.reservedBytes).toBe(0);expect(failureOf(()=>cursor.advance(1))).toBe(first);cursor.dispose();expect(failureOf(()=>cursor.advance(1))).toBe(first);
  }
  const tight=createOwnedHvpStructuralIngestJournalCursor(id,cells,materials,resident,20_000),first=failureOf(()=>finish(tight,1));
  expect(first).toMatchObject({code:"InvalidBudget",path:"cursor/prepareBytes"});expect(tight.resources.reservedBytes).toBe(0);tight.dispose();expect(failureOf(()=>tight.advance(257))).toBe(first);
  expect(failureOf(()=>createOwnedHvpStructuralIngestJournalCursor(id,cells,materials,256*1024*1024))).toMatchObject({path:"cursor/prepareBytes"});
  expect(finish(createOwnedHvpStructuralIngestJournalCursor(id,cells,materials,resident),64).value.editJournal.digest).toBe(expectedPrefix.editJournal.digest);
  const boundaries=[0,1,7,16,32,64,257,Math.floor(wholePrefix/4),Math.floor(wholePrefix/2),wholePrefix-1];
  for(const boundary of boundaries){
    const canceled=createOwnedHvpStructuralIngestJournalCursor(id,cells,materials,resident);
    if(boundary>0){expect(canceled.advance(boundary).done).toBe(false);}canceled.dispose();canceled.dispose();expect(canceled.resources.reservedBytes).toBe(0);
    const host=createOwnedHvpStructuralIngestJournalCursor(id,cells,materials,resident);
    try{if(boundary>0){host.advance(boundary);}throw new Error("host sentinel");}catch(error){expect((error as Error).message).toBe("host sentinel");}finally{host.dispose();}
    expect(host.resources.reservedBytes).toBe(0);
    const invalid=createOwnedHvpStructuralIngestJournalCursor(id,cells,materials,resident);
    if(boundary>0){invalid.advance(boundary);}const failure=failureOf(()=>invalid.advance(0));expect(failure).toMatchObject({path:"cursor/maxUnits"});
    expect(invalid.resources.reservedBytes).toBe(0);invalid.dispose();expect(failureOf(()=>invalid.advance(1))).toBe(failure);
  }
  const borrowed=model.createStructuralOwnerLedger(resident);borrowed.reserve(4_096);
  expect(drain(prepareHvpStructuralIngestJournalOwnedSteps(id,cells,materials,borrowed.reserve),7).value).toEqual(expectedPrefix);
  expect(borrowed.resources.reservedBytes).toBeGreaterThan(4_096);borrowed.release();expect(borrowed.resources.reservedBytes).toBe(0);
  expect(canonicalAdaptiveJson({cells,materials,fiveInputs})).toBe(inputBefore);
  console.log("OWNED_INGEST_JOURNAL_PREFIX_EVIDENCE",JSON.stringify({cases:records,units:[1,7,16,32,64,257],wholePrefixUnits:wholePrefix,
    large4096:{wholeCreateUnits:large.whole,maxAdvanceUnits:large.maxAdvance,peakEstimateBytes:largePeak,finalReservations:0},
    cancelBoundaries:boundaries.length,hostFinallyBoundaries:boundaries.length,invalidBudgetBoundaries:boundaries.length,finalReservations:0,
    originalPublicRuntimeBindings:26,originalPublicTypes:3,privateTableAbsentFromStructuralRoot:true,prefixIssuer:false,
    hashBackingBytes:4096,pendingUtf16Units:1024,physicalHeap:"NOT_PROVEN",whole8ms:"NOT_PROVEN",productionActivation:"OFF"}));
});
