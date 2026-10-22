import { decodeGraphicsSettingsEnvelope as decodeV1Envelope } from "../../../control/src/settings/validation";
import { createDefaultGraphicsSettings } from "./defaults";
import { GRAPHICS_LIMITS, GRAPHICS_SETTINGS_SCHEMA_VERSION, cloneAndFreeze } from "./schema";
import { inferQualityPreset } from "./presets";
import type {
  ConcreteQualityPreset,
  GraphicsSettingsV1,
  GraphicsSettingsV2,
  PowerPreference,
  RayTracingPreference,
  TargetFps
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

const concretePresets: readonly ConcreteQualityPreset[] = ["Low", "Medium", "High", "Ultra"];
const rayTracingPreferences: readonly RayTracingPreference[] = ["off", "auto", "contact", "hybrid", "photo"];
const powerPreferences: readonly PowerPreference[] = ["default", "high-performance", "low-power"];
const targetFpsValues: readonly TargetFps[] = [30, 60, 90, 120];
const v1Keys = ["qualityPreset", "display", "shadows", "textures", "lighting", "effects", "antiAliasing", "vsync"] as const;
const v2Keys = [...v1Keys, "rayTracing", "weatherQuality", "powerPreference", "adaptiveResolution"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isOneOf<T extends string | number>(value: unknown, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function legacySettings(value: Record<string, unknown>): GraphicsSettingsV1 {
  return {
    qualityPreset: value.qualityPreset as GraphicsSettingsV1["qualityPreset"],
    display: value.display as GraphicsSettingsV1["display"],
    shadows: value.shadows as GraphicsSettingsV1["shadows"],
    textures: value.textures as GraphicsSettingsV1["textures"],
    lighting: value.lighting as GraphicsSettingsV1["lighting"],
    effects: value.effects as GraphicsSettingsV1["effects"],
    antiAliasing: value.antiAliasing as GraphicsSettingsV1["antiAliasing"],
    vsync: value.vsync as GraphicsSettingsV1["vsync"]
  };
}

export function validateGraphicsSettings(value: unknown): value is GraphicsSettingsV2 {
  if (!isRecord(value) || !hasExactKeys(value, v2Keys)) return false;
  const adaptive = value.adaptiveResolution;
  if (!decodeV1Envelope({ schemaVersion: 1, settings: legacySettings(value) }).ok) return false;
  return isOneOf(value.rayTracing, rayTracingPreferences) &&
    isOneOf(value.weatherQuality, concretePresets) &&
    isOneOf(value.powerPreference, powerPreferences) &&
    isRecord(adaptive) &&
    hasExactKeys(adaptive, ["enabled", "minRenderScale", "maxRenderScale", "minDevicePixelRatio", "maxDevicePixelRatio", "targetFps"]) &&
    typeof adaptive.enabled === "boolean" &&
    isFiniteInRange(adaptive.minRenderScale, GRAPHICS_LIMITS.renderScale.min, GRAPHICS_LIMITS.renderScale.max) &&
    isFiniteInRange(adaptive.maxRenderScale, GRAPHICS_LIMITS.renderScale.min, GRAPHICS_LIMITS.renderScale.max) &&
    adaptive.minRenderScale <= adaptive.maxRenderScale &&
    isFiniteInRange(adaptive.minDevicePixelRatio, GRAPHICS_LIMITS.maxDevicePixelRatio.min, GRAPHICS_LIMITS.maxDevicePixelRatio.max) &&
    isFiniteInRange(adaptive.maxDevicePixelRatio, GRAPHICS_LIMITS.maxDevicePixelRatio.min, GRAPHICS_LIMITS.maxDevicePixelRatio.max) &&
    adaptive.minDevicePixelRatio <= adaptive.maxDevicePixelRatio &&
    isOneOf(adaptive.targetFps, targetFpsValues);
}

export function normalizeGraphicsSettings(settings: GraphicsSettingsV2): GraphicsSettingsV2 {
  const cloned = structuredClone(settings);
  const normalized: GraphicsSettingsV2 = {
    ...cloned,
    qualityPreset: inferQualityPreset(cloned)
  };
  return cloneAndFreeze(normalized) as GraphicsSettingsV2;
}

function migrateV1(value: unknown): GraphicsSettingsV2 | null {
  const decoded = decodeV1Envelope(value);
  if (!decoded.ok) return null;
  const defaults = createDefaultGraphicsSettings();
  return normalizeGraphicsSettings({
    ...decoded.value,
    rayTracing: defaults.rayTracing,
    weatherQuality: defaults.weatherQuality,
    powerPreference: defaults.powerPreference,
    adaptiveResolution: defaults.adaptiveResolution
  });
}

export function decodeGraphicsSettingsEnvelope(value: unknown): DecodeGraphicsSettingsResult {
  if (!isRecord(value)) {
    return { ok: false, reason: "Invalid", message: "Settings envelope is malformed." };
  }
  if (typeof value.schemaVersion === "number" && value.schemaVersion > GRAPHICS_SETTINGS_SCHEMA_VERSION) {
    return { ok: false, reason: "FutureVersion", message: `Unsupported future schema version ${value.schemaVersion}.` };
  }
  if (!hasExactKeys(value, ["schemaVersion", "settings"])) {
    return { ok: false, reason: "Invalid", message: "Settings envelope is malformed." };
  }
  if (value.schemaVersion === 1) {
    const migrated = migrateV1(value);
    return migrated
      ? { ok: true, value: migrated }
      : { ok: false, reason: "Invalid", message: "Stored v1 settings failed legacy schema validation." };
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
