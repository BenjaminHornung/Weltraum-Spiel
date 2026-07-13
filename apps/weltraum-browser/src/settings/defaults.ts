import { cloneAndFreeze } from "./schema";
import type { GraphicsRuntimeSnapshot, GraphicsSettingsV1 } from "./types";

const highDefaults: GraphicsSettingsV1 = {
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
  vsync: { mode: "BrowserManaged" }
};

export function createDefaultGraphicsSettings(): GraphicsSettingsV1 {
  return cloneAndFreeze(highDefaults) as GraphicsSettingsV1;
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
    antiAliasingApplied
  }) as GraphicsRuntimeSnapshot;
}
