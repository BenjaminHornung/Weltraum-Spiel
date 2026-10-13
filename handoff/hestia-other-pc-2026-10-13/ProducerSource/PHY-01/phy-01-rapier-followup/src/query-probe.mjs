import A from "rapier-a";
import B from "rapier-b";

const checks = (name, actual, expected, pass) => ({ name, actual, expected, status: pass ? "PASS" : "FAIL" });
const api = version => version === "a" ? A : B;
const toi = (hit, version) => hit === null ? null : version === "a" ? hit.toi : hit.timeOfImpact;
const shapeToi = (hit, version) => hit === null ? null : version === "a" ? hit.toi : hit.time_of_impact;
const rotation = { x: 0, y: 0, z: 0, w: 1 };

function state(world, steps, events) {
  const bodies = [];
  world.forEachRigidBody(body => bodies.push({ handle: body.handle, position: body.translation(),
    velocity: body.linvel(), angularVelocity: body.angvel(), sleeping: body.isSleeping() }));
  const contacts = [];
  world.forEachCollider(c => world.contactPairsWith(c, other => contacts.push([c.handle, other.handle])));
  const collisions = [];
  events.drainCollisionEvents((a, b, started) => collisions.push([a, b, started]));
  let forces = 0;
  events.drainContactForceEvents(() => { forces += 1; });
  return { steps, timestep: world.timestep, bodies, colliders: world.colliders.len(), contacts, collisions, forces };
}

/** Actual no-step queries. The optional initial step is a separate timing-policy diagnosis. */
export async function queryProbe(version, initialStep = false) {
  const R = api(version); await R.init();
  const world = new R.World({ x: 0, y: -9.81, z: 0 }), events = new R.EventQueue(false);
  world.timestep = 1 / 60;
  let steps = 0;
  const step = world.step.bind(world);
  world.step = (...args) => { steps += 1; step(...args); };
  const moving = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(20, 2, 0).setLinvel(1, 0, 0));
  world.createCollider(R.ColliderDesc.cuboid(.2, .2, .2).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), moving);
  const sleeper = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(30, 2, 0).setSleeping(true));
  world.createCollider(R.ColliderDesc.cuboid(.2, .2, .2), sleeper);
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(-3, 0, 0));
  const character = world.createCollider(R.ColliderDesc.capsule(.5, .3), body);
  const kcc = world.createCharacterController(.02);
  let wall = world.createCollider(R.ColliderDesc.cuboid(.5, 1, 1));
  if (initialStep) { world.step(events); state(world, steps, events); }
  const outcomes = [];
  const stages = [];
  try {
    for (const name of ["Create", "Move", "Remove", "Replace"]) {
      if (name === "Move") { wall.setTranslation({ x: 0, y: 3, z: 0 }); body.setTranslation({ x: -3, y: 3, z: 0 }, false); }
      if (name === "Remove") { world.removeCollider(wall, false); }
      if (name === "Replace") { wall = world.createCollider(R.ColliderDesc.cuboid(.5, 1, 1).setTranslation(1, 3, 0)); }
      const before = state(world, steps, events);
      world.propagateModifiedBodyPositionsToColliders();
      if (version === "a") { world.updateSceneQueries(); }
      const y = name === "Create" ? 0 : 3;
      const allowed = new Set(world.colliders.getAll().filter(c => !c.isSensor()).map(c => c.handle));
      const filter = c => allowed.has(c.handle);
      const ray = world.castRay(new R.Ray({ x: -3, y, z: 0 }, { x: 1, y: 0, z: 0 }), 10, true,
        undefined, undefined, character, body, filter);
      const args = [{ x: -3, y, z: 0 }, rotation, { x: 1, y: 0, z: 0 }, new R.Ball(.1)];
      const shape = version === "a"
        ? world.castShape(...args, 10, true, undefined, undefined, character, body, filter)
        : world.castShape(...args, 0, 10, true, undefined, undefined, character, body, filter);
      kcc.computeColliderMovement(character, { x: 6, y: 0, z: 0 }, undefined, undefined, filter);
      const movement = { ...kcc.computedMovement() };
      const after = state(world, steps, events);
      const absent = name === "Remove";
      const rayExpected = absent ? null : name === "Replace" ? 3.5 : 2.5;
      const shapeExpected = absent ? null : name === "Replace" ? 3.4 : 2.4;
      outcomes.push(checks(name + "/ray", toi(ray, version), rayExpected,
        absent ? ray === null : ray !== null && Math.abs(toi(ray, version) - rayExpected) < 1e-5 && ray.collider.handle === wall.handle));
      outcomes.push(checks(name + "/shape", shapeToi(shape, version), shapeExpected,
        absent ? shape === null : shape !== null && Math.abs(shapeToi(shape, version) - shapeExpected) < 1e-4 && shape.collider.handle === wall.handle));
      outcomes.push(checks(name + "/kcc", movement.x, absent ? 6 : "blocked by confirmed wall",
        absent ? Math.abs(movement.x - 6) < 1e-5 : movement.x > 0 && movement.x < (name === "Replace" ? 3.5 : 2.5)));
      outcomes.push(checks(name + "/no temporal side effects", after, before, JSON.stringify(after) === JSON.stringify(before)));
      stages.push({ name, before, after, wallHandle: absent ? null : wall.handle, ray: toi(ray, version),
        shape: shapeToi(shape, version), movement });
    }
  } finally {
    world.removeCharacterController(kcc);
    world.free();
    events.free();
  }
  return { version, initialStep, refresh: version === "a" ? "propagate + updateSceneQueries" : "propagate only; broadphase refresh UNSUPPORTED",
    outcomes, stages, free: "PASS" };
}

/** Isolate a sensor at x=1 from the actual wall at x=2. */
export async function borrowProbe(version, mode) {
  const R = api(version); await R.init();
  const world = new R.World({ x: 0, y: 0, z: 0 });
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
  const character = world.createCollider(R.ColliderDesc.capsule(.5, .5), body);
  world.createCollider(R.ColliderDesc.cuboid(.1, 1, 1).setTranslation(1, 0, 0).setSensor(true));
  world.createCollider(R.ColliderDesc.cuboid(.1, 1, 1).setTranslation(2, 0, 0));
  const kcc = world.createCharacterController(.01);
  world.step(); // Explicit initialization for this borrow-only question.
  let movement = null, error = null, free = "PASS", freeError = null, callbacks = 0;
  const callbackErrors = [];
  try {
    let predicate;
    if (mode === "reentrant") { predicate = c => { callbacks += 1; try { return !c.isSensor(); }
      catch (e) { callbackErrors.push(String(e)); throw e; } }; }
    if (mode === "throwing-callback") { predicate = () => { callbacks += 1;
      callbackErrors.push("injected predicate failure"); throw new Error("injected predicate failure"); }; }
    if (mode === "cached" || mode === "throw-before-callback") {
      const allowed = new Set();
      for (const c of world.colliders.getAll()) {
        if (mode === "throw-before-callback") { throw new Error("injected predicate failure"); }
        if (!c.isSensor()) { allowed.add(c.handle); }
      }
      predicate = c => { callbacks += 1; return allowed.has(c.handle); };
    }
    kcc.computeColliderMovement(character, { x: 3, y: 0, z: 0 }, undefined, undefined, predicate);
    movement = { ...kcc.computedMovement() };
  } catch (e) { error = String(e); }
  try { world.free(); } catch (e) { free = "FAIL"; freeError = String(e); }
  const exceptionCase = mode.includes("throw");
  return { version, mode, initializedSteps: 1, movement, error, callbacks, callbackErrors, free, freeError,
    outcomes: [
      checks("solid included, sensor excluded", movement?.x ?? null, "1 < dx < 1.5",
        exceptionCase ? error !== null : movement !== null && movement.x > 1 && movement.x < 1.5),
      checks("predicate error surfaced", error, exceptionCase ? "injected predicate failure" : null,
        exceptionCase ? error?.includes("injected predicate failure") === true : error === null),
      checks("free after query/error", free, "PASS", free === "PASS")
    ] };
}

export async function runQueryProbes() {
  const queries = [], borrows = [];
  for (const version of ["a", "b"]) {
    queries.push(await queryProbe(version), await queryProbe(version, true));
    for (const mode of ["reentrant", "cached", "throwing-callback", "throw-before-callback"]) {
      borrows.push(await borrowProbe(version, mode));
    }
  }
  return { queries, borrows };
}
