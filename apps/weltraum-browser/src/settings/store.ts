import { createDefaultGraphicsSettings } from "./defaults";
import { applyQualityPreset, inferQualityPreset, isPresetOwnedPath, QUALITY_PRESET_POLICIES } from "./presets";
import { GRAPHICS_LIMITS, clampFinite, cloneAndFreeze } from "./schema";
import type {
  ConcreteQualityPreset,
  FpsLimit,
  FullscreenPreference,
  GraphicsSettingPath,
  GraphicsSettingsV2,
  QualityPreset,
  ShadowQuality,
  TextureQuality,
  ToneMappingPreference
} from "./types";

export interface GraphicsDraftStoreSnapshot {
  readonly confirmed: GraphicsSettingsV2;
  readonly draft: GraphicsSettingsV2;
  readonly hasPendingChanges: boolean;
}

const shadowQualities: readonly ShadowQuality[] = ["Off", "Low", "Medium", "High"];
const textureQualities: readonly TextureQuality[] = ["Low", "Medium", "High", "Ultra"];
const concretePresets: readonly ConcreteQualityPreset[] = ["Low", "Medium", "High", "Ultra"];
const toneMappings: readonly ToneMappingPreference[] = ["None", "Reinhard", "ACESFilmic"];
const fullscreenPreferences: readonly FullscreenPreference[] = ["Windowed", "Fullscreen"];
const fpsLimits: readonly FpsLimit[] = [0, 30, 60, 120];

function oneOf<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] extends object ? Mutable<T[Key]> : T[Key] };

function mutable(settings: GraphicsSettingsV2): Mutable<GraphicsSettingsV2> {
  return structuredClone(settings) as Mutable<GraphicsSettingsV2>;
}

export class GraphicsDraftStore {
  private confirmed: GraphicsSettingsV2;
  private draft: GraphicsSettingsV2;

  constructor(initial: GraphicsSettingsV2) {
    this.confirmed = cloneAndFreeze(initial) as GraphicsSettingsV2;
    this.draft = cloneAndFreeze(initial) as GraphicsSettingsV2;
  }

  getSnapshot(): GraphicsDraftStoreSnapshot {
    return cloneAndFreeze({
      confirmed: this.confirmed,
      draft: this.draft,
      hasPendingChanges: JSON.stringify(this.confirmed) !== JSON.stringify(this.draft)
    }) as GraphicsDraftStoreSnapshot;
  }

  applyPreset(preset: ConcreteQualityPreset): void {
    this.draft = applyQualityPreset(this.draft, preset);
  }

  update(path: GraphicsSettingPath, value: unknown): void {
    const next = mutable(this.draft);
    switch (path) {
      case "display.renderScale":
        next.display.renderScale = clampFinite(value, GRAPHICS_LIMITS.renderScale.min, GRAPHICS_LIMITS.renderScale.max, next.display.renderScale);
        break;
      case "display.maxDevicePixelRatio":
        next.display.maxDevicePixelRatio = clampFinite(value, GRAPHICS_LIMITS.maxDevicePixelRatio.min, GRAPHICS_LIMITS.maxDevicePixelRatio.max, next.display.maxDevicePixelRatio);
        break;
      case "display.fieldOfView":
        next.display.fieldOfView = clampFinite(value, GRAPHICS_LIMITS.fieldOfView.min, GRAPHICS_LIMITS.fieldOfView.max, next.display.fieldOfView);
        break;
      case "display.renderDistance":
        next.display.renderDistance = clampFinite(value, GRAPHICS_LIMITS.renderDistance.min, GRAPHICS_LIMITS.renderDistance.max, next.display.renderDistance);
        break;
      case "display.fpsLimit":
        next.display.fpsLimit = oneOf(value, fpsLimits, next.display.fpsLimit);
        break;
      case "display.fullscreenPreference":
        next.display.fullscreenPreference = oneOf(value, fullscreenPreferences, next.display.fullscreenPreference);
        break;
      case "shadows.quality":
        next.shadows.quality = oneOf(value, shadowQualities, next.shadows.quality);
        break;
      case "textures.quality":
        next.textures.quality = oneOf(value, textureQualities, next.textures.quality);
        break;
      case "lighting.quality": {
        const quality = oneOf(value, concretePresets, next.lighting.quality === "Custom" ? "High" : next.lighting.quality);
        const policy = QUALITY_PRESET_POLICIES[quality];
        next.lighting = {
          quality,
          toneMapping: policy.toneMapping,
          exposure: policy.exposure,
          environmentReflectionQuality: quality
        };
        break;
      }
      case "lighting.toneMapping":
        next.lighting.toneMapping = oneOf(value, toneMappings, next.lighting.toneMapping);
        next.lighting.quality = "Custom";
        break;
      case "lighting.exposure":
        next.lighting.exposure = clampFinite(value, GRAPHICS_LIMITS.exposure.min, GRAPHICS_LIMITS.exposure.max, next.lighting.exposure);
        next.lighting.quality = "Custom";
        break;
      case "lighting.environmentReflectionQuality":
        next.lighting.environmentReflectionQuality = oneOf(value, concretePresets, next.lighting.environmentReflectionQuality);
        next.lighting.quality = "Custom";
        break;
      case "effects.quality": {
        const quality = oneOf(value, concretePresets, next.effects.quality === "Custom" ? "High" : next.effects.quality);
        const policy = QUALITY_PRESET_POLICIES[quality];
        next.effects = {
          quality,
          decorDensity: policy.decorDensity,
          bloomPreference: policy.bloomPreference,
          motionEffectsPreference: policy.motionEffectsPreference
        };
        break;
      }
      case "effects.decorDensity":
        next.effects.decorDensity = clampFinite(value, GRAPHICS_LIMITS.decorDensity.min, GRAPHICS_LIMITS.decorDensity.max, next.effects.decorDensity);
        next.effects.quality = "Custom";
        break;
      case "effects.bloomPreference":
        if (typeof value === "boolean") next.effects.bloomPreference = value;
        next.effects.quality = "Custom";
        break;
      case "effects.motionEffectsPreference":
        if (typeof value === "boolean") next.effects.motionEffectsPreference = value;
        next.effects.quality = "Custom";
        break;
      case "antiAliasing.enabled":
        if (typeof value === "boolean") next.antiAliasing.enabled = value;
        break;
    }
    if (isPresetOwnedPath(path)) {
      next.qualityPreset = inferQualityPreset(next);
    }
    this.draft = cloneAndFreeze(next) as GraphicsSettingsV2;
  }

  reset(): void {
    this.draft = createDefaultGraphicsSettings();
  }

  cancel(): void {
    this.draft = cloneAndFreeze(this.confirmed) as GraphicsSettingsV2;
  }

  confirm(settings: GraphicsSettingsV2 = this.draft): void {
    this.confirmed = cloneAndFreeze(settings) as GraphicsSettingsV2;
    this.draft = cloneAndFreeze(settings) as GraphicsSettingsV2;
  }
}

export function isQualityPreset(value: QualityPreset): value is ConcreteQualityPreset {
  return value !== "Custom";
}
