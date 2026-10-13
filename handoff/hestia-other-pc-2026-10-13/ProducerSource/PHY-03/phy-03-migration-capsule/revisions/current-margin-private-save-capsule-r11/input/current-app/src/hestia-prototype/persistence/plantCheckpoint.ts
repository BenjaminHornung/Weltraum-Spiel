import {createPersistenceSignature} from "../../persistence";
import {representationKey} from "../../presentation";
import {HVP_TERRAIN_REPRESENTATION_KEY} from "../../hvp/hvpTerrain";
import {HVP_VEGETATION_VERSION,estimateHvpVegetationSourceBytes,hvpPlantSourceDigest,
  type HvpPlantSource,type HvpPlantInstance,type HvpPlantVolume,type HvpPlantAttachment} from "../presentation/vegetation";
import type {HvpCellReader} from "../terrain/picking";
import {encodeHvpGrid,decodeHvpGrid,hvpGridCheckpointBytes,type HvpGridCheckpoint} from "./gridCheckpoint";

export interface HvpPlantCheckpoint {
  readonly version:"hvp-plant-checkpoint-v1";readonly generator:string;
  readonly instance:HvpPlantInstance;readonly wood:HvpGridCheckpoint|null;readonly decoration:HvpGridCheckpoint;
  readonly anchors:HvpPlantSource["anchors"];readonly attachments:HvpPlantSource["attachments"];
  readonly decorationPhysics:"none";readonly digest:string;readonly signature:string;
}
const grid=(v:HvpPlantVolume)=>encodeHvpGrid({...v,readSlot:(x,y,z)=>v.slotAt(x,y,z)});
export const encodeHvpPlant=(source:HvpPlantSource):HvpPlantCheckpoint=>{
  const data={version:"hvp-plant-checkpoint-v1" as const,generator:HVP_VEGETATION_VERSION,instance:source.instance,
    wood:source.wood===null?null:grid(source.wood),decoration:grid(source.decoration),anchors:source.anchors,
    attachments:source.attachments,decorationPhysics:source.decorationPhysics,digest:source.digest};
  return Object.freeze({...data,signature:createPersistenceSignature(data)});
};

/** All run counts and total slot bytes are admitted before any decoded volume. */
export const hvpPlantCheckpointBytes=(value:unknown):number=>{
  const p=value as HvpPlantCheckpoint|null;
  if(!p||Object.keys(p).sort().join(",")!=="anchors,attachments,decoration,decorationPhysics,digest,generator,instance,signature,version,wood"
    ||p.version!=="hvp-plant-checkpoint-v1"||p.generator!==HVP_VEGETATION_VERSION||p.decorationPhysics!=="none"
    ||typeof p.digest!=="string"||!/^[0-9a-f]{8}$/.test(p.digest)||!p.instance){throw new Error("Unsupported vegetation checkpoint/profile");}
  const i=p.instance;representationKey(i.id);
  if(Object.keys(i).sort().join(",")!=="id,kind,position,variant"||!i.id.startsWith("hvp:flora:")
    ||!["tree","reed","broadleaf","violet","amber"].includes(i.kind)||!Number.isSafeInteger(i.variant)||i.variant<0||i.variant>3
    ||!i.position||Object.keys(i.position).sort().join(",")!=="x,y,z"
    ||![i.position.x,i.position.y,i.position.z].every(n=>Number.isFinite(n)&&Number.isSafeInteger(n*8))
    ||Math.abs(i.position.x)>=16||Math.abs(i.position.z)>=16||i.position.y< -8||i.position.y>=8
    ||(i.kind==="tree")!==(p.wood!==null)||!Array.isArray(p.anchors)||p.anchors.length>8
    ||!Array.isArray(p.attachments)||p.attachments.length<1||p.attachments.length>16){throw new Error("Invalid plant checkpoint identity/frame");}
  const bytes=hvpGridCheckpointBytes(p.decoration)+(p.wood===null?0:hvpGridCheckpointBytes(p.wood));
  if(bytes!==estimateHvpVegetationSourceBytes([i])||(p.wood!==null
    &&(JSON.stringify(p.wood.size)!==JSON.stringify(p.decoration.size)||createPersistenceSignature(p.wood.origin)!==createPersistenceSignature(p.decoration.origin)))){
    throw new Error("Plant checkpoint grid/frame budget mismatch");
  }
  const ids=new Set<string>();
  for(const a of [...p.anchors,...p.attachments]){
    representationKey(a.id);if(ids.has(a.id)){throw new Error("Duplicate plant support identity");}ids.add(a.id);
    const c="cell"in a?a.cell:a.supportCell;
    if(!Array.isArray(c)||c.length!==3||!c.every(n=>Number.isSafeInteger(n)&&n>=0&&n<256)){throw new Error("Invalid plant support cell");}
  }
  const {signature,...data}=p;
  if(signature!==createPersistenceSignature(data)){throw new Error("Plant checkpoint signature mismatch");}
  return bytes;
};
export const decodeHvpPlant=(value:unknown,terrain:HvpCellReader):HvpPlantSource=>{
  hvpPlantCheckpointBytes(value);const p=value as HvpPlantCheckpoint;
  const volume=(checkpoint:HvpGridCheckpoint):HvpPlantVolume=>{
    const decoded=decodeHvpGrid(checkpoint);
    return Object.freeze({sizeX:decoded.sizeX,sizeY:decoded.sizeY,sizeZ:decoded.sizeZ,cellMeters:.125,originMeters:decoded.originMeters,
      byteLength:decoded.byteLength,slotAt:(x:number,y:number,z:number)=>decoded.readSlot(x,y,z)??0,copySlots:decoded.copySlots});
  };
  const wood=p.wood===null?null:volume(p.wood),decoration=volume(p.decoration);
  if(wood!==null&&wood.copySlots().some(v=>v>1)||decoration.copySlots().some(v=>v>3)
    ||hvpPlantSourceDigest(p.instance.id,[wood,decoration])!==p.digest){throw new Error("Plant checkpoint material/content mismatch");}
  if(wood===null?p.anchors.length!==0:p.anchors.length<3){throw new Error("Plant checkpoint anchor count mismatch");}
  const knownSolid=(x:number,y:number,z:number):boolean=>{const s=terrain.readSlot(x,y,z);return s!==undefined&&s!==0;};
  const anchors=p.anchors.map(a=>{
    if(Object.keys(a).sort().join(",")!=="cell,id"||wood===null||wood.slotAt(...a.cell)!==1){throw new Error("Missing saved root anchor");}
    const base=p.instance.position,origin=wood.originMeters;
    const x=Math.floor((base.x+origin.x+(a.cell[0]+.5)*.125-terrain.originMeters.x)/.125);
    const y=Math.round((base.y+origin.y+a.cell[1]*.125-terrain.originMeters.y)/.125)-1;
    const z=Math.floor((base.z+origin.z+(a.cell[2]+.5)*.125-terrain.originMeters.z)/.125);
    if(!knownSolid(x,y,z)){throw new Error("Saved root anchor has no terrain support");}
    return Object.freeze({id:a.id,cell:Object.freeze([...a.cell]) as readonly[number,number,number]});
  });
  const attachments=p.attachments.map((a:HvpPlantAttachment)=>{
    if(Object.keys(a).sort().join(",")!=="id,ownerId,supportCell,supportKind,supportOwnerId"||a.ownerId!==p.instance.id){throw new Error("Foreign plant attachment owner");}
    if(a.supportKind==="wood"){
      if(wood===null||a.supportOwnerId!==p.instance.id||wood.slotAt(...a.supportCell)!==1){throw new Error("Missing wood attachment support");}
    }else if(a.supportKind==="terrain"){
      if(wood!==null||a.supportOwnerId!==HVP_TERRAIN_REPRESENTATION_KEY||!knownSolid(...a.supportCell)){throw new Error("Missing terrain attachment support");}
    }else{throw new Error("Unknown attachment support kind");}
    return Object.freeze({...a,supportCell:Object.freeze([...a.supportCell]) as readonly[number,number,number]});
  });
  return Object.freeze({instance:Object.freeze({...p.instance,position:Object.freeze({...p.instance.position})}),wood,decoration,
    anchors:Object.freeze(anchors),attachments:Object.freeze(attachments),decorationPhysics:"none",digest:p.digest});
};
