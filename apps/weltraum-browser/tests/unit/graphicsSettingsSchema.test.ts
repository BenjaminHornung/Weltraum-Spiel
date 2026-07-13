import { describe, expect, it } from "vitest";
import {
  GRAPHICS_SETTINGS_SCHEMA_VERSION,
  createDefaultGraphicsSettings,
  createGraphicsSettingsEnvelope,
  decodeGraphicsSettingsEnvelope,
  validateGraphicsSettings
} from "../../src/settings";

describe("graphics settings schema", () => {
  it("accepts documented defaults and returns immutable values", () => {
    const defaults = createDefaultGraphicsSettings();
    expect(validateGraphicsSettings(defaults)).toBe(true);
    expect(defaults.qualityPreset).toBe("High");
    expect(defaults.display).toMatchObject({ renderScale: 1, maxDevicePixelRatio: 2, fieldOfView: 58, renderDistance: 5_000 });
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
    expect(envelope.schemaVersion).toBe(1);
    const decoded = decodeGraphicsSettingsEnvelope(JSON.parse(JSON.stringify(envelope)) as unknown);
    expect(decoded).toEqual({ ok: true, value: createDefaultGraphicsSettings() });
  });
});
