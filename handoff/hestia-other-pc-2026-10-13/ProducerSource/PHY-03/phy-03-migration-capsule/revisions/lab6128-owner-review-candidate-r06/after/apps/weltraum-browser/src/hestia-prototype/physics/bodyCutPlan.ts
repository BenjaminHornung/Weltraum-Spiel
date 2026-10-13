import {deriveMovingProbeFragmentSteps,isProbeSource,isProbeKernelEnabled,markProbeSource} from "../experiments/cutKernelProbe";
import {deriveStructuralObjectMassProperties,globalQuantumForStructuralCell,objectLocalQuantumForGlobal,
  structuralAddressForBrickCell,type StructuralObject} from "../../voxel/structural";
import {fnv1aHash} from "../../core/hash";
import {ingestHvpStructuralCells,prepareHvpStructuralIngestOwnedSteps,type HvpStructuralCell} from "../terrain/structuralIngest";
import type {HvpCell} from "../terrain/picking";
import {drainHvpPlanSteps,hvpPlanPartBoundaryPhase,measureHvpPlanPhase,prepareHvpStructuralBreakOwnedHashSteps,prepareHvpStructuralBreakSteps,
  prepareHvpStructuralSphereOwnedHashSteps,prepareHvpStructuralSphereSteps,borrowedHvpPlanSteps,type HvpPlanProbe} from "./structuralPlan";
import {selectHvpCutCells,type HvpCutShape} from "../terrain/cutPlan";
import type {HvpRigidRecipe} from "./rigidRecipe";
import {structuralFreezeArraySteps,type StructuralOwnedReserve} from "../../voxel/structural/validation";
import {structuralOwnedObjectMassSteps} from "../../voxel/structural/massProperties";

const cellCache=new WeakMap<StructuralObject,readonly HvpStructuralCell[]>();
function* bodyCellsSteps(source:StructuralObject,reserve?:StructuralOwnedReserve):Generator<string,readonly HvpStructuralCell[],unknown>{
  const cached=cellCache.get(source);if(cached){
    // Credit retained cache residency to this command's parent, even when extraction was earlier.
    reserve?.(64+cached.length*256,true);return cached;
  }
  let count:number;
  if(reserve===undefined){count=source.bricks.reduce((n,b)=>n+b.cells.length,0);}
  else{count=0;for(const brick of source.bricks){count+=brick.cells.length;if(count>32_768){throw new Error("Body cells BudgetExceeded");}yield "ownerCells";}}
  if(count>32_768){throw new Error("Body cells BudgetExceeded");}
  reserve?.(64+count*256,true);
  const cells:HvpStructuralCell[]=[];
  for(const brick of source.bricks){for(const cell of brick.cells){
    const local=objectLocalQuantumForGlobal(globalQuantumForStructuralCell(structuralAddressForBrickCell(brick,cell.localIndex)),source.frame);
    cells.push(Object.freeze({...local,materialId:Number(cell.state.materialId)}));
    if(reserve!==undefined){yield "ownerCells";}
  }if(reserve!==undefined){yield "ownerCells";}}
  const result=reserve===undefined?Object.freeze(cells):yield* borrowedHvpPlanSteps(structuralFreezeArraySteps(cells,reserve),"ownerCells");
  cellCache.set(source,result);return result;
}
export const readHvpBodyCells=(source:StructuralObject):readonly HvpStructuralCell[]=>drainHvpPlanSteps(bodyCellsSteps(source));
/** Same extraction/cache, bounded when the owner borrows its parent's reserve. */
export const readHvpOwnedBodyCellsSteps=(source:StructuralObject,reserve:StructuralOwnedReserve)=>bodyCellsSteps(source,reserve);

/** Worker-safe local work: no body handle, world pose or render transform. */
export function* prepareHvpLocalBodyCutSteps(source:StructuralObject,cell:HvpCell,commandId:string,edge=4,brush:"Box"|"Sphere"="Box",probe?:HvpPlanProbe){
  return yield* localBodyCutSteps(false,source,cell,commandId,edge,brush,probe);
}
/** OWNER-INTERNAL (module export only; first-party Physics-Worker body route): children use the owned-payload hash. */
export function* prepareHvpLocalBodyCutOwnedHashSteps(source:StructuralObject,cell:HvpCell,commandId:string,edge=4,brush:"Box"|"Sphere"="Box",probe?:HvpPlanProbe,parentRecipe?:HvpRigidRecipe,reserve?:StructuralOwnedReserve){
  return yield* localBodyCutSteps(true,source,cell,commandId,edge,brush,probe,parentRecipe,reserve);
}
function* localBodyCutSteps(ownedHash:boolean,source:StructuralObject,cell:HvpCell,commandId:string,edge:number,brush:"Box"|"Sphere",probe?:HvpPlanProbe,parentRecipe?:HvpRigidRecipe,reserve?:StructuralOwnedReserve){
  if(ownedHash&&reserve!==undefined&&isProbeKernelEnabled()&&source.objectId.startsWith("hvp:terrain-fragment:")){markProbeSource(source);}
  if(!Number.isSafeInteger(edge)||edge<1||edge>8||cell.length!==3||!cell.every(Number.isSafeInteger)){
    throw new Error("Invalid local body cut");
  }
  if(brush!=="Box"&&brush!=="Sphere"){throw new Error("Invalid body brush");}
  reserve?.(8_192);
  const min={x:Math.floor(cell[0]/edge)*edge,y:Math.floor(cell[1]/edge)*edge,z:Math.floor(cell[2]/edge)*edge};
  const max={x:min.x+edge,y:min.y+edge,z:min.z+edge};
  const shape:HvpCutShape=brush==="Sphere"?{kind:"Sphere",center2:[2*cell[0]+1,2*cell[1]+1,2*cell[2]+1],radius2:edge}
    :{kind:"Box",min:[min.x,min.y,min.z],max:[max.x,max.y,max.z]};
  reserve?.(65_536);
  const selected=new Set(selectHvpCutCells(shape).map(c=>c.join(":")));
  const plan=shape.kind==="Sphere"
    ?ownedHash
      ?yield* prepareHvpStructuralSphereOwnedHashSteps(source,shape,commandId,probe,parentRecipe,reserve)
      :yield* prepareHvpStructuralSphereSteps(source,shape,commandId,probe)
    :ownedHash
      ?yield* prepareHvpStructuralBreakOwnedHashSteps(source,{min,max},commandId,probe,parentRecipe,reserve)
      :yield* prepareHvpStructuralBreakSteps(source,{min,max},commandId,probe);
  // This step ended with the last child recipe (or the parent mass when no child remains).
  yield hvpPlanPartBoundaryPhase(plan.parts.length);
  let removed:HvpStructuralCell[];
  if(reserve===undefined){removed=measureHvpPlanPhase(probe,"removedFilterMs",()=>readHvpBodyCells(source).filter(c=>selected.has(`${c.x}:${c.y}:${c.z}`)));}
  else{
    const cells=yield* bodyCellsSteps(source,reserve);reserve(64+512*8);removed=[];
    for(const value of cells){if(selected.has(`${value.x}:${value.y}:${value.z}`)){removed.push(value);}yield "ownerCells";}
  }
  if(removed.length!==plan.removedCells){throw new Error("Incomplete removed-material receipt");}
  reserve?.(8_192);
  const removedId=`hvp-removed-${fnv1aHash(source.contentHash+commandId)}`;
  const removedSource=reserve===undefined?ingestHvpStructuralCells(removedId,removed,source.materials,[],probe?.ingest)
    :yield* borrowedHvpPlanSteps(isProbeSource(source)?deriveMovingProbeFragmentSteps(source,removedId,removed,reserve)
      :prepareHvpStructuralIngestOwnedSteps(removedId,removed,source.materials,[],reserve),"ownerIngest");
  const removedMass=reserve===undefined?measureHvpPlanPhase(probe,"removedMassDeriveMs",()=>deriveStructuralObjectMassProperties(removedSource,{maxVisitedCells:512}))
    :yield* borrowedHvpPlanSteps(structuralOwnedObjectMassSteps(removedSource,{maxVisitedCells:512},reserve),"ownerMass");
  reserve?.(2_048,true);
  return Object.freeze({plan,removedMass,bounds:Object.freeze({min:Object.freeze(min),max:Object.freeze(max)})});
}
export const prepareHvpLocalBodyCut=(source:StructuralObject,cell:HvpCell,commandId:string,edge=4,brush:"Box"|"Sphere"="Box")=>
  drainHvpPlanSteps(prepareHvpLocalBodyCutSteps(source,cell,commandId,edge,brush));
