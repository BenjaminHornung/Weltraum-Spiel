import {expect,it} from "vitest";
import {createPublishedPlayerEyes} from "../../src/hestia-prototype/physics/publishedPlayerEye";
const origin={x:1,y:1.75,z:2};
it("retains the exact reported ray origin while a normal controller moves between snapshots",()=>{
  let now=0;const eyes=createPublishedPlayerEyes("game",()=>now);
  const first=eyes.record(10,1,0,origin);now+=17;
  eyes.record(11,1,0,{...origin,y:1.7497});
  expect(eyes.resolve(structuredClone(first),origin,11,1,0)).toEqual(origin);
});
it.each(["session","world","epoch","foreign origin","terrain revision","body revision","age","wrap","pause","warp","cold"])("rejects a changed binding: %s",change=>{
  let now=0;const eyes=createPublishedPlayerEyes("game",()=>now);
  const first=structuredClone(eyes.record(9,1,0,origin));let tick=9,terrain=1,moving=0,eye=origin;
  if(change==="session")Object.assign(first,{session:"other"});
  if(change==="world")Object.assign(first,{world:"other"});
  if(change==="epoch")Object.assign(first,{epoch:99});
  if(change==="foreign origin")eye={...origin,x:4};
  if(change==="terrain revision")terrain++;if(change==="body revision")moving++;
  if(change==="age")now+=1501;
  if(change==="wrap"){tick+=256;eyes.record(tick,terrain,moving,origin);}
  if(change==="pause")eyes.clear();
  if(change==="warp"){now+=16;tick++;eyes.record(tick,terrain,moving,{...origin,x:14});}
  const current=change==="cold"?createPublishedPlayerEyes("game",()=>now):eyes;
  expect(()=>current.resolve(first,eye,tick,terrain,moving)).toThrow();
});

it("applies the real 64/384 rock-arm recut through the worker-facing session using an earlier published player eye",async()=>{
  const {HVP_SOURCE_MIN_METERS,prepareHvpCoastSource,materializeHvpCoastSource}=await import("../../src/hvp/hvpCoastSource");
  const {createHvpTerrainRoot}=await import("../../src/hestia-prototype/terrain/cutPlan");
  const {createTerrainComponentIndex}=await import("../../src/voxel/structural/componentIndex");
  const {cutAt}=await import("./componentIndex/compactFixtures");
  const {collisionSectors}=await import("../../src/hestia-prototype/physics/terrainColliders");
  const {createHvpWorkerPhysicsSession}=await import("../../src/hestia-prototype/physics/session");
  const {createHvpBodyMeshPhaseReserve}=await import("../../src/hestia-prototype/presentation/bodyMeshAdmission");
  const {readCompactMovingProjection}=await import("../../src/hestia-prototype/presentation/compactMovingProjection");
  const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"real-player-ray",1);
  const cut=cutAt(root,[176,78,76],[180,82,80]),index=createTerrainComponentIndex(cut.before);
  const source=index.prepareCompact(cut).fragments[0]!,terrain={sessionId:cut.after.sessionId,epoch:cut.after.epoch,generation:1,terrainDigest:cut.after.sourceDigest};
  const fragments=[{ownerId:source.ownerId,cells:[],massKg:source.massKg,origin:HVP_SOURCE_MIN_METERS,colliderBoxes:source.colliderBoxes,
    compactSource:{generation:1,cellCount:source.cellCount,parts:source.parts}}];
  const meshes=[...collisionSectors({sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x,y)=>y===0?1:0})];
  const player={spawn:{x:-16+189.5*.125,y:-8+85.5*.125-.75,z:-16+76*.125-.4},coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}]};
  const s=await createHvpWorkerPhysicsSession(meshes,{x:0,y:3,z:0},undefined,player);
  try{
    const replacements=[{index:0,mesh:meshes[0]!}];
    const ticket=await s.prepareTerrainPlan("terrain-1",0,replacements,fragments,createHvpBodyMeshPhaseReserve(48*1024*1024),
      {assertCurrent(){},async yieldTask(){},continuePlan:()=>true},terrain);
    s.prepareTerrain("terrain-1",0,replacements,fragments,ticket);s.commitTerrain("terrain-1");s.finalizeTerrain("terrain-1");
    s.play();const direction={x:0,y:0,z:1};s.aimBranch(direction);
    const issued=s.read(),base=issued.player!.position,eye={...base,y:base.y+.75};
    expect(issued.moving.preview).toMatchObject({ownerId:source.ownerId,cell:[189,85,76]});
    expect(issued.playerEyeReceipt).toBeDefined();
    s.advance(1/60);const advanced=s.read();
    expect(advanced.ticks).toBeGreaterThan(issued.ticks);
    expect(Math.abs(advanced.player!.position.y-base.y)).toBeGreaterThan(1e-5);
    const id="player-actual-recut",view=issued.terrainFragments[0]!;
    const prep=await s.beginBodyCutForWorker({id,sourceDigest:view.sourceDigest,ownerId:source.ownerId,edge:4,direction,expectedEye:eye,eyeReceipt:issued.playerEyeReceipt});
    const projection=readCompactMovingProjection(structuredClone(prep));
    expect(projection.removedMassKg).toBe(135.9375);expect(projection.removedCells).toBe(32);
    await s.prepareBodyCutPlan(id);s.stageBodyCut(id,projection);s.commitBodyCut(id);s.finalizeBodyCut(id);
    const applied=s.read();
    expect(applied.moving.last).toMatchObject({id,status:"Applied",parentId:source.ownerId});
    expect(applied.terrainFragments).toHaveLength(1);
    expect(applied.terrainFragments[0]).toMatchObject({ownerId:source.ownerId+":r1:p0",cellCount:352,massKg:1586.71875});
  }finally{s.dispose();index.dispose();}
},120000);
