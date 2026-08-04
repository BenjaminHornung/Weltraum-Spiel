import { describe, expect, it } from "vitest";
import {
  GRAPHICS_SETTINGS_SCHEMA_VERSION,
  createDefaultGraphicsSettings,
  createGraphicsSettingsEnvelope,
  decodeGraphicsSettingsEnvelope,
  validateGraphicsSettings,
  type GraphicsSettingsV1
} from "../../src/settings";

describe("graphics settings schema", () => {
  it("accepts documented defaults and returns immutable values", () => {
    const defaults = createDefaultGraphicsSettings();
    expect(validateGraphicsSettings(defaults)).toBe(true);
    expect(defaults.qualityPreset).toBe("High");
    expect(defaults.display).toMatchObject({ renderScale: 1, maxDevicePixelRatio: 2, fieldOfView: 58, renderDistance: 5_000 });
    expect(defaults.voxel).toEqual({ detail: "High", detailDistanceMeters: 4_000, streamingBudget: "High" });
    expect(Object.isFrozen(defaults)).toBe(true);
    expect(Object.isFrozen(defaults.display)).toBe(true);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("rejects non-finite values: %s", (invalid) => {
    const defaults = createDefaultGraphicsSettings();
    const settings = { ...defaults, display: { ...defaults.display, renderScale: invalid } };
    expect(validateGraphicsSettings(settings)).toBe(false);
  });

  it("rejects out-of-range and unknown values", () => {
    const defaults = createDefaultGraphicsSettings();
    const outOfRange = { ...defaults, display: { ...defaults.display, fieldOfView: 101 } };
    expect(validateGraphicsSettings(outOfRange)).toBe(false);

    const unknown = { ...createDefaultGraphicsSettings(), debugMode: true };
    expect(validateGraphicsSettings(unknown)).toBe(false);

    const unknownVoxel = { ...defaults, voxel: { ...defaults.voxel, automaticBudget: true } };
    expect(validateGraphicsSettings(unknownVoxel)).toBe(false);
  });

  it.each([
    { detail: "Auto" },
    { streamingBudget: "Auto" },
    { detailDistanceMeters: 0 },
    { detailDistanceMeters: Number.NaN },
    { detailDistanceMeters: Number.POSITIVE_INFINITY }
  ])("rejects invalid voxel settings: $detail $streamingBudget $detailDistanceMeters", (change) => {
    const defaults = createDefaultGraphicsSettings();
    expect(validateGraphicsSettings({ ...defaults, voxel: { ...defaults.voxel, ...change } })).toBe(false);
  });

  it("migrates V1 without changing any prior field", () => {
    const v1 = {
      qualityPreset: "Custom",
      display: {
        renderScale: 0.7, maxDevicePixelRatio: 1.5, fieldOfView: 82,
        renderDistance: 12_345, fpsLimit: 30, fullscreenPreference: "Fullscreen"
      },
      shadows: { quality: "Low" },
      textures: { quality: "Ultra" },
      lighting: {
        quality: "Custom", toneMapping: "ACESFilmic", exposure: 1.37,
        environmentReflectionQuality: "Medium"
      },
      effects: {
        quality: "Custom", decorDensity: 0.42, bloomPreference: true,
        motionEffectsPreference: true
      },
      antiAliasing: { enabled: false },
      vsync: { mode: "BrowserManaged" }
    } as GraphicsSettingsV1;
    const before = JSON.stringify(v1);

    const decoded = decodeGraphicsSettingsEnvelope({ schemaVersion: 1, settings: v1 });

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const migrated = structuredClone(decoded.value);
    delete (migrated as unknown as { voxel?: unknown }).voxel;
    expect(JSON.stringify(migrated)).toBe(before);
    expect(decoded.value.voxel).toEqual(createDefaultGraphicsSettings().voxel);
  });

  it("fails closed for a future schema version", () => {
    const decoded = decodeGraphicsSettingsEnvelope({
      schemaVersion: GRAPHICS_SETTINGS_SCHEMA_VERSION + 1,
      settings: createDefaultGraphicsSettings()
    });
    expect(decoded).toEqual(expect.objectContaining({ ok: false, reason: "FutureVersion" }));
  });

  it("round-trips the stable versioned envelope", () => {
    const envelope = createGraphicsSettingsEnvelope(createDefaultGraphicsSettings());
    expect(envelope.schemaVersion).toBe(2);
    const decoded = decodeGraphicsSettingsEnvelope(JSON.parse(JSON.stringify(envelope)) as unknown);
    expect(decoded).toEqual({ ok: true, value: createDefaultGraphicsSettings() });
  });
});
