import {
  AutopilotExecutor,
  DirectLocalPlanner,
  FixedStepSimulationLoop,
  ObstacleAvoidanceLocalPlanner,
  distance,
  dot,
  magnitude,
  normalize,
  sub,
  vec3
} from "../core";
import type {
  AutopilotExecutorOptions,
  LockedTransitPhase,
  ObstacleDescriptor,
  RequestedTransitPolicyId,
  RoutePlan,
  ShipState,
  TargetDescriptor
} from "../core";
import { orientationFromForward } from "../flight/flightController";
import {
  STANDARD_GRAVITY_MPS2,
  defaultCrewlessDroneAccelerationEnvelope,
  defaultHumanCrewAccelerationEnvelope,
  highGCrewlessDronePropulsionCapability,
  highThrustCrewedShipPropulsionCapability,
  normalCrewedScoutPropulsionCapability,
  underpoweredCrewedCargoShipPropulsionCapability
} from "../flight/propulsionCapability";
import { createAuthorityState, createShipStateV2 } from "../flight/state";

export const bangBangFixedStepHz = 30;
export const bangBangFixedDeltaSeconds = 1 / bangBangFixedStepHz;

export const bangBangTransitPhases = [
  "AlignForBurn",
  "Accelerate",
  "Coast",
  "Flip",
  "Brake",
  "TerminalCapture",
  "Holding"
] as const satisfies readonly LockedTransitPhase[];

export type BangBangTransitScenarioId =
  | "crew-comfort-500m"
  | "crew-sprint-500m"
  | "economy-500m"
  | "crew-comfort-1000m"
  | "crew-sprint-1000m"
  | "economy-1000m"
  | "crew-comfort-2500m"
  | "crew-sprint-2500m"
  | "economy-2500m"
  | "human-sprint-high-thrust-1000m"
  | "drone-sprint-high-g-1000m"
  | "underpowered-crew-comfort-1000m"
  | "low-rcs-attitude-expected-fail"
  | "no-main-thruster-expected-fail"
  | "low-fuel-expected-fail"
  | "brake-reserve-expected-fail"
  | "off-route-expected-fail"
  | "single-obstacle-corner-1000m"
  | "sharp-corner-geometry-1000m"
  | "terminal-holding-no-snap"
  | "hash-determinism-1000m"
  | "no-silent-replan-1000m";

export type BangBangTransitScenarioClassification = "Pass" | "ExpectedFail" | "Fail";

type BangBangPlannerKind = "DirectLocal" | "ObstacleAvoidanceLocal";

interface BangBangScenarioExpectation {
  readonly outcome: "Pass" | "ExpectedFail";
  readonly maxFinalDistance: number;
  readonly maxFinalSpeed: number;
  readonly minObstacleClearance: number;
  readonly requireNoReplan: boolean;
  readonly requireHolding?: boolean;
  readonly requireLatchedFailure?: boolean;
  readonly expectedFailureStatus?: "Diverged" | "OutOfFuel" | "NoAuthority" | "BrakeReserveInsufficient";
  readonly expectedFailureReasonCodes?: readonly string[];
  readonly allowedFailureReasonCodes?: readonly string[];
}

export interface BangBangTransitScenarioDefinition {
  readonly id: BangBangTransitScenarioId;
  readonly label: string;
  readonly transitPolicy: RequestedTransitPolicyId;
  readonly planner: BangBangPlannerKind;
  readonly initialShip: ShipState;
  /** Optional live state used after planning to prove authority can only reduce. */
  readonly executionShip?: ShipState;
  readonly target: TargetDescriptor;
  readonly obstacles: readonly ObstacleDescriptor[];
  readonly maxTicks: number;
  /** Test-harness-only compatibility clamp override; production defaults are never changed. */
  readonly executorOptions?: Partial<AutopilotExecutorOptions>;
  readonly disturbance?: {
    readonly tick: number;
    readonly positionOffset?: ShipState["position"];
    readonly velocityOffset?: ShipState["velocity"];
  };
  readonly expectation: BangBangScenarioExpectation;
}

export interface BangBangPhaseTimelineEntry {
  readonly phase: LockedTransitPhase;
  readonly startTick: number;
  readonly endTick: number;
  readonly durationSeconds: number;
  readonly sampleCount: number;
  /** Actual actuator acceleration signed along the active locked-route direction. */
  readonly peakPositiveG: number;
  /** Positive magnitude of actual reverse actuator acceleration along the locked route. */
  readonly peakNegativeG: number;
  readonly averageAppliedG: number;
  readonly poweredSeconds: number;
  readonly mainThrustSeconds: number;
  readonly rcsTranslationSeconds: number;
}

export interface BangBangTransitMetrics {
  readonly schemaVersion: 1;
  readonly fixedStepHz: number;
  readonly scenarioId: BangBangTransitScenarioId;
  readonly label: string;
  readonly classification: BangBangTransitScenarioClassification;
  readonly expectedOutcome: "Pass" | "ExpectedFail";
  readonly status: string;
  readonly transitPolicy: {
    readonly requested: RequestedTransitPolicyId;
    readonly resolved: string | null;
  };
  readonly targetDistanceMeters: number;
  readonly tick: number;
  readonly simulatedSeconds: number;
  readonly peakSpeedMps: number;
  readonly firstArrival: {
    readonly tick: number | null;
    readonly simulatedSeconds: number | null;
    readonly finalDistanceMeters: number;
    readonly finalSpeedMps: number;
  };
  readonly settledTerminal: {
    readonly settlingTicks: number;
    readonly distanceMeters: number;
    readonly speedMps: number;
  };
  readonly phaseDurationsSeconds: Readonly<Record<LockedTransitPhase, number>>;
  readonly phaseTimeline: readonly BangBangPhaseTimelineEntry[];
  /** Derived only from ShipState.actuatorTelemetry.lastAppliedAcceleration at each fixed step. */
  readonly actualAcceleration: {
    readonly peakPositiveG: number;
    readonly peakNegativeG: number;
    readonly sustainedPositiveG: number;
    readonly sustainedNegativeG: number;
    readonly peakAppliedAccelerationMps2: number;
    readonly peakAppliedG: number;
    readonly averagePoweredG: number;
    readonly poweredSeconds: number;
    readonly belowComfortMainBurnSeconds: number;
    readonly aboveHumanMaximumSeconds: number;
    readonly gravityCoverageFraction: number;
  };
  /** Finite telemetry copied from real actuator/executor output, never inferred from phase names. */
  readonly actuatorTelemetry: {
    readonly requestedBurnSamples: number;
    readonly actualMainThrustSamples: number;
    readonly flipSamples: number;
    readonly minimumMainThrustAlignment: number;
    readonly maximumMainThrustAlignmentErrorRadians: number;
    readonly maximumFlipAngleRadians: number;
    readonly peakCommandedPoweredAccelerationMps2: number;
    readonly peakAppliedMainAccelerationMps2: number;
    readonly peakAppliedAccelerationMps2: number;
  };
  readonly modeledPropulsion: {
    readonly model: "actual-applied-impulse-v1";
    readonly impulseNewtonSeconds: number;
    readonly totalDeltaVMps: number;
    readonly fuelBurnRateKgPerKilonewtonSecond: number;
    readonly modeledFuelFromImpulseKg: number;
    readonly actualFuelUsedKg: number;
    readonly fuelReserveRemainingKg: number;
    readonly throttleEfficiencyClaim: false;
  };
  readonly modeledThermal: {
    readonly model: "capability-metadata-only-v1";
    readonly heatLoadPerNewtonSecond: number;
    readonly accumulatedHeatLoad: number;
    readonly sustainedCoolingCapacity: number;
    readonly controllerThermalLimitApplied: false;
  };
  readonly physicalLimits: {
    readonly occupantMode: ShipState["occupantAccelerationEnvelope"]["occupantMode"];
    readonly minimumComfortG: number;
    readonly maximumHumanG: number | null;
    readonly mainThrustNewton: number;
    readonly effectiveBrakingThrustNewton: number;
    readonly structuralMaxAccelerationMps2: number;
    readonly sustainedThermalMaxAccelerationMps2: number;
    readonly maximumPeakAccelerationMps2: number;
  };
  readonly lockedPlan: {
    readonly before: string | null;
    readonly after: string | null;
    readonly completed: string | null;
    readonly stable: boolean;
  };
  readonly signals: {
    readonly replanRequired: boolean;
    readonly failureReasonCodes: readonly string[];
    readonly invalidationReasons: readonly string[];
    readonly terminalCaptureObserved: boolean;
    readonly holdingObserved: boolean;
    /** A restored external state stayed failed until the caller cancelled or relocked. */
    readonly latchedFailureObserved: boolean;
  };
  readonly minObstacleClearanceMeters: number;
  readonly notes: readonly string[];
}

interface PhaseAccumulator {
  phase: LockedTransitPhase;
  startTick: number;
  endTick: number;
  sampleCount: number;
  appliedGTotal: number;
  peakPositiveG: number;
  peakNegativeG: number;
  poweredTicks: number;
  mainThrustTicks: number;
  rcsTranslationTicks: number;
}

interface ActualAccelerationAccumulator {
  peakPositiveG: number;
  peakNegativeG: number;
  peakAppliedAccelerationMps2: number;
  positiveGTotal: number;
  positiveTicks: number;
  negativeGTotal: number;
  negativeTicks: number;
  peakAppliedG: number;
  poweredGTotal: number;
  poweredTicks: number;
  belowComfortMainBurnTicks: number;
  aboveHumanMaximumTicks: number;
  gravityCoverageTicks: number;
}

interface ActuatorTelemetryAccumulator {
  requestedBurnSamples: number;
  actualMainThrustSamples: number;
  flipSamples: number;
  minimumMainThrustAlignment: number;
  maximumMainThrustAlignmentErrorRadians: number;
  maximumFlipAngleRadians: number;
  peakCommandedPoweredAccelerationMps2: number;
  peakAppliedMainAccelerationMps2: number;
  peakAppliedAccelerationMps2: number;
}

export const finiteEvidenceNumber = (value: number, label = "Evidence metric"): number => {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite, received ${value}.`);
  }
  return value;
};

const round4 = (value: number): number => {
  finiteEvidenceNumber(value);
  return Number(value.toFixed(4));
};

const stopTarget = (id: string, distanceMeters: number): TargetDescriptor => ({
  id,
  label: id,
  kind: "Point",
  position: vec3(distanceMeters, 0, 0),
  arrivalEnvelope: { radius: 3, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" }
});

const obstacle = (id: string, x: number, y: number, radius: number, padding: number): ObstacleDescriptor => ({
  id,
  center: vec3(x, y, 0),
  radius,
  padding
});

const alignedForVisiblePhaseSequence = () => orientationFromForward(vec3(0, 0, 1));

const humanShip = (fuelCurrent: number, overrides: Parameters<typeof createShipStateV2>[0] = {}): ShipState =>
  createShipStateV2({
    fuel: { current: fuelCurrent, capacity: fuelCurrent, reserve: 5, burnRate: 0.02 },
    orientation: alignedForVisiblePhaseSequence(),
    occupantAccelerationEnvelope: defaultHumanCrewAccelerationEnvelope,
    ...overrides
  });

const passExpectation = (maxTicks: number, minObstacleClearance = 999_999): BangBangScenarioExpectation => ({
  outcome: "Pass",
  maxFinalDistance: 3,
  maxFinalSpeed: 0.5,
  minObstacleClearance,
  requireNoReplan: true,
  ...(maxTicks > 0 ? {} : {})
});

const expectedFailure = (
  status: NonNullable<BangBangScenarioExpectation["expectedFailureStatus"]>,
  codes: readonly string[],
  allowedCodes: readonly string[] = codes
): BangBangScenarioExpectation => ({
  outcome: "ExpectedFail",
  maxFinalDistance: 3,
  maxFinalSpeed: 0.5,
  minObstacleClearance: -999_999,
  requireNoReplan: false,
  expectedFailureStatus: status,
  expectedFailureReasonCodes: codes,
  allowedFailureReasonCodes: allowedCodes
});

const directTransit = (
  id: Extract<BangBangTransitScenarioId, `${"crew-comfort" | "crew-sprint" | "economy"}-${number}m`>,
  policy: Extract<RequestedTransitPolicyId, "CrewComfort" | "CrewSprint" | "Economy">,
  distanceMeters: number,
  maxTicks: number
): BangBangTransitScenarioDefinition => ({
  id,
  label: `${policy} ${distanceMeters}m direct transit`,
  transitPolicy: policy,
  planner: "DirectLocal",
  initialShip: humanShip(Math.max(240, distanceMeters * 0.18)),
  target: stopTarget(id, distanceMeters),
  obstacles: [],
  maxTicks,
  expectation: passExpectation(maxTicks)
});

/**
 * The 22 deterministic scenarios are the Task 4 truth matrix. They are not UI
 * fixtures: every successful row is executed by the fixed-step executor and
 * every negative row must preserve its locked-plan evidence while failing closed.
 */
export const bangBangTransitScenarioCatalog: readonly BangBangTransitScenarioDefinition[] = [
  directTransit("crew-comfort-500m", "CrewComfort", 500, 4_000),
  directTransit("crew-sprint-500m", "CrewSprint", 500, 4_000),
  directTransit("economy-500m", "Economy", 500, 5_000),
  directTransit("crew-comfort-1000m", "CrewComfort", 1_000, 6_000),
  directTransit("crew-sprint-1000m", "CrewSprint", 1_000, 6_000),
  directTransit("economy-1000m", "Economy", 1_000, 7_000),
  directTransit("crew-comfort-2500m", "CrewComfort", 2_500, 10_000),
  directTransit("crew-sprint-2500m", "CrewSprint", 2_500, 10_000),
  directTransit("economy-2500m", "Economy", 2_500, 12_000),
  {
    id: "human-sprint-high-thrust-1000m",
    label: "Human Sprint physical comfort limit",
    transitPolicy: "CrewSprint",
    planner: "DirectLocal",
    initialShip: humanShip(300, {
      propulsionCapability: highThrustCrewedShipPropulsionCapability,
      // Keep a real but near-zero lateral RCS channel so this axial authority
      // comparison cannot add RCS translation on top of the human g envelope.
      authority: createAuthorityState({ mode: "Autopilot", translationAuthority: 0.000000000001, rotationAuthority: 1 }),
      orientation: createShipStateV2().orientation
    }),
    target: stopTarget("human-sprint-high-thrust-1000m", 1_000),
    obstacles: [],
    maxTicks: 6_000,
    expectation: passExpectation(6_000)
  },
  {
    id: "drone-sprint-high-g-1000m",
    label: "Crewless Drone Sprint physical limit",
    transitPolicy: "DroneSprint",
    planner: "DirectLocal",
    initialShip: createShipStateV2({
      fuel: { current: 300, capacity: 300, reserve: 5, burnRate: 0.02 },
      propulsionCapability: highGCrewlessDronePropulsionCapability,
      occupantAccelerationEnvelope: defaultCrewlessDroneAccelerationEnvelope,
      authority: createAuthorityState({ mode: "Autopilot", translationAuthority: 0.000000000001, rotationAuthority: 1 })
    }),
    target: stopTarget("drone-sprint-high-g-1000m", 1_000),
    obstacles: [],
    maxTicks: 6_000,
    expectation: passExpectation(6_000)
  },
  {
    id: "underpowered-crew-comfort-1000m",
    label: "Underpowered CrewComfort shortfall",
    transitPolicy: "CrewComfort",
    planner: "DirectLocal",
    initialShip: humanShip(300, {
      orientation: createShipStateV2().orientation,
      propulsionCapability: underpoweredCrewedCargoShipPropulsionCapability
    }),
    target: stopTarget("underpowered-crew-comfort-1000m", 1_000),
    obstacles: [],
    maxTicks: 10_000,
    expectation: expectedFailure("NoAuthority", ["ComfortAccelerationUnavailable"])
  },
  {
    id: "low-rcs-attitude-expected-fail",
    label: "No RCS finite-attitude expected fail",
    transitPolicy: "CrewSprint",
    planner: "DirectLocal",
    initialShip: humanShip(260, {
      authority: createAuthorityState({ mode: "Autopilot", rcsAvailable: false, sasAvailable: true }),
      rcsEnabled: false,
      sasEnabled: true
    }),
    target: stopTarget("low-rcs-attitude-expected-fail", 800),
    obstacles: [],
    maxTicks: 300,
    expectation: expectedFailure("NoAuthority", ["AuthorityInsufficient"])
  },
  {
    id: "no-main-thruster-expected-fail",
    label: "No main thrust expected fail",
    transitPolicy: "CrewSprint",
    planner: "DirectLocal",
    initialShip: humanShip(260, { authority: createAuthorityState({ mode: "Autopilot", mainThrustersAvailable: false }) }),
    target: stopTarget("no-main-thruster-expected-fail", 800),
    obstacles: [],
    maxTicks: 300,
    expectation: expectedFailure("NoAuthority", ["MainThrustersUnavailable"], ["MainThrustersUnavailable", "AuthorityInsufficient"])
  },
  {
    id: "low-fuel-expected-fail",
    label: "Fuel reserve expected fail",
    transitPolicy: "CrewSprint",
    planner: "DirectLocal",
    initialShip: humanShip(7),
    target: stopTarget("low-fuel-expected-fail", 2_500),
    obstacles: [],
    maxTicks: 300,
    expectation: expectedFailure("BrakeReserveInsufficient", ["FuelInsufficient"], ["FuelInsufficient", "BrakeReserveInsufficient"])
  },
  {
    id: "brake-reserve-expected-fail",
    label: "Brake reserve expected fail",
    transitPolicy: "CrewSprint",
    planner: "DirectLocal",
    initialShip: humanShip(300),
    executionShip: humanShip(300, {
      position: vec3(200, 0, 0),
      velocity: vec3(80, 0, 0),
      propulsionCapability: { ...normalCrewedScoutPropulsionCapability, effectiveBrakingThrustNewton: 500 }
    }),
    target: stopTarget("brake-reserve-expected-fail", 500),
    obstacles: [],
    maxTicks: 300,
    expectation: expectedFailure("BrakeReserveInsufficient", ["BrakeReserveInsufficient"])
  },
  {
    id: "off-route-expected-fail",
    label: "Locked route disturbance expected fail",
    transitPolicy: "CrewSprint",
    planner: "DirectLocal",
    initialShip: humanShip(280),
    target: stopTarget("off-route-expected-fail", 1_000),
    obstacles: [],
    maxTicks: 4_000,
    disturbance: { tick: 120, positionOffset: vec3(0, 85, 0) },
    expectation: expectedFailure("Diverged", ["OffLockedRoute"])
  },
  {
    id: "single-obstacle-corner-1000m",
    label: "Single obstacle geometry corner",
    transitPolicy: "CrewComfort",
    planner: "ObstacleAvoidanceLocal",
    initialShip: humanShip(320),
    target: stopTarget("single-obstacle-corner-1000m", 1_000),
    obstacles: [obstacle("corner-single", 500, 0, 24, 12)],
    maxTicks: 9_000,
    expectation: passExpectation(9_000, 0)
  },
  {
    id: "sharp-corner-geometry-1000m",
    label: "Sharp multi-obstacle geometry corner",
    transitPolicy: "CrewComfort",
    planner: "ObstacleAvoidanceLocal",
    initialShip: humanShip(340),
    target: stopTarget("sharp-corner-geometry-1000m", 1_000),
    obstacles: [
      obstacle("sharp-a", 260, 0, 14, 8),
      obstacle("sharp-b", 470, 34, 15, 8),
      obstacle("sharp-c", 670, -34, 15, 8),
      obstacle("sharp-d", 840, 0, 14, 8)
    ],
    maxTicks: 11_000,
    expectation: passExpectation(11_000, 0)
  },
  {
    id: "terminal-holding-no-snap",
    label: "Terminal holding without snap",
    transitPolicy: "CrewSprint",
    planner: "DirectLocal",
    initialShip: humanShip(120, { position: vec3(99.2, 0, 0), velocity: vec3(0.2, 0, 0), orientation: alignedForVisiblePhaseSequence() }),
    target: stopTarget("terminal-holding-no-snap", 100),
    obstacles: [],
    maxTicks: 500,
    expectation: { ...passExpectation(500), requireHolding: true }
  },
  {
    id: "hash-determinism-1000m",
    label: "Hash and phase determinism",
    transitPolicy: "CrewSprint",
    planner: "DirectLocal",
    initialShip: humanShip(300),
    target: stopTarget("hash-determinism-1000m", 1_000),
    obstacles: [],
    maxTicks: 6_000,
    expectation: passExpectation(6_000)
  },
  {
    id: "no-silent-replan-1000m",
    label: "Locked plan latch after restored disturbance",
    transitPolicy: "CrewSprint",
    planner: "DirectLocal",
    initialShip: humanShip(300),
    target: stopTarget("no-silent-replan-1000m", 1_000),
    obstacles: [],
    maxTicks: 6_000,
    disturbance: { tick: 120, positionOffset: vec3(0, 85, 0) },
    expectation: { ...expectedFailure("Diverged", ["OffLockedRoute"]), requireLatchedFailure: true }
  }
];

const terminalStatuses = new Set(["Arrived", "Diverged", "OutOfFuel", "NoAuthority", "BrakeReserveInsufficient"]);

const uniqueStrings = (values: readonly string[]): readonly string[] => [...new Set(values)].sort();

const clearanceAtPosition = (position: ShipState["position"], obstacles: readonly ObstacleDescriptor[]): number =>
  obstacles.length === 0
    ? 999_999
    : Math.min(...obstacles.map((candidate) => distance(position, candidate.center) - (candidate.radius + candidate.padding)));

const planDirectionFor = (plan: RoutePlan, activeSegmentId: string | null): ShipState["position"] => {
  const segment = plan.segments.find((candidate) => candidate.id === activeSegmentId) ?? plan.segments[plan.segments.length - 1];
  return segment ? normalize(sub(segment.end, segment.start)) : normalize(sub(plan.target.position, plan.segments[0]?.start ?? vec3()));
};

const createPhaseDurations = (): Record<LockedTransitPhase, number> => ({
  AlignForBurn: 0,
  Accelerate: 0,
  Coast: 0,
  Flip: 0,
  Brake: 0,
  TerminalCapture: 0,
  Holding: 0
});

const createActualAccelerationAccumulator = (): ActualAccelerationAccumulator => ({
  peakPositiveG: 0,
  peakNegativeG: 0,
  peakAppliedAccelerationMps2: 0,
  positiveGTotal: 0,
  positiveTicks: 0,
  negativeGTotal: 0,
  negativeTicks: 0,
  peakAppliedG: 0,
  poweredGTotal: 0,
  poweredTicks: 0,
  belowComfortMainBurnTicks: 0,
  aboveHumanMaximumTicks: 0,
  gravityCoverageTicks: 0
});

const createActuatorTelemetryAccumulator = (): ActuatorTelemetryAccumulator => ({
  requestedBurnSamples: 0,
  actualMainThrustSamples: 0,
  flipSamples: 0,
  minimumMainThrustAlignment: 1,
  maximumMainThrustAlignmentErrorRadians: 0,
  maximumFlipAngleRadians: 0,
  peakCommandedPoweredAccelerationMps2: 0,
  peakAppliedMainAccelerationMps2: 0,
  peakAppliedAccelerationMps2: 0
});

const requireFiniteVector = (value: ShipState["position"] | undefined, label: string): ShipState["position"] => {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    throw new RangeError(`${label} must be a finite vector.`);
  }
  return value;
};

const toPhaseEntry = (accumulator: PhaseAccumulator): BangBangPhaseTimelineEntry => ({
  phase: accumulator.phase,
  startTick: accumulator.startTick,
  endTick: accumulator.endTick,
  durationSeconds: round4(accumulator.sampleCount * bangBangFixedDeltaSeconds),
  sampleCount: accumulator.sampleCount,
  peakPositiveG: round4(accumulator.peakPositiveG),
  peakNegativeG: round4(accumulator.peakNegativeG),
  averageAppliedG: round4(accumulator.sampleCount === 0 ? 0 : accumulator.appliedGTotal / accumulator.sampleCount),
  poweredSeconds: round4(accumulator.poweredTicks * bangBangFixedDeltaSeconds),
  mainThrustSeconds: round4(accumulator.mainThrustTicks * bangBangFixedDeltaSeconds),
  rcsTranslationSeconds: round4(accumulator.rcsTranslationTicks * bangBangFixedDeltaSeconds)
});

const applyDisturbance = (ship: ShipState, disturbance: NonNullable<BangBangTransitScenarioDefinition["disturbance"]>): ShipState => {
  const positionOffset = disturbance.positionOffset ?? vec3();
  const velocityOffset = disturbance.velocityOffset ?? vec3();
  return {
    ...ship,
    position: vec3(ship.position.x + positionOffset.x, ship.position.y + positionOffset.y, ship.position.z + positionOffset.z),
    velocity: vec3(ship.velocity.x + velocityOffset.x, ship.velocity.y + velocityOffset.y, ship.velocity.z + velocityOffset.z)
  };
};

const createPlanner = (kind: BangBangPlannerKind): DirectLocalPlanner | ObstacleAvoidanceLocalPlanner =>
  kind === "DirectLocal" ? new DirectLocalPlanner() : new ObstacleAvoidanceLocalPlanner();

export const getBangBangTransitScenario = (id: BangBangTransitScenarioId): BangBangTransitScenarioDefinition => {
  const scenario = bangBangTransitScenarioCatalog.find((candidate) => candidate.id === id);
  if (!scenario) {
    throw new Error(`Unknown bang-bang transit scenario: ${id}`);
  }
  return scenario;
};

const classify = (
  scenario: BangBangTransitScenarioDefinition,
  status: string,
  firstArrivalTick: number | null,
  firstArrivalDistance: number,
  firstArrivalSpeed: number,
  minObstacleClearance: number,
  replanRequired: boolean,
  failureReasonCodes: readonly string[],
  invalidationReasons: readonly string[],
  lockedPlanStable: boolean,
  holdingObserved: boolean,
  latchedFailureObserved: boolean
): { readonly classification: BangBangTransitScenarioClassification; readonly notes: readonly string[] } => {
  const notes: string[] = [];
  const expected = scenario.expectation;
  const observedCodes = uniqueStrings([...failureReasonCodes, ...invalidationReasons]);

  if (expected.outcome === "ExpectedFail") {
    if (expected.expectedFailureStatus === undefined) {
      notes.push("ExpectedFail has no exact terminal status contract.");
    } else if (status !== expected.expectedFailureStatus) {
      notes.push(`Expected failure status ${expected.expectedFailureStatus}, got ${status}.`);
    }
    const missingCodes = (expected.expectedFailureReasonCodes ?? []).filter((code) => !observedCodes.includes(code));
    if (missingCodes.length > 0) {
      notes.push(`Missing expected failure reason codes: ${missingCodes.join(", ")}.`);
    }
    const unexpectedCodes = observedCodes.filter((code) => !(expected.allowedFailureReasonCodes ?? []).includes(code));
    if (unexpectedCodes.length > 0) {
      notes.push(`Unexpected failure reason codes: ${unexpectedCodes.join(", ")}.`);
    }
    if (!lockedPlanStable) {
      notes.push("Locked plan hash changed during ExpectedFail handling.");
    }
    if (expected.requireLatchedFailure && !latchedFailureObserved) {
      notes.push("Expected a restored-state latch proof, but execution resumed or changed failure state.");
    }
    return { classification: notes.length === 0 ? "ExpectedFail" : "Fail", notes };
  }

  if (status !== "Arrived") {
    notes.push(`Expected Arrived status, got ${status}.`);
  }
  if (firstArrivalTick === null || firstArrivalTick > scenario.maxTicks) {
    notes.push(`Expected first arrival within ${scenario.maxTicks} ticks.`);
  }
  if (firstArrivalDistance > expected.maxFinalDistance) {
    notes.push(`First-arrival distance ${firstArrivalDistance} exceeds ${expected.maxFinalDistance}.`);
  }
  if (firstArrivalSpeed > expected.maxFinalSpeed + 1e-6) {
    notes.push(`First-arrival speed ${firstArrivalSpeed} exceeds ${expected.maxFinalSpeed}.`);
  }
  if (minObstacleClearance < expected.minObstacleClearance) {
    notes.push(`Minimum obstacle clearance ${minObstacleClearance} is below ${expected.minObstacleClearance}.`);
  }
  if (expected.requireNoReplan && replanRequired) {
    notes.push("Unexpected replanRequired signal.");
  }
  if (expected.requireHolding && !holdingObserved) {
    notes.push("Expected controller-integrated Holding phase was not observed.");
  }
  if (!lockedPlanStable) {
    notes.push("Locked plan hash changed.");
  }
  return { classification: notes.length === 0 ? "Pass" : "Fail", notes };
};

/**
 * Executes one scenario at exactly 30 Hz. Every acceleration, impulse, fuel,
 * and phase value is sampled after the executor has called the real flight
 * controller; neither phase names nor renderer state contribute synthetic g.
 */
export const runBangBangTransitScenario = (id: BangBangTransitScenarioId): BangBangTransitMetrics => {
  const scenario = getBangBangTransitScenario(id);
  const planner = createPlanner(scenario.planner);
  const planningShip = scenario.initialShip;
  const initialShip = scenario.executionShip ?? planningShip;
  const initialDistance = distance(initialShip.position, scenario.target.position);
  const planningResult = planner.planResult({
    tick: 0,
    ship: planningShip,
    target: scenario.target,
    obstacles: scenario.obstacles,
    transitPolicy: scenario.transitPolicy
  });

  if (!planningResult.ok) {
    const failureReasonCodes = uniqueStrings(planningResult.rejection.reasonCodes);
    const classification = classify(
      scenario,
      "PlanningRejected",
      null,
      initialDistance,
      magnitude(initialShip.velocity),
      clearanceAtPosition(initialShip.position, scenario.obstacles),
      true,
      failureReasonCodes,
      failureReasonCodes,
      true,
      false,
      false
    );
    const heat = initialShip.propulsionCapability.heat;
    return {
      schemaVersion: 1,
      fixedStepHz: bangBangFixedStepHz,
      scenarioId: scenario.id,
      label: scenario.label,
      classification: classification.classification,
      expectedOutcome: scenario.expectation.outcome,
      status: "PlanningRejected",
      transitPolicy: { requested: scenario.transitPolicy, resolved: null },
      targetDistanceMeters: round4(initialDistance),
      tick: 0,
      simulatedSeconds: 0,
      peakSpeedMps: round4(magnitude(initialShip.velocity)),
      firstArrival: { tick: null, simulatedSeconds: null, finalDistanceMeters: round4(initialDistance), finalSpeedMps: round4(magnitude(initialShip.velocity)) },
      settledTerminal: { settlingTicks: 0, distanceMeters: round4(initialDistance), speedMps: round4(magnitude(initialShip.velocity)) },
      phaseDurationsSeconds: createPhaseDurations(),
      phaseTimeline: [],
      actualAcceleration: {
        peakPositiveG: 0,
        peakNegativeG: 0,
        sustainedPositiveG: 0,
        sustainedNegativeG: 0,
        peakAppliedAccelerationMps2: 0,
        peakAppliedG: 0,
        averagePoweredG: 0,
        poweredSeconds: 0,
        belowComfortMainBurnSeconds: 0,
        aboveHumanMaximumSeconds: 0,
        gravityCoverageFraction: 0
      },
      actuatorTelemetry: {
        requestedBurnSamples: 0,
        actualMainThrustSamples: 0,
        flipSamples: 0,
        minimumMainThrustAlignment: 1,
        maximumMainThrustAlignmentErrorRadians: 0,
        maximumFlipAngleRadians: 0,
        peakCommandedPoweredAccelerationMps2: 0,
        peakAppliedMainAccelerationMps2: 0,
        peakAppliedAccelerationMps2: 0
      },
      modeledPropulsion: {
        model: "actual-applied-impulse-v1",
        impulseNewtonSeconds: 0,
        totalDeltaVMps: 0,
        fuelBurnRateKgPerKilonewtonSecond: round4(initialShip.fuel.burnRate),
        modeledFuelFromImpulseKg: 0,
        actualFuelUsedKg: 0,
        fuelReserveRemainingKg: round4(initialShip.fuel.current - initialShip.fuel.reserve),
        throttleEfficiencyClaim: false
      },
      modeledThermal: {
        model: "capability-metadata-only-v1",
        heatLoadPerNewtonSecond: round4(heat?.heatLoadPerNewtonSecond ?? 0),
        accumulatedHeatLoad: 0,
        sustainedCoolingCapacity: round4(heat?.sustainedCoolingCapacity ?? 0),
        controllerThermalLimitApplied: false
      },
      physicalLimits: {
        occupantMode: initialShip.occupantAccelerationEnvelope.occupantMode,
        minimumComfortG: round4(initialShip.occupantAccelerationEnvelope.minimumComfortAccelerationMps2 / STANDARD_GRAVITY_MPS2),
        maximumHumanG: initialShip.occupantAccelerationEnvelope.maximumPeakAccelerationMps2 === undefined
          ? null
          : round4(initialShip.occupantAccelerationEnvelope.maximumPeakAccelerationMps2 / STANDARD_GRAVITY_MPS2),
        mainThrustNewton: round4(initialShip.propulsionCapability.mainThrustNewton),
        effectiveBrakingThrustNewton: round4(initialShip.propulsionCapability.effectiveBrakingThrustNewton),
        structuralMaxAccelerationMps2: round4(initialShip.propulsionCapability.structuralMaxAccelerationMps2),
        sustainedThermalMaxAccelerationMps2: round4(initialShip.propulsionCapability.sustainedThermalMaxAccelerationMps2),
        maximumPeakAccelerationMps2: round4(initialShip.propulsionCapability.maximumPeakAccelerationMps2)
      },
      lockedPlan: { before: null, after: null, completed: null, stable: true },
      signals: {
        replanRequired: true,
        failureReasonCodes,
        invalidationReasons: failureReasonCodes,
        terminalCaptureObserved: false,
        holdingObserved: false,
        latchedFailureObserved: false
      },
      minObstacleClearanceMeters: round4(clearanceAtPosition(initialShip.position, scenario.obstacles)),
      notes: ["Planner rejected before execution; no synthetic actuator samples were created.", ...classification.notes]
    };
  }

  const plan = planningResult.plan;
  const executor = new AutopilotExecutor(scenario.executorOptions);
  executor.lockPlan(plan, planningShip);
  const loop = new FixedStepSimulationLoop(initialShip, executor, { fixedDeltaSeconds: bangBangFixedDeltaSeconds, maxSubSteps: 8 });
  const phaseDurations = createPhaseDurations();
  const phaseTimeline: BangBangPhaseTimelineEntry[] = [];
  const actualAcceleration = createActualAccelerationAccumulator();
  const actuatorTelemetry = createActuatorTelemetryAccumulator();
  let activePhase: PhaseAccumulator | null = null;
  let peakSpeed = magnitude(initialShip.velocity);
  let minObstacleClearance = clearanceAtPosition(initialShip.position, scenario.obstacles);
  let impulseNewtonSeconds = 0;
  let totalDeltaVMps = 0;
  let modeledFuelFromImpulseKg = 0;
  let firstArrivalTick: number | null = null;
  let firstArrivalDistance = initialDistance;
  let firstArrivalSpeed = magnitude(initialShip.velocity);
  let terminalCaptureObserved = false;
  let holdingObserved = false;
  let shipBeforeDisturbance: ShipState | null = null;
  let latchedFailureObserved = false;
  let settlingTicks = 0;
  let finalShip = initialShip;
  let settledShip = initialShip;

  const sample = (before: ShipState, after: ShipState): void => {
    const telemetry = executor.getTelemetry();
    const phase = telemetry.motionPhase;
    if (!phase) {
      return;
    }
    const appliedAcceleration = after.actuatorTelemetry.lastAppliedAcceleration;
    const appliedAccelerationMps2 = magnitude(appliedAcceleration);
    const appliedG = appliedAccelerationMps2 / STANDARD_GRAVITY_MPS2;
    const routeDirection = planDirectionFor(plan, telemetry.activeSegmentId);
    const signedG = dot(appliedAcceleration, routeDirection) / STANDARD_GRAVITY_MPS2;
    const positiveG = Math.max(0, signedG);
    const negativeG = Math.max(0, -signedG);
    const powered = appliedAccelerationMps2 > 1e-9;
    const mainPowered = after.actuatorTelemetry.mainThrustActive;
    const comfortFloorG = after.occupantAccelerationEnvelope.minimumComfortAccelerationMps2 / STANDARD_GRAVITY_MPS2;
    const humanMaximumG = after.occupantAccelerationEnvelope.maximumPeakAccelerationMps2 === undefined
      ? null
      : after.occupantAccelerationEnvelope.maximumPeakAccelerationMps2 / STANDARD_GRAVITY_MPS2;
    const requestedBurnDirection = requireFiniteVector(telemetry.requestedBurnDirection, "requestedBurnDirection");
    const actualMainThrustDirection = requireFiniteVector(telemetry.actualMainThrustDirection, "actualMainThrustDirection");
    const mainThrustAlignment = finiteEvidenceNumber(telemetry.mainThrustAlignment ?? Number.NaN, "mainThrustAlignment");
    const mainThrustAlignmentErrorRadians = finiteEvidenceNumber(telemetry.mainThrustAlignmentErrorRadians ?? Number.NaN, "mainThrustAlignmentErrorRadians");
    const flipAngleRadians = finiteEvidenceNumber(telemetry.flipAngleRadians ?? Number.NaN, "flipAngleRadians");
    const commandedPoweredAccelerationMps2 = finiteEvidenceNumber(telemetry.commandedPoweredAccelerationMps2 ?? Number.NaN, "commandedPoweredAccelerationMps2");
    const appliedMainAccelerationMps2 = finiteEvidenceNumber(telemetry.appliedMainAccelerationMps2 ?? Number.NaN, "appliedMainAccelerationMps2");
    const telemetryAppliedAccelerationMps2 = finiteEvidenceNumber(telemetry.appliedAccelerationMps2 ?? Number.NaN, "appliedAccelerationMps2");

    phaseDurations[phase] += bangBangFixedDeltaSeconds;
    if (!activePhase || activePhase.phase !== phase) {
      if (activePhase) {
        phaseTimeline.push(toPhaseEntry(activePhase));
      }
      activePhase = {
        phase,
        startTick: telemetry.tick,
        endTick: telemetry.tick,
        sampleCount: 0,
        appliedGTotal: 0,
        peakPositiveG: 0,
        peakNegativeG: 0,
        poweredTicks: 0,
        mainThrustTicks: 0,
        rcsTranslationTicks: 0
      };
    }
    activePhase.endTick = telemetry.tick;
    activePhase.sampleCount += 1;
    activePhase.appliedGTotal += appliedG;
    activePhase.peakPositiveG = Math.max(activePhase.peakPositiveG, positiveG);
    activePhase.peakNegativeG = Math.max(activePhase.peakNegativeG, negativeG);
    activePhase.poweredTicks += powered ? 1 : 0;
    activePhase.mainThrustTicks += mainPowered ? 1 : 0;
    activePhase.rcsTranslationTicks += after.actuatorTelemetry.rcsTranslationActive ? 1 : 0;

    actualAcceleration.peakPositiveG = Math.max(actualAcceleration.peakPositiveG, positiveG);
    actualAcceleration.peakNegativeG = Math.max(actualAcceleration.peakNegativeG, negativeG);
    actualAcceleration.peakAppliedAccelerationMps2 = Math.max(actualAcceleration.peakAppliedAccelerationMps2, appliedAccelerationMps2);
    actualAcceleration.peakAppliedG = Math.max(actualAcceleration.peakAppliedG, appliedG);
    if (positiveG > 1e-9) {
      actualAcceleration.positiveGTotal += positiveG;
      actualAcceleration.positiveTicks += 1;
    }
    if (negativeG > 1e-9) {
      actualAcceleration.negativeGTotal += negativeG;
      actualAcceleration.negativeTicks += 1;
    }
    if (powered) {
      actualAcceleration.poweredGTotal += appliedG;
      actualAcceleration.poweredTicks += 1;
    }
    if (mainPowered && appliedG + 1e-9 < comfortFloorG) {
      actualAcceleration.belowComfortMainBurnTicks += 1;
    }
    if (humanMaximumG !== null && appliedG > humanMaximumG + 1e-9) {
      actualAcceleration.aboveHumanMaximumTicks += 1;
    }
    if (appliedG + 1e-9 >= comfortFloorG && comfortFloorG > 0) {
      actualAcceleration.gravityCoverageTicks += 1;
    }

    actuatorTelemetry.requestedBurnSamples += magnitude(requestedBurnDirection) > 1e-9 ? 1 : 0;
    actuatorTelemetry.actualMainThrustSamples += magnitude(actualMainThrustDirection) > 1e-9 ? 1 : 0;
    actuatorTelemetry.flipSamples += telemetry.flipActive === true ? 1 : 0;
    actuatorTelemetry.minimumMainThrustAlignment = Math.min(actuatorTelemetry.minimumMainThrustAlignment, mainThrustAlignment);
    actuatorTelemetry.maximumMainThrustAlignmentErrorRadians = Math.max(actuatorTelemetry.maximumMainThrustAlignmentErrorRadians, mainThrustAlignmentErrorRadians);
    actuatorTelemetry.maximumFlipAngleRadians = Math.max(actuatorTelemetry.maximumFlipAngleRadians, flipAngleRadians);
    actuatorTelemetry.peakCommandedPoweredAccelerationMps2 = Math.max(actuatorTelemetry.peakCommandedPoweredAccelerationMps2, commandedPoweredAccelerationMps2);
    actuatorTelemetry.peakAppliedMainAccelerationMps2 = Math.max(actuatorTelemetry.peakAppliedMainAccelerationMps2, appliedMainAccelerationMps2);
    actuatorTelemetry.peakAppliedAccelerationMps2 = Math.max(actuatorTelemetry.peakAppliedAccelerationMps2, telemetryAppliedAccelerationMps2);

    const actualImpulse = appliedAccelerationMps2 * before.mass.totalMass * bangBangFixedDeltaSeconds;
    impulseNewtonSeconds += actualImpulse;
    totalDeltaVMps += appliedAccelerationMps2 * bangBangFixedDeltaSeconds;
    modeledFuelFromImpulseKg += (actualImpulse / 1_000) * before.fuel.burnRate;
    peakSpeed = Math.max(peakSpeed, magnitude(after.velocity));
    minObstacleClearance = Math.min(minObstacleClearance, clearanceAtPosition(after.position, scenario.obstacles));
    terminalCaptureObserved = terminalCaptureObserved || telemetry.terminalCaptureActive === true || phase === "TerminalCapture";
    holdingObserved = holdingObserved || telemetry.terminalHoldingActive === true || phase === "Holding";
  };

  for (let index = 0; index < scenario.maxTicks; index += 1) {
    if (scenario.disturbance && loop.getTick() === scenario.disturbance.tick) {
      shipBeforeDisturbance = loop.getShip();
      loop.setShip(applyDisturbance(shipBeforeDisturbance, scenario.disturbance));
    }
    const before = loop.getShip();
    finalShip = loop.step(1);
    sample(before, finalShip);
    const telemetry = executor.getTelemetry();
    if (telemetry.status === "Arrived") {
      firstArrivalTick = telemetry.tick;
      firstArrivalDistance = distance(finalShip.position, plan.target.position);
      firstArrivalSpeed = magnitude(finalShip.velocity);
      settledShip = finalShip;
      break;
    }
    if (terminalStatuses.has(telemetry.status)) {
      if (scenario.expectation.requireLatchedFailure && shipBeforeDisturbance) {
        const failedStatus = telemetry.status;
        const failedHash = telemetry.planHash;
        loop.setShip(shipBeforeDisturbance);
        const beforeRestore = loop.getShip();
        finalShip = loop.step(1);
        sample(beforeRestore, finalShip);
        const restoredTelemetry = executor.getTelemetry();
        latchedFailureObserved =
          restoredTelemetry.status === failedStatus &&
          restoredTelemetry.planHash === failedHash &&
          restoredTelemetry.replanRequired &&
          finalShip.position.x === beforeRestore.position.x &&
          finalShip.position.y === beforeRestore.position.y &&
          finalShip.position.z === beforeRestore.position.z &&
          finalShip.velocity.x === beforeRestore.velocity.x &&
          finalShip.velocity.y === beforeRestore.velocity.y &&
          finalShip.velocity.z === beforeRestore.velocity.z;
      }
      settledShip = finalShip;
      break;
    }
  }

  if (firstArrivalTick !== null) {
    for (let index = 0; index < 30; index += 1) {
      const before = loop.getShip();
      settledShip = loop.step(1);
      sample(before, settledShip);
      settlingTicks += 1;
      if (executor.getTelemetry().status !== "Arrived") {
        break;
      }
    }
  }
  if (activePhase) {
    phaseTimeline.push(toPhaseEntry(activePhase));
  }

  const telemetry = executor.getTelemetry();
  const planHashAfter = telemetry.planHash ?? telemetry.completedPlanHash ?? null;
  const completedPlanHash = telemetry.completedPlanHash ?? null;
  const lockedPlanStable = planHashAfter === plan.planHash && (completedPlanHash === null || completedPlanHash === plan.planHash);
  const failureReasonCodes = uniqueStrings(telemetry.failureReasonCodes);
  const invalidationReasons = uniqueStrings(telemetry.invalidationReasons);
  const classification = classify(
    scenario,
    telemetry.status,
    firstArrivalTick,
    firstArrivalDistance,
    firstArrivalSpeed,
    minObstacleClearance,
    telemetry.replanRequired,
    failureReasonCodes,
    invalidationReasons,
    lockedPlanStable,
    holdingObserved,
    latchedFailureObserved
  );
  const totalSampleTicks = phaseTimeline.reduce((total, entry) => total + entry.sampleCount, 0);
  const heat = initialShip.propulsionCapability.heat;
  const maximumHumanG = initialShip.occupantAccelerationEnvelope.maximumPeakAccelerationMps2 === undefined
    ? null
    : initialShip.occupantAccelerationEnvelope.maximumPeakAccelerationMps2 / STANDARD_GRAVITY_MPS2;

  return {
    schemaVersion: 1,
    fixedStepHz: bangBangFixedStepHz,
    scenarioId: scenario.id,
    label: scenario.label,
    classification: classification.classification,
    expectedOutcome: scenario.expectation.outcome,
    status: telemetry.status,
    transitPolicy: {
      requested: scenario.transitPolicy,
      resolved: plan.motionProfile?.resolvedPolicy.resolvedPolicyId ?? null
    },
    targetDistanceMeters: round4(initialDistance),
    tick: telemetry.tick,
    simulatedSeconds: round4(telemetry.tick * bangBangFixedDeltaSeconds),
    peakSpeedMps: round4(peakSpeed),
    firstArrival: {
      tick: firstArrivalTick,
      simulatedSeconds: firstArrivalTick === null ? null : round4(firstArrivalTick * bangBangFixedDeltaSeconds),
      finalDistanceMeters: round4(firstArrivalDistance),
      finalSpeedMps: round4(firstArrivalSpeed)
    },
    settledTerminal: {
      settlingTicks,
      distanceMeters: round4(distance(settledShip.position, plan.target.position)),
      speedMps: round4(magnitude(settledShip.velocity))
    },
    phaseDurationsSeconds: Object.fromEntries(
      bangBangTransitPhases.map((phase) => [phase, round4(phaseDurations[phase])])
    ) as Readonly<Record<LockedTransitPhase, number>>,
    phaseTimeline,
    actualAcceleration: {
      peakPositiveG: round4(actualAcceleration.peakPositiveG),
      peakNegativeG: round4(actualAcceleration.peakNegativeG),
      sustainedPositiveG: round4(actualAcceleration.positiveTicks === 0 ? 0 : actualAcceleration.positiveGTotal / actualAcceleration.positiveTicks),
      sustainedNegativeG: round4(actualAcceleration.negativeTicks === 0 ? 0 : actualAcceleration.negativeGTotal / actualAcceleration.negativeTicks),
      peakAppliedAccelerationMps2: round4(actualAcceleration.peakAppliedAccelerationMps2),
      peakAppliedG: round4(actualAcceleration.peakAppliedG),
      averagePoweredG: round4(actualAcceleration.poweredTicks === 0 ? 0 : actualAcceleration.poweredGTotal / actualAcceleration.poweredTicks),
      poweredSeconds: round4(actualAcceleration.poweredTicks * bangBangFixedDeltaSeconds),
      belowComfortMainBurnSeconds: round4(actualAcceleration.belowComfortMainBurnTicks * bangBangFixedDeltaSeconds),
      aboveHumanMaximumSeconds: round4(actualAcceleration.aboveHumanMaximumTicks * bangBangFixedDeltaSeconds),
      gravityCoverageFraction: round4(totalSampleTicks === 0 ? 0 : actualAcceleration.gravityCoverageTicks / totalSampleTicks)
    },
    actuatorTelemetry: {
      requestedBurnSamples: actuatorTelemetry.requestedBurnSamples,
      actualMainThrustSamples: actuatorTelemetry.actualMainThrustSamples,
      flipSamples: actuatorTelemetry.flipSamples,
      minimumMainThrustAlignment: round4(actuatorTelemetry.minimumMainThrustAlignment),
      maximumMainThrustAlignmentErrorRadians: round4(actuatorTelemetry.maximumMainThrustAlignmentErrorRadians),
      maximumFlipAngleRadians: round4(actuatorTelemetry.maximumFlipAngleRadians),
      peakCommandedPoweredAccelerationMps2: round4(actuatorTelemetry.peakCommandedPoweredAccelerationMps2),
      peakAppliedMainAccelerationMps2: round4(actuatorTelemetry.peakAppliedMainAccelerationMps2),
      peakAppliedAccelerationMps2: round4(actuatorTelemetry.peakAppliedAccelerationMps2)
    },
    modeledPropulsion: {
      model: "actual-applied-impulse-v1",
      impulseNewtonSeconds: round4(impulseNewtonSeconds),
      totalDeltaVMps: round4(totalDeltaVMps),
      fuelBurnRateKgPerKilonewtonSecond: round4(initialShip.fuel.burnRate),
      modeledFuelFromImpulseKg: round4(modeledFuelFromImpulseKg),
      actualFuelUsedKg: round4(Math.max(0, initialShip.fuel.current - finalShip.fuel.current)),
      fuelReserveRemainingKg: round4(finalShip.fuel.current - finalShip.fuel.reserve),
      throttleEfficiencyClaim: false
    },
    modeledThermal: {
      model: "capability-metadata-only-v1",
      heatLoadPerNewtonSecond: round4(heat?.heatLoadPerNewtonSecond ?? 0),
      accumulatedHeatLoad: round4(impulseNewtonSeconds * (heat?.heatLoadPerNewtonSecond ?? 0)),
      sustainedCoolingCapacity: round4(heat?.sustainedCoolingCapacity ?? 0),
      controllerThermalLimitApplied: false
    },
    physicalLimits: {
      occupantMode: initialShip.occupantAccelerationEnvelope.occupantMode,
      minimumComfortG: round4(initialShip.occupantAccelerationEnvelope.minimumComfortAccelerationMps2 / STANDARD_GRAVITY_MPS2),
      maximumHumanG: maximumHumanG === null ? null : round4(maximumHumanG),
      mainThrustNewton: round4(initialShip.propulsionCapability.mainThrustNewton),
      effectiveBrakingThrustNewton: round4(initialShip.propulsionCapability.effectiveBrakingThrustNewton),
      structuralMaxAccelerationMps2: round4(initialShip.propulsionCapability.structuralMaxAccelerationMps2),
      sustainedThermalMaxAccelerationMps2: round4(initialShip.propulsionCapability.sustainedThermalMaxAccelerationMps2),
      maximumPeakAccelerationMps2: round4(initialShip.propulsionCapability.maximumPeakAccelerationMps2)
    },
    lockedPlan: {
      before: plan.planHash,
      after: planHashAfter,
      completed: completedPlanHash,
      stable: lockedPlanStable
    },
    signals: {
      replanRequired: telemetry.replanRequired,
      failureReasonCodes,
      invalidationReasons,
      terminalCaptureObserved,
      holdingObserved,
      latchedFailureObserved
    },
    minObstacleClearanceMeters: round4(minObstacleClearance),
    notes: [
      "All g, impulse, fuel, and phase values are sampled from fixed-step executor/actuator output; phase labels never create acceleration.",
      "Modeled thermal load is capability metadata only; Browser v1 has no heat-soak curve or thermal throttle efficiency claim.",
      ...classification.notes
    ]
  };
};

export const runBangBangTransitScenarioMatrix = (): readonly BangBangTransitMetrics[] =>
  bangBangTransitScenarioCatalog.map((scenario) => runBangBangTransitScenario(scenario.id));
