import type {
  AuthorityState,
  FailureReasonCode,
  JsonValue,
  LockedRouteMotionProfile,
  LockedTransitPhase,
  NamespacedExtensionKey,
  OccupantAccelerationEnvelope,
  PlannerContext,
  ResolvedTransitPolicy,
  RouteSegment,
  RouteSegmentMotionConstraint,
  RouteTurnConstraint,
  ShipPropulsionCapability
} from "../core/types";
import type { Vec3 } from "../core/vector";
import { canonicalCloneAndDeepFreeze } from "../core/hash";
import { distance, dot, magnitude, sub } from "../core/vector";
import {
  assertValidOccupantAccelerationEnvelope,
  assertValidShipPropulsionCapability,
  deriveEffectiveMotionAuthority
} from "../flight/propulsionCapability";
import {
  defaultFlightModelOptions,
  defaultRcsTranslationAccelerationMps2,
  legacyCompatibilityAccelerationClampForMass
} from "../flight/state";
import { resolveTransitPolicy } from "../flight/transitPolicies";
import { terminalSpeedForTarget } from "./validation";

const EPSILON = 1e-6;
const ROUNDING_DECIMALS = 6;

export const lockedTransitPhaseVocabulary: readonly LockedTransitPhase[] = Object.freeze([
  "AlignForBurn",
  "Accelerate",
  "Coast",
  "Flip",
  "Brake",
  "TerminalCapture",
  "Holding"
]);

export const lockedTransitAlignmentTolerances = Object.freeze({
  mainThrustAlignmentToleranceRadians: 0.12,
  flipCompletionToleranceRadians: 0.08
});

export interface LockedRouteMotionResult {
  readonly motionProfile: LockedRouteMotionProfile;
  readonly segments: readonly RouteSegment[];
}

const finiteNonNegative = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number.`);
  }
  return value;
};

const rounded = (value: number, label: string): number =>
  Number(finiteNonNegative(value, label).toFixed(ROUNDING_DECIMALS));

const clamp = (value: number, lower: number, upper: number): number => Math.min(upper, Math.max(lower, value));

const authorityScaleFor = (value: number, label: string): number => clamp(finiteNonNegative(value, label), 0, 1);

const snapshotCapability = (capability: ShipPropulsionCapability): ShipPropulsionCapability => {
  assertValidShipPropulsionCapability(capability);
  const extensions = capability.extensions === undefined
    ? undefined
    : Object.freeze(
        Object.keys(capability.extensions)
          .sort()
          .reduce<Partial<Record<NamespacedExtensionKey, JsonValue>>>((copy, key) => {
            const extensionKey = key as NamespacedExtensionKey;
            const value = capability.extensions?.[extensionKey];
            if (value !== undefined) {
              copy[extensionKey] = canonicalCloneAndDeepFreeze(value);
            }
            return copy;
          }, {})
      );

  return Object.freeze({
    version: 1,
    mainThrustNewton: capability.mainThrustNewton,
    effectiveBrakingThrustNewton: capability.effectiveBrakingThrustNewton,
    structuralMaxAccelerationMps2: capability.structuralMaxAccelerationMps2,
    sustainedThermalMaxAccelerationMps2: capability.sustainedThermalMaxAccelerationMps2,
    maximumPeakAccelerationMps2: capability.maximumPeakAccelerationMps2,
    maximumAngularAcceleration: capability.maximumAngularAcceleration,
    maximumAngularVelocity: capability.maximumAngularVelocity,
    ...(capability.maximumCruiseSpeedMps === undefined ? {} : { maximumCruiseSpeedMps: capability.maximumCruiseSpeedMps }),
    ...(capability.fuelEfficiency === undefined
      ? {}
      : { fuelEfficiency: Object.freeze({ ...capability.fuelEfficiency }) }),
    ...(capability.heat === undefined ? {} : { heat: Object.freeze({ ...capability.heat }) }),
    ...(extensions === undefined ? {} : { extensions })
  });
};

const snapshotOccupantEnvelope = (envelope: OccupantAccelerationEnvelope): OccupantAccelerationEnvelope => {
  assertValidOccupantAccelerationEnvelope(envelope);
  return Object.freeze({
    version: 1,
    occupantMode: envelope.occupantMode,
    preferredAccelerationMps2: envelope.preferredAccelerationMps2,
    minimumComfortAccelerationMps2: envelope.minimumComfortAccelerationMps2,
    ...(envelope.maximumSustainedAccelerationMps2 === undefined
      ? {}
      : { maximumSustainedAccelerationMps2: envelope.maximumSustainedAccelerationMps2 }),
    ...(envelope.maximumPeakAccelerationMps2 === undefined
      ? {}
      : { maximumPeakAccelerationMps2: envelope.maximumPeakAccelerationMps2 }),
    maximumJerkMps3: envelope.maximumJerkMps3,
    gravityFloorPolicy: envelope.gravityFloorPolicy
  });
};

const snapshotResolvedPolicy = (policy: ResolvedTransitPolicy): ResolvedTransitPolicy =>
  Object.freeze({
    version: 1,
    requestedPolicyId: policy.requestedPolicyId,
    resolvedPolicyId: policy.resolvedPolicyId,
    ...(policy.targetAccelerationMps2 === undefined ? {} : { targetAccelerationMps2: policy.targetAccelerationMps2 }),
    ...(policy.targetAccelerationFraction === undefined ? {} : { targetAccelerationFraction: policy.targetAccelerationFraction }),
    maximumAccelerationMps2: policy.maximumAccelerationMps2,
    maximumJerkMps3: policy.maximumJerkMps3,
    ...(policy.maximumPeakSpeedMps === undefined ? {} : { maximumPeakSpeedMps: policy.maximumPeakSpeedMps }),
    coastAllowed: policy.coastAllowed,
    coastFraction: policy.coastFraction,
    minimumTime: policy.minimumTime,
    brakingReserveMultiplier: policy.brakingReserveMultiplier,
    turnBehavior: policy.turnBehavior,
    waypointBehavior: policy.waypointBehavior,
    gravityFloorPolicy: policy.gravityFloorPolicy
  });

const snapshotAuthority = (authority: AuthorityState): AuthorityState => {
  finiteNonNegative(authority.translationAuthority, "authority.translationAuthority");
  finiteNonNegative(authority.rotationAuthority, "authority.rotationAuthority");
  const reasonCodes = Object.freeze([...authority.reasonCodes].sort()) as readonly FailureReasonCode[];
  return Object.freeze({
    mode: authority.mode,
    autopilotAvailable: authority.autopilotAvailable,
    mainThrustersAvailable: authority.mainThrustersAvailable,
    rcsAvailable: authority.rcsAvailable,
    sasAvailable: authority.sasAvailable,
    translationAuthority: authority.translationAuthority,
    rotationAuthority: authority.rotationAuthority,
    reasonCodes
  });
};

const minimumDefined = (values: readonly (number | undefined)[]): number | undefined => {
  const finiteValues = values.filter((value): value is number => value !== undefined);
  return finiteValues.length === 0 ? undefined : Math.min(...finiteValues);
};

const policyFor = (context: PlannerContext): ResolvedTransitPolicy =>
  resolveTransitPolicy(context.transitPolicy ?? context.speedProfile ?? "Balanced", context.customTransitPolicyConstraints);

const createMotionProfile = (context: PlannerContext): LockedRouteMotionProfile => {
  const resolvedPolicy = snapshotResolvedPolicy(policyFor(context));
  const propulsionCapability = snapshotCapability(context.propulsionCapability ?? context.ship.propulsionCapability);
  const occupantAccelerationEnvelope = snapshotOccupantEnvelope(context.occupantAccelerationEnvelope ?? context.ship.occupantAccelerationEnvelope);
  const planningAuthority = snapshotAuthority(context.ship.authority);
  const authority = deriveEffectiveMotionAuthority({
    mass: context.ship.mass,
    liveCapability: propulsionCapability,
    liveOccupantAccelerationEnvelope: occupantAccelerationEnvelope,
    policy: resolvedPolicy
    ,
    ...(context.transitPolicy === undefined
      ? { compatibilityMaximumAccelerationMps2: legacyCompatibilityAccelerationClampForMass(context.ship.mass, defaultFlightModelOptions) }
      : {})
  });
  const maximumPeakSpeedMps = minimumDefined([
    resolvedPolicy.maximumPeakSpeedMps,
    propulsionCapability.maximumCruiseSpeedMps
  ]);

  return Object.freeze({
    version: 1,
    requestedPolicyId: resolvedPolicy.requestedPolicyId,
    resolvedPolicy,
    occupantAccelerationEnvelope,
    propulsionCapability,
    planningAuthority,
    targetAccelerationMps2: rounded(authority.mainAccelerationMps2, "targetAccelerationMps2"),
    maximumAccelerationMps2: rounded(resolvedPolicy.maximumAccelerationMps2, "maximumAccelerationMps2"),
    maximumJerkMps3: rounded(resolvedPolicy.maximumJerkMps3, "maximumJerkMps3"),
    ...(maximumPeakSpeedMps === undefined ? {} : { maximumPeakSpeedMps: rounded(maximumPeakSpeedMps, "maximumPeakSpeedMps") }),
    coastAllowed: resolvedPolicy.coastAllowed,
    coastFraction: rounded(resolvedPolicy.coastFraction, "coastFraction"),
    minimumTime: resolvedPolicy.minimumTime,
    brakingReserveMultiplier: rounded(resolvedPolicy.brakingReserveMultiplier, "brakingReserveMultiplier"),
    turnBehavior: resolvedPolicy.turnBehavior,
    waypointBehavior: resolvedPolicy.waypointBehavior,
    gravityFloorPolicy: resolvedPolicy.gravityFloorPolicy,
    plannedUsableMainAccelerationMps2: rounded(authority.mainAccelerationMps2, "plannedUsableMainAccelerationMps2"),
    plannedUsableBrakingAccelerationMps2: rounded(authority.brakingAccelerationMps2, "plannedUsableBrakingAccelerationMps2"),
    mainThrustAlignmentToleranceRadians: lockedTransitAlignmentTolerances.mainThrustAlignmentToleranceRadians,
    flipCompletionToleranceRadians: lockedTransitAlignmentTolerances.flipCompletionToleranceRadians,
    phaseVocabulary: lockedTransitPhaseVocabulary
  });
};

const segmentDirection = (segment: RouteSegment): Vec3 | null => {
  const offset = sub(segment.end, segment.start);
  const length = magnitude(offset);
  if (!Number.isFinite(length) || length <= EPSILON) {
    return null;
  }
  return {
    x: offset.x / length,
    y: offset.y / length,
    z: offset.z / length
  };
};

const turnBehaviorScaleFor = (profile: LockedRouteMotionProfile): number =>
  profile.turnBehavior === "Conservative" ? 0.75 : profile.turnBehavior === "Aggressive" ? 1.2 : 1;

const waypointBehaviorScaleFor = (profile: LockedRouteMotionProfile): number =>
  profile.waypointBehavior === "PreserveMomentum" ? 1.1 : 0.9;

const effectiveAuthorityScaleFor = (profile: LockedRouteMotionProfile): number => {
  const translationAuthority = profile.planningAuthority.mainThrustersAvailable
    ? authorityScaleFor(profile.planningAuthority.translationAuthority, "authority.translationAuthority")
    : 0;
  const rotationAuthority = profile.planningAuthority.rcsAvailable || profile.planningAuthority.sasAvailable
    ? authorityScaleFor(profile.planningAuthority.rotationAuthority, "authority.rotationAuthority")
    : 0;
  return Math.min(translationAuthority, rotationAuthority);
};

const turnConstraintFor = (
  segments: readonly RouteSegment[],
  index: number,
  profile: LockedRouteMotionProfile
): RouteTurnConstraint => {
  const segment = segments[index];
  const nextSegment = segments[index + 1];
  const clearanceRadius = finiteNonNegative(segment.clearanceRadius, `segment ${segment.id} clearanceRadius`);
  const authorityScale = effectiveAuthorityScaleFor(profile);
  const rotationScale = profile.planningAuthority.rcsAvailable || profile.planningAuthority.sasAvailable
    ? authorityScaleFor(profile.planningAuthority.rotationAuthority, "authority.rotationAuthority")
    : 0;
  const angularAcceleration = rounded(
    profile.propulsionCapability.maximumAngularAcceleration * rotationScale,
    "attitudeAngularAccelerationLimitRadps2"
  );
  const angularVelocity = rounded(
    profile.propulsionCapability.maximumAngularVelocity * rotationScale,
    "attitudeAngularVelocityLimitRadps"
  );
  const nextBrakingAcceleration = rounded(
    profile.plannedUsableBrakingAccelerationMps2,
    "nextSegmentBrakingAccelerationMps2"
  );

  if (!nextSegment) {
    return Object.freeze({
      version: 1,
      kind: segment.kind === "Terminal" ? "Terminal" : "Straight",
      turnAngleRadians: 0,
      effectiveCornerRadiusM: rounded(Math.max(0.5, clearanceRadius), "effectiveCornerRadiusM"),
      lateralAccelerationLimitMps2: 0,
      attitudeAngularAccelerationLimitRadps2: angularAcceleration,
      attitudeAngularVelocityLimitRadps: angularVelocity,
      authorityScale: rounded(authorityScale, "authorityScale"),
      nextSegmentBrakingAccelerationMps2: nextBrakingAcceleration
    });
  }

  const direction = segmentDirection(segment);
  const nextDirection = segmentDirection(nextSegment);
  if (!direction || !nextDirection) {
    const nextCornerClearanceRadius = nextSegment.kind === "Terminal"
      ? clearanceRadius
      : Math.min(clearanceRadius, finiteNonNegative(nextSegment.clearanceRadius, `segment ${nextSegment.id} clearanceRadius`));
    return Object.freeze({
      version: 1,
      kind: "Straight",
      turnAngleRadians: 0,
      effectiveCornerRadiusM: rounded(Math.max(0.5, nextCornerClearanceRadius), "effectiveCornerRadiusM"),
      lateralAccelerationLimitMps2: 0,
      attitudeAngularAccelerationLimitRadps2: angularAcceleration,
      attitudeAngularVelocityLimitRadps: angularVelocity,
      authorityScale: rounded(authorityScale, "authorityScale"),
      nextSegmentBrakingAccelerationMps2: nextBrakingAcceleration
    });
  }

  const angle = Math.acos(clamp(dot(direction, nextDirection), -1, 1));
  const nextClearanceRadius = finiteNonNegative(nextSegment.clearanceRadius, `segment ${nextSegment.id} clearanceRadius`);
  const cornerClearanceRadius = nextSegment.kind === "Terminal" ? clearanceRadius : Math.min(clearanceRadius, nextClearanceRadius);
  const effectiveCornerRadiusM = Math.max(
    0.5,
    cornerClearanceRadius / Math.max(0.05, Math.sin(angle / 2))
  );

  if (angle <= 0.001) {
    return Object.freeze({
      version: 1,
      kind: "Straight",
      turnAngleRadians: rounded(angle, "turnAngleRadians"),
      effectiveCornerRadiusM: rounded(effectiveCornerRadiusM, "effectiveCornerRadiusM"),
      lateralAccelerationLimitMps2: 0,
      attitudeAngularAccelerationLimitRadps2: angularAcceleration,
      attitudeAngularVelocityLimitRadps: angularVelocity,
      authorityScale: rounded(authorityScale, "authorityScale"),
      nextSegmentBrakingAccelerationMps2: nextBrakingAcceleration
    });
  }

  const lateralAcceleration = rounded(
    (profile.planningAuthority.rcsAvailable
      ? defaultRcsTranslationAccelerationMps2 * authorityScaleFor(profile.planningAuthority.translationAuthority, "authority.translationAuthority")
      : 0) * Math.min(1, turnBehaviorScaleFor(profile)),
    "lateralAccelerationLimitMps2"
  );
  const lateralSpeedLimit = lateralAcceleration <= EPSILON
    ? 0
    : Math.sqrt(lateralAcceleration * effectiveCornerRadiusM);
  const attitudeTurnTime = angularAcceleration <= EPSILON || angularVelocity <= EPSILON
    ? undefined
    : Math.max(Math.sqrt((2 * angle) / angularAcceleration), angle / angularVelocity);
  const attitudeSpeedLimit = attitudeTurnTime === undefined ? 0 : effectiveCornerRadiusM / attitudeTurnTime;
  const speedLimitMps = rounded(
    Math.min(lateralSpeedLimit, attitudeSpeedLimit) * Math.min(1, waypointBehaviorScaleFor(profile)),
    "turnSpeedLimitMps"
  );

  return Object.freeze({
    version: 1,
    kind: "Corner",
    turnAngleRadians: rounded(angle, "turnAngleRadians"),
    effectiveCornerRadiusM: rounded(effectiveCornerRadiusM, "effectiveCornerRadiusM"),
    lateralAccelerationLimitMps2: lateralAcceleration,
    attitudeAngularAccelerationLimitRadps2: angularAcceleration,
    attitudeAngularVelocityLimitRadps: angularVelocity,
    authorityScale: rounded(authorityScale, "authorityScale"),
    nextSegmentBrakingAccelerationMps2: nextBrakingAcceleration,
    speedLimitMps
  });
};

const speedAfterAcceleration = (speed: number, acceleration: number, segmentLength: number): number =>
  Math.sqrt(Math.max(0, speed * speed + 2 * acceleration * segmentLength));

const segmentLengthFor = (segment: RouteSegment): number =>
  rounded(distance(segment.start, segment.end), `segment ${segment.id} length`);

const pointSpeedsFor = (
  context: PlannerContext,
  segments: readonly RouteSegment[],
  profile: LockedRouteMotionProfile,
  turnConstraints: readonly RouteTurnConstraint[]
): readonly number[] => {
  const startSpeed = rounded(magnitude(context.ship.velocity), "initial route speed");
  const terminalSpeedMps = terminalSpeedForTarget(context.target);
  const pointCaps: Array<number | undefined> = Array.from({ length: segments.length + 1 }, () => undefined);
  pointCaps[0] = undefined;
  segments.forEach((_, index) => {
    pointCaps[index + 1] = index === segments.length - 1 ? terminalSpeedMps : turnConstraints[index].speedLimitMps;
  });

  const speeds = Array<number>(segments.length + 1).fill(0);
  speeds[0] = startSpeed;
  for (let index = 0; index < segments.length; index += 1) {
    const reachable = speedAfterAcceleration(
      speeds[index],
      profile.plannedUsableMainAccelerationMps2,
      segmentLengthFor(segments[index])
    );
    const pointCap = minimumDefined([pointCaps[index + 1], profile.maximumPeakSpeedMps]);
    speeds[index + 1] = rounded(pointCap === undefined ? reachable : Math.min(reachable, pointCap), `forward point speed ${index + 1}`);
  }

  for (let index = segments.length - 1; index >= 1; index -= 1) {
    const reachableWhileBraking = speedAfterAcceleration(
      speeds[index + 1],
      profile.plannedUsableBrakingAccelerationMps2,
      segmentLengthFor(segments[index])
    );
    speeds[index] = rounded(Math.min(speeds[index], reachableWhileBraking), `backward point speed ${index}`);
  }

  return Object.freeze(speeds);
};

const segmentPeakCapFor = (profile: LockedRouteMotionProfile): number | undefined => profile.maximumPeakSpeedMps;

const compatibilityDesiredSpeedFor = (
  context: PlannerContext,
  segment: RouteSegment,
  entrySpeedMps: number,
  exitSpeedMps: number,
  peakCap: number | undefined,
  profile: LockedRouteMotionProfile
): number => {
  if (context.transitPolicy === undefined) {
    return rounded(segment.desiredSpeed, `segment ${segment.id} legacy desiredSpeed`);
  }
  if (peakCap !== undefined) {
    return rounded(peakCap, `segment ${segment.id} compatibility desiredSpeed`);
  }
  return rounded(
    Math.max(
      entrySpeedMps,
      exitSpeedMps,
      speedAfterAcceleration(entrySpeedMps, profile.plannedUsableMainAccelerationMps2, segmentLengthFor(segment))
    ),
    `segment ${segment.id} compatibility desiredSpeed`
  );
};

/**
 * Locks policy, capability, authority, and finite speed constraints onto an
 * already validated route geometry. The forward pass limits what acceleration
 * can reach; the backward pass propagates next-segment braking and terminal
 * constraints without moving any route point.
 */
export const lockRouteMotionProfile = (
  context: PlannerContext,
  routeSegments: readonly RouteSegment[]
): LockedRouteMotionResult => {
  if (routeSegments.length === 0) {
    throw new RangeError("A locked motion profile requires at least one route segment.");
  }

  const motionProfile = createMotionProfile(context);
  const turnConstraints = routeSegments.map((_, index) => turnConstraintFor(routeSegments, index, motionProfile));
  const pointSpeeds = pointSpeedsFor(context, routeSegments, motionProfile, turnConstraints);
  const terminalSpeedMps = terminalSpeedForTarget(context.target);
  const segments = Object.freeze(routeSegments.map((segment, index) => {
    const peakCap = segmentPeakCapFor(motionProfile);
    const isTerminal = index === routeSegments.length - 1;
    const entrySpeedMps = pointSpeeds[index];
    const exitSpeedMps = pointSpeeds[index + 1];
    const motionConstraint: RouteSegmentMotionConstraint = Object.freeze({
      version: 1,
      entrySpeedMps,
      exitSpeedMps,
      ...(isTerminal && terminalSpeedMps !== undefined ? { terminalSpeedMps } : {}),
      ...(peakCap === undefined ? {} : { maximumPeakSpeedMps: rounded(peakCap, `segment ${segment.id} maximumPeakSpeedMps`) }),
      plannedUsableMainAccelerationMps2: motionProfile.plannedUsableMainAccelerationMps2,
      plannedUsableBrakingAccelerationMps2: motionProfile.plannedUsableBrakingAccelerationMps2,
      turnConstraint: turnConstraints[index]
    });
    return Object.freeze({
      ...segment,
      desiredSpeed: compatibilityDesiredSpeedFor(context, segment, entrySpeedMps, exitSpeedMps, peakCap, motionProfile),
      motionConstraint
    });
  }));

  return Object.freeze({ motionProfile, segments });
};
