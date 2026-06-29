import type { ExecutorTelemetry, FlightSnapshot, FuelState, RoutePlan, ShipState } from "../core/types";
import { roundVec } from "../core/vector";

export interface TelemetrySnapshot {
  readonly ship: ShipState;
  readonly executor: ExecutorTelemetry;
  readonly lockedPlan: RoutePlan | null;
  readonly flightSnapshot: FlightSnapshot;
}

const roundFuel = (fuel: FuelState): FuelState => ({
  ...fuel,
  capacity: Number(fuel.capacity.toFixed(4)),
  current: Number(fuel.current.toFixed(4)),
  reserve: Number(fuel.reserve.toFixed(4)),
  burnRate: Number(fuel.burnRate.toFixed(6))
});

const roundFlightSnapshot = (snapshot: FlightSnapshot): FlightSnapshot => ({
  ...snapshot,
  mass: {
    ...snapshot.mass,
    dryMass: Number(snapshot.mass.dryMass.toFixed(4)),
    cargoMass: snapshot.mass.cargoMass === undefined ? undefined : Number(snapshot.mass.cargoMass.toFixed(4)),
    fuelMass: Number(snapshot.mass.fuelMass.toFixed(4)),
    totalMass: Number(snapshot.mass.totalMass.toFixed(4))
  },
  fuel: roundFuel(snapshot.fuel),
  brakingReserve: {
    ...snapshot.brakingReserve,
    requiredDeltaV: Number(snapshot.brakingReserve.requiredDeltaV.toFixed(4)),
    availableDeltaV: Number(snapshot.brakingReserve.availableDeltaV.toFixed(4))
  }
});

export const serializeTelemetry = (snapshot: TelemetrySnapshot): TelemetrySnapshot => ({
  ship: {
    ...snapshot.ship,
    position: roundVec(snapshot.ship.position),
    velocity: roundVec(snapshot.ship.velocity),
    fuel: roundFuel(snapshot.ship.fuel)
  },
  executor: {
    ...snapshot.executor,
    distanceToTarget: Number(snapshot.executor.distanceToTarget.toFixed(4)),
    offRouteDistance: Number(snapshot.executor.offRouteDistance.toFixed(4)),
    fuel: roundFuel(snapshot.executor.fuel),
    flightSnapshot: roundFlightSnapshot(snapshot.executor.flightSnapshot),
    position: roundVec(snapshot.executor.position),
    velocity: roundVec(snapshot.executor.velocity)
  },
  lockedPlan: snapshot.lockedPlan,
  flightSnapshot: roundFlightSnapshot(snapshot.flightSnapshot)
});

export const createTelemetrySnapshot = (ship: ShipState, executor: ExecutorTelemetry, lockedPlan: RoutePlan | null): TelemetrySnapshot =>
  serializeTelemetry({ ship, executor, lockedPlan, flightSnapshot: executor.flightSnapshot });
