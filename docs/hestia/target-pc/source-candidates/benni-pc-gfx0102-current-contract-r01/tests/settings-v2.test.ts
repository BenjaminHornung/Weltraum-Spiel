import { describe, expect, it } from "vitest";
import { createDefaultGraphicsSettings as legacyDefaults, createGraphicsSettingsEnvelope as legacyEnvelope } from "../control/src/settings";
import { ALL_GRAPHICS_SETTING_IDS, createDefaultGraphicsSettings, createGraphicsSettingsEnvelope, decodeGraphicsSettingsEnvelope } from "../settings-v2-candidate/src/settings";

describe("additive v2 settings regression (red on unchanged control)", () => {
  it("encodes schema 2 and adds independent dimensions", () => {
    const settings = createDefaultGraphicsSettings();
    expect(createGraphicsSettingsEnvelope(settings).schemaVersion).toBe(2);
    expect(settings).toMatchObject({ rayTracing: "off", weatherQuality: "Low", powerPreference: "high-performance", adaptiveResolution: { enabled: false } });
    expect(ALL_GRAPHICS_SETTING_IDS).toContain("weatherQuality");
    expect(ALL_GRAPHICS_SETTING_IDS).toContain("rayTracing");
  });

  it("migrates real v1 without changing old settings", () => {
    const legacy = legacyDefaults();
    const decoded = decodeGraphicsSettingsEnvelope(legacyEnvelope(legacy));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw Error("Migration failed");
    expect(decoded.value).toMatchObject(legacy);
    expect(decoded.value).toHaveProperty("adaptiveResolution.enabled", false);
    expect(decoded.value.effects).toEqual(legacy.effects);
  });
});
