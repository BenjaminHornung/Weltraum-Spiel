import {createSaveCodec} from "../../browser-storage/codec";
import {prepareSaveImport} from "../../browser-storage/exportImport";
import type {SaveRepository} from "../../browser-storage/saveRepository";
import type {SaveImportPolicy} from "../../browser-storage/types";
import {createUniverseClock,validateSaveGameEnvelopeV1,type SaveGameEnvelopeV1} from "../../persistence";
import {decodeHvpLabGame,decodeHvpColdLabGame} from "./gameCheckpoint";

type HvpStoredGame={readonly checkpoint:{readonly signature:string;readonly world:{readonly tick:{readonly ticks:number}}}};
type HvpColdStoredGame<T extends HvpStoredGame>={readonly game:T;readonly recipeRetainedBytes:number};
type HvpStoreCodec<T extends HvpStoredGame>={
  readonly defaultSlot:string;readonly slot:(id:string)=>string;readonly decode:(value:unknown)=>T;
  readonly decodeCold:(value:unknown,admitPrepare:(workingBytes:number)=>void)=>HvpColdStoredGame<T>;
};
const gameVersion="hestia-playable-v1";
const readEnvelope=<T extends HvpStoredGame>(envelope:SaveGameEnvelopeV1,decode:(value:unknown)=>T):T=>{
  if(envelope.gameVersion!==gameVersion||envelope.player.playerId!=="player:hvp"||envelope.player.activeShipId!==null
    ||envelope.player.activeMissionRef!==null||Object.keys(envelope.player.data).join(",")!=="hestia"
    ||[envelope.ships,envelope.drones,envelope.stations,envelope.bases,envelope.missions,envelope.encounters,envelope.discoveries,
      envelope.definitionsVersionRefs,envelope.worldEvents.events].some(a=>a.length!==0)){
    throw new Error("Not a standalone Hestia save");
  }
  const game=decode(envelope.player.data.hestia);
  if(envelope.universeTime.tick!==game.checkpoint.world.tick.ticks*2
    ||envelope.universeTime.epochSeconds!==game.checkpoint.world.tick.ticks/60){throw new Error("Hestia/Universe tick mismatch");}
  return game;
};

/** @internal Shared HVP envelope/CAS/import path; each facade binds one fixed decoder and slot policy. */
export const createHvpSaveStoreCore=<T extends HvpStoredGame>(repository:SaveRepository,store:HvpStoreCodec<T>)=>{
  const codec=createSaveCodec([]);
  return {
    initialize:()=>repository.initialize(),
    list:()=>repository.listSlots(),
    async save(value:unknown,expectedRevision:number|null,id=store.defaultSlot){
      const game=store.decode(value),c=game.checkpoint,time=createUniverseClock(c.world.tick.ticks*2);
      const envelope=validateSaveGameEnvelopeV1({schemaVersion:1,gameVersion,saveId:`save:hvp.${c.signature.split(":")[1]}`,
        universeTime:time,definitionsVersionRefs:[],player:{playerId:"player:hvp",activeShipId:null,activeMissionRef:null,data:{hestia:c}},
        ships:[],drones:[],stations:[],bases:[],missions:[],encounters:[],discoveries:[],worldEvents:{events:[]},
        metadata:{createdAtTick:time.tick,updatedAtTick:time.tick,provenance:{owner:"hestia-prototype"}}},[]);
      return repository.writeSlot({slotId:store.slot(id),expectedRevision,envelope,lastWriteReason:"ManualSave"});
    },
    async load(id=store.defaultSlot){
      const saved=await repository.readSlot(store.slot(id));
      return Object.freeze({game:readEnvelope(saved.envelope,store.decode),metadata:saved.metadata});
    },
    async loadCold(admitPrepare:(workingBytes:number)=>void,id=store.defaultSlot){
      const saved=await repository.readSlot(store.slot(id));let recipeRetainedBytes=0;
      const game=readEnvelope(saved.envelope,value=>{
        const decoded=store.decodeCold(value,admitPrepare);recipeRetainedBytes=decoded.recipeRetainedBytes;return decoded.game;
      });
      return Object.freeze({game,metadata:saved.metadata,recipeRetainedBytes});
    },
    export:(id=store.defaultSlot)=>repository.exportSlot(store.slot(id)),
    async import(bundle:unknown,policy:SaveImportPolicy){
      // Validate both the existing transport and HVP domain BEFORE any write.
      const prepared=await prepareSaveImport(codec,bundle,policy);
      store.slot(prepared.targetSlotId);readEnvelope(prepared.decoded.envelope,store.decode);
      return repository.importSlot(prepared.decoded.bundle,policy);
    },
    close:()=>repository.close()
  };
};

export const HVP_PHY01_LAB_SAVE_SLOT="hvp-phy01-migration2-lab-r01";
const labSlot=(id:string):string=>{
  if(id!==HVP_PHY01_LAB_SAVE_SLOT){throw new Error("PHY-01 lab saves require their isolated slot");}
  return id;
};
/** Explicit-repository-only lab facade; no IndexedDB default or public persistence-index export. */
export const createHvpPhy01LabSaveStore=(repository:SaveRepository)=>createHvpSaveStoreCore(repository,{
  defaultSlot:HVP_PHY01_LAB_SAVE_SLOT,slot:labSlot,decode:decodeHvpLabGame,decodeCold:decodeHvpColdLabGame
});
