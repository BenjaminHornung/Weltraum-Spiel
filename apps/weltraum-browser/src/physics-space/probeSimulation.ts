import {
  createPhysicsSpaceSignature,
  serializeCanonicalPhysicsSpaceValue
} from "./canonical";
import { failPhysicsSpace } from "./errors";
import { createPhysicsProbeState, stepPhysicsProbe } from "./integrator";
import type {
  PhysicsProbeSimulationResult,
  PhysicsProbeState,
  PhysicsProbeStepContext,
  PhysicsStepResult
} from "./types";

export const runPhysicsProbeSimulation = (
  initialStateInput: PhysicsProbeState,
  contexts: readonly PhysicsProbeStepContext[]
): PhysicsProbeSimulationResult => {
  const initialState = createPhysicsProbeState(initialStateInput);
  if (!Array.isArray(contexts) || contexts.length === 0) {
    return failPhysicsSpace("INVALID_INPUT", "/contexts", "Probe simulation requires at least one explicit step context.");
  }
  let currentState = initialState;
  const steps: PhysicsStepResult[] = [];
  for (let index = 0; index < contexts.length; index += 1) {
    const context = contexts[index];
    if (context === null || typeof context !== "object" || Array.isArray(context)) {
      return failPhysicsSpace("INVALID_INPUT", `/contexts/${index}`, "Probe step context must be an object.");
    }
    const result = stepPhysicsProbe({ state: currentState, ...context });
    steps.push(result);
    currentState = result.state;
  }
  const frozenSteps = Object.freeze(steps.slice());
  const canonicalValue = { initialState, finalState: currentState, steps: frozenSteps };
  return Object.freeze({
    ...canonicalValue,
    canonicalJson: serializeCanonicalPhysicsSpaceValue(canonicalValue),
    signature: createPhysicsSpaceSignature(canonicalValue)
  });
};

export const simulatePhysicsProbe = runPhysicsProbeSimulation;
