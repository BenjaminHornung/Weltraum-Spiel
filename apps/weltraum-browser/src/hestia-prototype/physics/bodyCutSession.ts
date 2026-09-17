import {StructuralPhysicsCommitError} from "../../voxel/structural";
import {readHvpBodyCells} from "./bodyCutPlan";
import {captureHvpBodyHit,prepareHvpBodyCut,stageHvpBodyCut,type HvpBodyHit,type HvpCuttableBody} from "./bodyCut";
import type {R} from "./rapierPort";
import type {HvpBodyCutPayload,HvpLocalBodyProduct} from "../../workers/hvpBodyCutJob";

type Vec=Readonly<{x:number;y:number;z:number}>;
export interface HvpMovingCutRequest {readonly id:string;readonly ownerId:string;readonly sourceDigest:string;readonly edge:number;readonly direction:Vec;readonly brush?:"Box"|"Sphere"}
export interface HvpMovingCutPreparation {readonly payload:HvpBodyCutPayload;readonly cells:ReturnType<typeof readHvpBodyCells>;readonly issuedTick:number}
export interface HvpBodyCutAdmission {
  readonly removedCells:number;readonly removedMassKg:number;
  readonly parts:readonly Pick<HvpLocalBodyProduct,"ownerId"|"sourceDigest"|"center"|"massKg">[];
}
export type HvpMovingReceipt=Readonly<{id:string;status:string;parentId:string;children:readonly string[];removedCells:number;removedMassKg:number;
  issuedTick:number;commitTick:number;parentPose:ReturnType<typeof stageHvpBodyCut>["parentPose"];removedMomentum:ReturnType<typeof stageHvpBodyCut>["removedMomentum"]}>;
export interface HvpMovingCheckpoint {readonly sequence:number;readonly last:HvpMovingReceipt|null}

/** Local work runs elsewhere while the parent moves; only stage/commit holds the World. */
export const createHvpBodyCutSession=(world:R.World,targets:Map<string,HvpCuttableBody>,bodies:Map<string,R.RigidBody>,sessionId:string,saved?:HvpMovingCheckpoint,additionalResidentBodies:()=>number=()=>0)=>{
  let preview:HvpBodyHit|null=null,held=false,sequence=saved?.sequence??0;
  let pending:{request:HvpMovingCutRequest;hit:HvpBodyHit;target:HvpCuttableBody;preparation:HvpMovingCutPreparation}|undefined;
  let stage:ReturnType<typeof stageHvpBodyCut>|undefined;
  let children:HvpCuttableBody[]=[],committed=false;
  let last:HvpMovingReceipt|null=saved?.last??null;
  const restoreRegistry=()=>{
    for(const child of children){targets.delete(child.ownerId);bodies.delete(child.ownerId);}
    if(pending){targets.set(pending.target.ownerId,pending.target);bodies.set(pending.target.ownerId,pending.target.body);}
  };
  return {
    get busy(){return pending!==undefined||held;},get holdsWorld(){return stage!==undefined||held;},
    checkpoint():HvpMovingCheckpoint {
      if(pending||held){throw new Error("Moving checkpoint requires confirmed ownership");}
      return Object.freeze({sequence,last});
    },
    preview(eye:Vec|undefined,direction:Vec|undefined,tick:number):void {
      preview=!pending&&!held&&eye&&direction?captureHvpBodyHit(world,targets,eye,direction,tick):null;
    },
    begin(request:HvpMovingCutRequest,eye:Vec,tick:number):HvpMovingCutPreparation {
      if(pending||held||!request||!/^[A-Za-z0-9:._-]{1,128}$/.test(request.id)||!Number.isSafeInteger(request.edge)||request.edge<1||request.edge>8){throw new Error("Body cut Pending or invalid");}
      if(request.brush!==undefined&&request.brush!=="Box"&&request.brush!=="Sphere"){throw new Error("Invalid body brush");}
      const hit=captureHvpBodyHit(world,targets,eye,request.direction,tick),target=targets.get(request.ownerId);
      if(!hit||!target||hit.ownerId!==request.ownerId||hit.sourceDigest!==request.sourceDigest){throw new Error("Stale or missing moving contact within 4 m");}
      const cells=readHvpBodyCells(target.recipe.source);
      const payload:HvpBodyCutPayload=Object.freeze({sessionId,epoch:0,commandId:request.id,ownerId:target.ownerId,sourceId:target.recipe.source.objectId,
        sourceDigest:hit.sourceDigest,revision:hit.revision,cellCount:cells.length,massKg:target.recipe.mass.totalMassKg,cell:hit.cell,edge:request.edge,materials:target.recipe.source.materials,
        ...(request.brush==="Sphere"?{brush:"Sphere" as const}:{})});
      const preparation=Object.freeze({payload,cells,issuedTick:tick});
      pending={request:{id:request.id,ownerId:request.ownerId,sourceDigest:request.sourceDigest,edge:request.edge,
        direction:{x:request.direction.x,y:request.direction.y,z:request.direction.z},...(request.brush==="Sphere"?{brush:"Sphere" as const}:{})},hit,target,preparation};return preparation;
    },
    stage(id:string,products:HvpBodyCutAdmission,tick:number):void {
      if(!pending||pending.request.id!==id||stage||held||targets.get(pending.target.ownerId)!==pending.target){throw new Error("Stale body preparation");}
      const plan=prepareHvpBodyCut(pending.hit,pending.target,id,pending.request.edge,pending.request.brush),expected=plan.local.plan.parts;
      if(products.parts.length!==expected.length||products.removedCells!==plan.local.plan.removedCells||!Number.isFinite(products.removedMassKg)||Math.abs(products.removedMassKg-plan.local.plan.removedMassKg)>1e-8
        ||products.parts.some((p,i)=>{const e=expected[i]!,c=e.recipe.mass.centerOfMassMeters!;
          return p.ownerId!==e.ownerId||p.sourceDigest!==e.recipe.source.contentHash||!Number.isFinite(p.massKg)||Math.abs(p.massKg-e.recipe.mass.totalMassKg)>1e-8
            ||!p.center||![p.center.x,p.center.y,p.center.z].every(Number.isFinite)||Math.hypot(p.center.x-c.x,p.center.y-c.y,p.center.z-c.z)>1e-9;})){throw new Error("Foreign local body products");}
      try{stage=stageHvpBodyCut(world,pending.target,plan,additionalResidentBodies());}catch(error){if(error instanceof StructuralPhysicsCommitError&&!error.worldRestored){held=true;}throw error;}
      children=stage.result.parts.map((p,i)=>({ownerId:p.ownerId,body:p.body,recipe:expected[i]!.recipe,family:pending!.target.family}));committed=false;
      last=Object.freeze({id,status:"PreparedHeld",parentId:pending.target.ownerId,children:Object.freeze(children.map(c=>c.ownerId)),
        removedCells:plan.local.plan.removedCells,removedMassKg:plan.local.plan.removedMassKg,issuedTick:pending.hit.issuedTick,commitTick:tick,
        parentPose:stage.parentPose,removedMomentum:stage.removedMomentum});
    },
    commit(id:string):void {
      if(!stage||!pending||id!==pending.request.id||committed){throw new Error("Stale body commit");}
      stage.commit();targets.delete(pending.target.ownerId);bodies.delete(pending.target.ownerId);
      for(const child of children){targets.set(child.ownerId,child);bodies.set(child.ownerId,child.body);}
      committed=true;sequence+=1;preview=null;last=Object.freeze({...last!,status:"CommittedHeld"});
    },
    rollback(id:string):void {
      if(!pending||id!==pending.request.id){throw new Error("Stale body rollback");}
      try{stage?.rollback();restoreRegistry();if(committed){sequence-=1;}stage=undefined;pending=undefined;committed=false;children=[];if(last){last=Object.freeze({...last,status:"Rejected"});}}
      catch(error){held=true;throw error;}
    },
    finalize(id:string):void {
      if(!stage||!pending||id!==pending.request.id||!committed){throw new Error("Stale body finalization");}
      try{stage.finalize();stage=undefined;pending=undefined;children=[];committed=false;last=Object.freeze({...last!,status:"Applied"});}
      catch(error){
        if(error instanceof StructuralPhysicsCommitError&&error.worldRestored){restoreRegistry();sequence-=1;stage=undefined;pending=undefined;children=[];committed=false;last=Object.freeze({...last!,status:"Rejected"});}
        else{held=true;}throw error;
      }
    },
    read:()=>Object.freeze({sequence,pendingId:pending?.request.id??null,state:held?"RecoveryHold":stage?committed?"CommittedHeld":"PreparedHeld":pending?"Preparing":"Idle",preview,last})
  };
};
