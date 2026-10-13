import { CONCRETE_PRESETS, cloneAndFreeze } from "./schema";
import type {
  ConcreteQualityPreset,
  GraphicsSettingPath,
  GraphicsSettingsV1,
  ShadowPolicy,
  ShadowQuality,
  TexturePolicy,
  TextureQuality
} from "./types";

interface PresetPolicy {
  readonly renderScale: number;
  readonly maxDevicePixelRatio: number;
  readonly renderDistance: number;
  readonly shadowQuality: ShadowQuality;
  readonly textureQuality: TextureQuality;
  readonly toneMapping: GraphicsSettingsV1["lighting"]["toneMapping"];
  readonly exposure: number;
  readonly decorDensity: number;
  readonly bloomPreference: boolean;
  readonly motionEffectsPreference: boolean;
  readonly antiAliasing: boolean;
}

export const QUALITY_PRESET_POLICIES: Readonly<Record<ConcreteQualityPreset, PresetPolicy>> = Object.freeze({
  Low: Object.freeze({
    renderScale: 0.65,
    maxDevicePixelRatio: 1,
    renderDistance: 1_500,
    shadowQuality: "Off",
    textureQuality: "Low",
    toneMapping: "None",
    exposure: 0.85,
    decorDensity: 0.35,
    bloomPreference: false,
    motionEffectsPreference: false,
    antiAliasing: false
  }),
  Medium: Object.freeze({
    renderScale: 0.8,
    maxDevicePixelRatio: 1.5,
    renderDistance: 3_000,
    shadowQuality: "Low",
    textureQuality: "Medium",
    toneMapping: "Reinhard",
    exposure: 0.95,
    decorDensity: 0.65,
    bloomPreference: false,
    motionEffectsPreference: false,
    antiAliasing: true
  }),
  High: Object.freeze({
    renderScale: 1,
    maxDevicePixelRatio: 2,
    renderDistance: 5_000,
    shadowQuality: "Medium",
    textureQuality: "High",
    toneMapping: "None",
    exposure: 1,
    decorDensity: 1,
    bloomPreference: false,
    motionEffectsPreference: false,
    antiAliasing: true
  }),
  Ultra: Object.freeze({
    renderScale: 1.25,
    maxDevicePixelRatio: 2,
    renderDistance: 10_000,
    shadowQuality: "High",
    textureQuality: "Ultra",
    toneMapping: "ACESFilmic",
    exposure: 1,
    decorDensity: 1,
    bloomPreference: true,
    motionEffectsPreference: true,
    antiAliasing: true
  })
});

export const SHADOW_POLICIES: Readonly<Record<ShadowQuality, ShadowPolicy>> = Object.freeze({
  Off: Object.freeze({ enabled: false, mapType: "Basic", mapSize: 0, updatePolicy: "Never" }),
  Low: Object.freeze({ enabled: true, mapType: "Basic", mapSize: 512, updatePolicy: "OnDemand" }),
  Medium: Object.freeze({ enabled: true, mapType: "PCF", mapSize: 1024, updatePolicy: "OnDemand" }),
  High: Object.freeze({ enabled: true, mapType: "PCFSoft", mapSize: 2048, updatePolicy: "EveryFrame" })
});

export function resolveShadowPolicy(quality: ShadowQuality): ShadowPolicy {
  return cloneAndFreeze(SHADOW_POLICIES[quality]) as ShadowPolicy;
}

export function resolveTexturePolicy(quality: TextureQuality, maxAnisotropy: number): TexturePolicy {
  const safeMaximum = Math.max(1, Math.floor(Number.isFinite(maxAnisotropy) ? maxAnisotropy : 1));
  const requested = quality === "Low" ? 1 : quality === "Medium" ? 2 : quality === "High" ? 4 : safeMaximum;
  return cloneAndFreeze({
    anisotropy: Math.min(requested, safeMaximum),
    maxTextureSizePolicy: "Native",
    mipPolicy: "RendererManaged",
    assetLoaderPreference: "CurrentAsset"
  }) as TexturePolicy;
}

export function applyQualityPreset(base: GraphicsSettingsV1, preset: ConcreteQualityPreset): GraphicsSettingsV1 {
  const policy = QUALITY_PRESET_POLICIES[preset];
  return cloneAndFreeze({
    ...base,
    qualityPreset: preset,
    display: {
      ...base.display,
      renderScale: policy.renderScale,
      maxDevicePixelRatio: policy.maxDevicePixelRatio,
      renderDistance: policy.renderDistance
    },
    shadows: { quality: policy.shadowQuality },
    textures: { quality: policy.textureQuality },
    lighting: {
      quality: preset,
      toneMapping: policy.toneMapping,
      exposure: policy.exposure,
      environmentReflectionQuality: preset
    },
    effects: {
      quality: preset,
      decorDensity: policy.decorDensity,
      bloomPreference: policy.bloomPreference,
      motionEffectsPreference: policy.motionEffectsPreference
    },
    antiAliasing: { enabled: policy.antiAliasing }
  }) as GraphicsSettingsV1;
}

function presetOwnedValue(settings: GraphicsSettingsV1): unknown {
  return {
    display: {
      renderScale: settings.display.renderScale,
      maxDevicePixelRatio: settings.display.maxDevicePixelRatio,
      renderDistance: settings.display.renderDistance
    },
    shadows: settings.shadows,
    textures: settings.textures,
    lighting: settings.lighting,
    effects: settings.effects,
    antiAliasing: settings.antiAliasing
  };
}

export function inferQualityPreset(settings: GraphicsSettingsV1): GraphicsSettingsV1["qualityPreset"] {
  const comparable = JSON.stringify(presetOwnedValue(settings));
  for (const preset of CONCRETE_PRESETS) {
    if (JSON.stringify(presetOwnedValue(applyQualityPreset(settings, preset))) === comparable) {
      return preset;
    }
  }
  return "Custom";
}

export function isPresetOwnedPath(path: GraphicsSettingPath): boolean {
  return path !== "display.fieldOfView" && path !== "display.fpsLimit" && path !== "display.fullscreenPreference";
}
