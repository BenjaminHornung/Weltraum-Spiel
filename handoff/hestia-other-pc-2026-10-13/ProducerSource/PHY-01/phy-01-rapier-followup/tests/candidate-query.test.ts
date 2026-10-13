import { beforeAll, expect, it } from "vitest";
import * as R from "../src/rapier021Candidate";

beforeAll(() => R.init());
const zero = { x: 0, y: 0, z: 0 }, identity = { x: 0, y: 0, z: 0, w: 1 };
const ray = (y = 0) => new R.Ray({ x: -3, y, z: 0 }, { x: 1, y: 0, z: 0 });
function state(world: R.World) {
  return { timestep: world.timestep, bodies: world.bodies.getAll().map(body => ({ handle: body.handle,
    p: body.translation(), v: body.linvel(), w: body.angvel(), sleeping: body.isSleeping() })) };
}

it("publishes Create/Move/Remove/Replace for ray, shape and KCC with zero physics steps", () => {
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  let steps = 0; const step = world.step.bind(world);
  world.step = (...args) => { steps++; step(...args); };
  const moving = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(20, 2, 0).setLinvel(1, 0, 0));
  world.createCollider(R.ColliderDesc.ball(.2), moving);
  const sleeper = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(30, 2, 0).setSleeping(true));
  world.createCollider(R.ColliderDesc.ball(.2), sleeper);
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(-3, 0, 0));
  const character = world.createCollider(R.ColliderDesc.capsule(.5, .3), body);
  const kcc = world.createCharacterController(.02);
  let wall = world.createCollider(R.ColliderDesc.cuboid(.5, 1, 1));
  try {
    for (const phase of ["Create", "Move", "Remove", "Replace"]) {
      if (phase === "Move") { wall.setTranslation({ x: 0, y: 3, z: 0 }); body.setTranslation({ x: -3, y: 3, z: 0 }, false); }
      if (phase === "Remove") { world.removeCollider(wall, false); }
      if (phase === "Replace") { wall = world.createCollider(R.ColliderDesc.cuboid(.5, 1, 1).setTranslation(1, 3, 0)); }
      world.propagateModifiedBodyPositionsToColliders();
      const before = state(world), snapshot = world.takeSnapshot();
      world.updateSceneQueries();
      expect(state(world), phase).toEqual(before);
      expect(world.takeSnapshot(), phase).toEqual(snapshot);
      const y = phase === "Create" ? 0 : 3, missing = phase === "Remove", distance = phase === "Replace" ? 3.5 : 2.5;
      const hit = world.castRay(ray(y), 10, true, undefined, undefined, character, body, c => !c.isSensor());
      const shape = world.castShape({ x: -3, y, z: 0 }, identity, { x: 1, y: 0, z: 0 }, new R.Ball(.1),
        0, 10, true, undefined, undefined, character, body, c => !c.isSensor());
      kcc.computeColliderMovement(character, { x: 6, y: 0, z: 0 }, undefined, undefined, c => !c.isSensor());
      if (missing) { expect(hit).toBeNull(); expect(shape).toBeNull(); expect(kcc.computedMovement().x).toBeCloseTo(6, 5); }
      else {
        expect(hit?.collider.handle).toBe(wall.handle); expect(hit?.timeOfImpact).toBeCloseTo(distance, 5);
        expect(shape?.collider.handle).toBe(wall.handle); expect(shape?.time_of_impact).toBeCloseTo(distance - .1, 4);
        expect(kcc.computedMovement().x).toBeGreaterThan(distance - .4);
        expect(kcc.computedMovement().x).toBeLessThan(distance - .2);
      }
      expect(steps).toBe(0); expect(state(world)).toEqual(before);
    }
  } finally { expect(() => world.free()).not.toThrow(); }
});

it("publishes every scene-query family and distant BVH ancestors without a step", () => {
  const world = new R.World(zero);
  try {
    const wall = world.createCollider(R.ColliderDesc.cuboid(.5, 1, 1));
    const far = world.createCollider(R.ColliderDesc.ball(.25).setTranslation(100, 80, -60));
    world.updateSceneQueries();
    expect(world.castRayAndGetNormal(ray(), 10, true)?.collider.handle).toBe(wall.handle);
    const hits: number[] = [];
    world.intersectionsWithRay(ray(), 10, true, hit => { hits.push(hit.collider.handle); return true; });
    expect(hits).toEqual([wall.handle]);
    expect(world.intersectionWithShape(zero, identity, new R.Ball(.1))?.handle).toBe(wall.handle);
    expect(world.projectPoint({ x: -2, y: 0, z: 0 }, false)?.point.x).toBeCloseTo(-.5, 5);
    expect(world.projectPointAndGetFeature({ x: -2, y: 0, z: 0 })?.collider.handle).toBe(wall.handle);
    const points: number[] = [], shapes: number[] = [], bounds: number[] = [];
    world.intersectionsWithPoint(zero, collider => { points.push(collider.handle); return true; });
    world.intersectionsWithShape(zero, identity, new R.Ball(.1), collider => { shapes.push(collider.handle); return true; });
    world.collidersWithAabbIntersectingAabb(zero, { x: .6, y: 1.1, z: 1.1 }, collider => { bounds.push(collider.handle); return true; });
    expect(points).toEqual([wall.handle]); expect(shapes).toEqual([wall.handle]); expect(bounds).toEqual([wall.handle]);
    expect(world.castRay(new R.Ray({ x: 99, y: 80, z: -60 }, { x: 1, y: 0, z: 0 }), 2, true)?.collider.handle).toBe(far.handle);
    const separated = world.castShape({ x: -3, y: 0, z: 0 }, identity, { x: 1, y: 0, z: 0 }, new R.Ball(.1), .2, 10, true);
    expect(separated?.time_of_impact).toBeCloseTo(2.2, 4);
  } finally { world.free(); }
});

it("removes disabled/deleted leaves and resolves a replacement's actual handle generation", () => {
  const world = new R.World(zero);
  try {
    const old = world.createCollider(R.ColliderDesc.cuboid(.5, 1, 1)), oldHandle = old.handle;
    world.updateSceneQueries(); expect(world.castRay(ray(), 10, true)).not.toBeNull();
    old.setEnabled(false); world.updateSceneQueries(); expect(world.castRay(ray(), 10, true)).toBeNull();
    old.setEnabled(true); world.updateSceneQueries(); expect(world.castRay(ray(), 10, true)?.collider.handle).toBe(oldHandle);
    world.removeCollider(old, false);
    const replacement = world.createCollider(R.ColliderDesc.cuboid(.5, 1, 1).setTranslation(1, 0, 0));
    expect(replacement.handle).not.toBe(oldHandle);
    world.updateSceneQueries(); expect(world.castRay(ray(), 10, true)?.collider.handle).toBe(replacement.handle);
    expect(world.castRay(ray(), 10, true)?.timeOfImpact).toBeCloseTo(3.5, 5);
  } finally { world.free(); }
});

it.each([false, true])("preserves ordinary solver snapshots and collision events (events=%s)", withEvents => {
  const worlds = [new R.World({ x: 0, y: -9.81, z: 0 }), new R.World({ x: 0, y: -9.81, z: 0 })];
  const queues = [new R.EventQueue(false), new R.EventQueue(false)];
  const floors = worlds.map(world => world.createCollider(R.ColliderDesc.cuboid(4, .2, 4).setTranslation(0, -.2, 0)
    .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS)));
  for (const world of worlds) {
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 1, 0));
    world.createCollider(R.ColliderDesc.ball(.25).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), body);
  }
  try {
    for (let tick = 0; tick < 40; tick++) {
      if (tick === 30) { worlds.forEach((world, i) => world.removeCollider(floors[i]!, false)); }
      worlds.forEach(world => world.propagateModifiedBodyPositionsToColliders());
      worlds[0]!.updateSceneQueries(); worlds[0]!.updateSceneQueries();
      expect(worlds[0]!.takeSnapshot()).toEqual(worlds[1]!.takeSnapshot());
      worlds.forEach((world, i) => withEvents ? world.step(queues[i]) : world.step());
      expect(state(worlds[0]!)).toEqual(state(worlds[1]!));
      expect(worlds[0]!.takeSnapshot()).toEqual(worlds[1]!.takeSnapshot());
      const events = queues.map(queue => { const result: number[][] = []; queue.drainCollisionEvents((a,b,start) => result.push([a,b,Number(start)])); return result; });
      expect(events[0]).toEqual(events[1]);
    }
  } finally { worlds.forEach(world => world.free()); queues.forEach(queue => queue.free()); }
});

it("uses live native sets for KCC dynamic impulses and excludes sensors before the borrow", () => {
  const world = new R.World(zero);
  try {
    const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    const character = world.createCollider(R.ColliderDesc.capsule(.5, .3), body);
    world.createCollider(R.ColliderDesc.cuboid(.1, 1, 1).setTranslation(1, 0, 0).setSensor(true));
    const dynamic = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(2, 0, 0));
    world.createCollider(R.ColliderDesc.cuboid(.1, 1, 1), dynamic);
    const controller = world.createCharacterController(.01);
    controller.setApplyImpulsesToDynamicBodies(true); controller.setCharacterMass(5);
    world.updateSceneQueries();
    controller.computeColliderMovement(character, { x: 3, y: 0, z: 0 }, undefined, undefined, c => !c.isSensor());
    expect(controller.computedMovement().x).toBeGreaterThan(1.4); expect(controller.computedMovement().x).toBeLessThan(1.8);
    expect(dynamic.linvel().x).toBeGreaterThan(0);
    expect(() => controller.computeColliderMovement(character, { x: 3, y: 0, z: 0 }, undefined, undefined,
      () => { throw new Error("predicate-before-borrow"); })).toThrow("predicate-before-borrow");
    expect(() => world.castRay(ray(), 10, true, undefined, undefined, undefined, undefined,
      () => { throw new Error("ray-before-borrow"); })).toThrow("ray-before-borrow");
  } finally { expect(() => world.free()).not.toThrow(); }
});

it("discards the transient query tree at a real step and restores one adapted native owner", () => {
  const world = new R.World(zero);
  let restored: R.World | undefined;
  try {
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic());
    const collider = world.createCollider(R.ColliderDesc.ball(.25), body);
    world.updateSceneQueries(); expect(world.castRay(ray(), 10, true)?.collider.handle).toBe(collider.handle);
    body.setTranslation({ x: 20, y: 0, z: 0 }, false); world.step();
    expect(world.castRay(ray(), 10, true)).toBeNull();
    expect(world.castRay(new R.Ray({ x: 19, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), 2, true)?.collider.handle).toBe(collider.handle);
    restored = R.World.restoreSnapshot(world.takeSnapshot()); expect(restored).toBeInstanceOf(R.World);
    expect(restored.bodies.len()).toBe(1); expect(restored.colliders.len()).toBe(1);
    restored.updateSceneQueries();
    expect(() => restored!.castRay(ray(), 10, true, undefined, undefined, undefined, undefined,
      () => { throw new Error("restored-adapter"); })).toThrow("restored-adapter");
    expect(R.PHY01_SOLVER_PROFILE.vanillaNpmBytes).toBe(false); expect(R.version()).toBe("0.21.0");
  } finally { restored?.free(); world.free(); }
});
