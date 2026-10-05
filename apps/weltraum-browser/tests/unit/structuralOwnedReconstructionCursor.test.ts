import {expect, it} from "vitest";
import {canonicalAdaptiveJson, createAdaptiveBrickKey, hashAdaptiveCanonical, serializeAdaptiveKey} from "../../src/voxel/adaptive";
import {createOwnedCanonicalHashCursor} from "../../src/voxel/adaptive/ownedCanonicalHashSteps";
import {projectStructuralObjectContent, serializeStructuralObject} from "../../src/voxel/structural/canonical";
import {createOwnedStructuralReconstructionCursor, createStructuralReconstructionCursor, isIssuedStructuralObject,
  reconstructStructuralObjectInternal, type InternalStructuralObjectReconstructionInput} from "../../src/voxel/structural/model";
import {STRUCTURAL_BRICK_SCHEMA_VERSION, STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION, STRUCTURAL_OBJECT_SCHEMA_VERSION,
  STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION, type StructuralObject} from "../../src/voxel/structural/types";

const hash = "fnv1a64-v1:0000000000000001";
const frame = {schemaVersion:STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,bodyId:"planet.test",surfaceFrameId:"frame.surface",
  regionId:"region.test",generatorVersion:"generator.v1",objectOriginQuantum:{x:0,y:0,z:0}} as const;
const key = (x:number) => createAdaptiveBrickKey({bodyId:frame.bodyId,surfaceFrameId:frame.surfaceFrameId,
  regionId:frame.regionId,generatorVersion:frame.generatorVersion,level:4,originQuantum:{x,y:-16,z:16}});
const state = (materialId:number) => ({materialId,partId:null,semanticKey:null,damageKey:null});
const material = (materialId:number) => ({materialId,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null});
const left = {schemaVersion:STRUCTURAL_BRICK_SCHEMA_VERSION,key:key(-16),cells:[{localIndex:0,state:state(1)},{localIndex:15,state:state(7)}]};
const right = {schemaVersion:STRUCTURAL_BRICK_SCHEMA_VERSION,key:key(0),cells:[{localIndex:0,state:state(256)},{localIndex:1,state:state(65_535)}]};
const raw = {objectId:"object.test",frame,source:{schemaVersion:STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION,baseFieldIdentity:"base.persistence",
  baseFieldVersion:"generator.v1",baseFieldDescriptorDigest:hash,journalDigest:hash,snapshotProjectionDigest:hash,proofDigests:[hash],
  sourceRevision:1,editRevision:0,brickRevision:0,planningEpoch:1},materials:[material(65_535),material(1),material(256),material(7)],
  bricks:[right,left],anchors:[],joints:[],objectRevision:0,editRevision:0,commandEvidence:[]} satisfies InternalStructuralObjectReconstructionInput;
// Independent fixed schema fixture, using ONLY the unchanged Adaptive canonical/FNV implementation.
// Ordering and fields come from the retained prechange model/canonical, never a new cursor output.
const expectedContent = {schemaVersion:STRUCTURAL_OBJECT_SCHEMA_VERSION,objectId:raw.objectId,frame,source:raw.source,
  materials:[material(1),material(7),material(256),material(65_535)],
  bricks:[{schemaVersion:STRUCTURAL_BRICK_SCHEMA_VERSION,key:serializeAdaptiveKey(left.key),cells:left.cells},
    {schemaVersion:STRUCTURAL_BRICK_SCHEMA_VERSION,key:serializeAdaptiveKey(right.key),cells:right.cells}],anchors:[],joints:[]};
const input = (source:StructuralObject):InternalStructuralObjectReconstructionInput => ({objectId:source.objectId,frame:source.frame,
  source:source.source,materials:source.materials,bricks:source.bricks,anchors:source.anchors,joints:source.joints,
  objectRevision:source.objectRevision,editRevision:source.editRevision,commandEvidence:source.commandEvidence});
const drain = <T>(cursor:{advance(units:number):{done:false}|{done:true;value:T};dispose():void}, units:number) => {
  for (let advances=1; advances<10_000; advances+=1) {
    const step=cursor.advance(units);
    if (step.done) { return {value:step.value,advances}; }
  }
  throw new Error("Reconstruction did not make bounded progress");
};

it("keeps prechange literal bytes, generic observation/error prefixes and owned units/cancel/resource/result lifetime in one check", () => {
  const expectedBytes=canonicalAdaptiveJson(expectedContent), expectedHash=hashAdaptiveCanonical(expectedContent);
  const source=reconstructStructuralObjectInternal(raw), before=serializeStructuralObject(source);
  expect(source.contentHash).toBe(expectedHash);
  expect(source.evidenceHash).toBe(hashAdaptiveCanonical([]));
  expect(canonicalAdaptiveJson(projectStructuralObjectContent(source))).toBe(expectedBytes);
  let maximumAdvances=0;
  let ledger:ReturnType<typeof createOwnedStructuralReconstructionCursor>["resources"] | undefined;
  for (const units of [1,16,32,64]) {
    const generic=createStructuralReconstructionCursor(raw);
    expect(drain(generic,units).value).toEqual(source); generic.dispose();
    const owner=createOwnedStructuralReconstructionCursor(source,{...input(source),bricks:[source.bricks[1]!,source.bricks[0]!]},262_144);
    const result=drain(owner,units);maximumAdvances=Math.max(maximumAdvances,result.advances);
    expect(result.value).toEqual(source);
    expect(result.value.contentHash).toBe(expectedHash);
    expect(Object.isFrozen(result.value.bricks)).toBe(true);
    expect(Object.isFrozen(result.value.materials)).toBe(true);
    expect(Object.isFrozen(result.value.source.proofDigests)).toBe(true);
    expect(Object.isFrozen(result.value.bricks[0]!.cells)).toBe(true);
    expect(Object.isFrozen(result.value.commandEvidence)).toBe(true);
    expect(canonicalAdaptiveJson(projectStructuralObjectContent(result.value))).toBe(expectedBytes);
    expect(isIssuedStructuralObject(result.value)).toBe(true);
    expect(owner.resources.reservedBytes).toBe(0);
    expect(owner.resources.hashReservations).toBe(2);
    expect(owner.resources.peakEstimateBytes).toBeGreaterThan(owner.resources.residentBytes);
    expect(owner.resources.peakEstimateBytes-owner.resources.residentBytes).toBeLessThanOrEqual(96*1024*1024);
    ledger=owner.resources;
    expect(owner.resources.transferredResultEstimateBytes).toBeGreaterThan(0);
    expect(() => owner.advance(units)).toThrow("finished or disposed");
    owner.dispose();owner.dispose();
    expect(serializeStructuralObject(result.value)).toBe(before);
  }
  for (const units of [1,16,32,64]) {
    const broken=createStructuralReconstructionCursor({...raw,materials:[material(65_536)]});
    let first:unknown;
    try { drain(broken,units); } catch (error) { first=error; }
    expect(first).toMatchObject({code:"InvalidMaterial",path:"materials/0/materialId",message:"Structural material IDs must be Uint16 integers."});
    expect(() => broken.advance(units)).toThrow(first as Error);broken.dispose();
    try { broken.advance(units); } catch (error) { expect(error).toBe(first); }
  }
  const addressA={brickKey:left.key,local:{x:15,y:0,z:0}}, addressB={brickKey:right.key,local:{x:0,y:0,z:0}};
  const anchors=[{anchorId:"anchor.a",cell:addressA}], joints=[{jointId:"joint.a",jointClass:"weld",
    endpointA:{cell:addressA,role:"primary"},endpointB:{cell:addressB,role:"secondary"}}];
  const factContent={...expectedContent,anchors:[{anchorId:"anchor.a",cell:{brickKey:serializeAdaptiveKey(left.key),localIndex:15}}],
    joints:[{jointId:"joint.a",jointClass:"weld",endpointA:{cell:{brickKey:serializeAdaptiveKey(left.key),localIndex:15},role:"primary"},
      endpointB:{cell:{brickKey:serializeAdaptiveKey(right.key),localIndex:0},role:"secondary"}}]};
  const factHash=hashAdaptiveCanonical(factContent);
  const first={schemaVersion:"structural-microvoxel-command-evidence-v1",commandId:"command-z",commandHash:hash,status:"Applied",
    previousObjectRevision:0,resultingObjectRevision:1,previousEditRevision:0,resultingEditRevision:1,
    previousContentHash:expectedHash,resultingContentHash:factHash,changedBrickKeys:[left.key],selectedVoxelCount:1,changedVoxelCount:1,adaptiveJournalDigest:hash};
  const second={...first,commandId:"command-a",status:"NoChange",previousObjectRevision:1,resultingObjectRevision:2,
    previousEditRevision:1,resultingEditRevision:1,previousContentHash:factHash,changedBrickKeys:[],changedVoxelCount:0};
  const factInput={...input(source),anchors,joints,objectRevision:2,editRevision:1,commandEvidence:[first,second]};
  const evidenceHash=hashAdaptiveCanonical([{...first,changedBrickKeys:[serializeAdaptiveKey(left.key)]},second]);
  for (const units of [1,16,32,64]) {
    const cursor=createOwnedStructuralReconstructionCursor(source,factInput,262_144), result=drain(cursor,units).value;
    expect(result.contentHash).toBe(factHash);expect(result.evidenceHash).toBe(evidenceHash);
    expect(canonicalAdaptiveJson(projectStructuralObjectContent(result))).toBe(canonicalAdaptiveJson(factContent));
    expect(result.commandEvidence.map(receipt => receipt.commandId)).toEqual(["command-z","command-a"]);
    expect(cursor.resources.reservedBytes).toBe(0);cursor.dispose();
    const invalid=createOwnedStructuralReconstructionCursor(source,{...factInput,commandEvidence:[{...first,selectedVoxelCount:0},second]},262_144);
    let error:unknown;
    try { drain(invalid,units); } catch (thrown) { error=thrown; }
    expect(error).toMatchObject({code:"InvalidContract",path:"commandEvidence/0/changedVoxelCount",message:"Changed voxel count may not exceed selected voxel count."});
    try { invalid.advance(units); } catch (thrown) { expect(thrown).toBe(error); }
    expect(invalid.resources.reservedBytes).toBe(0);invalid.dispose();
  }
  const tagged=reconstructStructuralObjectInternal({...raw,materials:raw.materials.map(entry => entry.materialId===7 ? {...entry,tags:["tag.a","tag.z"]} : entry)});
  const taggedExpected={...expectedContent,materials:expectedContent.materials.map(entry => entry.materialId===7 ? {...entry,tags:["tag.a","tag.z"]} : entry)};
  for (const units of [1,16,32,64]) {
    const cursor=createOwnedStructuralReconstructionCursor(tagged,input(tagged),262_144), result=drain(cursor,units).value;
    expect(result.contentHash).toBe(hashAdaptiveCanonical(taggedExpected));
    expect(Object.isFrozen(result.materials[1]!.tags)).toBe(true);
    expect(cursor.resources.reservedBytes).toBe(0);cursor.dispose();
  }
  expect(() => createOwnedStructuralReconstructionCursor(Object.freeze({...source}),input(source),262_144)).toThrow("requires an issued source");
  // 4088-entry merge scratch is exactly 32768B too; only actual hash reservations count as hashes.
  const materialHeavy=reconstructStructuralObjectInternal({...raw,materials:Array.from({length:4088},(_,index) => material(index+1)),
    bricks:[{...left,cells:[left.cells[0]!]}]});
  const materialHeavyCursor=createOwnedStructuralReconstructionCursor(materialHeavy,input(materialHeavy),4*1024*1024);
  try {
    expect(drain(materialHeavyCursor,64).value.contentHash).toBe(materialHeavy.contentHash);
    expect(materialHeavyCursor.resources.hashReservations).toBe(2);
    expect(materialHeavyCursor.resources.reservedBytes).toBe(0);
  } finally { materialHeavyCursor.dispose(); }
  const seen:string[]=[], sentinel=new Error("prechange root frame sentinel");
  const observed=createStructuralReconstructionCursor(new Proxy(raw,{get(target,field,receiver){seen.push(String(field));if(field==="frame"){throw sentinel;}return Reflect.get(target,field,receiver);}}));
  expect(() => observed.advance(1)).toThrow(sentinel);expect(seen).toEqual(["frame"]);observed.dispose();
  // G1: inherited constructor failure on the receiver-filtered dense bricks copy precedes Species/callback/sort.
  const constructor=Object.getOwnPropertyDescriptor(Array.prototype,"constructor")!;
  const species=Object.getOwnPropertyDescriptor(Array,Symbol.species)!;
  const events:string[]=[], constructorError=new Error("prechange bricks constructor sentinel");
  try {
    Object.defineProperty(Array,Symbol.species,{configurable:true,get(){events.push("species");return Array;}});
    Object.defineProperty(Array.prototype,"constructor",{configurable:true,get(this:unknown[]){
      if (Array.isArray(this) && this.length===2 && this[0]===right && this[1]===left) { events.push("bricks constructor");throw constructorError; }
      return Array;
    }});
    let failure:unknown;
    try { reconstructStructuralObjectInternal(raw); } catch (error) { failure=error; }
    expect(failure).toBe(constructorError);expect(events.at(-1)).toBe("bricks constructor");
  } finally { Object.defineProperty(Array.prototype,"constructor",constructor);Object.defineProperty(Array,Symbol.species,species); }
  // G2: original root projection reads stop at sparse anchors, before joints.
  const reads:string[]=[], sparse=new Array(1);
  const projection=new Proxy({...source,anchors:sparse},{get(target,field,receiver){reads.push(String(field));return Reflect.get(target,field,receiver);}}) as StructuralObject;
  let projectionError:unknown;
  try { projectStructuralObjectContent(projection); } catch (error) { projectionError=error; }
  expect(projectionError).toMatchObject({code:"InvalidCanonicalValue",path:"object/anchors/0",message:"Sparse arrays are rejected."});
  expect(reads).toEqual(["schemaVersion","objectId","frame","source","source","materials","bricks","anchors"]);
  // Cancel / host throw at every observed boundary of one small literal issued source.
  const tiny=reconstructStructuralObjectInternal({...raw,bricks:[{...left,cells:[left.cells[0]!]}]});
  const probe=createOwnedStructuralReconstructionCursor(tiny,input(tiny),262_144), steps=drain(probe,1).advances;probe.dispose();
  const hostError=new Error("host yield sentinel");
  for (let boundary=0; boundary<steps; boundary+=1) {
    const cursor=createOwnedStructuralReconstructionCursor(tiny,input(tiny),262_144);
    try {
      for (let index=0; index<boundary; index+=1) {
        if (cursor.advance(1).done) { throw new Error("Cursor completed before the observed cancellation boundary"); }
      }
      throw hostError;
    } catch (error) { expect(error).toBe(hostError); }
    finally { cursor.dispose();cursor.dispose(); }
    expect(cursor.resources.reservedBytes).toBe(0);
    expect(cursor.resources.retainedEstimateBytes).toBe(0);
    expect(() => cursor.advance(1)).toThrow("finished or disposed");
    expect(isIssuedStructuralObject(tiny)).toBe(true);
    // Invalid unit budgets are failures too, including while an internal hash generator is open.
    const invalid=createOwnedStructuralReconstructionCursor(tiny,input(tiny),262_144);
    for (let index=0; index<boundary; index+=1) { invalid.advance(1); }
    let firstFailure:unknown;
    try { invalid.advance(0); } catch (error) { firstFailure=error; }
    expect(firstFailure).toMatchObject({code:"InvalidBudget",path:"cursor/maxUnits",message:"Explicit work budgets must be positive safe integers."});
    expect(invalid.resources.reservedBytes).toBe(0);
    expect(invalid.resources.retainedEstimateBytes).toBe(0);
    try { invalid.advance(1); } catch (error) { expect(error).toBe(firstFailure); }
    invalid.dispose();invalid.dispose();
    try { invalid.advance(1); } catch (error) { expect(error).toBe(firstFailure); }
  }
  expect(serializeStructuralObject(source)).toBe(before);
  const budget=createOwnedStructuralReconstructionCursor(source,input(source),256*1024*1024-16_384);
  expect(() => drain(budget,1)).toThrow("Prepare96MiB or CPU256MiB");expect(budget.resources.reservedBytes).toBe(0);budget.dispose();
  // The existing kernel's borrowed view proves actual backing allocation, not just a nominal constant.
  let backingBytes=0, emittedBytes=0, byteText="";
  const decoder=new TextDecoder();
  const hashProbe=createOwnedCanonicalHashCursor(projectStructuralObjectContent(source), bytes => {
    backingBytes=Math.max(backingBytes,bytes.buffer.byteLength);emittedBytes+=bytes.byteLength;
    byteText+=decoder.decode(bytes,{stream:true});
  });
  try {
    let result;
    do { result=hashProbe.advance(1); } while (result===undefined);
    expect(result.contentHash).toBe(expectedHash);expect(result.byteLength).toBe(emittedBytes);
  } finally { hashProbe.dispose(); }
  byteText+=decoder.decode();expect(byteText).toBe(expectedBytes);expect(backingBytes).toBe(4096);
  console.info("STRUCTURAL_CURSOR_RESOURCE_CHECK",JSON.stringify({units:[1,16,32,64],maximumAdvances,cancelBoundaries:steps,
    prepareCapBytes:96*1024*1024,cpuCapBytes:256*1024*1024,hashBackingBufferBytes:4096,pendingUtf16Bytes:2048,
    actualKernelBackingBytes:backingBytes,actualKernelContentBytes:emittedBytes,ledger,
    materialCounterCollision:{materialCount:4088,hashReservations:materialHeavyCursor.resources.hashReservations,
      peakEstimateBytes:materialHeavyCursor.resources.peakEstimateBytes,finalReservations:materialHeavyCursor.resources.reservedBytes},
    invalidBudgetFailureBoundaries:steps,finalReservations:budget.resources.reservedBytes,physicalHeap:"NOT_PROVEN",sourceUnchanged:true}));
});
