import { describe, expect, it } from "vitest";
import {
  createDefaultGraphicsSettings as createLegacyDefaults,
  createGraphicsSettingsEnvelope as createLegacyEnvelope,
  decodeGraphicsSettingsEnvelope as decodeLegacyEnvelope
} from "../control/src/settings";
import { applyQualityPreset as applyLegacyPreset } from "../control/src/settings/presets";
import {
  ALL_GRAPHICS_SETTING_IDS,
  createDefaultGraphicsSettings,
  createDefaultRuntimeSnapshot,
  createGraphicsSettingsController,
  createGraphicsSettingsEnvelope,
  decodeGraphicsSettingsEnvelope,
  detectGraphicsCapabilities,
  applyQualityPreset,
  GraphicsDraftStore,
  loadGraphicsSettings,
  validateGraphicsSettings,
  type GraphicsApplyResult,
  type GraphicsCapabilityProbe,
  type GraphicsRuntimePort,
  type GraphicsRuntimeSnapshot,
  type GraphicsSettingId,
  type GraphicsSettingsV2,
  type StorageLike
} from "../settings-v2-candidate/src/settings";

const probe: GraphicsCapabilityProbe = {
  devicePixelRatio: 1,
  maxAnisotropy: 8,
  maxTextureSize: 4096,
  fullscreenAvailable: true,
  antiAliasingApplied: true,
  effectiveShadows: true,
  renderOnlyDecor: true,
  postProcessing: false,
  motionEffects: false,
  environmentReflections: false,
  textureVariants: false
};

class MemoryStorage implements StorageLike {
  value: string | null = null;
  readError: Error | null = null;
  writeError: Error | null = null;
  writes = 0;

  getItem(): string | null {
    if (this.readError) throw this.readError;
    return this.value;
  }

  setItem(_key: string, value: string): void {
    this.writes++;
    if (this.writeError) throw this.writeError;
    this.value = value;
  }
}

function fakeRuntime(fail = false): {
  readonly port: GraphicsRuntimePort;
  readonly calls: { settings: GraphicsSettingsV2; ids: readonly GraphicsSettingId[] }[];
  readonly initialSnapshot: GraphicsRuntimeSnapshot;
} {
  const initialSnapshot = createDefaultRuntimeSnapshot();
  let current = initialSnapshot;
  const calls: { settings: GraphicsSettingsV2; ids: readonly GraphicsSettingId[] }[] = [];
  return {
    initialSnapshot,
    calls,
    port: {
      getCapabilities: () => detectGraphicsCapabilities(probe),
      getSnapshot: () => current,
      async apply(settings, ids): Promise<GraphicsApplyResult> {
        calls.push({ settings, ids });
        if (fail) throw new Error("runtime unavailable");
        return {
          runtime: current,
          applied: [],
          restartRequired: [],
          skipped: [],
          warnings: []
        };
      }
    }
  };
}

function controllerFor(storage: MemoryStorage, runtime: GraphicsRuntimePort) {
  return createGraphicsSettingsController({ initial: loadGraphicsSettings(storage), storage, runtime });
}

describe("v2 settings schema and migration contracts", () => {
  it("uses strict v2 values with immutable defaults and preserves the 19 existing IDs", () => {
    const settings = createDefaultGraphicsSettings();
    const envelope = createGraphicsSettingsEnvelope(settings);

    expect(envelope.schemaVersion).toBe(2);
    expect(Object.isFrozen(envelope.settings)).toBe(true);
    expect(envelope.settings).not.toHaveProperty("powerPreferenceApplied");
    expect(envelope.settings).not.toHaveProperty("renderer");
    expect(settings).toMatchObject({
      rayTracing: "off",
      weatherQuality: "Low",
      powerPreference: "high-performance",
      adaptiveResolution: {
        enabled: false,
        minRenderScale: 0.5,
        maxRenderScale: 1.25,
        minDevicePixelRatio: 1,
        maxDevicePixelRatio: 2,
        targetFps: 60
      }
    });
    expect(Object.isFrozen(settings.adaptiveResolution)).toBe(true);
    expect(ALL_GRAPHICS_SETTING_IDS).toHaveLength(23);
    expect(ALL_GRAPHICS_SETTING_IDS).toEqual(expect.arrayContaining([
      "renderScale", "maxDevicePixelRatio", "fieldOfView", "renderDistance", "fpsLimit", "fullscreen", "shadows",
      "textureQuality", "textureVariants", "lightingQuality", "toneMapping", "exposure", "environmentReflections",
      "effectsQuality", "decorDensity", "bloom", "motionEffects", "antiAliasing", "vsync"
    ]));
  });

  it("migrates every concrete preset and custom v1 settings through the unchanged v1 decoder", () => {
    const high = createLegacyDefaults();
    const custom = {
      ...high,
      qualityPreset: "Custom" as const,
      effects: { ...high.effects, decorDensity: 0.42 }
    };
    const variants = [
      applyLegacyPreset(high, "Low"),
      applyLegacyPreset(high, "Medium"),
      applyLegacyPreset(high, "High"),
      applyLegacyPreset(high, "Ultra"),
      custom
    ];

    for (const legacy of variants) {
      const oldDecoded = decodeLegacyEnvelope(createLegacyEnvelope(legacy));
      const migrated = decodeGraphicsSettingsEnvelope(createLegacyEnvelope(legacy));
      expect(oldDecoded.ok).toBe(true);
      expect(migrated.ok).toBe(true);
      if (!oldDecoded.ok || !migrated.ok) throw new Error("Expected valid v1 settings to migrate.");
      expect(migrated.value).toMatchObject(oldDecoded.value);
      expect(migrated.value).toMatchObject({
        rayTracing: "off",
        weatherQuality: "Low",
        powerPreference: "high-performance",
        adaptiveResolution: { enabled: false, targetFps: 60 }
      });
    }
  });

  it("rejects invalid new enums, unordered or out-of-range manual bounds, NaN, and unknown keys", () => {
    const settings = createDefaultGraphicsSettings();
    const badValues: unknown[] = [
      { ...settings, rayTracing: "path-traced" },
      { ...settings, weatherQuality: "Custom" },
      { ...settings, powerPreference: "balanced" },
      { ...settings, adaptiveResolution: { ...settings.adaptiveResolution, minRenderScale: 1.3 } },
      { ...settings, adaptiveResolution: { ...settings.adaptiveResolution, minRenderScale: Number.NaN } },
      { ...settings, adaptiveResolution: { ...settings.adaptiveResolution, minRenderScale: 1.1, maxRenderScale: 1 } },
      { ...settings, adaptiveResolution: { ...settings.adaptiveResolution, minDevicePixelRatio: 0.9 } },
      { ...settings, adaptiveResolution: { ...settings.adaptiveResolution, minDevicePixelRatio: 1.8, maxDevicePixelRatio: 1.5 } },
      { ...settings, adaptiveResolution: { ...settings.adaptiveResolution, targetFps: 24 } },
      { ...settings, unexpected: true },
      { ...settings, adaptiveResolution: { ...settings.adaptiveResolution, unexpected: true } }
    ];

    for (const value of badValues) expect(validateGraphicsSettings(value)).toBe(false);
  });

  it("distinguishes unknown future schemas from invalid v2 data", () => {
    const future = { schemaVersion: 7, settings: { preserved: "future bytes" } };
    const invalid = { schemaVersion: 2, settings: { ...createDefaultGraphicsSettings(), unknown: true } };
    const extraEnvelopeKey = { ...createGraphicsSettingsEnvelope(createDefaultGraphicsSettings()), unexpected: true };
    expect(decodeGraphicsSettingsEnvelope(future)).toMatchObject({ ok: false, reason: "FutureVersion" });
    expect(decodeGraphicsSettingsEnvelope(invalid)).toMatchObject({ ok: false, reason: "Invalid" });
    expect(decodeGraphicsSettingsEnvelope(extraEnvelopeKey)).toMatchObject({ ok: false, reason: "Invalid" });
  });
});

describe("v2 settings store and runtime contracts", () => {
  it("keeps new values independent from the original quality presets and exposes flattened paths", () => {
    const store = new GraphicsDraftStore(createDefaultGraphicsSettings());
    for (const preset of ["Low", "Medium", "High", "Ultra"] as const) {
      expect(applyQualityPreset(createDefaultGraphicsSettings(), preset)).toMatchObject(
        applyLegacyPreset(createLegacyDefaults(), preset)
      );
    }
    store.update("rayTracing", "hybrid");
    store.update("weatherQuality", "Ultra");
    store.update("powerPreference", "low-power");
    store.update("adaptiveResolution.targetFps", 90);
    store.update("adaptiveResolution.enabled", true);
    store.applyPreset("Low");

    expect(store.getSnapshot().draft.qualityPreset).toBe("Low");
    expect(store.getSnapshot().draft).toMatchObject({
      rayTracing: "hybrid",
      weatherQuality: "Ultra",
      powerPreference: "low-power",
      adaptiveResolution: { enabled: true, targetFps: 90 }
    });
  });

  it("reports truthful planned and unavailable capabilities and defaults effective metadata", () => {
    const planned = detectGraphicsCapabilities(probe);
    const noDecor = detectGraphicsCapabilities({ ...probe, renderOnlyDecor: false });
    const unavailable = detectGraphicsCapabilities({ ...probe, backend: "unavailable" });
    const runtime = createDefaultRuntimeSnapshot();

    expect(planned.rayTracing.status).toBe("Planned");
    expect(planned.effectsQuality.status).toBe("SupportedLive");
    expect(planned.decorDensity.status).toBe("SupportedLive");
    expect(noDecor.effectsQuality.status).toBe("Unsupported");
    expect(noDecor.decorDensity.status).toBe("Unsupported");
    expect(planned.weatherQuality.status).toBe("Planned");
    expect(planned.powerPreference.status).toBe("SupportedAfterRendererRestart");
    expect(planned.adaptiveResolution.status).toBe(planned.renderScale.status);
    expect(unavailable.rayTracing.status).toBe("Unsupported");
    expect(unavailable.weatherQuality.status).toBe("Unsupported");
    expect(detectGraphicsCapabilities({ ...probe, backend: "webgl2" }).rayTracing.status).toBe("Planned");
    expect(detectGraphicsCapabilities({ ...probe, backend: "webgpu" }).weatherQuality.status).toBe("Planned");
    expect(runtime).toMatchObject({ powerPreferenceApplied: "default", rayTracing: "off", weatherQuality: null });
  });

  it("reports requested skipped changes as saved without inventing live apply", async () => {
    const storage = new MemoryStorage();
    const runtime = fakeRuntime();
    let warnings: readonly string[] = [];
    const port: GraphicsRuntimePort = {
      ...runtime.port,
      async apply(settings, ids) {
        const result = await runtime.port.apply(settings, ids);
        return { ...result, skipped: ["effectsQuality"], warnings };
      }
    };
    const controller = controllerFor(storage, port);
    controller.updateSetting("effects.quality", "Low");
    const result = await controller.apply();
    expect(result.ok).toBe(true);
    expect(runtime.calls[0]?.ids).toContain("effectsQuality");
    expect(JSON.parse(storage.value ?? "null").settings.effects.quality).toBe("Low");
    expect(result.snapshot.confirmed.effects.quality).toBe("Low");
    expect(result.message).toContain("saved");
    expect(result.message).not.toBe("Graphics settings applied.");

    warnings = ["First port warning.", "Second port warning."];
    controller.updateSetting("effects.quality", "Medium");
    const withWarnings = await controller.apply();
    expect(withWarnings.message).toContain("saved");
    for (const warning of warnings) expect(withWarnings.message).toContain(warning);
  });

  it("persists pure desired settings before runtime apply and reports restart from actual preference", async () => {
    const storage = new MemoryStorage();
    const runtime = fakeRuntime();
    const controller = controllerFor(storage, runtime.port);
    controller.updateSetting("rayTracing", "auto");
    controller.updateSetting("weatherQuality", "High");
    controller.updateSetting("powerPreference", "low-power");
    controller.updateSetting("adaptiveResolution.minRenderScale", 0.75);
    controller.updateSetting("adaptiveResolution.maxRenderScale", 1.1);
    controller.updateSetting("adaptiveResolution.targetFps", 90);

    const result = await controller.apply();
    const stored = JSON.parse(storage.value ?? "null") as { schemaVersion: number; settings: GraphicsSettingsV2 };
    expect(result.ok).toBe(true);
    expect(stored.schemaVersion).toBe(2);
    expect(stored.settings).toMatchObject({
      rayTracing: "auto",
      weatherQuality: "High",
      powerPreference: "low-power",
      adaptiveResolution: { minRenderScale: 0.75, maxRenderScale: 1.1, targetFps: 90 }
    });
    expect(Object.keys(stored.settings)).toEqual(expect.arrayContaining([
      "qualityPreset", "display", "shadows", "textures", "lighting", "effects", "antiAliasing", "vsync",
      "rayTracing", "weatherQuality", "powerPreference", "adaptiveResolution"
    ]));
    expect(runtime.calls[0]?.ids).toEqual(expect.arrayContaining([
      "rayTracing", "weatherQuality", "powerPreference", "adaptiveResolution"
    ]));
    expect(runtime.calls[0]?.settings).toMatchObject(stored.settings);
    expect(Object.isFrozen(runtime.calls[0]?.settings.adaptiveResolution)).toBe(true);
    expect(result.snapshot.restartRequired).toContain("powerPreference");
  });

  it("handles storage read and write errors without confirming or applying failed saves", async () => {
    const unreadable = new MemoryStorage();
    unreadable.readError = new Error("read denied");
    expect(loadGraphicsSettings(unreadable)).toMatchObject({ reason: "Unavailable", message: expect.stringContaining("read denied") });
    const unreadableRuntime = fakeRuntime();
    const unreadableController = controllerFor(unreadable, unreadableRuntime.port);
    unreadableController.updateSetting("rayTracing", "contact");
    const readFailure = await unreadableController.apply();
    expect(readFailure.ok).toBe(false);
    expect(readFailure.message).toContain("read denied");
    expect(unreadableRuntime.calls).toHaveLength(0);

    const storage = new MemoryStorage();
    storage.writeError = new Error("quota exceeded");
    const runtime = fakeRuntime();
    const controller = controllerFor(storage, runtime.port);
    const original = controller.getSnapshot().confirmed;
    controller.updateSetting("rayTracing", "contact");
    const result = await controller.apply();

    expect(result.ok).toBe(false);
    expect(result.message).toContain("quota exceeded");
    expect(result.snapshot.confirmed).toEqual(original);
    expect(result.snapshot.hasPendingChanges).toBe(true);
    expect(runtime.calls).toHaveLength(0);
  });

  it("does not overwrite unknown future bytes when Apply is explicitly requested", async () => {
    const storage = new MemoryStorage();
    const futureBytes = '{ "schemaVersion" : 9, "settings" : { "keep" : [1,2,3] } }';
    storage.value = futureBytes;
    const runtime = fakeRuntime();
    const controller = controllerFor(storage, runtime.port);
    controller.updateSetting("display.fieldOfView", 61);

    const result = await controller.apply();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("future");
    expect(storage.value).toBe(futureBytes);
    expect(storage.writes).toBe(0);
    expect(runtime.calls).toHaveLength(0);
  });

  it("keeps runtime state on failure and lets cancel discard only the pending draft", async () => {
    const storage = new MemoryStorage();
    const runtime = fakeRuntime(true);
    const controller = controllerFor(storage, runtime.port);
    const originalRuntime = controller.getSnapshot().runtime;
    controller.updateSetting("rayTracing", "hybrid");
    controller.cancel();
    expect(controller.getSnapshot()).toMatchObject({ hasPendingChanges: false, draft: controller.getSnapshot().confirmed });

    controller.updateSetting("powerPreference", "low-power");
    const result = await controller.apply();
    expect(result.ok).toBe(false);
    expect(result.snapshot.confirmed.powerPreference).toBe("low-power");
    expect(result.snapshot.hasPendingChanges).toBe(false);
    expect(result.snapshot.runtime).toEqual(originalRuntime);
    expect(JSON.parse(storage.value ?? "null").settings.powerPreference).toBe("low-power");

    controller.updateSetting("weatherQuality", "Ultra");
    controller.cancel();
    expect(controller.getSnapshot().draft.weatherQuality).toBe("Low");
    expect(controller.getSnapshot().confirmed.weatherQuality).toBe("Low");
  });
});
