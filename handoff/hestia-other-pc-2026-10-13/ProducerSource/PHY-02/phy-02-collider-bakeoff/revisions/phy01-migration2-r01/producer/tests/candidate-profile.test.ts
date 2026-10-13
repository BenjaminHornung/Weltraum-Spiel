import { beforeAll, expect, it } from "vitest";
import * as R from "../src/rapier021Candidate";
import { applyStructuralDestructionCommand, deriveStructuralComponentClassification, deriveStructuralPhysicsTransition,
  getStructuralVoxel, globalQuantumForStructuralCell } from "../snapshot/c/src/voxel/structural";
import { PG_DENSITIES, createPgTragwerk01, pgAccepted, pgConnectivityBudgets, pgCutCommand } from "../snapshot/c/tests/unit/pgTragwerkFixture";
import { createHvpPhysicsSession } from "../snapshot/c/src/hestia-prototype/physics/session";
import { collisionSectors } from "../snapshot/c/src/hestia-prototype/physics/terrainColliders";
import { decodeHvpWorld } from "../snapshot/c/src/hestia-prototype/persistence/worldCheckpoint";
import { HVP_SAVE_PROFILES } from "../snapshot/c/src/hestia-prototype/persistence/gameCheckpoint";
beforeAll(() => R.init());
const zero = { x: 0, y: 0, z: 0 }, identity = { x: 0, y: 0, z: 0, w: 1 };

it("corrects the historical F7 density reader and proves its canonical impulse response", () => {
  const fixture = createPgTragwerk01();
  const cut = { kind: "box", space: "global-quantum", boundsQuantum: { min: { x: 15, y: 4, z: 0 }, max: { x: 16, y: 5, z: 1 } } } as const;
  const live = pgAccepted(applyStructuralDestructionCommand(fixture, pgCutCommand(fixture, cut, "command.phy01-density-positive"))).object;
  const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
  const plan = deriveStructuralPhysicsTransition(live, classification,
    { velocityMetersPerSecond: zero, angularVelocityRadPerSecond: zero },
    { maxFragments: 4, maxCollidersPerFragment: 8, maxVoxelsPerFragment: 16 },
    { maxVisitedCells: 64, maxConnectivityCells: 64, maxComponents: 16, maxConnectivityFacts: 64 });
  if (plan.status !== "Installed") { throw new Error("Canonical F7 fixture not installed"); }
  const recipe = plan.dynamicBodies[0]!, com = recipe.centerOfMassMeters, world = new R.World(zero);
  try {
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(com.x, com.y, com.z));
    for (const address of classification.fragments[0]!.occupiedCells) {
      const cell = getStructuralVoxel(live, address), global = globalQuantumForStructuralCell(address);
      if (!cell) { throw new Error("Missing F7 material"); }
      world.createCollider(R.ColliderDesc.cuboid(.0625, .0625, .0625)
        .setTranslation((global.x + .5) * .125 - com.x, (global.y + .5) * .125 - com.y, (global.z + .5) * .125 - com.z)
        .setDensity(PG_DENSITIES[cell.materialId]!), body);
    }
    const mass = (2 * 7800 + 3 * 2700) * .125 ** 3, ixx = mass * .125 ** 2 / 6;
    expect(mass).toBe(46.2890625); expect(ixx).toBe(.12054443359375);
    expect(world.colliders.len()).toBe(5); expect(body.mass()).toBeCloseTo(mass, 5);
    expect(body.principalInertia().x).toBeCloseTo(ixx, 6);
    expect(body.principalInertia().y).toBeCloseTo(recipe.inertiaTensorKgMetersSquared.yy, 5);
    expect(body.principalInertia().z).toBeCloseTo(recipe.inertiaTensorKgMetersSquared.zz, 5);
    body.applyImpulseAtPoint({ x: 0, y: 0, z: ixx / .25 }, { x: com.x, y: com.y + .25, z: com.z }, true);
    world.step(); expect(body.angvel().x).toBeCloseTo(1, 5);
    expect(body.linvel().z).toBeCloseTo(ixx / .25 / mass, 6);
  } finally { world.free(); }
});

it.each([false, true])("binds the actual gyro profile, immediate impulse and native restore (gyro=%s)", gyro => {
  const Ctor = gyro ? R.GyroscopicWorld : R.World, world = new Ctor(zero);
  let restored: R.World | undefined;
  try {
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setAdditionalMassProperties(3, zero, { x: 1, y: 2, z: 3 }, identity)
      .setAngvel({ x: .1, y: .2, z: .3 }));
    // This collider-free fixture must explicitly publish its additional mass before an immediate impulse.
    body.recomputeMassPropertiesFromColliders();
    expect(body.mass()).toBeCloseTo(3, 6); expect(body.principalInertia()).toEqual({ x: 1, y: 2, z: 3 });
    expect(body.gyroscopicForcesEnabled()).toBe(gyro);
    body.applyTorqueImpulse({ x: .4, y: .6, z: .6 }, true);
    const immediate = body.angvel();
    for (const value of Object.values(immediate)) { expect(value).toBeCloseTo(.5, 6); }
    world.step(); const after = body.angvel(), delta = Math.hypot(after.x-immediate.x,after.y-immediate.y,after.z-immediate.z);
    if (gyro) { expect(delta).toBeGreaterThan(.0001); } else { expect(delta).toBeLessThan(.000001); }
    restored = Ctor.restoreSnapshot(world.takeSnapshot());
    expect(restored.getRigidBody(body.handle).gyroscopicForcesEnabled()).toBe(gyro);
    const fresh = restored.createRigidBody(R.RigidBodyDesc.dynamic());
    expect(fresh.gyroscopicForcesEnabled()).toBe(gyro);
  } finally { restored?.free(); world.free(); }
});

it("creates an honestly labelled C checkpoint and rejects both 0.12 and another solver profile before restore", async () => {
  const floor = { sizeX: 16, sizeY: 4, sizeZ: 16, cellMeters: .125, originMeters: { x: -1, y: -.125, z: -1 },
    readSlot: (_x: number, y: number, _z: number) => y === 0 ? 1 : 0 };
  const session = await createHvpPhysicsSession([...collisionSectors(floor)], { x: 0, y: 3, z: 0 }, 9.81,
    undefined, undefined, undefined, "phy01-profile-save");
  try {
    session.pause(); const saved = JSON.parse(JSON.stringify(session.checkpoint())), before = session.read(true);
    expect(saved.solver).toBe(R.PHY01_SOLVER_VERSION); expect(HVP_SAVE_PROFILES.solver).toBe(R.PHY01_SOLVER_VERSION);
    expect(decodeHvpWorld(saved).checkpoint).toEqual(saved);
    expect(() => decodeHvpWorld({ ...saved, solver: "rapier-0.12.0" })).toThrow();
    expect(() => decodeHvpWorld({ ...saved, solver: R.PHY01_GYROSCOPIC_SOLVER_PROFILE.id })).toThrow();
    expect(session.read(true)).toEqual(before);
  } finally { session.dispose(); }
});
