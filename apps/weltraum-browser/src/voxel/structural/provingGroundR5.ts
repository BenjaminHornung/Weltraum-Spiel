import {
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  createAdaptiveBrickKey,
  deepFreeze,
  serializeAdaptiveKey,
  type AdaptiveBrickKey
} from "../adaptive";
import type { StableWorkerJobQueue, WorkerJobRequest } from "../../workers";
import { globalQuantumForStructuralCell } from "./coordinates";
import { reconstructStructuralObjectInternal, structuralAddressForBrickCell } from "./model";
import {
  STRUCTURAL_BRICK_SCHEMA_VERSION,
  type StructuralComponentClassification,
  type StructuralMeshProduct,
  type StructuralObject
} from "./types";
import type {
  StructuralColliderBoxMeters,
  StructuralPhysicsTransitionResult
} from "./physicsTransition";

/**
 * Paket P-PG-R5 — additiver R5-Pfad, keine Aenderung der R3/R4-Vertraege.
 *
 * - Vollstaendige bekannte Coverage: fehlende Nachbar-Bricks werden als leere
 *   (bekannte Aussenluft) explizit beigelegt; Occupancy/Masse/Konnektivitaet
 *   bleiben identisch, nur die Brickliste waechst.
 * - LOD ist reine Projektion: "low" waehlt Greedy-Collider, "high" waehlt
 *   Voxel-Collider aus demselben Transition-Plan. Authority bleibt gleich.
 * - Begrenzte Vorbereitung: Budgets werden VOR schwerer Ableitung gegen billige
 *   Zaehler (Zellen, Bricks, Schaetzung) geprueft; Ueberlast wird explizit als
 *   Deferred/Rejected zurueckgegeben, Authority unangetastet, Pending bleibt
 *   beim Aufrufer (StableWorkerJobQueue wird wiederverwendet, hier kein Queue).
 * - Szene ist deterministische Pruef-Beschreibung (Material/Licht/Kamera/Bounds),
 *   kein Renderer, keine Engine-Entscheidung. AO-Pfad existiert im Core nicht
 *   (harte Quads, keine gemittelten Normalen) — siehe Evidence.
 */

export type R5Lod = "low" | "high";

export interface R5PrepareBudgets {
  readonly maxOccupiedCells: number;
  readonly maxBricks: number;
  readonly maxTotalWork: number;
}

export type R5PrepareStatus = "Ready" | "Deferred" | "Rejected";

/**
 * Paket P-PG-R5B: estimatedWork ist eine ehrliche Schaetzung (keine Messung).
 * Formel: 9x occupiedCells (1 Zelle + max 6 Faces + max 2 Collider).
 * Gemessene Arbeit wird separat ueber measureR5Work berichtet.
 */
export const R5_ESTIMATED_WORK_PER_OCCUPIED_CELL = 9;

export type R5WorkEstimateKind = "estimate:9x-occupied-cells";

export interface R5PrepareDecision {
  readonly status: R5PrepareStatus;
  readonly occupiedCells: number;
  readonly brickCount: number;
  readonly estimatedWork: number;
  readonly estimatedWorkKind: R5WorkEstimateKind;
  readonly reason: string | null;
}

export interface R5SceneMaterial {
  readonly materialId: number;
  readonly densityKgPerCubicMeter: number;
  readonly structuralClass: string;
  readonly displayColor: string;
  readonly roughness: number;
}

export interface R5SceneDescriptor {
  readonly schemaVersion: "pg-tragwerk-r5-scene-v1";
  readonly meshContentHash: string;
  readonly sourceContentHash: string;
  readonly lod: R5Lod;
  readonly materials: readonly R5SceneMaterial[];
  readonly lights: {
    readonly keyIntensity: number;
    readonly fillIntensity: number;
    readonly ambientIntensity: number;
  };
  readonly camera: {
    readonly positionMeters: { readonly x: number; readonly y: number; readonly z: number };
    readonly targetMeters: { readonly x: number; readonly y: number; readonly z: number };
  };
  readonly boundsMeters: StructuralMeshProduct["boundsMeters"];
  readonly quadCount: number;
}

const brickOriginForGlobal = (global: number): number =>
  Math.floor(global / ADAPTIVE_BRICK_CELLS_PER_AXIS) * ADAPTIVE_BRICK_CELLS_PER_AXIS;

/** Fehlende Nachbar-Brick-Origins fuer vollstaendige bekannte Coverage (deterministisch, sortiert). */
export const missingNeighborBrickOrigins = (
  object: StructuralObject
): readonly { readonly x: number; readonly y: number; readonly z: number }[] => {
  const known = new Set(object.bricks.map((brick) => serializeAdaptiveKey(brick.key)));
  const missing = new Map<string, { readonly x: number; readonly y: number; readonly z: number }>();
  const offsets = [
    [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]
  ] as const;
  for (const brick of object.bricks) {
    for (const cell of brick.cells) {
      const global = globalQuantumForStructuralCell(structuralAddressForBrickCell(brick, cell.localIndex));
      for (const [dx, dy, dz] of offsets) {
        const neighbor = { x: global.x + dx, y: global.y + dy, z: global.z + dz };
        const origin = {
          x: brickOriginForGlobal(neighbor.x),
          y: brickOriginForGlobal(neighbor.y),
          z: brickOriginForGlobal(neighbor.z)
        };
        const key = createAdaptiveBrickKey({
          bodyId: object.frame.bodyId,
          surfaceFrameId: object.frame.surfaceFrameId,
          regionId: object.frame.regionId,
          generatorVersion: object.frame.generatorVersion,
          level: 4,
          originQuantum: origin
        });
        const serialized = serializeAdaptiveKey(key);
        if (!known.has(serialized) && !missing.has(serialized)) missing.set(serialized, origin);
      }
    }
  }
  return deepFreeze(
    [...missing.values()].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z)
  );
};

/** Lege bekannte Aussenluft als leere Bricks bei; Occupancy/Masse/Konnektivitaet unveraendert.
 *
 * Ablaufvorgabe: Coverage wird auf dem ungeschnittenen Ausgangsobjekt (Revision 0,
 * leere Evidence) beigelegt, danach erst schneiden. Nach einem akzeptierten Edit
 * aendert jede Brickliste den Content-Hash und bricht die Evidence-Kette — die
 * Rekonstruktion schlaegt dann fail-closed fehl (kein stilles Ummodeln).
 *
 * Paket P-PG-R5B: zusaetzlich an das geschlossene authored Fixture gebunden
 * (object.pg-tragwerk-01, Revision 0, leere Evidence) — fail-closed sonst.
 */
export const withFullKnownCoverage = (object: StructuralObject): StructuralObject => {
  if (
    object.objectId !== "object.pg-tragwerk-01" ||
    object.objectRevision !== 0 ||
    object.commandEvidence.length !== 0
  ) {
    throw new Error(
      "withFullKnownCoverage requires the closed authored fixture object.pg-tragwerk-01 at revision 0 with empty evidence."
    );
  }
  const missing = missingNeighborBrickOrigins(object);
  if (missing.length === 0) return object;
  const emptyBricks = missing.map((origin) => ({
    schemaVersion: STRUCTURAL_BRICK_SCHEMA_VERSION,
    key: createAdaptiveBrickKey({
      bodyId: object.frame.bodyId,
      surfaceFrameId: object.frame.surfaceFrameId,
      regionId: object.frame.regionId,
      generatorVersion: object.frame.generatorVersion,
      level: 4,
      originQuantum: origin
    }) as AdaptiveBrickKey,
    cells: [] as const
  }));
  return reconstructStructuralObjectInternal({
    objectId: object.objectId,
    frame: object.frame,
    source: object.source,
    materials: object.materials,
    bricks: [...object.bricks, ...emptyBricks],
    anchors: object.anchors,
    joints: object.joints,
    objectRevision: object.objectRevision,
    editRevision: object.editRevision,
    commandEvidence: object.commandEvidence
  });
};

/** LOD ist Projektion: low = Greedy-Collider, high = Voxel-Collider desselben Plans (inkl. Debris). */
export const selectR5LodColliders = (
  plan: StructuralPhysicsTransitionResult,
  lod: R5Lod
): readonly StructuralColliderBoxMeters[] => {
  if (lod !== "low" && lod !== "high") {
    throw new Error(`Unknown R5 LOD "${String(lod)}" (expected "low" | "high").`);
  }
  const pick = (body: {
    readonly greedyColliders: readonly StructuralColliderBoxMeters[];
    readonly voxelColliders: readonly StructuralColliderBoxMeters[];
  }): readonly StructuralColliderBoxMeters[] =>
    lod === "low" ? body.greedyColliders : body.voxelColliders;
  const selected: StructuralColliderBoxMeters[] = [];
  for (const body of plan.dynamicBodies) selected.push(...pick(body));
  if (plan.status === "Fallback") selected.push(...pick(plan.debris));
  return deepFreeze(selected.slice());
};

/**
 * Begrenzte Vorbereitung: billige Zaehler zuerst, Budgets VOR schwerer Ableitung.
 * Schaetzung: occupied + 6*occupied (max Faces) + 2*occupied (max Collider).
 * Ueberlast -> Deferred (einreihbar, kein Verlust) oder Rejected (hart zu eng).
 */
export const prepareR5Bounded = (
  object: StructuralObject,
  budgets: R5PrepareBudgets
): R5PrepareDecision => {
  const validBudget = (value: unknown): value is number =>
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    !Object.is(value, -0);
  const occupiedCells = object.bricks.reduce((sum, brick) => sum + brick.cells.length, 0);
  const brickCount = object.bricks.length;
  const estimatedWork = R5_ESTIMATED_WORK_PER_OCCUPIED_CELL * occupiedCells;
  const estimatedWorkKind: R5WorkEstimateKind = "estimate:9x-occupied-cells";
  const budgetRecord =
    typeof budgets === "object" && budgets !== null
      ? (budgets as Partial<Record<"maxOccupiedCells" | "maxBricks" | "maxTotalWork", unknown>>)
      : null;
  if (
    budgetRecord === null ||
    !validBudget(budgetRecord.maxOccupiedCells) ||
    !validBudget(budgetRecord.maxBricks) ||
    !validBudget(budgetRecord.maxTotalWork)
  ) {
    return deepFreeze({
      status: "Rejected" as const,
      occupiedCells,
      brickCount,
      estimatedWork,
      estimatedWorkKind,
      reason: "r5/budgets/invalid"
    });
  }
  if (occupiedCells > budgets.maxOccupiedCells || brickCount > budgets.maxBricks) {
    return deepFreeze({
      status: "Rejected" as const,
      occupiedCells,
      brickCount,
      estimatedWork,
      estimatedWorkKind,
      reason: "r5/budgets/occupied-or-bricks"
    });
  }
  if (estimatedWork > budgets.maxTotalWork) {
    return deepFreeze({
      status: "Deferred" as const,
      occupiedCells,
      brickCount,
      estimatedWork,
      estimatedWorkKind,
      reason: "r5/budgets/total-work"
    });
  }
  return deepFreeze({
    status: "Ready" as const, occupiedCells, brickCount, estimatedWork, estimatedWorkKind, reason: null
  });
};

const R5_DISPLAY_COLORS: Readonly<Record<number, string>> = {
  1: "#8a7f6a",
  2: "#7d8ea3",
  3: "#c2a15a"
};

/** Deterministische Pruef-Szene aus Mesh-Produkt + Fixture-Materialien (kein Renderer).
 *
 * Fail-closed: das Mesh muss zum Objekt gehoeren (sourceContentHash + Revision),
 * sonst wuerde veraltetes Mesh mit aktuellen Materialien komponiert.
 */
export const describeR5Scene = (
  object: StructuralObject,
  mesh: StructuralMeshProduct,
  lod: R5Lod
): R5SceneDescriptor => {
  if (mesh.sourceContentHash !== object.contentHash || mesh.sourceRevision !== object.objectRevision) {
    throw new Error("R5 scene requires the mesh product of the given object (stale mesh rejected).");
  }
  if (lod !== "low" && lod !== "high") {
    throw new Error(`Unknown R5 LOD "${String(lod)}" (expected "low" | "high").`);
  }
  const materials: R5SceneMaterial[] = object.materials.map((material) => ({
    materialId: material.materialId,
    densityKgPerCubicMeter: material.densityKgPerCubicMeter,
    structuralClass: material.structuralClass,
    displayColor: R5_DISPLAY_COLORS[material.materialId] ?? "#ffffff",
    roughness: 0.85
  }));
  const bounds = mesh.boundsMeters;
  const center = bounds === null
    ? { x: 0, y: 0, z: 0 }
    : {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2
    };
  const sizeX = bounds === null ? 0 : bounds.max.x - bounds.min.x;
  const sizeY = bounds === null ? 0 : bounds.max.y - bounds.min.y;
  const sizeZ = bounds === null ? 0 : bounds.max.z - bounds.min.z;
  const distance = Math.max(sizeX, sizeY, sizeZ) * 2 + 2;
  return deepFreeze({
    schemaVersion: "pg-tragwerk-r5-scene-v1",
    meshContentHash: mesh.contentHash,
    sourceContentHash: mesh.sourceContentHash,
    lod,
    materials: deepFreeze(materials),
    lights: deepFreeze({ keyIntensity: 2.5, fillIntensity: 0.8, ambientIntensity: 0.4 }),
    camera: deepFreeze({
      positionMeters: deepFreeze({ x: center.x + distance, y: center.y + distance * 0.6, z: center.z + distance }),
      targetMeters: deepFreeze(center)
    }),
    boundsMeters: bounds,
    quadCount: mesh.indices.length / 6
  });
};

/* ------------------------------------------------------------------ */
/* Paket P-PG-R5B — additiv auf R5, R3/R4/F8-Vertraege unberuehrt.        */
/*                                                                     */
/* - measureR5Work: gemessene (nicht geschaetzte) Arbeit nach Ready.    */
/* - selectR5RenderLodGeometry: Renderer-LOD-Geometrie (THREE-agnostisch, */
/*   low = gemergte Greedy-Boxen/shared Material, high = per-Voxel-Boxen */
/*   /distinct Material). Physik-Approximation (Colliderwahl) und        */
/*   Render-LOD (sichtbare Geometrie/Material) sind getrennte            */
/*   Entscheidungen mit gleicher Authority.                             */
/* - createR5DeferredJobRequest/completeR5DeferredRun: Deferred-Pfad    */
/*   als echter Queue-Job (synchron dispatch-then-execute, kein Worker-  */
/*   Thread) mit Re-Prepare zu Ready und Materie-Erhalt. Timings sind   */
/*   Dev-Maschinen-Beobachtungen via performance.now(), keine            */
/*   Hardware-Aussagen.                                                 */
/* ------------------------------------------------------------------ */

export interface R5MeasuredWorkTimings {
  readonly classifyMs: number;
  readonly meshMs: number;
  readonly transitionMs: number;
}

export interface R5MeasureInput {
  readonly occupiedCells: number;
  readonly classification: StructuralComponentClassification;
  readonly meshQuadCount: number;
  readonly plan: StructuralPhysicsTransitionResult;
  readonly timings: R5MeasuredWorkTimings;
}

export interface R5MeasuredWork extends R5MeasuredWorkTimings {
  readonly visitedCells: number;
  readonly components: number;
  readonly fragments: number;
  readonly quads: number;
  readonly colliders: number;
  readonly totalMeasured: number;
}

const countR5PlanColliders = (plan: StructuralPhysicsTransitionResult): number => {
  let colliders = 0;
  for (const body of plan.dynamicBodies) {
    colliders += body.voxelColliders.length + body.greedyColliders.length;
  }
  if (plan.status === "Fallback") {
    colliders += plan.debris.voxelColliders.length + plan.debris.greedyColliders.length;
  }
  return colliders;
};

/** Gemessene Arbeit nach Ready — separat von der 9x-Schaetzung (prepareR5Bounded). */
export const measureR5Work = (input: R5MeasureInput): R5MeasuredWork => {
  const visitedCells = input.occupiedCells;
  const components = input.classification.components.length;
  const fragments = input.classification.fragments.length;
  const quads = input.meshQuadCount;
  const colliders = countR5PlanColliders(input.plan);
  return deepFreeze({
    visitedCells,
    components,
    fragments,
    quads,
    colliders,
    totalMeasured: visitedCells + components + fragments + quads + colliders,
    classifyMs: input.timings.classifyMs,
    meshMs: input.timings.meshMs,
    transitionMs: input.timings.transitionMs
  });
};

export type R5RenderMaterialVariant = "r5-low-shared" | "r5-high-per-voxel";

export interface R5RenderBox {
  readonly minMeters: StructuralColliderBoxMeters["minMeters"];
  readonly maxMeters: StructuralColliderBoxMeters["maxMeters"];
  readonly materialVariant: R5RenderMaterialVariant;
}

/**
 * Renderer-LOD-Geometrie aus demselben Transition-Plan (THREE-agnostische
 * Boxen + Materialvariante, keine Produkt-Renderer-Aenderung):
 * low = gemergte Greedy-Boxen mit shared Material,
 * high = per-Voxel-Boxen mit distinct Material.
 */
export const selectR5RenderLodGeometry = (
  plan: StructuralPhysicsTransitionResult,
  lod: R5Lod
): readonly R5RenderBox[] => {
  const colliders = selectR5LodColliders(plan, lod);
  const materialVariant: R5RenderMaterialVariant = lod === "low" ? "r5-low-shared" : "r5-high-per-voxel";
  return deepFreeze(
    colliders.map((box) => deepFreeze({
      minMeters: box.minMeters,
      maxMeters: box.maxMeters,
      materialVariant
    }))
  );
};

export interface R5DeferredPayload {
  readonly kind: "pg-tragwerk-r5-deferred-v1";
  readonly objectId: string;
  readonly objectRevision: number;
  readonly estimatedWork: number;
}

/** Deferred-Entscheidung als echter, JSON-serialisierbarer Queue-Job (fail-closed ausserhalb Deferred). */
export const createR5DeferredJobRequest = (
  decision: R5PrepareDecision,
  object: StructuralObject
): WorkerJobRequest<R5DeferredPayload> => {
  if (decision.status !== "Deferred") {
    throw new Error(`R5 deferred job requires a Deferred decision (received "${decision.status}").`);
  }
  return deepFreeze({
    jobId: "pg-r5-deferred-run" as WorkerJobRequest<R5DeferredPayload>["jobId"],
    jobKind: "TransformBuffer" as WorkerJobRequest<R5DeferredPayload>["jobKind"],
    targetKey: String(object.objectId) as WorkerJobRequest<R5DeferredPayload>["targetKey"],
    planningEpoch: 1 as WorkerJobRequest<R5DeferredPayload>["planningEpoch"],
    workerEpoch: 0 as WorkerJobRequest<R5DeferredPayload>["workerEpoch"],
    inputRevision: Number(object.objectRevision) as WorkerJobRequest<R5DeferredPayload>["inputRevision"],
    algorithmVersion: 1 as WorkerJobRequest<R5DeferredPayload>["algorithmVersion"],
    priority: "Normal" as WorkerJobRequest<R5DeferredPayload>["priority"],
    deadline: 0 as WorkerJobRequest<R5DeferredPayload>["deadline"],
    estimatedInputBytes: 1 as WorkerJobRequest<R5DeferredPayload>["estimatedInputBytes"],
    estimatedOutputBytes: 1 as WorkerJobRequest<R5DeferredPayload>["estimatedOutputBytes"],
    payload: deepFreeze({
      kind: "pg-tragwerk-r5-deferred-v1",
      objectId: String(object.objectId),
      objectRevision: Number(object.objectRevision),
      estimatedWork: decision.estimatedWork
    })
  });
};

export interface R5DeferredHooks {
  readonly classify: (object: StructuralObject) => StructuralComponentClassification;
  readonly mesh: (object: StructuralObject) => StructuralMeshProduct;
  readonly transition: (
    object: StructuralObject,
    classification: StructuralComponentClassification
  ) => StructuralPhysicsTransitionResult;
  readonly massKg: (object: StructuralObject) => number;
}

export interface R5DeferredCompletion {
  readonly dispatchedJobId: WorkerJobRequest<R5DeferredPayload>["jobId"];
  readonly decision: R5PrepareDecision;
  readonly measured: R5MeasuredWork;
  readonly anchoredVoxels: number;
  readonly fragmentVoxels: number;
  readonly dynamicVoxels: number;
  readonly massKg: number;
}

const r5NowMs = (): number => {
  const now = performance.now();
  return Number.isFinite(now) ? now : 0;
};

/**
 * Deferred-Vollzug: synchron dispatch-then-execute (kein Worker-Thread).
 * Entnimmt den Job aus der Queue, bereitet mit entspannten Budgets erneut
 * zu Ready vor und faehrt die volle Ableitung bis zum Abschluss — die
 * Fragmente bilanzieren jede Zelle, die Masse bleibt erhalten.
 */
export const completeR5DeferredRun = (
  object: StructuralObject,
  queue: StableWorkerJobQueue,
  relaxedBudgets: R5PrepareBudgets,
  hooks: R5DeferredHooks
): R5DeferredCompletion => {
  const dispatched = queue.dispatchNext();
  if (!dispatched) {
    throw new Error("R5 deferred run requires a dispatched queue job (queue empty).");
  }
  const decision = prepareR5Bounded(object, relaxedBudgets);
  if (decision.status !== "Ready") {
    throw new Error(`R5 deferred run requires relaxed budgets reaching Ready (received "${decision.status}").`);
  }
  const classifyStart = r5NowMs();
  const classification = hooks.classify(object);
  const classifyMs = Math.max(0, r5NowMs() - classifyStart);
  const meshStart = r5NowMs();
  const mesh = hooks.mesh(object);
  const meshMs = Math.max(0, r5NowMs() - meshStart);
  const transitionStart = r5NowMs();
  const plan = hooks.transition(object, classification);
  const transitionMs = Math.max(0, r5NowMs() - transitionStart);
  const measured = measureR5Work({
    occupiedCells: decision.occupiedCells,
    classification,
    meshQuadCount: mesh.indices.length / 6,
    plan,
    timings: { classifyMs, meshMs, transitionMs }
  });
  const fragmentVoxels = classification.fragments.reduce(
    (sum, fragment) => sum + fragment.occupiedCells.length, 0
  );
  const anchoredVoxels = classification.anchoredComponents.reduce(
    (sum, component) => sum + component.occupiedCells.length, 0
  );
  const dynamicVoxels =
    plan.dynamicBodies.reduce((sum, body) => sum + body.occupiedVoxelCount, 0) +
    (plan.status === "Fallback" ? plan.debris.occupiedVoxelCount : 0);
  // Materie-Erhalt auf zwei Ebenen: Klassifikation partitioniert alle Zellen
  // (Anker + Fragmente), und der installierte Plan vertritt jede nicht
  // verankerte Zelle dynamisch (direkt oder via Debris) — Anker bleibt statisch.
  if (anchoredVoxels + fragmentVoxels !== decision.occupiedCells) {
    throw new Error(
      `R5 deferred run lost matter in classification: ${anchoredVoxels} anchored + ${fragmentVoxels} fragment vs ${decision.occupiedCells} occupied cells.`
    );
  }
  if (anchoredVoxels + dynamicVoxels !== decision.occupiedCells) {
    throw new Error(
      `R5 deferred run lost matter in transition: ${anchoredVoxels} anchored + ${dynamicVoxels} dynamic vs ${decision.occupiedCells} occupied cells.`
    );
  }
  return deepFreeze({
    dispatchedJobId: dispatched.jobId as WorkerJobRequest<R5DeferredPayload>["jobId"],
    decision,
    measured,
    anchoredVoxels,
    fragmentVoxels,
    dynamicVoxels,
    massKg: hooks.massKg(object)
  });
};
