import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { backendRevision, materialProfileId, renderCommandResult, type RenderCommand } from "../../src/presentation";
import {
  HVP_COAST_BLOCK_SIZE_METERS,
  HVP_TERRAIN_MATERIAL_ID,
  HVP_TERRAIN_REPRESENTATION_KEY,
  HVP_WATER_REPRESENTATION_KEY,
  type HvpBlockMesh,
  hvpBuildCoastBlockCells,
  hvpMeshBlocks
} from "../../src/hvp/hvpTerrain";
import {
  HVP_SLOT_LIMESTONE_DRY,
  HVP_SLOT_LIMESTONE_WET,
  HVP_SLOT_MOSS,
  HVP_SLOT_SOIL,
  materializeHvpCoastSource,
  type HvpCoastSourceSnapshot
} from "../../src/hvp/hvpCoastSource";
import { meshHvpTestCells } from "../../src/hvp/hvpCoastMesher";
import {
  admitHvpResources,
  buildHvpResourceLedger,
  createHvpCompactLookTerrain,
  createHvpLookTerrain,
  HVP_RESOURCE_CAPS_DEFAULT,
  startHvp,
  startHvpRoute,
  type HvpBootstrapHandle
} from "../../src/hvp/hvpBootstrap";
import { createHvpLookProfile } from "../../src/hestia-prototype/presentation/look";

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
  const reticle = new FakeElement("div");
  reticle.setAttribute("class", "hud-center-safe-area");
  host.append(reticle);
  body.append(host, canvas);
  const documentPort = {
    body,
    querySelector: (selector: string) => {
      if (selector === "#app") return host;
      if (selector === "#debug-scene") return canvas;
      if (selector === ".hud-center-safe-area") return reticle;
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
  const dispatchedCommands: RenderCommand[] = [];
  const scene = new THREE.Scene();
  const representationRoot = new THREE.Group();
  scene.add(representationRoot);
  const backend = {
    camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1_000),
    scene,
    representationRoot,
    dispatch: (command: RenderCommand) => {
      dispatchedCommands.push(command);
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
    counts: () => ({ backendConstructions, backendDisposals, renders }),
    commands: dispatchedCommands,
    camera: backend.camera,
    scene,
    backend
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
  // Full starts materialize and mesh the region; allow generous time per test
  // instead of the 5 s default so slow environments report real failures.
  vi.setConfig({ testTimeout: 120_000 });
  it("binds the rendered daylight look scene instead of only publishing dataset claims", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());

    try {
      const presentation = source.scene.getObjectByName("hvp-readable-coast-presentation");
      expect(presentation).toBeDefined();
      expect(source.scene.background).toBeInstanceOf(THREE.Color);
      expect((source.scene.background as THREE.Color).getHex()).toBe(0x87b5d9);
      expect(source.scene.fog).toBeInstanceOf(THREE.Fog);
      expect((source.scene.fog as THREE.Fog).near).toBe(48);
      expect((source.scene.fog as THREE.Fog).far).toBe(170);
      expect(source.scene.getObjectByName("hvp-ambient-fill")).toBeInstanceOf(THREE.HemisphereLight);
      expect(source.scene.getObjectByName("hvp-sun-key")).toBeInstanceOf(THREE.DirectionalLight);
      expect(source.scene.getObjectByName("hvp-cool-fill")).toBeInstanceOf(THREE.DirectionalLight);

      expect(presentation?.userData.hvpRenderOnly).toBe(true);
    } finally {
      await handle.dispose();
    }
  });

  it("fails closed when the backend cannot provide a rendered scene", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides({
      createBackend: () => ({ ...source.backend, scene: undefined })
    }));

    expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(0);
    expect(descendants(source.body).filter((element) => element.getAttribute("role") === "alert")).toHaveLength(1);
    expect(descendants(source.body).find((element) => element.id === "hvp-error-detail")?.textContent)
      .toContain("HVP-02 requires a rendered Three.js scene");
    expect(source.body.dataset.hestiaPrototypeLook).toBeUndefined();
    await handle.dispose();
  });

  it("proves the far field arrives bound through the pipeline as render-only data", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());

    try {
      const proxyGroup = source.scene.getObjectByName("hvp-distant-coast-proxy-noneditable");
      expect(proxyGroup).toBeUndefined();
      const farCommand = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey === "hvp:far"
      );
      expect(farCommand).toBeDefined();
      if (farCommand === undefined) return;
      expect(farCommand.artifact.algorithmVersion).toBe("hvp-farfield-macro-v3");
      expect(farCommand.artifact.indices.length).toBeGreaterThan(0);
      expect(farCommand.artifact.indices.length / 3).toBeLessThanOrEqual(500_000);
      const roleIds = farCommand.artifact.materialRanges.map((range) => range.materialProfileId);
      expect(roleIds.length).toBeGreaterThan(0);
      for (const id of roleIds) {
        expect([
          "hvp:look:limestone-dry",
          "hvp:look:limestone-wet",
          "hvp:look:soil",
          "hvp:look:moss"
        ]).toContain(id);
      }
      expect(farCommand.artifact.materialRanges.reduce((total, range) => total + range.indexCount, 0))
        .toBe(farCommand.artifact.indices.length);
      expect((handle as unknown as { readonly edit?: unknown }).edit).toBeUndefined();
    } finally {
      await handle.dispose();
    }
  });

  it("keeps source-derived terrain geometry intact while grouping readable material ranges", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());
    try {
      const terrainCommand = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey === HVP_TERRAIN_REPRESENTATION_KEY
      );

      expect(terrainCommand).toBeDefined();
      if (terrainCommand === undefined) return;
      expect(terrainCommand.artifact.algorithmVersion).toBe("hvp-coast-greedy-v3");
      expect(terrainCommand.artifact.indices.length % 6).toBe(0);
      expect(terrainCommand.artifact.indices.length).toBeGreaterThan(6_000);
      expect(terrainCommand.artifact.indices.length / 3).toBeLessThanOrEqual(500_000);
      expect(terrainCommand.artifact.materialRanges.reduce((total, range) => total + range.indexCount, 0))
        .toBe(terrainCommand.artifact.indices.length);
      expect(terrainCommand.artifact.materialRanges).toHaveLength(4);
      expect(terrainCommand.artifact.materialRanges.map((range) => range.materialProfileId)).toEqual([
        "hvp:look:limestone-dry",
        "hvp:look:limestone-wet",
        "hvp:look:soil",
        "hvp:look:moss"
      ]);
      terrainCommand.artifact.materialRanges.forEach((range) => {
        expect(range.indexCount).toBeGreaterThan(0);
      });
      expect(terrainCommand.artifact.sourceRevision).toBe(1);
      terrainCommand.artifact.materialRanges.forEach((range, index, ranges) => {
        expect(range.startIndex).toBe(index === 0 ? 0 : ranges[index - 1]!.startIndex + ranges[index - 1]!.indexCount);
      });
      expect(source.body.dataset.hestiaPrototypeSeed).toBe("hestia-hvp-lagoon-001");
      expect(source.body.dataset.hestiaPrototypeSourceRevision).toBe("hvp-authored-coast-v3");
      expect(source.body.dataset.hestiaPrototypeSourceDigest).toMatch(/^[0-9a-f]{8}$/);
      const resources = JSON.parse(source.body.dataset.hestiaPrototypeResources!);
      const artifactTriangles = source.commands.reduce((count, command) =>
        count + (command.kind === "UpsertMeshArtifact" ? command.artifact.indices.length / 3 : 0), 0);
      expect(resources.ledger.triangles).toBe(artifactTriangles);
      expect(resources.ledger.gpuBytes).toBe("unsupported");
      expect(resources.ledger.totalCpuBytes).toBeLessThanOrEqual(resources.caps.maxCpuBytes);
      expect(resources.ledger.retainedMeshBytes).toBeLessThanOrEqual(resources.caps.maxMeshBytes);

      const waterCommand = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey === HVP_WATER_REPRESENTATION_KEY
      );
      expect(waterCommand).toBeDefined();
      if (waterCommand === undefined) return;
      expect(waterCommand.artifact.algorithmVersion).toBe("hvp-water-mask-v2");
      expect(new Set([...waterCommand.artifact.positions].filter((_value, index) => index % 3 === 1))).toEqual(new Set([0]));
      expect(waterCommand.materialProfiles).toHaveLength(1);
      expect([...waterCommand.artifact.normals].every((value, index) => value === (index % 3 === 1 ? 1 : 0))).toBe(true);
      expect(waterCommand.materialProfiles[0]).toMatchObject({
        id: "hvp:look:water",
        depthWrite: false
      });
      let waterArea = 0;
      const positions = waterCommand.artifact.positions;
      const indices = waterCommand.artifact.indices;
      for (let triangle = 0; triangle < indices.length; triangle += 3) {
        const ax = positions[indices[triangle]! * 3]!;
        const az = positions[indices[triangle]! * 3 + 2]!;
        const bx = positions[indices[triangle + 1]! * 3]!;
        const bz = positions[indices[triangle + 1]! * 3 + 2]!;
        const cx = positions[indices[triangle + 2]! * 3]!;
        const cz = positions[indices[triangle + 2]! * 3 + 2]!;
        waterArea += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
      }
      expect(waterArea).toBeGreaterThan(40);
      expect(waterArea).toBeLessThan(480 * 480);

      const joinCommand = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey === "hvp:join"
      );
      expect(joinCommand).toBeDefined();
      if (joinCommand === undefined) return;
      expect(joinCommand.artifact.algorithmVersion).toBe("hvp-coast-greedy-v3");
      expect(joinCommand.artifact.indices.length).toBeGreaterThan(600);
      expect(joinCommand.artifact.materialRanges).toHaveLength(4);
      expect(joinCommand.artifact.materialRanges.map((range) => range.materialProfileId)).toEqual([
        "hvp:look:limestone-dry",
        "hvp:look:limestone-wet",
        "hvp:look:soil",
        "hvp:look:moss"
      ]);

      const waterButton = source.body.children
        .flatMap((child) => [child, ...descendants(child)])
        .find((element) => element.id === "hvp-water-toggle");
      expect(waterButton).toBeDefined();
      waterButton?.dispatchEvent(new Event("click"));
      const visibilityPlans = source.commands.filter((command): command is Extract<RenderCommand, { kind: "ApplyVisibilityPlan" }> =>
        command.kind === "ApplyVisibilityPlan"
      );
      const hiddenWaterPlan = visibilityPlans.at(-1)?.plan;
      // Key sets are canonical ASCII-sorted by the visibility contract.
      expect(hiddenWaterPlan?.visibleRepresentationKeys).toEqual(["hvp:far", "hvp:join", HVP_TERRAIN_REPRESENTATION_KEY]);
      expect(hiddenWaterPlan?.hiddenRepresentationKeys).toEqual(["hvp:water"]);
      waterButton?.dispatchEvent(new Event("click"));
      const restoredPlan = source.commands.filter((command): command is Extract<RenderCommand, { kind: "ApplyVisibilityPlan" }> =>
        command.kind === "ApplyVisibilityPlan"
      ).at(-1)?.plan;
      expect(restoredPlan?.visibleRepresentationKeys).toEqual(
        expect.arrayContaining([HVP_TERRAIN_REPRESENTATION_KEY, HVP_WATER_REPRESENTATION_KEY, "hvp:join", "hvp:far"])
      );
      expect(restoredPlan?.hiddenRepresentationKeys).toEqual([]);
    } finally {
      await handle.dispose();
    }
  });

  it("fails closed when a look role is empty or its profile diverges from the role", () => {
    const look = createHvpLookProfile("readable");
    const sparseMesh: HvpBlockMesh = {
      faceCount: 1,
      outerFaceCount: 1,
      cavityFaceCount: 0,
      positions: new Float32Array([0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
      boundsMeters: { min: { x: 0, y: 1, z: 0 }, max: { x: 1, y: 1, z: 1 } },
      materialProfileId: HVP_TERRAIN_MATERIAL_ID
    };
    expect(() => createHvpLookTerrain(sparseMesh, look)).toThrow(/empty|four/i);

    const divergent = {
      ...look,
      materials: look.materials.map((material) => material.role === "moss"
        ? {
            ...material,
            materialProfile: Object.freeze({
              ...material.materialProfile,
              id: materialProfileId("hvp:look:soil")
            })
          }
        : material)
    };
    expect(() => createHvpLookTerrain(hvpMeshBlocks(
      hvpBuildCoastBlockCells(HVP_COAST_BLOCK_SIZE_METERS),
      HVP_COAST_BLOCK_SIZE_METERS,
      HVP_TERRAIN_MATERIAL_ID
    ), divergent)).toThrow(/diverg|profile/i);
  });

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

  it("never installs failure UI into a torn-down or newer mount", async () => {
    const source = harness();
    let rejectSource!: (error: Error) => void;
    const gate = new Promise<HvpCoastSourceSnapshot>((_resolve, reject) => {
      rejectSource = reject;
    });
    const pending = startHvp(source.overrides({
      createSourceSnapshot: () => gate
    }));

    source.windowPort.dispatchEvent(new Event("pagehide"));
    rejectSource(new Error("late source failure"));
    const handle = await pending;
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    expect(source.body.dataset.hestiaPrototypeState).toBeUndefined();
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(0);
    expect(descendants(source.body).filter((element) => element.getAttribute("role") === "alert")).toHaveLength(0);
    expect(source.counts().renders).toBe(0);
    expect(source.windowPort.animationFrames.size).toBe(0);
    await handle.dispose();

    const retry = await startHvp(source.overrides());
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await retry.dispose();
  }, 120_000);

  it("cancels a deferred source on pagehide without publishing products", async () => {
    const source = harness();
    const snapshot = materializeHvpCoastSource();
    let resolveSource!: (value: HvpCoastSourceSnapshot) => void;
    const gate = new Promise<HvpCoastSourceSnapshot>((resolve) => {
      resolveSource = resolve;
    });
    const pending = startHvp(source.overrides({
      createSourceSnapshot: () => gate
    }));

    expect(source.body.dataset.hestiaPrototypeState).toBe("Loading");
    source.windowPort.dispatchEvent(new Event("pagehide"));
    resolveSource(snapshot);
    const handle = await pending;
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    expect(source.body.dataset.hestiaPrototypeState).toBeUndefined();
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(0);
    expect(descendants(source.body).filter((element) => element.getAttribute("role") === "alert")).toHaveLength(0);
    expect(source.commands.filter((command) => command.kind === "UpsertMeshArtifact")).toHaveLength(0);
    expect(source.counts().renders).toBe(0);
    expect(source.windowPort.animationFrames.size).toBe(0);
    await handle.dispose();

    const retry = await startHvp(source.overrides());
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await retry.dispose();
  }, 120_000);

  it("does not let a late failure teardown wipe a newer mount", async () => {
    const source = harness();
    let rejectFirst!: (error: Error) => void;
    const gate = new Promise<HvpCoastSourceSnapshot>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const firstPending = startHvp(source.overrides({
      createSourceSnapshot: () => gate
    }));
    source.windowPort.dispatchEvent(new Event("pagehide"));
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    const second = await startHvp(source.overrides());
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");

    rejectFirst(new Error("late source failure"));
    const firstHandle = await firstPending;
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);
    expect(descendants(source.body).filter((element) => element.getAttribute("role") === "alert")).toHaveLength(0);
    await firstHandle.dispose();
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await second.dispose();
  }, 180_000);

  it("rejects over-cap scenes before attaching products or reaching Ready", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides({
      resourceCaps: { maxTriangles: 100 }
    }));

    expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(0);
    expect(source.commands.filter((command) => command.kind === "UpsertMeshArtifact")).toHaveLength(0);
    expect(source.counts().renders).toBe(0);
    expect(source.windowPort.animationFrames.size).toBe(0);
    await handle.dispose();

    const retry = await startHvp(source.overrides());
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await retry.dispose();
  }, 180_000);

  it("rejects malformed look ranges instead of falling back to vertex zero", () => {
    const look = createHvpLookProfile("readable");    const mesh = meshHvpTestCells(
      [
        { x: 0, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_DRY },
        { x: 1, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_WET },
        { x: 0, y: 0, z: 1, slot: HVP_SLOT_SOIL },
        { x: 1, y: 0, z: 1, slot: HVP_SLOT_MOSS }
      ],
      1
    );
    const grouped = createHvpCompactLookTerrain(mesh, look);
    expect(grouped.materialRanges).toHaveLength(4);
    const corrupt = {
      ...mesh,
      materialRanges: [{ slot: 1, startIndex: 999_999_999, indexCount: 6 }]
    };
    expect(() => createHvpCompactLookTerrain(corrupt, look)).toThrow();
  });

  it("groups partial proxy roles in order while strict mode still rejects them", () => {
    const look = createHvpLookProfile("readable");
    const partial = meshHvpTestCells(
      [
        { x: 0, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_DRY },
        { x: 1, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_WET }
      ],
      1
    );
    expect(() => createHvpCompactLookTerrain(partial, look)).toThrow(/empty/i);
    const grouped = createHvpCompactLookTerrain(partial, look, { allowPartialRoles: true });
    expect(grouped.materialRanges.map((range) => range.materialProfileId)).toEqual([
      "hvp:look:limestone-dry",
      "hvp:look:limestone-wet"
    ]);
    expect(grouped.materialRanges.reduce((total, range) => total + range.indexCount, 0))
      .toBe(grouped.indices.length);
    expect(grouped.materialProfiles.map((profile) => profile.id)).toEqual([
      "hvp:look:limestone-dry",
      "hvp:look:limestone-wet"
    ]);
  });

  it("exposes a real Inspect-only AO toggle defaulting to on", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());
    try {
      expect(source.body.dataset.hestiaPrototypeAo).toBe("on");
      const elements = source.body.children.flatMap((child) => [child, ...descendants(child)]);
      const aoButton = elements.find((element) => element.id === "hvp-ao-toggle");
      expect(aoButton?.textContent).toBe("AO: on");
      expect(aoButton?.getAttribute("aria-pressed")).toBe("true");
      const commandsBefore = source.commands.length;
      const terrainBefore = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact" && command.artifact.representationKey === HVP_TERRAIN_REPRESENTATION_KEY
      );
      const positionsBefore = terrainBefore === undefined ? [] : [...terrainBefore.artifact.positions];
      aoButton?.dispatchEvent(new Event("click"));
      expect(aoButton?.textContent).toBe("AO: off");
      expect(aoButton?.getAttribute("aria-pressed")).toBe("false");
      expect(source.body.dataset.hestiaPrototypeAo).toBe("off");
      aoButton?.dispatchEvent(new Event("click"));
      expect(aoButton?.textContent).toBe("AO: on");
      expect(source.body.dataset.hestiaPrototypeAo).toBe("on");
      // Render-only toggle: no new scene products, geometry bytes untouched.
      expect(source.commands.length).toBe(commandsBefore);
      const terrainAfter = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact" && command.artifact.representationKey === HVP_TERRAIN_REPRESENTATION_KEY
      );
      expect(terrainAfter === undefined ? [] : [...terrainAfter.artifact.positions]).toEqual(positionsBefore);
    } finally {
      await handle.dispose();
    }
  });

  it("swaps whole material arrays on toggle without mutating cached instances", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());
    try {
      const root = source.backend.representationRoot;
      const terrainNode = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
      terrainNode.name = `representation:${HVP_TERRAIN_REPRESENTATION_KEY}`;
      const originals = [...(Array.isArray(terrainNode.material) ? terrainNode.material : [terrainNode.material])];
      root.add(terrainNode);
      const elements = source.body.children.flatMap((child) => [child, ...descendants(child)]);
      const aoButton = elements.find((element) => element.id === "hvp-ao-toggle");
      aoButton?.dispatchEvent(new Event("click"));
      const offMaterials = Array.isArray(terrainNode.material) ? terrainNode.material : [terrainNode.material];
      expect(offMaterials).toHaveLength(4);
      expect(offMaterials).not.toEqual(originals);
      for (const material of offMaterials) {
        expect((material as { vertexColors?: boolean }).vertexColors).toBe(false);
      }
      aoButton?.dispatchEvent(new Event("click"));
      expect([...(Array.isArray(terrainNode.material) ? terrainNode.material : [terrainNode.material])]).toEqual(originals);
      root.remove(terrainNode);
    } finally {
      await handle.dispose();
    }
  });

  it("accounts exact ledger bytes from known inputs and rejects just below total", () => {
    const ledger = buildHvpResourceLedger({
      terrainMesh: {
          faceCount: 2,
          unitFaceCount: 2,
          outerFaceCount: 2,
          cavityFaceCount: 0,
          positions: new Float32Array(24),
          normals: new Float32Array(24),
          indices: new Uint16Array(12),
          colors: null,
          materialRanges: [{ slot: 1, startIndex: 0, indexCount: 12 }],
          boundsMeters: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
          sourceDigest: "00000000",
          algorithmVersion: "test-ledger-v1",
          tempEstimateBytes: 100
        },
        waterMesh: {
          faceCount: 1,
          unitFaceCount: 1,
          outerFaceCount: 1,
          cavityFaceCount: 0,
          positions: new Float32Array(12),
          normals: new Float32Array(12),
          indices: new Uint16Array(6),
          colors: null,
          materialRanges: [{ slot: 1, startIndex: 0, indexCount: 6 }],
          boundsMeters: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 0, z: 1 } },
          sourceDigest: "00000000",
          algorithmVersion: "test-ledger-v1",
          tempEstimateBytes: 50
        },
        joinMesh: {
          faceCount: 0,
          unitFaceCount: 0,
          outerFaceCount: 0,
          cavityFaceCount: 0,
          positions: new Float32Array(0),
          normals: new Float32Array(0),
          indices: new Uint16Array(0),
          colors: null,
          materialRanges: [],
          boundsMeters: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          sourceDigest: "00000000",
          algorithmVersion: "test-ledger-v1",
          tempEstimateBytes: 0
        },
        farMesh: {
          faceCount: 1,
          unitFaceCount: 1,
          outerFaceCount: 1,
          cavityFaceCount: 0,
          positions: new Float32Array(12),
          normals: new Float32Array(12),
          indices: new Uint16Array(6),
          colors: null,
          materialRanges: [{ slot: 1, startIndex: 0, indexCount: 6 }],
          boundsMeters: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 0, z: 1 } },
          sourceDigest: "00000000",
          algorithmVersion: "test-ledger-v1",
          tempEstimateBytes: 0
        },
        groupedIndexBytes: 48,
        drawCalls: 2
      });
      expect(ledger.meshBytes).toBe(
        (96 + 96 + 24) + 2 * (48 + 48 + 12)
      );
      // Far is dispatched through UpsertMeshArtifact too, not wrapped directly.
      expect(ledger.artifactCopyBytes).toBe((96 + 96 + 24) + 2 * (48 + 48 + 12));
      expect(ledger.maskBytes).toBe(256 * 256 + 320 * 320 + 960 * 960);
      expect(ledger.retainedMeshBytes).toBe(ledger.artifactCopyBytes);
      expect(ledger.triangles).toBe(4 + 2 + 2);
      expect(ledger.drawCalls).toBe(2);
      expect(ledger.gpuBytes).toBe("unsupported");
      expect(ledger.totalCpuBytes).toBe(
        ledger.slotBytes + ledger.preparedCopyBytes + ledger.maskBytes + ledger.meshBytes
        + ledger.groupedIndexBytes + ledger.artifactCopyBytes + ledger.tempEstimateBytes
      );
      expect(() => admitHvpResources(ledger, HVP_RESOURCE_CAPS_DEFAULT)).not.toThrow();
      expect(() => admitHvpResources(ledger, {
        ...HVP_RESOURCE_CAPS_DEFAULT,
        maxCpuBytes: ledger.totalCpuBytes - 1
      })).toThrow(/BudgetExceeded/);
      expect(() => admitHvpResources(ledger, {
        ...HVP_RESOURCE_CAPS_DEFAULT,
        maxTriangles: ledger.triangles - 1
      })).toThrow(/BudgetExceeded/);
      expect(() => admitHvpResources(ledger, {
        ...HVP_RESOURCE_CAPS_DEFAULT,
        maxMeshBytes: ledger.retainedMeshBytes - 1
      })).toThrow(/BudgetExceeded/);
  });

  it("never reaches Ready on an invalid source and stays fail-closed", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides({
      createSourceSnapshot: async () => ({
        version: "hvp-authored-coast-v999",
        seedName: "invalid-seed",
        registryDigest: "deadbeef",
        sourceDigest: "deadbeef",
        sizeX: 0,
        sizeY: 0,
        sizeZ: 0,
        cellMeters: 0.125,
        originMeters: { x: -16, y: -8, z: -16 },
        readSlot: () => 0,
        copySlots: () => new Uint8Array(0)
      })
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

  it("hides the leftover flight reticle on entry and restores it on dispose", async () => {
    const source = harness();
    const reticle = source.documentPort.querySelector(".hud-center-safe-area") as unknown as FakeElement;
    expect(reticle.getAttribute("style")).toBeNull();
    const handle = await startHvp(source.overrides());
    try {
      expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
      expect(reticle.getAttribute("style")).toContain("display:none");
    } finally {
      await handle.dispose();
    }
    expect(reticle.getAttribute("style")).toBeNull();
  });

  it("restores the flight reticle when the HVP start fails closed", async () => {
    const source = harness();
    const reticle = source.documentPort.querySelector(".hud-center-safe-area") as unknown as FakeElement;
    const handle = await startHvp(source.overrides({
      createBackend: () => ({ ...source.backend, scene: undefined })
    }));
    expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
    expect(reticle.getAttribute("style")).toBeNull();
    await handle.dispose();
  });

  it("exposes an accessible HUD hide control and a labeled camera inspection mode", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());
    try {
      const elements = source.body.children.flatMap((child) => [child, ...descendants(child)]);
      const hideButton = elements.find((element) => element.id === "hvp-hide-ui");
      const inspectButton = elements.find((element) => element.id === "hvp-camera-inspect");
      expect(hideButton?.textContent).toBe("Hide UI");
      expect(hideButton?.getAttribute("aria-pressed")).toBe("false");
      expect(inspectButton?.textContent).toBe("Inspect: off");
      expect(inspectButton?.getAttribute("aria-pressed")).toBe("false");
      const originalInspectStyle = inspectButton?.getAttribute("style");
      expect(originalInspectStyle).toBe("margin:6px 6px 0 0;pointer-events:auto");

      hideButton?.dispatchEvent(new Event("click"));
      expect(hideButton?.textContent).toBe("Show UI");
      expect(hideButton?.getAttribute("aria-pressed")).toBe("true");
      const statePanel = elements.find((element) => element.id === "hvp-state");
      expect(statePanel?.hasAttribute("hidden")).toBe(true);
      expect(inspectButton?.hasAttribute("hidden")).toBe(true);
      expect(inspectButton?.getAttribute("style")).toBe(originalInspectStyle);
      expect(hideButton?.hasAttribute("hidden")).toBe(false);
      hideButton?.dispatchEvent(new Event("click"));
      expect(hideButton?.textContent).toBe("Hide UI");
      expect(statePanel?.getAttribute("style")).toBeNull();
      expect(statePanel?.hasAttribute("hidden")).toBe(false);
      expect(inspectButton?.hasAttribute("hidden")).toBe(false);
      expect(inspectButton?.getAttribute("style")).toBe(originalInspectStyle);

      inspectButton?.dispatchEvent(new Event("click"));
      expect(inspectButton?.textContent).toBe("Inspect: on");
      expect(source.body.children.flatMap((child) => [child, ...descendants(child)])
        .find((element) => element.id === "hvp-mode")?.textContent).toContain("(Fly)");
      inspectButton?.dispatchEvent(new Event("click"));
      expect(inspectButton?.textContent).toBe("Inspect: off");
      expect(source.body.children.flatMap((child) => [child, ...descendants(child)])
        .find((element) => element.id === "hvp-mode")?.textContent).toContain("(Orbit)");
    } finally {
      await handle.dispose();
    }
  });
});
