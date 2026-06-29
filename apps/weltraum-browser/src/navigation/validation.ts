import type {
  ArrivalEnvelope,
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
import { distance } from "../core/vector";
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
  options: Pick<RouteValidationIssue, "targetId" | "obstacleId"> & { readonly severity?: RouteValidationIssue["severity"] } = {}
): RouteValidationIssue => ({ code, message, severity: options.severity ?? "Reject", targetId: options.targetId, obstacleId: options.obstacleId });

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

export const validateRouteSegments = (context: PlannerContext, segments: readonly RouteSegment[], validation: RouteValidationResult): RouteValidationResult => {
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

  return validationResult(issues);
};

export const scoreRouteCandidate = (context: PlannerContext, segments: readonly RouteSegment[]): RouteScore => {
  const distanceTotal = round4(segments.reduce((sum, segment) => sum + distance(segment.start, segment.end), 0));
  const clearanceRisk = round4(segments.reduce((sum, segment) => sum + 1 / Math.max(1, segment.clearanceRadius), 0));
  const massTonnes = Math.max(0.001, context.ship.mass.totalMass / 1_000);
  const fuelCostEstimate = round4(distanceTotal * massTonnes * context.ship.fuel.burnRate * 0.01);
  const authorityRisk = context.ship.authority.reasonCodes.length + context.ship.fuel.reasonCodes.length;
  const total = round4(distanceTotal + segments.length * 10 + clearanceRisk * 100 + fuelCostEstimate * 5 + authorityRisk * 50);

  return {
    distance: distanceTotal,
    segmentCount: segments.length,
    clearanceRisk,
    fuelCostEstimate,
    authorityRisk,
    total,
    reasons: [`segments:${segments.length}`, `distance:${distanceTotal}`, `clearanceRisk:${clearanceRisk}`]
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
