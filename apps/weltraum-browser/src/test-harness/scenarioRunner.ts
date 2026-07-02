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
import type { AutopilotCourseClassification, AutopilotProvingGroundCourse, AutopilotSpeedProfileId, ObstacleDescriptor, RoutePlan } from "../core";
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
    planHashAfter: executor.getLockedPlan()?.planHash ?? null,
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
  readonly profile: AutopilotSpeedProfileId;
  readonly expectedOutcome: "Pass" | "KnownStress" | "ExpectedFail";
  readonly ticksToArrival: number | null;
  readonly tick: number;
  readonly peakSpeed: number;
  readonly finalSpeed: number;
  readonly finalDistance: number;
  readonly minObstacleClearance: number;
  readonly fuelUsed: number;
  readonly arrivalPhase: string;
  readonly status: string;
  readonly terminalSpeedLimit: number | null;
  readonly planHashBefore: string | null;
  readonly planHashAfter: string | null;
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
    ["finalSpeed", result.finalSpeed],
    ["finalDistance", result.finalDistance],
    ["minObstacleClearance", result.minObstacleClearance],
    ["fuelUsed", result.fuelUsed]
  ] as const;

  for (const [name, value] of finiteMetrics) {
    if (!Number.isFinite(value)) {
      notes.push(`Metric ${name} is not finite: ${value}.`);
    }
  }

  if (result.planHashBefore !== result.planHashAfter) {
    notes.push(`Locked plan hash changed from ${result.planHashBefore ?? "null"} to ${result.planHashAfter ?? "null"}.`);
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
    notes.push(...hardViolations);
    notes.push(...acceptanceViolations.map((violation) => `KnownStress tolerated planner-limit note: ${violation}`));
    return { classification: hardViolations.length === 0 ? "KnownStress" : "Fail", notes };
  }

  if (course.expectedOutcome === "ExpectedFail") {
    if ((course.acceptance.expectedFailureReasonCodes?.length ?? 0) === 0) {
      hardViolations.push("ExpectedFail requires expectedFailureReasonCodes to fail closed.");
    }
    notes.push(...hardViolations);
    return { classification: hardViolations.length === 0 ? "ExpectedFail" : "Fail", notes };
  }

  notes.push(...hardViolations, ...acceptanceViolations);

  return { classification: notes.length === 1 + (course.notes?.length ?? 0) ? "Pass" : "Fail", notes };
};

export const runAutopilotProvingGroundCourse = (
  id: AutopilotProvingGroundCourseId,
  profile: AutopilotSpeedProfileId = "Balanced"
): AutopilotProvingGroundCourseResult => {
  const course = getAutopilotProvingGroundCourse(id);
  const speedProfile = autopilotSpeedProfileFor(profile);
  const plannerKind: PlannerKind = course.planner ?? (course.obstacles.length > 0 ? "ObstacleAvoidanceLocal" : "DirectLocal");
  const planner = createPlanner(plannerKind);
  const planningResult = planner.planResult({ tick: 0, ship: course.initialShip, target: course.target, obstacles: course.obstacles, speedProfile: speedProfile.id });
  const initialFuel = course.initialShip.fuel.current;

  if (!planningResult.ok) {
    const base = {
      courseId: course.id as AutopilotProvingGroundCourseId,
      label: course.label,
      profile: speedProfile.id,
      expectedOutcome: course.expectedOutcome,
      ticksToArrival: null,
      tick: 0,
      peakSpeed: round4(magnitude(course.initialShip.velocity)),
      finalSpeed: round4(magnitude(course.initialShip.velocity)),
      finalDistance: round4(distance(course.initialShip.position, course.target.position)),
      minObstacleClearance: round4(clearanceAtPosition(course.initialShip.position, course.obstacles)),
      fuelUsed: 0,
      arrivalPhase: "None",
      status: "PlanningRejected",
      terminalSpeedLimit: course.target.arrivalEnvelope.terminalSpeed ?? null,
      planHashBefore: null,
      planHashAfter: null,
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

  for (let i = 0; i < course.acceptance.maxTicks; i += 1) {
    if (course.disturbance && loop.getTick() === course.disturbance.tick) {
      const current = loop.getShip();
      loop.setShip({
        ...current,
        position: vec3(
          current.position.x + course.disturbance.positionOffset.x,
          current.position.y + course.disturbance.positionOffset.y,
          current.position.z + course.disturbance.positionOffset.z
        )
      });
    }

    loop.step(1);
    const currentShip = loop.getShip();
    peakSpeed = Math.max(peakSpeed, magnitude(currentShip.velocity));
    minObstacleClearance = Math.min(minObstacleClearance, clearanceAtPosition(currentShip.position, course.obstacles));
    const telemetry = executor.getTelemetry();
    if (telemetry.status === "Arrived") {
      ticksToArrival = telemetry.tick;
      break;
    }
    if (terminalStatuses.has(telemetry.status)) {
      break;
    }
  }

  const telemetry = executor.getTelemetry();
  const finalShip = loop.getShip();
  const base = {
    courseId: course.id as AutopilotProvingGroundCourseId,
    label: course.label,
    profile: speedProfile.id,
    expectedOutcome: course.expectedOutcome,
    ticksToArrival,
    tick: telemetry.tick,
    peakSpeed: round4(peakSpeed),
    finalSpeed: round4(magnitude(finalShip.velocity)),
    finalDistance: round4(distance(finalShip.position, plan.target.position)),
    minObstacleClearance: round4(minObstacleClearance),
    fuelUsed: round4(Math.max(0, initialFuel - finalShip.fuel.current)),
    arrivalPhase: telemetry.arrivalPhase ?? "None",
    status: telemetry.status,
    terminalSpeedLimit: telemetry.terminalSpeedLimit ?? null,
    planHashBefore: plan.planHash,
    planHashAfter: executor.getLockedPlan()?.planHash ?? null,
    replanRequired: telemetry.replanRequired,
    planner: plan.planner,
    segmentKinds: plan.segments.map((segment) => segment.kind),
    failureReasonCodes: telemetry.failureReasonCodes,
    invalidationReasons: telemetry.invalidationReasons
  } satisfies Omit<AutopilotProvingGroundCourseResult, "classification" | "notes">;

  return { ...base, ...evaluateAutopilotProvingGroundCourseResult(course, base) };
};

export const runAutopilotProvingGroundMatrix = (profile: AutopilotSpeedProfileId = "Balanced"): readonly AutopilotProvingGroundCourseResult[] =>
  autopilotProvingGroundCourses.map((course) => runAutopilotProvingGroundCourse(course.id as AutopilotProvingGroundCourseId, profile));
