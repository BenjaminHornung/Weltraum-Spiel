import {
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  requireExactKeys as adaptiveRequireExactKeys,
  requireFinite as adaptiveRequireFinite,
  requirePlainRecord as adaptiveRequirePlainRecord,
  type MeterPoint
} from "../adaptive";
import { decodeStructuralObject, encodeStructuralObject } from "./persistence";
import { deriveStructuralComponentClassification } from "./connectivity";
import {
  STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES,
  STRUCTURAL_REGION_SAVE_MAX_MOTIONS,
  type StructuralFragmentId,
  type StructuralObject
} from "./types";
import type {
  StructuralBodyMotion,
  StructuralParentMotionSource
} from "./physicsTransition";
import type { StructuralWorldQuaternion } from "./physicsCommit";
import {
  normalizeAdaptiveAuthorityFunction,
  requireStructuralHash,
  structuralDenseArray,
  structuralFail,
  structuralRevision
} from "./validation";

const canonicalAdaptiveJson = normalizeAdaptiveAuthorityFunction(adaptiveCanonicalJson);
const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requireFinite = normalizeAdaptiveAuthorityFunction(adaptiveRequireFinite);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);

/**
 * P-PG-R4B — versionierter Region-Save: Fragmentidentitaet + Pose + v/omega +
 * Besitz-/Revisionsbindung in EINEM persistierten Artefakt.
 *
 * Der bisherige Savevertrag (`encodeStructuralObject`) enthaelt nur das
 * Struktur-Objekt; Pose/Velocities lebten separat im Speicher (`moved`) und
 * wurden beim Wiederaufbau ungebunden uebergeben. Dieser Container bindet
 * jede Fragmentmotion per (fragmentId, objectRevision, sourceContentHash) an
 * denselben Objektstand und sichert das Gesamtpaket per `saveHash` gegen
 * Bewegungsdaten-Tamper ab. Rehydration laeuft ueber
 * `decodeStructuralRegionSave` + `commitStructuralPhysicsTransition` mit
 * `restoredFragmentMotions` (Prepared-Bindung, kein Parallel-Installer).
 */
export const STRUCTURAL_REGION_SAVE_SCHEMA_VERSION = "structural-microvoxel-region-save-v1" as const;

export interface StructuralSavedFragmentMotion {
  readonly fragmentId: StructuralFragmentId;
  readonly objectRevision: number;
  readonly sourceContentHash: string;
  readonly translationMeters: MeterPoint;
  readonly rotation: StructuralWorldQuaternion;
  readonly linvelMetersPerSecond: MeterPoint;
  readonly angvelRadPerSecond: MeterPoint;
}

export interface StructuralRegionWorldPose {
  readonly translationMeters: MeterPoint;
  readonly rotation: StructuralWorldQuaternion;
}

export interface StructuralRegionSave {
  readonly schemaVersion: typeof STRUCTURAL_REGION_SAVE_SCHEMA_VERSION;
  readonly object: StructuralObject;
  readonly parentMotionSource: StructuralParentMotionSource;
  readonly parentMotion: StructuralBodyMotion;
  readonly parentWorldPose: StructuralRegionWorldPose | null;
  readonly preCutCenterAuthorMeters: MeterPoint | null;
  readonly motions: readonly StructuralSavedFragmentMotion[];
  readonly saveHash: string;
}

export interface StructuralRegionSaveMotionInput {
  readonly fragmentId: string;
  readonly objectRevision: number;
  readonly sourceContentHash: string;
  readonly translationMeters: MeterPoint;
  readonly rotation: StructuralWorldQuaternion;
  readonly linvelMetersPerSecond: MeterPoint;
  readonly angvelRadPerSecond: MeterPoint;
}

export interface StructuralRegionSaveInput {
  readonly object: StructuralObject;
  readonly parentMotionSource: StructuralParentMotionSource;
  readonly parentMotion: StructuralBodyMotion;
  readonly parentWorldPose?: StructuralRegionWorldPose | null;
  readonly preCutCenterAuthorMeters?: MeterPoint | null;
  readonly motions: readonly StructuralRegionSaveMotionInput[];
}

const utf8Encoder = new TextEncoder();

const finiteNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number") {
    return structuralFail("InvalidContract", path, "Expected a finite number.");
  }
  return requireFinite(value, path);
};

const requireSaveByteLength = (serialized: string): string => {
  if (serialized.length > STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES) {
    return structuralFail("InvalidContract", "regionSave", `Structural region save exceeds the ${STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES}-byte UTF-8 limit.`);
  }
  if (utf8Encoder.encode(serialized).byteLength > STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES) {
    return structuralFail("InvalidContract", "regionSave", `Structural region save exceeds the ${STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES}-byte UTF-8 limit.`);
  }
  return serialized;
};

const validateMeterPoint = (value: unknown, path: string): MeterPoint => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["x", "y", "z"], path);
  return deepFreeze({
    x: finiteNumber(record.x, `${path}/x`),
    y: finiteNumber(record.y, `${path}/y`),
    z: finiteNumber(record.z, `${path}/z`)
  });
};

const validateRotation = (value: unknown, path: string): StructuralWorldQuaternion => {
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
    return structuralFail("InvalidContract", path, "Saved fragment rotation must be a unit quaternion.");
  }
  return quat;
};

const validateParentMotion = (value: unknown, path: string): StructuralBodyMotion => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["velocityMetersPerSecond", "angularVelocityRadPerSecond"], path);
  return deepFreeze({
    velocityMetersPerSecond: validateMeterPoint(record.velocityMetersPerSecond, `${path}/velocityMetersPerSecond`),
    angularVelocityRadPerSecond: validateMeterPoint(record.angularVelocityRadPerSecond, `${path}/angularVelocityRadPerSecond`)
  });
};

/** Besitz-/Revisionsbindung: Motion muss denselben Objektstand tragen. */
const validateMotionBinding = (
  value: StructuralRegionSaveMotionInput | unknown,
  path: string,
  object: StructuralObject
): StructuralSavedFragmentMotion => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, [
    "fragmentId", "objectRevision", "sourceContentHash",
    "translationMeters", "rotation", "linvelMetersPerSecond", "angvelRadPerSecond"
  ], path);
  const fragmentId = requireStructuralHash(record.fragmentId, `${path}/fragmentId`);
  const objectRevision = structuralRevision(record.objectRevision, `${path}/objectRevision`);
  const sourceContentHash = requireStructuralHash(record.sourceContentHash, `${path}/sourceContentHash`);
  if (objectRevision !== object.objectRevision) {
    return structuralFail("InvalidRevision", `${path}/objectRevision`, "Saved fragment motion must bind the saved object revision (no stale motion).");
  }
  if (sourceContentHash !== object.contentHash) {
    return structuralFail("InvalidRevision", `${path}/sourceContentHash`, "Saved fragment motion must bind the saved object content hash (no foreign motion).");
  }
  return deepFreeze({
    fragmentId: fragmentId as StructuralFragmentId,
    objectRevision,
    sourceContentHash,
    translationMeters: validateMeterPoint(record.translationMeters, `${path}/translationMeters`),
    rotation: validateRotation(record.rotation, `${path}/rotation`),
    linvelMetersPerSecond: validateMeterPoint(record.linvelMetersPerSecond, `${path}/linvelMetersPerSecond`),
    angvelRadPerSecond: validateMeterPoint(record.angvelRadPerSecond, `${path}/angvelRadPerSecond`)
  });
};

const hashSavePayload = (payload: {
  readonly objectContentHash: string;
  readonly objectRevision: number;
  readonly parentMotionSource: StructuralParentMotionSource;
  readonly parentMotion: StructuralBodyMotion;
  readonly parentWorldPose: StructuralRegionWorldPose | null;
  readonly preCutCenterAuthorMeters: MeterPoint | null;
  readonly motions: readonly StructuralSavedFragmentMotion[];
}): string => hashAdaptiveCanonical({
  schemaVersion: STRUCTURAL_REGION_SAVE_SCHEMA_VERSION,
  objectContentHash: payload.objectContentHash,
  objectRevision: payload.objectRevision,
  parentMotionSource: payload.parentMotionSource,
  parentMotion: payload.parentMotion,
  parentWorldPose: payload.parentWorldPose,
  preCutCenterAuthorMeters: payload.preCutCenterAuthorMeters,
  motions: payload.motions
});

const validateParentMotionSource = (value: unknown, path: string): StructuralParentMotionSource => {
  if (value !== "explicit" && value !== "live-parent-body") {
    return structuralFail("InvalidContract", path, "Region parent motion source must be explicit or live-parent-body.");
  }
  return value;
};

const expectedFragmentIds = (object: StructuralObject): ReadonlySet<string> => {
  const occupiedCellCount = object.bricks.reduce((sum, brick) => sum + brick.cells.length, 0);
  const indexedFactCount = object.anchors.length + object.joints.length * 2;
  try {
    const classification = deriveStructuralComponentClassification(object, {
      maxVisitedCells: Math.max(1, occupiedCellCount),
      maxComponents: Math.max(1, occupiedCellCount),
      maxIndexedFacts: Math.max(1, indexedFactCount)
    });
    return new Set(classification.fragments.map((fragment) => fragment.fragmentId));
  } catch {
    return structuralFail("InvalidContract", "regionSave/object", "Unable to derive the saved object's fragment coverage.");
  }
};

const validateMotionCoverage = (
  motions: readonly StructuralSavedFragmentMotion[],
  object: StructuralObject,
  path: string
): void => {
  const fragmentIds = expectedFragmentIds(object);
  if (motions.length !== fragmentIds.size) {
    return structuralFail(
      "InvalidContract",
      path,
      fragmentIds.size === 0
        ? "A region save with no dynamic fragments must carry an empty motion set."
        : "Saved fragment motions must cover every dynamic fragment exactly once."
    );
  }
  const seen = new Set<string>();
  for (const motion of motions) {
    if (!fragmentIds.has(motion.fragmentId)) {
      return structuralFail("InvalidContract", path, "Saved fragment motion references a foreign fragment.");
    }
    if (seen.has(motion.fragmentId)) {
      return structuralFail("InvalidContract", path, "Saved fragment motions must reference each fragment exactly once.");
    }
    seen.add(motion.fragmentId);
  }
  for (const fragmentId of fragmentIds) {
    if (!seen.has(fragmentId)) {
      return structuralFail("InvalidContract", path, "Saved fragment motions must cover every dynamic fragment exactly once.");
    }
  }
};

interface ValidatedRegionSaveBody {
  readonly object: StructuralObject;
  readonly parentMotionSource: StructuralParentMotionSource;
  readonly parentMotion: StructuralBodyMotion;
  readonly parentWorldPose: StructuralRegionWorldPose | null;
  readonly preCutCenterAuthorMeters: MeterPoint | null;
  readonly motions: readonly StructuralSavedFragmentMotion[];
}

const validateSaveBody = (record: Record<string, unknown>): ValidatedRegionSaveBody => {
  requireExactKeys(record, [
    "schemaVersion", "object", "parentMotionSource", "parentMotion",
    "parentWorldPose", "preCutCenterAuthorMeters", "motions", "saveHash"
  ], "regionSave");
  if (record.schemaVersion !== STRUCTURAL_REGION_SAVE_SCHEMA_VERSION) {
    return structuralFail("InvalidContract", "regionSave/schemaVersion", "Unsupported Structural region save version.");
  }
  // Objekt ueber den bestehenden Savevertrag: Belegung, Revisionen, Hashes,
  // Evidence und kanonische Ordnung werden dort vollstaendig geprueft.
  const object = decodeStructuralObject(canonicalAdaptiveJson(record.object));
  const parentMotionSource = validateParentMotionSource(record.parentMotionSource, "regionSave/parentMotionSource");
  const parentMotion = validateParentMotion(record.parentMotion, "regionSave/parentMotion");
  let parentWorldPose: StructuralRegionWorldPose | null = null;
  if (record.parentWorldPose !== null) {
    const pose = requirePlainRecord(record.parentWorldPose, "regionSave/parentWorldPose");
    requireExactKeys(pose, ["translationMeters", "rotation"], "regionSave/parentWorldPose");
    parentWorldPose = deepFreeze({
      translationMeters: validateMeterPoint(pose.translationMeters, "regionSave/parentWorldPose/translationMeters"),
      rotation: validateRotation(pose.rotation, "regionSave/parentWorldPose/rotation")
    });
  }
  const preCutCenterAuthorMeters = record.preCutCenterAuthorMeters === null
    ? null
    : validateMeterPoint(record.preCutCenterAuthorMeters, "regionSave/preCutCenterAuthorMeters");
  if (parentMotionSource === "live-parent-body") {
    if (parentWorldPose === null || preCutCenterAuthorMeters === null) {
      return structuralFail("InvalidContract", "regionSave/parentWorldPose", "A live-parent-body region save must carry the parent world pose and the pre-cut center.");
    }
  } else if (parentWorldPose !== null || preCutCenterAuthorMeters !== null) {
    return structuralFail("InvalidContract", "regionSave/parentWorldPose", "An explicit region save must not carry a parent world pose or pre-cut center.");
  }
  const motions = structuralDenseArray(record.motions, "regionSave/motions", STRUCTURAL_REGION_SAVE_MAX_MOTIONS)
    .map((entry, index) => validateMotionBinding(entry, `regionSave/motions/${index}`, object));
  validateMotionCoverage(motions, object, "regionSave/motions");
  const persistedHash = requireStructuralHash(record.saveHash, "regionSave/saveHash");
  const recomputed = hashSavePayload({
    objectContentHash: object.contentHash,
    objectRevision: object.objectRevision,
    parentMotionSource,
    parentMotion,
    parentWorldPose,
    preCutCenterAuthorMeters,
    motions
  });
  if (recomputed !== persistedHash) {
    return structuralFail("InvalidContract", "regionSave/saveHash", "Region save hash mismatch: object, motion source or a fragment motion was tampered with.");
  }
  return deepFreeze({ object, parentMotionSource, parentMotion, parentWorldPose, preCutCenterAuthorMeters, motions });
};

export const decodeStructuralRegionSave = (serialized: string): StructuralRegionSave => {
  if (typeof serialized !== "string") {
    return structuralFail("InvalidContract", "regionSave", "Structural region save input must be a string.");
  }
  requireSaveByteLength(serialized);
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return structuralFail("InvalidContract", "regionSave", "Structural region save input is not valid JSON.");
  }
  if (canonicalAdaptiveJson(parsed) !== serialized) {
    return structuralFail("InvalidContract", "regionSave", "Structural region save input must use byte-exact Adaptive canonical JSON.");
  }
  const body = validateSaveBody(requirePlainRecord(parsed, "regionSave"));
  const persistedHash = requireStructuralHash((parsed as Record<string, unknown>).saveHash, "regionSave/saveHash");
  return deepFreeze({ schemaVersion: STRUCTURAL_REGION_SAVE_SCHEMA_VERSION, ...body, saveHash: persistedHash });
};

export const encodeStructuralRegionSave = (input: StructuralRegionSaveInput): string => {
  const record = requirePlainRecord(input, "regionSaveInput");
  // Optionale Pose-Keys duerfen im Explicit-Modus fehlen (=> null).
  requireExactKeys(record, [
    "object", "parentMotionSource", "parentMotion",
    ...(Object.hasOwn(record, "parentWorldPose") ? ["parentWorldPose"] : []),
    ...(Object.hasOwn(record, "preCutCenterAuthorMeters") ? ["preCutCenterAuthorMeters"] : []),
    "motions"
  ], "regionSaveInput");
  // Objekt ueber den bestehenden Savevertrag kanonisieren (byte-exakt,
  // vollstaendig validiert) und als Projektion einbetten.
  const objectProjection = JSON.parse(encodeStructuralObject(record.object as StructuralObject)) as unknown;
  const parentMotionSource = validateParentMotionSource(record.parentMotionSource, "regionSaveInput/parentMotionSource");
  const parentMotion = validateParentMotion(record.parentMotion, "regionSaveInput/parentMotion");
  let parentWorldPose: StructuralRegionWorldPose | null = null;
  if (record.parentWorldPose !== null && record.parentWorldPose !== undefined) {
    const pose = requirePlainRecord(record.parentWorldPose, "regionSaveInput/parentWorldPose");
    requireExactKeys(pose, ["translationMeters", "rotation"], "regionSaveInput/parentWorldPose");
    parentWorldPose = deepFreeze({
      translationMeters: validateMeterPoint(pose.translationMeters, "regionSaveInput/parentWorldPose/translationMeters"),
      rotation: validateRotation(pose.rotation, "regionSaveInput/parentWorldPose/rotation")
    });
  }
  const preCutCenterAuthorMeters = record.preCutCenterAuthorMeters === null || record.preCutCenterAuthorMeters === undefined
    ? null
    : validateMeterPoint(record.preCutCenterAuthorMeters, "regionSaveInput/preCutCenterAuthorMeters");
  if (parentMotionSource === "live-parent-body") {
    if (parentWorldPose === null || preCutCenterAuthorMeters === null) {
      return structuralFail("InvalidContract", "regionSaveInput/parentWorldPose", "A live-parent-body region save must carry the parent world pose and the pre-cut center.");
    }
  } else if (parentWorldPose !== null || preCutCenterAuthorMeters !== null) {
    return structuralFail("InvalidContract", "regionSaveInput/parentWorldPose", "An explicit region save must not carry a parent world pose or pre-cut center.");
  }
  // Bindung gegen das validierte Objekt (Revision + Content-Hash).
  const object = decodeStructuralObject(canonicalAdaptiveJson(objectProjection));
  const motions = structuralDenseArray(record.motions, "regionSaveInput/motions", STRUCTURAL_REGION_SAVE_MAX_MOTIONS)
    .map((entry, index) => validateMotionBinding(entry, `regionSaveInput/motions/${index}`, object));
  validateMotionCoverage(motions, object, "regionSaveInput/motions");
  const saveHash = hashSavePayload({
    objectContentHash: object.contentHash,
    objectRevision: object.objectRevision,
    parentMotionSource,
    parentMotion,
    parentWorldPose,
    preCutCenterAuthorMeters,
    motions
  });
  const serialized = requireSaveByteLength(canonicalAdaptiveJson(deepFreeze({
    schemaVersion: STRUCTURAL_REGION_SAVE_SCHEMA_VERSION,
    object: objectProjection,
    parentMotionSource,
    parentMotion,
    parentWorldPose,
    preCutCenterAuthorMeters,
    motions,
    saveHash
  })));
  // Selbstverifikation: fehlgeschlagene Transaktion faellt hier, nicht erst beim Reload.
  decodeStructuralRegionSave(serialized);
  return serialized;
};
