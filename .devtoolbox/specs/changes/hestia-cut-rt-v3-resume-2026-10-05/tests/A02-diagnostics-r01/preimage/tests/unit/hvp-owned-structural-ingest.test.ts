import {expect,it} from "vitest";
import * as adaptive from "../../src/voxel/adaptive";
import * as structural from "../../src/voxel/structural";
import {createStructuralObjectFromAdaptive,createStructuralOwnerLedger,isIssuedStructuralObject,ownedStructuralAdaptiveIngestSteps} from "../../src/voxel/structural/model";
import {projectStructuralObjectContent,serializeStructuralObject} from "../../src/voxel/structural/canonical";
import {structuralPositiveBudget,StructuralValidationError} from "../../src/voxel/structural/validation";
import type {StructuralAdaptiveIngestInput,StructuralObject} from "../../src/voxel/structural/types";

const {deepFreeze,canonicalAdaptiveJson,hashAdaptiveCanonical,serializeAdaptiveKey}=adaptive;
const material=(materialId:number)=>({materialId,densityKgPerCubicMeter:materialId===256?512:1024,
  structuralClass:"solid",destructible:true,tags:["tag.solid"]});
const frame=deepFreeze({schemaVersion:"structural-microvoxel-frame-binding-v1",bodyId:"body.child",surfaceFrameId:"frame.child",
  regionId:"region.child",generatorVersion:"generator.child",objectOriginQuantum:{x:0,y:0,z:0}});
const state=(materialId:number,semanticKey:string)=>({materialId,partId:null,semanticKey,damageKey:null});
const fixture=(occupancy=0)=>{
  const baseField=adaptive.createAdaptiveBaseFieldDescriptor({kind:"constant-v1",identity:adaptive.stableAuthorityId("base.child"),
    version:adaptive.stableAuthorityId("version.child"),sourceRevision:adaptive.authorityRevision(1),
    sample:{density:0,occupancy,materialId:occupancy===0?null:adaptive.stableAuthorityId("material.256")}});
  const editJournal=adaptive.createAdaptiveEditJournal(deepFreeze([-16,0].map((x,index)=>({editId:`edit.${index}`,sequence:index+1,
    expectedRegionRevision:index,resultRegionRevision:index+1,actorId:"actor.child",sourceId:"source.child",operation:"AddBox" as const,
    box:{min:{x,y:0,z:0},max:{x:x+16,y:1,z:1}},materialId:index===0?"material.256":"material.65535",semanticId:index===0?"left":"right"}))));
  const bricks=deepFreeze([0,-16].map(x=>adaptive.materializeAdaptiveBrick({key:adaptive.createAdaptiveBrickKey({bodyId:frame.bodyId,
    surfaceFrameId:frame.surfaceFrameId,regionId:frame.regionId,generatorVersion:frame.generatorVersion,level:4,originQuantum:{x,y:0,z:0}}),baseField,editJournal})));
  const resident=bricks.map(brick=>({key:brick.key,readiness:"ready" as const,byteSize:131072,work:4096,contentHash:brick.contentHash,
    provenanceHash:brick.provenance.provenanceHash,baseFieldDescriptorDigest:brick.baseFieldDescriptorDigest,journalDigest:brick.provenance.journalDigest,
    sourceRevision:brick.sourceRevision,editRevision:brick.editRevision,brickRevision:adaptive.authorityRevision(2)}));
  const draft=deepFreeze({schemaVersion:"adaptive-microvoxel-planner-snapshot-v1",bodyId:frame.bodyId,surfaceFrameId:frame.surfaceFrameId,
    regionId:frame.regionId,generatorVersion:frame.generatorVersion,authority:{schemaVersion:"adaptive-microvoxel-planner-authority-v1",
      baseField,editJournal,brickRevision:2},planningEpoch:3,resident,activeCoverage:[],refinementRequests:[],
    budgets:{maxBricks:16,maxBytes:16*1024*1024,maxWork:65536,maxCoverageQuantum:65536}}) as unknown as adaptive.AdaptivePlannerSnapshot;
  const proofs=adaptive.createAdaptiveResidentValidationProofs({bricks,brickRevision:2,snapshot:draft});
  const snapshot=deepFreeze({...draft,resident:resident.map((entry,index)=>({...entry,validationProof:proofs[index]!}))});
  const left=bricks[1]!.key,right=bricks[0]!.key;
  const anchor={anchorId:"anchor.left",cell:{brickKey:left,local:{x:0,y:0,z:0}}};
  const joint={jointId:"joint.seam",jointClass:"weld",endpointA:{cell:{brickKey:left,local:{x:15,y:0,z:0}},role:"primary"},
    endpointB:{cell:{brickKey:right,local:{x:0,y:0,z:0}},role:"secondary"}};
  const input=deepFreeze({objectId:"object.child",frame,authority:{baseField,editJournal},snapshot,materials:[material(65535),material(256)],
    materialBindings:[{adaptiveMaterialId:"material.65535",structuralMaterialId:65535},{adaptiveMaterialId:"material.256",structuralMaterialId:256}],
    bricks,anchors:[anchor],joints:[joint],objectRevision:0,editRevision:0,commandEvidence:[]}) as unknown as StructuralAdaptiveIngestInput;
  // Literal PRECHANGE model/canonical schema and order; none of these fields comes from a new
  // Structural issuer output. The unchanged accepted Adaptive kernel only supplies real fixtures.
  const projection={schemaVersion:adaptive.ADAPTIVE_SNAPSHOT_PROJECTION_SCHEMA_VERSION,authority:{
    schemaVersion:"adaptive-microvoxel-planner-authority-v1",bodyId:frame.bodyId,surfaceFrameId:frame.surfaceFrameId,
    regionId:frame.regionId,generatorVersion:frame.generatorVersion,baseField,
    baseFieldDescriptorDigest:hashAdaptiveCanonical({schemaVersion:adaptive.ADAPTIVE_BASE_FIELD_DESCRIPTOR_DIGEST_SCHEMA_VERSION,descriptor:baseField}),
    editJournal,journalDigest:editJournal.digest,sourceRevision:1,editRevision:2,brickRevision:2,planningEpoch:3},
    resident:[resident[1],resident[0]],activeCoverage:[],refinementRequests:[],budgets:draft.budgets};
  const snapshotProjectionDigest=hashAdaptiveCanonical(projection);
  const literalProofs=bricks.map(brick=>{const payload={schemaVersion:adaptive.ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION,
    proofVersion:adaptive.ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION,key:brick.key,contentHash:brick.contentHash,
    provenanceHash:brick.provenance.provenanceHash,baseFieldDescriptorDigest:brick.baseFieldDescriptorDigest,journalDigest:editJournal.digest,
    sourceRevision:1,editRevision:2,brickRevision:2,planningEpoch:3,snapshotProjectionDigest};return {...payload,proofDigest:hashAdaptiveCanonical(payload)};});
  const source={schemaVersion:"structural-microvoxel-source-binding-v1",baseFieldIdentity:baseField.identity,baseFieldVersion:baseField.version,
    baseFieldDescriptorDigest:projection.authority.baseFieldDescriptorDigest,journalDigest:editJournal.digest,snapshotProjectionDigest,
    proofDigests:literalProofs.map(proof=>proof.proofDigest).sort(),sourceRevision:1,editRevision:2,brickRevision:2,planningEpoch:3};
  const content={schemaVersion:"structural-microvoxel-object-v1",objectId:input.objectId,frame,source,
    materials:[material(256),material(65535)],bricks:[left,right].map((key,index)=>({schemaVersion:"structural-microvoxel-brick-v1",
      key:serializeAdaptiveKey(key),cells:Array.from({length:16},(_,localIndex)=>({localIndex,state:state(index===0?256:65535,index===0?"left":"right")}))})),
    anchors:[{anchorId:anchor.anchorId,cell:{brickKey:serializeAdaptiveKey(left),localIndex:0}}],joints:[{jointId:joint.jointId,jointClass:joint.jointClass,
      endpointA:{cell:{brickKey:serializeAdaptiveKey(left),localIndex:15},role:"primary"},endpointB:{cell:{brickKey:serializeAdaptiveKey(right),localIndex:0},role:"secondary"}}]};
  const expected={...content,objectRevision:0,editRevision:0,contentHash:hashAdaptiveCanonical(content),commandEvidence:[],evidenceHash:hashAdaptiveCanonical([])};
  return {input,snapshot,bricks,proofs,literalProofs,content,expected};
};
const own=(input:StructuralAdaptiveIngestInput,limit=96*1024*1024)=>{
  const ledger=createStructuralOwnerLedger(8*1024*1024,limit);ledger.reserve(16384);
  const steps=ownedStructuralAdaptiveIngestSteps(input,ledger.reserve);let state:"open"|"done"|"failed"|"disposed"="open",first:unknown,units=0;
  const close=()=>{try{steps.return(undefined as never);}catch{/* no cleanup replaces the first failure */}};
  return {advance(value:number){if(state==="failed"){throw first;}if(state!=="open"){throw new Error("Once-only Structural ingest result");}
    try{const budget=structuralPositiveBudget(value,"cursor/maxUnits");for(let index=0;index<budget;index+=1){units+=1;const step=steps.next();
      if(step.done){state="done";close();ledger.release(true);return {done:true as const,value:step.value};}}return {done:false as const};
    }catch(error){state="failed";first=error;close();ledger.release();throw error;}},dispose(){if(state!=="failed"){state="disposed";}close();ledger.release();},
    get units(){return units;},get resources(){return ledger.resources;}};
};
const finish=(cursor:ReturnType<typeof own>,budget:number)=>{let maxAdvance=0;
  for(;;){const before=cursor.units,step=cursor.advance(budget);maxAdvance=Math.max(maxAdvance,cursor.units-before);
    if(maxAdvance>budget){throw new Error("Unit cap exceeded");}if(step.done){return {value:step.value,maxAdvance};}}
};
const failureOf=(run:()=>unknown)=>{try{run();}catch(error){return error;}throw new Error("Expected Structural failure");};

it("shares complete preimage-bound Adaptive-to-Structural issuance, generic observations and borrowed lifetime without World authority",()=>{
  expect(structural.createStructuralObjectFromAdaptive).toBe(createStructuralObjectFromAdaptive);
  for(const key of ["ownedStructuralAdaptiveIngestSteps","structuralAdaptiveIngestSteps","structuralMaterialTableSteps","reconstructStructuralObjectInternal"]){expect(structural).not.toHaveProperty(key);}
  const f=fixture(),before=canonicalAdaptiveJson(f.input),expected=canonicalAdaptiveJson(f.expected),records:unknown[]=[];
  expect(canonicalAdaptiveJson(f.proofs)).toBe(canonicalAdaptiveJson(f.literalProofs));
  const generic=createStructuralObjectFromAdaptive(f.input);expect(serializeStructuralObject(generic)).toBe(expected);
  let whole=0,result:StructuralObject|undefined;
  for(const budget of [1,7,16,32,64,257]){
    const cursor=own(f.input),done=finish(cursor,budget);whole=cursor.units;result=done.value;
    expect(serializeStructuralObject(done.value)).toBe(expected);expect(canonicalAdaptiveJson(projectStructuralObjectContent(done.value))).toBe(canonicalAdaptiveJson(f.content));
    expect(isIssuedStructuralObject(done.value)).toBe(true);expect(isIssuedStructuralObject(deepFreeze({...done.value}))).toBe(false);
    expect(adaptive.isDeepFrozen(done.value)).toBe(true);expect(done.value.bricks.map(brick=>brick.key.originQuantum.x)).toEqual([-16,0]);
    expect(done.value.bricks.map(brick=>brick.cells.length)).toEqual([16,16]);expect(done.value.source.proofDigests).toEqual(f.expected.source.proofDigests);
    expect(cursor.resources.reservedBytes).toBe(0);expect(cursor.resources.retainedEstimateBytes).toBe(0);expect(cursor.resources.hashReservations).toBeGreaterThan(2);
    expect(()=>cursor.advance(1)).toThrow("Once-only");cursor.dispose();cursor.dispose();expect(isIssuedStructuralObject(done.value)).toBe(true);
    expect(serializeStructuralObject(done.value)).toBe(expected);records.push({budget,units:cursor.units,maxAdvance:done.maxAdvance,resources:cursor.resources});
  }
  expect(result).toBeDefined();const mass=structural.deriveStructuralObjectMassProperties(result!,{maxVisitedCells:32768});
  expect(mass.totalMassKg).toBe(48);expect(mass.centerOfMassMeters!.x).toBeCloseTo(1/3,14);expect(mass.centerOfMassMeters!.y).toBe(0.0625);expect(mass.centerOfMassMeters!.z).toBe(0.0625);
  const reversed=deepFreeze({...f.input,bricks:[...f.input.bricks].reverse()});expect(serializeStructuralObject(finish(own(reversed),7).value)).toBe(expected);
  const sentinel=new Error("generic root sentinel"),reads:string[]=[],observed=new Proxy(f.input,{get(target,key,receiver){reads.push(String(key));return Reflect.get(target,key,receiver);}});
  expect(serializeStructuralObject(createStructuralObjectFromAdaptive(observed))).toBe(expected);
  expect(reads).toEqual(["frame","authority","snapshot","materials","materialBindings","bricks","objectId","anchors","joints","objectRevision","editRevision","commandEvidence"]);
  const constructor=Object.getOwnPropertyDescriptor(Array.prototype,"constructor")!,events:string[]=[];let caught:unknown;
  try{Object.defineProperty(Array.prototype,"constructor",{configurable:true,get(){events.push("constructor");return {get [Symbol.species](){events.push("Species");throw sentinel;}};}});
    try{createStructuralObjectFromAdaptive(f.input);}catch(error){caught=error;}
  }finally{Object.defineProperty(Array.prototype,"constructor",constructor);}expect(caught).toBe(sentinel);expect(events).toEqual(["constructor","Species"]);
  const negatives:readonly unknown[]=[
    {...f.input,frame:{...frame,regionId:"region.foreign"}},
    {...f.input,authority:{...f.input.authority,baseField:{...f.input.authority.baseField,identity:"base.foreign"}}},
    {...f.input,authority:{...f.input.authority,editJournal:{...f.input.authority.editJournal,digest:"fnv1a64-v1:0000000000000000"}}},
    {...f.input,snapshot:{...f.snapshot,planningEpoch:4}},
    {...f.input,snapshot:{...f.snapshot,resident:f.snapshot.resident.map(({validationProof:ignored,...entry})=>{void ignored;return entry;})}},
    {...f.input,snapshot:{...f.snapshot,resident:f.snapshot.resident.map(entry=>({...entry,validationProof:{...entry.validationProof!}}))}},
    {...f.input,snapshot:{...f.snapshot,resident:f.snapshot.resident.map(entry=>({...entry,brickRevision:3}))}},
    {...f.input,materialBindings:[]},
    {...f.input,materialBindings:[{adaptiveMaterialId:"material.256",structuralMaterialId:0}]},
    {...f.input,materialBindings:[{adaptiveMaterialId:"material.256",structuralMaterialId:65536}]},
    {...f.input,materialBindings:[...f.input.materialBindings,f.input.materialBindings[0]]},
    {...f.input,materials:[material(65535),material(65535)]},
    {...f.input,bricks:[f.input.bricks[0],f.input.bricks[0]]},
    {...f.input,bricks:[{...f.bricks[0]!,density:[NaN,...f.bricks[0]!.density.slice(1)]},f.bricks[1]]},
    {...f.input,anchors:[{anchorId:"absent",cell:{brickKey:{...f.bricks[0]!.key,originQuantum:{x:32,y:0,z:0}},local:{x:0,y:0,z:0}}}]},
    {...f.input,objectRevision:1},
    fixture(0.5).input
  ];
  for(const raw of negatives){const value=deepFreeze(raw) as StructuralAdaptiveIngestInput,original=failureOf(()=>createStructuralObjectFromAdaptive(value));
    expect(original).toBeInstanceOf(StructuralValidationError);const cursor=own(value),actual=failureOf(()=>finish(cursor,257));
    expect(actual).toBeInstanceOf(StructuralValidationError);expect(actual).toMatchObject({code:(original as StructuralValidationError).code,
      path:(original as StructuralValidationError).path,message:(original as Error).message});expect(cursor.resources.reservedBytes).toBe(0);
    cursor.dispose();expect(failureOf(()=>cursor.advance(1))).toBe(actual);}
  for(const [field,cap] of [["materials",4096],["materialBindings",4096],["bricks",4096],["anchors",4096],["joints",4096],["commandEvidence",4096]] as const){
    const value={...f.input,[field]:new Array(cap+1)} as StructuralAdaptiveIngestInput,original=failureOf(()=>createStructuralObjectFromAdaptive(value));
    const cursor=own(value);expect(failureOf(()=>finish(cursor,257))).toMatchObject({path:(original as StructuralValidationError).path});expect(cursor.resources.reservedBytes).toBe(0);
  }
  const tight=own(f.input,20_000),budgetFailure=failureOf(()=>finish(tight,1));expect(budgetFailure).toMatchObject({path:"cursor/prepareBytes"});
  tight.dispose();expect(tight.resources.reservedBytes).toBe(0);expect(failureOf(()=>tight.advance(1))).toBe(budgetFailure);
  const boundaries=[0,1,64,Math.floor(whole/3),Math.floor(whole/2),whole-1];
  for(const boundary of boundaries){
    const cancel=own(f.input);if(boundary>0){expect(cancel.advance(boundary).done).toBe(false);}cancel.dispose();cancel.dispose();expect(cancel.resources.reservedBytes).toBe(0);
    const host=own(f.input);try{if(boundary>0){host.advance(boundary);}throw sentinel;}catch(error){expect(error).toBe(sentinel);}finally{host.dispose();}expect(host.resources.reservedBytes).toBe(0);
    const invalid=own(f.input);if(boundary>0){invalid.advance(boundary);}const first=failureOf(()=>invalid.advance(0));invalid.dispose();expect(failureOf(()=>invalid.advance(1))).toBe(first);expect(invalid.resources.reservedBytes).toBe(0);
  }
  expect(serializeStructuralObject(finish(own(f.input),257).value)).toBe(expected);
  const parent=createStructuralOwnerLedger(8*1024*1024);parent.reserve(4096);const steps=ownedStructuralAdaptiveIngestSteps(f.input,parent.reserve);
  let borrowed:StructuralObject|undefined;try{for(;;){const step=steps.next();if(step.done){borrowed=step.value;break;}}}finally{steps.return(undefined as never);}
  expect(parent.resources.reservedBytes).toBeGreaterThan(4096);expect(serializeStructuralObject(borrowed!)).toBe(expected);parent.release();expect(parent.resources.reservedBytes).toBe(0);
  expect(canonicalAdaptiveJson(f.input)).toBe(before);expect(isIssuedStructuralObject(generic)).toBe(true);
  console.info("OWNED_STRUCTURAL_INGEST_EVIDENCE",JSON.stringify({cases:records,units:whole,cellCount:32,channelValues:32768,
    completeLiteralBytes:Buffer.byteLength(expected),contentHash:f.expected.contentHash,evidenceHash:f.expected.evidenceHash,
    cancelBoundaries:boundaries.length,hostFinallyBoundaries:boundaries.length,invalidBudgetBoundaries:boundaries.length,
    finalReservations:0,genuineResidentProofs:true,genuineStructuralObject:true,worldAuthority:false,activation:"OFF",
    independentReview:"NOT_RUN",physicalHeap:"NOT_PROVEN",whole8ms:"NOT_PROVEN"}));
});
