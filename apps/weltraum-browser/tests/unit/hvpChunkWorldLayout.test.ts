import {expect,it} from "vitest";
import {createHvpChunkWorkerPhysicsSession,createHvpWorkerPhysicsSession} from "../../src/hestia-prototype/physics/session";
import {prepareHvpWorkerWorldLayoutReplacement} from "../../src/hestia-prototype/physics/worldReplacement";
import {hvpCollisionDigest} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import {collisionSectors,type HvpCollisionSector} from "../../src/hestia-prototype/physics/terrainColliders";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
import {createHvpBodyMeshPhaseReserve} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import type {HvpTerrainFragmentRequest} from "../../src/hestia-prototype/physics/terrainFragment";

const layout={version:"hvp-static-chunks-v1" as const,primaryTerrainCount:256 as const,neighborTerrainCount:256 as const};
it("preserves all empty primary slots and static wood extras without creating empty native colliders",async()=>{
  const sectors:HvpCollisionSector[]=Array.from({length:256},()=>({vertices:new Float32Array(),indices:new Uint32Array()}));
  const floor={sizeX:8,sizeY:4,sizeZ:8,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};
  sectors.push(...collisionSectors(floor));
  const session=await createHvpChunkWorkerPhysicsSession(layout,sectors,{x:.5,y:2,z:.5});
  try{
    session.pause();
    expect(session.copyCollision()).toHaveLength(257);expect(session.checkpoint().collisionDigest).toBe(hvpCollisionDigest(sectors));
    expect(session.read().colliderCount).toBe(2);expect(session.checkpoint().neighbor).toBeNull();
    expect(session.staticTerrainLayout()).toEqual(layout);
  }finally{session.dispose();}
  expect(session.read().bodyCount).toBe(0);expect(session.read().colliderCount).toBe(0);
});
it("rejects wrong private segmentation before native admission",async()=>{
  const sectors=Array.from({length:256},()=>({vertices:new Float32Array(),indices:new Uint32Array()}));
  await expect(createHvpChunkWorkerPhysicsSession({...layout,primaryTerrainCount:64} as never,sectors,{x:0,y:1,z:0})).rejects.toThrow(/layout|segmentation/i);
  await expect(createHvpChunkWorkerPhysicsSession(layout,sectors.slice(1),{x:0,y:1,z:0})).rejects.toThrow(/coverage|membership/i);
});
it.each(["wood","swapped"] as const)("rejects misplaced primary XYZ coverage (%s)",async mode=>{
  const empty=()=>({vertices:new Float32Array(),indices:new Uint32Array()});
  const floor=[...collisionSectors({sizeX:8,sizeY:4,sizeZ:8,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0})][0]!;
  const sectors=mode==="wood"?[floor,...Array.from({length:256},empty)]:Array.from({length:256},empty);
  if(mode==="swapped"){sectors[0]={vertices:new Float32Array([-12,-8,-16,-12,-8,-12,-8,-8,-12]),indices:new Uint32Array([0,1,2])};}
  let unexpected:Awaited<ReturnType<typeof createHvpChunkWorkerPhysicsSession>>|undefined;
  try{await expect(createHvpChunkWorkerPhysicsSession(layout,sectors,{x:0,y:2,z:0}).then(s=>{unexpected=s;return s;})).rejects.toThrow(/coverage|bounds|chunk/i);}
  finally{unexpected?.dispose();}
});
it.each(["direct","plan"] as const)("accepts actual high-index terrain commit and rollback (%s)",async kind=>{
  const sectors=Array.from({length:256},()=>({vertices:new Float32Array(),indices:new Uint32Array()}));
  const floor={vertices:new Float32Array([-16,-8,-8,-16,-8,-4,-12,-8,-4,-12,-8,-8]),indices:new Uint32Array([0,1,2,0,2,3])};
  sectors[64]=floor;const session=await createHvpChunkWorkerPhysicsSession(layout,sectors,{x:-15,y:2,z:-7}),pump=createHvpBodyMeshTaskPump(()=>{});
  try{
    const removed=[{index:64,mesh:{vertices:new Float32Array(),indices:new Uint32Array()}}],fragments:readonly HvpTerrainFragmentRequest[]=[];
    const ticket=kind==="plan"?await session.prepareTerrainPlan("high",0,removed,fragments,createHvpBodyMeshPhaseReserve(1024*1024),pump.host):undefined;
    session.prepareTerrain("high",0,removed,fragments,ticket);session.commitTerrain("high");session.rollbackTerrain("high");
    expect(session.read().terrainGeneration).toBe(0);expect(session.read().colliderCount).toBe(2);
    session.prepareTerrain("high-final",0,removed);session.commitTerrain("high-final");session.finalizeTerrain("high-final");
    expect(session.read().terrainGeneration).toBe(1);expect(session.read().colliderCount).toBe(1);
  }finally{pump.dispose();session.dispose();}
});
it("replaces a complete legacy catalogue by chunks and back with exact Save digests and real native retirement",async()=>{
  const empty=()=>({vertices:new Float32Array(),indices:new Uint32Array()});
  const floor=[...collisionSectors({sizeX:8,sizeY:4,sizeZ:8,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0})];
  const legacy=[...Array.from({length:64},empty),...floor],chunks=[...Array.from({length:256},empty),...floor];
  const a=await createHvpWorkerPhysicsSession(legacy,{x:.5,y:2,z:.5});a.pause();const saved=a.checkpoint();
  try{
    await expect(prepareHvpWorkerWorldLayoutReplacement(a,{...saved,collisionDigest:"00000000"},{sectors:chunks,layout})).rejects.toThrow(/collision/i);
    expect(a.read().bodyCount).toBe(1);
    const chunkSave={...saved,collisionDigest:hvpCollisionDigest(chunks)};
    const first=await prepareHvpWorkerWorldLayoutReplacement(a,chunkSave,{sectors:chunks,layout});
    expect(first.candidate.copyCollision()).toHaveLength(257);expect(a.copyCollision()).toHaveLength(65);
    first.commit();expect(first.rollback()).toBe(a);expect(first.candidate.read().bodyCount).toBe(0);
    const second=await prepareHvpWorkerWorldLayoutReplacement(a,chunkSave,{sectors:chunks,layout}),b=second.commit();second.finalize();
    expect(a.read().bodyCount).toBe(0);expect(b.staticTerrainLayout()).toEqual(layout);
    const visit=(owner:typeof b,count:64|256,baseSectorCount:number)=>{
      const neighbor={version:"hvp-neighbor-world-v1" as const,epoch:1,resident:true,sourceDigest:"cafebabe",baseSectorCount};
      const edge=Array.from({length:count/8},(_,i)=>({index:i*8+7,mesh:empty()}));
      owner.prepareNeighbor("first-east",neighbor,Array.from({length:count},empty),edge);owner.commitNeighbor("first-east");owner.finalizeNeighbor("first-east");
      expect(owner.read().neighbor?.baseSectorCount).toBe(baseSectorCount);expect(owner.copyCollision()).toHaveLength(baseSectorCount+count);
      owner.prepareNeighbor("evict-east",{...neighbor,epoch:2,resident:false},[],edge);owner.commitNeighbor("evict-east");owner.finalizeNeighbor("evict-east");
      expect(owner.copyCollision()).toHaveLength(baseSectorCount);
    };
    visit(b,256,257);
    const back=await prepareHvpWorkerWorldLayoutReplacement(b,saved,{sectors:legacy,layout:null});
    const restored=back.commit();back.finalize();expect(b.read().bodyCount).toBe(0);
    expect(restored.copyCollision()).toHaveLength(65);expect(restored.staticTerrainLayout()).toBeNull();
    expect(restored.checkpoint().collisionDigest).toBe(saved.collisionDigest);visit(restored,64,65);back.dispose();
    expect(restored.read().bodyCount).toBe(0);
  }finally{a.dispose();}
});
