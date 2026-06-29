import { AutopilotExecutor, DirectLocalPlanner, FixedStepSimulationLoop, ObstacleAvoidanceLocalPlanner, createTelemetrySnapshot, vec3 } from "../core";
import type { ObstacleDescriptor, RoutePlan, ShipState, TargetDescriptor } from "../core";
import { autopilotAuthority, createShipState, defaultObstacles, noAutopilotAuthority, provingGroundTargets } from "../world/provingGroundWorld";

export interface BrowserRuntimeController {
  advance(elapsedSeconds: number): ReturnType<typeof createTelemetrySnapshot>;
  step(count?: number): ReturnType<typeof createTelemetrySnapshot>;
  getTelemetry(): ReturnType<typeof createTelemetrySnapshot>;
  getPlanHash(): string | null;
  getLockedPlan(): RoutePlan | null;
  useDirectPlan(): RoutePlan;
  useObstacleAvoidancePlan(): RoutePlan;
  disturbShip(offsetX: number): ReturnType<typeof createTelemetrySnapshot>;
}

export const createInitialShip = (): ShipState => createShipState({ authority: autopilotAuthority });

export const defaultTarget: TargetDescriptor = provingGroundTargets.navigationAlpha;

export const browserObstacles: readonly ObstacleDescriptor[] = defaultObstacles;

export interface BrowserRuntimeOptions {
  readonly initialShip?: ShipState;
}

export const createBrowserRuntime = (options: BrowserRuntimeOptions = {}) => {
  const executor = new AutopilotExecutor({ divergenceDistance: 24 });
  let ship = options.initialShip ?? createInitialShip();
  const loop = new FixedStepSimulationLoop(ship, executor, { fixedDeltaSeconds: 1 / 30, maxSubSteps: 10 });

  const snapshot = () => createTelemetrySnapshot(loop.getShip(), loop.getTelemetry(), executor.getLockedPlan());

  const lockPlan = (plan: RoutePlan): RoutePlan => {
    executor.lockPlan(plan, loop.getShip(), loop.getTick());
    return plan;
  };

  const useDirectPlan = () => lockPlan(new DirectLocalPlanner().plan({ tick: loop.getTick(), ship: loop.getShip(), target: defaultTarget }));

  const useObstacleAvoidancePlan = () =>
    lockPlan(new ObstacleAvoidanceLocalPlanner().plan({ tick: loop.getTick(), ship: loop.getShip(), target: defaultTarget, obstacles: browserObstacles }));

  useObstacleAvoidancePlan();

  const controller: BrowserRuntimeController = {
    advance(elapsedSeconds: number) {
      ship = loop.advance(elapsedSeconds);
      return snapshot();
    },
    step(count = 1) {
      ship = loop.step(count);
      return snapshot();
    },
    getTelemetry: snapshot,
    getPlanHash() {
      return executor.getLockedPlan()?.planHash ?? null;
    },
    getLockedPlan() {
      return executor.getLockedPlan();
    },
    useDirectPlan,
    useObstacleAvoidancePlan,
    disturbShip(offsetX: number) {
      const current = loop.getShip();
      loop.setShip({
        ...current,
        position: vec3(current.position.x + offsetX, current.position.y + 64, current.position.z)
      });
      ship = loop.step(1);
      return snapshot();
    }
  };

  return { controller, loop, executor, getShip: () => ship };
};

export const createSpikeRuntime = createBrowserRuntime;

export const createRuntimeShipForFlightCase = (flightCase: string | null): ShipState => {
  if (flightCase === "insufficient-fuel") {
    return createShipState({ fuel: 0 });
  }
  if (flightCase === "no-authority") {
    return createShipState({ authority: noAutopilotAuthority });
  }

  return createInitialShip();
};
