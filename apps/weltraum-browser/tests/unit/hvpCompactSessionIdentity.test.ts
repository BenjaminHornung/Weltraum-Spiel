import {expect,it} from "vitest";
import {createHvpWorkerPhysicsSession,restoreHvpTerrainWorker} from "../../src/hestia-prototype/physics/session";
import {isIssuedHvpCompactNativeOwner} from "../../src/hestia-prototype/physics/compactNativeOwner";
import {hvpFragmentArchiveDigest,matchesHvpFragmentSourceDigest} from "../../src/hestia-prototype/physics/compactFragmentIdentity";
import {createTerrainComponentIndex,materializeCompactCells} from "../../src/voxel/structural/componentIndex";
import {prepareHvpTerrainFragment} from "../../src/hestia-prototype/physics/terrainFragment";
import {HVP_SOURCE_MIN_METERS} from "../../src/hvp/hvpCoastSource";
import {createHvpBodyMeshPhaseReserve} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {cutAt,rootFor,uFixture} from "./componentIndex/compactFixtures";

const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};
const host={assertCurrent(){},continuePlan:()=>true,yieldTask:async()=>{}};

it("publishes the compact material identity before archive creation and preserves it in native recovery",async()=>{
  const cut=cutAt(rootFor(uFixture()),[12,2,4]),index=createTerrainComponentIndex(cut.before);
  const mesh=[...collisionSectors(floor)],replacements=[{index:0,mesh:mesh[0]!}];
  const s=await createHvpWorkerPhysicsSession(mesh,{x:0,y:3,z:0});
  try {
    const [part]=index.prepareCompact(cut).fragments;
    const request={ownerId:part!.ownerId,origin:HVP_SOURCE_MIN_METERS,compactSource:{generation:1,cellCount:part!.cellCount,parts:part!.parts},
      cells:[],massKg:part!.massKg,colliderBoxes:part!.colliderBoxes};
    const requests=[request],source={sessionId:cut.after.sessionId,epoch:cut.after.epoch,generation:1,terrainDigest:cut.after.sourceDigest};
    const binding={sessionId:source.sessionId,epoch:source.epoch,baseRevision:0,commandId:"compact-session",baseDigest:cut.before.sourceDigest,targetDigest:source.terrainDigest};
    const assets=structuredClone(s.captureTerrainAssets());
    const ticket=await s.prepareTerrainPlan(binding.commandId,0,replacements,requests,createHvpBodyMeshPhaseReserve(48*1024*1024),host,source);
    const owner=ticket.recipes[0]!;
    if(!isIssuedHvpCompactNativeOwner(owner)) throw new Error("Expected bounded compact native owner");
    const view=s.terrainPlanSourceViews(ticket)[0]!;
    expect(view.sourceDigest).toBe(owner.identity.membershipDigest);
    expect(matchesHvpFragmentSourceDigest(view.sourceDigest,request)).toBe(true);
    expect(matchesHvpFragmentSourceDigest(view.sourceDigest.replace(/.$/,c=>c==="f"?"0":"f"),request)).toBe(false);
    s.prepareTerrain(binding.commandId,0,replacements,requests,ticket);
    expect(s.read().preparedTerrainFragments[0]).toEqual(view);
    s.commitTerrain(binding.commandId);
    const motion=structuredClone(s.captureTerrainRecovery(binding));
    expect(motion.bodies.find(b=>b.ownerId===request.ownerId)?.sourceDigest).toBe(view.sourceDigest);
    s.finalizeTerrain(binding.commandId);
    expect(s.read().terrainFragments[0]).toEqual(view);
    expect(owner.archiveReady()).toBe(false);
    const oracle=prepareHvpTerrainFragment({...request,compactSource:undefined,cells:materializeCompactCells(request.compactSource)},1);
    expect(hvpFragmentArchiveDigest(oracle)).toBe(view.sourceDigest);
    const saved=owner.materializeV1Sync(createHvpBodyMeshPhaseReserve(96*1024*1024));
    expect(saved.source.contentHash).toBe(oracle.source.contentHash);
    expect(hvpFragmentArchiveDigest(saved)).toBe(view.sourceDigest);
    const replay=await restoreHvpTerrainWorker({assets,motion,journal:[{binding,replacements,fragments:requests}]},"public",false);
    try{expect(replay.read().terrainFragments[0]).toEqual(view);}
    finally{replay.dispose();}
  }finally{s.dispose();index.dispose();}
});
