import type { ActuatorTelemetry, ExecutorTelemetry, FlightSnapshot, FuelState, Quaternion, RoutePlan, RouteValidationReasonCode, RouteValidationResult, ShipState, TargetDescriptor } from "../core/types";
import { roundVec } from "../core/vector";
import type { ManualFlightInputState } from "../runtime/input";

export interface RoutePreviewSnapshot {
  readonly state: "Ready" | "Unavailable";
  readonly planner: RoutePlan["planner"];
  readonly target: TargetDescriptor | null;
  readonly plan: RoutePlan | null;
  readonly validation: RouteValidationResult | null;
  readonly rejectedReasonCodes: readonly RouteValidationReasonCode[];
  readonly playerMessage: string;
}

export interface TelemetrySnapshot {
  readonly ship: ShipState;
  readonly executor: ExecutorTelemetry;
  readonly lockedPlan: RoutePlan | null;
  readonly flightSnapshot: FlightSnapshot;
  readonly selectableTargets?: readonly TargetDescriptor[];
  readonly selectedTarget?: TargetDescriptor | null;
  readonly routePreview?: RoutePreviewSnapshot | null;
  readonly runtimeMessage?: string | null;
  readonly manualInput?: ManualFlightInputState;
}

const roundFuel = (fuel: FuelState): FuelState => ({
  ...fuel,
  capacity: Number(fuel.capacity.toFixed(4)),
  current: Number(fuel.current.toFixed(4)),
  reserve: Number(fuel.reserve.toFixed(4)),
  burnRate: Number(fuel.burnRate.toFixed(6))
});

const roundQuaternion = (q: Quaternion): Quaternion => ({
  x: Number(q.x.toFixed(6)),
  y: Number(q.y.toFixed(6)),
  z: Number(q.z.toFixed(6)),
  w: Number(q.w.toFixed(6))
});

const roundActuatorTelemetry = (telemetry: ActuatorTelemetry): ActuatorTelemetry => ({
  ...telemetry,
  lastAppliedAcceleration: roundVec(telemetry.lastAppliedAcceleration),
  lastAppliedAngularAcceleration: roundVec(telemetry.lastAppliedAngularAcceleration)
});

const roundShipState = (ship: ShipState): ShipState => ({
  ...ship,
  position: roundVec(ship.position),
  velocity: roundVec(ship.velocity),
  orientation: roundQuaternion(ship.orientation),
  angularVelocity: roundVec(ship.angularVelocity),
  throttle: Number(ship.throttle.toFixed(4)),
  mainThrottleCommand: Number(ship.mainThrottleCommand.toFixed(4)),
  translationCommand: roundVec(ship.translationCommand),
  rotationCommand: roundVec(ship.rotationCommand),
  actuatorTelemetry: roundActuatorTelemetry(ship.actuatorTelemetry),
  fuel: roundFuel(ship.fuel),
  mass: {
    ...ship.mass,
    dryMass: Number(ship.mass.dryMass.toFixed(4)),
    cargoMass: ship.mass.cargoMass === undefined ? undefined : Number(ship.mass.cargoMass.toFixed(4)),
    fuelMass: Number(ship.mass.fuelMass.toFixed(4)),
    totalMass: Number(ship.mass.totalMass.toFixed(4))
  }
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
  ship: roundShipState(snapshot.ship),
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
  flightSnapshot: roundFlightSnapshot(snapshot.flightSnapshot),
  selectableTargets: snapshot.selectableTargets,
  selectedTarget: snapshot.selectedTarget,
  routePreview: snapshot.routePreview,
  runtimeMessage: snapshot.runtimeMessage,
  manualInput: snapshot.manualInput
});

export const createTelemetrySnapshot = (ship: ShipState, executor: ExecutorTelemetry, lockedPlan: RoutePlan | null): TelemetrySnapshot =>
  serializeTelemetry({ ship, executor, lockedPlan, flightSnapshot: executor.flightSnapshot });
