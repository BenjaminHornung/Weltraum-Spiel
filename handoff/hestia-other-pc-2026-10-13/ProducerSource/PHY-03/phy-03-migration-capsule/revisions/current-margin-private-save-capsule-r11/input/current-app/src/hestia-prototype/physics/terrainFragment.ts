import {HVP_COAST_MATERIAL_REGISTRY,HVP_SOURCE_MIN_METERS,HVP_ROCK_ARM} from "../../hvp/hvpCoastSource";
import {ingestHvpStructuralCells,prepareHvpStructuralIngestOwnedSteps,type HvpStructuralCell} from "../terrain/structuralIngest";
import {admitHvpTransferredRigidBody,admitHvpTransferredRigidBodyOwnedSteps,type HvpTransferredColliderBox} from "./rigidRecipe";
import {borrowedHvpPlanSteps} from "./hvpPlanSteps";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";
import {decodeStructuralObject} from "../../voxel/structural";
import {readHvpBodyCells} from "./bodyCutPlan";
import {markProbeSource,isProbeMovingSubsetEnabled} from "../experiments/cutKernelProbe";
import {structuralReconstructionSteps,ownedStructuralSubsetSteps,admitOwnedStructuralGraphSteps,type InternalStructuralObjectReconstructionInput} from "../../voxel/structural/model";
import type {StructuralObject} from "../../voxel/structural/types";
import {requirePlainRecord,requireExactKeys} from "../../voxel/adaptive";

export interface HvpTerrainSourceSubset {
  readonly ancestorDigest:string;readonly expectedDigest:string;
  readonly ancestorInput?:InternalStructuralObjectReconstructionInput;
}
/** Conservative logical clone/residency allowance, never a physical IPC byte measurement. */
const cloneQuotes=new WeakMap<object,{bytes:number;copy:HvpTerrainSourceSubset}>();
// ponytail: one authored Rockarm ancestor; other regions require a separately qualified owner.
const maxAncestorCells=((HVP_ROCK_ARM.roofMaxX-HVP_ROCK_ARM.roofMinX)*(HVP_ROCK_ARM.roofTop-HVP_ROCK_ARM.roofBottom)
  +(HVP_ROCK_ARM.pillarMaxX-HVP_ROCK_ARM.roofMinX)*(HVP_ROCK_ARM.roofBottom-HVP_ROCK_ARM.floor))
  *(HVP_ROCK_ARM.roofMaxZ-HVP_ROCK_ARM.roofMinZ)/.125**3;
const terrainSubsetClone=(subset:HvpTerrainSourceSubset):{bytes:number;copy:HvpTerrainSourceSubset}=>{
  const cached=cloneQuotes.get(subset);if(cached!==undefined){return cached;}
  let bytes=512,frozen=true,nodes=0,cells=0,brickCount=0;
  const root:{value?:unknown}={},copies=new Map<object,object>(),containers:object[]=[];
  const pending:Array<{value:unknown;target:object;key:string}>=[{value:subset,target:root,key:"value"}];
  while(pending.length){const {value,target,key}=pending.pop()!;
    let copied:unknown=value;
    if(typeof value==="string"){if(value.length>1024){throw new Error("Terrain clone metadata string budget");}bytes+=64+value.length*4;}
    else if(value===null||typeof value==="boolean"||typeof value==="number"&&Number.isFinite(value)){bytes+=32;}
    else if(value!==null&&typeof value==="object"){
      const previous=copies.get(value);if(previous){Object.defineProperty(target,key,{value:previous,enumerable:true,writable:true,configurable:true});continue;}
      if(++nodes>8192){throw new Error("Terrain clone node budget");}
      frozen&&=Object.isFrozen(value);const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
      if(proto!==(array?Array.prototype:Object.prototype)){throw new Error("Terrain clone plain data required");}
      const keys=Reflect.ownKeys(value);
      if(array){const length=Object.getOwnPropertyDescriptor(value,"length")?.value;
        if(!Number.isSafeInteger(length)||length<0||length>4096||keys.length!==length+1){throw new Error("Terrain clone dense array budget");}
        copied=new Array(length);copies.set(value,copied as object);containers.push(copied as object);
        bytes+=128+length*32;for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));
          if(!d?.enumerable||!("value" in d)){throw new Error("Terrain clone data properties required");}pending.push({value:d.value,target:copied as object,key:String(i)});}
      }else{if(keys.length>16){throw new Error("Terrain clone record budget");}bytes+=512;
        // Only fresh ordinary records reach structuredClone: no copied Native internal slots.
        copied={};copies.set(value,copied as object);containers.push(copied as object);
        for(const field of keys){const d=Object.getOwnPropertyDescriptor(value,field)!;
          if(typeof field!=="string"||field.length>128||!d.enumerable||!("value" in d)){throw new Error("Terrain clone data properties required");}
          bytes+=64+field.length*4;pending.push({value:d.value,target:copied as object,key:field});}
      }
    }else{throw new Error("Terrain clone data required");}
    Object.defineProperty(target,key,{value:copied,enumerable:true,writable:true,configurable:true});
    if(bytes>8*1024*1024){throw new Error("Terrain clone byte budget");}
  }
  for(let i=0;i<containers.length;i++){Object.freeze(containers[i]);}
  const packet=requirePlainRecord(root.value,"terrain/clone");
  requireExactKeys(packet,packet.ancestorInput===undefined?["ancestorDigest","expectedDigest"]:["ancestorDigest","expectedDigest","ancestorInput"],"terrain/clone");
  if(packet.ancestorInput!==undefined){const input=requirePlainRecord(packet.ancestorInput,"terrain/clone/input");
    requireExactKeys(input,["objectId","frame","source","materials","bricks","anchors","joints","objectRevision","editRevision","commandEvidence"],"terrain/clone/input");
    const bricks=input.bricks as readonly {cells:readonly unknown[]}[];
    if(!Array.isArray(bricks)||bricks.length>8){throw new Error("Terrain clone brick budget");}brickCount=bricks.length;
    for(let i=0;i<bricks.length;i++){if(!Array.isArray(bricks[i]!.cells)){throw new Error("Terrain clone cell shape");}cells+=bricks[i]!.cells.length;}
    if(cells>maxAncestorCells){throw new Error("Terrain clone authored ancestor budget");}
  }
  bytes+=65536+brickCount*8192+cells*1024;
  if(bytes>8*1024*1024){throw new Error("Terrain clone byte budget");}
  const result={bytes,copy:root.value as HvpTerrainSourceSubset};cloneQuotes.set(result.copy,result);
  if(frozen){cloneQuotes.set(subset,result);}return result;
};
export const hvpTerrainSubsetCloneBytes=(subset:HvpTerrainSourceSubset|undefined):number=>subset===undefined?0:terrainSubsetClone(subset).bytes;
/** Snapshot only declared data into fresh frozen literals; Native slots/aliases never travel. */
export const copyHvpTerrainSubset=(subset:HvpTerrainSourceSubset):HvpTerrainSourceSubset=>terrainSubsetClone(subset).copy;

/** One session's derivative provenance. Cold clone is fully validated; warm subsets reuse issued states. */
export const createHvpProbeTerrainSourceOwner=()=>{
  let ancestor:StructuralObject|undefined,bytes=0,disposed=false;
  return {residentBytes:()=>bytes,dispose(){disposed=true;ancestor=undefined;bytes=0;},
    *prepareSteps(request:HvpTerrainFragmentRequest,generation:number,reserve:StructuralOwnedReserve){
      if(disposed){throw new Error("Terrain Source owner disposed");}
      const packet=requirePlainRecord(request.sourceSubset,"terrain/subset");
      requireExactKeys(packet,packet.ancestorInput===undefined?["ancestorDigest","expectedDigest"]:["ancestorDigest","expectedDigest","ancestorInput"],"terrain/subset");
      if(request.sourceRegion!==undefined||![packet.ancestorDigest,packet.expectedDigest].every(v=>typeof v==="string"&&/^fnv1a64-v1:[a-f0-9]{16}$/.test(v))){throw new Error("Terrain subset digest/transport");}
      let candidate=ancestor;
      if(!candidate){
        if(packet.ancestorInput===undefined){throw new Error("Missing cold Terrain ancestor input");}
        reserve(hvpTerrainSubsetCloneBytes(request.sourceSubset),true);
        candidate=yield* borrowedHvpPlanSteps(structuralReconstructionSteps(packet.ancestorInput,reserve),"terrainAncestorAdmission");
        if(candidate.objectId!=="hvp-cut-probe-rockarm-seed"||candidate.anchors.length||candidate.joints.length||candidate.objectRevision!==0
          ||candidate.frame.bodyId!=="body.hestia"||candidate.frame.surfaceFrameId!=="frame.hvp"
          ||Object.values(candidate.frame.objectOriginQuantum).some(n=>n!==0)
          ||candidate.materials.length!==materials.length||candidate.materials.some((m,i)=>JSON.stringify(m)!==JSON.stringify(materials[i]))){throw new Error("Terrain ancestor identity/material binding");}
      }
      if(candidate.contentHash!==packet.ancestorDigest){throw new Error("Stale or foreign Terrain ancestor digest");}
      const source=yield* borrowedHvpPlanSteps(ownedStructuralSubsetSteps(candidate,request.ownerId,request.cells,reserve),"terrainOwnedSubset");
      if(source.contentHash!==packet.expectedDigest){throw new Error("Terrain subset canonical digest mismatch");}
      const recipe=yield* terrainFragmentSteps(request,generation,reserve,true,source);
      if(disposed){throw new Error("Terrain Source owner disposed");}
      if(!ancestor){ancestor=candidate;bytes=hvpTerrainSubsetCloneBytes(request.sourceSubset);}
      return recipe;
    }};
};

export interface HvpTerrainFragmentRequest {
  readonly ownerId:string;readonly cells:readonly HvpStructuralCell[];
  readonly origin:Readonly<{x:number;y:number;z:number}>;readonly massKg:number;
  readonly colliderBoxes:readonly HvpTransferredColliderBox[];
  /** Explicit E2 transport only; the ordinary admission ignores this field. */
  readonly sourceRegion?:string;
  readonly sourceSubset?:HvpTerrainSourceSubset;
}
const materials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,
  structuralClass:m.role,destructible:true,tags:null}));

/** Admit the transferred support recipe in the single World owner: ingest for the
 * authoritative source, then cheap exact verification (mass, connectivity,
 * coverage) instead of recomputing classification and the greedy transition. */
export const prepareHvpTerrainFragment=(request:HvpTerrainFragmentRequest,generation:number)=>{
  const steps=terrainFragmentSteps(request,generation);for(;;){const step=steps.next();if(step.done){return step.value;}}
};
export const prepareHvpTerrainFragmentOwnedSteps=(request:HvpTerrainFragmentRequest,generation:number,reserve:StructuralOwnedReserve,
  observe?:(phase:string,start:number,duration:number)=>void,isMeasured?:()=>boolean)=>terrainFragmentSteps(request,generation,reserve,false,undefined,observe,isMeasured);
export const prepareHvpProbeTerrainFragmentOwnedSteps=(request:HvpTerrainFragmentRequest,generation:number,reserve:StructuralOwnedReserve)=>terrainFragmentSteps(request,generation,reserve,true);
function* terrainFragmentSteps(request:HvpTerrainFragmentRequest,generation:number,reserve?:StructuralOwnedReserve,probe=false,ownedSource?:StructuralObject,
  observe?:(phase:string,start:number,duration:number)=>void,isMeasured?:()=>boolean){
  if(isMeasured?.()===false){observe=undefined;}
  let started=observe===undefined?0:performance.now();
  const report=(phase:string)=>{if(isMeasured?.()===false){observe=undefined;}if(observe===undefined){return;}const now=performance.now();
    try{observe(phase,started,now-started);}catch{observe=undefined;}started=now;};
  const invalid=(c:HvpStructuralCell)=>![c.x,c.y,c.z,c.materialId].every(Number.isSafeInteger)
    ||c.x<0||c.x>=256||c.y<1||c.y>=128||c.z<0||c.z>=256||c.materialId<1||c.materialId>4;
  function* invalidOwnedCells(){for(const c of request.cells){if(invalid(c)){return true;}yield "terrainNativeInput";}return false;}
  if(!new RegExp(`^hvp:terrain-fragment:r${generation}:[a-f0-9]{8}$`).test(request.ownerId)
    ||!Array.isArray(request.cells)||request.cells.length===0||request.cells.length>32_768
    ||request.origin.x!==HVP_SOURCE_MIN_METERS.x||request.origin.y!==HVP_SOURCE_MIN_METERS.y||request.origin.z!==HVP_SOURCE_MIN_METERS.z
    ||!Number.isFinite(request.massKg)||request.massKg<=0
    ||!Array.isArray(request.colliderBoxes)||request.colliderBoxes.length<1||request.colliderBoxes.length>64
    ||(reserve===undefined?request.cells.some(invalid):yield* invalidOwnedCells())){
    throw new Error("Invalid terrain fragment admission");
  }
  report("cutNativeCellValidationMs");
  let source:ReturnType<typeof ingestHvpStructuralCells>;
  if(probe){
    if(ownedSource){source=ownedSource;reserve?.(request.cells.length*512,true);}
    else{if(typeof request.sourceRegion!=="string"||request.sourceRegion.length>4*1024*1024){throw new Error("Experimental source transport budget");}
      reserve?.(request.sourceRegion.length*4+request.cells.length*512,true);source=decodeStructuralObject(request.sourceRegion);
      if(reserve&&isProbeMovingSubsetEnabled()){source=yield* borrowedHvpPlanSteps(admitOwnedStructuralGraphSteps(source,reserve),"terrainOwnedGraphAdmission");}}
    if(source.objectId!==request.ownerId||source.anchors.length||source.joints.length
      ||source.frame.bodyId!=="body.hestia"||source.frame.surfaceFrameId!=="frame.hvp"
      ||Object.values(source.frame.objectOriginQuantum).some(n=>n!==0)
      ||source.materials.length!==materials.length||source.materials.some((m,i)=>JSON.stringify(m)!==JSON.stringify(materials[i]))){
      throw new Error("Experimental source identity/material binding");}
    const cells=readHvpBodyCells(source),members=new Map(request.cells.map(c=>[`${c.x}:${c.y}:${c.z}`,c.materialId]));
    if(cells.length!==request.cells.length||members.size!==cells.length){throw new Error("Experimental source occupancy count");}
    for(const c of cells){if(members.get(`${c.x}:${c.y}:${c.z}`)!==c.materialId){throw new Error("Experimental source occupancy/material binding");}yield "terrainNativeSourceBinding";}
    markProbeSource(source);
  }else{source=reserve===undefined?ingestHvpStructuralCells(request.ownerId,request.cells,materials)
    :yield* borrowedHvpPlanSteps(prepareHvpStructuralIngestOwnedSteps(request.ownerId,request.cells,materials,[],reserve),"terrainNativeIngest");}
  report("cutNativeFragmentSourceMs");
  const claim={massKg:request.massKg,colliderBoxes:request.colliderBoxes};
  const recipe=reserve===undefined?admitHvpTransferredRigidBody(source,claim):yield* admitHvpTransferredRigidBodyOwnedSteps(source,claim,undefined,reserve);
  report("cutNativeFragmentAdmissionMs");return recipe;
}
