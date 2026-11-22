import { beforeAll, expect, it } from "vitest";
import { R, initializeHvpRapier, isHvpSolidCollider, isHvpStaticCollider, isHvpSolidNonKinematicCollider } from "../../src/hestia-prototype/physics/rapierPort";

beforeAll(initializeHvpRapier);

const origin = { x: 0, y: 0, z: 0 };
const obstaclePosition = { x: 2, y: 0, z: 0 };
const rotation = { x: 0, y: 0, z: 0, w: 1 };
const displacement = { x: 4, y: 0, z: 0 };
const ray = new R.Ray(origin, { x: 1, y: 0, z: 0 });
const sphere = new R.Ball(0.2);

function observeQueries(world: R.World, controller: R.KinematicCharacterController, mover: R.RigidBody,
  moverCollider: R.Collider, flags: R.QueryFilterFlags | undefined, predicate: (c: R.Collider) => boolean) {
  const tail = [flags, 0x00010001, moverCollider, mover, predicate] as const;
  const rayHits: unknown[] = [];
  world.intersectionsWithRay(ray, 5, true, hit => {
    rayHits.push({ ...hit, collider: hit.collider.handle });
    return true;
  }, ...tail);
  const pointHits: number[] = [];
  world.intersectionsWithPoint(obstaclePosition, collider => {
    pointHits.push(collider.handle);
    return true;
  }, ...tail);
  const shapeHits: number[] = [];
  world.intersectionsWithShape(obstaclePosition, rotation, sphere, collider => {
    shapeHits.push(collider.handle);
    return true;
  }, ...tail);

  const rayHit = world.castRay(ray, 5, true, ...tail);
  const rayNormal = world.castRayAndGetNormal(ray, 5, true, ...tail);
  const shape = world.intersectionWithShape(obstaclePosition, rotation, sphere, ...tail);
  const point = world.projectPoint(obstaclePosition, true, ...tail);
  const feature = world.projectPointAndGetFeature(obstaclePosition, ...tail);
  const sweep = world.castShape(origin, rotation, displacement, sphere, 0, 1, true, ...tail);
  controller.computeColliderMovement(moverCollider, displacement, flags, tail[1], predicate);
  const contacts = Array.from({ length: controller.numComputedCollisions() }, (_, index) => {
    const hit = controller.computedCollision(index)!;
    return { ...hit, collider: hit.collider?.handle };
  });
  return {
    ray: rayHit && { ...rayHit, collider: rayHit.collider.handle },
    rayNormal: rayNormal && { ...rayNormal, collider: rayNormal.collider.handle },
    rayHits, shape: shape?.handle, pointHits, shapeHits,
    point: point && { ...point, collider: point.collider.handle },
    feature: feature && { ...feature, collider: feature.collider.handle },
    sweep: sweep && { ...sweep, collider: sweep.collider.handle },
    kcc: { grounded: controller.computedGrounded(), movement: controller.computedMovement(), contacts }
  };
}

it("matches the borrow-safe reference for all query entry points and every combination of the five filter bits", () => {
  const descriptors = [undefined, R.RigidBodyDesc.fixed, R.RigidBodyDesc.dynamic,
    R.RigidBodyDesc.kinematicPositionBased, R.RigidBodyDesc.kinematicVelocityBased];
  const flags = [undefined, ...Array.from({ length: 32 }, (_, bits) => bits)];
  for (const descriptor of descriptors) for (const sensor of [false, true]) for (const enabled of [false, true]) {
    const world = new R.World(origin);
    try {
      const parent = descriptor && world.createRigidBody(descriptor().setTranslation(2, 0, 0));
      const shape = R.ColliderDesc.ball(0.5).setSensor(sensor).setEnabled(enabled).setCollisionGroups(0x00010001);
      if (!parent) { shape.setTranslation(2, 0, 0); }
      world.createCollider(shape, parent);
      world.createCollider(R.ColliderDesc.ball(0.3).setTranslation(1, 0, 0).setCollisionGroups(0x00020002));
      const mover = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
      const player = world.createCollider(R.ColliderDesc.ball(0.2), mover);
      const controller = world.createCharacterController(0.01);
      world.updateSceneQueries();
      for (const predicate of [isHvpSolidCollider, isHvpStaticCollider, isHvpSolidNonKinematicCollider]) for (const existing of flags) {
        const reference = observeQueries(world, controller, mover, player, existing, c => predicate(c));
        const actual = observeQueries(world, controller, mover, player, existing, predicate);
        expect(actual).toEqual(reference);
      }
    } finally { world.free(); }
  }
});

it("re-evaluates native filter membership, body cascades, snapshot and independent world lifetime", () => {
  const world = new R.World(origin);
  const hit = (world:R.World, filter?:(c:R.Collider)=>boolean) =>
    world.castRay(ray,20,true,undefined,undefined,undefined,undefined,filter)?.collider.handle;
  const ball = R.ColliderDesc.ball;
  try {
    const sensor = world.createCollider(ball(.5).setTranslation(2,0,0).setSensor(true));
    const dynamic = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(4,0,0));
    const active = world.createCollider(ball(.5),dynamic);
    const kin = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(6,0,0));
    world.createCollider(ball(.5), kin);
    const fixed = world.createCollider(ball(.5).setTranslation(8,0,0));
    world.updateSceneQueries();
    expect(hit(world)).toBe(sensor.handle);
    expect(hit(world,isHvpSolidCollider)).toBe(active.handle);
    expect(hit(world,isHvpStaticCollider)).toBe(fixed.handle);
    sensor.setSensor(false);
    world.updateSceneQueries();
    expect(hit(world,isHvpStaticCollider)).toBe(sensor.handle);
    sensor.setEnabled(false);
    world.updateSceneQueries();
    expect(hit(world,isHvpStaticCollider)).toBe(fixed.handle);
    dynamic.setBodyType(R.RigidBodyType.Fixed,true);
    world.updateSceneQueries();
    expect(hit(world,isHvpStaticCollider)).toBe(active.handle);
    dynamic.setEnabled(false);
    world.updateSceneQueries();
    // The pinned solver propagates body enablement to attached colliders during a step.
    const referenceHit = () => hit(world, collider => isHvpStaticCollider(collider));
    expect(hit(world, isHvpStaticCollider)).toBe(referenceHit());
    world.step();
    expect(hit(world, isHvpStaticCollider)).toBe(fixed.handle);
    dynamic.setEnabled(true);
    world.updateSceneQueries();
    expect(hit(world, isHvpStaticCollider)).toBe(referenceHit());
    world.step();
    expect(hit(world, isHvpStaticCollider)).toBe(active.handle);
    const restored = R.World.restoreSnapshot(world.takeSnapshot());
    try {
      restored.updateSceneQueries();
      expect(hit(restored,isHvpStaticCollider)).toBe(active.handle);
      expect(hit(restored,isHvpSolidNonKinematicCollider)).toBe(active.handle);
      world.removeRigidBody(dynamic);
      world.updateSceneQueries();
      expect(hit(world,isHvpStaticCollider)).toBe(fixed.handle);
      const replacement = world.createCollider(ball(.5).setSensor(true).setTranslation(1,0,0));
      const bits = (handle: number) => {
        const bytes = new DataView(new ArrayBuffer(8));
        bytes.setFloat64(0, handle, true);
        return [bytes.getUint32(0, true), bytes.getUint32(4, true)];
      };
      expect(bits(replacement.handle)[0]).toBe(bits(active.handle)[0]);
      expect(bits(replacement.handle)[1]).not.toBe(bits(active.handle)[1]);
      world.updateSceneQueries();
      expect(hit(world)).toBe(replacement.handle);
      expect(hit(world,isHvpSolidNonKinematicCollider)).toBe(fixed.handle);
      expect(hit(world,isHvpStaticCollider)).toBe(fixed.handle);
      expect(hit(restored,isHvpStaticCollider)).toBe(active.handle);
      expect(hit(restored,isHvpSolidNonKinematicCollider)).toBe(active.handle);
      let target = fixed.handle;
      const observed:number[] = [];
      const arbitrary = (collider: R.Collider) => {
        observed.push(collider.handle);
        return collider.handle === target;
      };
      expect(hit(world,arbitrary)).toBe(target);
      expect(observed).toHaveLength(world.colliders.len());
      observed.length = 0;
      target = replacement.handle;
      expect(hit(world,arbitrary)).toBe(target);
      expect(observed).toHaveLength(world.colliders.len());
      expect(()=>hit(world,()=>{throw Error("arbitrary failure");})).toThrow("arbitrary failure");
      expect(hit(world,isHvpStaticCollider)).toBe(fixed.handle);
    } finally { restored.free(); }
    world.removeCollider(fixed,false);
    world.updateSceneQueries();
    expect(hit(world,isHvpStaticCollider)).toBeUndefined();
  } finally { world.free(); }
});

it("avoids a full collider scan for both player aim queries", () => {
  const world = new R.World(origin);
  try {
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(2, 0, 0));
    const target = world.createCollider(R.ColliderDesc.ball(.5), body);
    for (let i = 0; i < 64; ++i) {
      world.createCollider(R.ColliderDesc.ball(.2).setTranslation(i, 20, 0));
    }
    world.updateSceneQueries();
    let visits = 0;
    const visit = world.colliders.forEach.bind(world.colliders);
    world.colliders.forEach = callback => visit(collider => { visits++; callback(collider); });
    const check = (predicate: (collider: R.Collider) => boolean) => {
      expect(world.castRay(ray, 4, true, undefined, undefined, undefined, undefined, predicate)?.collider.handle).toBe(target.handle);
      expect(world.castRayAndGetNormal(ray, 4, true, undefined, undefined, undefined, undefined, predicate)?.collider.handle).toBe(target.handle);
    };
    check(collider => isHvpSolidNonKinematicCollider(collider));
    expect(visits).toBe(world.colliders.len() * 2);
    visits = 0;
    check(isHvpSolidNonKinematicCollider);
    expect(visits).toBe(0);
  } finally { world.free(); }
});
