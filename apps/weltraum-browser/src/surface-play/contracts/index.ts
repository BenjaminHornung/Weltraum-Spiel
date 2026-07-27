import { canonicalCloneAndDeepFreeze } from "../../core/hash";
import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  compareCanonicalCodeUnits,
  globalQuantumCoordinate,
  type GlobalQuantumCoordinate
} from "../../voxel/adaptive";
import { validateVoxelStableId } from "../../voxel";
import type { SpatialVector3 } from "../../spatial";

export { MICROVOXEL_BASE_QUANTUM_METERS } from "../../voxel/adaptive";

export type SurfacePlayContractErrorCode =
  | "InvalidBoolean"
  | "InvalidEnum"
  | "InvalidHash"
  | "InvalidIdentity"
  | "InvalidArray"
  | "InvalidNumber"
  | "InvalidRecord"
  | "InvalidRevision"
  | "InvalidTick"
  | "InvalidVector"
  | "InvalidVoxelEditResult";

export class SurfacePlayContractError extends Error {
  public readonly code: SurfacePlayContractErrorCode;
  public readonly path: string;

  public constructor(code: SurfacePlayContractErrorCode, path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "SurfacePlayContractError";
    this.code = code;
    this.path = path;
  }
}

const fail = (code: SurfacePlayContractErrorCode, path: string, message: string): never => {
  throw new SurfacePlayContractError(code, path, message);
};

declare const surfaceIdBrand: unique symbol;
export type SurfaceStableId = string & { readonly [surfaceIdBrand]: true };
export type SurfaceBodyId = SurfaceStableId;
export type SurfaceFrameId = SurfaceStableId;
export type SurfaceRegionId = SurfaceStableId;
export type SurfacePlayerId = SurfaceStableId;
export type SurfaceCommandId = SurfaceStableId;
export type SurfaceBrickId = SurfaceStableId;

const stableId = (value: unknown, path: string): SurfaceStableId => {
  const result = validateVoxelStableId(value, path);
  if (!result.valid) {
    return fail(
      "InvalidIdentity",
      path,
      "must be a 1-128 character lowercase ASCII identifier with stable separators."
    );
  }
  return value as SurfaceStableId;
};

const finite = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail("InvalidNumber", path, "must be finite.");
  }
  return Object.is(value, -0) ? 0 : value;
};

const nonNegative = (value: unknown, path: string): number => {
  const parsed = finite(value, path);
  if (parsed < 0) return fail("InvalidNumber", path, "must be non-negative.");
  return parsed;
};

const positive = (value: unknown, path: string): number => {
  const parsed = finite(value, path);
  if (parsed <= 0) return fail("InvalidNumber", path, "must be positive.");
  return parsed;
};

const safeNonNegativeInteger = (
  value: unknown,
  path: string,
  code: "InvalidRevision" | "InvalidTick"
): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < 0) {
    return fail(code, path, "must be a non-negative safe integer and may not be negative zero.");
  }
  return value;
};

const booleanValue = (value: unknown, path: string): boolean =>
  typeof value === "boolean" ? value : fail("InvalidBoolean", path, "must be boolean.");

const enumValue = <T extends string>(value: unknown, allowed: readonly T[], path: string): T =>
  typeof value === "string" && allowed.includes(value as T)
    ? value as T
    : fail("InvalidEnum", path, `must be one of ${allowed.join(", ")}.`);

const denseArray = (value: unknown, path: string, maximumLength: number): readonly unknown[] => {
  if (!Array.isArray(value)) return fail("InvalidArray", path, "must be an array.");
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value)) {
    return fail("InvalidArray", path, "length must be a safe data property.");
  }
  const length = lengthDescriptor.value as number;
  if (length > maximumLength) return fail("InvalidArray", path, `must contain at most ${maximumLength} entries.`);
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) {
      return fail("InvalidArray", path, "may contain only indexed entries and length.");
    }
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
      return fail("InvalidArray", path, "contains an index outside its declared length.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      return fail("InvalidArray", `${path}.${key}`, "entries must be enumerable own data properties.");
    }
  }
  const copy = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) return fail("InvalidArray", `${path}.${index}`, "sparse arrays are rejected.");
    if (!descriptor.enumerable || !("value" in descriptor)) {
      return fail("InvalidArray", `${path}.${index}`, "entries must be enumerable own data properties.");
    }
    copy[index] = descriptor.value;
  }
  return copy;
};

const requirePlainDataRecord = (value: unknown, path: string): void => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("InvalidRecord", path, "must be a plain record.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail("InvalidRecord", path, "must have Object.prototype or null prototype.");
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") return fail("InvalidRecord", path, "symbol properties are not supported.");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      return fail("InvalidRecord", `${path}.${key}`, "properties must be enumerable own data properties.");
    }
  }
};

const vector = (value: SpatialVector3, path: string): Readonly<SpatialVector3> => {
  requirePlainDataRecord(value, path);
  return canonicalCloneAndDeepFreeze({
    x: finite(value.x, `${path}.x`),
    y: finite(value.y, `${path}.y`),
    z: finite(value.z, `${path}.z`)
  });
};

const boundedAxis = (value: unknown, path: string): number => {
  const parsed = finite(value, path);
  if (parsed < -1 || parsed > 1) return fail("InvalidNumber", path, "must be within [-1, 1].");
  return parsed;
};

const rootSeed = (value: unknown): string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)) {
    return fail("InvalidIdentity", "identity.seed", "must be a 1-128 character ASCII seed token.");
  }
  return value;
};

const fnv1a64Ascii = (value: string): string => {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x7f) return fail("InvalidIdentity", "identity", "canonical identity inputs must be ASCII.");
    hash ^= BigInt(code);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
};

const deriveIdentity = (prefix: string, values: readonly (string | number | boolean | null)[]): SurfaceStableId =>
  stableId(`${prefix}:${fnv1a64Ascii(JSON.stringify(values))}`, "identity");

export interface SurfacePlayIdentityInput {
  readonly bodyId: string;
  readonly surfaceFrameId: string;
  readonly regionId: string;
  readonly generatorVersion: string;
  readonly seed: string;
  readonly regionRevision: number;
}

export interface SurfacePlayIdentity {
  readonly bodyId: SurfaceBodyId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly regionId: SurfaceRegionId;
  readonly generatorVersion: SurfaceStableId;
  readonly seed: string;
  readonly regionRevision: number;
  readonly canonicalIdentity: SurfaceStableId;
}

export const createSurfacePlayIdentity = (input: SurfacePlayIdentityInput): Readonly<SurfacePlayIdentity> => {
  const bodyId = stableId(input.bodyId, "identity.bodyId");
  const surfaceFrameId = stableId(input.surfaceFrameId, "identity.surfaceFrameId");
  const regionId = stableId(input.regionId, "identity.regionId");
  const generatorVersion = stableId(input.generatorVersion, "identity.generatorVersion");
  const seed = rootSeed(input.seed);
  const regionRevision = safeNonNegativeInteger(input.regionRevision, "identity.regionRevision", "InvalidRevision");
  return canonicalCloneAndDeepFreeze({
    bodyId,
    surfaceFrameId,
    regionId,
    generatorVersion,
    seed,
    regionRevision,
    canonicalIdentity: deriveIdentity("surface_region", [bodyId, surfaceFrameId, regionId, generatorVersion, seed, regionRevision])
  });
};

export interface SurfaceCapsule {
  readonly radiusMeters: number;
  readonly heightMeters: number;
}

const capsule = (value: SurfaceCapsule, path: string): Readonly<SurfaceCapsule> => {
  const radiusMeters = positive(value?.radiusMeters, `${path}.radiusMeters`);
  const heightMeters = positive(value?.heightMeters, `${path}.heightMeters`);
  if (heightMeters < radiusMeters * 2) {
    return fail("InvalidNumber", `${path}.heightMeters`, "must be at least twice radiusMeters.");
  }
  return canonicalCloneAndDeepFreeze({ radiusMeters, heightMeters });
};

export const SURFACE_MOVEMENT_MODES = ["Walk", "Sprint", "Crouch", "Airborne", "Recovery"] as const;
export type SurfaceMovementMode = (typeof SURFACE_MOVEMENT_MODES)[number];

export interface SurfacePlayerSnapshotInput {
  readonly playerId: string;
  readonly surfaceFrameId: string;
  readonly positionMeters: SpatialVector3;
  readonly velocityMetersPerSecond: SpatialVector3;
  readonly yawRadians: number;
  readonly pitchRadians: number;
  readonly grounded: boolean;
  readonly movementMode: SurfaceMovementMode;
  readonly capsule: SurfaceCapsule;
  readonly simulationTick: number;
}

export interface SurfacePlayerSnapshot extends Omit<SurfacePlayerSnapshotInput, "playerId" | "surfaceFrameId"> {
  readonly playerId: SurfacePlayerId;
  readonly surfaceFrameId: SurfaceFrameId;
}

export const createSurfacePlayerSnapshot = (input: SurfacePlayerSnapshotInput): Readonly<SurfacePlayerSnapshot> =>
  canonicalCloneAndDeepFreeze({
    playerId: stableId(input.playerId, "player.playerId"),
    surfaceFrameId: stableId(input.surfaceFrameId, "player.surfaceFrameId"),
    positionMeters: vector(input.positionMeters, "player.positionMeters"),
    velocityMetersPerSecond: vector(input.velocityMetersPerSecond, "player.velocityMetersPerSecond"),
    yawRadians: finite(input.yawRadians, "player.yawRadians"),
    pitchRadians: finite(input.pitchRadians, "player.pitchRadians"),
    grounded: booleanValue(input.grounded, "player.grounded"),
    movementMode: enumValue(input.movementMode, SURFACE_MOVEMENT_MODES, "player.movementMode"),
    capsule: capsule(input.capsule, "player.capsule"),
    simulationTick: safeNonNegativeInteger(input.simulationTick, "player.simulationTick", "InvalidTick")
  });

export const SURFACE_POINTER_LOCK_INTENTS = ["Unchanged", "Request", "Release"] as const;
export type SurfacePointerLockIntent = (typeof SURFACE_POINTER_LOCK_INTENTS)[number];
export type SurfaceRecoveryReset = "None" | "RecoveryOnly";

export interface SurfacePlayerCommandInput {
  readonly playerId: string;
  readonly surfaceFrameId: string;
  readonly simulationTick: number;
  readonly moveAxes: Readonly<{ readonly forward: number; readonly right: number }>;
  readonly lookDeltaRadians: Readonly<{ readonly yaw: number; readonly pitch: number }>;
  readonly sprint: boolean;
  /** null means that this command carries no crouch transition. */
  readonly crouch: boolean | null;
  readonly jump: boolean;
  readonly fire: boolean;
  readonly pointerLockIntent: SurfacePointerLockIntent;
  readonly reset: SurfaceRecoveryReset;
}

export interface SurfacePlayerCommand extends Omit<SurfacePlayerCommandInput, "playerId" | "surfaceFrameId"> {
  readonly playerId: SurfacePlayerId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly commandId: SurfaceCommandId;
}

export const createSurfacePlayerCommand = (input: SurfacePlayerCommandInput): Readonly<SurfacePlayerCommand> => {
  const playerId = stableId(input.playerId, "command.playerId");
  const surfaceFrameId = stableId(input.surfaceFrameId, "command.surfaceFrameId");
  const simulationTick = safeNonNegativeInteger(input.simulationTick, "command.simulationTick", "InvalidTick");
  const moveAxes = canonicalCloneAndDeepFreeze({
    forward: boundedAxis(input.moveAxes?.forward, "command.moveAxes.forward"),
    right: boundedAxis(input.moveAxes?.right, "command.moveAxes.right")
  });
  const lookDeltaRadians = canonicalCloneAndDeepFreeze({
    yaw: finite(input.lookDeltaRadians?.yaw, "command.lookDeltaRadians.yaw"),
    pitch: finite(input.lookDeltaRadians?.pitch, "command.lookDeltaRadians.pitch")
  });
  const sprint = booleanValue(input.sprint, "command.sprint");
  const crouch = input.crouch === null ? null : booleanValue(input.crouch, "command.crouch");
  const jump = booleanValue(input.jump, "command.jump");
  const fire = booleanValue(input.fire, "command.fire");
  const pointerLockIntent = enumValue(input.pointerLockIntent, SURFACE_POINTER_LOCK_INTENTS, "command.pointerLockIntent");
  const reset = enumValue(input.reset, ["None", "RecoveryOnly"] as const, "command.reset");
  const commandId = deriveIdentity("surface_command", [
    playerId,
    surfaceFrameId,
    simulationTick,
    moveAxes.forward,
    moveAxes.right,
    lookDeltaRadians.yaw,
    lookDeltaRadians.pitch,
    sprint,
    crouch,
    jump,
    fire,
    pointerLockIntent,
    reset
  ]);
  return canonicalCloneAndDeepFreeze({
    commandId,
    playerId,
    surfaceFrameId,
    simulationTick,
    moveAxes,
    lookDeltaRadians,
    sprint,
    crouch,
    jump,
    fire,
    pointerLockIntent,
    reset
  });
};

export interface SurfaceAuthorityBindingInput {
  readonly bodyId: string;
  readonly regionId: string;
  readonly surfaceFrameId: string;
  readonly regionRevision: number;
  readonly simulationTick: number;
}

export interface SurfaceAuthorityBinding {
  readonly bodyId: SurfaceBodyId;
  readonly regionId: SurfaceRegionId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly regionRevision: number;
  readonly simulationTick: number;
}

const authorityBinding = (input: SurfaceAuthorityBindingInput, path: string): Readonly<SurfaceAuthorityBinding> =>
  canonicalCloneAndDeepFreeze({
    bodyId: stableId(input.bodyId, `${path}.bodyId`),
    regionId: stableId(input.regionId, `${path}.regionId`),
    surfaceFrameId: stableId(input.surfaceFrameId, `${path}.surfaceFrameId`),
    regionRevision: safeNonNegativeInteger(input.regionRevision, `${path}.regionRevision`, "InvalidRevision"),
    simulationTick: safeNonNegativeInteger(input.simulationTick, `${path}.simulationTick`, "InvalidTick")
  });

interface SurfaceCollisionQueryBaseInput extends SurfaceAuthorityBindingInput {
  readonly queryId: string;
}

interface SurfaceCollisionQueryBase extends SurfaceAuthorityBinding {
  readonly queryId: SurfaceStableId;
}

export interface SurfaceGroundContactQueryInput extends SurfaceCollisionQueryBaseInput {
  readonly kind: "GroundContact";
  readonly capsule: SurfaceCapsule;
  readonly positionMeters: SpatialVector3;
  readonly maximumDistanceMeters: number;
}

export interface SurfaceGroundContactQuery extends SurfaceCollisionQueryBase {
  readonly kind: "GroundContact";
  readonly capsule: Readonly<SurfaceCapsule>;
  readonly positionMeters: Readonly<SpatialVector3>;
  readonly maximumDistanceMeters: number;
}

export interface SurfaceCapsuleSweepQueryInput extends SurfaceCollisionQueryBaseInput {
  readonly kind: "CapsuleSweep";
  readonly capsule: SurfaceCapsule;
  readonly startPositionMeters: SpatialVector3;
  readonly displacementMeters: SpatialVector3;
}

export interface SurfaceCapsuleSweepQuery extends SurfaceCollisionQueryBase {
  readonly kind: "CapsuleSweep";
  readonly capsule: Readonly<SurfaceCapsule>;
  readonly startPositionMeters: Readonly<SpatialVector3>;
  readonly displacementMeters: Readonly<SpatialVector3>;
}

export interface SurfaceRayQueryInput extends SurfaceCollisionQueryBaseInput {
  readonly kind: "Ray";
  readonly originMeters: SpatialVector3;
  readonly direction: SpatialVector3;
  readonly maximumDistanceMeters: number;
}

export interface SurfaceRayQuery extends SurfaceCollisionQueryBase {
  readonly kind: "Ray";
  readonly originMeters: Readonly<SpatialVector3>;
  readonly direction: Readonly<SpatialVector3>;
  readonly maximumDistanceMeters: number;
}

export interface SurfaceLineQueryInput extends SurfaceCollisionQueryBaseInput {
  readonly kind: "Line";
  readonly startMeters: SpatialVector3;
  readonly endMeters: SpatialVector3;
}

export interface SurfaceLineQuery extends SurfaceCollisionQueryBase {
  readonly kind: "Line";
  readonly startMeters: Readonly<SpatialVector3>;
  readonly endMeters: Readonly<SpatialVector3>;
}

const collisionBase = (input: SurfaceCollisionQueryBaseInput, path: string) => ({
  queryId: stableId(input.queryId, `${path}.queryId`),
  ...authorityBinding(input, path)
});

export const createSurfaceGroundContactQuery = (input: SurfaceGroundContactQueryInput): Readonly<SurfaceGroundContactQuery> => {
  if (input.kind !== "GroundContact") return fail("InvalidEnum", "groundQuery.kind", "must be GroundContact.");
  return canonicalCloneAndDeepFreeze({
    ...collisionBase(input, "groundQuery"),
    kind: "GroundContact" as const,
    capsule: capsule(input.capsule, "groundQuery.capsule"),
    positionMeters: vector(input.positionMeters, "groundQuery.positionMeters"),
    maximumDistanceMeters: nonNegative(input.maximumDistanceMeters, "groundQuery.maximumDistanceMeters")
  });
};

export const createSurfaceCapsuleSweepQuery = (input: SurfaceCapsuleSweepQueryInput): Readonly<SurfaceCapsuleSweepQuery> => {
  if (input.kind !== "CapsuleSweep") return fail("InvalidEnum", "sweepQuery.kind", "must be CapsuleSweep.");
  return canonicalCloneAndDeepFreeze({
    ...collisionBase(input, "sweepQuery"),
    kind: "CapsuleSweep" as const,
    capsule: capsule(input.capsule, "sweepQuery.capsule"),
    startPositionMeters: vector(input.startPositionMeters, "sweepQuery.startPositionMeters"),
    displacementMeters: vector(input.displacementMeters, "sweepQuery.displacementMeters")
  });
};

const unitDirection = (value: SpatialVector3, path: string): Readonly<SpatialVector3> => {
  const parsed = vector(value, path);
  const length = Math.hypot(parsed.x, parsed.y, parsed.z);
  if (!Number.isFinite(length) || Math.abs(length - 1) > 1e-9) {
    return fail("InvalidVector", path, "must have unit length within 1e-9.");
  }
  return parsed;
};

export const createSurfaceRayQuery = (input: SurfaceRayQueryInput): Readonly<SurfaceRayQuery> => {
  if (input.kind !== "Ray") return fail("InvalidEnum", "rayQuery.kind", "must be Ray.");
  return canonicalCloneAndDeepFreeze({
    ...collisionBase(input, "rayQuery"),
    kind: "Ray" as const,
    originMeters: vector(input.originMeters, "rayQuery.originMeters"),
    direction: unitDirection(input.direction, "rayQuery.direction"),
    maximumDistanceMeters: positive(input.maximumDistanceMeters, "rayQuery.maximumDistanceMeters")
  });
};

export const createSurfaceLineQuery = (input: SurfaceLineQueryInput): Readonly<SurfaceLineQuery> => {
  if (input.kind !== "Line") return fail("InvalidEnum", "lineQuery.kind", "must be Line.");
  const startMeters = vector(input.startMeters, "lineQuery.startMeters");
  const endMeters = vector(input.endMeters, "lineQuery.endMeters");
  if (startMeters.x === endMeters.x && startMeters.y === endMeters.y && startMeters.z === endMeters.z) {
    return fail("InvalidVector", "lineQuery.endMeters", "must differ from startMeters.");
  }
  return canonicalCloneAndDeepFreeze({ ...collisionBase(input, "lineQuery"), kind: "Line" as const, startMeters, endMeters });
};

export type SurfaceCollisionRejectionCode =
  | "BodyMismatch"
  | "RegionMismatch"
  | "FrameMismatch"
  | "StaleRevision"
  | "StaleTick"
  | "AuthorityUnavailable";

export interface SurfaceCollisionRejection {
  readonly status: "Rejected";
  readonly queryId: SurfaceStableId;
  readonly code: SurfaceCollisionRejectionCode;
  readonly message: string;
}

export interface SurfaceContact {
  readonly pointMeters: Readonly<SpatialVector3>;
  readonly normal: Readonly<SpatialVector3>;
  readonly distanceMeters: number;
  readonly colliderId: SurfaceStableId;
}

export interface SurfaceContactInput {
  readonly pointMeters: SpatialVector3;
  readonly normal: SpatialVector3;
  readonly distanceMeters: number;
  readonly colliderId: string;
}

export interface SurfaceCollisionRejectionInput {
  readonly status: "Rejected";
  readonly queryId: string;
  readonly code: SurfaceCollisionRejectionCode;
  readonly message: string;
}

type SurfaceResolvedContactInput = Readonly<{
  readonly status: "Resolved";
  readonly queryId: string;
  readonly contact: SurfaceContactInput | null;
}>;

export type SurfaceGroundContactResultInput = SurfaceResolvedContactInput | SurfaceCollisionRejectionInput;
export type SurfaceRayResultInput = SurfaceResolvedContactInput | SurfaceCollisionRejectionInput;
export type SurfaceLineResultInput = SurfaceResolvedContactInput | SurfaceCollisionRejectionInput;
export type SurfaceCapsuleSweepResultInput =
  | Readonly<{
    readonly status: "Resolved";
    readonly queryId: string;
    readonly fraction: number;
    readonly contact: SurfaceContactInput | null;
  }>
  | SurfaceCollisionRejectionInput;

export type SurfaceGroundContactResult =
  | Readonly<{ readonly status: "Resolved"; readonly queryId: SurfaceStableId; readonly contact: SurfaceContact | null }>
  | SurfaceCollisionRejection;
export type SurfaceCapsuleSweepResult =
  | Readonly<{ readonly status: "Resolved"; readonly queryId: SurfaceStableId; readonly fraction: number; readonly contact: SurfaceContact | null }>
  | SurfaceCollisionRejection;
export type SurfaceRayResult =
  | Readonly<{ readonly status: "Resolved"; readonly queryId: SurfaceStableId; readonly contact: SurfaceContact | null }>
  | SurfaceCollisionRejection;
export type SurfaceLineResult = SurfaceRayResult;

const collisionContact = (input: SurfaceContactInput | null, path: string): SurfaceContact | null => {
  if (input === null) return null;
  requirePlainDataRecord(input, path);
  return canonicalCloneAndDeepFreeze({
       pointMeters: vector(input.pointMeters, `${path}.pointMeters`),
       normal: unitDirection(input.normal, `${path}.normal`),
       distanceMeters: nonNegative(input.distanceMeters, `${path}.distanceMeters`),
       colliderId: stableId(input.colliderId, `${path}.colliderId`)
     });
};

export const createSurfaceCollisionRejection = (
  input: SurfaceCollisionRejectionInput,
  path = "collisionResult"
): Readonly<SurfaceCollisionRejection> => {
  requirePlainDataRecord(input, path);
  if (input.status !== "Rejected") return fail("InvalidEnum", `${path}.status`, "must be Rejected.");
  return canonicalCloneAndDeepFreeze({
    status: "Rejected" as const,
    queryId: stableId(input.queryId, `${path}.queryId`),
    code: enumValue(
      input.code,
      ["BodyMismatch", "RegionMismatch", "FrameMismatch", "StaleRevision", "StaleTick", "AuthorityUnavailable"] as const,
      `${path}.code`
    ),
    message: message(input.message, `${path}.message`)
  });
};

const resolvedContactResult = (
  input: SurfaceResolvedContactInput,
  path: string
): Exclude<SurfaceGroundContactResult, SurfaceCollisionRejection> => {
  requirePlainDataRecord(input, path);
  if (input.status !== "Resolved") return fail("InvalidEnum", `${path}.status`, "must be Resolved.");
  return canonicalCloneAndDeepFreeze({
    status: "Resolved" as const,
    queryId: stableId(input.queryId, `${path}.queryId`),
    contact: collisionContact(input.contact, `${path}.contact`)
  });
};

export const createSurfaceGroundContactResult = (input: SurfaceGroundContactResultInput): SurfaceGroundContactResult => {
  requirePlainDataRecord(input, "groundContactResult");
  return input.status === "Rejected"
    ? createSurfaceCollisionRejection(input, "groundContactResult")
    : resolvedContactResult(input, "groundContactResult");
};

export const createSurfaceCapsuleSweepResult = (input: SurfaceCapsuleSweepResultInput): SurfaceCapsuleSweepResult => {
  requirePlainDataRecord(input, "capsuleSweepResult");
  if (input.status === "Rejected") return createSurfaceCollisionRejection(input, "capsuleSweepResult");
  if (input.status !== "Resolved") return fail("InvalidEnum", "capsuleSweepResult.status", "must be Resolved or Rejected.");
  const fraction = finite(input.fraction, "capsuleSweepResult.fraction");
  if (fraction < 0 || fraction > 1) return fail("InvalidNumber", "capsuleSweepResult.fraction", "must be within [0, 1].");
  return canonicalCloneAndDeepFreeze({
    status: "Resolved" as const,
    queryId: stableId(input.queryId, "capsuleSweepResult.queryId"),
    fraction,
    contact: collisionContact(input.contact, "capsuleSweepResult.contact")
  });
};

export const createSurfaceRayResult = (input: SurfaceRayResultInput): SurfaceRayResult => {
  requirePlainDataRecord(input, "rayResult");
  return input.status === "Rejected" ? createSurfaceCollisionRejection(input, "rayResult") : resolvedContactResult(input, "rayResult");
};

export const createSurfaceLineResult = (input: SurfaceLineResultInput): SurfaceLineResult => {
  requirePlainDataRecord(input, "lineResult");
  return input.status === "Rejected" ? createSurfaceCollisionRejection(input, "lineResult") : resolvedContactResult(input, "lineResult");
};

export interface SurfaceCollisionQueryPort {
  queryGroundContact(query: SurfaceGroundContactQuery): SurfaceGroundContactResult;
  sweepCapsule(query: SurfaceCapsuleSweepQuery): SurfaceCapsuleSweepResult;
  queryRay(query: SurfaceRayQuery): SurfaceRayResult;
  queryLine(query: SurfaceLineQuery): SurfaceLineResult;
}

export const SURFACE_FIRE_REJECTION_CODES = [
  "Cooldown",
  "InsufficientEnergy",
  "Overheated",
  "InvalidTarget",
  "FrameMismatch",
  "StaleRevision",
  "AuthorityRefused"
] as const;
export type SurfaceFireRejectionCode = (typeof SURFACE_FIRE_REJECTION_CODES)[number];
export type SurfaceFireResultInput =
  | Readonly<{ readonly status: "Accepted"; readonly commandId: string; readonly hit: "None" | "Target" | "Terrain" }>
  | Readonly<{ readonly status: "Rejected"; readonly commandId: string; readonly code: SurfaceFireRejectionCode; readonly message: string }>;
export type SurfaceFireResult =
  | Readonly<{ readonly status: "Accepted"; readonly commandId: SurfaceCommandId; readonly hit: "None" | "Target" | "Terrain" }>
  | Readonly<{ readonly status: "Rejected"; readonly commandId: SurfaceCommandId; readonly code: SurfaceFireRejectionCode; readonly message: string }>;

export interface SurfaceCombatEventSummaryInput {
  readonly sequence: number;
  readonly eventId: string;
  readonly kind: "FireAccepted" | "FireRejected" | "TargetDamaged" | "TargetDestroyed" | "TerrainHit";
  readonly simulationTick: number;
}

export interface SurfaceCombatEventSummary extends Omit<SurfaceCombatEventSummaryInput, "eventId"> {
  readonly eventId: SurfaceStableId;
}

export interface SurfaceCombatSnapshotInput {
  readonly activeWeaponId: string;
  readonly energyJoules: number;
  readonly maximumEnergyJoules: number;
  readonly heatJoules: number;
  readonly maximumHeatJoules: number;
  readonly cooldownSeconds: number;
  readonly target: null | Readonly<{
    readonly targetId: string;
    readonly condition: "Operational" | "Damaged" | "Disabled" | "Destroyed";
    readonly integrity: number;
    readonly maximumIntegrity: number;
  }>;
  readonly latestFireResult: SurfaceFireResultInput | null;
  readonly events: readonly SurfaceCombatEventSummaryInput[];
  readonly simulationTick: number;
}

export interface SurfaceCombatSnapshot extends Omit<SurfaceCombatSnapshotInput, "activeWeaponId" | "target" | "latestFireResult" | "events"> {
  readonly activeWeaponId: SurfaceStableId;
  readonly target: null | Readonly<{
    readonly targetId: SurfaceStableId;
    readonly condition: "Operational" | "Damaged" | "Disabled" | "Destroyed";
    readonly integrity: number;
    readonly maximumIntegrity: number;
  }>;
  readonly latestFireResult: SurfaceFireResult | null;
  readonly events: readonly SurfaceCombatEventSummary[];
}

const message = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.length > 256) {
    return fail("InvalidIdentity", path, "must be a non-empty trimmed string of at most 256 characters.");
  }
  return value;
};

const fireResult = (value: SurfaceFireResultInput | null): SurfaceFireResult | null => {
  if (value === null) return null;
  const commandId = stableId(value.commandId, "combat.latestFireResult.commandId");
  if (value.status === "Accepted") {
    return canonicalCloneAndDeepFreeze({
      status: "Accepted" as const,
      commandId,
      hit: enumValue(value.hit, ["None", "Target", "Terrain"] as const, "combat.latestFireResult.hit")
    });
  }
  if (value.status !== "Rejected") return fail("InvalidEnum", "combat.latestFireResult.status", "must be Accepted or Rejected.");
  return canonicalCloneAndDeepFreeze({
    status: "Rejected" as const,
    commandId,
    code: enumValue(value.code, SURFACE_FIRE_REJECTION_CODES, "combat.latestFireResult.code"),
    message: message(value.message, "combat.latestFireResult.message")
  });
};

export const createSurfaceCombatSnapshot = (input: SurfaceCombatSnapshotInput): Readonly<SurfaceCombatSnapshot> => {
  const maximumEnergyJoules = nonNegative(input.maximumEnergyJoules, "combat.maximumEnergyJoules");
  const energyJoules = nonNegative(input.energyJoules, "combat.energyJoules");
  if (energyJoules > maximumEnergyJoules) return fail("InvalidNumber", "combat.energyJoules", "must not exceed maximumEnergyJoules.");
  const maximumHeatJoules = nonNegative(input.maximumHeatJoules, "combat.maximumHeatJoules");
  const heatJoules = nonNegative(input.heatJoules, "combat.heatJoules");
  if (heatJoules > maximumHeatJoules) return fail("InvalidNumber", "combat.heatJoules", "must not exceed maximumHeatJoules.");
  const target = input.target === null ? null : (() => {
    const maximumIntegrity = nonNegative(input.target.maximumIntegrity, "combat.target.maximumIntegrity");
    const integrity = nonNegative(input.target.integrity, "combat.target.integrity");
    if (integrity > maximumIntegrity) return fail("InvalidNumber", "combat.target.integrity", "must not exceed maximumIntegrity.");
    return {
      targetId: stableId(input.target.targetId, "combat.target.targetId"),
      condition: enumValue(input.target.condition, ["Operational", "Damaged", "Disabled", "Destroyed"] as const, "combat.target.condition"),
      integrity,
      maximumIntegrity
    };
  })();
  let previousSequence = -1;
  const events = denseArray(input.events, "combat.events", 256).map((rawEvent, index): SurfaceCombatEventSummary => {
    const event = rawEvent as SurfaceCombatEventSummaryInput;
    const sequence = safeNonNegativeInteger(event.sequence, `combat.events.${index}.sequence`, "InvalidTick");
    if (sequence <= previousSequence) return fail("InvalidTick", `combat.events.${index}.sequence`, "must be strictly increasing.");
    previousSequence = sequence;
    return {
      sequence,
      eventId: stableId(event.eventId, `combat.events.${index}.eventId`),
      kind: enumValue(event.kind, ["FireAccepted", "FireRejected", "TargetDamaged", "TargetDestroyed", "TerrainHit"] as const, `combat.events.${index}.kind`),
      simulationTick: safeNonNegativeInteger(event.simulationTick, `combat.events.${index}.simulationTick`, "InvalidTick")
    };
  });
  return canonicalCloneAndDeepFreeze({
    activeWeaponId: stableId(input.activeWeaponId, "combat.activeWeaponId"),
    energyJoules,
    maximumEnergyJoules,
    heatJoules,
    maximumHeatJoules,
    cooldownSeconds: nonNegative(input.cooldownSeconds, "combat.cooldownSeconds"),
    target,
    latestFireResult: fireResult(input.latestFireResult),
    events,
    simulationTick: safeNonNegativeInteger(input.simulationTick, "combat.simulationTick", "InvalidTick")
  });
};

export interface SurfaceVoxelEditRequestInput extends SurfaceAuthorityBindingInput {
  readonly commandId: string;
  readonly operation: "SubtractSphere";
  readonly centerQuantum: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  readonly quantumMeters: number;
  readonly radiusMeters: number;
}

export interface SurfaceVoxelEditRequest extends SurfaceAuthorityBinding {
  readonly commandId: SurfaceCommandId;
  readonly operation: "SubtractSphere";
  readonly centerQuantum: Readonly<{
    readonly x: GlobalQuantumCoordinate;
    readonly y: GlobalQuantumCoordinate;
    readonly z: GlobalQuantumCoordinate;
  }>;
  readonly quantumMeters: typeof MICROVOXEL_BASE_QUANTUM_METERS;
  readonly radiusMeters: number;
}

export const createSurfaceVoxelEditRequest = (input: SurfaceVoxelEditRequestInput): Readonly<SurfaceVoxelEditRequest> => {
  if (input.operation !== "SubtractSphere") return fail("InvalidEnum", "voxelEdit.operation", "must be SubtractSphere.");
  if (input.quantumMeters !== MICROVOXEL_BASE_QUANTUM_METERS) {
    return fail("InvalidNumber", "voxelEdit.quantumMeters", `must equal ${MICROVOXEL_BASE_QUANTUM_METERS}.`);
  }
  let centerQuantum: SurfaceVoxelEditRequest["centerQuantum"];
  try {
    centerQuantum = {
      x: globalQuantumCoordinate(input.centerQuantum?.x, "voxelEdit.centerQuantum.x"),
      y: globalQuantumCoordinate(input.centerQuantum?.y, "voxelEdit.centerQuantum.y"),
      z: globalQuantumCoordinate(input.centerQuantum?.z, "voxelEdit.centerQuantum.z")
    };
  } catch {
    return fail("InvalidNumber", "voxelEdit.centerQuantum", "coordinates must be safe integers without negative zero.");
  }
  return canonicalCloneAndDeepFreeze({
    ...authorityBinding(input, "voxelEdit"),
    commandId: stableId(input.commandId, "voxelEdit.commandId"),
    operation: "SubtractSphere" as const,
    centerQuantum,
    quantumMeters: MICROVOXEL_BASE_QUANTUM_METERS,
    radiusMeters: positive(input.radiusMeters, "voxelEdit.radiusMeters")
  });
};

export const SURFACE_VOXEL_EDIT_REJECTION_CODES = [
  "StaleRevision",
  "BodyMismatch",
  "RegionMismatch",
  "FrameMismatch",
  "InvalidRadius",
  "InvalidQuantum",
  "DuplicateCommand",
  "AuthorityRefused"
] as const;
export type SurfaceVoxelEditRejectionCode = (typeof SURFACE_VOXEL_EDIT_REJECTION_CODES)[number];

interface SurfaceVoxelEditAppliedInput {
  readonly status: "Applied";
  readonly commandId: string;
  readonly changedBrickIds: readonly string[];
  readonly resultingRegionRevision: number;
  readonly resultingRegionHash: string;
}
interface SurfaceVoxelEditNoChangeInput {
  readonly status: "NoChange";
  readonly commandId: string;
  readonly changedBrickIds: readonly [];
  readonly resultingRegionRevision: number;
  readonly resultingRegionHash: string;
}
interface SurfaceVoxelEditRejectedInput {
  readonly status: "Rejected";
  readonly commandId: string;
  readonly code: SurfaceVoxelEditRejectionCode;
  readonly message: string;
}
export type SurfaceVoxelEditResultInput = SurfaceVoxelEditAppliedInput | SurfaceVoxelEditNoChangeInput | SurfaceVoxelEditRejectedInput;

export type SurfaceVoxelEditResult =
  | Readonly<{
    readonly status: "Applied";
    readonly commandId: SurfaceCommandId;
    readonly changedBrickIds: readonly SurfaceBrickId[];
    readonly resultingRegionRevision: number;
    readonly resultingRegionHash: string;
  }>
  | Readonly<{
    readonly status: "NoChange";
    readonly commandId: SurfaceCommandId;
    readonly changedBrickIds: readonly [];
    readonly resultingRegionRevision: number;
    readonly resultingRegionHash: string;
  }>
  | Readonly<{
    readonly status: "Rejected";
    readonly commandId: SurfaceCommandId;
    readonly code: SurfaceVoxelEditRejectionCode;
    readonly message: string;
  }>;

const regionHash = (value: unknown): string => {
  if (typeof value !== "string" || !/^fnv1a64-v1:[0-9a-f]{16}$/.test(value)) {
    return fail("InvalidHash", "voxelEditResult.resultingRegionHash", "must use authoritative fnv1a64-v1:<16 lowercase hex> format.");
  }
  return value;
};

export const createSurfaceVoxelEditResult = (input: SurfaceVoxelEditResultInput): Readonly<SurfaceVoxelEditResult> => {
  const commandId = stableId(input.commandId, "voxelEditResult.commandId");
  if (input.status === "Rejected") {
    return canonicalCloneAndDeepFreeze({
      status: "Rejected" as const,
      commandId,
      code: enumValue(input.code, SURFACE_VOXEL_EDIT_REJECTION_CODES, "voxelEditResult.code"),
      message: message(input.message, "voxelEditResult.message")
    });
  }
  if (input.status !== "Applied" && input.status !== "NoChange") {
    return fail("InvalidVoxelEditResult", "voxelEditResult.status", "must be Applied, NoChange, or Rejected.");
  }
  const changedBrickIds = denseArray(input.changedBrickIds, "voxelEditResult.changedBrickIds", 4096)
    .map((id, index) => stableId(id, `voxelEditResult.changedBrickIds.${index}`));
  for (let index = 1; index < changedBrickIds.length; index += 1) {
    if (compareCanonicalCodeUnits(changedBrickIds[index - 1], changedBrickIds[index]) >= 0) {
      return fail("InvalidVoxelEditResult", "voxelEditResult.changedBrickIds", "must be unique and strictly ordered.");
    }
  }
  if (input.status === "Applied" && changedBrickIds.length === 0) {
    return fail("InvalidVoxelEditResult", "voxelEditResult.changedBrickIds", "Applied results require at least one changed brick.");
  }
  if (input.status === "NoChange" && changedBrickIds.length !== 0) {
    return fail("InvalidVoxelEditResult", "voxelEditResult.changedBrickIds", "NoChange results cannot list changed bricks.");
  }
  return canonicalCloneAndDeepFreeze({
    status: input.status,
    commandId,
    changedBrickIds,
    resultingRegionRevision: safeNonNegativeInteger(input.resultingRegionRevision, "voxelEditResult.resultingRegionRevision", "InvalidRevision"),
    resultingRegionHash: regionHash(input.resultingRegionHash)
  }) as Readonly<SurfaceVoxelEditResult>;
};

export interface SurfacePlayHudSnapshotInput {
  readonly mode: "SurfaceFirstPerson";
  readonly movementMode: SurfaceMovementMode;
  readonly grounded: boolean;
  readonly energyJoules: number;
  readonly maximumEnergyJoules: number;
  readonly heatJoules: number;
  readonly maximumHeatJoules: number;
  readonly cooldownSeconds: number;
  readonly targetCondition: "None" | "Operational" | "Damaged" | "Disabled" | "Destroyed";
  readonly latestAction: string | null;
  readonly latestBlock: string | null;
}

export type SurfacePlayHudSnapshot = SurfacePlayHudSnapshotInput;

const optionalHudText = (value: string | null, path: string): string | null => value === null ? null : message(value, path);

export const createSurfacePlayHudSnapshot = (input: SurfacePlayHudSnapshotInput): Readonly<SurfacePlayHudSnapshot> => {
  const maximumEnergyJoules = nonNegative(input.maximumEnergyJoules, "hud.maximumEnergyJoules");
  const energyJoules = nonNegative(input.energyJoules, "hud.energyJoules");
  if (energyJoules > maximumEnergyJoules) return fail("InvalidNumber", "hud.energyJoules", "must not exceed maximumEnergyJoules.");
  const maximumHeatJoules = nonNegative(input.maximumHeatJoules, "hud.maximumHeatJoules");
  const heatJoules = nonNegative(input.heatJoules, "hud.heatJoules");
  if (heatJoules > maximumHeatJoules) return fail("InvalidNumber", "hud.heatJoules", "must not exceed maximumHeatJoules.");
  return canonicalCloneAndDeepFreeze({
    mode: enumValue(input.mode, ["SurfaceFirstPerson"] as const, "hud.mode"),
    movementMode: enumValue(input.movementMode, SURFACE_MOVEMENT_MODES, "hud.movementMode"),
    grounded: booleanValue(input.grounded, "hud.grounded"),
    energyJoules,
    maximumEnergyJoules,
    heatJoules,
    maximumHeatJoules,
    cooldownSeconds: nonNegative(input.cooldownSeconds, "hud.cooldownSeconds"),
    targetCondition: enumValue(input.targetCondition, ["None", "Operational", "Damaged", "Disabled", "Destroyed"] as const, "hud.targetCondition"),
    latestAction: optionalHudText(input.latestAction, "hud.latestAction"),
    latestBlock: optionalHudText(input.latestBlock, "hud.latestBlock")
  });
};

export interface SurfacePlayerPresentationSnapshot {
  readonly playerId: SurfacePlayerId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly positionMeters: Readonly<SpatialVector3>;
  readonly yawRadians: number;
  readonly pitchRadians: number;
  readonly movementMode: SurfaceMovementMode;
}

export interface SurfacePlayerPresentationSnapshotInput {
  readonly playerId: string;
  readonly surfaceFrameId: string;
  readonly positionMeters: SpatialVector3;
  readonly yawRadians: number;
  readonly pitchRadians: number;
  readonly movementMode: SurfaceMovementMode;
}

export interface SurfaceTerrainPresentationSnapshot {
  readonly bodyId: SurfaceBodyId;
  readonly regionId: SurfaceRegionId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly regionRevision: number;
  readonly visibleBrickIds: readonly SurfaceBrickId[];
}

export interface SurfaceTerrainPresentationSnapshotInput {
  readonly bodyId: string;
  readonly regionId: string;
  readonly surfaceFrameId: string;
  readonly regionRevision: number;
  readonly visibleBrickIds: readonly string[];
}

export interface SurfaceTargetPresentationSnapshot {
  readonly targetId: SurfaceStableId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly positionMeters: Readonly<SpatialVector3>;
  readonly condition: "Operational" | "Damaged" | "Disabled" | "Destroyed";
}

export interface SurfaceTargetPresentationSnapshotInput {
  readonly targetId: string;
  readonly surfaceFrameId: string;
  readonly positionMeters: SpatialVector3;
  readonly condition: "Operational" | "Damaged" | "Disabled" | "Destroyed";
}

export interface SurfaceWeaponPresentationSnapshot {
  readonly weaponId: SurfaceStableId;
  readonly ownerPlayerId: SurfacePlayerId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly muzzlePositionMeters: Readonly<SpatialVector3>;
  readonly cooldownSeconds: number;
  readonly firing: boolean;
}

export interface SurfaceWeaponPresentationSnapshotInput {
  readonly weaponId: string;
  readonly ownerPlayerId: string;
  readonly surfaceFrameId: string;
  readonly muzzlePositionMeters: SpatialVector3;
  readonly cooldownSeconds: number;
  readonly firing: boolean;
}

export interface SurfaceImpactPresentationSnapshot {
  readonly impactId: SurfaceStableId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly positionMeters: Readonly<SpatialVector3>;
  readonly normal: Readonly<SpatialVector3>;
  readonly kind: "Target" | "Terrain";
  readonly simulationTick: number;
}

export interface SurfaceImpactPresentationSnapshotInput {
  readonly impactId: string;
  readonly surfaceFrameId: string;
  readonly positionMeters: SpatialVector3;
  readonly normal: SpatialVector3;
  readonly kind: "Target" | "Terrain";
  readonly simulationTick: number;
}

export const createSurfacePlayerPresentationSnapshot = (
  input: SurfacePlayerPresentationSnapshotInput
): Readonly<SurfacePlayerPresentationSnapshot> => {
  requirePlainDataRecord(input, "playerPresentation");
  return canonicalCloneAndDeepFreeze({
    playerId: stableId(input.playerId, "playerPresentation.playerId"),
    surfaceFrameId: stableId(input.surfaceFrameId, "playerPresentation.surfaceFrameId"),
    positionMeters: vector(input.positionMeters, "playerPresentation.positionMeters"),
    yawRadians: finite(input.yawRadians, "playerPresentation.yawRadians"),
    pitchRadians: finite(input.pitchRadians, "playerPresentation.pitchRadians"),
    movementMode: enumValue(input.movementMode, SURFACE_MOVEMENT_MODES, "playerPresentation.movementMode")
  });
};

export const createSurfaceTerrainPresentationSnapshot = (
  input: SurfaceTerrainPresentationSnapshotInput
): Readonly<SurfaceTerrainPresentationSnapshot> => {
  requirePlainDataRecord(input, "terrainPresentation");
  return canonicalCloneAndDeepFreeze({
    bodyId: stableId(input.bodyId, "terrainPresentation.bodyId"),
    regionId: stableId(input.regionId, "terrainPresentation.regionId"),
    surfaceFrameId: stableId(input.surfaceFrameId, "terrainPresentation.surfaceFrameId"),
    regionRevision: safeNonNegativeInteger(input.regionRevision, "terrainPresentation.regionRevision", "InvalidRevision"),
    visibleBrickIds: denseArray(input.visibleBrickIds, "terrainPresentation.visibleBrickIds", 4096)
      .map((brickId, index) => stableId(brickId, `terrainPresentation.visibleBrickIds.${index}`))
  });
};

export const createSurfaceTargetPresentationSnapshot = (
  input: SurfaceTargetPresentationSnapshotInput
): Readonly<SurfaceTargetPresentationSnapshot> => {
  requirePlainDataRecord(input, "targetPresentation");
  return canonicalCloneAndDeepFreeze({
    targetId: stableId(input.targetId, "targetPresentation.targetId"),
    surfaceFrameId: stableId(input.surfaceFrameId, "targetPresentation.surfaceFrameId"),
    positionMeters: vector(input.positionMeters, "targetPresentation.positionMeters"),
    condition: enumValue(
      input.condition,
      ["Operational", "Damaged", "Disabled", "Destroyed"] as const,
      "targetPresentation.condition"
    )
  });
};

export const createSurfaceWeaponPresentationSnapshot = (
  input: SurfaceWeaponPresentationSnapshotInput
): Readonly<SurfaceWeaponPresentationSnapshot> => {
  requirePlainDataRecord(input, "weaponPresentation");
  return canonicalCloneAndDeepFreeze({
    weaponId: stableId(input.weaponId, "weaponPresentation.weaponId"),
    ownerPlayerId: stableId(input.ownerPlayerId, "weaponPresentation.ownerPlayerId"),
    surfaceFrameId: stableId(input.surfaceFrameId, "weaponPresentation.surfaceFrameId"),
    muzzlePositionMeters: vector(input.muzzlePositionMeters, "weaponPresentation.muzzlePositionMeters"),
    cooldownSeconds: nonNegative(input.cooldownSeconds, "weaponPresentation.cooldownSeconds"),
    firing: booleanValue(input.firing, "weaponPresentation.firing")
  });
};

export const createSurfaceImpactPresentationSnapshot = (
  input: SurfaceImpactPresentationSnapshotInput
): Readonly<SurfaceImpactPresentationSnapshot> => {
  requirePlainDataRecord(input, "impactPresentation");
  return canonicalCloneAndDeepFreeze({
    impactId: stableId(input.impactId, "impactPresentation.impactId"),
    surfaceFrameId: stableId(input.surfaceFrameId, "impactPresentation.surfaceFrameId"),
    positionMeters: vector(input.positionMeters, "impactPresentation.positionMeters"),
    normal: unitDirection(input.normal, "impactPresentation.normal"),
    kind: enumValue(input.kind, ["Target", "Terrain"] as const, "impactPresentation.kind"),
    simulationTick: safeNonNegativeInteger(input.simulationTick, "impactPresentation.simulationTick", "InvalidTick")
  });
};

export interface SurfacePlayerPresentationPort {
  presentPlayer(snapshot: Readonly<SurfacePlayerPresentationSnapshot>): void;
}
export interface SurfaceTerrainPresentationPort {
  presentTerrain(snapshot: Readonly<SurfaceTerrainPresentationSnapshot>): void;
}
export interface SurfaceTargetPresentationPort {
  presentTarget(snapshot: Readonly<SurfaceTargetPresentationSnapshot>): void;
}
export interface SurfaceWeaponPresentationPort {
  presentWeapon(snapshot: Readonly<SurfaceWeaponPresentationSnapshot>): void;
}
export interface SurfaceImpactPresentationPort {
  presentImpact(snapshot: Readonly<SurfaceImpactPresentationSnapshot>): void;
}

export interface SurfacePlayPresentationPorts
  extends SurfacePlayerPresentationPort,
    SurfaceTerrainPresentationPort,
    SurfaceTargetPresentationPort,
    SurfaceWeaponPresentationPort,
    SurfaceImpactPresentationPort {}
