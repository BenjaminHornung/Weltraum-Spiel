import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {HVP_BRANCH_CELLS,HVP_BRANCH_KEY} from "../../src/hestia-prototype/physics/profile";
import { backendRevision, materialProfileId, renderCommandResult, type RenderCommand } from "../../src/presentation";
import {
  HVP_COAST_BLOCK_SIZE_METERS,
  HVP_TERRAIN_MATERIAL_ID,
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
  estimateHvpColdCheckpointSourceBytes,
  estimateHvpStageCpuBytes,
  createHvpCompactLookTerrain,
  createHvpLookTerrain,
  HVP_RESOURCE_CAPS_DEFAULT,
  startHvp,
  startHvpRoute,
  type HvpBootstrapHandle
} from "../../src/hvp/hvpBootstrap";
import { createHvpLookProfile } from "../../src/hestia-prototype/presentation/look";
import * as cutTraceModule from "../../src/hestia-prototype/runtime/cutTrace";
import * as plasmaToolModule from "../../src/hestia-prototype/terrain/plasmaTool";
import * as playerInputModule from "../../src/hestia-prototype/player/input";
import * as terrainConsumerModule from "../../src/hestia-prototype/terrain/terrainConsumer";
import * as bodyConsumerModule from "../../src/hestia-prototype/terrain/bodyCutConsumer";
import * as structuralConsumerModule from "../../src/hestia-prototype/terrain/structuralConsumer";
import {ThreeRenderBackend} from "../../src/render/three/backend";

class FakeElement extends EventTarget {
  id = "";
  textContent = "";
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly style:Record<string,string>={};
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
    addEventListener: () => {}, removeEventListener: () => {},
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
  let recoveryHold = false;
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
    // Bootstrap lifecycle tests isolate transport; real Rapier/worker kernels
    // are verified separately, without allocating a second World per UI test.
     createPhysics: async (_sources: unknown, spawn: { x: number; y: number; z: number }) => ({
      collisionBytes: 0, workerCount: 1, update: () => {}, command: async () => {}, dispose: async () => {},
      setPlayerInput: () => {}, setCutAim:()=>{},impulse:async()=>{},
      preparation: { jobs: 95, peakParallelJobs: 1, mainPrepareMaxMs: 0 },
       read: () => ({ status: "Paused", terrainGeneration: 0, ticks: 0, backlogSeconds: 0, discardedSeconds: 0,
        gravity: 11.79, gravityProfile: "test-fixture", solver: "test-fixture", stepCpuMs: 0,
        bodyCount: 3, colliderCount: 5, nativeBytes: "unsupported", player: null,
        // Transport-only fixture: the real mass/solver contract has its own tests.
        inertia: {ownerId:"hvp:physics:inertia",sourceDigest:"test-fixture",centerOfMass:{x:71/240,y:71/240,z:.125}},lastImpulse:null,
         structural:{generation:0,sourceDigest:"test-fixture",state:recoveryHold?"RecoveryHold":"Idle",last:null,preview:null,aimPoint:spawn,
          attachment:{id:"hvp:branch:foliage",ownerId:HVP_BRANCH_KEY,supportCell:{x:10,y:11,z:2}},
          parts:[{ownerId:HVP_BRANCH_KEY,anchored:true,cells:HVP_BRANCH_CELLS,center:{x:.75,y:1,z:.25},position:spawn,orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},massKg:450,sleeping:true}]},
        bodies: [{ ownerId: "hvp:physics:drop", position: spawn, orientation: { x: 0, y: 0, z: 0, w: 1 },
          velocity: { x: 0, y: 0, z: 0 }, sleeping: true, massKg: 300 },
          {ownerId:"hvp:physics:inertia",position:spawn,orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},sleeping:true,massKg:35.15625},
          {ownerId:HVP_BRANCH_KEY,position:spawn,orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},sleeping:true,massKg:450}] })
    }),
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
    setRecoveryHold: (value: boolean) => { recoveryHold = value; },
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
  it("records measured cold Ready only after the first submitted scene frame",async()=>{
    const source=harness();Object.defineProperty(source.windowPort,"location",{value:{search:"?hvpMeasure=1"}});
    const measure=vi.spyOn(performance,"measure");let handle:Awaited<ReturnType<typeof startHvp>>|undefined;
    try{
      handle=await startHvp(source.overrides());
      const startupProjection=source.commands.filter(c=>c.kind==="ApplyFrameProjection");
      expect(startupProjection).toHaveLength(1);
      expect(startupProjection[0]!.snapshot.representationTransforms).toHaveLength(source.commands.filter(c=>c.kind==="UpsertMeshArtifact").length);
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.coldReadyMs")).toHaveLength(0);
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.startupBackendUpsertMs")).toHaveLength(source.commands.filter(c=>c.kind==="UpsertMeshArtifact").length);
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.startupProjectionMs")).toHaveLength(source.commands.filter(c=>c.kind==="ApplyFrameProjection").length);
      stepFrame(source.windowPort,performance.now());expect(source.counts().renders).toBe(1);
      expect(source.commands.filter(c=>c.kind==="ApplyFrameProjection").length).toBeGreaterThan(startupProjection.length);
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.coldReadyMs")).toHaveLength(1);
      stepFrame(source.windowPort,performance.now()+17);
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.coldReadyMs")).toHaveLength(1);
    }finally{await handle?.dispose();measure.mockRestore();}
  });
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
      const terrainCommands = source.commands.filter((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey.startsWith("hvp:terrain:s")
      );
      expect(terrainCommands).toHaveLength(16);
      expect(terrainCommands.map(c=>c.artifact.representationKey)).toEqual(Array.from({length:16},(_,i)=>`hvp:terrain:s${i}:r0`));
      const allIndices=terrainCommands.reduce((n,c)=>n+c.artifact.indices.length,0);
      expect(allIndices).toBeGreaterThan(6000);expect(allIndices/3).toBeLessThanOrEqual(500_000);
      expect(new Set(terrainCommands.flatMap(c=>c.artifact.materialRanges.map(r=>r.materialProfileId))))
        .toEqual(new Set(["hvp:look:limestone-dry","hvp:look:limestone-wet","hvp:look:soil","hvp:look:moss"]));
      for(const terrainCommand of terrainCommands) {
      expect(terrainCommand.artifact.algorithmVersion).toBe("hvp-terrain-sector-v1");
      expect(terrainCommand.artifact.indices.length % 6).toBe(0);
      expect(terrainCommand.artifact.materialRanges.reduce((total, range) => total + range.indexCount, 0))
        .toBe(terrainCommand.artifact.indices.length);
      terrainCommand.artifact.materialRanges.forEach((range) => {
        expect(range.indexCount).toBeGreaterThan(0);
      });
      expect(terrainCommand.artifact.sourceRevision).toBe(0);
      terrainCommand.artifact.materialRanges.forEach((range, index, ranges) => {
        expect(range.startIndex).toBe(index === 0 ? 0 : ranges[index - 1]!.startIndex + ranges[index - 1]!.indexCount);
      });
      }
      expect(source.body.dataset.hestiaPrototypeSeed).toBe("hestia-hvp-lagoon-001");
      expect(source.body.dataset.hestiaPrototypeSourceRevision).toBe("hvp-authored-coast-v5");
      expect(source.body.dataset.hestiaPrototypeSourceDigest).toMatch(/^[0-9a-f]{8}$/);
      const resources = JSON.parse(source.body.dataset.hestiaPrototypeResources!);
      const artifactTriangles = source.commands.reduce((count, command) =>
        count + (command.kind === "UpsertMeshArtifact" ? command.artifact.indices.length / 3 : 0), 0);
      // The presentation-only sky contributes 24 * 11 * 2 triangles, not a world artifact.
      expect(resources.ledger.triangles).toBe(artifactTriangles + 528);
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
      const publishedKeys = source.commands.flatMap((command) => command.kind === "UpsertMeshArtifact" ? [command.artifact.representationKey] : []).sort();
      expect(publishedKeys.filter((key) => key.startsWith("hvp:flora:") && key.endsWith(":wood"))).toHaveLength(4);
      expect(source.body.dataset.hestiaPrototypeVegetation).toBe("hvp-root-umbrella-v3");
      // Key sets are canonical ASCII-sorted by the visibility contract.
      expect(hiddenWaterPlan?.visibleRepresentationKeys).toEqual(publishedKeys.filter((key) => key !== HVP_WATER_REPRESENTATION_KEY));
      expect(hiddenWaterPlan?.hiddenRepresentationKeys).toEqual(["hvp:water"]);
      waterButton?.dispatchEvent(new Event("click"));
      const restoredPlan = source.commands.filter((command): command is Extract<RenderCommand, { kind: "ApplyVisibilityPlan" }> =>
        command.kind === "ApplyVisibilityPlan"
      ).at(-1)?.plan;
      expect(restoredPlan?.visibleRepresentationKeys).toEqual(publishedKeys);
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
      const terrainBefore = source.commands.filter((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact" && command.artifact.representationKey.startsWith("hvp:terrain:s")
      );
      expect(terrainBefore).toHaveLength(16);
      const positionsBefore = terrainBefore.map(c=>[...c.artifact.positions]);
      aoButton?.dispatchEvent(new Event("click"));
      expect(aoButton?.textContent).toBe("AO: off");
      expect(aoButton?.getAttribute("aria-pressed")).toBe("false");
      expect(source.body.dataset.hestiaPrototypeAo).toBe("off");
      aoButton?.dispatchEvent(new Event("click"));
      expect(aoButton?.textContent).toBe("AO: on");
      expect(source.body.dataset.hestiaPrototypeAo).toBe("on");
      // Render-only toggle: no new scene products, geometry bytes untouched.
      expect(source.commands.length).toBe(commandsBefore);
      const terrainAfter = source.commands.filter((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact" && command.artifact.representationKey.startsWith("hvp:terrain:s")
      );
      expect(terrainAfter.map(c=>[...c.artifact.positions])).toEqual(positionsBefore);
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
      const terrain = source.commands.find((c):c is Extract<RenderCommand,{kind:"UpsertMeshArtifact"}>=>c.kind==="UpsertMeshArtifact"&&c.artifact.representationKey.startsWith("hvp:terrain:s"))!;
      expect(terrain).toBeDefined();
      terrainNode.name = `representation:${terrain.artifact.representationKey}`;
      const originals = [...(Array.isArray(terrainNode.material) ? terrainNode.material : [terrainNode.material])];
      root.add(terrainNode);
      const woodNodes = source.commands.flatMap((command) => {
        if (command.kind !== "UpsertMeshArtifact" || !command.artifact.representationKey.endsWith(":wood")) { return []; }
        const material = new THREE.MeshBasicMaterial({vertexColors:true});
        const node = new THREE.Mesh(new THREE.BufferGeometry(), material);
        node.name = `representation:${command.artifact.representationKey}`;
        root.add(node);
        return [{node,material}];
      });
      expect(woodNodes).toHaveLength(4);
      const elements = source.body.children.flatMap((child) => [child, ...descendants(child)]);
      const aoButton = elements.find((element) => element.id === "hvp-ao-toggle");
      aoButton?.dispatchEvent(new Event("click"));
      const offMaterials = Array.isArray(terrainNode.material) ? terrainNode.material : [terrainNode.material];
      expect(offMaterials).toHaveLength(terrain.materialProfiles.length);
      expect(offMaterials).not.toEqual(originals);
      for (const material of offMaterials) {
        expect((material as { vertexColors?: boolean }).vertexColors).toBe(false);
      }
      for (const {node,material} of woodNodes) {
        const uncolored = node.material as unknown as THREE.MeshBasicMaterial[];
        expect(uncolored).toHaveLength(1);
        expect(uncolored[0]!.vertexColors).toBe(false);
        expect(uncolored[0]).not.toBe(material);
      }
      aoButton?.dispatchEvent(new Event("click"));
      expect([...(Array.isArray(terrainNode.material) ? terrainNode.material : [terrainNode.material])]).toEqual(originals);
      for (const {node,material} of woodNodes) {
        expect(node.material).toEqual([material]);
        root.remove(node);
        node.geometry.dispose();
        material.dispose();
      }
      root.remove(terrainNode);
      terrainNode.geometry.dispose();
      originals.forEach((material) => material.dispose());
    } finally {
      await handle.dispose();
    }
  });

  it("separates retired initial-build scratch from live replacement working memory without raising caps",()=>{
    const mib=1024*1024,before={totalCpuBytes:250*mib,tempEstimateBytes:150*mib},after={totalCpuBytes:251*mib,tempEstimateBytes:149*mib};
    const totalCpuBytes=estimateHvpStageCpuBytes(before,after,2*mib,96*mib);
    expect(totalCpuBytes).toBe(204*mib); // 102 retained + 6 old/new/index coexistence + 96 preparation.
    expect(()=>admitHvpResources({totalCpuBytes,retainedMeshBytes:30*mib,triangles:400_000,drawCalls:200})).not.toThrow();
    expect(()=>admitHvpResources({totalCpuBytes:estimateHvpStageCpuBytes(before,after,20*mib,96*mib),
      retainedMeshBytes:30*mib,triangles:400_000,drawCalls:200})).toThrow(/BudgetExceeded/);
    expect(HVP_RESOURCE_CAPS_DEFAULT.maxCpuBytes).toBe(256*mib);
  });

  it("cold checkpoint source accounting excludes the shared primary grid without a neighbor",()=>{
    expect(estimateHvpColdCheckpointSourceBytes(1234,567,false)).toBe(3_502);
  });

  it("cold checkpoint source accounting retains the neighbor primary grid",()=>{
    expect(estimateHvpColdCheckpointSourceBytes(1234,567,true)).toBe(8_392_110);
  });

  it("cold checkpoint source accounting has no extra bytes at zero inputs",()=>{
    expect(estimateHvpColdCheckpointSourceBytes(0,0,false)).toBe(0);
  });

  it("cold checkpoint ledger delta matches retained source ownership",()=>{
    const mesh=meshHvpTestCells([{x:0,y:0,z:0,slot:HVP_SLOT_LIMESTONE_DRY}],0.125);
    const input={terrainMesh:mesh,waterMesh:mesh,joinMesh:mesh,farMesh:mesh,groupedIndexBytes:0,drawCalls:0};
    const warm=buildHvpResourceLedger(input);
    const cold=buildHvpResourceLedger({...input,checkpointSourceBytes:estimateHvpColdCheckpointSourceBytes(1234,567,false)});
    expect(cold.totalCpuBytes-warm.totalCpuBytes).toBe(3_502);
    expect(cold.slotBytes).toBe(warm.slotBytes);
    expect(cold.preparedCopyBytes).toBe(warm.preparedCopyBytes);
    expect(HVP_RESOURCE_CAPS_DEFAULT.maxCpuBytes).toBe(256*1024*1024);
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

  it("rejects a World missing the planned inertia specimen before publishing meshes",async()=>{
    const source=harness();const options=source.overrides()!;
    const handle=await startHvp({...options,createPhysics:async(...args)=>{
      const client=await options.createPhysics!(...args);
      return {...client,read:()=>({...client.read(),inertia:null})};
    }});
    expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
    expect(source.commands.some(c=>c.kind==="UpsertMeshArtifact")).toBe(false);
    await handle.dispose();
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
  it("publishes save busy and rejection immediately without waiting for a render frame",async()=>{
    const source=harness(),handle=await startHvp(source.overrides());
    try{
      const save=source.body.children.flatMap(child=>[child,...descendants(child)]).find(e=>e.id==="hvp-save")!;
      expect(save).toBeDefined();save.dispatchEvent(new Event("click"));
      expect(JSON.parse(source.body.dataset.hestiaPrototypeSave!).state).toBe("Saving");
      // Transport fixture deliberately has no checkpoint method: exercise the
      // error boundary, not a fake successful persistence operation.
      await vi.waitFor(()=>expect(JSON.parse(source.body.dataset.hestiaPrototypeSave!).state).toBe("Rejected"));
      expect(source.counts().renders).toBe(0);
    }finally{await handle.dispose();}
  });

  it("C2B wires the real confirm, terrain trace, and accepted render callbacks", async () => {
    const source = harness();
    Object.defineProperty(source.windowPort, "location", { value: { search: "?hvpMeasure=1" } });
    const originalInput = playerInputModule.createHvpPlayerInput;
    const originalConsumer = terrainConsumerModule.createHvpTerrainConsumer;
    const originalObservation = cutTraceModule.createHvpCutObservation;
    let confirmCallback: (() => void) | undefined;
    let traceCallback: cutTraceModule.HvpCutTrace | undefined;
    let observerConfirm: ReturnType<typeof cutTraceModule.createHvpCutObservation>["confirm"] | undefined;
    let observerRender: ReturnType<typeof cutTraceModule.createHvpCutObservation>["render"] | undefined;
    const inputSpy = vi.spyOn(playerInputModule, "createHvpPlayerInput").mockImplementation((...args) => {
      confirmCallback = args[6]!.confirm;
      return originalInput(...args);
    });
    const consumerSpy = vi.spyOn(terrainConsumerModule, "createHvpTerrainConsumer").mockImplementation((...args) => {
      traceCallback = args[6];
      return originalConsumer(...args);
    });
    const observationSpy = vi.spyOn(cutTraceModule, "createHvpCutObservation").mockImplementation((...args) => {
      const observation = originalObservation(...args);
      observerConfirm = vi.spyOn(observation, "confirm");
      observerRender = vi.spyOn(observation, "render");
      return observation;
    });
    const handle = await startHvp(source.overrides());
    try {
      expect(inputSpy).toHaveBeenCalledOnce();
      expect(consumerSpy).toHaveBeenCalledOnce();
      expect(observationSpy).toHaveBeenCalledOnce();
      expect(traceCallback).toEqual(expect.any(Function));
      expect(confirmCallback).toEqual(expect.any(Function));
      confirmCallback!();
      expect(observerConfirm).toHaveBeenCalledOnce();
      stepFrame(source.windowPort, performance.now());
      expect(observerRender).toHaveBeenCalledOnce();
      expect(source.counts().renders).toBe(1);
    } finally {
      await handle.dispose();
      inputSpy.mockRestore();
      consumerSpy.mockRestore();
      observationSpy.mockRestore();
    }
  });

  it("C2B reports the controlled observation reservation separately from gameplay bytes", async () => {
    const source = harness();
    Object.defineProperty(source.windowPort, "location", { value: { search: "?hvpMeasure=1" } });
    const handle = await startHvp(source.overrides());
    try {
      const resources = JSON.parse(source.body.dataset.hestiaPrototypeResources!);
      expect(resources.gameplayCpuBytes).toBe(resources.ledger.totalCpuBytes);
      expect(resources.diagnosticReservedBytes).toBe(cutTraceModule.HVP_CUT_TRACE_RESERVE_BYTES);
      expect(resources.totalCpuBytes).toBe(resources.gameplayCpuBytes + resources.diagnosticReservedBytes);
      expect(resources.diagnosticRuntimeOverhead).toBe("not-measured");
      expect(resources.cutObservation.status).toBe("armed");
    } finally {
      await handle.dispose();
    }
  });

  it("C2B remains inert by default and preserves the original resource ledger", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());
    try {
      const resources = JSON.parse(source.body.dataset.hestiaPrototypeResources!);
      expect(resources.diagnosticReservedBytes).toBe(0);
      expect(resources.totalCpuBytes).toBe(resources.ledger.totalCpuBytes);
      expect(resources.cutObservation.status).toBe("not-requested");
    } finally {
      await handle.dispose();
    }
  });

  it("C2B does not allocate the observer when startup leaves less than its reserve", async () => {
    const baseline = harness();
    const baselineHandle = await startHvp(baseline.overrides());
    const gameplayCpuBytes = JSON.parse(baseline.body.dataset.hestiaPrototypeResources!).ledger.totalCpuBytes as number;
    await baselineHandle.dispose();

    const source = harness();
    Object.defineProperty(source.windowPort, "location", { value: { search: "?hvpMeasure=1" } });
    const factory = vi.spyOn(cutTraceModule, "createHvpCutObservation");
    const maxCpuBytes = gameplayCpuBytes + Math.floor(cutTraceModule.HVP_CUT_TRACE_RESERVE_BYTES / 2);
    const handle = await startHvp(source.overrides({ resourceCaps: { maxCpuBytes } }));
    try {
      const resources = JSON.parse(source.body.dataset.hestiaPrototypeResources!);
      expect(factory).not.toHaveBeenCalled();
      expect(resources.diagnosticReservedBytes).toBe(0);
      expect(resources.cutObservation.status).toBe("budget-disabled");
      expect(resources.cutObservation.disables).toBe(1);
    } finally {
      await handle.dispose();
      factory.mockRestore();
    }
  });

  it("C2B admits an exact-cap preview, releases diagnostics, and stays disabled after rollback", async () => {
    // Synthetic preview cells exercise the real resource admission, not a native cut.
    const cells = Array.from({ length: 512 }, (_, index) =>
      [2 * (index % 16), 64 + 2 * Math.floor(index / 16), 128] as const);
    const plasmaFactory = vi.spyOn(plasmaToolModule, "createHvpPlasmaTool");
    const consumerFactory = vi.spyOn(terrainConsumerModule, "createHvpTerrainConsumer");
    const bodyFactory = vi.spyOn(bodyConsumerModule, "createHvpBodyCutConsumer");
    const observerFactory = vi.spyOn(cutTraceModule, "createHvpCutObservation");
    let handle: HvpBootstrapHandle | undefined;
    try {
      const baseline = harness();
      handle = await startHvp(baseline.overrides());
      const baselineResources = JSON.parse(baseline.body.dataset.hestiaPrototypeResources!);
      plasmaFactory.mock.calls[0]![3](cells, true);
      const preview = baseline.commands.find(command => command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey.startsWith("hvp:tool:preview:"));
      if (preview?.kind !== "UpsertMeshArtifact") {
        throw new Error("The real preview callback did not submit its artifact");
      }
      const previewBytes = preview.artifact.positions.byteLength + preview.artifact.normals.byteLength
        + preview.artifact.indices.byteLength;
      const maxCpuBytes = baselineResources.gameplayCpuBytes + previewBytes * 3;
      expect(previewBytes * 3).toBeGreaterThan(cutTraceModule.HVP_CUT_TRACE_RESERVE_BYTES);
      expect(maxCpuBytes).toBeLessThanOrEqual(HVP_RESOURCE_CAPS_DEFAULT.maxCpuBytes);
      await handle.dispose();
      handle = undefined;
      expect(observerFactory).not.toHaveBeenCalled();

      const source = harness();
      Object.defineProperty(source.windowPort, "location", { value: { search: "?hvpMeasure=1" } });
      handle = await startHvp(source.overrides({ resourceCaps: { maxCpuBytes } }));
      expect(observerFactory).toHaveBeenCalledOnce();
      const observer = observerFactory.mock.results[0]!.value!;
      const consumer = consumerFactory.mock.results[1]!.value!;
      const disable = vi.spyOn(consumer, "disableTrace");
      const disableBody = vi.spyOn(bodyFactory.mock.results[1]!.value!, "disableTrace");
      const release = vi.spyOn(observer, "dispose");
      const render = vi.spyOn(observer, "render");
      try {
        const [root, , , showPreview, , structural] = plasmaFactory.mock.calls[1]!;
        const before = root.read();
        const initialResources = JSON.parse(source.body.dataset.hestiaPrototypeResources!);
        expect(initialResources.cutObservation.status).toBe("armed");
        observer.confirm(() => observer.trace({ commandId: "c2b-release", thread: "main", phase: "cutSubmittedMs",
          origin: performance.timeOrigin, start: performance.now(), duration: 0 }));
        expect(observer.read().inputCount).toBe(1);

        // Reject the original gameplay overrun before changing observation state.
        expect(() => showPreview([...cells, [200, 100, 128]], true)).toThrow(/CPU bytes exceed/);
        expect(release).not.toHaveBeenCalled();
        expect(disable).not.toHaveBeenCalled();
        expect(disableBody).not.toHaveBeenCalled();

        // The same production callback now admits exactly the measured payload cap.
        expect(() => showPreview(cells, true)).not.toThrow();
        const admitted = source.commands.find(command => command.kind === "UpsertMeshArtifact"
          && command.artifact.representationKey.startsWith("hvp:tool:preview:"));
        if (admitted?.kind !== "UpsertMeshArtifact") {
          throw new Error("The exact-cap preview was not submitted");
        }
        expect(initialResources.gameplayCpuBytes + 3 * (admitted.artifact.positions.byteLength
          + admitted.artifact.normals.byteLength + admitted.artifact.indices.byteLength)).toBe(maxCpuBytes);
        expect(release).toHaveBeenCalledOnce();
        expect(disable).toHaveBeenCalledOnce();
        expect(disableBody).toHaveBeenCalledOnce();
        expect(observer.read()).toMatchObject({ disposed: true, inputCount: 0, pendingRender: false, dropped: 1 });
        expect(root.read()).toBe(before);

        showPreview([cells[0]!], true);
        structural!.admit();
        // Exercise the existing scene-stage rollback without inventing native success.
        const stage = consumerFactory.mock.calls[1]![2];
        stage({ source: before, render: new Map(), collision: new Map() }).rollback();
        const restored = JSON.parse(source.body.dataset.hestiaPrototypeResources!);
        expect(restored.ledger).toEqual(initialResources.ledger);
        expect(restored.totalCpuBytes).toBe(restored.gameplayCpuBytes);
        expect(restored.diagnosticReservedBytes).toBe(0);
        expect(restored.cutObservation).toMatchObject({ status: "budget-disabled", drops: 1, disables: 1 });
        for (let index = 0; index < 15; index += 1) {
          stepFrame(source.windowPort, performance.now() + index);
        }
        const health = JSON.parse(source.body.dataset.hestiaPrototypeMeasurements!);
        expect(health.cutObservation).toMatchObject({ status: "budget-disabled", drops: 1, disables: 1 });
        expect(observerFactory).toHaveBeenCalledOnce();
        expect(release).toHaveBeenCalledOnce();
        expect(disable).toHaveBeenCalledOnce();
        expect(render).not.toHaveBeenCalled();
        expect(source.counts().renders).toBe(15);
        expect(root.read()).toBe(before);
        expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
      } finally {
        await handle.dispose();
        handle = undefined;
        disable.mockRestore();
        disableBody.mockRestore();
        release.mockRestore();
        render.mockRestore();
      }
    } finally {
      await handle?.dispose();
      plasmaFactory.mockRestore();
      consumerFactory.mockRestore();
      bodyFactory.mockRestore();
      observerFactory.mockRestore();
    }
  });

  it("P07 binds a body outcome to actual staged source, native receipt and Three projection",async()=>{
    // Real bootstrap/staging/Three projection; transport state is an explicit unit fixture, not a native-cut claim.
    const source=harness();Object.defineProperty(source.windowPort,"location",{value:{search:"?hvpMeasure=1"}});
    const overrides=source.overrides();
    if(!overrides?.createPhysics){throw new Error("Missing fixture physics factory");}
    const originalPhysics=overrides.createPhysics;
    let native!:ReturnType<Awaited<ReturnType<typeof originalPhysics>>["read"]>,backend!:ThreeRenderBackend;
    const createPhysics:typeof originalPhysics=async(...args)=>{
      const physics=await originalPhysics(...args);native=physics.read();
      Reflect.set(native,"moving",{state:"Idle",sequence:0,last:null,preview:null});Reflect.set(native,"terrainFragments",[]);
      return {...physics,read:()=>native};
    };
    const observerFactory=vi.spyOn(cutTraceModule,"createHvpCutObservation");
    const bodyFactory=vi.spyOn(bodyConsumerModule,"createHvpBodyCutConsumer");
    const terrainFactory=vi.spyOn(terrainConsumerModule,"createHvpTerrainConsumer");
    const structuralFactory=vi.spyOn(structuralConsumerModule,"createHvpStructuralConsumer");
    const measure=vi.spyOn(performance,"measure");let handle:HvpBootstrapHandle|undefined;
    try{
      handle=await startHvp(source.overrides({createPhysics,createBackend:(options:ConstructorParameters<typeof ThreeRenderBackend>[0])=>{
        backend=new ThreeRenderBackend({...options,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:()=>{}})});return backend;
      }}));
      const observer=observerFactory.mock.results[0]!.value!,readFrame=observerFactory.mock.calls[0]![1];
      const consumer=bodyFactory.mock.results[0]!.value!,stage=bodyFactory.mock.calls[0]![2],trace=bodyFactory.mock.calls[0]![3]!;
      expect(typeof trace).toBe("function");expect(()=>readFrame("not-applied")).toThrow(/confirmed native replacement/);
      const oldResidents=backend.readDiagnostics().residentRepresentationKeys;
      const oldVisible=backend.readDiagnostics().visibleRepresentationKeys;
      const oldLedger=JSON.parse(source.body.dataset.hestiaPrototypeResources!).ledger;
      // Replacing an A candidate may leave a tombstone even when native A is restored.
      // The next valid attempt at the same source revision must not reuse that render identity.
      const terrainStage=terrainFactory.mock.calls[0]![2];
      const originalRoot=terrainFactory.mock.calls[0]![0].read();
      const tile=meshHvpTestCells([{x:0,y:0,z:0,slot:HVP_SLOT_LIMESTONE_DRY}],.125,{ao:true});
      const tileProducts={source:{...originalRoot,revision:originalRoot.revision+1},render:new Map([[0,tile]]),collision:new Map()};
      terrainStage(tileProducts).rollback();
      expect(()=>terrainStage(tileProducts).rollback()).not.toThrow();
      const branchStage=structuralFactory.mock.calls[0]![1];
      const branchState={...native.structural!,attachment:{...native.structural!.attachment,ownerId:null}};
      branchStage(branchState).rollback();
      expect(()=>branchStage(branchState).rollback()).not.toThrow();
      expect(backend.readDiagnostics().residentRepresentationKeys).toEqual(oldResidents);
      expect(backend.readDiagnostics().visibleRepresentationKeys).toEqual(oldVisible);
      expect(JSON.parse(source.body.dataset.hestiaPrototypeResources!).ledger).toEqual(oldLedger);
      const ownerId=`hvp:body-fixture:${"x".repeat(110)}`,digest="fnv1a64-v1:0123456789abcdef",id="moving-cut-fixture";
      expect(ownerId).toHaveLength(127); // Valid canonical owner; render-only suffixes must not consume its ID budget.
      const mesh={...meshHvpTestCells([{x:0,y:0,z:0,slot:1}],.125,{ao:true}),sourceDigest:digest};
      const products={removedCells:1,removedMassKg:1,parts:[{ownerId,sourceDigest:digest,sourceBytes:1,
        center:{x:0,y:0,z:0},massKg:1,cells:[{x:0,y:0,z:0,materialId:1}],mesh}]};
      // Four earlier stages consumed tags 1–4. A separately owned native body
      // can legally have the would-be scene key of the next body candidate.
      const existingBodies=native.bodies,collidingOwner="hvp:fragment:stage5:p0";
      Reflect.set(native,"bodies",[...existingBodies,{...existingBodies[0]!,ownerId:collidingOwner}]);
      try{
        const first=stage(HVP_BRANCH_KEY,products);
        expect(backend.readDiagnostics().residentRepresentationKeys).not.toContain(collidingOwner);
        first.rollback();
      }finally{Reflect.set(native,"bodies",existingBodies);}
      expect(backend.readDiagnostics().residentRepresentationKeys).toEqual(oldResidents);
      expect(backend.readDiagnostics().visibleRepresentationKeys).toEqual(oldVisible);
      expect(JSON.parse(source.body.dataset.hestiaPrototypeResources!).ledger).toEqual(oldLedger);
      const pending=stage(HVP_BRANCH_KEY,products);
      const receipt={id,status:"Applied",parentId:HVP_BRANCH_KEY,children:[ownerId]};
      const pose={ownerId,position:{x:1.1,y:2.2,z:3.3},orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},sleeping:true,massKg:1};
      const childSource={ownerId,sourceDigest:digest};
      Reflect.set(native,"moving",{state:"Idle",sequence:1,last:receipt,preview:null});
      Reflect.set(native,"bodies",[...native.bodies.filter(body=>body.ownerId!==HVP_BRANCH_KEY),pose]);
      Reflect.set(native,"terrainFragments",[childSource]);
      Reflect.set(native,"structural",{...native.structural,parts:[],attachment:{...native.structural!.attachment,ownerId:null}});
      pending.publish();pending.finish();
      const outcome=Object.freeze({id,status:"Applied" as const,reason:"fixture finalized"}),read=consumer.read.bind(consumer);
      const consumerRead=vi.spyOn(consumer,"read").mockImplementation(()=>({...read(),last:outcome}));
      try{
        const facts=readFrame(id);expect(facts.body).toMatchObject({outcome,nativeSequence:1,receipt,
          children:[{ownerId,sourceDigest:digest}]});
        const childKey=facts.body?.children[0]?.renderKey;
        expect(childKey).toMatch(/^hvp:fragment:stage[0-9]+:p0$/);
        expect(facts.body).toMatchObject({activeKeys:[childKey],visibleKeys:[childKey]});
        observer.confirm(()=>trace({commandId:id,thread:"main",phase:"cutBodySubmittedMs",origin:performance.timeOrigin,start:performance.now(),duration:0}));
        trace({commandId:id,thread:"main",phase:"cutBodyTotalAppliedMs",origin:performance.timeOrigin,start:performance.now(),duration:0});
        expect(observer.read().pendingRender).toBe(true);stepFrame(source.windowPort,performance.now());
        expect(measure.mock.calls.filter(call=>call[0]==="hvp.cutBodyFirstCommittedRenderSubmitMs")).toHaveLength(1);
        const node=backend.representationRoot.getObjectByName(`representation:${childKey}`)!;
        const x=node.position.x;node.position.x+=1;expect(()=>readFrame(id)).toThrow(/projection mismatch/);node.position.x=x;
        childSource.sourceDigest="fnv1a64-v1:fedcba9876543210";expect(()=>readFrame(id)).toThrow(/source or generation mismatch/);childSource.sourceDigest=digest;
        receipt.status="CommittedHeld";expect(()=>readFrame(id)).toThrow(/confirmed native replacement/);receipt.status="Applied";
        const extra=new THREE.Object3D();extra.name=`representation:${HVP_BRANCH_KEY}`;backend.representationRoot.add(extra);
        observer.confirm(()=>trace({commandId:id,thread:"main",phase:"cutBodySubmittedMs",origin:performance.timeOrigin,start:performance.now(),duration:0}));
        trace({commandId:id,thread:"main",phase:"cutBodyTotalAppliedMs",origin:performance.timeOrigin,start:performance.now(),duration:0});
        expect(observer.read().pendingRender).toBe(false);backend.representationRoot.remove(extra);
      }finally{consumerRead.mockRestore();}
    }finally{await handle?.dispose();measure.mockRestore();observerFactory.mockRestore();bodyFactory.mockRestore();terrainFactory.mockRestore();structuralFactory.mockRestore();}
  });

  it("C2B bounds visible representation reads before the sentinel", async () => {
    const source = harness();
    Object.defineProperty(source.windowPort, "location", { value: { search: "?hvpMeasure=1" } });
    const originalFactory = cutTraceModule.createHvpCutObservation;
    let readFrame: (() => cutTraceModule.HvpCutRenderFacts) | undefined;
    const factory = vi.spyOn(cutTraceModule, "createHvpCutObservation").mockImplementation((sink, read) => {
      readFrame = read;
      return originalFactory(sink, read);
    });
    const handle = await startHvp(source.overrides());
    const root = source.backend.representationRoot;
    const injected: THREE.Object3D[] = [];
    const addSentinel = (): { readonly visited: () => boolean; readonly node: THREE.Object3D } => {
      let visited = false;
      const node = new THREE.Object3D();
      Object.defineProperty(node, "name", { configurable: true, get: () => { visited = true; return "sentinel"; } });
      root.add(node);
      injected.push(node);
      return { visited: () => visited, node };
    };
    const cleanupInjected = (): void => {
      root.remove(...injected);
      injected.length = 0;
    };
    try {
      expect(readFrame).toBeDefined();
      if (readFrame === undefined) return;

      for (let index = 0; index < 65; index += 1) {
        const node = new THREE.Object3D();
        node.name = `representation:hvp:terrain:s-c2b-overflow-${index}`;
        injected.push(node);
        root.add(node);
      }
      const overflowSentinel = addSentinel();
      expect(() => readFrame!()).toThrow(/overflow/);
      expect(overflowSentinel.visited()).toBe(false);
      cleanupInjected();

      const first = new THREE.Object3D();
      first.name = "representation:hvp:terrain:s-c2b-duplicate";
      root.add(first);
      injected.push(first);
      const duplicate = new THREE.Object3D();
      duplicate.name = first.name;
      root.add(duplicate);
      injected.push(duplicate);
      const duplicateSentinel = addSentinel();
      expect(() => readFrame!()).toThrow(/invalid/);
      expect(duplicateSentinel.visited()).toBe(false);
      cleanupInjected();

      const oversized = new THREE.Object3D();
      oversized.name = `representation:hvp:terrain:s${"x".repeat(257)}`;
      root.add(oversized);
      injected.push(oversized);
      const oversizedSentinel = addSentinel();
      expect(() => readFrame!()).toThrow(/overflow/);
      expect(oversizedSentinel.visited()).toBe(false);
    } finally {
      cleanupInjected();
      await handle.dispose();
      factory.mockRestore();
    }
  });

  it("C2B renders once and emits no committed marker when frame facts fail", async () => {
    const source = harness();
    Object.defineProperty(source.windowPort, "location", { value: { search: "?hvpMeasure=1" } });
    const originalFactory = cutTraceModule.createHvpCutObservation;
    let observer: ReturnType<typeof cutTraceModule.createHvpCutObservation> | undefined;
    let readFrame: (() => cutTraceModule.HvpCutRenderFacts) | undefined;
    const factory = vi.spyOn(cutTraceModule, "createHvpCutObservation").mockImplementation((sink, read) => {
      readFrame = read;
      observer = originalFactory(sink, read);
      return observer;
    });
    const measure = vi.spyOn(performance, "measure");
    const handle = await startHvp(source.overrides());
    const root = source.backend.representationRoot;
    const injected: THREE.Object3D[] = [];
    try {
      expect(observer).toBeDefined();
      expect(readFrame).toBeDefined();
      for (const key of readFrame!().activeTerrainKeys) {
        const node = new THREE.Object3D();
        node.name = `representation:${key}`;
        injected.push(node);
        root.add(node);
      }
      const span = { commandId: "c2b-invalid-frame", thread: "main" as const, origin: performance.timeOrigin, duration: 0 };
      observer!.confirm(() => observer!.trace({ ...span, phase: "cutSubmittedMs", start: performance.now() }));
      observer!.trace({ ...span, phase: "cutTotalAppliedMs", start: performance.now() });
      expect(observer!.read().pendingRender).toBe(true);
      const duplicate = new THREE.Object3D();
      duplicate.name = injected[0]!.name;
      root.add(duplicate);
      injected.push(duplicate);
      stepFrame(source.windowPort, performance.now());
      expect(source.counts().renders).toBe(1);
      expect(observer!.read().pendingRender).toBe(false);
      expect(observer!.read().dropped).toBeGreaterThan(0);
      expect(measure.mock.calls.some(([name]) => name === "hvp.cutFirstCommittedRenderSubmitMs")).toBe(false);
    } finally {
      root.remove(...injected);
      await handle.dispose();
      factory.mockRestore();
      measure.mockRestore();
    }
  });

  it("C2B preserves backend unavailable and thrown render results", async () => {
    const source = harness();
    Object.defineProperty(source.windowPort, "location", { value: { search: "?hvpMeasure=1" } });
    const originalFactory = cutTraceModule.createHvpCutObservation;
    let observer: ReturnType<typeof cutTraceModule.createHvpCutObservation> | undefined;
    const factory = vi.spyOn(cutTraceModule, "createHvpCutObservation").mockImplementation((sink, read) => {
      observer = originalFactory(sink, read);
      return observer;
    });
    const originalRender = source.backend.renderFrame;
    const handle = await startHvp(source.overrides());
    try {
      expect(observer).toBeDefined();
      const render = vi.spyOn(observer!, "render");
      try {
        const unavailable = renderCommandResult("BackendUnavailable");
        const backendRender = vi.fn(() => unavailable);
        source.backend.renderFrame = backendRender;
        stepFrame(source.windowPort, performance.now());
        expect(backendRender).toHaveBeenCalledOnce();
        expect(render.mock.results[0]!.value).toBe(unavailable);
        const original = new Error("C2B render failure");
        backendRender.mockImplementation(() => { throw original; });
        expect(() => stepFrame(source.windowPort, performance.now())).toThrow(original);
        expect(backendRender).toHaveBeenCalledTimes(2);
        expect(render.mock.results[1]!.value).toBe(original);
      } finally {
        render.mockRestore();
      }
    } finally {
      source.backend.renderFrame = originalRender;
      await handle.dispose();
      factory.mockRestore();
    }
  });

  it("C2B maps the native RecoveryHold fact into the observer frame", async () => {
    const source = harness();
    Object.defineProperty(source.windowPort, "location", { value: { search: "?hvpMeasure=1" } });
    const originalFactory = cutTraceModule.createHvpCutObservation;
    let readFrame: (() => cutTraceModule.HvpCutRenderFacts) | undefined;
    const factory = vi.spyOn(cutTraceModule, "createHvpCutObservation").mockImplementation((sink, read) => {
      readFrame = read;
      return originalFactory(sink, read);
    });
    const handle = await startHvp(source.overrides());
    try {
      expect(readFrame).toBeDefined();
      if (readFrame === undefined) return;
      source.setRecoveryHold(true);
      expect(readFrame().recoveryHold).toBe(true);
    } finally {
      await handle.dispose();
      factory.mockRestore();
    }
  });

  it("C2B delegates the real structural admission without re-arming", async () => {
    const source = harness();
    Object.defineProperty(source.windowPort, "location", { value: { search: "?hvpMeasure=1" } });
    const originalPlasma = plasmaToolModule.createHvpPlasmaTool;
    let structuralAdmit: (() => void) | undefined;
    const plasmaSpy = vi.spyOn(plasmaToolModule, "createHvpPlasmaTool").mockImplementation((...args) => {
      structuralAdmit = (args[5] as { admit?: () => void } | undefined)?.admit;
      return originalPlasma(...args);
    });
    const handle = await startHvp(source.overrides());
    try {
      expect(structuralAdmit).toEqual(expect.any(Function));
      const before = JSON.parse(source.body.dataset.hestiaPrototypeResources!);
      expect(before.cutObservation.status).toBe("armed");
      structuralAdmit!();
      for (let index = 0; index < 15; index += 1) {
        stepFrame(source.windowPort, performance.now() + index);
      }
      const health = JSON.parse(source.body.dataset.hestiaPrototypeMeasurements!);
      expect(health.cutObservation).toMatchObject({ status: "armed", disables: 0 });
      expect(JSON.parse(source.body.dataset.hestiaPrototypeResources!).diagnosticReservedBytes)
        .toBe(cutTraceModule.HVP_CUT_TRACE_RESERVE_BYTES);
    } finally {
      await handle.dispose();
      plasmaSpy.mockRestore();
    }
  });

  it("C2B preserves observer drops in live and disposed measurement health", async () => {
    const source = harness();
    Object.defineProperty(source.windowPort, "location", { value: { search: "?hvpMeasure=1" } });
    (source.windowPort as unknown as { confirm: () => boolean }).confirm = () => true;
    const originalFactory = cutTraceModule.createHvpCutObservation;
    let observer: ReturnType<typeof cutTraceModule.createHvpCutObservation> | undefined;
    const factory = vi.spyOn(cutTraceModule, "createHvpCutObservation").mockImplementation((sink, read) => {
      observer = originalFactory(sink, read);
      return observer;
    });
    const handle = await startHvp(source.overrides());
    try {
      expect(observer).toBeDefined();
      if (observer === undefined) return;
      const submitted = { commandId: "c2b-health", thread: "main" as const, phase: "cutSubmittedMs", origin: performance.timeOrigin, start: performance.now(), duration: 0 };
      observer.confirm(() => { observer!.trace(submitted); });
      for (let index = 0; index < 15; index += 1) {
        stepFrame(source.windowPort, performance.now() + index);
      }
      const live = JSON.parse(source.body.dataset.hestiaPrototypeMeasurements!);
      expect(live).toMatchObject({ enabled: true, samples: expect.any(Number), errors: expect.any(Number), dropped: expect.any(Number) });
      expect(live.cutObservation).toMatchObject({ status: "armed", drops: 0, disables: 0 });

      const end = source.body.children.flatMap((child) => [child, ...descendants(child)]).find((element) => element.id === "hvp-end-session");
      expect(end).toBeDefined();
      end?.dispatchEvent(new Event("click"));
      await vi.waitFor(() => expect(source.body.dataset.hestiaPrototypeDisposal).toBeDefined());
      const disposal = JSON.parse(source.body.dataset.hestiaPrototypeDisposal!);
      expect(disposal.measurementHealth).toMatchObject({ enabled: true, cutObservation: { status: "disposed" } });
      expect(disposal.measurementHealth.cutObservation.drops).toBe(observer.read().dropped);
      expect(disposal.measurementHealth.cutObservation.drops).toBeGreaterThan(0);
    } finally {
      await handle.dispose();
      factory.mockRestore();
    }
  });

});
