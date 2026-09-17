import {expect,it,vi} from "vitest";
import {createHvpPhysicsSession} from "../../src/hestia-prototype/physics/session";
import {prepareHvpWorldReplacement} from "../../src/hestia-prototype/physics/worldReplacement";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";

const floor={sizeX:8,sizeY:4,sizeZ:8,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number,_z:number)=>y===0?1:0};
const facts=(s:Awaited<ReturnType<typeof createHvpPhysicsSession>>)=>{const {stepCpuMs:_diagnostic,...state}=s.read();return state;};
it("keeps A alive through B preparation/rollback, and removes A only after explicit finalization",async()=>{
  const a=await createHvpPhysicsSession([...collisionSectors(floor)],{x:.5,y:2,z:.5});
  a.advance(1/60);a.pause();const before=facts(a),saved=a.checkpoint();
  const first=await prepareHvpWorldReplacement(a,saved,[]);
  expect(facts(a)).toEqual(before);expect(facts(first.candidate)).toEqual(before);
  const b=first.commit();expect(facts(b)).toEqual(before);expect(a.read().bodyCount).toBe(1);
  expect(first.rollback()).toBe(a);expect(first.candidate.read().bodyCount).toBe(0);expect(facts(a)).toEqual(before);
  const second=await prepareHvpWorldReplacement(a,saved,[]);second.commit();second.finalize();
  expect(a.read().status).toBe("Disposed");expect(facts(second.candidate)).toEqual(before);
  second.candidate.resume();second.candidate.advance(1/60);expect(second.candidate.read().ticks).toBe(2);second.dispose();
});
it("fails candidate creation without deleting A, and reports uncertain retirement as RecoveryHold",async()=>{
  const a=await createHvpPhysicsSession([...collisionSectors(floor)],{x:.5,y:2,z:.5});a.pause();const before=a.read();
  await expect(prepareHvpWorldReplacement(a,{...a.checkpoint(),collisionDigest:"00000000"},[])).rejects.toThrow(/collision/);
  expect(a.read()).toEqual(before);
  const tx=await prepareHvpWorldReplacement(a,a.checkpoint(),[]);tx.commit();
  const dispose=vi.spyOn(a,"dispose").mockImplementationOnce(()=>{throw new Error("injected old-world retirement");});
  expect(()=>tx.finalize()).toThrow(/RecoveryHold/);expect(tx.state).toBe("RecoveryHold");
  expect(tx.candidate.read().status).toBe("Paused");expect(()=>tx.rollback()).toThrow(/RecoveryHold/);
  dispose.mockRestore();tx.dispose();expect(a.read().bodyCount).toBe(0);expect(tx.candidate.read().bodyCount).toBe(0);
});

it("restores between absent and resident eastern collision without changing the live World early",async()=>{
  const make=(x:number)=>({sizeX:256,sizeY:8,sizeZ:256,cellMeters:.125,originMeters:{x,y:-.125,z:-16},
    readSlot:(_x:number,y:number,_z:number)=>y===0?1:0});
  const aSource=make(-16),bSource=make(16);
  const aMeshes=[...collisionSectors(aSource)];
  const bMeshes=[...collisionSectors({...bSource,readHaloSlot:(x,y,z)=>x<0?aSource.readSlot(x+256,y,z):undefined})];
  const joined=[...collisionSectors({...aSource,readHaloSlot:(x,y,z)=>x>=256?bSource.readSlot(x-256,y,z):undefined})];
  const edge=(list:typeof aMeshes)=>list.flatMap((mesh,index)=>index%8===7?[{index,mesh}]:[]);
  const a=await createHvpPhysicsSession(aMeshes,{x:-12,y:2,z:0});a.pause();const absent=a.checkpoint();
  const binding={version:"hvp-neighbor-world-v1" as const,epoch:1,resident:true,sourceDigest:"12345678",baseSectorCount:64};
  a.prepareNeighbor("enter",binding,bMeshes,edge(joined));a.commitNeighbor("enter");a.finalizeNeighbor("enter");
  const resident=a.checkpoint();
  a.prepareNeighbor("leave",{...binding,epoch:2,resident:false},[],edge(aMeshes));a.commitNeighbor("leave");a.finalizeNeighbor("leave");
  const live=facts(a),load=[...edge(joined),...bMeshes.map((mesh,index)=>({index:64+index,mesh}))];
  await expect(prepareHvpWorldReplacement(a,resident,load.slice(0,-1))).rejects.toThrow(/Missing restored/);
  expect(facts(a)).toEqual(live);
  const enter=await prepareHvpWorldReplacement(a,resident,load);
  expect(facts(a)).toEqual(live);expect(enter.candidate.copyCollision()).toHaveLength(128);
  const b=enter.commit();enter.finalize();expect(a.read().status).toBe("Disposed");
  const leave=await prepareHvpWorldReplacement(b,absent,edge(aMeshes));
  expect(b.copyCollision()).toHaveLength(128);expect(leave.candidate.copyCollision()).toHaveLength(64);
  leave.commit();leave.finalize();expect(b.read().status).toBe("Disposed");leave.dispose();
},120_000);
