import { beforeAll, describe, expect, it } from "vitest";
import R from "@dimforge/rapier3d-compat";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES,
  StructuralValidationError,
  applyStructuralDestructionCommand,
  decodeStructuralObject,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,
  encodeStructuralObject,
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  structuralAddressForBrickCell,
  validateStructuralDestructionCommand,
  type StructuralColliderBoxMeters,
  type StructuralObject
} from "../../src/voxel/structural";
import {
  byteCount,
  algorithmVersion,
  contentRevision,
  fnv1aBytes,
  integrateWorkerResult,
  planningEpoch,
  workerEpoch,
  workerJobId,
  workerTargetKey,
  type TransferableBufferBundle,
  type WorkerJobResult,
  type WorkerResultExpectation
} from "../../src/workers";
import { transitionResidency, type ResidencyState } from "../../src/streaming";
import { canonicalAdaptiveJson } from "../../src/voxel/adaptive";
import {
  PG_DENSITIES,
  createPgTragwerk01,
  pgAccepted,
  pgCommandBudgets,
  pgConnectivityBudgets,
  pgCutCommand,
  pgOccupiedKeys
} from "./pgTragwerkFixture";

/**
 * Paket P-PG-R4 — Persistenz, Residency und Asynchronitaet verbunden.
 *
 * Baut auf dem stabilen R3-Vertrag auf (exakte Partitionsbindung,
 * Step-Punkt-Swap, heterogener Transfer; keine Produktlogik-Aenderung):
 * reine Test-Scheibe ohne UI-/Render-/Szenenaenderung (JSON-/Markdown-
 * Evidence, kein Screenshot).
 *
 * - R4a: Bewegtes Fragment (Pose, Rotation, Geschwindigkeiten, Besitz) ueber
 *   den vorgesehenen Savevertrag (encodeStructuralObject) speichern, Besitzer
 *   und Welt TATSAECHLICH freigeben (Owner-Referenz null, world.free()),
 *   neu laden (decodeStructuralObject), in frischer Welt an gespeicherter
 *   Pose mit gespeicherten Velocities neu installieren, weiter simulieren.
 *   Keine reinen Codec-Roundtrips ohne Freigabe.
 * - R4b: Region TATSAECHLICH evicten (Bodies aus der laufenden Welt entfernt,
 *   Residency Ready->Evicted) und zurueckkehren (Reload aus dem Save,
 *   Neuinstallation in derselben Welt, Evicted->Queued->Loading->Ready)
 *   ohne wiederauferstandene Zellen und ohne Doppel-Bodies.
 * - R4c: Alte Worker-/Proxyresultate werden NACH einem neueren Edit
 *   zugestellt und nachweisbar nicht adoptiert (Authority + neue Revision
 *   unveraendert); Cancel-Pfad (RejectedCancelled) abgedeckt.
 * - R4d: Fail-Pfade des Savevertrags (manipuliert, Uebergroesse,
 *   nicht-kanonisch) fail-closed abgewiesen; Authority unangetastet.
 *
 * Solver-Provenienz wie R3: @dimforge/rapier3d-compat 0.12.0, transitiv,
 * lockfile-pin, ohne Manifest-Eingriff; faellt der Pin weg, bricht der
 * Import explizit (fail-closed).
 */

const SIDE = 0.125;

const generousBudgets = {
  maxFragments: 4,
  maxCollidersPerFragment: 8,
  maxVoxelsPerFragment: 16
} as const;

const componentMassBudgets = {
  maxVisitedCells: 64,
  maxConnectivityCells: 64,
  maxComponents: 16,
  maxConnectivityFacts: 64
} as const;

/** Heterogener Schnitt wie R3: Stuetzenzelle (15,4,0) raus; Traegerzeile
 *  x=14..18/y=5 (2x Stahl + 3x Traeger) als EIN 5-Zellen-Fragment. */
const hetCutBounds = {
  kind: "box",
  space: "global-quantum",
  boundsQuantum: { min: { x: 15, y: 4, z: 0 }, max: { x: 16, y: 5, z: 1 } }
} as const;

const densityOf = (object: StructuralObject, address: Parameters<typeof getStructuralVoxel>[1]): number => {
  const state = getStructuralVoxel(object, address);
  if (state === null || state === undefined) throw new Error("Occupied cell expected.");
  const density = PG_DENSITIES[state.materialId];
  if (!Number.isFinite(density)) throw new Error(`No density for material ${state.materialId}.`);
  return density;
};

const cellCenterMeters = (address: Parameters<typeof getStructuralVoxel>[1]): { x: number; y: number; z: number } => {
  const global = globalQuantumForStructuralCell(address);
  return { x: (global.x + 0.5) * SIDE, y: (global.y + 0.5) * SIDE, z: (global.z + 0.5) * SIDE };
};

const voxelBoxEntries = (
  object: StructuralObject,
  addresses: readonly Parameters<typeof getStructuralVoxel>[1][]
): { box: StructuralColliderBoxMeters; density: number }[] =>
  addresses.map((address) => {
    const center = cellCenterMeters(address);
    return {
      box: {
        minMeters: { x: center.x - SIDE / 2, y: center.y - SIDE / 2, z: center.z - SIDE / 2 },
        maxMeters: { x: center.x + SIDE / 2, y: center.y + SIDE / 2, z: center.z + SIDE / 2 }
      },
      density: densityOf(object, address)
    };
  });

const installCuboids = (
  world: R.World,
  body: R.RigidBody,
  entries: readonly { box: StructuralColliderBoxMeters; density: number }[],
  center: { x: number; y: number; z: number }
): void => {
  for (const entry of entries) {
    const hx = (entry.box.maxMeters.x - entry.box.minMeters.x) / 2;
    const hy = (entry.box.maxMeters.y - entry.box.minMeters.y) / 2;
    const hz = (entry.box.maxMeters.z - entry.box.minMeters.z) / 2;
    world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(
          (entry.box.minMeters.x + entry.box.maxMeters.x) / 2 - center.x,
          (entry.box.minMeters.y + entry.box.minMeters.y) / 2 - center.y,
          (entry.box.minMeters.z + entry.box.maxMeters.z) / 2 - center.z
        )
        .setDensity(entry.density),
      body
    );
  }
};

interface LiveMotionSnapshot {
  readonly translation: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotation: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
  readonly linvel: { readonly x: number; readonly y: number; readonly z: number };
  readonly angvel: { readonly x: number; readonly y: number; readonly z: number };
}

const snapshotBody = (body: R.RigidBody): LiveMotionSnapshot => {
  const t = body.translation();
  const r = body.rotation();
  const lv = body.linvel();
  const av = body.angvel();
  return {
    translation: { x: t.x, y: t.y, z: t.z },
    rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
    linvel: { x: lv.x, y: lv.y, z: lv.z },
    angvel: { x: av.x, y: av.y, z: av.z }
  };
};

const speedOf = (v: { readonly x: number; readonly y: number; readonly z: number }): number =>
  Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

const distanceBetween = (
  a: { readonly x: number; readonly y: number; readonly z: number },
  b: { readonly x: number; readonly y: number; readonly z: number }
): number => speedOf({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

const createGroundWorld = (): { world: R.World; step: () => number; steps: () => number } => {
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  let steps = 0;
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  world.createCollider(
    R.ColliderDesc.cuboid(6.5, 0.5, 5).setTranslation(1.5, -0.5, 0).setDensity(PG_DENSITIES[1]),
    ground
  );
  return {
    world,
    step: (): number => {
      world.step();
      steps += 1;
      return steps;
    },
    steps: (): number => steps
  };
};

const allOccupiedCells = (object: StructuralObject): Parameters<typeof getStructuralVoxel>[1][] => {
  const cells: Parameters<typeof getStructuralVoxel>[1][] = [];
  for (const brick of object.bricks) {
    for (const cell of brick.cells) {
      cells.push(structuralAddressForBrickCell(brick, cell.localIndex));
    }
  }
  return cells;
};

/** Region in eine (frische oder bestehende) Welt installieren: verankert
 *  statisch am Ursprung, Fragment dynamisch an Pose mit Velocities. */
const installRegion = (
  world: R.World,
  object: StructuralObject,
  classification: ReturnType<typeof deriveStructuralComponentClassification>,
  bodyPlan: { readonly centerOfMassMeters: { x: number; y: number; z: number }; readonly massKg: number },
  pose: LiveMotionSnapshot
): { anchoredBody: R.RigidBody; fragmentBody: R.RigidBody } => {
  const anchoredBody = world.createRigidBody(R.RigidBodyDesc.fixed());
  const anchoredCells = classification.anchoredComponents.flatMap((component) => component.occupiedCells);
  installCuboids(world, anchoredBody, voxelBoxEntries(object, anchoredCells), { x: 0, y: 0, z: 0 });
  const fragmentCells = classification.fragments[0].occupiedCells;
  const fragmentBody = world.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(pose.translation.x, pose.translation.y, pose.translation.z)
      .setRotation(pose.rotation)
      .setLinvel(pose.linvel.x, pose.linvel.y, pose.linvel.z)
      .setAngvel({ x: pose.angvel.x, y: pose.angvel.y, z: pose.angvel.z })
      .setLinearDamping(0.1)
      .setAngularDamping(0.5)
      .setCcdEnabled(true)
  );
  installCuboids(world, fragmentBody, voxelBoxEntries(object, fragmentCells), bodyPlan.centerOfMassMeters);
  return { anchoredBody, fragmentBody };
};

/** Het-Cut auf frischem Fixture ueber den vorgesehenen Commandpfad. */
const hetCutLive = (): StructuralObject =>
  pgAccepted(
    applyStructuralDestructionCommand(
      createPgTragwerk01(),
      pgCutCommand(createPgTragwerk01(), hetCutBounds, "command.pg-tragwerk-r4-het-01")
    )
  ).object;

/** Zweiter (neuerer) Edit auf dem Het-Stand: (18,5,0) faellt weg -> Revision 2. */
const newerEdit = (object: StructuralObject): StructuralObject => {
  const command = validateStructuralDestructionCommand({
    schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
    kind: "SubtractBox",
    commandId: "command.pg-tragwerk-r4-edit-02",
    targetObjectId: "object.pg-tragwerk-01",
    expectedObjectRevision: 1,
    resultingObjectRevision: 2,
    expectedAdaptiveSource: object.source,
    materialFilter: null,
    actor: "player.pg-tragwerk-01",
    source: "tool.pg-canonical-cut",
    sequence: 2,
    budgets: pgCommandBudgets,
    shape: { kind: "box", space: "global-quantum", boundsQuantum: { min: { x: 18, y: 5, z: 0 }, max: { x: 19, y: 6, z: 1 } } }
  });
  return pgAccepted(applyStructuralDestructionCommand(object, command)).object;
};

const expectInvalidContract = (fn: () => unknown): void => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(StructuralValidationError);
    expect((error as StructuralValidationError).code).toBe("InvalidContract");
    return;
  }
  throw new Error("Expected save-contract rejection with InvalidContract, but input was accepted.");
};

/** Fail-closed-Abweisung mit beliebigem Structural-Code (z. B. bricht ein
 *  Revisions-Tamper die Revisionsbindung mit InvalidRevision — ebenfalls
 *  fail-closed, niemals partiell adoptiert). */
const expectFailClosed = (fn: () => unknown): void => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(StructuralValidationError);
    return;
  }
  throw new Error("Expected fail-closed save-contract rejection, but input was accepted.");
};

describe("P-PG-R4: Persistenz, Residency, Asynchronitaet verbunden", () => {
  beforeAll(async () => {
    await R.init();
  }, 120_000);

  it("R4a: Bewegtes Fragment — Save, echte Freigabe, Reload, weiter simulieren", () => {
    const preCut = createPgTragwerk01();
    const parentMass = deriveStructuralObjectMassProperties(preCut, { maxVisitedCells: 64 });
    if (parentMass.centerOfMassMeters === null) throw new Error("Fixture requires finite parent center of mass.");
    const preCutCenter = parentMass.centerOfMassMeters;

    // Laufende intakte Welt: Parent-Body ueber voller Prae-Schnitt-Occupancy.
    const running = createGroundWorld();
    const parentBody = running.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(preCutCenter.x, preCutCenter.y, preCutCenter.z)
        .setLinvel(0.1, 0, 0.05)
        .setAngvel({ x: 0, y: 0.1, z: 0 })
    );
    installCuboids(running.world, parentBody, voxelBoxEntries(preCut, allOccupiedCells(preCut)), preCutCenter);
    expect(running.world.bodies.len()).toBe(2);
    expect(running.world.colliders.len()).toBe(28);
    for (let i = 0; i < 20; i += 1) running.step();

    // Schnitt + Transition mit live gelesener Parentmotion (R3-Vertrag).
    const live = hetCutLive();
    const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
    expect(classification.fragments).toHaveLength(1);
    const liveLinvel = parentBody.linvel();
    const liveAngvel = parentBody.angvel();
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      {
        velocityMetersPerSecond: { x: liveLinvel.x, y: liveLinvel.y, z: liveLinvel.z },
        angularVelocityRadPerSecond: { x: liveAngvel.x, y: liveAngvel.y, z: liveAngvel.z }
      },
      generousBudgets,
      componentMassBudgets,
      "live-parent-body"
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("R4a requires an installed plan.");
    const bodyPlan = plan.dynamicBodies[0];

    // Swap am sicheren Simulationspunkt (0 Interim-Steps).
    const stepsBeforeSwap = running.steps();
    running.world.removeRigidBody(parentBody);
    const installed = installRegion(
      running.world,
      live,
      classification,
      bodyPlan,
      {
        translation: { ...bodyPlan.centerOfMassMeters },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        linvel: { ...bodyPlan.initialVelocityMetersPerSecond },
        angvel: { x: liveAngvel.x, y: liveAngvel.y, z: liveAngvel.z }
      }
    );
    expect(running.steps()).toBe(stepsBeforeSwap);
    expect(running.world.bodies.len()).toBe(3);
    expect(running.world.colliders.len()).toBe(27);
    const installPose = snapshotBody(installed.fragmentBody).translation;

    // Fragment bewegen lassen: 2 Steps — faellt schnell (Parent fiel 20 Steps),
    // sicher vor Kontakt, sicher in Bewegung.
    running.step();
    running.step();
    const moved = snapshotBody(installed.fragmentBody);
    expect(distanceBetween(moved.translation, installPose)).toBeGreaterThan(0.005);
    expect(speedOf(moved.linvel)).toBeGreaterThan(0.05);

    // Tatsaechlicher Zustand + Bilanz vor dem Save.
    const keysBefore = pgOccupiedKeys(live);
    expect(keysBefore).toHaveLength(26);
    const massBefore = deriveStructuralObjectMassProperties(live, { maxVisitedCells: 64 }).totalMassKg;
    const solverMassBefore = installed.fragmentBody.mass();
    const relative = (actual: number, expected: number): number =>
      Math.abs(actual - expected) / Math.max(1, Math.abs(expected));
    expect(relative(solverMassBefore, bodyPlan.massKg)).toBeLessThan(1e-6);
    const inventoryBefore = { bodies: running.world.bodies.len(), colliders: running.world.colliders.len() };

    // SAVE ueber den vorgesehenen Savevertrag.
    const saved = encodeStructuralObject(live);

    // ECHTE Freigabe: Besitzer-Referenz faellt weg, Welt wird freigegeben.
    // Die Neuinstallation darf danach nur noch `saved` + Snapshot verwenden
    // (keine alten Handles) — strukturell garantiert, da nichts ueberlebt.
    let owner: { object: StructuralObject; world: R.World; fragmentBody: R.RigidBody } | null = {
      object: live,
      world: running.world,
      fragmentBody: installed.fragmentBody
    };
    owner.world.free();
    owner = null;
    expect(owner).toBeNull();

    // RELOAD aus dem Save in frischer Welt an gespeicherter Pose/Velocities.
    const reloaded = decodeStructuralObject(saved);
    expect(pgOccupiedKeys(reloaded)).toEqual(keysBefore);
    expect(reloaded.objectRevision).toBe(live.objectRevision);
    expect(reloaded.contentHash).toBe(live.contentHash);
    expect(reloaded.evidenceHash).toBe(live.evidenceHash);
    expect(reloaded.commandEvidence).toHaveLength(live.commandEvidence.length);
    expect(deriveStructuralObjectMassProperties(reloaded, { maxVisitedCells: 64 }).totalMassKg).toBe(massBefore);
    const afterClassification = deriveStructuralComponentClassification(reloaded, pgConnectivityBudgets);
    expect(canonicalAdaptiveJson(afterClassification.fragments)).toBe(canonicalAdaptiveJson(classification.fragments));
    const replan = deriveStructuralPhysicsTransition(reloaded, afterClassification, plan.parentMotion, generousBudgets, componentMassBudgets, "live-parent-body");
    expect(replan.contentHash).toBe(plan.contentHash);
    if (replan.status !== "Installed") throw new Error("R4a reload requires an installed replan.");
    const reBodyPlan = replan.dynamicBodies[0];

    const returned = createGroundWorld();
    const reinstalled = installRegion(returned.world, reloaded, afterClassification, reBodyPlan, moved);
    // Kein Doppel, keine Luecke: Inventar identisch zum Pre-Save-Stand.
    expect(returned.world.bodies.len()).toBe(inventoryBefore.bodies);
    expect(returned.world.colliders.len()).toBe(inventoryBefore.colliders);
    const reBody = reinstalled.fragmentBody;
    expect(relative(reBody.mass(), reBodyPlan.massKg)).toBeLessThan(1e-6);
    // Pose + Bewegungszustand erhalten: exakte Wiederherstellung am Snapshot.
    const rePose = snapshotBody(reBody);
    expect(distanceBetween(rePose.translation, moved.translation)).toBeLessThan(1e-9);
    expect(distanceBetween(rePose.linvel, moved.linvel)).toBeLessThan(1e-9);
    expect(distanceBetween(rePose.angvel, moved.angvel)).toBeLessThan(1e-9);
    expect(
      Math.abs(rePose.rotation.x - moved.rotation.x) +
      Math.abs(rePose.rotation.y - moved.rotation.y) +
      Math.abs(rePose.rotation.z - moved.rotation.z) +
      Math.abs(rePose.rotation.w - moved.rotation.w)
    ).toBeLessThan(1e-9);

    // Weiter simulieren: faellt weiter, kollidiert mit dem Stumpf, schlaeft —
    // kein Teleport, keine Explosion, kein Doppel.
    for (let i = 0; i < 3; i += 1) returned.step();
    expect(distanceBetween(snapshotBody(reBody).translation, moved.translation)).toBeGreaterThan(0.005);
    for (let i = 0; i < 1500; i += 1) {
      returned.step();
      if (reBody.isSleeping()) break;
    }
    expect(reBody.isSleeping()).toBe(true);
    const rest = reBody.translation();
    expect(Number.isFinite(rest.x + rest.y + rest.z)).toBe(true);
    expect(rest.y).toBeGreaterThan(0.4);
    expect(rest.y).toBeLessThan(0.7);
    expect(returned.world.bodies.len()).toBe(inventoryBefore.bodies);
    expect(returned.world.colliders.len()).toBe(inventoryBefore.colliders);
    returned.world.free();
  }, 180_000);

  it("R4b: Region evicten und zurueckkehren ohne Res/Doppel (gleiche Welt)", () => {
    const running = createGroundWorld();
    const live = hetCutLive();
    const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      {
        velocityMetersPerSecond: { x: 0.1, y: 0, z: 0.05 },
        angularVelocityRadPerSecond: { x: 0, y: 0.1, z: 0 }
      },
      generousBudgets,
      componentMassBudgets
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("R4b requires an installed plan.");
    const bodyPlan = plan.dynamicBodies[0];

    let residency: ResidencyState = "Ready";
    let region = installRegion(
      running.world,
      live,
      classification,
      bodyPlan,
      {
        translation: { ...bodyPlan.centerOfMassMeters },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        linvel: { ...bodyPlan.initialVelocityMetersPerSecond },
        angvel: { x: 0, y: 0.1, z: 0 }
      }
    );
    expect(running.world.bodies.len()).toBe(3);
    expect(running.world.colliders.len()).toBe(27);

    // Fragment kurz bewegen, dann Save als Rueckkehrquelle.
    running.step();
    running.step();
    const moved = snapshotBody(region.fragmentBody);
    expect(speedOf(moved.linvel)).toBeGreaterThan(0.05);
    const saved = encodeStructuralObject(live);
    const keysBefore = pgOccupiedKeys(live);
    const hashBefore = live.contentHash;

    // TATSAECHLICHER Evict: Region-Bodies aus der laufenden Welt entfernt
    // (nur Ground uebrig), Referenzen fallen weg, Residency -> Evicted.
    residency = transitionResidency(residency, "Evicted");
    running.world.removeRigidBody(region.anchoredBody);
    running.world.removeRigidBody(region.fragmentBody);
    region = null as unknown as typeof region;
    expect(region).toBeNull();
    expect(running.world.bodies.len()).toBe(1);
    expect(running.world.colliders.len()).toBe(1);
    expect(residency).toBe("Evicted");

    // Rueckkehr: Queued -> Loading, Reload aus dem Save, Neuinstallation
    // in DERSELBEN Welt an gespeicherter Pose/Velocities -> Ready.
    residency = transitionResidency(residency, "Queued");
    residency = transitionResidency(residency, "Loading");
    const reloaded = decodeStructuralObject(saved);
    region = installRegion(
      running.world,
      reloaded,
      deriveStructuralComponentClassification(reloaded, pgConnectivityBudgets),
      bodyPlan,
      moved
    );
    residency = transitionResidency(residency, "Ready");
    expect(residency).toBe("Ready");

    // Weder Res noch Doppel: Inventar identisch, Belegung identisch,
    // Klassifikation und Plan-Hash identisch.
    expect(running.world.bodies.len()).toBe(3);
    expect(running.world.colliders.len()).toBe(27);
    expect(pgOccupiedKeys(reloaded)).toEqual(keysBefore);
    expect(reloaded.contentHash).toBe(hashBefore);
    const afterClassification = deriveStructuralComponentClassification(reloaded, pgConnectivityBudgets);
    expect(canonicalAdaptiveJson(afterClassification.fragments)).toBe(canonicalAdaptiveJson(classification.fragments));
    const replan = deriveStructuralPhysicsTransition(reloaded, afterClassification, plan.parentMotion, generousBudgets, componentMassBudgets);
    expect(replan.contentHash).toBe(plan.contentHash);
    const rePose = snapshotBody(region.fragmentBody);
    expect(distanceBetween(rePose.translation, moved.translation)).toBeLessThan(1e-9);

    // Region simuliert weiter und kommt zur Ruhe.
    for (let i = 0; i < 1500; i += 1) {
      running.step();
      if (region.fragmentBody.isSleeping()) break;
    }
    expect(region.fragmentBody.isSleeping()).toBe(true);
    expect(running.world.bodies.len()).toBe(3);
    expect(running.world.colliders.len()).toBe(27);
    running.world.free();
  }, 180_000);

  it("R4c: Stale Worker-/Proxyresultate nach neuerem Edit + Cancel → keine Adoption", () => {
    const before = hetCutLive();
    const authorityKeysBefore = pgOccupiedKeys(before);

    // Neuerer Edit NACH Bindung: Revision 1 -> 2, neuer Content-Hash.
    const authority = newerEdit(before);
    expect(authority.objectRevision).toBe(2);
    expect(authority.contentHash).not.toBe(before.contentHash);
    const authorityKeys = pgOccupiedKeys(authority);
    const authorityHash = authority.contentHash;

    // Erwartung an den NEUEN Stand gebunden (Edit hat Epoch + Revision erhoeht).
    const fresh: WorkerResultExpectation = {
      jobId: workerJobId("pg-tragwerk-r4"),
      cancelled: false,
      planningEpoch: planningEpoch(4),
      workerEpoch: workerEpoch(4),
      targetKey: workerTargetKey("object.pg-tragwerk-01"),
      inputRevision: contentRevision(2),
      outputRevision: contentRevision(3),
      algorithmVersion: algorithmVersion(5),
      maximumOutputBytes: byteCount(4),
      expectedContentHash: fnv1aBytes([new Uint8Array([1, 2, 3, 4]).buffer])
    };
    const payload = new Uint8Array([1, 2, 3, 4]).buffer;
    const hash = fnv1aBytes([payload]);
    const output = (revision: number): TransferableBufferBundle => ({
      ownership: "WorkerToConsumer",
      revision: contentRevision(revision),
      byteLength: byteCount(4),
      buffers: [payload.slice(0)],
      views: [{ name: "bytes", bufferIndex: 0, kind: "Uint8Array", byteOffset: 0, elementCount: 4 }],
      contentHash: hash
    });
    const resultFor = (overrides: Partial<WorkerJobResult>): WorkerJobResult => ({
      jobId: fresh.jobId,
      planningEpoch: fresh.planningEpoch,
      workerEpoch: fresh.workerEpoch,
      targetKey: fresh.targetKey,
      inputRevision: fresh.inputRevision,
      outputRevision: fresh.outputRevision,
      algorithmVersion: fresh.algorithmVersion,
      outputBytes: byteCount(4),
      contentHash: hash,
      ...overrides
    });

    // Adoptions-Modell: nur Accepted wuerde adoptiert (Besitz-Transfer).
    let adopted: TransferableBufferBundle | null = null;
    const deliver = (
      expectation: WorkerResultExpectation,
      result: WorkerJobResult,
      bundle: TransferableBufferBundle
    ): string => {
      const decision = integrateWorkerResult(expectation, result, bundle);
      if (decision.kind === "Accepted") adopted = decision.bundle;
      return decision.kind;
    };

    // Altes Resultat (Epoch 3, Revision 1->2) kommt NACH dem Edit an.
    const staleResult: WorkerJobResult = {
      ...resultFor({}),
      planningEpoch: planningEpoch(3),
      inputRevision: contentRevision(1),
      outputRevision: contentRevision(2)
    };
    expect(deliver(fresh, staleResult, output(2))).toBe("RejectedStalePlanningEpoch");
    // Selbst bei passender Epoch bleibt die alte Input-Revision stale.
    expect(deliver(fresh, { ...staleResult, planningEpoch: planningEpoch(4) }, output(2)))
      .toBe("RejectedRevisionMismatch");
    // Cancel-Pfad: gueltiges Resultat gegen abgebrochene Erwartung.
    const cancelled: WorkerResultExpectation = { ...fresh, cancelled: true };
    expect(deliver(cancelled, resultFor({}), output(3))).toBe("RejectedCancelled");

    // Nachweis: nichts adoptiert; Authority + neue Revision unveraendert.
    expect(adopted).toBeNull();
    expect(pgOccupiedKeys(authority)).toEqual(authorityKeys);
    expect(authority.contentHash).toBe(authorityHash);
    expect(authority.objectRevision).toBe(2);

    // Stale Proxy (Revision 1) ist nach dem Edit unterscheidbar und wird
    // nicht als Truth adoptiert: Consumer-Projektion bleibt Revision 2.
    const proxyFor = (object: StructuralObject): { readonly objectRevision: number; readonly contentHash: string } => ({
      objectRevision: object.objectRevision,
      contentHash: object.contentHash
    });
    const staleProxy = proxyFor(before);
    expect(staleProxy.objectRevision).toBe(1);
    expect(proxyFor(authority)).toEqual({ objectRevision: 2, contentHash: authorityHash });
    expect(staleProxy).not.toEqual(proxyFor(authority));
    expect(authorityKeysBefore).not.toEqual(authorityKeys);
  });

  it("R4d: Save-Failpfade fail-closed (Tamper/Uebergroesse/nicht-kanonisch)", () => {
    const live = hetCutLive();
    const saved = encodeStructuralObject(live);
    const keysBefore = pgOccupiedKeys(live);
    const hashBefore = live.contentHash;

    // Fail 1: manipuliertes Dokument (Revision-Hash-Bindung gebrochen) —
    // fail-closed abgewiesen (Revisionsbindung schlaegt an).
    const tampered = saved.replace('"objectRevision":1', '"objectRevision":0');
    expect(tampered).not.toBe(saved);
    expectFailClosed(() => decodeStructuralObject(tampered));

    // Fail 2: Uebergroesse ueber dem Persistenz-Limit.
    expect(STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES).toBe(16_777_216);
    expectInvalidContract(() =>
      decodeStructuralObject("x".repeat(STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES + 1))
    );

    // Fail 3: gueltige Projektion, aber nicht-kanonische Key-Reihenfolge.
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(parsed).reverse()));
    expect(reordered).not.toBe(saved);
    expectInvalidContract(() => decodeStructuralObject(reordered));

    // Authority unangetastet und weiter ableitbar; Savevertrag intakt.
    expect(pgOccupiedKeys(live)).toEqual(keysBefore);
    expect(live.contentHash).toBe(hashBefore);
    expect(live.objectRevision).toBe(1);
    expect(encodeStructuralObject(live)).toBe(saved);
    expect(decodeStructuralObject(saved).contentHash).toBe(hashBefore);
  });
});
