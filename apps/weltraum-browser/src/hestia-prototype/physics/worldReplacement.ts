import {createHvpPhysicsSession,createHvpWorkerPhysicsSession,createHvpChunkWorkerPhysicsSession,
  bindHvpLabWorldReplacementCaptureSectors,createHvpLabReplacementCandidate,issueHvpLabWorldReplacementCapture,releaseHvpLabWorldReplacementCapture,
  type HvpLabWorldReplacementCapture,type HvpLabWorldReplacementCaptureWitness,
  type HvpPhysicsSession,type HvpLabPhysicsSession} from "./session";
import type {HvpWorldCheckpoint,HvpLabWorldCheckpoint} from "../persistence/worldCheckpoint";
import {assertHvpDecodedLabGame,type HvpDecodedLabGame} from "../persistence/gameCheckpoint";
import {HVP_SOLVER_VERSION} from "./profile";
import type {HvpCollisionSector} from "./terrainColliders";
import {validateHvpNeighborCheckpoint} from "../runtime/residency";
import {validateHvpChunkStaticLayout,type HvpChunkStaticLayout} from "./staticTerrainLayout";
import {validateHvpChunkBuffers} from "../../workers/hvpChunkJob";
import {requireExactKeys,requirePlainRecord} from "../../voxel/adaptive/validation";

export interface HvpCompleteStaticCollision {
  readonly sectors:readonly HvpCollisionSector[];
  readonly layout:HvpChunkStaticLayout|null;
}
/** @internal Complete collision replacement for the fixed private Chunk-LAB owner only. */
export interface HvpLabCompleteStaticCollision {
  readonly sectors:readonly HvpCollisionSector[];
  readonly layout:HvpChunkStaticLayout;
}
const replacementGetOwnPropertyDescriptor=Object.getOwnPropertyDescriptor;
const replacementDataValue=(record:Record<string,unknown>,key:string,label:string):unknown=>{
  const descriptor=replacementGetOwnPropertyDescriptor(record,key);
  if(descriptor===undefined||!descriptor.enumerable||!("value" in descriptor)){throw new Error(`Invalid LAB complete data property ${label}/${key}`);}
  return descriptor.value;
};
const normalizeLabChunkLayout=(value:unknown,label:string):HvpChunkStaticLayout=>{
  const record=requirePlainRecord(value,label);
  requireExactKeys(record,["neighborTerrainCount","primaryTerrainCount","version"],label);
  return validateHvpChunkStaticLayout({
    version:replacementDataValue(record,"version",label),
    primaryTerrainCount:replacementDataValue(record,"primaryTerrainCount",label),
    neighborTerrainCount:replacementDataValue(record,"neighborTerrainCount",label)
  });
};
const sameLabChunkLayout=(left:HvpChunkStaticLayout,right:HvpChunkStaticLayout):boolean=>left.version===right.version
  &&left.primaryTerrainCount===right.primaryTerrainCount&&left.neighborTerrainCount===right.neighborTerrainCount;
const normalizeLabCompleteStaticCollision=(value:unknown):Readonly<{complete:HvpLabCompleteStaticCollision;count:number}>=>{
  const record=requirePlainRecord(value,"LAB complete collision");
  requireExactKeys(record,["layout","sectors"],"LAB complete collision");
  const rawSectors=replacementDataValue(record,"sectors","LAB complete collision");
  if(!Array.isArray(rawSectors)){throw new Error("Invalid complete static collision coverage");}
  const length=replacementGetOwnPropertyDescriptor(rawSectors,"length");
  if(length===undefined||!("value" in length)||!Number.isSafeInteger(length.value)||length.value<256||length.value>4094){
    throw new Error("Invalid complete static collision coverage");
  }
  const complete=Object.freeze({sectors:rawSectors as readonly HvpCollisionSector[],
    layout:normalizeLabChunkLayout(replacementDataValue(record,"layout","LAB complete collision"),"LAB complete layout")});
  return Object.freeze({complete,count:length.value as number});
};

type WorldCheckpoint=HvpWorldCheckpoint|HvpLabWorldCheckpoint;
type ReplacementState="Prepared"|"Committed"|"Finalized"|"RolledBack"|"RecoveryHold";
type Replacement<S>={readonly candidate:S;readonly state:ReplacementState;commit():S;rollback():S;finalize():void;dispose():void};
type ReplacementContext<S>={
  readonly workerOwned:boolean;readonly complete?:HvpCompleteStaticCollision|HvpLabCompleteStaticCollision;
  readonly create:(sectors:readonly HvpCollisionSector[],layout:HvpChunkStaticLayout|null,checkpoint:WorldCheckpoint,measure:boolean,
    witness?:HvpLabWorldReplacementCaptureWitness)=>Promise<S>;
  readonly admit?:(previous:WorldCheckpoint,layout:HvpChunkStaticLayout|null)=>void;
  readonly beforeCapture?:(layout:HvpChunkStaticLayout|null)=>void;
  readonly capture?:(before:S,replacements:readonly {index:number;mesh:HvpCollisionSector}[],complete?:HvpCompleteStaticCollision|HvpLabCompleteStaticCollision)=>HvpLabWorldReplacementCapture;
  readonly bindCapture?:(witness:HvpLabWorldReplacementCaptureWitness,sectors:readonly HvpCollisionSector[],layout?:HvpChunkStaticLayout|null)=>void;
  readonly releaseCapture?:(witness:HvpLabWorldReplacementCaptureWitness)=>void;
  readonly current?:()=>boolean;
  readonly preparationHold?:(transaction:Replacement<S>,error:unknown)=>never;
};
export type HvpLabWorldReplacement=Replacement<HvpLabPhysicsSession>;
/** @internal Keeps both LAB owner handles reachable when preparation cleanup is unproven. */
export class HvpLabWorldReplacementPreparationError extends Error {
  constructor(readonly transaction:HvpLabWorldReplacement,cause:unknown){super(`RecoveryHold: LAB preparation cleanup unproven: ${String(cause)}`,{cause});}
}

/**
 * A stays owned and paused until validated B and its render products are ready. `workerOwned` is fixed
 * per factory (never a caller input) and only selects the candidate's session factory.
 */
const prepareWorldReplacement=async<S extends HvpPhysicsSession|HvpLabPhysicsSession>(before:S,checkpoint:unknown,
  replacements:readonly {index:number;mesh:HvpCollisionSector}[],measureBodyHold:boolean,context:ReplacementContext<S>):Promise<Replacement<S>>=>{
  const {workerOwned,complete,current:currentCallback,preparationHold,capture:takeCapture,bindCapture,releaseCapture,beforeCapture,admit,
    create:createCandidate}=context;
  const current=()=>currentCallback===undefined||currentCallback()===true;
  if(!current()){throw new Error("Stale World replacement");}
  let capture:HvpLabWorldReplacementCapture|undefined;
  try{
  let previous:WorldCheckpoint,layout:HvpChunkStaticLayout|null;
  if(takeCapture){
    layout=before.staticTerrainLayout();
    beforeCapture?.(layout);
    capture=takeCapture(before,replacements,complete);
    previous=capture.checkpoint;
  }else{
    previous=before.checkpoint(); // Reject in-flight cuts/Hold, not just a superficially paused clock.
    layout=before.staticTerrainLayout();
  }
  admit?.(previous,layout);
  const c=checkpoint as WorldCheckpoint|null;
  if(!c||!c.dropSpawn){throw new Error("Missing World checkpoint");}
  let sectors:readonly HvpCollisionSector[];
  if(complete!==undefined){
    if(!workerOwned||replacements.length!==0){throw new Error("Invalid complete static collision coverage");}
    const ownedComplete=capture?.complete;
    if(capture&&!ownedComplete){throw new Error("Missing owned LAB complete collision capture");}
    const completeSectors=ownedComplete?.sectors??complete.sectors;
    if(!ownedComplete&&(!Array.isArray(completeSectors)||completeSectors.length>4094)){throw new Error("Invalid complete static collision coverage");}
    layout=ownedComplete?.layout??(complete.layout===null?null:validateHvpChunkStaticLayout(complete.layout));
    for(let i=0;i<completeSectors.length;i+=1){
      if(!Object.hasOwn(completeSectors,i)){throw new Error("Incomplete static collision coverage");}
      const s=completeSectors[i]!;validateHvpChunkBuffers([s.vertices.buffer as ArrayBuffer,s.indices.buffer as ArrayBuffer]);
    }
    sectors=ownedComplete?.sectors??[...completeSectors];
  }else{
    const oldSectors=capture?.baseCollision??before.copyCollision(),ownedReplacements=capture?.replacements??replacements;
    const baseCount=previous.neighbor?.baseSectorCount??oldSectors.length;
    if(c.neighbor){validateHvpNeighborCheckpoint(c.neighbor);if(c.neighbor.baseSectorCount!==baseCount){throw new Error("Foreign static collision catalogue");}}
    const count=baseCount+(c.neighbor?.resident?(layout?.neighborTerrainCount??64):0),primaryCount=layout?.primaryTerrainCount??64;
    if(!Array.isArray(ownedReplacements)||ownedReplacements.length>(layout?512:128)||new Set(ownedReplacements.map(r=>r.index)).size!==ownedReplacements.length
      ||ownedReplacements.some(r=>!Number.isSafeInteger(r.index)||r.index<0||r.index>=count||(r.index>=primaryCount&&r.index<baseCount))){
      throw new Error("Invalid restored terrain sectors");
    }
    const assembled=[...oldSectors.slice(0,count)];
    for(const r of ownedReplacements){assembled[r.index]=r.mesh;}
    for(let i=0;i<count;i+=1){if(!assembled[i]){throw new Error("Missing restored terrain sector");}}
    sectors=assembled;
  }
  const facts=()=>{const {stepCpuMs:_step,...s}=before.read();return JSON.stringify(s);};
  const originalFacts=facts();
  if(capture){
    if(capture.complete){bindCapture?.(capture.witness,sectors,capture.complete.layout);}
    else{bindCapture?.(capture.witness,sectors);}
  }
  const candidate=await createCandidate(sectors,layout,c,measureBodyHold,capture?.witness);
  let state:ReplacementState="Prepared";
  const hold=(error:unknown):never=>{state="RecoveryHold";candidate.pause();before.pause();throw new Error(`RecoveryHold: ${String(error)}`);};
  const transaction:Replacement<S>={
    candidate,
    get state(){return state;},
    commit():S{
      if(state!=="Prepared"||!current()||facts()!==originalFacts){throw new Error("Stale World replacement");}
      state="Committed";return candidate;
    },
    rollback():S{
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
  try{if(!current()||facts()!==originalFacts){throw new Error("Live World changed during restore preparation");}}
  catch(error){
    try{candidate.dispose();if(preparationHold&&candidate.read().bodyCount!==0){throw new Error("Candidate disposal is unproven");}}
    catch(cleanup){
      if(preparationHold){
        state="RecoveryHold";
        try{candidate.pause();}catch{/* Both handles remain retained for terminal cleanup. */}
        try{before.pause();}catch{/* Neither owner's retirement is claimed. */}
        return preparationHold(transaction,cleanup);
      }
      throw cleanup;
    }
    throw error;
  }
  return transaction;
  }finally{if(capture){releaseCapture?.(capture.witness);}}
};
const worldReplacementFor=(workerOwned:boolean,complete?:HvpCompleteStaticCollision)=>async(before:HvpPhysicsSession,checkpoint:unknown,
  replacements:readonly {index:number;mesh:HvpCollisionSector}[],measureBodyHold=false)=>prepareWorldReplacement(before,checkpoint,replacements,measureBodyHold,{
    workerOwned,complete,create:async(sectors,layout,c,measure)=>{
      const args=[sectors,c.dropSpawn,c.gravity,undefined,undefined,undefined,c.sessionId,c,"branch",measure] as const;
      return workerOwned&&layout?createHvpChunkWorkerPhysicsSession(layout,...args):(workerOwned?createHvpWorkerPhysicsSession:createHvpPhysicsSession)(...args);
    }
  });
export const prepareHvpWorldReplacement=worldReplacementFor(false);
/** OWNER-INTERNAL (module export only): the first-party Physics-Worker Restore; its candidate keeps the Worker body route. */
export const prepareHvpWorkerWorldReplacement=worldReplacementFor(true);
/** Owner-internal whole-catalogue replacement, validated by the unchanged full v1 collision digest. */
export const prepareHvpWorkerWorldLayoutReplacement=async(before:HvpPhysicsSession,checkpoint:unknown,complete:HvpCompleteStaticCollision,measureBodyHold=false)=>
  worldReplacementFor(true,complete)(before,checkpoint,[],measureBodyHold);
export type HvpWorldReplacement=Awaited<ReturnType<typeof prepareHvpWorldReplacement>>;

/** @internal Direct LAB only; chunk/full-catalogue restore remains a separate context gate. */
export const prepareHvpLabWorldReplacement=async(before:HvpLabPhysicsSession,game:HvpDecodedLabGame,
  replacements:readonly {index:number;mesh:HvpCollisionSector}[],current:()=>boolean,measureBodyHold=false):Promise<HvpLabWorldReplacement>=>{
  if(typeof current!=="function"){throw new Error("LAB World replacement requires a current callback");}
  assertHvpDecodedLabGame(game);
  const c=game.checkpoint.world;
  return prepareWorldReplacement(before,c,replacements,measureBodyHold,{
    workerOwned:true,current,
    beforeCapture:layout=>{if(layout!==null){throw new Error("Unsupported direct LAB chunk World replacement");}},
    capture:(owner,inputs)=>issueHvpLabWorldReplacementCapture(owner,game,inputs,current),
    bindCapture:bindHvpLabWorldReplacementCaptureSectors,
    releaseCapture:releaseHvpLabWorldReplacementCapture,
    admit:(previous,layout)=>{
      if(layout!==null){throw new Error("Unsupported direct LAB chunk World replacement");}
      if(previous.solver!==HVP_SOLVER_VERSION||previous.sessionId!==c.sessionId||previous.gravity!==c.gravity){
        throw new Error("LAB World replacement solver/session/gravity mismatch");
      }
    },
    create:(_sectors,_layout,_checkpoint,measure,witness)=>{
      if(!witness){throw new Error("Missing issued LAB replacement capture");}
      return createHvpLabReplacementCandidate(witness,game,_sectors,measure);
    },
    preparationHold:(transaction,error)=>{throw new HvpLabWorldReplacementPreparationError(transaction,error);}
  });
};

/** @internal Complete-catalogue replacement for an existing fixed-layout private Chunk-LAB owner. */
export const prepareHvpLabWorldLayoutReplacement=async(before:HvpLabPhysicsSession,game:HvpDecodedLabGame,completeInput:HvpLabCompleteStaticCollision,
  current:()=>boolean,measureBodyHold=false):Promise<HvpLabWorldReplacement>=>{
  if(typeof current!=="function"){throw new Error("LAB World replacement requires a current callback");}
  assertHvpDecodedLabGame(game);
  const {complete,count}=normalizeLabCompleteStaticCollision(completeInput),c=game.checkpoint.world;
  if(c.solver!==HVP_SOLVER_VERSION){throw new Error("LAB World replacement solver/session/gravity mismatch");}
  const baseCount=c.neighbor?.baseSectorCount??count;
  if(baseCount<complete.layout.primaryTerrainCount||count!==baseCount+(c.neighbor?.resident?complete.layout.neighborTerrainCount:0)){
    throw new Error("Invalid complete static collision coverage");
  }
  return prepareWorldReplacement(before,c,[],measureBodyHold,{
    workerOwned:true,complete,current,
    beforeCapture:layout=>{
      if(layout===null||!sameLabChunkLayout(normalizeLabChunkLayout(layout,"LAB owner layout"),complete.layout)){
        throw new Error("LAB World replacement static layout mismatch");
      }
    },
    capture:(owner,inputs,supplied)=>{
      if(!supplied||supplied.layout===null){throw new Error("Missing LAB complete static layout");}
      return issueHvpLabWorldReplacementCapture(owner,game,inputs,current,{sectors:complete.sectors,layout:complete.layout});
    },
    bindCapture:bindHvpLabWorldReplacementCaptureSectors,
    releaseCapture:releaseHvpLabWorldReplacementCapture,
    admit:(previous,layout)=>{
      if(layout===null||!sameLabChunkLayout(normalizeLabChunkLayout(layout,"LAB owner layout"),complete.layout)
        ||previous.solver!==HVP_SOLVER_VERSION||previous.sessionId!==c.sessionId||previous.gravity!==c.gravity){
        throw new Error("LAB World replacement solver/session/gravity mismatch");
      }
    },
    create:(_sectors,_layout,_checkpoint,measure,witness)=>{
      if(!witness){throw new Error("Missing issued LAB replacement capture");}
      return createHvpLabReplacementCandidate(witness,game,_sectors,measure);
    },
    preparationHold:(transaction,error)=>{throw new HvpLabWorldReplacementPreparationError(transaction,error);}
  });
};
