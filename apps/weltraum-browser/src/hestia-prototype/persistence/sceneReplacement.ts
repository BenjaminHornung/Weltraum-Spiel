import type {HvpPhysicsClient} from "../physics/client";
import type {HvpStagedTerrain} from "../terrain/terrainConsumer";
import type {HvpCollisionSector} from "../physics/terrainColliders";
import {assertHvpDecodedGame,type HvpDecodedGame} from "./gameCheckpoint";

/** Both generations stay owned until Root, input, World and render B are published. */
export const replaceHvpScene=async(game:HvpDecodedGame,id:string,physics:HvpPhysicsClient,
  replacements:readonly {index:number;mesh:HvpCollisionSector}[],
  stage:(snapshot:ReturnType<HvpPhysicsClient["read"]>)=>HvpStagedTerrain|Promise<HvpStagedTerrain>,
  current:()=>boolean)=>{
  assertHvpDecodedGame(game);
  if(!current()){throw new Error("Stale scene restore");}
  const facts=()=>{const s=physics.read();return JSON.stringify({status:s.status,ticks:s.ticks,terrainGeneration:s.terrainGeneration,
    bodies:s.bodies,player:s.player,bodyCount:s.bodyCount,colliderCount:s.colliderCount});};
  const before=facts();
  let prepared=false,finalized=false,render:HvpStagedTerrain|undefined;
  try{
    if(!current()){throw new Error("Stale scene restore");}
    const candidate=await physics.prepareRestore(id,game.checkpoint.world,replacements);prepared=true;
    if(!current()){throw new Error("Stale prepared scene");}
    render=await stage(candidate);
    await physics.commitRestore(id);
    if(!current()){throw new Error("Stale scene before publication");}
    physics.publishRestore();render.publish();
    await physics.finalizeRestore(id);finalized=true;
    render.finish();
  }catch(error){
    let restored=!finalized&&!(error instanceof Error&&error.message.includes("RecoveryHold"));
    if(!finalized){
      try{render?.rollback();}catch{restored=false;}
      if(prepared){try{await physics.rollbackRestore(id);}catch{restored=false;}}
    }
    try{if(facts()!==before||!current()){restored=false;}}catch{restored=false;}
    if(!restored){try{await physics.command("Pause");}catch{/* No unproven restoration claim. */}
      throw new Error(`RecoveryHold: scene restoration unproven: ${String(error)}`);}
    throw error;
  }
};
