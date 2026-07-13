import type { SimulationMode } from "./types";

export type SimulationModeTransitionErrorCode = "INVALID_SIMULATION_MODE" | "INVALID_SIMULATION_MODE_TRANSITION";

export class SimulationModeTransitionError extends Error {
  public constructor(
    public readonly code: SimulationModeTransitionErrorCode,
    public readonly from: unknown,
    public readonly to: unknown,
    message: string
  ) {
    super(message);
    this.name = "SimulationModeTransitionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const SIMULATION_MODES = Object.freeze([
  "Active",
  "Background",
  "Dormant",
  "NeedsReplan",
  "NeedsPlayerAttention",
  "Destroyed"
] as const satisfies readonly SimulationMode[]);

export const SIMULATION_MODE_TRANSITIONS: Readonly<Record<SimulationMode, readonly SimulationMode[]>> =
  Object.freeze({
    Active: Object.freeze(["Background", "NeedsReplan", "NeedsPlayerAttention", "Destroyed"] as const),
    Background: Object.freeze(["Active", "Dormant", "NeedsReplan", "NeedsPlayerAttention", "Destroyed"] as const),
    Dormant: Object.freeze(["Background", "NeedsPlayerAttention", "Destroyed"] as const),
    NeedsReplan: Object.freeze(["Active", "Background", "NeedsPlayerAttention", "Destroyed"] as const),
    NeedsPlayerAttention: Object.freeze(["Active", "Background", "Dormant", "NeedsReplan", "Destroyed"] as const),
    Destroyed: Object.freeze([] as const)
  });

export const isSimulationMode = (value: unknown): value is SimulationMode =>
  typeof value === "string" && (SIMULATION_MODES as readonly string[]).includes(value);

function assertMode(value: unknown, from: unknown, to: unknown): asserts value is SimulationMode {
  if (!isSimulationMode(value)) {
    throw new SimulationModeTransitionError("INVALID_SIMULATION_MODE", from, to, "Simulation mode is not supported.");
  }
}

export const canTransitionSimulationMode = (from: SimulationMode, to: SimulationMode): boolean =>
  from === to || SIMULATION_MODE_TRANSITIONS[from].includes(to);

/** Applies only the explicit transition matrix; no simulation or event side effect occurs. */
export const transitionSimulationMode = (from: SimulationMode, to: SimulationMode): SimulationMode => {
  assertMode(from, from, to);
  assertMode(to, from, to);
  if (from === to) {
    return from;
  }
  if (!SIMULATION_MODE_TRANSITIONS[from].includes(to)) {
    throw new SimulationModeTransitionError(
      "INVALID_SIMULATION_MODE_TRANSITION",
      from,
      to,
      `Simulation mode transition ${from} -> ${to} is not allowed.`
    );
  }
  return to;
};
