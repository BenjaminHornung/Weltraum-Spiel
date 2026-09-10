import { describe, expect, it } from "vitest";
import {
  HVP_READABLE_COAST_LOOK_ID,
  createHvpLookProfile,
  projectHvpLook
} from "../../src/hestia-prototype/presentation/look";

describe("HVP-02 T01 semantic material roles", () => {
  it("changes presentation only and preserves canonical material state", () => {
    const canonical = Object.freeze({
      materialIds: Object.freeze(["hvp:terrain:dry", "hvp:terrain:wet", "hvp:soil"]),
      densityKgPerM3: Object.freeze([2_400, 2_400, 1_500]),
      contentHash: "fnv1a64:0123456789abcdef"
    });

    const selected = projectHvpLook(canonical, "readable");

    expect(selected.profile.id).toBe(HVP_READABLE_COAST_LOOK_ID);
    expect(selected.materialIds).toEqual(canonical.materialIds);
    expect(selected.densityKgPerM3).toEqual(canonical.densityKgPerM3);
    expect(selected.contentHash).toBe(canonical.contentHash);
    expect(selected.profile.materials.map((material) => material.role)).toEqual([
      "limestone-dry",
      "limestone-wet",
      "soil",
      "moss"
    ]);
  });
});

describe("HVP-02 T04 water presentation contract", () => {
  it("keeps water transparent and outside solid/collider authority", () => {
    const profile = createHvpLookProfile("readable");

    expect(profile.water).toMatchObject({
      transparent: true,
      depthWrite: false,
      renderOrder: 1,
      collision: "none",
      physics: "not-simulated"
    });
    expect(profile.water.opacity).toBeGreaterThan(0);
    expect(profile.water.opacity).toBeLessThan(1);
    expect(profile.water.materialProfile.kind).toBe("BasicLit");
    expect(profile.water.materialProfile.depthWrite).toBe(false);
  });
});
