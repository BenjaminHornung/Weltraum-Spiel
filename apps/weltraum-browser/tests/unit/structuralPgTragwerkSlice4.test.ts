import { describe, expect, it } from "vitest";
import { canonicalAdaptiveJson } from "../../src/voxel/adaptive";
import {
  StableWorkerJobQueue,
  algorithmVersion,
  byteCount,
  contentRevision,
  fnv1aBytes,
  integrateWorkerResult,
  jobDeadline,
  planningEpoch,
  workerEpoch,
  workerJobId,
  workerJobKind,
  workerTargetKey,
  type JobPriority,
  type TransferableBufferBundle,
  type WorkerJobRequest,
  type WorkerJobResult,
  type WorkerResultExpectation
} from "../../src/workers";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION,
  STRUCTURAL_MESH_FACE_ORDER,
  STRUCTURAL_MESH_TRIANGLE_CORNER_ORDER,
  applyStructuralDestructionCommand,
  deriveStructuralComponentClassification,
  deriveStructuralPhysicsTransition,
  extractStructuralMeshData,
  validateStructuralDestructionCommand,
  type StructuralPhysicsTransitionBudgets
} from "../../src/voxel/structural";
import {
  createPgTragwerk01,
  pgApplyCanonicalCut,
  pgCommandBudgets,
  pgConnectivityBudgets,
  pgCutBounds,
  pgOccupiedKeys
} from "./pgTragwerkFixture";

/**
 * Paket P-PG-SLICE4 — Proving-Ground-Schlussscheibe, nur G5 + Bildabnahme.
 *
 * Reine Core-Kompositions-Scheibe ohne UI-/Render-/Szenenaenderung
 * (Evidence-Regel wie Slice 1-3: JSON-/Markdown-Evidence, kein Screenshot;
 * kein neuer Renderer, kein Shader, keine Szene — nur bestehende
 * Mesher-/Physik-/Worker-Pfade). Keine neue Src-Logik, kein Schema-Eingriff:
 * alle Primitiven sind auditiert und werden nur komponiert.
 *
 * - K11 Ueberlast: Budgetueberschreitung fuehrt zu expliziter definierter
 *   Rejection (Befehl, Mesh, Worker-Gate, Queue) oder zum semantischen
 *   Fallback mit Debris-Ledger (Physiktransition); persistente Materie wird
 *   niemals still geloescht (Belegung + contentHash unveraendert, im
 *   Fallback jede Fragment-ID entweder dynamisch oder im Debris
 *   nachweisbar, Masse erhalten).
 * - Priorisierung/Starvationgrenze: Urgent zuerst, aber nach 4
 *   Urgent-Dispatches weicht die Queue auf High/Normal aus; ein Normal-Job
 *   verhungert nicht trotz Urgent-Flut (sichtbare definierte Verzoegerung
 *   statt Loeschung). Volle Queue → RejectedQueueFull, Cancel gibt den
 *   Slot explizit frei.
 * - Cancellation: abgebrochene Erwartung → RejectedCancelled, Authority
 *   unangetastet.
 * - K12 Bildabnahme (ohne neuen Renderer): harte achsenparallele Zellen
 *   ueber Collider-Boxen (exakt eine Box pro Zelle, 0,125-m-Raster,
 *   volumenerhaltender Greedy-Merge), Mesher-Vertrag (6 Achsen-Faces,
 *   CCW-Ecken, reine Dreiecke, kein Material-Crossing per bestehendem
 *   Test), keine erfundenen Faces jenseits der Abdeckung
 *   (MissingNeighborCoverage statt Halluzination). AO-Pfad existiert im
 *   Core nicht — Kanten kommen aus harten Quads ohne gemittelte
 *   Vertex-Normalen, daher kein AO-Halo durch Glaettung.
 */

const SIDE = 0.125;
const CELL_VOLUME = SIDE * SIDE * SIDE;

const generousTransitionBudgets: StructuralPhysicsTransitionBudgets = {
  maxFragments: 4,
  maxCollidersPerFragment: 8,
  maxVoxelsPerFragment: 16
};

const componentMassBudgets = {
  maxVisitedCells: 64,
  maxConnectivityCells: 64,
  maxComponents: 16,
  maxConnectivityFacts: 64
} as const;

const spinParentMotion = {
  velocityMetersPerSecond: { x: 1, y: 0.5, z: -0.25 },
  angularVelocityRadPerSecond: { x: 0, y: 1.5, z: 2 }
} as const;

const generousMeshBudgets = {
  maxVisitedCells: 64,
  maxQuads: 1024,
  maxVertices: 4096,
  maxIndices: 6144
} as const;

const boxVolume = (box: {
  readonly minMeters: { x: number; y: number; z: number };
  readonly maxMeters: { x: number; y: number; z: number };
}): number =>
  (box.maxMeters.x - box.minMeters.x) *
  (box.maxMeters.y - box.minMeters.y) *
  (box.maxMeters.z - box.minMeters.z);

const onGrid = (value: number): boolean => {
  const steps = value / SIDE;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
};

const queueRequest = (
  id: string,
  priority: JobPriority,
  deadline = 10
): WorkerJobRequest<{ readonly value: number }> => ({
  jobId: workerJobId(id),
  jobKind: workerJobKind("TransformBuffer"),
  targetKey: workerTargetKey("object.pg-tragwerk-01"),
  planningEpoch: planningEpoch(1),
  workerEpoch: workerEpoch(0),
  inputRevision: contentRevision(1),
  algorithmVersion: algorithmVersion(1),
  priority,
  deadline: jobDeadline(deadline),
  estimatedInputBytes: byteCount(1),
  estimatedOutputBytes: byteCount(1),
  payload: { value: 1 }
});

describe("PG-TRAGWERK-01 proving-ground slice 4 (G5 + Bildabnahme)", () => {
  it("K11: Befehls-Ueberlast wird explizit rejected; Materie unveraendert", () => {
    const fixture = createPgTragwerk01();
    const beforeKeys = pgOccupiedKeys(fixture);
    expect(beforeKeys).toHaveLength(27);
    const beforeHash = fixture.contentHash;

    // Gueltiges, aber viel zu enges Besuchs-Budget: Traversierung gegen maxVisitedCells 1.
    const tight = validateStructuralDestructionCommand({
      schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
      kind: "SubtractBox",
      commandId: "command.pg-tragwerk-overload-01",
      targetObjectId: "object.pg-tragwerk-01",
      expectedObjectRevision: 0,
      resultingObjectRevision: 1,
      expectedAdaptiveSource: fixture.source,
      materialFilter: null,
      actor: "player.pg-tragwerk-01",
      source: "tool.pg-overload-probe",
      sequence: 1,
      budgets: { ...pgCommandBudgets, maxVisitedCells: 1 },
      shape: pgCutBounds
    });
    const result = applyStructuralDestructionCommand(fixture, tight);

    // Expliziter Ledger-Eintrag statt stiller Loeschung/Verzoegerung ohne Spur:
    // Status, Code, Pfad plus zurueckgegebener Authority-Stand (kein partielles
    // Objekt) und Kommando-Bindung sind im Resultat enthalten.
    expect(result.status).toBe("Rejected");
    if (result.status === "Rejected") {
      expect(result.code).toBe("BudgetExceeded");
      expect(result.path).toBe("command/budgets/maxVisitedCells");
      expect(result.commandId).toBe("command.pg-tragwerk-overload-01");
      expect(pgOccupiedKeys(result.object)).toEqual(beforeKeys);
      expect(result.object.contentHash).toBe(beforeHash);
      expect(result.resultHash).not.toBe("");
    }
    // Persistente Materie unangetastet: Belegung, Hash, Evidence-Laenge.
    expect(pgOccupiedKeys(fixture)).toEqual(beforeKeys);
    expect(fixture.contentHash).toBe(beforeHash);
    expect(fixture.commandEvidence).toHaveLength(0);
  });

  it("K11: Mesh-Ueberlast wird explizit rejected; kein partielles Produkt", () => {
    const cut = pgApplyCanonicalCut();
    expect(pgOccupiedKeys(cut.object)).toHaveLength(26);
    const beforeHash = cut.object.contentHash;

    const result = extractStructuralMeshData(cut.object, {
      maxVisitedCells: 1,
      maxQuads: 1024,
      maxVertices: 4096,
      maxIndices: 6144
    });
    expect(result).toEqual({ status: "Rejected", code: "BudgetExceeded", missingNeighborKey: null });
    expect("product" in result).toBe(false);
    // Keine stille Loeschung: Authority-Belegung und Hash unveraendert.
    expect(pgOccupiedKeys(cut.object)).toHaveLength(26);
    expect(cut.object.contentHash).toBe(beforeHash);
  });

  it("K11: Physik-Ueberlast faellt semantisch zurueck; jede Zelle bilanziert", () => {
    const cut = pgApplyCanonicalCut();
    const classification = deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets);
    expect(classification.fragments).toHaveLength(1);

    // Referenz: Installed-Plan mit grosszuegigem Budget (Fragment 2 Zellen).
    const installed = deriveStructuralPhysicsTransition(
      cut.object,
      classification,
      spinParentMotion,
      generousTransitionBudgets,
      componentMassBudgets
    );
    expect(installed.status).toBe("Installed");
    const referenceMass = installed.dynamicBodies.reduce((sum, body) => sum + body.massKg, 0);

    // Ueberlast: Fragment (2 Voxel) gegen maxVoxelsPerFragment 1.
    const squeezed = deriveStructuralPhysicsTransition(
      cut.object,
      classification,
      spinParentMotion,
      { maxFragments: 4, maxCollidersPerFragment: 8, maxVoxelsPerFragment: 1 },
      componentMassBudgets
    );
    expect(squeezed.status).toBe("Fallback");
    if (squeezed.status !== "Fallback") return;
    expect(squeezed.fallbackKind).toBe("merge-excess-fragments-into-single-debris-body");

    // Ledger: jede Fragment-ID entweder dynamisch oder im Debris nachweisbar.
    const allFragmentIds = [...classification.fragments.map((fragment) => fragment.fragmentId)].sort();
    const accounted = [...squeezed.dynamicFragmentIds, ...squeezed.mergedDebrisFragmentIds].sort();
    expect(accounted).toEqual(allFragmentIds);
    expect(squeezed.debris.mergedFragmentIds).toHaveLength(1);

    // Bilanz: kein Voxel verloren, Masse erhalten, Partition vollstaendig.
    const dynamicVoxels = squeezed.dynamicBodies.reduce((sum, body) => sum + body.occupiedVoxelCount, 0);
    expect(dynamicVoxels + squeezed.debris.occupiedVoxelCount).toBe(
      squeezed.occupancyProof.fragmentVoxels
    );
    expect(squeezed.occupancyProof).toEqual({
      totalOccupiedVoxels: 26,
      anchoredVoxels: 24,
      fragmentVoxels: 2,
      disjoint: true,
      complete: true
    });
    const dynamicMass = squeezed.dynamicBodies.reduce((sum, body) => sum + body.massKg, 0);
    expect(dynamicMass + squeezed.debris.massKg).toBeCloseTo(referenceMass, 12);
    expect(squeezed.debris.massKg).toBeCloseTo(2 * 2700 * CELL_VOLUME, 12);

    // Debris-Steiner-Cross-Check (P-PG-R4-Nachtrag, reine Test-Ergaenzung ohne
    // Produktlogik-Aenderung): Single-Member-Sonderfall — das einzige
    // Overflow-Fragment ist dasselbe wie im Installed-Referenzplan.
    expect(squeezed.mergedDebrisFragmentIds).toEqual([installed.dynamicBodies[0].fragmentId]);
    const member = installed.dynamicBodies[0];
    const debris = squeezed.debris;
    // Schwerpunkt des Single-Member-Debris faellt mit dem Fragment-COM zusammen.
    expect(debris.centerOfMassMeters.x).toBeCloseTo(member.centerOfMassMeters.x, 9);
    expect(debris.centerOfMassMeters.y).toBeCloseTo(member.centerOfMassMeters.y, 9);
    expect(debris.centerOfMassMeters.z).toBeCloseTo(member.centerOfMassMeters.z, 9);
    // Unabhaengige Steiner-Nachrechnung: I = I_eigen + m*(|d|^2 E - d d^T)
    // mit d = c_fragment - c_debris.
    const dx = member.centerOfMassMeters.x - debris.centerOfMassMeters.x;
    const dy = member.centerOfMassMeters.y - debris.centerOfMassMeters.y;
    const dz = member.centerOfMassMeters.z - debris.centerOfMassMeters.z;
    const memberTensor = member.inertiaTensorKgMetersSquared;
    const debrisTensor = debris.inertiaTensorKgMetersSquared;
    expect(debrisTensor.xx).toBeCloseTo(memberTensor.xx + member.massKg * (dy * dy + dz * dz), 12);
    expect(debrisTensor.yy).toBeCloseTo(memberTensor.yy + member.massKg * (dx * dx + dz * dz), 12);
    expect(debrisTensor.zz).toBeCloseTo(memberTensor.zz + member.massKg * (dx * dx + dy * dy), 12);
    expect(debrisTensor.xy).toBeCloseTo(memberTensor.xy - member.massKg * dx * dy, 12);
    expect(debrisTensor.xz).toBeCloseTo(memberTensor.xz - member.massKg * dx * dz, 12);
    expect(debrisTensor.yz).toBeCloseTo(memberTensor.yz - member.massKg * dy * dz, 12);
    // Single-Member-Folge (d ~ 0): Debris-Tensor == Fragment-Eigentensor.
    expect(debrisTensor.xx).toBeCloseTo(memberTensor.xx, 9);
    expect(debrisTensor.yy).toBeCloseTo(memberTensor.yy, 9);
    expect(debrisTensor.zz).toBeCloseTo(memberTensor.zz, 9);
    expect(Math.abs(debrisTensor.xy) + Math.abs(debrisTensor.xz) + Math.abs(debrisTensor.yz)).toBeLessThan(1e-9);

    // Determinismus: erneute Ableitung liefert denselben Ledger-Hash.
    const again = deriveStructuralPhysicsTransition(
      cut.object,
      classification,
      spinParentMotion,
      { maxFragments: 4, maxCollidersPerFragment: 8, maxVoxelsPerFragment: 1 },
      componentMassBudgets
    );
    expect(again.contentHash).toBe(squeezed.contentHash);
  });

  it("K11: Queue-Volllauf, Cancel-Freigabe, Priorisierung, Starvationgrenze", () => {
    // Volllauf: Kapazitaet 2, drittes Enqueue wird explizit abgewiesen.
    const bounded = new StableWorkerJobQueue(2);
    expect(bounded.enqueue(queueRequest("pg-u-0", "Urgent", 1)).kind).toBe("Accepted");
    expect(bounded.enqueue(queueRequest("pg-n-0", "Normal", 2)).kind).toBe("Accepted");
    const full = bounded.enqueue(queueRequest("pg-h-0", "High", 0));
    expect(full.kind).toBe("RejectedQueueFull");
    // Ledger: Snapshot dokumentiert beide wartenden Jobs — nichts still gefallen.
    expect(bounded.size).toBe(2);
    expect(bounded.snapshot().jobs.map((job) => job.jobId).sort()).toEqual(["pg-n-0", "pg-u-0"]);

    // Cancel: explizite Rueckgabe des Jobs, Slot wird sichtbar frei (Verzoegerung, kein Verlust).
    const cancelled = bounded.cancel(workerJobId("pg-u-0"));
    expect(cancelled?.jobId).toBe("pg-u-0");
    expect(bounded.size).toBe(1);
    expect(bounded.enqueue(queueRequest("pg-h-0", "High", 0)).kind).toBe("Accepted");
    // Priorisierung: High/Urgent vor Normal.
    expect(bounded.dispatchNext()?.jobId).toBe("pg-h-0");
    expect(bounded.dispatchNext()?.jobId).toBe("pg-n-0");
    expect(bounded.dispatchNext()).toBeUndefined();

    // Starvationgrenze: Normal verhungert nicht trotz Urgent-Flut.
    const flooded = new StableWorkerJobQueue(32);
    for (let index = 0; index < 10; index += 1) {
      expect(flooded.enqueue(queueRequest(`pg-flood-${index}`, "Urgent", index)).kind).toBe("Accepted");
    }
    expect(flooded.enqueue(queueRequest("pg-pinned", "Normal", 0)).kind).toBe("Accepted");
    const order: string[] = [];
    while (flooded.size > 0) order.push(flooded.dispatchNext()!.jobId);
    // Urgent zuerst (Priorisierung), aber nach 4 Urgent-Dispatches weicht die
    // Queue aus (urgentBurst-Grenze): Normal an Position 5 statt am Ende.
    expect(order.slice(0, 4)).toEqual(["pg-flood-0", "pg-flood-1", "pg-flood-2", "pg-flood-3"]);
    expect(order[4]).toBe("pg-pinned");
    expect(order).toHaveLength(11);
  });

  it("K11: Cancel/Overbudget/Stale am Result-Gate → definierte Rejections", () => {
    const cut = pgApplyCanonicalCut();
    const authorityKeys = pgOccupiedKeys(cut.object);
    const authorityHash = cut.object.contentHash;

    const boundRevision = cut.object.objectRevision;
    const outputRevision = boundRevision + 1;
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
    const expectationFor = (overrides: Partial<WorkerResultExpectation>): WorkerResultExpectation => ({
      jobId: workerJobId("pg-tragwerk-g5"),
      cancelled: false,
      planningEpoch: planningEpoch(3),
      workerEpoch: workerEpoch(4),
      targetKey: workerTargetKey("object.pg-tragwerk-01"),
      inputRevision: contentRevision(boundRevision),
      outputRevision: contentRevision(outputRevision),
      algorithmVersion: algorithmVersion(5),
      maximumOutputBytes: byteCount(4),
      expectedContentHash: hash,
      ...overrides
    });
    const resultFor = (expectation: WorkerResultExpectation): WorkerJobResult => ({
      jobId: expectation.jobId,
      planningEpoch: expectation.planningEpoch,
      workerEpoch: expectation.workerEpoch,
      targetKey: expectation.targetKey,
      inputRevision: expectation.inputRevision,
      outputRevision: expectation.outputRevision,
      algorithmVersion: expectation.algorithmVersion,
      outputBytes: byteCount(4),
      contentHash: hash
    });

    // Cancel → RejectedCancelled (sichtbare definierte Zurueckweisung).
    const cancelledExpectation = expectationFor({ cancelled: true });
    expect(integrateWorkerResult(cancelledExpectation, resultFor(cancelledExpectation), output(outputRevision)).kind)
      .toBe("RejectedCancelled");
    // Overbudget → RejectedOverBudget (4 Bytes gegen Maximum 2).
    const tightExpectation = expectationFor({ maximumOutputBytes: byteCount(2) });
    expect(integrateWorkerResult(tightExpectation, resultFor(tightExpectation), output(outputRevision)).kind)
      .toBe("RejectedOverBudget");
    // Stale (Edit hat die Epoch erhoeht; K7-Bestaetigung im G5-Triple) → RejectedStalePlanningEpoch.
    // Akzeptanz-Kontrolle (Accepted-Pfad) steht in Slice 3 K7; hier nur Gate-Entscheidungen.
    const boundExpectation = expectationFor({});
    const staleResult: WorkerJobResult = { ...resultFor(boundExpectation), planningEpoch: planningEpoch(2) };
    expect(integrateWorkerResult(boundExpectation, staleResult, output(outputRevision)).kind)
      .toBe("RejectedStalePlanningEpoch");

    // Keine Rejection hat die Authority ueberschrieben: persistente Materie erhalten.
    expect(pgOccupiedKeys(cut.object)).toEqual(authorityKeys);
    expect(cut.object.contentHash).toBe(authorityHash);
  });

  it("K12: harte achsenparallele Zellen, Rastermass, kein erfundener Face-Schein", () => {
    const cut = pgApplyCanonicalCut();
    const classification = deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets);
    const plan = deriveStructuralPhysicsTransition(
      cut.object,
      classification,
      spinParentMotion,
      generousTransitionBudgets,
      componentMassBudgets
    );
    expect(plan.status).toBe("Installed");

    // Harte Zellen: exakt eine achsenparallele Box pro Zelle, alle Kanten auf
    // dem 0,125-m-Raster, Volumen exakt Zellzahl x Zellvolumen (kein Smoothing).
    // Das Post-Cut-Fragment (2 adjazente Traeger-Zellen) liefert genau einen
    // dynamischen Body — der Merge ist damit echt (1 Greedy-Box aus 2 Voxeln),
    // kein Box-pro-Voxel-Durchreichen.
    expect(plan.dynamicBodies).toHaveLength(1);
    for (const body of plan.dynamicBodies) {
      expect(body.voxelColliders).toHaveLength(body.occupiedVoxelCount);
      let voxelVolume = 0;
      for (const box of body.voxelColliders) {
        expect(box.maxMeters.x).toBeGreaterThan(box.minMeters.x);
        expect(box.maxMeters.y).toBeGreaterThan(box.minMeters.y);
        expect(box.maxMeters.z).toBeGreaterThan(box.minMeters.z);
        for (const value of [
          box.minMeters.x, box.minMeters.y, box.minMeters.z,
          box.maxMeters.x, box.maxMeters.y, box.maxMeters.z
        ]) {
          expect(onGrid(value)).toBe(true);
        }
        voxelVolume += boxVolume(box);
      }
      expect(voxelVolume).toBeCloseTo(body.occupiedVoxelCount * CELL_VOLUME, 12);
      // Greedy-Merge: achsenparallel, rastertreu, volumenerhaltend.
      let greedyVolume = 0;
      for (const box of body.greedyColliders) {
        for (const value of [
          box.minMeters.x, box.minMeters.y, box.minMeters.z,
          box.maxMeters.x, box.maxMeters.y, box.maxMeters.z
        ]) {
          expect(onGrid(value)).toBe(true);
        }
        greedyVolume += boxVolume(box);
      }
      expect(body.greedyColliders.length).toBeGreaterThanOrEqual(1);
      if (body.occupiedVoxelCount === 2) {
        // Die beiden abgeloesten Traeger-Zellen sind adjazent: Greedy-Merge
        // verschmilzt sie in genau eine Box (Merge-Nachweis, kein Durchreichen).
        expect(body.greedyColliders).toHaveLength(1);
      }
      expect(greedyVolume).toBeCloseTo(body.occupiedVoxelCount * CELL_VOLUME, 12);
    }

    // Mesher-Vertrag (gilt fuer jedes produzierte Mesh derselben
    // Algorithmus-Version): genau 6 Achsen-Faces, CCW-Ecken, reine Dreiecke —
    // keine gemittelten Normalen, kein Smooth-Remeshing. Die Geometrie-Seite
    // (echte Normalen aus produziertem Mesh, kein Material-Crossing) ist in
    // structuralMicrovoxelGreedyMesher.test.ts bewiesen (Faces/Normalen aus
    // produziertem Mesh; kein Merge ueber Material/Part/Semantik/Damage);
    // hier wird der Konstanten-Vertrag plus Abdeckungs-Verweigerung auf der
    // Fixture selbst gezeigt.
    expect([...STRUCTURAL_MESH_FACE_ORDER]).toEqual(["-x", "+x", "-y", "+y", "-z", "+z"]);
    expect([...STRUCTURAL_MESH_TRIANGLE_CORNER_ORDER]).toEqual([0, 1, 2, 0, 2, 3]);
    expect(typeof STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION).toBe("string");

    // Kein erfundener Face-Schein: jenseits der Fixture-Abdeckung (Sockel-West
    // bei x=-1 liegt ausserhalb der Bricks) verweigert der Mesher explizit,
    // statt Luft-Geometrie zu halluzinieren.
    const exposed = extractStructuralMeshData(cut.object, generousMeshBudgets);
    expect(exposed.status).toBe("Rejected");
    if (exposed.status === "Rejected") {
      expect(exposed.code).toBe("MissingNeighborCoverage");
      expect(exposed.missingNeighborKey).not.toBeNull();
      expect(exposed.missingNeighborKey?.originQuantum.x).toBe(-16);
    }
    expect("product" in exposed).toBe(false);
    expect(canonicalAdaptiveJson(classification.fragments)).toBe(
      canonicalAdaptiveJson(
        deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets).fragments
      )
    );
  });
});
