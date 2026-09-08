import { beforeAll, describe, expect, it } from "vitest";
import R from "@dimforge/rapier3d-compat";
import {
  StructuralPhysicsCommitError,
  applyStructuralDestructionCommand,
  commitStructuralPhysicsTransition,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  structuralAddressForBrickCell,
  type StructuralColliderBoxMeters,
  type StructuralObject
} from "../../src/voxel/structural";
import {
  PG_DENSITIES,
  createPgTragwerk01,
  pgAccepted,
  pgConnectivityBudgets,
  pgCutCommand
} from "./pgTragwerkFixture";
import { createRapierStructuralPort, type RapierBodyRef } from "./rapierStructuralCommitPort";

/**
 * Paket P-PG-F7 — Physik-/Besitzgrenze stabilisieren.
 *
 * Audit-Fixture (Abschnitt 2): heterogene Traegerzeile x=14..18/y=5
 * (2x Stahl 7800 + 3x Traeger 2700), kanonisch Ixx = 0,12054443359375.
 * Audit: installiert gelesen 2,7220325469970703, Impuls J = Ixx -> erwartet
 * Delta-omega = 1, beobachtet 0,04428.
 *
 * - T1 belegt den Dichtepfad-Defekt (Solver antwortet mit 2,722...).
 * - T1b prueft den passenden Pfad (explizite kanonische Masse am Body-COM):
 *   Masse/COM/Tensor/Drehimpuls GEMEINSAM, Delta-omega = 1.
 * - T2 uebernimmt Translation/Rotation des bewegten Parents + Vor-Schnitt-COM
 *   (Bezugspunkt explizit, v_kind im Weltraum) mit unabhaengigem Orakel
 *   (Vor-Schnitt-Objekt, eigene Quaternion-/Kreuzprodukt-Arithmetik).
 * - T2b prueft Drehimpuls unter Rotation (Tensor rotiert mit dem Body).
 * - T3 prueft Commit-Fehler NACH Mutationsbeginn (Rollback, Parent intakt).
 * - T3b prueft denselben Rollback ueber den fail()-Pfad (fehlendes
 *   Plan-Fragment nach Mutationsbeginn statt injiziertem plain Error).
 * - T4 prueft echte Colliderzaehlung + Herkunftslabel.
 *
 * Solver-Provenienz: @dimforge/rapier3d-compat 0.12.0 (transitiv, lockfile-pin,
 * kein Manifest-Eingriff; fail-closed bei Wegfall).
 */

const SIDE = 0.125;

const hetCutBounds = {
  kind: "box",
  space: "global-quantum",
  boundsQuantum: { min: { x: 15, y: 4, z: 0 }, max: { x: 16, y: 5, z: 1 } }
} as const;

const generousBudgets = { maxFragments: 4, maxCollidersPerFragment: 8, maxVoxelsPerFragment: 16 } as const;
const componentMassBudgets = {
  maxVisitedCells: 64,
  maxConnectivityCells: 64,
  maxComponents: 16,
  maxConnectivityFacts: 64
} as const;
const restParentMotion = {
  velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
  angularVelocityRadPerSecond: { x: 0, y: 0, z: 0 }
} as const;

const relative = (actual: number, expected: number): number =>
  Math.abs(actual - expected) / Math.max(1, Math.abs(expected));

const densityOf = (object: StructuralObject, address: Parameters<typeof getStructuralVoxel>[1]): number => {
  const state = getStructuralVoxel(object, address);
  if (state === null || state === undefined) throw new Error("Occupied cell expected.");
  const density = PG_DENSITIES[state.materialId];
  if (!Number.isFinite(density)) throw new Error(`No density for material ${state.materialId}.`);
  return density;
};

/** Dichtepfad-Installation (Audit-Stand): ein Cuboid pro Zelle mit Materialdichte. */
const installDensityVoxels = (
  world: R.World,
  body: R.RigidBody,
  object: StructuralObject,
  addresses: readonly Parameters<typeof getStructuralVoxel>[1][],
  center: { x: number; y: number; z: number }
): void => {
  for (const address of addresses) {
    const global = globalQuantumForStructuralCell(address);
    const cx = (global.x + 0.5) * SIDE;
    const cy = (global.y + 0.5) * SIDE;
    const cz = (global.z + 0.5) * SIDE;
    const box: StructuralColliderBoxMeters = {
      minMeters: { x: cx - SIDE / 2, y: cy - SIDE / 2, z: cz - SIDE / 2 },
      maxMeters: { x: cx + SIDE / 2, y: cy + SIDE / 2, z: cz + SIDE / 2 }
    };
    const hx = (box.maxMeters.x - box.minMeters.x) / 2;
    const hy = (box.maxMeters.y - box.minMeters.y) / 2;
    const hz = (box.maxMeters.z - box.minMeters.z) / 2;
    world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(
          (box.minMeters.x + box.maxMeters.x) / 2 - center.x,
          (box.minMeters.y + box.maxMeters.y) / 2 - center.y,
          (box.minMeters.z + box.maxMeters.z) / 2 - center.z
        )
        .setDensity(densityOf(object, address)),
      body
    );
  }
};

const liveHeteroPlan = (commandId: string) => {
  const fixture = createPgTragwerk01();
  const live = pgAccepted(
    applyStructuralDestructionCommand(fixture, pgCutCommand(fixture, hetCutBounds, commandId))
  ).object;
  const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
  expect(classification.fragments).toHaveLength(1);
  expect(classification.fragments[0].occupiedCells).toHaveLength(5);
  return { fixture, live, classification };
};

describe("P-PG-F7: Drehimpulsantwort (Audit-Repro + passender Pfad)", () => {
  beforeAll(async () => {
    await R.init();
  }, 120_000);

  it("T1: Dichtepfad antwortet mit Ixx_eff = 2,722... statt 0,1205 (Defektbeleg)", () => {
    const { live, classification } = liveHeteroPlan("command.pg-tragwerk-f7-t1-01");
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      restParentMotion,
      generousBudgets,
      componentMassBudgets
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("Installed plan required.");
    const bodyPlan = plan.dynamicBodies[0];
    expect(bodyPlan.inertiaTensorKgMetersSquared.xx).toBeCloseTo(0.12054443359375, 12);
    expect(bodyPlan.massKg).toBeCloseTo(46.2890625, 12);
    const com = bodyPlan.centerOfMassMeters;

    const world = new R.World({ x: 0, y: 0, z: 0 });
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(com.x, com.y, com.z)
        .setLinvel(0, 0, 0)
        .setAngvel({ x: 0, y: 0, z: 0 })
        .setLinearDamping(0)
        .setAngularDamping(0)
    );
    installDensityVoxels(world, body, live, classification.fragments[0].occupiedCells, com);
    expect(world.colliders.len()).toBe(5);

    // Audit-Zahl am Reader: 2,7220325469970703 statt 0,1205.
    const reader = body.principalInertia();
    expect(relative(reader.x, 2.7220325469970703)).toBeLessThan(1e-6);

    // J = Ixx_kanonisch um +x (Impuls im Abstand 0,25 m vom COM).
    const impulse = bodyPlan.inertiaTensorKgMetersSquared.xx;
    const arm = 0.25;
    body.applyImpulseAtPoint({ x: 0, y: 0, z: impulse / arm }, { x: com.x, y: com.y + arm, z: com.z }, true);
    world.step();
    const angvel = body.angvel();
    // Beobachtet: 0,04428 statt 1 — effektive Traegheit 2,722...
    expect(angvel.x).toBeGreaterThan(0.0442);
    expect(angvel.x).toBeLessThan(0.0444);
    expect(relative(impulse / angvel.x, 2.7220325469970703)).toBeLessThan(1e-6);
    world.free();
  }, 180_000);

  it("T1b: explizite kanonische Masse — Masse/COM/Tensor/Drehimpuls gemeinsam (Delta-omega = 1)", () => {
    const { live, classification } = liveHeteroPlan("command.pg-tragwerk-f7-t1b-01");
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      restParentMotion,
      generousBudgets,
      componentMassBudgets
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("Installed plan required.");
    const bodyPlan = plan.dynamicBodies[0];
    const com = bodyPlan.centerOfMassMeters;
    const tensor = bodyPlan.inertiaTensorKgMetersSquared;

    const world = new R.World({ x: 0, y: 0, z: 0 });
    const port = createRapierStructuralPort(world);
    const ref = port.createBody({
      dynamic: true,
      translationMeters: { ...com },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      linvelMetersPerSecond: { x: 0, y: 0, z: 0 },
      angvelRadPerSecond: { x: 0, y: 0, z: 0 }
    });
    const cells = classification.fragments[0].occupiedCells;
    cells.forEach((address, index) => {
      const global = globalQuantumForStructuralCell(address);
      const boxCenter = { x: (global.x + 0.5) * SIDE, y: (global.y + 0.5) * SIDE, z: (global.z + 0.5) * SIDE };
      const offset = { x: boxCenter.x - com.x, y: boxCenter.y - com.y, z: boxCenter.z - com.z };
      port.addCollider(
        ref,
        { halfExtentsMeters: { x: SIDE / 2, y: SIDE / 2, z: SIDE / 2 }, offsetWrtBodyMeters: offset },
        index === 0
          ? {
              kind: "canonical-body",
              massKg: bodyPlan.massKg,
              centerOfMassLocal: { x: -offset.x, y: -offset.y, z: -offset.z },
              principalInertia: { x: tensor.xx, y: tensor.yy, z: tensor.zz },
              frame: { x: 0, y: 0, z: 0, w: 1 }
            }
          : { kind: "massless" }
      );
    });
    // Echte Zaehler: 5 Voxel-Cuboids installiert (keine Greedy-Listenlaenge).
    expect(port.bodyColliderCount(ref)).toBe(5);

    const body = (ref as RapierBodyRef).body;
    expect(relative(body.mass(), 46.2890625)).toBeLessThan(1e-6);
    const localCom = body.localCom();
    expect(Math.abs(localCom.x) + Math.abs(localCom.y) + Math.abs(localCom.z)).toBeLessThan(1e-6);
    const reader = body.principalInertia();
    expect(relative(reader.x, tensor.xx)).toBeLessThan(1e-6);
    expect(relative(reader.y, tensor.yy)).toBeLessThan(1e-6);
    expect(relative(reader.z, tensor.zz)).toBeLessThan(1e-6);

    const arm = 0.25;
    const jz = tensor.xx / arm;
    body.applyImpulseAtPoint({ x: 0, y: 0, z: jz }, { x: com.x, y: com.y + arm, z: com.z }, true);
    world.step();
    const angvel = body.angvel();
    const linvel = body.linvel();
    expect(angvel.x).toBeCloseTo(1, 3);
    expect(Math.abs(angvel.y) + Math.abs(angvel.z)).toBeLessThan(1e-3);
    expect(linvel.z).toBeCloseTo(jz / bodyPlan.massKg, 6);
    world.free();
  }, 180_000);
});

/** Unabhaengiges Orakel: eigene Quaternion-/Kreuzprodukt-Arithmetik (kein Produktcode). */
const oracleQuatRotate = (
  quat: { x: number; y: number; z: number; w: number },
  vector: { x: number; y: number; z: number }
): { x: number; y: number; z: number } => {
  const ux = quat.y * vector.z - quat.z * vector.y;
  const uy = quat.z * vector.x - quat.x * vector.z;
  const uz = quat.x * vector.y - quat.y * vector.x;
  const vx = quat.y * uz - quat.z * uy;
  const vy = quat.z * ux - quat.x * uz;
  const vz = quat.x * uy - quat.y * ux;
  return {
    x: vector.x + 2 * (quat.w * ux + vx),
    y: vector.y + 2 * (quat.w * uy + vy),
    z: vector.z + 2 * (quat.w * uz + vz)
  };
};

const oracleCross = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): { x: number; y: number; z: number } => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});

describe("P-PG-F7: Parentpose + Vor-Schnitt-COM uebernehmen (Commitfunktion)", () => {
  beforeAll(async () => {
    await R.init();
  }, 120_000);

  it("T2: Translation/Rotation des bewegten Parents + Vor-Schnitt-COM -> Kindpose/COM/Velocities", () => {
    const preCut = createPgTragwerk01();
    const preCutMass = deriveStructuralObjectMassProperties(preCut, { maxVisitedCells: 64 });
    if (preCutMass.centerOfMassMeters === null) throw new Error("Fixture requires finite pre-cut center of mass.");
    const anchor = preCutMass.centerOfMassMeters;

    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;
    const preCutCells: Parameters<typeof getStructuralVoxel>[1][] = [];
    for (const brick of preCut.bricks) {
      for (const cell of brick.cells) {
        preCutCells.push(structuralAddressForBrickCell(brick, cell.localIndex));
      }
    }
    const parentBody = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(anchor.x, anchor.y, anchor.z)
        // Rein vertikal + Gier: kein seitliches Abrutschen vom 1-Zellen-Stumpf.
        .setLinvel(0, -0.1, 0)
        // Gier-only Spin: kippt die Traegerzeile nicht vom Stuetzenstumpf,
        // Rotation bleibt trotzdem echt (Quaternion != Identitaet).
        .setAngvel({ x: 0, y: 0.05, z: 0 })
        .setLinearDamping(0)
        .setAngularDamping(0)
    );
    installDensityVoxels(world, parentBody, preCut, preCutCells, anchor);
    expect(world.bodies.len()).toBe(1);
    expect(world.colliders.len()).toBe(27);

    // Bewegter Parent: 20 Steps vor dem Schnitt.
    for (let i = 0; i < 20; i += 1) world.step();
    const livePos = parentBody.translation();
    const liveRot = parentBody.rotation();
    const liveLin = parentBody.linvel();
    const liveAng = parentBody.angvel();
    expect(Math.hypot(livePos.x - anchor.x, livePos.y - anchor.y, livePos.z - anchor.z)).toBeGreaterThan(0.01);
    expect(Math.hypot(liveRot.x, liveRot.y, liveRot.z)).toBeGreaterThan(1e-3);

    const live = pgAccepted(
      applyStructuralDestructionCommand(preCut, pgCutCommand(preCut, hetCutBounds, "command.pg-tragwerk-f7-t2-01"))
    ).object;
    const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
    expect(classification.fragments).toHaveLength(1);
    const postCutMass = deriveStructuralObjectMassProperties(live, { maxVisitedCells: 64 });
    if (postCutMass.centerOfMassMeters === null) throw new Error("Live object requires finite center of mass.");
    // Orakel-Unabhaengigkeit: Vor-Schnitt-COM != Nach-Schnitt-COM.
    const postCut = postCutMass.centerOfMassMeters;
    expect(Math.hypot(anchor.x - postCut.x, anchor.y - postCut.y, anchor.z - postCut.z)).toBeGreaterThan(1e-6);

    const liveMotion = {
      velocityMetersPerSecond: { x: liveLin.x, y: liveLin.y, z: liveLin.z },
      angularVelocityRadPerSecond: { x: liveAng.x, y: liveAng.y, z: liveAng.z }
    } as const;
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      liveMotion,
      generousBudgets,
      componentMassBudgets,
      "live-parent-body"
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("Installed plan required.");
    const bodyPlan = plan.dynamicBodies[0];

    const basePort = createRapierStructuralPort(world);
    const createdRefs: RapierBodyRef[] = [];
    const port = {
      ...basePort,
      createBody: (pose: Parameters<typeof basePort.createBody>[0]): RapierBodyRef => {
        const ref = basePort.createBody(pose);
        createdRefs.push(ref);
        return ref;
      }
    };
    const receipt = commitStructuralPhysicsTransition({
      port,
      parentBody: { body: parentBody },
      plan,
      live,
      classification,
      parentWorldPose: {
        translationMeters: { x: livePos.x, y: livePos.y, z: livePos.z },
        rotation: { x: liveRot.x, y: liveRot.y, z: liveRot.z, w: liveRot.w }
      },
      preCutCenterAuthorMeters: { ...anchor }
    });

    // Unabhaengiges Orakel: W(c) = T + R*(c - A), v = v_p + w x (W(c) - T).
    const quat = { x: liveRot.x, y: liveRot.y, z: liveRot.z, w: liveRot.w };
    const origin = { x: livePos.x, y: livePos.y, z: livePos.z };
    const center = bodyPlan.centerOfMassMeters;
    const off = { x: center.x - anchor.x, y: center.y - anchor.y, z: center.z - anchor.z };
    const rot = oracleQuatRotate(quat, off);
    const expectedPos = { x: origin.x + rot.x, y: origin.y + rot.y, z: origin.z + rot.z };
    const armVec = { x: expectedPos.x - origin.x, y: expectedPos.y - origin.y, z: expectedPos.z - origin.z };
    const swirl = oracleCross({ x: liveAng.x, y: liveAng.y, z: liveAng.z }, armVec);
    const expectedVel = { x: liveLin.x + swirl.x, y: liveLin.y + swirl.y, z: liveLin.z + swirl.z };

    expect(receipt.childPoseSource).toBe("live-parent-pose");
    expect(receipt.parentMotionSource).toBe("live-parent-body");
    expect(receipt.bodiesBefore).toBe(1);
    expect(receipt.bodiesAfter).toBe(2);
    expect(receipt.collidersBefore).toBe(27);
    expect(receipt.collidersAfter).toBe(26);
    expect(receipt.anchoredColliderCount).toBe(21);
    expect(receipt.fragments).toHaveLength(1);
    // Echte Zaehler (keine Greedy-Listenlaenge): 5 Voxel-Cuboids.
    expect(receipt.fragments[0].installedColliderCount).toBe(5);

    // Installiertes Fragment am Orakel messen (Translation/Rotation/Velocities).
    expect(createdRefs).toHaveLength(2);
    const fragmentBody = createdRefs[1].body;
    const installedPos = fragmentBody.translation();
    const installedRot = fragmentBody.rotation();
    const installedLin = fragmentBody.linvel();
    const installedAng = fragmentBody.angvel();
    expect(installedPos.x).toBeCloseTo(expectedPos.x, 6);
    expect(installedPos.y).toBeCloseTo(expectedPos.y, 6);
    expect(installedPos.z).toBeCloseTo(expectedPos.z, 6);
    expect(installedRot.x).toBeCloseTo(quat.x, 6);
    expect(installedRot.y).toBeCloseTo(quat.y, 6);
    expect(installedRot.z).toBeCloseTo(quat.z, 6);
    expect(installedRot.w).toBeCloseTo(quat.w, 6);
    expect(installedLin.x).toBeCloseTo(expectedVel.x, 6);
    expect(installedLin.y).toBeCloseTo(expectedVel.y, 6);
    expect(installedLin.z).toBeCloseTo(expectedVel.z, 6);
    expect(installedAng.x).toBeCloseTo(liveAng.x, 9);
    expect(installedAng.y).toBeCloseTo(liveAng.y, 9);
    expect(installedAng.z).toBeCloseTo(liveAng.z, 9);
    expect(receipt.fragments[0].translationMeters.y).toBeCloseTo(expectedPos.y, 6);
    expect(receipt.fragments[0].translationMeters.z).toBeCloseTo(expectedPos.z, 6);
    expect(receipt.fragments[0].linvelMetersPerSecond.x).toBeCloseTo(expectedVel.x, 6);
    expect(receipt.fragments[0].linvelMetersPerSecond.y).toBeCloseTo(expectedVel.y, 6);
    expect(receipt.fragments[0].linvelMetersPerSecond.z).toBeCloseTo(expectedVel.z, 6);

    // Verankerter Spot-Check: Stuetzenzelle (15,3,0) liegt auf W(Zellmitte).
    const stumpCenter = { x: (15 + 0.5) * SIDE, y: (3 + 0.5) * SIDE, z: 0.0625 };
    const stumpOff = { x: stumpCenter.x - anchor.x, y: stumpCenter.y - anchor.y, z: stumpCenter.z - anchor.z };
    const stumpRot = oracleQuatRotate(quat, stumpOff);
    const stumpExpected = { x: origin.x + stumpRot.x, y: origin.y + stumpRot.y, z: origin.z + stumpRot.z };
    let stumpFound = false;
    world.colliders.forEach((collider) => {
      const t = collider.translation();
      if (
        Math.abs(t.x - stumpExpected.x) < 1e-6 &&
        Math.abs(t.y - stumpExpected.y) < 1e-6 &&
        Math.abs(t.z - stumpExpected.z) < 1e-6
      ) {
        stumpFound = true;
      }
    });
    expect(stumpFound).toBe(true);

    // Solveruebergabe: Masse exakt, installiertes Fragment faellt und schlaeft.
    expect(relative(fragmentBody.mass(), 46.2890625)).toBeLessThan(1e-6);
    const startY = fragmentBody.translation().y;
    for (let i = 0; i < 1500; i += 1) {
      world.step();
      if (fragmentBody.isSleeping()) break;
    }
    const fell = startY - fragmentBody.translation().y;
    expect(fell).toBeGreaterThan(0.05);
    expect(fell).toBeLessThan(0.2);
    expect(fragmentBody.isSleeping()).toBe(true);
    expect(world.bodies.len()).toBe(2);
    expect(world.colliders.len()).toBe(26);
    world.free();
  }, 180_000);

  it("T2b: Drehimpulsantwort unter 90-Grad-Rotation (Tensor rotiert mit dem Body)", () => {
    const preCut = createPgTragwerk01();
    const preCutMass = deriveStructuralObjectMassProperties(preCut, { maxVisitedCells: 64 });
    if (preCutMass.centerOfMassMeters === null) throw new Error("Fixture requires finite pre-cut center of mass.");
    const anchor = preCutMass.centerOfMassMeters;

    // Exakte 90-Grad-Rotation um Y: Body-x -> Welt -z.
    const half = Math.SQRT1_2;
    const pose = {
      translationMeters: { x: 2.5, y: -0.3, z: 0.4 },
      rotation: { x: 0, y: half, z: 0, w: half }
    };
    const world = new R.World({ x: 0, y: 0, z: 0 });
    const parentBody = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(pose.translationMeters.x, pose.translationMeters.y, pose.translationMeters.z)
        .setRotation({ ...pose.rotation })
        .setLinvel(0.2, -0.1, 0.05)
        .setAngvel({ x: 0.1, y: 0.2, z: 0.3 })
        .setLinearDamping(0)
        .setAngularDamping(0)
    );
    const preCutCells: Parameters<typeof getStructuralVoxel>[1][] = [];
    for (const brick of preCut.bricks) {
      for (const cell of brick.cells) {
        preCutCells.push(structuralAddressForBrickCell(brick, cell.localIndex));
      }
    }
    installDensityVoxels(world, parentBody, preCut, preCutCells, anchor);

    const live = pgAccepted(
      applyStructuralDestructionCommand(preCut, pgCutCommand(preCut, hetCutBounds, "command.pg-tragwerk-f7-t2b-01"))
    ).object;
    const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      {
        velocityMetersPerSecond: { x: 0.2, y: -0.1, z: 0.05 },
        angularVelocityRadPerSecond: { x: 0.1, y: 0.2, z: 0.3 }
      },
      generousBudgets,
      componentMassBudgets,
      "live-parent-body"
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("Installed plan required.");
    const bodyPlan = plan.dynamicBodies[0];
    const tensor = bodyPlan.inertiaTensorKgMetersSquared;

    const basePort = createRapierStructuralPort(world);
    const createdRefs: RapierBodyRef[] = [];
    const port = {
      ...basePort,
      createBody: (bodyPose: Parameters<typeof basePort.createBody>[0]): RapierBodyRef => {
        const ref = basePort.createBody(bodyPose);
        createdRefs.push(ref);
        return ref;
      }
    };
    const receipt = commitStructuralPhysicsTransition({
      port,
      parentBody: { body: parentBody },
      plan,
      live,
      classification,
      parentWorldPose: {
        translationMeters: { ...pose.translationMeters },
        rotation: { ...pose.rotation }
      },
      preCutCenterAuthorMeters: { ...anchor }
    });
    expect(receipt.childPoseSource).toBe("live-parent-pose");
    expect(createdRefs).toHaveLength(2);
    const fragmentBody = createdRefs[1].body;
    const installedRot = fragmentBody.rotation();
    expect(installedRot.x).toBeCloseTo(0, 6);
    expect(installedRot.y).toBeCloseTo(half, 6);
    expect(installedRot.z).toBeCloseTo(0, 6);
    expect(installedRot.w).toBeCloseTo(half, 6);
    const reader = fragmentBody.principalInertia();
    expect(relative(reader.x, tensor.xx)).toBeLessThan(1e-6);
    expect(relative(reader.y, tensor.yy)).toBeLessThan(1e-6);
    expect(relative(reader.z, tensor.zz)).toBeLessThan(1e-6);

    // Body-x (Ixx = 0,1205) liegt auf Welt -z: J um Welt-z -> Delta-omega_z = 1.
    const com = receipt.fragments[0].translationMeters;
    const arm = 0.25;
    fragmentBody.applyImpulseAtPoint(
      { x: 0, y: tensor.xx / arm, z: 0 },
      { x: com.x + arm, y: com.y, z: com.z },
      true
    );
    world.step();
    const angvel = fragmentBody.angvel();
    // Initialspin (0,1/0,2/0,3) bleibt, Impuls addiert exakt Delta-omega_z = 1.
    expect(angvel.z).toBeCloseTo(1.3, 3);
    expect(Math.abs(angvel.x - 0.1) + Math.abs(angvel.y - 0.2)).toBeLessThan(1e-3);
    world.free();
  }, 180_000);

  it("T3: Commit-Fehler NACH Mutationsbeginn — Rollback, Parent unberuehrt", () => {
    const { live, classification } = liveHeteroPlan("command.pg-tragwerk-f7-t3-01");
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      restParentMotion,
      generousBudgets,
      componentMassBudgets
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("Installed plan required.");

    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    const preCut = createPgTragwerk01();
    const preCutMass = deriveStructuralObjectMassProperties(preCut, { maxVisitedCells: 64 });
    if (preCutMass.centerOfMassMeters === null) throw new Error("Fixture requires finite center of mass.");
    const parentBody = world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(
        preCutMass.centerOfMassMeters.x,
        preCutMass.centerOfMassMeters.y,
        preCutMass.centerOfMassMeters.z
      )
    );
    const cells: Parameters<typeof getStructuralVoxel>[1][] = [];
    for (const brick of preCut.bricks) {
      for (const cell of brick.cells) {
        cells.push(structuralAddressForBrickCell(brick, cell.localIndex));
      }
    }
    installDensityVoxels(world, parentBody, preCut, cells, preCutMass.centerOfMassMeters);
    expect(world.bodies.len()).toBe(1);
    expect(world.colliders.len()).toBe(27);

    // Sabotage: dritter Collider-Zugriff wirft — Fehler NACH Mutationsbeginn
    // (erster verankerter Body + 1 Collider stehen bereits).
    const basePort = createRapierStructuralPort(world);
    let adds = 0;
    const port = {
      ...basePort,
      addCollider: (
        body: RapierBodyRef,
        cuboid: Parameters<typeof basePort.addCollider>[1],
        mass: Parameters<typeof basePort.addCollider>[2]
      ): void => {
        adds += 1;
        if (adds === 3) throw new Error("injected post-mutation failure");
        basePort.addCollider(body, cuboid, mass);
      }
    };
    let failure: unknown = null;
    try {
      commitStructuralPhysicsTransition({ port, parentBody: { body: parentBody }, plan, live, classification });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(StructuralPhysicsCommitError);
    const commitFailure = failure as StructuralPhysicsCommitError;
    expect(commitFailure.code).toBe("CommitFailed");
    expect(commitFailure.phase).toBe("create");
    expect(commitFailure.worldRestored).toBe(true);
    // Welt exakt wie vor dem Commit: keine partiellen Bodies, Parent intakt.
    expect(world.bodies.len()).toBe(1);
    expect(world.colliders.len()).toBe(27);
    expect(Number.isFinite(parentBody.translation().x)).toBe(true);
    world.free();
  }, 180_000);

  it("T3b: fail()-Fehler NACH Mutationsbeginn (fehlendes Plan-Fragment) — Rollback, Parent unberuehrt", () => {
    const { live, classification } = liveHeteroPlan("command.pg-tragwerk-f7-t3b-01");
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      restParentMotion,
      generousBudgets,
      componentMassBudgets
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("Installed plan required.");

    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    const preCut = createPgTragwerk01();
    const preCutMass = deriveStructuralObjectMassProperties(preCut, { maxVisitedCells: 64 });
    if (preCutMass.centerOfMassMeters === null) throw new Error("Fixture requires finite center of mass.");
    const parentBody = world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(
        preCutMass.centerOfMassMeters.x,
        preCutMass.centerOfMassMeters.y,
        preCutMass.centerOfMassMeters.z
      )
    );
    const cells: Parameters<typeof getStructuralVoxel>[1][] = [];
    for (const brick of preCut.bricks) {
      for (const cell of brick.cells) {
        cells.push(structuralAddressForBrickCell(brick, cell.localIndex));
      }
    }
    installDensityVoxels(world, parentBody, preCut, cells, preCutMass.centerOfMassMeters);
    expect(world.bodies.len()).toBe(1);
    expect(world.colliders.len()).toBe(27);

    // Sabotage ueber den fail()-Pfad: Plan-Fragment fehlt in der
    // Klassifikation — seit P-PG-F8 per Bindung VOR Mutationsbeginn
    // abgewiesen (kein verankerter Body steht dann bereits).
    const port = createRapierStructuralPort(world);
    let failure: unknown = null;
    try {
      commitStructuralPhysicsTransition({
        port,
        parentBody: { body: parentBody },
        plan,
        live,
        classification: { ...classification, fragments: [] }
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(StructuralPhysicsCommitError);
    const commitFailure = failure as StructuralPhysicsCommitError;
    expect(commitFailure.code).toBe("InvalidStructuralState");
    expect(commitFailure.phase).toBe("validate");
    expect(commitFailure.worldRestored).toBe(true);
    // Welt exakt wie vor dem Commit: keine partiellen Bodies, Parent intakt.
    expect(world.bodies.len()).toBe(1);
    expect(world.colliders.len()).toBe(27);
    expect(Number.isFinite(parentBody.translation().x)).toBe(true);
    world.free();
  }, 180_000);

  it("T4: Autorpose-Commit, echte Zaehler, Herkunftslabel", () => {
    const { live, classification } = liveHeteroPlan("command.pg-tragwerk-f7-t4-01");
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      restParentMotion,
      generousBudgets,
      componentMassBudgets
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("Installed plan required.");

    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    const preCut = createPgTragwerk01();
    const preCutMass = deriveStructuralObjectMassProperties(preCut, { maxVisitedCells: 64 });
    if (preCutMass.centerOfMassMeters === null) throw new Error("Fixture requires finite center of mass.");
    const parentBody = world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(
        preCutMass.centerOfMassMeters.x,
        preCutMass.centerOfMassMeters.y,
        preCutMass.centerOfMassMeters.z
      )
    );
    const cells: Parameters<typeof getStructuralVoxel>[1][] = [];
    for (const brick of preCut.bricks) {
      for (const cell of brick.cells) {
        cells.push(structuralAddressForBrickCell(brick, cell.localIndex));
      }
    }
    installDensityVoxels(world, parentBody, preCut, cells, preCutMass.centerOfMassMeters);

    const port = createRapierStructuralPort(world);
    const receipt = commitStructuralPhysicsTransition({
      port,
      parentBody: { body: parentBody },
      plan,
      live,
      classification
    });
    expect(receipt.childPoseSource).toBe("author");
    expect(receipt.parentMotionSource).toBe("explicit");
    expect(receipt.bodiesBefore).toBe(1);
    expect(receipt.bodiesAfter).toBe(2);
    expect(receipt.collidersBefore).toBe(27);
    expect(receipt.collidersAfter).toBe(26);
    expect(receipt.anchoredColliderCount).toBe(21);
    // Fuenf Voxel-Cuboids — NICHT die Greedy-Listenlaenge 1.
    expect(receipt.fragments[0].installedColliderCount).toBe(5);

    // Ehrlicher Variantenvergleich mit echten Zaehlern (-identische Masse).
    const cmpWorld = new R.World({ x: 0, y: -9.81, z: 0 });
    const cmpPort = createRapierStructuralPort(cmpWorld);
    const cmpPlan = plan.dynamicBodies[0];
    const cmpCom = cmpPlan.centerOfMassMeters;
    const cmpTensor = cmpPlan.inertiaTensorKgMetersSquared;
    const mkBody = (): RapierBodyRef =>
      cmpPort.createBody({
        dynamic: true,
        translationMeters: { ...cmpCom },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        linvelMetersPerSecond: { x: 0, y: 0, z: 0 },
        angvelRadPerSecond: { x: 0, y: 0, z: 0 }
      });
    const voxelRef = mkBody();
    classification.fragments[0].occupiedCells.forEach((address, index) => {
      const global = globalQuantumForStructuralCell(address);
      const offset = {
        x: (global.x + 0.5) * SIDE - cmpCom.x,
        y: (global.y + 0.5) * SIDE - cmpCom.y,
        z: (global.z + 0.5) * SIDE - cmpCom.z
      };
      cmpPort.addCollider(
        voxelRef,
        { halfExtentsMeters: { x: SIDE / 2, y: SIDE / 2, z: SIDE / 2 }, offsetWrtBodyMeters: offset },
        index === 0
          ? {
              kind: "canonical-body",
              massKg: cmpPlan.massKg,
              centerOfMassLocal: { x: -offset.x, y: -offset.y, z: -offset.z },
              principalInertia: { x: cmpTensor.xx, y: cmpTensor.yy, z: cmpTensor.zz },
              frame: { x: 0, y: 0, z: 0, w: 1 }
            }
          : { kind: "massless" }
      );
    });
    const greedyRef = mkBody();
    cmpPlan.greedyColliders.forEach((greedy, index) => {
      const offset = {
        x: (greedy.minMeters.x + greedy.maxMeters.x) / 2 - cmpCom.x,
        y: (greedy.minMeters.y + greedy.maxMeters.y) / 2 - cmpCom.y,
        z: (greedy.minMeters.z + greedy.maxMeters.z) / 2 - cmpCom.z
      };
      cmpPort.addCollider(
        greedyRef,
        {
          halfExtentsMeters: {
            x: (greedy.maxMeters.x - greedy.minMeters.x) / 2,
            y: (greedy.maxMeters.y - greedy.minMeters.y) / 2,
            z: (greedy.maxMeters.z - greedy.minMeters.z) / 2
          },
          offsetWrtBodyMeters: offset
        },
        index === 0
          ? {
              kind: "canonical-body",
              massKg: cmpPlan.massKg,
              centerOfMassLocal: { x: -offset.x, y: -offset.y, z: -offset.z },
              principalInertia: { x: cmpTensor.xx, y: cmpTensor.yy, z: cmpTensor.zz },
              frame: { x: 0, y: 0, z: 0, w: 1 }
            }
          : { kind: "massless" }
      );
    });
    expect(cmpPort.bodyColliderCount(voxelRef)).toBe(5);
    expect(cmpPort.bodyColliderCount(greedyRef)).toBe(cmpPlan.greedyColliders.length);
    expect(cmpPlan.greedyColliders.length).toBe(1);
    expect(relative(voxelRef.body.mass(), greedyRef.body.mass())).toBeLessThan(1e-6);
    cmpWorld.free();

    // Herkunftslabel: Live-Pose mit "explicit"-Plan wird abgewiesen.
    const preCutAnchor = preCutMass.centerOfMassMeters;
    let labelFailure: unknown = null;
    try {
      commitStructuralPhysicsTransition({
        port,
        parentBody: { body: parentBody },
        plan,
        live,
        classification,
        parentWorldPose: {
          translationMeters: { ...preCutAnchor },
          rotation: { x: 0, y: 0, z: 0, w: 1 }
        },
        preCutCenterAuthorMeters: { ...preCutAnchor }
      });
    } catch (error) {
      labelFailure = error;
    }
    expect(labelFailure).toBeInstanceOf(StructuralPhysicsCommitError);
    expect((labelFailure as StructuralPhysicsCommitError).code).toBe("InvalidStructuralState");
    world.free();
  }, 180_000);
});
