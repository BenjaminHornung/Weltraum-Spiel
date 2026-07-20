import { describe, expect, it } from "vitest";
import {
  createHestiaCircularTrajectoryRequest,
  predictTrajectory
} from "../../src/trajectory";

describe("gravity coast trajectory", () => {
  it("keeps a full circular VelocityVerlet orbit inside the fixture closure tolerance", () => {
    const request = createHestiaCircularTrajectoryRequest();

    const result = predictTrajectory(request);

    expect(result.status).toBe("Completed");
    if (result.status !== "Completed") {
      throw new Error(`Circular fixture rejected: ${result.issues[0]?.message ?? "unknown"}`);
    }
    const coast = result.segmentResults[0];
    expect(coast?.kind).toBe("GravityCoast");
    if (coast?.kind !== "GravityCoast") {
      throw new Error("Expected circular GravityCoast segment result.");
    }
    expect(coast.resolvedIntegrator).toBe("VelocityVerlet");
    expect(result.metrics.circularClosure).not.toBeNull();
    expect(result.metrics.circularClosure?.withinTolerance).toBe(true);
    expect(result.metrics.circularClosure?.positionClosureDistanceMeters).toBeLessThanOrEqual(
      request.toleranceProfile.closureDistanceToleranceMeters
    );
  });
});
