import {deriveStructuralObjectMassProperties,globalQuantumForStructuralCell,objectLocalQuantumForGlobal,
  structuralAddressForBrickCell,type StructuralObject} from "../../voxel/structural";
import {fnv1aHash} from "../../core/hash";
import {ingestHvpStructuralCells,type HvpStructuralCell} from "../terrain/structuralIngest";
import type {HvpCell} from "../terrain/picking";
import {prepareHvpStructuralBreak,prepareHvpStructuralSphere} from "./structuralPlan";
import {selectHvpCutCells,type HvpCutShape} from "../terrain/cutPlan";

const cellCache=new WeakMap<StructuralObject,readonly HvpStructuralCell[]>();
export const readHvpBodyCells=(source:StructuralObject):readonly HvpStructuralCell[]=>{
  const cached=cellCache.get(source);if(cached){return cached;}
  if(source.bricks.reduce((n,b)=>n+b.cells.length,0)>32_768){throw new Error("Body cells BudgetExceeded");}
  const cells:HvpStructuralCell[]=[];
  for(const brick of source.bricks){for(const cell of brick.cells){
    const local=objectLocalQuantumForGlobal(globalQuantumForStructuralCell(structuralAddressForBrickCell(brick,cell.localIndex)),source.frame);
    cells.push(Object.freeze({...local,materialId:Number(cell.state.materialId)}));
  }}
  const result=Object.freeze(cells);cellCache.set(source,result);return result;
};

/** Worker-safe local work: no body handle, world pose or render transform. */
export const prepareHvpLocalBodyCut=(source:StructuralObject,cell:HvpCell,commandId:string,edge=4,brush:"Box"|"Sphere"="Box")=>{
  if(!Number.isSafeInteger(edge)||edge<1||edge>8||cell.length!==3||!cell.every(Number.isSafeInteger)){
    throw new Error("Invalid local body cut");
  }
  if(brush!=="Box"&&brush!=="Sphere"){throw new Error("Invalid body brush");}
  const min={x:Math.floor(cell[0]/edge)*edge,y:Math.floor(cell[1]/edge)*edge,z:Math.floor(cell[2]/edge)*edge};
  const max={x:min.x+edge,y:min.y+edge,z:min.z+edge};
  const shape:HvpCutShape=brush==="Sphere"?{kind:"Sphere",center2:[2*cell[0]+1,2*cell[1]+1,2*cell[2]+1],radius2:edge}
    :{kind:"Box",min:[min.x,min.y,min.z],max:[max.x,max.y,max.z]};
  const selected=new Set(selectHvpCutCells(shape).map(c=>c.join(":")));
  const plan=shape.kind==="Sphere"?prepareHvpStructuralSphere(source,shape,commandId):prepareHvpStructuralBreak(source,{min,max},commandId);
  const removed=readHvpBodyCells(source).filter(c=>selected.has(`${c.x}:${c.y}:${c.z}`));
  if(removed.length!==plan.removedCells){throw new Error("Incomplete removed-material receipt");}
  const removedMass=deriveStructuralObjectMassProperties(ingestHvpStructuralCells(`hvp-removed-${fnv1aHash(source.contentHash+commandId)}`,removed,source.materials),{maxVisitedCells:512});
  return Object.freeze({plan,removedMass,bounds:Object.freeze({min:Object.freeze(min),max:Object.freeze(max)})});
};
