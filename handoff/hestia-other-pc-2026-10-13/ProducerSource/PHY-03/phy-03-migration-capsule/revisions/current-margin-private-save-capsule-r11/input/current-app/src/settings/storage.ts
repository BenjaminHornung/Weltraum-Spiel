import { createDefaultGraphicsSettings } from "./defaults";
import { GRAPHICS_SETTINGS_STORAGE_KEY, cloneAndFreeze } from "./schema";
import { createGraphicsSettingsEnvelope, decodeGraphicsSettingsEnvelope, validateGraphicsSettings } from "./validation";
import type { GraphicsSettingsLoadResult, GraphicsSettingsV1, StorageLike } from "./types";

export interface SaveGraphicsSettingsResult {
  readonly ok: boolean;
  readonly message: string;
}

export function loadGraphicsSettings(storage: StorageLike | null | undefined): GraphicsSettingsLoadResult {
  if (!storage) {
    return cloneAndFreeze({
      settings: createDefaultGraphicsSettings(),
      reason: "Unavailable",
      message: "LocalStorage is unavailable; using defaults in memory."
    }) as GraphicsSettingsLoadResult;
  }
  let raw: string | null;
  try {
    raw = storage.getItem(GRAPHICS_SETTINGS_STORAGE_KEY);
  } catch (error) {
    return cloneAndFreeze({
      settings: createDefaultGraphicsSettings(),
      reason: "Unavailable",
      message: `LocalStorage read failed: ${error instanceof Error ? error.message : String(error)}`
    }) as GraphicsSettingsLoadResult;
  }
  if (raw === null) {
    return cloneAndFreeze({
      settings: createDefaultGraphicsSettings(),
      reason: "Missing",
      message: "No stored graphics settings; using defaults."
    }) as GraphicsSettingsLoadResult;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return cloneAndFreeze({
      settings: createDefaultGraphicsSettings(),
      reason: "Corrupt",
      message: "Stored graphics settings are not valid JSON; using defaults."
    }) as GraphicsSettingsLoadResult;
  }
  const decoded = decodeGraphicsSettingsEnvelope(parsed);
  if (!decoded.ok) {
    return cloneAndFreeze({
      settings: createDefaultGraphicsSettings(),
      reason: decoded.reason,
      message: decoded.message
    }) as GraphicsSettingsLoadResult;
  }
  return cloneAndFreeze({ settings: decoded.value, reason: "Stored", message: "Stored graphics settings loaded." }) as GraphicsSettingsLoadResult;
}

export function saveGraphicsSettings(storage: StorageLike | null | undefined, settings: GraphicsSettingsV1): SaveGraphicsSettingsResult {
  if (!storage) {
    return { ok: false, message: "LocalStorage is unavailable." };
  }
  if (!validateGraphicsSettings(settings)) {
    return { ok: false, message: "Graphics settings failed validation." };
  }
  try {
    storage.setItem(GRAPHICS_SETTINGS_STORAGE_KEY, JSON.stringify(createGraphicsSettingsEnvelope(settings)));
    return { ok: true, message: "Graphics settings persisted." };
  } catch (error) {
    return { ok: false, message: `LocalStorage write failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
