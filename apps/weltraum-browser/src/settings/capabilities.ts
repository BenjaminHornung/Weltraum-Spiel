import { cloneAndFreeze } from "./schema";
import type { GraphicsCapability, GraphicsCapabilityMap, GraphicsCapabilityProbe, GraphicsSettingId } from "./types";

function capability(status: GraphicsCapability["status"], reason: string, numericLimit?: number): GraphicsCapability {
  return numericLimit === undefined ? { status, reason } : { status, reason, numericLimit };
}

export function detectGraphicsCapabilities(probe: GraphicsCapabilityProbe): GraphicsCapabilityMap {
  const maxAnisotropy = Number.isFinite(probe.maxAnisotropy) ? Math.max(1, probe.maxAnisotropy) : 1;
  const maxTextureSize = Number.isFinite(probe.maxTextureSize) ? Math.max(1, probe.maxTextureSize) : 1;
  const map: Record<GraphicsSettingId, GraphicsCapability> = {
    renderScale: capability("SupportedLive", "Canvas backing resolution is controlled by the renderer adapter.", maxTextureSize),
    maxDevicePixelRatio: capability("SupportedLive", "Device pixel ratio is feature-detected and hardware-capped.", Math.max(1, probe.devicePixelRatio)),
    fieldOfView: capability("SupportedLive", "The active perspective camera supports live FOV updates."),
    renderDistance: capability("SupportedLive", "The active camera far plane supports live presentation-only updates."),
    fpsLimit: capability("SupportedLive", "GPU presentation can be scheduled without throttling simulation."),
    fullscreen: probe.fullscreenAvailable
      ? capability("BrowserManaged", "Fullscreen requires a browser-approved user gesture.")
      : capability("Unsupported", "The Fullscreen API is unavailable."),
    shadows: probe.effectiveShadows
      ? capability("SupportedLive", "The scene has an effective light/caster/receiver shadow chain.")
      : capability("Planned", "The current scene has no effective shadow chain."),
    textureQuality: maxAnisotropy > 1
      ? capability("SupportedLive", "Managed textures support live anisotropy updates.", maxAnisotropy)
      : capability("Unsupported", "The renderer reports no anisotropic filtering headroom.", maxAnisotropy),
    textureVariants: probe.textureVariants
      ? capability("SupportedLive", "The asset loader exposes managed texture variants.")
      : capability("Planned", "Texture-size, mip, and asset variants are not available in the current loader."),
    lightingQuality: capability("SupportedLive", "Lighting quality resolves to live tone-mapping and exposure values."),
    toneMapping: capability("SupportedLive", "The WebGL renderer supports live tone-mapping selection."),
    exposure: capability("SupportedLive", "The WebGL renderer supports live exposure updates."),
    environmentReflections: probe.environmentReflections
      ? capability("SupportedLive", "The scene exposes managed environment/reflection resources.")
      : capability("Planned", "No managed environment/reflection pipeline exists."),
    effectsQuality: capability("SupportedLive", "Effects quality controls render-only decor density in V1."),
    decorDensity: capability("SupportedLive", "Explicitly tagged render-only decoration supports live density changes."),
    bloom: probe.postProcessing
      ? capability("SupportedLive", "A managed post-processing pipeline is available.")
      : capability("Unsupported", "No post-processing pipeline is installed."),
    motionEffects: probe.motionEffects
      ? capability("SupportedLive", "Managed motion effects are available.")
      : capability("Unsupported", "No managed motion-effects pipeline is installed."),
    antiAliasing: capability(
      "SupportedAfterRendererRestart",
      `WebGL anti-aliasing is fixed at renderer creation; current context is ${probe.antiAliasingApplied ? "on" : "off"}.`
    ),
    vsync: capability("BrowserManaged", "requestAnimationFrame synchronization is controlled by the browser.")
  };
  return cloneAndFreeze(map) as GraphicsCapabilityMap;
}
