import { describe, expect, it } from "vitest";
import type { TransitPolicyConstraints } from "../../src/core/types";
import { STANDARD_GRAVITY_MPS2 } from "../../src/flight/propulsionCapability";
import { legacyTransitPolicyAliases, resolveTransitPolicy, transitPolicyIds } from "../../src/flight/transitPolicies";

const validCustomConstraints: TransitPolicyConstraints = {
  targetAccelerationMps2: 6,
  maximumAccelerationMps2: 8,
  maximumJerkMps3: 3,
  maximumPeakSpeedMps: 42,
  coastAllowed: true,
  coastFraction: 0.3,
  minimumTime: false,
  brakingReserveMultiplier: 1.2,
  turnBehavior: "Balanced",
  waypointBehavior: "BrakeForWaypoint",
  gravityFloorPolicy: "Preferred"
};

describe("autopilot transit policies", () => {
  it("resolves legacy Safe, Balanced, and Fast identities deterministically", () => {
    const safe = resolveTransitPolicy("Safe");
    const balanced = resolveTransitPolicy("Balanced");
    const fast = resolveTransitPolicy("Fast");

    expect(legacyTransitPolicyAliases).toEqual({ Safe: "CrewComfort", Balanced: "CrewComfort", Fast: "CrewSprint" });
    expect(safe).toEqual(resolveTransitPolicy("Safe"));
    expect(balanced).toEqual(resolveTransitPolicy("Balanced"));
    expect(fast).toEqual(resolveTransitPolicy("Fast"));
    expect(safe).toMatchObject({ requestedPolicyId: "Safe", resolvedPolicyId: "CrewComfort", gravityFloorPolicy: "RequiredWhenPhysicallyAvailable" });
    expect(balanced).toMatchObject({ requestedPolicyId: "Balanced", resolvedPolicyId: "CrewComfort", gravityFloorPolicy: "Preferred" });
    expect(fast).toMatchObject({ requestedPolicyId: "Fast", resolvedPolicyId: "CrewSprint", minimumTime: true });
    expect(safe.targetAccelerationMps2).toBeCloseTo(STANDARD_GRAVITY_MPS2 * 0.8, 8);
    expect(balanced.targetAccelerationMps2).toBeCloseTo(STANDARD_GRAVITY_MPS2, 8);
    expect(fast.targetAccelerationFraction).toBe(1);
  });

  it("exposes finite policy snapshots with economy's explicit finite peak-speed and coast contract", () => {
    const snapshots = transitPolicyIds.map((id) => id === "Custom" ? resolveTransitPolicy(id, validCustomConstraints) : resolveTransitPolicy(id));
    const economy = resolveTransitPolicy("Economy");
    const droneSprint = resolveTransitPolicy("DroneSprint");

    for (const policy of snapshots) {
      expect(JSON.parse(JSON.stringify(policy))).toEqual(policy);
      expect(Number.isFinite(policy.maximumAccelerationMps2)).toBe(true);
      expect(Number.isFinite(policy.maximumJerkMps3)).toBe(true);
      expect(Number.isFinite(policy.coastFraction)).toBe(true);
      expect(Number.isFinite(policy.brakingReserveMultiplier)).toBe(true);
    }
    expect(economy).toMatchObject({
      requestedPolicyId: "Economy",
      resolvedPolicyId: "Economy",
      coastAllowed: true,
      minimumTime: false
    });
    expect(economy.maximumPeakSpeedMps).toBeGreaterThan(0);
    expect(economy.coastFraction).toBeGreaterThan(0);
    expect(droneSprint).toMatchObject({
      requestedPolicyId: "DroneSprint",
      resolvedPolicyId: "DroneSprint",
      targetAccelerationFraction: 1,
      gravityFloorPolicy: "Disabled"
    });
  });

  it("requires complete finite non-negative Custom constraints", () => {
    expect(resolveTransitPolicy("Custom", validCustomConstraints)).toMatchObject({
      requestedPolicyId: "Custom",
      resolvedPolicyId: "Custom",
      targetAccelerationMps2: 6
    });
    expect(() => resolveTransitPolicy("Custom")).toThrow(RangeError);
    expect(() => resolveTransitPolicy("Custom", { ...validCustomConstraints, targetAccelerationMps2: Number.NaN })).toThrow(RangeError);
    expect(() => resolveTransitPolicy("Custom", { ...validCustomConstraints, maximumAccelerationMps2: -1 })).toThrow(RangeError);
    expect(() => resolveTransitPolicy("Custom", { ...validCustomConstraints, maximumJerkMps3: -1 })).toThrow(RangeError);
    expect(() => resolveTransitPolicy("Custom", { ...validCustomConstraints, targetAccelerationMps2: undefined })).toThrow(RangeError);
  });
});
