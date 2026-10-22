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
