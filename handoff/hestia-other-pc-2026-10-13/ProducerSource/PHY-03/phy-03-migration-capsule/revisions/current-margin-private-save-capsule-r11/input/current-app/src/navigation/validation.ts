import { canonicalCloneAndDeepFreeze, planHashFor } from "../core/hash";
import type {
  ArrivalEnvelope,
  LockedRouteMotionProfile,
  ObstacleDescriptor,
  PlannerContext,
  RouteCandidate,
  RoutePlan,
  RoutePlanningResult,
  RouteScore,
  RouteSegment,
  RouteValidationIssue,
  RouteValidationReasonCode,
  RouteValidationResult,
  TargetDescriptor,
  TargetDescriptorKind
} from "../core/types";
import { distance, dot, projectPointOnSegment, sub } from "../core/vector";
import { estimateBrakingReserve } from "../flight/state";

const supportedRuntimeKinds: readonly TargetDescriptorKind[] = ["Waypoint", "Point"];
const supportedStopBehaviors: readonly string[] = ["NoStopRequired", "StopWithinEnvelope", "MatchTerminalSpeed"];

const round4 = (value: number): number => Number(value.toFixed(4));
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isFiniteVec3 = (value: unknown): value is TargetDescriptor["position"] =>
  Boolean(value) &&
  typeof value === "object" &&
  isFiniteNumber((value as TargetDescriptor["position"]).x) &&
  isFiniteNumber((value as TargetDescriptor["position"]).y) &&
  isFiniteNumber((value as TargetDescriptor["position"]).z);

const issue = (
  code: RouteValidationReasonCode,
  message: string,
  options: Pick<RouteValidationIssue, "targetId" | "obstacleId" | "segmentId"> & { readonly severity?: RouteValidationIssue["severity"] } = {}
): RouteValidationIssue => ({
  code,
  message,
  severity: options.severity ?? "Reject",
  ...(options.targetId !== undefined ? { targetId: options.targetId } : {}),
  ...(options.obstacleId !== undefined ? { obstacleId: options.obstacleId } : {}),
  ...(options.segmentId !== undefined ? { segmentId: options.segmentId } : {})
});

export const createRouteValidationIssue = issue;

export const arrivalEnvelopeForTarget = (target: TargetDescriptor | null | undefined): ArrivalEnvelope | null => {
  if (target?.arrivalEnvelope) {
    return target.arrivalEnvelope;
  }

  if (isFiniteNumber(target?.arrivalRadius)) {
    return { radius: target.arrivalRadius, stopBehavior: "NoStopRequired" };
  }

  return null;
};

export const arrivalRadiusForTarget = (target: TargetDescriptor | null | undefined): number => arrivalEnvelopeForTarget(target)?.radius ?? Number.NaN;

/**
 * The planner-side terminal constraint mirrors the existing executor gate:
 * stop/capture routes never accept more than 0.5 m/s, while MatchTerminalSpeed
 * retains its declared target. No-stop targets intentionally have no terminal
 * speed constraint.
 */
export const terminalSpeedForTarget = (target: TargetDescriptor | null | undefined): number | undefined => {
  const envelope = arrivalEnvelopeForTarget(target);
  if (!envelope) {
    return undefined;
  }
  if (envelope.stopBehavior === "StopWithinEnvelope") {
    return Math.min(0.5, envelope.terminalSpeed ?? 0.5);
  }
  if (envelope.stopBehavior === "MatchTerminalSpeed") {
    return envelope.terminalSpeed ?? 0;
  }
  return undefined;
};

export const validateTargetDescriptor = (target: TargetDescriptor | null | undefined): RouteValidationResult => {
  const issues: RouteValidationIssue[] = [];
  const targetId = typeof target?.id === "string" && target.id.trim().length > 0 ? target.id : undefined;

  if (!target || typeof target !== "object") {
    issues.push(issue("InvalidTarget", "Target descriptor is missing."));
    return validationResult(issues);
  }

  if (!targetId) {
    issues.push(issue("InvalidTarget", "Target id is required."));
  }
  if (typeof target.label !== "string" || target.label.trim().length === 0) {
    issues.push(issue("InvalidTarget", "Target label is required.", { targetId }));
  }
  if (!isFiniteVec3(target.position)) {
    issues.push(issue("InvalidTarget", "Target position must be a finite Vec3.", { targetId }));
  }
  if (!supportedRuntimeKinds.includes(target.kind)) {
    issues.push(issue("UnsupportedTargetKind", `Target kind ${String(target.kind)} is not executable in this v1 slice.`, { targetId }));
  }

  const envelope = arrivalEnvelopeForTarget(target);
  if (!envelope) {
    issues.push(issue("ImpossibleArrivalEnvelope", "Arrival envelope is required.", { targetId }));
  } else {
    if (!isFiniteNumber(envelope.radius) || envelope.radius <= 0) {
      issues.push(issue("ImpossibleArrivalEnvelope", "Arrival envelope radius must be a positive finite number.", { targetId }));
    }
    if (envelope.terminalSpeed !== undefined && (!isFiniteNumber(envelope.terminalSpeed) || envelope.terminalSpeed < 0)) {
      issues.push(issue("ImpossibleArrivalEnvelope", "Arrival envelope terminal speed must be a non-negative finite number.", { targetId }));
    }
    if (envelope.stopBehavior !== undefined && !supportedStopBehaviors.includes(envelope.stopBehavior)) {
      issues.push(issue("ImpossibleArrivalEnvelope", "Arrival envelope stop behavior is not supported.", { targetId }));
    }
  }

  return validationResult(issues);
};

export const validatePlanningContext = (context: PlannerContext): RouteValidationResult => {
  const issues: RouteValidationIssue[] = [...validateTargetDescriptor(context.target).issues];
  const envelope = arrivalEnvelopeForTarget(context.target);

  if (isFiniteVec3(context.target?.position) && envelope && isFiniteNumber(envelope.radius) && envelope.radius > 0) {
    for (const obstacle of context.obstacles ?? []) {
      const obstacleId = typeof obstacle?.id === "string" && obstacle.id.trim().length > 0 ? obstacle.id : undefined;
      if (!isValidObstacle(obstacle)) {
        issues.push(issue("UnsafeObstacle", "Obstacle center, radius, and padding must be finite non-negative values.", { targetId: context.target.id, obstacleId }));
        continue;
      }

      const unsafeDistance = obstacle.radius + obstacle.padding + envelope.radius;
      if (distance(context.target.position, obstacle.center) <= unsafeDistance) {
        issues.push(
          issue("UnsafeObstacle", `Target envelope overlaps obstacle ${obstacle.id}.`, {
            targetId: context.target.id,
            obstacleId: obstacle.id
          })
        );
      }
    }
  }

  const brakingReserve = estimateBrakingReserve(context.ship, null);
  for (const code of brakingReserve.reasonCodes) {
    if (code === "FuelInsufficient" || code === "FuelReserveViolated" || code === "MainThrustersUnavailable" || code === "AutopilotUnavailable" || code === "AuthorityInsufficient" || code === "BrakeReserveInsufficient") {
      issues.push(issue(code, `Operational route constraint is present: ${code}.`, { targetId: context.target?.id, severity: "Warning" }));
    }
  }

  return validationResult(issues);
};

export const validateRouteSegments = (
  context: PlannerContext,
  segments: readonly RouteSegment[],
  validation: RouteValidationResult,
  motionProfile?: LockedRouteMotionProfile
): RouteValidationResult => {
  const issues: RouteValidationIssue[] = [...validation.issues];
  const targetId = typeof context.target?.id === "string" && context.target.id.trim().length > 0 ? context.target.id : undefined;

  if (!validation.ok) {
    return validationResult(issues);
  }

  const terminalSegment = segments.at(-1);
  if (!terminalSegment) {
    issues.push(issue("InvalidTarget", "Route plan must contain at least one segment.", { targetId }));
  } else if (!isFiniteVec3(terminalSegment.end) || !isFiniteVec3(context.target?.position) || distance(terminalSegment.end, context.target.position) > 1e-6) {
    issues.push(issue("InvalidTarget", "Terminal route segment must end at the target position.", { targetId }));
  }

  const orderedObstacles = orderObstaclesForRoute(context);
  for (const violation of findUnsafeRouteSegmentViolations(segments, orderedObstacles)) {
    issues.push(
      issue("UnsafeRouteSegment", `Route segment ${violation.segment.id} intersects obstacle envelope ${violation.obstacle.id}.`, {
        targetId,
        obstacleId: violation.obstacle.id,
        segmentId: violation.segment.id
      })
    );
  }

  if (motionProfile) {
    validateLockedMotionProfile(context, segments, motionProfile, issues, targetId);
  }

  return validationResult(issues);
};

export interface UnsafeRouteSegmentViolation {
  readonly segmentIndex: number;
  readonly obstacleIndex: number;
  readonly segment: RouteSegment;
  readonly obstacle: ObstacleDescriptor;
  readonly clearance: number;
  readonly requiredClearance: number;
}

export const findUnsafeRouteSegmentViolations = (segments: readonly RouteSegment[], obstacles: readonly ObstacleDescriptor[]): readonly UnsafeRouteSegmentViolation[] => {
  const violations: UnsafeRouteSegmentViolation[] = [];

  segments.forEach((segment, segmentIndex) => {
    obstacles.forEach((obstacle, obstacleIndex) => {
      if (!isValidObstacle(obstacle)) {
        return;
      }

      const closest = projectPointOnSegment(obstacle.center, segment.start, segment.end);
      const clearance = distance(closest, obstacle.center);
      const requiredClearance = obstacle.radius + obstacle.padding;
      if (clearance <= requiredClearance) {
        violations.push({ segmentIndex, obstacleIndex, segment, obstacle, clearance, requiredClearance });
      }
    });
  });

  return violations;
};

export const findFirstUnsafeRouteSegmentViolation = (segments: readonly RouteSegment[], obstacles: readonly ObstacleDescriptor[]): UnsafeRouteSegmentViolation | null => findUnsafeRouteSegmentViolations(segments, obstacles)[0] ?? null;

export const scoreRouteCandidate = (context: PlannerContext, segments: readonly RouteSegment[]): RouteScore => {
  const distanceTotal = round4(segments.reduce((sum, segment) => sum + distance(segment.start, segment.end), 0));
  const clearanceRisk = round4(segments.reduce((sum, segment) => sum + 1 / Math.max(1, segment.clearanceRadius), 0));
  const plannerComplexity = segments.filter((segment) => segment.kind === "Avoidance").length;
  const massTonnes = Math.max(0.001, context.ship.mass.totalMass / 1_000);
  const fuelCostEstimate = round4(distanceTotal * massTonnes * context.ship.fuel.burnRate * 0.01);
  const authorityRisk = context.ship.authority.reasonCodes.length + context.ship.fuel.reasonCodes.length;
  const total = round4(distanceTotal + segments.length * 10 + plannerComplexity * 5 + clearanceRisk * 100 + fuelCostEstimate * 5 + authorityRisk * 50);

  return {
    distance: distanceTotal,
    segmentCount: segments.length,
    clearanceRisk,
    fuelCostEstimate,
    authorityRisk,
    total,
    reasons: [`segments:${segments.length}`, `distance:${distanceTotal}`, `clearanceRisk:${clearanceRisk}`, `plannerComplexity:${plannerComplexity}`]
  };
};

export const createRouteCandidate = (
  planner: RoutePlan["planner"],
  context: PlannerContext,
  segments: readonly RouteSegment[],
  validation: RouteValidationResult
): RouteCandidate => {
  const score = scoreRouteCandidate(context, segments);
  return {
    id: `${planner}:${context.target.id}:${context.tick}:candidate-0`,
    planner,
    target: context.target,
    segments,
    validation,
    score
  };
};

export const rejectionFor = (
  planner: RoutePlan["planner"],
  context: PlannerContext,
  validation: RouteValidationResult,
  candidate?: RouteCandidate
): RoutePlanningResult => ({
  ok: false,
  rejection: {
    planner,
    targetId: typeof context.target?.id === "string" ? context.target.id : null,
    reasonCodes: validation.rejectedReasonCodes,
    issues: validation.issues.filter((candidateIssue) => candidateIssue.severity === "Reject")
  },
  validation,
  candidate
});

const validationResult = (issues: readonly RouteValidationIssue[]): RouteValidationResult => ({
  ok: !issues.some((candidate) => candidate.severity === "Reject"),
  issues,
  rejectedReasonCodes: [...new Set(issues.filter((candidate) => candidate.severity === "Reject").map((candidate) => candidate.code))]
});

export const createRouteValidationResult = validationResult;

/** Builds the canonical immutable route payload before its hash is exposed. */
export const createCanonicalLockedRoutePlan = (planWithoutHash: Omit<RoutePlan, "planHash">): RoutePlan => {
  const canonicalPayload = canonicalCloneAndDeepFreeze(planWithoutHash);
  return canonicalCloneAndDeepFreeze({
    ...canonicalPayload,
    planHash: planHashFor(canonicalPayload)
  });
};

/**
 * Re-clones a route at the executor boundary and rejects any mutation whose
 * payload no longer matches the original planner hash.
 */
export const canonicalizeLockedRoutePlan = (plan: RoutePlan): RoutePlan => {
  const canonicalPlan = canonicalCloneAndDeepFreeze(plan);
  const expectedHash = planHashFor(canonicalPlan);
  if (canonicalPlan.planHash !== expectedHash) {
    throw new RangeError(`Locked route hash mismatch: expected ${expectedHash}, received ${canonicalPlan.planHash}.`);
  }
  return canonicalPlan;
};

const isFiniteNonNegative = (value: unknown): value is number => isFiniteNumber(value) && value >= 0;

const hasFiniteMotionProfile = (profile: LockedRouteMotionProfile): boolean =>
  profile.version === 1 &&
  isFiniteNonNegative(profile.targetAccelerationMps2) &&
  isFiniteNonNegative(profile.maximumAccelerationMps2) &&
  isFiniteNonNegative(profile.maximumJerkMps3) &&
  (profile.maximumPeakSpeedMps === undefined || isFiniteNonNegative(profile.maximumPeakSpeedMps)) &&
  isFiniteNumber(profile.coastFraction) &&
  profile.coastFraction >= 0 &&
  profile.coastFraction <= 1 &&
  isFiniteNumber(profile.brakingReserveMultiplier) &&
  profile.brakingReserveMultiplier > 0 &&
  isFiniteNonNegative(profile.plannedUsableMainAccelerationMps2) &&
  isFiniteNonNegative(profile.plannedUsableBrakingAccelerationMps2) &&
  isFiniteNonNegative(profile.mainThrustAlignmentToleranceRadians) &&
  isFiniteNonNegative(profile.flipCompletionToleranceRadians) &&
  profile.phaseVocabulary.length > 0;

const hasFiniteMotionConstraint = (segment: RouteSegment): boolean => {
  const constraint = segment.motionConstraint;
  if (!constraint || constraint.version !== 1) {
    return false;
  }
  const turn = constraint.turnConstraint;
  return (
    isFiniteNonNegative(constraint.entrySpeedMps) &&
    isFiniteNonNegative(constraint.exitSpeedMps) &&
    (constraint.terminalSpeedMps === undefined || isFiniteNonNegative(constraint.terminalSpeedMps)) &&
    (constraint.maximumPeakSpeedMps === undefined || isFiniteNonNegative(constraint.maximumPeakSpeedMps)) &&
    isFiniteNonNegative(constraint.plannedUsableMainAccelerationMps2) &&
    isFiniteNonNegative(constraint.plannedUsableBrakingAccelerationMps2) &&
    turn.version === 1 &&
    isFiniteNonNegative(turn.turnAngleRadians) &&
    isFiniteNonNegative(turn.effectiveCornerRadiusM) &&
    isFiniteNonNegative(turn.lateralAccelerationLimitMps2) &&
    isFiniteNonNegative(turn.attitudeAngularAccelerationLimitRadps2) &&
    isFiniteNonNegative(turn.attitudeAngularVelocityLimitRadps) &&
    isFiniteNumber(turn.authorityScale) &&
    turn.authorityScale >= 0 &&
    turn.authorityScale <= 1 &&
    isFiniteNonNegative(turn.nextSegmentBrakingAccelerationMps2) &&
    (turn.speedLimitMps === undefined || isFiniteNonNegative(turn.speedLimitMps))
  );
};

const validateLockedMotionProfile = (
  context: PlannerContext,
  segments: readonly RouteSegment[],
  profile: LockedRouteMotionProfile,
  issues: RouteValidationIssue[],
  targetId: string | undefined
): void => {
  if (!hasFiniteMotionProfile(profile)) {
    issues.push(issue("InvalidMotionProfile", "Locked route motion profile must contain finite serializable constraints.", { targetId }));
    return;
  }

  for (const segment of segments) {
    if (!hasFiniteMotionConstraint(segment)) {
      issues.push(issue("InvalidMotionProfile", `Route segment ${segment.id} is missing finite locked motion constraints.`, { targetId, segmentId: segment.id }));
    }
  }

  const terminalSegment = segments.at(-1);
  const expectedTerminalSpeed = terminalSpeedForTarget(context.target);
  const terminalConstraint = terminalSegment?.motionConstraint;
  if (!terminalSegment || expectedTerminalSpeed === undefined) {
    return;
  }
  if (
    !terminalConstraint ||
    terminalConstraint.terminalSpeedMps === undefined ||
    Math.abs(terminalConstraint.terminalSpeedMps - expectedTerminalSpeed) > 1e-6 ||
    terminalConstraint.exitSpeedMps > expectedTerminalSpeed + 1e-6
  ) {
    issues.push(
      issue("ImpossibleArrivalEnvelope", "Locked terminal motion constraint does not preserve the target arrival speed gate.", {
        targetId,
        segmentId: terminalSegment.id
      })
    );
  }
};

const obstacleSortKey = (context: PlannerContext, obstacle: ObstacleDescriptor) => {
  const route = sub(context.target.position, context.ship.position);
  const lengthSq = dot(route, route);
  const projection = lengthSq <= 1e-9 ? 0 : dot(sub(obstacle.center, context.ship.position), route) / lengthSq;
  return [projection, obstacle.id, obstacle.center.x, obstacle.center.y, obstacle.center.z, obstacle.radius, obstacle.padding] as const;
};

const compareNumbers = (a: number, b: number): number => (a < b ? -1 : a > b ? 1 : 0);

export const orderObstaclesForRoute = (context: PlannerContext): readonly ObstacleDescriptor[] =>
  [...(context.obstacles ?? [])].sort((a, b) => {
    const ak = obstacleSortKey(context, a);
    const bk = obstacleSortKey(context, b);
    return compareNumbers(ak[0], bk[0]) || ak[1].localeCompare(bk[1]) || compareNumbers(ak[2], bk[2]) || compareNumbers(ak[3], bk[3]) || compareNumbers(ak[4], bk[4]) || compareNumbers(ak[5], bk[5]) || compareNumbers(ak[6], bk[6]);
  });

const isValidObstacle = (obstacle: ObstacleDescriptor | null | undefined): obstacle is ObstacleDescriptor => {
  if (!obstacle || typeof obstacle !== "object") {
    return false;
  }

  return (
    isFiniteVec3(obstacle.center) &&
    isFiniteNumber(obstacle.radius) &&
    obstacle.radius >= 0 &&
    isFiniteNumber(obstacle.padding) &&
    obstacle.padding >= 0
  );
};

export const planOrThrow = (result: RoutePlanningResult): RoutePlan => {
  if (result.ok) {
    return result.plan;
  }

  throw new Error(`Route planning rejected: ${result.rejection.reasonCodes.join(",") || "Unknown"}`);
};
