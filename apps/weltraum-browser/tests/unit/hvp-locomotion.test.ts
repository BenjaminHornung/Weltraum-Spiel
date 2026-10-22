import { beforeAll, describe, expect, it } from "vitest";
import { R, initializeHvpRapier } from "../../src/hestia-prototype/physics/rapierPort";
import { createHvpLocomotion, HVP_PLAYER_PROFILE } from "../../src/hestia-prototype/player/locomotion";
import { collisionSectors } from "../../src/hestia-prototype/physics/terrainColliders";

beforeAll(() => initializeHvpRapier());

const rig = (ground = true, covered = (_x: number, _z: number) => true) => {
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  if (ground) { world.createCollider(R.ColliderDesc.cuboid(10, 0.5, 10).setTranslation(0, -0.5, 0)); }
  const player = createHvpLocomotion(world, { x: 0, y: 0.92, z: 0 }, 9.81, covered);
  const ticks = (n: number) => { for (let i = 0; i < n; i += 1) { player.step(); world.step(); } };
  const dispose = () => { player.dispose(); world.free(); };
  player.setEnabled(true); ticks(10);
  return { world, player, ticks, dispose };
};
const groundedCheckpoint=(world:R.World)=>{
  const player=createHvpLocomotion(world,{x:0,y:.92,z:0},9.81,()=>true);player.setEnabled(true);
  for(let i=0;i<10;i++){player.step();world.step();}
  player.setEnabled(false);const saved=player.checkpoint();player.dispose();return saved;
};

describe("HVP solver-owned locomotion", () => {
  it("preserves vertical motion when pausing and restores it in a fresh neutral-input capsule", () => {
    const r=rig(false);
    try {
      const falling=r.player.read();expect(falling.velocityY).toBeLessThan(-1);
      r.player.setEnabled(false);
      expect(r.player.read().velocityY).toBe(falling.velocityY);
      const saved=JSON.parse(JSON.stringify(r.player.checkpoint()));
      const fresh=new R.World({x:0,y:-9.81,z:0});fresh.timestep=1/60;
      try {
        const player=createHvpLocomotion(fresh,saved.position,9.81,()=>true,saved);
        expect(player.read()).toMatchObject({position:falling.position,velocityY:falling.velocityY,grounded:false,status:"Inspection"});
        player.setEnabled(true);player.step();fresh.step();
        expect(player.read().velocityY).toBeCloseTo(falling.velocityY-9.81/60,10);
        expect(player.read().position.y).toBeLessThan(falling.position.y);
        expect(player.read().position.x).toBe(falling.position.x);
        player.dispose();
      } finally {fresh.free();}
    } finally {r.dispose();}
  });
  it.each([false,true])("keeps dynamic solids in collision queries but excludes sensors (sensor: %s)",sensor=>{
    const r=rig();
    try {
      const obstacle=r.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,1,-2).lockTranslations().lockRotations());
      r.world.createCollider(R.ColliderDesc.cuboid(.5,1,.25).setSensor(sensor),obstacle);r.world.step();
      expect(obstacle.isDynamic()).toBe(true);
      r.player.setInput({x:0,z:-1,sprint:false,jump:false});r.ticks(60);
      if(sensor) { expect(r.player.read().position.z).toBeLessThan(-2.9); }
      else { expect(r.player.read().position.z).toBeGreaterThan(-1.5); }
    } finally { r.dispose(); }
  });
  it.each([1, 2, 4])("walks canonical trimesh stairs with %i-voxel treads without jumping", tread => {
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    const source = { sizeX: 16, sizeY: 16, sizeZ: 64, cellMeters: 0.125,
      originMeters: { x: -1, y: -0.125, z: -6 },
      readSlot: (_x: number, y: number, z: number) => y <= Math.min(8, Math.max(0, Math.floor((40 - z) / tread))) ? 1 : 0 };
    const player = createHvpLocomotion(world, { x: 0, y: 0.92, z: 0 }, 9.81, () => true);
    try {
      for (const s of collisionSectors(source)) { world.createCollider(R.ColliderDesc.trimesh(s.vertices, s.indices)); }
      world.timestep = 1 / 60; world.step(); player.setEnabled(true);
      for (let i = 0; i < 10; i += 1) { player.step(); world.step(); }
      player.setInput({ x: 0, z: -1, sprint: false, jump: false });
      for (let i = 0; i < 100; i += 1) { player.step(); world.step(); }
      expect(player.read().position.z).toBeLessThan(-3.5);
      expect(player.read().position.y).toBeGreaterThan(1.6);
      expect(player.read().jumpCount).toBe(0);
    } finally { player.dispose(); world.free(); }
  });
  it("walks at 3 m/s with normalized diagonal inputs and preserves ground contact", () => {
    const straight = rig(), diagonal = rig();
    try {
      straight.player.setInput({ x: 0, z: -1, sprint: false, jump: false });
      diagonal.player.setInput({ x: 1, z: -1, sprint: false, jump: false });
      straight.ticks(60); diagonal.ticks(60);
      const a = straight.player.read(), b = diagonal.player.read();
      expect(Math.hypot(a.position.x, a.position.z)).toBeCloseTo(3, 2);
      expect(Math.hypot(b.position.x, b.position.z)).toBeCloseTo(3, 2);
      expect(a.grounded).toBe(true); expect(b.grounded).toBe(true);
      // Rapier snap-to-ground can close part of the configured separation gap.
      const feet = a.position.y - HVP_PLAYER_PROFILE.height / 2;
      expect(feet).toBeGreaterThanOrEqual(0);
      expect(feet).toBeLessThanOrEqual(0.02);
    } finally { straight.dispose(); diagonal.dispose(); }
  });

  it.each([0.125, 0.25, 0.375])("respects the 0.26 m autostep limit on a %s m step", height => {
    const r = rig();
    try {
      r.world.createCollider(R.ColliderDesc.cuboid(2, height / 2, 1).setTranslation(0, height / 2, -2));
      r.world.step();
      r.player.setInput({ x: 0, z: -1, sprint: false, jump: false }); r.ticks(60);
      if (height <= 0.26) { expect(r.player.read().position.z).toBeLessThan(-2); }
      else { expect(r.player.read().position.z).toBeGreaterThan(-0.75); }
    } finally { r.dispose(); }
  });

  it("allows a grounded jump once, rejects air-jumps and collides with a ceiling", () => {
    const r = rig();
    try {
      r.world.createCollider(R.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(0, 2.3, 0)); r.world.step();
      r.player.setInput({ x: 0, z: 0, sprint: false, jump: true }); r.ticks(2);
      r.player.setInput({ x: 0, z: 0, sprint: false, jump: true });
      let maxHead = 0;
      for (let i = 0; i < 50; i += 1) { r.ticks(1); maxHead = Math.max(maxHead, r.player.read().position.y + 0.9); }
      expect(maxHead).toBeLessThanOrEqual(2.22);
      expect(r.player.read().jumpCount).toBe(1);
    } finally { r.dispose(); }
  });

  it("does not step a low ledge when the capsule has no headroom", () => {
    const r = rig();
    try {
      r.world.createCollider(R.ColliderDesc.cuboid(2, 0.0625, 1).setTranslation(0, 0.0625, -2));
      r.world.createCollider(R.ColliderDesc.cuboid(2, 0.1, 3).setTranslation(0, 1.95, -1));
      r.world.step(); r.player.setInput({ x: 0, z: -1, sprint: false, jump: false }); r.ticks(60);
      expect(r.player.read().position.z).toBeGreaterThan(-0.8);
      expect(r.player.read().position.y + 0.9).toBeLessThan(1.851);
    } finally { r.dispose(); }
  });

  it("clips the third-person camera arm against actual collision without moving the avatar", () => {
    const r = rig();
    try {
      const wall = r.world.createCollider(R.ColliderDesc.cuboid(2, 2, 0.125).setTranslation(0, 1, 1.5));
      r.world.updateSceneQueries(); const before = r.player.read().position;
      r.player.setCameraOffset({ x: 0, y: 0.6, z: 3.2 });
      expect(r.player.read().cameraFraction).toBeGreaterThan(0);
      expect(r.player.read().cameraFraction).toBeLessThan(0.5);
      expect(r.player.read().position).toEqual(before);
      r.world.removeCollider(wall, false); r.world.updateSceneQueries();
      r.player.setCameraOffset({ x: 0, y: 0.6, z: 3.2 }); expect(r.player.read().cameraFraction).toBe(1);
      expect(() => r.player.setCameraOffset({ x: Infinity, y: 0, z: 0 })).toThrow();
    } finally { r.dispose(); }
  });

  it("falls through a known gap but holds before unprepared collision coverage", () => {
    const r = rig(false, (x, z) => Math.abs(x) < 1 && Math.abs(z) < 1);
    try {
      const start = r.player.read().position.y;
      r.ticks(10); expect(r.player.read().position.y).toBeLessThan(start);
      r.player.setInput({ x: 1, z: 0, sprint: true, jump: false }); r.ticks(30);
      expect(r.player.read().status).toBe("CoverageHold");
      expect(r.player.read().position.x).toBeLessThan(0.71);
    } finally { r.dispose(); }
  });

  it("freezes the real avatar in inspection and never carries stale input across resume", () => {
    const r = rig();
    try {
      r.player.setInput({ x: 1, z: 0, sprint: true, jump: false }); r.player.setEnabled(false);
      const before = r.player.read().position; r.ticks(30);
      expect(r.player.read().position).toEqual(before);
      r.player.setEnabled(true); r.ticks(30);
      expect(r.player.read().position.x).toBe(before.x);
      expect(() => r.player.setInput({ x: NaN, z: 0, sprint: false, jump: false })).toThrow();
    } finally { r.dispose(); }
  });

  it.each([30, 50])("enforces the 45 degree climb policy on a %s degree ramp", degrees => {
    const r = rig();
    try {
      const angle = degrees * Math.PI / 180;
      r.world.createCollider(R.ColliderDesc.cuboid(2, 0.1, 3)
        .setRotation({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) })
        .setTranslation(0, 3 * Math.sin(angle) - 0.1 * Math.cos(angle), -3 * Math.cos(angle)));
      r.world.step(); r.player.setInput({ x: 0, z: -1, sprint: false, jump: false }); r.ticks(60);
      if (degrees < 45) { expect(r.player.read().position.y).toBeGreaterThan(1.4); }
      else { expect(r.player.read().position.y).toBeLessThan(1.1); }
    } finally { r.dispose(); }
  });
});

import { createFactoryFacilitySession } from "../../src/hestia-prototype/physics/factoryFacilitySession";
import { createFactoryCargoSite } from "../../src/factory/fixtures/cargoSite";
import { materializeFactoryStartSite } from "../../src/factory/fixtures/startSite";
import { createFp02Fixture } from "../../src/factory/catalog/fp02Catalog";
import { createFactoryInstallationProfile } from "../../src/factory/construction/installationProfile";
import { readCargoHandlingProfile } from "../../src/factory/construction/cargoHandlingProfile";
const pairedCarrierRig = (withLimiter=false, factoryCovered:(x:number,z:number)=>boolean=()=>true) => {
  const world = new R.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 60;
  const support=world.createCollider(R.ColliderDesc.cuboid(16, .125, 16).setTranslation(0, 1.125, 0));
  let facilities: ReturnType<typeof createFactoryFacilitySession> | undefined;
  const player = createHvpLocomotion(world, { x: -5.75, y: 2.17, z: 11.875 }, 9.81, () => true, undefined,
    (from, to) => facilities?.preparePlayerMove(from, to) ?? (() => {}),
    withLimiter ? (from, to) => facilities?.limitPlayerMove(from, to) ?? 0 : undefined,
    withLimiter ? (from, to) => facilities?.canSlidePlayerMove(from, to) ?? false : undefined);
  let playerHandle: number | undefined; world.forEachRigidBody(body => { if (body.isKinematic()) playerHandle = body.handle; });
  player.setEnabled(true); const ticks = (n: number) => { for (let i = 0; i < n; i++) { player.step(); world.step(); } }; ticks(10);
  facilities = createFactoryFacilitySession(world, () => true, () => 0, () => 0, createFactoryCargoSite(materializeFactoryStartSite()),
    () => player.read().position, () => playerHandle, factoryCovered);
  const cargo = facilities.read().cargo!; facilities.openCargo({ ownerId: cargo.ownerId, profileDigest: cargo.profileDigest, expectedRevision: 0, expectedTerrainRevision: 0 });
  const profile = readCargoHandlingProfile(createFp02Fixture("cargo").catalog, "C27-PACK")!;
  const request = { transactionId: "pair_carrier", ownerId: "factory_carrier", profileId: profile.profileId, profileDigest: profile.digest,
    expectedRevision: facilities.read().revision, expectedTerrainRevision: 0, sourceContainerId: cargo.containerId, materialBinding: "synthetic-native-paired-c27-custody" };
  facilities.prepareCarrier(request); facilities.commitCarrier(request.transactionId); facilities.publishCarrier(request.transactionId); facilities.finalizeCarrier(request.transactionId);
  return { world, player, ticks, facilities, support, dispose: () => { player.dispose(); world.free(); } };
};
describe("W09 paired actual Native carrier locomotion", () => {
  it("checks the full final grounded jump move before either pose and never replays a vetoed jump edge", () => {
    const r=pairedCarrierRig();try{
      r.world.createCollider(R.ColliderDesc.cuboid(.01,.2,.1).setTranslation(-6.525,2,10.875));r.world.updateSceneQueries();
      const before=r.player.read(),carrier=r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle),position=carrier.translation();
      r.player.setInput({x:-1,z:0,sprint:false,jump:true});r.ticks(1);
      expect(r.player.read().position).toEqual(before.position);expect(r.player.read().jumpCount).toBe(before.jumpCount);expect(carrier.translation()).toEqual(position);
      r.player.setInput({x:0,z:0,sprint:false,jump:false});r.ticks(3);expect(r.player.read().jumpCount).toBe(before.jumpCount);expect(r.player.read().grounded).toBe(true);
    }finally{r.dispose();}
  });
  it("adopts a real native capsule autostep with the carrier on its separately proven level wheel support", () => {
    const r=pairedCarrierRig();try{
      r.world.createCollider(R.ColliderDesc.cuboid(.5,.0625,.3).setTranslation(-6.65,1.3125,11.875));r.world.updateSceneQueries();
      const before=r.player.read().position;r.player.setInput({x:-1,z:0,sprint:false,jump:false});r.ticks(16);
      const player=r.player.read(),carrier=r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle);
      expect(player.position.x).toBeLessThan(before.x-.5);expect(player.position.y).toBeGreaterThan(before.y+.1);
      expect(carrier.translation().x).toBeCloseTo(player.position.x,4);expect(carrier.translation().y).toBeCloseTo(1.25,4);expect(player.grounded).toBe(true);
    }finally{r.dispose();}
  });
  it("moves the player and whole 300kg carrier only through the same real solver steps", () => {
    const r = pairedCarrierRig(); try {
      expect(r.player.read().grounded).toBe(true);
      const before = r.player.read().position, carrierBefore = r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle).translation();
      r.player.setInput({ x: -1, z: 0, sprint: false, jump: false });
      expect(r.player.read().position).toEqual(before); expect(r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle).translation()).toEqual(carrierBefore);
      r.ticks(6); const player = r.player.read().position, carrier = r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle).translation();
      expect(player.x).toBeLessThan(before.x - .25); expect(carrier.x).toBeCloseTo(player.x, 4); expect(carrier.z).toBeCloseTo(player.z - 1, 4);
      expect(r.player.read().grounded).toBe(true);
    } finally { r.dispose(); }
  });
  it("vetoes BOTH poses when the capsule path is free but the actual carrier sweeps a foreign obstacle", () => {
    const r = pairedCarrierRig(); try {
      r.world.createCollider(R.ColliderDesc.cuboid(.01, .2, .1).setTranslation(-6.525, 2, 10.875)); r.world.updateSceneQueries();
      const before = r.player.read(), carrier = r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle), carrierBefore = carrier.translation();
      r.player.setInput({ x: -1, z: 0, sprint: false, jump: false }); r.ticks(6);
      expect(r.player.read().position).toEqual(before.position); expect(carrier.translation()).toEqual(carrierBefore);
      expect(r.player.read().jumpCount).toBe(before.jumpCount); expect(r.player.read().grounded).toBe(true);
    } finally { r.dispose(); }
  });
  it("adopts an off-grid collision-free prefix and commits both actual poses in the same World step", () => {
    const r=pairedCarrierRig(true);try{
      r.world.createCollider(R.ColliderDesc.cuboid(.006,.2,.1).setTranslation(-9.497,2,10.875));r.world.updateSceneQueries();
      r.player.setInput({x:-1,z:0,sprint:false,jump:false});r.ticks(59);
      const before=r.player.read().position,carrier=r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle),carrierBefore=carrier.translation();
      expect(before.x).toBeLessThan(-8.68);expect(before.x).toBeGreaterThan(-8.72);
      r.player.step();
      expect(r.player.read().position).toEqual(before);expect(carrier.translation()).toEqual(carrierBefore);
      r.world.step();
      const after=r.player.read().position,carrierAfter=carrier.translation();
      expect(after.x).toBeLessThan(before.x-.02);expect(after.x).toBeGreaterThan(-8.742);
      expect(carrierAfter.x).toBeCloseTo(after.x,4);expect(carrierAfter.z).toBeCloseTo(after.z-1,4);
      expect(r.player.read().grounded).toBe(true);
    }finally{r.dispose();}
  });
  it("slides an oblique actual carrier move along the free original axis in one World step",()=>{
    const r=pairedCarrierRig(true);try{
      r.world.createCollider(R.ColliderDesc.cuboid(.02,.5,3).setTranslation(-7.27,2,10.875));r.world.updateSceneQueries();
      r.player.setInput({x:-1,z:-1,sprint:false,jump:false});r.ticks(60);
      const before=r.player.read().position,carrier=r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle),carrierBefore=carrier.translation();
      expect(before.x).toBeLessThan(-6.45);expect(before.z).toBeLessThan(10);
      r.player.step();
      expect(r.player.read().position).toEqual(before);expect(carrier.translation()).toEqual(carrierBefore);
      r.world.step();
      const after=r.player.read().position,carrierAfter=carrier.translation();
      expect(after.x).toBeCloseTo(before.x,3);expect(after.z).toBeLessThan(before.z-.02);
      expect(carrierAfter.x).toBeCloseTo(carrierBefore.x,3);expect(carrierAfter.x).toBeCloseTo(after.x,4);
      expect(carrierAfter.z).toBeCloseTo(after.z-1,4);
    }finally{r.dispose();}
  });
  it("uses a clipped west prefix before continuing through the narrow two-wall carrier corner",()=>{
    const r=pairedCarrierRig(true);try{
      r.world.createCollider(R.ColliderDesc.cuboid(.02,.5,3).setTranslation(-7.27,2,10.875));
      r.world.createCollider(R.ColliderDesc.cuboid(.02,.5,1.625).setTranslation(-5.73,2,8.625));
      r.world.updateSceneQueries();
      const before=r.player.read().position;
      r.player.setInput({x:-1,z:-1,sprint:false,jump:false});r.ticks(90);
      const after=r.player.read().position,carrier=r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle).translation();
      expect(after.x).toBeCloseTo(-6.5,1);expect(after.z).toBeLessThan(10);expect(after.x).toBeLessThan(before.x);
      expect(carrier.x).toBeCloseTo(after.x,4);expect(carrier.z).toBeCloseTo(after.z-1,4);
      expect(r.player.read().grounded).toBe(true);
    }finally{r.dispose();}
  });
  it("keeps an axis-one carrier coverage veto hard when the other axis is available",()=>{
    let rejectXAxis=false;
    const r=pairedCarrierRig(true,(_x,z)=>!rejectXAxis||z<11.36);try{
      r.world.createCollider(R.ColliderDesc.cuboid(.02,.5,.3).setTranslation(-6.52,2,10.875));r.world.updateSceneQueries();
      r.facilities.limitPlayerMove=()=>0;
      const before=r.player.read().position,carrier=r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle),carrierBefore=carrier.translation();
      const zOnly=r.facilities.preparePlayerMove(before,{x:before.x,y:before.y,z:before.z-Math.SQRT1_2*.05});
      expect(zOnly).not.toBe(false);
      rejectXAxis=true;r.player.setInput({x:-1,z:-1,sprint:false,jump:false});r.player.step();
      r.world.step();
      expect(r.player.read().position).toEqual(before);expect(carrier.translation()).toEqual(carrierBefore);
      expect(r.facilities.read().lastCarrierVeto?.reason).toBe("CarrierCoverage");
    }finally{r.dispose();}
  });
  it("keeps a hard mid-bisection coverage veto from authorizing an otherwise clear axis",()=>{
    let rejectMidpoint=false;
    const r=pairedCarrierRig(true,(x,z)=>!rejectMidpoint||x<=-5.773||x>=-5.762||z<=10.852||z>=10.862);try{
      r.world.createCollider(R.ColliderDesc.cuboid(.02,.5,.02).setTranslation(-6.5201,2,11.385));r.world.updateSceneQueries();
      const before=r.player.read().position,carrier=r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle),carrierBefore=carrier.translation();
      const zOnly=r.facilities.preparePlayerMove(before,{x:before.x,y:before.y,z:before.z-Math.SQRT1_2*.05});
      expect(zOnly).not.toBe(false);
      rejectMidpoint=true;r.player.setInput({x:-1,z:-1,sprint:false,jump:false});r.player.step();
      r.world.step();
      expect(r.player.read().position).toEqual(before);expect(carrier.translation()).toEqual(carrierBefore);
      expect(r.facilities.read().lastCarrierVeto?.reason).toBe("CarrierCoverage");
      rejectMidpoint=false;
      for(let attempt=0;attempt<4;attempt++){r.player.step();r.world.step();}
      const resumed=r.player.read().position,resumedCarrier=carrier.translation();
      expect(Math.hypot(resumed.x-before.x,resumed.z-before.z)).toBeGreaterThan(.01);
      expect(resumedCarrier.x).toBeCloseTo(resumed.x,4);expect(resumedCarrier.z).toBeCloseTo(resumed.z-1,4);
    }finally{r.dispose();}
  });
  it("does not let a stale contact veto authorize motion while a real Native owner is pending",()=>{
    const r=pairedCarrierRig(true);try{
      const wall=r.world.createCollider(R.ColliderDesc.cuboid(.02,.5,.3).setTranslation(-6.5201,2,10.875));r.world.updateSceneQueries();
      const before=r.player.read().position,target={x:before.x-.05/Math.SQRT2,y:before.y,z:before.z-.05/Math.SQRT2};
      expect(r.facilities.preparePlayerMove(before,target)).toBe(false);
      expect(r.facilities.read().lastCarrierVeto?.reason).toBe("CarrierOverlap");
      r.world.removeCollider(wall,false);r.world.updateSceneQueries();
      const profile=createFactoryInstallationProfile("B06");
      r.facilities.prepare({transactionId:"pending_slide_build",ownerId:"pending_slide_build",instanceId:"pending_slide_build",
        definitionRef:profile.definitionRef,profileDigest:profile.profileDigest,expectedRevision:r.facilities.read().revision,
        expectedTerrainRevision:0,materialBinding:"pending-carrier-slide-fixture",centerMm:[-6250,1500,5000],quarterTurns:1});
      const carrier=r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle),carrierBefore=carrier.translation();
      expect(r.facilities.canSlidePlayerMove(before,target)).toBe(false);
      r.player.setInput({x:-1,z:-1,sprint:false,jump:false});r.player.step();r.world.step();
      expect(r.player.read().position).toEqual(before);expect(carrier.translation()).toEqual(carrierBefore);
      expect(r.facilities.read().state).toBe("PreparedHeld");
    }finally{r.dispose();}
  });
  it("keeps support-coverage rejection hard instead of bisecting it", () => {
    let rejectCoverage=false;const r=pairedCarrierRig(true,(x)=>!rejectCoverage||x>-5.76);try{
      const prepare=r.facilities.preparePlayerMove.bind(r.facilities);let preparations=0;
      r.facilities.preparePlayerMove=(from,to)=>{preparations++;return prepare(from,to);};
      rejectCoverage=true;
      const before=r.player.read().position,carrier=r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle),carrierBefore=carrier.translation();
      r.player.setInput({x:-1,z:0,sprint:false,jump:false});r.ticks(1);
      expect(r.player.read().position).toEqual(before);expect(carrier.translation()).toEqual(carrierBefore);
      expect(r.facilities.read().lastCarrierVeto?.reason).toBe("CarrierCoverage");expect(preparations).toBe(2);
    }finally{r.dispose();}
  });
  it("keeps a real carrier-support loss hard instead of bisecting it",()=>{
    const r=pairedCarrierRig(true);try{
      r.world.removeCollider(r.support,false);
      r.world.createCollider(R.ColliderDesc.cuboid(5.09,.125,16).setTranslation(-10.91,1.125,0));
      r.world.createCollider(R.ColliderDesc.cuboid(10.89,.125,16).setTranslation(5.11,1.125,0));r.world.updateSceneQueries();
      const prepare=r.facilities.preparePlayerMove.bind(r.facilities);let preparations=0;
      r.facilities.preparePlayerMove=(from,to)=>{preparations++;return prepare(from,to);};
      const before=r.player.read().position,carrier=r.world.getRigidBody(r.facilities.read().carrier!.bodyHandle),carrierBefore=carrier.translation();
      expect(r.facilities.read().carrier?.phase).toBe("Carrying");
      const supportHit=r.world.castRayAndGetNormal(new R.Ray({x:before.x-.05,y:before.y+1,z:before.z-1},{x:0,y:-1,z:0}),6,true,
        undefined,undefined,undefined,undefined,c=>c.isEnabled()&&!c.isSensor()&&c.parent()?.handle!==carrier.handle&&c.parent()?.handle!==r.player.readonlyBodyHandle);
      expect(supportHit).toBeNull();
      r.player.setInput({x:-1,z:0,sprint:false,jump:false});r.ticks(1);
      expect(r.player.read().position).toEqual(before);expect(carrier.translation()).toEqual(carrierBefore);
      expect(r.facilities.read().lastCarrierVeto?.reason).toBe("CarrierSupport");expect(preparations).toBe(2);
    }finally{r.dispose();}
  });
});

describe("Factory paired-prefix rollback",()=>{
  it("rechecks the recomputed endpoint and restores prior movement state when that guard vetoes",()=>{
    const world=new R.World({x:0,y:-9.81,z:0});world.timestep=1/60;
    world.createCollider(R.ColliderDesc.cuboid(10,.5,10).setTranslation(0,-.5,0));
    const saved=groundedCheckpoint(world);
    let guardCalls=0,limiterCalls=0;
    const player=createHvpLocomotion(world,saved.position,9.81,()=>true,saved,()=>{guardCalls++;return false;},()=>{limiterCalls++;return .5;});
    try{
      player.setEnabled(true);const before=player.read();player.setInput({x:1,z:0,sprint:false,jump:true});
      player.step();expect(player.read().position).toEqual(before.position);expect(player.read().grounded).toBe(before.grounded);
      expect(player.read().velocityY).toBe(before.velocityY);expect(player.read().jumpCount).toBe(before.jumpCount);
      expect(guardCalls).toBe(2);expect(limiterCalls).toBe(1);
    }finally{player.dispose();world.free();}
  });
  it("commits a successful horizontal retry with the original single jump and gravity integration",()=>{
    const world=new R.World({x:0,y:-9.81,z:0});world.timestep=1/60;
    world.createCollider(R.ColliderDesc.cuboid(10,.5,10).setTranslation(0,-.5,0));
    const saved=groundedCheckpoint(world);let guardCalls=0,limiterCalls=0;
    const player=createHvpLocomotion(world,saved.position,9.81,()=>true,saved,()=>++guardCalls===1?false:()=>{},()=>{limiterCalls++;return .5;});
    try{
      player.setEnabled(true);const before=player.read(),dt=1/60,expectedVelocity=Math.sqrt(2*9.81*HVP_PLAYER_PROFILE.jumpHeight)-9.81*dt;
      player.setInput({x:1,z:0,sprint:false,jump:true});player.step();world.step();
      const after=player.read();
      expect(after.position.x).toBeCloseTo(before.position.x+.025,5);
      expect(after.position.y).toBeCloseTo(before.position.y+expectedVelocity*dt,5);
      expect(after.velocityY).toBeCloseTo(expectedVelocity,5);expect(after.jumpCount).toBe(before.jumpCount+1);expect(after.grounded).toBe(false);
      expect(guardCalls).toBe(2);expect(limiterCalls).toBe(1);
    }finally{player.dispose();world.free();}
  });
  it("rechecks Avatar capsule coverage for a scaled endpoint in nonconvex coverage",()=>{
    const world=new R.World({x:0,y:-9.81,z:0});world.timestep=1/60;
    world.createCollider(R.ColliderDesc.cuboid(10,.5,10).setTranslation(0,-.5,0));
    const saved=groundedCheckpoint(world),radius=HVP_PLAYER_PROFILE.radius+HVP_PLAYER_PROFILE.offset;
    const covered=(x:number)=>!(x>.33&&x<.35);
    expect(covered(.05+radius)).toBe(true);expect(covered(.025+radius)).toBe(false);
    let guardCalls=0,limiterCalls=0;
    const player=createHvpLocomotion(world,saved.position,9.81,covered,saved,()=>{guardCalls++;return false;},()=>{limiterCalls++;return .5;});
    try{
      player.setEnabled(true);const before=player.read();player.setInput({x:1,z:0,sprint:false,jump:false});player.step();world.step();
      const after=player.read();expect(after.position).toEqual(before.position);expect(after.status).toBe("CoverageHold");
      expect(after.grounded).toBe(before.grounded);expect(after.velocityY).toBe(0);expect(after.jumpCount).toBe(before.jumpCount);
      expect(guardCalls).toBe(1);expect(limiterCalls).toBe(1);
    }finally{player.dispose();world.free();}
  });
  it("holds when Rapier projects a covered intent into an uncovered Avatar corner",()=>{
    const radius=HVP_PLAYER_PROFILE.radius+HVP_PLAYER_PROFILE.offset,fullAxis=.05/Math.SQRT2;
    for(const limited of [false,true]){
      const world=new R.World({x:0,y:-9.81,z:0});world.timestep=1/60;
      world.createCollider(R.ColliderDesc.cuboid(10,.5,10).setTranslation(0,-.5,0));
      const saved=groundedCheckpoint(world),axis=fullAxis*(limited?.5:1);
      const coverageHole={minX:radius+axis-.007,maxX:radius+axis+.007,minZ:-radius+.005,maxZ:-radius+.015};
      const covered=(x:number,z:number)=>!(x>coverageHole.minX&&x<coverageHole.maxX&&z>coverageHole.minZ&&z<coverageHole.maxZ);
      world.createCollider(R.ColliderDesc.cuboid(2,2,.005).setTranslation(0,2,radius+.007));world.updateSceneQueries();
      for(const requestedScale of limited?[1,.5]:[1]){
        const requested=fullAxis*requestedScale;
        expect([-radius,radius].every(x=>[-radius,radius].every(z=>covered(requested+x,requested+z)))).toBe(true);
      }
      let guardCalls=0,limiterCalls=0,commits=0;
      const player=createHvpLocomotion(world,saved.position,9.81,covered,saved,()=>{
        guardCalls++;return limited&&guardCalls===1?false:()=>{commits++;};
      },limited?()=>{limiterCalls++;return .5;}:undefined);
      try{
        player.setEnabled(true);const before=player.read();player.setInput({x:1,z:1,sprint:false,jump:false});player.step();world.step();
        const after=player.read();
        expect(after.position).toEqual(before.position);expect(after.status).toBe("CoverageHold");
        expect(after.grounded).toBe(before.grounded);expect(after.velocityY).toBe(0);expect(after.jumpCount).toBe(before.jumpCount);
        expect(guardCalls).toBe(limited?1:0);expect(limiterCalls).toBe(limited?1:0);expect(commits).toBe(0);
      }finally{player.dispose();world.free();}
    }
  });
});
