import { rotateStructuralWorldVector, StructuralPhysicsCommitError,encodeStructuralObject,type StructuralObject } from "../../voxel/structural";
import { ingestHvpStructuralCells } from "../terrain/structuralIngest";
import { pickHvpCell } from "../terrain/picking";
import { HVP_BRANCH_CELLS, HVP_BRANCH_KEY, HVP_BRANCH_SUPPORT,HVP_SALVAGE_CELLS } from "./profile";
import { prepareHvpRigidBody, installHvpRigidBody } from "./rigidBody";
import { prepareHvpStructuralBreak, stageHvpStructuralBreak } from "./structuralBreak";
import { R, isHvpSolidCollider } from "./rapierPort";
import {fnv1aHash} from "../../core/hash";
import {readHvpBodyCells} from "./bodyCutPlan";
import type {HvpCuttableBody} from "./bodyCut";

type Vec=Readonly<{x:number;y:number;z:number}>;
export type HvpBranchRequest=Readonly<{id:string;generation:number;sourceDigest:string;direction:Vec}>;
export type HvpBranchReceipt=Readonly<{id:string;status:string;removedCells:number;removedMassKg:number}>;
export interface HvpBranchCheckpoint {readonly origin:Vec;readonly generation:number;readonly source:string|null;readonly last:HvpBranchReceipt|null;readonly kind?:"branch"|"salvage"}

/** One bounded authored structural owner. The enclosing session owns its clock. */
export const createHvpBranchSession=(world:R.World,origin:Vec,targets=new Map<string,HvpCuttableBody>(),bodies=new Map<string,R.RigidBody>(),
  restored?:{checkpoint:HvpBranchCheckpoint;source:StructuralObject|null;fixed:readonly HvpCuttableBody[]},kind:"branch"|"salvage"="branch",additionalResidentBodies:()=>number=()=>0)=>{
  if(![origin.x,origin.y,origin.z].every(Number.isFinite)) { throw new Error("Invalid branch pose"); }
  kind=restored?.checkpoint.kind??kind;
  if(kind!=="branch"&&kind!=="salvage"){throw new Error("Invalid structural scenario");}
  const authored=kind==="salvage"?HVP_SALVAGE_CELLS:HVP_BRANCH_CELLS,sourceId=kind==="salvage"?"hvp-salvage":"hvp-branch",edge=kind==="salvage"?1:4;
  const materials=[{materialId:1,densityKgPerCubicMeter:600,structuralClass:"wood",destructible:true,tags:null}];
  let source=restored?restored.source:ingestHvpStructuralCells(sourceId,authored,materials,[{x:0,y:0,z:0}]);
  const recipe=restored?restored.fixed.find(p=>p.ownerId===HVP_BRANCH_KEY)?.recipe:
    prepareHvpRigidBody(ingestHvpStructuralCells(`${sourceId}-mechanical`,authored,materials));
  const parent=restored?restored.fixed.find(p=>p.ownerId===HVP_BRANCH_KEY)?.body:
    installHvpRigidBody(world,recipe!,{translationMeters:origin,rotation:{x:0,y:0,z:0,w:1}},undefined,false);
  let generation=restored?.checkpoint.generation??0;
  let parts=(restored?.fixed??[{ownerId:HVP_BRANCH_KEY,body:parent!,recipe:recipe!}]).map(p=>({...p,anchored:true,
    cells:readHvpBodyCells(p.recipe.source),center:p.recipe.mass.centerOfMassMeters!}));
  let attachmentOwner=HVP_BRANCH_KEY;
  let stage:ReturnType<typeof stageHvpStructuralBreak>|undefined;
  let plan:ReturnType<typeof prepareHvpStructuralBreak>|undefined;
  let transactionId="",committed=false,held=false;
  let previousParts=parts;
  let previousSource=source;
  let preview:ReturnType<typeof hitCell>=null;
  let last:HvpBranchReceipt|null=restored?.checkpoint.last??null;
  const receipts=new Map<string,{signature:string;receipt:HvpBranchReceipt}>();
  const parentCells=recipe?readHvpBodyCells(recipe.source):[],occupied=new Set(parentCells.map(c=>`${c.x}:${c.y}:${c.z}`));
  function hitCell(eye:Vec,direction:Vec):Readonly<{cell:readonly[number,number,number];point:Vec}>|null {
    if(generation!==0||!parent||!recipe||stage||held||![eye.x,eye.y,eye.z,direction.x,direction.y,direction.z].every(Number.isFinite)
      ||Math.abs(Math.hypot(direction.x,direction.y,direction.z)-1)>1e-6) { return null; }
    world.propagateModifiedBodyPositionsToColliders();world.updateSceneQueries();
    const hit=world.castRay(new R.Ray(eye,direction),4,true,undefined,undefined,undefined,undefined,
      c=>isHvpSolidCollider(c)&&c.parent()?.isKinematic()!==true);
    if(hit?.collider.parent()?.handle!==parent.handle) { return null; }
    const rotation=parent.rotation(),inverse={x:-rotation.x,y:-rotation.y,z:-rotation.z,w:rotation.w};
    const p=parent.translation(),center=recipe.mass.centerOfMassMeters!;
    const local=rotateStructuralWorldVector(inverse,{x:eye.x-p.x,y:eye.y-p.y,z:eye.z-p.z});
    const ray=rotateStructuralWorldVector(inverse,direction);
    // Rapier establishes the unobscured first contact; DDA establishes the actual
    // canonical cell, just inside the same surface, never a render triangle id.
    const enter=hit.toi+1e-6;
    const cell=pickHvpCell({sizeX:16,sizeY:12,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},
      readSlot:(x,y,z)=>occupied.has(`${x}:${y}:${z}`)?1:0},
      [local.x+center.x+ray.x*enter,local.y+center.y+ray.y*enter,local.z+center.z+ray.z*enter],[ray.x,ray.y,ray.z],Math.max(0,4-enter));
    if(cell.kind!=="Hit") { return null; }
    return Object.freeze({cell:cell.cell,point:Object.freeze({x:eye.x+direction.x*hit.toi,y:eye.y+direction.y*hit.toi,z:eye.z+direction.z*hit.toi})});
  }
  return {
    get busy(){return stage!==undefined||held;},
    checkpoint():HvpBranchCheckpoint {
      if(stage||held){throw new Error("Branch checkpoint requires confirmed ownership");}
      return Object.freeze({origin:Object.freeze({...origin}),generation,source:generation===0?encodeStructuralObject(source!):null,last,kind});
    },
    fixedOwners:()=>parts.map(p=>({ownerId:p.ownerId,body:p.body,recipe:p.recipe,family:"branch" as const})),
    preview(eye:Vec|undefined,direction:Vec|undefined):void {preview=eye&&direction?hitCell(eye,direction):null;},
    prepare(request:HvpBranchRequest,eye:Vec):void {
      if(!/^[A-Za-z0-9:._-]{1,128}$/.test(request.id)) {throw new Error("Invalid branch command");}
      const signature=JSON.stringify(request),prior=receipts.get(request.id);
      if(prior) {throw new Error(prior.signature===signature?"Branch command already applied":"Branch command id conflict");}
      if(stage||held||generation!==0||!source||!parent||request.generation!==generation||request.sourceDigest!==source.contentHash) {throw new Error("Stale or pending branch generation");}
      const hit=hitCell(eye,request.direction);
      if(!hit) {throw new Error("No canonical branch contact within 4 m");}
      const [x,y,z]=hit.cell;
      const min={x:Math.floor(x/edge)*edge,y:Math.floor(y/edge)*edge,z:Math.floor(z/edge)*edge};
      // The anchored foot cannot be removed by this bounded HVP-08 action.
      if(min.x===0&&min.y===0) {throw new Error("Protected structural anchor");}
      plan=prepareHvpStructuralBreak(source,{min,max:{x:min.x+edge,y:min.y+edge,z:min.z+edge}},request.id);
      if(plan.parts.some(p=>targets.has(p.ownerId))){throw new Error("Conflicting branch owner");}
      const support=plan.parts.filter(p=>p.cells.some(c=>c.x===HVP_BRANCH_SUPPORT.x&&c.y===HVP_BRANCH_SUPPORT.y&&c.z===HVP_BRANCH_SUPPORT.z));
      if(kind==="branch"&&support.length!==1) {throw new Error("Cut would remove the attachment support");}
      try {stage=stageHvpStructuralBreak(world,parent,source,plan,additionalResidentBodies());}
      catch(error){if(error instanceof StructuralPhysicsCommitError&&!error.worldRestored){held=true;}throw error;}
      transactionId=request.id;committed=false;
      previousParts=parts;previousSource=source;
      last=Object.freeze({id:request.id,status:"PreparedHeld",removedCells:plan.removedCells,removedMassKg:plan.removedMassKg});
      receipts.set(request.id,{signature,receipt:last});
    },
    commit(id:string):void {
      if(!stage||!plan||id!==transactionId||committed) {throw new Error("Stale branch commit");}
      stage.commit();parts=stage.result.parts.map((p,i)=>({...p,recipe:plan!.parts[i]!.recipe}));source=plan.after;generation+=1;committed=true;
      attachmentOwner=parts.find(p=>p.cells.some(c=>c.x===HVP_BRANCH_SUPPORT.x&&c.y===HVP_BRANCH_SUPPORT.y&&c.z===HVP_BRANCH_SUPPORT.z))?.ownerId??HVP_BRANCH_KEY;
      last=Object.freeze({...last!,status:"CommittedHeld"});
    },
    rollback(id:string):void {
      if(!stage||id!==transactionId) {throw new Error("Stale branch rollback");}
      try {stage.rollback();parts=previousParts;source=previousSource;generation=0;attachmentOwner=HVP_BRANCH_KEY;
        receipts.delete(id);last=Object.freeze({...last!,status:"Rejected"});stage=undefined;committed=false;
      }catch(error){held=true;throw error;}
    },
    finalize(id:string):void {
      if(!stage||!committed||id!==transactionId) {throw new Error("Stale branch finalization");}
      try {
        stage.finalize();
        for(const p of parts){if(!p.anchored){targets.set(p.ownerId,{ownerId:p.ownerId,body:p.body,recipe:p.recipe,family:"branch"});bodies.set(p.ownerId,p.body);}}
        parts=parts.filter(p=>p.anchored);stage=undefined;last=Object.freeze({...last!,status:"Applied"});
      }
      catch(error){
        if(error instanceof StructuralPhysicsCommitError&&error.worldRestored) {parts=previousParts;source=previousSource;generation=0;attachmentOwner=HVP_BRANCH_KEY;stage=undefined;committed=false;receipts.delete(id);}
        else {held=true;}
        throw error;
      }
    },
    read(includeCells=false){
      const released=[...targets.values()].filter(p=>p.family==="branch").map(p=>({...p,anchored:false,cells:readHvpBodyCells(p.recipe.source),center:p.recipe.mass.centerOfMassMeters!}));
      const published=stage?(committed?parts:stage.result.parts.map((p,i)=>({...p,recipe:plan!.parts[i]!.recipe}))):[...parts,...released];
      const support=published.find(p=>p.cells.some(c=>c.x===HVP_BRANCH_SUPPORT.x&&c.y===HVP_BRANCH_SUPPORT.y&&c.z===HVP_BRANCH_SUPPORT.z));
      return Object.freeze({kind,origin:Object.freeze({...origin}),cutEdge:edge,generation,sourceDigest:generation===0?source!.contentHash:fnv1aHash(JSON.stringify(published.map(p=>[p.ownerId,p.recipe.source.contentHash]))),state:held?"RecoveryHold":stage?committed?"CommittedHeld":"PreparedHeld":"Idle",last,preview,
        aimPoint:kind==="salvage"?Object.freeze({x:origin.x+.1875,y:origin.y+.9375,z:origin.z+.0625}):Object.freeze({x:origin.x+.75,y:origin.y+1.25,z:origin.z+.25}),
        attachment:Object.freeze({id:"hvp:branch:foliage",ownerId:kind==="salvage"?null:stage&&!committed?attachmentOwner:support?.ownerId??null,supportCell:HVP_BRANCH_SUPPORT}),
        parts:Object.freeze(published.map(p=>Object.freeze({ownerId:p.ownerId,sourceDigest:p.recipe.source.contentHash,anchored:p.anchored,cellCount:p.cells.length,cells:includeCells?p.cells:undefined,center:p.center,
          position:Object.freeze({...p.body.translation()}),orientation:Object.freeze({...p.body.rotation()}),velocity:Object.freeze({...p.body.linvel()}),massKg:p.body.mass(),sleeping:p.body.isSleeping()})))});
    }
  };
};
