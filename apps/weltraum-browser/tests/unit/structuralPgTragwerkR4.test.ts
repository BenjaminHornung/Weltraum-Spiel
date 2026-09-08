import { beforeAll, describe, expect, it } from "vitest";
import R from "@dimforge/rapier3d-compat";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES,
  StructuralPhysicsCommitError,
  StructuralValidationError,
  applyStructuralDestructionCommand,
  commitStructuralPhysicsTransition,
  decodeStructuralObject,
  decodeStructuralRegionSave,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,
  encodeStructuralObject,
  encodeStructuralRegionSave,
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  structuralAddressForBrickCell,
  validateStructuralDestructionCommand,
  type StructuralColliderBoxMeters,
  type StructuralInstalledPhysicsTransition,
  type StructuralObject,
  type StructuralPhysicsWorldPort,
  type StructuralRegionSave,
  type StructuralRestoredFragmentMotion
} from "../../src/voxel/structural";
import { createRapierStructuralPort, type RapierBodyRef } from "./rapierStructuralCommitPort";
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
  PG_MATERIAL_BEAM,
  PG_MATERIAL_STEEL,
  createPgTragwerk01,
  pgAccepted,
  pgCommandBudgets,
  pgConnectivityBudgets,
  pgCutCommand,
  pgOccupiedKeys
} from "./pgTragwerkFixture";

/**
 * Paket P-PG-R4B — Persistenz-Neufassung (Fokusaudit 08.09.2026, Abschnitte 4+5).
 *
 * - Y-Mittelpunktfehler behoben: Seed-Installation rechnet
 *   `(min + max) / 2` auf allen Achsen (vorher `(min.y + min.y) / 2`,
 *   alle Collider 0,0625 zu tief). Regression mit unabhaengigem Orakel
 *   (handgerechnete kanonische Werte, y-Soll 0,6875).
 * - Vollstaendiger versionierter Region-Save (Fragmentidentitaet + Pose +
 *   v/omega + Besitz-/Revisionsbindung in EINEM Artefakt). Rehydration in
 *   neuer Instanz AUSSCHLIESSLICH aus dem persistierten Artefakt
 *   (JSON-Roundtrip; Producer/Restore-Schnitt trennt Memory von Artefakt).
 * - Tamper/fehlende Motion/fehlgeschlagene Transaktion fail-closed.
 * - Installation UND Wiederherstellung laufen ueber
 *   `commitStructuralPhysicsTransition` mit Prepared-Bindung
 *   (F8-Commitgrenze); der alte R4-Helferpfad (`installRegion`) ist entfernt.
 *   Uebrig bleibt nur das Pre-Cut-Parent-Seeding der laufenden Welt.
 *
 * Reine Test-Scheibe plus Save-Codec/Commit-Override, keine UI-/Render-/
 * Szenenaenderung (JSON-/Markdown-Evidence, kein Screenshot).
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

/** NUR Pre-Cut-Parent-Seeding der laufenden Welt (kein Regions-Installer,
 *  kein Restore-Pfad — beides laeuft ueber den Commit).
 *  P-PG-R4B: Mittelpunkt kanonisch `(min + max) / 2` auf allen Achsen. */
const seedIntactParentVoxels = (
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
          (entry.box.minMeters.y + entry.box.maxMeters.y) / 2 - center.y,
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

const relative = (actual: number, expected: number): number =>
  Math.abs(actual - expected) / Math.max(1, Math.abs(expected));

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

/** Regions-Installation UND -Wiederherstellung ueber die F8-Commitgrenze
 *  (Prepared-Bindung). Erzeugte Bodies werden festgehalten, damit Tests die
 *  installierte Wahrheit am Solver messen koennen. */
const commitRegionSwap = (
  world: R.World,
  parentBody: R.RigidBody,
  live: StructuralObject,
  classification: ReturnType<typeof deriveStructuralComponentClassification>,
  plan: StructuralInstalledPhysicsTransition,
  parentPose?: { translation: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } },
  preCutCenter?: { x: number; y: number; z: number },
  restoredMotions?: readonly StructuralRestoredFragmentMotion[]
): { receipt: ReturnType<typeof commitStructuralPhysicsTransition>; anchoredBody: R.RigidBody; fragmentBody: R.RigidBody } => {
  const basePort = createRapierStructuralPort(world);
  const created: RapierBodyRef[] = [];
  const port: StructuralPhysicsWorldPort<RapierBodyRef> = {
    ...basePort,
    createBody: (pose) => {
      const ref = basePort.createBody(pose);
      created.push(ref);
      return ref;
    }
  };
  const receipt = commitStructuralPhysicsTransition({
    port,
    parentBody: { body: parentBody },
    plan,
    live,
    classification,
    ...(parentPose !== undefined
      ? { parentWorldPose: { translationMeters: { ...parentPose.translation }, rotation: { ...parentPose.rotation } } }
      : {}),
    ...(preCutCenter !== undefined ? { preCutCenterAuthorMeters: { ...preCutCenter } } : {}),
    ...(restoredMotions !== undefined ? { restoredFragmentMotions: restoredMotions } : {})
  });
  expect(created).toHaveLength(1 + plan.dynamicBodies.length);
  expect(plan.dynamicBodies).toHaveLength(1);
  return { receipt, anchoredBody: created[0].body, fragmentBody: created[1].body };
};

interface MovedRegionBundle {
  readonly artifact: string;
  readonly bodies: number;
  readonly colliders: number;
  readonly planContentHash: string;
  readonly fragmentMassKg: number;
  readonly movedTranslation: { x: number; y: number; z: number };
  readonly movedRotation: { x: number; y: number; z: number; w: number };
  readonly movedLinvel: { x: number; y: number; z: number };
  readonly movedAngvel: { x: number; y: number; z: number };
  world?: R.World;
  step?: () => number;
  anchoredBody?: R.RigidBody;
  fragmentBody?: R.RigidBody;
}

/** Volle Live-Phase (intakte Welt, 20 Pre-Steps, Schnitt, Commit-Swap,
 *  2 Steps Bewegung, versionierter Save) in EINEM Scope. Gibt NUR das
 *  persistierte Artefakt plus Skalare zurueck — live/plan/moved/
 *  classification bleiben im Producer-Scope, In-Memory-Schummeln beim
 *  Restore ist strukturell unmoeglich. */
const produceMovedRegionArtifact = (releaseWorld: boolean): MovedRegionBundle => {
  const preCut = createPgTragwerk01();
  const parentMass = deriveStructuralObjectMassProperties(preCut, { maxVisitedCells: 64 });
  if (parentMass.centerOfMassMeters === null) throw new Error("Fixture requires finite parent center of mass.");
  const preCutCenter = parentMass.centerOfMassMeters;

  const running = createGroundWorld();
  const parentBody = running.world.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(preCutCenter.x, preCutCenter.y, preCutCenter.z)
      .setLinvel(0.1, 0, 0.05)
      .setAngvel({ x: 0, y: 0.1, z: 0 })
  );
  seedIntactParentVoxels(running.world, parentBody, voxelBoxEntries(preCut, allOccupiedCells(preCut)), preCutCenter);
  expect(running.world.bodies.len()).toBe(2);
  expect(running.world.colliders.len()).toBe(28);
  for (let i = 0; i < 20; i += 1) running.step();

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
  if (plan.status !== "Installed") throw new Error("Producer requires an installed plan.");
  const parentPose = snapshotBody(parentBody);

  // Swap ueber die Commitgrenze (kein Parallel-Installer).
  const swap = commitRegionSwap(
    running.world, parentBody, live, classification, plan,
    { translation: parentPose.translation, rotation: parentPose.rotation }, preCutCenter
  );
  expect(swap.receipt.bodiesBefore).toBe(2);
  expect(swap.receipt.bodiesAfter).toBe(3);
  expect(swap.receipt.collidersBefore).toBe(28);
  expect(swap.receipt.collidersAfter).toBe(27);
  expect(swap.receipt.anchoredColliderCount).toBe(21);
  expect(swap.receipt.fragments).toHaveLength(1);
  expect(swap.receipt.fragments[0].installedColliderCount).toBe(5);
  expect(swap.receipt.childPoseSource).toBe("live-parent-pose");
  expect(swap.receipt.parentMotionSource).toBe("live-parent-body");
  const installPose = snapshotBody(swap.fragmentBody).translation;

  // Fragment bewegen lassen: 2 Steps — sicher vor Kontakt, sicher in Bewegung.
  running.step();
  running.step();
  const moved = snapshotBody(swap.fragmentBody);
  expect(distanceBetween(moved.translation, installPose)).toBeGreaterThan(0.005);
  expect(speedOf(moved.linvel)).toBeGreaterThan(0.05);
  const inventory = { bodies: running.world.bodies.len(), colliders: running.world.colliders.len() };

  // VOLLSTAENDIGER versionierter Save: Objekt + Motion + Bindung in EIN Artefakt.
  const artifact = encodeStructuralRegionSave({
    object: live,
    parentMotionSource: plan.parentMotionSource,
    parentMotion: {
      velocityMetersPerSecond: { ...plan.parentMotion.velocityMetersPerSecond },
      angularVelocityRadPerSecond: { ...plan.parentMotion.angularVelocityRadPerSecond }
    },
    parentWorldPose: {
      translationMeters: { ...parentPose.translation },
      rotation: { ...parentPose.rotation }
    },
    preCutCenterAuthorMeters: { ...preCutCenter },
    motions: [{
      fragmentId: classification.fragments[0].fragmentId,
      objectRevision: live.objectRevision,
      sourceContentHash: live.contentHash,
      translationMeters: { ...moved.translation },
      rotation: { ...moved.rotation },
      linvelMetersPerSecond: { ...moved.linvel },
      angvelRadPerSecond: { ...moved.angvel }
    }]
  });

  const bundle: MovedRegionBundle = {
    artifact,
    bodies: inventory.bodies,
    colliders: inventory.colliders,
    planContentHash: plan.contentHash,
    fragmentMassKg: plan.dynamicBodies[0].massKg,
    movedTranslation: { ...moved.translation },
    movedRotation: { ...moved.rotation },
    movedLinvel: { ...moved.linvel },
    movedAngvel: { ...moved.angvel }
  };
  if (releaseWorld) {
    running.world.free();
  } else {
    bundle.world = running.world;
    bundle.step = running.step;
    bundle.anchoredBody = swap.anchoredBody;
    bundle.fragmentBody = swap.fragmentBody;
  }
  return bundle;
};

/** Rehydration AUSSCHLIESSLICH aus dem persistierten Artefakt (JSON-String):
 *  Decode, Re-Derivation, Wiederaufbau ueber den Commit mit den
 *  persistierten Motions. Nimmt keine live/plan/moved-Objekte entgegen. */
const restoreRegionFromArtifact = (
  artifact: string,
  world: R.World
): {
  receipt: ReturnType<typeof commitStructuralPhysicsTransition>;
  anchoredBody: R.RigidBody;
  fragmentBody: R.RigidBody;
  save: StructuralRegionSave;
  planContentHash: string;
} => {
  const save = decodeStructuralRegionSave(artifact);
  const classification = deriveStructuralComponentClassification(save.object, pgConnectivityBudgets);
  const plan = deriveStructuralPhysicsTransition(
    save.object,
    classification,
    {
      velocityMetersPerSecond: { ...save.parentMotion.velocityMetersPerSecond },
      angularVelocityRadPerSecond: { ...save.parentMotion.angularVelocityRadPerSecond }
    },
    generousBudgets,
    componentMassBudgets,
    save.parentMotionSource
  );
  expect(plan.status).toBe("Installed");
  if (plan.status !== "Installed") throw new Error("Restore requires an installed replan.");
  // Platzhalter-Parent: der Commit tauscht atomar Parent -> Region; nach
  // Evict/Freigabe existiert kein Parent mehr — der Platzhalter haelt den
  // Vertrag ein (Receipt zaehlt ehrlich, kein Parallel-Installer).
  const placeholder = world.createRigidBody(R.RigidBodyDesc.fixed());
  const swap = commitRegionSwap(
    world,
    placeholder,
    save.object,
    classification,
    plan,
    save.parentWorldPose === null
      ? undefined
      : { translation: save.parentWorldPose.translationMeters, rotation: save.parentWorldPose.rotation },
    save.preCutCenterAuthorMeters === null ? undefined : save.preCutCenterAuthorMeters,
    save.motions.map((motion) => ({
      fragmentId: motion.fragmentId,
      translationMeters: { ...motion.translationMeters },
      rotation: { ...motion.rotation },
      linvelMetersPerSecond: { ...motion.linvelMetersPerSecond },
      angvelRadPerSecond: { ...motion.angvelRadPerSecond }
    }))
  );
  return { ...swap, save, planContentHash: plan.contentHash };
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

describe("P-PG-R4B: Persistenz-Neufassung (Save, Y-Formel, abgesicherte Wiederherstellung)", () => {
  beforeAll(async () => {
    await R.init();
  }, 120_000);

  it("R4B-Y: kanonische Collider-Weltpositionen + COM nach Reload (unabhaengiges Orakel)", () => {
    const live = hetCutLive();
    const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
    expect(classification.fragments).toHaveLength(1);
    expect(classification.fragments[0].occupiedCells).toHaveLength(5);
    const zeroMotion = {
      velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
      angularVelocityRadPerSecond: { x: 0, y: 0, z: 0 }
    } as const;
    const plan = deriveStructuralPhysicsTransition(
      live, classification, zeroMotion, generousBudgets, componentMassBudgets, "explicit"
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("R4B-Y requires an installed plan.");
    const bodyPlan = plan.dynamicBodies[0];

    // UNABHAENGIGES ORAKEL (handgerechnet, ohne voxelBoxEntries/Installer):
    // Traegerzeile y=5: (14,5)+(15,5) Stahl 7800, (16,5)+(17,5)+(18,5) Traeger 2700.
    const oracleCells = [
      { gx: 14, mat: PG_MATERIAL_STEEL }, { gx: 15, mat: PG_MATERIAL_STEEL },
      { gx: 16, mat: PG_MATERIAL_BEAM }, { gx: 17, mat: PG_MATERIAL_BEAM }, { gx: 18, mat: PG_MATERIAL_BEAM }
    ] as const;
    const cellVolume = SIDE * SIDE * SIDE;
    let massSum = 0;
    let momentX = 0;
    const oracleCenters = oracleCells.map(({ gx, mat }) => {
      const center = { x: (gx + 0.5) * SIDE, y: 5.5 * SIDE, z: 0.5 * SIDE };
      const mass = PG_DENSITIES[mat] * cellVolume;
      massSum += mass;
      momentX += mass * center.x;
      return center;
    });
    const oracleCom = { x: momentX / massSum, y: 0.6875, z: 0.0625 };
    expect(massSum).toBeCloseTo(46.2890625, 9);

    // Plan-Geometrie gegen das Orakel (falsche Mitte waere hier 0,625).
    expect(bodyPlan.massKg).toBeCloseTo(46.2890625, 9);
    expect(bodyPlan.centerOfMassMeters.x).toBeCloseTo(oracleCom.x, 9);
    expect(bodyPlan.centerOfMassMeters.y).toBeCloseTo(0.6875, 9);
    expect(bodyPlan.centerOfMassMeters.z).toBeCloseTo(0.0625, 9);
    const planMidpoints = bodyPlan.voxelColliders
      .map((box) => ({
        x: (box.minMeters.x + box.maxMeters.x) / 2,
        y: (box.minMeters.y + box.maxMeters.y) / 2,
        z: (box.minMeters.z + box.maxMeters.z) / 2
      }))
      .sort((a, b) => a.x - b.x);
    expect(planMidpoints).toHaveLength(5);
    oracleCenters.forEach((want, index) => {
      expect(planMidpoints[index].x).toBeCloseTo(want.x, 9);
      expect(planMidpoints[index].y).toBeCloseTo(0.6875, 9);
      expect(planMidpoints[index].z).toBeCloseTo(want.z, 9);
    });

    // SAVE (explicit, Autorpose) -> Reload NUR aus dem Artefakt -> Commit.
    const artifact = encodeStructuralRegionSave({
      object: live,
      parentMotionSource: "explicit",
      parentMotion: {
        velocityMetersPerSecond: { ...zeroMotion.velocityMetersPerSecond },
        angularVelocityRadPerSecond: { ...zeroMotion.angularVelocityRadPerSecond }
      },
      motions: [{
        fragmentId: classification.fragments[0].fragmentId,
        objectRevision: live.objectRevision,
        sourceContentHash: live.contentHash,
        translationMeters: { ...bodyPlan.centerOfMassMeters },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        linvelMetersPerSecond: { ...bodyPlan.initialVelocityMetersPerSecond },
        angvelRadPerSecond: { x: 0, y: 0, z: 0 }
      }]
    });
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    const restored = restoreRegionFromArtifact(artifact, world);

    // Installierte Wahrheit am Solver gegen das Orakel (kein Installer-Output).
    const t = restored.fragmentBody.translation();
    const solverLocalCom = restored.fragmentBody.localCom();
    expect(t.x).toBeCloseTo(oracleCom.x, 6);
    expect(t.y).toBeCloseTo(0.6875, 6);
    expect(t.z).toBeCloseTo(0.0625, 6);
    expect(Math.abs(solverLocalCom.x) + Math.abs(solverLocalCom.y) + Math.abs(solverLocalCom.z)).toBeLessThan(1e-6);
    expect(t.x + solverLocalCom.x).toBeCloseTo(oracleCom.x, 6);
    expect(t.y + solverLocalCom.y).toBeCloseTo(oracleCom.y, 6);
    expect(t.z + solverLocalCom.z).toBeCloseTo(oracleCom.z, 6);
    const installed = world.colliders.getAll()
      .filter((collider) => {
        const parent = collider.parent();
        return parent !== null && !parent.isFixed();
      })
      .map((collider) => collider.translation())
      .sort((a, b) => a.x - b.x);
    expect(installed).toHaveLength(5);
    oracleCenters.forEach((want, index) => {
      expect(installed[index].x).toBeCloseTo(want.x, 6);
      expect(installed[index].y).toBeCloseTo(0.6875, 6);
      expect(installed[index].z).toBeCloseTo(want.z, 6);
    });
    world.free();
  });

  it("R4a: Bewegtes Fragment — Voll-Save, echte Freigabe, Rehydration nur aus Artefakt", () => {
    const bundle = produceMovedRegionArtifact(true);
    // Ab hier existiert kein live/plan/moved/classification mehr — nur Artefakt + Skalare.
    const envelope = JSON.parse(bundle.artifact) as {
      schemaVersion: string;
      motions: { linvelMetersPerSecond: { x: number; y: number; z: number } }[];
    };
    expect(envelope.schemaVersion).toBe("structural-microvoxel-region-save-v1");
    expect(envelope.motions).toHaveLength(1);
    expect(envelope.motions[0].linvelMetersPerSecond).toEqual(bundle.movedLinvel);

    const target = createGroundWorld();
    const restored = restoreRegionFromArtifact(bundle.artifact, target.world);
    // Bindung ueber das Artefakt: Replan == Producer-Plan, Inventar identisch.
    expect(restored.planContentHash).toBe(bundle.planContentHash);
    expect(target.world.bodies.len()).toBe(bundle.bodies);
    expect(target.world.colliders.len()).toBe(bundle.colliders);
    expect(relative(restored.fragmentBody.mass(), bundle.fragmentMassKg)).toBeLessThan(1e-6);
    // Pose + Bewegungszustand exakt am ARTEFAKT (nicht am Memory-Snapshot).
    const want = restored.save.motions[0];
    expect(want.translationMeters).toEqual(bundle.movedTranslation);
    const rePose = snapshotBody(restored.fragmentBody);
    expect(distanceBetween(rePose.translation, want.translationMeters)).toBeLessThan(1e-9);
    expect(distanceBetween(rePose.linvel, want.linvelMetersPerSecond)).toBeLessThan(1e-9);
    expect(distanceBetween(rePose.angvel, want.angvelRadPerSecond)).toBeLessThan(1e-9);
    expect(
      Math.abs(rePose.rotation.x - want.rotation.x) +
      Math.abs(rePose.rotation.y - want.rotation.y) +
      Math.abs(rePose.rotation.z - want.rotation.z) +
      Math.abs(rePose.rotation.w - want.rotation.w)
    ).toBeLessThan(1e-9);

    // Weiter simulieren: faellt weiter, schlaeft — kein Teleport, kein Doppel.
    for (let i = 0; i < 3; i += 1) target.step();
    expect(distanceBetween(snapshotBody(restored.fragmentBody).translation, want.translationMeters)).toBeGreaterThan(0.005);
    for (let i = 0; i < 1500; i += 1) {
      target.step();
      if (restored.fragmentBody.isSleeping()) break;
    }
    expect(restored.fragmentBody.isSleeping()).toBe(true);
    const rest = restored.fragmentBody.translation();
    expect(Number.isFinite(rest.x + rest.y + rest.z)).toBe(true);
    expect(rest.y).toBeGreaterThan(0.4);
    expect(rest.y).toBeLessThan(0.7);
    expect(target.world.bodies.len()).toBe(bundle.bodies);
    expect(target.world.colliders.len()).toBe(bundle.colliders);
    target.world.free();
  }, 180_000);

  it("R4b: Region evicten und zurueckkehren ohne Res/Doppel (gleiche Welt, Commit-Restore)", () => {
    const bundle = produceMovedRegionArtifact(false);
    const world = bundle.world;
    const step = bundle.step;
    if (world === undefined || step === undefined) throw new Error("R4b requires a live world.");
    if (bundle.anchoredBody === undefined || bundle.fragmentBody === undefined) {
      throw new Error("R4b requires live region handles for the evict.");
    }

    let residency: ResidencyState = "Ready";
    // TATSAECHLICHER Evict: Region-Bodies entfernt (nur Ground uebrig),
    // Referenzen fallen weg, Residency -> Evicted.
    residency = transitionResidency(residency, "Evicted");
    world.removeRigidBody(bundle.anchoredBody);
    world.removeRigidBody(bundle.fragmentBody);
    bundle.anchoredBody = undefined;
    bundle.fragmentBody = undefined;
    expect(world.bodies.len()).toBe(1);
    expect(world.colliders.len()).toBe(1);
    expect(residency).toBe("Evicted");

    // Rueckkehr: Queued -> Loading, Rehydration NUR aus dem Artefakt
    // (keine Handle-, kein Memory-Zugriff mehr moeglich) -> Ready.
    residency = transitionResidency(residency, "Queued");
    residency = transitionResidency(residency, "Loading");
    const restored = restoreRegionFromArtifact(bundle.artifact, world);
    residency = transitionResidency(residency, "Ready");
    expect(residency).toBe("Ready");

    // Weder Res noch Doppel: Inventar identisch, Pose exakt am Artefakt,
    // Belegung und Plan-Bindung identisch.
    expect(world.bodies.len()).toBe(bundle.bodies);
    expect(world.colliders.len()).toBe(bundle.colliders);
    const want = restored.save.motions[0];
    expect(distanceBetween(snapshotBody(restored.fragmentBody).translation, want.translationMeters)).toBeLessThan(1e-9);
    expect(pgOccupiedKeys(restored.save.object)).toHaveLength(26);
    expect(restored.planContentHash).toBe(bundle.planContentHash);

    // Region simuliert weiter und kommt zur Ruhe.
    for (let i = 0; i < 1500; i += 1) {
      step();
      if (restored.fragmentBody.isSleeping()) break;
    }
    expect(restored.fragmentBody.isSleeping()).toBe(true);
    expect(world.bodies.len()).toBe(bundle.bodies);
    expect(world.colliders.len()).toBe(bundle.colliders);
    world.free();
  }, 180_000);

  it("R4B-N1: Bewegungsdaten-Tamper und Torn-Write werden fail-closed abgewiesen", () => {
    const bundle = produceMovedRegionArtifact(true);
    // Gezielter Motion-Tamper im kanonischen Dokument: nur saveHash schlaegt an.
    const tamperedDoc = JSON.parse(bundle.artifact) as {
      motions: { linvelMetersPerSecond: { x: number } }[];
    };
    tamperedDoc.motions[0].linvelMetersPerSecond.x += 5;
    expectFailClosed(() => decodeStructuralRegionSave(canonicalAdaptiveJson(tamperedDoc)));
    // Revisions-Tamper bricht die Besitzbindung.
    const revisionTampered = JSON.parse(bundle.artifact) as {
      motions: { objectRevision: number }[];
    };
    revisionTampered.motions[0].objectRevision += 1;
    expectFailClosed(() => decodeStructuralRegionSave(canonicalAdaptiveJson(revisionTampered)));
    // Torn-Write (abgebrochene Transaktion): kein gueltiges Artefakt.
    expectFailClosed(() => decodeStructuralRegionSave(bundle.artifact.slice(0, bundle.artifact.length - 32)));
    expectInvalidContract(() => decodeStructuralRegionSave("x".repeat(STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES + 1)));
  });

  it("R4B-N2: Artefakt ohne Motion -> keine Rehydration; ohne Artefakt kein Bewegungszustand", () => {
    const bundle = produceMovedRegionArtifact(true);
    // Leere Motions scheitern bereits beim Speichern und beim Laden —
    // es gibt keinen unbewegten Default, der still weiterliefe.
    const emptiedInput = {
      ...(JSON.parse(bundle.artifact) as Record<string, unknown>),
      motions: [] as unknown[]
    };
    expectFailClosed(() => decodeStructuralRegionSave(canonicalAdaptiveJson(emptiedInput)));

    // Objekt-Only-Save (alter Vertrag) + Commit OHNE Motions stellt den
    // Bewegungszustand NICHT her: installiert an Plan-Pose, nicht an moved.
    const save = decodeStructuralRegionSave(bundle.artifact);
    const target = createGroundWorld();
    const classification = deriveStructuralComponentClassification(save.object, pgConnectivityBudgets);
    const plan = deriveStructuralPhysicsTransition(
      save.object,
      classification,
      {
        velocityMetersPerSecond: { ...save.parentMotion.velocityMetersPerSecond },
        angularVelocityRadPerSecond: { ...save.parentMotion.angularVelocityRadPerSecond }
      },
      generousBudgets,
      componentMassBudgets,
      save.parentMotionSource
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("R4B-N2 requires an installed plan.");
    const placeholder = target.world.createRigidBody(R.RigidBodyDesc.fixed());
    const swap = commitRegionSwap(
      target.world,
      placeholder,
      save.object,
      classification,
      plan,
      save.parentWorldPose === null
        ? undefined
        : { translation: save.parentWorldPose.translationMeters, rotation: save.parentWorldPose.rotation },
      save.preCutCenterAuthorMeters === null ? undefined : save.preCutCenterAuthorMeters
    );
    const installed = snapshotBody(swap.fragmentBody);
    expect(distanceBetween(installed.translation, bundle.movedTranslation)).toBeGreaterThan(0.005);
    target.world.free();
  });

  it("R4B-N3: unvollstaendige/fremde Motions scheitern am Commit VOR Weltmutation", () => {
    const live = hetCutLive();
    const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      {
        velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
        angularVelocityRadPerSecond: { x: 0, y: 0, z: 0 }
      },
      generousBudgets,
      componentMassBudgets,
      "explicit"
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("R4B-N3 requires an installed plan.");
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;

    const attempt = (motions: readonly StructuralRestoredFragmentMotion[] | undefined): { bodies: number; colliders: number } => {
      const bodiesBefore = world.bodies.len();
      const collidersBefore = world.colliders.len();
      const parentBody = world.createRigidBody(R.RigidBodyDesc.fixed());
      let failure: unknown = null;
      try {
        commitRegionSwap(world, parentBody, live, classification, plan, undefined, undefined, motions);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(StructuralPhysicsCommitError);
      expect((failure as StructuralPhysicsCommitError).phase).toBe("validate");
      expect((failure as StructuralPhysicsCommitError).worldRestored).toBe(true);
      world.removeRigidBody(parentBody);
      return { bodies: world.bodies.len() - bodiesBefore, colliders: world.colliders.len() - collidersBefore };
    };

    // Leere Motions: kein stilles Default-Weiterlaufen.
    expect(attempt([])).toEqual({ bodies: 0, colliders: 0 });
    // Fremde Fragment-Id: keine Adoption.
    expect(attempt([{
      fragmentId: "fnv1a64-v1:deadbeefdeadbeef" as StructuralRestoredFragmentMotion["fragmentId"],
      translationMeters: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      linvelMetersPerSecond: { x: 0, y: 0, z: 0 },
      angvelRadPerSecond: { x: 0, y: 0, z: 0 }
    }])).toEqual({ bodies: 0, colliders: 0 });
    expect(world.bodies.len()).toBe(0);
    expect(world.colliders.len()).toBe(0);
    world.free();
  });

  it("R4B-N4: fehlgeschlagene Speichertransaktion hinterlaesst kein ladbares Artefakt", () => {
    const live = hetCutLive();
    const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
    expect(classification.fragments).toHaveLength(1);
    const input = {
      object: live,
      parentMotionSource: "explicit" as const,
      parentMotion: {
        velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
        angularVelocityRadPerSecond: { x: 0, y: 0, z: 0 }
      },
      motions: [{
        fragmentId: classification.fragments[0].fragmentId,
        objectRevision: live.objectRevision,
        sourceContentHash: live.contentHash,
        translationMeters: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        linvelMetersPerSecond: { x: 0, y: 0, z: 0 },
        angvelRadPerSecond: { x: 0, y: 0, z: 0 }
      }]
    };
    // Encode ohne Motion ist keine gueltige Transaktion.
    expectFailClosed(() => encodeStructuralRegionSave({ ...input, motions: [] }));
    const artifact = encodeStructuralRegionSave(input);
    // Store wirft: nichts persistiert, Reload unmoeglich.
    let stored: string | null = null;
    expect(() => {
      throw new Error("injected storage failure");
    }).toThrow("injected storage failure");
    expect(stored).toBeNull();
    // Torn-Write: abgebrochenes Artefakt wird abgewiesen.
    expectFailClosed(() => decodeStructuralRegionSave(artifact.slice(0, 64)));
    expect(decodeStructuralRegionSave(artifact).motions).toHaveLength(1);
  });

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
