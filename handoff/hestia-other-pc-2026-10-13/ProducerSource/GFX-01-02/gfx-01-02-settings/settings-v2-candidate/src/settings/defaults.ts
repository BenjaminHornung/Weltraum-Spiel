import { cloneAndFreeze } from "./schema";
import type { GraphicsRuntimeSnapshot, GraphicsSettingsV2 } from "./types";

const highDefaults: GraphicsSettingsV2 = {
  qualityPreset: "High",
  display: {
    renderScale: 1,
    maxDevicePixelRatio: 2,
    fieldOfView: 58,
    renderDistance: 5_000,
    fpsLimit: 0,
    fullscreenPreference: "Windowed"
  },
  shadows: { quality: "Medium" },
  textures: { quality: "High" },
  lighting: {
    quality: "High",
    toneMapping: "None",
    exposure: 1,
    environmentReflectionQuality: "High"
  },
  effects: {
    quality: "High",
    decorDensity: 1,
    bloomPreference: false,
    motionEffectsPreference: false
  },
  antiAliasing: { enabled: true },
  vsync: { mode: "BrowserManaged" },
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
};

export function createDefaultGraphicsSettings(): GraphicsSettingsV2 {
  return cloneAndFreeze(highDefaults) as GraphicsSettingsV2;
}

export function createDefaultRuntimeSnapshot(antiAliasingApplied = true): GraphicsRuntimeSnapshot {
  return cloneAndFreeze({
    renderScale: 1,
    maxDevicePixelRatio: 2,
    effectivePixelRatio: 1,
    fieldOfView: 58,
    renderDistance: 5_000,
    fpsLimit: 0,
    fullscreenActual: "Windowed",
    shadowPolicy: null,
    textureAnisotropy: 1,
    toneMapping: "None",
    exposure: 1,
    decorDensity: 1,
    antiAliasingApplied,
    powerPreferenceApplied: "default",
    rayTracing: "off",
    weatherQuality: null
  }) as GraphicsRuntimeSnapshot;
}
