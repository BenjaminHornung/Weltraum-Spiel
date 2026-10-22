import { describe, expect, it } from "vitest";
import { probeRenderer } from "../src/probe";

function renderer(backend = "unavailable", context: unknown = null, adapter: unknown = null) {
  return { backend, context, adapter, deviceFeatures: new Set<string>(), deviceLimits: null } as Parameters<typeof probeRenderer>[0];
}

describe("scalar capability probe through existing renderer", () => {
  it("distinguishes no GPU, no adapter, no timer and unknown memory", async () => {
    const noGpu = await probeRenderer(renderer(), {}, "high-performance");
    expect(noGpu.webgpu.status).toBe("NoGPU");
    expect(noGpu.actualBackend).toBe("unavailable");
    expect(noGpu.gpuTimer).toBe("Unavailable");
    expect(noGpu.approximateRamGb).toBeNull();
    expect(noGpu.gpuMemoryBytes).toBeNull();
    const noAdapter = await probeRenderer(renderer(), { gpu: { requestAdapter: async () => null } }, "high-performance");
    expect(noAdapter.webgpu.status).toBe("NoAdapter");
  });

  it("does not claim probed adapter is used or timestamp feature is enabled", async () => {
    const adapter = { features: new Set(["timestamp-query", "shader-f16"]), limits: { maxBufferSize: 4096 }, info: { description: "Fast GPU", vendor: "test" } };
    const evidence = await probeRenderer(renderer("webgl2"), { gpu: { requestAdapter: async (options: unknown) => { expect(options).toEqual({ powerPreference: "high-performance" }); return adapter; } }, deviceMemory: 8 }, "high-performance");
    expect(evidence.actualAdapter).toBeNull();
    expect(evidence.availableAdapter?.features).toEqual(["shader-f16", "timestamp-query"]);
    expect(evidence.gpuTimer).toBe("Unavailable");
    expect(evidence.availableAdapter?.limits.maxBufferSize).toBe(4096);
    expect(evidence.approximateRamGb).toBe(8);
    expect(JSON.stringify(evidence)).not.toContain("requestAdapter");
  });

  it("uses one provided WebGL context and reports its actual renderer", async () => {
    const context = {
      MAX_TEXTURE_SIZE: 3379,
      isContextLost: () => false,
      getParameter: (key: number) => key === 3379 ? 8192 : "actual adapter",
      getExtension: (name: string) => name === "WEBGL_debug_renderer_info" ? { UNMASKED_RENDERER_WEBGL: 37446 } : name === "EXT_disjoint_timer_query_webgl2" ? {} : null
    };
    const evidence = await probeRenderer(renderer("webgl2", context), {}, "default");
    expect(evidence.actualBackend).toBe("webgl2");
    expect(evidence.actualAdapter?.description).toBe("actual adapter");
    expect(evidence.maxTextureSize).toBe(8192);
    expect(evidence.gpuTimer).toBe("Available");
    expect(evidence.gpuTimeMs).toBeNull();
  });

  it("reports failed requests and context loss without classifying names", async () => {
    const evidence = await probeRenderer(renderer(), { gpu: { requestAdapter: async () => { throw Error("unsupported"); } }, deviceMemory: 0 }, "low-power");
    expect(evidence.webgpu.status).toBe("Error");
    expect(evidence.approximateRamGb).toBeNull();
    const lost = await probeRenderer(renderer("webgl2", { isContextLost: () => true }), {}, "default");
    expect(lost.actualBackend).toBe("unavailable");
    expect(lost.maxTextureSize).toBeNull();
  });

  it("reads explicit prototype GPU limits and enabled device features", async () => {
    const limits = Object.create({ maxTextureDimension2D: 16384, maxBufferSize: 2048 });
    const adapter = { features: new Set(["timestamp-query"]), limits, info: { description: "adapter" } };
    const port = { ...renderer("webgpu", null, adapter), deviceFeatures: new Set(["timestamp-query"]), deviceLimits: limits };
    const evidence = await probeRenderer(port, {}, "default");
    expect(evidence.actualAdapter?.limits.maxTextureDimension2D).toBe(16384);
    expect(evidence.enabledFeatures).toEqual(["timestamp-query"]);
    expect(evidence.gpuTimer).toBe("Available");
  });
});
