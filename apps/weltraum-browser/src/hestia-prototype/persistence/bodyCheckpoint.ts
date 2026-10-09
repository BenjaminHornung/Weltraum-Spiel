import {deriveStructuralComponentClassification,encodeStructuralRegionSave,decodeStructuralRegionSave,type StructuralObject} from "../../voxel/structural";
import {prepareHvpRigidBody,prepareHvpRigidBodyOwnedHashSteps,assertHvpRigidRecipe,type HvpRigidRecipe} from "../physics/rigidRecipe";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";
import {admitOwnedStructuralGraphSteps,isOwnedStructuralGraph,isIssuedStructuralObject} from "../../voxel/structural/model";
import type {R} from "../physics/rapierPort";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../../voxel/adaptive";
const decodedBodies=new WeakSet<object>();

export interface HvpBodyCheckpoint {
  readonly version:"hvp-body-checkpoint-v1";
  readonly ownerId:string;readonly family:"drop"|"inertia"|"terrain"|"branch";
  readonly dynamic:boolean;readonly sleeping:boolean;readonly ccd:boolean;
  readonly region:string;
  readonly surfaces:readonly Readonly<{friction:number;restitution:number;frictionCombine:number;restitutionCombine:number}>[];
}
export const encodeHvpBody=(ownerId:string,family:HvpBodyCheckpoint["family"],recipe:HvpRigidRecipe,body:R.RigidBody):HvpBodyCheckpoint=>{
  const classification=deriveStructuralComponentClassification(recipe.source,{maxVisitedCells:32_768,maxComponents:32,maxIndexedFacts:262_144});
  if(classification.fragments.length!==1||body.numColliders()!==recipe.colliders.length||!body.isEnabled()||(!body.isDynamic()&&!body.isFixed())){
    throw new Error("Body checkpoint requires a live complete mechanical owner");
  }
  const motion={fragmentId:classification.fragments[0]!.fragmentId,objectRevision:recipe.source.objectRevision,
    sourceContentHash:recipe.source.contentHash,translationMeters:{...body.translation()},rotation:{...body.rotation()},
    linvelMetersPerSecond:{...body.linvel()},angvelRadPerSecond:{...body.angvel()}};
  const region=encodeStructuralRegionSave({object:recipe.source,parentMotionSource:"explicit",parentMotion:{
    velocityMetersPerSecond:motion.linvelMetersPerSecond,angularVelocityRadPerSecond:motion.angvelRadPerSecond},motions:[motion]});
  const surfaces=recipe.colliders.map((_,i)=>{const c=body.collider(i);
    if(c.isSensor()||!c.isEnabled()){throw new Error("Unsupported disabled/sensor body checkpoint");}
    return Object.freeze({friction:c.friction(),restitution:c.restitution(),frictionCombine:c.frictionCombineRule(),restitutionCombine:c.restitutionCombineRule()});
  });
  return Object.freeze({version:"hvp-body-checkpoint-v1",ownerId,family,dynamic:body.isDynamic(),sleeping:body.isSleeping(),ccd:body.isCcdEnabled(),region,surfaces:Object.freeze(surfaces)});
};
const decodeBody=(value:unknown,prepareRecipe:(source:StructuralObject)=>HvpRigidRecipe)=>{
  const c=value as HvpBodyCheckpoint|null;
  if(!c||c.version!=="hvp-body-checkpoint-v1"||Object.keys(c).sort().join(",")!=="ccd,dynamic,family,ownerId,region,sleeping,surfaces,version"
    ||typeof c.ownerId!=="string"||!/^[A-Za-z0-9:_-]{1,128}$/.test(c.ownerId)||!["drop","inertia","terrain","branch"].includes(c.family)
    ||typeof c.dynamic!=="boolean"||typeof c.sleeping!=="boolean"||typeof c.ccd!=="boolean"
    ||typeof c.region!=="string"||c.region.length>16*1024*1024||!Array.isArray(c.surfaces)||c.surfaces.length<1||c.surfaces.length>64){
    throw new Error("Invalid body checkpoint version/owner/budget");
  }
  for(const s of c.surfaces){
    if(!s||Object.keys(s).sort().join(",")!=="friction,frictionCombine,restitution,restitutionCombine"
      ||!Number.isFinite(Math.fround(s.friction))||s.friction<0||!Number.isFinite(s.restitution)||s.restitution<0||s.restitution>1
      ||![s.frictionCombine,s.restitutionCombine].every(n=>Number.isInteger(n)&&n>=0&&n<=3)){throw new Error("Invalid saved collider material");}
  }
  const region=decodeStructuralRegionSave(c.region);
  if(region.parentMotionSource!=="explicit"||region.motions.length!==1){throw new Error("Complete explicit saved body motion required");}
  const recipe=prepareRecipe(region.object),motion=region.motions[0]!;
  if(recipe.colliders.length!==c.surfaces.length){throw new Error("Saved source/collider membership mismatch");}
  const checkpoint:HvpBodyCheckpoint=Object.freeze({version:c.version,ownerId:c.ownerId,family:c.family,dynamic:c.dynamic,sleeping:c.sleeping,ccd:c.ccd,
    region:c.region,surfaces:Object.freeze(c.surfaces.map(s=>Object.freeze({...s})))});
  const decoded=Object.freeze({checkpoint,recipe,motion});decodedBodies.add(decoded);return decoded;
};
export const decodeHvpBody=(value:unknown)=>decodeBody(value,prepareHvpRigidBody);
/** Private logical preflight over an issued graph; no whole JSON/projection is allocated. */
export const reserveHvpBodyCapture=(recipe:HvpRigidRecipe,reserve:StructuralOwnedReserve):void=>{
  assertHvpRigidRecipe(recipe);
  if(!isIssuedStructuralObject(recipe.source)){throw new Error("Capture preflight requires an issued Source");}
  reserve(recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES*4+5*65_536);
  // Source projection only expands Adaptive keys;2x JSON upper bound plus fixed Region records covers it.
  const quote=(value:unknown):void=>{
    if(value===null){reserve(8*4);return;}
    if(typeof value==="string"){reserve(8*(2+6*value.length));return;}
    if(typeof value==="number"&&Number.isFinite(value)){reserve(8*32);return;}
    if(typeof value==="boolean"){reserve(8*5);return;}
    if(Array.isArray(value)){
      reserve(8*(2+Math.max(0,value.length-1)));
      for(let index=0;index<value.length;index+=1){quote(value[index]);}return;
    }
    if(typeof value==="object"){
      const keys=Object.keys(value);reserve(8*(2+keys.length+Math.max(0,keys.length-1)));
      for(const key of keys){quote(key);quote((value as Record<string,unknown>)[key]);}return;
    }
    throw new Error("Unsupported issued Source capture value");
  };
  quote(recipe.source);
};
/** Private held-tick capture: validate our own complete Save while retaining its exact owned recipe. */
export const captureHvpOwnedBody=(ownerId:string,family:HvpBodyCheckpoint["family"],recipe:HvpRigidRecipe,body:R.RigidBody)=>{
  assertHvpRigidRecipe(recipe);
  if(!isOwnedStructuralGraph(recipe.source)){throw new Error("Live capture requires its prepared owned Source");}
  return decodeBody(encodeHvpBody(ownerId,family,recipe,body),()=>recipe);
};
/** Internal fresh-ColdStart path; strict Region/motion validation remains shared. */
export const decodeHvpColdBody=(value:unknown,reserve:StructuralOwnedReserve)=>decodeBody(value,source=>{
  const steps=(function*(){
    const owned=yield* admitOwnedStructuralGraphSteps(source,reserve);
    return yield* prepareHvpRigidBodyOwnedHashSteps(owned,undefined,undefined,reserve);
  })();
  try{for(;;){const step=steps.next();if(step.done){return step.value;}}}finally{steps.return(undefined as never);}
});
export type HvpDecodedBody=ReturnType<typeof decodeHvpBody>;
export const assertHvpDecodedBody=(value:HvpDecodedBody):void=>{
  if(!decodedBodies.has(value)){throw new Error("Unvalidated saved body");}
};
