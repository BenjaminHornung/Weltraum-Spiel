import {createHvpPhysicsSession,createHvpWorkerPhysicsSession,createHvpChunkWorkerPhysicsSession,type HvpPhysicsSession} from "./session";
import type {HvpWorldCheckpoint} from "../persistence/worldCheckpoint";
import type {HvpCollisionSector} from "./terrainColliders";
import {validateHvpNeighborCheckpoint} from "../runtime/residency";
import {validateHvpChunkStaticLayout,type HvpChunkStaticLayout} from "./staticTerrainLayout";
import {validateHvpChunkBuffers} from "../../workers/hvpChunkJob";

export interface HvpCompleteStaticCollision {
  readonly sectors:readonly HvpCollisionSector[];
  readonly layout:HvpChunkStaticLayout|null;
}

/**
 * A stays owned and paused until validated B and its render products are ready. `workerOwned` is fixed
 * per factory (never a caller input) and only selects the candidate's session factory.
 */
const worldReplacementFor=(workerOwned:boolean,complete?:HvpCompleteStaticCollision)=>async(before:HvpPhysicsSession,checkpoint:unknown,
  replacements:readonly {index:number;mesh:HvpCollisionSector}[],measureBodyHold=false)=>{
  const previous=before.checkpoint(); // Reject in-flight cuts/Hold, not just a superficially paused clock.
  const c=checkpoint as HvpWorldCheckpoint|null;
  if(!c||!c.dropSpawn){throw new Error("Missing World checkpoint");}
  let sectors:HvpCollisionSector[],layout=before.staticTerrainLayout();
  if(complete!==undefined){
    if(!workerOwned||replacements.length!==0||!Array.isArray(complete.sectors)||complete.sectors.length>4094){throw new Error("Invalid complete static collision coverage");}
    layout=complete.layout===null?null:validateHvpChunkStaticLayout(complete.layout);
    for(let i=0;i<complete.sectors.length;i+=1){
      if(!Object.hasOwn(complete.sectors,i)){throw new Error("Incomplete static collision coverage");}
      const s=complete.sectors[i]!;validateHvpChunkBuffers([s.vertices.buffer as ArrayBuffer,s.indices.buffer as ArrayBuffer]);
    }
    sectors=[...complete.sectors];
  }else{
    const oldSectors=before.copyCollision(),baseCount=previous.neighbor?.baseSectorCount??oldSectors.length;
    if(c.neighbor){validateHvpNeighborCheckpoint(c.neighbor);if(c.neighbor.baseSectorCount!==baseCount){throw new Error("Foreign static collision catalogue");}}
    const count=baseCount+(c.neighbor?.resident?(layout?.neighborTerrainCount??64):0),primaryCount=layout?.primaryTerrainCount??64;
    if(!Array.isArray(replacements)||replacements.length>(layout?512:128)||new Set(replacements.map(r=>r.index)).size!==replacements.length
      ||replacements.some(r=>!Number.isSafeInteger(r.index)||r.index<0||r.index>=count||(r.index>=primaryCount&&r.index<baseCount))){
      throw new Error("Invalid restored terrain sectors");
    }
    sectors=[...oldSectors.slice(0,count)];
    for(const r of replacements){sectors[r.index]=r.mesh;}
    for(let i=0;i<count;i+=1){if(!sectors[i]){throw new Error("Missing restored terrain sector");}}
  }
  const facts=()=>{const {stepCpuMs:_step,...s}=before.read();return JSON.stringify(s);};
  const originalFacts=facts();
  const args=[sectors,c.dropSpawn,c.gravity,undefined,undefined,undefined,c.sessionId,c,"branch",measureBodyHold] as const;
  const candidate=await (workerOwned&&layout?createHvpChunkWorkerPhysicsSession(layout,...args):(workerOwned?createHvpWorkerPhysicsSession:createHvpPhysicsSession)(...args));
  let state:"Prepared"|"Committed"|"Finalized"|"RolledBack"|"RecoveryHold"="Prepared";
  const hold=(error:unknown):never=>{state="RecoveryHold";candidate.pause();before.pause();throw new Error(`RecoveryHold: ${String(error)}`);};
  try{if(facts()!==originalFacts){throw new Error("Live World changed during restore preparation");}}
  catch(error){candidate.dispose();throw error;}
  return {
    candidate,
    get state(){return state;},
    commit():HvpPhysicsSession{
      if(state!=="Prepared"||facts()!==originalFacts){throw new Error("Stale World replacement");}
      state="Committed";return candidate;
    },
    rollback():HvpPhysicsSession{
      if(state!=="Prepared"&&state!=="Committed"){throw new Error(`World replacement ${state}`);}
      try{candidate.dispose();if(candidate.read().bodyCount!==0||facts()!==originalFacts){throw new Error("Old World restoration is unproven");}}
      catch(error){return hold(error);}
      state="RolledBack";return before;
    },
    finalize():void{
      if(state!=="Committed"){throw new Error("World replacement not committed");}
      try{before.dispose();if(before.read().bodyCount!==0){throw new Error("Old World retirement failed");}}
      catch(error){hold(error);}
      state="Finalized";
    },
    dispose():void{
      // Terminal shutdown owns both worlds, including uncertain retirement.
      try{candidate.dispose();}finally{before.dispose();}
    }
  };
};
export const prepareHvpWorldReplacement=worldReplacementFor(false);
/** OWNER-INTERNAL (module export only): the first-party Physics-Worker Restore; its candidate keeps the Worker body route. */
export const prepareHvpWorkerWorldReplacement=worldReplacementFor(true);
/** Owner-internal whole-catalogue replacement, validated by the unchanged full v1 collision digest. */
export const prepareHvpWorkerWorldLayoutReplacement=async(before:HvpPhysicsSession,checkpoint:unknown,complete:HvpCompleteStaticCollision,measureBodyHold=false)=>
  worldReplacementFor(true,complete)(before,checkpoint,[],measureBodyHold);
export type HvpWorldReplacement=Awaited<ReturnType<typeof prepareHvpWorldReplacement>>;
