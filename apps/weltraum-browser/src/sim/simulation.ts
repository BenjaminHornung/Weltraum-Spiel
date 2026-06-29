import type { ExecutorTelemetry, ShipState } from "../core/types";
import type { AutopilotExecutor } from "../flight/executor";

export interface SimulationLoopOptions {
  readonly fixedDeltaSeconds: number;
  readonly maxSubSteps: number;
}

export class FixedStepSimulationLoop {
  private accumulator = 0;
  private tick = 0;

  constructor(
    private ship: ShipState,
    private readonly executor: AutopilotExecutor,
    private readonly options: SimulationLoopOptions = { fixedDeltaSeconds: 1 / 30, maxSubSteps: 8 }
  ) {}

  advance(elapsedSeconds: number): ShipState {
    this.accumulator += Math.max(0, elapsedSeconds);
    let steps = 0;

    while (this.accumulator >= this.options.fixedDeltaSeconds && steps < this.options.maxSubSteps) {
      this.tick += 1;
      this.ship = this.executor.step(this.ship, this.options.fixedDeltaSeconds, this.tick);
      this.accumulator -= this.options.fixedDeltaSeconds;
      steps += 1;
    }

    if (steps === this.options.maxSubSteps) {
      this.accumulator = 0;
    }

    return this.ship;
  }

  step(count = 1): ShipState {
    for (let i = 0; i < count; i += 1) {
      this.tick += 1;
      this.ship = this.executor.step(this.ship, this.options.fixedDeltaSeconds, this.tick);
    }

    return this.ship;
  }

  setShip(ship: ShipState): void {
    this.ship = ship;
  }

  getShip(): ShipState {
    return this.ship;
  }

  getTick(): number {
    return this.tick;
  }

  getTelemetry(): ExecutorTelemetry {
    return this.executor.getTelemetry();
  }
}
