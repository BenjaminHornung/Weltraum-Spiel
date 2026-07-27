import type { SurfaceCollisionQueryPort, SurfacePlayerCommand } from "../contracts";
import {
  stepSurfaceLocomotion,
  type SurfaceLocomotionConfig,
  type SurfaceLocomotionContext,
  type SurfaceLocomotionRejection,
  type SurfaceLocomotionState
} from "./locomotion";

export interface SurfaceFixedStepRuntime {
  readonly previousState: Readonly<SurfaceLocomotionState>;
  readonly currentState: Readonly<SurfaceLocomotionState>;
  readonly accumulatorSeconds: number;
  readonly interpolationAlpha: number;
}

export type SurfaceFixedStepAdvanceResult =
  | Readonly<{ readonly status: "Advanced"; readonly runtime: Readonly<SurfaceFixedStepRuntime>; readonly steps: number }>
  | Readonly<{
    readonly status: "Rejected";
    readonly runtime: Readonly<SurfaceFixedStepRuntime>;
    readonly steps: number;
    readonly rejection: Readonly<SurfaceLocomotionRejection>;
  }>;

export type SurfaceFixedStepCommandFactory = (
  simulationTick: number,
  state: Readonly<SurfaceLocomotionState>
) => Readonly<SurfacePlayerCommand>;

const freezeRuntime = (
  previousState: Readonly<SurfaceLocomotionState>,
  currentState: Readonly<SurfaceLocomotionState>,
  accumulatorSeconds: number,
  fixedDeltaSeconds: number
): Readonly<SurfaceFixedStepRuntime> => Object.freeze({
  previousState,
  currentState,
  accumulatorSeconds,
  interpolationAlpha: accumulatorSeconds / fixedDeltaSeconds
});

export const createSurfaceFixedStepRuntime = (
  state: Readonly<SurfaceLocomotionState>
): Readonly<SurfaceFixedStepRuntime> => Object.freeze({
  previousState: state,
  currentState: state,
  accumulatorSeconds: 0,
  interpolationAlpha: 0
});

export const advanceSurfaceFixedStepRuntime = (
  runtime: Readonly<SurfaceFixedStepRuntime>,
  presentationDeltaSeconds: number,
  commandFactory: SurfaceFixedStepCommandFactory,
  context: Readonly<SurfaceLocomotionContext>,
  collisionPort: SurfaceCollisionQueryPort,
  config: Readonly<SurfaceLocomotionConfig>
): SurfaceFixedStepAdvanceResult => {
  if (!Number.isFinite(presentationDeltaSeconds) || presentationDeltaSeconds < 0) {
    throw new Error("Presentation delta must be finite and non-negative.");
  }

  let accumulatorSeconds = runtime.accumulatorSeconds + presentationDeltaSeconds;
  let previousState = runtime.previousState;
  let currentState = runtime.currentState;
  let steps = 0;

  while (accumulatorSeconds + 1e-12 >= config.fixedDeltaSeconds) {
    const command = commandFactory(currentState.simulationTick + 1, currentState);
    const result = stepSurfaceLocomotion(currentState, command, context, collisionPort, config);
    if (result.status === "Rejected") {
      return {
        status: "Rejected",
        runtime: freezeRuntime(previousState, currentState, accumulatorSeconds, config.fixedDeltaSeconds),
        steps,
        rejection: result.rejection
      };
    }
    previousState = currentState;
    currentState = result.state;
    accumulatorSeconds -= config.fixedDeltaSeconds;
    if (Math.abs(accumulatorSeconds) <= 1e-12) accumulatorSeconds = 0;
    steps += 1;
  }

  return {
    status: "Advanced",
    runtime: freezeRuntime(previousState, currentState, accumulatorSeconds, config.fixedDeltaSeconds),
    steps
  };
};
