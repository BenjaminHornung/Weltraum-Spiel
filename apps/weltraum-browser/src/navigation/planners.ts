import { autopilotSpeedProfileFor } from "../core/types";
import type { LocalPlanner, PlannerContext, RoutePlan, RoutePlanningResult, RouteSegment } from "../core/types";
import { magnitude, normalize, scale, sub } from "../core/vector";
import { buildMultiObstacleRoute } from "./multiObstaclePlanner";
import { lockRouteMotionProfile } from "./motionProfile";
import { arrivalEnvelopeForTarget, arrivalRadiusForTarget, createCanonicalLockedRoutePlan, createRouteCandidate, planOrThrow, rejectionFor, validatePlanningContext, validateRouteSegments } from "./validation";

const withHash = (plan: Omit<RoutePlan, "planHash">): RoutePlan => createCanonicalLockedRoutePlan(plan);

const routeId = (planner: RoutePlan["planner"], targetId: string, tick: number): string => `${planner}:${targetId}:${tick}`;

const directSegmentsFor = (context: PlannerContext): readonly RouteSegment[] => {
  const profile = autopilotSpeedProfileFor(context.speedProfile);
  const arrivalRadius = arrivalRadiusForTarget(context.target);
  const arrivalEnvelope = arrivalEnvelopeForTarget(context.target);
  const routeOffset = sub(context.target.position, context.ship.position);
  const routeDistance = magnitude(routeOffset);
  const approachDistance = Math.max(arrivalRadius * 6, 18);

  if (context.transitPolicy === undefined && context.speedProfile !== undefined && arrivalEnvelope?.stopBehavior === "StopWithinEnvelope" && routeDistance > approachDistance + Math.max(2, arrivalRadius)) {
    const routeDirection = normalize(routeOffset);
    const terminalStart = sub(context.target.position, scale(routeDirection, approachDistance));
    return [
      {
        id: "direct-0",
        kind: "Direct",
        start: context.ship.position,
        end: terminalStart,
        desiredSpeed: profile.directDesiredSpeed,
        clearanceRadius: Math.max(4, arrivalRadius),
        brakeMarginMultiplier: profile.brakeMarginMultiplier
      },
      {
        id: "direct-terminal-0",
        kind: "Terminal",
        start: terminalStart,
        end: context.target.position,
        desiredSpeed: profile.terminalApproachDesiredSpeed,
        clearanceRadius: arrivalRadius
      }
    ];
  }

  return [
    {
      id: "direct-0",
      kind: "Direct",
      start: context.ship.position,
      end: context.target.position,
      desiredSpeed: profile.directDesiredSpeed,
      clearanceRadius: arrivalRadius,
      brakeMarginMultiplier: profile.brakeMarginMultiplier
    }
  ];
};

const finalizeLockedPlan = (
  planner: RoutePlan["planner"],
  context: PlannerContext,
  routeSegments: readonly RouteSegment[],
  routeValidation: ReturnType<typeof validateRouteSegments>
): RoutePlanningResult => {
  const rawCandidate = createRouteCandidate(planner, context, routeSegments, routeValidation);
  if (!routeValidation.ok) {
    return rejectionFor(planner, context, routeValidation, rawCandidate);
  }

  const locked = lockRouteMotionProfile(context, routeSegments);
  const lockedValidation = validateRouteSegments(context, locked.segments, routeValidation, locked.motionProfile);
  const candidate = createRouteCandidate(planner, context, locked.segments, lockedValidation);
  if (!lockedValidation.ok) {
    return rejectionFor(planner, context, lockedValidation, candidate);
  }

  const plan = withHash({
    id: routeId(planner, context.target.id, context.tick),
    planner,
    speedProfile: autopilotSpeedProfileFor(context.speedProfile).id,
    createdAtTick: context.tick,
    target: context.target,
    segments: candidate.segments,
    validation: lockedValidation,
    score: candidate.score,
    motionProfile: locked.motionProfile
  });

  return { ok: true, plan, candidate, validation: lockedValidation, score: candidate.score };
};

export class DirectLocalPlanner implements LocalPlanner {
  readonly kind = "DirectLocal" as const;

  planResult(context: PlannerContext): RoutePlanningResult {
    const validation = validatePlanningContext(context);
    if (!validation.ok) {
      return rejectionFor(this.kind, context, validation);
    }

    const segments = directSegmentsFor(context);
    return finalizeLockedPlan(this.kind, context, segments, validateRouteSegments(context, segments, validation));
  }

  plan(context: PlannerContext): RoutePlan {
    return planOrThrow(this.planResult(context));
  }
}

export class ObstacleAvoidanceLocalPlanner implements LocalPlanner {
  readonly kind = "ObstacleAvoidanceLocal" as const;

  planResult(context: PlannerContext): RoutePlanningResult {
    const validation = validatePlanningContext(context);
    if (!validation.ok) {
      return rejectionFor(this.kind, context, validation);
    }

    const directSegments = directSegmentsFor(context);
    const directValidation = validateRouteSegments(context, directSegments, validation);
    if (directValidation.ok || !directValidation.rejectedReasonCodes.includes("UnsafeRouteSegment")) {
      return finalizeLockedPlan(this.kind, context, directSegments, directValidation);
    }

    const multiObstacleRoute = buildMultiObstacleRoute(context, validation);
    return finalizeLockedPlan(this.kind, context, multiObstacleRoute.segments, multiObstacleRoute.validation);
  }

  plan(context: PlannerContext): RoutePlan {
    return planOrThrow(this.planResult(context));
  }
}
