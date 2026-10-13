import { ALL_GRAPHICS_SETTING_IDS, GRAPHICS_SETTING_PATH_TO_ID, cloneAndFreeze } from "./schema";
import { saveGraphicsSettings } from "./storage";
import { GraphicsDraftStore } from "./store";
import type {
  ConcreteQualityPreset,
  GraphicsControllerApplyResult,
  GraphicsRuntimePort,
  GraphicsSettingId,
  GraphicsSettingPath,
  GraphicsSettingsController,
  GraphicsSettingsControllerSnapshot,
  GraphicsSettingsLoadResult,
  StorageLike
} from "./types";

export interface CreateGraphicsSettingsControllerOptions {
  readonly initial: GraphicsSettingsLoadResult;
  readonly storage: StorageLike | null | undefined;
  readonly runtime: GraphicsRuntimePort;
}

function valueForId(settings: GraphicsSettingsControllerSnapshot["draft"], id: GraphicsSettingId): unknown {
  switch (id) {
    case "renderScale": return settings.display.renderScale;
    case "maxDevicePixelRatio": return settings.display.maxDevicePixelRatio;
    case "fieldOfView": return settings.display.fieldOfView;
    case "renderDistance": return settings.display.renderDistance;
    case "fpsLimit": return settings.display.fpsLimit;
    case "fullscreen": return settings.display.fullscreenPreference;
    case "shadows": return settings.shadows;
    case "textureQuality": return settings.textures.quality;
    case "textureVariants": return settings.textures.quality;
    case "lightingQuality": return settings.lighting.quality;
    case "toneMapping": return settings.lighting.toneMapping;
    case "exposure": return settings.lighting.exposure;
    case "environmentReflections": return settings.lighting.environmentReflectionQuality;
    case "effectsQuality": return settings.effects.quality;
    case "decorDensity": return settings.effects.decorDensity;
    case "bloom": return settings.effects.bloomPreference;
    case "motionEffects": return settings.effects.motionEffectsPreference;
    case "antiAliasing": return settings.antiAliasing.enabled;
    case "vsync": return settings.vsync.mode;
  }
}

export function createGraphicsSettingsController(options: CreateGraphicsSettingsControllerOptions): GraphicsSettingsController {
  const store = new GraphicsDraftStore(options.initial.settings);
  const listeners = new Set<(snapshot: GraphicsSettingsControllerSnapshot) => void>();
  let runtime = options.runtime.getSnapshot();
  let restartRequired: readonly GraphicsSettingId[] = [];
  let message = options.initial.message;

  const snapshot = (): GraphicsSettingsControllerSnapshot => {
    const draft = store.getSnapshot();
    const derivedRestart: GraphicsSettingId[] = draft.confirmed.antiAliasing.enabled === runtime.antiAliasingApplied ? [] : ["antiAliasing"];
    return cloneAndFreeze({
      ...draft,
      runtime,
      capabilities: options.runtime.getCapabilities(),
      restartRequired: [...new Set([...restartRequired, ...derivedRestart])],
      loadReason: options.initial.reason,
      message
    }) as GraphicsSettingsControllerSnapshot;
  };

  const notify = (): void => {
    const current = snapshot();
    for (const listener of listeners) listener(current);
  };

  const changedIds = (): readonly GraphicsSettingId[] => {
    const current = store.getSnapshot();
    return ALL_GRAPHICS_SETTING_IDS.filter((id) => JSON.stringify(valueForId(current.confirmed, id)) !== JSON.stringify(valueForId(current.draft, id)));
  };

  const runRuntime = async (ids: readonly GraphicsSettingId[]): Promise<GraphicsControllerApplyResult> => {
    try {
      const result = await options.runtime.apply(store.getSnapshot().confirmed, ids);
      runtime = result.runtime;
      restartRequired = result.restartRequired;
      message = result.warnings.length > 0 ? result.warnings.join(" ") : "Graphics settings applied.";
      notify();
      return { ok: true, snapshot: snapshot(), message };
    } catch (error) {
      message = `Runtime apply failed: ${error instanceof Error ? error.message : String(error)}`;
      notify();
      return { ok: false, snapshot: snapshot(), message };
    }
  };

  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    applyPreset(preset: ConcreteQualityPreset) {
      store.applyPreset(preset);
      message = "Pending graphics changes.";
      notify();
    },
    updateSetting(path: GraphicsSettingPath, value: unknown) {
      store.update(path, value);
      message = `Pending change: ${GRAPHICS_SETTING_PATH_TO_ID[path]}.`;
      notify();
    },
    resetDefaults() {
      store.reset();
      message = "High defaults staged; Apply to persist.";
      notify();
    },
    cancel() {
      store.cancel();
      message = "Pending changes discarded.";
      notify();
    },
    async initializeRuntime() {
      return runRuntime(ALL_GRAPHICS_SETTING_IDS.filter((id) => id !== "fullscreen"));
    },
    async apply() {
      const ids = changedIds();
      const current = store.getSnapshot();
      const saved = saveGraphicsSettings(options.storage, current.draft);
      if (!saved.ok) {
        message = saved.message;
        notify();
        return { ok: false, snapshot: snapshot(), message };
      }
      store.confirm(current.draft);
      message = saved.message;
      return runRuntime(ids);
    }
  };
}
