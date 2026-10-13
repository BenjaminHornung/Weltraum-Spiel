import type {HvpLabPhysicsClient,HvpPhysicsClient} from "../physics/client";
import type {HvpStagedTerrain} from "../terrain/terrainConsumer";
import type {HvpCollisionSector} from "../physics/terrainColliders";
import type {HvpCompleteStaticCollision,HvpLabCompleteStaticCollision} from "../physics/worldReplacement";
import {assertHvpDecodedGame,assertHvpDecodedLabGame,type HvpDecodedGame,type HvpDecodedLabGame} from "./gameCheckpoint";
import {HvpRenderStageRecoveryError} from "../presentation/renderStageRecovery";

type HvpSceneReplacementBackend={
  read:()=>ReturnType<HvpPhysicsClient["read"]>;command:(kind:"Pause")=>Promise<void>;
  prepare:()=>Promise<ReturnType<HvpPhysicsClient["read"]>>;commit:()=>Promise<void>;publish:()=>void;finalize:()=>Promise<void>;rollback:()=>Promise<void>;
};
/** Both generations stay owned until Root, input, World and render B are published. */
const replaceSceneCore=async(physics:HvpSceneReplacementBackend,
  stage:(snapshot:ReturnType<HvpPhysicsClient["read"]>)=>HvpStagedTerrain|Promise<HvpStagedTerrain>,current:()=>boolean)=>{
  if(!current()){throw new Error("Stale scene restore");}
  const facts=()=>{const s=physics.read();return JSON.stringify({status:s.status,ticks:s.ticks,terrainGeneration:s.terrainGeneration,
    bodies:s.bodies,player:s.player,bodyCount:s.bodyCount,colliderCount:s.colliderCount});};
  const before=facts();
  let prepared=false,finalized=false,render:HvpStagedTerrain|undefined;
  try{
    if(!current()){throw new Error("Stale scene restore");}
    const candidate=await physics.prepare();prepared=true;
    if(!current()){throw new Error("Stale prepared scene");}
    render=await stage(candidate);
    if(!current()){throw new Error("Stale graphics-staged scene");}
    await physics.commit();
    if(!current()){throw new Error("Stale scene before publication");}
    physics.publish();render.publish();
    await physics.finalize();finalized=true;
    render.finish();
  }catch(error){
    let restored=!finalized&&!(error instanceof HvpRenderStageRecoveryError)&&!(error instanceof Error&&error.message.includes("RecoveryHold"));
    if(!finalized){
      try{render?.rollback();}catch{restored=false;}
      if(prepared){try{await physics.rollback();}catch{restored=false;}}
    }
    try{if(facts()!==before||!current()){restored=false;}}catch{restored=false;}
    if(!restored){try{await physics.command("Pause");}catch{/* No unproven restoration claim. */}
      throw new Error(`RecoveryHold: scene restoration unproven: ${String(error)}`);}
    throw error;
  }
};

/** Public .12 scene restore contract remains unchanged. */
export const replaceHvpScene=async(game:HvpDecodedGame,id:string,physics:HvpPhysicsClient,
  replacements:readonly {index:number;mesh:HvpCollisionSector}[],
  stage:(snapshot:ReturnType<HvpPhysicsClient["read"]>)=>HvpStagedTerrain|Promise<HvpStagedTerrain>,
  current:()=>boolean,completeCollision?:HvpCompleteStaticCollision)=>{
  assertHvpDecodedGame(game);
  return replaceSceneCore({
    read:()=>physics.read(),command:kind=>physics.command(kind),
    prepare:()=>physics.prepareRestore(id,game.checkpoint.world,replacements,completeCollision),
    commit:()=>physics.commitRestore(id),publish:()=>physics.publishRestore(),finalize:()=>physics.finalizeRestore(id),rollback:()=>physics.rollbackRestore(id)
  },stage,current);
};

/** @internal Private LAB restore wrapper; it shares the same publication and RecoveryHold transaction kernel. */
export const replaceHvpLabScene=async(game:HvpDecodedLabGame,id:string,physics:HvpLabPhysicsClient,completeCollision:HvpLabCompleteStaticCollision,
  stage:(snapshot:ReturnType<HvpLabPhysicsClient["read"]>)=>HvpStagedTerrain|Promise<HvpStagedTerrain>,current:()=>boolean)=>{
  assertHvpDecodedLabGame(game);
  return replaceSceneCore({
    read:()=>physics.read(),command:kind=>physics.command(kind),prepare:()=>physics.prepareLabRestore(id,game,completeCollision),
    commit:()=>physics.commitLabRestore(id),publish:()=>physics.publishLabRestore(),finalize:()=>physics.finalizeLabRestore(id),
    rollback:()=>physics.rollbackLabRestore(id)
  },stage,current);
};
