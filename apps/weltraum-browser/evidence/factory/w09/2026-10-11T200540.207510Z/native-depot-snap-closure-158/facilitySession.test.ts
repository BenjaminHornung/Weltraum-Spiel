import {createFactoryInstallationProfile} from "../../../src/factory/construction/installationProfile";
import { beforeAll, describe, expect, it } from "vitest";
import { R, initializeHvpRapier } from "../../../src/hestia-prototype/physics/rapierPort";
import { createFactoryFacilitySession } from "../../../src/hestia-prototype/physics/factoryFacilitySession";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { createHvpPhysicsSession } from "../../../src/hestia-prototype/physics/session";
beforeAll(initializeHvpRapier);
const definition = createFp02Fixture("cargo").catalog.devices.find(d => d.sourceId === "B06")!;
const request = { transactionId: "native_cut_1", ownerId: "factory_cut_1", instanceId: "factory_cut_1", definitionRef: { sourceId: "B06", version: definition.version, digest: definition.digest }, expectedRevision: 0,
  expectedTerrainRevision: 0, materialBinding: "explicit-unit-BOM-binding-v1", centerMm: [-6250, 1500, 5000], quarterTurns: 1 };
describe("W07 actual native fixed Facility family", () => {
  it("stages disabled colliders in the SAME actualWorld, then commits/publishes/finalizes exact owner+members", () => {
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    try {
      const old = world.createRigidBody(R.RigidBodyDesc.dynamic()); const handle = old.handle;
      const facilities = createFactoryFacilitySession(world, () => true, () => 0);
      facilities.prepare(request);
      const prepared = facilities.read();
      expect(prepared.state).toBe("PreparedHeld"); expect(prepared.owners).toEqual([]);
      expect(world.bodies.len()).toBe(2); expect(world.getRigidBody(prepared.prepared!.bodyHandle).isEnabled()).toBe(false);
      facilities.commit(request.transactionId); expect(facilities.read().state).toBe("CommittedHeld");
      facilities.publish(request.transactionId); facilities.finalize(request.transactionId);
      const read = facilities.read(); expect(read.revision).toBe(1); expect(read.owners).toHaveLength(1);
      expect(read.owners[0]).toMatchObject({ ownerId: request.ownerId, massMg: 208_000_000 });
      expect(world.getRigidBody(handle)).toBe(old); expect(old.isDynamic()).toBe(true);
      expect(world.getRigidBody(read.owners[0].bodyHandle).isFixed()).toBe(true);
    } finally { world.free(); }
  });
  it("proves original member/handle identity after a committed candidate rollback", () => {
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    try {
      const old = world.createRigidBody(R.RigidBodyDesc.dynamic()), collider = world.createCollider(R.ColliderDesc.cuboid(.25,.25,.25), old);
      const facilities = createFactoryFacilitySession(world, () => true, () => 0);
      facilities.prepare(request); facilities.commit(request.transactionId); facilities.rollback(request.transactionId);
      expect(facilities.read()).toMatchObject({ state: "Idle", revision: 0, owners: [] });
      expect(world.bodies.len()).toBe(1); expect(world.colliders.len()).toBe(1);
      expect(world.getRigidBody(old.handle)).toBe(old); expect(world.getCollider(collider.handle)).toBe(collider);
    } finally { world.free(); }
  });
});


describe("W07 actual session hold boundary", () => {
  it("holds native ticks and every Resume/Play/Drop and legacy checkpoint across Facility prepare until proved rollback", async () => {
    const session = await createHvpPhysicsSession([], { x: 10, y: 4, z: 10 },undefined,undefined,undefined,undefined,undefined,undefined,undefined,true);
    try {
      session.pause(); const ticks = session.read().ticks;
      const factory = session as any; factory.prepareFactoryFacility(request);
      expect(factory.read().factoryFacilities.state).toBe("PreparedHeld");
      session.advance(1); expect(session.read().ticks).toBe(ticks);
      expect(() => session.resume()).toThrow(); expect(() => session.play()).toThrow(); expect(() => session.drop()).toThrow();
      expect(() => session.checkpoint()).toThrow();
      factory.rollbackFactoryFacility(request.transactionId);
      expect(factory.read().factoryFacilities.state).toBe("Idle"); expect(session.read().status).toBe("Paused");
      session.resume(); session.advance(1/60); expect(session.read().ticks).toBe(ticks+1);
    } finally { session.dispose(); }
  });
});


it("W07 Native rejects a current real collider in a Cutter foot BEFORE allocating any new member",()=>{
  const world=new R.World({x:0,y:-9.81,z:0});try{
    const old=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(-7,1.625,6.25));const collider=world.createCollider(R.ColliderDesc.cuboid(.1,.1,.1),old);world.updateSceneQueries();
    const facilities=createFactoryFacilitySession(world,()=>true,()=>0);
    expect(()=>facilities.prepare(request)).toThrow(/NativeOverlap/);
    expect(world.bodies.len()).toBe(1);expect(world.colliders.len()).toBe(1);expect(world.getRigidBody(old.handle)).toBe(old);expect(world.getCollider(collider.handle)).toBe(collider);
  }finally{world.free();}
});


import { createFactoryCargoSite } from "../../../src/factory/fixtures/cargoSite";
import { materializeFactoryStartSite } from "../../../src/factory/fixtures/startSite";
it("W07 source-Cargo Native disposal read never touches a freed World",async()=>{
 const site=createFactoryCargoSite(materializeFactoryStartSite());const ground={vertices:new Float32Array([-16,1.25,-16,-16,1.25,16,16,1.25,16,16,1.25,-16]),indices:new Uint32Array([0,1,2,0,2,3])};
 const session=await createHvpPhysicsSession([ground],{x:10,y:4,z:10},undefined,undefined,undefined,undefined,undefined,undefined,undefined,true,site);
 session.dispose();expect(()=>session.read()).not.toThrow();expect(session.read()).toMatchObject({status:"Disposed",bodyCount:0,colliderCount:0});
});
it.each(["shape","friction","extent"])("W07 full old native member proof detects %s mutation instead of claiming rollback",kind=>{
 const world=new R.World({x:0,y:-9.81,z:0});try{
  const old=world.createRigidBody(R.RigidBodyDesc.fixed()),collider=world.createCollider(R.ColliderDesc.cuboid(.25,.25,.25),old),facilities=createFactoryFacilitySession(world,()=>true,()=>0);
  facilities.prepare(request);if(kind==="shape")collider.setShape(new R.Cuboid(.5,.25,.25));else if(kind==="extent")collider.setHalfExtents({x:.5,y:.25,z:.25});else collider.setFriction(.01);
  expect(()=>facilities.rollback(request.transactionId)).toThrow(/RecoveryHold/);expect(facilities.read().state).toBe("RecoveryHold");
 }finally{world.free();}
});

it("W07 native candidate pose cannot silently change between disabled prepare and commit",()=>{
 const world=new R.World({x:0,y:-9.81,z:0});try{const facilities=createFactoryFacilitySession(world,()=>true,()=>0);facilities.prepare(request);world.getRigidBody(facilities.read().prepared!.bodyHandle).setTranslation({x:0,y:2,z:0},false);
 expect(()=>facilities.commit(request.transactionId)).toThrow(/RecoveryHold/);expect(facilities.read().state).toBe("RecoveryHold");}finally{world.free();}
});

it("W07 initial Cargo owner cannot be reused as a paid native Facility owner",()=>{
 const world=new R.World({x:0,y:-9.81,z:0});try{
  const site=createFactoryCargoSite(materializeFactoryStartSite());world.createCollider(R.ColliderDesc.cuboid(16,.125,16).setTranslation(0,1.125,0));world.updateSceneQueries();
  const facilities=createFactoryFacilitySession(world,()=>true,()=>0,()=>0,site),cargo=facilities.read().cargo!,before=[world.bodies.len(),world.colliders.len()];
  expect(()=>facilities.prepare({...request,ownerId:site.ownerId,instanceId:site.ownerId})).toThrow(/InvalidOrDuplicateIdentity/);
  expect([world.bodies.len(),world.colliders.len()]).toEqual(before);expect(facilities.read().cargo?.bodyHandle).toBe(cargo.bodyHandle);
 }finally{world.free();}
});
it("W07 direct Cargo dispose then checkpoint rejects before any freed-World read",async()=>{
 const site=createFactoryCargoSite(materializeFactoryStartSite()),ground={vertices:new Float32Array([-16,1.25,-16,-16,1.25,16,16,1.25,16,16,1.25,-16]),indices:new Uint32Array([0,1,2,0,2,3])};
 const session=await createHvpPhysicsSession([ground],{x:10,y:4,z:10},undefined,undefined,undefined,undefined,undefined,undefined,undefined,true,site);
 session.dispose();expect(()=>session.checkpoint()).toThrow("World checkpoint requires a confirmed paused generation");expect(session.read()).toMatchObject({status:"Disposed",bodyCount:0,colliderCount:0});
});

import { readCargoHandlingProfile } from "../../../src/factory/construction/cargoHandlingProfile";
import { createResourceContainerState } from "../../../src/resources/containers";
import { canonicalJson } from "../../../src/resources/serialization";
const carrierFixture = () => {
  // Explicit synthetic native floor. This verifies Rapier authority, not the actual D07 route.
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(R.ColliderDesc.cuboid(16, .125, 16).setTranslation(0, 1.125, 0));
  const site = createFactoryCargoSite(materializeFactoryStartSite());
  const actor = { x: -5.75, y: 2.17, z: 11.875 };
  const facilities = createFactoryFacilitySession(world, () => true, () => 0, () => 0, site, () => actor);
  const cargo = facilities.read().cargo!;
  facilities.openCargo({ ownerId: cargo.ownerId, profileDigest: cargo.profileDigest, expectedRevision: 0, expectedTerrainRevision: 0 });
  const profile = readCargoHandlingProfile(createFp02Fixture("cargo").catalog, "C27-PACK")!;
  const command = { transactionId: "carrier_former_1", ownerId: "factory_carrier", profileId: profile.profileId, profileDigest: profile.digest,
    expectedRevision: facilities.read().revision, expectedTerrainRevision: 0, sourceContainerId: site.containerId, materialBinding: "actual-unit-c27-custody-candidate" };
  return { world, facilities, command, cargo, actor };
};
describe("W09 actual Native closed depot frame",()=>{
 const carrying=()=>{
  const f=carrierFixture();f.actor.x=-5.72;f.actor.z=11.83;
  f.facilities.prepareCarrier(f.command);f.facilities.commitCarrier(f.command.transactionId);f.facilities.publishCarrier(f.command.transactionId);f.facilities.finalizeCarrier(f.command.transactionId);
  const original=f.facilities.read().carrier!;
  return {...f,original,deposit:{...f.command,transactionId:"native_snap_depot",sourceContainerId:original.containerId,expectedRevision:f.facilities.read().revision,materialBinding:"declared-unit-same-whole-c27-custody"}};
 };
 it("snaps the same fixed depot to250mm and rollback restores its exact off-grid carrying pose and300kg mass",()=>{
  const {world,facilities,deposit,original}=carrying();try{
   const body=world.getRigidBody(original.bodyHandle),before={...body.translation()},counts=[world.bodies.len(),world.colliders.len()];
   facilities.prepareCarrierDeposit(deposit);facilities.commitCarrier(deposit.transactionId);
   expect(body.translation().x).toBeCloseTo(-5.75,5);expect(body.translation().z).toBeCloseTo(10.75,5);expect(body.translation().y).toBeCloseTo(before.y,6);expect(body.mass()).toBeCloseTo(300,5);expect(body.isFixed()).toBe(true);
   facilities.rollbackCarrier(deposit.transactionId);expect(body.translation()).toEqual(before);expect(body.isKinematic()).toBe(true);expect(facilities.read().carrier?.phase).toBe("Carrying");expect([world.bodies.len(),world.colliders.len()]).toEqual(counts);
   facilities.prepareCarrierDeposit(deposit);facilities.commitCarrier(deposit.transactionId);facilities.publishCarrier(deposit.transactionId);facilities.finalizeCarrier(deposit.transactionId);expect(facilities.read().carrier).toMatchObject({phase:"Deposited",massMg:300000000,bodyHandle:original.bodyHandle});
  }finally{world.free();}
 });
 it("rejects a foreign custody source before disabling the actual carrying owner",()=>{
  const {world,facilities,deposit,original}=carrying();try{
   const before=[world.bodies.len(),world.colliders.len()],body=world.getRigidBody(original.bodyHandle),pose={...body.translation()};
   expect(()=>facilities.prepareCarrierDeposit({...deposit,sourceContainerId:"foreign_custody"})).toThrow(/CarrierProfileMismatch/);
   expect(body.isEnabled()).toBe(true);expect(body.translation()).toEqual(pose);expect(facilities.read().carrier?.phase).toBe("Carrying");expect([world.bodies.len(),world.colliders.len()]).toEqual(before);
  }finally{world.free();}
 });
 it("checks the actual diagonal snap sweep even when both payload endpoints are clear",()=>{
  const {world,facilities,deposit,original}=carrying();try{
   const p=world.getRigidBody(original.bodyHandle).translation();
   // Tiny synthetic corner obstacle is outside both endpoint hulls, but inside
   // the diagonal motion's swept corner. No D07 Source claim.
   world.createCollider(R.ColliderDesc.cuboid(.003,.1,.003).setTranslation(p.x+.735,p.y+.75,p.z-.54));world.updateSceneQueries();
   const before=[world.bodies.len(),world.colliders.len()];
   expect(()=>facilities.prepareCarrierDeposit(deposit)).toThrow(/CarrierSnapSweep/);expect(facilities.read().carrier?.phase).toBe("Carrying");expect([world.bodies.len(),world.colliders.len()]).toEqual(before);
  }finally{world.free();}
 });
});
describe("W09 paid SAME-world Native carrier", () => {
  it("consumes one paid local Former BOM depot atomically into the fixed machine and restores all original members on rollback",()=>{
    const {world,facilities,command,actor}=carrierFixture();try{
      const catalog=createFp02Fixture("cargo").catalog,profile=readCargoHandlingProfile(catalog,"B07-BOM")!;
      const pickup={...command,profileId:profile.profileId,profileDigest:profile.digest};
      facilities.prepareCarrier(pickup);facilities.commitCarrier(pickup.transactionId);facilities.publishCarrier(pickup.transactionId);facilities.finalizeCarrier(pickup.transactionId);
      const c=facilities.read().carrier!;
      // Synthetic empty-floor relocation uses the real paired sweep and one actual World step.
      const next={x:-6.25,y:actor.y,z:-1.5},move=facilities.preparePlayerMove(actor,next);expect(typeof move).toBe("function");if(move===false)return;move();world.step();Object.assign(actor,next);
      const deposit={...pickup,transactionId:"deposit_former_bom",sourceContainerId:c.containerId,expectedRevision:facilities.read().revision};
      facilities.prepareCarrierDeposit(deposit);facilities.commitCarrier(deposit.transactionId);facilities.publishCarrier(deposit.transactionId);facilities.finalizeCarrier(deposit.transactionId);
      const fixed=facilities.read().carrier!,before=[world.bodies.len(),world.colliders.len()],body=world.getRigidBody(fixed.bodyHandle);
      const empty=createResourceContainerState({containerId:c.containerId,ownerId:"fp02_wreck_owner",contents:[]},catalog.resources);
      const cargo=createFp02Fixture("cargo").resourceState;
      const installed=createResourceContainerState({containerId:"installed_local_former",ownerId:"fp02_wreck_owner",contents:profile.terms.map((term,i)=>{
        const item=catalog.items.find(item=>item.sourceId===term.itemId)!,source=cargo.contents.find(stack=>stack.resourceId===item.resourceId)!;return {...source,stackId:`paid_former_${i}`,quantity:term.quantityUnits};})},catalog.resources);
      const p=createFactoryInstallationProfile("B07"),center=fixed.positionMm;
      actor.x=center[0]/1000+2;actor.z=center[2]/1000;
      const build={transactionId:"consume_paid_former",ownerId:"local_former",instanceId:"local_former",definitionRef:p.definitionRef,profileDigest:p.profileDigest,expectedRevision:facilities.read().revision,expectedTerrainRevision:0,centerMm:center.map(v=>Math.round(v/250)*250),quarterTurns:1,
        materialBinding:canonicalJson({containers:[{stateBytes:empty.canonicalJson},{stateBytes:installed.canonicalJson}]}),consumedCustody:{containerId:c.containerId,emptyCanonicalJson:empty.canonicalJson}};
      let error:unknown;try{facilities.prepare(build);}catch(cause){error=cause;}expect(error).toBeUndefined();
      facilities.commit(build.transactionId);facilities.rollback(build.transactionId);
      expect(facilities.read().carrier?.bodyHandle).toBe(fixed.bodyHandle);expect(body.isFixed()).toBe(true);expect(body.isEnabled()).toBe(true);expect(fixed.colliderHandles.every(h=>world.getCollider(h).isEnabled())).toBe(true);expect([world.bodies.len(),world.colliders.len()]).toEqual(before);
      facilities.prepare(build);facilities.commit(build.transactionId);facilities.publish(build.transactionId);facilities.finalize(build.transactionId);
      expect(facilities.read().carrier).toBeUndefined();expect(facilities.read().owners).toHaveLength(1);expect(facilities.read().owners[0]?.massMg).toBe(341000000);expect([world.bodies.len(),world.colliders.len()]).toEqual([before[0],before[1]-5+p.colliders.length]);
    }finally{world.free();}
  });
  it("keeps the sole depot slot occupied until an exact empty-custody receipt releases all five colliders, then permits reuse", () => {
    const {world,facilities,command}=carrierFixture();try{
      const before=[world.bodies.len(),world.colliders.len()];facilities.prepareCarrier(command);facilities.commitCarrier(command.transactionId);facilities.publishCarrier(command.transactionId);facilities.finalizeCarrier(command.transactionId);
      const carrier=facilities.read().carrier!,catalog=createFp02Fixture("cargo").catalog;
      const empty=createResourceContainerState({containerId:carrier.containerId,ownerId:"fp02_wreck_owner",contents:[]},catalog.resources);
      const release={...command,transactionId:"release_full_custody",sourceContainerId:carrier.containerId,expectedRevision:facilities.read().revision,
        emptyCustodyCanonicalJson:empty.canonicalJson,materialBinding:canonicalJson({containers:[{stateBytes:empty.canonicalJson}]})};
      facilities.prepareCarrierRelease(release);expect(facilities.read().carrier?.phase).toBe("PreparedHeld");
      facilities.commitCarrier(release.transactionId);facilities.rollbackCarrier(release.transactionId);expect(facilities.read().carrier?.bodyHandle).toBe(carrier.bodyHandle);
      facilities.prepareCarrierRelease(release);facilities.commitCarrier(release.transactionId);facilities.publishCarrier(release.transactionId);facilities.finalizeCarrier(release.transactionId);
      expect(facilities.read().carrier).toBeUndefined();expect([world.bodies.len(),world.colliders.len()]).toEqual(before);
      facilities.prepareCarrier({...command,transactionId:"next_payload",expectedRevision:facilities.read().revision});expect(facilities.read().carrier?.phase).toBe("PreparedHeld");facilities.rollbackCarrier("next_payload");
    }finally{world.free();}
  });
  it("picks up fresh stock only from the actual reachable installed output owner and rejects its remote or forged endpoint", () => {
    const { world, facilities, command, actor } = carrierFixture();
    try {
      const machine = { ...request, centerMm: [-6250, 1250, 5000], expectedRevision: facilities.read().revision };
      facilities.prepare(machine); facilities.commit(machine.transactionId); facilities.publish(machine.transactionId); facilities.finalize(machine.transactionId);
      actor.x = -4.25; actor.z = 5;
      const profile = readCargoHandlingProfile(createFp02Fixture("cargo").catalog, "RAW8")!;
      const pickup = { ...command, transactionId: "local_output_pickup", profileId: profile.profileId, profileDigest: profile.digest,
        sourceContainerId: `output_${machine.instanceId}`, sourceInstanceId: machine.instanceId, expectedRevision: facilities.read().revision };
      let rejected: unknown; try { facilities.prepareCarrier(pickup); } catch (error) { rejected = error; }
      expect(rejected).toBeUndefined(); expect(facilities.read().carrier?.phase).toBe("PreparedHeld");
      facilities.rollbackCarrier(pickup.transactionId);
      expect(() => facilities.prepareCarrier({ ...pickup, sourceContainerId: "output_foreign_machine" })).toThrow(/CarrierSourceAccess/);
      actor.x = 8;
      expect(() => facilities.prepareCarrier(pickup)).toThrow(/CarrierSourceAccess/);
    } finally { world.free(); }
  });
  it("deposits the same paid carrier as one fixed local owner, and rollback restores the exact carrying membership", () => {
    const { world, facilities, command, actor } = carrierFixture();
    try {
      facilities.prepareCarrier(command); facilities.commitCarrier(command.transactionId); facilities.publishCarrier(command.transactionId); facilities.finalizeCarrier(command.transactionId);
      const original = facilities.read().carrier!, body = world.getRigidBody(original.bodyHandle), counts = [world.bodies.len(), world.colliders.len()];
      const deposit = { ...command, transactionId: "local_deposit_1", expectedRevision: facilities.read().revision, sourceContainerId: original.containerId, materialBinding: "actual-unit-same-c27-local-custody" };
      const prepare = facilities.prepareCarrierDeposit;
      prepare.call(facilities, deposit); expect(facilities.read().carrier?.phase).toBe("PreparedHeld"); facilities.commitCarrier(deposit.transactionId);
      expect(body.isFixed()).toBe(true); expect([world.bodies.len(), world.colliders.len()]).toEqual(counts);
      facilities.rollbackCarrier(deposit.transactionId);
      expect(facilities.read().carrier).toMatchObject({ phase: "Carrying", bodyHandle: original.bodyHandle, transactionId: original.transactionId, massMg: 300_000_000 });
      expect(body.isKinematic()).toBe(true); expect(body.isEnabled()).toBe(true);
      prepare.call(facilities, deposit); facilities.commitCarrier(deposit.transactionId); facilities.publishCarrier(deposit.transactionId); facilities.finalizeCarrier(deposit.transactionId);
      const fixed = facilities.read().carrier!;
      expect(fixed.phase).toBe("Deposited"); expect(fixed.bodyHandle).toBe(original.bodyHandle); expect(fixed.colliderHandles).toEqual(original.colliderHandles);
      expect(body.isFixed()).toBe(true); expect(body.mass()).toBeCloseTo(300, 5);
      expect(fixed.accessible).toBe(true);
      const losBlock=world.createCollider(R.ColliderDesc.cuboid(.2,.6,.05).setTranslation(actor.x,2.05,actor.z-.325));world.updateSceneQueries();
      expect(facilities.read().carrier!.accessible).toBe(false);world.removeCollider(losBlock,false);world.updateSceneQueries();
      expect(facilities.read().carrier!.accessible).toBe(true);
      const actualX=actor.x;actor.x+=10;expect(facilities.read().carrier!.accessible).toBe(false);actor.x=actualX;

      expect(() => facilities.prepareCarrier({ ...command, transactionId: "illegal_second_payload", expectedRevision: facilities.read().revision })).toThrow(/CarrierNotIdlePaused/);
      actor.x += .1; expect(facilities.preparePlayerMove({ ...actor, x: actor.x - .1 }, actor)).not.toBe(false);
      expect(body.translation().x).toBe(original.positionMm[0] / 1000);
    } finally { world.free(); }
  });
  it("prepares exactly one disabled kinematic carrier with five colliders and real 300kg mass, then rolls back every old native member", () => {
    const { world, facilities, command, cargo } = carrierFixture();
    try {
      const before = [world.bodies.len(), world.colliders.len()];
      facilities.prepareCarrier(command); const carrier = facilities.read().carrier;
      expect(carrier?.phase).toBe("PreparedHeld"); if (!carrier) return;
      const body = world.getRigidBody(carrier.bodyHandle);
      expect(body.isKinematic()).toBe(true); expect(body.isEnabled()).toBe(false);
      expect(carrier.colliderHandles).toHaveLength(5); expect(world.bodies.len()).toBe(before[0]! + 1); expect(world.colliders.len()).toBe(before[1]! + 5);
      expect(body.mass()).toBeCloseTo(300, 5); expect(body.localCom()).toMatchObject({ x: 0, y: .75, z: 0 });
      const inertia = body.principalInertia();
      for (const [actual, expected] of [[inertia.x, 81.25], [inertia.y, 81.25], [inertia.z, 50]]) {
        const twoUlp32 = 2 * 2 ** (Math.floor(Math.log2(expected!)) - 23);
        expect(Math.abs(actual! - expected!)).toBeLessThanOrEqual(Math.max(1e-6, twoUlp32));
      }
      facilities.commitCarrier(command.transactionId); expect(body.isEnabled()).toBe(true);
      facilities.rollbackCarrier(command.transactionId);
      expect(facilities.read().carrier).toBeUndefined(); expect([world.bodies.len(), world.colliders.len()]).toEqual(before);
      expect(world.getRigidBody(cargo.bodyHandle).isFixed()).toBe(true); expect(facilities.read().cargo!.opened).toBe(true);
    } finally { world.free(); }
  });
  it("rejects a foreign kinematic collider in the actual payload hull before allocation", () => {
    const { world, facilities, command } = carrierFixture();
    try {
      const blocker = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(-5.75, 2, 10.875));
      world.createCollider(R.ColliderDesc.cuboid(.1, .1, .1), blocker); world.updateSceneQueries();
      const before = [world.bodies.len(), world.colliders.len()];
      expect(() => facilities.prepareCarrier(command)).toThrow(/CarrierOverlap/);
      expect([world.bodies.len(), world.colliders.len()]).toEqual(before);
    } finally { world.free(); }
  });
  it("checks all four actual footprint support patches before allocating a suspended payload", () => {
    const { world, facilities, command } = carrierFixture();
    try {
      // Remove only the declared synthetic ground; Cargo support was checked at initialization.
      const ground = world.getCollider(0); world.removeCollider(ground, false); world.updateSceneQueries();
      const before = [world.bodies.len(), world.colliders.len()];
      expect(() => facilities.prepareCarrier(command)).toThrow(/CarrierSupport/);
      expect([world.bodies.len(), world.colliders.len()]).toEqual(before);
    } finally { world.free(); }
  });
});

it("W09 rejects inner support pads that leave the outer half of each complete 125mm foot unsupported", () => {
  const { world, facilities, command } = carrierFixture();
  try {
    world.removeCollider(world.getCollider(0), false);
    for (const x of [-6, -5.5]) for (const z of [10.625, 11.125]) world.createCollider(R.ColliderDesc.cuboid(.032, .125, .032).setTranslation(x, 1.125, z));
    world.createCollider(R.ColliderDesc.cuboid(.032, .125, .032).setTranslation(-5.75, 1.125, 10.875)); world.updateSceneQueries();
    const before = [world.bodies.len(), world.colliders.len()];
    expect(() => facilities.prepareCarrier(command)).toThrow(/CarrierSupport/);
    expect([world.bodies.len(), world.colliders.len()]).toEqual(before);
  } finally { world.free(); }
});
it("W09 excludes the existing carrier identity from paid fixed Facility ownership before allocation", () => {
  const { world, facilities, command } = carrierFixture();
  try {
    facilities.prepareCarrier(command); facilities.commitCarrier(command.transactionId); facilities.publishCarrier(command.transactionId); facilities.finalizeCarrier(command.transactionId);
    const before = [world.bodies.len(), world.colliders.len()];
    expect(() => facilities.prepare({ ...request, ownerId: command.ownerId, instanceId: command.ownerId, expectedRevision: facilities.read().revision, centerMm: [-12000, 1500, 5000] })).toThrow(/InvalidOrDuplicateIdentity/);
    expect([world.bodies.len(), world.colliders.len()]).toEqual(before);
  } finally { world.free(); }
});

it("admits source-bound paid B05 bench, B09 bin and REC05 brace as closed installation profiles with real support surfaces",()=>{
 for(const [id,mass] of [["B05",40000000],["B09",60000000],["fp02.comp.small_brace",5800000]] as const){
  let profile:ReturnType<typeof createFactoryInstallationProfile>|undefined;
  expect(()=>{profile=createFactoryInstallationProfile(id);}).not.toThrow();
  expect(profile!.massMg).toBe(mass);expect(profile!.supportPatchesMm.length).toBeGreaterThan(0);expect(profile!.colliders.length).toBeGreaterThan(0);
  expect(profile!.source.sourceRefs.some(ref=>ref.includes("technical-s0"))).toBe(true);
 }
});

it("W09 admits exactly four paid C14 metres and one finite C23 drive as one supported fixed belt owner",()=>{
 let profile:ReturnType<typeof createFactoryInstallationProfile>|undefined;
 expect(()=>{profile=createFactoryInstallationProfile("fp06.line.belt_4m");}).not.toThrow();
 expect(profile!.massMg).toBe(26000000);
 expect(profile!.bom).toEqual([{itemId:"fp02.comp.belt_module",quantityUnits:4},{itemId:"fp02.comp.belt_drive",quantityUnits:1}]);
 expect(profile!.supportPatchesMm).toHaveLength(4);
 const world=new R.World({x:0,y:-9.81,z:0});try{
  // Explicit synthetic unit floor: D07 source terrain admission is a separate gate.
  const ground=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,1.25,0));world.createCollider(R.ColliderDesc.cuboid(8,.25,8),ground);world.updateSceneQueries();
  const facilities=createFactoryFacilitySession(world,()=>true,()=>0),id="paid_belt_native";
  facilities.prepare({transactionId:id,ownerId:id,instanceId:id,definitionRef:profile!.definitionRef,profileDigest:profile!.profileDigest,expectedRevision:0,expectedTerrainRevision:0,materialBinding:"explicit-unit-paid-four-C14-one-C23",centerMm:[0,1500,0],quarterTurns:1});
  facilities.commit(id);facilities.publish(id);facilities.finalize(id);
  const read=facilities.read(),owner=read.owners[0]!;
  expect(owner).toMatchObject({massMg:26000000,definitionRef:profile!.definitionRef});expect(world.getRigidBody(owner.bodyHandle).isFixed()).toBe(true);
  expect(read.powerPorts?.find(p=>p.instanceId===id)).toMatchObject({role:"PowerConsumer",confirmed:true});
 }finally{world.free();}
});

it("W09 publishes the actual paired Native carrier veto without moving poses or members and clears it only on adopted movement",()=>{
 const {world,facilities,command,actor}=carrierFixture();try{
  facilities.prepareCarrier(command);facilities.commitCarrier(command.transactionId);facilities.publishCarrier(command.transactionId);facilities.finalizeCarrier(command.transactionId);
  const blocker=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(-6.75,2,10.875));world.createCollider(R.ColliderDesc.cuboid(.1,.1,.1),blocker);world.updateSceneQueries();
  const carrier=facilities.read().carrier!,body=world.getRigidBody(carrier.bodyHandle),pose={...body.translation()},members=[world.bodies.len(),world.colliders.len()];
  const target={...actor,x:-6.75};expect(facilities.preparePlayerMove(actor,target)).toBe(false);
  expect((facilities.read() as any).lastCarrierVeto).toMatchObject({reason:"CarrierOverlap",targetMm:[-6750,actor.y*1000,11875]});
  expect(body.translation()).toEqual(pose);expect([world.bodies.len(),world.colliders.len()]).toEqual(members);
  const neutral=facilities.preparePlayerMove(actor,actor);expect(typeof neutral).toBe("function");if(neutral!==false)neutral();expect((facilities.read() as any).lastCarrierVeto).toBeDefined();
  world.removeRigidBody(blocker);world.updateSceneQueries();const move=facilities.preparePlayerMove(actor,target);expect(typeof move).toBe("function");if(move===false)return;
  expect((facilities.read() as any).lastCarrierVeto).toBeDefined();move();world.step();Object.assign(actor,target);expect((facilities.read() as any).lastCarrierVeto).toBeUndefined();
 }finally{world.free();}
});

it("W09 production observation proves actual support coverage and clear service independently of immutable paid ownership",()=>{
 const world=new R.World({x:0,y:-9.81,z:0});let covered=true;
 try{
  // Declared synthetic ground: this exercises real Native queries, not the approved D07 terrain route.
  const ground=world.createCollider(R.ColliderDesc.cuboid(16,.125,16).setTranslation(0,1.375,0));world.updateSceneQueries();
  const facilities=createFactoryFacilitySession(world,()=>true,()=>0,()=>4,undefined,()=>({x:-4.75,y:2.4,z:6}),()=>undefined,()=>covered);
  facilities.prepare({...request,expectedTerrainRevision:4});facilities.commit(request.transactionId);facilities.publish(request.transactionId);facilities.finalize(request.transactionId);
  const owner=facilities.read().owners[0]!,observation=()=>((facilities.read() as any).production??[]).find((o:any)=>o.instanceId===owner.instanceId);
  expect(observation()).toMatchObject({profileDigest:owner.profileDigest,sourceDigest:owner.sourceDigest,terrainRevision:4,facilityRevision:1,installationRevision:1,confirmed:true,supported:true,serviceClear:true,sweepClear:true,accessible:true});
  const installedBytes=canonicalJson(owner),members=[world.bodies.len(),world.colliders.len()];
  ground.setEnabled(false);world.updateSceneQueries();expect(observation().supported).toBe(false);ground.setEnabled(true);world.updateSceneQueries();
  const blocker=world.createCollider(R.ColliderDesc.cuboid(.1,.1,.1).setTranslation(-4.75,2.4,5));world.updateSceneQueries();expect(observation().serviceClear).toBe(false);world.removeCollider(blocker,false);world.updateSceneQueries();
  covered=false;expect(observation().supported).toBe(false);covered=true;expect(observation().supported).toBe(true);
  expect(canonicalJson(facilities.read().owners[0])).toBe(installedBytes);expect([world.bodies.len(),world.colliders.len()]).toEqual(members);
 }finally{world.free();}
});

it("W09 electrical socket is bound to the actual Fixed Native owner pose and current actor LOS",()=>{
 const world=new R.World({x:0,y:-9.81,z:0});let actor={x:-.5,y:2.5,z:2};
 try{
  world.createCollider(R.ColliderDesc.cuboid(16,.125,16).setTranslation(0,1.375,0));world.updateSceneQueries();
  const profile=createFactoryInstallationProfile("fp02.device.battery_4kwh"),facilities=createFactoryFacilitySession(world,()=>true,()=>0,()=>2,undefined,()=>actor);
  const req={...request,transactionId:"paid_battery",instanceId:"battery",ownerId:"battery",definitionRef:profile.definitionRef,centerMm:[-1000,1500,0],quarterTurns:1,expectedTerrainRevision:2};
  facilities.prepare(req);facilities.commit(req.transactionId);facilities.publish(req.transactionId);facilities.finalize(req.transactionId);
  const socket=()=>((facilities.read() as any).powerPorts??[]).find((p:any)=>p.portId==="power_battery");
  expect(socket()).toMatchObject({instanceId:"battery",portId:"power_battery",sourcePortId:"fp02.device.battery_4kwh:POWER",positionMm:[-500,2500,0],outwardNormal:[1,0,0],profileDigest:profile.profileDigest,sourceDigest:profile.sourceDigest,installationRevision:1,terrainRevision:2,facilityRevision:1,confirmed:true,accessible:true});
  const blocker=world.createCollider(R.ColliderDesc.cuboid(.125,.125,.125).setTranslation(-.5,2.5,1));world.updateSceneQueries();expect(socket().accessible).toBe(false);world.removeCollider(blocker,false);world.updateSceneQueries();
  actor={x:5,y:2.5,z:0};expect(socket().accessible).toBe(false);actor={x:-.5,y:2.5,z:2};
  world.getRigidBody(facilities.read().owners[0]!.bodyHandle).setEnabled(false);world.updateSceneQueries();expect(socket().confirmed).toBe(false);
 }finally{world.free();}
});
