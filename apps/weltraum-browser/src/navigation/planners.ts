import { planHashFor } from "../core/hash";
import { autopilotSpeedProfileFor } from "../core/types";
import type { LocalPlanner, PlannerContext, RoutePlan, RoutePlanningResult, RouteSegment } from "../core/types";
import { magnitude, normalize, scale, sub } from "../core/vector";
import { buildMultiObstacleRoute } from "./multiObstaclePlanner";
import { arrivalEnvelopeForTarget, arrivalRadiusForTarget, createRouteCandidate, planOrThrow, rejectionFor, validatePlanningContext, validateRouteSegments } from "./validation";

const withHash = (plan: Omit<RoutePlan, "planHash">): RoutePlan => ({
  ...plan,
  planHash: planHashFor(plan)
});

const routeId = (planner: RoutePlan["planner"], targetId: string, tick: number): string => `${planner}:${targetId}:${tick}`;

const directSegmentsFor = (context: PlannerContext): readonly RouteSegment[] => {
  const profile = autopilotSpeedProfileFor(context.speedProfile);
  const arrivalRadius = arrivalRadiusForTarget(context.target);
  const arrivalEnvelope = arrivalEnvelopeForTarget(context.target);
  const routeOffset = sub(context.target.position, context.ship.position);
  const routeDistance = magnitude(routeOffset);
  const approachDistance = Math.max(arrivalRadius * 6, 18);

  if (context.speedProfile !== undefined && arrivalEnvelope?.stopBehavior === "StopWithinEnvelope" && routeDistance > approachDistance + Math.max(2, arrivalRadius)) {
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

export class DirectLocalPlanner implements LocalPlanner {
  readonly kind = "DirectLocal" as const;

  planResult(context: PlannerContext): RoutePlanningResult {
    const validation = validatePlanningContext(context);
    if (!validation.ok) {
      return rejectionFor(this.kind, context, validation);
    }

    const segments = directSegmentsFor(context);
    const routeValidation = validateRouteSegments(context, segments, validation);
    const candidate = createRouteCandidate(this.kind, context, segments, routeValidation);
    if (!routeValidation.ok) {
      return rejectionFor(this.kind, context, routeValidation, candidate);
    }
    const plan = withHash({
      id: routeId(this.kind, context.target.id, context.tick),
      planner: this.kind,
      speedProfile: autopilotSpeedProfileFor(context.speedProfile).id,
      createdAtTick: context.tick,
      target: context.target,
      segments: candidate.segments,
      validation: routeValidation,
      score: candidate.score
    });

    return { ok: true, plan, candidate, validation: routeValidation, score: candidate.score };
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
      const directCandidate = createRouteCandidate(this.kind, context, directSegments, directValidation);
      if (!directValidation.ok) {
        return rejectionFor(this.kind, context, directValidation, directCandidate);
      }
      const plan = withHash({
        id: routeId(this.kind, context.target.id, context.tick),
        planner: this.kind,
        speedProfile: autopilotSpeedProfileFor(context.speedProfile).id,
        createdAtTick: context.tick,
        target: context.target,
        segments: directCandidate.segments,
        validation: directValidation,
        score: directCandidate.score
      });

      return { ok: true, plan, candidate: directCandidate, validation: directValidation, score: directCandidate.score };
    }

    const multiObstacleRoute = buildMultiObstacleRoute(context, validation);
    const routeValidation = multiObstacleRoute.validation;
    const segments = multiObstacleRoute.segments;
    const candidate = createRouteCandidate(this.kind, context, segments, routeValidation);
    if (!routeValidation.ok) {
      return rejectionFor(this.kind, context, routeValidation, candidate);
    }
    const plan = withHash({
      id: routeId(this.kind, context.target.id, context.tick),
      planner: this.kind,
      speedProfile: autopilotSpeedProfileFor(context.speedProfile).id,
      createdAtTick: context.tick,
      target: context.target,
      segments: candidate.segments,
      validation: routeValidation,
      score: candidate.score
    });

    return { ok: true, plan, candidate, validation: routeValidation, score: candidate.score };
  }

  plan(context: PlannerContext): RoutePlan {
    return planOrThrow(this.planResult(context));
  }
}
