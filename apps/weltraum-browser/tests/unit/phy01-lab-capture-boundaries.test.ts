import {beforeEach,expect,it,vi} from "vitest";
import {createSyntheticAuthoredCodecFixtures} from "../fixtures/phy01LabCodecFixtures";
import {decodeHvpLabGame,encodeHvpLabGame,type HvpDecodedLabGame} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import {hvpCollisionDigest} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import {createHvpChunkLabPhysicsSession,createHvpLabReplacementCandidate,issueHvpLabWorldReplacementCapture,
  ownHvpLabCompleteCollisionSectors,ownHvpLabReplacementMeshes,type HvpLabPhysicsSession,type HvpLabWorldReplacementCaptureWitness}
  from "../../src/hestia-prototype/physics/session";
import {resolveHvpGravity} from "../../src/hestia-prototype/physics/profile";
import {collisionSectors,type HvpCollisionSector} from "../../src/hestia-prototype/physics/terrainColliders";
import type {HvpChunkStaticLayout} from "../../src/hestia-prototype/physics/staticTerrainLayout";
import {createHvpEastRegion} from "../../src/hestia-prototype/runtime/regionSource";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";

const native=vi.hoisted(()=>({init:vi.fn(),world:vi.fn()}));
vi.mock("../../src/hestia-prototype/physics/rapierPort",()=>({
  R:{World:class {constructor(){native.world();throw new Error("UNEXPECTED_NATIVE_WORLD");}}},
  initializeHvpRapier:()=>{native.init();throw new Error("UNEXPECTED_NATIVE_INIT");},isHvpSolidCollider:()=>true
}));
beforeEach(()=>{native.init.mockClear();native.world.mockClear();});
const mesh=()=>({vertices:new Float32Array([0,0,0,1,0,0,0,1,0]),indices:new Uint32Array([0,1,2])});
const noNative=()=>{expect(native.init).not.toHaveBeenCalled();expect(native.world).not.toHaveBeenCalled();};
const labLayout:HvpChunkStaticLayout=Object.freeze({version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256});
const emptySector=():HvpCollisionSector=>({vertices:new Float32Array(0),indices:new Uint32Array(0)});
const floor={sizeX:8,sizeY:4,sizeZ:8,cellMeters:.125,originMeters:{x:0,y:0,z:0},
  readSlot:(_x:number,y:number,_z:number)=>y===0?1:0};
const makeLabGame=(sectors:readonly HvpCollisionSector[],neighborRoot?:ReturnType<typeof createHvpTerrainRoot>,digest=hvpCollisionDigest(sectors))=>{
  const {lab}=createSyntheticAuthoredCodecFixtures(),{version:_version,profiles:_profiles,signature:_signature,...data}=lab;
  const world={...lab.world,collisionDigest:digest,
    coverage:neighborRoot?[...lab.world.coverage,{minX:16,maxX:48,minZ:-16,maxZ:16}]:lab.world.coverage,
    neighbor:neighborRoot?{
    version:"hvp-neighbor-world-v1" as const,epoch:1,resident:true,sourceDigest:neighborRoot.read().sourceDigest,baseSectorCount:257
  }:null};
  return decodeHvpLabGame(encodeHvpLabGame({...data,world,...(neighborRoot?{neighbor:{version:"hvp-neighbor-scene-v1" as const,
    terrain:neighborRoot.checkpoint(),lod:.125 as const}}:{})}));
};

it("owns exact subview bytes after debit and ignores later caller mutation",()=>{
  const input=mesh(),vertices=new Float32Array(24),indices=new Uint32Array(12);
  vertices.set(input.vertices,3);indices.set(input.indices,2);
  const borrowed={vertices:vertices.subarray(3,12),indices:indices.subarray(2,5)},debits:number[]=[];
  const copy=ownHvpLabReplacementMeshes([{index:0,mesh:borrowed}],bytes=>{debits.push(bytes);})[0]!.mesh;
  expect(debits).toContain(vertices.buffer.byteLength+indices.buffer.byteLength);
  expect(debits).toContain(borrowed.vertices.byteLength+borrowed.indices.byteLength);
  expect(Array.from(copy.vertices)).toEqual(Array.from(input.vertices));expect(Array.from(copy.indices)).toEqual([0,1,2]);
  expect(copy.vertices.buffer).not.toBe(vertices.buffer);expect(copy.indices.buffer).not.toBe(indices.buffer);
  vertices.fill(99);indices.fill(2);
  expect(copy.vertices[0]).toBe(0);expect(copy.indices[0]).toBe(0);noNative();
});

it("owns a dense complete catalogue before caller buffers can change",()=>{
  const input=Array.from({length:513},()=>({vertices:new Float32Array(0),indices:new Uint32Array(0)}));
  const source=mesh(),debits:number[]=[],backingBytes=source.vertices.buffer.byteLength+source.indices.buffer.byteLength;
  input[17]=source;let changedDuringDebit=false;
  const owned=ownHvpLabCompleteCollisionSectors(input,bytes=>{
    debits.push(bytes);
    if(!changedDuringDebit&&bytes===backingBytes){source.vertices[0]=-1;changedDuringDebit=true;}
  });
  expect(owned).toHaveLength(513);
  expect(debits).toContain(backingBytes);expect(changedDuringDebit).toBe(true);
  expect(debits).toContain(source.vertices.byteLength+source.indices.byteLength);
  expect(owned[17]!.vertices.buffer).not.toBe(source.vertices.buffer);
  source.vertices.fill(99);source.indices.fill(2);
  expect(owned[17]!.vertices[0]).toBe(-1);expect(owned[17]!.indices[0]).toBe(0);noNative();
});

it("rejects sparse or accessor-backed complete catalogues without invoking accessors",()=>{
  const getter=vi.fn(()=>mesh()),sparse=new Array(256);
  expect(()=>ownHvpLabCompleteCollisionSectors(sparse,()=>{})).toThrow();
  const accessor=Array.from({length:256},()=>({vertices:new Float32Array(0),indices:new Uint32Array(0)}));
  Object.defineProperty(accessor,"3",{get:getter,enumerable:true});
  expect(()=>ownHvpLabCompleteCollisionSectors(accessor,()=>{})).toThrow();
  expect(getter).not.toHaveBeenCalled();noNative();
});

it("rejects a complete catalogue that grows during its first reservation",()=>{
  const input=Array.from({length:256},emptySector);let first=true;
  expect(()=>ownHvpLabCompleteCollisionSectors(input,()=>{
    if(first){first=false;input.push(mesh());}
  })).toThrow(/LAB complete collision list changed during validation/);
  expect(input).toHaveLength(257);noNative();
});

it("rejects a complete LAB collision-digest mismatch before Native initialization",async()=>{
  const sectors=[...Array.from({length:256},emptySector),...collisionSectors(floor)];
  const digest=hvpCollisionDigest(sectors),wrong=digest==="00000000"?"ffffffff":"00000000";
  const game=makeLabGame(sectors,undefined,wrong);
  await expect(createHvpChunkLabPhysicsSession(labLayout,sectors,{x:0,y:4,z:0},resolveHvpGravity(),
    undefined,undefined,undefined,"synthetic-codec",game)).rejects.toThrow(/Saved collision does not match candidate sources/);
  noNative();
});

it("rejects resident neighbor XYZ outside the complete 256/256 catalogue before Native initialization",async()=>{
  const primary=[...Array.from({length:256},emptySector),...collisionSectors(floor)];
  const neighborRoot=createHvpTerrainRoot(await createHvpEastRegion(),"synthetic-codec-east",0);
  const neighbors=Array.from({length:256},emptySector);
  neighbors[0]={vertices:new Float32Array([100,-8,-16,101,-8,-16,100,-7,-16]),indices:new Uint32Array([0,1,2])};
  const sectors=[...primary,...neighbors],game=makeLabGame(sectors,neighborRoot);
  expect(sectors).toHaveLength(513);
  await expect(createHvpChunkLabPhysicsSession(labLayout,sectors,{x:0,y:4,z:0},resolveHvpGravity(),
    undefined,undefined,undefined,"synthetic-codec",game)).rejects.toThrow(/Invalid neighbour collision geometry/);
  noNative();
});

it("rejects accessor and sparse records without invoking their getters",()=>{
  const getter=vi.fn(()=>mesh()),record={index:0};Object.defineProperty(record,"mesh",{get:getter,enumerable:true});
  expect(()=>ownHvpLabReplacementMeshes([record],()=>{})).toThrow();
  const sparse=new Array(1);Object.defineProperty(sparse,"0",{get:getter,enumerable:true});
  expect(()=>ownHvpLabReplacementMeshes(sparse,()=>{})).toThrow();
  const hole=new Array(1);expect(()=>ownHvpLabReplacementMeshes(hole,()=>{})).toThrow();
  expect(getter).not.toHaveBeenCalled();noNative();
});

it("rejects a typed-array subclass and a shadowing typed-array getter",()=>{
  class ForeignFloat32 extends Float32Array {}
  const input=mesh();expect(()=>ownHvpLabReplacementMeshes([{index:0,mesh:{...input,vertices:new ForeignFloat32(9)}}],()=>{})).toThrow(/Exact collision/);
  const getter=vi.fn(()=>9);Object.defineProperty(input.vertices,"length",{get:getter});
  expect(()=>ownHvpLabReplacementMeshes([{index:0,mesh:input}],()=>{})).toThrow(/Exact collision/);
  expect(getter).not.toHaveBeenCalled();noNative();
});

it("rejects SharedArrayBuffer and resizable ArrayBuffer inputs",()=>{
  const input=mesh(),shared=new Float32Array(new SharedArrayBuffer(36));
  expect(()=>ownHvpLabReplacementMeshes([{index:0,mesh:{...input,vertices:shared}}],()=>{})).toThrow(/fixed collision/i);
  const resizable=Reflect.construct(ArrayBuffer,[36,{maxByteLength:72}]) as ArrayBuffer;
  expect(Reflect.get(resizable,"resizable")).toBe(true);
  expect(()=>ownHvpLabReplacementMeshes([{index:0,mesh:{...input,vertices:new Float32Array(resizable)}}],()=>{})).toThrow(/Fixed collision/);
  noNative();
});

it("applies CPU256 and Prepare96 admission before any result can be published",()=>{
  const input=mesh(),backing=new ArrayBuffer(8*1024*1024),vertices=new Float32Array(backing,0,9);
  const cpu=createStructuralOwnerLedger(250*1024*1024),prepare=createStructuralOwnerLedger(0,1024);
  try{
    expect(()=>ownHvpLabReplacementMeshes([{index:0,mesh:{...input,vertices}}],cpu.reserve)).toThrow(/CPU256MiB/);
    expect(()=>ownHvpLabReplacementMeshes([{index:0,mesh:{...input,vertices}}],prepare.reserve)).toThrow(/Prepare96MiB/);
    const full=Array.from({length:256},()=>({vertices:new Float32Array(0),indices:new Uint32Array(0)}));
    full[0]={...input,vertices};
    expect(()=>ownHvpLabCompleteCollisionSectors(full,cpu.reserve)).toThrow(/CPU256MiB/);
  }finally{cpu.release();prepare.release();}
  expect(cpu.resources.reservedBytes).toBe(0);expect(prepare.resources.reservedBytes).toBe(0);noNative();
});

it("cannot turn a fabricated owner, Game or witness into capture authority",async()=>{
  const checkpoint=vi.fn(),collision=vi.fn(),owner={checkpoint,copyCollision:collision} as unknown as HvpLabPhysicsSession;
  const game={} as HvpDecodedLabGame,witness=Object.freeze({}) as HvpLabWorldReplacementCaptureWitness;
  expect(()=>issueHvpLabWorldReplacementCapture(owner,game,[],()=>true)).toThrow(/Unvalidated/);
  await expect(createHvpLabReplacementCandidate(witness,game,[],false)).rejects.toThrow(/Invalid or consumed/);
  expect(checkpoint).not.toHaveBeenCalled();expect(collision).not.toHaveBeenCalled();noNative();
});
