import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { backendRevision, renderCommandResult, type RenderCommand } from "../../src/presentation";
import { createHvpSession } from "../../src/hvp/hvpTerrain";
import { startHvp, startHvpRoute, type HvpBootstrapHandle } from "../../src/hvp/hvpBootstrap";

class FakeElement extends EventTarget {
  id = "";
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
  hasAttribute(name: string): boolean { return this.attributes.has(name); }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  remove(): void {
    if (this.parent === undefined) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = undefined;
  }

  focus(): void {}
  setPointerCapture(): void {}
  releasePointerCapture(): void {}
}

class FakeWindow extends EventTarget {
  innerWidth = 1920;
  innerHeight = 1080;
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

const harness = () => {
  const body = new FakeElement("body");
  const host = new FakeElement("main");
  host.id = "app";
  const canvas = new FakeElement("canvas");
  canvas.id = "debug-scene";
  body.append(host, canvas);
  const documentPort = {
    body,
    querySelector: (selector: string) => {
      if (selector === "#app") return host;
      if (selector === "#debug-scene") return canvas;
      if (selector === "#hvp-hud") return descendants(body).find((element) => element.id === "hvp-hud") ?? null;
      if (selector === "#flight-hud") return null;
      return null;
    },
    createElement: (tagName: string) => new FakeElement(tagName)
  };
  const windowPort = new FakeWindow();
  let backendConstructions = 0;
  let backendDisposals = 0;
  let renders = 0;
  const backend = {
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
  const createBackend = vi.fn(() => {
    backendConstructions += 1;
    return backend;
  });
  const overrides = (extra: Record<string, unknown> = {}) => ({
    documentPort: documentPort as unknown as Document,
    windowPort: windowPort as unknown as Window,
    createBackend: createBackend as unknown as (
      options: ConstructorParameters<typeof import("../../src/render/three/backend").ThreeRenderBackend>[0]
    ) => import("../../src/render/three/backend").ThreeRenderBackend,
    ...extra
  } as unknown as Parameters<typeof startHvp>[0]);
  return {
    body,
    host,
    canvas,
    documentPort,
    windowPort,
    createBackend,
    overrides,
    counts: () => ({ backendConstructions, backendDisposals, renders })
  };
};

/** Emulates the browser firing a pending frame: the fired callback leaves the queue. */
const stepFrame = (windowPort: FakeWindow, timestamp: number): void => {
  expect(windowPort.animationFrames.size).toBe(1);
  const [id, callback] = [...windowPort.animationFrames.entries()][0]!;
  windowPort.animationFrames.delete(id);
  callback(timestamp);
};

describe("HVP T08 bootstrap lifecycle", () => {
  it("reaches Ready with exactly one tick loop and disposes start/dispose exactly once", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());

    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);
    expect(source.windowPort.animationFrames.size).toBe(1);

    stepFrame(source.windowPort, 16);
    expect(source.counts().renders).toBe(1);
    expect(source.windowPort.animationFrames.size).toBe(1);
    stepFrame(source.windowPort, 32);
    expect(source.counts().renders).toBe(2);
    expect(source.windowPort.animationFrames.size).toBe(1);

    await handle.dispose();
    await handle.dispose();
    expect(source.windowPort.animationFrames.size).toBe(0);
    expect(source.counts()).toEqual({ backendConstructions: 1, backendDisposals: 1, renders: 2 });
    expect(source.windowPort.listenerTotals.get("pagehide")).toBe(0);
  });

  it("fails a double mount closed with no duplicate HUD and no second backend", async () => {
    const source = harness();
    const first = await startHvp(source.overrides());

    await expect(startHvp(source.overrides())).rejects.toThrow(/already mounted/i);
    expect(source.createBackend).toHaveBeenCalledTimes(1);
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);

    await first.dispose();
    const second = await startHvp(source.overrides());
    expect(source.createBackend).toHaveBeenCalledTimes(2);
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await second.dispose();
  });

  it("fails a restart closed while dispose is pending and recovers after settle", async () => {
    const source = harness();
    const first = await startHvp(source.overrides());

    const pending = first.dispose();
    await expect(startHvp(source.overrides())).rejects.toThrow(/already mounted/i);
    expect(source.createBackend).toHaveBeenCalledTimes(1);

    await pending;
    const second = await startHvp(source.overrides());
    expect(source.createBackend).toHaveBeenCalledTimes(2);
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await second.dispose();
  });

  it("keeps the live session clean when the route entry fires twice", async () => {
    const source = harness();
    let handle: HvpBootstrapHandle | undefined;
    const documentPort = source.documentPort as unknown as Parameters<typeof startHvpRoute>[0];
    const loadHvp = async (): Promise<{ startHvp(): Promise<HvpBootstrapHandle> }> => ({
      startHvp: async () => (handle = await startHvp(source.overrides()))
    });

    await startHvpRoute(documentPort, loadHvp);
    await startHvpRoute(documentPort, loadHvp);

    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);
    expect(descendants(source.body).filter((element) => element.getAttribute("role") === "alert")).toHaveLength(0);
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");

    await handle!.dispose();
  });

  it("never reaches Ready on incomplete coverage and stays fail-closed", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides({
      createSession: () => createHvpSession({})
    }));

    expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(0);
    const alert = descendants(source.body).find((element) => element.getAttribute("role") === "alert");
    expect(alert?.id).toBe("hvp-failure");
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
    expect(source.counts().renders).toBe(0);
    expect(source.windowPort.animationFrames.size).toBe(0);

    await handle.dispose();
    const retry = await startHvp(source.overrides());
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await retry.dispose();
  });
});
