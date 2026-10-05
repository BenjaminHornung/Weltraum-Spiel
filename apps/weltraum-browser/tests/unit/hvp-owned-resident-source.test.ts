import {expect,it} from "vitest";
import * as root from "../../src/voxel/adaptive";
import * as canonical from "../../src/voxel/adaptive/canonical";
import * as residency from "../../src/voxel/adaptive/residency";
import * as validation from "../../src/voxel/adaptive/validation";
import * as edits from "../../src/voxel/adaptive/edits";
import * as materialization from "../../src/voxel/adaptive/materialization";
import {createOwnedCanonicalHashCursor,OWNED_RECORD_MAX_KEYS} from "../../src/voxel/adaptive/ownedCanonicalHashSteps";
import {createStructuralOwnerLedger,isIssuedStructuralObject,createStructuralObjectFromAdaptive} from "../../src/voxel/structural/model";
import {structuralPositiveBudget} from "../../src/voxel/structural/validation";
import type {AdaptiveOwnedJournalOptions} from "../../src/voxel/adaptive/edits";
import type {AdaptiveAuthorityRetention,AdaptiveResidencyRelease} from "../../src/voxel/adaptive";

const {deepFreeze,canonicalAdaptiveJson,hashAdaptiveCanonical}=root;
const resident=32*1024*1024; // Retained fixture inputs/old/new/oracles/results; logical, not heap/GC proof.
const projectionVector='{"activeCoverage":[],"authority":{"baseField":{"identity":"b","kind":"constant-v1","sample":{"density":0,"materialId":"m","occupancy":1,"semanticId":null},"sourceRevision":0,"version":"v"},"baseFieldDescriptorDigest":"fnv1a64-v1:81e095fb999e1a7d","bodyId":"p","brickRevision":0,"editJournal":{"digest":"fnv1a64-v1:4144927f889a3178","initialRegionRevision":0,"records":[],"revision":0,"schemaVersion":"adaptive-microvoxel-journal-v1"},"editRevision":0,"generatorVersion":"g","journalDigest":"fnv1a64-v1:4144927f889a3178","planningEpoch":0,"regionId":"r","schemaVersion":"adaptive-microvoxel-planner-authority-v1","sourceRevision":0,"surfaceFrameId":"f"},"budgets":{"maxBricks":0,"maxBytes":0,"maxCoverageQuantum":0,"maxWork":0},"refinementRequests":[],"resident":[{"baseFieldDescriptorDigest":"fnv1a64-v1:81e095fb999e1a7d","brickRevision":0,"byteSize":131072,"contentHash":"fnv1a64-v1:9f29dfdc70de51ff","editRevision":0,"journalDigest":"fnv1a64-v1:4144927f889a3178","key":{"bodyId":"p","generatorVersion":"g","level":0,"originQuantum":{"x":0,"y":0,"z":0},"regionId":"r","schemaVersion":"adaptive-microvoxel-key-v1","surfaceFrameId":"f"},"provenanceHash":"fnv1a64-v1:f1d62e52a9041bae","readiness":"ready","sourceRevision":0,"work":4096}],"schemaVersion":"adaptive-microvoxel-snapshot-projection-v1"}';
const proofVector='{"baseFieldDescriptorDigest":"fnv1a64-v1:81e095fb999e1a7d","brickRevision":0,"contentHash":"fnv1a64-v1:9f29dfdc70de51ff","editRevision":0,"journalDigest":"fnv1a64-v1:4144927f889a3178","key":{"bodyId":"p","generatorVersion":"g","level":0,"originQuantum":{"x":0,"y":0,"z":0},"regionId":"r","schemaVersion":"adaptive-microvoxel-key-v1","surfaceFrameId":"f"},"planningEpoch":0,"proofDigest":"fnv1a64-v1:db81963893ef243d","proofVersion":"adaptive-microvoxel-resident-validation-proof-issuer-v1","provenanceHash":"fnv1a64-v1:f1d62e52a9041bae","schemaVersion":"adaptive-microvoxel-resident-validation-proof-v1","snapshotProjectionDigest":"fnv1a64-v1:65c99718f9e33b8b","sourceRevision":0}';
const base=deepFreeze({kind:"constant-v1",identity:"base.child",version:"hvp-rigid-ingest-v1",sourceRevision:1,
  sample:{density:0.1,occupancy:0.3,materialId:"hvp.material.256",semanticId:"semantic.base"}}) as root.AdaptiveBaseFieldDescriptor;
const editInputs:readonly root.AdaptiveEditInput[]=deepFreeze([
  {editId:"child.edit.1",sequence:1,expectedRegionRevision:0,resultRegionRevision:1,actorId:"actor.child",sourceId:"source.child",
    operation:"AddBox",box:{min:{x:-16,y:0,z:0},max:{x:-15,y:1,z:1}},materialId:"hvp.material.65535",semanticId:"semantic.child"},
  {editId:"child.edit.2",sequence:2,expectedRegionRevision:1,resultRegionRevision:2,actorId:"actor.child",sourceId:"source.child",
    operation:"SubtractBox",box:{min:{x:0,y:0,z:0},max:{x:1,y:1,z:1}}}
]);
const journal=root.createAdaptiveEditJournal(editInputs);
const keyAt=(x:number)=>deepFreeze({schemaVersion:root.ADAPTIVE_KEY_SCHEMA_VERSION,bodyId:"body.hestia",surfaceFrameId:"frame.hvp",
  regionId:"region.child",generatorVersion:"hvp-rigid-ingest-v1",level:4,originQuantum:{x,y:0,z:0}}) as root.AdaptiveBrickKey;
// Handwritten full channels + retained materialization185-224/330-370 envelopes, NEVER new outputs.
const literalBrick=(key:root.AdaptiveBrickKey,descriptor:root.AdaptiveBaseFieldDescriptor,j:root.AdaptiveEditJournal,
  density:readonly number[],occupancy:readonly number[],material:readonly (string|null)[],semantic:readonly (string|null)[]):root.MaterializedAdaptiveBrick=>{
  const baseFieldDescriptorDigest=hashAdaptiveCanonical({schemaVersion:root.ADAPTIVE_BASE_FIELD_DESCRIPTOR_DIGEST_SCHEMA_VERSION,descriptor});
  const metadata={baseFieldIdentity:descriptor.identity,baseFieldVersion:descriptor.version,baseFieldDescriptorDigest,
    sourceRevision:descriptor.sourceRevision,editRevision:j.revision,journalDigest:j.digest};
  const authorityInputDigest=hashAdaptiveCanonical({schemaVersion:"adaptive-microvoxel-authority-input-v1",brickSchemaVersion:root.ADAPTIVE_BRICK_SCHEMA_VERSION,
    materializationVersion:root.ADAPTIVE_MATERIALIZATION_VERSION,key,...metadata});
  const size=2**(4-key.level),channels={density,occupancy,material,semantic};
  const contentHash=hashAdaptiveCanonical({schemaVersion:"adaptive-microvoxel-content-hash-input-v1",authorityInputDigest,
    cellSizeQuantum:size,cellSizeMeters:0.125*size,cellCount:4096,...channels});
  const parent=key.level===0?null:{...key,level:3,originQuantum:{x:key.originQuantum.x===0?0:-32,y:0,z:0}};
  const parentProvenanceHash=parent===null?null:hashAdaptiveCanonical({schemaVersion:"adaptive-microvoxel-parent-provenance-v1",
    brickSchemaVersion:root.ADAPTIVE_BRICK_SCHEMA_VERSION,materializationVersion:root.ADAPTIVE_MATERIALIZATION_VERSION,key:parent,...metadata});
  const provenance={schemaVersion:"adaptive-microvoxel-provenance-v1",...metadata,hierarchyKeyHash:hashAdaptiveCanonical(key),
    materializationVersion:root.ADAPTIVE_MATERIALIZATION_VERSION,parentProvenanceHash};
  return deepFreeze({schemaVersion:root.ADAPTIVE_BRICK_SCHEMA_VERSION,materializationVersion:root.ADAPTIVE_MATERIALIZATION_VERSION,key,
    cellSizeQuantum:size,cellSizeMeters:0.125*size,cellCount:4096,...channels,baseFieldDescriptorDigest,sourceRevision:metadata.sourceRevision,
    editRevision:metadata.editRevision,originQuantum:key.originQuantum,level:key.level,contentHash,
    provenance:{...provenance,provenanceHash:hashAdaptiveCanonical(provenance)}}) as root.MaterializedAdaptiveBrick;
};
const brickAt=(x:number,j=journal)=>{
  const density=new Array<number>(4096).fill(0.1),occupancy=new Array<number>(4096).fill(0.3);
  const material=new Array<string|null>(4096).fill("hvp.material.256"),semantic=new Array<string|null>(4096).fill("semantic.base");
  density[0]=x<0?-1:1;occupancy[0]=x<0?1:0;
  if(x<0){material[0]="hvp.material.65535";semantic[0]="semantic.child";}
  return literalBrick(keyAt(x),base,j,density,occupancy,material,semantic);
};
const bricks=deepFreeze([brickAt(0),brickAt(-16)]);
const residentOf=(brick:root.MaterializedAdaptiveBrick,revision=2)=>({key:brick.key,readiness:"ready" as const,byteSize:131072,work:4096,
  contentHash:brick.contentHash,provenanceHash:brick.provenance.provenanceHash,baseFieldDescriptorDigest:brick.baseFieldDescriptorDigest,
  journalDigest:brick.provenance.journalDigest,sourceRevision:brick.sourceRevision,editRevision:brick.editRevision,brickRevision:root.authorityRevision(revision)});
const requests=deepFreeze([
  {requestId:"request.sphere",region:{kind:"sphere",center:{x:-16,y:0,z:0},radiusQuantum:16},targetLevel:4,reason:"Inspection",requiredForCoverage:false,priority:0.1},
  {requestId:"request.aabb",region:{kind:"aabb",bounds:{min:{x:-16,y:0,z:0},max:{x:0,y:16,z:16}}},targetLevel:4,
    reason:"CollisionRequired",requiredForCoverage:true,deadlinePlanningEpoch:4,priority:0.2}
]) as unknown as readonly root.AdaptiveRefinementRequest[];
const snapshotOf=(values:readonly root.MaterializedAdaptiveBrick[]=bricks,j=journal)=>deepFreeze({schemaVersion:"adaptive-microvoxel-planner-snapshot-v1",
  bodyId:"body.hestia",surfaceFrameId:"frame.hvp",regionId:"region.child",generatorVersion:"hvp-rigid-ingest-v1",
  authority:{schemaVersion:"adaptive-microvoxel-planner-authority-v1",baseField:base,editJournal:j,brickRevision:2},planningEpoch:3,
  resident:values.map(brick=>residentOf(brick)),activeCoverage:values.map(brick=>({key:brick.key,kind:"selected",
    bounds:{min:brick.originQuantum,max:{x:brick.originQuantum.x+16,y:16,z:16}}})),refinementRequests:requests,
  budgets:{maxBricks:128,maxBytes:16*1024*1024,maxWork:524288,maxCoverageQuantum:524288}}) as unknown as root.AdaptivePlannerSnapshot;
const snapshot=snapshotOf(),authority=deepFreeze({baseField:base,editJournal:journal});
const sortLiteral=(values:readonly unknown[])=>[...values].sort((a,b)=>canonicalAdaptiveJson(a)<canonicalAdaptiveJson(b)?-1:canonicalAdaptiveJson(a)>canonicalAdaptiveJson(b)?1:0);
const literalProjection=(value:root.AdaptivePlannerSnapshot)=>deepFreeze({schemaVersion:root.ADAPTIVE_SNAPSHOT_PROJECTION_SCHEMA_VERSION,
  authority:{schemaVersion:"adaptive-microvoxel-planner-authority-v1",bodyId:value.bodyId,surfaceFrameId:value.surfaceFrameId,regionId:value.regionId,
    generatorVersion:value.generatorVersion,baseField:value.authority.baseField,baseFieldDescriptorDigest:hashAdaptiveCanonical({
      schemaVersion:root.ADAPTIVE_BASE_FIELD_DESCRIPTOR_DIGEST_SCHEMA_VERSION,descriptor:value.authority.baseField}),editJournal:value.authority.editJournal,
    journalDigest:value.authority.editJournal.digest,sourceRevision:value.authority.baseField.sourceRevision,editRevision:value.authority.editJournal.revision,
    brickRevision:value.authority.brickRevision,planningEpoch:value.planningEpoch},resident:[...value.resident].sort((a,b)=>a.key.originQuantum.x-b.key.originQuantum.x)
    .map(({validationProof:ignored,...entry})=>{void ignored;return entry;}),activeCoverage:sortLiteral(value.activeCoverage),
  refinementRequests:sortLiteral(value.refinementRequests),budgets:value.budgets});
const expectedProjection=literalProjection(snapshot),projectionDigest=hashAdaptiveCanonical(expectedProjection);
const literalProof=(brick:root.MaterializedAdaptiveBrick,digest=projectionDigest,revision=2,epoch=3)=>{
  const payload={schemaVersion:root.ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION,proofVersion:root.ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION,
    key:brick.key,contentHash:brick.contentHash,provenanceHash:brick.provenance.provenanceHash,baseFieldDescriptorDigest:brick.baseFieldDescriptorDigest,
    journalDigest:brick.provenance.journalDigest,sourceRevision:brick.sourceRevision,editRevision:brick.editRevision,
    brickRevision:revision,planningEpoch:epoch,snapshotProjectionDigest:digest};
  return deepFreeze({...payload,proofDigest:hashAdaptiveCanonical(payload)});
};
const expectedProofs=bricks.map(brick=>literalProof(brick));
const failureOf=(run:()=>unknown)=>{try{run();}catch(error){return error;}throw new Error("Expected literal failure");};
const job=<T>(run:(options:AdaptiveOwnedJournalOptions)=>Generator<void,T,void>,limit=96*1024*1024)=>{
  const ledger=createStructuralOwnerLedger(resident,limit);ledger.reserve(16_384);
  let started=0,closed=0,maxKeys=0,units=0,state:"open"|"done"|"failed"|"disposed"="open",failure:unknown;
  const options:AdaptiveOwnedJournalOptions=Object.freeze({reserve:ledger.reserve,hash:function*(payload:unknown):Generator<void,string,void>{
    ledger.reserve(32_768,false,"hash");started+=1;maxKeys=Math.max(maxKeys,Object.keys(payload as object).length);
    if(maxKeys>16){throw new Error("Never hash the17-field brick");}const cursor=createOwnedCanonicalHashCursor(payload);
    try{for(;;){const step=cursor.advance(1);if(step!==undefined){return step.contentHash;}yield;}}finally{cursor.dispose();closed+=1;}
  }});
  const steps=run(options),close=()=>{try{steps.return(undefined as never);}catch{/* first failure wins */}ledger.release(state==="done");};
  return {advance(value:number){if(state==="failed"){throw failure;}if(state!=="open"){throw new Error("Once-only resident job");}
    try{const budget=structuralPositiveBudget(value,"cursor/maxUnits");for(let index=0;index<budget;index+=1){units+=1;const step=steps.next();
      if(step.done){state="done";close();return {done:true as const,value:step.value};}}return {done:false as const};
    }catch(error){state="failed";failure=error;close();throw error;}},dispose(){if(state!=="failed"){state="disposed";}close();},
    get units(){return units;},get resources(){return ledger.resources;},get hashes(){return {started,closed,maxKeys};}};
};
const finish=<T>(cursor:ReturnType<typeof job<T>>,budget:number)=>{
  let maxAdvance=0,previous=cursor.resources.reservedBytes;
  for(;;){const before=cursor.units,step=cursor.advance(budget);maxAdvance=Math.max(maxAdvance,cursor.units-before);
    if(maxAdvance>budget||(!step.done&&cursor.resources.reservedBytes<previous)){throw new Error("Work/aggregate bound");}
    previous=cursor.resources.reservedBytes;if(step.done){return {value:step.value,maxAdvance};}}
};
const attached=(value:root.AdaptivePlannerSnapshot,proofs:readonly root.AdaptiveResidentValidationProof[])=>deepFreeze({...value,
  resident:value.resident.map(entry=>({...entry,validationProof:proofs.find(proof=>canonicalAdaptiveJson(proof.key)===canonicalAdaptiveJson(entry.key))!}))});
function* recipe(options:AdaptiveOwnedJournalOptions){
  options.reserve(32_768,true);
  const retention=yield* residency.adaptiveAuthorityRetentionSteps(authority,options);
  yield* residency.adaptiveValidateAuthorityRetentionSteps(retention,options);
  const proofs=yield* canonical.adaptiveResidentValidationProofsSteps({bricks,brickRevision:2,snapshot},options);
  const bound=attached(snapshot,proofs); // Exactly TWO summaries; immutable fixture-only producer.
  const semantics=yield* canonical.adaptivePlannerSnapshotSemanticsSteps(bound,{},options);
  return Object.freeze({retention,proofs,projection:semantics.projection,digest:semantics.snapshotProjectionDigest});
}

it("keeps independent complete resident/source bytes and real proof brands within one inactive borrowed lifetime",()=>{
  const aliases:[AdaptiveAuthorityRetention|null,AdaptiveResidencyRelease|null]=[null,null];expect(aliases).toHaveLength(2);
  for(const name of ["createAdaptiveAuthorityRetention","releaseAdaptiveResidency"] as const){expect(root[name]).toBe(residency[name]);}
  for(const name of ["ADAPTIVE_MAX_RESIDENT_SUMMARIES","ADAPTIVE_MAX_ACTIVE_COVERAGE_ENTRIES","ADAPTIVE_MAX_REFINEMENT_REQUESTS",
    "ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES","ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES","canonicalAdaptiveJson","hashAdaptiveCanonical",
    "validateAdaptiveBaseFieldDescriptor","createAdaptiveBaseFieldDescriptor","evaluateAdaptiveBaseFieldDescriptor","hashAdaptiveBaseFieldDescriptor",
    "serializeAdaptiveKey","serializeAdaptiveEditJournal","serializeMaterializedAdaptiveBrick","createAdaptivePlannerSnapshotProjection",
    "hashAdaptivePlannerSnapshotProjection","validateAdaptivePlannerSnapshotSemantics","createAdaptiveResidentValidationProof",
    "createAdaptiveResidentValidationProofs","hasAdaptiveResidentValidationProofBrand","validateAdaptivePlanResult","serializeAdaptivePlan"] as const){expect(root[name]).toBe(canonical[name]);}
  for(const name of ["AdaptiveAuthorityError","fail","adaptiveLevel","adaptiveRefinementLevel","globalQuantumCoordinate","authorityRevision",
    "adaptiveBrickRevision","adaptivePlanningEpoch","adaptiveEditRevision","editSequence","requireCanonicalString","compareCanonicalCodeUnits",
    "requireDenseDataPropertyArray","stableAuthorityId","adaptiveRegionId","adaptiveEditId","requireFinite","requirePlainRecord","requireExactKeys",
    "deepFreeze","isDeepFrozen"] as const){expect(root[name]).toBe(validation[name]);}
  for(const name of ["ADAPTIVE_MAX_JOURNAL_RECORDS","createAdaptiveEdit","createAdaptiveEditJournal","appendAdaptiveEdit","validateAdaptiveEditJournal"] as const){expect(root[name]).toBe(edits[name]);}
  for(const name of ["materializeAdaptiveBrick","validateMaterializedAdaptiveBrick"] as const){expect(root[name]).toBe(materialization[name]);}
  expect(root.createAdaptiveBaseFieldDescriptor).toBe(root.validateAdaptiveBaseFieldDescriptor);
  for(const name of ["adaptiveAuthorityRetentionSteps","adaptiveValidateAuthorityRetentionSteps","adaptiveIsDeepFrozenSteps",
    "adaptivePlannerSnapshotProjectionSteps","adaptivePlannerSnapshotHashSteps","adaptivePlannerSnapshotSemanticsSteps",
    "adaptiveResidentValidationProofSteps","adaptiveResidentValidationProofsSteps","adaptiveMaterializeBrickSteps",
    "adaptiveValidateMaterializedBrickSteps","adaptiveBaseFieldDescriptorHashSteps","adaptiveDenseArraySteps","createOwnedCanonicalHashCursor"]){expect(root).not.toHaveProperty(name);}
  expect(OWNED_RECORD_MAX_KEYS).toBe(16);
  const vector=JSON.parse(projectionVector) as ReturnType<typeof canonical.createAdaptivePlannerSnapshotProjection>;
  const vectorSnapshot=deepFreeze({schemaVersion:"adaptive-microvoxel-planner-snapshot-v1",bodyId:vector.authority.bodyId,
    surfaceFrameId:vector.authority.surfaceFrameId,regionId:vector.authority.regionId,generatorVersion:vector.authority.generatorVersion,
    authority:{schemaVersion:"adaptive-microvoxel-planner-authority-v1",baseField:vector.authority.baseField,
      editJournal:vector.authority.editJournal,brickRevision:root.authorityRevision(0)},planningEpoch:root.authorityRevision(0),resident:vector.resident,
    activeCoverage:[],refinementRequests:[],budgets:vector.budgets}) as root.AdaptivePlannerSnapshot;
  const vectorBrick=literalBrick(vector.resident[0]!.key,vector.authority.baseField,vector.authority.editJournal,
    new Array<number>(4096).fill(0),new Array<number>(4096).fill(1),new Array<string|null>(4096).fill("m"),new Array<string|null>(4096).fill(null));
  const projectedVector=finish(job(options=>canonical.adaptivePlannerSnapshotProjectionSteps(vectorSnapshot,options)),7).value;
  expect(canonicalAdaptiveJson(projectedVector)).toBe(projectionVector);expect(Buffer.byteLength(projectionVector,"utf8")).toBe(1297);
  expect(hashAdaptiveCanonical(projectedVector)).toBe("fnv1a64-v1:65c99718f9e33b8b");
  const issuedVector=finish(job(options=>canonical.adaptiveResidentValidationProofSteps({brick:vectorBrick,brickRevision:0,snapshot:vectorSnapshot},options)),16).value;
  expect(canonicalAdaptiveJson(issuedVector)).toBe(proofVector);expect(Buffer.byteLength(proofVector,"utf8")).toBe(680);
  expect(issuedVector.proofDigest).toBe("fnv1a64-v1:db81963893ef243d");expect(root.hasAdaptiveResidentValidationProofBrand(issuedVector)).toBe(true);
  const before=canonicalAdaptiveJson({snapshot,bricks,authority}),records:unknown[]=[];
  let whole=0,retained:(ReturnType<typeof recipe> extends Generator<void,infer T,void>?T:never)|undefined;
  for(const budget of [1,7,16,32,64,257]){
    const cursor=job(recipe),done=finish(cursor,budget);whole=cursor.units;retained=done.value;
    expect(canonicalAdaptiveJson(done.value.projection)).toBe(canonicalAdaptiveJson(expectedProjection));expect(done.value.digest).toBe(projectionDigest);
    expect(canonicalAdaptiveJson(done.value.retention)).toBe(canonicalAdaptiveJson(authority));expect(canonicalAdaptiveJson(done.value.proofs)).toBe(canonicalAdaptiveJson(expectedProofs));
    for(const proof of done.value.proofs){expect(root.hasAdaptiveResidentValidationProofBrand(proof)).toBe(true);expect(isIssuedStructuralObject(proof)).toBe(false);}
    expect(root.isDeepFrozen(done.value)).toBe(true);expect(cursor.resources.reservedBytes).toBe(0);expect(cursor.resources.retainedEstimateBytes).toBe(0);
    expect(cursor.hashes.started).toBe(cursor.hashes.closed);expect(cursor.hashes.maxKeys).toBeLessThanOrEqual(13);
    expect(()=>cursor.advance(1)).toThrow("Once-only");const resultBytes=canonicalAdaptiveJson(done.value);
    cursor.dispose();cursor.dispose();expect(canonicalAdaptiveJson(done.value)).toBe(resultBytes);expect(root.hasAdaptiveResidentValidationProofBrand(done.value.proofs[0])).toBe(true);
    records.push({budget,wholeUnits:whole,maxAdvanceUnits:done.maxAdvance,resources:cursor.resources,hashes:cursor.hashes});
  }
  expect(retained).toBeDefined();const proofs=retained!.proofs,bound=attached(snapshot,proofs);
  expect(root.validateAdaptivePlannerSnapshotSemantics(bound).snapshotProjectionDigest).toBe(projectionDigest);
  // Exact retained source envelope is host-only DATA, not a Structural-issued object.
  const sourceLiteral={schemaVersion:"structural-microvoxel-source-binding-v1",baseFieldIdentity:base.identity,baseFieldVersion:base.version,
    baseFieldDescriptorDigest:expectedProjection.authority.baseFieldDescriptorDigest,journalDigest:journal.digest,snapshotProjectionDigest:projectionDigest,
    proofDigests:expectedProofs.map(proof=>proof.proofDigest).sort(),sourceRevision:1,editRevision:2,brickRevision:2,planningEpoch:3};
  const observedSource={...sourceLiteral,baseFieldDescriptorDigest:retained!.projection.authority.baseFieldDescriptorDigest,
    journalDigest:retained!.retention.editJournal.digest,snapshotProjectionDigest:retained!.digest,proofDigests:proofs.map(proof=>proof.proofDigest).sort()};
  expect(canonicalAdaptiveJson(observedSource)).toBe(canonicalAdaptiveJson(sourceLiteral));expect(isIssuedStructuralObject(observedSource)).toBe(false);
  const genericProofs=root.createAdaptiveResidentValidationProofs({bricks,brickRevision:2,snapshot});expect(canonicalAdaptiveJson(genericProofs)).toBe(canonicalAdaptiveJson(expectedProofs));
  const sortedBricks=deepFreeze([...bricks].reverse()),sortedSnapshot=snapshotOf(sortedBricks);
  const sorted=finish(job(options=>canonical.adaptiveResidentValidationProofsSteps({bricks:sortedBricks,brickRevision:2,snapshot:sortedSnapshot},options)),32).value;
  expect(canonicalAdaptiveJson(sorted)).toBe(canonicalAdaptiveJson([...expectedProofs].reverse()));
  for(const [index,brick] of bricks.entries()){
    const actual=root.materializeAdaptiveBrick({key:brick.key,baseField:base,editJournal:journal});
    expect(Buffer.from(new Float64Array(actual.density).buffer)).toEqual(Buffer.from(new Float64Array(brick.density).buffer));
    expect(Buffer.from(new Float64Array(actual.occupancy).buffer)).toEqual(Buffer.from(new Float64Array(brick.occupancy).buffer));
    expect(canonicalAdaptiveJson(actual)).toBe(canonicalAdaptiveJson(brick));expect(proofs[index]!.key).toEqual(brick.key);
  }
  const modelError=failureOf(()=>createStructuralObjectFromAdaptive({objectId:"object.child",frame:{schemaVersion:"structural-microvoxel-frame-binding-v1",
    bodyId:"body.foreign",surfaceFrameId:"frame.hvp",regionId:"region.child",generatorVersion:"hvp-rigid-ingest-v1",objectOriginQuantum:{x:0,y:0,z:0}},
    authority:retained!.retention,snapshot:bound,materials:[],materialBindings:[],bricks,anchors:[],joints:[],objectRevision:0,editRevision:0,commandEvidence:[]}));
  expect(modelError).toMatchObject({code:"InvalidAdaptiveBinding",path:"ingest/frame"});
  const clone=deepFreeze({...proofs[0]!}),badDigest=deepFreeze({...proofs[0]!,proofDigest:"fnv1a64-v1:0000000000000000"});
  for(const unissued of [clone,badDigest]){expect(root.hasAdaptiveResidentValidationProofBrand(unissued)).toBe(false);
    const value=deepFreeze({...bound,resident:[{...bound.resident[0]!,validationProof:unissued},bound.resident[1]!]});
    expect(failureOf(()=>finish(job(options=>canonical.adaptivePlannerSnapshotSemanticsSteps(value,{},options)),64))).toMatchObject({path:"snapshot/resident/0/validationProof"});}
  const changes:readonly root.AdaptivePlannerSnapshot[]=[
    snapshot,
    deepFreeze({...bound,planningEpoch:root.authorityRevision(4)}),
    deepFreeze({...bound,resident:[{...bound.resident[0]!,brickRevision:root.authorityRevision(3)},bound.resident[1]!]}),
    deepFreeze({...bound,resident:[{...bound.resident[0]!,sourceRevision:root.authorityRevision(2)},bound.resident[1]!]}),
    deepFreeze({...bound,resident:[{...bound.resident[0]!,editRevision:root.authorityRevision(3)},bound.resident[1]!]}),
    deepFreeze({...bound,resident:[{...bound.resident[0]!,journalDigest:"fnv1a64-v1:0000000000000000"},bound.resident[1]!]}),
    deepFreeze({...bound,authority:{...bound.authority,baseField:{...base,identity:root.stableAuthorityId("base.foreign")}}}),
    deepFreeze({...bound,resident:[{...bound.resident[0]!,key:{...bricks[0]!.key,surfaceFrameId:root.stableAuthorityId("frame.foreign")}},bound.resident[1]!]}),
    deepFreeze({...bound,resident:[{...bound.resident[0]!,key:{...bricks[0]!.key,regionId:root.stableAuthorityId("region.foreign")}},bound.resident[1]!]}),
    deepFreeze({...bound,refinementRequests:[]}),
    deepFreeze({...bound,resident:[{...bound.resident[0]!,readiness:"stale"},bound.resident[1]!]})
  ];
  for(const value of changes){const original=failureOf(()=>root.validateAdaptivePlannerSnapshotSemantics(value));
    const cursor=job(options=>canonical.adaptivePlannerSnapshotSemanticsSteps(value,{},options)),actual=failureOf(()=>finish(cursor,257));
    expect(actual).toMatchObject({code:(original as validation.AdaptiveAuthorityError).code,path:(original as validation.AdaptiveAuthorityError).path,message:(original as Error).message});
    expect(cursor.resources.reservedBytes).toBe(0);expect(cursor.hashes.closed).toBe(cursor.hashes.started);}
  const pastDeadline=deepFreeze({...snapshot,refinementRequests:[{...requests[0]!,deadlinePlanningEpoch:root.authorityRevision(2)}]});
  expect(canonicalAdaptiveJson(finish(job(options=>canonical.adaptivePlannerSnapshotSemanticsSteps(pastDeadline,{allowProoflessReadyResidents:true},options)),257).value))
    .toBe(canonicalAdaptiveJson(root.validateAdaptivePlannerSnapshotSemantics(pastDeadline,{allowProoflessReadyResidents:true})));
  for(const value of [deepFreeze({...snapshot,resident:[snapshot.resident[0]!,snapshot.resident[0]!]}),
    deepFreeze({...snapshot,refinementRequests:[requests[0]!,requests[0]!]}),
    deepFreeze({...snapshot,refinementRequests:[{...requests[0]!,deadlinePlanningEpoch:-1}]}),
    deepFreeze({...snapshot,refinementRequests:[{...requests[0]!,priority:NaN}]}),
    deepFreeze({...snapshot,budgets:{...snapshot.budgets,maxWork:-1}})] as readonly root.AdaptivePlannerSnapshot[]){
    const original=failureOf(()=>root.validateAdaptivePlannerSnapshotSemantics(value,{allowProoflessReadyResidents:true}));
    const cursor=job(options=>canonical.adaptivePlannerSnapshotSemanticsSteps(value,{allowProoflessReadyResidents:true},options));
    expect(failureOf(()=>finish(cursor,257))).toMatchObject({code:(original as validation.AdaptiveAuthorityError).code,path:(original as validation.AdaptiveAuthorityError).path});
    expect(cursor.resources.reservedBytes).toBe(0);}
  for(const [field,limit] of [["resident",4096],["activeCoverage",4096],["refinementRequests",4096]] as const){
    const value={...snapshot,[field]:new Array(limit+1)} as root.AdaptivePlannerSnapshot;
    const original=failureOf(()=>root.createAdaptivePlannerSnapshotProjection(value));
    const cursor=job(options=>canonical.adaptivePlannerSnapshotProjectionSteps(value,options));
    expect(failureOf(()=>finish(cursor,1))).toMatchObject({path:(original as validation.AdaptiveAuthorityError).path});expect(cursor.resources.reservedBytes).toBe(0);
  }
  const largeInputs=deepFreeze(Array.from({length:4096},(_,index)=>index<2?editInputs[index]!:{...editInputs[1]!,editId:`large.${index}`,
    sequence:index+1,expectedRegionRevision:index,resultRegionRevision:index+1,box:{min:{x:4096,y:0,z:0},max:{x:4097,y:1,z:1}}}));
  const largeJournal=root.createAdaptiveEditJournal(largeInputs),largeBricks=deepFreeze([brickAt(0,largeJournal),brickAt(-16,largeJournal)]),largeSnapshot=snapshotOf(largeBricks,largeJournal);
  const largeDigest=hashAdaptiveCanonical(literalProjection(largeSnapshot)),largeJob=job(options=>canonical.adaptiveResidentValidationProofsSteps({bricks:largeBricks,brickRevision:2,snapshot:largeSnapshot},options));
  const large=finish(largeJob,257);expect(canonicalAdaptiveJson(large.value)).toBe(canonicalAdaptiveJson(largeBricks.map(brick=>literalProof(brick,largeDigest))));
  expect(largeJob.resources.reservedBytes).toBe(0);expect(largeJob.hashes.closed).toBe(largeJob.hashes.started);
  const changedJournal=deepFreeze({...largeJournal,records:largeJournal.records.map((record,index)=>index===4095?{...record,sourceId:root.stableAuthorityId("source.foreign")}:record)});
  const corrupted=deepFreeze({...largeSnapshot,authority:{...largeSnapshot.authority,editJournal:changedJournal}});
  expect(failureOf(()=>finish(job(options=>canonical.adaptivePlannerSnapshotProjectionSteps(corrupted,options)),257))).toMatchObject({code:"InvalidEditJournal",path:"journal"});
  const mutableChild={},array=Object.freeze([...new Array<number>(4095).fill(0),mutableChild]);
  expect(root.isDeepFrozen(array)).toBe(false);expect(finish(job(options=>validation.adaptiveIsDeepFrozenSteps(array,undefined,options.reserve)),7).value).toBe(false);
  const cycle:{self?:unknown}={};cycle.self=cycle;Object.freeze(cycle);const alreadySeen=new WeakSet<object>([mutableChild]);
  expect(root.isDeepFrozen(cycle)).toBe(true);expect(finish(job(options=>validation.adaptiveIsDeepFrozenSteps(cycle,undefined,options.reserve)),1).value).toBe(true);
  expect(root.isDeepFrozen(mutableChild,alreadySeen)).toBe(true);expect(finish(job(options=>validation.adaptiveIsDeepFrozenSteps(mutableChild,alreadySeen,options.reserve)),1).value).toBe(true);
  const explicitNullSeen=null as unknown as WeakSet<object>;
  for(const value of [undefined,null,"primitive",0,false]){expect(root.isDeepFrozen(value,explicitNullSeen)).toBe(true);}
  for(const value of [Object.freeze({}),{}]){
    const original=failureOf(()=>explicitNullSeen.has(value));
    const actual=failureOf(()=>root.isDeepFrozen(value,explicitNullSeen));
    expect(actual).toBeInstanceOf(TypeError);
    expect(actual).toMatchObject({name:(original as Error).name,message:(original as Error).message});
  }
  let getters=0;const accessor=Object.freeze(Object.defineProperty({},"value",{enumerable:true,get(){getters+=1;throw new Error("getter must not run");}}));
  const symbol=Symbol("ignored"),symbolRecord=Object.freeze({[symbol]:mutableChild});
  for(const value of [accessor,symbolRecord]){expect(root.isDeepFrozen(value)).toBe(true);expect(finish(job(options=>validation.adaptiveIsDeepFrozenSteps(value,undefined,options.reserve)),1).value).toBe(true);}expect(getters).toBe(0);
  const mutableRetention=Object.freeze({baseField:base,editJournal:Object.freeze({...journal,records:[...journal.records]})});
  expect(failureOf(()=>root.releaseAdaptiveResidency([],[],"evict",mutableRetention))).toMatchObject({path:"authority"});
  const retentionJob=job(options=>residency.adaptiveValidateAuthorityRetentionSteps(mutableRetention,options));
  expect(failureOf(()=>finish(retentionJob,7))).toMatchObject({path:"authority"});expect(retentionJob.resources.reservedBytes).toBe(0);
  const observation:string[]=[],proxy=new Proxy(snapshot,{get(target,key,receiver){observation.push(String(key));return Reflect.get(target,key,receiver);}});
  expect(canonicalAdaptiveJson(root.createAdaptivePlannerSnapshotProjection(proxy))).toBe(canonicalAdaptiveJson(expectedProjection));
  expect(observation).toEqual(["schemaVersion","bodyId","surfaceFrameId","regionId","generatorVersion","planningEpoch","authority","resident","activeCoverage","refinementRequests","budgets"]);
  const parameterReads:string[]=[],badParameters=new Proxy({bricks:new Array(4097),brickRevision:2,snapshot:null},{get(target,key,receiver){parameterReads.push(String(key));return Reflect.get(target,key,receiver);}});
  expect(failureOf(()=>root.createAdaptiveResidentValidationProofs(badParameters as unknown as canonical.CreateAdaptiveResidentValidationProofsInput))).toMatchObject({path:"proofs/bricks"});
  expect(parameterReads).toEqual(["bricks","brickRevision","snapshot"]);
  const saved=Object.getOwnPropertyDescriptor(Array.prototype,"constructor")!,sentinel=new Error("native Species"),native:string[]=[];let nativeFailure:unknown;
  try{Object.defineProperty(Array.prototype,"constructor",{configurable:true,get(){native.push("constructor");return {get [Symbol.species](){native.push("Species");throw sentinel;}};}});
    try{root.createAdaptivePlannerSnapshotProjection(snapshot);}catch(error){nativeFailure=error;}
  }finally{Object.defineProperty(Array.prototype,"constructor",saved);}expect(nativeFailure).toBe(sentinel);expect(native).toEqual(["constructor","Species"]);
  const tight=job(recipe,20_000),first=failureOf(()=>finish(tight,1));expect(first).toMatchObject({code:"InvalidBudget",path:"cursor/prepareBytes"});
  expect(tight.resources.reservedBytes).toBe(0);tight.dispose();expect(failureOf(()=>tight.advance(1))).toBe(first);
  const boundaries=[0,1,64,Math.floor(whole/3),Math.floor(whole/2),whole-1];
  for(const boundary of boundaries){
    const canceled=job(recipe);if(boundary>0){expect(canceled.advance(boundary).done).toBe(false);}canceled.dispose();canceled.dispose();expect(canceled.resources.reservedBytes).toBe(0);expect(canceled.hashes.closed).toBe(canceled.hashes.started);
    const host=job(recipe);try{if(boundary>0){host.advance(boundary);}throw sentinel;}catch(error){expect(error).toBe(sentinel);}finally{host.dispose();}expect(host.resources.reservedBytes).toBe(0);expect(host.hashes.closed).toBe(host.hashes.started);
    const invalid=job(recipe);if(boundary>0){invalid.advance(boundary);}const error=failureOf(()=>invalid.advance(0));expect(error).toMatchObject({path:"cursor/maxUnits"});invalid.dispose();expect(invalid.resources.reservedBytes).toBe(0);expect(failureOf(()=>invalid.advance(1))).toBe(error);expect(invalid.hashes.closed).toBe(invalid.hashes.started);
  }
  expect(canonicalAdaptiveJson(finish(job(recipe),257).value.proofs)).toBe(canonicalAdaptiveJson(expectedProofs));
  const parent=createStructuralOwnerLedger(resident);parent.reserve(4096);
  const reservationBefore=parent.resources.reservedBytes,steps=residency.adaptiveAuthorityRetentionSteps(authority,{reserve:parent.reserve,hash:function*(payload){
    parent.reserve(32768,false,"hash");const cursor=createOwnedCanonicalHashCursor(payload);
    try{for(;;){const result=cursor.advance(1);if(result!==undefined){return result.contentHash;}yield;}}finally{cursor.dispose();}
  }});
  let borrowedRetention:root.AdaptiveAuthorityRetention|undefined;try{for(;;){const step=steps.next();if(step.done){borrowedRetention=step.value;break;}}}finally{steps.return(undefined as never);}
  expect(canonicalAdaptiveJson(borrowedRetention)).toBe(canonicalAdaptiveJson(authority));expect(parent.resources.reservedBytes).toBeGreaterThan(reservationBefore);parent.release();expect(parent.resources.reservedBytes).toBe(0);
  expect(canonicalAdaptiveJson({snapshot,bricks,authority})).toBe(before);
  console.log("OWNED_RESIDENT_SOURCE_EVIDENCE",JSON.stringify({cases:records,wholeUnits:whole,large4096:{units:largeJob.units,
    maxAdvanceUnits:large.maxAdvance,resources:largeJob.resources,hashes:largeJob.hashes},cancelBoundaries:boundaries.length,
    hostFinallyBoundaries:boundaries.length,invalidBudgetBoundaries:boundaries.length,finalReservations:0,
    vectors:{projectionBytes:1297,projectionHash:"fnv1a64-v1:65c99718f9e33b8b",proofBytes:680,proofHash:"fnv1a64-v1:db81963893ef243d"},
    genuineResidentProofs:true,structuralIssuer:false,privateHelpersAbsent:true,hashBackingBytes:4096,pendingUtf16Units:1024,
    kernelRecordCap:16,productionActivation:"OFF",physicalGC:"NOT_PROVEN",whole8ms:"NOT_PROVEN"}));
});
