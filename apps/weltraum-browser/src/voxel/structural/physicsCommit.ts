import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  requireExactKeys as adaptiveRequireExactKeys,
  requireFinite as adaptiveRequireFinite,
  requirePlainRecord as adaptiveRequirePlainRecord,
  type MeterPoint
} from "../adaptive";
import { globalQuantumForStructuralCell } from "./coordinates";
import {
  hashStructuralFragmentContent,
  hashStructuralFragmentId,
  serializeStructuralCellAddress
} from "./canonical";
import { structuralAddressForBrickCell } from "./model";
import type {
  StructuralCellAddress,
  StructuralComponent,
  StructuralComponentClassification,
  StructuralFragmentId,
  StructuralObject
} from "./types";
import { normalizeAdaptiveAuthorityFunction } from "./validation";
import type {
  StructuralInstalledPhysicsTransition,
  StructuralParentMotionSource
} from "./physicsTransition";

const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requireFinite = normalizeAdaptiveAuthorityFunction(adaptiveRequireFinite);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);

export const STRUCTURAL_PHYSICS_COMMIT_SCHEMA_VERSION = "structural-microvoxel-physics-commit-v1" as const;

export class StructuralPhysicsCommitError extends Error {
  readonly code: "InvalidStructuralState" | "CommitFailed";
  readonly path: string;
  readonly phase: "validate" | "create" | "remove";
  readonly worldRestored: boolean;

  constructor(
    code: "InvalidStructuralState" | "CommitFailed",
    path: string,
    message: string,
    phase: "validate" | "create" | "remove",
    worldRestored: boolean
  ) {
    super(message);
    this.name = "StructuralPhysicsCommitError";
    this.code = code;
    this.path = path;
    this.phase = phase;
    this.worldRestored = worldRestored;
  }
}

const fail = (
  code: "InvalidStructuralState" | "CommitFailed",
  path: string,
  message: string,
  phase: "validate" | "create" | "remove",
  worldRestored: boolean
): never => {
  throw new StructuralPhysicsCommitError(code, path, message, phase, worldRestored);
};

export interface StructuralWorldQuaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface StructuralParentWorldPose {
  readonly translationMeters: MeterPoint;
  readonly rotation: StructuralWorldQuaternion;
}

export type StructuralColliderMassSpec =
  | { readonly kind: "massless" }
  | {
      readonly kind: "canonical-body";
      readonly massKg: number;
      readonly centerOfMassLocal: MeterPoint;
      readonly principalInertia: MeterPoint;
      readonly frame: StructuralWorldQuaternion;
    };

export interface StructuralWorldCuboid {
  readonly halfExtentsMeters: MeterPoint;
  readonly offsetWrtBodyMeters: MeterPoint;
}

export interface StructuralBodyPoseMotion {
  readonly dynamic: boolean;
  readonly translationMeters: MeterPoint;
  readonly rotation: StructuralWorldQuaternion;
  readonly linvelMetersPerSecond: MeterPoint;
  readonly angvelRadPerSecond: MeterPoint;
}

/**
 * P-PG-R4B — explizit persistierte Fragmentbewegung aus dem versionierten
 * Region-Save. Ersetzt am Commit die Plan-abgeleitete Pose/Velocity des
 * Fragments; Geometrie- und Partitionsbindung bleiben unveraendert
 * (Prepared-Zustand). Nur geschlossen gueltig: alle Plan-Fragmente, exakt
 * einmal — sonst scheitert der Commit VOR der ersten Weltmutation.
 */
export interface StructuralRestoredFragmentMotion {
  readonly fragmentId: StructuralFragmentId;
  readonly translationMeters: MeterPoint;
  readonly rotation: StructuralWorldQuaternion;
  readonly linvelMetersPerSecond: MeterPoint;
  readonly angvelRadPerSecond: MeterPoint;
}

/**
 * Solver-neutrale Weltgrenze. Der Commit ruft niemals `step` auf (keine
 * Methode dafuer vorhanden): Ueberlappung zwischen altem Parent und neuen
 * Bodies ist ohne Step unbeobachtbar, der Tausch ist atomar im
 * Step-Zaehler-Sinn. Fehlererkennung nach Mutationsbeginn raeumt erstellte
 * Bodies wieder ab, bevor der Parent entfernt wurde — die Welt steht dann
 * exakt wie vor dem Commit.
 *
 * P-PROD-P04: BodyRef-Handles sind single-use und muessen live sein. Ein
 * Doppel-Commit mit demselben (bereits entfernten) Parent-Handle oder die
 * Wiederverwendung stale Handles ist eine Caller-Vertragsverletzung und wird
 * vom Commit nicht fail-closed abgefangen (der Port bietet keine
 * Handle-Liveness-Pruefung). Aufrufer duerfen jeden Parent genau einmal
 * committen; F8-F belegt das enge Verhalten am zaehlenden Port.
 */
export interface StructuralPhysicsWorldPort<BodyRef> {
  bodiesLen(): number;
  collidersLen(): number;
  createBody(pose: StructuralBodyPoseMotion): BodyRef;
  addCollider(body: BodyRef, cuboid: StructuralWorldCuboid, mass: StructuralColliderMassSpec): void;
  bodyColliderCount(body: BodyRef): number;
  removeBody(body: BodyRef): void;
}

interface StructuralPhysicsCommitRequestBase<BodyRef> {
  readonly port: StructuralPhysicsWorldPort<BodyRef>;
  readonly parentBody: BodyRef;
  readonly plan: StructuralInstalledPhysicsTransition;
  readonly live: StructuralObject;
  readonly classification: StructuralComponentClassification;
  readonly parentWorldPose?: StructuralParentWorldPose;
  readonly preCutCenterAuthorMeters?: MeterPoint;
}

export interface StructuralFreshPhysicsCommitRequest<BodyRef> extends StructuralPhysicsCommitRequestBase<BodyRef> {
  readonly mode?: "fresh";
  readonly restoredFragmentMotions?: never;
}

export interface StructuralRestorePhysicsCommitRequest<BodyRef> extends StructuralPhysicsCommitRequestBase<BodyRef> {
  readonly mode: "restore";
  /**
   * Beim Wiederaufbau aus einem Region-Save verpflichtend; der Satz muss alle
   * Plan-Fragmente geschlossen abdecken. Ein leerer Satz ist nur fuer einen
   * installierten Plan ohne dynamische Fragmente gueltig.
   */
  readonly restoredFragmentMotions: readonly StructuralRestoredFragmentMotion[];
}

export type StructuralPhysicsCommitRequest<BodyRef> =
  | StructuralFreshPhysicsCommitRequest<BodyRef>
  | StructuralRestorePhysicsCommitRequest<BodyRef>;

export interface StructuralCommittedFragment {
  readonly fragmentId: StructuralFragmentId;
  readonly installedColliderCount: number;
  readonly translationMeters: MeterPoint;
  readonly linvelMetersPerSecond: MeterPoint;
}

export interface StructuralPhysicsCommitReceipt {
  readonly schemaVersion: typeof STRUCTURAL_PHYSICS_COMMIT_SCHEMA_VERSION;
  readonly childPoseSource: "author" | "live-parent-pose";
  readonly parentMotionSource: StructuralParentMotionSource;
  readonly bodiesBefore: number;
  readonly bodiesAfter: number;
  readonly collidersBefore: number;
  readonly collidersAfter: number;
  readonly anchoredColliderCount: number;
  readonly fragments: readonly StructuralCommittedFragment[];
}

const finiteNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number") {
    throw new StructuralPhysicsCommitError("InvalidStructuralState", path, "Expected a finite number.", "validate", true);
  }
  return requireFinite(value, path);
};

const validateVector = (value: unknown, path: string): MeterPoint => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["x", "y", "z"], path);
  return deepFreeze({
    x: finiteNumber(record.x, `${path}/x`),
    y: finiteNumber(record.y, `${path}/y`),
    z: finiteNumber(record.z, `${path}/z`)
  });
};

const validateQuaternion = (value: unknown, path: string): StructuralWorldQuaternion => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["x", "y", "z", "w"], path);
  const quat = deepFreeze({
    x: finiteNumber(record.x, `${path}/x`),
    y: finiteNumber(record.y, `${path}/y`),
    z: finiteNumber(record.z, `${path}/z`),
    w: finiteNumber(record.w, `${path}/w`)
  });
  const norm = Math.sqrt(quat.x * quat.x + quat.y * quat.y + quat.z * quat.z + quat.w * quat.w);
  if (Math.abs(norm - 1) > 1e-6) {
    fail("InvalidStructuralState", path, "Parent rotation must be a unit quaternion.", "validate", true);
  }
  return quat;
};

const cross = (a: MeterPoint, b: MeterPoint): MeterPoint =>
  deepFreeze({
    x: requireFinite(a.y * b.z - a.z * b.y, "commit/crossX"),
    y: requireFinite(a.z * b.x - a.x * b.z, "commit/crossY"),
    z: requireFinite(a.x * b.y - a.y * b.x, "commit/crossZ")
  });

/** Rotiert v mit Einheitsquaternion q (Weltabbildung starrer Parentbewegung). */
export const rotateStructuralWorldVector = (
  quatValue: StructuralWorldQuaternion,
  vectorValue: MeterPoint
): MeterPoint => {
  const quat = validateQuaternion(quatValue, "commit/rotation");
  const vector = validateVector(vectorValue, "commit/vector");
  const qv = deepFreeze({ x: quat.x, y: quat.y, z: quat.z });
  const uv = cross(qv, vector);
  const uuv = cross(qv, uv);
  return deepFreeze({
    x: requireFinite(vector.x + 2 * (quat.w * uv.x + uuv.x), "commit/rotatedX"),
    y: requireFinite(vector.y + 2 * (quat.w * uv.y + uuv.y), "commit/rotatedY"),
    z: requireFinite(vector.z + 2 * (quat.w * uv.z + uuv.z), "commit/rotatedZ")
  });
};

/**
 * Weltabbildung eines Autorpunkts: W(p) = T + R * (p - A).
 * Bezugspunkt A ist der tatsächliche Vor-Schnitt-COM in Autormetern
 * (nicht der Nach-Schnitt-COM des Plans).
 */
export const mapStructuralAuthorPointToWorld = (
  quatValue: StructuralWorldQuaternion,
  translationValue: MeterPoint,
  anchorAuthorValue: MeterPoint,
  pointAuthorValue: MeterPoint
): MeterPoint => {
  const translation = validateVector(translationValue, "commit/translation");
  const anchor = validateVector(anchorAuthorValue, "commit/preCutCenter");
  const point = validateVector(pointAuthorValue, "commit/authorPoint");
  const offset = deepFreeze({
    x: requireFinite(point.x - anchor.x, "commit/offsetX"),
    y: requireFinite(point.y - anchor.y, "commit/offsetY"),
    z: requireFinite(point.z - anchor.z, "commit/offsetZ")
  });
  const rotated = rotateStructuralWorldVector(quatValue, offset);
  return deepFreeze({
    x: requireFinite(translation.x + rotated.x, "commit/worldX"),
    y: requireFinite(translation.y + rotated.y, "commit/worldY"),
    z: requireFinite(translation.z + rotated.z, "commit/worldZ")
  });
};

/** v_kind im Weltraum nach Parenttransformation: v = v_p + omega x (W(c) - T). */
export const deriveStructuralWorldSplitVelocity = (
  linvelValue: MeterPoint,
  angvelValue: MeterPoint,
  parentTranslationValue: MeterPoint,
  childTranslationValue: MeterPoint
): MeterPoint => {
  const linvel = validateVector(linvelValue, "commit/linvel");
  const angvel = validateVector(angvelValue, "commit/angvel");
  const parent = validateVector(parentTranslationValue, "commit/parentTranslation");
  const child = validateVector(childTranslationValue, "commit/childTranslation");
  const arm = deepFreeze({
    x: requireFinite(child.x - parent.x, "commit/armX"),
    y: requireFinite(child.y - parent.y, "commit/armY"),
    z: requireFinite(child.z - parent.z, "commit/armZ")
  });
  const swirl = cross(angvel, arm);
  return deepFreeze({
    x: requireFinite(linvel.x + swirl.x, "commit/splitX"),
    y: requireFinite(linvel.y + swirl.y, "commit/splitY"),
    z: requireFinite(linvel.z + swirl.z, "commit/splitZ")
  });
};

const voxelCuboidForCell = (
  address: Parameters<typeof globalQuantumForStructuralCell>[0],
  center: MeterPoint
): StructuralWorldCuboid => {
  const global = globalQuantumForStructuralCell(address);
  const side = MICROVOXEL_BASE_QUANTUM_METERS;
  const boxCenter = {
    x: (global.x + 0.5) * side,
    y: (global.y + 0.5) * side,
    z: (global.z + 0.5) * side
  };
  return deepFreeze({
    halfExtentsMeters: deepFreeze({ x: side / 2, y: side / 2, z: side / 2 }),
    offsetWrtBodyMeters: deepFreeze({
      x: requireFinite(boxCenter.x - center.x, "commit/cuboidOffsetX"),
      y: requireFinite(boxCenter.y - center.y, "commit/cuboidOffsetY"),
      z: requireFinite(boxCenter.z - center.z, "commit/cuboidOffsetZ")
    })
  });
};

const identityRotation = (): StructuralWorldQuaternion => deepFreeze({ x: 0, y: 0, z: 0, w: 1 });
const zeroVector = (): MeterPoint => deepFreeze({ x: 0, y: 0, z: 0 });

export const commitStructuralPhysicsTransition = <BodyRef>(
  request: StructuralPhysicsCommitRequest<BodyRef>
): StructuralPhysicsCommitReceipt => {
  const { port, parentBody, plan, live, classification, parentWorldPose, preCutCenterAuthorMeters } = request;
  const restored = true;
  const requestMode = (request as { readonly mode?: unknown }).mode;
  if (requestMode !== undefined && requestMode !== "fresh" && requestMode !== "restore") {
    fail(
      "InvalidStructuralState",
      "request/mode",
      "Commit mode must be fresh or restore; unknown modes cannot fall back to a fresh install.",
      "validate",
      restored
    );
  }
  if (plan.status !== "Installed") {
    fail("InvalidStructuralState", "plan/status", "Commit requires an installed plan (no debris fallback).", "validate", restored);
  }
  if (plan.objectRevision !== live.objectRevision || plan.sourceContentHash !== live.contentHash) {
    fail(
      "InvalidStructuralState",
      "plan/binding",
      "Stale plan: revision or content hash does not match the live object. Commit refused before touching the world.",
      "validate",
      restored
    );
  }
  // Plan-Integritaet: contentHash ueber alles ausser sich selbst nachrechnen.
  const { contentHash: planHash, ...unsigned } = plan as unknown as {
    contentHash: unknown;
  } & Record<string, unknown>;
  if (hashAdaptiveCanonical(unsigned) !== planHash) {
    fail("InvalidStructuralState", "plan/contentHash", "Plan content hash mismatch.", "validate", restored);
  }
  if (plan.objectId !== live.objectId) {
    fail(
      "InvalidStructuralState",
      "plan/binding",
      "Mismatched binding: object id does not match the live object. Commit refused before touching the world.",
      "validate",
      restored
    );
  }
  // P-PG-F8 (Audit Abschnitt 4): Klassifikation + Plan VOR erster Weltmutation
  // an denselben kanonischen Objektstand binden (exakte Partition,
  // Fragmentidentitaeten, vollstaendige Restbelegung). Der Commit installierte
  // bisher Zellen der ungebundenen Klassifikation bei unveraendertem Planhash
  // (falsche Fragment-Collider, stiller Ankerverlust bei leerem Rest). Alle
  // Pruefungen laufen vor dem ersten port.createBody; die Installation liest
  // danach nur noch den gemeinsam validierten, eingefrorenen Prepared-Zustand.
  interface StructuralPreparedFragment {
    readonly fragmentId: StructuralFragmentId;
    readonly occupiedCells: readonly StructuralCellAddress[];
  }
  interface StructuralPreparedInstall {
    readonly anchoredCells: readonly StructuralCellAddress[];
    readonly fragments: readonly StructuralPreparedFragment[];
  }
  const bindClassificationToPlan = (): StructuralPreparedInstall => {
    if (classification.fragments.length !== classification.detachedComponents.length) {
      fail(
        "InvalidStructuralState",
        "classification/binding",
        "Fragment count must match detached-component count (same canonical object state).",
        "validate",
        restored
      );
    }
    if (plan.dynamicBodies.length !== classification.fragments.length) {
      fail(
        "InvalidStructuralState",
        "classification/binding",
        "Plan fragment count must match classification fragment count.",
        "validate",
        restored
      );
    }
    const plannedIds = new Set(plan.dynamicFragmentIds);
    if (plannedIds.size !== plan.dynamicBodies.length) {
      fail("InvalidStructuralState", "plan/binding", "Plan fragment ids must be unique.", "validate", restored);
    }
    for (const fragment of classification.fragments) {
      if (!plannedIds.has(fragment.fragmentId)) {
        fail(
          "InvalidStructuralState",
          "classification/binding",
          "Classification fragment is not part of the plan (unbound classification).",
          "validate",
          restored
        );
      }
    }
    const fragmentComponentIds = new Set(classification.fragments.map((entry) => entry.componentId));
    for (const component of classification.detachedComponents) {
      if (!fragmentComponentIds.has(component.componentId)) {
        fail(
          "InvalidStructuralState",
          "classification/binding",
          "Detached component has no fragment in this classification state.",
          "validate",
          restored
        );
      }
    }
    // Fragment <-> Component an dieselbe Objektversion binden (P1 aus derive):
    // stale/vertauschte Zellen scheitern hier, nicht erst in der Welt.
    for (let index = 0; index < classification.fragments.length; index += 1) {
      const path = `classification/fragments/${index}`;
      const fragment = classification.fragments[index];
      const component = classification.detachedComponents.find((entry) => entry.componentId === fragment.componentId);
      if (component === undefined) {
        fail("InvalidStructuralState", path, "Fragment has no matching detached component.", "validate", restored);
      }
      const bound = component as StructuralComponent;
      if (
        fragment.objectId !== live.objectId ||
        fragment.objectRevision !== live.objectRevision ||
        fragment.sourceContentHash !== live.contentHash ||
        bound.objectId !== live.objectId ||
        bound.objectRevision !== live.objectRevision ||
        bound.sourceContentHash !== live.contentHash ||
        fragment.sourceAdaptiveAuthorityDigest !== bound.sourceAdaptiveAuthorityDigest
      ) {
        fail(
          "InvalidStructuralState",
          path,
          "Fragment and component must bind the same live object version and content hash.",
          "validate",
          restored
        );
      }
      const fragmentCellKeys = fragment.occupiedCells.map((address) => serializeStructuralCellAddress(address)).sort();
      const componentCellKeys = bound.occupiedCells.map((address) => serializeStructuralCellAddress(address)).sort();
      if (
        fragmentCellKeys.length !== componentCellKeys.length ||
        fragmentCellKeys.some((key, keyIndex) => key !== componentCellKeys[keyIndex])
      ) {
        fail("InvalidStructuralState", path, "Fragment cells must exactly match the bound component cells.", "validate", restored);
      }
      const recomputedContent = hashStructuralFragmentContent({
        componentId: fragment.componentId,
        sourceContentHash: live.contentHash,
        sourceAdaptiveAuthorityDigest: bound.sourceAdaptiveAuthorityDigest,
        componentContentHash: bound.componentContentHash,
        occupiedCellKeys: bound.occupiedCells.map((address) => serializeStructuralCellAddress(address))
      });
      if (recomputedContent !== fragment.fragmentContentHash) {
        fail("InvalidStructuralState", path, "Fragment content hash must match the bound component and live version.", "validate", restored);
      }
      const recomputedId = hashStructuralFragmentId({
        objectId: live.objectId,
        objectRevision: live.objectRevision,
        componentId: fragment.componentId,
        fragmentContentHash: fragment.fragmentContentHash
      });
      if (recomputedId !== fragment.fragmentId) {
        fail("InvalidStructuralState", path, "Fragment id must match the bound live version and content.", "validate", restored);
      }
    }
    // Exakte Partition: Union(verankert + alle Fragmente) == kanonische
    // Occupancy des live-Objekts — keine Doppelbelegung, keine Phantomzellen
    // (verschoben/veraltet), keine Luecke (z.B. geleerter Anker-Rest).
    const canonicalKeys = new Set<string>();
    let totalOccupied = 0;
    for (const brick of live.bricks) {
      for (const cell of brick.cells) {
        canonicalKeys.add(serializeStructuralCellAddress(structuralAddressForBrickCell(brick, cell.localIndex)));
        totalOccupied += 1;
      }
    }
    const claimedBy = new Map<string, string>();
    const claimCell = (key: string, path: string): void => {
      if (!canonicalKeys.has(key)) {
        fail("InvalidStructuralState", path, "Claimed cell is not part of the canonical live occupancy (phantom or stale cell).", "validate", restored);
      }
      const firstClaim = claimedBy.get(key);
      if (firstClaim !== undefined) {
        fail("InvalidStructuralState", path, `Cell is claimed twice (first claim at ${firstClaim}).`, "validate", restored);
      }
      claimedBy.set(key, path);
    };
    let anchoredVoxels = 0;
    classification.anchoredComponents.forEach((component, componentIndex) => {
      const path = `classification/anchored/${componentIndex}`;
      if (
        component.objectId !== live.objectId ||
        component.objectRevision !== live.objectRevision ||
        component.sourceContentHash !== live.contentHash
      ) {
        fail("InvalidStructuralState", path, "Anchored component must bind the same live object version and content hash.", "validate", restored);
      }
      for (const address of component.occupiedCells) {
        claimCell(serializeStructuralCellAddress(address), path);
        anchoredVoxels += 1;
      }
    });
    let fragmentVoxels = 0;
    classification.fragments.forEach((fragment, fragmentIndex) => {
      const path = `classification/fragments/${fragmentIndex}`;
      for (const address of fragment.occupiedCells) {
        claimCell(serializeStructuralCellAddress(address), path);
        fragmentVoxels += 1;
      }
    });
    if (claimedBy.size !== canonicalKeys.size || canonicalKeys.size !== totalOccupied) {
      fail(
        "InvalidStructuralState",
        "classification/occupancy",
        "Atomic install requires a disjoint, complete partition: anchored plus fragment cells must equal all live occupied cells.",
        "validate",
        restored
      );
    }
    // Belegung gegen den Plan: Rest- und Fragmentvoxels muessen den
    // Occupancy-Proof des Plans treffen (leerer Rest faellt hier, nicht stumm).
    if (
      anchoredVoxels !== plan.occupancyProof.anchoredVoxels ||
      fragmentVoxels !== plan.occupancyProof.fragmentVoxels ||
      totalOccupied !== plan.occupancyProof.totalOccupiedVoxels
    ) {
      fail(
        "InvalidStructuralState",
        "classification/occupancy",
        "Classification occupancy does not match the plan occupancy proof (unbound classification).",
        "validate",
        restored
      );
    }
    // Installationsgeometrie an den Plan binden: Voxel-Collider jedes
    // Plan-Bodys muessen exakt aus seinen Klassifikationszellen folgen.
    const side = MICROVOXEL_BASE_QUANTUM_METERS;
    const boxKey = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): string =>
      `${minX}|${minY}|${minZ}|${maxX}|${maxY}|${maxZ}`;
    for (let bodyIndex = 0; bodyIndex < plan.dynamicBodies.length; bodyIndex += 1) {
      const bodyPlan = plan.dynamicBodies[bodyIndex];
      const path = `classification/geometry/${bodyIndex}`;
      const fragment = classification.fragments.find((entry) => entry.fragmentId === bodyPlan.fragmentId);
      if (fragment === undefined) {
        fail("InvalidStructuralState", path, "Plan fragment missing in classification.", "validate", restored);
      }
      const bound = fragment as StructuralComponentClassification["fragments"][number];
      if (bound.occupiedCells.length !== bodyPlan.occupiedVoxelCount) {
        fail("InvalidStructuralState", path, "Fragment cell count must match the plan body voxel count.", "validate", restored);
      }
      const expected = bound.occupiedCells
        .map((address) => {
          const global = globalQuantumForStructuralCell(address);
          return boxKey(
            global.x * side, global.y * side, global.z * side,
            (global.x + 1) * side, (global.y + 1) * side, (global.z + 1) * side
          );
        })
        .sort();
      const planned = bodyPlan.voxelColliders
        .map((box) =>
          boxKey(
            box.minMeters.x, box.minMeters.y, box.minMeters.z,
            box.maxMeters.x, box.maxMeters.y, box.maxMeters.z
          )
        )
        .sort();
      if (expected.length !== planned.length || expected.some((key, keyIndex) => key !== planned[keyIndex])) {
        fail("InvalidStructuralState", path, "Fragment install geometry must exactly match the plan voxel colliders.", "validate", restored);
      }
    }
    return deepFreeze({
      anchoredCells: deepFreeze(
        classification.anchoredComponents.flatMap((component) => component.occupiedCells)
      ),
      fragments: deepFreeze(
        plan.dynamicBodies.map((bodyPlan) => {
          const fragment = classification.fragments.find((entry) => entry.fragmentId === bodyPlan.fragmentId) as StructuralComponentClassification["fragments"][number];
          return deepFreeze({
            fragmentId: fragment.fragmentId,
            occupiedCells: deepFreeze(fragment.occupiedCells.slice())
          });
        })
      )
    });
  };
  const prepared = bindClassificationToPlan();

  // P-PG-R4B: persistierte Fragmentbewegungen (Region-Save) ersetzen die
  // Plan-abgeleitete Pose — aber nur geschlossen (alle Plan-Fragmente, exakt
  // einmal, finite Vektoren, Einheitsquaternionen). Jede Luecke, Dublette
  // oder fremde Id scheitert HIER, vor der ersten Weltmutation: fehlende
  // Motion fuehrt niemals zu stillem Default-Weiterlaufen.
  const restoredMotions = ((): ReadonlyMap<string, StructuralRestoredFragmentMotion> | null => {
    const isRestore = request.mode === "restore";
    if (!isRestore) {
      const motions = (request as { readonly restoredFragmentMotions?: readonly StructuralRestoredFragmentMotion[] }).restoredFragmentMotions;
      if (motions !== undefined) {
        fail(
          "InvalidStructuralState",
          "restoredFragmentMotions",
          "Fresh installation cannot carry restored fragment motions; use restore mode.",
          "validate",
          restored
        );
      }
      return null;
    }
    const motions = request.restoredFragmentMotions;
    if (!Array.isArray(motions) || motions.length !== plan.dynamicBodies.length) {
      fail(
        "InvalidStructuralState",
        "restoredFragmentMotions",
        "Restore requires a motion for every planned fragment; missing motions cannot fall back to plan values.",
        "validate",
        restored
      );
    }
    const restoredMotionList = motions as readonly StructuralRestoredFragmentMotion[];
    const plannedIds = new Set(plan.dynamicFragmentIds);
    const seen = new Set<string>();
    const byId = new Map<string, StructuralRestoredFragmentMotion>();
    restoredMotionList.forEach((motion, index) => {
      const path = `restoredFragmentMotions/${index}`;
      const candidate = motion as unknown as {
        readonly fragmentId: unknown;
        readonly translationMeters: unknown;
        readonly rotation: unknown;
        readonly linvelMetersPerSecond: unknown;
        readonly angvelRadPerSecond: unknown;
      };
      if (typeof candidate !== "object" || candidate === null) {
        fail("InvalidStructuralState", path, "Restored motion must be a record.", "validate", restored);
      }
      const rawId: unknown = candidate.fragmentId;
      if (typeof rawId !== "string") {
        fail("InvalidStructuralState", path, "Restored motion fragment id must be a string.", "validate", restored);
      }
      const fragmentId = rawId as string;
      if (!plannedIds.has(fragmentId as StructuralFragmentId)) {
        fail("InvalidStructuralState", path, "Restored motion references an unknown fragment id.", "validate", restored);
      }
      if (seen.has(fragmentId)) {
        fail("InvalidStructuralState", path, "Restored motions must reference each planned fragment exactly once.", "validate", restored);
      }
      seen.add(fragmentId);
      byId.set(fragmentId, deepFreeze({
        fragmentId: fragmentId as StructuralFragmentId,
        translationMeters: validateVector(candidate.translationMeters, `${path}/translationMeters`),
        rotation: validateQuaternion(candidate.rotation, `${path}/rotation`),
        linvelMetersPerSecond: validateVector(candidate.linvelMetersPerSecond, `${path}/linvelMetersPerSecond`),
        angvelRadPerSecond: validateVector(candidate.angvelRadPerSecond, `${path}/angvelRadPerSecond`)
      }));
    });
    for (const plannedId of plannedIds) {
      if (!seen.has(plannedId)) {
        fail(
          "InvalidStructuralState",
          "restoredFragmentMotions",
          `Restored motions miss planned fragment ${plannedId} (no silent default).`,
          "validate",
          restored
        );
      }
    }
    return byId;
  })();

  const useLivePose = parentWorldPose !== undefined;
  const childPoseSource = useLivePose ? ("live-parent-pose" as const) : ("author" as const);
  if (useLivePose && plan.parentMotionSource !== "live-parent-body") {
    fail(
      "InvalidStructuralState",
      "plan/parentMotionSource",
      "A live parent pose requires a live-parent-body motion source (origin label must match).",
      "validate",
      restored
    );
  }
  // P-PROD-P04 (Label-Guard-Symmetrie, spiegelt regionSave.ts): Ein
  // Autoren-Aufruf ohne Parentpose darf keinen live-parent-body-Plan tragen —
  // sonst wuerde der Commit still an der Autorpose installieren, aber das
  // live-Label im Receipt behalten.
  if (!useLivePose && plan.parentMotionSource === "live-parent-body") {
    fail(
      "InvalidStructuralState",
      "plan/parentMotionSource",
      "An author-pose install cannot carry a live-parent-body motion source (origin label must match).",
      "validate",
      restored
    );
  }
  if (useLivePose && preCutCenterAuthorMeters === undefined) {
    fail(
      "InvalidStructuralState",
      "preCutCenterAuthorMeters",
      "A live parent pose requires the actual pre-cut center of mass in author meters.",
      "validate",
      restored
    );
  }
  const pose = useLivePose
    ? {
        translationMeters: validateVector(parentWorldPose.translationMeters, "parentWorldPose/translationMeters"),
        rotation: validateQuaternion(parentWorldPose.rotation, "parentWorldPose/rotation")
      }
    : { translationMeters: zeroVector(), rotation: identityRotation() };
  const anchor = useLivePose
    ? validateVector(preCutCenterAuthorMeters, "preCutCenterAuthorMeters")
    : zeroVector();
  const mapPoint = (authorPoint: MeterPoint): MeterPoint =>
    useLivePose
      ? mapStructuralAuthorPointToWorld(pose.rotation, pose.translationMeters, anchor, authorPoint)
      : validateVector(authorPoint, "commit/authorPoint");

  const parentMotion = plan.parentMotion;
  validateVector(parentMotion.velocityMetersPerSecond, "plan/parentMotion/velocityMetersPerSecond");
  validateVector(parentMotion.angularVelocityRadPerSecond, "plan/parentMotion/angularVelocityRadPerSecond");

  // Explizite kanonische Masseneigenschaften verlangen diagonale Tensoren
  // (alle bisherigen Fragmente); Nebendiagonalen wuerden eine
  // Hauptachsentransformation verlangen und werden fail-closed abgewiesen.
  for (let index = 0; index < plan.dynamicBodies.length; index += 1) {
    validateVector(plan.dynamicBodies[index].centerOfMassMeters, `dynamicBodies/${index}/centerOfMassMeters`);
    validateVector(
      plan.dynamicBodies[index].initialVelocityMetersPerSecond,
      `dynamicBodies/${index}/initialVelocityMetersPerSecond`
    );
    const tensor = plan.dynamicBodies[index].inertiaTensorKgMetersSquared;
    if (Math.abs(tensor.xy) + Math.abs(tensor.xz) + Math.abs(tensor.yz) > 1e-9) {
      fail(
        "InvalidStructuralState",
        `dynamicBodies/${index}/inertiaTensor`,
        "Explicit canonical install supports diagonal inertia tensors only.",
        "validate",
        restored
      );
    }
    if (!(plan.dynamicBodies[index].massKg > 0)) {
      fail("InvalidStructuralState", `dynamicBodies/${index}/massKg`, "Fragment mass must be positive.", "validate", restored);
    }
  }

  const bodiesBefore = port.bodiesLen();
  const collidersBefore = port.collidersLen();
  const created: BodyRef[] = [];
  let parentRemoved = false;
  // P-PG-F8 (Audit Abschnitt 6) — ehrliches Cleanup, Vertrag:
  // - Create/Add-Fehler: Parent unberuehrt, erstellte Bodies rollbacken;
  //   worldRestored:true nur bei VERIFIZIERTEM Rueckbau (Bodies- UND
  //   Colliderzaehlung stimmen wieder), sonst worldRestored:false mit
  //   Cleanup-Kontext — keine sichere Wiederaufnahme behaupten, die
  //   verbleibenden Handles bleiben in der Welt sichtbar.
  // - Parent-Remove-Fehler: konservativ worldRestored:false (die
  //   Remove-Semantik des Ports ist unbekannt), trotz Rollback-Versuch.
  // - Fehler NACH erfolgreicher Parententfernung (z.B. Zaehl-Reads im
  //   Receipt): die Welt kann nicht mehr restauriert werden -> Phase
  //   "remove", worldRestored:false.
  const removeCreated = (): { ok: boolean; failures: number } => {
    let failures = 0;
    for (let index = created.length - 1; index >= 0; index -= 1) {
      try {
        port.removeBody(created[index]);
      } catch {
        failures += 1;
      }
    }
    return { ok: failures === 0, failures };
  };
  const verifyRestored = (): boolean => {
    try {
      return port.bodiesLen() === bodiesBefore && port.collidersLen() === collidersBefore;
    } catch {
      return false;
    }
  };

  try {
    // 1) Verankerten Rest statisch installieren (Kontakt-Cuboids, masselos —
    //    fixe Bodies tragen keine Masseneigenschaften). P-PG-F8 (Audit
    //    Abschnitt 5): Der Restbody traegt die Parentpose (Translation +
    //    Rotation), Collider-Offsets sind body-lokal im Autorframe
    //    (Zellmitte - Anker) — die Engine rotiert sie mit dem Body.
    //    Achsparallele Welt-Offsets am Ursprungs-Body waren unter
    //    R != Identitaet falsch orientiert (Kontaktgeometrie verdreht).
    //    Installationsquelle ist der validierte Prepared-Zustand.
    const anchoredBody = port.createBody({
      dynamic: false,
      translationMeters: pose.translationMeters,
      rotation: pose.rotation,
      linvelMetersPerSecond: zeroVector(),
      angvelRadPerSecond: zeroVector()
    });
    created.push(anchoredBody);
    for (const address of prepared.anchoredCells) {
      const cellCenter = {
        x: (globalQuantumForStructuralCell(address).x + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
        y: (globalQuantumForStructuralCell(address).y + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
        z: (globalQuantumForStructuralCell(address).z + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS
      };
      const authorCenter = validateVector(cellCenter, "commit/anchoredCell");
      const localOffset = deepFreeze({
        x: requireFinite(authorCenter.x - anchor.x, "commit/anchoredLocalX"),
        y: requireFinite(authorCenter.y - anchor.y, "commit/anchoredLocalY"),
        z: requireFinite(authorCenter.z - anchor.z, "commit/anchoredLocalZ")
      });
      port.addCollider(
        anchoredBody,
        {
          halfExtentsMeters: deepFreeze({
            x: MICROVOXEL_BASE_QUANTUM_METERS / 2,
            y: MICROVOXEL_BASE_QUANTUM_METERS / 2,
            z: MICROVOXEL_BASE_QUANTUM_METERS / 2
          }),
          offsetWrtBodyMeters: localOffset
        },
        { kind: "massless" }
      );
    }
    const anchoredColliderCount = port.bodyColliderCount(anchoredBody);
    if (anchoredColliderCount !== prepared.anchoredCells.length) {
      fail(
        "CommitFailed",
        "anchored/colliders",
        `Anchored install incomplete: ${anchoredColliderCount} of ${prepared.anchoredCells.length} colliders present.`,
        "create",
        true
      );
    }

    // 2) Jedes Fragment dynamisch installieren: Kontakt als Voxel-Cuboids,
    //    kanonische Masse/Tensor explizit auf dem ersten Collider am Body-COM
    //    (Offset null -> Aggregationspfad trivial, kein Dichte-Shift).
    //    Fragmentzellen stammen aus dem validierten Prepared-Zustand
    //    (plan-aligniert); die Bindung ist oben bereits geprueft.
    const fragments: StructuralCommittedFragment[] = [];
    for (let bodyIndex = 0; bodyIndex < plan.dynamicBodies.length; bodyIndex += 1) {
      const bodyPlan = plan.dynamicBodies[bodyIndex];
      const preparedFragment = prepared.fragments[bodyIndex];
      // P-PG-R4B: persistierte Motion (Region-Save) schlaegt die
      // Plan-Ableitung; ohne Override bleibt das bisherige Verhalten.
      const restoredMotion = restoredMotions?.get(bodyPlan.fragmentId);
      if (restoredMotions !== null && restoredMotion === undefined) {
        fail(
          "InvalidStructuralState",
          `fragments/${bodyPlan.fragmentId}/restored`,
          "Restored motion missing for planned fragment (no silent default).",
          "validate",
          true
        );
      }
      const center = restoredMotion
        ? restoredMotion.translationMeters
        : mapPoint(validateVector(bodyPlan.centerOfMassMeters, "commit/fragmentCenter"));
      const authorCenter = validateVector(bodyPlan.centerOfMassMeters, "commit/fragmentCenterAuthor");
      const linvel = restoredMotion
        ? restoredMotion.linvelMetersPerSecond
        : useLivePose
          ? deriveStructuralWorldSplitVelocity(
            parentMotion.velocityMetersPerSecond,
            parentMotion.angularVelocityRadPerSecond,
            pose.translationMeters,
            center
          )
          : validateVector(bodyPlan.initialVelocityMetersPerSecond, "commit/plannedVelocity");
      const angvel = restoredMotion
        ? restoredMotion.angvelRadPerSecond
        : validateVector(parentMotion.angularVelocityRadPerSecond, "commit/angvel");
      const fragmentRotation = restoredMotion ? restoredMotion.rotation : (useLivePose ? pose.rotation : identityRotation());
      const body = port.createBody({
        dynamic: true,
        translationMeters: center,
        rotation: fragmentRotation,
        linvelMetersPerSecond: linvel,
        angvelRadPerSecond: angvel
      });
      created.push(body);
      // Collider-Offsets sind IMMER body-lokal = Autorframe (Boxmitte - COM):
      // Die Engine rotiert sie mit dem Body (R). Welt-Offsets waeren unter
      // R != Identitaet falsch (Kontakt-/Massen-Geometrie wuerde verdreht).
      const fragmentCells = preparedFragment.occupiedCells;
      const boxes = fragmentCells.map((address) => voxelCuboidForCell(address, authorCenter));
      if (boxes.length === 0) {
        fail("InvalidStructuralState", "fragment/cells", "Fragment must contain at least one cell.", "validate", true);
      }
      boxes.forEach((box, boxIndex) => {
        if (boxIndex === 0) {
          const tensor = bodyPlan.inertiaTensorKgMetersSquared;
          port.addCollider(
            body,
            box,
            {
              kind: "canonical-body",
              massKg: bodyPlan.massKg,
              centerOfMassLocal: deepFreeze({
                x: requireFinite(-box.offsetWrtBodyMeters.x, "commit/comLocalX"),
                y: requireFinite(-box.offsetWrtBodyMeters.y, "commit/comLocalY"),
                z: requireFinite(-box.offsetWrtBodyMeters.z, "commit/comLocalZ")
              }),
              principalInertia: deepFreeze({ x: tensor.xx, y: tensor.yy, z: tensor.zz }),
              frame: identityRotation()
            }
          );
        } else {
          port.addCollider(body, box, { kind: "massless" });
        }
      });
      const installed = port.bodyColliderCount(body);
      if (installed !== boxes.length) {
        fail(
          "CommitFailed",
          `fragments/${bodyPlan.fragmentId}/colliders`,
          `Fragment install incomplete: ${installed} of ${boxes.length} colliders present.`,
          "create",
          true
        );
      }
      fragments.push(
        deepFreeze({
          fragmentId: bodyPlan.fragmentId,
          installedColliderCount: installed,
          translationMeters: center,
          linvelMetersPerSecond: linvel
        })
      );
    }

    // 3) Erst wenn alles steht: Parent entfernen. Kein Step dazwischen —
    //    weder Doppelbelegung noch Luecke sind je beobachtbar.
    try {
      port.removeBody(parentBody);
    } catch (error) {
      const cleanup = removeCreated();
      const cleanupNote =
        cleanup.ok && verifyRestored()
          ? "created bodies rolled back, parent untouched"
          : `created-body rollback INCOMPLETE (${cleanup.failures} remove failure(s)); recovery state explicit, no safe resume claimed`;
      fail(
        "CommitFailed",
        "parent/remove",
        `Parent removal failed (${error instanceof Error ? error.message : String(error)}); ${cleanupNote}.`,
        "remove",
        false
      );
    }
    parentRemoved = true;

    return deepFreeze({
      schemaVersion: STRUCTURAL_PHYSICS_COMMIT_SCHEMA_VERSION,
      childPoseSource,
      parentMotionSource: plan.parentMotionSource,
      bodiesBefore,
      bodiesAfter: port.bodiesLen(),
      collidersBefore,
      collidersAfter: port.collidersLen(),
      anchoredColliderCount,
      fragments: deepFreeze(fragments.slice())
    });
  } catch (error) {
    // Remove-Phase (inkl. Fehler nach erfolgreicher Parententfernung) meldet
    // oben bereits worldRestored:false — hier nur Create/Validate.
    if (error instanceof StructuralPhysicsCommitError && error.phase === "remove") throw error;
    if (parentRemoved) {
      throw new StructuralPhysicsCommitError(
        "CommitFailed",
        "commit/post-remove",
        `Failure after parent removal (${error instanceof Error ? error.message : String(error)}); world cannot be restored, no safe resume.`,
        "remove",
        false
      );
    }
    const cleanup = removeCreated();
    const restored = cleanup.ok && verifyRestored();
    if (error instanceof StructuralPhysicsCommitError) {
      if (restored) throw error;
      throw new StructuralPhysicsCommitError(
        error.code,
        error.path,
        `${error.message} (cleanup incomplete: ${cleanup.failures} remove failure(s); world NOT restored, no safe resume)`,
        error.phase,
        false
      );
    }
    throw new StructuralPhysicsCommitError(
      "CommitFailed",
      "commit/create",
      `Install failed after mutation began (${error instanceof Error ? error.message : String(error)}); cleanup ${restored ? "verified, parent untouched" : "INCOMPLETE, world NOT restored, no safe resume"}.`,
      "create",
      restored
    );
  }
};
