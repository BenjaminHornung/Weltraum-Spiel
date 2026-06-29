import { AutopilotExecutor, DirectLocalPlanner, FixedStepSimulationLoop, ObstacleAvoidanceLocalPlanner, serializeTelemetry, vec3 } from "../core";
import type { ObstacleDescriptor, RoutePlan, ShipState, TargetDescriptor } from "../core";
import { autopilotAuthority, createShipState, defaultObstacles, provingGroundTargets } from "../world/provingGroundWorld";

export interface BrowserRuntimeController {
  advance(elapsedSeconds: number): ReturnType<typeof serializeTelemetry>;
  step(count?: number): ReturnType<typeof serializeTelemetry>;
  getTelemetry(): ReturnType<typeof serializeTelemetry>;
  getPlanHash(): string | null;
  getLockedPlan(): RoutePlan | null;
  useDirectPlan(): RoutePlan;
  useObstacleAvoidancePlan(): RoutePlan;
  disturbShip(offsetX: number): ReturnType<typeof serializeTelemetry>;
}

export const createInitialShip = (): ShipState => createShipState({ authority: autopilotAuthority });

export const defaultTarget: TargetDescriptor = provingGroundTargets.navigationAlpha;

export const browserObstacles: readonly ObstacleDescriptor[] = defaultObstacles;

export const createBrowserRuntime = () => {
  const executor = new AutopilotExecutor({ divergenceDistance: 24 });
  let ship = createInitialShip();
  const loop = new FixedStepSimulationLoop(ship, executor, { fixedDeltaSeconds: 1 / 30, maxSubSteps: 10 });

  const snapshot = () => serializeTelemetry({ ship: loop.getShip(), executor: loop.getTelemetry(), lockedPlan: executor.getLockedPlan() });

  const lockPlan = (plan: RoutePlan): RoutePlan => {
    executor.lockPlan(plan);
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
