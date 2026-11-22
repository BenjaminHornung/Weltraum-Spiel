import {beforeAll,expect,it} from "vitest";
import {HVP_COAST_MATERIAL_REGISTRY} from "../../src/hvp/hvpCoastSource";
import {cellsFromCompactSpans,compactTerrainOwnerDigest} from "../../src/voxel/structural/componentIndex/fragment";
import type {Span} from "../../src/voxel/structural/componentIndex/exactShapes";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {bindHvpCompactChildArchive,compactRuntimeMembershipDigest,createHvpCompactChildIdentity,
  hvpCompactChildArchiveProof,hvpFragmentArchiveDigest} from "../../src/hestia-prototype/physics/compactFragmentIdentity";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {installHvpRigidBody,prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {createHvpWorkerBodyResidency} from "../../src/hestia-prototype/physics/bodyResidency";
import type {HvpCuttableBody} from "../../src/hestia-prototype/physics/bodyCut";
import {decodeHvpBody,decodeHvpColdBody,encodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import body384 from "../fixtures/hvp-contact-r90-body384.json";

const row=(x:number,end:number,material:number):Span=>({x,end,y:15,z:9,material});
const whole=[row(13,18,1),row(18,20,3)], removed=[row(18,20,3)], retained=[row(13,18,1)];
const parent={ownerId:"hvp:terrain-fragment:r1:"+compactTerrainOwnerDigest(whole),revision:0,
  sourceDigest:compactRuntimeMembershipDigest(whole,7),spans:whole};
const materials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,
  structuralClass:m.role,destructible:true,tags:null}));
const makeRecipe=(id:string,spans:Span[])=>prepareHvpRigidBody(ingestHvpStructuralCells(id,cellsFromCompactSpans(spans),materials));
beforeAll(initializeHvpRapier);

it("binds the retained and removed materials to the original root independently of run boundaries",()=>{
  const issued=createHvpCompactChildIdentity(parent,removed,retained)!;
  expect(issued.ownerId).toBe(parent.ownerId+":r1:p0");
  expect(issued.sourceDigest).toMatch(/^hvp-material-child-v1:[0-9a-f]{16}$/);
  expect(issued.removedDigest).toMatch(/^hvp-material-removed-v1:[0-9a-f]{16}$/);
  expect(createHvpCompactChildIdentity(parent,[row(18,19,3),row(19,20,3)],[row(13,16,1),row(16,18,1)])).toEqual(issued);
  expect(createHvpCompactChildIdentity(parent,removed,[row(13,15,1)])).toBeUndefined(); // sibling omitted
  expect(createHvpCompactChildIdentity(parent,removed,[row(12,17,1)])).toBeUndefined();
  expect(createHvpCompactChildIdentity(parent,[row(18,20,2)],retained)).toBeUndefined();
  expect(createHvpCompactChildIdentity(parent,[row(17,19,3)],retained)).toBeUndefined();
  expect(createHvpCompactChildIdentity({...parent,sourceDigest:issued.sourceDigest},removed,retained)).toBeUndefined();
  expect(createHvpCompactChildIdentity({...parent,ownerId:parent.ownerId+":r1:p0"},removed,retained)).toBeUndefined();
  expect(createHvpCompactChildIdentity({...parent,revision:1},removed,retained)).toBeUndefined();
  expect(createHvpCompactChildIdentity(parent,removed,retained,1)).toBeUndefined();
  const alternate=createHvpCompactChildIdentity(parent,[row(13,14,1)],[row(14,18,1),row(18,20,3)])!;
  expect(alternate.ownerId).toBe(issued.ownerId);
  expect(alternate.sourceDigest).not.toBe(issued.sourceDigest);
});

it("reopens legacy v1 separately from a proven child and checks modified ID, lineage and membership on cold admission",()=>{
  const issued=createHvpCompactChildIdentity(parent,removed,retained)!;
  const recipe=makeRecipe(issued.ownerId,retained),world=new R.World({x:0,y:0,z:0});
  try {
    const body=installHvpRigidBody(world,recipe);
    const legacy=encodeHvpBody(issued.ownerId,"terrain",recipe,body);
    expect(legacy.version).toBe("hvp-body-checkpoint-v1");
    const previous=decodeHvpColdBody(legacy,()=>{});
    expect(hvpFragmentArchiveDigest(previous.recipe)).toBe(recipe.source.contentHash);
    expect(bindHvpCompactChildArchive(recipe,issued.proof)).toBe(issued.sourceDigest);
    const checkpoint=encodeHvpBody(issued.ownerId,"terrain",recipe,body);
    if(checkpoint.version!=="hvp-body-checkpoint-v2")throw new Error("missing lineage");
    expect(checkpoint.region).toBe(legacy.region); // exact Structural v1 bytes, including original source hash
    expect(()=>encodeHvpBody(issued.ownerId+":alias","terrain",recipe,body)).toThrow(/owner/);
    const cold=decodeHvpColdBody(JSON.parse(JSON.stringify(checkpoint)),()=>{});
    expect(cold.recipe.source.contentHash).toBe(previous.recipe.source.contentHash);
    expect(hvpFragmentArchiveDigest(cold.recipe)).toBe(issued.sourceDigest);
    for(const malformed of [
      {...checkpoint,ownerId:parent.ownerId},
      {...checkpoint,family:"branch"},
      {...checkpoint,lineage:{...issued.proof,childDigest:issued.sourceDigest.replace(/.$/,c=>c==="0"?"1":"0")}},
      {...checkpoint,lineage:{...issued.proof,parentDigest:issued.proof.parentDigest.replace(/.$/,c=>c==="0"?"1":"0")}},
      {...checkpoint,lineage:{...issued.proof,removed:[row(18,20,1)]}},
      {...checkpoint,lineage:{...issued.proof,removed:[row(19,21,3)]}},
      {...checkpoint,lineage:{...issued.proof,removed:[row(18,19,3)]}},
      {...checkpoint,lineage:{...issued.proof,parentOwnerId:issued.proof.parentOwnerId.replace(":r1:",":r2:")}},
      {...checkpoint,version:"hvp-body-checkpoint-v1"},
      {...checkpoint,lineage:undefined}
    ])expect(()=>decodeHvpColdBody(malformed,()=>{})).toThrow();
    // A valid Structural archive with the same nominal ID, but another material, has no authority to reuse a proof.
    const shifted=makeRecipe(issued.ownerId,[row(12,17,1)]);
    expect(()=>bindHvpCompactChildArchive(shifted,issued.proof)).toThrow(/membership/);
    expect(hvpCompactChildArchiveProof(shifted)).toBeUndefined();
    const oldRoot=decodeHvpColdBody(body384,()=>{});
    expect(hvpFragmentArchiveDigest(oldRoot.recipe)).toMatch(/^hvp-material-cells-v1:/);
  }finally{world.free();}
},120000);

it("preserves one child identity, canonical source, colliders and motion across native park, cold load, wake and the next park",()=>{
  const issued=createHvpCompactChildIdentity(parent,removed,retained)!;
  const recipe=makeRecipe(issued.ownerId,retained), world=new R.World({x:0,y:0,z:0});
  const ledger=createStructuralOwnerLedger(0,undefined,128);
  const targets=new Map<string,HvpCuttableBody>(),bodies=new Map<string,R.RigidBody>();
  const live=createHvpWorkerBodyResidency(world,targets,bodies,()=>true);
  try{
    bindHvpCompactChildArchive(recipe,issued.proof);
    const body=installHvpRigidBody(world,recipe,{translationMeters:{x:1,y:2,z:3},rotation:{x:0,y:0,z:.6,w:.8}});
    body.sleep();targets.set(issued.ownerId,{ownerId:issued.ownerId,body,recipe,family:"terrain"});bodies.set(issued.ownerId,body);
    expect(live.park(issued.ownerId,{x:30,y:0,z:30})).toBe(true);
    const saved=JSON.parse(JSON.stringify(live.checkpoint()[0]));
    expect(live.sources()[0]).toMatchObject({ownerId:issued.ownerId,sourceDigest:issued.sourceDigest,cellCount:5});
    expect(world.bodies.len()).toBe(0);live.dispose();
    const cold=decodeHvpColdBody(saved,ledger.reserve);
    const parked=createHvpWorkerBodyResidency(world,targets,bodies,()=>true,[cold]);
    try{
      expect(parked.sources()[0]?.sourceDigest).toBe(issued.sourceDigest);
      expect(parked.restore(issued.ownerId)).toBe(true);
      const target=targets.get(issued.ownerId)!;
      expect(hvpFragmentArchiveDigest(target.recipe)).toBe(issued.sourceDigest);
      expect(target.body.numColliders()).toBe(cold.recipe.colliders.length);
      expect(target.recipe.source.contentHash).toBe(recipe.source.contentHash);
      expect(encodeHvpBody(issued.ownerId,"terrain",target.recipe,target.body)).toEqual(saved);
      expect(parked.park(issued.ownerId,{x:30,y:0,z:30})).toBe(true);
      expect(decodeHvpBody(parked.checkpoint()[0]!).checkpoint).toEqual(saved);
    }finally{parked.dispose();}
  }finally{live.dispose();ledger.release();world.free();}
},120000);
