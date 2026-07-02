import {
  AutopilotExecutor,
  DirectLocalPlanner,
  FixedStepSimulationLoop,
  ObstacleAvoidanceLocalPlanner,
  autopilotSpeedProfileFor,
  distance,
  magnitude,
  roundVec,
  vec3
} from "../core";
import type { AutopilotCourseCategory, AutopilotCourseClassification, AutopilotProvingGroundCourse, AutopilotSpeedProfileId, ExecutorTelemetry, ObstacleDescriptor, RouteLifecycle, RoutePlan, ShipState } from "../core";
import { autopilotProvingGroundCourses, getAutopilotProvingGroundCourse, type AutopilotProvingGroundCourseId } from "../world/autopilotProvingGroundCourses";
import { getScenarioDefinition, scenarioCatalog } from "./scenarios";
import type { PlannerKind, ScenarioDefinition, ScenarioId, ScenarioResult } from "./scenarios";

export { autopilotProvingGroundCourses, scenarioCatalog };

const createPlanner = (kind: PlannerKind): DirectLocalPlanner | ObstacleAvoidanceLocalPlanner =>
  kind === "DirectLocal" ? new DirectLocalPlanner() : new ObstacleAvoidanceLocalPlanner();

const terminalStatuses = new Set(["Arrived", "Diverged", "OutOfFuel", "NoAuthority", "BrakeReserveInsufficient"]);

const evaluateScenario = (scenario: ScenarioDefinition, result: Omit<ScenarioResult, "classification" | "notes">): Pick<ScenarioResult, "classification" | "notes"> => {
  const notes: string[] = [];
  const expected = scenario.expected;

  if (expected.status && result.status !== expected.status) {
    notes.push(`Expected status ${expected.status}, got ${result.status}`);
  }

  if (expected.replanRequired !== undefined && result.replanRequired !== expected.replanRequired) {
    notes.push(`Expected replanRequired=${expected.replanRequired}, got ${result.replanRequired}`);
  }

  if (expected.invalidationReason && !result.invalidationReasons.includes(expected.invalidationReason)) {
    notes.push(`Missing invalidation reason ${expected.invalidationReason}`);
  }

  if (expected.routeValid !== undefined && result.routeValid !== expected.routeValid) {
    notes.push(`Expected routeValid=${expected.routeValid}, got ${result.routeValid}`);
  }

  if (expected.requiresAvoidanceSegment && !result.segmentKinds.includes("Avoidance")) {
    notes.push("Expected an avoidance segment in the locked route");
  }

  if (expected.preservePlanHash && result.planHashAfter !== result.planHashBefore) {
    notes.push(`Locked plan hash changed from ${result.planHashBefore} to ${result.planHashAfter ?? "null"}`);
  }

  return { classification: notes.length === 0 ? "PASS" : "FAIL", notes };
};

export const runScenario = (id: ScenarioId): ScenarioResult => {
  const scenario = getScenarioDefinition(id);
  const executor = new AutopilotExecutor({ divergenceDistance: scenario.divergenceDistance });
  const planner = createPlanner(scenario.planner);
  const planningResult = planner.planResult({ tick: 0, ship: scenario.ship, target: scenario.target, obstacles: scenario.obstacles });
  if (!planningResult.ok) {
    throw new Error(`Scenario ${scenario.id} planner rejection: ${planningResult.rejection.reasonCodes.join(",")}`);
  }
  const plan = planningResult.plan;
  executor.lockPlan(plan, scenario.ship);

  const loop = new FixedStepSimulationLoop(scenario.ship, executor, { fixedDeltaSeconds: 1 / 30, maxSubSteps: 8 });

  for (let i = 0; i < scenario.maxTicks; i += 1) {
    if (scenario.perturbation && loop.getTick() === scenario.perturbation.tick) {
      const current = loop.getShip();
      loop.setShip({
        ...current,
        position: vec3(
          current.position.x + scenario.perturbation.positionOffset.x,
          current.position.y + scenario.perturbation.positionOffset.y,
          current.position.z + scenario.perturbation.positionOffset.z
        )
      });
    }

    loop.step(1);
    if (terminalStatuses.has(executor.getTelemetry().status)) {
      break;
    }
  }

  const telemetry = executor.getTelemetry();
  const finalShip = loop.getShip();
  const initialFuel = scenario.ship.fuel.current;
  const finalFuel = finalShip.fuel.current;
  const base = {
    id: scenario.id,
    label: scenario.label,
    tick: telemetry.tick,
    planner: plan.planner,
    planHashBefore: plan.planHash,
    planHashAfter: telemetry.planHash ?? telemetry.completedPlanHash ?? null,
    segmentKinds: plan.segments.map((segment) => segment.kind),
    targetKind: plan.target.kind,
    arrivalEnvelope: plan.target.arrivalEnvelope,
    routeValidation: planningResult.validation,
    routeScore: planningResult.score,
    status: telemetry.status,
    arrivalPhase: telemetry.arrivalPhase ?? "None",
    replanRequired: telemetry.replanRequired,
    invalidationReasons: telemetry.invalidationReasons,
    failureReasonCodes: telemetry.failureReasonCodes,
    routeValid: telemetry.flightSnapshot.routeValid,
    authority: finalShip.authority,
    brakingReserve: telemetry.flightSnapshot.brakingReserve,
    initialMass: Number(scenario.ship.mass.totalMass.toFixed(4)),
    finalMass: Number(finalShip.mass.totalMass.toFixed(4)),
    initialFuel: Number(initialFuel.toFixed(4)),
    finalFuel: Number(finalFuel.toFixed(4)),
    fuelUsed: Number(Math.max(0, initialFuel - finalFuel).toFixed(4)),
    finalSpeed: Number(magnitude(finalShip.velocity).toFixed(4)),
    terminalSpeedLimit: telemetry.terminalSpeedLimit ?? null,
    terminalSpeedError: telemetry.terminalSpeedError ?? null,
    terminalRadialSpeed: Number((telemetry.terminalRadialSpeed ?? 0).toFixed(4)),
    terminalTangentialSpeed: Number((telemetry.terminalTangentialSpeed ?? 0).toFixed(4)),
    desiredTerminalVelocity: roundVec(telemetry.desiredTerminalVelocity ?? vec3()),
    terminalCaptureActive: telemetry.terminalCaptureActive === true,
    terminalHoldingActive: telemetry.terminalHoldingActive === true,
    fuel: Number(finalFuel.toFixed(4)),
    finalPosition: roundVec(finalShip.position),
    targetPosition: roundVec(plan.target.position),
    distanceToTarget: telemetry.distanceToTarget,
    offRouteDistance: telemetry.offRouteDistance
  };
  const evaluation = evaluateScenario(scenario, base);

  return { ...base, ...evaluation };
};

export const runScenarioMatrix = (): readonly ScenarioResult[] => scenarioCatalog.map((scenario) => runScenario(scenario.id));

export interface AutopilotProvingGroundCourseResult {
  readonly courseId: AutopilotProvingGroundCourseId;
  readonly label: string;
  readonly category: AutopilotCourseCategory;
  readonly catalogSpeedProfile: AutopilotSpeedProfileId;
  readonly profile: AutopilotSpeedProfileId;
  readonly expectedOutcome: "Pass" | "KnownStress" | "ExpectedFail";
  readonly ticksToArrival: number | null;
  readonly tick: number;
  readonly simulatedSeconds: number;
  /** Straight-line distance from the initial ship position to the course target. */
  readonly targetDistance: number;
  /** Catalog-owned straight-line distance in metres for evidence summaries. */
  readonly distanceMeters: number;
  /** Straight-line targetDistance divided by simulatedSeconds; not path-length travelled. */
  readonly averageSpeed: number;
  readonly peakSpeed: number;
  readonly finalSpeed: number;
  readonly finalDistance: number;
  /** Post-arrival holding speed after a bounded deterministic settling window. */
  readonly settledSpeed: number;
  /** Post-arrival distance to target after a bounded deterministic settling window. */
  readonly settledDistance: number;
  /** Number of holding ticks stepped after first Arrived telemetry. */
  readonly settlingTicks: number;
  readonly minObstacleClearance: number;
  readonly fuelUsed: number;
  readonly fuelReserveRemaining: number;
  readonly arrivalPhase: string;
  readonly status: string;
  readonly terminalSpeedLimit: number | null;
  readonly planHashBefore: string | null;
  readonly planHashAfter: string | null;
  readonly completedPlanHash: string | null;
  readonly routeLifecycle: RouteLifecycle | null;
  readonly terminalCaptureTicks: number;
  readonly holdingTicks: number;
  readonly stationKeepingActive: boolean;
  readonly holdingActive: boolean;
  readonly replanRequired: boolean;
  readonly classification: AutopilotCourseClassification;
  readonly notes: readonly string[];
  readonly planner: RoutePlan["planner"] | null;
  readonly segmentKinds: readonly string[];
  readonly failureReasonCodes: readonly string[];
  readonly invalidationReasons: readonly string[];
}

const clearanceAtPosition = (position: { readonly x: number; readonly y: number; readonly z: number }, obstacles: readonly ObstacleDescriptor[]): number => {
  if (obstacles.length === 0) {
    return 999_999;
  }

  return Math.min(...obstacles.map((candidate) => distance(position, candidate.center) - (candidate.radius + candidate.padding)));
};

const round4 = (value: number): number => Number(value.toFixed(4));

const fixedDeltaSeconds = 1 / 30;

const postArrivalSettlingTicks = 30;

const simulatedSecondsForTick = (tick: number): number => round4(Math.max(0, tick) * fixedDeltaSeconds);

const averageSpeedFor = (initialDistance: number, simulatedSeconds: number): number =>
  simulatedSeconds > 0 ? round4(initialDistance / simulatedSeconds) : 0;

const hasReasonCode = (result: Pick<AutopilotProvingGroundCourseResult, "failureReasonCodes" | "invalidationReasons">, code: string): boolean =>
  result.failureReasonCodes.includes(code) || result.invalidationReasons.includes(code);

const hasFailureOrReplanSignal = (result: Pick<AutopilotProvingGroundCourseResult, "failureReasonCodes" | "invalidationReasons" | "replanRequired" | "status">): boolean =>
  result.replanRequired || result.failureReasonCodes.length > 0 || result.invalidationReasons.length > 0 || result.status !== "Arrived";

const appendExpectedFailureViolations = (
  expectedCodes: readonly string[],
  result: Omit<AutopilotProvingGroundCourseResult, "classification" | "notes">,
  notes: string[]
): void => {
  if (expectedCodes.length === 0) {
    return;
  }

  if (!hasFailureOrReplanSignal(result)) {
    notes.push("Expected a failure or replan signal, but none was raised.");
  }

  const missingCodes = expectedCodes.filter((code) => !hasReasonCode(result, code));
  if (missingCodes.length > 0) {
    notes.push(`Expected failure reason codes missing: ${missingCodes.join(",")}.`);
  }
};

const collectHardInvariantViolations = (
  course: AutopilotProvingGroundCourse,
  result: Omit<AutopilotProvingGroundCourseResult, "classification" | "notes">
): string[] => {
  const notes: string[] = [];
  const acceptance = course.acceptance;
  const finiteMetrics = [
    ["tick", result.tick],
    ["peakSpeed", result.peakSpeed],
    ["simulatedSeconds", result.simulatedSeconds],
    ["targetDistance", result.targetDistance],
    ["averageSpeed", result.averageSpeed],
    ["finalSpeed", result.finalSpeed],
    ["finalDistance", result.finalDistance],
    ["settledSpeed", result.settledSpeed],
    ["settledDistance", result.settledDistance],
    ["settlingTicks", result.settlingTicks],
    ["minObstacleClearance", result.minObstacleClearance],
    ["fuelUsed", result.fuelUsed],
    ["fuelReserveRemaining", result.fuelReserveRemaining],
    ["terminalCaptureTicks", result.terminalCaptureTicks],
    ["holdingTicks", result.holdingTicks]
  ] as const;

  for (const [name, value] of finiteMetrics) {
    if (!Number.isFinite(value)) {
      notes.push(`Metric ${name} is not finite: ${value}.`);
    }
  }

  if (result.planHashBefore !== result.planHashAfter) {
    notes.push(`Locked plan hash changed from ${result.planHashBefore ?? "null"} to ${result.planHashAfter ?? "null"}.`);
  }

  if (result.completedPlanHash !== null && result.completedPlanHash !== result.planHashBefore) {
    notes.push(`Completed plan hash ${result.completedPlanHash} does not match locked plan hash ${result.planHashBefore ?? "null"}.`);
  }

  if (!acceptance.allowReplanRequired && result.replanRequired) {
    notes.push("Unexpected replanRequired signal.");
  }

  if (result.status === "Arrived" && course.target.arrivalEnvelope.stopBehavior === "StopWithinEnvelope") {
    if (result.finalDistance > acceptance.maxFinalDistance) {
      notes.push(`Arrived final distance ${result.finalDistance} exceeds ${acceptance.maxFinalDistance}.`);
    }
    if (result.finalSpeed > acceptance.maxFinalSpeed + 1e-6) {
      notes.push(`Arrived final speed ${result.finalSpeed} exceeds ${acceptance.maxFinalSpeed}.`);
    }
  }

  appendExpectedFailureViolations(acceptance.expectedFailureReasonCodes ?? [], result, notes);

  return notes;
};

const collectAcceptanceViolations = (
  course: AutopilotProvingGroundCourse,
  result: Omit<AutopilotProvingGroundCourseResult, "classification" | "notes">
): string[] => {
  const notes: string[] = [];
  const acceptance = course.acceptance;

  if (result.status !== "Arrived") {
    notes.push(`Expected Arrived status, got ${result.status}.`);
  }
  if (result.ticksToArrival === null || result.ticksToArrival > acceptance.maxTicks) {
    notes.push(`Expected arrival within ${acceptance.maxTicks} ticks, got ${result.ticksToArrival ?? "none"}.`);
  }
  if (result.finalDistance > acceptance.maxFinalDistance) {
    notes.push(`Final distance ${result.finalDistance} exceeds ${acceptance.maxFinalDistance}.`);
  }
  if (result.finalSpeed > acceptance.maxFinalSpeed + 1e-6) {
    notes.push(`Final speed ${result.finalSpeed} exceeds ${acceptance.maxFinalSpeed}.`);
  }
  if (result.minObstacleClearance < acceptance.minObstacleClearance) {
    notes.push(`Minimum obstacle clearance ${result.minObstacleClearance} is below ${acceptance.minObstacleClearance}.`);
  }
  if (acceptance.maxFuelUsed !== undefined && result.fuelUsed > acceptance.maxFuelUsed) {
    notes.push(`Fuel used ${result.fuelUsed} exceeds ${acceptance.maxFuelUsed}.`);
  }

  return notes;
};

const collectKnownStressHardAcceptanceViolations = (
  course: AutopilotProvingGroundCourse,
  result: Omit<AutopilotProvingGroundCourseResult, "classification" | "notes">
): string[] => {
  const notes: string[] = [];
  const acceptance = course.acceptance;

  if (result.status !== "Arrived") {
    notes.push(`KnownStress must still arrive; got ${result.status}.`);
  }
  if (result.ticksToArrival === null || result.ticksToArrival > acceptance.maxTicks) {
    notes.push(`KnownStress must arrive within ${acceptance.maxTicks} ticks, got ${result.ticksToArrival ?? "none"}.`);
  }
  if (result.finalDistance > acceptance.maxFinalDistance) {
    notes.push(`KnownStress final distance ${result.finalDistance} exceeds ${acceptance.maxFinalDistance}.`);
  }
  if (result.finalSpeed > acceptance.maxFinalSpeed + 1e-6) {
    notes.push(`KnownStress final speed ${result.finalSpeed} exceeds ${acceptance.maxFinalSpeed}.`);
  }
  if (acceptance.maxFuelUsed !== undefined && result.fuelUsed > acceptance.maxFuelUsed) {
    notes.push(`KnownStress fuel used ${result.fuelUsed} exceeds ${acceptance.maxFuelUsed}.`);
  }

  return notes;
};

const collectKnownStressRouteQualityViolations = (
  course: AutopilotProvingGroundCourse,
  result: Omit<AutopilotProvingGroundCourseResult, "classification" | "notes">
): string[] => {
  if (result.minObstacleClearance >= course.acceptance.minObstacleClearance) {
    return [];
  }
  return [`Minimum obstacle clearance ${result.minObstacleClearance} is below ${course.acceptance.minObstacleClearance}.`];
};

export const evaluateAutopilotProvingGroundCourseResult = (
  course: AutopilotProvingGroundCourse,
  result: Omit<AutopilotProvingGroundCourseResult, "classification" | "notes">
): Pick<AutopilotProvingGroundCourseResult, "classification" | "notes"> => {
  const notes: string[] = ["Obstacle clearance uses closest sampled ship position distance minus obstacle radius plus padding."];
  const hardViolations = collectHardInvariantViolations(course, result);
  const acceptanceViolations = collectAcceptanceViolations(course, result);

  if (course.notes) {
    notes.push(...course.notes);
  }

  if (course.expectedOutcome === "KnownStress") {
    const hardAcceptanceViolations = collectKnownStressHardAcceptanceViolations(course, result);
    const routeQualityViolations = collectKnownStressRouteQualityViolations(course, result);
    notes.push(...hardViolations, ...hardAcceptanceViolations);
    notes.push(...routeQualityViolations.map((violation) => `KnownStress tolerated route-quality planner-limit note: ${violation}`));
    return { classification: hardViolations.length === 0 && hardAcceptanceViolations.length === 0 ? "KnownStress" : "Fail", notes };
  }

  if (course.expectedOutcome === "ExpectedFail") {
    if ((course.acceptance.expectedFailureReasonCodes?.length ?? 0) === 0) {
      hardViolations.push("ExpectedFail requires expectedFailureReasonCodes to fail closed.");
    }
    notes.push(...hardViolations);
    return { classification: hardViolations.length === 0 ? "ExpectedFail" : "Fail", notes };
  }

  notes.push(...hardViolations, ...acceptanceViolations);

  return { classification: hardViolations.length === 0 && acceptanceViolations.length === 0 ? "Pass" : "Fail", notes };
};

export const runAutopilotProvingGroundCourse = (
  id: AutopilotProvingGroundCourseId,
  profile?: AutopilotSpeedProfileId
): AutopilotProvingGroundCourseResult => {
  const course = getAutopilotProvingGroundCourse(id);
  const resolvedProfile = profile ?? course.speedProfile ?? "Balanced";
  const speedProfile = autopilotSpeedProfileFor(resolvedProfile);
  const plannerKind: PlannerKind = course.planner ?? (course.obstacles.length > 0 ? "ObstacleAvoidanceLocal" : "DirectLocal");
  const planner = createPlanner(plannerKind);
  const planningResult = planner.planResult({ tick: 0, ship: course.initialShip, target: course.target, obstacles: course.obstacles, speedProfile: speedProfile.id });
  const initialFuel = course.initialShip.fuel.current;
  const initialDistance = distance(course.initialShip.position, course.target.position);

  if (!planningResult.ok) {
    const simulatedSeconds = simulatedSecondsForTick(0);
    const base = {
      courseId: course.id as AutopilotProvingGroundCourseId,
      label: course.label,
      category: course.category,
      catalogSpeedProfile: course.speedProfile,
      profile: speedProfile.id,
      expectedOutcome: course.expectedOutcome,
      ticksToArrival: null,
      tick: 0,
      simulatedSeconds,
      targetDistance: round4(initialDistance),
      distanceMeters: course.distanceMeters,
      averageSpeed: averageSpeedFor(initialDistance, simulatedSeconds),
      peakSpeed: round4(magnitude(course.initialShip.velocity)),
      finalSpeed: round4(magnitude(course.initialShip.velocity)),
      finalDistance: round4(distance(course.initialShip.position, course.target.position)),
      settledSpeed: round4(magnitude(course.initialShip.velocity)),
      settledDistance: round4(distance(course.initialShip.position, course.target.position)),
      settlingTicks: 0,
      minObstacleClearance: round4(clearanceAtPosition(course.initialShip.position, course.obstacles)),
      fuelUsed: 0,
      fuelReserveRemaining: round4(course.initialShip.fuel.current - course.initialShip.fuel.reserve),
      arrivalPhase: "None",
      status: "PlanningRejected",
      terminalSpeedLimit: course.target.arrivalEnvelope.terminalSpeed ?? null,
      planHashBefore: null,
      planHashAfter: null,
      completedPlanHash: null,
      routeLifecycle: "Idle",
      terminalCaptureTicks: 0,
      holdingTicks: 0,
      stationKeepingActive: false,
      holdingActive: false,
      replanRequired: true,
      planner: null,
      segmentKinds: [],
      failureReasonCodes: planningResult.rejection.reasonCodes,
      invalidationReasons: planningResult.rejection.reasonCodes
    } satisfies Omit<AutopilotProvingGroundCourseResult, "classification" | "notes">;
    return { ...base, ...evaluateAutopilotProvingGroundCourseResult(course, base) };
  }

  const plan = planningResult.plan;
  const executor = new AutopilotExecutor({ divergenceDistance: 30 });
  executor.lockPlan(plan, course.initialShip);
  const loop = new FixedStepSimulationLoop(course.initialShip, executor, { fixedDeltaSeconds: 1 / 30, maxSubSteps: 8 });
  let peakSpeed = magnitude(course.initialShip.velocity);
  let minObstacleClearance = clearanceAtPosition(course.initialShip.position, course.obstacles);
  let ticksToArrival: number | null = null;
  let terminalCaptureTicks = 0;
  let holdingTicks = 0;
  let firstArrivalTelemetry: ExecutorTelemetry | null = null;
  let firstArrivalShip: ShipState | null = null;

  for (let i = 0; i < course.acceptance.maxTicks; i += 1) {
    if (course.disturbance && loop.getTick() === course.disturbance.tick) {
      const current = loop.getShip();
      const positionOffset = course.disturbance.positionOffset ?? vec3();
      const velocityOffset = course.disturbance.velocityOffset ?? vec3();
      loop.setShip({
        ...current,
        position: vec3(
          current.position.x + positionOffset.x,
          current.position.y + positionOffset.y,
          current.position.z + positionOffset.z
        ),
        velocity: vec3(
          current.velocity.x + velocityOffset.x,
          current.velocity.y + velocityOffset.y,
          current.velocity.z + velocityOffset.z
        )
      });
    }

    loop.step(1);
    const currentShip = loop.getShip();
    peakSpeed = Math.max(peakSpeed, magnitude(currentShip.velocity));
    minObstacleClearance = Math.min(minObstacleClearance, clearanceAtPosition(currentShip.position, course.obstacles));
    const telemetry = executor.getTelemetry();
    if (telemetry.terminalCaptureActive) {
      terminalCaptureTicks += 1;
    }
    if (telemetry.terminalHoldingActive || telemetry.routeLifecycle === "Holding") {
      holdingTicks += 1;
    }
    if (telemetry.status === "Arrived") {
      ticksToArrival = telemetry.tick;
      firstArrivalTelemetry = telemetry;
      firstArrivalShip = currentShip;
      break;
    }
    if (terminalStatuses.has(telemetry.status)) {
      break;
    }
  }

  const telemetry = firstArrivalTelemetry ?? executor.getTelemetry();
  const finalShip = firstArrivalShip ?? loop.getShip();
  let settledShip = finalShip;
  let settlingTicks = 0;
  if (firstArrivalTelemetry !== null) {
    for (let i = 0; i < postArrivalSettlingTicks; i += 1) {
      loop.step(1);
      settlingTicks += 1;
      settledShip = loop.getShip();
      if (executor.getTelemetry().status !== "Arrived") {
        break;
      }
    }
  }
  const simulatedSeconds = simulatedSecondsForTick(telemetry.tick);
  const base = {
    courseId: course.id as AutopilotProvingGroundCourseId,
    label: course.label,
    category: course.category,
    catalogSpeedProfile: course.speedProfile,
    profile: speedProfile.id,
    expectedOutcome: course.expectedOutcome,
    ticksToArrival,
    tick: telemetry.tick,
    simulatedSeconds,
    targetDistance: round4(initialDistance),
    distanceMeters: course.distanceMeters,
    averageSpeed: averageSpeedFor(initialDistance, simulatedSeconds),
    peakSpeed: round4(peakSpeed),
    finalSpeed: round4(magnitude(finalShip.velocity)),
    finalDistance: round4(distance(finalShip.position, plan.target.position)),
    settledSpeed: round4(magnitude(settledShip.velocity)),
    settledDistance: round4(distance(settledShip.position, plan.target.position)),
    settlingTicks,
    minObstacleClearance: round4(minObstacleClearance),
    fuelUsed: round4(Math.max(0, initialFuel - finalShip.fuel.current)),
    fuelReserveRemaining: round4(finalShip.fuel.current - finalShip.fuel.reserve),
    arrivalPhase: telemetry.arrivalPhase ?? "None",
    status: telemetry.status,
    terminalSpeedLimit: telemetry.terminalSpeedLimit ?? null,
    planHashBefore: plan.planHash,
    planHashAfter: telemetry.planHash ?? telemetry.completedPlanHash ?? null,
    completedPlanHash: telemetry.completedPlanHash ?? null,
    routeLifecycle: telemetry.routeLifecycle ?? null,
    terminalCaptureTicks,
    holdingTicks,
    stationKeepingActive: telemetry.stationKeepingActive === true,
    holdingActive: telemetry.terminalHoldingActive === true,
    replanRequired: telemetry.replanRequired,
    planner: plan.planner,
    segmentKinds: plan.segments.map((segment) => segment.kind),
    failureReasonCodes: telemetry.failureReasonCodes,
    invalidationReasons: telemetry.invalidationReasons
  } satisfies Omit<AutopilotProvingGroundCourseResult, "classification" | "notes">;

  return { ...base, ...evaluateAutopilotProvingGroundCourseResult(course, base) };
};

export const runAutopilotProvingGroundMatrix = (profile?: AutopilotSpeedProfileId): readonly AutopilotProvingGroundCourseResult[] =>
  autopilotProvingGroundCourses.map((course) => runAutopilotProvingGroundCourse(course.id as AutopilotProvingGroundCourseId, profile));
