import {applyStructuralDestructionCommand,deriveStructuralComponentClassification,deriveStructuralObjectMassProperties,
  globalQuantumForStructuralCell,objectLocalQuantumForGlobal,structuralAddressForBrickCell,getStructuralVoxel,STRUCTURAL_COMMAND_SCHEMA_VERSION,type StructuralObject} from "../../voxel/structural";
import {selectHvpCutCells,type HvpCutShape} from "../terrain/cutPlan";
import {fnv1aHash} from "../../core/hash";
import {ingestHvpStructuralCells} from "../terrain/structuralIngest";
import {prepareHvpRigidBody} from "./rigidRecipe";

const issued=new WeakSet<object>();
/** Pure local preparation; deliberately independent of native body poses and WASM. */
export const prepareHvpStructuralBreak=(before:StructuralObject,
  bounds:Readonly<{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}>,commandId:string)=>{
  selectHvpCutCells({kind:"Box",min:[bounds.min.x,bounds.min.y,bounds.min.z],max:[bounds.max.x,bounds.max.y,bounds.max.z]});
  const result=subtractBox(before,bounds,commandId);
  return finishPlan(before,result.object,commandId,result.changedVoxelCount);
};
const subtractBox=(before:StructuralObject,bounds:Readonly<{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}>,commandId:string)=>{
  const result=applyStructuralDestructionCommand(before,{
    schemaVersion:STRUCTURAL_COMMAND_SCHEMA_VERSION,commandId,targetObjectId:before.objectId,
    expectedObjectRevision:before.objectRevision,resultingObjectRevision:before.objectRevision+1,
    expectedAdaptiveSource:before.source,sequence:before.objectRevision+1,actor:"hvp.player",source:"hvp.plasma",
    materialFilter:null,kind:"SubtractBox",shape:{kind:"box",space:"object-local-quantum",boundsQuantum:bounds},
    budgets:{maxVisitedBricks:8,maxVisitedCells:32_768,maxSelectedCells:512,maxChangedCells:512,
      maxConnectivityCells:32_768,maxConnectivityFacts:262_144,maxComponents:32,maxMassCells:32_768}
  });
  if(result.status!=="Applied"){throw new Error(`Structural cut ${result.status}${result.status==="Rejected"?`: ${result.code}`:""}`);}
  return result;
};
const finishPlan=(before:StructuralObject,after:StructuralObject,commandId:string,changedVoxelCount:number)=>{
  const classification=deriveStructuralComponentClassification(after,{maxVisitedCells:32_768,maxComponents:32,maxIndexedFacts:262_144});
  const oldMass=deriveStructuralObjectMassProperties(before,{maxVisitedCells:32_768});
  if(oldMass.centerOfMassMeters===null){throw new Error("Empty structural parent");}
  const parts=classification.components.map((component,index)=>{
    const cells=component.occupiedCells.map(address=>{
      const local=objectLocalQuantumForGlobal(globalQuantumForStructuralCell(address),after.frame);
      return Object.freeze({...local,materialId:Number(getStructuralVoxel(after,address)!.materialId)});
    });
    const recipe=prepareHvpRigidBody(ingestHvpStructuralCells(`${before.objectId}:r${before.objectRevision+1}:p${index}`,cells,after.materials));
    return Object.freeze({ownerId:`${before.objectId}:r${before.objectRevision+1}:p${index}`,componentId:component.componentId,
      anchored:component.anchored,cells:Object.freeze(cells),recipe});
  });
  const occupiedBefore=before.bricks.reduce((n,brick)=>n+brick.cells.length,0);
  if(parts.reduce((n,part)=>n+part.cells.length,0)+changedVoxelCount!==occupiedBefore){throw new Error("Structural partition is incomplete");}
  const remainingMass=parts.reduce((n,part)=>n+part.recipe.mass.totalMassKg,0);
  const plan=Object.freeze({before,after,commandId,parts:Object.freeze(parts),preCutCenter:oldMass.centerOfMassMeters,
    removedCells:changedVoxelCount,removedMassKg:oldMass.totalMassKg-remainingMass});
  issued.add(plan);return plan;
};
/** Cell-centred HVP spheres use doubled integers; legacy Structural sphere syntax stays unchanged. */
export const prepareHvpStructuralSphere=(before:StructuralObject,shape:Extract<HvpCutShape,{kind:"Sphere"}>,commandId:string)=>{
  if(before.anchors.length!==0){throw new Error("Sphere recut requires a released source");}
  if(before.bricks.reduce((n,b)=>n+b.cells.length,0)>32_768){throw new Error("Body cell budget");}
  const selected=selectHvpCutCells(shape),keys=new Set(selected.map(c=>c.join(":")));
  const cells=before.bricks.flatMap(brick=>brick.cells.map(cell=>{
    const local=objectLocalQuantumForGlobal(globalQuantumForStructuralCell(structuralAddressForBrickCell(brick,cell.localIndex)),before.frame);
    return {...local,materialId:Number(cell.state.materialId)};
  }));
  const removed=cells.filter(c=>keys.has(`${c.x}:${c.y}:${c.z}`));
  if(!removed.length){throw new Error("Structural cut NoChange");}
  if(removed.some(c=>!before.materials.find(m=>m.materialId===c.materialId)?.destructible)){throw new Error("Protected body material");}
  const remaining=cells.filter(c=>!keys.has(`${c.x}:${c.y}:${c.z}`));
  if(!remaining.length){
    // The validated sphere covers ALL occupied cells. A public subtract removes
    // that same complete set and supplies the legitimate empty source proof.
    const xs=cells.map(c=>c.x),ys=cells.map(c=>c.y),zs=cells.map(c=>c.z);
    const result=subtractBox(before,{min:{x:Math.min(...xs),y:Math.min(...ys),z:Math.min(...zs)},
      max:{x:Math.max(...xs)+1,y:Math.max(...ys)+1,z:Math.max(...zs)+1}},commandId);
    return finishPlan(before,result.object,commandId,result.changedVoxelCount);
  }
  // Re-ingest the actual surviving occupancy, not a fabricated source binding.
  // This temporary source is never published as an edited old body; children
  // receive new ownership IDs and their own validated source proofs.
  const after=ingestHvpStructuralCells(`hvp-sphere-${fnv1aHash(before.contentHash+commandId)}`,remaining,before.materials);
  return finishPlan(before,after,commandId,removed.length);
};
export type HvpStructuralBreakPlan=ReturnType<typeof prepareHvpStructuralBreak>;
export const isIssuedHvpStructuralPlan=(plan:HvpStructuralBreakPlan):boolean=>issued.has(plan);
