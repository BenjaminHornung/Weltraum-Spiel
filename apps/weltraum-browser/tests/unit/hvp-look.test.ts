import { describe, expect, it } from "vitest";
import {
  assertHvpWaterPresentation,
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

describe("HVP-02 readable coast daylight palette", () => {
  it("keeps limestone pale and wet rock neutral instead of water-blue", () => {
    const profile = createHvpLookProfile("readable");
    expect(profile.id).toBe(HVP_READABLE_COAST_LOOK_ID);
    const dry = profile.materials.find((material) => material.role === "limestone-dry");
    const wet = profile.materials.find((material) => material.role === "limestone-wet");
    expect(dry?.materialProfile.baseColor.r).toBeGreaterThan(0.7);
    expect(dry?.materialProfile.baseColor.g).toBeGreaterThan(0.6);
    expect(wet).toBeDefined();
    if (wet === undefined) return;
    // Wet rock is darker neutral stone, never water-blue: blue must not dominate red.
    expect(wet.materialProfile.baseColor.b).toBeLessThanOrEqual(wet.materialProfile.baseColor.r + 0.02);
    expect(wet.materialProfile.baseColor.r).toBeLessThan(dry?.materialProfile.baseColor.r ?? 1);
  });

  it("renders turquoise water under a daylight sky with layered fog", () => {
    const profile = createHvpLookProfile("readable");
    expect(profile.water.materialProfile.baseColor.g).toBeGreaterThan(0.5);
    expect(profile.water.materialProfile.baseColor.b).toBeGreaterThan(0.5);
    expect(profile.water.materialProfile.baseColor.r).toBeLessThan(0.3);
    expect(profile.background.color).toBe(0x87b5d9);
    expect(profile.background.fogNear).toBe(48);
    expect(profile.background.fogFar).toBe(170);
    expect(profile.background.fogNear).toBeLessThan(profile.background.fogFar);
    expect(profile.lighting.ambient.groundColor).toBe(0x8c9376);
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

  it("rejects an opaque water mask as a failed underwater oracle", () => {
    const profile = createHvpLookProfile("readable");
    expect(() => assertHvpWaterPresentation({
      ...profile.water,
      opacity: 1,
      materialProfile: Object.freeze({
        ...profile.water.materialProfile,
        opacity: 1,
        depthWrite: true
      })
    })).toThrow(/transparent|opacity|depth/i);
  });
});
