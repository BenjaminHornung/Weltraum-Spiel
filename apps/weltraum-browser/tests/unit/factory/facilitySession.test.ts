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
