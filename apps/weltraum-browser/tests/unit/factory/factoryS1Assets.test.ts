import {describe,it,expect} from "vitest";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {loadFactoryS1Assets,sampleFactoryS1Assets,disposeFactoryS1Assets,type FactoryS1Sample} from "../../../src/factory/presentation/factoryS1Assets";
import {createFactoryInstallationProfile} from "../../../src/factory/construction/installationProfile";
import {createFp02Fixture} from "../../../src/factory/catalog/fp02Catalog";
import {deepFreezeMetadata,validateMeshArtifact} from "../../../src/presentation";
import {canonicalSignature} from "../../../src/resources/serialization";
import type {FactoryNativePartObservation,FactoryFacilityOwner} from "../../../src/hestia-prototype/physics/factoryFacilitySession";
import type {HvpPhysicsSnapshot} from "../../../src/hestia-prototype/physics/physicsWorker";
// Tests-only bridge scaffolding retains the legacy flat fields for the unchanged
// seed's RED, while carrying the frozen agreed wrapper/snapshot API.
type BoundNative=FactoryNativePartObservation&Readonly<{sessionId:string;epoch:number;nativeTick:number;rawObservation:FactoryNativePartObservation}>;
type BoundSample=FactoryS1Sample&Readonly<{native:BoundNative;currentPhysicsSnapshot:Readonly<Pick<HvpPhysicsSnapshot,"ticks"|"status"|"factoryFacilities">>}>;
const makeRow=(value:FactoryNativePartObservation):FactoryNativePartObservation=>{
 const {observationDigest:_old,...binding}=value;return deepFreezeMetadata({...binding,observationDigest:canonicalSignature(binding)});
};
const withNative=(read:BoundSample,patch:Partial<FactoryNativePartObservation>):BoundSample=>{
 const rawObservation=makeRow({...read.native.rawObservation,...patch});
 return {...read,native:{...rawObservation,sessionId:read.sessionId,epoch:read.epoch,nativeTick:read.nativeTick,rawObservation},currentPhysicsSnapshot:deepFreezeMetadata({...read.currentPhysicsSnapshot,factoryFacilities:{...read.currentPhysicsSnapshot.factoryFacilities!,partObservations:[rawObservation]}})};
};
const actualFetch:typeof fetch=async input=>{
 const url=String(input);const bytes=await readFile(path.resolve("public",url.replace(/^\//,"")));return new Response(new Uint8Array(bytes));
};
const fixture=async(sourceId="B06")=>{
 const catalog=createFp02Fixture("cargo").catalog,recipe=catalog.recipes.find(r=>r.sourceId===(sourceId==="B06"?"REC-01-CUT":"REC-02-PROFILE"))!,profile=createFactoryInstallationProfile(sourceId),instanceId=`actual_asset_${sourceId.toLowerCase()}`;
 const assets=await loadFactoryS1Assets({...profile.definitionRef,instanceId},{fetch:actualFetch});
 // Native/work record is an explicitly synthetic readonly controller fixture.
 // Actual Rapier membership/removal is verified separately in facilitySession.
 const read:Omit<FactoryS1Sample,"native"|"currentPhysicsSnapshot">&{native:FactoryNativePartObservation}={sessionId:"s1_unit",epoch:3,nativeTick:120,terrainRevision:0,facilityRevision:1,native:{instanceId,definitionRef:profile.definitionRef,sourceDigest:profile.sourceDigest,profileDigest:profile.profileDigest,installationRevision:1,terrainRevision:0,facilityRevision:1,published:true,confirmed:true,complete:true,observationDigest:"synthetic_fixture_v1",parts:profile.source.parts.map(p=>({partId:p.partId,status:"Present",colliderHandles:profile.colliders.flatMap((c,i)=>c.partId===p.partId?[i]:[])}))},work:{sessionId:"s1_unit",epoch:3,publicationRevision:8,nativeTick:120,catalogDigest:catalog.catalogDigest,instanceId,definitionRef:profile.definitionRef,sourceDigest:profile.sourceDigest,profileDigest:profile.profileDigest,installationRevision:1,terrainRevision:0,facilityRevision:1,confirmed:true,status:"RUNNING",confirmedWorkMs:15000,jobId:"paid_unit_job",recipeRef:{sourceId:recipe.sourceId,version:recipe.version,digest:recipe.digest},custody:{inputContainerId:`input_${instanceId}`,wipContainerId:`wip_${instanceId}`,outputContainerId:`output_${instanceId}`,offcutContainerId:`offcut_${instanceId}`,installedContainerId:`installed_${instanceId}`}}};
 const rawObservation=makeRow(read.native),owner:FactoryFacilityOwner=deepFreezeMetadata({ownerId:"fp02_wreck_owner",instanceId,transactionId:"unit_paid_install",definitionRef:profile.definitionRef,profileDigest:profile.profileDigest,sourceDigest:profile.sourceDigest,massMg:profile.massMg,materialBinding:"synthetic_paid_install",centerMm:[0,0,0],quarterTurns:0,bodyHandle:1,colliderHandles:profile.colliders.map((_,i)=>i),installationRevision:1});
 const bound:BoundSample={...read,native:{...rawObservation,sessionId:read.sessionId,epoch:read.epoch,nativeTick:read.nativeTick,rawObservation},work:{...read.work,installationRevision:1},currentPhysicsSnapshot:deepFreezeMetadata({ticks:read.nativeTick,status:"Running",factoryFacilities:{partObservations:[rawObservation],revision:1,state:"Idle",transactionId:null,owners:[owner],prepared:null}})};
 return {assets,read:bound,profile};
};
describe("PLAY02 closed S1 source/cell/native/work/render join",()=>{
 it.each(["B06","B07"])("admits the actual %s GLB beside its real125mm cell derivative and frozen native recipe",async sourceId=>{
  const f=await fixture(sourceId);expect(f.assets.cells.profileDigest).toBe(f.profile.profileDigest);expect(f.assets.cells.sourceDigest).toBe(f.profile.sourceDigest);
  expect(f.assets.cells.parts.map(p=>p.partId).sort()).toEqual(f.assets.render.parts.map(p=>p.partId).sort());
  expect(f.assets.render.assetId).toBe(sourceId==="B06"?"play_cutter_v2":"play_former_v2");
  expect(f.assets.render.parts.every(p=>validateMeshArtifact(p.artifact).valid)).toBe(true);
  expect(f.assets.cells.parts.every(p=>validateMeshArtifact(p.artifact).valid)).toBe(true);
  expect(f.assets.cost.triangles).toBe(f.assets.render.parts.reduce((n,p)=>n+p.artifact.indices.length/3,0));
  expect(f.assets.cost.draws).toBe(f.assets.render.parts.reduce((n,p)=>n+p.artifact.materialRanges.length,0));
  expect(f.assets.cost.cpu).toBeGreaterThan(f.assets.cost.mesh/2);
  expect(f.profile.massMg).toBe(sourceId==="B06"?208000000:341000000);
  const pose=sampleFactoryS1Assets(f.assets,f.read);expect(pose.status).toBe("RUNNING");expect(pose.paused).toBe(false);expect(pose.partPoses).toHaveLength(f.profile.source.parts.length);
 });
 it.each(["instanceId","sourceDigest","profileDigest"] as const)("rejects wrong native %s instead of accepting render provenance",async key=>{
  const f=await fixture();expect(()=>sampleFactoryS1Assets(f.assets,withNative(f.read,{[key]:"wrong"}))).toThrow(/binding/i);
 });
 it.each(["epoch","terrainRevision","facilityRevision"] as const)("rejects stale work %s even when source/asset identity matches",async key=>{
  const f=await fixture();expect(()=>sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,[key]:99}})).toThrow(/binding/i);
 });
 it("suppresses an absent native part and its authored moving children without rebuilding it from cached source",async()=>{
  const f=await fixture();const read=withNative(f.read,{complete:false,parts:f.read.native.rawObservation.parts.map(p=>p.partId==="cutter_frame"?{...p,status:"Absent" as const,colliderHandles:[]}:p)});
  const pose=sampleFactoryS1Assets(f.assets,read),ids=pose.partPoses.map(p=>p.partId);
  expect(ids).not.toContain("cutter_frame");for(const child of Object.keys(f.assets.cells.semanticParents))expect(ids).not.toContain(child);
  expect(pose.status).toBe("FAULT");expect(pose.paused).toBe(true);
  expect(sampleFactoryS1Assets(f.assets,read)).toEqual(pose);
 });
 it("unknown native body binding cannot make source-listed parts present",async()=>{
  const f=await fixture();const pose=sampleFactoryS1Assets(f.assets,withNative(f.read,{confirmed:false}));
  expect(pose.partPoses).toEqual([]);expect(pose.status).toBe("FAULT");
 });
 it.each(["WAIT_INPUT","WAIT_POWER","WAIT_OUTPUT"])("keeps the confirmed phase frozen for %s with the same real custody",async status=>{
  const f=await fixture();const read={...f.read,work:{...f.read.work,status}};const before=JSON.stringify(read);
  const first=sampleFactoryS1Assets(f.assets,read);expect(first.status).toBe(status);expect(first.paused).toBe(true);
  expect(sampleFactoryS1Assets(f.assets,read)).toEqual(first);expect(JSON.stringify(read)).toBe(before);
 });
 it("refuses future work/native ticks and malformed custody identity",async()=>{
  const f=await fixture();expect(()=>sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,nativeTick:121}})).toThrow(/binding/i);
  expect(()=>sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,custody:{...f.read.work.custody,wipContainerId:"foreign"}}})).toThrow(/custody/i);
 });
 it("wrong active recipe/catalog provenance cannot animate a paid machine",async()=>{
  const f=await fixture();expect(()=>sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,catalogDigest:"foreign"}})).toThrow(/binding/i);
  expect(()=>sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,recipeRef:{...f.read.work.recipeRef!,digest:"foreign"}}})).toThrow(/recipe/i);
 });
 it("a verified disabled PreparedHeld candidate is not published working presence",async()=>{
  const f=await fixture();const read=withNative(f.read,{published:false});
  const pose=sampleFactoryS1Assets(f.assets,read);expect(pose.status).toBe("FAULT");expect(pose.partPoses).toEqual([]);
 });
 it("disposed owned assets cannot resurrect their parts or pose after later cache reads",async()=>{
  const f=await fixture();disposeFactoryS1Assets(f.assets);expect(()=>sampleFactoryS1Assets(f.assets,f.read)).toThrow(/disposed/i);
 });
 it.each(["RUNNING","WAIT_POWER","FAULT"])("P2 unconfirmed changed work cannot move any part during %s",async status=>{
  const f=await fixture();const paid=sampleFactoryS1Assets(f.assets,f.read);
  expect(paid.partPoses.some(p=>p.translationM.some(v=>v!==0))).toBe(true);
  const held=sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,confirmed:false,status,confirmedWorkMs:20000}});
  expect(held.status).toBe("FAULT");expect(held.paused).toBe(true);expect(held.partPoses).toEqual([]);
 });
 it.each(["sessionId","epoch","nativeTick"] as const)("P2 rejects stale Native %s despite matching source and revisions",async key=>{
  const f=await fixture();const bad={...f.read,native:{...f.read.native,[key]:key==="sessionId"?"prior_session":999}};
  expect(()=>sampleFactoryS1Assets(f.assets,bad)).toThrow(/binding/i);
 });
 it("P2 rejects a cached Present observation after a same-tick parent loss in the current snapshot",async()=>{
  const f=await fixture();const current=withNative(f.read,{complete:false,parts:f.read.native.rawObservation.parts.map(p=>p.partId==="cutter_frame"?{...p,status:"Absent" as const,colliderHandles:[]}:p)});
  const replay={...current,native:f.read.native};
  expect(replay.nativeTick).toBe(f.read.nativeTick);expect(replay.facilityRevision).toBe(f.read.facilityRevision);
  expect(()=>sampleFactoryS1Assets(f.assets,replay)).toThrow(/binding/i);
 });
 it("P2 rejects a copied equal Native row instead of admitting an unowned observation",async()=>{
  const f=await fixture();const bad={...f.read,native:{...f.read.native,rawObservation:makeRow({...f.read.native.rawObservation})}};
  expect(()=>sampleFactoryS1Assets(f.assets,bad)).toThrow(/binding/i);
 });
 it("P2 rejects a current snapshot whose real physics tick differs from copied headers",async()=>{
  const f=await fixture();expect(()=>sampleFactoryS1Assets(f.assets,{...f.read,currentPhysicsSnapshot:deepFreezeMetadata({...f.read.currentPhysicsSnapshot,ticks:121})})).toThrow(/binding/i);
 });
 it("P2 refuses Present parts without a current published Native owner",async()=>{
  const f=await fixture();const currentPhysicsSnapshot=deepFreezeMetadata({...f.read.currentPhysicsSnapshot,factoryFacilities:{...f.read.currentPhysicsSnapshot.factoryFacilities!,owners:[]}});
  expect(()=>sampleFactoryS1Assets(f.assets,{...f.read,currentPhysicsSnapshot})).toThrow(/binding/i);
 });
 it("P2 refuses an observation from an earlier installation of the same instance",async()=>{
  const f=await fixture();const currentPhysicsSnapshot=deepFreezeMetadata({...f.read.currentPhysicsSnapshot,factoryFacilities:{...f.read.currentPhysicsSnapshot.factoryFacilities!,owners:f.read.currentPhysicsSnapshot.factoryFacilities!.owners.map(o=>({...o,installationRevision:2}))}});
  expect(()=>sampleFactoryS1Assets(f.assets,{...f.read,currentPhysicsSnapshot})).toThrow(/binding/i);
 });
 it("P2 refuses paid work from an earlier installation despite identical definition",async()=>{
  const f=await fixture();expect(()=>sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,installationRevision:2}})).toThrow(/binding/i);
 });
 it("P2 refuses a modified observation digest even when the current row object matches",async()=>{
  const f=await fixture();const rawObservation=deepFreezeMetadata({...f.read.native.rawObservation,observationDigest:"foreign"});
  const read={...f.read,native:{...rawObservation,sessionId:f.read.sessionId,epoch:f.read.epoch,nativeTick:f.read.nativeTick,rawObservation},currentPhysicsSnapshot:deepFreezeMetadata({...f.read.currentPhysicsSnapshot,factoryFacilities:{...f.read.currentPhysicsSnapshot.factoryFacilities!,partObservations:[rawObservation]}})};
  expect(()=>sampleFactoryS1Assets(f.assets,read)).toThrow(/binding/i);
 });
 it.each([null,""," "])("P2 RUNNING cannot animate a selected recipe without a paid job identity %s",async jobId=>{
  const f=await fixture();expect(()=>sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,jobId}})).toThrow(/job/i);
 });
 it.each(["Paused","SimulationHold","CoverageHold","RecoveryHold"] as const)("P2 a %s physics snapshot cannot authorize substituted RUNNING motion",async status=>{
  const f=await fixture();const held=sampleFactoryS1Assets(f.assets,{...f.read,currentPhysicsSnapshot:deepFreezeMetadata({...f.read.currentPhysicsSnapshot,status}),work:{...f.read.work,confirmedWorkMs:20000}});
  expect(held.partPoses).toEqual([]);expect(held.status).toBe("FAULT");expect(held.paused).toBe(true);
 });
 it("P2 an explicitly FAULT paid read cannot move parts using a substituted work amount",async()=>{
  const f=await fixture();const held=sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,status:"FAULT",confirmedWorkMs:20000}});
  expect(held.partPoses).toEqual([]);expect(held.status).toBe("FAULT");
 });
 it("completed paid history stays truthful after the active job UI identity is cleared",async()=>{
  const f=await fixture();const pose=sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,status:"COMPLETED",jobId:null,confirmedWorkMs:30000}});
  expect(pose.status).toBe("COMPLETED");expect(pose.phase).toBe("complete");expect(pose.paused).toBe(true);
 });
 it.each(["IDLE","WAIT_INPUT","WAIT_POWER"])("prestart %s with no paid job or recipe does not fabricate work",async status=>{
  const f=await fixture();const pose=sampleFactoryS1Assets(f.assets,{...f.read,work:{...f.read.work,status,jobId:null,recipeRef:null,confirmedWorkMs:0}});
  expect(pose.status).toBe(status);expect(pose.paused).toBe(true);expect(pose.partPoses.every(p=>p.translationM.every(v=>v===0))).toBe(true);
 });
});
