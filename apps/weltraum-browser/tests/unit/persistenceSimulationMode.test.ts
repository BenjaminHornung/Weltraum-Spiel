import { describe, expect, it } from "vitest";
import {
  SIMULATION_MODES,
  SIMULATION_MODE_TRANSITIONS,
  SimulationModeTransitionError,
  canTransitionSimulationMode,
  transitionSimulationMode,
  type SimulationMode
} from "../../src/persistence";

describe("simulation mode transitions", () => {
  it("accepts every documented edge and all idempotent self-transitions", () => {
    for (const from of SIMULATION_MODES) {
      expect(transitionSimulationMode(from, from)).toBe(from);
      expect(canTransitionSimulationMode(from, from)).toBe(true);
      for (const to of SIMULATION_MODE_TRANSITIONS[from]) {
        expect(transitionSimulationMode(from, to)).toBe(to);
        expect(canTransitionSimulationMode(from, to)).toBe(true);
      }
    }
  });

  it("rejects every non-self edge absent from the exact matrix", () => {
    for (const from of SIMULATION_MODES) {
      for (const to of SIMULATION_MODES) {
        if (from === to || SIMULATION_MODE_TRANSITIONS[from].includes(to)) {
          continue;
        }
        expect(canTransitionSimulationMode(from, to)).toBe(false);
        try {
          transitionSimulationMode(from, to);
          throw new Error(`Expected ${from} -> ${to} to fail.`);
        } catch (error) {
          expect(error).toBeInstanceOf(SimulationModeTransitionError);
          expect(error).toMatchObject({ code: "INVALID_SIMULATION_MODE_TRANSITION", from, to });
        }
      }
    }
  });

  it("keeps Destroyed terminal and rejects unknown runtime values", () => {
    expect(transitionSimulationMode("Destroyed", "Destroyed")).toBe("Destroyed");
    for (const to of SIMULATION_MODES.filter((mode) => mode !== "Destroyed")) {
      expect(() => transitionSimulationMode("Destroyed", to)).toThrowError(SimulationModeTransitionError);
    }
    expect(() => transitionSimulationMode("Unknown" as SimulationMode, "Active"))
      .toThrowError(expect.objectContaining({ code: "INVALID_SIMULATION_MODE" }));
  });
});
