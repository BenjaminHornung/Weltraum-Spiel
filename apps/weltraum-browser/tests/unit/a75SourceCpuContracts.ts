import assert from "node:assert/strict";
import * as THREE from "three";
import { backendRevision, createFrameProjectionSnapshot, frameId, frameRevision } from "../../src/presentation";
import { ThreeRenderBackend, createThreeRendererPort, type ThreeRendererPort } from "../../src/render/three/backend/threeRenderBackend";
import { ThreeGraphicsSettingsAdapter } from "../../src/render/three/graphicsSettingsAdapter";
import { createGraphicsSettingsController, createDefaultGraphicsSettings, detectGraphicsCapabilities, loadGraphicsSettings } from "../../src/settings";

// Finite changed-Source contracts. Renderer/DOM ports are synthetic; no GPU, World or WASM executes.
const results: { id: string; status: "PASS" }[] = [];
async function check(id: string, run: () => void | Promise<void>): Promise<void> {
  await run();
  results.push({ id, status: "PASS" });
}

class CpuRenderer implements ThreeRendererPort {
  outcome: boolean | void = true;
  failRender = false;
  failResize = false;
  afterRender: (() => void) | undefined;
  size = new THREE.Vector2(1280, 720);
  setPixelRatio(): void {}
  setSize(): void { if (this.failResize) throw new Error("owned resize failure"); }
  getDrawingBufferSize(target: THREE.Vector2): THREE.Vector2 { return target.copy(this.size); }
  render(_scene: THREE.Scene, camera: THREE.Camera): boolean | void {
    if (this.failRender) throw new Error("owned render failure");
    camera.updateMatrixWorld();
    this.afterRender?.();
    return this.outcome;
  }
  dispose(): void {}
}

function backendFixture(): { backend: ThreeRenderBackend; renderer: CpuRenderer; canvas: EventTarget } {
  const canvas = new EventTarget();
  const renderer = new CpuRenderer();
  const backend = new ThreeRenderBackend({ canvas: canvas as HTMLCanvasElement, lightingMode: "None", rendererFactory: () => renderer });
  assert.equal(backend.dispatch({ kind: "InitializeBackend", backendRevision: backendRevision(0) }).status, "Accepted");
  return { backend, renderer, canvas };
}

await check("A75-FRAME-01-live-camera-and-previous-submit", () => {
  const { backend } = backendFixture();
  assert.equal(backend.readDiagnostics().ownedCpuBytes, 0);
  backend.camera.position.x = 7;
  backend.renderFrame();
  const first = backend.readSubmittedFrameMetadata()!;
  assert.equal(first.current.position[0], 7);
  assert.equal(first.previous, null);
  assert.deepEqual(first.current.drawingBuffer, { widthPx: 1280, heightPx: 720 });
  assert.equal(backend.readDiagnostics().ownedCpuBytes, 488);
  backend.camera.position.x = 9;
  backend.renderFrame();
  const second = backend.readSubmittedFrameMetadata()!;
  assert.equal(second.renderFrameId, first.renderFrameId + 1);
  assert.deepEqual(second.previous, first.current);
  assert.equal(first.current.position[0], 7);
  assert.equal(second.current.position[0], 9);
  assert.ok(Object.isFrozen(second.current.viewMatrix));
  assert.equal(second.attachmentPublication, "UNAVAILABLE");
  assert.equal(second.originEpoch, "UNAVAILABLE");
  assert.equal(backend.readDiagnostics().ownedCpuBytes, 976);
  backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
  assert.equal(backend.readDiagnostics().ownedCpuBytes, 0);
});

await check("A75-FRAME-02-explicit-skipped-submit", () => {
  const { backend, renderer } = backendFixture();
  backend.renderFrame();
  renderer.outcome = false;
  assert.equal(backend.renderFrame().reasonCode, "PresentationSkipped");
  assert.equal(backend.readSubmittedFrameMetadata(), undefined);
  assert.equal(backend.readDiagnostics().ownedCpuBytes, 0);
  renderer.outcome = true;
  backend.renderFrame();
  assert.equal(backend.readSubmittedFrameMetadata()!.previous, null);
  backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
});

await check("A75-FRAME-03-legacy-void-not-submit-evidence", () => {
  const { backend, renderer } = backendFixture();
  renderer.outcome = undefined;
  assert.equal(backend.renderFrame().status, "Accepted");
  assert.equal(backend.readSubmittedFrameMetadata(), undefined);
  backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
});

await check("A75-FRAME-04-failed-render-invalidates", () => {
  const { backend, renderer } = backendFixture();
  backend.renderFrame();
  renderer.failRender = true;
  assert.throws(() => backend.renderFrame(), /owned render failure/);
  assert.equal(backend.readSubmittedFrameMetadata(), undefined);
  backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
});

await check("A75-FRAME-05-failed-resize-and-dpr-output", () => {
  const { backend, renderer } = backendFixture();
  backend.renderFrame();
  const generation = backend.readSubmittedFrameMetadata()!.metadataGeneration;
  renderer.failResize = true;
  assert.throws(() => backend.resizeViewport(800, 600), /owned resize failure/);
  assert.equal(backend.readSubmittedFrameMetadata(), undefined);
  renderer.failResize = false;
  renderer.size.set(1600, 1200);
  backend.resizeViewport(800, 600);
  backend.renderFrame();
  assert.deepEqual(backend.readSubmittedFrameMetadata()!.current.drawingBuffer, { widthPx: 1600, heightPx: 1200 });
  assert.ok(backend.readSubmittedFrameMetadata()!.metadataGeneration > generation);
  assert.equal(backend.readSubmittedFrameMetadata()!.previous, null);
  backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
});

await check("A75-FRAME-06-context-loss-restoration-and-disposal", () => {
  const { backend, canvas } = backendFixture();
  backend.renderFrame();
  canvas.dispatchEvent(new Event("webglcontextlost"));
  assert.equal(backend.readSubmittedFrameMetadata(), undefined);
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  backend.renderFrame();
  assert.equal(backend.readSubmittedFrameMetadata()!.previous, null);
  assert.equal(backend.readSubmittedFrameMetadata()!.resetReason, "ContextRestored");
  backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
  assert.equal(backend.readSubmittedFrameMetadata(), undefined);
});

await check("A75-FRAME-07-projection-change-continuity", () => {
  const { backend } = backendFixture();
  backend.renderFrame();
  backend.camera.fov = 65;
  backend.camera.updateProjectionMatrix();
  backend.renderFrame();
  assert.equal(backend.readSubmittedFrameMetadata()!.previous, null);
  assert.equal(backend.readSubmittedFrameMetadata()!.resetReason, "ProjectionOrOutputChanged");
  assert.equal(backend.readSubmittedFrameMetadata()!.current.verticalFovDegrees, 65);
  backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
});

await check("A75-FRAME-08-same-renderer-submit-counter", () => {
  const state = { frame: 4 };
  let submit = false;
  const renderer = { info: { render: state }, render() { if (submit) state.frame += 1; },
    setPixelRatio() {}, setSize() {}, dispose() {} } as unknown as THREE.WebGLRenderer;
  const port = createThreeRendererPort(renderer);
  assert.equal(port.render(new THREE.Scene(), new THREE.PerspectiveCamera()), false);
  submit = true;
  assert.equal(port.render(new THREE.Scene(), new THREE.PerspectiveCamera()), true);
});

await check("A75-FRAME-09-camera-mutated-during-submit", () => {
  const { backend, renderer } = backendFixture();
  backend.renderFrame();
  renderer.afterRender = () => { backend.camera.position.x += 1; };
  backend.renderFrame();
  assert.equal(backend.readSubmittedFrameMetadata(), undefined);
  assert.equal(backend.readDiagnostics().ownedCpuBytes, 0);
  renderer.afterRender = undefined;
  backend.renderFrame();
  assert.equal(backend.readSubmittedFrameMetadata()!.previous, null);
  assert.equal(backend.readSubmittedFrameMetadata()!.resetReason, "CameraChangedDuringSubmit");
  backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
});

await check("A75-FRAME-10-projection-failure-invalidates", () => {
  const { backend } = backendFixture();
  backend.renderFrame();
  const update = backend.camera.updateProjectionMatrix;
  backend.camera.updateProjectionMatrix = () => { throw new Error("owned projection failure"); };
  const snapshot = createFrameProjectionSnapshot({ frameId: frameId("local:a75"), frameRevision: frameRevision(1),
    cameraPositionRelative: { x: 3, y: 0, z: 5 }, cameraOrientation: { x: 0, y: 0, z: 0, w: 1 },
    projectionParameters: { kind: "Perspective", verticalFovDegrees: 50, aspect: 16 / 9, near: 0.1, far: 100 },
    representationTransforms: [] });
  assert.throws(() => backend.dispatch({ kind: "ApplyFrameProjection", backendRevision: backendRevision(0), snapshot }), /owned projection failure/);
  assert.equal(backend.readSubmittedFrameMetadata(), undefined);
  assert.equal(backend.readDiagnostics().ownedCpuBytes, 0);
  backend.camera.updateProjectionMatrix = update;
  backend.camera.updateProjectionMatrix();
  backend.renderFrame();
  assert.equal(backend.readSubmittedFrameMetadata()!.previous, null);
  assert.equal(backend.readSubmittedFrameMetadata()!.resetReason, "ProjectionFailed");
  backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
});

const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const documentPort = { fullscreenEnabled: true, fullscreenElement: null,
  documentElement: { requestFullscreen: async () => {} }, exitFullscreen: async () => {} };
Object.defineProperty(globalThis, "window", { configurable: true, value: { devicePixelRatio: 2 } });
Object.defineProperty(globalThis, "document", { configurable: true, value: documentPort });
try {
  function adapter(scene: THREE.Scene): ThreeGraphicsSettingsAdapter {
    const renderer = { getContext: () => ({ getContextAttributes: () => ({ antialias: true }) }),
      capabilities: { getMaxAnisotropy: () => 8, maxTextureSize: 4096 }, shadowMap: {},
      setPixelRatio() {}, setSize() {} } as unknown as THREE.WebGLRenderer;
    return new ThreeGraphicsSettingsAdapter({ renderer, scene, camera: new THREE.PerspectiveCamera(),
      canvas: { clientWidth: 800, clientHeight: 600, dataset: {} } as HTMLCanvasElement });
  }

  await check("A75-SETTINGS-01-nested-shadow-chain", () => {
    const scene = new THREE.Scene(), group = new THREE.Group(), light = new THREE.DirectionalLight();
    light.castShadow = true;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(light, mesh); scene.add(group);
    assert.equal(adapter(scene).getCapabilities().shadows.status, "SupportedLive");
    mesh.receiveShadow = false;
    assert.equal(adapter(scene).getCapabilities().shadows.status, "Planned");
    mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); light.dispose();
  });

  await check("A75-SETTINGS-02-actual-managed-decoration", () => {
    const scene = new THREE.Scene();
    assert.equal(adapter(scene).getCapabilities().decorDensity.status, "Unsupported");
    const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
    Object.assign(points.userData, { renderOnly: true, graphicsDensityMode: "drawRange", graphicsDensityBaseCount: 4 });
    scene.add(points);
    assert.equal(adapter(scene).getCapabilities().decorDensity.status, "SupportedLive");
    points.geometry.dispose(); (points.material as THREE.Material).dispose();
  });

  await check("A75-SETTINGS-04-invisible-and-layer-excluded-shadow-light", () => {
    const scene = new THREE.Scene(), group = new THREE.Group(), light = new THREE.DirectionalLight();
    light.castShadow = true;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(light); scene.add(group, mesh);
    group.visible = false;
    assert.equal(adapter(scene).getCapabilities().shadows.status, "Planned");
    group.visible = true; light.layers.set(1);
    assert.equal(adapter(scene).getCapabilities().shadows.status, "Planned");
    mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); light.dispose();
  });

  await check("A75-SETTINGS-05-ambient-light-is-not-a-shadow-producer", () => {
    const scene = new THREE.Scene(), light = new THREE.AmbientLight();
    light.castShadow = true;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(light, mesh);
    assert.equal(adapter(scene).getCapabilities().shadows.status, "Planned");
    mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
  });

  await check("A75-SETTINGS-03-resolved-fullscreen-decline", async () => {
    const settings = createDefaultGraphicsSettings();
    const result = await adapter(new THREE.Scene()).apply({ ...settings,
      display: { ...settings.display, fullscreenPreference: "Fullscreen" } }, ["fullscreen"]);
    assert.equal(result.runtime.fullscreenActual, "Windowed");
    assert.ok(result.skipped.includes("fullscreen"));
    assert.ok(!result.applied.includes("fullscreen"));
    assert.ok(result.warnings.includes("The browser did not apply the requested fullscreen mode."));
  });
} finally {
  if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
  if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
}

await check("A75-CONTROLLER-01-requested-skip-is-not-full-apply", async () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); } };
  const capabilities = detectGraphicsCapabilities({ devicePixelRatio: 1, maxAnisotropy: 1, maxTextureSize: 2048,
    fullscreenAvailable: false, antiAliasingApplied: true, effectiveShadows: false, renderOnlyDecor: false,
    postProcessing: false, motionEffects: false, environmentReflections: false, textureVariants: false });
  const baseline = { renderScale: 1, maxDevicePixelRatio: 1, effectivePixelRatio: 1, fieldOfView: 60,
    renderDistance: 5000, fpsLimit: 0 as const, fullscreenActual: "Windowed" as const, shadowPolicy: null,
    textureAnisotropy: 1, toneMapping: "ACESFilmic" as const, exposure: 1, decorDensity: 1, antiAliasingApplied: true };
  const controller = createGraphicsSettingsController({ initial: loadGraphicsSettings(storage), storage,
    runtime: { getSnapshot: () => baseline, getCapabilities: () => capabilities,
      apply: async () => ({ runtime: baseline, applied: [], skipped: ["fullscreen"], restartRequired: [], warnings: [] }) } });
  controller.updateSetting("display.fullscreenPreference", "Fullscreen");
  const result = await controller.apply();
  assert.equal(result.ok, true);
  assert.match(result.message, /some requested changes are not supported/);
  assert.equal(result.snapshot.runtime.fullscreenActual, "Windowed");
  assert.equal(result.snapshot.confirmed.display.fullscreenPreference, "Fullscreen");
});

console.log(JSON.stringify({ schema: "a75.changed-source-cpu.v1", classification: "SYNTHETIC_RENDERER_DOM_PORTS_ACTUAL_SOURCE_CLASSES",
  tests: results, passed: results.length, failed: 0, native: "NOT_RUN", gpu: "NOT_RUN", browser: "NOT_RUN",
  actualFrameTextures: "NOT_RUN", reference: "NOT_RUN" }));
