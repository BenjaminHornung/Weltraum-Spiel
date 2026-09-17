import {R} from "./rapierPort";
import type {HvpCuttableBody} from "./bodyCut";
import {encodeHvpBody,decodeHvpBody,assertHvpDecodedBody,type HvpBodyCheckpoint,type HvpDecodedBody} from "../persistence/bodyCheckpoint";
import {restoreHvpBody} from "./restoreBody";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../../voxel/adaptive";
import {serializeCanonicalPersistenceValue} from "../../persistence";

/** Sleeping terrain owners may leave the solver, never their canonical checkpoint. */
export const createHvpBodyResidency=(world:R.World,targets:Map<string,HvpCuttableBody>,bodies:Map<string,R.RigidBody>,safeTick:()=>boolean,restored:readonly HvpDecodedBody[]=[])=>{
  const describe=(ownerId:string,recipe:HvpCuttableBody["recipe"])=>Object.freeze({ownerId,sourceDigest:recipe.source.contentHash,
    centerOfMass:recipe.mass.centerOfMassMeters!,cellCount:recipe.mass.occupiedVoxelCount,massKg:recipe.mass.totalMassKg,
    colliders:recipe.colliders.length,sourceBytes:recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES});
  const parked=new Map<string,{checkpoint:HvpBodyCheckpoint;position:Readonly<{x:number;y:number;z:number}>;source:ReturnType<typeof describe>;bytes:number}>();
  const checkpointBytes=(checkpoint:HvpBodyCheckpoint)=>new TextEncoder().encode(serializeCanonicalPersistenceValue(checkpoint)).byteLength*2;
  const storedBytes=()=>[...parked.values()].reduce((n,p)=>n+p.bytes,0);
  if(restored.length>64){throw new Error("Dormant owner budget");}
  for(const data of restored){assertHvpDecodedBody(data);const c=data.checkpoint;
    if(c.family!=="terrain"||!c.dynamic||!c.sleeping||targets.has(c.ownerId)||bodies.has(c.ownerId)||parked.has(c.ownerId)){throw new Error("Invalid dormant owner restore");}
    const bytes=checkpointBytes(c);if(storedBytes()+bytes>16*1024*1024){throw new Error("Dormant checkpoint byte budget");}
    parked.set(c.ownerId,{checkpoint:c,position:data.motion.translationMeters,source:describe(c.ownerId,data.recipe),bytes});
  }
  let hold=false;
  const admit=()=>{if(hold||!safeTick()){throw new Error(hold?"RecoveryHold: body residency":"Residency requires a safe held tick");}};
  const distance=(a:Readonly<{x:number;y:number;z:number}>,b:Readonly<{x:number;y:number;z:number}>)=>Math.hypot(a.x-b.x,a.z-b.z);
  return {
    get held(){return hold;},
    get count(){return parked.size;},
    get bytes(){return storedBytes();},
    sources:()=>Object.freeze([...parked.values()].map(p=>p.source)),
    read:()=>Object.freeze([...parked].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([ownerId,p])=>Object.freeze({ownerId,position:p.position,residency:"Checkpointed"}))),
    checkpoint:()=>Object.freeze([...parked.values()].map(p=>p.checkpoint)),
    park(ownerId:string,player:Readonly<{x:number;y:number;z:number}>):boolean{
      admit();const target=targets.get(ownerId);
      if(![player.x,player.y,player.z].every(Number.isFinite)){throw new Error("Invalid residency observer");}
      if(!target||target.family!=="terrain"||!target.body.isSleeping()||distance(target.body.translation(),player)<=18){return false;}
      const beforeBodies=world.bodies.len(),beforeColliders=world.colliders.len(),colliders=target.body.numColliders();
      const checkpoint=encodeHvpBody(ownerId,"terrain",target.recipe,target.body),position=Object.freeze({...target.body.translation()});
      // Durable owner data exists before the native removal can have any effect.
      if(parked.size>=64){throw new Error("Dormant owner budget");}
      const bytes=checkpointBytes(checkpoint);if(storedBytes()+bytes>16*1024*1024){throw new Error("Dormant checkpoint byte budget");}
      parked.set(ownerId,{checkpoint,position,source:describe(ownerId,target.recipe),bytes});
      try{
        world.removeRigidBody(target.body);
        if(world.getRigidBody(target.body.handle)!==null||world.bodies.len()!==beforeBodies-1||world.colliders.len()!==beforeColliders-colliders){
          throw new Error("Native dematerialization was not proven");
        }
        targets.delete(ownerId);bodies.delete(ownerId);return true;
      }catch(error){
        if(world.getRigidBody(target.body.handle)===target.body&&world.bodies.len()===beforeBodies&&world.colliders.len()===beforeColliders){parked.delete(ownerId);throw error;}
        if(world.getRigidBody(target.body.handle)!==target.body){targets.delete(ownerId);bodies.delete(ownerId);}
        hold=true;throw new Error(`RecoveryHold: parked material retained after uncertain native removal: ${String(error)}`);
      }
    },
    restore(ownerId:string):boolean{
      admit();const p=parked.get(ownerId);if(!p){return false;}
      if(targets.has(ownerId)||bodies.has(ownerId)){throw new Error("Duplicate resident owner");}
      const decoded=decodeHvpBody(p.checkpoint);let dynamic=0;world.bodies.forEach(b=>{if(b.isDynamic()){dynamic+=1;}});
      if(dynamic>=32||world.colliders.len()+decoded.recipe.colliders.length>4096){throw new Error("Body residency BudgetExceeded");}
      try{
        const body=restoreHvpBody(world,decoded);
        targets.set(ownerId,{ownerId,body,recipe:decoded.recipe,family:"terrain"});bodies.set(ownerId,body);parked.delete(ownerId);return true;
      }catch(error){
        if((error as {worldRestored?:boolean}).worldRestored===false){hold=true;}
        throw error;
      }
    },
    near(player:Readonly<{x:number;y:number;z:number}>):readonly string[]{
      if(![player.x,player.y,player.z].every(Number.isFinite)){throw new Error("Invalid residency observer");}
      return [...parked].filter(([,p])=>distance(p.position,player)<12).map(([id])=>id);
    }
  };
};
