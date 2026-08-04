import { canonicalCloneAndDeepFreeze } from "../../core/hash";
import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  compareCanonicalCodeUnits,
  globalQuantumCoordinate,
  type GlobalQuantumCoordinate
} from "../../voxel/adaptive";
import { validateVoxelStableId } from "../../voxel";
import {
  createSpatialQuaternion,
  type SpatialQuaternion,
  type SpatialVector3
} from "../../spatial";

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
  code: "InvalidNumber" | "InvalidRevision" | "InvalidTick"
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

const canonicalQuaternion = (
  value: SpatialQuaternion,
  path: string
): Readonly<SpatialQuaternion> => {
  requirePlainDataRecord(value, path);
  const components = {
    x: finite(value.x, `${path}.x`),
    y: finite(value.y, `${path}.y`),
    z: finite(value.z, `${path}.z`),
    w: finite(value.w, `${path}.w`)
  };
  const magnitude = Math.hypot(components.x, components.y, components.z, components.w);
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return fail("InvalidVector", path, "must be a non-zero finite quaternion.");
  }
  return createSpatialQuaternion(components, path);
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
  "AuthorityRefused",
  "BodyCapacityExceeded",
  "ColliderBudgetExceeded",
  "DetachedBodyImmutable"
] as const;
export type SurfaceFireRejectionCode = (typeof SURFACE_FIRE_REJECTION_CODES)[number];
export type SurfaceFireResultInput =
  | Readonly<{ readonly status: "Accepted"; readonly commandId: string; readonly hit: "None" | "Target" | "Terrain" | "Structural" }>
  | Readonly<{ readonly status: "Rejected"; readonly commandId: string; readonly code: SurfaceFireRejectionCode; readonly message: string }>;
export type SurfaceFireResult =
  | Readonly<{ readonly status: "Accepted"; readonly commandId: SurfaceCommandId; readonly hit: "None" | "Target" | "Terrain" | "Structural" }>
  | Readonly<{ readonly status: "Rejected"; readonly commandId: SurfaceCommandId; readonly code: SurfaceFireRejectionCode; readonly message: string }>;

export interface SurfaceCombatEventSummaryInput {
  readonly sequence: number;
  readonly eventId: string;
  readonly kind:
    | "FireAccepted"
    | "FireRejected"
    | "TargetDamaged"
    | "TargetDestroyed"
    | "TerrainHit"
    | "StructuralHit"
    | "StructuralDamaged"
    | "StructuralDetached";
  readonly simulationTick: number;
}

export interface SurfaceCombatEventSummary extends Omit<SurfaceCombatEventSummaryInput, "eventId"> {
  readonly eventId: SurfaceStableId;
}

export type SurfaceWeaponReadinessInput =
  | Readonly<{ readonly kind: "Ready"; readonly nextShotReadyInSeconds: 0 }>
  | Readonly<{ readonly kind: "Cooldown" | "Overheated"; readonly nextShotReadyInSeconds: number }>
  | Readonly<{
    readonly kind: "EnergyInsufficient";
    readonly currentEnergyJoules: number;
    readonly requiredEnergyJoules: number;
    readonly recoveryDelayRemainingSeconds: number;
    readonly recoveryRateJoulesPerSecond: number;
    readonly nextShotReadyInSeconds: number;
  }>;

export type SurfaceWeaponReadiness = SurfaceWeaponReadinessInput;

export interface SurfaceCombatSnapshotInput {
  readonly activeWeaponId: string;
  readonly energyJoules: number;
  readonly maximumEnergyJoules: number;
  readonly heatJoules: number;
  readonly maximumHeatJoules: number;
  readonly cooldownSeconds: number;
  readonly readiness: SurfaceWeaponReadinessInput;
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
  readonly readiness: SurfaceWeaponReadiness;
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
      hit: enumValue(value.hit, ["None", "Target", "Terrain", "Structural"] as const, "combat.latestFireResult.hit")
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

const weaponReadiness = (
  value: SurfaceWeaponReadinessInput,
  path: string
): Readonly<SurfaceWeaponReadiness> => {
  requirePlainDataRecord(value, path);
  const kind = enumValue(
    value.kind,
    ["Ready", "Cooldown", "Overheated", "EnergyInsufficient"] as const,
    `${path}.kind`
  );
  if (kind === "Ready") {
    if (value.nextShotReadyInSeconds !== 0) {
      return fail("InvalidNumber", `${path}.nextShotReadyInSeconds`, "must be exactly zero when Ready.");
    }
    return canonicalCloneAndDeepFreeze({ kind, nextShotReadyInSeconds: 0 as const });
  }
  if (kind === "Cooldown" || kind === "Overheated") {
    return canonicalCloneAndDeepFreeze({
      kind,
      nextShotReadyInSeconds: nonNegative(value.nextShotReadyInSeconds, `${path}.nextShotReadyInSeconds`)
    });
  }
  const energy = value as Extract<SurfaceWeaponReadinessInput, { readonly kind: "EnergyInsufficient" }>;
  const currentEnergyJoules = nonNegative(energy.currentEnergyJoules, `${path}.currentEnergyJoules`);
  const requiredEnergyJoules = positive(energy.requiredEnergyJoules, `${path}.requiredEnergyJoules`);
  if (currentEnergyJoules >= requiredEnergyJoules) {
    return fail("InvalidNumber", `${path}.currentEnergyJoules`, "must be below requiredEnergyJoules.");
  }
  return canonicalCloneAndDeepFreeze({
    kind,
    currentEnergyJoules,
    requiredEnergyJoules,
    recoveryDelayRemainingSeconds: nonNegative(
      energy.recoveryDelayRemainingSeconds,
      `${path}.recoveryDelayRemainingSeconds`
    ),
    recoveryRateJoulesPerSecond: nonNegative(
      energy.recoveryRateJoulesPerSecond,
      `${path}.recoveryRateJoulesPerSecond`
    ),
    nextShotReadyInSeconds: nonNegative(energy.nextShotReadyInSeconds, `${path}.nextShotReadyInSeconds`)
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
      kind: enumValue(
        event.kind,
        [
          "FireAccepted",
          "FireRejected",
          "TargetDamaged",
          "TargetDestroyed",
          "TerrainHit",
          "StructuralHit",
          "StructuralDamaged",
          "StructuralDetached"
        ] as const,
        `combat.events.${index}.kind`
      ),
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
    readiness: weaponReadiness(input.readiness, "combat.readiness"),
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

const structuralContentHash = (value: unknown, path: string): string => {
  if (typeof value !== "string" || !/^fnv1a64-v1:[0-9a-f]{16}$/.test(value)) {
    return fail("InvalidHash", path, "must use authoritative fnv1a64-v1:<16 lowercase hex> format.");
  }
  return value;
};

const orderedStableIds = (
  value: unknown,
  path: string,
  maximumLength: number
): readonly SurfaceStableId[] => {
  const ids = denseArray(value, path, maximumLength)
    .map((id, index) => stableId(id, `${path}.${index}`));
  for (let index = 1; index < ids.length; index += 1) {
    if (compareCanonicalCodeUnits(ids[index - 1], ids[index]) >= 0) {
      return fail("InvalidArray", path, "must contain unique IDs in canonical code-unit order.");
    }
  }
  return ids;
};

type SurfaceStructuralAcceptedTransitionSnapshotInput = Readonly<{
  readonly status: "Applied" | "NoChange";
  readonly fireCommandId: string;
  readonly structuralCommandId: string;
  readonly objectId: string;
  readonly previousObjectRevision: number;
  readonly resultingObjectRevision: number;
  readonly previousEditRevision: number;
  readonly resultingEditRevision: number;
  readonly previousContentHash: string;
  readonly resultingContentHash: string;
  readonly changedCellCount: number;
  readonly changedBrickIds: readonly string[];
  readonly supportResult: "Anchored" | "Detached" | "Empty";
  readonly detachedComponentIds: readonly string[];
  readonly authorityTransfer: SurfaceStructuralAuthorityTransferSnapshotInput | null;
  readonly simulationTick: number;
}>;

type SurfaceStructuralRejectedTransitionSnapshotInput = Readonly<{
  readonly status: "Rejected";
  readonly fireCommandId: string;
  readonly structuralCommandId: string | null;
  readonly objectId: string;
  readonly currentObjectRevision: number;
  readonly currentEditRevision: number;
  readonly currentContentHash: string;
  readonly code:
    | "BodyCapacityExceeded"
    | "ColliderBudgetExceeded"
    | "DetachedBodyImmutable"
    | "StructuralAuthorityRefused";
  readonly authorityTransfer: null;
  readonly simulationTick: number;
}>;

export interface SurfaceStructuralAuthorityTransferSnapshotInput {
  readonly transferCommandId: string;
  readonly previousObjectRevision: number;
  readonly resultingObjectRevision: number;
  readonly previousEditRevision: number;
  readonly resultingEditRevision: number;
  readonly previousContentHash: string;
  readonly resultingContentHash: string;
  readonly transferredCellCount: number;
  readonly changedBrickIds: readonly string[];
  readonly sourceFragmentIds: readonly string[];
}

export interface SurfaceStructuralAuthorityTransferSnapshot
  extends Omit<
    SurfaceStructuralAuthorityTransferSnapshotInput,
    "transferCommandId" | "changedBrickIds" | "sourceFragmentIds"
  > {
  readonly transferCommandId: SurfaceCommandId;
  readonly changedBrickIds: readonly SurfaceBrickId[];
  readonly sourceFragmentIds: readonly SurfaceStableId[];
}

export type SurfaceStructuralTransitionSnapshotInput =
  | SurfaceStructuralAcceptedTransitionSnapshotInput
  | SurfaceStructuralRejectedTransitionSnapshotInput;

export type SurfaceStructuralTransitionSnapshot =
  | Readonly<{
    readonly status: "Applied" | "NoChange";
    readonly fireCommandId: SurfaceCommandId;
    readonly structuralCommandId: SurfaceCommandId;
    readonly objectId: SurfaceStableId;
    readonly previousObjectRevision: number;
    readonly resultingObjectRevision: number;
    readonly previousEditRevision: number;
    readonly resultingEditRevision: number;
    readonly previousContentHash: string;
    readonly resultingContentHash: string;
    readonly changedCellCount: number;
    readonly changedBrickIds: readonly SurfaceBrickId[];
    readonly supportResult: "Anchored" | "Detached" | "Empty";
    readonly detachedComponentIds: readonly SurfaceStableId[];
    readonly authorityTransfer: SurfaceStructuralAuthorityTransferSnapshot | null;
    readonly simulationTick: number;
  }>
  | Readonly<{
    readonly status: "Rejected";
    readonly fireCommandId: SurfaceCommandId;
    readonly structuralCommandId: SurfaceCommandId | null;
    readonly objectId: SurfaceStableId;
    readonly currentObjectRevision: number;
    readonly currentEditRevision: number;
    readonly currentContentHash: string;
    readonly code:
      | "BodyCapacityExceeded"
      | "ColliderBudgetExceeded"
      | "DetachedBodyImmutable"
      | "StructuralAuthorityRefused";
    readonly authorityTransfer: null;
    readonly simulationTick: number;
  }>;

const structuralAuthorityTransfer = (
  input: SurfaceStructuralAuthorityTransferSnapshotInput,
  path: string
): Readonly<SurfaceStructuralAuthorityTransferSnapshot> => {
  requirePlainDataRecord(input, path);
  const previousObjectRevision = safeNonNegativeInteger(
    input.previousObjectRevision,
    `${path}.previousObjectRevision`,
    "InvalidRevision"
  );
  const resultingObjectRevision = safeNonNegativeInteger(
    input.resultingObjectRevision,
    `${path}.resultingObjectRevision`,
    "InvalidRevision"
  );
  const previousEditRevision = safeNonNegativeInteger(
    input.previousEditRevision,
    `${path}.previousEditRevision`,
    "InvalidRevision"
  );
  const resultingEditRevision = safeNonNegativeInteger(
    input.resultingEditRevision,
    `${path}.resultingEditRevision`,
    "InvalidRevision"
  );
  const previousContentHash = structuralContentHash(
    input.previousContentHash,
    `${path}.previousContentHash`
  );
  const resultingContentHash = structuralContentHash(
    input.resultingContentHash,
    `${path}.resultingContentHash`
  );
  const transferredCellCount = safeNonNegativeInteger(
    input.transferredCellCount,
    `${path}.transferredCellCount`,
    "InvalidNumber"
  );
  const changedBrickIds = orderedStableIds(input.changedBrickIds, `${path}.changedBrickIds`, 4096);
  const sourceFragmentIds = orderedStableIds(input.sourceFragmentIds, `${path}.sourceFragmentIds`, 8);
  if (
    previousObjectRevision === Number.MAX_SAFE_INTEGER
    || resultingObjectRevision !== previousObjectRevision + 1
    || previousEditRevision === Number.MAX_SAFE_INTEGER
    || resultingEditRevision !== previousEditRevision + 1
    || previousContentHash === resultingContentHash
    || transferredCellCount === 0
    || changedBrickIds.length === 0
    || sourceFragmentIds.length === 0
  ) {
    return fail(
      "InvalidRevision",
      path,
      "must describe one non-empty, revision-advancing Structural authority transfer."
    );
  }
  return canonicalCloneAndDeepFreeze({
    transferCommandId: stableId(input.transferCommandId, `${path}.transferCommandId`),
    previousObjectRevision,
    resultingObjectRevision,
    previousEditRevision,
    resultingEditRevision,
    previousContentHash,
    resultingContentHash,
    transferredCellCount,
    changedBrickIds,
    sourceFragmentIds
  });
};

export const createSurfaceStructuralTransitionSnapshot = (
  input: SurfaceStructuralTransitionSnapshotInput
): Readonly<SurfaceStructuralTransitionSnapshot> => {
  requirePlainDataRecord(input, "structuralTransition");
  const status = enumValue(
    input.status,
    ["Applied", "NoChange", "Rejected"] as const,
    "structuralTransition.status"
  );
  const fireCommandId = stableId(input.fireCommandId, "structuralTransition.fireCommandId");
  const objectId = stableId(input.objectId, "structuralTransition.objectId");
  const simulationTick = safeNonNegativeInteger(
    input.simulationTick,
    "structuralTransition.simulationTick",
    "InvalidTick"
  );
  if (status === "Rejected") {
    const rejected = input as SurfaceStructuralRejectedTransitionSnapshotInput;
    if (rejected.authorityTransfer !== null) {
      return fail(
        "InvalidRecord",
        "structuralTransition.authorityTransfer",
        "must be null for Rejected transitions."
      );
    }
    return canonicalCloneAndDeepFreeze({
      status,
      fireCommandId,
      structuralCommandId: rejected.structuralCommandId === null
        ? null
        : stableId(rejected.structuralCommandId, "structuralTransition.structuralCommandId"),
      objectId,
      currentObjectRevision: safeNonNegativeInteger(
        rejected.currentObjectRevision,
        "structuralTransition.currentObjectRevision",
        "InvalidRevision"
      ),
      currentEditRevision: safeNonNegativeInteger(
        rejected.currentEditRevision,
        "structuralTransition.currentEditRevision",
        "InvalidRevision"
      ),
      currentContentHash: structuralContentHash(
        rejected.currentContentHash,
        "structuralTransition.currentContentHash"
      ),
      code: enumValue(
        rejected.code,
        [
          "BodyCapacityExceeded",
          "ColliderBudgetExceeded",
          "DetachedBodyImmutable",
          "StructuralAuthorityRefused"
        ] as const,
        "structuralTransition.code"
      ),
      authorityTransfer: null,
      simulationTick
    });
  }

  const accepted = input as SurfaceStructuralAcceptedTransitionSnapshotInput;
  const previousObjectRevision = safeNonNegativeInteger(
    accepted.previousObjectRevision,
    "structuralTransition.previousObjectRevision",
    "InvalidRevision"
  );
  const resultingObjectRevision = safeNonNegativeInteger(
    accepted.resultingObjectRevision,
    "structuralTransition.resultingObjectRevision",
    "InvalidRevision"
  );
  if (previousObjectRevision === Number.MAX_SAFE_INTEGER || resultingObjectRevision !== previousObjectRevision + 1) {
    return fail(
      "InvalidRevision",
      "structuralTransition.resultingObjectRevision",
      "must advance previousObjectRevision exactly once."
    );
  }
  const previousEditRevision = safeNonNegativeInteger(
    accepted.previousEditRevision,
    "structuralTransition.previousEditRevision",
    "InvalidRevision"
  );
  const resultingEditRevision = safeNonNegativeInteger(
    accepted.resultingEditRevision,
    "structuralTransition.resultingEditRevision",
    "InvalidRevision"
  );
  const previousContentHash = structuralContentHash(
    accepted.previousContentHash,
    "structuralTransition.previousContentHash"
  );
  const resultingContentHash = structuralContentHash(
    accepted.resultingContentHash,
    "structuralTransition.resultingContentHash"
  );
  const changedCellCount = safeNonNegativeInteger(
    accepted.changedCellCount,
    "structuralTransition.changedCellCount",
    "InvalidNumber"
  );
  const changedBrickIds = orderedStableIds(
    accepted.changedBrickIds,
    "structuralTransition.changedBrickIds",
    4096
  );
  if (status === "Applied") {
    if (
      previousEditRevision === Number.MAX_SAFE_INTEGER
      || resultingEditRevision !== previousEditRevision + 1
      || previousContentHash === resultingContentHash
      || changedCellCount === 0
      || changedBrickIds.length === 0
    ) {
      return fail(
        "InvalidRevision",
        "structuralTransition",
        "Applied must advance edit/content state and describe non-empty changes."
      );
    }
  } else if (
    resultingEditRevision !== previousEditRevision
    || resultingContentHash !== previousContentHash
    || changedCellCount !== 0
    || changedBrickIds.length !== 0
  ) {
    return fail(
      "InvalidRevision",
      "structuralTransition",
      "NoChange must preserve edit/content state and contain no changed cells or bricks."
    );
  }
  const supportResult = enumValue(
    accepted.supportResult,
    ["Anchored", "Detached", "Empty"] as const,
    "structuralTransition.supportResult"
  );
  const detachedComponentIds = orderedStableIds(
    accepted.detachedComponentIds,
    "structuralTransition.detachedComponentIds",
    8
  );
  if (supportResult === "Detached" && detachedComponentIds.length === 0) {
    return fail(
      "InvalidArray",
      "structuralTransition.detachedComponentIds",
      "Detached support requires at least one detached component ID."
    );
  }
  if (supportResult !== "Detached" && detachedComponentIds.length !== 0) {
    return fail(
      "InvalidArray",
      "structuralTransition.detachedComponentIds",
      `${supportResult} support cannot list detached component IDs.`
    );
  }
  if (supportResult === "Empty" && status !== "Applied") {
    return fail(
      "InvalidRecord",
      "structuralTransition.supportResult",
      "Empty means the applied Damage step itself made the current object empty."
    );
  }
  let authorityTransfer: Readonly<SurfaceStructuralAuthorityTransferSnapshot> | null = null;
  if (supportResult === "Detached") {
    if (status !== "Applied" || accepted.authorityTransfer === null) {
      return fail(
        "InvalidRecord",
        "structuralTransition.authorityTransfer",
        "Detached Applied transitions require an authority transfer."
      );
    }
    authorityTransfer = structuralAuthorityTransfer(
      accepted.authorityTransfer,
      "structuralTransition.authorityTransfer"
    );
    if (
      authorityTransfer.transferCommandId === accepted.structuralCommandId
      || authorityTransfer.previousObjectRevision !== resultingObjectRevision
      || authorityTransfer.previousEditRevision !== resultingEditRevision
      || authorityTransfer.previousContentHash !== resultingContentHash
      || authorityTransfer.sourceFragmentIds.length !== detachedComponentIds.length
    ) {
      return fail(
        "InvalidRevision",
        "structuralTransition.authorityTransfer",
        "must be a separate command chained exactly from the Damage result with one Fragment per detached Component."
      );
    }
  } else if (accepted.authorityTransfer !== null) {
    return fail(
      "InvalidRecord",
      "structuralTransition.authorityTransfer",
      "must be null for NoChange, Anchored and Empty transitions."
    );
  }
  return canonicalCloneAndDeepFreeze({
    status,
    fireCommandId,
    structuralCommandId: stableId(
      accepted.structuralCommandId,
      "structuralTransition.structuralCommandId"
    ),
    objectId,
    previousObjectRevision,
    resultingObjectRevision,
    previousEditRevision,
    resultingEditRevision,
    previousContentHash,
    resultingContentHash,
    changedCellCount,
    changedBrickIds,
    supportResult,
    detachedComponentIds,
    authorityTransfer,
    simulationTick
  });
};

export interface SurfaceDynamicBodySnapshotInput {
  readonly bodyId: string;
  readonly componentId: string;
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceContentHash: string;
  readonly lifecycle: "Falling" | "Resting";
  readonly positionMeters: SpatialVector3;
  readonly orientation: SpatialQuaternion;
  readonly linearVelocityMetersPerSecond: SpatialVector3;
  readonly angularVelocityRadiansPerSecond: SpatialVector3;
  readonly colliderRevision: number;
  readonly simulationTick: number;
}

export interface SurfaceDynamicBodySnapshot
  extends Omit<
    SurfaceDynamicBodySnapshotInput,
    "bodyId" | "componentId" | "objectId" | "orientation"
  > {
  readonly bodyId: SurfaceStableId;
  readonly componentId: SurfaceStableId;
  readonly objectId: SurfaceStableId;
  readonly orientation: Readonly<SpatialQuaternion>;
}

export const createSurfaceDynamicBodySnapshot = (
  input: SurfaceDynamicBodySnapshotInput
): Readonly<SurfaceDynamicBodySnapshot> => {
  requirePlainDataRecord(input, "dynamicBody");
  return canonicalCloneAndDeepFreeze({
    bodyId: stableId(input.bodyId, "dynamicBody.bodyId"),
    componentId: stableId(input.componentId, "dynamicBody.componentId"),
    objectId: stableId(input.objectId, "dynamicBody.objectId"),
    sourceObjectRevision: safeNonNegativeInteger(
      input.sourceObjectRevision,
      "dynamicBody.sourceObjectRevision",
      "InvalidRevision"
    ),
    sourceContentHash: structuralContentHash(
      input.sourceContentHash,
      "dynamicBody.sourceContentHash"
    ),
    lifecycle: enumValue(input.lifecycle, ["Falling", "Resting"] as const, "dynamicBody.lifecycle"),
    positionMeters: vector(input.positionMeters, "dynamicBody.positionMeters"),
    orientation: canonicalQuaternion(input.orientation, "dynamicBody.orientation"),
    linearVelocityMetersPerSecond: vector(
      input.linearVelocityMetersPerSecond,
      "dynamicBody.linearVelocityMetersPerSecond"
    ),
    angularVelocityRadiansPerSecond: vector(
      input.angularVelocityRadiansPerSecond,
      "dynamicBody.angularVelocityRadiansPerSecond"
    ),
    colliderRevision: safeNonNegativeInteger(
      input.colliderRevision,
      "dynamicBody.colliderRevision",
      "InvalidRevision"
    ),
    simulationTick: safeNonNegativeInteger(
      input.simulationTick,
      "dynamicBody.simulationTick",
      "InvalidTick"
    )
  });
};

export interface SurfacePhysicsFailureSnapshotInput {
  readonly code: "ContactBudgetExceeded" | "MotionBudgetExceeded" | "NonFiniteState";
  readonly simulationTick: number;
  readonly bodyIds: readonly string[];
}

export interface SurfacePhysicsFailureSnapshot
  extends Omit<SurfacePhysicsFailureSnapshotInput, "bodyIds"> {
  readonly bodyIds: readonly SurfaceStableId[];
}

export const createSurfacePhysicsFailureSnapshot = (
  input: SurfacePhysicsFailureSnapshotInput
): Readonly<SurfacePhysicsFailureSnapshot> => {
  requirePlainDataRecord(input, "physicsFailure");
  return canonicalCloneAndDeepFreeze({
    code: enumValue(
      input.code,
      ["ContactBudgetExceeded", "MotionBudgetExceeded", "NonFiniteState"] as const,
      "physicsFailure.code"
    ),
    simulationTick: safeNonNegativeInteger(
      input.simulationTick,
      "physicsFailure.simulationTick",
      "InvalidTick"
    ),
    bodyIds: orderedStableIds(input.bodyIds, "physicsFailure.bodyIds", 8)
  });
};

interface SurfaceStructuralObjectPresentationInput {
  readonly objectId: string;
  readonly treeInstanceId: string;
  readonly speciesId: string;
  readonly objectRevision: number;
  readonly editRevision: number;
  readonly contentHash: string;
  readonly componentIds: readonly string[];
  readonly meshArtifactId: string;
}

interface SurfaceStructuralObjectPresentation
  extends Omit<
    SurfaceStructuralObjectPresentationInput,
    "objectId" | "treeInstanceId" | "speciesId" | "componentIds" | "meshArtifactId"
  > {
  readonly objectId: SurfaceStableId;
  readonly treeInstanceId: SurfaceStableId;
  readonly speciesId: SurfaceStableId;
  readonly componentIds: readonly SurfaceStableId[];
  readonly meshArtifactId: SurfaceStableId;
}

interface SurfaceStructuralComponentPresentationInput {
  readonly componentId: string;
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceContentHash: string;
  readonly anchored: true;
  readonly bodyId: null;
  readonly meshArtifactId: string;
}

interface SurfaceStructuralComponentPresentation
  extends Omit<
    SurfaceStructuralComponentPresentationInput,
    "componentId" | "objectId" | "bodyId" | "meshArtifactId"
  > {
  readonly componentId: SurfaceStableId;
  readonly objectId: SurfaceStableId;
  readonly anchored: true;
  readonly bodyId: null;
  readonly meshArtifactId: SurfaceStableId;
}

export interface SurfaceStructuralBodySourceSnapshotInput {
  readonly componentId: string;
  readonly sourceFragmentId: string;
  readonly bodyId: string;
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceContentHash: string;
  readonly colliderRevision: number;
  readonly meshArtifactId: string;
}

export interface SurfaceStructuralBodySourceSnapshot
  extends Omit<
    SurfaceStructuralBodySourceSnapshotInput,
    "componentId" | "sourceFragmentId" | "bodyId" | "objectId" | "meshArtifactId"
  > {
  readonly componentId: SurfaceStableId;
  readonly sourceFragmentId: SurfaceStableId;
  readonly bodyId: SurfaceStableId;
  readonly objectId: SurfaceStableId;
  readonly meshArtifactId: SurfaceStableId;
}

export interface SurfaceStructuralPresentationSnapshotInput {
  readonly bodyId: string;
  readonly regionId: string;
  readonly surfaceFrameId: string;
  readonly regionRevision: number;
  readonly objects: readonly SurfaceStructuralObjectPresentationInput[];
  readonly components: readonly SurfaceStructuralComponentPresentationInput[];
  readonly bodySources: readonly SurfaceStructuralBodySourceSnapshotInput[];
  readonly dynamicBodies: readonly SurfaceDynamicBodySnapshotInput[];
  readonly latestTransition: SurfaceStructuralTransitionSnapshotInput | null;
  readonly physicsFailure: SurfacePhysicsFailureSnapshotInput | null;
  readonly simulationTick: number;
}

export interface SurfaceStructuralPresentationSnapshot
  extends Omit<
    SurfaceStructuralPresentationSnapshotInput,
    | "bodyId"
    | "regionId"
    | "surfaceFrameId"
    | "objects"
    | "components"
    | "bodySources"
    | "dynamicBodies"
    | "latestTransition"
    | "physicsFailure"
  > {
  readonly bodyId: SurfaceBodyId;
  readonly regionId: SurfaceRegionId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly objects: readonly SurfaceStructuralObjectPresentation[];
  readonly components: readonly SurfaceStructuralComponentPresentation[];
  readonly bodySources: readonly SurfaceStructuralBodySourceSnapshot[];
  readonly dynamicBodies: readonly SurfaceDynamicBodySnapshot[];
  readonly latestTransition: SurfaceStructuralTransitionSnapshot | null;
  readonly physicsFailure: SurfacePhysicsFailureSnapshot | null;
}

const ensureCanonicalFactOrder = (
  values: readonly Readonly<{ readonly id: SurfaceStableId }>[] ,
  path: string
): void => {
  for (let index = 1; index < values.length; index += 1) {
    if (compareCanonicalCodeUnits(values[index - 1].id, values[index].id) >= 0) {
      return fail("InvalidArray", path, "must contain unique facts in canonical stable-ID order.");
    }
  }
};

export const createSurfaceStructuralPresentationSnapshot = (
  input: SurfaceStructuralPresentationSnapshotInput
): Readonly<SurfaceStructuralPresentationSnapshot> => {
  requirePlainDataRecord(input, "structuralPresentation");
  const objects = denseArray(input.objects, "structuralPresentation.objects", 128)
    .map((rawObject, index): SurfaceStructuralObjectPresentation => {
      const object = rawObject as SurfaceStructuralObjectPresentationInput;
      const path = `structuralPresentation.objects.${index}`;
      requirePlainDataRecord(object, path);
      return canonicalCloneAndDeepFreeze({
        objectId: stableId(object.objectId, `${path}.objectId`),
        treeInstanceId: stableId(object.treeInstanceId, `${path}.treeInstanceId`),
        speciesId: stableId(object.speciesId, `${path}.speciesId`),
        objectRevision: safeNonNegativeInteger(
          object.objectRevision,
          `${path}.objectRevision`,
          "InvalidRevision"
        ),
        editRevision: safeNonNegativeInteger(
          object.editRevision,
          `${path}.editRevision`,
          "InvalidRevision"
        ),
        contentHash: structuralContentHash(object.contentHash, `${path}.contentHash`),
        componentIds: orderedStableIds(object.componentIds, `${path}.componentIds`, 128),
        meshArtifactId: stableId(object.meshArtifactId, `${path}.meshArtifactId`)
      });
    });
  ensureCanonicalFactOrder(
    objects.map((object) => ({ id: object.objectId })),
    "structuralPresentation.objects"
  );

  const components = denseArray(input.components, "structuralPresentation.components", 128)
    .map((rawComponent, index): SurfaceStructuralComponentPresentation => {
      const component = rawComponent as SurfaceStructuralComponentPresentationInput;
      const path = `structuralPresentation.components.${index}`;
      requirePlainDataRecord(component, path);
      const anchored = booleanValue(component.anchored, `${path}.anchored`);
      if (!anchored || component.bodyId !== null) {
        return fail(
          "InvalidRecord",
          path,
          "current Structural components must be anchored and have bodyId null."
        );
      }
      return canonicalCloneAndDeepFreeze({
        componentId: stableId(component.componentId, `${path}.componentId`),
        objectId: stableId(component.objectId, `${path}.objectId`),
        sourceObjectRevision: safeNonNegativeInteger(
          component.sourceObjectRevision,
          `${path}.sourceObjectRevision`,
          "InvalidRevision"
        ),
        sourceContentHash: structuralContentHash(
          component.sourceContentHash,
          `${path}.sourceContentHash`
        ),
        anchored: true as const,
        bodyId: null,
        meshArtifactId: stableId(component.meshArtifactId, `${path}.meshArtifactId`)
      });
    });
  ensureCanonicalFactOrder(
    components.map((component) => ({ id: component.componentId })),
    "structuralPresentation.components"
  );

  const bodySources = denseArray(input.bodySources, "structuralPresentation.bodySources", 8)
    .map((rawBodySource, index): SurfaceStructuralBodySourceSnapshot => {
      const bodySource = rawBodySource as SurfaceStructuralBodySourceSnapshotInput;
      const path = `structuralPresentation.bodySources.${index}`;
      requirePlainDataRecord(bodySource, path);
      return canonicalCloneAndDeepFreeze({
        componentId: stableId(bodySource.componentId, `${path}.componentId`),
        sourceFragmentId: stableId(bodySource.sourceFragmentId, `${path}.sourceFragmentId`),
        bodyId: stableId(bodySource.bodyId, `${path}.bodyId`),
        objectId: stableId(bodySource.objectId, `${path}.objectId`),
        sourceObjectRevision: safeNonNegativeInteger(
          bodySource.sourceObjectRevision,
          `${path}.sourceObjectRevision`,
          "InvalidRevision"
        ),
        sourceContentHash: structuralContentHash(
          bodySource.sourceContentHash,
          `${path}.sourceContentHash`
        ),
        colliderRevision: safeNonNegativeInteger(
          bodySource.colliderRevision,
          `${path}.colliderRevision`,
          "InvalidRevision"
        ),
        meshArtifactId: stableId(bodySource.meshArtifactId, `${path}.meshArtifactId`)
      });
    });
  ensureCanonicalFactOrder(
    bodySources.map((bodySource) => ({ id: bodySource.componentId })),
    "structuralPresentation.bodySources"
  );

  const dynamicBodies = denseArray(input.dynamicBodies, "structuralPresentation.dynamicBodies", 8)
    .map((body) => createSurfaceDynamicBodySnapshot(body as SurfaceDynamicBodySnapshotInput));
  ensureCanonicalFactOrder(
    dynamicBodies.map((body) => ({ id: body.bodyId })),
    "structuralPresentation.dynamicBodies"
  );

  const objectById = new Map(objects.map((object) => [object.objectId, object] as const));
  const componentById = new Map(components.map((component) => [component.componentId, component] as const));
  const bodySourceByComponentId = new Map(
    bodySources.map((bodySource) => [bodySource.componentId, bodySource] as const)
  );
  const bodySourceByBodyId = new Map(
    bodySources.map((bodySource) => [bodySource.bodyId, bodySource] as const)
  );
  const bodyById = new Map(dynamicBodies.map((body) => [body.bodyId, body] as const));

  for (const object of objects) {
    const actualComponentIds = components
      .filter((component) => component.objectId === object.objectId)
      .map((component) => component.componentId);
    if (
      actualComponentIds.length !== object.componentIds.length
      || actualComponentIds.some((componentId, index) => componentId !== object.componentIds[index])
    ) {
      return fail(
        "InvalidArray",
        "structuralPresentation.objects",
        `componentIds must exactly bind the published components for ${object.objectId}.`
      );
    }
  }

  for (const component of components) {
    const object = objectById.get(component.objectId);
    if (object === undefined) {
      return fail(
        "InvalidIdentity",
        "structuralPresentation.components",
        `component ${component.componentId} references an unpublished object.`
      );
    }
    if (
      component.sourceObjectRevision !== object.objectRevision
      || component.sourceContentHash !== object.contentHash
    ) {
      return fail(
        "InvalidRevision",
        "structuralPresentation.components",
        `component ${component.componentId} must bind the published object revision and content hash.`
      );
    }
  }

  const seenBodyIds = new Set<SurfaceStableId>();
  const seenSourceFragmentIds = new Set<SurfaceStableId>();
  for (const bodySource of bodySources) {
    const object = objectById.get(bodySource.objectId);
    if (
      object === undefined
      || bodySource.sourceObjectRevision >= object.objectRevision
      || componentById.has(bodySource.componentId)
      || seenBodyIds.has(bodySource.bodyId)
      || seenSourceFragmentIds.has(bodySource.sourceFragmentId)
    ) {
      return fail(
        "InvalidRevision",
        "structuralPresentation.bodySources",
        `body source ${bodySource.componentId} must be unique, historical and separate from current components.`
      );
    }
    seenBodyIds.add(bodySource.bodyId);
    seenSourceFragmentIds.add(bodySource.sourceFragmentId);
  }

  for (const body of dynamicBodies) {
    const bodySource = bodySourceByComponentId.get(body.componentId);
    if (
      bodySource === undefined
      || bodySource.bodyId !== body.bodyId
      || bodySource.objectId !== body.objectId
      || bodySource.sourceObjectRevision !== body.sourceObjectRevision
      || bodySource.sourceContentHash !== body.sourceContentHash
      || bodySource.colliderRevision !== body.colliderRevision
    ) {
      return fail(
        "InvalidRevision",
        "structuralPresentation.dynamicBodies",
        `body ${body.bodyId} must exactly bind one historical body source.`
      );
    }
  }
  for (const bodySource of bodySources) {
    const body = bodyById.get(bodySource.bodyId);
    if (
      body === undefined
      || body.componentId !== bodySource.componentId
      || bodySourceByBodyId.get(body.bodyId)?.componentId !== body.componentId
    ) {
      return fail(
        "InvalidIdentity",
        "structuralPresentation.bodySources",
        `body source ${bodySource.componentId} must lifecycle-bind exactly one Dynamic Body.`
      );
    }
  }

  const latestTransition = input.latestTransition === null
    ? null
    : createSurfaceStructuralTransitionSnapshot(input.latestTransition);
  if (latestTransition !== null) {
    const object = objectById.get(latestTransition.objectId);
    if (object === undefined) {
      return fail(
        "InvalidIdentity",
        "structuralPresentation.latestTransition.objectId",
        "must reference a published Structural object."
      );
    }
    const transitionRevision = latestTransition.status === "Rejected"
      ? latestTransition.currentObjectRevision
      : latestTransition.authorityTransfer?.resultingObjectRevision
        ?? latestTransition.resultingObjectRevision;
    const transitionEditRevision = latestTransition.status === "Rejected"
      ? latestTransition.currentEditRevision
      : latestTransition.authorityTransfer?.resultingEditRevision
        ?? latestTransition.resultingEditRevision;
    const transitionHash = latestTransition.status === "Rejected"
      ? latestTransition.currentContentHash
      : latestTransition.authorityTransfer?.resultingContentHash
        ?? latestTransition.resultingContentHash;
    if (
      transitionRevision !== object.objectRevision
      || transitionEditRevision !== object.editRevision
      || transitionHash !== object.contentHash
    ) {
      return fail(
        "InvalidRevision",
        "structuralPresentation.latestTransition",
        "must bind the published object revision, edit revision and content hash."
      );
    }
    if (latestTransition.status !== "Rejected") {
      const objectComponents = components.filter((component) => component.objectId === object.objectId);
      const newBodySources = bodySources.filter((bodySource) =>
        bodySource.objectId === object.objectId
        && bodySource.sourceObjectRevision === latestTransition.resultingObjectRevision
        && bodySource.sourceContentHash === latestTransition.resultingContentHash
      );
      if (
        (latestTransition.supportResult === "Anchored"
          && (objectComponents.length === 0 || newBodySources.length !== 0))
        || (latestTransition.supportResult === "Empty" && objectComponents.length !== 0)
        || (latestTransition.supportResult === "Empty" && newBodySources.length !== 0)
      ) {
        return fail(
          "InvalidRecord",
          "structuralPresentation.latestTransition.supportResult",
          "must match the published Structural component support facts."
        );
      }
      if (latestTransition.supportResult === "Detached") {
        const transfer = latestTransition.authorityTransfer;
        if (transfer === null) {
          return fail(
            "InvalidRecord",
            "structuralPresentation.latestTransition.authorityTransfer",
            "Detached presentation requires its chained authority transfer."
          );
        }
        const componentIds = newBodySources.map((bodySource) => bodySource.componentId);
        const fragmentIds = [...newBodySources]
          .map((bodySource) => bodySource.sourceFragmentId)
          .sort(compareCanonicalCodeUnits);
        if (
          componentIds.length !== latestTransition.detachedComponentIds.length
          || componentIds.some((componentId, index) =>
            componentId !== latestTransition.detachedComponentIds[index]
          )
          || fragmentIds.length !== transfer.sourceFragmentIds.length
          || fragmentIds.some((fragmentId, index) => fragmentId !== transfer.sourceFragmentIds[index])
        ) {
          return fail(
            "InvalidIdentity",
            "structuralPresentation.bodySources",
            "Detached transition Component and source Fragment IDs must exactly bind its new body sources."
          );
        }
      }
    }
  }

  return canonicalCloneAndDeepFreeze({
    bodyId: stableId(input.bodyId, "structuralPresentation.bodyId"),
    regionId: stableId(input.regionId, "structuralPresentation.regionId"),
    surfaceFrameId: stableId(input.surfaceFrameId, "structuralPresentation.surfaceFrameId"),
    regionRevision: safeNonNegativeInteger(
      input.regionRevision,
      "structuralPresentation.regionRevision",
      "InvalidRevision"
    ),
    objects,
    components,
    bodySources,
    dynamicBodies,
    latestTransition,
    physicsFailure: input.physicsFailure === null
      ? null
      : createSurfacePhysicsFailureSnapshot(input.physicsFailure),
    simulationTick: safeNonNegativeInteger(
      input.simulationTick,
      "structuralPresentation.simulationTick",
      "InvalidTick"
    )
  });
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
  readonly weaponReadiness: SurfaceWeaponReadinessInput;
  readonly targetCondition: "None" | "Operational" | "Damaged" | "Disabled" | "Destroyed";
  readonly structuralPreparation?: Readonly<{
    readonly status: "Queued" | "Running" | "ReadyToAdopt";
    readonly objectId: string;
    readonly queueDepth: number;
    readonly inFlight: number;
    readonly latencyMilliseconds: number;
  }> | null;
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
    weaponReadiness: weaponReadiness(input.weaponReadiness, "hud.weaponReadiness"),
    targetCondition: enumValue(input.targetCondition, ["None", "Operational", "Damaged", "Disabled", "Destroyed"] as const, "hud.targetCondition"),
    ...(input.structuralPreparation === undefined
      ? {}
      : { structuralPreparation: input.structuralPreparation === null
        ? null
        : {
          status: enumValue(
            input.structuralPreparation.status,
            ["Queued", "Running", "ReadyToAdopt"] as const,
            "hud.structuralPreparation.status"
          ),
          objectId: stableId(input.structuralPreparation.objectId, "hud.structuralPreparation.objectId"),
          queueDepth: safeNonNegativeInteger(
            input.structuralPreparation.queueDepth,
            "hud.structuralPreparation.queueDepth",
            "InvalidNumber"
          ),
          inFlight: safeNonNegativeInteger(
            input.structuralPreparation.inFlight,
            "hud.structuralPreparation.inFlight",
            "InvalidNumber"
          ),
          latencyMilliseconds: nonNegative(
            input.structuralPreparation.latencyMilliseconds,
            "hud.structuralPreparation.latencyMilliseconds"
          )
          }
      }),
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
  readonly kind: "Target" | "Terrain" | "Structural";
  readonly simulationTick: number;
}

export interface SurfaceImpactPresentationSnapshotInput {
  readonly impactId: string;
  readonly surfaceFrameId: string;
  readonly positionMeters: SpatialVector3;
  readonly normal: SpatialVector3;
  readonly kind: "Target" | "Terrain" | "Structural";
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
    kind: enumValue(input.kind, ["Target", "Terrain", "Structural"] as const, "impactPresentation.kind"),
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
export interface SurfaceStructuralPresentationPort {
  presentStructural(snapshot: Readonly<SurfaceStructuralPresentationSnapshot>): void;
}

export interface SurfacePlayPresentationPorts
  extends SurfacePlayerPresentationPort,
    SurfaceTerrainPresentationPort,
    SurfaceTargetPresentationPort,
    SurfaceWeaponPresentationPort,
    SurfaceImpactPresentationPort,
    SurfaceStructuralPresentationPort {}
