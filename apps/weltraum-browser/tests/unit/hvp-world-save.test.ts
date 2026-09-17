import {expect,it} from "vitest";
import {createHvpPhysicsSession} from "../../src/hestia-prototype/physics/session";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {encodeHvpGrid,decodeHvpGrid} from "../../src/hestia-prototype/persistence/gridCheckpoint";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpLocalBodyCut} from "../../src/hestia-prototype/physics/bodyCutPlan";

const floor={sizeX:64,sizeY:8,sizeZ:64,cellMeters:.125,originMeters:{x:-4,y:-.125,z:-4},readSlot:(_x:number,y:number,_z:number)=>y===0?1:0};
const drop={x:-2,y:3,z:-2},player={spawn:{x:.75,y:.92,z:-1},coverage:[{minX:-4,maxX:4,minZ:-4,maxZ:4}]};
const create=()=>createHvpPhysicsSession([...collisionSectors(floor)],drop,9.81,player,{x:2,y:2,z:2},{x:0,y:0,z:0},"saved-world");
it("recreates every current native owner and the paused player from artifact-only data",async()=>{
  const source=await create();source.play();for(let i=0;i<10;i+=1){source.advance(1/60);}source.pause();
  const before=source.read(true),grid=JSON.parse(JSON.stringify(encodeHvpGrid(floor))),saved=JSON.parse(JSON.stringify(source.checkpoint()));
  source.dispose();
  const restored=await createHvpPhysicsSession([...collisionSectors(decodeHvpGrid(grid))],drop,9.81,undefined,undefined,undefined,"saved-world",saved);
  try{
    const after=restored.read(true);
    expect(after.bodies).toEqual(before.bodies);expect(after.player).toEqual(before.player);
    expect(after.structural).toEqual(before.structural);expect(after.inertia).toEqual(before.inertia);
    expect(after.ticks).toBe(before.ticks);expect(after.status).toBe("Paused");
    expect(after.bodyCount).toBe(4);expect(after.colliderCount).toBe(before.colliderCount);
    restored.advance(3);expect(restored.read().ticks).toBe(before.ticks);
    restored.play();restored.advance(1/60);expect(restored.read().ticks).toBe(before.ticks+1);
  }finally{restored.dispose();}
},120_000);
it("rejects running checkpoints and foreign collision/profile or incomplete owner membership",async()=>{
  const session=await create();
  try{
    expect(()=>session.checkpoint()).toThrow(/paused|confirmed/i);session.pause();
    const saved=session.checkpoint();
    await expect(createHvpPhysicsSession([],drop,9.81,undefined,undefined,undefined,"saved-world",saved)).rejects.toThrow(/collision/i);
    await expect(createHvpPhysicsSession([...collisionSectors(floor)],drop,8,undefined,undefined,undefined,"saved-world",saved)).rejects.toThrow(/profile|gravity/i);
    await expect(createHvpPhysicsSession([...collisionSectors(floor)],drop,9.81,undefined,undefined,undefined,"saved-world",{...saved,bodies:[]})).rejects.toThrow(/owner|body/i);
    expect(session.read().bodyCount).toBe(4);expect(session.read().status).toBe("Paused");
  }finally{session.dispose();}
},120_000);
it("never invents collision for missing checkpoint coverage",()=>{
  expect(()=>[...collisionSectors({...floor,readSlot:()=>undefined})]).toThrow(/Unknown/);
});
it("restores current recut timber and terrain fragments, not the original parent generators",async()=>{
  const source=await create();let saved:ReturnType<typeof source.checkpoint>,before:ReturnType<typeof source.read>;
  const sectors=[...collisionSectors(floor)];
  const direction=(point:{x:number;y:number;z:number})=>{
    const p=source.read().player!.position,dx=point.x-p.x,dy=point.y-(p.y+.75),dz=point.z-p.z,length=Math.hypot(dx,dy,dz);
    return {x:dx/length,y:dy/length,z:dz/length};
  };
  try{
    source.play();source.advance(1/60);
    source.prepareBranch({id:"release",generation:0,sourceDigest:source.read().structural!.sourceDigest,direction:direction({x:.75,y:1.25,z:0})});
    expect(()=>source.checkpoint()).toThrow(/confirmed/);
    source.commitBranch("release");source.finalizeBranch("release");
    source.prepareTerrain("rock",0,[{index:0,mesh:sectors[0]!}],[{ownerId:"hvp:terrain-fragment:r1:12345678",
      origin:{x:-16,y:-8,z:-16},massKg:9.375,cells:[{x:128,y:90,z:144,materialId:1},{x:129,y:90,z:144,materialId:1}]}]);
    source.commitTerrain("rock");source.finalizeTerrain("rock");
    const parent=source.read().structural!.parts.find(p=>!p.anchored)!;
    source.aimBranch(direction(parent.position));
    const hit=source.read().moving.preview!;expect(hit.ownerId).toBe(parent.ownerId);
    const prep=source.beginBodyCut({id:"recut",ownerId:parent.ownerId,sourceDigest:hit.sourceDigest,edge:1,direction:direction(parent.position)});
    const p=prep.payload,local=prepareHvpLocalBodyCut(ingestHvpStructuralCells(p.sourceId,prep.cells,p.materials),p.cell,p.commandId,p.edge);
    source.stageBodyCut("recut",{removedCells:local.plan.removedCells,removedMassKg:local.plan.removedMassKg,parts:local.plan.parts.map(part=>({
      ownerId:part.ownerId,sourceDigest:part.recipe.source.contentHash,massKg:part.recipe.mass.totalMassKg,center:part.recipe.mass.centerOfMassMeters!}))});
    source.commitBodyCut("recut");source.finalizeBodyCut("recut");
    source.pause();before=source.read(true);saved=JSON.parse(JSON.stringify(source.checkpoint()));
    expect(before.structural!.generation).toBe(1);expect(before.moving.sequence).toBe(1);
    expect(before.structural!.parts.some(p=>p.ownerId===parent.ownerId)).toBe(false);
    expect(saved.branch!.source).toBeNull();
  }finally{source.dispose();}
  const restored=await createHvpPhysicsSession(sectors,drop,9.81,undefined,undefined,undefined,"saved-world",saved!);
  try{
    const after=restored.read(true);
    expect(after.bodies).toEqual(before!.bodies);expect(after.structural).toEqual(before!.structural);
    expect(after.terrainGeneration).toBe(1);expect(after.terrainFragments).toEqual(before!.terrainFragments);
    expect(after.moving.last).toEqual(before!.moving.last);expect(after.player).toEqual(before!.player);
    expect(after.bodyCount).toBe(before!.bodyCount);expect(after.colliderCount).toBe(before!.colliderCount);
  }finally{restored.dispose();}
},120_000);
