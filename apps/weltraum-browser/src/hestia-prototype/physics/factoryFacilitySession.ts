import { R } from "./rapierPort";
import { createFactoryInstallationProfile, transformFactoryPoint, type FactoryVector } from "../../factory/construction/installationProfile";
import { canonicalJson } from "../../resources/serialization";
import { copyFactoryCargoSite,type FactoryCargoSite } from "../../factory/fixtures/cargoSite";
import type { FactoryCargoAccess } from "../../factory/construction/placement";
import { isSaveSafeResourceId } from "../../resources/ids";

export interface FactoryFacilityRequest {
  readonly transactionId: string; readonly ownerId: string; readonly instanceId: string;
  readonly definitionRef: Readonly<{ sourceId: string; version: number; digest: string }>;
  readonly expectedRevision: number; readonly expectedTerrainRevision: number;
  readonly materialBinding: string; readonly centerMm: readonly number[]; readonly quarterTurns: number;
  readonly profileDigest?: string;
}
export interface FactoryFacilityOwner {
  readonly ownerId: string; readonly instanceId: string; readonly transactionId: string;
  readonly definitionRef: FactoryFacilityRequest["definitionRef"]; readonly profileDigest: string; readonly sourceDigest: string;
  readonly massMg: number; readonly materialBinding: string; readonly centerMm: FactoryVector; readonly quarterTurns: number;
  readonly bodyHandle: number; readonly colliderHandles: readonly number[];
}
export interface FactoryCargoOpenIntent { readonly ownerId:string;readonly profileDigest:string;readonly expectedTerrainRevision:number;readonly expectedRevision:number }
export interface FactoryNativeCargoRead extends FactoryCargoAccess { readonly site:FactoryCargoSite;readonly colliderHandles:readonly number[];readonly accessible:boolean;readonly openReceipt:FactoryCargoOpenIntent|null }
export interface FactoryFacilityRead {
  readonly cargo?:FactoryNativeCargoRead;
  readonly revision: number; readonly state: "Idle" | "PreparedHeld" | "CommittedHeld" | "PublishedHeld" | "RecoveryHold";
  readonly transactionId: string | null; readonly owners: readonly FactoryFacilityOwner[];
  readonly prepared: FactoryFacilityOwner | null;
}
const reject = (reason: string): never => { throw new Error(`FactoryFacilityRejected:${reason}`); };
const bodyBytes=(body:R.RigidBody,enabled=true):string=>canonicalJson({...(enabled?{enabled:body.isEnabled()}:{}),type:body.bodyType(),pose:{...body.translation()},rotation:{...body.rotation()},velocity:{...body.linvel()},angular:{...body.angvel()},sleeping:body.isSleeping(),mass:body.mass(),localCom:{...body.localCom()},inertia:{...body.principalInertia()},inertiaFrame:{...body.principalInertiaLocalFrame()},gravityScale:body.gravityScale(),linearDamping:body.linearDamping(),angularDamping:body.angularDamping(),ccd:body.isCcdEnabled()});
const colliderBytes=(collider:R.Collider,enabled=true):string=>{
  const type=collider.shapeType();
  const geometry=type===R.ShapeType.Cuboid||type===R.ShapeType.RoundCuboid?{halfExtents:{...collider.halfExtents()},...(type===R.ShapeType.RoundCuboid?{borderRadius:collider.roundRadius()}: {})}:
    type===R.ShapeType.Capsule||type===R.ShapeType.Cylinder||type===R.ShapeType.Cone?{radius:collider.radius(),halfHeight:collider.halfHeight()}:type===R.ShapeType.Ball?{radius:collider.radius()}:{type};
  return canonicalJson({...(enabled?{enabled:collider.isEnabled()}:{}),parent:collider.parent()?.handle??null,pose:{...collider.translation()},rotation:{...collider.rotation()},type,geometry,sensor:collider.isSensor(),friction:collider.friction(),restitution:collider.restitution(),density:collider.density(),collisionGroups:collider.collisionGroups(),solverGroups:collider.solverGroups()});
};
const members=(world:R.World)=>{
  const bodies=new Map<number,{object:R.RigidBody;bytes:string}>(),colliders=new Map<number,{object:R.Collider;shape:R.Shape;bytes:string}>();
  world.forEachRigidBody(body=>bodies.set(body.handle,{object:body,bytes:bodyBytes(body)}));
  // In this pinned Rapier port, topology replacement uses setShape and changes its cached shape object.
  // Native primitive dimension setters are checked separately above; no terrain geometry is re-encoded.
  world.forEachCollider(collider=>colliders.set(collider.handle,{object:collider,shape:collider.shape,bytes:colliderBytes(collider)}));
  return {bodies,colliders};
};
/** Only the private Native session supplies this SAME World. Requests contain no arbitrary body/box creation API. */
export const createFactoryFacilitySession = (world: R.World, safePaused: () => boolean, dormantBodies: () => number,
  terrainRevision: () => number = () => 0, initialCargo?:FactoryCargoSite, actorPosition:()=>Readonly<{x:number;y:number;z:number}>|undefined=()=>undefined) => {
  let revision = 0, owners: readonly FactoryFacilityOwner[] = [], recovery = false;
  let pending: { owner: FactoryFacilityOwner; state: "PreparedHeld" | "CommittedHeld" | "PublishedHeld";
    before: ReturnType<typeof members>; candidateBodyBytes:string;candidateColliders:ReadonlyMap<number,Readonly<{object:R.Collider;shape:R.Shape;bytes:string}>>; previousOwners: readonly FactoryFacilityOwner[]; previousRevision: number } | undefined;
  const completed = new Set<string>();
  if(initialCargo)initialCargo=copyFactoryCargoSite(initialCargo);
  let supportCache:Readonly<{revision:number;valid:boolean}>|undefined;
  let cargoBody:R.RigidBody|undefined,cargoCollider:R.Collider|undefined,cargoOpened=false;
  let cargoOpenReceipt:FactoryCargoOpenIntent|null=null;
  const hold = (): never => { recovery = true; throw new Error("FactoryFacilityRecoveryHold:MembershipNotProven"); };
  const verifyOld = (before: ReturnType<typeof members>): boolean => {
    const current = members(world);
    for (const [handle,value] of before.bodies) if (current.bodies.get(handle)?.object !== value.object || current.bodies.get(handle)?.bytes !== value.bytes) return false;
    for (const [handle,value] of before.colliders) if (current.colliders.get(handle)?.object !== value.object || current.colliders.get(handle)?.bytes !== value.bytes || current.colliders.get(handle)?.shape !== value.shape) return false;
    return true;
  };
  const requirePending = (id: string): NonNullable<typeof pending> => {
    if (recovery) reject("RecoveryHold");
    if (!pending || pending.owner.transactionId !== id) reject("TransactionMismatch");
    return pending!;
  };
  const verifyCandidate = (candidate: NonNullable<typeof pending>): boolean => {
    const body = world.getRigidBody(candidate.owner.bodyHandle);
    return !!body && body.isFixed() && bodyBytes(body,false)===candidate.candidateBodyBytes && body.isEnabled()===(candidate.state!=="PreparedHeld") && body.numColliders() === candidate.owner.colliderHandles.length &&
      candidate.owner.colliderHandles.every(handle => {const collider=world.getCollider(handle),expected=candidate.candidateColliders.get(handle);return !!collider&&collider.parent()===body&&collider===expected?.object&&collider.shape===expected.shape&&colliderBytes(collider,false)===expected.bytes&&collider.isEnabled()===(candidate.state!=="PreparedHeld");}) &&
      world.bodies.len() === candidate.before.bodies.size + 1 && world.colliders.len() === candidate.before.colliders.size + candidate.owner.colliderHandles.length && verifyOld(candidate.before);
  };
  const refresh = () => { world.propagateModifiedBodyPositionsToColliders(); world.updateSceneQueries(); };
  const currentCargoSupport=():boolean=>{
    if(!initialCargo)return false;
    if(supportCache?.revision===terrainRevision())return supportCache.valid;
    for(let z=12.6875;z<13.625;z+=.125)for(let x=-6.1875;x<-4.75;x+=.125){
      const hit=world.castRayAndGetNormal(new R.Ray({x,y:1.255,z},{x:0,y:-1,z:0}),.01,true,undefined,undefined,undefined,cargoBody,collider=>collider.isEnabled()&&!collider.isSensor()&&(collider.parent()?.isFixed()??true));
      if(!hit||Math.abs(1.255-hit.toi-1.25)>.003||hit.normal.y<.9){supportCache={revision:terrainRevision(),valid:false};return false;}
    }supportCache={revision:terrainRevision(),valid:true};return true;
  };
  const cargoClearance=():boolean=>{
    if(!initialCargo)return false;
    const a=initialCargo.accessBoundsMm,center=a.min.map((v,i)=>(v+a.max[i]!)/2000),extent=a.max.map((v,i)=>(v-a.min[i]!)/2000-.0005);let blocked=false;
    world.intersectionsWithShape({x:center[0]!,y:center[1]!,z:center[2]!},{x:0,y:0,z:0,w:1},new R.Cuboid(extent[0]!,extent[1]!,extent[2]!),()=>{blocked=true;return false;},undefined,undefined,undefined,cargoBody,collider=>collider.isEnabled()&&!collider.isSensor()&&!collider.parent()?.isKinematic());return !blocked;
  };
  if(initialCargo){
    refresh();
    if(world.bodies.len()+dormantBodies()+1>64||world.colliders.len()+1>4096)reject("CargoBudgetExceeded");
    let blocked=false;
    world.intersectionsWithShape({x:-5.5,y:2,z:13.125},{x:0,y:0,z:0,w:1},new R.Cuboid(.7495,.7495,.4995),()=>{blocked=true;return false;},undefined,undefined,undefined,undefined,collider=>collider.isEnabled()&&!collider.isSensor());
    if(blocked||!currentCargoSupport()||!cargoClearance())reject("CargoNativeSupportOrClearance");
    cargoBody=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(-5.5,2,13.125));
    try{cargoCollider=world.createCollider(R.ColliderDesc.cuboid(.75,.75,.5).setFriction(.8),cargoBody);refresh();}catch(error){world.removeRigidBody(cargoBody);refresh();throw error;}
  }
  const readCargo=():FactoryNativeCargoRead|undefined=>{
    if(!initialCargo||!cargoBody||!cargoCollider)return undefined;
    const pose=cargoBody.translation(),orientation=cargoBody.rotation();
    const intact=world.getRigidBody(cargoBody.handle)===cargoBody&&world.getCollider(cargoCollider.handle)===cargoCollider&&cargoBody.isFixed()&&cargoBody.isEnabled()&&cargoCollider.isEnabled()&&Math.hypot(pose.x+5.5,pose.y-2,pose.z-13.125)<1e-6&&Math.hypot(orientation.x,orientation.y,orientation.z)<1e-6&&Math.abs(orientation.w-1)<1e-6;
    if(!intact)recovery=true;
    const actor=actorPosition(),target=initialCargo.accessPointMm.map(v=>v/1000);let accessible=false;
    if(intact&&actor){const distance=Math.hypot(actor.x-target[0]!,actor.y-target[1]!,actor.z-target[2]!);
      if(distance<=4){const ray=new R.Ray(actor,{x:(target[0]!-actor.x)/Math.max(distance,.0001),y:(target[1]!-actor.y)/Math.max(distance,.0001),z:(target[2]!-actor.z)/Math.max(distance,.0001)});
        accessible=!world.castRay(ray,Math.max(0,distance-.001),true,undefined,undefined,undefined,cargoBody,collider=>collider.isEnabled()&&!collider.isSensor()&&!collider.parent()?.isKinematic())&&currentCargoSupport()&&cargoClearance();}}
    return Object.freeze({ownerId:initialCargo.ownerId,containerId:initialCargo.containerId,sourceDigest:initialCargo.sourceDigest,profileDigest:initialCargo.profileDigest,opened:cargoOpened,positionMm:initialCargo.centerMm,accessBoundsMm:initialCargo.accessBoundsMm,bodyHandle:cargoBody.handle,colliderHandles:Object.freeze([cargoCollider.handle]),site:initialCargo,accessible,openReceipt:cargoOpenReceipt});
  };
  const rollback = (id: string): void => {
    const candidate = requirePending(id);
    const body = world.getRigidBody(candidate.owner.bodyHandle);
    if (body) world.removeRigidBody(body);
    refresh();
    if (world.bodies.len() !== candidate.before.bodies.size || world.colliders.len() !== candidate.before.colliders.size || !verifyOld(candidate.before)) hold();
    owners = candidate.previousOwners; revision = candidate.previousRevision; pending = undefined;
  };
  return {
    get busy(): boolean { return !!pending || recovery; },
    read(): FactoryFacilityRead { const cargo=readCargo();return Object.freeze({ ...(cargo?{cargo}:{}),revision, state: recovery ? "RecoveryHold" : pending?.state ?? "Idle", transactionId: pending?.owner.transactionId ?? null,
      owners, prepared: pending?.owner ?? null }); },
    openCargo(intent:FactoryCargoOpenIntent):FactoryFacilityRead{
      if(pending||recovery)reject("CargoBusy");
      const cargo=readCargo();if(cargoOpenReceipt&&canonicalJson(intent)===canonicalJson(cargoOpenReceipt)&&intent.expectedTerrainRevision===terrainRevision()){if(!cargo?.accessible)reject("CargoOutOfReach");return this.read();}
      if(!cargo||intent.ownerId!==cargo.ownerId||intent.profileDigest!==cargo.profileDigest||intent.expectedRevision!==revision||intent.expectedTerrainRevision!==terrainRevision())reject("CargoBindingMismatch");
      if(!cargo!.accessible)reject("CargoOutOfReach");
      if(!cargoOpened){cargoOpened=true;cargoOpenReceipt=Object.freeze({...intent});revision++;}return this.read();
    },
    prepare(request: FactoryFacilityRequest): FactoryFacilityRead {
      if (recovery || pending || !safePaused()) reject("NotIdlePaused");
      if (![request.transactionId, request.ownerId, request.instanceId].every(isSaveSafeResourceId) || request.ownerId !== request.instanceId || request.ownerId===initialCargo?.ownerId || completed.has(request.transactionId) || owners.some(value => value.ownerId === request.ownerId)) reject("InvalidOrDuplicateIdentity");
      if (request.expectedRevision !== revision || request.expectedTerrainRevision !== terrainRevision()) reject("StaleRevision");
      if (typeof request.materialBinding !== "string" || request.materialBinding.length < 1 || request.materialBinding.length > 262144 || request.centerMm.length !== 3 || !request.centerMm.every(v => Number.isSafeInteger(v) && v % 250 === 0) || !Number.isInteger(request.quarterTurns) || request.quarterTurns < 0 || request.quarterTurns > 3) reject("InvalidBindingOrFrame");
      const profile = createFactoryInstallationProfile(request.definitionRef.sourceId);
      if (canonicalJson(profile.definitionRef) !== canonicalJson(request.definitionRef) || (request.profileDigest !== undefined && request.profileDigest !== profile.profileDigest)) reject("DefinitionOrProfileMismatch");
      let dynamic = 0; world.forEachRigidBody(body => { if (body.isDynamic()) dynamic++; });
      if (owners.length+(initialCargo?1:0) >= 16 || world.bodies.len() + dormantBodies() + 1 > 64 || dynamic > 32 || world.colliders.len() + profile.colliders.length > 4096) reject("BudgetExceeded");
      // Narrow-phase scene query against real current native members, before body allocation.
      refresh();
      for(const box of profile.colliders){
        const center=transformFactoryPoint(box.centerMm,request.centerMm,request.quarterTurns),sy=Math.sin(request.quarterTurns*Math.PI/4),cy=Math.cos(request.quarterTurns*Math.PI/4),sz=Math.sin(box.rotationZRadians/2),cz=Math.cos(box.rotationZRadians/2);
        let blocked=false;
        world.intersectionsWithShape({x:center[0]/1000,y:center[1]/1000,z:center[2]/1000},{x:sy*sz,y:sy*cz,z:cy*sz,w:cy*cz},new R.Cuboid(Math.max(.0001,box.sizeMm[0]/2000-.0005),Math.max(.0001,box.sizeMm[1]/2000-.0005),Math.max(.0001,box.sizeMm[2]/2000-.0005)),()=>{blocked=true;return false;},undefined,undefined,undefined,undefined,collider=>collider.isEnabled());
        if(blocked)reject("NativeOverlap");
      }
      const before = members(world), handles: number[] = [];
      let body: R.RigidBody | undefined;
      try {
        body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(request.centerMm[0]!/1000,request.centerMm[1]!/1000,request.centerMm[2]!/1000)
          .setRotation({ x: 0, y: Math.sin(request.quarterTurns*Math.PI/4), z: 0, w: Math.cos(request.quarterTurns*Math.PI/4) }).setEnabled(false));
        for (const box of profile.colliders) {
          const collider = world.createCollider(R.ColliderDesc.cuboid(box.sizeMm[0]/2000,box.sizeMm[1]/2000,box.sizeMm[2]/2000)
            .setTranslation(box.centerMm[0]/1000,box.centerMm[1]/1000,box.centerMm[2]/1000)
            .setRotation({ x: 0, y: 0, z: Math.sin(box.rotationZRadians/2), w: Math.cos(box.rotationZRadians/2) }), body);
          collider.setEnabled(false); handles.push(collider.handle);
        }
        const owner: FactoryFacilityOwner = Object.freeze({ ownerId: request.ownerId, instanceId: request.instanceId, transactionId: request.transactionId,
          definitionRef: profile.definitionRef, profileDigest: profile.profileDigest, sourceDigest: profile.sourceDigest, massMg: profile.massMg,
          materialBinding: request.materialBinding, centerMm: Object.freeze([...request.centerMm]) as FactoryVector, quarterTurns: request.quarterTurns,
          bodyHandle: body.handle, colliderHandles: Object.freeze(handles) });
        refresh();const candidateColliders=new Map(handles.map(handle=>{const collider=world.getCollider(handle);return [handle,{object:collider,shape:collider.shape,bytes:colliderBytes(collider,false)}] as const;}));
        pending = { owner, state: "PreparedHeld", before,candidateBodyBytes:bodyBytes(body,false),candidateColliders, previousOwners: owners, previousRevision: revision };
        if (!verifyCandidate(pending)) hold();
      } catch (error) {
        if (body && world.getRigidBody(body.handle)) world.removeRigidBody(body);
        refresh();
        if (world.bodies.len() !== before.bodies.size || world.colliders.len() !== before.colliders.size || !verifyOld(before)) hold();
        pending = undefined; throw error;
      }
      return this.read();
    },
    commit(id: string): FactoryFacilityRead {
      const candidate = requirePending(id); if (candidate.state !== "PreparedHeld") reject("WrongPhase");
      if (!verifyCandidate(candidate)) hold();
      world.getRigidBody(candidate.owner.bodyHandle).setEnabled(true);
      for (const handle of candidate.owner.colliderHandles) world.getCollider(handle).setEnabled(true);
      refresh(); candidate.state = "CommittedHeld"; return this.read();
    },
    publish(id: string): FactoryFacilityRead {
      const candidate = requirePending(id); if (candidate.state !== "CommittedHeld") reject("WrongPhase");
      if (!verifyCandidate(candidate)) hold();
      owners = Object.freeze([...candidate.previousOwners,candidate.owner]); revision = candidate.previousRevision+1; candidate.state = "PublishedHeld";
      return this.read();
    },
    rollback,
    finalize(id: string): FactoryFacilityRead {
      const candidate = requirePending(id); if (candidate.state !== "PublishedHeld") reject("WrongPhase");
      if (!verifyCandidate(candidate)) hold();
      completed.add(id); pending = undefined; return this.read();
    }
  };
};
