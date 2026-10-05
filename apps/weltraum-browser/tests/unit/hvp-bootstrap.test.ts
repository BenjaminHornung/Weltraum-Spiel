import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {HVP_BRANCH_CELLS,HVP_BRANCH_KEY} from "../../src/hestia-prototype/physics/profile";
import { artifactRevision, backendRevision, createMaterialProfile, createMeshArtifact, createRenderCommand, frameId,
  materialProfileId, representationKey, renderCommandResult, sourceRevision, type RenderCommand, type RepresentationKey } from "../../src/presentation";
import * as presentationModule from "../../src/presentation";
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
  prepareHvpCoastSource,
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
import * as cameraModule from "../../src/hvp/hvpCamera";
import * as hudModule from "../../src/hvp/hvpHud";
import { createHvpLookProfile } from "../../src/hestia-prototype/presentation/look";
import * as cutTraceModule from "../../src/hestia-prototype/runtime/cutTrace";
import * as plasmaToolModule from "../../src/hestia-prototype/terrain/plasmaTool";
import * as playerInputModule from "../../src/hestia-prototype/player/input";
import * as terrainConsumerModule from "../../src/hestia-prototype/terrain/terrainConsumer";
import * as terrainProductsModule from "../../src/hestia-prototype/terrain/terrainProducts";
import * as neighborControllerModule from "../../src/hestia-prototype/runtime/neighborController";
import type {HvpNeighborStage} from "../../src/hestia-prototype/runtime/neighborController";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {buildHvpPlant,planHvpVegetation} from "../../src/hestia-prototype/presentation/vegetation";
import {encodeHvpPlant} from "../../src/hestia-prototype/persistence/plantCheckpoint";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {createHvpPhysicsSession,resolveHvpGravity} from "../../src/hestia-prototype/physics/session";
import {decodeHvpGame,encodeHvpGame} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import * as saveStoreModule from "../../src/hestia-prototype/persistence/saveStore";
import * as sceneReplacementModule from "../../src/hestia-prototype/persistence/sceneReplacement";
import * as dormancyControllerModule from "../../src/hestia-prototype/runtime/dormancyController";
import type {HvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {bindHvpSupportPlan} from "../../src/hestia-prototype/terrain/supportPlan";
import * as bodyConsumerModule from "../../src/hestia-prototype/terrain/bodyCutConsumer";
import {HvpRenderStageRecoveryError} from "../../src/hestia-prototype/presentation/renderStageRecovery";
import * as structuralConsumerModule from "../../src/hestia-prototype/terrain/structuralConsumer";
import * as structuralPartModule from "../../src/hestia-prototype/presentation/structuralPart";
import {ThreeRenderBackend} from "../../src/render/three/backend";
import {isHvpCutHealthFresh} from "../performance/hvpCutRtReport";

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

let k34LoadCheckpoint: ReturnType<typeof encodeHvpGame> | undefined;
const createK34LoadCheckpoint = async (): Promise<ReturnType<typeof encodeHvpGame>> => {
  if (k34LoadCheckpoint !== undefined) return k34LoadCheckpoint;
  const prepared = prepareHvpCoastSource(materializeHvpCoastSource());
  const root = createHvpTerrainRoot(prepared, "k34-load-fixture", 0);
  const session = await createHvpPhysicsSession([...collisionSectors(root.read())], { x: -9, y: 8, z: -9 }, resolveHvpGravity(),
    { spawn: { x: -9, y: 2.42, z: -11 }, coverage: [{ minX: -16, maxX: 16, minZ: -16, maxZ: 16 }] },
    { x: -9, y: 8, z: -13 }, { x: -12, y: 5, z: -13.5 }, "k34-load-fixture");
  try {
    session.pause();
    k34LoadCheckpoint = encodeHvpGame({
      terrain: root.checkpoint(),
      plants: planHvpVegetation().map(buildHvpPlant).map(encodeHvpPlant),
      world: session.checkpoint(),
      progress: null,
      receipts: {
        terrain: { version: "hvp-command-receipts-v1", kind: "terrain", entries: [], last: null },
        structural: { version: "hvp-command-receipts-v1", kind: "structural", entries: [], last: null },
        moving: { version: "hvp-command-receipts-v1", kind: "moving", entries: [], last: null }
      },
      view: {
        camera: { mode: "Orbit", preset: "C04-WIDE", fov: 55, position: { x: -24, y: 18, z: -28 }, target: { x: 0, y: 1, z: 1 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } },
        playerYaw: Math.PI, playerPitch: 0, thirdPerson: true, waterEnabled: true, aoEnabled: true,
        tool: { mode: 2, sequence: 1, structureSequence: 0, movingSequence: 0, edges: 1 }
      }
    });
    return k34LoadCheckpoint;
  } finally {
    session.dispose();
  }
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
  it("keeps HUD inspection state tied to the real camera across presets reset Play and restored modes", async () => {
    const source = harness();
    const createCamera = cameraModule.createHvpCamera;
    const createHud = hudModule.createHvpHud;
    const createPhysics = source.overrides()!.createPhysics!;
    let camera: ReturnType<typeof createCamera> | undefined;
    let hud: ReturnType<typeof createHud> | undefined;
    let actions: Parameters<typeof createHud>[0]["actions"] | undefined;
    const cameraSpy = vi.spyOn(cameraModule, "createHvpCamera").mockImplementation((...args) => {
      camera = createCamera(...args);
      return camera;
    });
    const hudSpy = vi.spyOn(hudModule, "createHvpHud").mockImplementation((options) => {
      actions = options.actions;
      hud = createHud(options);
      return hud;
    });
    let handle: HvpBootstrapHandle | undefined;
    try {
      handle = await startHvp(source.overrides({
        createPhysics: async (...args: Parameters<typeof createPhysics>) => {
          const physics = await createPhysics(...args);
          const read = physics.read;
          // Transport-only Inspection sample; Camera and HUD remain real.
          return { ...physics, read: () => ({ ...read(), player: {
            ownerId: "hvp:player", position: { ...args[1] }, grounded: true,
            velocityY: 0, jumpCount: 0, cameraFraction: 1, status: "Inspection" as const
          } }) };
        }
      }));
      expect(cameraSpy).toHaveBeenCalledOnce();
      expect(hudSpy).toHaveBeenCalledOnce();
      const owner = camera!;
      const actualHud = hud!;
      const hudActions = actions!;
      const elements = source.body.children.flatMap((child) => [child, ...descendants(child)]);
      const inspect = elements.find((element) => element.id === "hvp-camera-inspect")!;
      const root = elements.find((element) => element.id === "hvp-hud")!;
      const mode = elements.find((element) => element.id === "hvp-mode")!;
      expect(owner.mode).toBe("Orbit");
      expect(hudActions.readInspectEnabled()).toBe(false);
      expect(inspect.textContent).toBe("Inspect: off");
      expect(inspect.getAttribute("aria-pressed")).toBe("false");
      expect(root.dataset.inspect).toBe("off");
      expect(mode.textContent).toContain("(Orbit)");
      expect(hudActions.readPhysics().player?.status).toBe("Inspection");
      const updates = vi.spyOn(actualHud, "update");
      try {
        for (const id of ["hvp-camera-eye", "hvp-camera-shore", "hvp-camera-roots", "hvp-camera-wide",
          "hvp-camera-rockarm", "hvp-camera-quarry", "hvp-reset-camera"]) {
          inspect.dispatchEvent(new Event("click"));
          expect(owner.mode).toBe("Fly");
          expect(hudActions.readInspectEnabled()).toBe(true);
          expect(inspect.textContent).toBe("Inspect: on");
          expect(inspect.getAttribute("aria-pressed")).toBe("true");
          expect(root.dataset.inspect).toBe("on");
          expect(mode.textContent).toContain("(Fly)");
          elements.find((element) => element.id === id)!.dispatchEvent(new Event("click"));
          expect(owner.mode).toBe("Orbit");
          expect(hudActions.readInspectEnabled()).toBe(false);
          expect(inspect.textContent).toBe("Inspect: off");
          expect(inspect.getAttribute("aria-pressed")).toBe("false");
          expect(root.dataset.inspect).toBe("off");
          expect(mode.textContent).toContain("(Orbit)");
          stepFrame(source.windowPort, performance.now());
          expect(owner.mode).toBe("Orbit");
          expect(hudActions.readInspectEnabled()).toBe(false);
          expect(inspect.textContent).toBe("Inspect: off");
          expect(inspect.getAttribute("aria-pressed")).toBe("false");
          expect(root.dataset.inspect).toBe("off");
          expect(mode.textContent).toContain("(Orbit)");
          inspect.dispatchEvent(new Event("click"));
          expect(owner.mode).toBe("Fly");
          expect(hudActions.readInspectEnabled()).toBe(true);
          expect(inspect.textContent).toBe("Inspect: on");
          inspect.dispatchEvent(new Event("click"));
          expect(owner.mode).toBe("Orbit");
          expect(hudActions.readInspectEnabled()).toBe(false);
          expect(inspect.textContent).toBe("Inspect: off");
        }

        inspect.dispatchEvent(new Event("click"));
        expect(owner.mode).toBe("Fly");
        expect(inspect.textContent).toBe("Inspect: on");
        // Real Play action, not a Native walking or pointer-lock proof.
        elements.find((element) => element.id === "hvp-play")!.dispatchEvent(new Event("click"));
        expect(owner.mode).toBe("Orbit");
        expect(hudActions.readInspectEnabled()).toBe(false);
        expect(inspect.textContent).toBe("Inspect: off");
        expect(inspect.getAttribute("aria-pressed")).toBe("false");
        expect(root.dataset.inspect).toBe("off");
        expect(mode.textContent).toContain("(Orbit)");

        const orbit = owner.checkpoint();
        expect(orbit.mode).toBe("Orbit");
        inspect.dispatchEvent(new Event("click"));
        const fly = owner.checkpoint();
        expect(fly.mode).toBe("Fly");
        // Owner Camera + real HUD only; no Save/Load or native Restore fixture.
        for (const [checkpoint, expectedMode, enabled, text, pressed, dataset] of [
          [orbit, "Orbit", false, "Inspect: off", "false", "off"],
          [fly, "Fly", true, "Inspect: on", "true", "on"]
        ] as const) {
          owner.setMode(expectedMode === "Orbit" ? "Fly" : "Orbit");
          owner.restore(checkpoint);
          const projected = updates.mock.calls.at(-1)!;
          actualHud.update(projected[0], owner.readPose(), projected[2], projected[3]);
          expect(owner.mode).toBe(expectedMode);
          expect(hudActions.readInspectEnabled()).toBe(enabled);
          expect(inspect.textContent).toBe(text);
          expect(inspect.getAttribute("aria-pressed")).toBe(pressed);
          expect(root.dataset.inspect).toBe(dataset);
          expect(mode.textContent).toContain(`(${expectedMode})`);
          stepFrame(source.windowPort, performance.now());
          expect(owner.mode).toBe(expectedMode);
          expect(hudActions.readInspectEnabled()).toBe(enabled);
          expect(inspect.textContent).toBe(text);
          expect(inspect.getAttribute("aria-pressed")).toBe(pressed);
          expect(root.dataset.inspect).toBe(dataset);
          expect(mode.textContent).toContain(`(${expectedMode})`);
          inspect.dispatchEvent(new Event("click"));
          expect(owner.mode).toBe(expectedMode === "Orbit" ? "Fly" : "Orbit");
          expect(hudActions.readInspectEnabled()).toBe(!enabled);
          expect(inspect.textContent).toBe(enabled ? "Inspect: off" : "Inspect: on");
          expect(inspect.getAttribute("aria-pressed")).toBe(enabled ? "false" : "true");
          expect(root.dataset.inspect).toBe(enabled ? "off" : "on");
          expect(mode.textContent).toContain(enabled ? "(Orbit)" : "(Fly)");
        }
      } finally {
        updates.mockRestore();
      }
    } finally {
      try {
        await handle?.dispose();
      } finally {
        cameraSpy.mockRestore();
        hudSpy.mockRestore();
      }
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
        const previews=source.commands.filter((command):command is Extract<RenderCommand,{kind:"UpsertMeshArtifact"}>=>
          command.kind==="UpsertMeshArtifact"&&command.artifact.representationKey.startsWith("hvp:tool:preview:"));
        expect(previews).toHaveLength(2);
        expect(previews[0]!.artifact.representationKey).toMatch(/^hvp:tool:preview:e0~[1-9][0-9]*$/);
        expect(source.commands.some(command=>command.kind==="RemoveRepresentation"
          &&command.representationKey===previews[0]!.artifact.representationKey)).toBe(true);
        const currentPreviewKey=previews[1]!.artifact.representationKey;
        showPreview([],false);
        expect(source.commands.some(command=>command.kind==="RemoveRepresentation"&&command.representationKey===currentPreviewKey)).toBe(false);
        expect(source.commands.some(command=>command.kind==="CancelEphemeralRepresentation"&&command.representationKey===currentPreviewKey)).toBe(false);
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
         expect(childKey).toMatch(/^hvp:fragment:e0~[1-9][0-9]*$/);
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

  it("V3-01 exposes the already validated support phase numbers without forging worker start times",async()=>{
    const source=harness();Object.defineProperty(source.windowPort,"location",{value:{search:"?hvpMeasure=1"}});
    const originalFactory=terrainProductsModule.createHvpTerrainCompiler;
    const compilerFactory=vi.spyOn(terrainProductsModule,"createHvpTerrainCompiler").mockImplementation(()=>{
      const compiler=originalFactory();
      vi.spyOn(compiler,"analyze").mockImplementation(async plan=>bindHvpSupportPlan(plan,{
        status:"Ready",reason:"",probes:0,anchoredWitnesses:0,fragments:[],workingBytes:0,
        timings:{seedsMs:1,supportMs:2,ingestMs:3,recipeMs:4,totalMs:10,fragmentCount:0,fragmentCells:0,
          recipeBreakdown:{massMs:.5,classifyMs:.5,transitionMs:2,axesMs:1}}
      }));
      return compiler;
    });
    const terrainFactory=vi.spyOn(terrainConsumerModule,"createHvpTerrainConsumer");
    const measurement=vi.spyOn(performance,"measure");let handle:HvpBootstrapHandle|undefined;
    try{
      handle=await startHvp(source.overrides());
      const root=terrainFactory.mock.calls[0]![0],before=root.read();
      const plan=root.prepare({sessionId:before.sessionId,epoch:before.epoch,revision:before.revision,
        sourceDigest:before.sourceDigest,commandId:"v3-support-breakdown",toolPolicy:"hvp-plasma-v1",
        shape:{kind:"Box",min:[40,80,40],max:[41,81,41]}});
      const analyze=terrainFactory.mock.calls[0]![5];
      if(!analyze){throw new Error("Missing actual support-analysis callback");}
      expect((await analyze(plan)).timings?.totalMs).toBe(10);
      const recorded=measurement.mock.calls.filter(([name])=>name==="hvp.cutSupportPhasesMs");
      expect(recorded).toHaveLength(1);
      expect(recorded[0]![1]).toMatchObject({duration:0,detail:{data:{commandId:plan.request.commandId,
        thread:"support",timings:{seedsMs:1,supportMs:2,ingestMs:3,recipeMs:4,totalMs:10,fragmentCount:0,fragmentCells:0}}}});
    }finally{await handle?.dispose();measurement.mockRestore();terrainFactory.mockRestore();compilerFactory.mockRestore();}
  });

  it("V3-00 keeps an occupied native fragment representation through terrain staging and rollback",async()=>{
    // Cold-style owner/name collision in a real Three backend; native state is
    // an explicit unit fixture, not a claim of a successful cold restore.
    const source=harness(),overrides=source.overrides();
    if(!overrides?.createPhysics){throw new Error("Missing fixture physics factory");}
    const originalPhysics=overrides.createPhysics;
    let native!:ReturnType<Awaited<ReturnType<typeof originalPhysics>>["read"]>,backend!:ThreeRenderBackend;
    const createPhysics:typeof originalPhysics=async(...args)=>{
      const physics=await originalPhysics(...args);native=physics.read();
      return {...physics,read:()=>native};
    };
    const factory=vi.spyOn(terrainConsumerModule,"createHvpTerrainConsumer");
    let handle:HvpBootstrapHandle|undefined;
    try{
      handle=await startHvp(source.overrides({createPhysics,createBackend:(options:ConstructorParameters<typeof ThreeRenderBackend>[0])=>{
        backend=new ThreeRenderBackend({...options,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:()=>{}})});
        return backend;
      }}));
      const ownerId="hvp:terrain-fragment:r1:12345678",residentKey=`${ownerId}:stage1`;
      const residentMesh=meshHvpTestCells([{x:0,y:0,z:0,slot:HVP_SLOT_LIMESTONE_DRY}],.125,{ao:true});
      const material=createMaterialProfile({id:materialProfileId("hvp:v3:resident"),kind:"BasicLit",
        baseColor:{r:.5,g:.5,b:.5},opacity:1,doubleSided:false,wireframe:false,depthWrite:true});
      const resident=createMeshArtifact({representationKey:representationKey(residentKey),frameId:frameId("hvp:coast-frame"),
        sourceRevision:sourceRevision(0),artifactRevision:artifactRevision(0),algorithmVersion:residentMesh.algorithmVersion,
        positions:residentMesh.positions,normals:residentMesh.normals,indices:residentMesh.indices,
        attributes:{color:residentMesh.colors!},bounds:residentMesh.boundsMeters,
        materialRanges:[{materialProfileId:material.id,startIndex:0,indexCount:residentMesh.indices.length}]});
      expect(backend.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),
        artifact:resident,materialProfiles:[material]})).status).toBe("Accepted");
      const originalNode=backend.representationRoot.getObjectByName(`representation:${residentKey}`);
      expect(originalNode).toBeInstanceOf(THREE.Mesh);
      Reflect.set(native,"bodies",[...native.bodies,{...native.bodies[0]!,ownerId:residentKey}]);
      const root=factory.mock.calls[0]![0].read(),stage=factory.mock.calls[0]![2];
      const fragment={request:{ownerId,origin:{x:0,y:0,z:0},massKg:1,
        cells:[{x:0,y:0,z:0,materialId:1}],colliderBoxes:[{min:[0,0,0] as const,max:[1,1,1] as const}]},
        state:{ownerId,sourceDigest:"fnv1a64-v1:0123456789abcdef",centerOfMass:{x:0,y:0,z:0},cellCount:1,
          massKg:1,colliders:1,sourceBytes:4096}};
      const candidate=stage({source:{...root,revision:root.revision+1},render:new Map(),collision:new Map()},[fragment]);
      expect(backend.representationRoot.getObjectByName(`representation:${residentKey}`)).toBe(originalNode);
       const fragmentKey=backend.readDiagnostics().residentRepresentationKeys.find(key=>/^hvp:fragment:e0~[1-9][0-9]*$/.test(key));
       expect(fragmentKey).toBeDefined();
      candidate.rollback();
      expect(backend.representationRoot.getObjectByName(`representation:${residentKey}`)).toBe(originalNode);
      expect(backend.readDiagnostics().residentRepresentationKeys).toContain(residentKey);
    }finally{await handle?.dispose();factory.mockRestore();}
  });

  it.each(["body-foliage-parked","body-foliage-product-alias","structural-branch"] as const)("V3-05 keeps a restored owner representation during %s staging",async scenario=>{
    // Native owner facts are an explicit unit fixture; only ThreeRenderBackend is real here.
    const source=harness(),overrides=source.overrides();
    if(!overrides?.createPhysics){throw new Error("Missing fixture physics factory");}
    const originalPhysics=overrides.createPhysics;
    let native!:ReturnType<Awaited<ReturnType<typeof originalPhysics>>["read"]>,backend!:ThreeRenderBackend;
    const createPhysics:typeof originalPhysics=async(...args)=>{
      const physics=await originalPhysics(...args);native=physics.read();return {...physics,read:()=>native};
    };
    const bodyFactory=vi.spyOn(bodyConsumerModule,"createHvpBodyCutConsumer");
    const structuralFactory=vi.spyOn(structuralConsumerModule,"createHvpStructuralConsumer");
    let handle:HvpBootstrapHandle|undefined;
    try{
      handle=await startHvp(source.overrides({createPhysics,createBackend:(options:ConstructorParameters<typeof ThreeRenderBackend>[0])=>{
        backend=new ThreeRenderBackend({...options,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:()=>{}})});
        return backend;
      }}));
      const residentMesh=meshHvpTestCells([{x:0,y:0,z:0,slot:HVP_SLOT_LIMESTONE_DRY}],.125,{ao:true});
       let residentKey:string,stageCandidate!:()=>{rollback():void},expectedStageCount:number;
      let bodyStage:Parameters<typeof bodyConsumerModule.createHvpBodyCutConsumer>[2]|undefined;
      if(scenario.startsWith("body-foliage")){
        residentKey="hvp:branch:foliage:body-r1-0:stage1";
        Reflect.set(native,"moving",{state:"Idle",sequence:0,last:null,preview:null});
        if(scenario==="body-foliage-parked"){
          Reflect.set(native,"parked",[{ownerId:residentKey,position:native.bodies[0]!.position,residency:"Checkpointed"}]);
        }
        bodyStage=bodyFactory.mock.calls[0]![2];
        if(!bodyStage){throw new Error("Missing body presentation stage");}
        const digest="fnv1a64-v1:0123456789abcdef";
        const mesh={...residentMesh,sourceDigest:digest};
        const products={removedCells:1,removedMassKg:1,parts:[{ownerId:scenario==="body-foliage-product-alias"?residentKey:"hvp:body-v3-child",sourceDigest:digest,sourceBytes:4096,
          center:{x:0,y:0,z:0},massKg:1,cells:[{x:10,y:11,z:2,materialId:1}],mesh}]};
        stageCandidate=()=>bodyStage!(HVP_BRANCH_KEY,products);
         expectedStageCount=2;
      }else{
        const branchOwner=`hvp:branch:${"x".repeat(117)}`;
        residentKey="hvp:branch:stage1:p0";
        expect(branchOwner).toHaveLength(128);
        Reflect.set(native,"bodies",[...native.bodies,{...native.bodies[0]!,ownerId:residentKey}]);
        const initial=native.structural;
        if(!initial){throw new Error("Missing fixture branch snapshot");}
        const state={...initial,parts:initial.parts.map((part,index)=>index===0?{...part,ownerId:branchOwner}:part),
          attachment:{...initial.attachment,ownerId:branchOwner}};
        const branchStage=structuralFactory.mock.calls[0]![1];
        if(!branchStage){throw new Error("Missing structural presentation stage");}
        stageCandidate=()=>branchStage(state);
         expectedStageCount=2;
      }
      const profile=createMaterialProfile({id:materialProfileId("hvp:v3:resident"),kind:"BasicLit",
        baseColor:{r:.5,g:.5,b:.5},opacity:1,doubleSided:false,wireframe:false,depthWrite:true});
      const resident=createMeshArtifact({representationKey:representationKey(residentKey),frameId:frameId("hvp:coast-frame"),
        sourceRevision:sourceRevision(0),artifactRevision:artifactRevision(0),algorithmVersion:residentMesh.algorithmVersion,
        positions:residentMesh.positions,normals:residentMesh.normals,indices:residentMesh.indices,
        attributes:{color:residentMesh.colors!},bounds:residentMesh.boundsMeters,
        materialRanges:[{materialProfileId:profile.id,startIndex:0,indexCount:residentMesh.indices.length}]});
      expect(backend.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),
        artifact:resident,materialProfiles:[profile]})).status).toBe("Accepted");
      const originalNode=backend.representationRoot.getObjectByName(`representation:${residentKey}`);
      expect(originalNode).toBeInstanceOf(THREE.Mesh);
      if(!(originalNode instanceof THREE.Mesh)){throw new Error("Missing real resident Three mesh");}
      const originalGeometry=originalNode.geometry,originalPositions=Array.from(originalGeometry.getAttribute("position").array),
        originalIndices=originalGeometry.index===null?null:Array.from(originalGeometry.index.array),originalPose={
          position:originalNode.position.toArray(),quaternion:originalNode.quaternion.toArray(),scale:originalNode.scale.toArray()};
      const before=backend.readDiagnostics(),beforeLedger=JSON.parse(source.body.dataset.hestiaPrototypeResources!).ledger;
      const nativeBefore={bodies:native.bodies.map(body=>body.ownerId),parked:native.parked?.map(body=>body.ownerId)};
      const assertResident=()=>{
        const current=backend.representationRoot.getObjectByName(`representation:${residentKey}`);
        expect(current).toBe(originalNode);
        expect(originalNode.geometry).toBe(originalGeometry);
        expect(Array.from(originalGeometry.getAttribute("position").array)).toEqual(originalPositions);
        expect(originalGeometry.index===null?null:Array.from(originalGeometry.index.array)).toEqual(originalIndices);
        expect({position:originalNode.position.toArray(),quaternion:originalNode.quaternion.toArray(),scale:originalNode.scale.toArray()}).toEqual(originalPose);
      };
      const assertRestored=()=>{
        assertResident();
        const after=backend.readDiagnostics();
        expect(after.residentRepresentationKeys).toEqual(before.residentRepresentationKeys);
        expect(after.visibleRepresentationKeys).toEqual(before.visibleRepresentationKeys);
        expect(JSON.parse(source.body.dataset.hestiaPrototypeResources!).ledger).toEqual(beforeLedger);
        expect({bodies:native.bodies.map(body=>body.ownerId),parked:native.parked?.map(body=>body.ownerId)}).toEqual(nativeBefore);
      };
       const stageAndRollback=()=>{
         const candidate=stageCandidate();
         try{
           assertResident();
           const residents=backend.readDiagnostics().residentRepresentationKeys;
           const keys=residents.filter(key=>/^hvp:(?:fragment|branch)(?::foliage)?:e0~[1-9][0-9]*$/.test(key)
             &&!before.residentRepresentationKeys.includes(key));
           expect(keys).toHaveLength(expectedStageCount);
           expect(new Set(keys).size).toBe(expectedStageCount);
           expect(keys).not.toContain(residentKey);
         }finally{candidate.rollback();}
         assertRestored();
       };
       stageAndRollback();
       stageAndRollback();
       if(scenario==="structural-branch"){
         for(let attempt=0;attempt<7;attempt+=1){stageAndRollback();}
       }
      if(scenario.startsWith("body-foliage")){
        const structure=native.structural;
        if(!structure||!bodyStage){throw new Error("Missing no-foliage fixture state");}
        Reflect.set(native,"structural",{...structure,attachment:{...structure.attachment,ownerId:null,supportCell:null}});
        const empty={removedCells:1,removedMassKg:1,parts:[]};
        const completeRemoval=bodyStage(HVP_BRANCH_KEY,empty);
        try{
          expect(backend.readDiagnostics().residentRepresentationKeys).toEqual(before.residentRepresentationKeys);
        }finally{completeRemoval.rollback();Reflect.set(native,"structural",structure);}
        assertRestored();
      }
    }finally{await handle?.dispose();bodyFactory.mockRestore();structuralFactory.mockRestore();}
  });

  it.each(["cpu","mesh"] as const)("preflights moving-body coexistence over the %s cap before allocation",async cap=>{
    const baseline=harness(),baselineHandle=await startHvp(baseline.overrides());
    const baselineLedger=JSON.parse(baseline.body.dataset.hestiaPrototypeResources!).ledger as {
      totalCpuBytes:number;tempEstimateBytes:number;retainedMeshBytes:number
    };
    const maxCpuBytes=HVP_RESOURCE_CAPS_DEFAULT.maxCpuBytes;
    await baselineHandle.dispose();

    const source=harness(),overrides=source.overrides();
    if(!overrides?.createPhysics){throw new Error("Missing fixture physics factory");}
    const originalPhysics=overrides.createPhysics;
    let native!:ReturnType<HvpPhysicsClient["read"]>;
    const createPhysics:typeof originalPhysics=async(...args)=>{
      const physics=await originalPhysics(...args);native=physics.read();
      Reflect.set(native,"moving",{state:"Idle",sequence:0,last:null,preview:null});Reflect.set(native,"terrainFragments",[]);
      return {...physics,read:()=>native};
    };
    const bodyFactory=vi.spyOn(bodyConsumerModule,"createHvpBodyCutConsumer");
    let handle:HvpBootstrapHandle|undefined,artifactCalls=0,foliageCalls=0;
    try{
      const resourceCaps=cap==="cpu"?{maxCpuBytes}:{maxMeshBytes:baselineLedger.retainedMeshBytes};
      handle=await startHvp(source.overrides({createPhysics,resourceCaps}));
      const stage=bodyFactory.mock.calls[0]?.[2];if(!stage){throw new Error("Missing body presentation stage");}
      const originalArtifact=presentationModule.createMeshArtifact;
      const artifactSpy=vi.spyOn(presentationModule,"createMeshArtifact").mockImplementation(input=>{
        artifactCalls+=1;return originalArtifact(input);
      });
      const originalFoliage=structuralPartModule.meshHvpBranchFoliage;
      const foliageSpy=vi.spyOn(structuralPartModule,"meshHvpBranchFoliage").mockImplementation((...args)=>{
        foliageCalls+=1;return originalFoliage(...args);
      });
      try{
        const digest="fnv1a64-v1:0123456789abcdef",mesh={...meshHvpTestCells([{x:0,y:0,z:0,slot:HVP_SLOT_LIMESTONE_DRY}],.125,{ao:true}),sourceDigest:digest};
        const indexReads={count:0},indices=new Proxy(mesh.indices,{get(target,property){
          if(typeof property==="string"&&/^(0|[1-9][0-9]*)$/.test(property)){indexReads.count+=1;}
          return Reflect.get(target,property,target);
        }});
        // Controlled source-cost estimate, not an allocated 256-MiB source or native proof.
        const products={removedCells:1,removedMassKg:1,parts:[{ownerId:"hvp:body-preflight-child",sourceDigest:digest,sourceBytes:cap==="cpu"?maxCpuBytes:4096,
          center:{x:0,y:0,z:0},massKg:1,cells:[{x:10,y:11,z:2,materialId:1}],mesh:{...mesh,indices}}]};
        const registrations=source.commands.filter(command=>command.kind==="RegisterEphemeralRepresentation").length;
        expect(()=>stage(HVP_BRANCH_KEY,products)).toThrow(cap==="cpu"?/CPU bytes exceed/:/retained mesh bytes exceed/);
        expect(source.commands.filter(command=>command.kind==="RegisterEphemeralRepresentation")).toHaveLength(registrations);
        expect(artifactCalls).toBe(0);expect(foliageCalls).toBe(0);expect(indexReads.count).toBe(0);

        const malformedMesh={...meshHvpTestCells([{x:0,y:0,z:0,slot:HVP_SLOT_MOSS}],.125,{ao:true}),sourceDigest:digest};
        expect(()=>stage(HVP_BRANCH_KEY,{...products,parts:[{...products.parts[0]!,mesh:malformedMesh}]})).toThrow(/Unexpected timber material/);
        expect(source.commands.filter(command=>command.kind==="RegisterEphemeralRepresentation")).toHaveLength(registrations);
        expect(artifactCalls).toBe(0);expect(foliageCalls).toBe(0);
      }finally{artifactSpy.mockRestore();foliageSpy.mockRestore();}
    }finally{await handle?.dispose();bodyFactory.mockRestore();}
  });

  it.each(["Rejected","ThrowAfterAcceptance","PageHide","SuccessfulLoad","RolloverFailure","PageHideDuringRollover"] as const)("K34 uses an issued save and atomic replacement before %s epoch outcome",async advanceFailure=>{
    // The checkpoint and coordinator are real; Native A/B and lifecycle counters are controlled fixtures, not a cold restore.
    const source=harness(),snapshot=materializeHvpCoastSource(),createSourceSnapshot=()=>snapshot;
    const checkpoint=await createK34LoadCheckpoint();let currentGame=decodeHvpGame(checkpoint);
    const overrides=source.overrides();
    if(!overrides?.createPhysics){throw new Error("Missing fixture physics factory");}
    const originalPhysics=overrides.createPhysics;
    let native!:ReturnType<HvpPhysicsClient["read"]>,restoreA!:ReturnType<HvpPhysicsClient["read"]>,restoreB!:ReturnType<HvpPhysicsClient["read"]>;
    let rootOwner!:ReturnType<typeof createHvpTerrainRoot>,backend!:ThreeRenderBackend;
    let beforeLoad:{root:unknown;native:ReturnType<HvpPhysicsClient["read"]>;resident:string[];visible:string[];owned:number}|undefined;
    let stagedKeys:string[]=[],failFinalizeNext=false,deferFinalizeNext=false,deferredFinalizePending=false,restoreFinalized=false,restorePublished=false,physicsDisposals=0,rollbackCount=0;
    let failRolloverNext=false,deferRolloverNext=false;
    const events:string[]=[];
    let releaseDeferredFinalize!:()=>void,signalDeferredFinalize!:()=>void,finalizeReturned=false;
    const deferredFinalize=new Promise<void>(resolve=>{releaseDeferredFinalize=resolve;});
    const deferredFinalizeEntered=new Promise<void>(resolve=>{signalDeferredFinalize=resolve;});
    let releaseDeferredRollover!:()=>void,signalDeferredRollover!:()=>void,signalRolloverSettled!:()=>void;
    const deferredRollover=new Promise<void>(resolve=>{releaseDeferredRollover=resolve;});
    const deferredRolloverEntered=new Promise<void>(resolve=>{signalDeferredRollover=resolve;});
    const deferredRolloverSettled=new Promise<void>(resolve=>{signalRolloverSettled=resolve;});
    const createPhysics:typeof originalPhysics=async(...args)=>{
      const physics=await originalPhysics(...args);native=physics.read();
      const disposePhysics=physics.dispose;
      Reflect.set(native,"parked",[]);Reflect.set(native,"terrainFragments",[]);Reflect.set(native,"dormantCheckpointBytes",0);
      return Object.assign(physics,{
        read:()=>native,
        checkpoint:async()=>currentGame.checkpoint.world,
        prepareRestore:async(_id:string,world:Awaited<ReturnType<HvpPhysicsClient["checkpoint"]>>)=>{
          restoreA=native;
          const bodies=currentGame.world.bodies.map(({checkpoint:body,motion,recipe})=>({ownerId:body.ownerId,position:motion.translationMeters,
            orientation:motion.rotation,velocity:motion.linvelMetersPerSecond,sleeping:body.sleeping,massKg:recipe.mass.totalMassKg}));
          restoreB={...restoreA,terrainGeneration:world.terrainGeneration,bodies,bodyCount:bodies.length};
          restoreFinalized=false;restorePublished=false;finalizeReturned=false;stagedKeys=[];
          return restoreB;
        },
        commitRestore:async()=>{
          if(!beforeLoad){throw new Error("Missing captured A state before restore");}
          expect(native).toBe(restoreA);expect(rootOwner.read()).toBe(beforeLoad.root);
          const afterStage=backend.readDiagnostics();
          stagedKeys=afterStage.residentRepresentationKeys.filter(key=>!beforeLoad!.resident.includes(key));
          expect(stagedKeys.length).toBeGreaterThan(0);
          expect(stagedKeys.every(key=>key.includes("~"))).toBe(true);
          expect(afterStage.visibleRepresentationKeys).not.toEqual(expect.arrayContaining(stagedKeys));
          if(beforeLoad.resident.includes(retainedKey!)){expect(afterStage.residentRepresentationKeys).toContain(retainedKey!);}
        },
        publishRestore:()=>{native=restoreB;restorePublished=true;},
        rollbackRestore:async()=>{
          rollbackCount+=1;
          expect(native).toBe(restorePublished?restoreB:restoreA);
          if(beforeLoad){
            expect(rootOwner.read()).toBe(beforeLoad.root);
            expect(backend.readDiagnostics().visibleRepresentationKeys).toEqual(beforeLoad.visible);
          }
          native=restoreA;restorePublished=false;restoreFinalized=false;
        },
        finalizeRestore:async()=>{
          expect(native).toBe(restoreB);expect(rootOwner.read()).toBe(currentGame.root.read());
          const published=backend.readDiagnostics(),terrainKeys=stagedKeys.filter(key=>key.startsWith("hvp:terrain:s"));
          expect(terrainKeys.length).toBeGreaterThan(0);
          expect(published.visibleRepresentationKeys).toEqual(expect.arrayContaining(terrainKeys));
          if(failFinalizeNext){failFinalizeNext=false;throw new Error("Injected pre-finalize B failure");}
          if(deferFinalizeNext){deferFinalizeNext=false;deferredFinalizePending=true;signalDeferredFinalize();await deferredFinalize;}
          restoreFinalized=true;finalizeReturned=true;events.push("finalized");
        },
        dispose:async()=>{physicsDisposals+=1;await disposePhysics();},
        lifecycle:()=>({workers:0,pendingJobs:0,timers:0,listeners:0,timingSinkFailures:0,
          native:{status:physicsDisposals>0?"Disposed":"Paused",bodies:physicsDisposals>0?0:native.bodyCount,colliders:physicsDisposals>0?0:native.colliderCount}})
      });
    };
    let renderCount=2,failSecondConstructor=false,constructionCount=0;
    const originalCompilerFactory=terrainProductsModule.createHvpTerrainCompiler;
    const tile=meshHvpTestCells([{x:0,y:0,z:0,slot:HVP_SLOT_LIMESTONE_DRY}],.125,{ao:true});
    let compiler!:ReturnType<typeof originalCompilerFactory>;
    vi.spyOn(terrainProductsModule,"createHvpTerrainCompiler").mockImplementation(()=>{
      compiler=originalCompilerFactory();
      vi.spyOn(compiler,"restore").mockImplementation(async(_old,target)=>({source:target,
        render:new Map(Array.from({length:renderCount},(_,id)=>[id,tile] as const)),collision:new Map()}));
      const rollover=compiler.rolloverAfterLoad;
      vi.spyOn(compiler,"rolloverAfterLoad").mockImplementation(async ownerStillLive=>{
        events.push("rollover-started");
        if(failRolloverNext){failRolloverNext=false;events.push("rollover-failed");throw new Error("Injected compiler pool rollover failure");}
        const deferred=deferRolloverNext;
        if(deferred){deferRolloverNext=false;signalDeferredRollover();}
        try{
          if(deferred){await deferredRollover;}
          await rollover(ownerStillLive);events.push("rollover-complete");
        }finally{if(deferred){signalRolloverSettled();}}
      });
      return compiler;
    });
    const terrainFactory=vi.spyOn(terrainConsumerModule,"createHvpTerrainConsumer");
    const commands:RenderCommand[]=[];let advanceMode:"none"|"rejected"|"throw-after-accepted"="none";
    let retainedKey:RepresentationKey|undefined,handle:HvpBootstrapHandle|undefined;
    const originalReplace=sceneReplacementModule.replaceHvpScene,replacementOperations:Promise<void>[]=[];
    const replacementSpy=vi.spyOn(sceneReplacementModule,"replaceHvpScene").mockImplementation((...args)=>{
      const operation=originalReplace(...args);replacementOperations.push(operation);return operation;
    });
    try{
      handle=await startHvp(source.overrides({createSourceSnapshot,createPhysics,createBackend:(options:ConstructorParameters<typeof ThreeRenderBackend>[0])=>{
        backend=new ThreeRenderBackend({...options,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:()=>{}})});
        const dispatch=backend.dispatch.bind(backend);
        vi.spyOn(backend,"dispatch").mockImplementation(command=>{
          commands.push(command);
          if(command.kind==="AdvanceEphemeralEpoch"){
            expect(restoreFinalized).toBe(true);expect(native).toBe(restoreB);expect(rootOwner.read()).toBe(currentGame.root.read());
            expect(events.at(-1)).toBe("finalized");
            if(advanceMode==="rejected"){events.push("advance-rejected");return renderCommandResult("RejectedStaleRevision","NotApplicable","InjectedEpochRejection");}
            const result=dispatch(command);events.push("advance-accepted");
            if(advanceMode==="throw-after-accepted"){expect(result.status).toBe("Accepted");throw new Error("Injected epoch publication throw");}
            return result;
          }
          return dispatch(command);
        });
        return backend;
      }}));
      rootOwner=terrainFactory.mock.calls[0]![0];
      const terrainStage=terrainFactory.mock.calls[0]?.[2];
      if(!terrainStage){throw new Error("Missing terrain staging callback");}
      const liveRoot=rootOwner.read(),ownerId="hvp:terrain-fragment:load-retained",digest="fnv1a64-v1:0123456789abcdef";
      const retained=terrainStage({source:{...liveRoot,revision:liveRoot.revision+1},render:new Map(),collision:new Map()},[{
        request:{ownerId,origin:{x:0,y:0,z:0},massKg:1,cells:[{x:0,y:0,z:0,materialId:1}],
          colliderBoxes:[{min:[0,0,0] as const,max:[1,1,1] as const}]},
        state:{ownerId,sourceDigest:digest,centerOfMass:{x:0,y:0,z:0},cellCount:1,massKg:1,colliders:1,sourceBytes:4096}
      }]);
      retained.publish();retained.finish();
      retainedKey=backend.readDiagnostics().residentRepresentationKeys.find(key=>/^hvp:fragment:e0~[1-9][0-9]*$/.test(key));
      if(!retainedKey){throw new Error("Missing registered active fragment alias");}

      const originalArtifactFactory=presentationModule.createMeshArtifact;
      vi.spyOn(presentationModule,"createMeshArtifact").mockImplementation(input=>{
        if(failSecondConstructor&&input.representationKey.includes("~")){
          constructionCount+=1;if(constructionCount===2){throw new Error("Injected second Load artifact constructor");}
        }
        return originalArtifactFactory(input);
      });
      const store={initialize:vi.fn(async()=>{}),list:vi.fn(async()=>({slots:[]})),
        load:vi.fn(async()=>({game:currentGame,metadata:{recordRevision:1}})),close:vi.fn(async()=>{}),
        save:vi.fn(),export:vi.fn(),import:vi.fn()};
      vi.spyOn(saveStoreModule,"createHvpSaveStore").mockReturnValue(store as unknown as ReturnType<typeof saveStoreModule.createHvpSaveStore>);
      const loadButton=descendants(source.body).find(element=>element.id==="hvp-load");
      if(!loadButton){throw new Error("Missing HVP Load control");}
      const saveState=()=>{
        const save=source.body.dataset.hestiaPrototypeSave;
        return save===undefined?undefined:JSON.parse(save).state as string;
      };
      const captureBeforeLoad=()=>{
        const diagnostics=backend.readDiagnostics();
        beforeLoad={root:rootOwner.read(),native,resident:[...diagnostics.residentRepresentationKeys],
          visible:[...diagnostics.visibleRepresentationKeys],owned:diagnostics.ownedCpuBytes};
        events.length=0;
      };
      const failLoad=async(mode:"constructor"|"rollback"|"admission")=>{
        failSecondConstructor=mode==="constructor";constructionCount=0;failFinalizeNext=mode==="rollback";
        renderCount=mode==="admission"?301:2;
        const registrationsBefore=commands.filter(command=>command.kind==="RegisterEphemeralRepresentation").length;
        const cancellationsBefore=commands.filter(command=>command.kind==="CancelEphemeralRepresentation").length;
        const advancesBefore=commands.filter(command=>command.kind==="AdvanceEphemeralEpoch").length;
        captureBeforeLoad();loadButton.dispatchEvent(new Event("click"));await vi.waitFor(()=>expect(saveState()).toBe("Rejected"));
        expect(commands.filter(command=>command.kind==="AdvanceEphemeralEpoch")).toHaveLength(advancesBefore);
        expect(rootOwner.read()).toBe(beforeLoad!.root);expect(native).toBe(beforeLoad!.native);
        expect(backend.readDiagnostics().residentRepresentationKeys).toEqual(beforeLoad!.resident);
        expect(backend.readDiagnostics().visibleRepresentationKeys).toEqual(beforeLoad!.visible);
        expect(backend.readDiagnostics().ownedCpuBytes).toBe(beforeLoad!.owned);
        const newRegistrations=commands.filter(command=>command.kind==="RegisterEphemeralRepresentation").slice(registrationsBefore);
        if(mode==="rollback"){
          expect(newRegistrations.length).toBeGreaterThan(0);
          for(const registration of newRegistrations){
            expect(commands.some(command=>command.kind==="RemoveRepresentation"&&command.representationKey===registration.representationKey)).toBe(true);
          }
        }else{
          expect(commands.filter(command=>command.kind==="CancelEphemeralRepresentation").slice(cancellationsBefore).length).toBe(newRegistrations.length);
        }
        failSecondConstructor=false;renderCount=2;
      };
      await failLoad("constructor");await failLoad("rollback");await failLoad("admission");
      expect(replacementSpy).toHaveBeenCalledTimes(3);
      expect(compiler.rolloverAfterLoad).toHaveBeenCalledTimes(0);

      captureBeforeLoad();loadButton.dispatchEvent(new Event("click"));await vi.waitFor(()=>expect(saveState()).toBe("Loaded"));
      expect(events).toEqual(["finalized","advance-accepted","rollover-started","rollover-complete"]);
      expect(compiler.rolloverAfterLoad).toHaveBeenCalledTimes(1);
      const successfulAdvance=commands.filter(command=>command.kind==="AdvanceEphemeralEpoch").at(-1);
      expect(successfulAdvance).toMatchObject({kind:"AdvanceEphemeralEpoch",nextEpoch:1});
      expect(native).toBe(restoreB);expect(rootOwner.read()).toBe(currentGame.root.read());
      const currentDiagnostics=backend.readDiagnostics(),currentKeys=currentDiagnostics.residentRepresentationKeys;
      expect(currentKeys.some(key=>/e1~[1-9][0-9]*$/.test(key))).toBe(true);
      expect(currentKeys.some(key=>/^hvp:terrain:s[0-9]+:e1~[1-9][0-9]*$/.test(key))).toBe(true);
      expect(currentKeys.some(key=>/^hvp:branch(?::foliage)?:e1~[1-9][0-9]*$/.test(key))).toBe(true);
      expect(currentDiagnostics.visibleRepresentationKeys).toEqual(expect.arrayContaining(stagedKeys.filter(key=>key.startsWith("hvp:terrain:s"))));
      expect(currentKeys).not.toContain(retainedKey!);
      expect(replacementSpy).toHaveBeenCalledTimes(4);

      currentGame=decodeHvpGame(checkpoint);
      const rollbacksAfterCommittedLoad=rollbackCount;
      captureBeforeLoad();
      if(advanceFailure==="PageHide"){
        deferFinalizeNext=true;loadButton.dispatchEvent(new Event("click"));
        await vi.waitFor(()=>{
          if(saveState()!=="Loading"){throw new Error(`Load ended before deferred finalize: ${source.body.dataset.hestiaPrototypeSave}`);}
          expect(deferredFinalizePending).toBe(true);
        },{timeout:30_000,interval:10});await deferredFinalizeEntered;
        expect(saveState()).toBe("Loading");expect(restoreFinalized).toBe(false);
        try{source.windowPort.dispatchEvent(new Event("pagehide"));await handle.dispose();}
        finally{releaseDeferredFinalize();}
        expect(physicsDisposals).toBe(1);expect(source.windowPort.listenerTotals.get("pagehide")).toBe(0);
        expect(backend.readDiagnostics()).toMatchObject({backendState:"Disposed",residentRepresentationKeys:[],ownedCpuBytes:0});
        await Promise.allSettled([replacementOperations.at(-1)!]);await Promise.resolve();
        expect(finalizeReturned).toBe(true);expect(saveState()).toBeUndefined();
        expect(commands.filter(command=>command.kind==="AdvanceEphemeralEpoch")).toHaveLength(1);
        expect(rollbackCount).toBe(rollbacksAfterCommittedLoad);
        expect(compiler.rolloverAfterLoad).toHaveBeenCalledTimes(1);
      }else if(advanceFailure==="PageHideDuringRollover"){
        deferRolloverNext=true;
        try{
          loadButton.dispatchEvent(new Event("click"));
          await vi.waitFor(()=>expect(events).toContain("rollover-started"),{timeout:30_000,interval:10});
          await deferredRolloverEntered;
          expect(saveState()).toBe("Loading");expect(restoreFinalized).toBe(true);
          expect(events).toEqual(["finalized","advance-accepted","rollover-started"]);
          source.windowPort.dispatchEvent(new Event("pagehide"));await handle.dispose();
        }
        finally{releaseDeferredRollover();}
        await deferredRolloverSettled;
        expect(saveState()).toBeUndefined();expect(events).toEqual(["finalized","advance-accepted","rollover-started"]);
        expect(commands.filter(command=>command.kind==="AdvanceEphemeralEpoch")).toHaveLength(2);
        expect(rollbackCount).toBe(rollbacksAfterCommittedLoad);expect(compiler.rolloverAfterLoad).toHaveBeenCalledTimes(2);
        expect(physicsDisposals).toBe(1);expect(source.windowPort.listenerTotals.get("pagehide")).toBe(0);
        expect(backend.readDiagnostics()).toMatchObject({backendState:"Disposed",residentRepresentationKeys:[],ownedCpuBytes:0});
      }else if(advanceFailure==="SuccessfulLoad"){
        const firstEpochKeys=backend.readDiagnostics().residentRepresentationKeys.filter(key=>/e1~[1-9][0-9]*$/.test(key));
        captureBeforeLoad();loadButton.dispatchEvent(new Event("click"));await vi.waitFor(()=>expect(saveState()).toBe("Loaded"));
        expect(events).toEqual(["finalized","advance-accepted","rollover-started","rollover-complete"]);
        expect(compiler.rolloverAfterLoad).toHaveBeenCalledTimes(2);
        expect(native).toBe(restoreB);expect(rootOwner.read()).toBe(currentGame.root.read());
        const secondEpochKeys=backend.readDiagnostics().residentRepresentationKeys.filter(key=>/e2~[1-9][0-9]*$/.test(key));
        expect(secondEpochKeys.length).toBeGreaterThan(0);expect(secondEpochKeys.some(key=>key.startsWith("hvp:terrain:s"))).toBe(true);
        expect(secondEpochKeys.some(key=>key.startsWith("hvp:branch"))).toBe(true);
        expect(secondEpochKeys.some(key=>firstEpochKeys.includes(key))).toBe(false);
        expect(backend.readDiagnostics().residentRepresentationKeys).not.toEqual(expect.arrayContaining(firstEpochKeys));
      }else if(advanceFailure==="RolloverFailure"){
        failRolloverNext=true;loadButton.dispatchEvent(new Event("click"));await vi.waitFor(()=>expect(saveState()).toBe("RecoveryHold"));
        expect(events).toEqual(["finalized","advance-accepted","rollover-started","rollover-failed"]);
        expect(saveState()).not.toBe("Loaded");expect(native).toBe(restoreB);expect(rootOwner.read()).toBe(currentGame.root.read());
        expect(rollbackCount).toBe(rollbacksAfterCommittedLoad);expect(compiler.rolloverAfterLoad).toHaveBeenCalledTimes(2);
        const lastAdvance=commands.filter(command=>command.kind==="AdvanceEphemeralEpoch").at(-1);
        expect(lastAdvance).toMatchObject({kind:"AdvanceEphemeralEpoch",nextEpoch:2});
      }else{
        advanceMode=advanceFailure.toLowerCase()==="rejected"?"rejected":"throw-after-accepted";
        loadButton.dispatchEvent(new Event("click"));await vi.waitFor(()=>expect(["RecoveryHold","Rejected","Loaded"]).toContain(saveState()));
        expect(saveState(),source.body.dataset.hestiaPrototypeSave).toBe("RecoveryHold");
        expect(saveState()).not.toBe("Loaded");expect(saveState()).not.toBe("Rejected");
        expect(events).toEqual(["finalized",advanceFailure==="Rejected"?"advance-rejected":"advance-accepted"]);
        expect(compiler.rolloverAfterLoad).toHaveBeenCalledTimes(1);
        expect(native).toBe(restoreB);expect(rootOwner.read()).toBe(currentGame.root.read());
        expect(rollbackCount).toBe(rollbacksAfterCommittedLoad);
        const lastAdvance=commands.filter(command=>command.kind==="AdvanceEphemeralEpoch").at(-1);
        expect(lastAdvance).toMatchObject({kind:"AdvanceEphemeralEpoch",nextEpoch:2});
        expect(backend.readDiagnostics().residentRepresentationKeys.some(key=>/e2~[1-9][0-9]*$/.test(key))).toBe(true);
        expect(replacementSpy).toHaveBeenCalledTimes(5);
      }
    }finally{
      try{await handle?.dispose();}
      finally{vi.restoreAllMocks();}
      if(backend){
        expect(commands.filter(command=>command.kind==="DisposeBackend")).toHaveLength(1);
        expect(backend.readDiagnostics()).toMatchObject({backendState:"Disposed",residentRepresentationKeys:[],ownedCpuBytes:0});
      }
      if(handle){expect(physicsDisposals).toBe(1);}
    }
  });

  it("K34 registers neighbour role aliases once and keeps reused proxies live",async()=>{
    const source=harness(),neighborFactory=vi.spyOn(neighborControllerModule,"createHvpNeighborController");
    let backend!:ThreeRenderBackend;const commands:RenderCommand[]=[];let handle:HvpBootstrapHandle|undefined;
    try{
      handle=await startHvp(source.overrides({createBackend:(options:ConstructorParameters<typeof ThreeRenderBackend>[0])=>{
        backend=new ThreeRenderBackend({...options,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:()=>{}})});
        const dispatch=backend.dispatch.bind(backend);
        vi.spyOn(backend,"dispatch").mockImplementation(command=>{commands.push(command);return dispatch(command);});return backend;
      }}));
      const stage=neighborFactory.mock.calls[0]?.[0].stage;
      if(!stage){throw new Error("Missing HVP neighbour stage callback");}
      const mesh={...meshHvpTestCells([{x:0,y:0,z:0,slot:HVP_SLOT_LIMESTONE_DRY}],.125,{ao:true}),
        sourceDigest:"fnv1a64-v1:0123456789abcdef"};
      const products={digest:"neighbor-fixture",lod:.125,region:[mesh],waterPatch:mesh,water:mesh,join:mesh,far:mesh,sourceBytes:0,projectionBytes:0} as unknown as NonNullable<HvpNeighborStage["products"]>;
      const before=commands.filter(command=>command.kind==="RegisterEphemeralRepresentation").length;
      const next=stage({products,seams:null,epoch:1,source:null,cacheBytes:0,checkpointBytes:0});next.publish();next.finish();
      const activeKeys=backend.readDiagnostics().residentRepresentationKeys.filter(key=>key.includes("~"));
      expect(activeKeys).toHaveLength(5);
      expect(activeKeys.filter(key=>key.startsWith("hvp:water:")).length).toBe(2);
      expect(activeKeys.some(key=>/^hvp:neighbor:join:e0~[1-9][0-9]*$/.test(key))).toBe(true);
      expect(activeKeys.some(key=>/^hvp:neighbor:far:e0~[1-9][0-9]*$/.test(key))).toBe(true);
      expect(activeKeys.some(key=>/^hvp:neighbor:region:e0~[1-9][0-9]*$/.test(key))).toBe(true);
      const proxies=stage({products:null,seams:null,epoch:2,source:null,cacheBytes:0,checkpointBytes:0});proxies.publish();proxies.finish();
      const proxyKeys=backend.readDiagnostics().residentRepresentationKeys.filter(key=>key.includes("~"));
      expect(proxyKeys).toHaveLength(3);
      expect(proxyKeys.filter(key=>key.startsWith("hvp:neighbor:proxy:")).length).toBe(2);
      expect(proxyKeys.some(key=>key.startsWith("hvp:water:"))).toBe(true);
      const beforeReuse=commands.filter(command=>command.kind==="RegisterEphemeralRepresentation").length;
      const reused=stage({products:null,seams:null,epoch:3,source:null,cacheBytes:0,checkpointBytes:0});reused.publish();reused.finish();
      expect(commands.filter(command=>command.kind==="RegisterEphemeralRepresentation")).toHaveLength(beforeReuse);
      expect(backend.readDiagnostics().residentRepresentationKeys.filter(key=>key.includes("~"))).toEqual(proxyKeys);
      expect(commands.filter(command=>command.kind==="RegisterEphemeralRepresentation").length-before).toBe(8);
      expect(commands.filter(command=>command.kind==="EvictRepresentation"&&activeKeys.includes(command.representationKey))).toHaveLength(0);
    }finally{await handle?.dispose();neighborFactory.mockRestore();}
  });

  it("K34 keeps a parked ephemeral fragment registered across Evict and wake",async()=>{
    // Fake Native residency facts; Three owns the actual Evict/rehydrate lifecycle.
    const source=harness(),terrainFactory=vi.spyOn(terrainConsumerModule,"createHvpTerrainConsumer"),
      dormancyFactory=vi.spyOn(dormancyControllerModule,"createHvpDormancyController");
    let backend!:ThreeRenderBackend,native!:ReturnType<HvpPhysicsClient["read"]>;const backendCommands:RenderCommand[]=[];
    const overrides=source.overrides();
    if(!overrides?.createPhysics){throw new Error("Missing fixture physics factory");}
    const originalPhysics=overrides.createPhysics;
    const createPhysics:typeof originalPhysics=async(...args)=>{
      const physics=await originalPhysics(...args);native=physics.read();Reflect.set(native,"parked",[]);return {...physics,read:()=>native};
    };
    let handle:HvpBootstrapHandle|undefined;
    try{
      handle=await startHvp(source.overrides({createPhysics,createBackend:(options:ConstructorParameters<typeof ThreeRenderBackend>[0])=>{
        backend=new ThreeRenderBackend({...options,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:()=>{}})});
        const dispatch=backend.dispatch.bind(backend);vi.spyOn(backend,"dispatch").mockImplementation(command=>{
          backendCommands.push(command);return dispatch(command);
        });return backend;
      }}));
      const stage=terrainFactory.mock.calls[0]?.[2],stageDormancy=dormancyFactory.mock.calls[0]?.[0].stage;
      if(!stage||!stageDormancy){throw new Error("Missing HVP fragment/residency stage callbacks");}
      const root=terrainFactory.mock.calls[0]![0].read(),ownerId="hvp:terrain-fragment:parked-fixture",digest="fnv1a64-v1:0123456789abcdef";
      const fragment={request:{ownerId,origin:{x:0,y:0,z:0},massKg:1,cells:[{x:0,y:0,z:0,materialId:1}],
        colliderBoxes:[{min:[0,0,0] as const,max:[1,1,1] as const}]},
        state:{ownerId,sourceDigest:digest,centerOfMass:{x:0,y:0,z:0},cellCount:1,massKg:1,colliders:1,sourceBytes:4096}};
      const installed=stage({source:{...root,revision:root.revision+1},render:new Map(),collision:new Map()},[fragment]);
      installed.publish();installed.finish();
      const key=backend.readDiagnostics().residentRepresentationKeys.find(value=>/^hvp:fragment:e0~[1-9][0-9]*$/.test(value));
      if(!key){throw new Error("Missing issued fragment render alias");}
      const registrations=backendCommands.filter(command=>command.kind==="RegisterEphemeralRepresentation").length;
      const parked=stageDormancy({...native,parked:[{ownerId,position:native.bodies[0]!.position,residency:"Checkpointed"}],dormantCheckpointBytes:0});
      parked.publish();parked.finish();
      expect(backend.readDiagnostics().residentRepresentationKeys).not.toContain(key);
      expect(backendCommands.filter(command=>command.kind==="RegisterEphemeralRepresentation")).toHaveLength(registrations);
      const awake=stageDormancy({...native,parked:[],terrainFragments:[fragment.state],dormantCheckpointBytes:0});
      awake.publish();awake.finish();
      expect(backend.readDiagnostics().residentRepresentationKeys).toContain(key);
      expect(backendCommands.filter(command=>command.kind==="RegisterEphemeralRepresentation")).toHaveLength(registrations);
    }finally{await handle?.dispose();terrainFactory.mockRestore();dormancyFactory.mockRestore();}
  });

  it.each([false,true])("R01/T04 moving stage reports renderer cleanup authority (unproven=%s)",async unproven=>{
    // The renderer/ephemeral owner is real; physics remains a controlled fixture.
    const source=harness(),overrides=source.overrides();
    if(!overrides?.createPhysics){throw new Error("Missing fixture physics factory");}
    const originalPhysics=overrides.createPhysics;
    const createPhysics:typeof originalPhysics=async(...args)=>{
      const physics=await originalPhysics(...args),native=physics.read();
      Reflect.set(native,"moving",{state:"Idle",sequence:0,last:null,preview:null});
      return {...physics,read:()=>native};
    };
    const bodyFactory=vi.spyOn(bodyConsumerModule,"createHvpBodyCutConsumer");
    let backend!:ThreeRenderBackend,failUpload=false,failCleanup=false,handle:HvpBootstrapHandle|undefined;
    const uploadFailure=new Error("injected accepted upload failure"),cleanupFailure=new Error("injected release failure");
    try{
      handle=await startHvp(source.overrides({createPhysics,createBackend:(options:ConstructorParameters<typeof ThreeRenderBackend>[0])=>{
        backend=new ThreeRenderBackend({...options,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:()=>{}})});
        const dispatch=backend.dispatch.bind(backend);
        vi.spyOn(backend,"dispatch").mockImplementation(command=>{
          if(failCleanup&&command.kind==="RemoveRepresentation"&&command.representationKey.includes("~")){throw cleanupFailure;}
          const result=dispatch(command);
          if(failUpload&&command.kind==="UpsertMeshArtifact"&&command.artifact.representationKey.includes("~")){
            failUpload=false;throw uploadFailure;
          }
          return result;
        });return backend;
      }}));
      const stage=bodyFactory.mock.calls[0]?.[2];if(!stage){throw new Error("Missing moving render stage");}
      const digest="fnv1a64-v1:0123456789abcdef";
      const mesh={...meshHvpTestCells([{x:0,y:0,z:0,slot:HVP_SLOT_LIMESTONE_DRY}],.125,{ao:true}),sourceDigest:digest};
      const products={removedCells:1,removedMassKg:1,parts:[{ownerId:"hvp:r01-child",sourceDigest:digest,sourceBytes:4096,
        center:{x:0,y:0,z:0},massKg:1,cells:[{x:10,y:11,z:2,materialId:1}],mesh}]};
      const before=backend.readDiagnostics();failUpload=true;failCleanup=unproven;
      let caught:unknown;
      try{stage(HVP_BRANCH_KEY,products);}catch(error){caught=error;}
      if(unproven){
        expect(caught).toBeInstanceOf(HvpRenderStageRecoveryError);
        expect(source.body.dataset.hestiaPrototypeSave).toContain("RecoveryHold");
        // Failed release is not counted as reclaimed GPU/native memory.
        expect(backend.readDiagnostics().residentRepresentationKeys).not.toEqual(before.residentRepresentationKeys);
      }else{
        expect(caught).toBe(uploadFailure);
        expect(backend.readDiagnostics().residentRepresentationKeys).toEqual(before.residentRepresentationKeys);
        expect(backend.readDiagnostics().ownedCpuBytes).toBe(before.ownedCpuBytes);
        expect(source.body.dataset.hestiaPrototypeSave).not.toContain("RecoveryHold");
      }
    }finally{failUpload=false;failCleanup=false;await handle?.dispose();bodyFactory.mockRestore();}
  });

  it("K34 removes an accepted terrain Upsert after visibility publication throws",async()=>{
    const source=harness(),terrainFactory=vi.spyOn(terrainConsumerModule,"createHvpTerrainConsumer");
    let backend!:ThreeRenderBackend,injectVisibilityFailure=false;const commands:RenderCommand[]=[];
    const publishFailure=new Error("injected visibility publication failure");let handle:HvpBootstrapHandle|undefined;
    try{
      handle=await startHvp(source.overrides({createBackend:(options:ConstructorParameters<typeof ThreeRenderBackend>[0])=>{
        backend=new ThreeRenderBackend({...options,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:()=>{}})});
        const dispatch=backend.dispatch.bind(backend);
        vi.spyOn(backend,"dispatch").mockImplementation(command=>{
          commands.push(command);const result=dispatch(command);
          if(injectVisibilityFailure&&command.kind==="ApplyVisibilityPlan"){injectVisibilityFailure=false;throw publishFailure;}
          return result;
        });return backend;
      }}));
      const stage=terrainFactory.mock.calls[0]?.[2];if(!stage){throw new Error("Missing terrain stage callback");}
      const root=terrainFactory.mock.calls[0]![0].read(),mesh=meshHvpTestCells([{x:0,y:0,z:0,slot:HVP_SLOT_LIMESTONE_DRY}],.125,{ao:true});
      const before=backend.readDiagnostics();injectVisibilityFailure=true;
      expect(()=>stage({source:{...root,revision:root.revision+1},render:new Map([[0,mesh]]),collision:new Map()})).toThrow(publishFailure);
      const afterCleanup=backend.readDiagnostics();
      expect(afterCleanup.residentRepresentationKeys).toEqual(before.residentRepresentationKeys);
      expect(afterCleanup.ownedCpuBytes).toBe(before.ownedCpuBytes);
      const upsert=commands.find(command=>command.kind==="UpsertMeshArtifact"&&command.artifact.representationKey.includes("~"));
      if(upsert?.kind!=="UpsertMeshArtifact"){throw new Error("Missing accepted ephemeral Upsert");}
      expect(commands.some(command=>command.kind==="RemoveRepresentation"&&command.representationKey===upsert.artifact.representationKey)).toBe(true);
      const allocations=afterCleanup.geometryAllocations;
      expect(backend.dispatch(upsert)).toMatchObject({status:"RejectedStaleRevision",reasonCode:"ExpiredEpoch"});
      expect(backend.readDiagnostics().staleRejectCount).toBeGreaterThan(before.staleRejectCount);
      expect(backend.readDiagnostics().geometryAllocations).toBe(allocations);
      expect(backend.readDiagnostics().residentRepresentationKeys).toEqual(before.residentRepresentationKeys);
    }finally{await handle?.dispose();terrainFactory.mockRestore();}
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

      const overActualKey = new THREE.Object3D();
      overActualKey.name = `representation:hvp:terrain:s${"x".repeat(116)}`;
      expect(overActualKey.name.slice("representation:".length)).toHaveLength(129);
      root.add(overActualKey);
      injected.push(overActualKey);
      const keySentinel=addSentinel();
      expect(() => readFrame!()).toThrow(/overflow/);
      expect(keySentinel.visited()).toBe(false);
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

  it.each([false,true])("V3-01 records a sink failure after health publication (publish next: %s)",async publishNext=>{
    const source=harness();Object.defineProperty(source.windowPort,"location",{value:{search:"?hvpMeasure=1"}});
    Reflect.set(source.windowPort,"confirm",()=>true);
    const overrides=source.overrides();
    if(!overrides?.createPhysics){throw new Error("Missing fixture physics factory");}
    const originalPhysics=overrides.createPhysics;
    let failures=0;
    const createPhysics:typeof originalPhysics=async(...args)=>{
      const physics=await originalPhysics(...args);
      return {...physics,lifecycle:()=>({workers:1,pendingJobs:0,timers:1,listeners:0,
        timingSinkFailures:failures,native:{status:"Running",bodies:3,colliders:5}})};
    };
    const handle=await startHvp(source.overrides({createPhysics}));
    try{
      for(let i=0;i<15;i+=1){stepFrame(source.windowPort,performance.now()+i);}
      const before=JSON.parse(source.body.dataset.hestiaPrototypeMeasurements!);
      expect(before).toMatchObject({publishedOrigin:performance.timeOrigin,publishedAt:expect.any(Number),timingSinkFailures:0});
      failures=1;
      expect(isHvpCutHealthFresh(before,performance.timeOrigin,before.publishedAt+1)).toBe(false);
      if(publishNext){
        for(let i=0;i<15;i+=1){stepFrame(source.windowPort,performance.now()+i);}
        const after=JSON.parse(source.body.dataset.hestiaPrototypeMeasurements!);
        expect(after).toMatchObject({publishedOrigin:performance.timeOrigin,timingSinkFailures:1});
        expect(after.publishedAt).toBeGreaterThanOrEqual(before.publishedAt);
        expect(isHvpCutHealthFresh(after,performance.timeOrigin,before.publishedAt)).toBe(false);
      }else{expect(JSON.parse(source.body.dataset.hestiaPrototypeMeasurements!).timingSinkFailures).toBe(0);}
      const end=descendants(source.body).find(element=>element.id==="hvp-end-session");
      if(!end){throw new Error("Missing end-session control");}
      end.dispatchEvent(new Event("click"));
      await vi.waitFor(()=>expect(source.body.dataset.hestiaPrototypeDisposal).toBeDefined());
      expect(JSON.parse(source.body.dataset.hestiaPrototypeDisposal!).measurementHealth.timingSinkFailures).toBe(1);
    }finally{await handle.dispose();}
  });

});
