import { planHashFor } from "../core/hash";
import { autopilotSpeedProfileFor } from "../core/types";
import type { LocalPlanner, ObstacleDescriptor, PlannerContext, RoutePlan, RoutePlanningResult, RouteSegment } from "../core/types";
import { cross, distance, dot, magnitude, normalize, scale, sub, vec3 } from "../core/vector";
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

const intersectsObstacle = (start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }, obstacle: ObstacleDescriptor): boolean => {
  const line = sub(end, start);
  const toCenter = sub(obstacle.center, start);
  const lengthSq = dot(line, line);
  if (lengthSq <= 1e-9) {
    return distance(start, obstacle.center) <= obstacle.radius + obstacle.padding;
  }

  const t = Math.max(0, Math.min(1, dot(toCenter, line) / lengthSq));
  const closest = {
    x: start.x + line.x * t,
    y: start.y + line.y * t,
    z: start.z + line.z * t
  };

  return distance(closest, obstacle.center) <= obstacle.radius + obstacle.padding;
};

const selectFirstBlockingObstacle = (context: PlannerContext): ObstacleDescriptor | null => {
  return (context.obstacles ?? []).find((obstacle) => intersectsObstacle(context.ship.position, context.target.position, obstacle)) ?? null;
};

const avoidanceWaypoint = (context: PlannerContext, obstacle: ObstacleDescriptor) => {
  const route = normalize(sub(context.target.position, context.ship.position));
  const up = Math.abs(dot(route, vec3(0, 1, 0))) > 0.92 ? vec3(0, 0, 1) : vec3(0, 1, 0);
  const lateral = normalize(cross(route, up));
  const detourDistance = obstacle.radius + obstacle.padding + 12;
  const routeLength = magnitude(sub(context.target.position, context.ship.position));
  const centerBias = Math.max(0.25, Math.min(0.75, distance(context.ship.position, obstacle.center) / Math.max(routeLength, 1)));
  const alongRoute = {
    x: context.ship.position.x + (context.target.position.x - context.ship.position.x) * centerBias,
    y: context.ship.position.y + (context.target.position.y - context.ship.position.y) * centerBias,
    z: context.ship.position.z + (context.target.position.z - context.ship.position.z) * centerBias
  };

  return {
    x: alongRoute.x + lateral.x * detourDistance,
    y: alongRoute.y + lateral.y * detourDistance,
    z: alongRoute.z + lateral.z * detourDistance
  };
};

export class ObstacleAvoidanceLocalPlanner implements LocalPlanner {
  readonly kind = "ObstacleAvoidanceLocal" as const;

  planResult(context: PlannerContext): RoutePlanningResult {
    const validation = validatePlanningContext(context);
    if (!validation.ok) {
      return rejectionFor(this.kind, context, validation);
    }

    const profile = autopilotSpeedProfileFor(context.speedProfile);
    const obstacle = selectFirstBlockingObstacle(context);
    if (!obstacle) {
      const directSegments = directSegmentsFor(context);
      const routeValidation = validateRouteSegments(context, directSegments, validation);
      const candidate = createRouteCandidate(this.kind, context, directSegments, routeValidation);
      if (!routeValidation.ok) {
        return rejectionFor(this.kind, context, routeValidation, candidate);
      }
      const plan = withHash({
        id: routeId(this.kind, context.target.id, context.tick),
        planner: this.kind,
        createdAtTick: context.tick,
        target: context.target,
        segments: candidate.segments,
        validation: routeValidation,
        score: candidate.score
      });

      return { ok: true, plan, candidate, validation: routeValidation, score: candidate.score };
    }

    const waypoint = avoidanceWaypoint(context, obstacle);
    const segments: RouteSegment[] = [
      {
        id: `avoid-${obstacle.id}-0`,
        kind: "Avoidance",
        start: context.ship.position,
        end: waypoint,
        desiredSpeed: profile.avoidanceDesiredSpeed,
        clearanceRadius: obstacle.radius + obstacle.padding,
        brakeMarginMultiplier: profile.brakeMarginMultiplier
      },
      {
        id: `avoid-${obstacle.id}-1`,
        kind: "Terminal",
        start: waypoint,
        end: context.target.position,
        desiredSpeed: profile.terminalApproachDesiredSpeed,
        clearanceRadius: arrivalRadiusForTarget(context.target)
      }
    ];
    const routeValidation = validateRouteSegments(context, segments, validation);
    const candidate = createRouteCandidate(this.kind, context, segments, routeValidation);
    if (!routeValidation.ok) {
      return rejectionFor(this.kind, context, routeValidation, candidate);
    }
    const plan = withHash({
      id: routeId(this.kind, context.target.id, context.tick),
      planner: this.kind,
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
