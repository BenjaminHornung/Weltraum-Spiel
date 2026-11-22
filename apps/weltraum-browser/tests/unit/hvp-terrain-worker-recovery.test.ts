import {expect,it} from "vitest";
import {createHvpWorkerPhysicsSession,restoreHvpTerrainWorker} from "../../src/hestia-prototype/physics/session";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";

const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};
const fragment={ownerId:"hvp:terrain-fragment:r1:12345678",origin:{x:-16,y:-8,z:-16},massKg:9.375,
  cells:[{x:128,y:76,z:128,materialId:1},{x:129,y:76,z:128,materialId:1}],colliderBoxes:[{min:[128,76,128] as const,max:[130,77,129] as const}]};
const binding={sessionId:"source-session",epoch:3,commandId:"cut",baseRevision:0,baseDigest:"00000001",targetDigest:"00000002"};

it("reconstructs both sides of L with exact queries, sources and body motion at the held R05 tick",async()=>{
  const owner=await createHvpWorkerPhysicsSession([...collisionSectors(floor)],{x:1,y:2,z:1},undefined,{spawn:{x:2,y:2,z:2},coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}]},undefined,undefined,"hvp-world");
  const ray=(s:typeof owner)=>[s.queryTerrainRay({x:.4,y:1,z:.4},{x:0,y:-1,z:0},2),
    s.queryTerrainRay({x:.06,y:2,z:.06},{x:0,y:-1,z:0},1)];
  const capsule=(s:typeof owner)=>[s.queryTerrainCapsule({x:.8,y:1,z:.4},{x:0,y:-1,z:0},2,.6,.3),
    s.queryTerrainCapsule({x:.06,y:3,z:.06},{x:0,y:-1,z:0},2,.6,.3)];
  try{
    const assets=structuredClone(owner.captureTerrainAssets());
    owner.play();owner.advance(1/60);
    owner.prepareTerrain("cut",0,[{index:0,mesh:{vertices:new Float32Array(),indices:new Uint32Array()}}],[fragment]);
    const before={assets,motion:structuredClone(owner.captureTerrainRecovery(binding)),journal:[]};
    owner.commitTerrain("cut");
    const after={assets,motion:structuredClone(owner.captureTerrainRecovery(binding)),journal:[{binding,
      replacements:[{index:0,mesh:{vertices:new Float32Array(),indices:new Uint32Array()}}],fragments:[fragment]}]},held=owner.read();
    expect(after.motion.tick.ticks).toBe(before.motion.tick.ticks);
    expect(ray(owner)).toEqual([null,{ownerId:fragment.ownerId,distance:expect.any(Number)}]);
    expect(capsule(owner)).toEqual([null,{ownerId:fragment.ownerId,distance:expect.any(Number)}]);
    owner.finalizeTerrain("cut");
    const released=owner.read();
    for(const [image,rev] of [[before,0],[after,1]] as const){
      const recovered=await restoreHvpTerrainWorker(image,"public",false);
      try{
        const snap=recovered.read();
        expect(snap).toMatchObject({ticks:held.ticks,terrainGeneration:rev,terrainTransaction:"Idle"});
        if(rev===1){
          expect(capsule(recovered)).toEqual(capsule(owner));expect(ray(recovered)).toEqual(ray(owner));expect(snap.terrainFragments).toEqual(released.terrainFragments);
          expect(snap.bodyCount).toBe(released.bodyCount);expect(snap.colliderCount).toBe(released.colliderCount);
          expect(snap.bodies).toEqual(released.bodies);expect(snap.player).toEqual(released.player);
        }else{expect(ray(recovered)).toEqual([{ownerId:null,distance:expect.any(Number)},null]);expect(snap.terrainFragments).toEqual([]);}
        expect(()=>recovered.checkpoint()).toThrow();
      }finally{recovered.dispose();}
    }
  }finally{owner.dispose();}
},30000);
