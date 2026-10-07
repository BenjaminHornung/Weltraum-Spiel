import {HVP_COAST_MATERIAL_REGISTRY,HVP_SOURCE_MIN_METERS} from "../../hvp/hvpCoastSource";
import {ingestHvpStructuralCells,prepareHvpStructuralIngestOwnedSteps,type HvpStructuralCell} from "../terrain/structuralIngest";
import {admitHvpTransferredRigidBody,admitHvpTransferredRigidBodyOwnedSteps,type HvpTransferredColliderBox} from "./rigidRecipe";
import {borrowedHvpPlanSteps} from "./hvpPlanSteps";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";

export interface HvpTerrainFragmentRequest {
  readonly ownerId:string;readonly cells:readonly HvpStructuralCell[];
  readonly origin:Readonly<{x:number;y:number;z:number}>;readonly massKg:number;
  readonly colliderBoxes:readonly HvpTransferredColliderBox[];
}
const materials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,
  structuralClass:m.role,destructible:true,tags:null}));

/** Admit the transferred support recipe in the single World owner: ingest for the
 * authoritative source, then cheap exact verification (mass, connectivity,
 * coverage) instead of recomputing classification and the greedy transition. */
export const prepareHvpTerrainFragment=(request:HvpTerrainFragmentRequest,generation:number)=>{
  const steps=terrainFragmentSteps(request,generation);for(;;){const step=steps.next();if(step.done){return step.value;}}
};
export const prepareHvpTerrainFragmentOwnedSteps=(request:HvpTerrainFragmentRequest,generation:number,reserve:StructuralOwnedReserve)=>terrainFragmentSteps(request,generation,reserve);
function* terrainFragmentSteps(request:HvpTerrainFragmentRequest,generation:number,reserve?:StructuralOwnedReserve){
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
  const source=reserve===undefined?ingestHvpStructuralCells(request.ownerId,request.cells,materials)
    :yield* borrowedHvpPlanSteps(prepareHvpStructuralIngestOwnedSteps(request.ownerId,request.cells,materials,[],reserve),"terrainNativeIngest");
  const claim={massKg:request.massKg,colliderBoxes:request.colliderBoxes};
  return reserve===undefined?admitHvpTransferredRigidBody(source,claim):yield* admitHvpTransferredRigidBodyOwnedSteps(source,claim,undefined,reserve);
}
