import {canonicalizePersistenceValue,createPersistenceSignature,serializeCanonicalPersistenceValue} from "../../persistence";
import {HVP_COAST_MATERIAL_REGISTRY,HVP_COAST_SOURCE_VERSION,restoreHvpCoastSource} from "../../hvp/hvpCoastSource";
import type {HvpCameraCheckpoint} from "../../hvp/hvpCamera";
import {HVP_VEGETATION_VERSION} from "../presentation/vegetation";
import {createHvpLookProfile} from "../presentation/look";
import {HVP_EFFECT_VERSION} from "../presentation/visualEffects";
import {HVP_BRANCH_CELLS,HVP_SALVAGE_CELLS,HVP_PLAYER_PROFILE_DIGEST,resolveHvpGravity} from "../physics/profile";
import {readHvpBodyCells} from "../physics/bodyCutPlan";
import {createHvpTerrainRoot,validateHvpTerrainCheckpointHeader,type HvpTerrainCheckpoint} from "../terrain/cutPlan";
import type {HvpCutOutcome} from "../terrain/terrainConsumer";
import {hvpGridCheckpointBytes,decodeHvpGrid} from "./gridCheckpoint";
import {hvpPlantCheckpointBytes,decodeHvpPlant,type HvpPlantCheckpoint} from "./plantCheckpoint";
import {hvpWorldCheckpointBytes,decodeHvpWorld,type HvpWorldCheckpoint} from "./worldCheckpoint";
import {decodeHvpReceipts,type HvpReceiptCheckpoint,type HvpSimpleOutcome} from "./receiptCheckpoint";
import {validateHvpSalvageCheckpoint,savedHvpSalvageObservation,type HvpSalvageCheckpoint} from "../gameplay/salvageLoop";
import {restoreHvpEastRegion} from "../runtime/regionSource";

export const HVP_SAVE_TRANSPORT_BYTES=16*1024*1024;
export const HVP_SAVE_DECODE_BYTES=64*1024*1024;
export const HVP_SAVE_PROFILES=Object.freeze({source:HVP_COAST_SOURCE_VERSION,vegetation:HVP_VEGETATION_VERSION,
  look:createHvpLookProfile("readable").id,effects:HVP_EFFECT_VERSION,player:HVP_PLAYER_PROFILE_DIGEST,solver:"rapier-0.12.0"});
export interface HvpToolCheckpoint {readonly mode:number;readonly sequence:number;readonly structureSequence:number;readonly movingSequence:number;readonly edges:number}
export interface HvpViewCheckpoint {
  readonly camera:HvpCameraCheckpoint;readonly playerYaw:number;readonly playerPitch:number;readonly thirdPerson:boolean;readonly tool:HvpToolCheckpoint;
  readonly waterEnabled:boolean;readonly aoEnabled:boolean;
}
export interface HvpGameCheckpoint {
  readonly version:"hvp-game-checkpoint-v1";readonly profiles:typeof HVP_SAVE_PROFILES;
  readonly terrain:HvpTerrainCheckpoint;readonly plants:readonly HvpPlantCheckpoint[];readonly world:HvpWorldCheckpoint;
  readonly receipts:Readonly<{terrain:HvpReceiptCheckpoint<HvpCutOutcome>;structural:HvpReceiptCheckpoint<HvpSimpleOutcome>;moving:HvpReceiptCheckpoint<HvpSimpleOutcome>}>;
  readonly view:HvpViewCheckpoint;readonly progress:HvpSalvageCheckpoint|null;readonly signature:string;
  readonly neighbor?:Readonly<{version:"hvp-neighbor-scene-v1";terrain:HvpTerrainCheckpoint;lod:.125|.5}>|null;
}
const issued=new WeakSet<object>();
const safeInt=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const vector=(v:unknown,quaternion=false):boolean=>{
  if(!v||typeof v!=="object"||Object.keys(v).sort().join(",")!==(quaternion?"w,x,y,z":"x,y,z")){return false;}
  const a=Object.values(v);return a.every(n=>typeof n==="number"&&Number.isFinite(n)&&Math.abs(n)<1_000_000)
    &&(!quaternion||Math.abs(Math.hypot(...a)-1)<1e-6);
};
export const validateHvpViewCheckpoint=(value:unknown):HvpViewCheckpoint=>{
  const v=value as HvpViewCheckpoint|null,c=v?.camera,t=v?.tool;
  if(!v||Object.keys(v).sort().join(",")!=="aoEnabled,camera,playerPitch,playerYaw,thirdPerson,tool,waterEnabled"||!c
    ||Object.keys(c).sort().join(",")!=="fov,mode,position,preset,quaternion,target"||!["Orbit","Fly"].includes(c.mode)
    ||!Number.isFinite(c.fov)||c.fov<=0||c.fov>=180
    ||!["C01-EYE","C02-SHORE","C03-ROOTS","C04-WIDE","C05-ROCKARM","C07-QUARRY"].includes(c.preset)
    ||!vector(c.position)||!vector(c.target)||!vector(c.quaternion,true)
    ||!Number.isFinite(v.playerYaw)||Math.abs(v.playerYaw)>1_000_000||!Number.isFinite(v.playerPitch)||Math.abs(v.playerPitch)>1.4
    ||typeof v.thirdPerson!=="boolean"||typeof v.waterEnabled!=="boolean"||typeof v.aoEnabled!=="boolean"||!t||Object.keys(t).sort().join(",")!=="edges,mode,movingSequence,sequence,structureSequence"
    ||!Number.isInteger(t.mode)||t.mode<1||t.mode>3||![t.sequence,t.structureSequence,t.movingSequence,t.edges].every(safeInt)){
    throw new Error("Invalid saved input/view state");
  }
  return v;
};

/** Decode bounded data only. No generator, native World, GPU, URL or file loader. */
export const decodeHvpGame=(value:unknown)=>{
  const p=value as HvpGameCheckpoint|null;
  if(!p||Object.keys(p).filter(k=>k!=="neighbor").sort().join(",")!=="plants,profiles,progress,receipts,signature,terrain,version,view,world"
    ||p.version!=="hvp-game-checkpoint-v1"||createPersistenceSignature(p.profiles)!==createPersistenceSignature(HVP_SAVE_PROFILES)){
    throw new Error("Unsupported Hestia save schema/profile");
  }
  if(!p.terrain||!Array.isArray(p.terrain.leaves)||p.terrain.leaves.length>2048||!Array.isArray(p.plants)||p.plants.length>256
    ||!p.world||p.world.gravity!==resolveHvpGravity()||p.world.terrainGeneration!==p.terrain.revision||p.world.player===null){throw new Error("Hestia save owner/generation mismatch");}
  if(p.neighbor!==undefined&&p.neighbor!==null&&(typeof p.neighbor!=="object"||Array.isArray(p.neighbor))){throw new Error("Invalid saved neighbour");}
  const baseBytes=hvpGridCheckpointBytes(p.terrain.base);
  if(JSON.stringify(p.terrain.base.size)!=="[256,128,256]"||createPersistenceSignature(p.terrain.base.origin)!==createPersistenceSignature({x:-16,y:-8,z:-16})){
    throw new Error("Hestia canonical region mismatch");
  }
  let decodedBytes=baseBytes;
  const admitBytes=(n:number)=>{decodedBytes+=n;if(decodedBytes+3*baseBytes>HVP_SAVE_DECODE_BYTES){throw new Error("Hestia decoded-source budget exceeded before allocation");}};
  for(const leaf of p.terrain.leaves){admitBytes(hvpGridCheckpointBytes(leaf.grid));}
  if(p.neighbor){
    const n=p.neighbor,t=n.terrain;
    if(Object.keys(n).sort().join(",")!=="lod,terrain,version"||n.version!=="hvp-neighbor-scene-v1"||(n.lod!==.125&&n.lod!==.5)
      ||!t||!Array.isArray(t.leaves)||t.leaves.length>2048||JSON.stringify(t.base?.size)!=="[256,128,256]"
      ||createPersistenceSignature(t.base?.origin)!==createPersistenceSignature({x:16,y:-8,z:-16})
      ||!p.world.neighbor||p.world.neighbor.sourceDigest!==t.sourceDigest){throw new Error("Saved neighbour source/World mismatch");}
    admitBytes(hvpGridCheckpointBytes(t.base));for(const leaf of t.leaves){admitBytes(hvpGridCheckpointBytes(leaf.grid));}
  }else if(p.world.neighbor){throw new Error("Missing saved neighbour source");}
  const plantIds=new Set<string>();
  for(const plant of p.plants){admitBytes(hvpPlantCheckpointBytes(plant));
    if(plantIds.has(plant.instance.id)){throw new Error("Duplicate saved plant owner");}plantIds.add(plant.instance.id);}
  admitBytes(hvpWorldCheckpointBytes(p.world));
  const ownershipBytes=p.world.bodies.some(b=>b.family==="terrain")?baseBytes:0;
  // Conservative RLE and defensive-copy working allowance remains unchanged.
  const decodeWorkingBytes=decodedBytes+3*baseBytes+ownershipBytes;
  if(decodeWorkingBytes>HVP_SAVE_DECODE_BYTES){throw new Error("Hestia decoded-source budget exceeded before allocation");}
  const view=validateHvpViewCheckpoint(p.view);
  if(!p.receipts||Object.keys(p.receipts).sort().join(",")!=="moving,structural,terrain"){throw new Error("Missing command history");}
  const receipts={terrain:decodeHvpReceipts(p.receipts.terrain,"terrain",p.terrain.revision),
    structural:decodeHvpReceipts(p.receipts.structural,"structural"),moving:decodeHvpReceipts(p.receipts.moving,"moving")};
  for(const [checkpoint,prefix,count] of [[receipts.terrain,"cut-",view.tool.sequence],
    [receipts.structural,"branch-cut-",view.tool.structureSequence],[receipts.moving,"moving-cut-",view.tool.movingSequence]] as const){
    for(const entry of checkpoint.entries){if(entry.id.startsWith(prefix)){
      const n=Number(entry.id.slice(prefix.length));if(!safeInt(n)||n<1||n>count){throw new Error("Saved command counter would reuse an identity");}
    }}
  }
  // This object comes from bounded repository/import bytes or owned live data;
  // validate all per-field budgets before canonical cloning/serialization.
  const text=serializeCanonicalPersistenceValue(p);
  if(text.length>HVP_SAVE_TRANSPORT_BYTES||new TextEncoder().encode(text).byteLength>HVP_SAVE_TRANSPORT_BYTES){throw new Error("Hestia save transport budget");}
  const {signature,...data}=p;
  if(signature!==createPersistenceSignature(data)){throw new Error("Hestia save signature mismatch");}
  const owned=canonicalizePersistenceValue(p) as unknown as HvpGameCheckpoint;
  const decodedBase=decodeHvpGrid(p.terrain.base);
  const base=restoreHvpCoastSource(decodedBase.copySlots(),p.terrain.baseDigest);
  const savedTerrain=validateHvpTerrainCheckpointHeader(p.terrain);
  const root=createHvpTerrainRoot(base,savedTerrain.sessionId,savedTerrain.epoch,undefined,savedTerrain);
  const plants=p.plants.map(plant=>decodeHvpPlant(plant,root.read()));
  const world=decodeHvpWorld(p.world);
  const neighborRoot=p.neighbor?restoreHvpEastRegion(p.neighbor.terrain):undefined;
  if(p.progress!==null){
    if(p.progress.sessionId!==p.terrain.sessionId){throw new Error("Foreign objective session");}
    validateHvpSalvageCheckpoint(p.progress,savedHvpSalvageObservation(world),createPersistenceSignature(p.world));
  }else if(p.world.branch?.kind==="salvage"){throw new Error("Missing salvage objective state");}
  // A save must not recreate material simultaneously in static terrain and a
  // moving owner, nor copy the same authored cell into two fragment owners.
  const terrainOwners=new Uint8Array(ownershipBytes),branchOwners=new Set<string>();
  const branchCells=new Set((p.world.branch?.kind==="salvage"?HVP_SALVAGE_CELLS:HVP_BRANCH_CELLS).map(c=>`${c.x}:${c.y}:${c.z}`));
  for(const body of world.bodies){
    const family=body.checkpoint.family;
    if(family!=="terrain"&&family!=="branch"){continue;}
    if(body.checkpoint.dynamic&&body.checkpoint.ownerId!==body.recipe.source.objectId){throw new Error("Saved fragment owner/source mismatch");}
    for(const material of body.recipe.source.materials){
      const expected=family==="terrain"?HVP_COAST_MATERIAL_REGISTRY.find(m=>m.slot===material.materialId):undefined;
      if(family==="terrain"?(!expected||material.densityKgPerCubicMeter!==expected.densityKgPerM3||material.structuralClass!==expected.role)
        :(material.materialId!==1||material.densityKgPerCubicMeter!==600||material.structuralClass!=="wood")){
        throw new Error("Saved fragment material profile mismatch");
      }
    }
    let anchored=false;
    for(const c of readHvpBodyCells(body.recipe.source)){
      if(family==="terrain"){
        const index=c.x+c.y*256+c.z*256*128;
        if(c.x<0||c.x>=256||c.y<1||c.y>=128||c.z<0||c.z>=256||base.readSlot(c.x,c.y,c.z)!==c.materialId
          ||root.read().readSlot(c.x,c.y,c.z)!==0||terrainOwners[index]!==0){throw new Error("Saved terrain ownership overlap or missing origin");}
        terrainOwners[index]=1;
      }else{
        const key=`${c.x}:${c.y}:${c.z}`;
        if(!branchCells.has(key)||branchOwners.has(key)||c.materialId!==1){throw new Error("Saved wood ownership overlap or missing origin");}
        branchOwners.add(key);anchored ||= c.x===0&&c.y===0&&c.z===0;
      }
    }
    if(family==="branch"&&body.checkpoint.dynamic===anchored){throw new Error("Saved wood anchor/body-kind mismatch");}
  }
  const result=Object.freeze({checkpoint:owned,base,root,plants:Object.freeze(plants),world,neighborRoot,
    receipts:Object.freeze(receipts),view:owned.view,decodedBytes,decodeWorkingBytes});
  issued.add(result);return result;
};
export type HvpDecodedGame=ReturnType<typeof decodeHvpGame>;
export const assertHvpDecodedGame=(value:HvpDecodedGame):void=>{if(!issued.has(value)){throw new Error("Unvalidated Hestia restore candidate");}};
export const parseHvpGame=(bytes:Uint8Array):HvpDecodedGame=>{
  if(!(bytes instanceof Uint8Array)||bytes.byteLength===0||bytes.byteLength>HVP_SAVE_TRANSPORT_BYTES){throw new Error("Hestia save transport budget before decode");}
  return decodeHvpGame(JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)));
};
export const encodeHvpGame=(data:Omit<HvpGameCheckpoint,"version"|"profiles"|"signature">):HvpGameCheckpoint=>{
  const value={version:"hvp-game-checkpoint-v1" as const,profiles:HVP_SAVE_PROFILES,...data};
  return canonicalizePersistenceValue({...value,signature:createPersistenceSignature(value)}) as unknown as HvpGameCheckpoint;
};
