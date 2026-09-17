import {expect,it} from "vitest";
import {collisionSectors,type HvpCollisionSource} from "../../src/hestia-prototype/physics/terrainColliders";
import {createHvpPhysicsSession} from "../../src/hestia-prototype/physics/session";

const floor=(x:number):HvpCollisionSource=>({sizeX:256,sizeY:8,sizeZ:256,cellMeters:.125,originMeters:{x,y:-.125,z:-16},
  readSlot:(_x,y,_z)=>y===0?1:0});
const base=floor(-16),east=floor(16);
const primary=[...collisionSectors(base)],neighbor=[...collisionSectors({...east,readHaloSlot:(x,y,z)=>x<0?base.readSlot(x+256,y,z):undefined})];
const joined=[...collisionSectors({...base,readHaloSlot:(x,y,z)=>x>=256?east.readSlot(x-256,y,z):undefined})];
const edge=(meshes:typeof primary)=>meshes.flatMap((mesh,index)=>index%8===7?[{index,mesh}]:[]);
const player={spawn:{x:15.5,y:.92,z:0},coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}]};

it("holds actual capsule coverage until the complete neighbour commits, and checkpoints both regions",async()=>{
  const s=await createHvpPhysicsSession(primary,{x:-12,y:2,z:0},9.81,player);
  try{
    s.play();s.input({x:1,z:0,sprint:false,jump:false});for(let i=0;i<90;i+=1){s.advance(1/60);}
    const held=s.read();expect(held.player!.status).toBe("CoverageHold");expect(held.player!.position.x).toBeLessThan(15.71);
    const binding={version:"hvp-neighbor-world-v1" as const,epoch:1,resident:true,sourceDigest:"12345678",baseSectorCount:64};
    s.prepareNeighbor("load",binding,neighbor,edge(joined));const ticks=s.read().ticks;s.advance(1);
    expect(s.read().ticks).toBe(ticks);expect(s.read().neighborTransaction).toBe("PreparedHeld");
    s.commitNeighbor("load");s.advance(1);expect(s.read().ticks).toBe(ticks);s.finalizeNeighbor("load");
    for(let i=0;i<60;i+=1){s.advance(1/60);}
    expect(s.read().player!.position.x).toBeGreaterThan(17);expect(s.read().player!.position.y).toBeGreaterThan(.89);
    expect(s.read().terrainGeneration).toBe(0);
    expect(()=>s.prepareNeighbor("pinned",{...binding,epoch:2,resident:false},[],edge(primary))).toThrow(/pinned/i);
    s.pause();const saved=JSON.parse(JSON.stringify(s.checkpoint())),geometry=s.copyCollision();expect(geometry).toHaveLength(128);
    const before=s.read();const restored=await createHvpPhysicsSession(geometry,saved.dropSpawn,9.81,undefined,undefined,undefined,saved.sessionId,saved);
    try{
      expect(restored.read().bodies).toEqual(before.bodies);expect(restored.read().player!.position).toEqual(before.player!.position);
      expect(restored.read().neighbor).toEqual(binding);expect(restored.read().colliderCount).toBe(before.colliderCount);
      const bad={...saved,coverage:saved.coverage.filter((r:{minX:number})=>r.minX<16)};
      await expect(createHvpPhysicsSession(geometry,saved.dropSpawn,9.81,undefined,undefined,undefined,saved.sessionId,bad)).rejects.toThrow(/coverage/);
      restored.play();restored.input({x:-1,z:0,sprint:false,jump:false});for(let i=0;i<160;i+=1){restored.advance(1/60);}
      restored.prepareNeighbor("unload",{...binding,epoch:2,resident:false},[],edge(primary));restored.commitNeighbor("unload");restored.finalizeNeighbor("unload");
      expect(restored.read().neighbor?.resident).toBe(false);expect(restored.read().terrainGeneration).toBe(0);
      restored.pause();expect(restored.copyCollision()).toHaveLength(64);
    }finally{restored.dispose();}
  }finally{s.dispose();}
},120_000);

it("cold-restores a checkpointed sleeping fragment without instantiating it until the real player returns",async()=>{
  const s=await createHvpPhysicsSession(primary,{x:-12,y:2,z:-10},9.81,player);
  try{
    const ownerId="hvp:terrain-fragment:r1:12345678";
    s.prepareTerrain("fragment",0,[{index:0,mesh:primary[0]!}],[{ownerId,origin:{x:-16,y:-8,z:-16},massKg:9.375,
      cells:[{x:48,y:68,z:128,materialId:1},{x:49,y:68,z:128,materialId:1}]}]);
    s.commitTerrain("fragment");s.finalizeTerrain("fragment");for(let i=0;i<240;i+=1){s.advance(1/60);}s.pause();
    const body=s.read().bodies.find(b=>b.ownerId===ownerId)!;expect(body.sleeping).toBe(true);
    s.parkDistantBodies();expect(s.read().bodies.some(b=>b.ownerId===ownerId)).toBe(false);expect(s.read().terrainFragments).toHaveLength(1);
    const saved=JSON.parse(JSON.stringify(s.checkpoint()));expect(saved.parked).toEqual([ownerId]);
    const restored=await createHvpPhysicsSession(s.copyCollision(),saved.dropSpawn,9.81,undefined,undefined,undefined,saved.sessionId,saved);
    try{
      expect(restored.read().parked.map(p=>p.ownerId)).toEqual([ownerId]);expect(restored.read().bodyCount).toBe(2);
      restored.play();restored.input({x:-1,z:0,sprint:false,jump:false});for(let i=0;i<300;i+=1){restored.advance(1/60);}restored.pause();
      restored.restoreNearBodies();expect(restored.read().parked).toEqual([]);
      expect(restored.read().bodies.find(b=>b.ownerId===ownerId)).toEqual(body);expect(restored.read().bodyCount).toBe(3);
    }finally{restored.dispose();}
  }finally{s.dispose();}
},120_000);

it("holds residency changes until graphics publication and never disguises a changed World as a rollback",async()=>{
  const s=await createHvpPhysicsSession(primary,{x:-12,y:2,z:-10},9.81,player);
  try{
    const ownerId="hvp:terrain-fragment:r1:12345678";
    s.prepareTerrain("fragment",0,[{index:0,mesh:primary[0]!}],[{ownerId,origin:{x:-16,y:-8,z:-16},massKg:9.375,
      cells:[{x:48,y:68,z:128,materialId:1},{x:49,y:68,z:128,materialId:1}]}]);
    s.commitTerrain("fragment");s.finalizeTerrain("fragment");for(let i=0;i<240;i+=1){s.advance(1/60);}
    const before=s.read();expect(before.bodies.find(b=>b.ownerId===ownerId)!.sleeping).toBe(true);
    s.prepareBodyResidency("park");expect(s.read().bodyResidencyTransaction).toBe("PreparedHeld");
    expect(s.read().parked.map(p=>p.ownerId)).toEqual([ownerId]);s.advance(2);expect(s.read().ticks).toBe(before.ticks);
    expect(()=>s.checkpoint()).toThrow(/paused generation/);expect(()=>s.resume()).toThrow(/transaction/);
    s.commitBodyResidency("park");expect(s.read().bodyResidencyTransaction).toBe("CommittedHeld");
    s.advance(2);expect(s.read().ticks).toBe(before.ticks);s.finalizeBodyResidency("park");
    expect(s.read().status).toBe("Running");s.advance(1/60);expect(s.read().ticks).toBe(before.ticks+1);
    s.prepareBodyResidency("unchanged");s.rollbackBodyResidency("unchanged");expect(s.read().bodyResidencyTransaction).toBe("Idle");
    s.play();s.input({x:-1,z:0,sprint:false,jump:false});for(let i=0;i<300;i+=1){s.advance(1/60);}
    s.prepareBodyResidency("wake");expect(s.read().parked).toEqual([]);
    expect(()=>s.rollbackBodyResidency("wake")).toThrow(/RecoveryHold/);
    const held=s.read();s.advance(2);expect(s.read().ticks).toBe(held.ticks);
    expect(s.read().bodyResidencyTransaction).toBe("RecoveryHold");expect(()=>s.play()).toThrow(/RecoveryHold/);
  }finally{s.dispose();}
},120_000);
