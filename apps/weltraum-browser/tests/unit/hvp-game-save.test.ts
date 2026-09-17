import {beforeAll,expect,it,vi} from "vitest";
import * as coast from "../../src/hvp/hvpCoastSource";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {createHvpPhysicsSession,resolveHvpGravity} from "../../src/hestia-prototype/physics/session";
import {buildHvpPlant,planHvpVegetation} from "../../src/hestia-prototype/presentation/vegetation";
import {encodeHvpPlant} from "../../src/hestia-prototype/persistence/plantCheckpoint";
import {decodeHvpGame,encodeHvpGame,parseHvpGame,HVP_SAVE_TRANSPORT_BYTES,type HvpGameCheckpoint} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import {createHvpSaveStore} from "../../src/hestia-prototype/persistence/saveStore";
import {createMemorySaveRepository,SaveRepositoryError} from "../../src/browser-storage";
import {createPersistenceSignature} from "../../src/persistence";
import {createHvpEastRegion} from "../../src/hestia-prototype/runtime/regionSource";
import {R} from "../../src/hestia-prototype/physics/rapierPort";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {encodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {decodeHvpGrid} from "../../src/hestia-prototype/persistence/gridCheckpoint";
import {replaceHvpScene} from "../../src/hestia-prototype/persistence/sceneReplacement";
import type {HvpPhysicsClient} from "../../src/hestia-prototype/physics/client";

let artifact:HvpGameCheckpoint,cutY:number;
beforeAll(async()=>{
  const prepared=coast.prepareHvpCoastSource(coast.materializeHvpCoastSource()),root=createHvpTerrainRoot(prepared,"saved-game",0);
  const before=[...collisionSectors(root.read())];
  const session=await createHvpPhysicsSession(before,{x:-9,y:8,z:-9},resolveHvpGravity(),
    {spawn:{x:-9,y:2.42,z:-11},coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}]});
  try{
    cutY=127;while(root.read().readSlot(40,cutY,56)===0){cutY-=1;}
    const plan=root.prepare({sessionId:"saved-game",epoch:0,revision:0,sourceDigest:root.read().sourceDigest,commandId:"cut-1",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[40,cutY,56],max:[41,cutY+1,57]}});
    const after=[...collisionSectors(plan.after)];session.prepareTerrain("cut-1",0,[{index:9,mesh:after[9]!}]);
    session.commitTerrain("cut-1");root.commit(plan);session.finalizeTerrain("cut-1");session.pause();
    const plant=buildHvpPlant(planHvpVegetation().find(p=>p.kind!=="tree"&&p.position.x>0)!);
    artifact=encodeHvpGame({terrain:root.checkpoint(),plants:[encodeHvpPlant(plant)],world:session.checkpoint(),progress:null,
      receipts:{terrain:{version:"hvp-command-receipts-v1",kind:"terrain",entries:[],last:null},
        structural:{version:"hvp-command-receipts-v1",kind:"structural",entries:[],last:null},moving:{version:"hvp-command-receipts-v1",kind:"moving",entries:[],last:null}},
      view:{camera:{mode:"Orbit",preset:"C04-WIDE",fov:55,position:{x:-24,y:18,z:-28},target:{x:0,y:1,z:1},quaternion:{x:0,y:0,z:0,w:1}},
        playerYaw:Math.PI,playerPitch:0,thirdPerson:true,waterEnabled:true,aoEnabled:true,tool:{mode:2,sequence:1,structureSequence:0,movingSequence:0,edges:1}}});
  }finally{session.dispose();}
},120_000);

it("round-trips an edited eastern Root with exact native coverage and rejects a foreign neighbour binding",async()=>{
  const a=decodeHvpGame(artifact).root,east=createHvpTerrainRoot(await createHvpEastRegion(),"saved-east",0);
  let y=127;while(east.read().readSlot(8,y,24)===0){y-=1;}
  east.commit(east.prepare({sessionId:"saved-east",epoch:0,revision:0,sourceDigest:east.read().sourceDigest,commandId:"east-cut",toolPolicy:"hvp-plasma-v1",
    shape:{kind:"Box",min:[8,y,24],max:[9,y+1,25]}}));
  const primary=[...collisionSectors({...a.read(),readHaloSlot:(x,cy,z)=>x>=256?east.read().readSlot(x-256,cy,z):undefined})];
  const other=[...collisionSectors({...east.read(),readHaloSlot:(x,cy,z)=>x<0?a.read().readSlot(x+256,cy,z):undefined})];
  const live=await createHvpPhysicsSession([...collisionSectors(a.read())],artifact.world.dropSpawn,artifact.world.gravity,undefined,undefined,undefined,artifact.world.sessionId,artifact.world);
  let restored:Awaited<ReturnType<typeof createHvpPhysicsSession>>|undefined;
  try{
    live.prepareNeighbor("load-east",{version:"hvp-neighbor-world-v1",epoch:1,resident:true,sourceDigest:east.read().sourceDigest,baseSectorCount:64},other,
      [7,15,23,31,39,47,55,63].map(index=>({index,mesh:primary[index]!})));
    live.commitNeighbor("load-east");live.finalizeNeighbor("load-east");
    const {version:_version,profiles:_profiles,signature:_signature,...data}=artifact;
    const saved=encodeHvpGame({...data,world:live.checkpoint(),neighbor:{version:"hvp-neighbor-scene-v1",terrain:east.checkpoint(),lod:.5}});
    const decoded=decodeHvpGame(JSON.parse(JSON.stringify(saved)));
    expect(decoded.neighborRoot!.read().revision).toBe(1);expect(decoded.neighborRoot!.read().readSlot(8,y,24)).toBe(0);
    restored=await createHvpPhysicsSession([...primary,...other],saved.world.dropSpawn,saved.world.gravity,undefined,undefined,undefined,saved.world.sessionId,saved.world);
    expect(restored.read().neighbor).toEqual(live.read().neighbor);expect(restored.read().bodies).toEqual(live.read().bodies);
    expect(()=>decodeHvpGame({...saved,neighbor:null})).toThrow(/Missing saved neighbour/);
    expect(()=>decodeHvpGame({...saved,neighbor:{...saved.neighbor!,terrain:{...saved.neighbor!.terrain,sourceDigest:"00000000"}}})).toThrow(/neighbour source/);
  }finally{live.dispose();restored?.dispose();}
},120_000);

it.each(["prepare","upload","commit","world-publish","render-publish","finalize","retire","lost-worker","false-rollback"])(
  "preserves A or reports RecoveryHold after scene %s failure",async fault=>{
    const game=decodeHvpGame(artifact);let native=0,published=0,visible=0,root=0,lost=false,paused=false;
    const fail=(at:string)=>{if(fault===at){throw new Error(`injected ${at}`);}};
    const snapshot=()=>({status:"Paused",ticks:7,terrainGeneration:published,bodies:[],player:null,bodyCount:1,colliderCount:2});
    const physics={read:()=>{if(lost){throw new Error("worker unavailable");}return snapshot();},
      prepareRestore:async()=>{if(fault==="lost-worker"){lost=true;throw new Error("worker unavailable");}fail("prepare");return snapshot();},
      commitRestore:async()=>{fail("commit");native=1;},publishRestore:()=>{fail("world-publish");published=1;},
      rollbackRestore:async()=>{expect(visible).toBe(0);expect(root).toBe(0);native=0;if(fault!=="false-rollback"){published=0;}},
      finalizeRestore:async()=>{fail("finalize");},command:async()=>{paused=true;}
    } as unknown as HvpPhysicsClient;
    const operation=replaceHvpScene(game,"load-1",physics,[],()=>{
      fail("upload");return {publish(){expect(published).toBe(1);visible=1;root=1;fail("render-publish");if(fault==="false-rollback"){throw new Error("upload lost");}},
        rollback(){visible=0;root=0;},finish(){fail("retire");}};
    },()=>root===0);
    if(["retire","lost-worker","false-rollback"].includes(fault)){await expect(operation).rejects.toThrow(/RecoveryHold/);expect(paused).toBe(true);}
    else{await expect(operation).rejects.toThrow(/injected/);expect({native,published,visible,root,paused}).toEqual({native:0,published:0,visible:0,root:0,paused:false});}
    if(fault==="retire"){expect({native,published,visible,root}).toEqual({native:1,published:1,visible:1,root:1});}
  },120_000);

it("loads only complete artifact data after the original World is gone, through the real repository codec",async()=>{
  const generator=vi.spyOn(coast,"materializeHvpCoastSource").mockImplementation(()=>{throw new Error("No generator on restore");});
  const repository=createMemorySaveRepository([]),store=createHvpSaveStore(repository);
  try{
    await store.initialize();const written=await store.save(artifact,null);
    const restored=await store.load();expect(restored.metadata.recordRevision).toBe(1);
    expect(restored.game.root.read().revision).toBe(1);expect(restored.game.root.read().readSlot(40,cutY,56)).toBe(0);
    expect(restored.game.checkpoint).toEqual(artifact);expect(restored.game.view.thirdPerson).toBe(true);
    expect(Object.isFrozen(restored.game.view)).toBe(true);
    expect(written.envelope.ships).toEqual([]);expect(written.envelope.universeTime.tick).toBe(artifact.world.tick.ticks*2);
    expect(generator).not.toHaveBeenCalled();
    await expect(store.save(artifact,null)).rejects.toMatchObject({code:"SlotAlreadyExists"});
    await expect(store.save(artifact,99)).rejects.toMatchObject({code:"RevisionConflict"});
    const exported=await store.export();const imported=await store.import(exported,{kind:"CreateNewSlot",targetSlotId:"hvp-copy"});
    expect(imported.metadata.slotId).toBe("hvp-copy");expect((await store.load("hvp-copy")).game.checkpoint.signature).toBe(artifact.signature);
  }finally{generator.mockRestore();await store.close();}
},120_000);

it("leaves the old slot unchanged on quota/storage failure and on an invalid imported HVP payload",async()=>{
  const repository=createMemorySaveRepository([]),store=createHvpSaveStore(repository);await store.initialize();
  try{
    await store.save(artifact,null);const before=await store.export();
    const write=vi.spyOn(repository,"writeSlot").mockRejectedValueOnce(new SaveRepositoryError("QuotaExceeded","writeSlot","injected quota"));
    await expect(store.save(artifact,1)).rejects.toMatchObject({code:"QuotaExceeded"});write.mockRestore();
    expect(await store.export()).toEqual(before);
    const corrupt={...artifact,profiles:{...artifact.profiles,solver:"unknown"}};
    await expect(store.save(corrupt,1)).rejects.toThrow(/schema\/profile/);
    expect(await store.export()).toEqual(before);
    await expect(store.import({...before,canonicalPayload:"file:///outside/world.json"},{kind:"ReplaceExpectedRevision",expectedRevision:1})).rejects.toThrow();
    expect(await store.export()).toEqual(before);
  }finally{await store.close();}
},120_000);

it("rejects oversized bytes before text decode, and rejects source/profile corruption even after outer rehash",()=>{
  const decode=vi.spyOn(TextDecoder.prototype,"decode");
  try{expect(()=>parseHvpGame(new Uint8Array(HVP_SAVE_TRANSPORT_BYTES+1))).toThrow(/before decode/);expect(decode).not.toHaveBeenCalled();}
  finally{decode.mockRestore();}
  const bad=JSON.parse(JSON.stringify(artifact));bad.terrain.base.runs[0]=3;
  const {signature:_signature,...data}=bad;bad.signature=createPersistenceSignature(data);
  expect(()=>decodeHvpGame(bad)).toThrow(/digest|checkpoint material/);
  expect(()=>decodeHvpGame({...artifact,view:{...artifact.view,tool:{...artifact.view.tool,sequence:-1}}})).toThrow(/input\/view/);
},120_000);

it("rejects rehashed material duplicated between Root and a body or between two moving owners",()=>{
  const base=decodeHvpGrid(artifact.terrain.base),world=new R.World({x:0,y:-resolveHvpGravity(),z:0});
  const materials=coast.HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,structuralClass:m.role,destructible:true,tags:null}));
  const body=(ownerId:string,x:number,y:number,z:number)=>{
    const recipe=prepareHvpRigidBody(ingestHvpStructuralCells(ownerId,[{x,y,z,materialId:base.readSlot(x,y,z)!}],materials));
    return encodeHvpBody(ownerId,"terrain",recipe,installHvpRigidBody(world,recipe));
  };
  const withBodies=(bodies:ReturnType<typeof body>[])=>{
    const {version:_version,profiles:_profiles,signature:_signature,...data}=artifact;
    return encodeHvpGame({...data,world:{...artifact.world,bodies:[...artifact.world.bodies,...bodies]}});
  };
  try{
    const a=body("hvp:terrain-fragment:r1:aaaaaaaa",40,cutY,56);
    expect(()=>decodeHvpGame(withBodies([a]))).not.toThrow();
    const overlap=body("hvp:terrain-fragment:r1:bbbbbbbb",0,1,0);
    expect(()=>decodeHvpGame(withBodies([overlap]))).toThrow(/terrain ownership/);
    const duplicate=body("hvp:terrain-fragment:r1:cccccccc",40,cutY,56);
    expect(()=>decodeHvpGame(withBodies([a,duplicate]))).toThrow(/terrain ownership/);
  }finally{world.free();}
},120_000);
