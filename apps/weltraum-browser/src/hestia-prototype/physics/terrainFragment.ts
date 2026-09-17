import {HVP_COAST_MATERIAL_REGISTRY,HVP_SOURCE_MIN_METERS} from "../../hvp/hvpCoastSource";
import {ingestHvpStructuralCells,type HvpStructuralCell} from "../terrain/structuralIngest";
import {prepareHvpRigidBody} from "./rigidRecipe";

export interface HvpTerrainFragmentRequest {
  readonly ownerId:string;readonly cells:readonly HvpStructuralCell[];
  readonly origin:Readonly<{x:number;y:number;z:number}>;readonly massKg:number;
}
const materials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,
  structuralClass:m.role,destructible:true,tags:null}));

/** Rebuild an admitted, exact mechanical recipe in the single World owner. */
export const prepareHvpTerrainFragment=(request:HvpTerrainFragmentRequest,generation:number)=>{
  if(!new RegExp(`^hvp:terrain-fragment:r${generation}:[a-f0-9]{8}$`).test(request.ownerId)
    ||!Array.isArray(request.cells)||request.cells.length===0||request.cells.length>32_768
    ||request.origin.x!==HVP_SOURCE_MIN_METERS.x||request.origin.y!==HVP_SOURCE_MIN_METERS.y||request.origin.z!==HVP_SOURCE_MIN_METERS.z
    ||!Number.isFinite(request.massKg)||request.massKg<=0
    ||request.cells.some(c=>![c.x,c.y,c.z,c.materialId].every(Number.isSafeInteger)
      ||c.x<0||c.x>=256||c.y<1||c.y>=128||c.z<0||c.z>=256||c.materialId<1||c.materialId>4)){
    throw new Error("Invalid terrain fragment admission");
  }
  const recipe=prepareHvpRigidBody(ingestHvpStructuralCells(request.ownerId,request.cells,materials));
  if(Math.abs(recipe.mass.totalMassKg-request.massKg)>Math.max(1,request.massKg)*1e-10){throw new Error("Terrain fragment mass mismatch");}
  return recipe;
};
