import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { backendRevision, renderCommandResult, type RenderBackend, type RenderCommand } from "../../src/presentation";
import {
  startSurfaceLab,
  type SurfaceLabBootstrapDependencies
} from "../../src/surface-lab/surfaceLabBootstrap";

class FakeElement extends EventTarget {
  id = "";
  className = "";
  textContent = "";
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  parent: FakeElement | undefined;

  constructor(readonly tagName: string) { super(); }

  append(...children: FakeElement[]): void {
    children.forEach((child) => { child.parent = this; });
    this.children.push(...children);
  }

  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  remove(): void {
    if (this.parent === undefined) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = undefined;
  }
}

class FakeWindow extends EventTarget {
  innerWidth = 1280;
  innerHeight = 720;
  devicePixelRatio = 1;
  readonly animationFrames = new Map<number, FrameRequestCallback>();
  readonly listenerTotals = new Map<string, number>();
  #nextAnimationFrame = 1;

  public override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    super.addEventListener(type, listener, options);
    this.listenerTotals.set(type, (this.listenerTotals.get(type) ?? 0) + 1);
  }

  public override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener, options);
    this.listenerTotals.set(type, Math.max(0, (this.listenerTotals.get(type) ?? 0) - 1));
  }

  public requestAnimationFrame(callback: FrameRequestCallback): number {
    const id = this.#nextAnimationFrame++;
    this.animationFrames.set(id, callback);
    return id;
  }

  public cancelAnimationFrame(id: number): void { this.animationFrames.delete(id); }
}

const descendants = (element: FakeElement): FakeElement[] =>
  element.children.flatMap((child) => [child, ...descendants(child)]);

const harness = (start: () => Promise<void>, cameraFailure?: Error, controllerFailure?: Error) => {
  const body = new FakeElement("body");
  const host = new FakeElement("main");
  const canvas = new FakeElement("canvas");
  body.append(host, canvas);
  const documentPort = {
    body,
    querySelector: (selector: string) => selector === "#app" ? host : selector === "#debug-scene" ? canvas : null,
    createElement: (tagName: string) => new FakeElement(tagName)
  };
  const windowPort = new FakeWindow();
  let backendDisposals = 0;
  let poolShutdowns = 0;
  let controllerDisposals = 0;
  let renders = 0;
  const backend: RenderBackend & { readonly camera: THREE.PerspectiveCamera } = {
    camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1_000),
    dispatch: (command: RenderCommand) => {
      if (command.kind === "DisposeBackend") backendDisposals += 1;
      return renderCommandResult("Accepted");
    },
    renderFrame: () => { renders += 1; return renderCommandResult("Accepted"); },
    getCapabilities: () => ({
      supportedIndexWidths: [16, 32],
      supportedMaterialKinds: ["Unlit", "BasicLit", "DebugWireframe"],
      supportsPerspectiveProjection: true,
      supportsEviction: true
    }),
    readDiagnostics: () => ({
      acceptedArtifacts: 0,
      rejectedArtifacts: 0,
      activeRepresentations: 0,
      activeFallbacks: 0,
      geometryAllocations: 0,
      geometryDisposals: 0,
      materialAllocations: 0,
      materialDisposals: 0,
      estimatedGpuBytes: 0,
      ownedCpuBytes: 0,
      replacementCount: 0,
      removeCount: 0,
      staleRejectCount: 0,
      resetCount: 0,
      evictionCount: 0,
      evictionRejectCount: 0,
      rehydrationCount: 0,
      renderTargetAllocations: 0,
      renderTargetDisposals: 0,
      activeRenderTargets: 0,
      backendRevision: backendRevision(0),
      backendState: "Available",
      residentRepresentationKeys: [],
      visibleRepresentationKeys: [],
      pinnedFallbackRepresentationKeys: []
    })
  };
  const workerPool = {
    shutdown: vi.fn(async () => { poolShutdowns += 1; })
  };
  let disposed = false;
  const controller = {
    start: vi.fn(start),
    dispose: vi.fn(async () => {
      if (disposed) return;
      disposed = true;
      controllerDisposals += 1;
      await workerPool.shutdown();
      backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) });
    })
  };
  const createCamera = vi.fn(() => {
    if (cameraFailure !== undefined) throw cameraFailure;
    throw new Error("Camera construction was not expected in this harness.");
  });
  const createEnvironment = vi.fn();
  const createHud = vi.fn();
  const dependencies = {
    documentPort,
    windowPort,
    navigatorPort: { hardwareConcurrency: 4 },
    nowMilliseconds: () => 0,
    createBackend: () => backend,
    createWorkerPool: () => workerPool,
    createController: () => {
      if (controllerFailure !== undefined) throw controllerFailure;
      return controller;
    },
    createCamera,
    createEnvironment,
    createHud,
    createFrameTimeSampler: vi.fn()
  } as unknown as Partial<SurfaceLabBootstrapDependencies>;

  return {
    body,
    host,
    canvas,
    windowPort,
    controller,
    createCamera,
    createEnvironment,
    createHud,
    dependencies,
    counts: () => ({ backendDisposals, poolShutdowns, controllerDisposals, renders })
  };
};

describe("Surface Lab bootstrap lifecycle", () => {
  it("does not construct UI, render, schedule, or write telemetry after disposal races pending start", async () => {
    let releaseStart!: () => void;
    const startGate = new Promise<void>((resolve) => { releaseStart = resolve; });
    const source = harness(() => startGate);
    const starting = startSurfaceLab(source.dependencies);
    await Promise.resolve();
    await Promise.resolve();
    expect(source.controller.start).toHaveBeenCalledOnce();

    source.windowPort.dispatchEvent(new Event("pagehide"));
    releaseStart();
    const handle = await starting;
    await handle.dispose();

    expect(source.createCamera).not.toHaveBeenCalled();
    expect(source.createEnvironment).not.toHaveBeenCalled();
    expect(source.createHud).not.toHaveBeenCalled();
    expect(source.windowPort.animationFrames.size).toBe(0);
    expect(source.windowPort.listenerTotals.get("pagehide")).toBe(0);
    expect(source.counts()).toEqual({ backendDisposals: 1, poolShutdowns: 1, controllerDisposals: 1, renders: 0 });
    expect(Object.keys(source.body.dataset).filter((key) => key.startsWith("surfaceLab"))).toEqual([]);
  });

  it("contains a post-start construction failure and returns an inert accessible failure handle", async () => {
    const source = harness(async () => undefined, new Error("synthetic camera failure"));
    const handle = await startSurfaceLab(source.dependencies);

    expect(handle.controller).toBeUndefined();
    expect(source.createCamera).toHaveBeenCalledOnce();
    expect(source.createEnvironment).not.toHaveBeenCalled();
    expect(source.createHud).not.toHaveBeenCalled();
    expect(source.windowPort.animationFrames.size).toBe(0);
    expect(source.windowPort.listenerTotals.get("pagehide")).toBe(0);
    expect(source.counts()).toEqual({ backendDisposals: 1, poolShutdowns: 1, controllerDisposals: 1, renders: 0 });
    const alert = descendants(source.body).find((element) => element.getAttribute("role") === "alert");
    expect(alert?.id).toBe("surface-lab-failure");
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
    expect(alert?.parent).toBe(source.host);
    expect(descendants(alert!).map((element) => element.textContent).join(" ")).toContain("synthetic camera failure");
    expect(source.body.dataset).toMatchObject({ surfaceLab: "1", surfaceLabState: "Failed" });

    await handle.dispose();
    await handle.dispose();
    expect(descendants(source.body).some((element) => element.id === "surface-lab-failure")).toBe(false);
    expect(source.counts()).toEqual({ backendDisposals: 1, poolShutdowns: 1, controllerDisposals: 1, renders: 0 });
  });

  it("releases the worker pool and backend exactly once when controller construction throws", async () => {
    const source = harness(
      async () => undefined,
      undefined,
      new Error("synthetic pre-controller construction failure")
    );
    const handle = await startSurfaceLab(source.dependencies);

    expect(handle.controller).toBeUndefined();
    expect(source.controller.start).not.toHaveBeenCalled();
    expect(source.counts()).toEqual({ backendDisposals: 1, poolShutdowns: 1, controllerDisposals: 0, renders: 0 });
    const alert = descendants(source.host).find((element) => element.id === "surface-lab-failure");
    expect(alert?.getAttribute("role")).toBe("alert");
    expect(descendants(alert!).map((element) => element.textContent).join(" ")).toContain("synthetic pre-controller construction failure");
    expect(source.body.dataset).toMatchObject({ surfaceLab: "1", surfaceLabState: "Failed" });

    await handle.dispose();
    await handle.dispose();
    expect(source.counts()).toEqual({ backendDisposals: 1, poolShutdowns: 1, controllerDisposals: 0, renders: 0 });
  });

  it("keeps the technical failure alert visible while hiding other app chrome in Surface Lab mode", () => {
    const css = readFileSync(new URL("../../src/style.css", import.meta.url), "utf8");

    expect(css).toContain(
      'body[data-surface-lab="1"] #app > :not(#debug-scene):not(#surface-lab-hud):not(#surface-lab-failure)'
    );
    expect(css).toMatch(/\.surface-lab-failure\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*40;/s);
  });

  it("contains an asynchronous controller start failure without revealing the flight HUD", async () => {
    const source = harness(async () => { throw new Error("synthetic async start failure"); });
    const handle = await startSurfaceLab(source.dependencies);

    expect(handle.controller).toBeUndefined();
    expect(source.createCamera).not.toHaveBeenCalled();
    expect(source.createEnvironment).not.toHaveBeenCalled();
    expect(source.createHud).not.toHaveBeenCalled();
    expect(source.windowPort.animationFrames.size).toBe(0);
    expect(source.windowPort.listenerTotals.get("pagehide")).toBe(0);
    expect(source.counts()).toEqual({ backendDisposals: 1, poolShutdowns: 1, controllerDisposals: 1, renders: 0 });
    const alert = descendants(source.body).find((element) => element.getAttribute("role") === "alert");
    expect(alert?.id).toBe("surface-lab-failure");
    expect(descendants(source.host).some((element) => element.id === "surface-lab-hud")).toBe(false);
  });
});
