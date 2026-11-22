import {expect,it} from "vitest";
import {createHvpWorkerPhysicsSession,restoreHvpTerrainWorker} from "../../src/hestia-prototype/physics/session";
import {isIssuedHvpCompactNativeOwner} from "../../src/hestia-prototype/physics/compactNativeOwner";
import {hvpFragmentArchiveDigest,matchesHvpFragmentSourceDigest} from "../../src/hestia-prototype/physics/compactFragmentIdentity";
import {createTerrainComponentIndex,materializeCompactCells} from "../../src/voxel/structural/componentIndex";
import {prepareHvpTerrainFragment} from "../../src/hestia-prototype/physics/terrainFragment";
import {HVP_SOURCE_MIN_METERS} from "../../src/hvp/hvpCoastSource";
import {createHvpBodyMeshPhaseReserve} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import {decodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {prepareHvpLocalBodyCut} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {cutAt,rootFor,uFixture} from "./componentIndex/compactFixtures";

const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};
const host={assertCurrent(){},continuePlan:()=>true,yieldTask:async()=>{}};

it("publishes the compact material identity before archive creation and preserves it in native recovery",async()=>{
  const cut=cutAt(rootFor(uFixture()),[12,2,4]),index=createTerrainComponentIndex(cut.before);
  const mesh=[...collisionSectors(floor)],replacements=[{index:0,mesh:mesh[0]!}];
  const player={spawn:{x:-16+12.5*.125,y:-8+11.5*.125-.75,z:-13.5},coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}]};
  const s=await createHvpWorkerPhysicsSession(mesh,{x:0,y:3,z:0},undefined,player);
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
    const ray={x:0,y:0,z:-1} as const;
    s.play();s.aimBranch(ray);
    expect(s.read().moving.preview).toMatchObject({ownerId:request.ownerId,sourceDigest:view.sourceDigest,cell:[12,11,4]});
    expect(owner.archiveReady()).toBe(false);
    s.pause();
    const latestAssets=structuredClone(s.captureTerrainAssets());
    const checkpoint=latestAssets.world.bodies.find(b=>b.ownerId===request.ownerId)!;
    expect(checkpoint.version).toBe("hvp-body-checkpoint-v1");
    const decoded=decodeHvpBody(checkpoint);
    expect(decoded.recipe.source.contentHash).toBe(oracle.source.contentHash);
    expect(hvpFragmentArchiveDigest(decoded.recipe)).toBe(view.sourceDigest);
    expect(owner.archiveReady()).toBe(true);
    const cold=await restoreHvpTerrainWorker({assets:latestAssets,motion,journal:[]},"public",false);
    try{expect(cold.read().terrainFragments[0]).toEqual(view);}
    finally{cold.dispose();}
    const replay=await restoreHvpTerrainWorker({assets,motion,journal:[{binding,replacements,fragments:requests}]},"public",false);
    try{expect(replay.read().terrainFragments[0]).toEqual(view);}
    finally{replay.dispose();}
    s.play();s.aimBranch(ray);
    const next=s.beginBodyCut({id:"recut-compact",ownerId:request.ownerId,sourceDigest:view.sourceDigest,edge:1,direction:ray});
    expect(next.payload.sourceDigest).toBe(oracle.source.contentHash);
    const ref=prepareHvpLocalBodyCut(oracle.source,next.payload.cell,next.payload.commandId,1,"Box").plan;
    s.advance(1/60);
    s.stageBodyCut(next.payload.commandId,{removedCells:ref.removedCells,removedMassKg:ref.removedMassKg,
      parts:ref.parts.map(p=>({ownerId:p.ownerId,sourceDigest:p.recipe.source.contentHash,massKg:p.recipe.mass.totalMassKg,center:p.recipe.mass.centerOfMassMeters!}))});
    s.commitBodyCut(next.payload.commandId);s.finalizeBodyCut(next.payload.commandId);
    expect(s.read().moving.last).toMatchObject({parentId:request.ownerId,status:"Applied",removedCells:1});
    expect(s.read().terrainFragments.some(f=>f.ownerId===request.ownerId)).toBe(false);
  }finally{s.dispose();index.dispose();}
});
