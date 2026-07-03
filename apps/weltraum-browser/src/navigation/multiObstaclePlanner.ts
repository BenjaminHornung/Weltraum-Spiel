import { autopilotSpeedProfileFor } from "../core/types";
import type { ObstacleDescriptor, PlannerContext, RouteSegment, RouteValidationReasonCode, RouteValidationResult, RouteValidationIssue } from "../core/types";
import type { Vec3 } from "../core/vector";
import { add, cross, distance, dot, magnitude, normalize, projectPointOnSegment, roundVec, scale, sub, vec3 } from "../core/vector";
import { arrivalRadiusForTarget, createRouteValidationIssue, createRouteValidationResult, findFirstUnsafeRouteSegmentViolation, findUnsafeRouteSegmentViolations, orderObstaclesForRoute, validateRouteSegments } from "./validation";

export const multiObstaclePlannerLimits = {
  maxWaypoints: 6,
  maxIterations: 8,
  maxCandidateRoutesPerViolation: 8
} as const;

export type MultiObstacleRouteResult =
  | {
      readonly ok: true;
      readonly segments: readonly RouteSegment[];
      readonly validation: RouteValidationResult;
      readonly orderedObstacleIds: readonly string[];
      readonly iterations: number;
    }
  | {
      readonly ok: false;
      readonly segments: readonly RouteSegment[];
      readonly validation: RouteValidationResult;
      readonly orderedObstacleIds: readonly string[];
      readonly iterations: number;
    };

interface RoutePoint {
  readonly position: Vec3;
  readonly source: "start" | "waypoint" | "target";
}

export const orderObstaclesForMultiObstacleRoute = orderObstaclesForRoute;

export const buildMultiObstacleRoute = (context: PlannerContext, planningValidation: RouteValidationResult): MultiObstacleRouteResult => {
  const orderedObstacles = orderObstaclesForMultiObstacleRoute(context);
  const orderedObstacleIds = orderedObstacles.map((obstacle) => obstacle.id);
  let points: RoutePoint[] = [
    { position: context.ship.position, source: "start" },
    { position: context.target.position, source: "target" }
  ];

  for (let iteration = 0; iteration <= multiObstaclePlannerLimits.maxIterations; iteration += 1) {
    const segments = segmentsForPoints(context, points, orderedObstacles);
    const validation = validateRouteSegments(context, segments, planningValidation);
    if (validation.ok) {
      return { ok: true, segments, validation, orderedObstacleIds, iterations: iteration };
    }

    const violation = findFirstUnsafeRouteSegmentViolation(segments, orderedObstacles);
    if (!violation) {
      return { ok: false, segments, validation, orderedObstacleIds, iterations: iteration };
    }

    const waypointCount = points.filter((point) => point.source === "waypoint").length;
    if (waypointCount >= multiObstaclePlannerLimits.maxWaypoints || iteration >= multiObstaclePlannerLimits.maxIterations) {
      return failWith(context, segments, validation, "RouteBudgetExceeded", "Multi-obstacle waypoint or iteration budget was exceeded.", violation.obstacle.id, violation.segment.id, orderedObstacleIds, iteration);
    }

    const candidate = firstSafeWaypointCandidate(context, points, violation.segmentIndex, violation.obstacle, orderedObstacles, planningValidation);
    if (!candidate) {
      return failWith(context, segments, validation, "RouteUnsolvable", `No deterministic waypoint candidate cleared obstacle ${violation.obstacle.id}.`, violation.obstacle.id, violation.segment.id, orderedObstacleIds, iteration);
    }

    points = [...points.slice(0, violation.segmentIndex + 1), { position: candidate, source: "waypoint" }, ...points.slice(violation.segmentIndex + 1)];
  }

  const segments = segmentsForPoints(context, points, orderedObstacles);
  const validation = validateRouteSegments(context, segments, planningValidation);
  return failWith(context, segments, validation, "RouteBudgetExceeded", "Multi-obstacle planner exhausted its fixed iteration budget.", undefined, undefined, orderedObstacleIds, multiObstaclePlannerLimits.maxIterations);
};

const firstSafeWaypointCandidate = (
  context: PlannerContext,
  points: readonly RoutePoint[],
  segmentIndex: number,
  obstacle: ObstacleDescriptor,
  orderedObstacles: readonly ObstacleDescriptor[],
  planningValidation: RouteValidationResult
): Vec3 | null => {
  const start = points[segmentIndex].position;
  const end = points[segmentIndex + 1].position;
  const candidates = waypointCandidatesForViolation(context, start, end, obstacle).slice(0, multiObstaclePlannerLimits.maxCandidateRoutesPerViolation);
  const existingPointKeys = new Set(points.map((point) => pointKey(point.position)));
  let firstCurrentObstacleClearingCandidate: Vec3 | null = null;

  for (const candidate of candidates) {
    if (existingPointKeys.has(pointKey(candidate)) || distance(candidate, start) <= 1e-6 || distance(candidate, end) <= 1e-6) {
      continue;
    }

    const trialPoints = [...points.slice(0, segmentIndex + 1), { position: candidate, source: "waypoint" as const }, ...points.slice(segmentIndex + 1)];
    const trialSegments = segmentsForPoints(context, trialPoints, orderedObstacles);
    const trialValidation = validateRouteSegments(context, trialSegments, planningValidation);
    if (trialValidation.ok) {
      return candidate;
    }

    const adjacentSegments = trialSegments.slice(segmentIndex, segmentIndex + 2);
    const currentObstacleStillUnsafe = findUnsafeRouteSegmentViolations(adjacentSegments, [obstacle]).length > 0;
    if (!currentObstacleStillUnsafe && firstCurrentObstacleClearingCandidate === null) {
      firstCurrentObstacleClearingCandidate = candidate;
    }
  }

  return firstCurrentObstacleClearingCandidate;
};

export const waypointCandidatesForViolation = (context: PlannerContext, segmentStart: Vec3, segmentEnd: Vec3, obstacle: ObstacleDescriptor): readonly Vec3[] => {
  const routeDirection = normalize(sub(context.target.position, context.ship.position));
  const segmentDirection = normalize(sub(segmentEnd, segmentStart));
  const direction = magnitude(segmentDirection) > 0 ? segmentDirection : routeDirection;
  const up = Math.abs(dot(direction, vec3(0, 1, 0))) > 0.92 ? vec3(0, 0, 1) : vec3(0, 1, 0);
  const lateral = normalize(cross(direction, up));
  const vertical = normalize(cross(lateral, direction));
  const closest = projectPointOnSegment(obstacle.center, segmentStart, segmentEnd);
  const detourDistance = obstacle.radius + obstacle.padding + 12;
  const obstacleOffset = sub(obstacle.center, closest);
  const lateralPreferred = dot(obstacleOffset, lateral) > 1e-6 ? -1 : 1;
  const verticalPreferred = dot(obstacleOffset, vertical) > 1e-6 ? -1 : 1;
  const directions = [
    scale(lateral, lateralPreferred),
    scale(lateral, -lateralPreferred),
    scale(vertical, verticalPreferred),
    scale(vertical, -verticalPreferred),
    normalize(add(scale(lateral, lateralPreferred), scale(vertical, verticalPreferred))),
    normalize(add(scale(lateral, -lateralPreferred), scale(vertical, verticalPreferred))),
    normalize(add(scale(lateral, lateralPreferred), scale(vertical, -verticalPreferred))),
    normalize(add(scale(lateral, -lateralPreferred), scale(vertical, -verticalPreferred)))
  ];

  const candidates: Vec3[] = [];
  const seen = new Set<string>();
  for (const directionCandidate of directions) {
    const waypoint = roundVec(add(closest, scale(directionCandidate, detourDistance)), 4);
    const key = pointKey(waypoint);
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(waypoint);
    }
  }

  return candidates;
};

const segmentsForPoints = (context: PlannerContext, points: readonly RoutePoint[], orderedObstacles: readonly ObstacleDescriptor[]): readonly RouteSegment[] => {
  const profile = autopilotSpeedProfileFor(context.speedProfile);
  const arrivalRadius = arrivalRadiusForTarget(context.target);
  const avoidanceClearanceRadius = Math.max(4, ...orderedObstacles.map((obstacle) => obstacle.radius + obstacle.padding));

  return points.slice(0, -1).map((point, index) => {
    const isTerminal = index === points.length - 2;
    return {
      id: isTerminal ? `multi-terminal-${index}` : `multi-avoid-${index}`,
      kind: isTerminal ? "Terminal" : "Avoidance",
      start: point.position,
      end: points[index + 1].position,
      desiredSpeed: isTerminal ? profile.terminalApproachDesiredSpeed : profile.avoidanceDesiredSpeed,
      clearanceRadius: isTerminal ? arrivalRadius : avoidanceClearanceRadius,
      ...(!isTerminal ? { brakeMarginMultiplier: profile.brakeMarginMultiplier } : {})
    } satisfies RouteSegment;
  });
};

const failWith = (
  context: PlannerContext,
  segments: readonly RouteSegment[],
  validation: RouteValidationResult,
  code: RouteValidationReasonCode,
  message: string,
  obstacleId: string | undefined,
  segmentId: string | undefined,
  orderedObstacleIds: readonly string[],
  iterations: number
): MultiObstacleRouteResult => {
  const issues: RouteValidationIssue[] = [
    ...validation.issues,
    createRouteValidationIssue(code, message, {
      ...(context.target?.id !== undefined ? { targetId: context.target.id } : {}),
      ...(obstacleId !== undefined ? { obstacleId } : {}),
      ...(segmentId !== undefined ? { segmentId } : {})
    })
  ];
  return { ok: false, segments, validation: createRouteValidationResult(issues), orderedObstacleIds, iterations };
};

const pointKey = (point: Vec3): string => `${point.x.toFixed(4)}:${point.y.toFixed(4)}:${point.z.toFixed(4)}`;
