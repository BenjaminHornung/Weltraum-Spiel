import {beforeAll,beforeEach,expect,it,vi} from "vitest";
import {createSyntheticAuthoredCodecFixtures} from "../fixtures/phy01LabCodecFixtures";
import {decodeHvpGame,decodeHvpLabGame,encodeHvpLabGame,type HvpDecodedLabGame} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import {createHvpLabPhysicsSession,createHvpPhysicsSession} from "../../src/hestia-prototype/physics/session";
import {resolveHvpGravity} from "../../src/hestia-prototype/physics/profile";
import {hvpCollisionDigest} from "../../src/hestia-prototype/persistence/worldCheckpoint";

const nativeAdmission=vi.hoisted(()=>({initializeCalls:0,worldConstructorCalls:0,sentinel:new Error("FAKE_RAPIER_WORLD_SENTINEL") }));
vi.mock("../../src/hestia-prototype/physics/rapierPort",()=>({
  R:{World:class {constructor(){nativeAdmission.worldConstructorCalls+=1;throw nativeAdmission.sentinel;}}},
  initializeHvpRapier:async()=>{nativeAdmission.initializeCalls+=1;},
  isHvpSolidCollider:()=>true
}));
vi.mock("../../src/workers/hvpBoundedPump",()=>({createHvpBodyMeshTaskPump:()=>{throw new Error("UNEXPECTED_WORKER_PUMP");}}));
vi.mock("../../src/workers/hvpBodyMeshJob",()=>({
  decodeHvpBodyMeshOutput:()=>{throw new Error("UNEXPECTED_WORKER_OUTPUT");},
  decodeHvpBodyMeshOutputSteps:()=>{throw new Error("UNEXPECTED_WORKER_OUTPUT");}
}));

let fixtures:ReturnType<typeof createSyntheticAuthoredCodecFixtures>;
beforeAll(()=>{fixtures=createSyntheticAuthoredCodecFixtures();});
beforeEach(()=>{nativeAdmission.initializeCalls=0;nativeAdmission.worldConstructorCalls=0;});

const createLabSession=(game:HvpDecodedLabGame)=>createHvpLabPhysicsSession([], {x:0,y:4,z:0},resolveHvpGravity(),
  undefined,undefined,undefined,"synthetic-codec",game);

it("admits an issued synthetic lab game through validation and stops at the fake World constructor",async()=>{
  const {version:_version,profiles:_profiles,signature:_signature,...data}=fixtures.lab;
  const checkpoint=encodeHvpLabGame({...data,world:{...fixtures.lab.world,collisionDigest:hvpCollisionDigest([])}});
  const issued=decodeHvpLabGame(checkpoint);
  await expect(createLabSession(issued)).rejects.toBe(nativeAdmission.sentinel);
  expect(nativeAdmission.initializeCalls).toBe(1);
  expect(nativeAdmission.worldConstructorCalls).toBe(1);
});

it("rejects raw and public-admitted game values before fake Native initialization",async()=>{
  await expect(createLabSession(fixtures.lab as unknown as HvpDecodedLabGame)).rejects.toThrow(/Unvalidated Hestia lab restore candidate/);
  const publicGame=decodeHvpGame(fixtures.legacy);
  await expect(createLabSession(publicGame as unknown as HvpDecodedLabGame)).rejects.toThrow(/Unvalidated Hestia lab restore candidate/);
  expect(nativeAdmission.initializeCalls).toBe(0);
  expect(nativeAdmission.worldConstructorCalls).toBe(0);
});

it("rejects a lab collision digest that does not match the supplied empty sector set before fake Native initialization",async()=>{
  const expected=hvpCollisionDigest([]),wrong=expected==="00000000"?"ffffffff":"00000000";
  const {version:_version,profiles:_profiles,signature:_signature,...data}=fixtures.lab;
  const checkpoint=encodeHvpLabGame({...data,world:{...fixtures.lab.world,collisionDigest:wrong}});
  await expect(createLabSession(decodeHvpLabGame(checkpoint))).rejects.toThrow(/Saved collision does not match candidate sources/);
  expect(nativeAdmission.initializeCalls).toBe(0);
  expect(nativeAdmission.worldConstructorCalls).toBe(0);
});

it("revalidates an issued checkpoint if its signature can be changed",async()=>{
  const {version:_version,profiles:_profiles,signature:_signature,...data}=fixtures.lab;
  const issued=decodeHvpLabGame(encodeHvpLabGame({...data,world:{...fixtures.lab.world,collisionDigest:hvpCollisionDigest([])}}));
  const changed=Reflect.set(issued.checkpoint,"signature","forged");
  if(changed){await expect(createLabSession(issued)).rejects.toThrow(/Hestia save signature mismatch/);}
  else{expect(Object.isFrozen(issued.checkpoint)).toBe(true);}
  expect(nativeAdmission.initializeCalls).toBe(0);
  expect(nativeAdmission.worldConstructorCalls).toBe(0);
});

it("keeps the public restore guard ahead of fake Native initialization",async()=>{
  await expect(createHvpPhysicsSession([], {x:0,y:4,z:0},resolveHvpGravity(),undefined,undefined,undefined,
    "synthetic-codec",fixtures.legacy.world)).rejects.toThrow(/noch nicht freigegeben/);
  expect(nativeAdmission.initializeCalls).toBe(0);
  expect(nativeAdmission.worldConstructorCalls).toBe(0);
});

it("rejects invalid inertia admission before fake Native initialization",async()=>{
  await expect(createHvpLabPhysicsSession([], {x:0,y:4,z:0},resolveHvpGravity(),undefined,
    {x:Number.NaN,y:0,z:0})).rejects.toThrow(/Invalid inertia spawn/);
  expect(nativeAdmission.initializeCalls).toBe(0);
  expect(nativeAdmission.worldConstructorCalls).toBe(0);
});

it("rejects collider budget admission before fake Native initialization",async()=>{
  const sector={vertices:new Float32Array(9),indices:new Uint32Array([0,1,2])};
  await expect(createHvpLabPhysicsSession(Array.from({length:4094},()=>sector),{x:0,y:4,z:0},resolveHvpGravity(),
    undefined,undefined,{x:0,y:0,z:0})).rejects.toThrow(/Physics collider BudgetExceeded/);
  expect(nativeAdmission.initializeCalls).toBe(0);
  expect(nativeAdmission.worldConstructorCalls).toBe(0);
});
