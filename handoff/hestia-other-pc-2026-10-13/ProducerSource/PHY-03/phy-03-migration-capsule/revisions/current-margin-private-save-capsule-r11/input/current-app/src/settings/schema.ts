import type { ConcreteQualityPreset, FpsLimit, GraphicsSettingId, GraphicsSettingPath } from "./types";

export const GRAPHICS_SETTINGS_SCHEMA_VERSION = 1 as const;
export const GRAPHICS_SETTINGS_STORAGE_KEY = "weltraum.browser.graphics-settings";

export const GRAPHICS_LIMITS = Object.freeze({
  renderScale: Object.freeze({ min: 0.5, max: 1.25 }),
  maxDevicePixelRatio: Object.freeze({ min: 1, max: 2 }),
  fieldOfView: Object.freeze({ min: 45, max: 100 }),
  renderDistance: Object.freeze({ min: 500, max: 20_000 }),
  exposure: Object.freeze({ min: 0.5, max: 2 }),
  decorDensity: Object.freeze({ min: 0, max: 1 })
});

export const CONCRETE_PRESETS = Object.freeze<readonly ConcreteQualityPreset[]>(["Low", "Medium", "High", "Ultra"]);
export const FPS_LIMITS = Object.freeze<readonly FpsLimit[]>([0, 30, 60, 120]);

export const GRAPHICS_SETTING_PATH_TO_ID: Readonly<Record<GraphicsSettingPath, GraphicsSettingId>> = Object.freeze({
  "display.renderScale": "renderScale",
  "display.maxDevicePixelRatio": "maxDevicePixelRatio",
  "display.fieldOfView": "fieldOfView",
  "display.renderDistance": "renderDistance",
  "display.fpsLimit": "fpsLimit",
  "display.fullscreenPreference": "fullscreen",
  "shadows.quality": "shadows",
  "textures.quality": "textureQuality",
  "lighting.quality": "lightingQuality",
  "lighting.toneMapping": "toneMapping",
  "lighting.exposure": "exposure",
  "lighting.environmentReflectionQuality": "environmentReflections",
  "effects.quality": "effectsQuality",
  "effects.decorDensity": "decorDensity",
  "effects.bloomPreference": "bloom",
  "effects.motionEffectsPreference": "motionEffects",
  "antiAliasing.enabled": "antiAliasing"
});

export const ALL_GRAPHICS_SETTING_IDS = Object.freeze<readonly GraphicsSettingId[]>([
  "renderScale",
  "maxDevicePixelRatio",
  "fieldOfView",
  "renderDistance",
  "fpsLimit",
  "fullscreen",
  "shadows",
  "textureQuality",
  "textureVariants",
  "lightingQuality",
  "toneMapping",
  "exposure",
  "environmentReflections",
  "effectsQuality",
  "decorDensity",
  "bloom",
  "motionEffects",
  "antiAliasing",
  "vsync"
]);

export function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function cloneAndFreeze<T>(value: T): Readonly<T> {
  return deepFreeze(cloneValue(value));
}

export function clampFinite(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}
