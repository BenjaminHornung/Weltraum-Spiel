import { cloneAndFreeze } from "./schema";
import type { GraphicsRuntimeSnapshot, GraphicsSettingsV2 } from "./types";

export const DEFAULT_VOXEL_SETTINGS: GraphicsSettingsV2["voxel"] = Object.freeze({
  detail: "High",
  detailDistanceMeters: 4_000,
  streamingBudget: "High"
});

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
  voxel: DEFAULT_VOXEL_SETTINGS
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
    antiAliasingApplied
  }) as GraphicsRuntimeSnapshot;
}
