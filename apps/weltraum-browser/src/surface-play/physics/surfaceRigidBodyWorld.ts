import {
  createQuaternionFromAxisAngle,
  createSpatialQuaternion,
  createSpatialVector3,
  multiplySpatialQuaternions,
  rotateSpatialVector,
  spatialVector3
} from "../../spatial/quaternion";
import type { SpatialQuaternion, SpatialVector3 } from "../../spatial/types";
import {
  canonicalAdaptiveJson,
  requireExactKeys,
  requirePlainRecord
} from "../../voxel/adaptive";
import {
  createSurfaceDynamicBodySnapshot,
  createSurfacePhysicsFailureSnapshot,
  type SurfaceDynamicBodySnapshot,
  type SurfacePhysicsFailureSnapshot
} from "../contracts";
import {
  SURFACE_RIGID_BODY_MAX_BODIES,
  SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY,
  validateSurfaceRigidBodyColliderRepresentation,
  type SurfaceRigidBodyCandidate,
  type SurfaceRigidBodyColliderBox,
  type SurfaceRigidBodyColliderRepresentation
} from "./surfaceRigidBody";

export const SURFACE_RIGID_BODY_TICK_SECONDS = 1 / 60;
export const SURFACE_RIGID_BODY_MAX_CONTACTS_PER_TICK = 256 as const;
export const SURFACE_RIGID_BODY_MAX_SUBSTEPS = 4 as const;
export const SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS = 0.0625 as const;
export const SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS = Math.PI / 90;
const maximumSpeedForSubstepLimit = (maximumPerSubstep: number): number =>
  maximumPerSubstep / SURFACE_RIGID_BODY_TICK_SECONDS;
const SURFACE_RIGID_BODY_MAX_LINEAR_SPEED_METERS_PER_SECOND =
  SURFACE_RIGID_BODY_MAX_SUBSTEPS
  * maximumSpeedForSubstepLimit(SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS);
const SURFACE_RIGID_BODY_MAX_ANGULAR_SPEED_RADIANS_PER_SECOND =
  SURFACE_RIGID_BODY_MAX_SUBSTEPS
  * maximumSpeedForSubstepLimit(SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS);
export const SURFACE_RIGID_BODY_SOLVER_ITERATIONS = 8 as const;
export const SURFACE_RIGID_BODY_FRICTION = 0.65 as const;
export const SURFACE_RIGID_BODY_BAUMGARTE = 0.2 as const;
export const SURFACE_RIGID_BODY_PENETRATION_SLOP_METERS = 0.005 as const;
export const SURFACE_RIGID_BODY_REST_SPEED = 0.05 as const;
export const SURFACE_RIGID_BODY_REST_TICKS = 120 as const;
export const SURFACE_RIGID_BODY_CAPSULE_SEPARATION_MAX_ITERATIONS = 16 as const;

export interface SurfaceRigidBodyTerrainColliderInput {
  readonly colliderKey: string;
  readonly minimumMeters: SpatialVector3;
  readonly maximumMeters: SpatialVector3;
}

export interface SurfaceRigidBodyTerrainCollider extends SurfaceRigidBodyTerrainColliderInput {}

export interface SurfaceRigidBodyState {
  readonly bodyId: string;
  readonly componentId: string;
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceContentHash: string;
  readonly massKg: number;
  readonly inverseMassPerKg: number;
  readonly inverseInertiaTensorPerKgMetersSquared: SurfaceRigidBodyCandidate["inverseInertiaTensorPerKgMetersSquared"];
  readonly colliders: readonly SurfaceRigidBodyColliderBox[];
  readonly colliderRepresentation: Readonly<SurfaceRigidBodyColliderRepresentation>;
  readonly colliderRevision: number;
  readonly activationSimulationTick: number;
  readonly lifecycle: "Falling" | "Resting";
  readonly restingTicks: number;
  readonly positionMeters: SpatialVector3;
  readonly orientation: SpatialQuaternion;
  readonly linearVelocityMetersPerSecond: SpatialVector3;
  readonly angularVelocityRadiansPerSecond: SpatialVector3;
  readonly simulationTick: number;
}

export interface SurfaceRigidBodyWorld {
  readonly simulationTick: number;
  readonly gravityMetersPerSecondSquared: number;
  readonly terrainColliders: readonly SurfaceRigidBodyTerrainCollider[];
  readonly bodies: readonly SurfaceRigidBodyState[];
  readonly physicsFailure: SurfacePhysicsFailureSnapshot | null;
}

export type SurfaceRigidBodyAdmission =
  | Readonly<{ readonly status: "Admitted"; readonly world: Readonly<SurfaceRigidBodyWorld>; readonly bodyIds: readonly string[] }>
  | Readonly<{
      readonly status: "Rejected";
      readonly world: Readonly<SurfaceRigidBodyWorld>;
      readonly code: "BodyCapacityExceeded" | "ColliderBudgetExceeded";
    }>;

export type SurfaceRigidBodyStep =
  | Readonly<{ readonly status: "Advanced"; readonly world: Readonly<SurfaceRigidBodyWorld> }>
  | Readonly<{
      readonly status: "Failed";
      readonly world: Readonly<SurfaceRigidBodyWorld>;
      readonly failure: SurfacePhysicsFailureSnapshot;
    }>;

export type SurfaceRigidBodyStepDiagnosticStage =
  | "LatchedFailure"
  | "PreStepValidation"
  | "MotionBudget"
  | "Integration"
  | "ContactGeneration"
  | "ContactBudget"
  | "ContactSolve"
  | "PostSolveValidation"
  | "Advanced";

export interface SurfaceRigidBodyStepNonFiniteFieldDiagnostic {
  readonly bodyId: string;
  readonly path: string;
  readonly value: number;
}

export interface SurfaceRigidBodyStepCaughtErrorDiagnostic {
  readonly name: "TypeError" | "RangeError";
  readonly message: string;
}

export interface SurfaceRigidBodyStepBodyDiagnostics {
  readonly bodyId: string;
  readonly componentId: string;
  readonly objectId: string;
  readonly active: boolean;
  readonly sourceObjectRevision: number;
  readonly sourceContentHash: string;
  readonly colliderRevision: number;
  readonly colliderCount: number;
  readonly activationSimulationTick: number;
  readonly lifecycle: "Falling" | "Resting";
  readonly positionMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  readonly orientation: Readonly<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
  }>;
  readonly linearVelocityMetersPerSecond: Readonly<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }>;
  readonly angularVelocityRadiansPerSecond: Readonly<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }>;
  readonly positionFinite: boolean;
  readonly orientationFinite: boolean;
  readonly poseFinite: boolean;
  readonly linearVelocityFinite: boolean;
  readonly angularVelocityFinite: boolean;
  readonly predictedNextTickLinearSpeedMetersPerSecond: number | null;
  readonly angularSpeedRadiansPerSecond: number | null;
  readonly requiredTranslationSubsteps: number | null;
  readonly requiredRotationSubsteps: number | null;
  readonly requiredMotionSubsteps: number | null;
}

export interface SurfaceRigidBodyStepDiagnostics {
  readonly sourceSimulationTick: number;
  readonly attemptedSimulationTick: number;
  readonly outcome: "Advanced" | "Failed";
  readonly stage: SurfaceRigidBodyStepDiagnosticStage;
  readonly failureCode: SurfacePhysicsFailureSnapshot["code"] | null;
  readonly selectedSubsteps: number | null;
  readonly completedSubsteps: number;
  readonly contactsPerSubstep: readonly number[];
  readonly cumulativeContactCount: number;
  readonly activeBodyIds: readonly string[];
  readonly bodies: readonly Readonly<SurfaceRigidBodyStepBodyDiagnostics>[];
  readonly firstNonFiniteField: Readonly<SurfaceRigidBodyStepNonFiniteFieldDiagnostic> | null;
  readonly caughtError: Readonly<SurfaceRigidBodyStepCaughtErrorDiagnostic> | null;
}

export interface SurfaceRigidBodyRayQuery {
  readonly originMeters: SpatialVector3;
  readonly direction: SpatialVector3;
  readonly maximumDistanceMeters: number;
}

export interface SurfaceRigidBodyRayHit {
  readonly bodyId: string;
  readonly componentId: string;
  readonly colliderIndex: number;
  readonly pointMeters: SpatialVector3;
  readonly normal: SpatialVector3;
  readonly distanceMeters: number;
}

export type SurfaceRigidBodyRayResult =
  | Readonly<{ readonly status: "Miss"; readonly hit: null }>
  | Readonly<{ readonly status: "Hit"; readonly hit: Readonly<SurfaceRigidBodyRayHit> }>;

export interface SurfaceRigidBodyCapsule {
  readonly radiusMeters: number;
  readonly heightMeters: number;
}

export interface SurfaceRigidBodyCapsuleSweepQuery {
  readonly capsule: SurfaceRigidBodyCapsule;
  readonly startPositionMeters: SpatialVector3;
  readonly displacementMeters: SpatialVector3;
}

export interface SurfaceRigidBodyCapsuleSweepHit {
  readonly bodyId: string;
  readonly componentId: string;
  readonly colliderIndex: number;
  readonly pointMeters: SpatialVector3;
  readonly normal: SpatialVector3;
  readonly fraction: number;
  readonly distanceMeters: number;
}

export interface SurfaceRigidBodyGroundContactQuery {
  readonly capsule: SurfaceRigidBodyCapsule;
  readonly positionMeters: SpatialVector3;
  readonly maximumDistanceMeters: number;
}

export interface SurfaceRigidBodyCapsuleSeparationQuery {
  readonly capsule: SurfaceRigidBodyCapsule;
  readonly positionMeters: SpatialVector3;
  readonly skinMeters: number;
}

export interface SurfaceRigidBodyCapsuleSeparationContact {
  readonly bodyId: string;
  readonly componentId: string;
  readonly colliderIndex: number;
  readonly normal: SpatialVector3;
  readonly correctionDistanceMeters: number;
}

export interface SurfaceRigidBodyCapsuleSeparationResult {
  readonly status: "Clear" | "Separated" | "Blocked";
  readonly positionMeters: SpatialVector3;
  readonly iterations: number;
  readonly contacts: readonly Readonly<SurfaceRigidBodyCapsuleSeparationContact>[];
}

export type SurfaceRigidBodyCapsuleSweepResult =
  | Readonly<{ readonly status: "Miss"; readonly fraction: 1; readonly hit: null }>
  | Readonly<{
      readonly status: "Hit";
      readonly fraction: number;
      readonly hit: Readonly<SurfaceRigidBodyCapsuleSweepHit>;
    }>;

interface MutableVector {
  x: number;
  y: number;
  z: number;
}

interface MutableBody {
  readonly bodyId: string;
  readonly componentId: string;
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceContentHash: string;
  readonly massKg: number;
  readonly inverseMassPerKg: number;
  readonly inverseInertiaTensorPerKgMetersSquared: SurfaceRigidBodyCandidate["inverseInertiaTensorPerKgMetersSquared"];
  readonly colliders: readonly SurfaceRigidBodyColliderBox[];
  readonly colliderRepresentation: Readonly<SurfaceRigidBodyColliderRepresentation>;
  readonly colliderRevision: number;
  readonly activationSimulationTick: number;
  lifecycle: "Falling" | "Resting";
  restingTicks: number;
  positionMeters: MutableVector;
  orientation: SpatialQuaternion;
  linearVelocityMetersPerSecond: MutableVector;
  angularVelocityRadiansPerSecond: MutableVector;
  simulationTick: number;
}

interface OrientedBox {
  readonly center: MutableVector;
  readonly axes: readonly [MutableVector, MutableVector, MutableVector];
  readonly halfExtents: readonly [number, number, number];
  readonly minimumAabb: MutableVector;
  readonly maximumAabb: MutableVector;
}

interface SurfaceRigidBodyTerrainBroadphaseStats {
  readonly terrainColliderCount: number;
  readonly bodyColliderQueryCount: number;
  readonly bruteForcePairCount: number;
  readonly candidatePairCount: number;
  readonly aabbOverlapCount: number;
  readonly terrainBoxPreparationCount: number;
  readonly bucketCount: number;
}

interface MutableSurfaceRigidBodyTerrainBroadphaseStats {
  terrainColliderCount: number;
  bodyColliderQueryCount: number;
  bruteForcePairCount: number;
  candidatePairCount: number;
  aabbOverlapCount: number;
  terrainBoxPreparationCount: number;
  bucketCount: number;
}

interface SurfaceRigidBodyTerrainBroadphaseEntry {
  readonly canonicalIndex: number;
  readonly box: OrientedBox;
}

interface SurfaceRigidBodyTerrainBroadphaseIndex {
  readonly entries: readonly SurfaceRigidBodyTerrainBroadphaseEntry[];
  readonly buckets: ReadonlyMap<string, readonly number[]>;
  readonly overflowCanonicalIndices: readonly number[];
}

interface Contact {
  readonly bodyA: MutableBody;
  readonly bodyB: MutableBody | null;
  readonly normalFromBToA: MutableVector;
  readonly pointMeters: MutableVector;
  readonly penetrationMeters: number;
  accumulatedNormalImpulse: number;
  accumulatedTangentImpulse: number;
}

const finite = (value: number, name: string): number => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite.`);
  return Object.is(value, -0) ? 0 : value;
};

const simulationTick = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("simulationTick must be a non-negative safe integer.");
  return value;
};

const copyVector = (value: SpatialVector3): MutableVector => ({ x: value.x, y: value.y, z: value.z });
const frozenVector = (value: MutableVector): SpatialVector3 => createSpatialVector3(value);
const add = (left: MutableVector, right: MutableVector): MutableVector => ({ x: left.x + right.x, y: left.y + right.y, z: left.z + right.z });
const subtract = (left: MutableVector, right: MutableVector): MutableVector => ({ x: left.x - right.x, y: left.y - right.y, z: left.z - right.z });
const scale = (value: MutableVector, factor: number): MutableVector => ({ x: value.x * factor, y: value.y * factor, z: value.z * factor });
const dot = (left: MutableVector, right: MutableVector): number => left.x * right.x + left.y * right.y + left.z * right.z;
const cross = (left: MutableVector, right: MutableVector): MutableVector => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x
});
const magnitude = (value: MutableVector): number => Math.hypot(value.x, value.y, value.z);
const requiredSubstepsForMagnitude = (
  value: number,
  maximumPerSubstep: number
): number => Math.ceil(value / maximumSpeedForSubstepLimit(maximumPerSubstep));
const predictedLinearVelocityForNextTick = (
  body: Pick<MutableBody, "lifecycle" | "linearVelocityMetersPerSecond">,
  gravityMetersPerSecondSquared: number
): MutableVector => ({
  x: body.linearVelocityMetersPerSecond.x,
  y: body.linearVelocityMetersPerSecond.y - (
    body.lifecycle === "Resting" ? 0 : gravityMetersPerSecondSquared * SURFACE_RIGID_BODY_TICK_SECONDS
  ),
  z: body.linearVelocityMetersPerSecond.z
});
const predictedNextTickLinearSpeed = (
  body: Pick<MutableBody, "lifecycle" | "linearVelocityMetersPerSecond">,
  gravityMetersPerSecondSquared: number
): number => magnitude(predictedLinearVelocityForNextTick(body, gravityMetersPerSecondSquared));

const angularSpeed = (
  body: Pick<MutableBody, "angularVelocityRadiansPerSecond">
): number => magnitude(body.angularVelocityRadiansPerSecond);

const requiredTranslationSubsteps = (
  body: Pick<MutableBody, "lifecycle" | "linearVelocityMetersPerSecond">,
  gravityMetersPerSecondSquared: number
): number => requiredSubstepsForMagnitude(
  predictedNextTickLinearSpeed(body, gravityMetersPerSecondSquared),
  SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS
);

const requiredRotationSubsteps = (
  body: Pick<MutableBody, "angularVelocityRadiansPerSecond">
): number => requiredSubstepsForMagnitude(
  angularSpeed(body),
  SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS
);

const requiredMotionSubsteps = (
  body: Pick<MutableBody, "lifecycle" | "linearVelocityMetersPerSecond" | "angularVelocityRadiansPerSecond">,
  gravityMetersPerSecondSquared: number
): number => Math.max(
  1,
  requiredTranslationSubsteps(body, gravityMetersPerSecondSquared),
  requiredRotationSubsteps(body)
);
const checkedTerrain = (input: SurfaceRigidBodyTerrainColliderInput): SurfaceRigidBodyTerrainCollider => {
  if (typeof input.colliderKey !== "string" || input.colliderKey.length === 0 || input.colliderKey.trim() !== input.colliderKey) {
    throw new TypeError("terrain colliderKey must be a non-empty stable value.");
  }
  const minimumMeters = createSpatialVector3(input.minimumMeters, "/minimumMeters");
  const maximumMeters = createSpatialVector3(input.maximumMeters, "/maximumMeters");
  if (maximumMeters.x <= minimumMeters.x || maximumMeters.y <= minimumMeters.y || maximumMeters.z <= minimumMeters.z) {
    throw new TypeError("terrain collider bounds must have positive volume.");
  }
  return Object.freeze({ colliderKey: input.colliderKey, minimumMeters, maximumMeters });
};

const checkedTerrainColliders = (
  inputs: readonly SurfaceRigidBodyTerrainColliderInput[]
): readonly SurfaceRigidBodyTerrainCollider[] => {
  const colliders = inputs.map(checkedTerrain).sort((left, right) =>
    compareCodeUnits(left.colliderKey, right.colliderKey));
  for (let index = 1; index < colliders.length; index += 1) {
    if (colliders[index - 1].colliderKey === colliders[index].colliderKey) {
      throw new TypeError("terrain collider keys must be unique.");
    }
  }
  return Object.freeze(colliders);
};

const freezeBody = (body: MutableBody): Readonly<SurfaceRigidBodyState> => Object.freeze({
  bodyId: body.bodyId,
  componentId: body.componentId,
  objectId: body.objectId,
  sourceObjectRevision: body.sourceObjectRevision,
  sourceContentHash: body.sourceContentHash,
  massKg: body.massKg,
  inverseMassPerKg: body.inverseMassPerKg,
  inverseInertiaTensorPerKgMetersSquared: body.inverseInertiaTensorPerKgMetersSquared,
  colliders: body.colliders,
  colliderRepresentation: body.colliderRepresentation,
  colliderRevision: body.colliderRevision,
  activationSimulationTick: body.activationSimulationTick,
  lifecycle: body.lifecycle,
  restingTicks: body.restingTicks,
  positionMeters: frozenVector(body.positionMeters),
  orientation: createSpatialQuaternion(body.orientation),
  linearVelocityMetersPerSecond: frozenVector(body.linearVelocityMetersPerSecond),
  angularVelocityRadiansPerSecond: frozenVector(body.angularVelocityRadiansPerSecond),
  simulationTick: body.simulationTick
});

const thawBody = (body: SurfaceRigidBodyState): MutableBody => ({
  ...body,
  positionMeters: copyVector(body.positionMeters),
  orientation: body.orientation,
  linearVelocityMetersPerSecond: copyVector(body.linearVelocityMetersPerSecond),
  angularVelocityRadiansPerSecond: copyVector(body.angularVelocityRadiansPerSecond)
});

const candidateBody = (candidate: SurfaceRigidBodyCandidate, tick: number): Readonly<SurfaceRigidBodyState> =>
  freezeBody({
    bodyId: candidate.bodyId,
    componentId: candidate.componentId,
    objectId: candidate.objectId,
    sourceObjectRevision: candidate.sourceObjectRevision,
    sourceContentHash: candidate.sourceContentHash,
    massKg: candidate.massKg,
    inverseMassPerKg: candidate.inverseMassPerKg,
    inverseInertiaTensorPerKgMetersSquared: candidate.inverseInertiaTensorPerKgMetersSquared,
    colliders: candidate.colliders,
    colliderRepresentation: candidate.colliderRepresentation,
    colliderRevision: candidate.colliderRevision,
    activationSimulationTick: candidate.activationSimulationTick,
    lifecycle: "Falling",
    restingTicks: 0,
    positionMeters: copyVector(candidate.positionMeters),
    orientation: candidate.orientation,
    linearVelocityMetersPerSecond: copyVector(candidate.linearVelocityMetersPerSecond),
    angularVelocityRadiansPerSecond: copyVector(candidate.angularVelocityRadiansPerSecond),
    simulationTick: tick
  });

const freezeWorld = (input: SurfaceRigidBodyWorld): Readonly<SurfaceRigidBodyWorld> => Object.freeze({
  simulationTick: input.simulationTick,
  gravityMetersPerSecondSquared: input.gravityMetersPerSecondSquared,
  terrainColliders: input.terrainColliders,
  bodies: Object.freeze([...input.bodies].sort((left, right) => left.bodyId.localeCompare(right.bodyId))),
  physicsFailure: input.physicsFailure
});

export const createSurfaceRigidBodyWorld = (input: Readonly<{
  simulationTick: number;
  gravityMetersPerSecondSquared: number;
  terrainColliders: readonly SurfaceRigidBodyTerrainColliderInput[];
}>): Readonly<SurfaceRigidBodyWorld> => {
  const gravity = finite(input.gravityMetersPerSecondSquared, "gravityMetersPerSecondSquared");
  if (gravity < 0) throw new TypeError("gravityMetersPerSecondSquared must be non-negative.");
  const terrainColliders = checkedTerrainColliders(input.terrainColliders);
  return freezeWorld({
    simulationTick: simulationTick(input.simulationTick),
    gravityMetersPerSecondSquared: gravity,
    terrainColliders,
    bodies: Object.freeze([]),
    physicsFailure: null
  });
};

export const validateSurfaceRigidBodyWorldTransport = (
  worldValue: unknown,
  bodyValues: readonly unknown[],
  candidates: readonly Readonly<SurfaceRigidBodyCandidate>[]
): Readonly<SurfaceRigidBodyWorld> => {
  const worldRecord = requirePlainRecord(worldValue, "physicsDynamic/World");
  requireExactKeys(worldRecord, [
    "kind", "simulationTick", "gravityMetersPerSecondSquared", "terrainColliders", "physicsFailure"
  ], "physicsDynamic/World");
  if (worldRecord.kind !== "World") throw new TypeError("Dynamic Physics world record must use kind World.");
  const simulationTickValue = simulationTick(worldRecord.simulationTick as number);
  const base = createSurfaceRigidBodyWorld({
    simulationTick: simulationTickValue,
    gravityMetersPerSecondSquared: worldRecord.gravityMetersPerSecondSquared as number,
    terrainColliders: worldRecord.terrainColliders as readonly SurfaceRigidBodyTerrainColliderInput[]
  });
  if (!Array.isArray(bodyValues) || bodyValues.length !== candidates.length) {
    throw new TypeError("Dynamic Physics body records must be bijective with immutable candidates.");
  }
  const orderedCandidates = [...candidates].sort((left, right) => compareCodeUnits(left.bodyId, right.bodyId));
  const bodies = bodyValues.map((value, index): Readonly<SurfaceRigidBodyState> => {
    const path = `physicsDynamic/Body/${index}`;
    const record = requirePlainRecord(value, path);
    requireExactKeys(record, ["kind", "bodyId", "candidateInitial", "current"], path);
    if (record.kind !== "Body") throw new TypeError(`${path} must use kind Body.`);
    const candidate = orderedCandidates[index];
    if (candidate === undefined || record.bodyId !== candidate.bodyId) {
      throw new TypeError("Dynamic Physics bodies must use canonical candidate body order.");
    }
    validateSurfaceRigidBodyColliderRepresentation(candidate);
    const candidateInitial = requirePlainRecord(record.candidateInitial, `${path}/candidateInitial`);
    requireExactKeys(candidateInitial, [
      "positionMeters", "orientation", "linearVelocityMetersPerSecond", "angularVelocityRadiansPerSecond"
    ], `${path}/candidateInitial`);
    const expectedInitial = {
      positionMeters: candidate.positionMeters,
      orientation: candidate.orientation,
      linearVelocityMetersPerSecond: candidate.linearVelocityMetersPerSecond,
      angularVelocityRadiansPerSecond: candidate.angularVelocityRadiansPerSecond
    };
    if (canonicalAdaptiveJson(candidateInitial) !== canonicalAdaptiveJson(expectedInitial)) {
      throw new TypeError("Dynamic Physics candidate initial state does not bind its immutable candidate.");
    }
    const current = requirePlainRecord(record.current, `${path}/current`);
    requireExactKeys(current, [
      "lifecycle", "restingTicks", "positionMeters", "orientation", "linearVelocityMetersPerSecond",
      "angularVelocityRadiansPerSecond", "simulationTick"
    ], `${path}/current`);
    if (current.lifecycle !== "Falling" && current.lifecycle !== "Resting") {
      throw new TypeError(`${path}/current/lifecycle is unsupported.`);
    }
    const bodyTick = simulationTick(current.simulationTick as number);
    if (bodyTick !== simulationTickValue) {
      throw new TypeError("Dynamic Physics body tick must equal its World tick.");
    }
    const restingTicks = simulationTick(current.restingTicks as number);
    if ((current.lifecycle === "Falling" && restingTicks !== 0) || restingTicks > SURFACE_RIGID_BODY_REST_TICKS) {
      throw new TypeError("Dynamic Physics resting state is inconsistent.");
    }
    return freezeBody({
      bodyId: candidate.bodyId,
      componentId: candidate.componentId,
      objectId: candidate.objectId,
      sourceObjectRevision: candidate.sourceObjectRevision,
      sourceContentHash: candidate.sourceContentHash,
      massKg: candidate.massKg,
      inverseMassPerKg: candidate.inverseMassPerKg,
      inverseInertiaTensorPerKgMetersSquared: candidate.inverseInertiaTensorPerKgMetersSquared,
      colliders: candidate.colliderRepresentation.broadphaseColliders,
      colliderRepresentation: candidate.colliderRepresentation,
      colliderRevision: candidate.colliderRevision,
      activationSimulationTick: candidate.activationSimulationTick,
      lifecycle: current.lifecycle,
      restingTicks,
      positionMeters: copyVector(createSpatialVector3(current.positionMeters, `${path}/current/positionMeters`)),
      orientation: createSpatialQuaternion(current.orientation, `${path}/current/orientation`),
      linearVelocityMetersPerSecond: copyVector(createSpatialVector3(
        current.linearVelocityMetersPerSecond,
        `${path}/current/linearVelocityMetersPerSecond`
      )),
      angularVelocityRadiansPerSecond: copyVector(createSpatialVector3(
        current.angularVelocityRadiansPerSecond,
        `${path}/current/angularVelocityRadiansPerSecond`
      )),
      simulationTick: bodyTick
    });
  });
  const physicsFailure = worldRecord.physicsFailure === null
    ? null
    : createSurfacePhysicsFailureSnapshot(worldRecord.physicsFailure as Parameters<
        typeof createSurfacePhysicsFailureSnapshot
      >[0]);
  if (
    physicsFailure !== null
    && (physicsFailure.simulationTick !== simulationTickValue
      || physicsFailure.bodyIds.some((bodyId) => !bodies.some((body) => body.bodyId === bodyId)))
  ) {
    throw new TypeError("Dynamic Physics failure does not bind its World state.");
  }
  return freezeWorld({ ...base, bodies: Object.freeze(bodies), physicsFailure });
};

export const replaceSurfaceRigidBodyTerrainColliders = (
  world: Readonly<SurfaceRigidBodyWorld>,
  terrainColliders: readonly SurfaceRigidBodyTerrainColliderInput[]
): Readonly<SurfaceRigidBodyWorld> => Object.freeze({
  simulationTick: world.simulationTick,
  gravityMetersPerSecondSquared: world.gravityMetersPerSecondSquared,
  terrainColliders: checkedTerrainColliders(terrainColliders),
  bodies: world.bodies,
  physicsFailure: world.physicsFailure
});

export const admitSurfaceRigidBodyBatch = (
  world: Readonly<SurfaceRigidBodyWorld>,
  candidates: readonly Readonly<SurfaceRigidBodyCandidate>[]
): SurfaceRigidBodyAdmission => {
  if (world.physicsFailure !== null) throw new TypeError("Cannot admit bodies after a fatal Surface Physics failure.");
  const ordered = [...candidates].sort((left, right) => left.bodyId.localeCompare(right.bodyId));
  if (world.bodies.length + ordered.length > SURFACE_RIGID_BODY_MAX_BODIES) {
    return Object.freeze({ status: "Rejected", world, code: "BodyCapacityExceeded" });
  }
  for (const candidate of ordered) validateSurfaceRigidBodyColliderRepresentation(candidate);
  if (ordered.some((candidate) => candidate.colliders.length > SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY)) {
    return Object.freeze({ status: "Rejected", world, code: "ColliderBudgetExceeded" });
  }
  const ids = new Set(world.bodies.map((body) => body.bodyId));
  for (const candidate of ordered) {
    if (ids.has(candidate.bodyId)) throw new TypeError(`Duplicate rigid body ID ${candidate.bodyId}.`);
    ids.add(candidate.bodyId);
  }
  const admittedBodies = ordered.map((candidate) => candidateBody(candidate, world.simulationTick));
  const admittedWorld = freezeWorld({ ...world, bodies: Object.freeze([...world.bodies, ...admittedBodies]) });
  return Object.freeze({ status: "Admitted", world: admittedWorld, bodyIds: Object.freeze(ordered.map((candidate) => candidate.bodyId)) });
};

const orientedBox = (body: MutableBody, collider: SurfaceRigidBodyColliderBox): OrientedBox => {
  const localCenter = rotateSpatialVector(body.orientation, collider.centerMeters);
  const center = add(body.positionMeters, copyVector(localCenter));
  const axes = [
    copyVector(rotateSpatialVector(body.orientation, spatialVector3(1, 0, 0))),
    copyVector(rotateSpatialVector(body.orientation, spatialVector3(0, 1, 0))),
    copyVector(rotateSpatialVector(body.orientation, spatialVector3(0, 0, 1)))
  ] as const;
  const halfExtents = [collider.halfExtentsMeters.x, collider.halfExtentsMeters.y, collider.halfExtentsMeters.z] as const;
  const worldHalf = {
    x: Math.abs(axes[0].x) * halfExtents[0] + Math.abs(axes[1].x) * halfExtents[1] + Math.abs(axes[2].x) * halfExtents[2],
    y: Math.abs(axes[0].y) * halfExtents[0] + Math.abs(axes[1].y) * halfExtents[1] + Math.abs(axes[2].y) * halfExtents[2],
    z: Math.abs(axes[0].z) * halfExtents[0] + Math.abs(axes[1].z) * halfExtents[1] + Math.abs(axes[2].z) * halfExtents[2]
  };
  return {
    center,
    axes,
    halfExtents,
    minimumAabb: subtract(center, worldHalf),
    maximumAabb: add(center, worldHalf)
  };
};

const narrowphaseCollidersForBroadphase = (
  body: Pick<MutableBody, "colliderRepresentation"> | Pick<SurfaceRigidBodyState, "colliderRepresentation">,
  broadphaseColliderIndex: number
): readonly SurfaceRigidBodyColliderBox[] => {
  const indices = body.colliderRepresentation
    .broadphaseNarrowphaseColliderIndices[broadphaseColliderIndex];
  if (indices === undefined) throw new TypeError("Rigid-body broadphase collider mapping is unavailable.");
  return indices.map((index) => {
    const collider = body.colliderRepresentation.narrowphaseColliders[index];
    if (collider === undefined) throw new TypeError("Rigid-body narrowphase collider mapping is stale.");
    return collider;
  });
};

const terrainBox = (terrain: SurfaceRigidBodyTerrainCollider): OrientedBox => {
  const center = scale(add(copyVector(terrain.minimumMeters), copyVector(terrain.maximumMeters)), 0.5);
  const half = scale(subtract(copyVector(terrain.maximumMeters), copyVector(terrain.minimumMeters)), 0.5);
  return {
    center,
    axes: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }],
    halfExtents: [half.x, half.y, half.z],
    minimumAabb: copyVector(terrain.minimumMeters),
    maximumAabb: copyVector(terrain.maximumMeters)
  };
};

const SURFACE_RIGID_BODY_TERRAIN_BUCKET_SIZE_METERS = 1;
const SURFACE_RIGID_BODY_TERRAIN_MAX_BUCKETS_PER_RANGE = 4_096;
const surfaceRigidBodyTerrainBroadphaseIndexes =
  new WeakMap<readonly SurfaceRigidBodyTerrainCollider[], Readonly<SurfaceRigidBodyTerrainBroadphaseIndex>>();
const surfaceRigidBodyTerrainBroadphaseStats =
  new WeakMap<Readonly<SurfaceRigidBodyWorld>, Readonly<SurfaceRigidBodyTerrainBroadphaseStats>>();
const surfaceRigidBodyStepDiagnostics =
  new WeakMap<Readonly<SurfaceRigidBodyWorld>, Readonly<SurfaceRigidBodyStepDiagnostics>>();

const terrainBucketCoordinate = (meters: number): number =>
  Math.floor(meters / SURFACE_RIGID_BODY_TERRAIN_BUCKET_SIZE_METERS);

const terrainBucketKey = (x: number, z: number): string => `${x}:${z}`;

interface SurfaceRigidBodyTerrainBucketRange {
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumZ: number;
  readonly maximumZ: number;
  readonly bucketCount: number;
}

const surfaceRigidBodyTerrainBucketRange = (
  box: Pick<OrientedBox, "minimumAabb" | "maximumAabb">
): Readonly<SurfaceRigidBodyTerrainBucketRange> | null => {
  const minimumX = terrainBucketCoordinate(box.minimumAabb.x);
  const maximumX = terrainBucketCoordinate(box.maximumAabb.x);
  const minimumZ = terrainBucketCoordinate(box.minimumAabb.z);
  const maximumZ = terrainBucketCoordinate(box.maximumAabb.z);
  if (![minimumX, maximumX, minimumZ, maximumZ].every(Number.isSafeInteger)) return null;
  const spanX = maximumX - minimumX + 1;
  const spanZ = maximumZ - minimumZ + 1;
  if (!Number.isSafeInteger(spanX) || !Number.isSafeInteger(spanZ) || spanX <= 0 || spanZ <= 0) return null;
  const bucketCount = spanX * spanZ;
  if (!Number.isSafeInteger(bucketCount) || bucketCount > SURFACE_RIGID_BODY_TERRAIN_MAX_BUCKETS_PER_RANGE) {
    return null;
  }
  return Object.freeze({ minimumX, maximumX, minimumZ, maximumZ, bucketCount });
};

const createSurfaceRigidBodyTerrainBroadphaseIndex = (
  terrainColliders: readonly SurfaceRigidBodyTerrainCollider[]
): Readonly<SurfaceRigidBodyTerrainBroadphaseIndex> => {
  const mutableBuckets = new Map<string, number[]>();
  const overflowCanonicalIndices: number[] = [];
  const entries = terrainColliders.map((terrain, canonicalIndex) => {
    const box = terrainBox(terrain);
    const range = surfaceRigidBodyTerrainBucketRange(box);
    if (range === null) {
      overflowCanonicalIndices.push(canonicalIndex);
    } else {
      for (let bucketX = range.minimumX; bucketX <= range.maximumX; bucketX += 1) {
        for (let bucketZ = range.minimumZ; bucketZ <= range.maximumZ; bucketZ += 1) {
          const key = terrainBucketKey(bucketX, bucketZ);
          const bucket = mutableBuckets.get(key);
          if (bucket === undefined) mutableBuckets.set(key, [canonicalIndex]);
          else bucket.push(canonicalIndex);
        }
      }
    }
    return Object.freeze({ canonicalIndex, box: Object.freeze(box) });
  });
  const buckets = new Map<string, readonly number[]>();
  for (const [key, indices] of mutableBuckets) buckets.set(key, Object.freeze(indices));
  return Object.freeze({
    entries: Object.freeze(entries),
    buckets,
    overflowCanonicalIndices: Object.freeze(overflowCanonicalIndices)
  });
};

const surfaceRigidBodyTerrainBroadphaseIndex = (
  terrainColliders: readonly SurfaceRigidBodyTerrainCollider[]
): Readonly<{
  readonly index: Readonly<SurfaceRigidBodyTerrainBroadphaseIndex>;
  readonly terrainBoxPreparationCount: number;
}> => {
  const cached = surfaceRigidBodyTerrainBroadphaseIndexes.get(terrainColliders);
  if (cached !== undefined) return Object.freeze({ index: cached, terrainBoxPreparationCount: 0 });
  const created = createSurfaceRigidBodyTerrainBroadphaseIndex(terrainColliders);
  surfaceRigidBodyTerrainBroadphaseIndexes.set(terrainColliders, created);
  return Object.freeze({ index: created, terrainBoxPreparationCount: terrainColliders.length });
};

const surfaceRigidBodyTerrainCandidates = (
  bodyBox: OrientedBox,
  index: Readonly<SurfaceRigidBodyTerrainBroadphaseIndex>
): readonly SurfaceRigidBodyTerrainBroadphaseEntry[] => {
  const range = surfaceRigidBodyTerrainBucketRange(bodyBox);
  if (range === null || range.bucketCount > index.buckets.size) {
    return index.entries;
  }
  const candidateIndices = new Set<number>(index.overflowCanonicalIndices);
  for (let bucketX = range.minimumX; bucketX <= range.maximumX; bucketX += 1) {
    for (let bucketZ = range.minimumZ; bucketZ <= range.maximumZ; bucketZ += 1) {
      for (const canonicalIndex of index.buckets.get(terrainBucketKey(bucketX, bucketZ)) ?? []) {
        candidateIndices.add(canonicalIndex);
      }
    }
  }
  return Object.freeze(
    [...candidateIndices]
      .sort((left, right) => left - right)
      .map((canonicalIndex) => index.entries[canonicalIndex])
  );
};

/** @internal Read-only work-budget evidence; it is not gameplay or world truth. */
export const readSurfaceRigidBodyTerrainBroadphaseStats = (
  world: Readonly<SurfaceRigidBodyWorld>
): Readonly<SurfaceRigidBodyTerrainBroadphaseStats> | undefined =>
  surfaceRigidBodyTerrainBroadphaseStats.get(world);

/** @internal Read-only latest-step evidence; it is not gameplay or world truth. */
export const readSurfaceRigidBodyStepDiagnostics = (
  world: Readonly<SurfaceRigidBodyWorld>
): Readonly<SurfaceRigidBodyStepDiagnostics> | undefined =>
  surfaceRigidBodyStepDiagnostics.get(world);

const overlapsAabb = (left: OrientedBox, right: OrientedBox): boolean =>
  left.minimumAabb.x <= right.maximumAabb.x && left.maximumAabb.x >= right.minimumAabb.x &&
  left.minimumAabb.y <= right.maximumAabb.y && left.maximumAabb.y >= right.minimumAabb.y &&
  left.minimumAabb.z <= right.maximumAabb.z && left.maximumAabb.z >= right.minimumAabb.z;

const projectionRadius = (box: OrientedBox, axis: MutableVector): number =>
  box.halfExtents[0] * Math.abs(dot(box.axes[0], axis)) +
  box.halfExtents[1] * Math.abs(dot(box.axes[1], axis)) +
  box.halfExtents[2] * Math.abs(dot(box.axes[2], axis));

const supportPoint = (box: OrientedBox, direction: MutableVector): MutableVector => {
  let result = { ...box.center };
  for (let index = 0; index < 3; index += 1) {
    const projection = dot(box.axes[index], direction);
    if (Math.abs(projection) > 1e-12) {
      result = add(result, scale(box.axes[index], projection > 0 ? box.halfExtents[index] : -box.halfExtents[index]));
    }
  }
  return result;
};

const satContact = (left: OrientedBox, right: OrientedBox): Readonly<{
  normalFromRightToLeft: MutableVector;
  leftPointMeters: MutableVector;
  rightPointMeters: MutableVector;
  penetrationMeters: number;
}> | null => {
  const axes: MutableVector[] = [...left.axes.map((axis) => ({ ...axis })), ...right.axes.map((axis) => ({ ...axis }))];
  for (const leftAxis of left.axes) {
    for (const rightAxis of right.axes) axes.push(cross(leftAxis, rightAxis));
  }
  let bestAxis: MutableVector | null = null;
  let bestPenetration = Number.POSITIVE_INFINITY;
  const centerDelta = subtract(left.center, right.center);
  for (const candidate of axes) {
    const length = magnitude(candidate);
    if (length <= 1e-10) continue;
    const axis = scale(candidate, 1 / length);
    const penetration = projectionRadius(left, axis) + projectionRadius(right, axis) - Math.abs(dot(centerDelta, axis));
    if (penetration < -1e-10) return null;
    if (penetration < bestPenetration - 1e-12) {
      bestPenetration = Math.max(0, penetration);
      bestAxis = dot(centerDelta, axis) >= 0 ? axis : scale(axis, -1);
    }
  }
  if (bestAxis === null || !Number.isFinite(bestPenetration)) return null;
  const leftPoint = supportPoint(left, scale(bestAxis, -1));
  const rightPoint = supportPoint(right, bestAxis);
  return Object.freeze({
    normalFromRightToLeft: bestAxis,
    leftPointMeters: leftPoint,
    rightPointMeters: rightPoint,
    penetrationMeters: bestPenetration
  });
};

const worldInverseInertia = (body: MutableBody, worldVector: MutableVector): MutableVector => {
  const orientation = body.orientation;
  const inverseOrientation = createSpatialQuaternion({ x: -orientation.x, y: -orientation.y, z: -orientation.z, w: orientation.w });
  const local = rotateSpatialVector(inverseOrientation, frozenVector(worldVector));
  const tensor = body.inverseInertiaTensorPerKgMetersSquared;
  const localResult = createSpatialVector3({
    x: tensor.xx * local.x + tensor.xy * local.y + tensor.xz * local.z,
    y: tensor.xy * local.x + tensor.yy * local.y + tensor.yz * local.z,
    z: tensor.xz * local.x + tensor.yz * local.y + tensor.zz * local.z
  });
  return copyVector(rotateSpatialVector(orientation, localResult));
};

const velocityAt = (body: MutableBody, relativePoint: MutableVector): MutableVector =>
  add(body.linearVelocityMetersPerSecond, cross(body.angularVelocityRadiansPerSecond, relativePoint));

const impulseDenominator = (body: MutableBody, relativePoint: MutableVector, direction: MutableVector): number => {
  const torque = cross(relativePoint, direction);
  return body.inverseMassPerKg + dot(direction, cross(worldInverseInertia(body, torque), relativePoint));
};

interface ImpulseVelocityDelta {
  readonly linear: MutableVector;
  readonly angular: MutableVector;
}

const impulseVelocityDelta = (
  body: MutableBody,
  point: MutableVector,
  impulse: MutableVector
): ImpulseVelocityDelta => {
  const relativePoint = subtract(point, body.positionMeters);
  return {
    linear: scale(impulse, body.inverseMassPerKg),
    angular: worldInverseInertia(body, cross(relativePoint, impulse))
  };
};

const largestMagnitudeBoundedScale = (
  current: MutableVector,
  delta: MutableVector,
  limit: number
): number => {
  const a = dot(delta, delta);
  const b = 2 * dot(current, delta);
  const c = dot(current, current) - limit * limit;
  if (a === 0) return c <= 0 ? 1 : 0;
  if (magnitude(add(current, delta)) <= limit) return 1;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 0;
  const root = Math.sqrt(discriminant);
  const intervalMinimum = (-b - root) / (2 * a);
  const intervalMaximum = (-b + root) / (2 * a);
  const feasibleMinimum = Math.max(0, intervalMinimum);
  const feasibleMaximum = Math.min(1, intervalMaximum);
  if (feasibleMaximum < feasibleMinimum) return 0;

  return feasibleMaximum * (1 - 8 * Number.EPSILON);
};

const impulseBudgetScale = (
  body: MutableBody,
  delta: ImpulseVelocityDelta,
  gravityMetersPerSecondSquared: number
): number => Math.min(
  largestMagnitudeBoundedScale(
    predictedLinearVelocityForNextTick(body, gravityMetersPerSecondSquared),
    delta.linear,
    SURFACE_RIGID_BODY_MAX_LINEAR_SPEED_METERS_PER_SECOND
  ),
  largestMagnitudeBoundedScale(
    body.angularVelocityRadiansPerSecond,
    delta.angular,
    SURFACE_RIGID_BODY_MAX_ANGULAR_SPEED_RADIANS_PER_SECOND
  )
);

const applyImpulse = (
  bodyA: MutableBody,
  bodyB: MutableBody | null,
  point: MutableVector,
  impulse: MutableVector,
  gravityMetersPerSecondSquared: number
): number => {
  const deltaA = impulseVelocityDelta(bodyA, point, impulse);
  const deltaB = bodyB === null ? null : impulseVelocityDelta(bodyB, point, scale(impulse, -1));
  const alpha = Math.min(
    impulseBudgetScale(bodyA, deltaA, gravityMetersPerSecondSquared),
    deltaB === null ? 1 : impulseBudgetScale(bodyB as MutableBody, deltaB, gravityMetersPerSecondSquared)
  );

  bodyA.linearVelocityMetersPerSecond = add(bodyA.linearVelocityMetersPerSecond, scale(deltaA.linear, alpha));
  bodyA.angularVelocityRadiansPerSecond = add(bodyA.angularVelocityRadiansPerSecond, scale(deltaA.angular, alpha));
  if (bodyB !== null && deltaB !== null) {
    bodyB.linearVelocityMetersPerSecond = add(bodyB.linearVelocityMetersPerSecond, scale(deltaB.linear, alpha));
    bodyB.angularVelocityRadiansPerSecond = add(bodyB.angularVelocityRadiansPerSecond, scale(deltaB.angular, alpha));
  }
  return alpha;
};

const solveContacts = (
  contacts: readonly Contact[],
  gravityMetersPerSecondSquared: number
): void => {
  for (let iteration = 0; iteration < SURFACE_RIGID_BODY_SOLVER_ITERATIONS; iteration += 1) {
    for (const contact of contacts) {
      const relativeA = subtract(contact.pointMeters, contact.bodyA.positionMeters);
      const relativeB = contact.bodyB === null ? { x: 0, y: 0, z: 0 } : subtract(contact.pointMeters, contact.bodyB.positionMeters);
      const velocityA = velocityAt(contact.bodyA, relativeA);
      const velocityB = contact.bodyB === null ? { x: 0, y: 0, z: 0 } : velocityAt(contact.bodyB, relativeB);
      const relativeVelocity = subtract(velocityA, velocityB);
      const normalSpeed = dot(relativeVelocity, contact.normalFromBToA);
      const normalDenominator = impulseDenominator(contact.bodyA, relativeA, contact.normalFromBToA) +
        (contact.bodyB === null ? 0 : impulseDenominator(contact.bodyB, relativeB, contact.normalFromBToA));
      if (normalDenominator > 1e-12) {
        const nextImpulse = Math.max(0, contact.accumulatedNormalImpulse - normalSpeed / normalDenominator);
        const impulseDelta = nextImpulse - contact.accumulatedNormalImpulse;
        const impulse = scale(contact.normalFromBToA, impulseDelta);
        const appliedScale = applyImpulse(
          contact.bodyA,
          contact.bodyB,
          contact.pointMeters,
          impulse,
          gravityMetersPerSecondSquared
        );
        contact.accumulatedNormalImpulse += impulseDelta * appliedScale;
      }

      const postVelocityA = velocityAt(contact.bodyA, relativeA);
      const postVelocityB = contact.bodyB === null ? { x: 0, y: 0, z: 0 } : velocityAt(contact.bodyB, relativeB);
      const postRelative = subtract(postVelocityA, postVelocityB);
      const tangentVelocity = subtract(postRelative, scale(contact.normalFromBToA, dot(postRelative, contact.normalFromBToA)));
      const tangentLength = magnitude(tangentVelocity);
      if (tangentLength <= 1e-12) continue;
      const tangent = scale(tangentVelocity, 1 / tangentLength);
      const tangentDenominator = impulseDenominator(contact.bodyA, relativeA, tangent) +
        (contact.bodyB === null ? 0 : impulseDenominator(contact.bodyB, relativeB, tangent));
      if (tangentDenominator <= 1e-12) continue;
      const unconstrained = contact.accumulatedTangentImpulse - dot(postRelative, tangent) / tangentDenominator;
      const limit = SURFACE_RIGID_BODY_FRICTION * contact.accumulatedNormalImpulse;
      const nextTangent = Math.max(-limit, Math.min(limit, unconstrained));
      const tangentDelta = nextTangent - contact.accumulatedTangentImpulse;
      const frictionImpulse = scale(tangent, tangentDelta);
      const appliedScale = applyImpulse(
        contact.bodyA,
        contact.bodyB,
        contact.pointMeters,
        frictionImpulse,
        gravityMetersPerSecondSquared
      );
      contact.accumulatedTangentImpulse += tangentDelta * appliedScale;
    }
  }
  for (const contact of contacts) {
    const inverseMassSum = contact.bodyA.inverseMassPerKg + (contact.bodyB?.inverseMassPerKg ?? 0);
    const correctionMagnitude = SURFACE_RIGID_BODY_BAUMGARTE
      * Math.max(contact.penetrationMeters - SURFACE_RIGID_BODY_PENETRATION_SLOP_METERS, 0)
      / inverseMassSum;
    if (!(correctionMagnitude > 0)) continue;
    contact.bodyA.positionMeters = add(
      contact.bodyA.positionMeters,
      scale(contact.normalFromBToA, correctionMagnitude * contact.bodyA.inverseMassPerKg)
    );
    if (contact.bodyB !== null) {
      contact.bodyB.positionMeters = add(
        contact.bodyB.positionMeters,
        scale(contact.normalFromBToA, -correctionMagnitude * contact.bodyB.inverseMassPerKg)
      );
    }
  }
};

const generateContacts = (
  bodies: readonly MutableBody[],
  terrainIndex: Readonly<SurfaceRigidBodyTerrainBroadphaseIndex>,
  terrainStats: MutableSurfaceRigidBodyTerrainBroadphaseStats
): Contact[] => {
  const contacts: Contact[] = [];
  for (const body of bodies) {
    const testedPairs = new Set<string>();
    for (const broadphaseCollider of body.colliders) {
      const broadphaseBox = orientedBox(body, broadphaseCollider);
      const candidates = surfaceRigidBodyTerrainCandidates(broadphaseBox, terrainIndex);
      terrainStats.bodyColliderQueryCount += 1;
      terrainStats.bruteForcePairCount += terrainIndex.entries.length;
      terrainStats.candidatePairCount += candidates.length;
      for (const candidate of candidates) {
        const fixedBox = candidate.box;
        if (!overlapsAabb(broadphaseBox, fixedBox)) continue;
        terrainStats.aabbOverlapCount += 1;
        for (const collider of narrowphaseCollidersForBroadphase(body, broadphaseCollider.colliderIndex)) {
          const pairKey = `${collider.colliderIndex}:${candidate.canonicalIndex}`;
          if (testedPairs.has(pairKey)) continue;
          testedPairs.add(pairKey);
          const bodyBox = orientedBox(body, collider);
          if (!overlapsAabb(bodyBox, fixedBox)) continue;
          const hit = satContact(bodyBox, fixedBox);
          if (hit !== null) contacts.push({
            bodyA: body,
            bodyB: null,
            normalFromBToA: hit.normalFromRightToLeft,
            pointMeters: hit.leftPointMeters,
            penetrationMeters: hit.penetrationMeters,
            accumulatedNormalImpulse: 0,
            accumulatedTangentImpulse: 0
          });
        }
      }
    }
  }
  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex += 1) {
    const leftBody = bodies[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < bodies.length; rightIndex += 1) {
      const rightBody = bodies[rightIndex];
      const testedPairs = new Set<string>();
      for (const leftBroadphase of leftBody.colliders) {
        const leftBroadphaseBox = orientedBox(leftBody, leftBroadphase);
        for (const rightBroadphase of rightBody.colliders) {
          const rightBroadphaseBox = orientedBox(rightBody, rightBroadphase);
          if (!overlapsAabb(leftBroadphaseBox, rightBroadphaseBox)) continue;
          for (const leftCollider of narrowphaseCollidersForBroadphase(leftBody, leftBroadphase.colliderIndex)) {
            const leftBox = orientedBox(leftBody, leftCollider);
            for (const rightCollider of narrowphaseCollidersForBroadphase(rightBody, rightBroadphase.colliderIndex)) {
              const pairKey = `${leftCollider.colliderIndex}:${rightCollider.colliderIndex}`;
              if (testedPairs.has(pairKey)) continue;
              testedPairs.add(pairKey);
              const rightBox = orientedBox(rightBody, rightCollider);
              if (!overlapsAabb(leftBox, rightBox)) continue;
              const hit = satContact(leftBox, rightBox);
              if (hit !== null) contacts.push({
                bodyA: leftBody,
                bodyB: rightBody,
                normalFromBToA: hit.normalFromRightToLeft,
                pointMeters: scale(add(hit.leftPointMeters, hit.rightPointMeters), 0.5),
                penetrationMeters: hit.penetrationMeters,
                accumulatedNormalImpulse: 0,
                accumulatedTangentImpulse: 0
              });
            }
          }
        }
      }
    }
  }
  return contacts;
};

const finiteBody = (body: MutableBody): boolean => [
  body.positionMeters.x, body.positionMeters.y, body.positionMeters.z,
  body.orientation.x, body.orientation.y, body.orientation.z, body.orientation.w,
  body.linearVelocityMetersPerSecond.x, body.linearVelocityMetersPerSecond.y, body.linearVelocityMetersPerSecond.z,
  body.angularVelocityRadiansPerSecond.x, body.angularVelocityRadiansPerSecond.y, body.angularVelocityRadiansPerSecond.z
].every(Number.isFinite);

type SurfaceRigidBodyDiagnosticSourceBody = MutableBody | Readonly<SurfaceRigidBodyState>;

const uncheckedFrozenVector = (
  value: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>
): Readonly<{ readonly x: number; readonly y: number; readonly z: number }> => Object.freeze({
  x: value.x,
  y: value.y,
  z: value.z
});

const uncheckedFrozenQuaternion = (
  value: Readonly<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
  }>
): Readonly<{
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}> => Object.freeze({
  x: value.x,
  y: value.y,
  z: value.z,
  w: value.w
});

const finiteVector = (
  value: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>
): boolean => Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);

const finiteQuaternion = (
  value: Readonly<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
  }>
): boolean => Number.isFinite(value.x)
  && Number.isFinite(value.y)
  && Number.isFinite(value.z)
  && Number.isFinite(value.w);

const nullableFinite = (value: number): number | null => Number.isFinite(value) ? value : null;

const firstNonFiniteBodyField = (
  bodies: readonly SurfaceRigidBodyDiagnosticSourceBody[]
): Readonly<SurfaceRigidBodyStepNonFiniteFieldDiagnostic> | null => {
  for (const body of bodies) {
    const fields = [
      ["positionMeters.x", body.positionMeters.x],
      ["positionMeters.y", body.positionMeters.y],
      ["positionMeters.z", body.positionMeters.z],
      ["orientation.x", body.orientation.x],
      ["orientation.y", body.orientation.y],
      ["orientation.z", body.orientation.z],
      ["orientation.w", body.orientation.w],
      ["linearVelocityMetersPerSecond.x", body.linearVelocityMetersPerSecond.x],
      ["linearVelocityMetersPerSecond.y", body.linearVelocityMetersPerSecond.y],
      ["linearVelocityMetersPerSecond.z", body.linearVelocityMetersPerSecond.z],
      ["angularVelocityRadiansPerSecond.x", body.angularVelocityRadiansPerSecond.x],
      ["angularVelocityRadiansPerSecond.y", body.angularVelocityRadiansPerSecond.y],
      ["angularVelocityRadiansPerSecond.z", body.angularVelocityRadiansPerSecond.z]
    ] as const;
    for (const [path, value] of fields) {
      if (!Number.isFinite(value)) return Object.freeze({ bodyId: body.bodyId, path, value });
    }
  }
  return null;
};

const createSurfaceRigidBodyStepBodyDiagnostics = (
  body: SurfaceRigidBodyDiagnosticSourceBody,
  activeBodyIds: ReadonlySet<string>,
  gravityMetersPerSecondSquared: number
): Readonly<SurfaceRigidBodyStepBodyDiagnostics> => {
  const predictedNextTickLinearSpeedMetersPerSecond = predictedNextTickLinearSpeed(
    body,
    gravityMetersPerSecondSquared
  );
  const angularSpeedRadiansPerSecond = angularSpeed(body);
  const translationSubsteps = nullableFinite(requiredSubstepsForMagnitude(
    predictedNextTickLinearSpeedMetersPerSecond,
    SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS
  ));
  const rotationSubsteps = nullableFinite(requiredSubstepsForMagnitude(
    angularSpeedRadiansPerSecond,
    SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS
  ));
  const positionFinite = finiteVector(body.positionMeters);
  const orientationFinite = finiteQuaternion(body.orientation);
  return Object.freeze({
    bodyId: body.bodyId,
    componentId: body.componentId,
    objectId: body.objectId,
    active: activeBodyIds.has(body.bodyId),
    sourceObjectRevision: body.sourceObjectRevision,
    sourceContentHash: body.sourceContentHash,
    colliderRevision: body.colliderRevision,
    colliderCount: body.colliders.length,
    activationSimulationTick: body.activationSimulationTick,
    lifecycle: body.lifecycle,
    positionMeters: uncheckedFrozenVector(body.positionMeters),
    orientation: uncheckedFrozenQuaternion(body.orientation),
    linearVelocityMetersPerSecond: uncheckedFrozenVector(body.linearVelocityMetersPerSecond),
    angularVelocityRadiansPerSecond: uncheckedFrozenVector(body.angularVelocityRadiansPerSecond),
    positionFinite,
    orientationFinite,
    poseFinite: positionFinite && orientationFinite,
    linearVelocityFinite: finiteVector(body.linearVelocityMetersPerSecond),
    angularVelocityFinite: finiteVector(body.angularVelocityRadiansPerSecond),
    predictedNextTickLinearSpeedMetersPerSecond: nullableFinite(
      predictedNextTickLinearSpeedMetersPerSecond
    ),
    angularSpeedRadiansPerSecond: nullableFinite(angularSpeedRadiansPerSecond),
    requiredTranslationSubsteps: translationSubsteps,
    requiredRotationSubsteps: rotationSubsteps,
    requiredMotionSubsteps: translationSubsteps === null || rotationSubsteps === null
      ? null
      : Math.max(1, translationSubsteps, rotationSubsteps)
  });
};

interface SurfaceRigidBodyStepDiagnosticRecord {
  readonly resultWorld: Readonly<SurfaceRigidBodyWorld>;
  readonly sourceSimulationTick: number;
  readonly attemptedSimulationTick: number;
  readonly outcome: "Advanced" | "Failed";
  readonly stage: SurfaceRigidBodyStepDiagnosticStage;
  readonly failureCode: SurfacePhysicsFailureSnapshot["code"] | null;
  readonly selectedSubsteps: number | null;
  readonly completedSubsteps: number;
  readonly contactsPerSubstep: readonly number[];
  readonly cumulativeContactCount: number;
  readonly activeBodyIds: readonly string[];
  readonly bodies: readonly SurfaceRigidBodyDiagnosticSourceBody[];
  readonly gravityMetersPerSecondSquared: number;
  readonly caughtError?: TypeError | RangeError;
}

const recordSurfaceRigidBodyStepDiagnostics = (
  input: Readonly<SurfaceRigidBodyStepDiagnosticRecord>
): void => {
  const activeBodyIds = Object.freeze([...input.activeBodyIds]);
  const activeBodySet = new Set(activeBodyIds);
  const caughtError = input.caughtError === undefined
    ? null
    : Object.freeze({
        name: input.caughtError instanceof RangeError ? "RangeError" as const : "TypeError" as const,
        message: input.caughtError.message
      });
  const diagnostics: Readonly<SurfaceRigidBodyStepDiagnostics> = Object.freeze({
    sourceSimulationTick: input.sourceSimulationTick,
    attemptedSimulationTick: input.attemptedSimulationTick,
    outcome: input.outcome,
    stage: input.stage,
    failureCode: input.failureCode,
    selectedSubsteps: input.selectedSubsteps,
    completedSubsteps: input.completedSubsteps,
    contactsPerSubstep: Object.freeze([...input.contactsPerSubstep]),
    cumulativeContactCount: input.cumulativeContactCount,
    activeBodyIds,
    bodies: Object.freeze(input.bodies.map((body) =>
      createSurfaceRigidBodyStepBodyDiagnostics(
        body,
        activeBodySet,
        input.gravityMetersPerSecondSquared
      ))),
    firstNonFiniteField: firstNonFiniteBodyField(input.bodies),
    caughtError
  });
  surfaceRigidBodyStepDiagnostics.set(input.resultWorld, diagnostics);
};

const failedStep = (
  world: Readonly<SurfaceRigidBodyWorld>,
  code: SurfacePhysicsFailureSnapshot["code"],
  failingTick: number,
  bodyIds: readonly string[]
): SurfaceRigidBodyStep => {
  const failure = createSurfacePhysicsFailureSnapshot({ code, simulationTick: failingTick, bodyIds });
  const failedWorld = freezeWorld({ ...world, physicsFailure: failure });
  return Object.freeze({ status: "Failed", world: failedWorld, failure });
};

export const stepSurfaceRigidBodyWorld = (world: Readonly<SurfaceRigidBodyWorld>): SurfaceRigidBodyStep => {
  if (world.physicsFailure !== null) {
    if (!surfaceRigidBodyStepDiagnostics.has(world)) {
      const activeBodyIds = world.bodies
        .filter((body) => body.activationSimulationTick <= world.physicsFailure!.simulationTick)
        .map((body) => body.bodyId);
      recordSurfaceRigidBodyStepDiagnostics({
        resultWorld: world,
        sourceSimulationTick: world.simulationTick,
        attemptedSimulationTick: world.physicsFailure.simulationTick,
        outcome: "Failed",
        stage: "LatchedFailure",
        failureCode: world.physicsFailure.code,
        selectedSubsteps: null,
        completedSubsteps: 0,
        contactsPerSubstep: [],
        cumulativeContactCount: 0,
        activeBodyIds,
        bodies: world.bodies,
        gravityMetersPerSecondSquared: world.gravityMetersPerSecondSquared
      });
    }
    return Object.freeze({ status: "Failed", world, failure: world.physicsFailure });
  }
  const nextTick = world.simulationTick + 1;
  const activeIds = world.bodies
    .filter((body) => body.activationSimulationTick <= nextTick)
    .map((body) => body.bodyId);
  const activeSet = new Set(activeIds);
  if (world.bodies.some((body) => !finiteBody(thawBody(body)))) {
    const failed = failedStep(world, "NonFiniteState", nextTick, activeIds);
    recordSurfaceRigidBodyStepDiagnostics({
      resultWorld: failed.world,
      sourceSimulationTick: world.simulationTick,
      attemptedSimulationTick: nextTick,
      outcome: "Failed",
      stage: "PreStepValidation",
      failureCode: "NonFiniteState",
      selectedSubsteps: null,
      completedSubsteps: 0,
      contactsPerSubstep: [],
      cumulativeContactCount: 0,
      activeBodyIds: activeIds,
      bodies: world.bodies,
      gravityMetersPerSecondSquared: world.gravityMetersPerSecondSquared
    });
    return failed;
  }
  let substeps = 1;
  for (const body of world.bodies) {
    if (!activeSet.has(body.bodyId)) continue;
    substeps = Math.max(substeps, requiredMotionSubsteps(body, world.gravityMetersPerSecondSquared));
  }
  if (substeps > SURFACE_RIGID_BODY_MAX_SUBSTEPS) {
    const failed = failedStep(world, "MotionBudgetExceeded", nextTick, activeIds);
    recordSurfaceRigidBodyStepDiagnostics({
      resultWorld: failed.world,
      sourceSimulationTick: world.simulationTick,
      attemptedSimulationTick: nextTick,
      outcome: "Failed",
      stage: "MotionBudget",
      failureCode: "MotionBudgetExceeded",
      selectedSubsteps: substeps,
      completedSubsteps: 0,
      contactsPerSubstep: [],
      cumulativeContactCount: 0,
      activeBodyIds: activeIds,
      bodies: world.bodies,
      gravityMetersPerSecondSquared: world.gravityMetersPerSecondSquared
    });
    return failed;
  }

  const terrainBroadphase = surfaceRigidBodyTerrainBroadphaseIndex(world.terrainColliders);
  const terrainStats: MutableSurfaceRigidBodyTerrainBroadphaseStats = {
    terrainColliderCount: world.terrainColliders.length,
    bodyColliderQueryCount: 0,
    bruteForcePairCount: 0,
    candidatePairCount: 0,
    aabbOverlapCount: 0,
    terrainBoxPreparationCount: terrainBroadphase.terrainBoxPreparationCount,
    bucketCount: terrainBroadphase.index.buckets.size
  };
  const scratch = world.bodies.map(thawBody);
  const active = scratch.filter((body) => activeSet.has(body.bodyId));
  const substepSeconds = SURFACE_RIGID_BODY_TICK_SECONDS / substeps;
  let contactCount = 0;
  const contactsPerSubstep: number[] = [];
  let completedSubsteps = 0;
  let currentStage: SurfaceRigidBodyStepDiagnosticStage = "Integration";
  try {
    for (let substep = 0; substep < substeps; substep += 1) {
      currentStage = "Integration";
      for (const body of active) {
        if (body.lifecycle === "Falling") body.linearVelocityMetersPerSecond.y -= world.gravityMetersPerSecondSquared * substepSeconds;
        body.positionMeters = add(body.positionMeters, scale(body.linearVelocityMetersPerSecond, substepSeconds));
        const angularSpeed = magnitude(body.angularVelocityRadiansPerSecond);
        if (angularSpeed > 0) {
          const delta = createQuaternionFromAxisAngle(frozenVector(scale(body.angularVelocityRadiansPerSecond, 1 / angularSpeed)), angularSpeed * substepSeconds);
          body.orientation = multiplySpatialQuaternions(delta, body.orientation);
        }
      }
      currentStage = "ContactGeneration";
      const contacts = generateContacts(active, terrainBroadphase.index, terrainStats);
      contactsPerSubstep.push(contacts.length);
      contactCount += contacts.length;
      if (contactCount > SURFACE_RIGID_BODY_MAX_CONTACTS_PER_TICK) {
        const failed = failedStep(world, "ContactBudgetExceeded", nextTick, activeIds);
        surfaceRigidBodyTerrainBroadphaseStats.set(failed.world, Object.freeze({ ...terrainStats }));
        recordSurfaceRigidBodyStepDiagnostics({
          resultWorld: failed.world,
          sourceSimulationTick: world.simulationTick,
          attemptedSimulationTick: nextTick,
          outcome: "Failed",
          stage: "ContactBudget",
          failureCode: "ContactBudgetExceeded",
          selectedSubsteps: substeps,
          completedSubsteps,
          contactsPerSubstep,
          cumulativeContactCount: contactCount,
          activeBodyIds: activeIds,
          bodies: scratch,
          gravityMetersPerSecondSquared: world.gravityMetersPerSecondSquared
        });
        return failed;
      }
      currentStage = "ContactSolve";
      solveContacts(contacts, world.gravityMetersPerSecondSquared);
      currentStage = "PostSolveValidation";
      if (active.some((body) => !finiteBody(body))) {
        const failed = failedStep(world, "NonFiniteState", nextTick, activeIds);
        surfaceRigidBodyTerrainBroadphaseStats.set(failed.world, Object.freeze({ ...terrainStats }));
        recordSurfaceRigidBodyStepDiagnostics({
          resultWorld: failed.world,
          sourceSimulationTick: world.simulationTick,
          attemptedSimulationTick: nextTick,
          outcome: "Failed",
          stage: "PostSolveValidation",
          failureCode: "NonFiniteState",
          selectedSubsteps: substeps,
          completedSubsteps,
          contactsPerSubstep,
          cumulativeContactCount: contactCount,
          activeBodyIds: activeIds,
          bodies: scratch,
          gravityMetersPerSecondSquared: world.gravityMetersPerSecondSquared
        });
        return failed;
      }
      completedSubsteps = substep + 1;
    }
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      const failed = failedStep(world, "NonFiniteState", nextTick, activeIds);
      surfaceRigidBodyTerrainBroadphaseStats.set(failed.world, Object.freeze({ ...terrainStats }));
      recordSurfaceRigidBodyStepDiagnostics({
        resultWorld: failed.world,
        sourceSimulationTick: world.simulationTick,
        attemptedSimulationTick: nextTick,
        outcome: "Failed",
        stage: currentStage,
        failureCode: "NonFiniteState",
        selectedSubsteps: substeps,
        completedSubsteps,
        contactsPerSubstep,
        cumulativeContactCount: contactCount,
        activeBodyIds: activeIds,
        bodies: scratch,
        gravityMetersPerSecondSquared: world.gravityMetersPerSecondSquared,
        caughtError: error
      });
      return failed;
    }
    throw error;
  }

  for (const body of scratch) {
    body.simulationTick = nextTick;
    if (!activeSet.has(body.bodyId)) continue;
    const slow = magnitude(body.linearVelocityMetersPerSecond) <= SURFACE_RIGID_BODY_REST_SPEED &&
      magnitude(body.angularVelocityRadiansPerSecond) <= SURFACE_RIGID_BODY_REST_SPEED;
    if (slow) {
      body.restingTicks += 1;
      if (body.restingTicks >= SURFACE_RIGID_BODY_REST_TICKS) {
        body.lifecycle = "Resting";
        body.linearVelocityMetersPerSecond = { x: 0, y: 0, z: 0 };
        body.angularVelocityRadiansPerSecond = { x: 0, y: 0, z: 0 };
      }
    } else {
      body.lifecycle = "Falling";
      body.restingTicks = 0;
    }
  }
  const advancedWorld = freezeWorld({
    ...world,
    simulationTick: nextTick,
    bodies: Object.freeze(scratch.map(freezeBody)),
    physicsFailure: null
  });
  surfaceRigidBodyTerrainBroadphaseStats.set(advancedWorld, Object.freeze({ ...terrainStats }));
  recordSurfaceRigidBodyStepDiagnostics({
    resultWorld: advancedWorld,
    sourceSimulationTick: world.simulationTick,
    attemptedSimulationTick: nextTick,
    outcome: "Advanced",
    stage: "Advanced",
    failureCode: null,
    selectedSubsteps: substeps,
    completedSubsteps,
    contactsPerSubstep,
    cumulativeContactCount: contactCount,
    activeBodyIds: activeIds,
    bodies: scratch,
    gravityMetersPerSecondSquared: world.gravityMetersPerSecondSquared
  });
  return Object.freeze({
    status: "Advanced",
    world: advancedWorld
  });
};

export const surfaceRigidBodySnapshots = (
  world: Readonly<SurfaceRigidBodyWorld>
): readonly SurfaceDynamicBodySnapshot[] => Object.freeze(world.bodies.map((body) => createSurfaceDynamicBodySnapshot({
  bodyId: body.bodyId,
  componentId: body.componentId,
  objectId: body.objectId,
  sourceObjectRevision: body.sourceObjectRevision,
  sourceContentHash: body.sourceContentHash,
  lifecycle: body.lifecycle,
  positionMeters: body.positionMeters,
  orientation: body.orientation,
  linearVelocityMetersPerSecond: body.linearVelocityMetersPerSecond,
  angularVelocityRadiansPerSecond: body.angularVelocityRadiansPerSecond,
  colliderRevision: body.colliderRevision,
  simulationTick: body.simulationTick
})));

export const clearSurfaceRigidBodyWorld = (
  world: Readonly<SurfaceRigidBodyWorld>
): Readonly<SurfaceRigidBodyWorld> => freezeWorld({ ...world, bodies: Object.freeze([]), physicsFailure: null });

interface SurfaceRigidBodyLocalSlabHit {
  readonly parameter: number;
  readonly normal: MutableVector;
}

const compareCodeUnits = (left: string, right: string): number => {
  const commonLength = Math.min(left.length, right.length);
  for (let index = 0; index < commonLength; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
};

const inverseBodyOrientation = (body: SurfaceRigidBodyState): SpatialQuaternion =>
  createSpatialQuaternion({
    x: -body.orientation.x,
    y: -body.orientation.y,
    z: -body.orientation.z,
    w: body.orientation.w
  });

const bodyLocalPoint = (
  body: SurfaceRigidBodyState,
  inverseOrientation: SpatialQuaternion,
  pointMeters: SpatialVector3
): MutableVector => copyVector(rotateSpatialVector(
  inverseOrientation,
  frozenVector(subtract(copyVector(pointMeters), copyVector(body.positionMeters)))
));

const bodyLocalDirection = (
  inverseOrientation: SpatialQuaternion,
  direction: SpatialVector3
): MutableVector => copyVector(rotateSpatialVector(inverseOrientation, direction));

const closestOutwardSeparation = (
  point: MutableVector,
  minimum: MutableVector,
  maximum: MutableVector
): Readonly<{ readonly distanceMeters: number; readonly normal: MutableVector }> => {
  const candidates: readonly Readonly<{ readonly distance: number; readonly normal: MutableVector }>[] = [
    { distance: point.x - minimum.x, normal: { x: -1, y: 0, z: 0 } },
    { distance: maximum.x - point.x, normal: { x: 1, y: 0, z: 0 } },
    { distance: point.y - minimum.y, normal: { x: 0, y: -1, z: 0 } },
    { distance: maximum.y - point.y, normal: { x: 0, y: 1, z: 0 } },
    { distance: point.z - minimum.z, normal: { x: 0, y: 0, z: -1 } },
    { distance: maximum.z - point.z, normal: { x: 0, y: 0, z: 1 } }
  ];
  let nearest = candidates[0];
  for (let index = 1; index < candidates.length; index += 1) {
    if (candidates[index].distance < nearest.distance) nearest = candidates[index];
  }
  return { distanceMeters: nearest.distance, normal: { ...nearest.normal } };
};

const closestOutwardNormal = (
  point: MutableVector,
  minimum: MutableVector,
  maximum: MutableVector
): MutableVector => closestOutwardSeparation(point, minimum, maximum).normal;

const pointInsideBounds = (
  point: MutableVector,
  minimum: MutableVector,
  maximum: MutableVector
): boolean => point.x >= minimum.x && point.x <= maximum.x
  && point.y >= minimum.y && point.y <= maximum.y
  && point.z >= minimum.z && point.z <= maximum.z;

const localSlabInterval = (
  origin: MutableVector,
  direction: MutableVector,
  minimum: MutableVector,
  maximum: MutableVector
): Readonly<{ readonly start: number; readonly end: number }> | null => {
  let near = Number.NEGATIVE_INFINITY;
  let far = Number.POSITIVE_INFINITY;
  for (const axis of ["x", "y", "z"] as const) {
    const component = direction[axis];
    if (Math.abs(component) <= Number.EPSILON) {
      if (origin[axis] < minimum[axis] || origin[axis] > maximum[axis]) return null;
      continue;
    }
    const inverse = 1 / component;
    let axisNear = (minimum[axis] - origin[axis]) * inverse;
    let axisFar = (maximum[axis] - origin[axis]) * inverse;
    if (axisNear > axisFar) [axisNear, axisFar] = [axisFar, axisNear];
    near = Math.max(near, axisNear);
    far = Math.min(far, axisFar);
    if (far < near) return null;
  }
  if (far < 0) return null;
  return { start: Math.max(0, near), end: far };
};

const localSlabHit = (
  origin: MutableVector,
  direction: MutableVector,
  minimum: MutableVector,
  maximum: MutableVector,
  maximumParameter: number
): SurfaceRigidBodyLocalSlabHit | null => {
  if (pointInsideBounds(origin, minimum, maximum)) {
    return {
      parameter: 0,
      normal: closestOutwardNormal(origin, minimum, maximum)
    };
  }
  let near = 0;
  let far = maximumParameter;
  let normal: MutableVector | null = null;
  for (const axis of ["x", "y", "z"] as const) {
    const component = direction[axis];
    if (Math.abs(component) <= Number.EPSILON) {
      if (origin[axis] < minimum[axis] || origin[axis] > maximum[axis]) return null;
      continue;
    }
    const inverse = 1 / component;
    let axisNear = (minimum[axis] - origin[axis]) * inverse;
    let axisFar = (maximum[axis] - origin[axis]) * inverse;
    const nearSign = -Math.sign(component);
    if (axisNear > axisFar) {
      [axisNear, axisFar] = [axisFar, axisNear];
    }
    if (axisNear > near) {
      near = axisNear;
      normal = {
        x: axis === "x" ? nearSign : 0,
        y: axis === "y" ? nearSign : 0,
        z: axis === "z" ? nearSign : 0
      };
    }
    far = Math.min(far, axisFar);
    if (far < near) return null;
  }
  return near <= maximumParameter && far >= 0 && normal !== null
    ? { parameter: Math.max(0, near), normal }
    : null;
};

const colliderLocalBounds = (
  collider: SurfaceRigidBodyColliderBox,
  expansion: MutableVector = { x: 0, y: 0, z: 0 }
): Readonly<{ readonly minimum: MutableVector; readonly maximum: MutableVector }> => ({
  minimum: {
    x: collider.centerMeters.x - collider.halfExtentsMeters.x - expansion.x,
    y: collider.centerMeters.y - collider.halfExtentsMeters.y - expansion.y,
    z: collider.centerMeters.z - collider.halfExtentsMeters.z - expansion.z
  },
  maximum: {
    x: collider.centerMeters.x + collider.halfExtentsMeters.x + expansion.x,
    y: collider.centerMeters.y + collider.halfExtentsMeters.y + expansion.y,
    z: collider.centerMeters.z + collider.halfExtentsMeters.z + expansion.z
  }
});

const orderedQueryBodies = (
  world: Readonly<SurfaceRigidBodyWorld>
): readonly SurfaceRigidBodyState[] => [...world.bodies].sort((left, right) =>
  compareCodeUnits(left.bodyId, right.bodyId));

const orderedBodyColliders = (
  body: SurfaceRigidBodyState
): readonly SurfaceRigidBodyColliderBox[] => [...body.colliders].sort((left, right) =>
  left.colliderIndex - right.colliderIndex);

const orderedBodyNarrowphaseCollidersForQuery = (
  body: SurfaceRigidBodyState,
  broadphasePredicate: (collider: SurfaceRigidBodyColliderBox) => boolean
): readonly SurfaceRigidBodyColliderBox[] => {
  const indices = new Set<number>();
  for (const broadphase of orderedBodyColliders(body)) {
    if (!broadphasePredicate(broadphase)) continue;
    for (const index of body.colliderRepresentation
      .broadphaseNarrowphaseColliderIndices[broadphase.colliderIndex] ?? []) indices.add(index);
  }
  return [...indices]
    .sort((left, right) => left - right)
    .map((index) => {
      const collider = body.colliderRepresentation.narrowphaseColliders[index];
      if (collider === undefined) throw new TypeError("Rigid-body query narrowphase mapping is stale.");
      return collider;
    });
};

const queryTieBreaksBefore = (
  body: SurfaceRigidBodyState,
  collider: SurfaceRigidBodyColliderBox,
  currentBodyId: string,
  currentColliderIndex: number
): boolean => {
  const bodyOrder = compareCodeUnits(body.bodyId, currentBodyId);
  return bodyOrder < 0 || (bodyOrder === 0 && collider.colliderIndex < currentColliderIndex);
};

export const raycastSurfaceRigidBodies = (
  world: Readonly<SurfaceRigidBodyWorld>,
  query: SurfaceRigidBodyRayQuery
): SurfaceRigidBodyRayResult => {
  const originMeters = createSpatialVector3(query.originMeters, "/rigidBodyRay/originMeters");
  const rawDirection = createSpatialVector3(query.direction, "/rigidBodyRay/direction");
  const directionLength = Math.hypot(rawDirection.x, rawDirection.y, rawDirection.z);
  if (!(directionLength > 0)) throw new TypeError("Rigid-body ray direction must be non-zero.");
  const maximumDistanceMeters = finite(query.maximumDistanceMeters, "rigidBodyRay.maximumDistanceMeters");
  if (maximumDistanceMeters < 0) throw new TypeError("Rigid-body ray maximum distance must be non-negative.");
  const direction = createSpatialVector3({
    x: rawDirection.x / directionLength,
    y: rawDirection.y / directionLength,
    z: rawDirection.z / directionLength
  });
  let nearest: Readonly<{
    readonly body: SurfaceRigidBodyState;
    readonly collider: SurfaceRigidBodyColliderBox;
    readonly slab: SurfaceRigidBodyLocalSlabHit;
  }> | null = null;

  for (const body of orderedQueryBodies(world)) {
    const inverseOrientation = inverseBodyOrientation(body);
    const localOrigin = bodyLocalPoint(body, inverseOrientation, originMeters);
    const localDirection = bodyLocalDirection(inverseOrientation, direction);
    const colliders = orderedBodyNarrowphaseCollidersForQuery(body, (broadphase) => {
      const bounds = colliderLocalBounds(broadphase);
      return localSlabHit(
        localOrigin,
        localDirection,
        bounds.minimum,
        bounds.maximum,
        maximumDistanceMeters
      ) !== null;
    });
    for (const collider of colliders) {
      const bounds = colliderLocalBounds(collider);
      const slab = localSlabHit(
        localOrigin,
        localDirection,
        bounds.minimum,
        bounds.maximum,
        maximumDistanceMeters
      );
      if (slab === null) continue;
      if (
        nearest === null
        || slab.parameter < nearest.slab.parameter
        || (
          slab.parameter === nearest.slab.parameter
          && queryTieBreaksBefore(body, collider, nearest.body.bodyId, nearest.collider.colliderIndex)
        )
      ) {
        nearest = { body, collider, slab };
      }
    }
  }

  if (nearest === null) return Object.freeze({ status: "Miss", hit: null });
  const pointMeters = createSpatialVector3({
    x: originMeters.x + direction.x * nearest.slab.parameter,
    y: originMeters.y + direction.y * nearest.slab.parameter,
    z: originMeters.z + direction.z * nearest.slab.parameter
  });
  const normal = rotateSpatialVector(nearest.body.orientation, frozenVector(nearest.slab.normal));
  const hit: SurfaceRigidBodyRayHit = Object.freeze({
    bodyId: nearest.body.bodyId,
    componentId: nearest.body.componentId,
    colliderIndex: nearest.collider.colliderIndex,
    pointMeters,
    normal,
    distanceMeters: nearest.slab.parameter
  });
  return Object.freeze({ status: "Hit", hit });
};

const checkedCapsule = (capsule: SurfaceRigidBodyCapsule): Readonly<SurfaceRigidBodyCapsule> => {
  const radiusMeters = finite(capsule.radiusMeters, "rigidBodySweep.capsule.radiusMeters");
  const heightMeters = finite(capsule.heightMeters, "rigidBodySweep.capsule.heightMeters");
  if (!(radiusMeters > 0)) throw new TypeError("Rigid-body capsule radius must be positive.");
  if (heightMeters < radiusMeters * 2) {
    throw new TypeError("Rigid-body capsule height must be at least twice its radius.");
  }
  return Object.freeze({ radiusMeters, heightMeters });
};

export const sweepSurfaceRigidBodyCapsule = (
  world: Readonly<SurfaceRigidBodyWorld>,
  query: SurfaceRigidBodyCapsuleSweepQuery
): SurfaceRigidBodyCapsuleSweepResult => {
  const capsule = checkedCapsule(query.capsule);
  const startPositionMeters = createSpatialVector3(
    query.startPositionMeters,
    "/rigidBodySweep/startPositionMeters"
  );
  const displacementMeters = createSpatialVector3(
    query.displacementMeters,
    "/rigidBodySweep/displacementMeters"
  );
  const displacementLength = Math.hypot(
    displacementMeters.x,
    displacementMeters.y,
    displacementMeters.z
  );
  const halfSegmentMeters = capsule.heightMeters / 2 - capsule.radiusMeters;
  let nearest: Readonly<{
    readonly body: SurfaceRigidBodyState;
    readonly collider: SurfaceRigidBodyColliderBox;
    readonly slab: SurfaceRigidBodyLocalSlabHit;
  }> | null = null;

  for (const body of orderedQueryBodies(world)) {
    const inverseOrientation = inverseBodyOrientation(body);
    const localStart = bodyLocalPoint(body, inverseOrientation, startPositionMeters);
    const localDisplacement = bodyLocalDirection(inverseOrientation, displacementMeters);
    const localUp = bodyLocalDirection(inverseOrientation, spatialVector3(0, 1, 0));
    const expansion = {
      x: capsule.radiusMeters + Math.abs(localUp.x) * halfSegmentMeters,
      y: capsule.radiusMeters + Math.abs(localUp.y) * halfSegmentMeters,
      z: capsule.radiusMeters + Math.abs(localUp.z) * halfSegmentMeters
    };
    const colliders = orderedBodyNarrowphaseCollidersForQuery(body, (broadphase) => {
      const bounds = colliderLocalBounds(broadphase, expansion);
      return localSlabHit(localStart, localDisplacement, bounds.minimum, bounds.maximum, 1) !== null;
    });
    for (const collider of colliders) {
      const bounds = colliderLocalBounds(collider, expansion);
      const slab = localSlabHit(localStart, localDisplacement, bounds.minimum, bounds.maximum, 1);
      if (slab === null) continue;
      if (
        nearest === null
        || slab.parameter < nearest.slab.parameter
        || (
          slab.parameter === nearest.slab.parameter
          && queryTieBreaksBefore(body, collider, nearest.body.bodyId, nearest.collider.colliderIndex)
        )
      ) {
        nearest = { body, collider, slab };
      }
    }
  }

  if (nearest === null) return Object.freeze({ status: "Miss", fraction: 1, hit: null });
  const pointMeters = createSpatialVector3({
    x: startPositionMeters.x + displacementMeters.x * nearest.slab.parameter,
    y: startPositionMeters.y + displacementMeters.y * nearest.slab.parameter,
    z: startPositionMeters.z + displacementMeters.z * nearest.slab.parameter
  });
  const normal = rotateSpatialVector(nearest.body.orientation, frozenVector(nearest.slab.normal));
  const distanceMeters = displacementLength * nearest.slab.parameter;
  const hit: SurfaceRigidBodyCapsuleSweepHit = Object.freeze({
    bodyId: nearest.body.bodyId,
    componentId: nearest.body.componentId,
    colliderIndex: nearest.collider.colliderIndex,
    pointMeters,
    normal,
    fraction: nearest.slab.parameter,
    distanceMeters
  });
  return Object.freeze({ status: "Hit", fraction: nearest.slab.parameter, hit });
};

export const querySurfaceRigidBodyGroundContact = (
  world: Readonly<SurfaceRigidBodyWorld>,
  query: SurfaceRigidBodyGroundContactQuery
): SurfaceRigidBodyCapsuleSweepResult => {
  const maximumDistanceMeters = finite(
    query.maximumDistanceMeters,
    "rigidBodyGround.maximumDistanceMeters"
  );
  if (maximumDistanceMeters < 0) {
    throw new TypeError("Rigid-body ground distance must be non-negative.");
  }
  const restingWorld: Readonly<SurfaceRigidBodyWorld> = {
    ...world,
    bodies: world.bodies.filter((body) => body.lifecycle === "Resting")
  };
  return sweepSurfaceRigidBodyCapsule(restingWorld, {
    capsule: query.capsule,
    startPositionMeters: query.positionMeters,
    displacementMeters: { x: 0, y: -maximumDistanceMeters, z: 0 }
  });
};

const capsuleOverlapCandidate = (
  world: Readonly<SurfaceRigidBodyWorld>,
  capsule: Readonly<SurfaceRigidBodyCapsule>,
  positionMeters: SpatialVector3
): Readonly<{
  readonly body: SurfaceRigidBodyState;
  readonly collider: SurfaceRigidBodyColliderBox;
  readonly normal: SpatialVector3;
  readonly distanceMeters: number;
}> | null => {
  let nearest: Readonly<{
    readonly body: SurfaceRigidBodyState;
    readonly collider: SurfaceRigidBodyColliderBox;
    readonly normal: SpatialVector3;
    readonly distanceMeters: number;
  }> | null = null;
  const halfSegmentMeters = capsule.heightMeters / 2 - capsule.radiusMeters;

  for (const body of orderedQueryBodies(world)) {
    const inverseOrientation = inverseBodyOrientation(body);
    const localPosition = bodyLocalPoint(body, inverseOrientation, positionMeters);
    const localUp = bodyLocalDirection(inverseOrientation, spatialVector3(0, 1, 0));
    const expansion = {
      x: capsule.radiusMeters + Math.abs(localUp.x) * halfSegmentMeters,
      y: capsule.radiusMeters + Math.abs(localUp.y) * halfSegmentMeters,
      z: capsule.radiusMeters + Math.abs(localUp.z) * halfSegmentMeters
    };
    const colliders = orderedBodyNarrowphaseCollidersForQuery(body, (broadphase) => {
      const bounds = colliderLocalBounds(broadphase, expansion);
      return pointInsideBounds(localPosition, bounds.minimum, bounds.maximum);
    });
    for (const collider of colliders) {
      const bounds = colliderLocalBounds(collider, expansion);
      if (!pointInsideBounds(localPosition, bounds.minimum, bounds.maximum)) continue;
      const localSeparation = closestOutwardSeparation(localPosition, bounds.minimum, bounds.maximum);
      if (
        nearest !== null
        && (
          localSeparation.distanceMeters > nearest.distanceMeters
          || (
            localSeparation.distanceMeters === nearest.distanceMeters
            && !queryTieBreaksBefore(body, collider, nearest.body.bodyId, nearest.collider.colliderIndex)
          )
        )
      ) continue;
      nearest = {
        body,
        collider,
        normal: rotateSpatialVector(body.orientation, frozenVector(localSeparation.normal)),
        distanceMeters: localSeparation.distanceMeters
      };
    }
  }
  return nearest;
};

const capsuleUnionSeparationCandidate = (
  world: Readonly<SurfaceRigidBodyWorld>,
  capsule: Readonly<SurfaceRigidBodyCapsule>,
  positionMeters: SpatialVector3,
  boundaryClearanceMeters: number
): Readonly<{
  readonly body: SurfaceRigidBodyState;
  readonly collider: SurfaceRigidBodyColliderBox;
  readonly normal: SpatialVector3;
  readonly distanceMeters: number;
}> | null => {
  if (capsuleOverlapCandidate(world, capsule, positionMeters) === null) return null;
  const bodies = orderedQueryBodies(world);
  const localDirections = [
    spatialVector3(-1, 0, 0),
    spatialVector3(1, 0, 0),
    spatialVector3(0, -1, 0),
    spatialVector3(0, 1, 0),
    spatialVector3(0, 0, -1),
    spatialVector3(0, 0, 1)
  ] as const;
  let nearest: Readonly<{
    readonly body: SurfaceRigidBodyState;
    readonly collider: SurfaceRigidBodyColliderBox;
    readonly normal: SpatialVector3;
    readonly distanceMeters: number;
  }> | null = null;
  const halfSegmentMeters = capsule.heightMeters / 2 - capsule.radiusMeters;

  for (const directionBody of bodies) {
    for (const localDirection of localDirections) {
      const direction = rotateSpatialVector(directionBody.orientation, localDirection);
      const intervals: Array<Readonly<{
        readonly start: number;
        readonly end: number;
        readonly body: SurfaceRigidBodyState;
        readonly collider: SurfaceRigidBodyColliderBox;
      }>> = [];
      for (const body of bodies) {
        const inverseOrientation = inverseBodyOrientation(body);
        const localPosition = bodyLocalPoint(body, inverseOrientation, positionMeters);
        const localRayDirection = bodyLocalDirection(inverseOrientation, direction);
        const localUp = bodyLocalDirection(inverseOrientation, spatialVector3(0, 1, 0));
        const expansion = {
          x: capsule.radiusMeters + Math.abs(localUp.x) * halfSegmentMeters,
          y: capsule.radiusMeters + Math.abs(localUp.y) * halfSegmentMeters,
          z: capsule.radiusMeters + Math.abs(localUp.z) * halfSegmentMeters
        };
        const colliders = orderedBodyNarrowphaseCollidersForQuery(body, (broadphase) => {
          const bounds = colliderLocalBounds(broadphase, expansion);
          return localSlabInterval(
            localPosition,
            localRayDirection,
            bounds.minimum,
            bounds.maximum
          ) !== null;
        });
        for (const collider of colliders) {
          const bounds = colliderLocalBounds(collider, expansion);
          const interval = localSlabInterval(
            localPosition,
            localRayDirection,
            bounds.minimum,
            bounds.maximum
          );
          if (interval !== null) intervals.push({ ...interval, body, collider });
        }
      }
      intervals.sort((left, right) =>
        left.start - right.start
        || compareCodeUnits(left.body.bodyId, right.body.bodyId)
        || left.collider.colliderIndex - right.collider.colliderIndex);
      let coverageEnd = 0;
      let blocker: typeof intervals[number] | null = null;
      for (const interval of intervals) {
        if (interval.start > coverageEnd + boundaryClearanceMeters) break;
        if (interval.end > coverageEnd) {
          coverageEnd = interval.end;
          blocker = interval;
        }
      }
      if (blocker === null) continue;
      const distanceMeters = coverageEnd + boundaryClearanceMeters;
      if (nearest === null || distanceMeters < nearest.distanceMeters) {
        nearest = {
          body: blocker.body,
          collider: blocker.collider,
          normal: direction,
          distanceMeters
        };
      }
    }
  }
  return nearest;
};

export const separateSurfaceRigidBodyCapsule = (
  world: Readonly<SurfaceRigidBodyWorld>,
  query: SurfaceRigidBodyCapsuleSeparationQuery
): Readonly<SurfaceRigidBodyCapsuleSeparationResult> => {
  const capsule = checkedCapsule(query.capsule);
  const skinMeters = finite(query.skinMeters, "rigidBodySeparation.skinMeters");
  if (skinMeters < 0) throw new TypeError("Rigid-body separation skin must be non-negative.");
  let positionMeters = createSpatialVector3(
    query.positionMeters,
    "/rigidBodySeparation/positionMeters"
  );
  const sourcePositionMeters = positionMeters;
  const contacts: SurfaceRigidBodyCapsuleSeparationContact[] = [];
  const boundaryClearanceMeters = skinMeters + 1e-9;

  for (
    let iteration = 0;
    iteration < SURFACE_RIGID_BODY_CAPSULE_SEPARATION_MAX_ITERATIONS;
    iteration += 1
  ) {
    const overlap = capsuleUnionSeparationCandidate(
      world,
      capsule,
      positionMeters,
      boundaryClearanceMeters
    );
    if (overlap === null) break;
    const correctionDistanceMeters = overlap.distanceMeters;
    positionMeters = createSpatialVector3({
      x: positionMeters.x + overlap.normal.x * correctionDistanceMeters,
      y: positionMeters.y + overlap.normal.y * correctionDistanceMeters,
      z: positionMeters.z + overlap.normal.z * correctionDistanceMeters
    });
    contacts.push(Object.freeze({
      bodyId: overlap.body.bodyId,
      componentId: overlap.body.componentId,
      colliderIndex: overlap.collider.colliderIndex,
      normal: overlap.normal,
      correctionDistanceMeters
    }));
  }

  const blocked = capsuleOverlapCandidate(world, capsule, positionMeters) !== null;
  return Object.freeze({
    status: contacts.length === 0 ? "Clear" : blocked ? "Blocked" : "Separated",
    positionMeters: blocked ? sourcePositionMeters : positionMeters,
    iterations: contacts.length,
    contacts: Object.freeze(contacts)
  });
};
