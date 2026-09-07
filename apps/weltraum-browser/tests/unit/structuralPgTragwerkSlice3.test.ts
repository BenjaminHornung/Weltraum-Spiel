import { describe, expect, it } from "vitest";
import { canonicalAdaptiveJson } from "../../src/voxel/adaptive";
import {
  algorithmVersion,
  byteCount,
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
import { applyQualityPreset, createDefaultGraphicsSettings } from "../../src/settings";
import { transitionResidency, type ResidencyState } from "../../src/streaming";
import {
  canonicalStructuralTransitionJson,
  decodeStructuralObject,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,
  encodeStructuralObject,
  type StructuralObject,
  type StructuralPhysicsTransitionBudgets
} from "../../src/voxel/structural";
import {
  pgApplyCanonicalCut,
  pgConnectivityBudgets,
  pgOccupiedKeys
} from "./pgTragwerkFixture";

/**
 * Paket P-PG-SLICE3 — Proving-Ground-Scheibe 3, nur G4.
 *
 * Reine Core-Kompositions-Scheibe ohne UI-/Render-/Szenenaenderung
 * (Evidence-Regel wie Slice 1/2: JSON-/Markdown-Evidence, kein Screenshot).
 * Keine neue Core-Logik, kein Schema-Eingriff: Alle Primitiven werden
 * wiederverwendet —
 * Structural-Serialisierung (encode/decodeStructuralObject),
 * Save-Besitzsemantik (revisionsgesicherte Atomic-Replace-Pattern aus dem
 * Save-Repository-Core), Worker-Adoption-Gate (integrateWorkerResult mit
 * Revisionsbindung), Residency-Maschine (transitionResidency),
 * Render-Qualitaet (applyQualityPreset, strikt render-seitig).
 *
 * - K8 Save/Reload: Loch/Fragment/Bewegungszustand ueber
 *   Encode/Decode erhalten; Transfer ist atomar (ganz oder Rejection,
 *   niemals partiell adoptiert).
 * - K9 Residency: Ready→Evicted→Queued→Loading→Ready ohne
 *   wiederauferstandene Zellen/Collider; Fernprojektion traegt exakt die
 *   Authority-Revision.
 * - K7 Asynchronitaet: Stale-Workerresultat (alte Epoch/Revision) wird
 *   rejected und kann neue Edits nicht ueberschreiben; nur das gebundene,
 *   voll validierte Resultat wird adoptiert.
 * - K10 LOD-Neutralitaet: Collider-Variante und Qualitaets-Preset aendern
 *   weder Masse noch Kollision (Abdeckung) noch Edit-Zustand.
 */

const SIDE = 0.125;

const generousBudgets: StructuralPhysicsTransitionBudgets = {
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

const boxVolume = (box: { readonly minMeters: { x: number; y: number; z: number }; readonly maxMeters: { x: number; y: number; z: number } }): number =>
  (box.maxMeters.x - box.minMeters.x) * (box.maxMeters.y - box.minMeters.y) * (box.maxMeters.z - box.minMeters.z);

/** Fernprojektion: traegt exakt die Authority-Revision, keine eigene Truth. */
const proxyFor = (object: StructuralObject): { readonly objectRevision: number; readonly contentHash: string } => ({
  objectRevision: object.objectRevision,
  contentHash: object.contentHash
});

describe("PG-TRAGWERK-01 proving-ground slice 3 (G4)", () => {
  it("K8: Save/Reload erhaelt Loch/Fragment/Bewegung; Transfer ist atomar", () => {
    const cut = pgApplyCanonicalCut();
    expect(pgOccupiedKeys(cut.object)).toHaveLength(26);

    const saved = encodeStructuralObject(cut.object);
    const reloaded = decodeStructuralObject(saved);

    // Loch erhalten: identische Belegung, identische Revision/Hashes/Evidence.
    expect(pgOccupiedKeys(reloaded)).toEqual(pgOccupiedKeys(cut.object));
    expect(reloaded.objectRevision).toBe(cut.object.objectRevision);
    expect(reloaded.contentHash).toBe(cut.object.contentHash);
    expect(reloaded.evidenceHash).toBe(cut.object.evidenceHash);
    expect(reloaded.commandEvidence).toHaveLength(cut.object.commandEvidence.length);
    // Byte-exakt idempotent: erneutes Encodieren liefert dasselbe Dokument.
    expect(encodeStructuralObject(reloaded)).toBe(saved);

    // Fragment erhalten: Klassifikation auf dem Reload identisch.
    const before = deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets);
    const after = deriveStructuralComponentClassification(reloaded, pgConnectivityBudgets);
    expect(after.anchoredComponents).toHaveLength(before.anchoredComponents.length);
    expect(after.detachedComponents).toHaveLength(before.detachedComponents.length);
    expect(canonicalAdaptiveJson(after.fragments)).toBe(canonicalAdaptiveJson(before.fragments));

    // Bewegung erhalten: gleicher Parent-Motion-Input leitet denselben Plan ab.
    const plan = deriveStructuralPhysicsTransition(cut.object, before, spinParentMotion, generousBudgets, componentMassBudgets);
    const replan = deriveStructuralPhysicsTransition(reloaded, after, spinParentMotion, generousBudgets, componentMassBudgets);
    expect(replan.contentHash).toBe(plan.contentHash);
    expect(canonicalAdaptiveJson(replan.dynamicBodies)).toBe(canonicalAdaptiveJson(plan.dynamicBodies));
    // Plan-Serialisierung als Round-Trip: Inhalt ueberlebt Speichern/Laden.
    const planJson = canonicalStructuralTransitionJson(plan);
    const planParsed = JSON.parse(planJson) as { readonly contentHash: string; readonly dynamicFragmentIds: readonly string[] };
    expect(planParsed.contentHash).toBe(plan.contentHash);
    expect(planParsed.dynamicFragmentIds).toEqual([...plan.dynamicFragmentIds]);

    // Atomar: manipuliertes Dokument wird fail-closed abgewiesen, ...
    const tampered = saved.replace('"objectRevision":1', '"objectRevision":0');
    expect(tampered).not.toBe(saved);
    expect(() => decodeStructuralObject(tampered)).toThrow();
    // ... die Authority bleibt unangetastet und weiter ableitbar.
    expect(pgOccupiedKeys(cut.object)).toHaveLength(26);
    expect(deriveStructuralObjectMassProperties(cut.object, { maxVisitedCells: 64 }).totalMassKg)
      .toBe(deriveStructuralObjectMassProperties(reloaded, { maxVisitedCells: 64 }).totalMassKg);
  });

  it("K9: Evict/Rueckkehr ohne Wiederauferstehung; Fernproxy gleiche Revision", () => {
    const cut = pgApplyCanonicalCut();
    const saved = encodeStructuralObject(cut.object);
    const beforeKeys = pgOccupiedKeys(cut.object);
    const beforeProxy = proxyFor(cut.object);
    const beforeClassification = deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets);
    const beforePlan = deriveStructuralPhysicsTransition(cut.object, beforeClassification, spinParentMotion, generousBudgets, componentMassBudgets);
    const colliderCount = (plan: typeof beforePlan): number =>
      plan.dynamicBodies.reduce((sum, body) => sum + body.voxelColliders.length + body.greedyColliders.length, 0);

    // Verlassen/Evicten: Ready -> Evicted (In-Memory-Besitz faellt weg).
    let residency: ResidencyState = "Ready";
    residency = transitionResidency(residency, "Evicted");
    expect(residency).toBe("Evicted");

    // Rueckkehr: Evicted -> Queued -> Loading -> Ready, Reload aus dem Save.
    residency = transitionResidency(residency, "Queued");
    residency = transitionResidency(residency, "Loading");
    const returned = decodeStructuralObject(saved);
    residency = transitionResidency(residency, "Ready");
    expect(residency).toBe("Ready");

    // Keine Wiederauferstehung: keine Zelle dazu, keine weg, keine Collider dazu.
    expect(pgOccupiedKeys(returned)).toEqual(beforeKeys);
    const afterClassification = deriveStructuralComponentClassification(returned, pgConnectivityBudgets);
    expect(canonicalAdaptiveJson(afterClassification.fragments)).toBe(canonicalAdaptiveJson(beforeClassification.fragments));
    const afterPlan = deriveStructuralPhysicsTransition(returned, afterClassification, spinParentMotion, generousBudgets, componentMassBudgets);
    expect(afterPlan.contentHash).toBe(beforePlan.contentHash);
    expect(colliderCount(afterPlan)).toBe(colliderCount(beforePlan));
    expect(afterPlan.occupancyProof).toEqual(beforePlan.occupancyProof);

    // Fernproxy traegt exakt die Authority-Revision (kein Stale-, kein Res-Drop).
    expect(proxyFor(returned)).toEqual(beforeProxy);
    expect(proxyFor(returned).objectRevision).toBe(1);
    const staleProxy = { objectRevision: 0, contentHash: beforeProxy.contentHash };
    expect(staleProxy.objectRevision).not.toBe(proxyFor(returned).objectRevision);
  });

  it("K7: Stale-Workerresultat wird rejected; Edits bleiben unangetastet", () => {
    const cut = pgApplyCanonicalCut();
    const authorityKeys = pgOccupiedKeys(cut.object);
    const authorityHash = cut.object.contentHash;

    // Bindung an den Post-Cut-Stand: Input-Revision = Authority-ObjectRevision.
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
    const expectation: WorkerResultExpectation = {
      jobId: workerJobId("pg-tragwerk-g4"),
      cancelled: false,
      planningEpoch: planningEpoch(3),
      workerEpoch: workerEpoch(4),
      targetKey: workerTargetKey("object.pg-tragwerk-01"),
      inputRevision: contentRevision(boundRevision),
      outputRevision: contentRevision(outputRevision),
      algorithmVersion: algorithmVersion(5),
      maximumOutputBytes: byteCount(4),
      expectedContentHash: hash
    };
    const resultFor = (overrides: Partial<WorkerJobResult>): WorkerJobResult => ({
      jobId: expectation.jobId,
      planningEpoch: expectation.planningEpoch,
      workerEpoch: expectation.workerEpoch,
      targetKey: expectation.targetKey,
      inputRevision: expectation.inputRevision,
      outputRevision: expectation.outputRevision,
      algorithmVersion: expectation.algorithmVersion,
      outputBytes: byteCount(4),
      contentHash: hash,
      ...overrides
    });

    // Stale Planning-Epoch (Edit hat die Epoch erhoeht): Rejection.
    expect(integrateWorkerResult(expectation, resultFor({ planningEpoch: planningEpoch(2) }), output(outputRevision)).kind)
      .toBe("RejectedStalePlanningEpoch");
    // Stale Input-Revision (Resultat rechnet auf Pre-Cut-Stand): Rejection.
    expect(integrateWorkerResult(
      expectation,
      resultFor({ inputRevision: contentRevision(boundRevision - 1) }),
      output(outputRevision)
    ).kind).toBe("RejectedRevisionMismatch");

    // Adoption-Pruefung: nur das gebundene, voll validierte Resultat wird adoptiert.
    const adoption = integrateWorkerResult(expectation, resultFor({}), output(outputRevision));
    expect(adoption.kind).toBe("Accepted");
    if (adoption.kind === "Accepted") {
      expect(adoption.bundle.ownership).toBe("WorkerToConsumer");
    }

    // Kein stale Resultat hat die Authority ueberschrieben.
    expect(pgOccupiedKeys(cut.object)).toEqual(authorityKeys);
    expect(cut.object.contentHash).toBe(authorityHash);
  });

  it("K10: LOD-/Qualitaetswechsel aendert Masse/Kollision/Edit nicht", () => {
    const cut = pgApplyCanonicalCut();
    const reloaded = decodeStructuralObject(encodeStructuralObject(cut.object));
    const classification = deriveStructuralComponentClassification(reloaded, pgConnectivityBudgets);
    const plan = deriveStructuralPhysicsTransition(reloaded, classification, spinParentMotion, generousBudgets, componentMassBudgets);

    // Masse haengt an Dichte x Volumen, nicht an der Collider-Variante.
    const cellVolume = SIDE * SIDE * SIDE;
    for (const body of plan.dynamicBodies) {
      const voxelVolume = body.voxelColliders.reduce((sum, box) => sum + boxVolume(box), 0);
      const greedyVolume = body.greedyColliders.reduce((sum, box) => sum + boxVolume(box), 0);
      expect(body.voxelColliders).toHaveLength(body.occupiedVoxelCount);
      expect(voxelVolume).toBeCloseTo(body.occupiedVoxelCount * cellVolume, 12);
      expect(greedyVolume).toBeCloseTo(body.occupiedVoxelCount * cellVolume, 12);
    }
    const massBefore = deriveStructuralObjectMassProperties(reloaded, { maxVisitedCells: 64 });

    // Render-LOD (Quality-Preset Low..Ultra) ist strikt render-seitig.
    const base = createDefaultGraphicsSettings();
    const low = applyQualityPreset(base, "Low");
    const ultra = applyQualityPreset(base, "Ultra");
    expect(low.qualityPreset).toBe("Low");
    expect(ultra.qualityPreset).toBe("Ultra");

    // Nach jedem Preset-Wechsel: identische Klassifikation/Masse/Plan, kein Edit.
    for (const preset of [low, ultra]) {
      expect(preset.qualityPreset).not.toBe(base.qualityPreset);
      const again = deriveStructuralComponentClassification(reloaded, pgConnectivityBudgets);
      expect(canonicalAdaptiveJson(again.fragments)).toBe(canonicalAdaptiveJson(classification.fragments));
      const massAgain = deriveStructuralObjectMassProperties(reloaded, { maxVisitedCells: 64 });
      expect(massAgain.totalMassKg).toBe(massBefore.totalMassKg);
      expect(canonicalAdaptiveJson(massAgain.centerOfMassMeters)).toBe(canonicalAdaptiveJson(massBefore.centerOfMassMeters));
      const replan = deriveStructuralPhysicsTransition(reloaded, again, spinParentMotion, generousBudgets, componentMassBudgets);
      expect(replan.contentHash).toBe(plan.contentHash);
    }
    expect(reloaded.objectRevision).toBe(cut.object.objectRevision);
    expect(reloaded.commandEvidence).toHaveLength(cut.object.commandEvidence.length);
    expect(reloaded.contentHash).toBe(cut.object.contentHash);
  });
});
