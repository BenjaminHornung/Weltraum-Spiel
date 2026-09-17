import {deriveStructuralWorldSplitVelocity,rotateStructuralWorldVector} from "../../voxel/structural";
import {pickHvpCell,type HvpCell,type HvpCellReader} from "../terrain/picking";
import {R,isHvpSolidCollider} from "./rapierPort";
import {assertHvpRigidRecipe,type HvpRigidRecipe} from "./rigidRecipe";
import {prepareHvpLocalBodyCut,readHvpBodyCells} from "./bodyCutPlan";
import {stageHvpStructuralBreak} from "./structuralBreak";

type Vec=Readonly<{x:number;y:number;z:number}>;
export interface HvpCuttableBody {readonly ownerId:string;readonly body:R.RigidBody;readonly recipe:HvpRigidRecipe;readonly family?:"terrain"|"branch"}
const readers=new WeakMap<HvpRigidRecipe,{reader:HvpCellReader;min:HvpCell}>();
const hits=new WeakMap<object,{target:HvpCuttableBody;source:HvpRigidRecipe}>();
const plans=new WeakSet<object>();

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

export const captureHvpBodyHit=(world:R.World,targets:ReadonlyMap<string,HvpCuttableBody>,eye:Vec,direction:Vec,issuedTick:number)=>{
  if(![eye.x,eye.y,eye.z,direction.x,direction.y,direction.z].every(Number.isFinite)
    ||Math.abs(Math.hypot(direction.x,direction.y,direction.z)-1)>1e-6||!Number.isSafeInteger(issuedTick)||issuedTick<0){throw new Error("Invalid body ray");}
  world.propagateModifiedBodyPositionsToColliders();world.updateSceneQueries();
  const contact=world.castRay(new R.Ray(eye,direction),4,true,undefined,undefined,undefined,undefined,
    c=>isHvpSolidCollider(c)&&c.parent()?.isKinematic()!==true);
  const body=contact?.collider.parent();
  if(!body?.isDynamic()||!contact){return null;}
  const target=[...targets.values()].find(t=>t.body===body);if(!target){return null;}
  const position={...body.translation()},rotation={...body.rotation()},inverse={x:-rotation.x,y:-rotation.y,z:-rotation.z,w:rotation.w};
  const local=rotateStructuralWorldVector(inverse,{x:eye.x-position.x,y:eye.y-position.y,z:eye.z-position.z});
  const ray=rotateStructuralWorldVector(inverse,direction),center=target.recipe.mass.centerOfMassMeters!;
  const {reader,min}=readerFor(target.recipe),enter=Math.min(4,contact.toi+1e-6);
  const picked=pickHvpCell(reader,[local.x+center.x+ray.x*enter,local.y+center.y+ray.y*enter,local.z+center.z+ray.z*enter],
    [ray.x,ray.y,ray.z],4-enter);
  if(picked.kind!=="Hit"){return null;}
  const hit=Object.freeze({ownerId:target.ownerId,sourceDigest:target.recipe.source.contentHash,revision:target.recipe.source.objectRevision,issuedTick,
    cell:Object.freeze(picked.cell.map((v,i)=>v+min[i]!)) as HvpCell,
    pose:Object.freeze({position:Object.freeze(position),rotation:Object.freeze(rotation)})});
  hits.set(hit,{target,source:target.recipe});return hit;
};
export type HvpBodyHit=NonNullable<ReturnType<typeof captureHvpBodyHit>>;

export const prepareHvpBodyCut=(hit:HvpBodyHit,target:HvpCuttableBody,id:string,edge=4,brush:"Box"|"Sphere"="Box")=>{
  const proof=hits.get(hit);
  if(!proof||proof.target.body!==target.body||proof.source!==target.recipe||hit.ownerId!==target.ownerId){throw new Error("Stale or unvalidated body hit");}
  const local=prepareHvpLocalBodyCut(target.recipe.source,hit.cell,id,edge,brush);
  const plan=Object.freeze({hit,local,ownerId:target.ownerId,source:target.recipe});plans.add(plan);return plan;
};
export type HvpBodyCutPlan=ReturnType<typeof prepareHvpBodyCut>;

export const stageHvpBodyCut=(world:R.World,target:HvpCuttableBody,plan:HvpBodyCutPlan,additionalResidentBodies=0)=>{
  if(!plans.has(plan)||plan.ownerId!==target.ownerId||plan.source!==target.recipe||world.getRigidBody(target.body.handle)!==target.body){
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
