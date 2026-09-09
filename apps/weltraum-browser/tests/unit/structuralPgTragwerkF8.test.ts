import { describe, expect, it } from "vitest";
import {
  StructuralPhysicsCommitError,
  applyStructuralDestructionCommand,
  commitStructuralPhysicsTransition,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,
  globalQuantumForStructuralCell,
  createStructuralCellAddress,
  type StructuralBodyPoseMotion,
  type StructuralColliderMassSpec,
  type StructuralPhysicsWorldPort,
  type StructuralWorldCuboid
} from "../../src/voxel/structural";
import {
  createPgTragwerk01,
  pgAccepted,
  pgConnectivityBudgets,
  pgCutCommand,
  pgKeyAt
} from "./pgTragwerkFixture";

/**
 * Paket P-PG-F8 — Commitgrenze binden (Fokusaudit-Folge, Abschnitte 4-6).
 *
 * Solver-unabhaengige Regressionen mit zaehlendem World-Port:
 * - F8-A: ungebundene Klassifikation (Fragmentzellen getauscht, Planhash
 *   unveraendert) muss VOR createBody scheitern.
 * - F8-B: leere Anker-Restbelegung muss scheitern (kein stiller Parent-Verlust).
 * - F8-C: Ankerrotation 45° um z — Restbody traegt Parentpose, Offsets lokal;
 *   Punktsonde (0,06/0,06/0) ist ausserhalb (lokal x ~0,08485 > 0,0625).
 *   Reine Geometrie-Punktsonde an installierten Offsets — KEIN
 *   Solver-Kontakt-Claim (P-PROD-P04 Wortlaut).
 * - F8-D: Cleanup-Ehrlichkeit per Fault-Injection (add + remove schlagen
 *   fehl) — worldRestored:false, keine sichere Wiederaufnahme.
 * - F8-E: Parent-Remove-Fehler — Verhalten vor/nach Wirkung +
 *   Caller-Recovery (Rollback-Versuch, worldRestored:false, ehrliche
 *   Cleanup-Flag-Formulierung), inkl. INCOMPLETE-Variante (P-PROD-P04).
 * - F8-F: enger Reentrancy-Nachweis — Doppel-Commit mit stalem Parent-Handle
 *   dupliziert (kein fail-closed Guard); Handles sind single-use,
 *   Caller-Vertrag, keine Engine-Aussage darueber hinaus (P-PROD-P04).
 */

const SIDE = 0.125;
const HALF = SIDE / 2;

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

interface CountingBody {
  id: number;
  pose: StructuralBodyPoseMotion;
  cuboids: { cuboid: StructuralWorldCuboid; mass: StructuralColliderMassSpec }[];
  removed: boolean;
}

interface CountingHarness {
  port: StructuralPhysicsWorldPort<CountingBody>;
  bodies: CountingBody[];
  addCalls: () => number;
}

const createCountingPort = (options?: {
  failAddAt?: number;
  failRemoveIds?: Set<number>;
}): CountingHarness => {
  const bodies: CountingBody[] = [];
  let nextId = 0;
  let adds = 0;
  const live = (b: CountingBody): boolean => !b.removed;
  const port: StructuralPhysicsWorldPort<CountingBody> = {
    bodiesLen: () => bodies.filter(live).length,
    collidersLen: () =>
      bodies.filter(live).reduce((sum, b) => sum + b.cuboids.length, 0),
    createBody: (pose: StructuralBodyPoseMotion): CountingBody => {
      const body: CountingBody = { id: nextId += 1, pose, cuboids: [], removed: false };
      bodies.push(body);
      return body;
    },
    addCollider: (
      body: CountingBody,
      cuboid: StructuralWorldCuboid,
      mass: StructuralColliderMassSpec
    ): void => {
      adds += 1;
      if (options?.failAddAt !== undefined && adds === options.failAddAt) {
        throw new Error("injected addCollider failure");
      }
      body.cuboids.push({ cuboid, mass });
    },
    bodyColliderCount: (body: CountingBody): number => body.cuboids.length,
    removeBody: (body: CountingBody): void => {
      if (options?.failRemoveIds?.has(body.id)) {
        throw new Error(`injected removeBody failure for body ${body.id}`);
      }
      // Zaehlsemantik: entfernte Collider verschwinden mit dem Body.
      body.removed = true;
    }
  };
  return { port, bodies, addCalls: () => adds };
};

/** Parent mit 27 Dichte-Collidern nachstellen (F7-Inventar 1/27). */
const seedParent = (harness: CountingHarness): CountingBody => {
  const parent = harness.port.createBody({
    dynamic: true,
    translationMeters: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    linvelMetersPerSecond: { x: 0, y: 0, z: 0 },
    angvelRadPerSecond: { x: 0, y: 0, z: 0 }
  });
  for (let i = 0; i < 27; i += 1) {
    harness.port.addCollider(
      parent,
      {
        halfExtentsMeters: { x: HALF, y: HALF, z: HALF },
        offsetWrtBodyMeters: { x: 0, y: 0, z: 0 }
      },
      { kind: "massless" }
    );
  }
  return parent;
};

const liveHeteroPlan = (commandId: string) => {
  const fixture = createPgTragwerk01();
  const live = pgAccepted(
    applyStructuralDestructionCommand(fixture, pgCutCommand(fixture, hetCutBounds, commandId))
  ).object;
  const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
  expect(classification.fragments).toHaveLength(1);
  expect(classification.fragments[0].occupiedCells).toHaveLength(5);
  const plan = deriveStructuralPhysicsTransition(
    live,
    classification,
    restParentMotion,
    generousBudgets,
    componentMassBudgets
  );
  expect(plan.status).toBe("Installed");
  if (plan.status !== "Installed") throw new Error("Installed plan required.");
  return { fixture, live, classification, plan };
};

const globalOf = (address: Parameters<typeof globalQuantumForStructuralCell>[0]): string => {
  const g = globalQuantumForStructuralCell(address);
  return `${g.x},${g.y},${g.z}`;
};

/** Minimaler Quaternion-/Vektor-Orakel (unabhaengig vom Produktcode). */
const quatRotate = (
  q: { x: number; y: number; z: number; w: number },
  v: { x: number; y: number; z: number }
): { x: number; y: number; z: number } => {
  const ux = q.y * v.z - q.z * v.y;
  const uy = q.z * v.x - q.x * v.z;
  const uz = q.x * v.y - q.y * v.x;
  const vx = q.y * uz - q.z * uy;
  const vy = q.z * ux - q.x * uz;
  const vz = q.x * uy - q.y * ux;
  return {
    x: v.x + 2 * (q.w * ux + vx),
    y: v.y + 2 * (q.w * uy + vy),
    z: v.z + 2 * (q.w * uz + vz)
  };
};

const quatConjugate = (q: { x: number; y: number; z: number; w: number }) =>
  ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

describe("P-PG-F8: Commitgrenze (Klassifikation/Anker/Cleanup)", () => {
  it("F8-A: getauschte Fragmentzellen bei unveraendertem Planhash scheitern VOR createBody", () => {
    const { live, classification, plan } = liveHeteroPlan("command.pg-tragwerk-f8-a-01");
    // Fragmentzellen (17,5,0),(18,5,0) durch Phantomzellen (3,8,0),(4,8,0) ersetzen.
    const phantomA = createStructuralCellAddress(pgKeyAt(), { x: 3, y: 8, z: 0 });
    const phantomB = createStructuralCellAddress(pgKeyAt(), { x: 4, y: 8, z: 0 });
    const victimKeys = new Set(["17,5,0", "18,5,0"]);
    const phantoms = [phantomA, phantomB];
    let phantomIndex = 0;
    const swappedFragmentCells = classification.fragments[0].occupiedCells.map((address) => {
      if (victimKeys.has(globalOf(address))) {
        const phantom = phantoms[phantomIndex];
        phantomIndex += 1;
        return phantom;
      }
      return address;
    });
    expect(swappedFragmentCells.map(globalOf).sort()).toContain("3,8,0");
    expect(swappedFragmentCells.map(globalOf).sort()).toContain("4,8,0");
    // Zugehoerige Detached-Komponente identisch tauschen (intern konsistent,
    // aber gegen Plan/live-Objektstand falsch); Hashes/Ids bleiben stale.
    const fragmentComponentId = classification.fragments[0].componentId;
    const mutatedClassification = {
      ...classification,
      fragments: [{ ...classification.fragments[0], occupiedCells: swappedFragmentCells }],
      detachedComponents: classification.detachedComponents.map((component) =>
        component.componentId === fragmentComponentId
          ? { ...component, occupiedCells: swappedFragmentCells }
          : component
      )
    };

    const harness = createCountingPort();
    const parentBody = seedParent(harness);
    expect(harness.port.bodiesLen()).toBe(1);
    expect(harness.port.collidersLen()).toBe(27);

    let failure: unknown = null;
    try {
      commitStructuralPhysicsTransition({
        port: harness.port,
        parentBody,
        plan,
        live,
        classification: mutatedClassification
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(StructuralPhysicsCommitError);
    const commitFailure = failure as StructuralPhysicsCommitError;
    expect(commitFailure.phase).toBe("validate");
    expect(commitFailure.worldRestored).toBe(true);
    // Bindungsfehler VOR Weltmutation: kein Body erzeugt, Inventar unberuehrt.
    expect(harness.bodies).toHaveLength(1);
    expect(harness.port.bodiesLen()).toBe(1);
    expect(harness.port.collidersLen()).toBe(27);
  });

  it("F8-B: leere Anker-Restbelegung scheitert (kein stiller Parent-Verlust)", () => {
    const { live, classification, plan } = liveHeteroPlan("command.pg-tragwerk-f8-b-01");
    const harness = createCountingPort();
    const parentBody = seedParent(harness);

    let failure: unknown = null;
    try {
      commitStructuralPhysicsTransition({
        port: harness.port,
        parentBody,
        plan,
        live,
        classification: { ...classification, anchoredComponents: [] }
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(StructuralPhysicsCommitError);
    const commitFailure = failure as StructuralPhysicsCommitError;
    expect(commitFailure.phase).toBe("validate");
    expect(commitFailure.worldRestored).toBe(true);
    // Welt unberuehrt: Parent steht, kein Rest-/Fragmentbody zurueckgelassen.
    expect(harness.bodies).toHaveLength(1);
    expect(harness.port.bodiesLen()).toBe(1);
    expect(harness.port.collidersLen()).toBe(27);
  });

  it("F8-C: 45°-Ankerrotation — Restbody traegt Parentpose, Punktsonde (0,06/0,06/0) ist aussen (kein Solver-Kontakt-Claim)", () => {
    const preCut = createPgTragwerk01();
    const preCutMass = deriveStructuralObjectMassProperties(preCut, { maxVisitedCells: 64 });
    if (preCutMass.centerOfMassMeters === null) throw new Error("Fixture requires finite pre-cut center.");
    const anchor = preCutMass.centerOfMassMeters;

    const live = pgAccepted(
      applyStructuralDestructionCommand(preCut, pgCutCommand(preCut, hetCutBounds, "command.pg-tragwerk-f8-c-01"))
    ).object;
    const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      restParentMotion,
      generousBudgets,
      componentMassBudgets,
      "live-parent-body"
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("Installed plan required.");

    // 45° um z: keine Wuerfelsymmetrie (erst bei 90°).
    const qz = Math.sin(Math.PI / 8);
    const qw = Math.cos(Math.PI / 8);
    expect(qz).toBeCloseTo(0.38268343, 6);
    expect(qw).toBeCloseTo(0.92387953, 6);
    const pose = {
      translationMeters: { x: 1.25, y: -0.4, z: 0.75 },
      rotation: { x: 0, y: 0, z: qz, w: qw }
    };

    const harness = createCountingPort();
    const parentBody = seedParent(harness);
    const receipt = commitStructuralPhysicsTransition({
      port: harness.port,
      parentBody,
      plan,
      live,
      classification,
      parentWorldPose: {
        translationMeters: { ...pose.translationMeters },
        rotation: { ...pose.rotation }
      },
      preCutCenterAuthorMeters: { ...anchor }
    });
    expect(receipt.anchoredColliderCount).toBe(21);

    // Erster erzeugter Body ist der verankerte Rest: Pose muss der Parentpose folgen.
    const anchoredBody = harness.bodies[1];
    expect(anchoredBody.pose.translationMeters.x).toBeCloseTo(pose.translationMeters.x, 9);
    expect(anchoredBody.pose.translationMeters.y).toBeCloseTo(pose.translationMeters.y, 9);
    expect(anchoredBody.pose.translationMeters.z).toBeCloseTo(pose.translationMeters.z, 9);
    expect(anchoredBody.pose.rotation.x).toBeCloseTo(0, 9);
    expect(anchoredBody.pose.rotation.y).toBeCloseTo(0, 9);
    expect(anchoredBody.pose.rotation.z).toBeCloseTo(qz, 9);
    expect(anchoredBody.pose.rotation.w).toBeCloseTo(qw, 9);

    // Lokaler Offset = Autorframe (Zellmitte - Anker), NICHT Weltmitte.
    const firstCell = classification.anchoredComponents[0].occupiedCells[0];
    const g = globalQuantumForStructuralCell(firstCell);
    const authorCenter = { x: (g.x + 0.5) * SIDE, y: (g.y + 0.5) * SIDE, z: (g.z + 0.5) * SIDE };
    const expectedLocal = {
      x: authorCenter.x - anchor.x,
      y: authorCenter.y - anchor.y,
      z: authorCenter.z - anchor.z
    };
    const recorded = anchoredBody.cuboids[0].cuboid.offsetWrtBodyMeters;
    expect(recorded.x).toBeCloseTo(expectedLocal.x, 9);
    expect(recorded.y).toBeCloseTo(expectedLocal.y, 9);
    expect(recorded.z).toBeCloseTo(expectedLocal.z, 9);

    // Punktsonde: W(c) + (0,06/0,06/0) ist im rotierten Wuerfel AUSSEN
    // (lokal x ~0,08485 > 0,0625), im achsparallelen Wuerfel faelschlich innen.
    // P-PROD-P04 Wortlaut: reine installierte-Geometrie-Sonde, kein
    // Solver-Kontakt-Claim (kein Step, keine Kontaktabfrage).
    const off = { x: authorCenter.x - anchor.x, y: authorCenter.y - anchor.y, z: authorCenter.z - anchor.z };
    const rot = quatRotate(pose.rotation, off);
    const worldCenter = {
      x: pose.translationMeters.x + rot.x,
      y: pose.translationMeters.y + rot.y,
      z: pose.translationMeters.z + rot.z
    };
    const probe = { x: worldCenter.x + 0.06, y: worldCenter.y + 0.06, z: worldCenter.z };
    // Installierte Geometrie: Weltmitte = Bodypos + R*Offset.
    const installedCenter = {
      x:
        anchoredBody.pose.translationMeters.x +
        quatRotate(anchoredBody.pose.rotation, {
          x: recorded.x,
          y: recorded.y,
          z: recorded.z
        }).x,
      y:
        anchoredBody.pose.translationMeters.y +
        quatRotate(anchoredBody.pose.rotation, {
          x: recorded.x,
          y: recorded.y,
          z: recorded.z
        }).y,
      z:
        anchoredBody.pose.translationMeters.z +
        quatRotate(anchoredBody.pose.rotation, {
          x: recorded.x,
          y: recorded.y,
          z: recorded.z
        }).z
    };
    const arm = {
      x: probe.x - installedCenter.x,
      y: probe.y - installedCenter.y,
      z: probe.z - installedCenter.z
    };
    const local = quatRotate(quatConjugate(anchoredBody.pose.rotation), arm);
    const inside =
      Math.abs(local.x) <= HALF + 1e-9 &&
      Math.abs(local.y) <= HALF + 1e-9 &&
      Math.abs(local.z) <= HALF + 1e-9;
    // Orakel-Kontrolle: lokale x-Koordinate ~0,08485.
    expect(Math.abs(local.x)).toBeCloseTo(0.0848528, 4);
    expect(inside).toBe(false);
  });

  it("F8-D: doppelter Remove-Fehler nach Add-Fehler meldet worldRestored:false", () => {
    const { live, classification, plan } = liveHeteroPlan("command.pg-tragwerk-f8-d-01");
    // Add-Fehler beim 2. Commit-Collider (verankerter Body steht bereits),
    // Remove des neuen Bodies (Id 2: Parent hat Id 1) schlaegt ebenfalls fehl.
    // Hinweis: seedParent verbraucht 27 Adds im selben Harness.
    const harness = createCountingPort({ failAddAt: 27 + 2, failRemoveIds: new Set([2]) });
    const parentBody = seedParent(harness);
    expect(harness.port.bodiesLen()).toBe(1);

    let failure: unknown = null;
    try {
      commitStructuralPhysicsTransition({
        port: harness.port,
        parentBody,
        plan,
        live,
        classification
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(StructuralPhysicsCommitError);
    const commitFailure = failure as StructuralPhysicsCommitError;
    expect(commitFailure.code).toBe("CommitFailed");
    expect(commitFailure.phase).toBe("create");
    // Ehrlich: Wiederherstellung unvollstaendig — KEIN worldRestored:true.
    expect(commitFailure.worldRestored).toBe(false);
    // Verbleibender Body belegt die unvollstaendige Wiederherstellung.
    expect(harness.port.bodiesLen()).toBeGreaterThan(1);
  });

  it("F8-E: Parent-Remove-Fehler — Rollback-Versuch, worldRestored:false, ehrliche Cleanup-Flag-Formulierung", () => {
    // P-PROD-P04: Verhalten vor/nach Wirkung + Caller-Recovery. Der Commit
    // erstellt Rest (Id 2) + Fragment (Id 3) und scheitert DANN beim
    // Parent-Remove (Id 1). Caller-Recovery: erstellte Bodies werden
    // zurueckgerollt, Parent bleibt gezaehlt, Fehler traegt Phase "remove"
    // und worldRestored:false — niemals eine sichere Wiederaufnahme.
    const { live, classification, plan } = liveHeteroPlan("command.pg-tragwerk-f8-e-01");
    const harness = createCountingPort({ failRemoveIds: new Set([1]) });
    const parentBody = seedParent(harness);
    expect(harness.port.bodiesLen()).toBe(1);
    expect(harness.port.collidersLen()).toBe(27);

    let failure: unknown = null;
    try {
      commitStructuralPhysicsTransition({
        port: harness.port,
        parentBody,
        plan,
        live,
        classification
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(StructuralPhysicsCommitError);
    const commitFailure = failure as StructuralPhysicsCommitError;
    expect(commitFailure.code).toBe("CommitFailed");
    expect(commitFailure.phase).toBe("remove");
    expect(commitFailure.worldRestored).toBe(false);
    // Ehrliche Cleanup-Flag-Formulierung pinnen (Rollback ok-Pfad).
    expect(commitFailure.message).toMatch(/Parent removal failed/);
    expect(commitFailure.message).toMatch(/created bodies rolled back, parent untouched/);
    // Nach Wirkung: Parent weiter gezaehlt, Erstellte abgeraeumt.
    expect(harness.port.bodiesLen()).toBe(1);
    expect(harness.port.collidersLen()).toBe(27);

    // INCOMPLETE-Variante: Parent-Remove UND Cleanup-Remove (Id 2) schlagen
    // fehl — die Meldung muss die unvollstaendige Wiederherstellung mit
    // Remove-Fehlzahl ehrlich flaggen statt "rolled back" zu behaupten.
    const harness2 = createCountingPort({ failRemoveIds: new Set([1, 2]) });
    const parentBody2 = seedParent(harness2);
    let failure2: unknown = null;
    try {
      commitStructuralPhysicsTransition({
        port: harness2.port,
        parentBody: parentBody2,
        plan,
        live,
        classification
      });
    } catch (error) {
      failure2 = error;
    }
    expect(failure2).toBeInstanceOf(StructuralPhysicsCommitError);
    const commitFailure2 = failure2 as StructuralPhysicsCommitError;
    expect(commitFailure2.phase).toBe("remove");
    expect(commitFailure2.worldRestored).toBe(false);
    expect(commitFailure2.message).toMatch(/Parent removal failed/);
    expect(commitFailure2.message).toMatch(/INCOMPLETE \(1 remove failure/);
    // Residueller Body belegt die unvollstaendige Wiederherstellung.
    expect(harness2.port.bodiesLen()).toBeGreaterThan(1);
  });

  it("F8-F: enger Reentrancy-Nachweis — Doppel-Commit mit stalem Parent-Handle dupliziert (single-use Caller-Vertrag)", () => {
    // P-PROD-P04 (enger Nachweis ODER expliziter Portvertrag — hier beides,
    // eng begrenzt): Handles sind single-use und muessen live sein
    // (Port-Kommentar in physicsCommit.ts). Der Commit bietet KEINEN
    // Doppel-Commit-Guard — der zweite Commit mit demselben (bereits
    // entfernten) Parent-Handle laeuft erneut erfolgreich und dupliziert.
    // Das ist dokumentiertes Caller-Fehlverhalten, keine Engine-Garantie
    // darueber hinaus (keine Backend-Matrix, nur Counting-Port).
    const { live, classification, plan } = liveHeteroPlan("command.pg-tragwerk-f8-f-01");
    const harness = createCountingPort();
    const parentBody = seedParent(harness);
    const first = commitStructuralPhysicsTransition({
      port: harness.port,
      parentBody,
      plan,
      live,
      classification
    });
    expect(first.bodiesBefore).toBe(1);
    expect(first.bodiesAfter).toBe(2);
    expect(harness.port.bodiesLen()).toBe(2);

    const second = commitStructuralPhysicsTransition({
      port: harness.port,
      parentBody,
      plan,
      live,
      classification
    });
    // Kein Guard: zweiter Commit dupliziert statt abzuweisen — Caller darf
    // Handles nicht wiederverwenden (single-use, muss live sein).
    expect(second.bodiesBefore).toBe(2);
    expect(second.bodiesAfter).toBe(4);
    expect(harness.port.bodiesLen()).toBe(4);
  });
});
