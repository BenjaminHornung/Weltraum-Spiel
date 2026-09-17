import {createHvpPhysicsSession,type HvpPhysicsSession} from "./session";
import type {HvpWorldCheckpoint} from "../persistence/worldCheckpoint";
import type {HvpCollisionSector} from "./terrainColliders";
import {validateHvpNeighborCheckpoint} from "../runtime/residency";

/** A stays owned and paused until validated B and its render products are ready. */
export const prepareHvpWorldReplacement=async(before:HvpPhysicsSession,checkpoint:unknown,
  replacements:readonly {index:number;mesh:HvpCollisionSector}[])=>{
  const previous=before.checkpoint(); // Reject in-flight cuts/Hold, not just a superficially paused clock.
  const c=checkpoint as HvpWorldCheckpoint|null;
  if(!c||!c.dropSpawn){throw new Error("Missing World checkpoint");}
  const oldSectors=before.copyCollision(),baseCount=previous.neighbor?.baseSectorCount??oldSectors.length;
  if(c.neighbor){validateHvpNeighborCheckpoint(c.neighbor);if(c.neighbor.baseSectorCount!==baseCount){throw new Error("Foreign static collision catalogue");}}
  const count=baseCount+(c.neighbor?.resident?64:0);
  if(!Array.isArray(replacements)||replacements.length>128||new Set(replacements.map(r=>r.index)).size!==replacements.length
    ||replacements.some(r=>!Number.isSafeInteger(r.index)||r.index<0||r.index>=count||(r.index>=64&&r.index<baseCount))){
    throw new Error("Invalid restored terrain sectors");
  }
  const sectors=[...oldSectors.slice(0,count)];
  for(const r of replacements){sectors[r.index]=r.mesh;}
  for(let i=0;i<count;i+=1){if(!sectors[i]){throw new Error("Missing restored terrain sector");}}
  const facts=()=>{const {stepCpuMs:_step,...s}=before.read();return JSON.stringify(s);};
  const originalFacts=facts();
  const candidate=await createHvpPhysicsSession(sectors,c.dropSpawn,c.gravity,undefined,undefined,undefined,c.sessionId,c);
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
export type HvpWorldReplacement=Awaited<ReturnType<typeof prepareHvpWorldReplacement>>;
