import { describe, expect, it } from "vitest";
import { detectGraphicsCapabilities, type GraphicsCapabilityProbe } from "../../src/settings";

const probe: GraphicsCapabilityProbe = {
  devicePixelRatio: 2,
  maxAnisotropy: 16,
  maxTextureSize: 8192,
  fullscreenAvailable: true,
  antiAliasingApplied: true,
  effectiveShadows: false,
  postProcessing: false,
  motionEffects: false,
  environmentReflections: false,
  textureVariants: false
};

describe("graphics settings capabilities", () => {
  it("reports current live, restart, browser-managed, planned, and unsupported truth", () => {
    const capabilities = detectGraphicsCapabilities(probe);
    expect(capabilities.renderScale.status).toBe("SupportedLive");
    expect(capabilities.antiAliasing.status).toBe("SupportedAfterRendererRestart");
    expect(capabilities.vsync.status).toBe("BrowserManaged");
    expect(capabilities.fullscreen.status).toBe("BrowserManaged");
    expect(capabilities.shadows.status).toBe("Planned");
    expect(capabilities.environmentReflections.status).toBe("Planned");
    expect(capabilities.bloom.status).toBe("Unsupported");
    expect(capabilities.motionEffects.status).toBe("Unsupported");
  });

  it("uses feature detection and renderer limits", () => {
    const capabilities = detectGraphicsCapabilities({ ...probe, maxAnisotropy: 8, maxTextureSize: 4096 });
    expect(capabilities.textureQuality).toEqual(expect.objectContaining({ status: "SupportedLive", numericLimit: 8 }));
    expect(capabilities.renderScale.numericLimit).toBe(4096);
  });

  it("does not claim unsupported browser features are controllable", () => {
    const capabilities = detectGraphicsCapabilities({ ...probe, fullscreenAvailable: false, maxAnisotropy: 1 });
    expect(capabilities.fullscreen.status).toBe("Unsupported");
    expect(capabilities.textureQuality.status).toBe("Unsupported");
  });

  it("returns deeply immutable capability snapshots", () => {
    const capabilities = detectGraphicsCapabilities(probe);
    expect(Object.isFrozen(capabilities)).toBe(true);
    expect(Object.isFrozen(capabilities.vsync)).toBe(true);
  });
});
