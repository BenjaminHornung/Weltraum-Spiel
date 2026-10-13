import {IndexedDbSaveRepository} from "../../browser-storage/indexedDbSaveRepository";
import type {SaveRepository} from "../../browser-storage/saveRepository";
import {decodeHvpGame,decodeHvpColdGame} from "./gameCheckpoint";
import {createHvpSaveStoreCore} from "./phy01LabSave";

export const HVP_SAVE_DATABASE="weltraum-hestia-prototype-v1";
export const HVP_SAVE_SLOT="hvp-primary";
const slot=(id:string):string=>{
  if(!/^hvp-[a-z0-9-]{1,96}$/.test(id)){throw new Error("Hestia saves require their own slot namespace");}
  return id;
};

/** Reuses the repository's one-record payload+metadata transaction and CAS. */
export const createHvpSaveStore=(repository:SaveRepository=new IndexedDbSaveRepository([],{databaseId:HVP_SAVE_DATABASE}))=>
  createHvpSaveStoreCore(repository,{defaultSlot:HVP_SAVE_SLOT,slot,decode:decodeHvpGame,decodeCold:decodeHvpColdGame});
