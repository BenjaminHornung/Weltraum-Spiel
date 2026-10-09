import {expect,it,vi} from "vitest";
import body384 from "../fixtures/hvp-contact-r90-body384.json";
import {createHvpPhysicsSession,createHvpWorkerPhysicsSession} from "../../src/hestia-prototype/physics/session";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import * as restore from "../../src/hestia-prototype/physics/restoreBody";
import {isOwnedStructuralGraph} from "../../src/voxel/structural/model";
import * as model from "../../src/voxel/structural/model";
import {decodeHvpColdWorld,decodeHvpWorld,hvpColdWorldAllocationBytes} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../../src/voxel/adaptive";
import {serializeCanonicalPersistenceValue} from "../../src/persistence";
import {prepareHvpLocalBodyCut} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {decodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import * as branchOwner from "../../src/hestia-prototype/physics/branchSession";

const floor={sizeX:64,sizeY:8,sizeZ:64,cellMeters:.125,originMeters:{x:-4,y:-.125,z:-4},readSlot:(_x:number,y:number,_z:number)=>y===0?1:0};
const savedWorld=async(allFamilies=false)=>{
  const sectors=[...collisionSectors(floor)],spawn={x:-2,y:3,z:-2};
  const source=await createHvpPhysicsSession(sectors,spawn,9.81,undefined,allFamilies?{x:2,y:2,z:2}:undefined,allFamilies?{x:0,y:0,z:0}:undefined,"cold-worker-ancestor");
  try{source.pause();const saved=source.checkpoint();return {sectors,spawn,saved:{...saved,
    bodies:[...saved.bodies,allFamilies?{...body384,sleeping:true}:body384],...(allFamilies?{parked:[body384.ownerId]}:{})}};}
  finally{source.dispose();}
};
it("includes fresh Inertia and every retained Fixed branch recipe and Source in the private resident union",async()=>{
  const sectors=[...collisionSectors(floor)],spawn={x:-2,y:3,z:-2},factory=branchOwner.createHvpBranchSession;
  let branch:ReturnType<typeof factory>|undefined;
  const observed=vi.spyOn(branchOwner,"createHvpBranchSession").mockImplementation((...args)=>{branch=factory(...args);return branch;});
  const worker=await createHvpWorkerPhysicsSession(sectors,spawn,9.81,undefined,{x:2,y:2,z:2},{x:0,y:0,z:0},"fresh-worker-static-union");
  try{
    worker.pause();const saved=worker.checkpoint(),inertia=decodeHvpBody(saved.bodies.find(body=>body.family==="inertia")!).recipe;
    const recipes=new Set(branch!.retainedRecipes());
    let expected=64+inertia.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES+4096+inertia.colliders.length*256;
    for(const recipe of recipes){expected+=recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES+4096+recipe.colliders.length*256;}
    const recipeSources=new Set([...recipes].map(recipe=>recipe.source));
    for(const source of new Set(branch!.retainedSources())){if(!recipeSources.has(source)){expected+=source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES;}}
    expect(expected).toBeGreaterThan(64);expect(worker.read().bodySourceResidentBytes).toBe(expected);
    expect(saved.bodies.map(body=>body.family).sort()).toEqual(["branch","drop","inertia"]);
  }finally{worker.dispose();observed.mockRestore();branch=undefined;}
  expect(worker.read()).toMatchObject({bodyCount:0,colliderCount:0,bodySourceResidentBytes:0});
},120_000);
it("restores the actual saved Body384 into the Worker with an owned ancestor before Ready and identical native Save",async()=>{
  const {sectors,spawn,saved}=await savedWorld();
  const control=await createHvpPhysicsSession(sectors,spawn,9.81,undefined,undefined,undefined,"cold-worker-ancestor",saved!);
  let expected:ReturnType<typeof control.checkpoint>;
  try{expected=control.checkpoint();}finally{control.dispose();}
  const nativeRestore=restore.restoreHvpBody;let recipe:Parameters<typeof nativeRestore>[1]["recipe"]|undefined;
  const observed=vi.spyOn(restore,"restoreHvpBody").mockImplementation((world,data)=>{
    if(data.checkpoint.ownerId===body384.ownerId){recipe=data.recipe;}return nativeRestore(world,data);
  });
  const worker=await createHvpWorkerPhysicsSession(sectors,spawn,9.81,undefined,undefined,undefined,"cold-worker-ancestor",saved!);
  try{
    expect(recipe?.mass.occupiedVoxelCount).toBe(384);
    expect(isOwnedStructuralGraph(recipe!.source)).toBe(true);
    expect(serializeCanonicalPersistenceValue(worker.checkpoint())).toBe(serializeCanonicalPersistenceValue(expected!));
    expect(worker.read()).toMatchObject({status:"Paused",bodyCount:2});
    expect(worker.read().bodySourceResidentBytes).toBeGreaterThan(0);
  }finally{worker.dispose();observed.mockRestore();}
  expect(worker.read()).toMatchObject({bodyCount:0,colliderCount:0,bodySourceResidentBytes:0});
},120_000);

it("accounts the exact initial retained union for Drop Inertia Fixed and Parked recipes without a duplicate active-recipe charge",async()=>{
  const {sectors,spawn,saved}=await savedWorld(true),factory=model.createStructuralOwnerLedger;
  const decoded=decodeHvpWorld(saved);
  expect(decoded.bodies.map(body=>body.checkpoint.family).sort()).toEqual(["branch","drop","inertia","terrain"]);
  expect(saved.parked).toEqual([body384.ownerId]);
  let retained=-1;
  const observed=vi.spyOn(model,"createStructuralOwnerLedger").mockImplementation((...args)=>{
    const ledger=factory(...args),release=ledger.release;
    ledger.release=(completed=false)=>{retained=ledger.resources.retainedEstimateBytes;release(completed);};
    return ledger;
  });
  let worker:Awaited<ReturnType<typeof createHvpWorkerPhysicsSession>>|undefined;
  try{
    worker=await createHvpWorkerPhysicsSession(sectors,spawn,9.81,undefined,undefined,undefined,"cold-worker-ancestor",saved);
    const allocation=hvpColdWorldAllocationBytes(saved);
    const branchBytes=(decoded.branchSource?.bricks.length??0)*ADAPTIVE_BRICK_ESTIMATED_BYTES;
    expect(retained).toBeGreaterThan(64);
    expect(worker.read().bodySourceResidentBytes).toBe(retained+allocation.checkpointBytes+branchBytes+4096+64);
    expect(worker.read().parked).toHaveLength(1);
    expect(serializeCanonicalPersistenceValue(worker.checkpoint())).toBe(serializeCanonicalPersistenceValue(saved));
  }finally{worker?.dispose();observed.mockRestore();}
  expect(worker!.read().bodySourceResidentBytes).toBe(0);
},120_000);

it("keeps the initial Cold recipe charged while adding only real recut children",async()=>{
  const sectors=[...collisionSectors(floor)],spawn={x:-2,y:3,z:-2},sessionId="cold-worker-recut";
  const player={spawn:{x:.75,y:.92,z:-1},coverage:[{minX:-4,maxX:4,minZ:-4,maxZ:4}]};
  const aimAt=(point:{x:number;y:number;z:number},position:{x:number;y:number;z:number})=>{
    const dx=point.x-position.x,dy=point.y-(position.y+.75),dz=point.z-position.z,length=Math.hypot(dx,dy,dz);
    return {x:dx/length,y:dy/length,z:dz/length};
  };
  const source=await createHvpPhysicsSession(sectors,spawn,9.81,player,{x:2,y:2,z:2},{x:0,y:0,z:0},sessionId);
  let saved:ReturnType<typeof source.checkpoint>,parentId:string;
  try{
    source.play();source.advance(1/60);
    source.prepareBranch({id:"release",generation:0,sourceDigest:source.read().structural!.sourceDigest,
      direction:aimAt({x:.75,y:1.25,z:0},source.read().player!.position)});
    source.commitBranch("release");source.finalizeBranch("release");
    parentId=source.read().structural!.parts.find(part=>!part.anchored)!.ownerId;
    source.pause();saved=source.checkpoint();
    expect(saved.bodies.find(body=>body.ownerId===parentId)).toMatchObject({family:"branch",dynamic:true});
    expect(saved.branch!.source).toBeNull();
  }finally{source.dispose();}
  const factory=model.createStructuralOwnerLedger;let retained=-1;
  const observed=vi.spyOn(model,"createStructuralOwnerLedger").mockImplementation((...args)=>{
    const ledger=factory(...args),release=ledger.release;
    ledger.release=(completed=false)=>{retained=ledger.resources.retainedEstimateBytes;release(completed);};return ledger;
  });
  let cold:Awaited<ReturnType<typeof createHvpWorkerPhysicsSession>>|undefined;
  try{
    cold=await createHvpWorkerPhysicsSession(sectors,spawn,9.81,undefined,undefined,undefined,sessionId,saved!);
    observed.mockRestore();
    const baseline=retained+hvpColdWorldAllocationBytes(saved!).checkpointBytes+4096+64;
    expect(cold.read().bodySourceResidentBytes).toBe(baseline);
    expect(serializeCanonicalPersistenceValue(cold.checkpoint())).toBe(serializeCanonicalPersistenceValue(saved!));
    cold.play();
    const parent=cold.read().structural!.parts.find(part=>part.ownerId===parentId!)!;
    const direction=aimAt(parent.position,cold.read().player!.position);
    cold.aimBranch(direction);const hit=cold.read().moving.preview!;
    expect(hit.ownerId).toBe(parentId!);
    const prep=cold.beginBodyCut({id:"cold-recut",ownerId:parentId!,sourceDigest:hit.sourceDigest,edge:1,direction});
    const payload=prep.payload,local=prepareHvpLocalBodyCut(ingestHvpStructuralCells(payload.sourceId,prep.cells,payload.materials),
      payload.cell,payload.commandId,payload.edge);
    const admission={removedCells:local.plan.removedCells,removedMassKg:local.plan.removedMassKg,parts:local.plan.parts.map(part=>({
      ownerId:part.ownerId,sourceDigest:part.recipe.source.contentHash,massKg:part.recipe.mass.totalMassKg,center:part.recipe.mass.centerOfMassMeters!}))};
    await cold.prepareBodyCutPlan("cold-recut");cold.stageBodyCut("cold-recut",admission);
    cold.commitBodyCut("cold-recut");cold.finalizeBodyCut("cold-recut");cold.pause();
    const checkpoint=cold.checkpoint(),receipt=cold.read().moving.last!;
    expect(receipt.status).toBe("Applied");expect(receipt.children.length).toBeGreaterThan(0);
    expect(checkpoint.bodies.some(body=>body.ownerId===parentId!)).toBe(false);
    const children=checkpoint.bodies.filter(body=>receipt.children.includes(body.ownerId));
    expect(children).toHaveLength(receipt.children.length);
    const childBytes=children.reduce((bytes,body)=>{const recipe=decodeHvpBody(body).recipe;
      return bytes+recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES+4096+recipe.colliders.length*256;},0);
    expect(cold.read().bodySourceResidentBytes).toBe(baseline+childBytes);
  }finally{cold?.dispose();observed.mockRestore();}
  expect(cold!.read()).toMatchObject({bodyCount:0,colliderCount:0,bodySourceResidentBytes:0});
},120_000);

it("publishes retained Recipe identities only after complete World validation and preserves hash quantum and exact decode JSON",async()=>{
  const {saved}=await savedWorld(),ledger=model.createStructuralOwnerLedger(32*1024*1024,undefined,128);
  const expected=decodeHvpWorld(saved),records:{recipe:typeof expected.bodies[number]["recipe"];bytes:number}[]=[];
  try{
    const actual=decodeHvpColdWorld(saved,ledger.reserve,(recipe,bytes)=>records.push({recipe,bytes}));
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    expect(records).toHaveLength(saved.bodies.length);
    expect(records.reduce((bytes,record)=>bytes+record.bytes,0)).toBe(ledger.resources.retainedEstimateBytes);
    expect(ledger.resources.hashReservations).toBeGreaterThan(0);
    for(const [index,record] of records.entries()){
      expect(record.recipe).toBe(actual.bodies[index]!.recipe);
      expect(isOwnedStructuralGraph(record.recipe.source)).toBe(true);
      expect(record.bytes).toBeGreaterThan(0);
    }
    const malformed={...saved,bodies:saved.bodies.map((body,index)=>index===0?{...body,dynamic:false}:body)};
    records.length=0;
    expect(()=>decodeHvpColdWorld(malformed,ledger.reserve,(recipe,bytes)=>records.push({recipe,bytes}))).toThrow(/owner membership/);
    expect(records).toEqual([]);
  }finally{ledger.release();}
  expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
},120_000);

it("rejects Worker Cold preparation over the unchanged cap before native restoration and releases its ledger",async()=>{
  const {sectors,spawn,saved}=await savedWorld(),factory=model.createStructuralOwnerLedger;
  let ledger:ReturnType<typeof factory>|undefined;
  const constrained=vi.spyOn(model,"createStructuralOwnerLedger").mockImplementation((resident,_limit,hashUnits)=>{
    ledger=factory(resident,1,hashUnits);return ledger;
  });
  const nativeRestore=vi.spyOn(restore,"restoreHvpBody");
  try{
    await expect(createHvpWorkerPhysicsSession(sectors,spawn,9.81,undefined,undefined,undefined,"cold-worker-ancestor",saved))
      .rejects.toThrow(/Prepare96MiB|CPU256MiB/);
    expect(nativeRestore).not.toHaveBeenCalled();
    expect(ledger!.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
  }finally{constrained.mockRestore();nativeRestore.mockRestore();}
},120_000);
