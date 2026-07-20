import { describe, expect, it, vi } from "vitest";
import { createSurfaceLabFrameTimeSampler, createSurfaceLabHud } from "../../src/surface-lab/surfaceLabHud";
import { snapshotSurfaceLabTelemetry, type SurfaceLabTelemetrySnapshot } from "../../src/surface-lab/surfaceLabTelemetry";

class FakeElement extends EventTarget {
  id = "";
  className = "";
  textContent = "";
  value = "";
  type = "";
  spellcheck = true;
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

const descendants = (element: FakeElement): FakeElement[] =>
  element.children.flatMap((child) => [child, ...descendants(child)]);

const snapshot = (overrides: Partial<SurfaceLabTelemetrySnapshot> = {}): SurfaceLabTelemetrySnapshot => snapshotSurfaceLabTelemetry({
  lifecycle: "Ready",
  seed: "hestia-surface-lab-v1",
  presetId: "hestia.nebelwald-archipelago.preview.v1",
  voxelSizeMeters: 0.5,
  regionExtentMeters: { x: 64, y: 32, z: 64 },
  requestedChunks: 16,
  readyChunks: 16,
  failedChunks: 0,
  cancelledJobs: 2,
  staleRejects: 1,
  workerQueueDepth: 0,
  runningWorkers: 0,
  workerRestarts: 3,
  planningEpoch: 4,
  latestWorkerEpoch: 5,
  vertices: 1_200,
  triangles: 400,
  meshBytes: 2_048,
  generationMilliseconds: 10.5,
  meshingMilliseconds: 4.25,
  uploadMilliseconds: 1.5,
  cacheHits: 6,
  cacheMisses: 7,
  cacheBypasses: 8,
  brickHashes: ["brick-a", "brick-b"],
  meshHashes: ["mesh-a", "mesh-b"],
  bodyId: "planet.hestia",
  systemFrameId: "frame:system",
  bodyInertialFrameId: "frame:body-inertial",
  bodyFixedFrameId: "frame:body-fixed",
  surfaceFrameId: "frame:surface",
  universeTick: 9,
  universeEpochSeconds: 7_200,
  ...overrides
});

describe("Surface Lab HUD", () => {
  it("projects every immutable telemetry family, explicit mode labels, warnings and camera evidence", () => {
    const body = new FakeElement("body");
    const host = new FakeElement("main");
    body.append(host);
    const documentPort = {
      body,
      createElement: (tagName: string) => new FakeElement(tagName)
    };
    const regenerate = vi.fn(async () => undefined);
    const setResolution = vi.fn(async () => undefined);
    const setWireframeEnabled = vi.fn();
    const hud = createSurfaceLabHud({
      host: host as unknown as HTMLElement,
      documentPort: documentPort as unknown as Document,
      presentationState: {
        fogEnabled: true,
        waterEnabled: true,
        vegetationEnabled: true,
        wireframeEnabled: false,
        boundariesEnabled: false
      },
      cameraPose: {
        mode: "Orbit",
        position: { x: 46, y: 34, z: 52 },
        target: { x: 0, y: -4, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 }
      },
      actions: {
        resetCamera: vi.fn(),
        setCameraMode: vi.fn(),
        setFogEnabled: vi.fn(),
        setWaterEnabled: vi.fn(),
        setVegetationEnabled: vi.fn(),
        setWireframeEnabled,
        setBoundariesEnabled: vi.fn(),
        regenerate,
        setResolution
      }
    });
    hud.update(snapshot(), { averageMilliseconds: 16.67, sampleCount: 300, complete: true }, {
      mode: "Orbit",
      position: { x: 46, y: 34, z: 52 },
      target: { x: 0, y: -4, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    });

    const all = descendants(host);
    const byId = (id: string): FakeElement | undefined => all.find((element) => element.id === id);
    expect(all.map((element) => element.textContent)).toEqual(expect.arrayContaining([
      "SURFACE LAB",
      "TECHNICAL PROVING GROUND",
      "NOT GAMEPLAY",
      "surfaceLab=1",
      "TECHNICAL TELEMETRY"
    ]));
    expect(byId("surface-lab-state")?.textContent).toBe("State: Ready");
    expect(byId("surface-lab-warnings")?.textContent).toContain("stale result(s) rejected");
    expect(byId("surface-lab-frame-time")?.textContent).toContain("300-frame settled sample");
    expect(byId("surface-lab-brick-hashes")?.textContent).toBe("brick-a · brick-b");
    expect(byId("surface-lab-mesh-hashes")?.textContent).toBe("mesh-a · mesh-b");
    expect(byId("surface-lab-camera")?.textContent).toContain("Orbit");
    expect(body.dataset).toMatchObject({
      surfaceLab: "1",
      surfaceLabState: "Ready",
      surfaceLabSeed: "hestia-surface-lab-v1",
      surfaceLabRequested: "16",
      surfaceLabReady: "16",
      surfaceLabCancelled: "2",
      surfaceLabWorkerRestarts: "3",
      surfaceLabFrameMilliseconds: "16.67",
      surfaceLabBrickHashes: "brick-a,brick-b",
      surfaceLabHashes: "mesh-a,mesh-b",
      surfaceLabCameraMode: "Orbit",
      surfaceLabFog: "true",
      surfaceLabVegetation: "true",
      surfaceLabWireframe: "false",
      surfaceLabRendererResize: "camera-and-css-only-private-renderer-drawing-buffer-fixed"
    });
    body.dataset.unrelatedEvidence = "preserve-me";

    const seedInput = byId("surface-lab-seed-input")!;
    seedInput.value = "changed-seed";
    seedInput.dispatchEvent(new Event("input"));
    hud.update(snapshot(), { averageMilliseconds: 16.67, sampleCount: 300, complete: true }, {
      mode: "Orbit",
      position: { x: 46, y: 34, z: 52 },
      target: { x: 0, y: -4, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    });
    expect(seedInput.value).toBe("changed-seed");
    byId("surface-lab-regenerate")?.dispatchEvent(new Event("click"));
    expect(regenerate).toHaveBeenCalledWith("changed-seed");
    const wireframe = all.find((element) => element.textContent === "Wireframe")!;
    expect(wireframe.getAttribute("aria-pressed")).toBe("false");
    wireframe.dispatchEvent(new Event("click"));
    expect(setWireframeEnabled).toHaveBeenCalledWith(true);
    expect(wireframe.getAttribute("aria-pressed")).toBe("true");

    hud.dispose();
    hud.dispose();
    expect(host.children).toHaveLength(0);
    expect(Object.keys(body.dataset).filter((key) => key.startsWith("surfaceLab"))).toEqual([]);
    expect(body.dataset.unrelatedEvidence).toBe("preserve-me");
  });

  it("publishes a bounded 300-frame settled average and resets while generation is active", () => {
    const sampler = createSurfaceLabFrameTimeSampler();
    let sample = sampler.push(25, false);
    expect(sample).toEqual({ averageMilliseconds: 0, sampleCount: 0, complete: false });
    for (let index = 0; index < 300; index += 1) sample = sampler.push(16 + index % 2, true);
    expect(sample.sampleCount).toBe(300);
    expect(sample.complete).toBe(true);
    expect(sample.averageMilliseconds).toBeCloseTo(16.5);
    sample = sampler.push(17, true);
    expect(sample.sampleCount).toBe(300);
    expect(sample.complete).toBe(true);
    expect(sampler.push(16, false).sampleCount).toBe(0);
  });

  it("renders synchronous seed and resolution action failures immediately and ignores actions after disposal", () => {
    const body = new FakeElement("body");
    const host = new FakeElement("main");
    body.append(host);
    const regenerate = vi.fn((_seed: string): Promise<unknown> => {
      throw new Error("synchronous seed failure");
    });
    const setResolution = vi.fn((_voxelSizeMeters: number): Promise<unknown> => {
      throw new Error("synchronous resolution failure");
    });
    const hud = createSurfaceLabHud({
      host: host as unknown as HTMLElement,
      documentPort: {
        body,
        createElement: (tagName: string) => new FakeElement(tagName)
      } as unknown as Document,
      presentationState: {
        fogEnabled: true,
        waterEnabled: true,
        vegetationEnabled: true,
        wireframeEnabled: false,
        boundariesEnabled: false
      },
      cameraPose: {
        mode: "Orbit",
        position: { x: 46, y: 34, z: 52 },
        target: { x: 0, y: -4, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 }
      },
      actions: {
        resetCamera: vi.fn(),
        setCameraMode: vi.fn(),
        setFogEnabled: vi.fn(),
        setWaterEnabled: vi.fn(),
        setVegetationEnabled: vi.fn(),
        setWireframeEnabled: vi.fn(),
        setBoundariesEnabled: vi.fn(),
        regenerate,
        setResolution
      }
    });
    hud.update(snapshot(), { averageMilliseconds: 0, sampleCount: 0, complete: false }, {
      mode: "Orbit",
      position: { x: 46, y: 34, z: 52 },
      target: { x: 0, y: -4, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    });
    const all = descendants(host);
    const byId = (id: string): FakeElement => all.find((element) => element.id === id)!;

    const seedInput = byId("surface-lab-seed-input");
    seedInput.value = "invalid seed";
    expect(() => byId("surface-lab-regenerate").dispatchEvent(new Event("click"))).not.toThrow();
    expect(regenerate).toHaveBeenCalledWith("invalid seed");
    expect(byId("surface-lab-warnings").textContent).toBe("Action failed: synchronous seed failure");

    const resolution = byId("surface-lab-resolution");
    resolution.value = "0.25";
    expect(() => resolution.dispatchEvent(new Event("change"))).not.toThrow();
    expect(setResolution).toHaveBeenCalledWith(0.25);
    expect(byId("surface-lab-warnings").textContent).toBe("Action failed: synchronous resolution failure");

    hud.dispose();
    expect(() => byId("surface-lab-regenerate").dispatchEvent(new Event("click"))).not.toThrow();
    expect(regenerate).toHaveBeenCalledOnce();
    expect(Object.keys(body.dataset).filter((key) => key.startsWith("surfaceLab"))).toEqual([]);
  });
});
