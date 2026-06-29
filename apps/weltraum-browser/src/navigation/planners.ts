import { planHashFor } from "../core/hash";
import type { LocalPlanner, ObstacleDescriptor, PlannerContext, RoutePlan, RoutePlanningResult, RouteSegment } from "../core/types";
import { cross, distance, dot, magnitude, normalize, sub, vec3 } from "../core/vector";
import { arrivalRadiusForTarget, createRouteCandidate, planOrThrow, rejectionFor, validatePlanningContext, validateRouteSegments } from "./validation";

const withHash = (plan: Omit<RoutePlan, "planHash">): RoutePlan => ({
  ...plan,
  planHash: planHashFor(plan)
});

const routeId = (planner: RoutePlan["planner"], targetId: string, tick: number): string => `${planner}:${targetId}:${tick}`;

export class DirectLocalPlanner implements LocalPlanner {
  readonly kind = "DirectLocal" as const;

  planResult(context: PlannerContext): RoutePlanningResult {
    const validation = validatePlanningContext(context);
    if (!validation.ok) {
      return rejectionFor(this.kind, context, validation);
    }

    const segment: RouteSegment = {
      id: "direct-0",
      kind: "Direct",
      start: context.ship.position,
      end: context.target.position,
      desiredSpeed: 18,
      clearanceRadius: arrivalRadiusForTarget(context.target)
    };
    const routeValidation = validateRouteSegments(context, [segment], validation);
    const candidate = createRouteCandidate(this.kind, context, [segment], routeValidation);
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

    const obstacle = selectFirstBlockingObstacle(context);
    if (!obstacle) {
      const directSegment: RouteSegment = {
        id: "direct-0",
        kind: "Direct",
        start: context.ship.position,
        end: context.target.position,
        desiredSpeed: 18,
        clearanceRadius: arrivalRadiusForTarget(context.target)
      };
      const routeValidation = validateRouteSegments(context, [directSegment], validation);
      const candidate = createRouteCandidate(this.kind, context, [directSegment], routeValidation);
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
        desiredSpeed: 14,
        clearanceRadius: obstacle.radius + obstacle.padding
      },
      {
        id: `avoid-${obstacle.id}-1`,
        kind: "Terminal",
        start: waypoint,
        end: context.target.position,
        desiredSpeed: 12,
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
