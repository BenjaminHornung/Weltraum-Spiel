import { distance, magnitude, vec3 } from "../core/vector";
import type {
  ActuatorTelemetry,
  AuthorityMode,
  AuthorityState,
  BrakingReserve,
  ControlModeEffectSnapshot,
  FailureReasonCode,
  FlightControlMode,
  FlightSnapshot,
  FuelState,
  Quaternion,
  RoutePlan,
  ShipMass,
  ShipState
} from "../core/types";

export interface FlightModelOptions {
  /** Maximum forward thrust available to the browser autopilot. Unit: kilonewtons. */
  readonly maxThrustKilonewtons: number;
  /** Maximum acceleration cap used by the executor. Unit: m/s^2. */
  readonly maxAcceleration: number;
}

export const defaultFlightModelOptions: FlightModelOptions = {
  maxThrustKilonewtons: 10,
  maxAcceleration: 10
};

const unique = (codes: readonly FailureReasonCode[]): readonly FailureReasonCode[] => [...new Set(codes)];

export const identityOrientation = (): Quaternion => ({ x: 0, y: 0, z: 0, w: 1 });

export const inactiveControlModeEffect = (controlMode: FlightControlMode = "Cruise"): ControlModeEffectSnapshot => ({
  controlMode,
  mainThrustAllowed: controlMode === "Cruise",
  rcsTranslationAllowed: controlMode === "Translation",
  rcsRotationAllowed: true,
  sasAllowed: true,
  modeEffectLabel:
    controlMode === "Cruise"
      ? "main thrust enabled"
      : controlMode === "Precision"
        ? "RCS attitude / main thrust blocked"
        : "RCS translation / main thrust blocked",
  blockedReasonCodes: controlMode === "Cruise" ? ["RcsTranslationModeBlocked"] : ["MainThrustModeBlocked"],
  notes: [],
  rotationResponseScale: controlMode === "Precision" ? 0.45 : controlMode === "Translation" ? 0.65 : 1
});

export const inactiveActuatorTelemetry = (): ActuatorTelemetry => ({
  mainThrustActive: false,
  rcsTranslationActive: false,
  rcsRotationActive: false,
  sasCorrectionActive: false,
  controlModeEffect: inactiveControlModeEffect(),
  lastAppliedAcceleration: vec3(),
  lastAppliedAngularAcceleration: vec3()
});

const defaultControlMode = (authority: AuthorityState): FlightControlMode => (authority.mode === "Autopilot" ? "Cruise" : "Precision");

export const createShipMass = (input: { readonly dryMass?: number; readonly cargoMass?: number; readonly fuelMass: number }): ShipMass => {
  const dryMass = input.dryMass ?? 1_000;
  const cargoMass = input.cargoMass ?? 0;
  const fuelMass = Math.max(0, input.fuelMass);
  return {
    dryMass,
    cargoMass,
    fuelMass,
    totalMass: dryMass + cargoMass + fuelMass
  };
};

export const createFuelState = (input: {
  readonly capacity?: number;
  readonly current?: number;
  readonly reserve?: number;
  readonly burnRate?: number;
} = {}): FuelState => {
  const capacity = input.capacity ?? 100;
  const reserve = input.reserve ?? 5;
  const current = Math.max(0, Math.min(capacity, input.current ?? capacity));
  const burnRate = input.burnRate ?? 0.02;
  const reasonCodes: FailureReasonCode[] = [];

  if (current <= 0) {
    reasonCodes.push("FuelDepleted", "FuelInsufficient");
  } else if (current <= reserve) {
    reasonCodes.push("FuelReserveViolated", "FuelInsufficient");
  }

  return {
    capacity,
    current,
    reserve,
    burnRate,
    status: reasonCodes.length > 0 ? "Blocked" : "Ready",
    reasonCodes: unique(reasonCodes)
  };
};

export const createAuthorityState = (input: {
  readonly mode?: AuthorityMode;
  readonly autopilotAvailable?: boolean;
  readonly mainThrustersAvailable?: boolean;
  readonly rcsAvailable?: boolean;
  readonly sasAvailable?: boolean;
  readonly translationAuthority?: number;
  readonly rotationAuthority?: number;
} = {}): AuthorityState => {
  const mode = input.mode ?? "Autopilot";
  const autopilotAvailable = input.autopilotAvailable ?? mode === "Autopilot";
  const mainThrustersAvailable = input.mainThrustersAvailable ?? true;
  const rcsAvailable = input.rcsAvailable ?? true;
  const sasAvailable = input.sasAvailable ?? true;
  const translationAuthority = Math.max(0, input.translationAuthority ?? (mainThrustersAvailable || rcsAvailable ? 1 : 0));
  const rotationAuthority = Math.max(0, input.rotationAuthority ?? (rcsAvailable || sasAvailable ? 1 : 0));
  const reasonCodes: FailureReasonCode[] = [];

  if (!autopilotAvailable) {
    reasonCodes.push("AutopilotUnavailable", "AuthorityInsufficient");
  }
  if (!mainThrustersAvailable) {
    reasonCodes.push("MainThrustersUnavailable", "AuthorityInsufficient");
  }
  if (translationAuthority <= 0 || rotationAuthority <= 0) {
    reasonCodes.push("AuthorityInsufficient");
  }

  return {
    mode,
    autopilotAvailable,
    mainThrustersAvailable,
    rcsAvailable,
    sasAvailable,
    translationAuthority,
    rotationAuthority,
    reasonCodes: unique(reasonCodes)
  };
};

export const createShipStateV2 = (overrides: Partial<Omit<ShipState, "mass" | "fuel" | "authority">> & {
  readonly dryMass?: number;
  readonly cargoMass?: number;
  readonly fuel?: Partial<FuelState> | number;
  readonly authority?: Partial<AuthorityState>;
}): ShipState => {
  const fuel = typeof overrides.fuel === "number" ? createFuelState({ current: overrides.fuel }) : createFuelState(overrides.fuel);
  const authority = createAuthorityState(overrides.authority);
  const controlMode = overrides.controlMode ?? defaultControlMode(authority);
  return {
    position: overrides.position ?? vec3(),
    velocity: overrides.velocity ?? vec3(),
    orientation: overrides.orientation ?? identityOrientation(),
    angularVelocity: overrides.angularVelocity ?? vec3(),
    throttle: Math.max(0, Math.min(1, overrides.throttle ?? 0)),
    controlMode,
    rcsEnabled: overrides.rcsEnabled ?? authority.rcsAvailable,
    sasEnabled: overrides.sasEnabled ?? authority.sasAvailable,
    mainThrottleCommand: Math.max(0, Math.min(1, overrides.mainThrottleCommand ?? overrides.throttle ?? 0)),
    translationCommand: overrides.translationCommand ?? vec3(),
    rotationCommand: overrides.rotationCommand ?? vec3(),
    actuatorTelemetry: overrides.actuatorTelemetry ?? { ...inactiveActuatorTelemetry(), controlModeEffect: inactiveControlModeEffect(controlMode) },
    mass: createShipMass({ dryMass: overrides.dryMass, cargoMass: overrides.cargoMass, fuelMass: fuel.current }),
    fuel,
    authority
  };
};

export const accelerationLimitForMass = (mass: ShipMass, options: FlightModelOptions = defaultFlightModelOptions): number => {
  const massTonnes = Math.max(0.001, mass.totalMass / 1_000);
  return Math.min(options.maxAcceleration, options.maxThrustKilonewtons / massTonnes);
};

export const estimateBrakingReserve = (
  ship: ShipState,
  plan: RoutePlan | null,
  options: FlightModelOptions = defaultFlightModelOptions
): BrakingReserve => {
  const speed = magnitude(ship.velocity);
  const distanceToTarget = plan ? distance(ship.position, plan.target.position) : 0;
  const accelerationLimit = accelerationLimitForMass(ship.mass, options);
  const stoppingDistanceLimitedDeltaV = distanceToTarget > 0 ? Math.sqrt(Math.max(0, 2 * accelerationLimit * distanceToTarget)) : speed;
  const requiredDeltaV = Number(Math.max(speed, Math.min(speed + 1, stoppingDistanceLimitedDeltaV)).toFixed(4));
  const usableFuel = Math.max(0, ship.fuel.current - ship.fuel.reserve);
  const massTonnes = Math.max(0.001, ship.mass.totalMass / 1_000);
  const availableDeltaV = Number((usableFuel / Math.max(0.000001, ship.fuel.burnRate * massTonnes)).toFixed(4));
  const reasonCodes: FailureReasonCode[] = [];

  if (ship.fuel.status === "Blocked") {
    reasonCodes.push(...ship.fuel.reasonCodes);
  }
  if (!ship.authority.mainThrustersAvailable) {
    reasonCodes.push("MainThrustersUnavailable");
  }
  if (!ship.authority.autopilotAvailable) {
    reasonCodes.push("AutopilotUnavailable");
  }
  if (ship.authority.translationAuthority <= 0 || ship.authority.rotationAuthority <= 0) {
    reasonCodes.push("AuthorityInsufficient");
  }
  if (availableDeltaV < requiredDeltaV) {
    reasonCodes.push("FuelInsufficient", "BrakeReserveInsufficient");
  }

  return {
    requiredDeltaV,
    availableDeltaV,
    canBrake: reasonCodes.length === 0,
    reasonCodes: unique(reasonCodes)
  };
};

export const createFlightSnapshot = (
  ship: ShipState,
  plan: RoutePlan | null,
  options: FlightModelOptions = defaultFlightModelOptions
): FlightSnapshot => {
  const brakingReserve = estimateBrakingReserve(ship, plan, options);
  const failureReasonCodes = unique([...ship.fuel.reasonCodes, ...ship.authority.reasonCodes, ...brakingReserve.reasonCodes]);
  const routeValid = failureReasonCodes.length === 0;
  const targetDistance = plan ? distance(ship.position, plan.target.position) : 0;
  const speed = magnitude(ship.velocity);

  return {
    mass: ship.mass,
    fuel: ship.fuel,
    authority: ship.authority,
    brakingReserve,
    routeValid,
    failureReasonCodes,
    etaSeconds: plan && speed > 0.001 ? Number((targetDistance / speed).toFixed(2)) : null
  };
};

export const burnFuel = (ship: ShipState, kilonewtonSeconds: number): ShipState => {
  const burnedFuel = Math.max(0, kilonewtonSeconds * ship.fuel.burnRate);
  const fuel = createFuelState({
    capacity: ship.fuel.capacity,
    current: ship.fuel.current - burnedFuel,
    reserve: ship.fuel.reserve,
    burnRate: ship.fuel.burnRate
  });

  return {
    ...ship,
    fuel,
    mass: createShipMass({ dryMass: ship.mass.dryMass, cargoMass: ship.mass.cargoMass, fuelMass: fuel.current })
  };
};
