import { beforeAll, describe, expect, it, vi } from "vitest";
import { R, initializeHvpRapier } from "../../src/hestia-prototype/physics/rapierPort";
import { createHvpTick, HVP_PHYSICS_DT } from "../../src/hestia-prototype/physics/tick";
import { collisionSectors } from "../../src/hestia-prototype/physics/terrainColliders";
import { createHvpPhysicsSession, resolveHvpGravity } from "../../src/hestia-prototype/physics/session";
import { chooseHvpParallelism } from "../../src/hestia-prototype/physics/client";

beforeAll(initializeHvpRapier);
const floor = { sizeX: 16, sizeY: 8, sizeZ: 16, cellMeters: 0.125,
  originMeters: { x: -1, y: -0.125, z: -1 }, readSlot: (_x: number, y: number, _z: number) => y === 0 ? 1 : 0 };

describe("HVP runtime physics", () => {
  it("collects actual per-step solver timings without adding simulation steps",async()=>{
    const a=await createHvpPhysicsSession([], {x:0,y:2,z:0}),b=await createHvpPhysicsSession([], {x:0,y:2,z:0});
    try{
      const samples=a.advance(3/60,true);b.advance(3/60);
      expect(samples).toHaveLength(3);expect(samples!.every(([at,ms])=>Number.isFinite(at)&&at>=0&&Number.isFinite(ms)&&ms>=0)).toBe(true);
      expect(a.read().bodies).toEqual(b.read().bodies);expect(a.read().ticks).toBe(3);
      a.pause();expect(a.advance(1,true)).toEqual([]);expect(a.read().ticks).toBe(3);
    }finally{a.dispose();b.dispose();}
  });
  it("stages real colliders at a held tick, commits a physical cut, and rolls back without a mixed generation", async () => {
    const mesh=(layers:number)=>[...collisionSectors({...floor,sizeY:16,originMeters:{x:-1,y:0,z:-1},readSlot:(_x:number,y:number)=>y<layers?1:0})][0]!;
    const session=await createHvpPhysicsSession([mesh(8)],{x:0,y:2,z:0},9.81);
    const settle=()=>{for(let i=0;i<180;i+=1) { session.advance(1/60); } return session.read().bodies[0]!.position.y;};
    try {
      expect(settle()).toBeCloseTo(1.25,2);
      const before=session.read();
      session.prepareTerrain("one",0,[{index:0,mesh:mesh(4)}]); session.advance(1);
      expect(session.read().ticks).toBe(before.ticks);
      expect(session.read().terrainGeneration).toBe(0);
      session.commitTerrain("one"); session.advance(1);
      expect(session.read().ticks).toBe(before.ticks);
      session.finalizeTerrain("one");
      expect(settle()).toBeCloseTo(.75,2);
      expect(session.read().terrainGeneration).toBe(1);
      expect(()=>session.prepareTerrain("old",0,[{index:0,mesh:mesh(2)}])).toThrow(/Stale/);
      session.prepareTerrain("two",1,[{index:0,mesh:mesh(2)}]); session.commitTerrain("two");
      session.rollbackTerrain("two"); session.drop();
      expect(settle()).toBeCloseTo(.75,2);
      expect(session.read()).toMatchObject({terrainGeneration:1,colliderCount:2,terrainTransaction:"Idle"});
    } finally { session.dispose(); }
  });
  it("a collider-create failure preserves the previous active physical generation", async () => {
    const sectors=[...collisionSectors(floor)];
    const session=await createHvpPhysicsSession(sectors,{x:0,y:2,z:0},9.81);
    const spy=vi.spyOn(R.World.prototype,"createCollider").mockImplementationOnce(()=>{throw new Error("injected create failure");});
    try {
      expect(()=>session.prepareTerrain("fault",0,[{index:0,mesh:sectors[0]!}])).toThrow(/injected/);
      expect(session.read()).toMatchObject({terrainGeneration:0,colliderCount:2,status:"Running",terrainTransaction:"Idle"});
      for(let i=0;i<180;i+=1) { session.advance(1/60); }
      expect(session.read().bodies[0]!.position.y).toBeCloseTo(.25,2);
    } finally { spy.mockRestore(); session.dispose(); }
  });
  it("scales preparation only after measured headroom and backs off on a slow main thread", () => {
    expect(chooseHvpParallelism(1, 2, [1, 1, 1])).toBe(1);
    expect(chooseHvpParallelism(1, 2, [1, 1, 1, 1])).toBe(2);
    expect(chooseHvpParallelism(2, 2, [3, 3, 3, 3])).toBe(2);
    expect(chooseHvpParallelism(2, 2, [1, 1, 1, 5])).toBe(1);
    expect(chooseHvpParallelism(1, 1, [1, 1, 1, 1])).toBe(1);
    expect(chooseHvpParallelism(2, 2, [NaN])).toBe(1);
  });
  it("frees the real owned World and never steps it after dispose", async () => {
    const session = await createHvpPhysicsSession([...collisionSectors(floor)], { x: 0, y: 2, z: 0 });
    expect(session.read().bodyCount).toBe(1);
    expect(session.read().colliderCount).toBe(2);
    session.advance(1 / 60);
    session.dispose(); session.dispose(); session.advance(1);
    expect(session.read()).toMatchObject({ status: "Disposed", bodyCount: 0, colliderCount: 0, ticks: 1 });
  });
  it("resolves game gravity from Hestia, not the 9.81 test fixture", () => {
    expect(resolveHvpGravity()).toBeCloseTo(8.09e14 / 8_282_000 ** 2, 10);
    expect(resolveHvpGravity()).not.toBe(9.81);
  });

  it.each([1, 4, 8])("steps the pinned small-steps solver in free fall (%i substeps)", (substeps) => {
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    try {
      world.timestep = HVP_PHYSICS_DT;
      world.integrationParameters.numSolverIterations = substeps;
      const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 10, 0));
      world.createCollider(R.ColliderDesc.cuboid(0.0625, 0.0625, 0.0625).setDensity(512), body);
      for (let i = 0; i < 30; i += 1) { world.step(); }
      expect(body.mass()).toBeCloseTo(1, 6);
      expect(body.linvel().y).toBeCloseTo(-4.905, 4);
      // Rapier 0.12 small-steps PGS integrates each solver substep. Independent
      // sum of 30*substeps semi-implicit increments, not fitted solver output.
      const count = 30 * substeps;
      const dt = HVP_PHYSICS_DT / substeps;
      expect(body.translation().y).toBeCloseTo(10 - 9.81 * dt * dt * count * (count + 1) / 2, 4);
    } finally { world.free(); }
  });

  it("keeps contact on canonical exposed faces, and disabling them fails the oracle", () => {
    const settle = (enabled: boolean): number => {
      const world = new R.World({ x: 0, y: -9.81, z: 0 });
      try {
        for (const sector of collisionSectors(floor)) {
          world.createCollider(R.ColliderDesc.trimesh(sector.vertices, sector.indices).setEnabled(enabled));
        }
        const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 2, 0).setCcdEnabled(true));
        world.createCollider(R.ColliderDesc.cuboid(0.0625, 0.0625, 0.0625).setDensity(512), body);
        for (let i = 0; i < 180; i += 1) { world.step(); }
        return body.translation().y;
      } finally { world.free(); }
    };
    expect(Math.abs(settle(true) - 0.0625)).toBeLessThan(0.02);
    expect(settle(false)).toBeLessThan(-1);
  });

  it("preserves a real cavity under an overhang; a filled heightfield blocks it", () => {
    const hit = (filled: boolean): boolean => {
      const world = new R.World({ x: 0, y: 0, z: 0 });
      try {
        const source = { ...floor, readSlot: (x: number, y: number, _z: number) =>
          y === 0 || (x >= 4 && x <= 11 && (filled || y >= 6)) ? 1 : 0 };
        for (const sector of collisionSectors(source)) {
          world.createCollider(R.ColliderDesc.trimesh(sector.vertices, sector.indices));
        }
        world.updateSceneQueries();
        const ray = new R.Ray({ x: -0.9, y: 0.3, z: 0 }, { x: 1, y: 0, z: 0 });
        const obstruction = world.castRay(ray, 1.8, true);
        // Actual Rapier query against canonical triangle collision, not height sampling.
        return obstruction !== null;
      } finally { world.free(); }
    };
    expect(hit(false)).toBe(false);
    expect(hit(true)).toBe(true);
  });

  it("has identical 600-tick solver motion at 30, 60 and 144 render Hz", () => {
    const simulate = (hz: number) => {
      const world = new R.World({ x: 0, y: -9.81, z: 0 });
      try {
        const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 1000, 0));
        world.createCollider(R.ColliderDesc.ball(0.1), body);
        const tick = createHvpTick(() => { world.timestep = HVP_PHYSICS_DT; world.step(); });
        for (let i = 0; i < hz * 10; i += 1) { tick.advance(1 / hz); }
        return [tick.read().ticks, body.translation().y, body.linvel().y];
      } finally { world.free(); }
    };
    expect(simulate(30)).toEqual(simulate(60));
    expect(simulate(144)).toEqual(simulate(60));
    expect(simulate(60)[0]).toBe(600);
  });

  it("bounds catch-up and pauses without silently consuming the backlog", () => {
    let count = 0;
    const tick = createHvpTick(() => { count += 1; });
    tick.advance(2);
    expect(count).toBe(4);
    expect(tick.read().status).toBe("SimulationHold");
    expect(tick.read().backlogSeconds).toBeGreaterThan(1.9);
    tick.advance(2);
    expect(count).toBe(4);
    const held = tick.read();
    tick.pause();
    expect(tick.read()).toEqual(held);
    tick.resume();
    expect(tick.read().discardedSeconds).toBeGreaterThan(1.9);
    tick.advance(1 / 60);
    expect(count).toBe(5);
    tick.pause(); tick.advance(2);
    expect(count).toBe(5);
  });

  it("CCD stops a fast small body at a one-cell wall", () => {
    const world = new R.World({ x: 0, y: 0, z: 0 });
    try {
      const wall = world.createCollider(R.ColliderDesc.cuboid(0.0625, 2, 2));
      const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(-1, 0, 0).setLinvel(20, 0, 0).setCcdEnabled(true));
      world.createCollider(R.ColliderDesc.ball(0.04).setRestitution(0), body);
      let contact = false;
      for (let i = 0; i < 120; i += 1) {
        world.step();
        world.contactPair(wall, body.collider(0), () => { contact = true; });
      }
      expect(contact).toBe(true);
      expect(body.translation().x).toBeLessThan(0);
    } finally { world.free(); }
  });
});
