import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../../voxel/adaptive";
import {cellsFromCompactSpans} from "../../voxel/structural/componentIndex/fragment";
import {compactRemovedMembershipDigest} from "./compactFragmentIdentity";
import {compactCoastMaterials,issueCompactMovingChild,type HvpCompactNativeOwner} from "./compactNativeOwner";
import {prepareCompactMovingPlan} from "./compactMovingPlan";
import type {HvpBodyHit} from "./bodyCut";
import type {HvpMovingCutRequest,HvpMovingCutPreparation,HvpBodyChildProjection} from "./bodyCutSession";

const issued=new WeakMap<object,HvpCompactNativeOwner>();
export function ownsCompactMovingPlan(plan:object,parent:HvpCompactNativeOwner){return issued.get(plan)===parent;}

export function prepareLiveCompactMovingCut(parent:HvpCompactNativeOwner,request:HvpMovingCutRequest,hit:HvpBodyHit,sessionId:string){
  if(!/^hvp:terrain-fragment:r[1-9][0-9]*:[a-f0-9]{8}$/.test(parent.identity.ownerId)||hit.revision!==0)return;
  const geom=prepareCompactMovingPlan(parent,hit.cell,request.edge,request.brush??"Box");
  if(geom.kind!=="Planned"||geom.children.length>1)return;
  const remaining=geom.children[0],derived=remaining&&issueCompactMovingChild(parent,geom.removed.runs,remaining.runs);
  if(remaining&&!derived)return;
  try{
    const child=derived?.child, owners=child?[child]:[];
    const removedDigest=derived?.removedDigest??compactRemovedMembershipDigest(geom.removed.runs,geom.removed.count);
    const childCells=remaining?Object.freeze(cellsFromCompactSpans(remaining.runs)):[];
    const cells=Object.freeze(cellsFromCompactSpans(parent.materialRuns()));
    const payload=Object.freeze({sessionId,epoch:0,commandId:request.id,ownerId:parent.identity.ownerId,sourceId:parent.identity.ownerId,
      sourceDigest:parent.identity.membershipDigest,revision:hit.revision,cellCount:cells.length,massKg:parent.recipe.mass.totalMassKg,
      cell:hit.cell,edge:request.edge,materials:compactCoastMaterials,...(request.brush==="Sphere"?{brush:"Sphere" as const}:{})});
    const parts=Object.freeze(owners.map(o=>Object.freeze({ownerId:o.identity.ownerId,sourceDigest:o.identity.membershipDigest,
      center:o.recipe.mass.centerOfMassMeters,massKg:o.recipe.mass.totalMassKg,sourceBytes:o.leafCount*ADAPTIVE_BRICK_ESTIMATED_BYTES,cells:childCells})));
    const projection:HvpBodyChildProjection=Object.freeze({...payload,issuedTick:hit.issuedTick,removedCells:geom.removed.count,removedMassKg:geom.removed.mass.totalMassKg,parts});
    const preparation:HvpMovingCutPreparation=Object.freeze({payload,cells,issuedTick:hit.issuedTick,
      compact:Object.freeze({version:"hvp-compact-moving-cut-v1",removedDigest,projection})});
    const nativePlan=Object.freeze({preCutCenter:parent.recipe.mass.centerOfMassMeters,
      parts:Object.freeze(owners.map(o=>({ownerId:o.identity.ownerId,anchored:false,cells:childCells,recipe:o.recipe}))),
      removedMassKg:geom.removed.mass.totalMassKg,after:undefined});
    issued.set(nativePlan,parent);
    return {nativePlan,owners,projection,preparation,removedMass:geom.removed.mass};
  }catch(error){derived?.child.dispose();throw error;}
}
