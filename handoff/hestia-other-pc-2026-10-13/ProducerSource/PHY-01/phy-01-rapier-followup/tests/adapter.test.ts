import { beforeAll, expect, it } from "vitest";
import B from "rapier-b";
import { World, cachedPredicate } from "../src/rapier021";

beforeAll(() => B.init());
function rig() {
  const world = new World({ x: 0, y: 0, z: 0 });
  const body = world.createRigidBody(B.RigidBodyDesc.kinematicPositionBased());
  const character = world.createCollider(B.ColliderDesc.capsule(.5, .5), body);
  world.createCollider(B.ColliderDesc.cuboid(.1, 1, 1).setTranslation(1, 0, 0).setSensor(true));
  world.createCollider(B.ColliderDesc.cuboid(.1, 1, 1).setTranslation(2, 0, 0));
  const controller = world.createCharacterController(.01);
  world.step(); // The borrow test uses a genuinely initialized scene.
  return { world, body, character, controller };
}

it("keeps the real solid, excludes the sensor and frees after the original WASM-reading predicate", () => {
  const r = rig();
  try {
    r.controller.computeColliderMovement(r.character, { x: 3, y: 0, z: 0 }, undefined, undefined, c => !c.isSensor());
    expect(r.controller.computedMovement().x).toBeGreaterThan(1);
    expect(r.controller.computedMovement().x).toBeLessThan(1.5);
  } finally { expect(() => r.world.free()).not.toThrow(); }
});

it("surfaces predicate errors before entering the borrow and still frees", () => {
  const r = rig();
  try {
    expect(() => r.controller.computeColliderMovement(r.character, { x: 3, y: 0, z: 0 },
      undefined, undefined, () => { throw new Error("injected predicate failure"); })).toThrow("injected predicate failure");
    expect(() => r.world.castRay(new B.Ray({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), 3, true,
      undefined, undefined, r.character, r.body, () => { throw new Error("injected ray predicate failure"); })).toThrow("injected ray predicate failure");
  } finally { expect(() => r.world.free()).not.toThrow(); }
});

it("refreshes handle membership after remove, replacement and sensor change without a persistent cache", () => {
  const world = new World({ x: 0, y: 0, z: 0 });
  try {
    const old = world.createCollider(B.ColliderDesc.cuboid(1, 1, 1));
    const first = cachedPredicate(world, c => !c.isSensor())!;
    expect(first(old)).toBe(true);
    world.removeCollider(old, false);
    const replacement = world.createCollider(B.ColliderDesc.cuboid(1, 1, 1).setSensor(true));
    expect(cachedPredicate(world, c => !c.isSensor())!(replacement)).toBe(false);
    replacement.setSensor(false);
    expect(cachedPredicate(world, c => !c.isSensor())!(replacement)).toBe(true);
  } finally { world.free(); }
});

it("does not advance time when the diagnostic propagation spelling is called", () => {
  const world = new World({ x: 0, y: -9.81, z: 0 });
  try {
    const body = world.createRigidBody(B.RigidBodyDesc.dynamic().setTranslation(0, 2, 0).setLinvel(1, 0, 0));
    world.createCollider(B.ColliderDesc.cuboid(.2, .2, .2), body);
    const before = { p: body.translation(), v: body.linvel(), sleeping: body.isSleeping() };
    world.updateSceneQueries();
    expect({ p: body.translation(), v: body.linvel(), sleeping: body.isSleeping() }).toEqual(before);
    expect(world.castRay(new B.Ray({ x: -1, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }), 2, true)).toBeNull();
    expect(body.collider(0).castRay(new B.Ray({ x: -1, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }), 2, true)).toBeCloseTo(.8, 5);
  } finally { world.free(); }
});
