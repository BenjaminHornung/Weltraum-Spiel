import { describe, expect, it } from "vitest";
import { globalQuantumCoordinate } from "../../src/voxel/adaptive";
import { createHardAuthorityRequirement } from "../../src/voxel/representation";
import {
  CONCRETE_PRESETS,
  applyQualityPreset,
  createDefaultGraphicsSettings,
  createVoxelQualityPolicy,
  type VoxelQuality
} from "../../src/settings";

describe("VoxelQualityPolicy", () => {
  it("maps deterministic provisional visual caps, distances, and budgets", () => {
    const policies = CONCRETE_PRESETS.map((preset) =>
      createVoxelQualityPolicy(applyQualityPreset(createDefaultGraphicsSettings(), preset))
    );

    expect(policies.map((policy) => policy.maximumVisualAdaptiveLevel)).toEqual([2, 3, 3, 4]);
    expect(policies.map((policy) => policy.detailDistanceMeters)).toEqual([750, 2_000, 4_000, 8_000]);
    expect(policies.map((policy) => policy.maximumEstimatedBytes)).toEqual([
      64_000_000,
      128_000_000,
      256_000_000,
      512_000_000
    ]);
    expect(policies.map((policy) => policy.maximumWorkUnits)).toEqual([100_000, 250_000, 500_000, 1_000_000]);
    expect(policies.map((policy) => policy.maximumUploadUnits)).toEqual([100_000, 250_000, 500_000, 1_000_000]);
    expect(policies.every((policy) => policy.schemaVersion === "voxel-quality-policy-v2")).toBe(true);
  });

  it("returns a defensive deeply frozen policy", () => {
    const settings = structuredClone(createDefaultGraphicsSettings());
    const policy = createVoxelQualityPolicy(settings);
    Object.assign(settings.voxel, { detail: "Low", detailDistanceMeters: 100 });

    expect(policy).toEqual({
      schemaVersion: "voxel-quality-policy-v2",
      detail: "High",
      maximumVisualAdaptiveLevel: 3,
      detailDistanceMeters: 4_000,
      streamingBudget: "High",
      maximumEstimatedBytes: 256_000_000,
      maximumWorkUnits: 500_000,
      maximumUploadUnits: 500_000
    });
    expect(Object.isFrozen(policy)).toBe(true);
  });

  it("keeps the L4 hard-pin contract quality-independent and exposes no simulation or gameplay inputs", () => {
    const policyFor = (detail: VoxelQuality) =>
      createVoxelQualityPolicy(applyQualityPreset(createDefaultGraphicsSettings(), detail));
    const low = policyFor("Low");
    const ultra = policyFor("Ultra");

    for (const policy of [low, ultra]) {
      expect(Object.keys(policy)).not.toEqual(expect.arrayContaining([
        "hardPinAdaptiveLevel",
        "simulationTicks",
        "authority",
        "gameplay",
        "edits",
        "collision",
        "structural"
      ]));
    }

    const requirementFor = (detail: VoxelQuality) => {
      policyFor(detail);
      return createHardAuthorityRequirement({
        requestId: "request.settings-policy-invariance",
        reason: "CollisionRequired",
        region: {
          kind: "sphere",
          center: {
            x: globalQuantumCoordinate(0),
            y: globalQuantumCoordinate(0),
            z: globalQuantumCoordinate(0)
          },
          radiusQuantum: globalQuantumCoordinate(1)
        },
        priority: 1
      });
    };
    const lowRequirement = requirementFor("Low");
    const ultraRequirement = requirementFor("Ultra");
    expect(lowRequirement).toEqual(ultraRequirement);
    expect(lowRequirement.targetLevel).toBe(4);
    expect(Object.keys(lowRequirement)).not.toEqual(expect.arrayContaining([
      "simulationTicks",
      "gameplay",
      "edits",
      "structural"
    ]));
  });
});
