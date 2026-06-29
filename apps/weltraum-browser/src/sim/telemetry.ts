import type { ExecutorTelemetry, RoutePlan, ShipState } from "../core/types";
import { roundVec } from "../core/vector";

export interface TelemetrySnapshot {
  readonly ship: ShipState;
  readonly executor: ExecutorTelemetry;
  readonly lockedPlan: RoutePlan | null;
}

export const serializeTelemetry = (snapshot: TelemetrySnapshot): TelemetrySnapshot => ({
  ship: {
    ...snapshot.ship,
    position: roundVec(snapshot.ship.position),
    velocity: roundVec(snapshot.ship.velocity),
    fuel: Number(snapshot.ship.fuel.toFixed(4))
  },
  executor: {
    ...snapshot.executor,
    distanceToTarget: Number(snapshot.executor.distanceToTarget.toFixed(4)),
    offRouteDistance: Number(snapshot.executor.offRouteDistance.toFixed(4)),
    fuel: Number(snapshot.executor.fuel.toFixed(4)),
    position: roundVec(snapshot.executor.position),
    velocity: roundVec(snapshot.executor.velocity)
  },
  lockedPlan: snapshot.lockedPlan
});
