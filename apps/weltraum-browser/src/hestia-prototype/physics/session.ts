import { resolveHvpGravity, HVP_INERTIA_CELLS, HVP_INERTIA_KEY, HVP_PLAYER_PROFILE } from "./profile";
export { resolveHvpGravity } from "./profile";
import { R, initializeHvpRapier, isHvpSolidCollider } from "./rapierPort";
import { createHvpTick, HVP_PHYSICS_DT } from "./tick";
import type { HvpCollisionSector } from "./terrainColliders";
import { createHvpLocomotion, type HvpCollisionCoverage, type HvpPlayerInput } from "../player/locomotion";
import { ingestHvpStructuralCells } from "../terrain/structuralIngest";
import { prepareHvpRigidBody, installHvpRigidBody } from "./rigidBody";
import { createHvpBranchSession, type HvpBranchRequest } from "./branchSession";
import {prepareHvpTerrainFragment,type HvpTerrainFragmentRequest} from "./terrainFragment";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../../voxel/adaptive";
import {createHvpBodyCutSession,type HvpMovingCutRequest,type HvpBodyCutAdmission} from "./bodyCutSession";
import type {HvpCuttableBody} from "./bodyCut";
import {decodeHvpWorld,hvpCollisionDigest,type HvpWorldCheckpoint} from "../persistence/worldCheckpoint";
import {encodeHvpBody} from "../persistence/bodyCheckpoint";
import {restoreHvpBody} from "./restoreBody";
import {createHvpNeighborCollision} from "./neighborRegion";
import {createHvpBodyResidency} from "./bodyResidency";
import type {HvpNeighborCheckpoint} from "../runtime/residency";

export type HvpPhysicsSession = Awaited<ReturnType<typeof createHvpPhysicsSession>>;
/** Ephemeral native contact information, never persisted or used as a command authorization. */
export interface HvpImpulseTarget {
  readonly kind:"NotPlaying"|"Busy"|"InvalidAim"|"NoContact"|"Fixed"|"Dynamic"|"Cooldown"|"SpeedLimit";
  readonly target:string|null;readonly distanceMeters:number|null;readonly massKg:number|null;
  readonly point:Readonly<{x:number;y:number;z:number}>|null;
}
const noImpulseTarget:HvpImpulseTarget=Object.freeze({kind:"NotPlaying",target:null,distanceMeters:null,massKg:null,point:null});
export const createHvpPhysicsSession = async (
  sectors: readonly HvpCollisionSector[],
  spawn: Readonly<{ x: number; y: number; z: number }>,
  gravity = resolveHvpGravity(),
  player?: Readonly<{ spawn: { x: number; y: number; z: number }; coverage: readonly HvpCollisionCoverage[] }>,
  inertiaSpawn?:Readonly<{x:number;y:number;z:number}>,
  branchSpawn?:Readonly<{x:number;y:number;z:number}>,
   sessionId="hvp-world",
    checkpoint?:unknown,
    branchKind:"branch"|"salvage"="branch"
) => {
  if (!Number.isFinite(gravity) || gravity <= 0 || ![spawn.x, spawn.y, spawn.z].every(Number.isFinite) || sectors.length > 4094) {
    throw new RangeError("Invalid HVP physics admission");
  }
  const collisionDigest=hvpCollisionDigest(sectors);
  if(checkpoint!==undefined){
    const header=checkpoint as Partial<HvpWorldCheckpoint>|null;
    if(!header||header.gravity!==gravity||header.sessionId!==sessionId){throw new Error("Saved World gravity/session profile mismatch");}
    if(header.collisionDigest!==collisionDigest){throw new Error("Saved collision does not match candidate sources");}
  }
  const restored=checkpoint===undefined?undefined:decodeHvpWorld(checkpoint),saved=restored?.checkpoint;
  const parkedIds=new Set(saved?.parked??[]);
  const baseSectorCount=saved?.neighbor?.baseSectorCount??sectors.length;
  if(sectors.length!==baseSectorCount+(saved?.neighbor?.resident?64:0)){throw new Error("Saved neighbour collision membership mismatch");}
  if(saved){spawn=saved.dropSpawn;player=saved.player===null?undefined:{spawn:saved.player.position,coverage:saved.coverage};}
  await initializeHvpRapier();
  if(inertiaSpawn!==undefined&&![inertiaSpawn.x,inertiaSpawn.y,inertiaSpawn.z].every(Number.isFinite)) { throw new Error("Invalid inertia spawn"); }
  const inertiaRecipe=restored?restored.bodies.find(b=>b.checkpoint.family==="inertia")?.recipe??null:
    inertiaSpawn!==undefined?prepareHvpRigidBody(ingestHvpStructuralCells("hvp-inertia-l",HVP_INERTIA_CELLS,
    [{materialId:1,densityKgPerCubicMeter:600,structuralClass:"wood",destructible:true,tags:null}])):null;
  const bodyColliderCount=restored?restored.bodies.filter(b=>!parkedIds.has(b.checkpoint.ownerId)).reduce((n,b)=>n+b.recipe.colliders.length,0):1+(inertiaRecipe?.colliders.length??0)+(branchSpawn?2:0);
  if(sectors.filter(s=>s.indices.length>0).length+bodyColliderCount+(player===undefined?0:1)>4096) { throw new Error("Physics collider BudgetExceeded"); }
  const world = new R.World({ x: 0, y: -gravity, z: 0 });
  let disposed = false;
  try {
    world.timestep = HVP_PHYSICS_DT;
    const collision = new Map<number, { mesh: HvpCollisionSector; collider?: R.Collider }>();
    for (const [index, sector] of sectors.slice(0,baseSectorCount).entries()) {
      let collider: R.Collider | undefined;
      if (sector.indices.length > 0) {
        collider = world.createCollider(R.ColliderDesc.trimesh(sector.vertices, sector.indices).setFriction(0.8).setRestitution(0));
      }
      collision.set(index, { mesh: sector, collider });
    }
    const bodies = new Map<string, R.RigidBody>();
    const movingBodies=new Map<string,HvpCuttableBody>();
    const restoredFixed:HvpCuttableBody[]=[];
    if(restored){for(const data of restored.bodies){
      if(parkedIds.has(data.checkpoint.ownerId)){continue;}
      const body=restoreHvpBody(world,data),ownerId=data.checkpoint.ownerId;
      if(data.checkpoint.family==="branch"&&!data.checkpoint.dynamic){restoredFixed.push({ownerId,body,recipe:data.recipe,family:"branch"});}
      else{bodies.set(ownerId,body);}
      if(data.checkpoint.family==="terrain"||(data.checkpoint.family==="branch"&&data.checkpoint.dynamic)){
        movingBodies.set(ownerId,{ownerId,body,recipe:data.recipe,family:data.checkpoint.family});
      }
    }}
    const id = "hvp:physics:drop";
    const body = restored?bodies.get(id)!:world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y, spawn.z).setCcdEnabled(true));
    if(!restored){world.createCollider(R.ColliderDesc.cuboid(0.25, 0.25, 0.25).setDensity(2400).setFriction(0.8).setRestitution(0.05), body);}
    bodies.set(id, body);
    const inertiaBody=restored?bodies.get(HVP_INERTIA_KEY)??null:inertiaRecipe===null?null:installHvpRigidBody(world,inertiaRecipe,{
      translationMeters:inertiaSpawn!,rotation:{x:0,y:Math.sin(Math.PI/8),z:0,w:Math.cos(Math.PI/8)}});
    if(inertiaBody) { bodies.set(HVP_INERTIA_KEY,inertiaBody); }
    let residency:ReturnType<typeof createHvpBodyResidency>|undefined;
    const residentExtras=()=>residency?.count??parkedIds.size;
    const branch=restored?(saved!.branch===null?undefined:createHvpBranchSession(world,saved!.branch.origin,movingBodies,bodies,
      {checkpoint:saved!.branch,source:restored.branchSource,fixed:restoredFixed},branchKind,residentExtras)):
      branchSpawn===undefined?undefined:createHvpBranchSession(world,branchSpawn,movingBodies,bodies,undefined,branchKind,residentExtras);
    if(world.colliders.len()>4096) {throw new Error("Physics collider BudgetExceeded");}
    let branchWasRunning=false;
    let impulses=saved?.impulses??0;
    let lastImpulseTick=saved?.lastImpulseTick??-Infinity;
    let lastImpulse:HvpWorldCheckpoint["lastImpulse"]=saved?.lastImpulse??null;
    const primaryCoverage=(player?.coverage??[]).filter(s=>s.maxX<=16);
    let coverage:readonly HvpCollisionCoverage[]=player?.coverage??[];
    const character = player === undefined ? undefined : createHvpLocomotion(world, player.spawn, gravity,
      (x, z) => coverage.some(s => x >= s.minX && x < s.maxX && z >= s.minZ && z < s.maxZ),saved?.player??undefined);
    let stepCpuMs = 0;
    let stepTimings:[number,number][]|undefined;
    const tick = createHvpTick(() => {
      const start = performance.now();
      character?.step();
      const solverStart=stepTimings?performance.now():start;
      world.step();
      const end=performance.now();stepCpuMs = end - start;
      stepTimings?.push([solverStart,end-solverStart]);
    },saved?.tick);
    let terrainGeneration = saved?.terrainGeneration??0;
    type Fragment=HvpCuttableBody;
    const moving=createHvpBodyCutSession(world,movingBodies,bodies,sessionId,saved?.moving,residentExtras);
    let movingWasRunning=false;
    let terrainHeld=false;
    let bodyResidencyWork:{id:string;running:boolean;committed:boolean;changed:boolean;hold:boolean}|undefined;
    let staged: { id: string; expected: number; running: boolean; committed: boolean;
      old: Map<number, { mesh: HvpCollisionSector; collider?: R.Collider }>;
      next: Map<number, { mesh: HvpCollisionSector; collider?: R.Collider }>;
      fragments:Fragment[];bodiesBefore:Map<number,R.RigidBody>;collidersBefore:Map<number,R.Collider> } | undefined;
    const neighbor=baseSectorCount<64?undefined:createHvpNeighborCollision(world,baseSectorCount,
      ()=>!disposed&&!terrainHeld&&!staged&&!branch?.busy&&!moving.busy&&!residency?.held&&!bodyResidencyWork&&tick.read().status==="Paused",
      saved?.neighbor?{checkpoint:saved.neighbor,meshes:sectors.slice(baseSectorCount)}:undefined,collision);
    residency=createHvpBodyResidency(world,movingBodies,bodies,
      ()=>!disposed&&!terrainHeld&&!staged&&!branch?.busy&&!moving.busy&&!neighbor?.busy&&tick.read().status==="Paused",
      restored?.bodies.filter(b=>parkedIds.has(b.checkpoint.ownerId))??[]);
    let neighborWasRunning=false,coverageHeld=false,coverageWasRunning=false;
    const neighborMeshes=()=>neighbor?.meshes()??[];
    const allCollision=()=>[...[...collision.values()].map(c=>c.mesh),...neighborMeshes()];
    const collisionBytes = () => allCollision().reduce((n,s)=>n+s.vertices.byteLength+s.indices.byteLength,0);
    const extraHeld=()=>neighbor?.busy||residency!.held||coverageHeld||bodyResidencyWork!==undefined;
    let impulseTarget:HvpImpulseTarget=noImpulseTarget;
    const queryImpulse=(direction?:Readonly<{x:number;y:number;z:number}>):{
      preview:HvpImpulseTarget;reason:string;body?:R.RigidBody;magnitude?:number
    }=>{
      const blocked=(kind:HvpImpulseTarget["kind"],reason:string)=>({preview:Object.freeze({...noImpulseTarget,kind}),reason});
      const avatar=character?.read();
      if(disposed||tick.read().status!=="Running"||avatar?.status!=="Walking"){return blocked("NotPlaying","Player is not running");}
      if(staged||branch?.busy||moving.busy||extraHeld()){return blocked("Busy","Player is not running");}
      if(!direction||![direction.x,direction.y,direction.z].every(Number.isFinite)||Math.abs(Math.hypot(direction.x,direction.y,direction.z)-1)>1e-6){return blocked("InvalidAim","Invalid aim");}
      if(tick.read().ticks-lastImpulseTick<15){return blocked("Cooldown","Cooldown 250 ms");}
      const origin={x:avatar.position.x,y:avatar.position.y+HVP_PLAYER_PROFILE.eyeHeight-HVP_PLAYER_PROFILE.height/2,z:avatar.position.z};
      world.propagateModifiedBodyPositionsToColliders();world.updateSceneQueries();
      const hit=world.castRayAndGetNormal(new R.Ray(origin,direction),4,true,undefined,undefined,undefined,undefined,
        collider=>isHvpSolidCollider(collider)&&collider.parent()?.isKinematic()!==true);
      if(!hit){return blocked("NoContact","No contact within 4 m");}
      const point=Object.freeze({x:origin.x+direction.x*hit.toi,y:origin.y+direction.y*hit.toi,z:origin.z+direction.z*hit.toi});
      const body=hit.collider.parent();
      if(!body?.isDynamic()){return {preview:Object.freeze({...noImpulseTarget,kind:"Fixed",distanceMeters:hit.toi,point}),reason:"Contact is not dynamic"};}
      const massKg=body.mass(),v=body.linvel(),magnitude=Math.min(15,Math.max(0,20-Math.hypot(v.x,v.y,v.z))*massKg);
      const target=[...bodies].find(([,b])=>b.handle===body.handle)?.[0]??"dynamic";
      return {preview:Object.freeze({kind:magnitude>0?"Dynamic":"SpeedLimit",target,massKg,distanceMeters:hit.toi,point}),
        reason:magnitude>0?"Solver contact impulse":"Speed budget",body,magnitude};
    };
    const residencyMembership=()=>JSON.stringify([world.bodies.len(),world.colliders.len(),[...movingBodies.keys()].sort(),residency!.read().map(p=>p.ownerId)]);
    const requireResidency=(id:string)=>{if(!bodyResidencyWork||bodyResidencyWork.id!==id||bodyResidencyWork.hold){throw new Error("RecoveryHold or stale body residency transaction");}return bodyResidencyWork;};
    const finishResidency=()=>{const running=bodyResidencyWork?.running;bodyResidencyWork=undefined;if(running){tick.resume();}};
    const updateCoverage=()=>{coverage=character&&neighbor?.read().checkpoint?.resident?[...primaryCoverage,{minX:16,maxX:48,minZ:-16,maxZ:16}]:primaryCoverage;};
    const finishNeighbor=()=>{
      updateCoverage();if(neighbor?.read().checkpoint?.resident){coverageHeld=false;}
      if(!neighbor?.busy&&!coverageHeld&&neighborWasRunning){tick.resume();}
    };
    const requireStage = (id: string) => {
      if (staged === undefined || staged.id !== id) { throw new Error("Stale terrain transaction"); }
      return staged;
    };
    const restoreTerrain=(transaction:NonNullable<typeof staged>):void=>{
      for(const [handle,value] of transaction.collidersBefore){
        if(world.getCollider(handle)!==value){throw new Error("RecoveryHold: old terrain membership lost");}
      }
      for(const [index,item] of transaction.old){item.collider?.setEnabled(true);collision.set(index,item);}
      for(const f of transaction.fragments){movingBodies.delete(f.ownerId);bodies.delete(f.ownerId);}
      const newBodies:R.RigidBody[]=[];world.bodies.forEach(b=>{if(!transaction.bodiesBefore.has(b.handle)){newBodies.push(b);}});
      for(const b of newBodies){world.removeRigidBody(b);}
      const newColliders:R.Collider[]=[];world.colliders.forEach(c=>{if(!transaction.collidersBefore.has(c.handle)){newColliders.push(c);}});
      for(const c of newColliders){world.removeCollider(c,true);}
      if(world.bodies.len()!==transaction.bodiesBefore.size||world.colliders.len()!==transaction.collidersBefore.size
        ||[...transaction.bodiesBefore].some(([h,b])=>world.getRigidBody(h)!==b)){throw new Error("RecoveryHold: terrain rollback not proven");}
      terrainGeneration=transaction.expected;world.updateSceneQueries();staged=undefined;
      if(transaction.running){tick.resume();}
    };
    const fragmentView=(f:Fragment)=>Object.freeze({ownerId:f.ownerId,sourceDigest:f.recipe.source.contentHash,
      centerOfMass:f.recipe.mass.centerOfMassMeters!,cellCount:f.recipe.mass.occupiedVoxelCount,
      massKg:f.recipe.mass.totalMassKg,colliders:f.recipe.colliders.length,sourceBytes:f.recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES});
    const read = (includeBranchCells=false) => {const structural=disposed?null:branch?.read(includeBranchCells)??null;
      let activeDynamic=0,residentDynamic=disposed?0:residency!.count;
      if(!disposed){world.bodies.forEach(b=>{if(b.isDynamic()){residentDynamic+=1;if(!b.isSleeping()){activeDynamic+=1;}}});}
      return Object.freeze({ ...tick.read(), status:bodyResidencyWork?.hold?"RecoveryHold" as const:coverageHeld?"CoverageHold" as const:tick.read().status,gravity, gravityProfile: "local-tangent-gravity-v1",activeDynamic,residentDynamic,
      solver: `rapier-${R.version()}`, stepCpuMs, bodyCount: disposed ? 0 : world.bodies.len(),
      colliderCount: disposed ? 0 : world.colliders.len(), nativeBytes: "unsupported", terrainGeneration,
       collisionBytes: disposed ? 0 : collisionBytes(), terrainTransaction: terrainHeld?"RecoveryHold":staged === undefined ? "Idle" : staged.committed ? "CommittedHeld" : "PreparedHeld",
         terrainFragments:disposed?[]:[...[...movingBodies.values()].filter(f=>f.family!=="branch").map(fragmentView),...residency!.sources()],
         parked:disposed?[]:residency!.read(),neighbor:disposed?null:neighbor?.read().checkpoint??null,
         dormantCheckpointBytes:disposed?0:residency!.bytes,
         bodyResidencyId:disposed?null:bodyResidencyWork?.id??null,
         bodyResidencyTransaction:disposed?"Idle":bodyResidencyWork?.hold?"RecoveryHold":bodyResidencyWork?(bodyResidencyWork.committed?"CommittedHeld":"PreparedHeld"):"Idle",
        neighborTransaction:disposed?"Idle":residency!.held?"RecoveryHold":neighbor?.read().state??"Idle",
        neighborPinned:disposed?false:neighbor?.pinned(character?.read().position)??false,
       preparedTerrainFragments:disposed?[]:(staged?.fragments??[]).map(fragmentView),
      player: disposed ? null : character?.read() ?? null,
       structural,
       moving:moving.read(),
        lastImpulse,impulseTarget:disposed?noImpulseTarget:impulseTarget,lastImpulseTick:Number.isFinite(lastImpulseTick)?lastImpulseTick:null,
      inertia: disposed||inertiaRecipe===null||inertiaBody===null?null:Object.freeze({ownerId:HVP_INERTIA_KEY,
        sourceDigest:inertiaRecipe.source.contentHash,centerOfMass:inertiaRecipe.mass.centerOfMassMeters!,
        tensor:inertiaRecipe.mass.inertiaTensorKgMetersSquared,principal:inertiaRecipe.axes,
        colliders:inertiaRecipe.colliders.length,impulses,aimPoint:Object.freeze({...inertiaBody.collider(0).translation()}),
        angularVelocity:Object.freeze({...inertiaBody.angvel()})}),
      bodies: disposed ? [] : [...[...bodies].map(([ownerId, value]) => Object.freeze({ ownerId,
        position: Object.freeze({ ...value.translation() }), orientation: Object.freeze({ ...value.rotation() }),
        velocity: Object.freeze({ ...value.linvel() }), sleeping: value.isSleeping(), massKg: value.mass() })),
        ...(structural?.parts??[]).filter(p=>!bodies.has(p.ownerId)).map(p=>({ownerId:p.ownerId,position:p.position,orientation:p.orientation,velocity:p.velocity,sleeping:p.sleeping,massKg:p.massKg}))] });};
    const playerEye=()=>{const avatar=character?.read();if(avatar?.status!=="Walking"){throw new Error("Player is not walking");}
      return {x:avatar.position.x,y:avatar.position.y+HVP_PLAYER_PROFILE.eyeHeight-HVP_PLAYER_PROFILE.height/2,z:avatar.position.z};};
    return {
      read,
      checkpoint():HvpWorldCheckpoint {
        if(disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()||tick.read().status!=="Paused"){
          throw new Error("World checkpoint requires a confirmed paused generation");
        }
        const dropRecipe=restored?.bodies.find(b=>b.checkpoint.family==="drop")?.recipe??prepareHvpRigidBody(ingestHvpStructuralCells("hvp-drop",
          Array.from({length:64},(_,i)=>({x:i%4,y:Math.floor(i/4)%4,z:Math.floor(i/16),materialId:1})),
          [{materialId:1,densityKgPerCubicMeter:2400,structuralClass:"limestone",destructible:true,tags:null}]));
        const result=[encodeHvpBody(id,"drop",dropRecipe,body)];
        if(inertiaRecipe&&inertiaBody){result.push(encodeHvpBody(HVP_INERTIA_KEY,"inertia",inertiaRecipe,inertiaBody));}
        for(const b of movingBodies.values()){result.push(encodeHvpBody(b.ownerId,b.family??"terrain",b.recipe,b.body));}
        for(const b of branch?.fixedOwners()??[]){result.push(encodeHvpBody(b.ownerId,"branch",b.recipe,b.body));}
        result.push(...residency!.checkpoint());
        return Object.freeze({version:"hvp-world-checkpoint-v1",solver:"rapier-0.12.0",sessionId,gravity,terrainGeneration,
          tick:tick.read(),collisionDigest:hvpCollisionDigest(allCollision()),dropSpawn:Object.freeze({...spawn}),
          player:character?.checkpoint()??null,coverage:Object.freeze(coverage.map(c=>Object.freeze({...c}))),
          bodies:Object.freeze(result),branch:branch?.checkpoint()??null,moving:moving.checkpoint(),impulses,
          neighbor:neighbor?.read().checkpoint??null,parked:Object.freeze(residency!.read().map(p=>p.ownerId)),
          lastImpulseTick:Number.isFinite(lastImpulseTick)?lastImpulseTick:null,lastImpulse});
      },
      copyCollision():readonly HvpCollisionSector[]{
        if(disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()||tick.read().status!=="Paused"){throw new Error("Collision checkpoint requires an idle paused World");}
        return allCollision().map(mesh=>({vertices:new Float32Array(mesh.vertices),indices:new Uint32Array(mesh.indices)}));
      },
      prepareNeighbor(id:string,next:HvpNeighborCheckpoint,meshes:readonly HvpCollisionSector[],edge:readonly {index:number;mesh:HvpCollisionSector}[]):void{
        if(!neighbor||disposed||terrainHeld||staged||branch?.busy||moving.busy||neighbor.busy||residency!.held||bodyResidencyWork){throw new Error("Neighbour World transaction unavailable");}
        let bytes=[...collision.values()].reduce((n,c)=>n+c.mesh.vertices.byteLength+c.mesh.indices.byteLength,0);
        for(const e of edge){const previous=collision.get(e.index);if(!previous){throw new Error("Missing primary seam");}
          bytes+=e.mesh.vertices.byteLength+e.mesh.indices.byteLength-previous.mesh.vertices.byteLength-previous.mesh.indices.byteLength;}
        bytes+=meshes.reduce((n,m)=>n+m.vertices.byteLength+m.indices.byteLength,0);
        if(bytes>8*1024*1024){throw new Error("Global collision payload BudgetExceeded");}
        neighborWasRunning=coverageHeld?coverageWasRunning:tick.read().status==="Running";tick.pause();
        try{neighbor.prepare(id,next,meshes,character?.read().position,edge);}catch(error){if(!neighbor.busy&&!coverageHeld&&neighborWasRunning){tick.resume();}throw error;}
      },
      commitNeighbor(id:string):void{if(!neighbor){throw new Error("No neighbour");}neighbor.commit(id);updateCoverage();},
      rollbackNeighbor(id:string):void{if(!neighbor){throw new Error("No neighbour");}neighbor.rollback(id);finishNeighbor();},
      finalizeNeighbor(id:string):void{if(!neighbor){throw new Error("No neighbour");}try{neighbor.finalize(id);}finally{finishNeighbor();}},
      prepareBodyResidency(id:string):void{
        if(!/^[A-Za-z0-9:_-]{1,128}$/.test(id)||disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()
          ||!["Running","Paused"].includes(tick.read().status)){throw new Error("Body residency requires a safe generation");}
        const position=character?.read().position;if(!position){throw new Error("Body residency requires a player");}
        const before=residencyMembership(),running=tick.read().status==="Running";tick.pause();
        const transaction={id,running,committed:false,changed:false,hold:false};bodyResidencyWork=transaction;
        try{
          // All actions use the actual paused observer and native sleeping state.
          for(const owner of residency!.near(position)){residency!.restore(owner);}
          for(const target of [...movingBodies.values()]){
            const p=target.body.translation();
            if(target.family==="terrain"&&target.body.isSleeping()&&Math.hypot(p.x-position.x,p.z-position.z)>18){residency!.park(target.ownerId,position);}
          }
          transaction.changed=residencyMembership()!==before;
        }catch(error){
          transaction.changed=residencyMembership()!==before;
          if(residency!.held||transaction.changed){transaction.hold=true;throw new Error(`RecoveryHold: residency source retained: ${String(error)}`);}
          finishResidency();throw error;
        }
      },
      commitBodyResidency(id:string):void{requireResidency(id).committed=true;},
      finalizeBodyResidency(id:string):void{if(!requireResidency(id).committed){throw new Error("Unpublished body residency");}finishResidency();},
      rollbackBodyResidency(id:string):void{
        const transaction=requireResidency(id);
        if(transaction.changed){transaction.hold=true;throw new Error("RecoveryHold: changed residency cannot claim original native identity");}
        finishResidency();
      },
      parkDistantBodies():void{
        if(disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()){throw new Error("Body residency requires a safe generation");}
        const position=character?.read().position;if(!position){throw new Error("Body residency requires a player");}
        const running=tick.read().status==="Running";tick.pause();
        try{
          for(const owner of residency!.near(position)){residency!.restore(owner);}
          for(const target of [...movingBodies.values()]){
            const p=target.body.translation();
            if(target.family!=="branch"&&target.body.isSleeping()&&Math.hypot(p.x-position.x,p.z-position.z)>18){residency!.park(target.ownerId,position);}
          }
        }finally{if(!residency!.held&&running){tick.resume();}}
      },
      restoreNearBodies():void{
        if(disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()){throw new Error("Body residency requires a safe generation");}
        const position=character?.read().position;if(!position){throw new Error("Body residency requires a player");}
        const running=tick.read().status==="Running";tick.pause();
        try{for(const owner of residency!.near(position)){residency!.restore(owner);}}
        finally{if(!residency!.held&&running){tick.resume();}}
      },
        advance(seconds: number,measure=false):readonly (readonly[number,number])[]|undefined {
         if(neighbor&&!neighbor.read().checkpoint?.resident&&tick.read().status==="Running"&&!staged&&!branch?.busy&&!moving.busy&&neighbor.pinned()){
           coverageHeld=true;coverageWasRunning=true;tick.pause();
         }
         stepTimings=measure?[]:undefined;
         try{if(!terrainHeld&&staged === undefined&&!branch?.busy&&!moving.holdsWorld&&!extraHeld()) { tick.advance(seconds); }return stepTimings;}
         finally{stepTimings=undefined;}
       },
      pause(): void { impulseTarget=noImpulseTarget;if(staged) { staged.running=false; }if(bodyResidencyWork){bodyResidencyWork.running=false;} branchWasRunning=false;movingWasRunning=false;neighborWasRunning=false;coverageWasRunning=false;character?.setEnabled(false); tick.pause(); },
       resume(): void { if(terrainHeld||moving.holdsWorld||extraHeld()){throw new Error("RecoveryHold, coverage or body transaction");}tick.resume(); },
       play(): void {
         if(terrainHeld||moving.holdsWorld||extraHeld()){throw new Error("RecoveryHold, coverage or body transaction");}
        if (character === undefined) { throw new Error("Player collision is unavailable"); }
        character.setEnabled(true); tick.resume();
      },
      inspect(): void { character?.setEnabled(false);impulseTarget=noImpulseTarget; },
      input(value: HvpPlayerInput): void { character?.setInput(value); },
      camera(offset?: Readonly<{ x: number; y: number; z: number }>): void { character?.setCameraOffset(offset); },
      aimBranch(direction?:Readonly<{x:number;y:number;z:number}>):void {
        impulseTarget=queryImpulse(direction).preview;
        if(branch&&!branch.busy) {branch.preview(character?.read().status==="Walking"&&tick.read().status==="Running"?playerEye():undefined,direction);}
        moving.preview(character?.read().status==="Walking"&&tick.read().status==="Running"?playerEye():undefined,direction,tick.read().ticks);
      },
      beginBodyCut(request:HvpMovingCutRequest){
        if(disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()||tick.read().status!=="Running"){throw new Error("Moving cut unavailable");}
        return moving.begin(request,playerEye(),tick.read().ticks);
      },
      stageBodyCut(id:string,products:HvpBodyCutAdmission):void {
        if(terrainHeld||staged||branch?.busy||extraHeld()){throw new Error("World transaction pending");}
        movingWasRunning=tick.read().status==="Running";tick.pause();
        try{moving.stage(id,products,tick.read().ticks);}catch(error){if(!moving.holdsWorld&&movingWasRunning){tick.resume();}throw error;}
      },
      commitBodyCut(id:string):void {moving.commit(id);},
      rollbackBodyCut(id:string):void {moving.rollback(id);if(movingWasRunning){tick.resume();}},
      finalizeBodyCut(id:string):void {try{moving.finalize(id);}finally{if(!moving.holdsWorld&&movingWasRunning){tick.resume();}}},
      prepareBranch(request:HvpBranchRequest):void {
        if(!branch||staged||branch.busy||moving.busy||extraHeld()||tick.read().status!=="Running") {throw new Error("Branch not available");}
        const eye=playerEye();branchWasRunning=true;tick.pause();
        try {branch.prepare(request,eye);}catch(error){if(!branch.busy&&branchWasRunning){tick.resume();}throw error;}
      },
      commitBranch(id:string):void {if(!branch){throw new Error("No branch");}branch.commit(id);},
      rollbackBranch(id:string):void {if(!branch){throw new Error("No branch");}branch.rollback(id);if(branchWasRunning){tick.resume();}},
      finalizeBranch(id:string):void {
        if(!branch){throw new Error("No branch");}
        try {branch.finalize(id);}finally{if(!branch.busy&&branchWasRunning){tick.resume();}}
      },
      impulse(direction:Readonly<{x:number;y:number;z:number}>): void {
        const reject=(reason:string):void=>{lastImpulse=Object.freeze({status:"Rejected",reason});};
        // Re-query at the command's native tick; an earlier green HUD target is not authority.
        const contact=queryImpulse(direction);impulseTarget=contact.preview;
        if(contact.preview.kind!=="Dynamic"||!contact.body||!contact.preview.point){reject(contact.reason);return;}
        const target=contact.body,magnitude=contact.magnitude!,point=contact.preview.point;
        const impulse={x:direction.x*magnitude,y:direction.y*magnitude,z:direction.z*magnitude};
        target.applyImpulseAtPoint(impulse,point,true);lastImpulseTick=tick.read().ticks;
        if(target.handle===inertiaBody?.handle) { impulses+=1; }
        lastImpulse=Object.freeze({status:"Applied",reason:"Solver contact impulse",point:Object.freeze(point),impulse:Object.freeze(impulse),
          target:contact.preview.target!});
      },
       prepareTerrain(id: string, expected: number, replacements: readonly { index: number; mesh: HvpCollisionSector }[],fragments:readonly HvpTerrainFragmentRequest[]=[]): void {
         if (disposed || terrainHeld || staged !== undefined || branch?.busy || moving.busy || extraHeld() || terrainGeneration !== expected || !/^[A-Za-z0-9:._-]{1,128}$/.test(id)
           || replacements.length === 0 || replacements.length > 16||fragments.length>32
           ||new Set(fragments.map(f=>f.ownerId)).size!==fragments.length||fragments.some(f=>movingBodies.has(f.ownerId)||residency!.read().some(p=>p.ownerId===f.ownerId))
           ||fragments.reduce((n,f)=>n+f.cells.length,0)>32_768) { throw new Error("Stale or invalid terrain transaction"); }
        const old = new Map<number, { mesh: HvpCollisionSector; collider?: R.Collider }>();
        let bytes = collisionBytes();
        for (const { index, mesh } of replacements) {
          const previous = collision.get(index);
          if (!Number.isSafeInteger(index) || index < 0 || index >= 64 || previous === undefined || old.has(index)
            || !(mesh.vertices instanceof Float32Array) || !(mesh.indices instanceof Uint32Array)
            || mesh.vertices.length % 3 !== 0 || mesh.indices.length % 3 !== 0
            || mesh.vertices.some(v=>!Number.isFinite(v)) || mesh.indices.some(v=>v>=mesh.vertices.length/3)) {
            throw new Error("Invalid terrain collision replacement");
          }
          old.set(index, previous);
          bytes += mesh.vertices.byteLength + mesh.indices.byteLength - previous.mesh.vertices.byteLength - previous.mesh.indices.byteLength;
        }
        if (bytes > 8*1024*1024) { throw new Error("Terrain collision BudgetExceeded"); }
         const next = new Map<number, { mesh: HvpCollisionSector; collider?: R.Collider }>();
         const running = tick.read().status === "Running";
         tick.pause();
         const bodiesBefore=new Map<number,R.RigidBody>(),collidersBefore=new Map<number,R.Collider>();
         world.bodies.forEach(b=>bodiesBefore.set(b.handle,b));world.colliders.forEach(c=>collidersBefore.set(c.handle,c));
         const transaction={id,expected,running,committed:false,old,next,fragments:[] as Fragment[],bodiesBefore,collidersBefore};
         staged=transaction;
         try {
           const recipes=fragments.map(f=>prepareHvpTerrainFragment(f,expected+1));
            if(world.bodies.len()+residency!.count+fragments.length>64||[...bodiesBefore.values()].filter(b=>b.isDynamic()).length+fragments.length>32
             ||world.colliders.len()+replacements.length+recipes.reduce((n,r)=>n+r.colliders.length,0)>4096){throw new Error("Terrain fragment BudgetExceeded");}
          for (const { index, mesh } of [...replacements].sort((a,b)=>a.index-b.index)) {
            const collider = mesh.indices.length === 0 ? undefined : world.createCollider(
              R.ColliderDesc.trimesh(mesh.vertices,mesh.indices).setEnabled(false).setFriction(.8).setRestitution(0));
            next.set(index,{mesh,collider});
          }
           for(const [index,request] of fragments.entries()){
             const recipe=recipes[index]!,body=installHvpRigidBody(world,recipe,{translationMeters:request.origin,rotation:{x:0,y:0,z:0,w:1}});
             body.setEnabled(false);transaction.fragments.push({ownerId:request.ownerId,body,recipe,family:"terrain"});
           }
         } catch(error) {
           try{restoreTerrain(transaction);}catch(rollbackError){terrainHeld=true;throw new Error(`RecoveryHold: ${String(error)}; ${String(rollbackError)}`);}
           throw error;
        }
      },
      commitTerrain(id: string): void {
        const transaction = requireStage(id);
        if(transaction.committed || transaction.expected !== terrainGeneration) { throw new Error("Stale terrain generation"); }
         for(const [index,item] of transaction.next) {
          transaction.old.get(index)!.collider?.setEnabled(false);
          item.collider?.setEnabled(true); collision.set(index,item);
         }
         for(const f of transaction.fragments){f.body.setEnabled(true);movingBodies.set(f.ownerId,f);bodies.set(f.ownerId,f.body);}
        world.updateSceneQueries();
        terrainGeneration += 1; transaction.committed = true;
      },
       rollbackTerrain(id: string): void {
         const transaction = requireStage(id);
         try{restoreTerrain(transaction);}catch(error){terrainHeld=true;throw error;}
      },
      finalizeTerrain(id: string): void {
        const transaction = requireStage(id);
        if(!transaction.committed) { throw new Error("Terrain transaction is not committed"); }
         try{for(const item of transaction.old.values()) { if(item.collider) { world.removeCollider(item.collider,true); } }}
         catch(error){terrainHeld=true;throw error;}
        staged = undefined;
        if(transaction.running) { tick.resume(); }
      },
       drop(): void {
         if (disposed||terrainHeld||moving.busy||extraHeld()) { throw new Error("Physics disposed or RecoveryHold"); }
        body.setTranslation(spawn, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true); body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        tick.resume();
      },
      dispose(): void {
        if (disposed) { return; }
         disposed = true; tick.dispose(); character?.dispose(); bodies.clear();movingBodies.clear();world.free();
      }
    };
  } catch (error) { world.free(); throw error; }
};
