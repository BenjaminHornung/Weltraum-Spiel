import { describe, expect, it } from "vitest";
import { StableWorkerJobQueue } from "../../src/workers";
import {
  applyStructuralDestructionCommand,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,
  extractStructuralMeshData,
  type StructuralMeshProduct,
  type StructuralObject
} from "../../src/voxel/structural";
import {
  completeR5DeferredRun,
  createR5DeferredJobRequest,
  describeR5Scene,
  measureR5Work,
  prepareR5Bounded,
  selectR5LodColliders,
  selectR5RenderLodGeometry,
  withFullKnownCoverage
} from "../../src/voxel/structural/provingGroundR5";
import {
  createCoveredPgTragwerk01,
  createPgTragwerk01,
  pgAccepted,
  pgConnectivityBudgets,
  pgCutBounds,
  pgCutCommand,
  pgOccupiedKeys
} from "./pgTragwerkFixture";
import { reconstructStructuralObjectInternal } from "../../src/voxel/structural/model";

/**
 * Paket P-PG-R5B — schliesst R5-Luecken minimal auf R5 auf (R3/R4/F8 unberuehrt).
 *
 * Failing proofs zuerst: Schaetzung-vs-Messung, echte Renderer-LOD,
 * deferred Vollstaendigkeit, Fixture-gebundene Coverage.
 */

const generousMeshBudgets = {
  maxVisitedCells: 64,
  maxQuads: 1024,
  maxVertices: 4096,
  maxIndices: 6144
} as const;

const generousTransitionBudgets = {
  maxFragments: 8,
  maxCollidersPerFragment: 16,
  maxVoxelsPerFragment: 16
} as const;

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

const r5PrepareBudgets = {
  maxOccupiedCells: 64,
  maxBricks: 16,
  maxTotalWork: 512
} as const;

const producedMesh = (object: StructuralObject): StructuralMeshProduct => {
  const result = extractStructuralMeshData(object, generousMeshBudgets);
  if (result.status !== "Produced") {
    throw new Error(`Expected mesh, received ${result.status} ${(result as { code?: string }).code ?? ""}.`);
  }
  return result.product;
};

const cutCovered = (commandId: string): StructuralObject => {
  const covered = createCoveredPgTragwerk01();
  return pgAccepted(
    applyStructuralDestructionCommand(covered, pgCutCommand(covered, pgCutBounds, commandId))
  ).object;
};

describe("PG-TRAGWERK-01 proving-ground R5B (Schaetzung, Render-LOD, Deferred-Vollzug, Coverage-Bindung)", () => {
  it("R5B-a: estimatedWork ist explizit als Schaetzung (9x occupiedCells) gelabelt; Messung separat", () => {
    const cut = cutCovered("command.pg-tragwerk-r5b-cut-a");
    const decision = prepareR5Bounded(cut, r5PrepareBudgets);
    expect(decision.status).toBe("Ready");
    // Schaetzung ist ehrlich gelabelt, Formel 9x occupiedCells.
    expect(decision.estimatedWorkKind).toBe("estimate:9x-occupied-cells");
    expect(decision.estimatedWork).toBe(9 * decision.occupiedCells);
    // Messung separat: besuchte Zellen/Komponenten/Fragmente/Quads/Collider + finite Timings.
    const classifyStart = performance.now();
    const classification = deriveStructuralComponentClassification(cut, pgConnectivityBudgets);
    const classifyMs = Math.max(0, performance.now() - classifyStart);
    const meshStart = performance.now();
    const mesh = producedMesh(cut);
    const meshMs = Math.max(0, performance.now() - meshStart);
    const transitionStart = performance.now();
    const plan = deriveStructuralPhysicsTransition(
      cut, classification, spinParentMotion, generousTransitionBudgets, componentMassBudgets, "live-parent-body"
    );
    const transitionMs = Math.max(0, performance.now() - transitionStart);
    expect(plan.status).toBe("Installed");
    const measured = measureR5Work({
      occupiedCells: decision.occupiedCells,
      classification,
      meshQuadCount: mesh.indices.length / 6,
      plan,
      timings: { classifyMs, meshMs, transitionMs }
    });
    expect(measured.visitedCells).toBe(decision.occupiedCells);
    expect(measured.components).toBe(classification.components.length);
    expect(measured.fragments).toBe(classification.fragments.length);
    expect(measured.quads).toBe(mesh.indices.length / 6);
    expect(measured.colliders).toBeGreaterThan(0);
    expect(measured.totalMeasured).toBeLessThanOrEqual(r5PrepareBudgets.maxTotalWork);
    for (const timing of [measured.classifyMs, measured.meshMs, measured.transitionMs]) {
      expect(Number.isFinite(timing)).toBe(true);
      expect(timing).toBeGreaterThanOrEqual(0);
    }
  });

  it("R5B-b: echte Renderer-LOD-Geometrie (low gemergt/shared, high per-voxel/distinct); Authority gleich", () => {
    const cut = cutCovered("command.pg-tragwerk-r5b-cut-b");
    const classification = deriveStructuralComponentClassification(cut, pgConnectivityBudgets);
    const plan = deriveStructuralPhysicsTransition(
      cut, classification, spinParentMotion, generousTransitionBudgets, componentMassBudgets, "live-parent-body"
    );
    expect(plan.status).toBe("Installed");
    // Renderer-LOD verzweigt IM Renderer-Pfad: sichtbarer Geometrie-/Material-Delta.
    const low = selectR5RenderLodGeometry(plan, "low");
    const high = selectR5RenderLodGeometry(plan, "high");
    expect(low.length).toBe(1);
    expect(high.length).toBe(2);
    for (const box of low) expect(box.materialVariant).toBe("r5-low-shared");
    for (const box of high) expect(box.materialVariant).toBe("r5-high-per-voxel");
    expect(low[0].materialVariant).not.toBe(high[0].materialVariant);
    expect(() => selectR5RenderLodGeometry(plan, "ultra" as never)).toThrow();
    // Authority-Gleichheit ueber LODs: Belegung/Masse/Fragmente/Mesh-Hash identisch.
    const mass = deriveStructuralObjectMassProperties(cut, { maxVisitedCells: 64 });
    expect(pgOccupiedKeys(cut)).toHaveLength(26);
    expect(mass.totalMassKg).toBeGreaterThan(0);
    const lowMesh = producedMesh(cut);
    const highMesh = producedMesh(cut);
    expect(lowMesh.contentHash).toBe(highMesh.contentHash);
    expect(classification.fragments).toHaveLength(1);
    // Konsistenz mit Physik-LOD-Projektion (gleiche Boxzahlen).
    expect(low.length).toBe(selectR5LodColliders(plan, "low").length);
    expect(high.length).toBe(selectR5LodColliders(plan, "high").length);
    const lowScene = describeR5Scene(cut, lowMesh, "low");
    const highScene = describeR5Scene(cut, highMesh, "high");
    expect(lowScene.meshContentHash).toBe(highScene.meshContentHash);
  });

  it("R5B-c: Deferred-Pfad vollzieht echten Run (Queue, Dispatch, Re-Prepare Ready, Materie erhalten)", () => {
    const cut = cutCovered("command.pg-tragwerk-r5b-cut-c");
    const deferred = prepareR5Bounded(cut, { maxOccupiedCells: 64, maxBricks: 16, maxTotalWork: 10 });
    expect(deferred.status).toBe("Deferred");
    expect(deferred.reason).toBe("r5/budgets/total-work");
    const beforeKeys = pgOccupiedKeys(cut);
    const beforeHash = cut.contentHash;
    const beforeMass = deriveStructuralObjectMassProperties(cut, { maxVisitedCells: 64 }).totalMassKg;

    const queue = new StableWorkerJobQueue(4);
    const request = createR5DeferredJobRequest(deferred, cut);
    // Payload ist JSON-serialisierbar (cloneFreeze-sicher): Roundtrip ohne Verlust.
    expect(JSON.parse(JSON.stringify(request.payload))).toEqual(request.payload);
    expect(queue.enqueue(request).kind).toBe("Accepted");
    const completion = completeR5DeferredRun(cut, queue, request, r5PrepareBudgets, {
      classify: (object) => deriveStructuralComponentClassification(object, pgConnectivityBudgets),
      mesh: (object) => producedMesh(object),
      transition: (object, classification) => deriveStructuralPhysicsTransition(
        object, classification, spinParentMotion, generousTransitionBudgets, componentMassBudgets, "live-parent-body"
      ),
      massKg: (object) => deriveStructuralObjectMassProperties(object, { maxVisitedCells: 64 }).totalMassKg
    });
    expect(completion.dispatchedJobId).toBe(request.jobId);
    expect(completion.decision.status).toBe("Ready");
    expect(completion.decision.reason).toBeNull();
    // Vollstaendige Ableitung: Anker (24) + Fragment (2) bilanzieren jede Zelle,
    // der Plan vertritt jede nicht verankerte Zelle dynamisch, Masse erhalten.
    expect(completion.anchoredVoxels).toBe(24);
    expect(completion.fragmentVoxels).toBe(2);
    expect(completion.dynamicVoxels).toBe(2);
    expect(completion.anchoredVoxels + completion.fragmentVoxels).toBe(beforeKeys.length);
    expect(completion.massKg).toBeCloseTo(beforeMass, 12);
    expect(pgOccupiedKeys(cut)).toEqual(beforeKeys);
    expect(cut.contentHash).toBe(beforeHash);
    expect(queue.snapshot().size).toBe(0);
  });

  it("R5B-d: Coverage ist an das geschlossene authored Fixture gebunden (fail-closed sonst)", () => {
    const covered = createCoveredPgTragwerk01();
    expect(covered.objectId).toBe("object.pg-tragwerk-01");
    expect(covered.objectRevision).toBe(0);
    expect(covered.commandEvidence).toHaveLength(0);
    expect(covered.bricks).toHaveLength(7);
    expect(pgOccupiedKeys(covered)).toHaveLength(27);
    // Frisches Fixture bleibt coverage-faehig (R5-Vertrag erhalten).
    expect(withFullKnownCoverage(createPgTragwerk01()).bricks).toHaveLength(7);
    // Fremde Objekt-ID, Revision != 0, nicht-leere Evidence: fail-closed.
    const foreignBase = createPgTragwerk01();
    const foreign = { ...foreignBase, objectId: "object.other" as typeof foreignBase.objectId };
    expect(() => withFullKnownCoverage(foreign)).toThrow();
    const revised = cutCovered("command.pg-tragwerk-r5b-cut-d");
    expect(revised.objectRevision).not.toBe(0);
    expect(() => withFullKnownCoverage(revised)).toThrow();
  });

  it("R5B-f: Deferred bindet fremde und veraltete Jobs ab und requeued Hook-Fehler", () => {
    const cut = cutCovered("command.pg-tragwerk-r5b-cut-f");
    const deferred = prepareR5Bounded(cut, { maxOccupiedCells: 64, maxBricks: 16, maxTotalWork: 10 });
    expect(deferred.status).toBe("Deferred");
    const hooks = {
      classify: (object: StructuralObject) => deriveStructuralComponentClassification(object, pgConnectivityBudgets),
      mesh: (object: StructuralObject) => producedMesh(object),
      transition: (object: StructuralObject, classification: ReturnType<typeof deriveStructuralComponentClassification>) => deriveStructuralPhysicsTransition(
        object, classification, spinParentMotion, generousTransitionBudgets, componentMassBudgets, "live-parent-body"
      ),
      massKg: (object: StructuralObject) => deriveStructuralObjectMassProperties(object, { maxVisitedCells: 64 }).totalMassKg
    };

    const foreignRequest = createR5DeferredJobRequest(deferred, cut);
    const foreignQueue = new StableWorkerJobQueue(2);
    expect(foreignQueue.enqueue({ ...foreignRequest, targetKey: "object.foreign" as typeof foreignRequest.targetKey }).kind).toBe("Accepted");
    expect(() => completeR5DeferredRun(cut, foreignQueue, foreignRequest, r5PrepareBudgets, hooks)).toThrow();
    expect(foreignQueue.snapshot().size).toBe(1);

    const fresh = createCoveredPgTragwerk01();
    const staleDecision = prepareR5Bounded(fresh, { maxOccupiedCells: 64, maxBricks: 16, maxTotalWork: 10 });
    const staleQueue = new StableWorkerJobQueue(2);
    expect(staleQueue.enqueue(createR5DeferredJobRequest(staleDecision, fresh)).kind).toBe("Accepted");
    const staleRequest = createR5DeferredJobRequest(staleDecision, fresh);
    expect(() => completeR5DeferredRun(cut, staleQueue, staleRequest, r5PrepareBudgets, hooks)).toThrow();
    expect(staleQueue.snapshot().size).toBe(1);

    const hookErrorQueue = new StableWorkerJobQueue(2);
    expect(hookErrorQueue.enqueue(foreignRequest).kind).toBe("Accepted");
    expect(() => completeR5DeferredRun(cut, hookErrorQueue, foreignRequest, r5PrepareBudgets, {
      ...hooks,
      classify: () => { throw new Error("synthetic R5 hook failure"); }
    })).toThrow("synthetic R5 hook failure");
    expect(hookErrorQueue.snapshot().size).toBe(1);
  });

  it("R5B-g: Same-ID-Inhalt ausserhalb des kanonischen authored Digest wird abgewiesen", () => {
    const base = createPgTragwerk01();
    const foreign = reconstructStructuralObjectInternal({
      objectId: base.objectId,
      frame: base.frame,
      source: base.source,
      materials: base.materials.map((material) => material.materialId === 3
        ? { ...material, densityKgPerCubicMeter: material.densityKgPerCubicMeter + 1 }
        : material),
      bricks: base.bricks,
      anchors: base.anchors,
      joints: base.joints,
      objectRevision: base.objectRevision,
      editRevision: base.editRevision,
      commandEvidence: base.commandEvidence
    });
    expect(foreign.objectId).toBe(base.objectId);
    expect(foreign.objectRevision).toBe(0);
    expect(foreign.commandEvidence).toHaveLength(0);
    expect(foreign.contentHash).not.toBe(base.contentHash);
    expect(() => withFullKnownCoverage(foreign)).toThrow();
  });

  it("R5B-e: ungueltige Budgets bleiben Rejected r5/budgets/invalid (R5-Vertrag)", () => {
    const cut = cutCovered("command.pg-tragwerk-r5b-cut-e");
    for (const budgets of [
      { maxOccupiedCells: Number.NaN, maxBricks: 16, maxTotalWork: 512 },
      { maxOccupiedCells: 64, maxBricks: -1, maxTotalWork: 512 }
    ] as const) {
      const decision = prepareR5Bounded(cut, budgets);
      expect(decision.status).toBe("Rejected");
      expect(decision.reason).toBe("r5/budgets/invalid");
    }
  });
});
