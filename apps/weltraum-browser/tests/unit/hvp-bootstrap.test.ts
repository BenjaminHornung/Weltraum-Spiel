import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { backendRevision, materialProfileId, renderCommandResult, type RenderCommand } from "../../src/presentation";
import {
  HVP_BLOCK_MESH_ALGORITHM_VERSION,
  HVP_COAST_BLOCK_SIZE_METERS,
  HVP_TERRAIN_MATERIAL_ID,
  HVP_TERRAIN_REPRESENTATION_KEY,
  HVP_WATER_REPRESENTATION_KEY,
  createHvpSession,
  type HvpBlockMesh,
  hvpBuildCoastBlockCells,
  hvpMeshBlocks
} from "../../src/hvp/hvpTerrain";
import {
  createHvpLookTerrain,
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
  it("binds the rendered look scene instead of only publishing dataset claims", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());

    try {
      const presentation = source.scene.getObjectByName("hvp-readable-coast-presentation");
      expect(presentation).toBeDefined();
      expect(source.scene.background).toBeInstanceOf(THREE.Color);
      expect((source.scene.background as THREE.Color).getHex()).toBe(0x081820);
      expect(source.scene.fog).toBeInstanceOf(THREE.Fog);
      expect((source.scene.fog as THREE.Fog).near).toBe(58);
      expect((source.scene.fog as THREE.Fog).far).toBe(150);
      expect(source.scene.getObjectByName("hvp-ambient-fill")).toBeInstanceOf(THREE.HemisphereLight);
      expect(source.scene.getObjectByName("hvp-sun-key")).toBeInstanceOf(THREE.DirectionalLight);
      expect(source.scene.getObjectByName("hvp-cool-fill")).toBeInstanceOf(THREE.DirectionalLight);

      const ground = source.scene.getObjectByName("hvp-distant-coast-ground-proxy");
      expect(ground).toBeInstanceOf(THREE.Mesh);
      expect(ground?.renderOrder).toBe(-2);
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

  it("proves the distant proxy is a raycastable render hit but never an edit target", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());

    try {
      const proxyGroup = source.scene.getObjectByName("hvp-distant-coast-proxy-noneditable");
      expect(proxyGroup).toBeInstanceOf(THREE.Group);
      expect(proxyGroup?.children).toHaveLength(4);
      const mound = proxyGroup?.children[1];
      expect(mound).toBeInstanceOf(THREE.Mesh);
      if (!(mound instanceof THREE.Mesh)) return;

      source.camera.updateProjectionMatrix();
      source.camera.updateMatrixWorld(true);
      mound.updateWorldMatrix(true, true);
      const center = mound.getWorldPosition(new THREE.Vector3());
      const projected = center.clone().project(source.camera);
      expect(projected.x).toBeGreaterThan(-1);
      expect(projected.x).toBeLessThan(1);
      expect(projected.y).toBeGreaterThan(-1);
      expect(projected.y).toBeLessThan(1);
      expect(projected.z).toBeLessThan(1);
      const ray = new THREE.Raycaster(source.camera.position, center.sub(source.camera.position).normalize());
      const hit = ray.intersectObject(mound, false)[0];
      expect(hit).toBeDefined();
      expect(hit?.object.userData.hvpRenderOnly).toBe(true);
      expect(hit?.object.userData.hvpEditable).toBe(false);
      expect((hit?.object as unknown as { readonly edit?: unknown } | undefined)?.edit).toBeUndefined();
      expect((handle as unknown as { readonly edit?: unknown }).edit).toBeUndefined();

      const ground = source.scene.getObjectByName("hvp-distant-coast-ground-proxy");
      expect(ground).toBeInstanceOf(THREE.Mesh);
      expect(ground?.userData.hvpRenderOnly).toBe(true);
      expect(ground?.userData.hvpEditable).toBe(false);
      expect((ground as unknown as { readonly edit?: unknown } | undefined)?.edit).toBeUndefined();
      ground?.updateWorldMatrix(true, true);
      const groundCenter = new THREE.Vector3(0, -7.75, 0);
      const groundRay = new THREE.Raycaster(source.camera.position, groundCenter.sub(source.camera.position).normalize());
      expect(groundRay.intersectObject(ground!, false)[0]).toBeDefined();
    } finally {
      await handle.dispose();
    }
  });

  it("keeps terrain geometry intact while grouping readable material ranges", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());
    try {
      const terrainCommand = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey === HVP_TERRAIN_REPRESENTATION_KEY
      );

      expect(terrainCommand).toBeDefined();
      if (terrainCommand === undefined) return;
      const original = hvpMeshBlocks(
        hvpBuildCoastBlockCells(HVP_COAST_BLOCK_SIZE_METERS),
        HVP_COAST_BLOCK_SIZE_METERS,
        HVP_TERRAIN_MATERIAL_ID
      );
      expect(terrainCommand.artifact.algorithmVersion).toBe(HVP_BLOCK_MESH_ALGORITHM_VERSION);
      expect([...terrainCommand.artifact.indices].sort((left, right) => left - right))
        .toEqual([...original.indices].sort((left, right) => left - right));
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
      expect(terrainCommand.materialProfiles.map((profile) => profile.id).sort()).toEqual([
        "hvp:look:limestone-dry",
        "hvp:look:limestone-wet",
        "hvp:look:moss",
        "hvp:look:soil"
      ]);
      expect(terrainCommand.artifact.sourceRevision).toBe(1);
      terrainCommand.artifact.materialRanges.forEach((range, index, ranges) => {
        expect(range.startIndex).toBe(index === 0 ? 0 : ranges[index - 1]!.startIndex + ranges[index - 1]!.indexCount);
      });

      const waterCommand = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey === HVP_WATER_REPRESENTATION_KEY
      );
      expect(waterCommand).toBeDefined();
      if (waterCommand === undefined) return;
      expect(new Set([...waterCommand.artifact.positions].filter((_value, index) => index % 3 === 1))).toEqual(new Set([0]));
      expect(waterCommand.materialProfiles).toHaveLength(1);
      expect(waterCommand.materialProfiles[0]).toMatchObject({
        id: "hvp:look:water",
        opacity: 0.62,
        depthWrite: false
      });

      const waterButton = source.body.children
        .flatMap((child) => [child, ...descendants(child)])
        .find((element) => element.id === "hvp-water-toggle");
      expect(waterButton).toBeDefined();
      waterButton?.dispatchEvent(new Event("click"));
      const visibilityPlans = source.commands.filter((command): command is Extract<RenderCommand, { kind: "ApplyVisibilityPlan" }> =>
        command.kind === "ApplyVisibilityPlan"
      );
      const hiddenWaterPlan = visibilityPlans.at(-1)?.plan;
      expect(hiddenWaterPlan?.visibleRepresentationKeys).toEqual([HVP_TERRAIN_REPRESENTATION_KEY]);
      expect(hiddenWaterPlan?.hiddenRepresentationKeys).toEqual(["hvp:water"]);
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
