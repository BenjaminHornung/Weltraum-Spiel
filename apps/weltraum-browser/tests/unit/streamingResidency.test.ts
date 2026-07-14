import { describe, expect, it } from "vitest";
import {
  RESIDENCY_STATES,
  ResidencyTransitionError,
  canTransitionResidency,
  transitionResidency
} from "../../src/streaming";

describe("streaming residency", () => {
  it("accepts the documented deterministic transitions", () => {
    expect(transitionResidency("NotRequested", "Queued")).toBe("Queued");
    expect(transitionResidency("Queued", "Loading")).toBe("Loading");
    expect(transitionResidency("Loading", "Ready")).toBe("Ready");
    expect(transitionResidency("Ready", "Evicted")).toBe("Evicted");
    expect(transitionResidency("Evicted", "Queued")).toBe("Queued");
    expect(transitionResidency("Failed", "Queued")).toBe("Queued");
    expect(transitionResidency("Cancelled", "Queued")).toBe("Queued");
  });

  it("rejects same-state and undocumented transitions", () => {
    expect(canTransitionResidency("Ready", "Ready")).toBe(false);
    expect(() => transitionResidency("NotRequested", "Ready")).toThrowError(ResidencyTransitionError);
  });

  it("contains only the seven generic residency states", () => {
    expect(RESIDENCY_STATES).toEqual([
      "NotRequested", "Queued", "Loading", "Ready", "Failed", "Evicted", "Cancelled"
    ]);
  });
});
