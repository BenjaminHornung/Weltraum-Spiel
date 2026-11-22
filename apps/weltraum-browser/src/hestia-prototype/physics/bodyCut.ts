import {deriveStructuralWorldSplitVelocity,rotateStructuralWorldVector} from "../../voxel/structural";
import {pickHvpCell,type HvpCell,type HvpCellReader} from "../terrain/picking";
import {R,isHvpSolidNonKinematicCollider} from "./rapierPort";
import {assertHvpRigidRecipe,hvpObjectLocalCenterOfMass,type HvpRigidRecipe} from "./rigidRecipe";
import {prepareHvpLocalBodyCutOwnedHashSteps,prepareHvpLocalBodyCutSteps,readHvpBodyCells} from "./bodyCutPlan";
import {stageHvpStructuralBreak} from "./structuralBreak";
import {drainHvpPlanSteps,type HvpPlanProbe} from "./structuralPlan";
import {isIssuedHvpCompactNativeOwner,type HvpCompactNativeOwner} from "./compactNativeOwner";
import {hvpFragmentArchiveDigest} from "./compactFragmentIdentity";
import {ownsHvpCompactBody} from "./rigidBody";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";

type Vec=Readonly<{x:number;y:number;z:number}>;
export interface HvpCuttableBody {readonly ownerId:string;readonly body:R.RigidBody;readonly recipe:HvpRigidRecipe;readonly compactOwner?:HvpCompactNativeOwner;readonly family?:"terrain"|"branch"}
const readers=new WeakMap<HvpRigidRecipe,{reader:HvpCellReader;min:HvpCell}>();
const hits=new WeakMap<object,{source:HvpRigidRecipe|HvpCompactNativeOwner;body:R.RigidBody}>();
const plans=new WeakMap<object,R.RigidBody>();

const readerFor=(recipe:HvpRigidRecipe)=>{
  const old=readers.get(recipe);if(old){return old;}
  assertHvpRigidRecipe(recipe);
  const cells=readHvpBodyCells(recipe.source),min:[number,number,number]=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  const slots=new Map<string,number>();
  for(const c of cells){for(const [a,v] of [c.x,c.y,c.z].entries()){min[a]=Math.min(min[a]!,v);max[a]=Math.max(max[a]!,v+1);}slots.set(`${c.x}:${c.y}:${c.z}`,c.materialId);}
  const result={min,reader:{sizeX:max[0]!-min[0],sizeY:max[1]!-min[1],sizeZ:max[2]!-min[2],cellMeters:.125,
    originMeters:{x:min[0]*.125,y:min[1]*.125,z:min[2]*.125},
    readSlot:(x:number,y:number,z:number)=>slots.get(`${x+min[0]}:${y+min[1]}:${z+min[2]}`)??0}};
  readers.set(recipe,result);return result;
};

const bodyContact=<T extends {body:R.RigidBody}>(world:R.World,targets:ReadonlyMap<string,T>,eye:Vec,direction:Vec,issuedTick:number)=>{
  if(![eye.x,eye.y,eye.z,direction.x,direction.y,direction.z].every(Number.isFinite)
    ||Math.abs(Math.hypot(direction.x,direction.y,direction.z)-1)>1e-6||!Number.isSafeInteger(issuedTick)||issuedTick<0){throw new Error("Invalid body ray");}
  world.propagateModifiedBodyPositionsToColliders();world.updateSceneQueries();
  const contact=world.castRay(new R.Ray(eye,direction),4,true,undefined,undefined,undefined,undefined,
    isHvpSolidNonKinematicCollider);
  const body=contact?.collider.parent();
  if(!body?.isDynamic()||!contact){return null;}
  const target=[...targets.values()].find(t=>t.body===body);if(!target){return null;}
  return {target,distance:contact.timeOfImpact};
};
const pickContact=(body:R.RigidBody,eye:Vec,direction:Vec,distance:number,center:Vec,{reader,min}:{reader:HvpCellReader;min:HvpCell})=>{
  const position={...body.translation()},rotation={...body.rotation()},inverse={x:-rotation.x,y:-rotation.y,z:-rotation.z,w:rotation.w};
  const local=rotateStructuralWorldVector(inverse,{x:eye.x-position.x,y:eye.y-position.y,z:eye.z-position.z});
  const ray=rotateStructuralWorldVector(inverse,direction),enter=Math.min(4,distance+1e-6);
  const picked=pickHvpCell(reader,[local.x+center.x+ray.x*enter,local.y+center.y+ray.y*enter,local.z+center.z+ray.z*enter],
    [ray.x,ray.y,ray.z],4-enter);
  if(picked.kind!=="Hit"){return null;}
  return {cell:Object.freeze(picked.cell.map((v,i)=>v+min[i]!)) as HvpCell,
    pose:Object.freeze({position:Object.freeze(position),rotation:Object.freeze(rotation)})};
};
function pickCompactContact(world:R.World,body:R.RigidBody,owner:HvpCompactNativeOwner,eye:Vec,direction:Vec,distance:number) {
  if(!isIssuedHvpCompactNativeOwner(owner)||!ownsHvpCompactBody(world,body,owner.recipe))throw new Error("Unissued compact body/source binding");
  const {min,max}=owner.bounds;
  return pickContact(body,eye,direction,distance,owner.recipe.mass.centerOfMassMeters,{min,reader:{
    sizeX:max[0]-min[0],sizeY:max[1]-min[1],sizeZ:max[2]-min[2],cellMeters:.125,
    originMeters:{x:min[0]*.125,y:min[1]*.125,z:min[2]*.125},readSlot:(x,y,z)=>owner.readMaterial(x+min[0],y+min[1],z+min[2])}});
}
export const captureHvpBodyHit=(world:R.World,targets:ReadonlyMap<string,HvpCuttableBody>,eye:Vec,direction:Vec,issuedTick:number)=>{
  const contact=bodyContact(world,targets,eye,direction,issuedTick);if(!contact){return null;}
  const {target,distance}=contact;
  const owner=target.compactOwner;
  if(owner) {
    if(target.ownerId!==owner.identity.ownerId)throw new Error("Foreign compact body owner");
    const picked=pickCompactContact(world,target.body,owner,eye,direction,distance);
    if(!picked)return null;
    const hit=Object.freeze({ownerId:target.ownerId,sourceDigest:owner.identity.membershipDigest,revision:0,issuedTick,...picked});
    hits.set(hit,{source:owner,body:target.body});return hit;
  }
  const center=hvpObjectLocalCenterOfMass(target.recipe.source,target.recipe.mass.centerOfMassMeters!);
  const picked=pickContact(target.body,eye,direction,distance,center,readerFor(target.recipe));if(!picked){return null;}
  const hit=Object.freeze({ownerId:target.ownerId,sourceDigest:hvpFragmentArchiveDigest(target.recipe),revision:target.recipe.source.objectRevision,issuedTick,...picked});
  hits.set(hit,{source:target.recipe,body:target.body});return hit;
};

export interface HvpCompactCuttableBody {readonly owner:HvpCompactNativeOwner; readonly body:R.RigidBody}
/** The runtime tag remains separate from a Structural v1 source hash. Only the issuing World may
 * promote this particular hit at the moving-cut archive boundary. Camera or body motion is allowed. */
export function captureHvpCompactBodyHit(world:R.World,targets:ReadonlyMap<string,HvpCompactCuttableBody>,eye:Vec,direction:Vec,issuedTick:number){
  const contact=bodyContact(world,targets,eye,direction,issuedTick);if(!contact){return null;}
  const {body,owner}=contact.target;
  const ownerId=owner.identity.ownerId;
  const picked=pickCompactContact(world,body,owner,eye,direction,contact.distance);
  if(!picked){return null;}
  const materialId=owner.readMaterial(...picked.cell);
  const current=()=>{
    const live=targets.get(ownerId);
    if(live?.owner!==owner||live.body!==body||!ownsHvpCompactBody(world,body,owner.recipe)||owner.readMaterial(...picked.cell)!==materialId){
      throw new Error("Stale compact moving contact");
    }
  };
  current();
  return Object.freeze({identity:owner.identity,issuedTick,materialId,...picked,
    async forStructuralCut(credit:StructuralOwnedReserve,yieldTask:()=>Promise<void>){
      current();const recipe=await owner.materializeV1(credit,yieldTask);current();
      const archive=readerFor(recipe),local=picked.cell.map((value,i)=>value-archive.min[i]!) as [number,number,number];
      if(recipe.source.objectId!==ownerId||archive.reader.readSlot(...local)!==materialId){throw new Error("Compact/archive material mismatch");}
      const hit=Object.freeze({ownerId,sourceDigest:recipe.source.contentHash,revision:recipe.source.objectRevision,issuedTick,...picked});
      hits.set(hit,{source:recipe,body});
      return Object.freeze({hit,target:Object.freeze({ownerId,body,recipe,family:"terrain" as const})});
    }});
}

export type HvpBodyHit=NonNullable<ReturnType<typeof captureHvpBodyHit>>;

/** Owner-local plan steps for one issued hit; the plan is issued only after the last step. */
export function* prepareHvpBodyCutSteps(hit:HvpBodyHit,target:HvpCuttableBody,id:string,edge=4,brush:"Box"|"Sphere"="Box",probe?:HvpPlanProbe){
  return yield* bodyCutSteps(false,hit,target,id,edge,brush,probe);
}
/** OWNER-INTERNAL (module export only; first-party Physics-Worker body session): children use the owned-payload hash. */
export function* prepareHvpBodyCutOwnedHashSteps(hit:HvpBodyHit,target:HvpCuttableBody,id:string,edge=4,brush:"Box"|"Sphere"="Box",probe?:HvpPlanProbe,reserve?:StructuralOwnedReserve){
  return yield* bodyCutSteps(true,hit,target,id,edge,brush,probe,reserve);
}
function* bodyCutSteps(ownedHash:boolean,hit:HvpBodyHit,target:HvpCuttableBody,id:string,edge:number,brush:"Box"|"Sphere",probe?:HvpPlanProbe,reserve?:StructuralOwnedReserve){
  const proof=hits.get(hit);
  if(!proof||proof.body!==target.body||proof.source!==(target.compactOwner??target.recipe)
    ||target.compactOwner&&!target.compactOwner.ownsArchive(target.recipe)||hit.ownerId!==target.ownerId){throw new Error("Stale or unvalidated body hit");}
  reserve?.(4_096);
  const local=ownedHash
    ?yield* prepareHvpLocalBodyCutOwnedHashSteps(target.recipe.source,hit.cell,id,edge,brush,probe,target.recipe,reserve)
    :yield* prepareHvpLocalBodyCutSteps(target.recipe.source,hit.cell,id,edge,brush,probe);
  reserve?.(2_048,true);
  const plan=Object.freeze({hit,local,ownerId:target.ownerId,source:target.recipe});
  plans.set(plan,target.body);
  return plan;
}
export const prepareHvpBodyCut=(hit:HvpBodyHit,target:HvpCuttableBody,id:string,edge=4,brush:"Box"|"Sphere"="Box")=>
  drainHvpPlanSteps(prepareHvpBodyCutSteps(hit,target,id,edge,brush));
export type HvpBodyCutPlan=ReturnType<typeof prepareHvpBodyCut>;

export const stageHvpBodyCut=(world:R.World,target:HvpCuttableBody,plan:HvpBodyCutPlan,additionalResidentBodies=0)=>{
  const originalBody=plans.get(plan);
  if(originalBody===undefined||originalBody!==target.body||plan.ownerId!==target.ownerId
    ||plan.source!==target.recipe||world.getRigidBody(target.body.handle)!==target.body){
    throw new Error("Stale, removed or unvalidated body cut");
  }
  const position=Object.freeze({...target.body.translation()}),rotation=Object.freeze({...target.body.rotation()}),
    velocity=Object.freeze({...target.body.linvel()}),angularVelocity=Object.freeze({...target.body.angvel()});
  const mass=plan.local.removedMass,center=mass.centerOfMassMeters!,before=plan.local.plan.preCutCenter;
  const offset=rotateStructuralWorldVector(rotation,{x:center.x-before.x,y:center.y-before.y,z:center.z-before.z});
  const worldCenter={x:position.x+offset.x,y:position.y+offset.y,z:position.z+offset.z};
  const removedVelocity=deriveStructuralWorldSplitVelocity(velocity,angularVelocity,position,worldCenter);
  const linearMomentum={x:mass.totalMassKg*removedVelocity.x,y:mass.totalMassKg*removedVelocity.y,z:mass.totalMassKg*removedVelocity.z};
  const w=rotateStructuralWorldVector({x:-rotation.x,y:-rotation.y,z:-rotation.z,w:rotation.w},angularVelocity),t=mass.inertiaTensorKgMetersSquared;
  const spin=rotateStructuralWorldVector(rotation,{x:t.xx*w.x+t.xy*w.y+t.xz*w.z,y:t.xy*w.x+t.yy*w.y+t.yz*w.z,z:t.xz*w.x+t.yz*w.y+t.zz*w.z});
  const removedMomentum=Object.freeze({massKg:mass.totalMassKg,referencePoint:position,center:Object.freeze(worldCenter),
    linear:Object.freeze(linearMomentum),angular:Object.freeze({x:spin.x+offset.y*linearMomentum.z-offset.z*linearMomentum.y,
      y:spin.y+offset.z*linearMomentum.x-offset.x*linearMomentum.z,z:spin.z+offset.x*linearMomentum.y-offset.y*linearMomentum.x})});
  const stage=stageHvpStructuralBreak(world,target.body,target.recipe.source,plan.local.plan,additionalResidentBodies);
  return {...stage,parentPose:Object.freeze({position,rotation,velocity,angularVelocity}),removedMomentum};
};
