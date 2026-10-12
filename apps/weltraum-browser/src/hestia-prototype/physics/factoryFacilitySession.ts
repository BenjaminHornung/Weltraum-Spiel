import { R } from "./rapierPort";
import { createFactoryInstallationProfile, transformFactoryPoint, transformFactoryBounds, type FactoryVector } from "../../factory/construction/installationProfile";
import { canonicalJson, canonicalSignature } from "../../resources/serialization";
import { copyFactoryCargoSite,type FactoryCargoSite } from "../../factory/fixtures/cargoSite";
import type { FactoryCargoAccess } from "../../factory/construction/placement";
import { isSaveSafeResourceId } from "../../resources/ids";
import { createFp02Fixture } from "../../factory/catalog/fp02Catalog";
import { readCargoHandlingProfile, type CargoHandlingProfile } from "../../factory/construction/cargoHandlingProfile";

export interface FactoryFacilityRequest {
  readonly transactionId: string; readonly ownerId: string; readonly instanceId: string;
  readonly definitionRef: Readonly<{ sourceId: string; version: number; digest: string }>;
  readonly expectedRevision: number; readonly expectedTerrainRevision: number;
  readonly materialBinding: string; readonly centerMm: readonly number[]; readonly quarterTurns: number;
  readonly profileDigest?: string;
  readonly consumedCustody?: Readonly<{containerId:string;emptyCanonicalJson:string}>;
}
export interface FactoryFacilityOwner {
  readonly ownerId: string; readonly instanceId: string; readonly transactionId: string;
  readonly definitionRef: FactoryFacilityRequest["definitionRef"]; readonly profileDigest: string; readonly sourceDigest: string;
  readonly massMg: number; readonly materialBinding: string; readonly centerMm: FactoryVector; readonly quarterTurns: number;
  readonly bodyHandle: number; readonly colliderHandles: readonly number[];
  readonly installationRevision:number;
}
export interface FactoryCargoOpenIntent { readonly ownerId:string;readonly profileDigest:string;readonly expectedTerrainRevision:number;readonly expectedRevision:number }
export interface FactoryNativeCargoRead extends FactoryCargoAccess { readonly site:FactoryCargoSite;readonly colliderHandles:readonly number[];readonly accessible:boolean;readonly openReceipt:FactoryCargoOpenIntent|null }
export interface FactoryCarrierRequest {
  readonly transactionId: string; readonly ownerId: string; readonly profileId: string; readonly profileDigest: string;
  readonly expectedRevision: number; readonly expectedTerrainRevision: number; readonly sourceContainerId: string; readonly materialBinding: string;
  readonly sourceInstanceId?: string;
  readonly custodyContainerId?: string;
  readonly emptyCustodyCanonicalJson?: string;
}
export interface FactoryNativeCarrierRead {
  readonly ownerId: string; readonly transactionId: string; readonly profileId: string; readonly profileDigest: string;
  readonly phase: "PreparedHeld" | "CommittedHeld" | "PublishedHeld" | "Carrying" | "Deposited";
  readonly bodyHandle: number; readonly colliderHandles: readonly number[]; readonly massMg: number;
  readonly materialBinding: string; readonly positionMm: FactoryVector;
  readonly containerId: string;
  readonly accessible?: boolean;
  readonly nativeMassKg: number; readonly localCom: Readonly<{ x: number; y: number; z: number }>; readonly principalInertia: Readonly<{ x: number; y: number; z: number }>;
}
export interface FactoryCarrierVeto {
  readonly reason:string; readonly targetMm:FactoryVector;
  readonly colliderHandle?:number; readonly colliderShapeType?:number;
  readonly timeOfImpact?:number; readonly colliderLocalNormal?:Readonly<{x:number;y:number;z:number}>;
}
export interface FactoryNativePartObservation {
 readonly instanceId:string;readonly definitionRef:FactoryFacilityRequest["definitionRef"];readonly sourceDigest:string;readonly profileDigest:string;
 readonly installationRevision:number;readonly terrainRevision:number;readonly facilityRevision:number;
 readonly published:boolean;readonly confirmed:boolean;readonly complete:boolean;readonly observationDigest:string;
 readonly parts:readonly Readonly<{partId:string;status:"Present"|"Absent"|"Unknown";colliderHandles:readonly number[]}>[];
}
export interface FactoryFacilityRead {
  /** Derived observation of the last genuine move rejection; never movement/clock authority. */
  readonly lastCarrierVeto?:FactoryCarrierVeto;
  /** Derived actual same-World members; SourceScene alone cannot mark a part Present. */
  readonly partObservations?:readonly FactoryNativePartObservation[];
  /** Disabled candidate geometry is hidden staging evidence, never published gameplay presence. */
  readonly preparedPartObservation?:FactoryNativePartObservation;
  readonly powerPorts?:readonly Readonly<{portId:string;sourcePortId:string;instanceId:string;profileDigest:string;sourceDigest:string;installationRevision:number;terrainRevision:number;facilityRevision:number;positionMm:FactoryVector;outwardNormal:FactoryVector;role:string;confirmed:boolean;accessible:boolean}>[];
  readonly production?:readonly Readonly<{instanceId:string;profileDigest:string;sourceDigest:string;installationRevision:number;terrainRevision:number;facilityRevision:number;confirmed:boolean;supported:boolean;serviceClear:boolean;sweepClear:boolean;accessible:boolean}>[];
  readonly sources?: readonly Readonly<{containerId:string;instanceId:string;accessible:boolean}>[];
  readonly cargo?:FactoryNativeCargoRead;
  readonly carrier?: FactoryNativeCarrierRead;
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
  terrainRevision: () => number = () => 0, initialCargo?:FactoryCargoSite, actorPosition:()=>Readonly<{x:number;y:number;z:number}>|undefined=()=>undefined,
  actorBodyHandle: () => number | undefined = () => undefined, covered: (x: number, z: number) => boolean = () => true) => {
  let revision = 0, owners: readonly FactoryFacilityOwner[] = [], recovery = false;
  let pending: { owner: FactoryFacilityOwner; state: "PreparedHeld" | "CommittedHeld" | "PublishedHeld";
    before: ReturnType<typeof members>; originalMembers?:ReturnType<typeof members>; consumedCarrier?:FactoryNativeCarrierRead; candidateBodyBytes:string;candidateColliders:ReadonlyMap<number,Readonly<{object:R.Collider;shape:R.Shape;bytes:string}>>; previousOwners: readonly FactoryFacilityOwner[]; previousRevision: number } | undefined;
  const completed = new Set<string>();
  const handlingCatalog = createFp02Fixture("cargo").catalog;
  let carrier: FactoryNativeCarrierRead | undefined;
  let lastCarrierVeto:FactoryCarrierVeto|undefined;
  let carrierDefinition: CargoHandlingProfile | undefined;
  let carrierWork: { request: FactoryCarrierRequest; before: ReturnType<typeof members>; previousRevision: number;
    bodyBytes: string; colliders: ReadonlyMap<number, Readonly<{ object: R.Collider; shape: R.Shape; bytes: string }>>;
    previousCarrier?: FactoryNativeCarrierRead; previousPose?:Readonly<{x:number;y:number;z:number}>;
    depositPose?:Readonly<{x:number;y:number;z:number}>; operation?: "release" } | undefined;

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
  const obstacle = (collider: R.Collider): boolean => collider.isEnabled() && !collider.isSensor() && (actorBodyHandle() === undefined || collider.parent()?.handle !== actorBodyHandle()) && (carrier === undefined || collider.parent()?.handle !== carrier.bodyHandle);
  const carrierProfile = (request: FactoryCarrierRequest): CargoHandlingProfile => {
    const profile = readCargoHandlingProfile(handlingCatalog, request.profileId);
    if (!profile || profile.digest !== request.profileDigest) reject("CarrierProfileMismatch");
    return profile!;
  };
  const localSourceAccess = (containerId: string, instanceId: string | undefined,parts?:FactoryNativePartObservation): boolean => {
    const owner = owners.find(value => value.instanceId === instanceId), actor = actorPosition();
    if (!owner || !actor) return false;
    if(observedDefinitions.has(owner.definitionRef.sourceId)&&!(parts??partObservation(owner)).complete)return false;
    const roles = owner.definitionRef.sourceId === "B09" ? ["storage"] : ["B05", "B06", "B07"].includes(owner.definitionRef.sourceId) ? ["input", "output", "offcut"] : [];
    if (!roles.some(role => containerId === `${role}_${owner.instanceId}`)) return false;
    const body = world.getRigidBody(owner.bodyHandle);
    if (!body || !body.isFixed() || !body.isEnabled() || !owner.colliderHandles.every(handle => world.getCollider(handle)?.parent() === body)) return false;
    if (Math.hypot(body.translation().x - owner.centerMm[0] / 1000, body.translation().y - owner.centerMm[1] / 1000, body.translation().z - owner.centerMm[2] / 1000) > 1e-6) return false;
    const profile = createFactoryInstallationProfile(owner.definitionRef.sourceId);
    if (profile.profileDigest !== owner.profileDigest) return false;
    const access = transformFactoryBounds(profile.serviceBoundsMm, owner.centerMm, owner.quarterTurns);
    const point = [actor.x, actor.y, actor.z].map((value, index) => Math.min(access.max[index]! / 1000, Math.max(access.min[index]! / 1000, value)));
    const distance = Math.hypot(point[0]! - actor.x, point[1]! - actor.y, point[2]! - actor.z);
    if (distance > 3) return false;
    if (distance < .001) return true;
    return !world.castRay(new R.Ray(actor, { x: (point[0]! - actor.x) / distance, y: (point[1]! - actor.y) / distance, z: (point[2]! - actor.z) / distance }),
      distance - .001, true, undefined, undefined, undefined, body, obstacle);
  };
  const ownerProfiles=new Map<string,ReturnType<typeof createFactoryInstallationProfile>>();
  const ownerMembers=new Map<string,{body:R.RigidBody;colliders:ReadonlyMap<number,R.Collider>}>();
  const observedDefinitions=new Set(["B06","B07","B09"]);
  const profileFor=(owner:FactoryFacilityOwner)=>{let profile=ownerProfiles.get(owner.instanceId);if(!profile){profile=createFactoryInstallationProfile(owner.definitionRef.sourceId);ownerProfiles.set(owner.instanceId,profile);}return profile;};
  const partObservation=(owner:FactoryFacilityOwner,published=true,enabled=true):FactoryNativePartObservation=>{
    const profile=profileFor(owner),saved=ownerMembers.get(owner.instanceId),body=world.getRigidBody(owner.bodyHandle),pose=body?.translation(),rotation=body?.rotation();
    const sy=Math.sin(owner.quarterTurns*Math.PI/4),cy=Math.cos(owner.quarterTurns*Math.PI/4);
    const confirmed=!!body&&body===saved?.body&&body.isFixed()&&body.isEnabled()===enabled
      &&profile.definitionRef.sourceId===owner.definitionRef.sourceId&&profile.definitionRef.version===owner.definitionRef.version&&profile.definitionRef.digest===owner.definitionRef.digest
      &&profile.profileDigest===owner.profileDigest&&profile.sourceDigest===owner.sourceDigest
      &&Math.hypot(pose!.x-owner.centerMm[0]/1000,pose!.y-owner.centerMm[1]/1000,pose!.z-owner.centerMm[2]/1000)<1e-6
      &&Math.min(Math.hypot(rotation!.x,rotation!.y-sy,rotation!.z,rotation!.w-cy),Math.hypot(rotation!.x,rotation!.y+sy,rotation!.z,rotation!.w+cy))<1e-6;
    const parts=profile.source.parts.map(part=>{
      const boxes=profile.colliders.flatMap((box,index)=>box.partId===part.partId?[{box,handle:owner.colliderHandles[index]}]:[]);
      let missing=0,valid=confirmed&&boxes.length>0;const presentHandles:number[]=[];
      for(const {box,handle} of boxes){
        const collider=handle===undefined?null:world.getCollider(handle);if(!collider){missing++;valid=false;continue;}presentHandles.push(handle!);
        if(!confirmed||collider!==saved?.colliders.get(handle!)||collider.parent()!==body||collider.isEnabled()!==enabled||collider.isSensor()||collider.shapeType()!==R.ShapeType.Cuboid){valid=false;continue;}
        const half=collider.halfExtents(),p=collider.translation(),q=collider.rotation(),center=transformFactoryPoint(box.centerMm,owner.centerMm,owner.quarterTurns),sz=Math.sin(box.rotationZRadians/2),cz=Math.cos(box.rotationZRadians/2),expected={x:sy*sz,y:sy*cz,z:cy*sz,w:cy*cz};
        if(Math.hypot(half.x-box.sizeMm[0]/2000,half.y-box.sizeMm[1]/2000,half.z-box.sizeMm[2]/2000)>=1e-6
          ||Math.hypot(p.x-center[0]/1000,p.y-center[1]/1000,p.z-center[2]/1000)>=1e-6
          ||Math.min(Math.hypot(q.x-expected.x,q.y-expected.y,q.z-expected.z,q.w-expected.w),Math.hypot(q.x+expected.x,q.y+expected.y,q.z+expected.z,q.w+expected.w))>=1e-6)valid=false;
      }
      return Object.freeze({partId:part.partId,status:valid?"Present" as const:confirmed&&missing===boxes.length?"Absent" as const:"Unknown" as const,colliderHandles:Object.freeze(presentHandles)});
    });
    const complete=confirmed&&body!.numColliders()===profile.colliders.length&&parts.every(p=>p.status==="Present");
    const binding={instanceId:owner.instanceId,definitionRef:owner.definitionRef,sourceDigest:owner.sourceDigest,profileDigest:owner.profileDigest,installationRevision:owner.installationRevision,terrainRevision:terrainRevision(),facilityRevision:revision,published,confirmed,complete,parts:Object.freeze(parts)};
    return Object.freeze({...binding,observationDigest:canonicalSignature(binding)});
  };
  const productionObservation=(owner:FactoryFacilityOwner,parts?:FactoryNativePartObservation)=>{
    let profile=ownerProfiles.get(owner.instanceId);if(!profile){profile=createFactoryInstallationProfile(owner.definitionRef.sourceId);ownerProfiles.set(owner.instanceId,profile);}
    const body=world.getRigidBody(owner.bodyHandle),pose=body?.translation(),rotation=body?.rotation(),expectedY=Math.sin(owner.quarterTurns*Math.PI/4),expectedW=Math.cos(owner.quarterTurns*Math.PI/4);
    const confirmed=(!observedDefinitions.has(owner.definitionRef.sourceId)||(parts??partObservation(owner)).complete)&&!!body&&body.isFixed()&&body.isEnabled()&&profile.profileDigest===owner.profileDigest&&profile.sourceDigest===owner.sourceDigest
      &&Math.hypot(pose!.x-owner.centerMm[0]/1000,pose!.y-owner.centerMm[1]/1000,pose!.z-owner.centerMm[2]/1000)<1e-6
      &&Math.hypot(rotation!.x,rotation!.y-expectedY,rotation!.z,rotation!.w-expectedW)<1e-6
      &&body.numColliders()===profile.colliders.length&&owner.colliderHandles.every((handle,index)=>{const collider=world.getCollider(handle),box=profile!.colliders[index];if(!collider||!box||collider.parent()!==body||!collider.isEnabled()||collider.shapeType()!==R.ShapeType.Cuboid)return false;const half=collider.halfExtents();return Math.hypot(half.x-box.sizeMm[0]/2000,half.y-box.sizeMm[1]/2000,half.z-box.sizeMm[2]/2000)<1e-6;});
    const solid=(collider:R.Collider)=>collider.isEnabled()&&!collider.isSensor()&&collider.parent()?.handle!==owner.bodyHandle&&(actorBodyHandle()===undefined||collider.parent()?.handle!==actorBodyHandle());
    let supported=confirmed;
    for(const patch of profile.supportPatchesMm){
      for(let x=-patch.sizeMm[0]/2+.5;x<patch.sizeMm[0]/2;x+=62.5)for(let z=-patch.sizeMm[1]/2+.5;z<patch.sizeMm[1]/2;z+=62.5){
        const p=transformFactoryPoint([patch.centerMm[0]+x,patch.centerMm[1],patch.centerMm[2]+z],owner.centerMm,owner.quarterTurns),px=p[0]/1000,py=p[1]/1000,pz=p[2]/1000;
        if(!covered(px,pz)){supported=false;continue;}
        const hit=world.castRayAndGetNormal(new R.Ray({x:px,y:py+.005,z:pz},{x:0,y:-1,z:0}),.01,true,undefined,undefined,undefined,body,collider=>solid(collider)&&(collider.parent()?.isFixed()??true));
        if(!hit||Math.abs(.005-hit.toi)>.002||hit.normal.y<.9)supported=false;
      }
    }
    const clear=(bounds:ReturnType<typeof transformFactoryBounds>)=>{
      const b=transformFactoryBounds(bounds,owner.centerMm,owner.quarterTurns),center={x:(b.min[0]+b.max[0])/2000,y:(b.min[1]+b.max[1])/2000,z:(b.min[2]+b.max[2])/2000};
      let free=true;for(let x=b.min[0]+.5;x<b.max[0];x+=125)for(let z=b.min[2]+.5;z<b.max[2];z+=125)if(!covered(x/1000,z/1000))free=false;
      world.intersectionsWithShape(center,{x:0,y:0,z:0,w:1},new R.Cuboid(Math.max(.0001,(b.max[0]-b.min[0])/2000-.0005),Math.max(.0001,(b.max[1]-b.min[1])/2000-.0005),Math.max(.0001,(b.max[2]-b.min[2])/2000-.0005)),()=>{free=false;return false;},undefined,undefined,undefined,body,solid);return free;
    };
    return Object.freeze({instanceId:owner.instanceId,profileDigest:owner.profileDigest,sourceDigest:owner.sourceDigest,installationRevision:owner.installationRevision,terrainRevision:terrainRevision(),facilityRevision:revision,confirmed,supported,serviceClear:confirmed&&clear(profile.serviceBoundsMm),sweepClear:confirmed&&profile.sweepBoundsMm.every(clear),accessible:localSourceAccess(`input_${owner.instanceId}`,owner.instanceId)});
  };
  const powerSocketObservation=(owner:FactoryFacilityOwner,readProof:()=>ReturnType<typeof productionObservation>)=>{
    const profile=ownerProfiles.get(owner.instanceId)??createFactoryInstallationProfile(owner.definitionRef.sourceId);
    ownerProfiles.set(owner.instanceId,profile);
    const ports=profile.source.ports.filter(port=>port.role.startsWith("Power"));if(!ports.length)return [];
    const proof=readProof(),actor=actorPosition(),body=world.getRigidBody(owner.bodyHandle);
    return ports.map(port=>{
      const positionMm=transformFactoryPoint(port.centerM.map(n=>n*1000),owner.centerMm,owner.quarterTurns),outwardNormal=transformFactoryPoint(port.normal,[0,0,0],owner.quarterTurns);
      const distance=actor?Math.hypot(positionMm[0]/1000-actor.x,positionMm[1]/1000-actor.y,positionMm[2]/1000-actor.z):Infinity;
      let accessible=proof.confirmed&&proof.supported&&distance<=3;
      if(accessible&&distance>.001){const hit=world.castRay(new R.Ray(actor!,{x:(positionMm[0]/1000-actor!.x)/distance,y:(positionMm[1]/1000-actor!.y)/distance,z:(positionMm[2]/1000-actor!.z)/distance}),distance-.001,true,undefined,undefined,undefined,body,c=>c.isEnabled()&&!c.isSensor()&&c.parent()?.handle!==owner.bodyHandle&&(actorBodyHandle()===undefined||c.parent()?.handle!==actorBodyHandle()));accessible=!hit;}
      return Object.freeze({portId:`power_${owner.instanceId}`,sourcePortId:port.sourceId,instanceId:owner.instanceId,profileDigest:owner.profileDigest,sourceDigest:owner.sourceDigest,installationRevision:owner.installationRevision,terrainRevision:terrainRevision(),facilityRevision:revision,positionMm,outwardNormal,role:port.role,confirmed:proof.confirmed&&proof.supported,accessible});
    });
  };
  const carrierPose = (profile: CargoHandlingProfile, actor: Readonly<{ x: number; y: number; z: number }>, snap=false) => {
    const light = profile.sizeMm[0] === 500;
    const rawX=actor.x,rawZ=actor.z-(light?.75:1),x=snap?Math.round(rawX*4)/4:rawX,z=snap?Math.round(rawZ*4)/4:rawZ;
    if(snap&&(Math.abs(x-rawX)>.125001||Math.abs(z-rawZ)>.125001))reject("CarrierSnapDistance");
    const ground = world.castRayAndGetNormal(new R.Ray({ x, y: actor.y + 1, z }, { x: 0, y: -1, z: 0 }), 6, true, undefined, undefined, undefined, undefined,
      collider => obstacle(collider) && (collider.parent()?.isFixed() ?? true));
    if (!ground || ground.normal.y < .9) reject("CarrierSupport");
    const y = actor.y + 1 - ground!.toi, offset = light ? .0625 : .25;
    for (const dx of [-offset, offset]) for (const dz of [-offset, offset]) for (const sx of [-.06249, -.03125, 0, .03125, .06249]) for (const sz of [-.06249, -.03125, 0, .03125, .06249]) {
      const px = x + dx + sx, pz = z + dz + sz;
      if (!covered(px, pz)) reject("CarrierCoverage");
      const hit = world.castRayAndGetNormal(new R.Ray({ x: px, y: y + .005, z: pz }, { x: 0, y: -1, z: 0 }), .01, true, undefined, undefined, undefined, undefined,
        collider => obstacle(collider) && (collider.parent()?.isFixed() ?? true));
      if (!hit || Math.abs(y + .005 - hit.toi - y) > .002 || hit.normal.y < .9) reject("CarrierSupport");
    }
    // Known collision coverage includes the whole transported hull, independent of support samples.
    for (let px = x - profile.sizeMm[2] / 2000; px <= x + profile.sizeMm[2] / 2000; px += .125)
      for (let pz = z - profile.sizeMm[0] / 2000; pz <= z + profile.sizeMm[0] / 2000; pz += .125) if (!covered(px, pz)) reject("CarrierCoverage");
    return { x, y, z };
  };
  const carrierBoxes = (profile: CargoHandlingProfile) => {
    const offset = profile.sizeMm[0] === 500 ? .0625 : .25;
    return [{ center: { x: 0, y: .75, z: 0 }, half: { x: profile.sizeMm[0] / 2000, y: .5, z: profile.sizeMm[2] / 2000 } },
      ...[-offset, offset].flatMap(x => [-offset, offset].map(z => ({ center: { x, y: .125, z }, half: { x: .0625, y: .125, z: .0625 } })))];
  };
  const assertCarrierClearance = (profile: CargoHandlingProfile, pose: Readonly<{ x: number; y: number; z: number }>): void => {
    for (const box of carrierBoxes(profile)) {
      let blocked = false;
      // Tutorial transport q1: east→-Z, north→+X. The body carries exactly this same rotation.
      world.intersectionsWithShape({ x: pose.x + box.center.z, y: pose.y + box.center.y, z: pose.z - box.center.x },
        { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }, new R.Cuboid(box.half.x - .0005, box.half.y - .0005, box.half.z - .0005),
        () => { blocked = true; return false; }, undefined, undefined, undefined, undefined, obstacle);
      if (blocked) reject("CarrierOverlap");
    }
  };
  const readCarrier = (): FactoryNativeCarrierRead | undefined => {
    if (!carrier) return undefined;
    const body = world.getRigidBody(carrier.bodyHandle);
    if (!body || body.numColliders() !== 5 || !carrier.colliderHandles.every(handle => world.getCollider(handle)?.parent() === body)) hold();
    const position = body.translation(),actor=actorPosition();let accessible=false;
    if(carrier.phase==="Carrying")accessible=true;
    if(carrier.phase==="Deposited"&&body.isFixed()&&body.isEnabled()&&actor&&carrierDefinition){
      const p=carrierDefinition,point={x:Math.max(position.x-p.sizeMm[2]/2000,Math.min(position.x+p.sizeMm[2]/2000,actor.x)),y:Math.max(position.y+.25,Math.min(position.y+1.25,actor.y)),z:Math.max(position.z-p.sizeMm[0]/2000,Math.min(position.z+p.sizeMm[0]/2000,actor.z))};
      const distance=Math.hypot(point.x-actor.x,point.y-actor.y,point.z-actor.z);
      accessible=distance<=3&&covered(position.x,position.z)&&(distance<.001||!world.castRay(new R.Ray(actor,{x:(point.x-actor.x)/distance,y:(point.y-actor.y)/distance,z:(point.z-actor.z)/distance}),distance-.001,true,undefined,undefined,undefined,body,obstacle));
    }
    return Object.freeze({ ...carrier, accessible, positionMm: Object.freeze([position.x * 1000, position.y * 1000, position.z * 1000]) as FactoryVector,
      nativeMassKg: body.mass(), localCom: Object.freeze({ ...body.localCom() }), principalInertia: Object.freeze({ ...body.principalInertia() }) });
  };
  const requireCarrierWork = (id: string) => {
    if (!carrierWork || !carrier || carrier.transactionId !== id || recovery) reject("CarrierTransactionMismatch");
    const body = world.getRigidBody(carrier!.bodyHandle), work = carrierWork!, enabled = work.operation !== "release" && carrier!.phase !== "PreparedHeld";
    const deposition = work.previousCarrier !== undefined;
    const oldOthers = deposition ? { bodies: new Map([...work.before.bodies].filter(([handle]) => handle !== carrier!.bodyHandle)),
      colliders: new Map([...work.before.colliders].filter(([handle]) => !carrier!.colliderHandles.includes(handle))) } : work.before;
    const fixedExpected = work.operation === "release" ? work.previousCarrier?.phase === "Deposited" : deposition && carrier!.phase !== "PreparedHeld";
    if (!body || (fixedExpected ? !body.isFixed() : !body.isKinematic()) || body.isEnabled() !== enabled || bodyBytes(body, false) !== work.bodyBytes ||
      !carrier!.colliderHandles.every(handle => { const c = world.getCollider(handle), saved = carrierWork!.colliders.get(handle); return c === saved?.object && c.shape === saved.shape && c.isEnabled() === enabled && colliderBytes(c, false) === saved.bytes; }) ||
      world.bodies.len() !== oldOthers.bodies.size + 1 || world.colliders.len() !== oldOthers.colliders.size + 5 || !verifyOld(oldOthers)) hold();
    return carrierWork!;
  };
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
    world.intersectionsWithShape({x:center[0]!,y:center[1]!,z:center[2]!},{x:0,y:0,z:0,w:1},new R.Cuboid(extent[0]!,extent[1]!,extent[2]!),()=>{blocked=true;return false;},undefined,undefined,undefined,cargoBody,obstacle);return !blocked;
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
        accessible=!world.castRay(ray,Math.max(0,distance-.001),true,undefined,undefined,undefined,cargoBody,obstacle)&&currentCargoSupport()&&cargoClearance();}}
    return Object.freeze({ownerId:initialCargo.ownerId,containerId:initialCargo.containerId,sourceDigest:initialCargo.sourceDigest,profileDigest:initialCargo.profileDigest,opened:cargoOpened,positionMm:initialCargo.centerMm,accessBoundsMm:initialCargo.accessBoundsMm,bodyHandle:cargoBody.handle,colliderHandles:Object.freeze([cargoCollider.handle]),site:initialCargo,accessible,openReceipt:cargoOpenReceipt});
  };
  const rollback = (id: string): void => {
    const candidate = requirePending(id);
    const body = world.getRigidBody(candidate.owner.bodyHandle);
    if (body) world.removeRigidBody(body);
    if(candidate.consumedCarrier){const c=candidate.consumedCarrier;world.getRigidBody(c.bodyHandle).setEnabled(true);c.colliderHandles.forEach(handle=>world.getCollider(handle).setEnabled(true));}
    refresh();
    const before=candidate.originalMembers??candidate.before;
    if (world.bodies.len() !== before.bodies.size || world.colliders.len() !== before.colliders.size || !verifyOld(before)) hold();
    ownerMembers.delete(candidate.owner.instanceId);ownerProfiles.delete(candidate.owner.instanceId);
    owners = candidate.previousOwners; revision = candidate.previousRevision; pending = undefined;
  };
  return {
    get busy(): boolean { return !!pending || !!carrierWork || recovery; },
    read(): FactoryFacilityRead {
      const cargo=readCargo(), currentCarrier=readCarrier();
      // This map belongs to ONE synchronous observation. Every later Read
      // recomputes the actual current World/coverage/actor/LOS proofs.
      const partProofs=new Map<FactoryFacilityOwner,FactoryNativePartObservation>();
      const observeParts=(owner:FactoryFacilityOwner)=>{let proof=partProofs.get(owner);if(!proof){proof=partObservation(owner);partProofs.set(owner,proof);}return proof;};
      const proofs=new Map<FactoryFacilityOwner,ReturnType<typeof productionObservation>>();
      const observeProduction=(owner:FactoryFacilityOwner)=>{let proof=proofs.get(owner);if(!proof){proof=productionObservation(owner,observedDefinitions.has(owner.definitionRef.sourceId)?observeParts(owner):undefined);proofs.set(owner,proof);}return proof;};
      return Object.freeze({ ...(lastCarrierVeto?{lastCarrierVeto}:{}),partObservations:Object.freeze(owners.filter(owner=>observedDefinitions.has(owner.definitionRef.sourceId)).map(observeParts)),
        ...(pending&&observedDefinitions.has(pending.owner.definitionRef.sourceId)?{preparedPartObservation:partObservation(pending.owner,false,pending.state!=="PreparedHeld")}:{}),powerPorts:Object.freeze(owners.flatMap(owner=>powerSocketObservation(owner,()=>observeProduction(owner)))),production:Object.freeze(owners.filter(owner=>["B05","B06","B07"].includes(owner.definitionRef.sourceId)).map(observeProduction)),sources:Object.freeze(owners.flatMap(owner=>(owner.definitionRef.sourceId==="B09"?["storage"]:["B05","B06","B07"].includes(owner.definitionRef.sourceId)?["input","output","offcut"]:[]).map(role=>Object.freeze({containerId:`${role}_${owner.instanceId}`,instanceId:owner.instanceId,accessible:localSourceAccess(`${role}_${owner.instanceId}`,owner.instanceId,observedDefinitions.has(owner.definitionRef.sourceId)?observeParts(owner):undefined)})))), ...(cargo?{cargo}:{}), ...(currentCarrier?{carrier:currentCarrier}:{}), revision, state: recovery ? "RecoveryHold" : pending?.state ?? (carrierWork ? carrier!.phase as "PreparedHeld" | "CommittedHeld" | "PublishedHeld" : "Idle"), transactionId: pending?.owner.transactionId ?? (carrierWork ? carrier!.transactionId : null),
      owners, prepared: pending?.owner ?? null }); },
    openCargo(intent:FactoryCargoOpenIntent):FactoryFacilityRead{
      if(pending||carrierWork||recovery)reject("CargoBusy");
      const cargo=readCargo();if(cargoOpenReceipt&&canonicalJson(intent)===canonicalJson(cargoOpenReceipt)&&intent.expectedTerrainRevision===terrainRevision()){if(!cargo?.accessible)reject("CargoOutOfReach");return this.read();}
      if(!cargo||intent.ownerId!==cargo.ownerId||intent.profileDigest!==cargo.profileDigest||intent.expectedRevision!==revision||intent.expectedTerrainRevision!==terrainRevision())reject("CargoBindingMismatch");
      if(!cargo!.accessible)reject("CargoOutOfReach");
      if(!cargoOpened){cargoOpened=true;cargoOpenReceipt=Object.freeze({...intent});revision++;}return this.read();
    },
    preparePlayerMove(from: Readonly<{ x: number; y: number; z: number }>, to: Readonly<{ x: number; y: number; z: number }>): false | (() => void) {
      if (!carrier || carrier.phase !== "Carrying") return () => {};
      if (recovery || carrierWork || pending || !carrierDefinition) return false;
      const body = world.getRigidBody(carrier.bodyHandle), profile = carrierDefinition, actual = actorPosition();
      if (!body || !body.isKinematic() || !body.isEnabled() || !actual || Math.hypot(from.x - actual.x, from.y - actual.y, from.z - actual.z) > 1e-6) hold();
      const current = body.translation(), offset = profile.sizeMm[0] === 500 ? .75 : 1;
      if (Math.hypot(current.x - from.x, current.z - (from.z - offset)) > 1e-5) hold();
      const veto=(reason:string,details:Omit<FactoryCarrierVeto,"reason"|"targetMm">={})=>{lastCarrierVeto=Object.freeze({reason,targetMm:Object.freeze([to.x*1000,to.y*1000,to.z*1000]) as FactoryVector,...details});return false as const;};
      try {
        const pose = carrierPose(profile, to); assertCarrierClearance(profile, pose);
        const delta = { x: pose.x - current.x, y: pose.y - current.y, z: pose.z - current.z };
        if (Math.abs(delta.y) > .002) return veto("CarrierGroundHeight");
        for (const box of carrierBoxes(profile)) {
          const hit = world.castShape({ x: current.x + box.center.z, y: current.y + box.center.y, z: current.z - box.center.x }, body.rotation(), delta,
            new R.Cuboid(box.half.x - .0005, box.half.y - .0005, box.half.z - .0005), 1, true, undefined, undefined, undefined, undefined, obstacle);
          if (hit !== null) return veto("CarrierSweep",{colliderHandle:hit.collider.handle,colliderShapeType:hit.collider.shapeType(),timeOfImpact:hit.toi,colliderLocalNormal:Object.freeze({...hit.normal2})});
        }
        // Both next poses enter one subsequent private World.step; no pose or tick is changed by preparation.
        return () => { if(Math.hypot(to.x-from.x,to.z-from.z)>1e-6)lastCarrierVeto=undefined;body.setNextKinematicTranslation(pose); };
      } catch (error) {
        if (error instanceof Error && /^FactoryFacilityRejected:Carrier(?:Support|Coverage|Overlap)$/.test(error.message)) return veto(error.message.split(":")[1]!);
        throw error;
      }
    },
    prepareCarrierDeposit(request: FactoryCarrierRequest): FactoryFacilityRead {
      if (!safePaused() || recovery || pending || carrierWork || carrier?.phase !== "Carrying") reject("CarrierNotCarryingPaused");
      if (![request.transactionId, request.ownerId].every(isSaveSafeResourceId) || request.ownerId !== carrier!.ownerId || completed.has(request.transactionId)) reject("CarrierTransactionMismatch");
      if (request.expectedRevision !== revision || request.expectedTerrainRevision !== terrainRevision()) reject("StaleRevision");
      if (!request.materialBinding || request.materialBinding.length > 262144 || request.sourceContainerId!==carrier!.containerId || carrierProfile(request).digest !== carrier!.profileDigest) reject("CarrierProfileMismatch");
      const actor = actorPosition(); if (!actor || !carrierDefinition) reject("CarrierActorUnavailable");
      refresh(); const pose = carrierPose(carrierDefinition!, actor!); assertCarrierClearance(carrierDefinition!, pose);
      const original = readCarrier()!, body = world.getRigidBody(original.bodyHandle);
      if (Math.hypot(body.translation().x - pose.x, body.translation().y - pose.y, body.translation().z - pose.z) > .002) reject("CarrierPositionMismatch");
      const previousPose=Object.freeze({...body.translation()}),depositPose=carrierPose(carrierDefinition!,actor!,true);
      if(Math.abs(depositPose.y-previousPose.y)>.002)reject("CarrierGroundHeight");
      assertCarrierClearance(carrierDefinition!,depositPose);
      const delta={x:depositPose.x-previousPose.x,y:depositPose.y-previousPose.y,z:depositPose.z-previousPose.z};
      for(const box of carrierBoxes(carrierDefinition!)){
        const hit=world.castShape({x:previousPose.x+box.center.z,y:previousPose.y+box.center.y,z:previousPose.z-box.center.x},body.rotation(),delta,
          new R.Cuboid(box.half.x-.0005,box.half.y-.0005,box.half.z-.0005),1,true,undefined,undefined,undefined,undefined,obstacle);
        if(hit!==null)reject("CarrierSnapSweep");
      }
      const before = members(world);
      carrierWork = { request: Object.freeze({ ...request }), before, previousRevision: revision, previousCarrier: original,previousPose,depositPose,
        bodyBytes: bodyBytes(body, false), colliders: new Map(original.colliderHandles.map(handle => {
          const collider = world.getCollider(handle); return [handle, { object: collider, shape: collider.shape, bytes: colliderBytes(collider, false) }]; })) };
      body.setEnabled(false); original.colliderHandles.forEach(handle => world.getCollider(handle).setEnabled(false));
      carrier = Object.freeze({ ...original, transactionId: request.transactionId, phase: "PreparedHeld", materialBinding: request.materialBinding });
      refresh(); requireCarrierWork(request.transactionId); return this.read();
    },
    prepareCarrierRelease(request: FactoryCarrierRequest): FactoryFacilityRead {
      if (!safePaused() || recovery || pending || carrierWork || !carrier || !["Carrying","Deposited"].includes(carrier.phase)) reject("CarrierNotAvailablePaused");
      if (![request.transactionId,request.ownerId].every(isSaveSafeResourceId) || completed.has(request.transactionId) || request.ownerId !== carrier!.ownerId
        || request.sourceContainerId !== carrier!.containerId || carrierProfile(request).digest !== carrier!.profileDigest) reject("CarrierTransactionMismatch");
      if(request.expectedRevision!==revision||request.expectedTerrainRevision!==terrainRevision())reject("StaleRevision");
      // This is a bound Host custody receipt, not a second Resources authority.
      try { const empty=JSON.parse(request.emptyCustodyCanonicalJson??"null"), material=JSON.parse(request.materialBinding);
        if(!empty||canonicalJson(empty)!==request.emptyCustodyCanonicalJson||empty.containerId!==carrier!.containerId||!Array.isArray(empty.contents)||empty.contents.length
          ||!Array.isArray(material.containers)||!material.containers.some((c:{stateBytes?:string})=>c.stateBytes===request.emptyCustodyCanonicalJson))reject("CarrierCustodyNotEmpty");
      }catch{reject("CarrierCustodyNotEmpty");}
      const original=readCarrier()!,body=world.getRigidBody(original.bodyHandle),before=members(world);
      carrierWork={request:Object.freeze({...request}),before,previousRevision:revision,previousCarrier:original,operation:"release",bodyBytes:bodyBytes(body,false),
        colliders:new Map(original.colliderHandles.map(handle=>{const collider=world.getCollider(handle);return [handle,{object:collider,shape:collider.shape,bytes:colliderBytes(collider,false)}];}))};
      body.setEnabled(false);original.colliderHandles.forEach(handle=>world.getCollider(handle).setEnabled(false));
      carrier=Object.freeze({...original,transactionId:request.transactionId,phase:"PreparedHeld",materialBinding:request.materialBinding});refresh();requireCarrierWork(request.transactionId);return this.read();
    },
    prepareCarrier(request: FactoryCarrierRequest): FactoryFacilityRead {
      if (!safePaused() || recovery || pending || carrier || carrierWork) reject("CarrierNotIdlePaused");
      if (![request.transactionId, request.ownerId].every(isSaveSafeResourceId) || request.ownerId === initialCargo?.ownerId || owners.some(o => o.ownerId === request.ownerId) || completed.has(request.transactionId)) reject("InvalidOrDuplicateIdentity");
      if (request.expectedRevision !== revision || request.expectedTerrainRevision !== terrainRevision()) reject("StaleRevision");
      if (typeof request.materialBinding !== "string" || !request.materialBinding.length || request.materialBinding.length > 262144) reject("InvalidMaterialBinding");
      const source = readCargo();
      if (!(source?.opened && source.accessible && source.containerId === request.sourceContainerId && request.sourceInstanceId === undefined) &&
        !localSourceAccess(request.sourceContainerId, request.sourceInstanceId)) reject("CarrierSourceAccess");
      const profile = carrierProfile(request), actor = actorPosition(); if (!actor) reject("CarrierActorUnavailable");
      if(!isSaveSafeResourceId(request.custodyContainerId??`carrier_${request.transactionId}`))reject("InvalidCarrierCustodyId");
      let dynamic = 0; world.forEachRigidBody(body => { if (body.isDynamic()) dynamic++; });
      if (owners.length + (initialCargo ? 1 : 0) + 1 > 16 || world.bodies.len() + dormantBodies() + 1 > 64 || dynamic > 32 || world.colliders.len() + 5 > 4096) reject("CarrierBudgetExceeded");
      refresh(); const pose = carrierPose(profile, actor!); assertCarrierClearance(profile, pose);
      const before = members(world); let body: R.RigidBody | undefined;
      try {
        const mass = profile.massMg / 1_000_000, a = profile.sizeMm[0] / 1000, b = profile.sizeMm[1] / 1000, c = profile.sizeMm[2] / 1000;
        body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pose.x, pose.y, pose.z)
          .setRotation({ x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }).setEnabled(false)
          .setAdditionalMassProperties(mass, { x: 0, y: .75, z: 0 }, { x: mass * (b * b + c * c) / 12, y: mass * (a * a + c * c) / 12, z: mass * (a * a + b * b) / 12 }, { x: 0, y: 0, z: 0, w: 1 }));
        const handles = carrierBoxes(profile).map(box => world.createCollider(R.ColliderDesc.cuboid(box.half.x, box.half.y, box.half.z)
          .setTranslation(box.center.x, box.center.y, box.center.z).setDensity(0).setFriction(.8).setEnabled(false), body).handle);
        body.recomputeMassPropertiesFromColliders(); refresh();
        carrier = Object.freeze({ ownerId: request.ownerId, transactionId: request.transactionId, profileId: profile.profileId, profileDigest: profile.digest, phase: "PreparedHeld",
          containerId: request.custodyContainerId ?? `carrier_${request.transactionId}`,
          bodyHandle: body.handle, colliderHandles: Object.freeze(handles), massMg: profile.massMg, materialBinding: request.materialBinding,
          positionMm: Object.freeze([pose.x * 1000, pose.y * 1000, pose.z * 1000]) as FactoryVector,
          nativeMassKg: body.mass(), localCom: Object.freeze({ ...body.localCom() }), principalInertia: Object.freeze({ ...body.principalInertia() }) });
        carrierDefinition = profile;
        carrierWork = { request: Object.freeze({ ...request }), before, previousRevision: revision, bodyBytes: bodyBytes(body, false),
          colliders: new Map(handles.map(handle => { const collider = world.getCollider(handle); return [handle, { object: collider, shape: collider.shape, bytes: colliderBytes(collider, false) }]; })) };
        requireCarrierWork(request.transactionId);
      } catch (error) {
        if (body && world.getRigidBody(body.handle)) world.removeRigidBody(body); refresh(); carrier = undefined; carrierDefinition = undefined; carrierWork = undefined;
        if (world.bodies.len() !== before.bodies.size || world.colliders.len() !== before.colliders.size || !verifyOld(before)) hold(); throw error;
      }
      return this.read();
    },
    commitCarrier(id: string): FactoryFacilityRead {
      const work = requireCarrierWork(id); if (carrier!.phase !== "PreparedHeld") reject("WrongPhase");
      const body = world.getRigidBody(carrier!.bodyHandle);
      if (work.previousCarrier && work.operation !== "release") body.setBodyType(R.RigidBodyType.Fixed, false);
      if(work.depositPose)body.setTranslation(work.depositPose,false);
      if(work.operation!=="release"){body.setEnabled(true);carrier!.colliderHandles.forEach(handle=>world.getCollider(handle).setEnabled(true));}
      refresh();
      if (work.previousCarrier && work.operation !== "release") {
        work.bodyBytes = bodyBytes(body, false);
        work.colliders=new Map(carrier!.colliderHandles.map(handle=>{const collider=world.getCollider(handle);return [handle,{object:collider,shape:collider.shape,bytes:colliderBytes(collider,false)}];}));
      }
      carrier = Object.freeze({ ...carrier!, phase: "CommittedHeld" }); return this.read();
    },
    publishCarrier(id: string): FactoryFacilityRead {
      const work = requireCarrierWork(id); if (carrier!.phase !== "CommittedHeld") reject("WrongPhase");
      carrier = Object.freeze({ ...carrier!, phase: "PublishedHeld" }); revision = work.previousRevision + 1; return this.read();
    },
    finalizeCarrier(id: string): FactoryFacilityRead {
      const work = requireCarrierWork(id); if (carrier!.phase !== "PublishedHeld") reject("WrongPhase");
      if(work.operation==="release"){
        world.removeRigidBody(world.getRigidBody(carrier!.bodyHandle));refresh();
        const oldOthers={bodies:new Map([...work.before.bodies].filter(([handle])=>handle!==work.previousCarrier!.bodyHandle)),colliders:new Map([...work.before.colliders].filter(([handle])=>!work.previousCarrier!.colliderHandles.includes(handle)))};
        if(world.bodies.len()!==oldOthers.bodies.size||world.colliders.len()!==oldOthers.colliders.size||!verifyOld(oldOthers))hold();
        carrier=undefined;carrierDefinition=undefined;carrierWork=undefined;completed.add(id);return this.read();
      }
      carrier = Object.freeze({ ...carrier!, phase: work.previousCarrier ? "Deposited" : "Carrying" }); carrierWork = undefined; completed.add(id); return this.read();
    },
    rollbackCarrier(id: string): FactoryFacilityRead {
      const work = requireCarrierWork(id);
      if (work.previousCarrier) {
        const body = world.getRigidBody(carrier!.bodyHandle); body.setBodyType(work.previousCarrier.phase==="Deposited"?R.RigidBodyType.Fixed:R.RigidBodyType.KinematicPositionBased, false); body.setEnabled(true);
        if(work.previousPose){body.setTranslation(work.previousPose,false);body.setNextKinematicTranslation(work.previousPose);}
        carrier!.colliderHandles.forEach(handle => world.getCollider(handle).setEnabled(true)); refresh();
        if (world.bodies.len() !== work.before.bodies.size || world.colliders.len() !== work.before.colliders.size || !verifyOld(work.before)) hold();
        revision = work.previousRevision; carrier = work.previousCarrier; carrierWork = undefined; return this.read();
      }
      world.removeRigidBody(world.getRigidBody(carrier!.bodyHandle)); refresh();
      if (world.bodies.len() !== work.before.bodies.size || world.colliders.len() !== work.before.colliders.size || !verifyOld(work.before)) hold();
      revision = work.previousRevision; carrier = undefined; carrierDefinition = undefined; carrierWork = undefined; return this.read();
    },
    prepare(request: FactoryFacilityRequest): FactoryFacilityRead {
      if (recovery || pending || carrierWork || !safePaused()) reject("NotIdlePaused");
      if (![request.transactionId, request.ownerId, request.instanceId].every(isSaveSafeResourceId) || request.ownerId !== request.instanceId || request.ownerId===initialCargo?.ownerId || request.ownerId===carrier?.ownerId || completed.has(request.transactionId) || owners.some(value => value.ownerId === request.ownerId)) reject("InvalidOrDuplicateIdentity");
      if (request.expectedRevision !== revision || request.expectedTerrainRevision !== terrainRevision()) reject("StaleRevision");
      if (typeof request.materialBinding !== "string" || request.materialBinding.length < 1 || request.materialBinding.length > 262144 || request.centerMm.length !== 3 || !request.centerMm.every(v => Number.isSafeInteger(v) && v % 250 === 0) || !Number.isInteger(request.quarterTurns) || request.quarterTurns < 0 || request.quarterTurns > 3) reject("InvalidBindingOrFrame");
      const profile = createFactoryInstallationProfile(request.definitionRef.sourceId);
      if (canonicalJson(profile.definitionRef) !== canonicalJson(request.definitionRef) || (request.profileDigest !== undefined && request.profileDigest !== profile.profileDigest)) reject("DefinitionOrProfileMismatch");
      let consumedCarrier:FactoryNativeCarrierRead|undefined;
      if(request.consumedCustody){
        const c=readCarrier(),receipt=request.consumedCustody;
        if(!c||c.phase!=="Deposited"||!c.accessible||c.containerId!==receipt.containerId||!carrierDefinition
          ||canonicalJson(carrierDefinition.terms)!==canonicalJson(profile.bom)||c.massMg!==profile.massMg)reject("InstallCustodyMismatch");
        try{
          const material=JSON.parse(request.materialBinding),empty=JSON.parse(receipt.emptyCanonicalJson);
          const states=material.containers.map((container:{stateBytes:string})=>JSON.parse(container.stateBytes));
          const installed=states.find((state:{containerId:string})=>state.containerId===`installed_${request.instanceId}`);
          if(canonicalJson(empty)!==receipt.emptyCanonicalJson||empty.containerId!==c!.containerId||!Array.isArray(empty.contents)||empty.contents.length
            ||!material.containers.some((container:{stateBytes:string})=>container.stateBytes===receipt.emptyCanonicalJson)||!installed)reject("InstallCustodyNotConsumed");
          const quantities=new Map<string,number>();
          for(const stack of installed.contents){const item=handlingCatalog.items.find(i=>i.resourceId===stack.resourceId);if(!item||!Number.isSafeInteger(stack.quantity)||stack.quantity<=0)reject("InstallCustodyNotConsumed");quantities.set(item!.sourceId,(quantities.get(item!.sourceId)??0)+stack.quantity);}
          if(canonicalJson([...quantities].sort())!==canonicalJson(profile.bom.map(term=>[term.itemId,term.quantityUnits]).sort()))reject("InstallCustodyNotConsumed");
        }catch{reject("InstallCustodyNotConsumed");}
        consumedCarrier=c;
      }
      let dynamic = 0; world.forEachRigidBody(body => { if (body.isDynamic()) dynamic++; });
      if (owners.length+(initialCargo?1:0)+(carrier?1:0) >= 16 || world.bodies.len() + dormantBodies() + 1 > 64 || dynamic > 32 || world.colliders.len() + profile.colliders.length > 4096) reject("BudgetExceeded");
      // Only the completely consumed, bound paid depot is replaced. Every other member stays collidable.
      const originalMembers=consumedCarrier?members(world):undefined;
      if(consumedCarrier){world.getRigidBody(consumedCarrier.bodyHandle).setEnabled(false);consumedCarrier.colliderHandles.forEach(handle=>world.getCollider(handle).setEnabled(false));}
      const before = members(world), handles: number[] = [];
      let body: R.RigidBody | undefined;
      try {
      refresh();
      for(const box of profile.colliders){
        const center=transformFactoryPoint(box.centerMm,request.centerMm,request.quarterTurns),sy=Math.sin(request.quarterTurns*Math.PI/4),cy=Math.cos(request.quarterTurns*Math.PI/4),sz=Math.sin(box.rotationZRadians/2),cz=Math.cos(box.rotationZRadians/2);
        let blocked=false;
        world.intersectionsWithShape({x:center[0]/1000,y:center[1]/1000,z:center[2]/1000},{x:sy*sz,y:sy*cz,z:cy*sz,w:cy*cz},new R.Cuboid(Math.max(.0001,box.sizeMm[0]/2000-.0005),Math.max(.0001,box.sizeMm[1]/2000-.0005),Math.max(.0001,box.sizeMm[2]/2000-.0005)),()=>{blocked=true;return false;},undefined,undefined,undefined,undefined,collider=>collider.isEnabled());
        if(blocked)reject("NativeOverlap");
      }
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
          bodyHandle: body.handle, colliderHandles: Object.freeze(handles),installationRevision:revision+1 });
        refresh();const candidateColliders=new Map(handles.map(handle=>{const collider=world.getCollider(handle);return [handle,{object:collider,shape:collider.shape,bytes:colliderBytes(collider,false)}] as const;}));
        ownerMembers.set(owner.instanceId,{body,colliders:new Map(handles.map(handle=>[handle,world.getCollider(handle)]))});ownerProfiles.set(owner.instanceId,profile);
        pending = { owner, state: "PreparedHeld", before,...(originalMembers?{originalMembers,consumedCarrier}:{}),candidateBodyBytes:bodyBytes(body,false),candidateColliders, previousOwners: owners, previousRevision: revision };
        if (!verifyCandidate(pending)) hold();
      } catch (error) {
        if (body && world.getRigidBody(body.handle)) world.removeRigidBody(body);
        if(consumedCarrier){world.getRigidBody(consumedCarrier.bodyHandle).setEnabled(true);consumedCarrier.colliderHandles.forEach(handle=>world.getCollider(handle).setEnabled(true));}
        refresh();
        const expected=originalMembers??before;
        if (world.bodies.len() !== expected.bodies.size || world.colliders.len() !== expected.colliders.size || !verifyOld(expected)) hold();
        ownerMembers.delete(request.instanceId);ownerProfiles.delete(request.instanceId);
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
      if(candidate.consumedCarrier){
        const c=candidate.consumedCarrier,others={bodies:new Map([...candidate.before.bodies].filter(([handle])=>handle!==c.bodyHandle)),colliders:new Map([...candidate.before.colliders].filter(([handle])=>!c.colliderHandles.includes(handle)))};
        world.removeRigidBody(world.getRigidBody(c.bodyHandle));refresh();
        if(world.bodies.len()!==others.bodies.size+1||world.colliders.len()!==others.colliders.size+candidate.owner.colliderHandles.length||!verifyOld(others))hold();
        carrier=undefined;carrierDefinition=undefined;
      }
      completed.add(id); pending = undefined; return this.read();
    }
  };
};
