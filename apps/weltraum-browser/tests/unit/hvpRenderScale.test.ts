import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createHvpVisualRenderer } from "../../src/hestia-prototype/presentation/visualEffects";
import { backendRevision } from "../../src/presentation";
import { ThreeRenderBackend } from "../../src/render/three/backend";
import { createDefaultGraphicsSettings, loadGraphicsSettings, saveGraphicsSettings } from "../../src/settings";

function start(pixelRatio: number, scale?: number) {
  let raw: string | null = null;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  const defaults = createDefaultGraphicsSettings();
  if (scale !== undefined) {
    expect(saveGraphicsSettings(storage, { ...defaults, display: { ...defaults.display, renderScale: scale } }).ok).toBe(true);
  }
  const display = loadGraphicsSettings(storage).settings.display;
  const canvas = Object.assign(new EventTarget(), { style: { width: "100%", height: "100%" }, dataset: {} }) as unknown as HTMLCanvasElement;
  const context = { drawingBufferWidth: 0, drawingBufferHeight: 0 };
  const requested = new THREE.Vector2();
  let ratio = 1;
  const configure = vi.fn((width: number, height: number, nextRatio: number) => {
    ratio = nextRatio;
    context.drawingBufferWidth = Math.floor(width * ratio);
    context.drawingBufferHeight = Math.floor(height * ratio);
    requested.set(context.drawingBufferWidth, context.drawingBufferHeight);
  });
  const info = { render: { frame: 0 } };
  const limits = { maxTextureSize: 8192 };
  const webgl = {
    info, capabilities: limits, getContext: () => context, shadowMap: {},
    setDrawingBufferSize: configure,
    setPixelRatio: (value: number) => { ratio = value; },
    setSize: (width: number, height: number) => configure(width, height, ratio),
    getDrawingBufferSize: (target: THREE.Vector2) => target.copy(requested),
    render: () => { info.render.frame++; }, dispose: vi.fn(),
  } as unknown as THREE.WebGLRenderer;
  const backend = new ThreeRenderBackend({
    canvas, width: 1280, height: 720, pixelRatio, lightingMode: "None",
    rendererFactory: (element, parameters) => createHvpVisualRenderer(element, parameters, () => webgl, undefined, false, display),
  });
  expect(backend.dispatch({ kind: "InitializeBackend", backendRevision: backendRevision(0) }).status).toBe("Accepted");
  const dispose = () => backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
  const frame = () => { backend.renderFrame(); return backend.readSubmittedFrameMetadata()!; };
  return { backend, canvas, context, configure, dispose, frame, limits };
}

describe("HVP drawing-buffer scale", () => {
  it.each([
    { dpr: 1, scale: undefined, width: 1280, height: 720 },
    { dpr: 2, scale: undefined, width: 2560, height: 1440 },
    { dpr: 3, scale: undefined, width: 2560, height: 1440 },
    { dpr: 1, scale: 0.75, width: 960, height: 540 },
    { dpr: 2, scale: 0.75, width: 1920, height: 1080 },
  ])("uses the saved/default display settings for DPR $dpr and scale $scale", ({ dpr, scale, width, height }) => {
    const run = start(dpr, scale);
    try {
      expect(run.frame().current.drawingBuffer).toEqual({ widthPx: width, heightPx: height });
      expect(run.canvas.style).toEqual({ width: "100%", height: "100%" });
    } finally { run.dispose(); }
  });

  it("reports the drawing buffer allocated by WebGL when it is smaller than requested", () => {
    const run = start(2);
    try {
      run.context.drawingBufferWidth = 1600;
      run.context.drawingBufferHeight = 900;
      expect(run.frame().current.drawingBuffer).toEqual({ widthPx: 1600, heightPx: 900 });
    } finally { run.dispose(); }
  });

  it("resizes once on a DPR-only change and resolves the current hardware cap after restoration", () => {
    const run = start(1, 0.75);
    try {
      const original = run.frame();
      run.backend.resizeViewport(1280, 720, 2);
      expect(run.backend.isSubmittedFrameCurrent(original)).toBe(false);
      const resized = run.frame();
      expect(resized.current.drawingBuffer).toEqual({ widthPx: 1920, heightPx: 1080 });
      run.backend.resizeViewport(1280, 720, 2);
      expect(run.backend.isSubmittedFrameCurrent(resized)).toBe(true);
      expect(run.configure).toHaveBeenCalledTimes(2);
      run.canvas.dispatchEvent(new Event("webglcontextlost"));
      run.limits.maxTextureSize = 1024;
      run.canvas.dispatchEvent(new Event("webglcontextrestored"));
      const restored = run.frame();
      expect(restored.previous).toBeNull();
      expect(restored.current.drawingBuffer).toEqual({ widthPx: 1024, heightPx: 576 });
      run.backend.resizeViewport(640, 360, 2);
      expect(run.frame().current.drawingBuffer).toEqual({ widthPx: 960, heightPx: 540 });
      expect(run.canvas.style.width).toBe("100%");
    } finally { run.dispose(); }
    const submittedSizes = run.configure.mock.calls.length;
    run.canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(run.configure).toHaveBeenCalledTimes(submittedSizes);
  });
});
