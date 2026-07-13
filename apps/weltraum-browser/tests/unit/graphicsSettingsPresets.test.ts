import { describe, expect, it } from "vitest";
import {
  CONCRETE_PRESETS,
  GraphicsDraftStore,
  applyQualityPreset,
  createDefaultGraphicsSettings,
  inferQualityPreset,
  resolveShadowPolicy,
  validateGraphicsSettings
} from "../../src/settings";

describe("graphics settings presets", () => {
  it.each(CONCRETE_PRESETS)("produces a valid deterministic %s preset", (preset) => {
    const first = applyQualityPreset(createDefaultGraphicsSettings(), preset);
    const second = applyQualityPreset(createDefaultGraphicsSettings(), preset);
    expect(first).toEqual(second);
    expect(validateGraphicsSettings(first)).toBe(true);
    expect(inferQualityPreset(first)).toBe(preset);
  });

  it("uses the documented concrete render values", () => {
    const defaults = createDefaultGraphicsSettings();
    expect(applyQualityPreset(defaults, "Low").display).toMatchObject({ renderScale: 0.65, maxDevicePixelRatio: 1, renderDistance: 1_500 });
    expect(applyQualityPreset(defaults, "Medium").display).toMatchObject({ renderScale: 0.8, maxDevicePixelRatio: 1.5, renderDistance: 3_000 });
    expect(applyQualityPreset(defaults, "Ultra").display).toMatchObject({ renderScale: 1.25, maxDevicePixelRatio: 2, renderDistance: 10_000 });
  });

  it("preserves personal FOV, FPS, and fullscreen preferences", () => {
    const defaults = createDefaultGraphicsSettings();
    const base = {
      ...defaults,
      display: { ...defaults.display, fieldOfView: 82, fpsLimit: 30 as const, fullscreenPreference: "Fullscreen" as const }
    };
    expect(applyQualityPreset(base, "Low").display).toMatchObject({ fieldOfView: 82, fpsLimit: 30, fullscreenPreference: "Fullscreen" });
  });

  it("derives Custom for a preset-owned edit but not for a personal preference", () => {
    const store = new GraphicsDraftStore(createDefaultGraphicsSettings());
    store.update("display.renderScale", 0.9);
    expect(store.getSnapshot().draft.qualityPreset).toBe("Custom");
    store.cancel();
    store.update("display.fieldOfView", 72);
    expect(store.getSnapshot().draft.qualityPreset).toBe("High");
  });

  it("bounds interactive values", () => {
    const store = new GraphicsDraftStore(createDefaultGraphicsSettings());
    store.update("display.renderScale", 99);
    store.update("display.maxDevicePixelRatio", -5);
    store.update("display.fieldOfView", 500);
    store.update("display.renderDistance", -1);
    expect(store.getSnapshot().draft.display).toMatchObject({ renderScale: 1.25, maxDevicePixelRatio: 1, fieldOfView: 100, renderDistance: 500 });
  });

  it("resolves stable shadow policies", () => {
    expect(resolveShadowPolicy("Off")).toEqual({ enabled: false, mapType: "Basic", mapSize: 0, updatePolicy: "Never" });
    expect(resolveShadowPolicy("Low")).toEqual({ enabled: true, mapType: "Basic", mapSize: 512, updatePolicy: "OnDemand" });
    expect(resolveShadowPolicy("Medium")).toEqual({ enabled: true, mapType: "PCF", mapSize: 1024, updatePolicy: "OnDemand" });
    expect(resolveShadowPolicy("High")).toEqual({ enabled: true, mapType: "PCFSoft", mapSize: 2048, updatePolicy: "EveryFrame" });
  });
});
