import { describe, expect, it } from "vitest";
import {
  GRAPHICS_SETTINGS_STORAGE_KEY,
  applyQualityPreset,
  createDefaultGraphicsSettings,
  createDefaultRuntimeSnapshot,
  createGraphicsSettingsController,
  createGraphicsSettingsEnvelope,
  detectGraphicsCapabilities,
  loadGraphicsSettings,
  type GraphicsApplyResult,
  type GraphicsRuntimePort,
  type GraphicsSettingsV1,
  type StorageLike
} from "../../src/settings";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("quota exceeded");
    this.values.set(key, value);
  }
}

function runtimePort(): GraphicsRuntimePort & { calls: GraphicsSettingsV1[] } {
  const calls: GraphicsSettingsV1[] = [];
  let snapshot = createDefaultRuntimeSnapshot(true);
  return {
    calls,
    getCapabilities: () => detectGraphicsCapabilities({
      devicePixelRatio: 1,
      maxAnisotropy: 4,
      maxTextureSize: 4096,
      fullscreenAvailable: true,
      antiAliasingApplied: snapshot.antiAliasingApplied,
      effectiveShadows: false,
      postProcessing: false,
      motionEffects: false,
      environmentReflections: false,
      textureVariants: false
    }),
    getSnapshot: () => snapshot,
    async apply(settings): Promise<GraphicsApplyResult> {
      calls.push(settings);
      snapshot = { ...snapshot, renderScale: settings.display.renderScale, antiAliasingApplied: snapshot.antiAliasingApplied };
      return { runtime: snapshot, applied: ["renderScale"], restartRequired: [], skipped: [], warnings: [] };
    }
  };
}

describe("graphics settings storage and controller", () => {
  it("falls back safely for corrupt storage", () => {
    const storage = new MemoryStorage();
    storage.values.set(GRAPHICS_SETTINGS_STORAGE_KEY, "{broken");
    expect(loadGraphicsSettings(storage)).toEqual(expect.objectContaining({ reason: "Corrupt", settings: createDefaultGraphicsSettings() }));
  });

  it("falls back for a future version without overwriting it", () => {
    const storage = new MemoryStorage();
    storage.values.set(GRAPHICS_SETTINGS_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, settings: createDefaultGraphicsSettings() }));
    expect(loadGraphicsSettings(storage).reason).toBe("FutureVersion");
    expect(JSON.parse(storage.values.get(GRAPHICS_SETTINGS_STORAGE_KEY)!).schemaVersion).toBe(2);
  });

  it("applies and persists confirmed settings", async () => {
    const storage = new MemoryStorage();
    const runtime = runtimePort();
    const controller = createGraphicsSettingsController({ initial: loadGraphicsSettings(storage), storage, runtime });
    controller.applyPreset("Low");
    const result = await controller.apply();
    expect(result.ok).toBe(true);
    expect(runtime.calls).toHaveLength(1);
    expect(loadGraphicsSettings(storage).settings.qualityPreset).toBe("Low");
  });

  it("Cancel neither persists nor applies", async () => {
    const storage = new MemoryStorage();
    const runtime = runtimePort();
    const controller = createGraphicsSettingsController({ initial: loadGraphicsSettings(storage), storage, runtime });
    controller.applyPreset("Low");
    controller.cancel();
    expect(controller.getSnapshot().draft.qualityPreset).toBe("High");
    expect(storage.getItem(GRAPHICS_SETTINGS_STORAGE_KEY)).toBeNull();
    expect(runtime.calls).toHaveLength(0);
  });

  it("Reset stages defaults without persisting or applying", async () => {
    const storage = new MemoryStorage();
    storage.setItem(GRAPHICS_SETTINGS_STORAGE_KEY, JSON.stringify(createGraphicsSettingsEnvelope(applyQualityPreset(createDefaultGraphicsSettings(), "Low"))));
    const runtime = runtimePort();
    const controller = createGraphicsSettingsController({ initial: loadGraphicsSettings(storage), storage, runtime });
    controller.resetDefaults();
    expect(controller.getSnapshot()).toEqual(expect.objectContaining({ hasPendingChanges: true }));
    expect(controller.getSnapshot().draft.qualityPreset).toBe("High");
    expect(runtime.calls).toHaveLength(0);
  });

  it("does not call runtime when persistence fails", async () => {
    const storage = new MemoryStorage();
    const runtime = runtimePort();
    const controller = createGraphicsSettingsController({ initial: loadGraphicsSettings(storage), storage, runtime });
    controller.applyPreset("Low");
    storage.failWrites = true;
    const result = await controller.apply();
    expect(result.ok).toBe(false);
    expect(runtime.calls).toHaveLength(0);
    expect(controller.getSnapshot().hasPendingChanges).toBe(true);
  });

  it("never exposes mutable public snapshots", () => {
    const storage = new MemoryStorage();
    const controller = createGraphicsSettingsController({ initial: loadGraphicsSettings(storage), storage, runtime: runtimePort() });
    const snapshot = controller.getSnapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.draft.display)).toBe(true);
    expect(() => Object.assign(snapshot.draft.display, { renderScale: 0.5 })).toThrow();
    expect(controller.getSnapshot().draft.display.renderScale).toBe(1);
  });
});
