import {
  ALL_GRAPHICS_SETTING_IDS, GRAPHICS_SETTINGS_STORAGE_KEY, cloneAndFreeze,
  createDefaultRuntimeSnapshot, createGraphicsSettingsController, detectGraphicsCapabilities, loadGraphicsSettings,
  type GraphicsRuntimePort, type GraphicsSettingId, type GraphicsSettingPath, type GraphicsSettingsV2, type StorageLike
} from "../settings-v2-candidate/src/settings";
import { ALL_GRAPHICS_SETTING_IDS as legacyIds, createDefaultGraphicsSettings as legacyDefaults, createGraphicsSettingsEnvelope as legacyEnvelope } from "../control/src/settings";
import { probeRenderer, type NavigatorProbePort, type PowerPreference } from "../src/probe";

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw Error(`Missing element: ${id}`);
  return found as T;
};
let storage: StorageLike | null = null;
let originalVersion: unknown = null;
try {
  storage = window.localStorage;
  if (storage.getItem(GRAPHICS_SETTINGS_STORAGE_KEY) === null) {
    storage.setItem(GRAPHICS_SETTINGS_STORAGE_KEY, JSON.stringify(legacyEnvelope(legacyDefaults())));
  }
  originalVersion = JSON.parse(storage.getItem(GRAPHICS_SETTINGS_STORAGE_KEY)!).schemaVersion;
} catch { /* Storage loader reports unavailable/corrupt bytes. */ }
const initial = loadGraphicsSettings(storage);
const canvas = element<HTMLCanvasElement>("renderer");
const gl = canvas.getContext("webgl2", { powerPreference: initial.settings.powerPreference, antialias: initial.settings.antiAliasing.enabled });
const attrs = gl?.getContextAttributes();
const actualPower = (attrs?.powerPreference ?? "default") as PowerPreference;
let runtime = cloneAndFreeze({ ...createDefaultRuntimeSnapshot(attrs?.antialias ?? false), powerPreferenceApplied: actualPower });

function applyResolution(scale: number, maxDpr: number): void {
  if (!gl || gl.isContextLost()) return;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const maxSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const ratio = Math.min(Math.min(window.devicePixelRatio, maxDpr) * scale, maxSize / width, maxSize / height);
  canvas.width = Math.max(1, Math.floor(width * ratio));
  canvas.height = Math.max(1, Math.floor(height * ratio));
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.09, 0.15, 0.22, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(Math.floor(canvas.width * 0.1), Math.floor(canvas.height * 0.25), Math.floor(canvas.width * 0.8), Math.floor(canvas.height * 0.5));
  gl.clearColor(0.2, 0.45, 0.58, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.disable(gl.SCISSOR_TEST);
  runtime = cloneAndFreeze({ ...runtime, renderScale: scale, maxDevicePixelRatio: maxDpr, effectivePixelRatio: ratio });
}

const port: GraphicsRuntimePort = {
  getSnapshot: () => runtime,
  getCapabilities() {
    const backend = gl && !gl.isContextLost() ? "webgl2" : "unavailable";
    const detected = detectGraphicsCapabilities({
      backend, devicePixelRatio: window.devicePixelRatio, maxAnisotropy: 1,
      maxTextureSize: gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 0,
      fullscreenAvailable: false, antiAliasingApplied: runtime.antiAliasingApplied,
      effectiveShadows: false, postProcessing: false, motionEffects: false, environmentReflections: false, textureVariants: false
    });
    const capabilities = { ...detected };
    for (const id of legacyIds) {
      if (id === "renderScale" || id === "maxDevicePixelRatio" || id === "antiAliasing" || id === "vsync") continue;
      capabilities[id] = { status: "Unsupported", reason: "This small probe renderer has no product camera, scene or effect pipeline." };
    }
    return cloneAndFreeze(capabilities);
  },
  async apply(settings, _changed) {
    applyResolution(settings.display.renderScale, settings.display.maxDevicePixelRatio);
    const available = gl !== null && !gl.isContextLost();
    const restartRequired: GraphicsSettingId[] = [];
    if (settings.antiAliasing.enabled !== runtime.antiAliasingApplied) restartRequired.push("antiAliasing");
    if (settings.powerPreference !== runtime.powerPreferenceApplied) restartRequired.push("powerPreference");
    const applied: GraphicsSettingId[] = available ? ["renderScale", "maxDevicePixelRatio"] : [];
    return {
      runtime, applied, restartRequired,
      skipped: ALL_GRAPHICS_SETTING_IDS.filter((id) => !applied.includes(id) && !restartRequired.includes(id)),
      warnings: available ? [] : ["WebGL2 unavailable; desired settings saved, effective values are last known values."]
    };
  }
};
const controller = createGraphicsSettingsController({ initial, storage, runtime: port });
const fields: ReadonlyArray<readonly [string, GraphicsSettingPath]> = [
  ["scale", "display.renderScale"], ["dpr", "display.maxDevicePixelRatio"], ["power", "powerPreference"],
  ["ray", "rayTracing"], ["weather", "weatherQuality"], ["aa", "antiAliasing.enabled"],
  ["adaptive", "adaptiveResolution.enabled"], ["minScale", "adaptiveResolution.minRenderScale"],
  ["maxScale", "adaptiveResolution.maxRenderScale"], ["minDpr", "adaptiveResolution.minDevicePixelRatio"],
  ["maxDpr", "adaptiveResolution.maxDevicePixelRatio"], ["target", "adaptiveResolution.targetFps"]
];

function displaySettings(settings: GraphicsSettingsV2): void {
  const values: Record<string, unknown> = {
    scale: settings.display.renderScale, dpr: settings.display.maxDevicePixelRatio, power: settings.powerPreference,
    ray: settings.rayTracing, weather: settings.weatherQuality, aa: settings.antiAliasing.enabled,
    adaptive: settings.adaptiveResolution.enabled, minScale: settings.adaptiveResolution.minRenderScale,
    maxScale: settings.adaptiveResolution.maxRenderScale, minDpr: settings.adaptiveResolution.minDevicePixelRatio,
    maxDpr: settings.adaptiveResolution.maxDevicePixelRatio, target: settings.adaptiveResolution.targetFps
  };
  element<HTMLSelectElement>("preset").value = settings.qualityPreset;
  for (const [id] of fields) {
    const input = element<HTMLInputElement>(id);
    if (input.type === "checkbox") input.checked = Boolean(values[id]);
    else input.value = String(values[id]);
  }
}

const renderSnapshot = (snapshot: ReturnType<typeof controller.getSnapshot>): void => {
  displaySettings(snapshot.draft);
  element("confirmed").textContent = JSON.stringify(snapshot.confirmed, null, 2);
  element("effective").textContent = JSON.stringify({ rendererAvailability: gl && !gl.isContextLost() ? "Active" : "UnavailableLastKnown", ...snapshot.runtime, backingSize: [canvas.width, canvas.height], restartRequired: snapshot.restartRequired }, null, 2);
  element("status").textContent = `${snapshot.hasPendingChanges ? "Entwurf: unbestätigt. " : ""}${snapshot.message}${snapshot.restartRequired.length ? ` Neustart erforderlich: ${snapshot.restartRequired.join(", ")}.` : ""}`;
  const rows = element("capabilities"); rows.replaceChildren();
  for (const id of ALL_GRAPHICS_SETTING_IDS) {
    const row = document.createElement("tr");
    for (const text of [id, snapshot.capabilities[id].status, snapshot.capabilities[id].reason]) {
      const cell = document.createElement("td"); cell.textContent = text; row.append(cell);
    }
    rows.append(row);
  }
};
controller.subscribe(renderSnapshot);
canvas.addEventListener("webglcontextlost", () => renderSnapshot(controller.getSnapshot()));
for (const [id, path] of fields) {
  element(id).addEventListener("change", () => {
    const input = element<HTMLInputElement>(id);
    const value = input.type === "checkbox" ? input.checked : input.type === "number" || id === "target" ? Number(input.value) : input.value;
    controller.updateSetting(path, value);
  });
}
element("preset").addEventListener("change", () => {
  const preset = element<HTMLSelectElement>("preset").value;
  if (preset === "Low" || preset === "Medium" || preset === "High" || preset === "Ultra") controller.applyPreset(preset);
});
element("cancel").addEventListener("click", () => controller.cancel());
element<HTMLFormElement>("settings").addEventListener("submit", async (event) => {
  event.preventDefault(); await controller.apply();
});
window.addEventListener("resize", () => {
  applyResolution(runtime.renderScale, runtime.maxDevicePixelRatio);
  renderSnapshot(controller.getSnapshot());
});
element("load").textContent = `Geladene Settings: Schema ${String(originalVersion)} → v2, ${initial.reason}. Automatik wird hier nur durch Unit-Oracles geprüft; keine Live-Hestia-Messung.`;
await controller.initializeRuntime();
const evidence = await probeRenderer({ backend: gl ? "webgl2" : "unavailable", context: gl, adapter: null, deviceFeatures: [], deviceLimits: null }, navigator as unknown as NavigatorProbePort, actualPower);
element("probe").textContent = JSON.stringify(evidence, null, 2);
