import {
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  createAdaptiveBrickKey,
  deepFreeze,
  serializeAdaptiveKey,
  type AdaptiveBrickKey
} from "../adaptive";
import { globalQuantumForStructuralCell } from "./coordinates";
import { reconstructStructuralObjectInternal, structuralAddressForBrickCell } from "./model";
import {
  STRUCTURAL_BRICK_SCHEMA_VERSION,
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

export interface R5PrepareDecision {
  readonly status: R5PrepareStatus;
  readonly occupiedCells: number;
  readonly brickCount: number;
  readonly estimatedWork: number;
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
 */
export const withFullKnownCoverage = (object: StructuralObject): StructuralObject => {
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
  const estimatedWork = occupiedCells + 6 * occupiedCells + 2 * occupiedCells;
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
      reason: "r5/budgets/invalid"
    });
  }
  if (occupiedCells > budgets.maxOccupiedCells || brickCount > budgets.maxBricks) {
    return deepFreeze({
      status: "Rejected" as const,
      occupiedCells,
      brickCount,
      estimatedWork,
      reason: "r5/budgets/occupied-or-bricks"
    });
  }
  if (estimatedWork > budgets.maxTotalWork) {
    return deepFreeze({
      status: "Deferred" as const,
      occupiedCells,
      brickCount,
      estimatedWork,
      reason: "r5/budgets/total-work"
    });
  }
  return deepFreeze({ status: "Ready" as const, occupiedCells, brickCount, estimatedWork, reason: null });
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
