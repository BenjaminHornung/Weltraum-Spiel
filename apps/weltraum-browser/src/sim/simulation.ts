import type { ExecutorTelemetry, Quaternion, ShipState } from "../core/types";
import type { AutopilotExecutor } from "../flight/executor";
import { add, scale, sub } from "../core/vector";

export interface SimulationLoopOptions {
  readonly fixedDeltaSeconds: number;
  readonly maxSubSteps: number;
}

export interface PresentationSnapshot {
  readonly previousShip: ShipState;
  readonly currentShip: ShipState;
  readonly renderedShip: ShipState;
  readonly interpolationAlpha: number;
  readonly accumulatorSeconds: number;
  readonly fixedDeltaSeconds: number;
  readonly fixedStepCountThisFrame: number;
  readonly frameDeltaSeconds: number;
}

const cloneShip = (ship: ShipState): ShipState => ({
  ...ship,
  position: { ...ship.position },
  velocity: { ...ship.velocity },
  orientation: { ...ship.orientation },
  angularVelocity: { ...ship.angularVelocity },
  translationCommand: { ...ship.translationCommand },
  rotationCommand: { ...ship.rotationCommand },
  actuatorTelemetry: {
    ...ship.actuatorTelemetry,
    lastAppliedAcceleration: { ...ship.actuatorTelemetry.lastAppliedAcceleration },
    lastAppliedAngularAcceleration: { ...ship.actuatorTelemetry.lastAppliedAngularAcceleration },
    controlModeEffect: {
      ...ship.actuatorTelemetry.controlModeEffect,
      blockedReasonCodes: [...ship.actuatorTelemetry.controlModeEffect.blockedReasonCodes],
      notes: [...ship.actuatorTelemetry.controlModeEffect.notes]
    }
  },
  mass: { ...ship.mass },
  fuel: { ...ship.fuel, reasonCodes: [...ship.fuel.reasonCodes] },
  authority: { ...ship.authority, reasonCodes: [...ship.authority.reasonCodes] }
});

const normalizeQuaternion = (q: Quaternion): Quaternion => {
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  if (length <= 1e-9) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
};

const slerpQuaternion = (from: Quaternion, to: Quaternion, alpha: number): Quaternion => {
  let target = to;
  let cosHalfTheta = from.x * to.x + from.y * to.y + from.z * to.z + from.w * to.w;
  if (cosHalfTheta < 0) {
    target = { x: -to.x, y: -to.y, z: -to.z, w: -to.w };
    cosHalfTheta = -cosHalfTheta;
  }

  if (cosHalfTheta > 0.9995) {
    return normalizeQuaternion({
      x: from.x + (target.x - from.x) * alpha,
      y: from.y + (target.y - from.y) * alpha,
      z: from.z + (target.z - from.z) * alpha,
      w: from.w + (target.w - from.w) * alpha
    });
  }

  const halfTheta = Math.acos(Math.max(-1, Math.min(1, cosHalfTheta)));
  const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
  const ratioA = Math.sin((1 - alpha) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(alpha * halfTheta) / sinHalfTheta;
  return normalizeQuaternion({
    x: from.x * ratioA + target.x * ratioB,
    y: from.y * ratioA + target.y * ratioB,
    z: from.z * ratioA + target.z * ratioB,
    w: from.w * ratioA + target.w * ratioB
  });
};

const interpolateShip = (previous: ShipState, current: ShipState, alpha: number): ShipState => ({
  ...cloneShip(current),
  position: add(previous.position, scale(sub(current.position, previous.position), alpha)),
  orientation: slerpQuaternion(previous.orientation, current.orientation, alpha)
});

export class FixedStepSimulationLoop {
  private accumulator = 0;
  private tick = 0;
  private previousShip: ShipState;
  private fixedStepCountThisFrame = 0;
  private frameDeltaSeconds = 0;

  constructor(
    private ship: ShipState,
    private readonly executor: AutopilotExecutor,
    private readonly options: SimulationLoopOptions = { fixedDeltaSeconds: 1 / 30, maxSubSteps: 8 }
  ) {
    this.previousShip = cloneShip(ship);
  }

  advance(elapsedSeconds: number): ShipState {
    this.frameDeltaSeconds = Math.max(0, elapsedSeconds);
    this.accumulator += this.frameDeltaSeconds;
    let steps = 0;

    while (this.accumulator >= this.options.fixedDeltaSeconds && steps < this.options.maxSubSteps) {
      this.tick += 1;
      this.previousShip = cloneShip(this.ship);
      this.ship = this.executor.step(this.ship, this.options.fixedDeltaSeconds, this.tick);
      this.accumulator -= this.options.fixedDeltaSeconds;
      steps += 1;
    }

    if (steps === this.options.maxSubSteps) {
      this.accumulator = 0;
    }

    this.fixedStepCountThisFrame = steps;

    return this.ship;
  }

  step(count = 1): ShipState {
    this.frameDeltaSeconds = Math.max(0, count) * this.options.fixedDeltaSeconds;
    this.fixedStepCountThisFrame = Math.max(0, count);
    for (let i = 0; i < count; i += 1) {
      this.tick += 1;
      this.previousShip = cloneShip(this.ship);
      this.ship = this.executor.step(this.ship, this.options.fixedDeltaSeconds, this.tick);
    }

    this.accumulator = 0;

    return this.ship;
  }

  setShip(ship: ShipState): void {
    this.ship = ship;
    this.previousShip = cloneShip(ship);
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

  getPresentationSnapshot(): PresentationSnapshot {
    const alpha = this.options.fixedDeltaSeconds > 0
      ? Math.max(0, Math.min(1, this.accumulator / this.options.fixedDeltaSeconds))
      : 0;
    const previousShip = cloneShip(this.previousShip);
    const currentShip = cloneShip(this.ship);
    return {
      previousShip,
      currentShip,
      renderedShip: interpolateShip(previousShip, currentShip, alpha),
      interpolationAlpha: alpha,
      accumulatorSeconds: this.accumulator,
      fixedDeltaSeconds: this.options.fixedDeltaSeconds,
      fixedStepCountThisFrame: this.fixedStepCountThisFrame,
      frameDeltaSeconds: this.frameDeltaSeconds
    };
  }
}
