import {expect,it,vi} from "vitest";
import {createHvpPhysicsSession} from "../../src/hestia-prototype/physics/session";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {encodeHvpGrid,decodeHvpGrid} from "../../src/hestia-prototype/persistence/gridCheckpoint";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpLocalBodyCut} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {createPersistenceSignature,serializeCanonicalPersistenceValue} from "../../src/persistence";

const floor={sizeX:64,sizeY:8,sizeZ:64,cellMeters:.125,originMeters:{x:-4,y:-.125,z:-4},readSlot:(_x:number,y:number,_z:number)=>y===0?1:0};
const drop={x:-2,y:3,z:-2},player={spawn:{x:.75,y:.92,z:-1},coverage:[{minX:-4,maxX:4,minZ:-4,maxZ:4}]};
const create=(measureBodyHold=false)=>createHvpPhysicsSession([...collisionSectors(floor)],drop,9.81,player,{x:2,y:2,z:2},{x:0,y:0,z:0},
  "saved-world",undefined,"branch",measureBodyHold);
it("recreates every current native owner and the paused player from artifact-only data",async()=>{
  const source=await create();source.play();for(let i=0;i<10;i+=1){source.advance(1/60);}source.pause();
  const before=source.read(true),grid=JSON.parse(JSON.stringify(encodeHvpGrid(floor))),saved:ReturnType<typeof source.checkpoint>=JSON.parse(JSON.stringify(source.checkpoint()));
  source.dispose();
  const restored=await createHvpPhysicsSession([...collisionSectors(decodeHvpGrid(grid))],drop,9.81,undefined,undefined,undefined,"saved-world",saved);
  try{
    const restoredCheckpoint=restored.checkpoint();
    expect(serializeCanonicalPersistenceValue(restoredCheckpoint)).toBe(serializeCanonicalPersistenceValue(saved));
    expect(createPersistenceSignature(restoredCheckpoint)).toBe(createPersistenceSignature(saved));
    expect(restoredCheckpoint.bodies.map(({ownerId,region})=>[ownerId,region])).toEqual(saved.bodies.map(({ownerId,region})=>[ownerId,region]));
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
it.each([
  {measureBodyHold:false,interruption:"none"},
  {measureBodyHold:true,interruption:"none"},
  {measureBodyHold:true,interruption:"Pause"},
  {measureBodyHold:true,interruption:"Inspect"}
])("restores current recut timber and terrain fragments with $interruption (measure=$measureBodyHold)",async({measureBodyHold,interruption})=>{
  const source=await create(measureBodyHold);let saved:ReturnType<typeof source.checkpoint>,before:ReturnType<typeof source.read>;
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
      origin:{x:-16,y:-8,z:-16},massKg:9.375,cells:[{x:128,y:90,z:144,materialId:1},{x:129,y:90,z:144,materialId:1}],
      colliderBoxes:[{min:[128,90,144],max:[130,91,145]}]}]);
    source.commitTerrain("rock");source.finalizeTerrain("rock");
    const parent=source.read().structural!.parts.find(p=>!p.anchored)!;
    source.aimBranch(direction(parent.position));
    const hit=source.read().moving.preview!;expect(hit.ownerId).toBe(parent.ownerId);
    const prep=source.beginBodyCut({id:"recut",ownerId:parent.ownerId,sourceDigest:hit.sourceDigest,edge:1,direction:direction(parent.position)});
    const p=prep.payload,local=prepareHvpLocalBodyCut(ingestHvpStructuralCells(p.sourceId,prep.cells,p.materials),p.cell,p.commandId,p.edge);
    let now=1000;
    const nowSpy=vi.spyOn(performance,"now").mockImplementation(()=>now);
    try{
      const admission={removedCells:local.plan.removedCells,removedMassKg:local.plan.removedMassKg,parts:local.plan.parts.map(part=>({
        ownerId:part.ownerId,sourceDigest:part.recipe.source.contentHash,massKg:part.recipe.mass.totalMassKg,center:part.recipe.mass.centerOfMassMeters!}))};
      if(measureBodyHold&&interruption==="none"){
        const originalError=new Error("invalid body-product getter"),old=source.read();
        const hostile=Object.defineProperty({...admission},"parts",{get:()=>{throw originalError;}});
        let caught:unknown;
        try{source.stageBodyCut("recut",hostile);}catch(error){caught=error;}
        expect(caught).toBe(originalError);
        expect(source.read()).toMatchObject({status:"Running",bodyCount:old.bodyCount,moving:{state:"Preparing"}});
      }
      source.stageBodyCut("recut",admission);
      if(measureBodyHold){expect(source.bodyPrepareSpans()).toMatchObject({transactionId:"recut",holdMs:null});}
      else{expect(source.bodyPrepareSpans()).toBeUndefined();}
      expect(()=>source.stageBodyCut("foreign",admission)).toThrow(/Stale body preparation/);
      expect(()=>source.stageBodyCut("recut",admission)).toThrow(/Stale body preparation/);
      if(measureBodyHold){expect(source.bodyPrepareSpans()).toMatchObject({transactionId:"recut",holdMs:null});}
      else{expect(source.bodyPrepareSpans()).toBeUndefined();}
      now=1010;
      if(interruption==="Pause"){source.pause();expect(source.bodyPrepareSpans()).toMatchObject({transactionId:"recut",holdMs:null,manualPause:true});}
      if(interruption==="Inspect"){source.inspect();expect(source.bodyPrepareSpans()).toMatchObject({transactionId:"recut",holdMs:null,manualPause:false});}
      now=1040;source.commitBodyCut("recut");
      if(measureBodyHold){expect(source.bodyPrepareSpans()?.holdMs).toBeNull();}
      else{expect(source.bodyPrepareSpans()).toBeUndefined();}
      now=1060;source.finalizeBodyCut("recut");
      if(measureBodyHold){expect(source.bodyPrepareSpans()).toMatchObject({transactionId:"recut",holdMs:interruption==="Pause"?null:60,
        manualPause:interruption==="Pause"});}
      else{expect(source.bodyPrepareSpans()).toBeUndefined();}
      expect(source.read().status).toBe(interruption==="Pause"?"Paused":"Running");
      if(interruption!=="none"){source.play();}
    }finally{nowSpy.mockRestore();}
    source.pause();before=source.read(true);saved=JSON.parse(JSON.stringify(source.checkpoint()));
    expect(before.structural!.generation).toBe(1);expect(before.moving.sequence).toBe(1);
    expect(before.structural!.parts.some(p=>p.ownerId===parent.ownerId)).toBe(false);
    expect(saved.branch!.source).toBeNull();
  }finally{source.dispose();}
  const restored=await createHvpPhysicsSession(sectors,drop,9.81,undefined,undefined,undefined,"saved-world",saved!);
  try{
    const restoredCheckpoint=restored.checkpoint();
    expect(serializeCanonicalPersistenceValue(restoredCheckpoint)).toBe(serializeCanonicalPersistenceValue(saved!));
    expect(createPersistenceSignature(restoredCheckpoint)).toBe(createPersistenceSignature(saved!));
    expect(restoredCheckpoint.bodies.map(({ownerId,region})=>[ownerId,region])).toEqual(saved!.bodies.map(({ownerId,region})=>[ownerId,region]));
    expect(restoredCheckpoint.branch).toEqual(saved!.branch);
    expect(restoredCheckpoint.moving).toEqual(saved!.moving);
    const after=restored.read(true);
    expect(after.bodies).toEqual(before!.bodies);expect(after.structural).toEqual(before!.structural);
    expect(after.terrainGeneration).toBe(1);expect(after.terrainFragments).toEqual(before!.terrainFragments);
    expect(after.moving.last).toEqual(before!.moving.last);expect(after.player).toEqual(before!.player);
    expect(after.bodyCount).toBe(before!.bodyCount);expect(after.colliderCount).toBe(before!.colliderCount);
  }finally{restored.dispose();}
},120_000);
