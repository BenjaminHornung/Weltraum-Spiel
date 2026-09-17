import {IndexedDbSaveRepository,createSaveCodec,type SaveRepository,type SaveImportPolicy} from "../../browser-storage";
import {prepareSaveImport} from "../../browser-storage/exportImport";
import {createUniverseClock,validateSaveGameEnvelopeV1,type SaveGameEnvelopeV1} from "../../persistence";
import {decodeHvpGame,type HvpDecodedGame} from "./gameCheckpoint";

export const HVP_SAVE_DATABASE="weltraum-hestia-prototype-v1";
export const HVP_SAVE_SLOT="hvp-primary";
const gameVersion="hestia-playable-v1";
const slot=(id:string):string=>{
  if(!/^hvp-[a-z0-9-]{1,96}$/.test(id)){throw new Error("Hestia saves require their own slot namespace");}
  return id;
};
const readEnvelope=(envelope:SaveGameEnvelopeV1):HvpDecodedGame=>{
  if(envelope.gameVersion!==gameVersion||envelope.player.playerId!=="player:hvp"||envelope.player.activeShipId!==null
    ||envelope.player.activeMissionRef!==null||Object.keys(envelope.player.data).join(",")!=="hestia"
    ||[envelope.ships,envelope.drones,envelope.stations,envelope.bases,envelope.missions,envelope.encounters,envelope.discoveries,
      envelope.definitionsVersionRefs,envelope.worldEvents.events].some(a=>a.length!==0)){
    throw new Error("Not a standalone Hestia save");
  }
  const game=decodeHvpGame(envelope.player.data.hestia);
  if(envelope.universeTime.tick!==game.checkpoint.world.tick.ticks*2
    ||envelope.universeTime.epochSeconds!==game.checkpoint.world.tick.ticks/60){throw new Error("Hestia/Universe tick mismatch");}
  return game;
};

/** Reuses the repository's one-record payload+metadata transaction and CAS. */
export const createHvpSaveStore=(repository:SaveRepository=new IndexedDbSaveRepository([],{databaseId:HVP_SAVE_DATABASE}))=>{
  const codec=createSaveCodec([]);
  return {
    initialize:()=>repository.initialize(),
    list:()=>repository.listSlots(),
    async save(value:unknown,expectedRevision:number|null,id=HVP_SAVE_SLOT){
      const game=decodeHvpGame(value),c=game.checkpoint,time=createUniverseClock(c.world.tick.ticks*2);
      const envelope=validateSaveGameEnvelopeV1({schemaVersion:1,gameVersion,saveId:`save:hvp.${c.signature.split(":")[1]}`,
        universeTime:time,definitionsVersionRefs:[],player:{playerId:"player:hvp",activeShipId:null,activeMissionRef:null,data:{hestia:c}},
        ships:[],drones:[],stations:[],bases:[],missions:[],encounters:[],discoveries:[],worldEvents:{events:[]},
        metadata:{createdAtTick:time.tick,updatedAtTick:time.tick,provenance:{owner:"hestia-prototype"}}},[]);
      return repository.writeSlot({slotId:slot(id),expectedRevision,envelope,lastWriteReason:"ManualSave"});
    },
    async load(id=HVP_SAVE_SLOT){
      const saved=await repository.readSlot(slot(id));
      return Object.freeze({game:readEnvelope(saved.envelope),metadata:saved.metadata});
    },
    export:(id=HVP_SAVE_SLOT)=>repository.exportSlot(slot(id)),
    async import(bundle:unknown,policy:SaveImportPolicy){
      // Validate both the existing transport and HVP domain BEFORE any write.
      const prepared=await prepareSaveImport(codec,bundle,policy);
      slot(prepared.targetSlotId);readEnvelope(prepared.decoded.envelope);
      return repository.importSlot(prepared.decoded.bundle,policy);
    },
    close:()=>repository.close()
  };
};
