import {afterEach,beforeAll,expect,it,vi} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {createHvpOwnedHashBodyCutSession,type HvpBodyPlanHost,type HvpBodyChildProjection} from "../../src/hestia-prototype/physics/bodyCutSession";
import {prepareHvpBodyCutOwnedHashSteps} from "../../src/hestia-prototype/physics/bodyCut";
import {buildHvpBodyMeshInput,executeHvpBodyMeshJob,decodeHvpBodyMeshOutput,
  HVP_BODY_MESH_JOB,HVP_BODY_MESH_ALGORITHM,HVP_BODY_MESH_MAX_OUTPUT} from "../../src/workers/hvpBodyMeshJob";
import {algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey} from "../../src/workers/ids";
import type {WorkerJobRequest} from "../../src/workers/protocol";
import * as meshModule from "../../src/workers/hvpBodyMeshJob";

vi.mock("../../src/hestia-prototype/physics/bodyCut",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/hestia-prototype/physics/bodyCut")>();
  return {...actual,prepareHvpBodyCutOwnedHashSteps:vi.fn(actual.prepareHvpBodyCutOwnedHashSteps)};
});
beforeAll(initializeHvpRapier);
afterEach(()=>vi.restoreAllMocks());
const host:HvpBodyPlanHost={yieldTask:()=>new Promise<void>(resolve=>setTimeout(resolve,0)),assertCurrent:()=>{}};

type OwnerSession=ReturnType<typeof createHvpOwnedHashBodyCutSession>;
// Existing five-cell/x2-hit real native fixture; no second plan or synthetic native proof.
const withOwner=async(run:(session:OwnerSession,id:string,projection:HvpBodyChildProjection,world:R.World)=>Promise<void>,edge=1,residentBytes?:number)=>{
  vi.mocked(prepareHvpBodyCutOwnedHashSteps).mockClear();
  const world=new R.World({x:0,y:0,z:0});
  let session:ReturnType<typeof createHvpOwnedHashBodyCutSession>|undefined;
  try{
    const source=ingestHvpStructuralCells("mesh-owner-source",Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1})),
      [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
    const recipe=prepareHvpRigidBody(source),body=installHvpRigidBody(world,recipe);
    const target={ownerId:"mesh-owner-parent",body,recipe};
    session=createHvpOwnedHashBodyCutSession(world,new Map([[target.ownerId,target]]),new Map([[target.ownerId,body]]),"mesh-owner");
    const request={id:"mesh-owner-cut",ownerId:target.ownerId,sourceDigest:source.contentHash,edge,direction:{x:0,y:0,z:1}};
    session.begin(request,{x:.3125,y:.0625,z:-1},7);
    const projection=await session.prepareChildProjection(request.id,residentBytes===undefined?host:{...host,continuePlan:()=>true},residentBytes);
    expect(vi.mocked(prepareHvpBodyCutOwnedHashSteps)).toHaveBeenCalledTimes(1);
    await run(session,request.id,projection,world);
    expect(vi.mocked(prepareHvpBodyCutOwnedHashSteps)).toHaveBeenCalledTimes(1);
  }finally{try{if(session?.busy){session.rollback("mesh-owner-cut");}}finally{world.free();}}
};
const productsFor=async(projection:HvpBodyChildProjection)=>{
  const packed=buildHvpBodyMeshInput(projection);
  const request:WorkerJobRequest={jobId:workerJobId("mesh-owner-job"),jobKind:workerJobKind(HVP_BODY_MESH_JOB),targetKey:workerTargetKey(projection.ownerId),
    planningEpoch:planningEpoch(0),workerEpoch:workerEpoch(0),inputRevision:contentRevision(projection.revision),sourceInputDigest:packed.sourceInputDigest,
    algorithmVersion:algorithmVersion(HVP_BODY_MESH_ALGORITHM),priority:"Urgent",deadline:jobDeadline(1),
    estimatedInputBytes:packed.input.byteLength,estimatedOutputBytes:byteCount(HVP_BODY_MESH_MAX_OUTPUT),payload:packed.payload};
  const output=await executeHvpBodyMeshJob(request,packed.input,host);
  return decodeHvpBodyMeshOutput(request,projection,output.bundle);
};

it("rejects projected owner-route Stage until the retained plan has admitted complete geometry",()=>withOwner(async(session,id,projection,world)=>{
  const colliders=world.colliders.len();
  expect(()=>session.stage(id,projection,8)).toThrow("Body mesh owner admission required");
  expect(world.bodies.len()).toBe(1);expect(world.colliders.len()).toBe(colliders);expect(session.holdsWorld).toBe(false);
}));

it("admits mesh-only output against the single retained native plan before Stage, commit and finalize",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection),colliders=world.colliders.len();
  await session.admitChildMesh(id,products,host);
  expect(world.bodies.len()).toBe(1);expect(world.colliders.len()).toBe(colliders);expect(session.holdsWorld).toBe(false);
  session.stage(id,products,8);expect(session.holdsWorld).toBe(true);
  session.commit(id);session.finalize(id);
  expect(session.read().last?.status).toBe("Applied");expect(world.bodies.len()).toBe(2);expect(session.holdsWorld).toBe(false);
}));

it("rejects altered color geometry with stable first failure and no native Stage or retry revival",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection),part=products.parts[0]!,colors=part.mesh.colors!.slice();
  colors[0]=colors[0]===0?1:0;
  const bad={...products,parts:[{...part,mesh:{...part.mesh,colors}},...products.parts.slice(1)]};
  let first:unknown;try{await session.admitChildMesh(id,bad,host);}catch(error){first=error;}
  expect(first).toBeInstanceOf(Error);
  await expect(session.admitChildMesh(id,products,host)).rejects.toBe(first);
  let staged:unknown;try{session.stage(id,products,8);}catch(error){staged=error;}
  expect(staged).toBe(first);expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
}));

it("keeps a thrown real admission yield terminal without mutating the native World",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection),sentinel=new Error("admission yield failure");let yielded=0;
  await expect(session.admitChildMesh(id,products,{...host,yieldTask:async()=>{yielded+=1;throw sentinel;}})).rejects.toBe(sentinel);
  expect(yielded).toBe(1);await expect(session.admitChildMesh(id,products,host)).rejects.toBe(sentinel);
  expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
}));

it("keeps a packet decoder failure terminal before geometry work and rejects a later good packet",()=>withOwner(async(session,id,projection,world)=>{
  const first=new Error("first packet decoding failure"),decode=vi.fn(()=>{throw first;});
  await expect(session.admitChildMesh(id,decode,host)).rejects.toBe(first);
  const products=await productsFor(projection);
  await expect(session.admitChildMesh(id,products,host)).rejects.toBe(first);
  expect(decode).toHaveBeenCalledTimes(1);expect(()=>session.stage(id,products,8)).toThrow(first);
  expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
}));

it("cannot revive an admission after Rollback at a real verifier yield",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection);let yielded=0;
  await expect(session.admitChildMesh(id,products,{...host,yieldTask:async()=>{yielded+=1;session.rollback(id);await host.yieldTask();}})).rejects.toThrow("Stale body preparation");
  expect(yielded).toBe(1);expect(session.read().state).toBe("Idle");
  expect(()=>session.stage(id,products,8)).toThrow("Stale body preparation");
  expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
}));

it("preserves the first yielded failure when verifier cleanup also throws",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection),first=new Error("first admission failure"),cleanup=new Error("later verifier cleanup failure");
  const original=meshModule.verifyHvpBodyMeshPartsSteps;
  vi.spyOn(meshModule,"verifyHvpBodyMeshPartsSteps").mockImplementation(function*(plan,value){
    try{return yield* original(plan,value);}finally{throw cleanup;}
  });
  await expect(session.admitChildMesh(id,products,{...host,yieldTask:async()=>{throw first;}})).rejects.toBe(first);
  await expect(session.admitChildMesh(id,products,host)).rejects.toBe(first);
  expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
}));

it("admits an empty child set after complete legal removal without a first-part assumption",()=>withOwner(async(session,id,projection,world)=>{
  expect(projection.parts).toHaveLength(0);const products=await productsFor(projection);
  await session.admitChildMesh(id,products,host);expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
  session.stage(id,products,8);session.commit(id);session.finalize(id);
  expect(world.bodies.len()).toBe(0);expect(session.read().last).toMatchObject({status:"Applied",children:[],removedCells:5});
},8));

it("retains one borrowed owner ledger through mesh admission and transfers results only at Finalize",()=>withOwner(async(session,id,projection)=>{
  const prepared=session.resources();expect(prepared?.residentBytes).toBe(32*1024*1024);
  expect(prepared?.reservedBytes).toBeGreaterThan(0);expect(prepared?.hashReservations).toBeGreaterThan(3);
  const products=await productsFor(projection);await session.admitChildMesh(id,products,host);
  expect(session.resources()?.reservedBytes).toBeGreaterThanOrEqual(prepared!.reservedBytes);
  session.stage(id,products,8);session.commit(id);expect(session.resources()?.reservedBytes).toBeGreaterThan(0);
  session.finalize(id);expect(session.resources()?.reservedBytes).toBe(0);
  expect(session.resources()?.transferredResultEstimateBytes).toBeGreaterThan(0);
},1,32*1024*1024));

it("keeps a retired ledger until the suspended verifier actually closes",()=>withOwner(async(session,id,projection)=>{
  const products=await productsFor(projection);let resume:()=>void=()=>{},entered:()=>void=()=>{};
  const waiting=new Promise<void>(resolve=>{entered=resolve;});
  const admission=session.admitChildMesh(id,products,{...host,yieldTask:()=>{entered();return new Promise<void>(resolve=>{resume=resolve;});}});
  const rejected=expect(admission).rejects.toThrow("Stale body preparation");await waiting;
  session.rollback(id);expect(session.read().state).toBe("Idle");expect(session.resources()?.reservedBytes).toBeGreaterThan(0);
  expect(session.busy).toBe(true);expect(()=>session.checkpoint()).toThrow("confirmed ownership");
  resume();await rejected;expect(session.resources()?.reservedBytes).toBe(0);
  expect(session.resources()?.transferredResultEstimateBytes).toBe(0);
},1,32*1024*1024));

it.each([undefined,32*1024*1024])("cannot switch the budget of an already derived plan (%s)",residentBytes=>withOwner(async(session,id)=>{
  const budget=residentBytes===undefined?32*1024*1024:64*1024*1024;
  await expect(session.prepareChildProjection(id,host,budget)).rejects.toThrow("Cannot change the started body owner budget");
},1,residentBytes));

it("closes owner scratch on Dispose and retains credits until its suspended admission returns",()=>withOwner(async(session,id,projection)=>{
  const products=await productsFor(projection);let resume:()=>void=()=>{},entered:()=>void=()=>{};
  const waiting=new Promise<void>(resolve=>{entered=resolve;});
  const admission=session.admitChildMesh(id,products,{...host,yieldTask:()=>{entered();return new Promise<void>(resolve=>{resume=resolve;});}});
  const rejected=expect(admission).rejects.toThrow("Stale body preparation");await waiting;session.dispose();
  expect(session.resources()?.reservedBytes).toBeGreaterThan(0);resume();await rejected;
  expect(session.busy).toBe(false);expect(session.resources()?.reservedBytes).toBe(0);
},1,32*1024*1024));
