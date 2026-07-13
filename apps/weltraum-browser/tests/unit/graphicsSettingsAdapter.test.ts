import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserRuntime } from "../../src/runtime/browserRuntime";
import { applyQualityPreset, createDefaultGraphicsSettings } from "../../src/settings";
import { PresentationScheduler, ThreeGraphicsSettingsAdapter } from "../../src/render/three/graphicsSettingsAdapter";

interface FakeRenderer extends Partial<THREE.WebGLRenderer> {
  readonly pixelRatios: number[];
  readonly sizes: Array<{ readonly width: number; readonly height: number }>;
}

function createFakeRenderer(): FakeRenderer {
  const renderer: FakeRenderer = {
    pixelRatios: [],
    sizes: [],
    capabilities: {
      getMaxAnisotropy: () => 8,
      maxTextureSize: 4_096
    } as THREE.WebGLCapabilities,
    shadowMap: {
      enabled: false,
      autoUpdate: true,
      needsUpdate: false,
      type: THREE.PCFShadowMap
    } as THREE.WebGLShadowMap,
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    getContext: () => ({ getContextAttributes: () => ({ antialias: true }) }) as WebGL2RenderingContext,
    setPixelRatio(pixelRatio: number) {
      renderer.pixelRatios.push(pixelRatio);
    },
    setSize(width: number, height: number) {
      renderer.sizes.push({ width, height });
    }
  };
  return renderer;
}

function createCanvas(): HTMLCanvasElement {
  return {
    clientWidth: 1_200,
    clientHeight: 800,
    dataset: {}
  } as HTMLCanvasElement;
}

describe("PresentationScheduler", () => {
  it("gates presentation frames without gating simulation ticks", () => {
    const scheduler = new PresentationScheduler();
    scheduler.setLimit(30);
    let simulationTicks = 0;
    const presentationFrames = [0, 10, 20, 34, 44, 68].map((time) => {
      simulationTicks += 1;
      return scheduler.shouldPresent(time);
    });
    expect(presentationFrames).toEqual([
      true,
      false,
      false,
      true,
      false,
      true
    ]);
    expect(simulationTicks).toBe(6);

    scheduler.setLimit(0);
    expect(scheduler.shouldPresent(69)).toBe(true);
    expect(scheduler.shouldPresent(70)).toBe(true);
  });
});

describe("ThreeGraphicsSettingsAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { devicePixelRatio: 3 });
    vi.stubGlobal("document", {
      fullscreenEnabled: true,
      fullscreenElement: null,
      documentElement: { requestFullscreen: vi.fn() },
      exitFullscreen: vi.fn()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies only presentation settings and preserves truth-backed scene objects", async () => {
    const renderer = createFakeRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 5_000);
    const canvas = createCanvas();

    const decorativePoints = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Array(300).fill(0), 3)),
      new THREE.PointsMaterial()
    );
    Object.assign(decorativePoints.userData, {
      renderOnly: true,
      graphicsDensityMode: "drawRange",
      graphicsDensityBaseCount: 100
    });
    const decorativeInstances = new THREE.InstancedMesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial(),
      10
    );
    Object.assign(decorativeInstances.userData, {
      renderOnly: true,
      graphicsDensityMode: "instanceCount",
      graphicsDensityBaseCount: 10
    });
    const truthInstances = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 7);
    truthInstances.userData.renderOnly = false;
    const truthSnapshot = Object.freeze({ count: truthInstances.count, position: truthInstances.position.toArray() });
    const runtime = createBrowserRuntime();
    const gameplaySnapshot = runtime.controller.getTelemetry();
    scene.add(decorativePoints, decorativeInstances, truthInstances);

    const adapter = new ThreeGraphicsSettingsAdapter({
      renderer: renderer as THREE.WebGLRenderer,
      camera,
      scene,
      canvas
    });
    const low = applyQualityPreset(createDefaultGraphicsSettings(), "Low");
    const result = await adapter.apply(low, ["renderScale", "decorDensity", "antiAliasing"]);

    expect(renderer.pixelRatios.at(-1)).toBe(0.65);
    expect(renderer.sizes.at(-1)).toEqual({ width: 1_200, height: 800 });
    expect(camera.fov).toBe(58);
    expect(camera.far).toBe(1_500);
    expect(decorativePoints.geometry.drawRange.count).toBe(35);
    expect(decorativeInstances.count).toBe(3);
    expect({ count: truthInstances.count, position: truthInstances.position.toArray() }).toEqual(truthSnapshot);
    expect(runtime.controller.getTelemetry()).toEqual(gameplaySnapshot);
    expect(result.restartRequired).toEqual(["antiAliasing"]);
    expect(result.skipped).toContain("shadows");
    expect(result.skipped).toContain("bloom");
    expect(result.applied).not.toContain("bloom");
    expect(canvas.dataset.graphicsPreset).toBe("Low");
    expect(canvas.dataset.graphicsEffectivePixelRatio).toBe("0.65");
  });

  it("clamps the backing resolution to the renderer texture limit", () => {
    const renderer = createFakeRenderer();
    (renderer.capabilities as { maxTextureSize: number }).maxTextureSize = 400;
    const adapter = new ThreeGraphicsSettingsAdapter({
      renderer: renderer as THREE.WebGLRenderer,
      camera: new THREE.PerspectiveCamera(),
      scene: new THREE.Scene(),
      canvas: createCanvas()
    });

    adapter.resize();

    expect(renderer.pixelRatios.at(-1)).toBeCloseTo(0.3333, 3);
    expect(adapter.getSnapshot().effectivePixelRatio).toBeCloseTo(0.3333, 3);
  });
});
