import { AutopilotExecutor, DirectLocalPlanner, FixedStepSimulationLoop, ObstacleAvoidanceLocalPlanner, magnitude, vec3 } from "../core";
import { getScenarioDefinition, scenarioCatalog } from "./scenarios";
import type { PlannerKind, ScenarioDefinition, ScenarioId, ScenarioResult } from "./scenarios";

export { scenarioCatalog };

const createPlanner = (kind: PlannerKind): DirectLocalPlanner | ObstacleAvoidanceLocalPlanner =>
  kind === "DirectLocal" ? new DirectLocalPlanner() : new ObstacleAvoidanceLocalPlanner();

const terminalStatuses = new Set(["Arrived", "Diverged", "OutOfFuel", "NoAuthority"]);

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
  const plan = planner.plan({ tick: 0, ship: scenario.ship, target: scenario.target, obstacles: scenario.obstacles });
  executor.lockPlan(plan);

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
  const initialFuel = scenario.ship.fuel;
  const finalFuel = finalShip.fuel;
  const base = {
    id: scenario.id,
    label: scenario.label,
    tick: telemetry.tick,
    planner: plan.planner,
    planHashBefore: plan.planHash,
    planHashAfter: executor.getLockedPlan()?.planHash ?? null,
    segmentKinds: plan.segments.map((segment) => segment.kind),
    status: telemetry.status,
    replanRequired: telemetry.replanRequired,
    invalidationReasons: telemetry.invalidationReasons,
    authority: finalShip.authority,
    brakingReserve: {
      autopilotAvailable: finalShip.authority.autopilot,
      mainThrustersAvailable: finalShip.authority.mainThrusters,
      fuelAvailable: finalFuel > 0,
      canBrake: finalShip.authority.autopilot && finalShip.authority.mainThrusters && finalFuel > 0
    },
    initialFuel: Number(initialFuel.toFixed(4)),
    finalFuel: Number(finalFuel.toFixed(4)),
    fuelUsed: Number(Math.max(0, initialFuel - finalFuel).toFixed(4)),
    finalSpeed: Number(magnitude(finalShip.velocity).toFixed(4)),
    fuel: Number(finalFuel.toFixed(4)),
    distanceToTarget: telemetry.distanceToTarget,
    offRouteDistance: telemetry.offRouteDistance
  };
  const evaluation = evaluateScenario(scenario, base);

  return { ...base, ...evaluation };
};

export const runScenarioMatrix = (): readonly ScenarioResult[] => scenarioCatalog.map((scenario) => runScenario(scenario.id));
