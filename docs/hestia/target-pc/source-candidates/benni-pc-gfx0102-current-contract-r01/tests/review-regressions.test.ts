import { describe, expect, it } from "vitest";
import { decideQuality, INITIAL_QUALITY_CONTROLLER_STATE, type QualityMetrics } from "../src/quality";
import { BoundedFrameWindow } from "../src/frameWindow";
import { probeRenderer } from "../src/probe";
import { createDefaultRuntimeSnapshot, createGraphicsSettingsController, detectGraphicsCapabilities, loadGraphicsSettings, type GraphicsRuntimePort } from "../settings-v2-candidate/src/settings";

const desired = { enabled: true, minRenderScale: 0.5, maxRenderScale: 1.25, minDevicePixelRatio: 1, maxDevicePixelRatio: 2, targetFps: 60 as const };
const metrics: QualityMetrics = { sequence: 1, startMs: 0, endMs: 500, sampleCount: 30, frameP50Ms: 24, frameP95Ms: 24, cpuP95Ms: 3, gpuP95Ms: 22, visible: true, warmed: true, valid: true, referenceFrozen: false, maxRenderScale: 1.25, maxDevicePixelRatio: 2, capabilityRevision: 0 };

describe("independent review regressions", () => {
  it("reads actual port state after resize or restart without changing desired values", () => {
    let actual = createDefaultRuntimeSnapshot();
    const port: GraphicsRuntimePort = {
      getSnapshot: () => actual,
      getCapabilities: () => detectGraphicsCapabilities({ devicePixelRatio: 1, maxAnisotropy: 1, maxTextureSize: 4096, fullscreenAvailable: false, antiAliasingApplied: true, effectiveShadows: false, renderOnlyDecor: false, postProcessing: false, motionEffects: false, environmentReflections: false, textureVariants: false }),
      async apply() { return { runtime: actual, applied: [], restartRequired: [], skipped: [], warnings: [] }; }
    };
    const controller = createGraphicsSettingsController({ initial: loadGraphicsSettings(null), storage: null, runtime: port });
    const desiredBefore = controller.getSnapshot().confirmed;
    actual = { ...actual, effectivePixelRatio: 0.7, powerPreferenceApplied: "high-performance" };
    controller.updateSetting("rayTracing", "auto");
    expect(controller.getSnapshot().runtime.effectivePixelRatio).toBe(0.7);
    expect(controller.getSnapshot().restartRequired).not.toContain("powerPreference");
    expect(controller.getSnapshot().confirmed).toEqual(desiredBefore);
  });
  it("keeps arbitrary exact fractional manual and capability limits", () => {
    const limits = { ...desired, minRenderScale: 0.555, maxRenderScale: 0.555 };
    const decision = decideQuality({ ...metrics, maxRenderScale: 0.555 }, limits, { renderScale: 1, maxDevicePixelRatio: 2 }, INITIAL_QUALITY_CONTROLLER_STATE);
    expect(decision.quality.renderScale).toBe(0.555);
    expect(decision.quality.renderScale).toBeLessThanOrEqual(limits.maxRenderScale);
  });

  it("does not apply automatic minimums or ceilings to a fixed user value", () => {
    const fixed = { ...desired, enabled: false, minRenderScale: 0.7, maxRenderScale: 0.8, maxDevicePixelRatio: 1.5 };
    const current = { renderScale: 1.1, maxDevicePixelRatio: 2 };
    expect(decideQuality(metrics, fixed, current, INITIAL_QUALITY_CONTROLLER_STATE).quality).toEqual(current);
    const capped = decideQuality({ ...metrics, maxRenderScale: 0.995 }, fixed, current, INITIAL_QUALITY_CONTROLLER_STATE);
    expect(capped.quality.renderScale).toBe(0.995);
  });

  it.each(["hidden", "warmup", "backend", "reset"])("breaks controller continuity after a short %s boundary", (boundary) => {
    const sampler = new BoundedFrameWindow({ capacity: 30 });
    const input = { frameTimeMs: 24, cpuTimeMs: 3, gpuTimeMs: 22, visible: true, warmed: true, valid: true, backendGeneration: 1 };
    for (let i = 0; i < 30; i++) sampler.push({ ...input, timestampMs: i * 20 });
    const first = sampler.take()!;
    if (boundary === "reset") sampler.reset();
    else if (boundary !== "backend") sampler.push({ ...input, timestampMs: 590, visible: boundary !== "hidden", warmed: boundary !== "warmup" });
    for (let i = 0; i < 30; i++) sampler.push({ ...input, timestampMs: 600 + i * 20, backendGeneration: boundary === "backend" ? 2 : 1 });
    const second = sampler.take()!;
    expect(second.sequence).toBeGreaterThan(first.sequence + 1);
    const state = { ...INITIAL_QUALITY_CONTROLLER_STATE, slowWindows: 2, lastWindowSequence: first.sequence, lastWindowStartMs: first.startMs, lastWindowEndMs: first.endMs };
    const result = decideQuality({ ...metrics, ...second }, desired, { renderScale: 1, maxDevicePixelRatio: 2 }, state);
    expect(result.action).toBe("hold");
    expect(result.state.slowWindows).toBe(1);
  });

  it("omits WebGPU power hint for Browserstandard rather than forwarding a WebGL enum", async () => {
    const result = await probeRenderer({ backend: "unavailable", context: null, adapter: null, deviceFeatures: [], deviceLimits: null }, {
      gpu: { async requestAdapter(options) { expect(options).toEqual({}); return { features: [], limits: {} }; } }
    }, "default");
    expect(result.webgpu.status).toBe("Available");
  });
});
