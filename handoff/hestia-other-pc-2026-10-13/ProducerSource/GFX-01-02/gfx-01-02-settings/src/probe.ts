import { cloneAndFreeze } from "../control/src/settings/schema";

export type Backend = "webgl2" | "webgpu" | "unavailable";
export type PowerPreference = "default" | "high-performance" | "low-power";
export interface AdapterPort {
  readonly features: Iterable<string>;
  readonly limits: Readonly<Record<string, number>>;
  readonly info?: { readonly vendor?: string; readonly architecture?: string; readonly device?: string; readonly description?: string; readonly isFallbackAdapter?: boolean };
}
export interface RendererProbePort {
  readonly backend: Backend;
  readonly context: WebGL2RenderingContext | null;
  readonly adapter: AdapterPort | null;
  readonly deviceFeatures: Iterable<string>;
  readonly deviceLimits: Readonly<Record<string, number>> | null;
}
export interface NavigatorProbePort {
  readonly gpu?: { requestAdapter(options: { powerPreference?: Exclude<PowerPreference, "default"> }): Promise<AdapterPort | null> };
  readonly deviceMemory?: number;
  readonly hardwareConcurrency?: number;
}

const limitNames = ["maxTextureDimension2D", "maxBufferSize", "maxStorageBufferBindingSize", "maxComputeInvocationsPerWorkgroup", "maxComputeWorkgroupSizeX", "maxComputeWorkgroupSizeY", "maxComputeWorkgroupSizeZ"] as const;
const positive = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

function limitsOf(limits: Readonly<Record<string, number>> | null) {
  const result: Record<string, number> = {};
  for (const name of limitNames) {
    const value = positive(limits?.[name]);
    if (value !== null) result[name] = value;
  }
  return result;
}

function adapterOf(adapter: AdapterPort | null) {
  if (!adapter) return null;
  return {
    vendor: adapter.info?.vendor ?? null,
    architecture: adapter.info?.architecture ?? null,
    device: adapter.info?.device ?? null,
    description: adapter.info?.description ?? null,
    isFallbackAdapter: adapter.info?.isFallbackAdapter ?? null,
    features: [...adapter.features].sort(), limits: limitsOf(adapter.limits)
  };
}

export async function probeRenderer(renderer: RendererProbePort, navigatorPort: NavigatorProbePort, powerPreference: PowerPreference) {
  let actualBackend = renderer.backend;
  let maxTextureSize: number | null = null;
  let actualAdapter = actualBackend === "webgpu" ? adapterOf(renderer.adapter) : null;
  let gpuTimer: "Available" | "Unavailable" = "Unavailable";
  if (actualBackend === "webgl2" && !renderer.context) actualBackend = "unavailable";
  if (actualBackend === "webgl2" && renderer.context) {
    const gl = renderer.context;
    try {
      if (gl.isContextLost()) actualBackend = "unavailable";
      else {
        maxTextureSize = positive(gl.getParameter(gl.MAX_TEXTURE_SIZE));
        gpuTimer = gl.getExtension("EXT_disjoint_timer_query_webgl2") ? "Available" : "Unavailable";
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        if (debug) {
          const name: unknown = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
          actualAdapter = { vendor: null, architecture: null, device: null, description: typeof name === "string" ? name : null, isFallbackAdapter: null, features: [], limits: {} };
        }
      }
    } catch { actualBackend = "unavailable"; maxTextureSize = null; actualAdapter = null; gpuTimer = "Unavailable"; }
  }
  const enabledFeatures = [...renderer.deviceFeatures].sort();
  if (actualBackend === "webgpu") {
    gpuTimer = enabledFeatures.includes("timestamp-query") ? "Available" : "Unavailable";
    maxTextureSize = positive(renderer.deviceLimits?.maxTextureDimension2D);
  }

  let status: "NoGPU" | "NoAdapter" | "Available" | "Error" | "Timeout" = "NoGPU";
  let availableAdapter: ReturnType<typeof adapterOf> = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  if (navigatorPort.gpu) {
    try {
      const adapter = await Promise.race([
        navigatorPort.gpu.requestAdapter(powerPreference === "default" ? {} : { powerPreference }),
        new Promise<"timeout">((resolve) => { timeout = setTimeout(() => resolve("timeout"), 1500); })
      ]);
      if (adapter === "timeout") status = "Timeout";
      else { availableAdapter = adapterOf(adapter); status = adapter ? "Available" : "NoAdapter"; }
    } catch { status = "Error"; }
    finally { if (timeout !== undefined) clearTimeout(timeout); }
  }

  return cloneAndFreeze({
    actualBackend, actualAdapter, availableAdapter,
    webgpu: { status }, enabledFeatures, enabledLimits: limitsOf(renderer.deviceLimits),
    maxTextureSize, gpuTimer, gpuTimeMs: null,
    approximateRamGb: positive(navigatorPort.deviceMemory), gpuMemoryBytes: null,
    logicalCpuThreads: positive(navigatorPort.hardwareConcurrency),
    requestedPowerPreference: powerPreference,
    powerPreferenceIsHint: true,
    environment: "LOCAL_WINDOWS_ISOLATED", workload: "FUNCTIONAL_DIAGNOSTIC_CONCURRENT_LOAD"
  });
}
