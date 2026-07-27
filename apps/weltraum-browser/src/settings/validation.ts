import { GRAPHICS_LIMITS, GRAPHICS_SETTINGS_SCHEMA_VERSION, cloneAndFreeze } from "./schema";
import { DEFAULT_VOXEL_SETTINGS } from "./defaults";
import { inferQualityPreset } from "./presets";
import type {
  ConcreteQualityPreset,
  FpsLimit,
  FullscreenPreference,
  GraphicsSettingsV1,
  GraphicsSettingsV2,
  QualityPreset,
  ShadowQuality,
  TextureQuality,
  ToneMappingPreference,
  VoxelQuality
} from "./types";

export interface GraphicsSettingsEnvelopeV1 {
  readonly schemaVersion: 1;
  readonly settings: GraphicsSettingsV1;
}

export interface GraphicsSettingsEnvelopeV2 {
  readonly schemaVersion: 2;
  readonly settings: GraphicsSettingsV2;
}

export type DecodeGraphicsSettingsResult =
  | { readonly ok: true; readonly value: GraphicsSettingsV2 }
  | { readonly ok: false; readonly reason: "Invalid" | "FutureVersion"; readonly message: string };

const qualityPresets: readonly QualityPreset[] = ["Low", "Medium", "High", "Ultra", "Custom"];
const concretePresets: readonly ConcreteQualityPreset[] = ["Low", "Medium", "High", "Ultra"];
const shadowQualities: readonly ShadowQuality[] = ["Off", "Low", "Medium", "High"];
const textureQualities: readonly TextureQuality[] = ["Low", "Medium", "High", "Ultra"];
const toneMappings: readonly ToneMappingPreference[] = ["None", "Reinhard", "ACESFilmic"];
const fullscreenPreferences: readonly FullscreenPreference[] = ["Windowed", "Fullscreen"];
const fpsLimits: readonly FpsLimit[] = [0, 30, 60, 120];
const voxelQualities: readonly VoxelQuality[] = ["Low", "Medium", "High", "Ultra"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    return false;
  }
  const actual = (ownKeys as string[]).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isOneOf<T extends string | number>(value: unknown, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function validateGraphicsSettingsBase(value: unknown, topLevelKeys: readonly string[]): value is GraphicsSettingsV1 {
  if (!isRecord(value) || !hasExactKeys(value, topLevelKeys)) {
    return false;
  }
  if (!isOneOf(value.qualityPreset, qualityPresets)) {
    return false;
  }

  const display = value.display;
  if (!isRecord(display) || !hasExactKeys(display, ["renderScale", "maxDevicePixelRatio", "fieldOfView", "renderDistance", "fpsLimit", "fullscreenPreference"])) {
    return false;
  }
  if (
    !isFiniteInRange(display.renderScale, GRAPHICS_LIMITS.renderScale.min, GRAPHICS_LIMITS.renderScale.max) ||
    !isFiniteInRange(display.maxDevicePixelRatio, GRAPHICS_LIMITS.maxDevicePixelRatio.min, GRAPHICS_LIMITS.maxDevicePixelRatio.max) ||
    !isFiniteInRange(display.fieldOfView, GRAPHICS_LIMITS.fieldOfView.min, GRAPHICS_LIMITS.fieldOfView.max) ||
    !isFiniteInRange(display.renderDistance, GRAPHICS_LIMITS.renderDistance.min, GRAPHICS_LIMITS.renderDistance.max) ||
    !isOneOf(display.fpsLimit, fpsLimits) ||
    !isOneOf(display.fullscreenPreference, fullscreenPreferences)
  ) {
    return false;
  }

  const shadows = value.shadows;
  if (!isRecord(shadows) || !hasExactKeys(shadows, ["quality"]) || !isOneOf(shadows.quality, shadowQualities)) {
    return false;
  }

  const textures = value.textures;
  if (!isRecord(textures) || !hasExactKeys(textures, ["quality"]) || !isOneOf(textures.quality, textureQualities)) {
    return false;
  }

  const lighting = value.lighting;
  if (
    !isRecord(lighting) ||
    !hasExactKeys(lighting, ["quality", "toneMapping", "exposure", "environmentReflectionQuality"]) ||
    !isOneOf(lighting.quality, qualityPresets) ||
    !isOneOf(lighting.toneMapping, toneMappings) ||
    !isFiniteInRange(lighting.exposure, GRAPHICS_LIMITS.exposure.min, GRAPHICS_LIMITS.exposure.max) ||
    !isOneOf(lighting.environmentReflectionQuality, concretePresets)
  ) {
    return false;
  }

  const effects = value.effects;
  if (
    !isRecord(effects) ||
    !hasExactKeys(effects, ["quality", "decorDensity", "bloomPreference", "motionEffectsPreference"]) ||
    !isOneOf(effects.quality, qualityPresets) ||
    !isFiniteInRange(effects.decorDensity, GRAPHICS_LIMITS.decorDensity.min, GRAPHICS_LIMITS.decorDensity.max) ||
    typeof effects.bloomPreference !== "boolean" ||
    typeof effects.motionEffectsPreference !== "boolean"
  ) {
    return false;
  }

  const antiAliasing = value.antiAliasing;
  if (!isRecord(antiAliasing) || !hasExactKeys(antiAliasing, ["enabled"]) || typeof antiAliasing.enabled !== "boolean") {
    return false;
  }

  const vsync = value.vsync;
  return isRecord(vsync) && hasExactKeys(vsync, ["mode"]) && vsync.mode === "BrowserManaged";
}

export function validateGraphicsSettingsV1(value: unknown): value is GraphicsSettingsV1 {
  return validateGraphicsSettingsBase(value, ["qualityPreset", "display", "shadows", "textures", "lighting", "effects", "antiAliasing", "vsync"]);
}

export function validateGraphicsSettings(value: unknown): value is GraphicsSettingsV2 {
  if (!validateGraphicsSettingsBase(value, ["qualityPreset", "display", "shadows", "textures", "lighting", "effects", "antiAliasing", "vsync", "voxel"])) {
    return false;
  }
  const voxel = (value as unknown as Record<string, unknown>).voxel;
  return isRecord(voxel) &&
    hasExactKeys(voxel, ["detail", "detailDistanceMeters", "streamingBudget"]) &&
    isOneOf(voxel.detail, voxelQualities) &&
    isFiniteInRange(
      voxel.detailDistanceMeters,
      GRAPHICS_LIMITS.voxelDetailDistanceMeters.min,
      GRAPHICS_LIMITS.voxelDetailDistanceMeters.max
    ) &&
    isOneOf(voxel.streamingBudget, voxelQualities);
}

export function normalizeGraphicsSettings(settings: GraphicsSettingsV2): GraphicsSettingsV2 {
  const cloned = structuredClone(settings);
  const normalized: GraphicsSettingsV2 = {
    ...cloned,
    qualityPreset: inferQualityPreset(cloned)
  };
  return cloneAndFreeze(normalized) as GraphicsSettingsV2;
}

export function decodeGraphicsSettingsEnvelope(value: unknown): DecodeGraphicsSettingsResult {
  if (!isRecord(value) || !hasExactKeys(value, ["schemaVersion", "settings"])) {
    return { ok: false, reason: "Invalid", message: "Settings envelope is malformed." };
  }
  if (typeof value.schemaVersion === "number" && value.schemaVersion > GRAPHICS_SETTINGS_SCHEMA_VERSION) {
    return { ok: false, reason: "FutureVersion", message: `Unsupported future schema version ${value.schemaVersion}.` };
  }
  if (value.schemaVersion === 1) {
    if (!validateGraphicsSettingsV1(value.settings)) {
      return { ok: false, reason: "Invalid", message: "Settings payload failed schema validation." };
    }
    return {
      ok: true,
      value: cloneAndFreeze({ ...value.settings, voxel: DEFAULT_VOXEL_SETTINGS }) as GraphicsSettingsV2
    };
  }
  if (value.schemaVersion !== GRAPHICS_SETTINGS_SCHEMA_VERSION || !validateGraphicsSettings(value.settings)) {
    return { ok: false, reason: "Invalid", message: "Settings payload failed schema validation." };
  }
  return { ok: true, value: normalizeGraphicsSettings(value.settings) };
}

export function createGraphicsSettingsEnvelope(settings: GraphicsSettingsV2): GraphicsSettingsEnvelopeV2 {
  if (!validateGraphicsSettings(settings)) {
    throw new Error("Cannot encode invalid graphics settings.");
  }
  return cloneAndFreeze({
    schemaVersion: GRAPHICS_SETTINGS_SCHEMA_VERSION,
    settings: normalizeGraphicsSettings(settings)
  }) as GraphicsSettingsEnvelopeV2;
}
