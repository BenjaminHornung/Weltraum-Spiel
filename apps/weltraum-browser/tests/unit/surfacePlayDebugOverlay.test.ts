import { describe, expect, it, vi } from "vitest";
import { backendRevision, type RenderBackendDiagnostics } from "../../src/presentation";
import {
  createSurfacePlayDebugOverlay,
  type SurfacePlayDebugFrameSample
} from "../../src/surface-play/ui/surfacePlayDebugOverlay";
import type { SurfacePlayRuntimeSnapshot } from "../../src/surface-play/surfacePlayRuntime";

class FakeElement extends EventTarget {
  id = "";
  className = "";
  textContent = "";
  hidden = false;
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

class FakeDocument {
  createElement(tagName: string): FakeElement { return new FakeElement(tagName); }
  createElementNS(_namespace: string, tagName: string): FakeElement { return new FakeElement(tagName); }
}

const descendants = (element: FakeElement): FakeElement[] =>
  element.children.flatMap((child) => [child, ...descendants(child)]);

const diagnostics = (): Readonly<RenderBackendDiagnostics> => Object.freeze({
  acceptedArtifacts: 7,
  rejectedArtifacts: 5,
  activeRepresentations: 4,
  activeFallbacks: 1,
  geometryAllocations: 8,
  geometryDisposals: 2,
  materialAllocations: 4,
  materialDisposals: 1,
  estimatedGpuBytes: 2 * 1024 * 1024,
  ownedCpuBytes: 1024 * 1024,
  replacementCount: 2,
  removeCount: 1,
  staleRejectCount: 3,
  resetCount: 0,
  evictionCount: 1,
  evictionRejectCount: 0,
  rehydrationCount: 0,
  renderTargetAllocations: 1,
  renderTargetDisposals: 0,
  activeRenderTargets: 1,
  backendRevision: backendRevision(4),
  backendState: "Available",
  residentRepresentationKeys: ["representation:a", "representation:b", "representation:c", "representation:d"],
  visibleRepresentationKeys: ["representation:a", "representation:b", "representation:c"],
  pinnedFallbackRepresentationKeys: ["representation:d"]
} as unknown as RenderBackendDiagnostics);

const snapshot = (): Readonly<SurfacePlayRuntimeSnapshot> => Object.freeze({
  authorityState: Object.freeze({ regionRevision: 8 }),
  world: Object.freeze({ identity: Object.freeze({ regionRevision: 7 }) }),
  fixedStep: Object.freeze({ accumulatorSeconds: 0.0025 }),
  player: Object.freeze({
    simulationTick: 42,
    positionMeters: Object.freeze({ x: -1, y: 2, z: 3 }),
    velocityMetersPerSecond: Object.freeze({ x: 4, y: -5, z: 6 }),
    grounded: true
  }),
  combat: Object.freeze({
    events: Object.freeze([Object.freeze({ kind: "StructuralHit", simulationTick: 41 })]),
    latestFireResult: Object.freeze({ status: "Accepted", hit: "Structural" })
  }),
  hud: Object.freeze({ latestAction: "TREE CUT PUBLISHED", latestBlock: null }),
  presentation: Object.freeze({
    structural: Object.freeze({
      dynamicBodies: Object.freeze([
        Object.freeze({ lifecycle: "Falling" }),
        Object.freeze({ lifecycle: "Resting" })
      ]),
      physicsFailure: null
    })
  }),
  latestVoxelTransition: Object.freeze({ result: Object.freeze({ status: "Applied" }) }),
  latestRejection: null
} as unknown as SurfacePlayRuntimeSnapshot);

const sample = (frameTimeMilliseconds: number): SurfacePlayDebugFrameSample => Object.freeze({
  frameTimeMilliseconds,
  fixedSteps: 2,
  pendingElapsedSeconds: 0.004,
  snapshot: snapshot(),
  backendDiagnostics: diagnostics()
});

describe("Surface Play debug overlay", () => {
  it("starts hidden, projects read-only runtime/backend facts, and keeps a bounded rolling graph", () => {
    const documentPort = new FakeDocument();
    const host = new FakeElement("main");
    const overlay = createSurfacePlayDebugOverlay({
      host: host as unknown as HTMLElement,
      documentPort: documentPort as unknown as Document,
      historyLimit: 3
    });
    const byId = (id: string): FakeElement =>
      descendants(host).find((element) => element.id === id)!;

    expect(byId("surface-play-debug-overlay").hidden).toBe(true);
    expect(byId("surface-play-debug-overlay").dataset.visible).toBe("false");
    expect(overlay.isVisible()).toBe(false);
    overlay.update(sample(10));
    overlay.update(sample(20));
    overlay.update(sample(30));
    overlay.update(sample(40));
    expect(byId("surface-play-debug-overlay").dataset.sampleCount).toBe("3");

    const originalElementCount = descendants(host).length;
    overlay.toggle();
    expect(overlay.isVisible()).toBe(true);
    expect(byId("surface-play-debug-overlay").hidden).toBe(false);
    expect(byId("surface-play-debug-fps").textContent).toBe("FPS 33.3");
    expect(byId("surface-play-debug-frametime").textContent)
      .toBe("FRAME 40.00 MS | AVG 30.00 | P50 30.00 | P95 40.00 | MAX 40.00");
    expect(byId("surface-play-debug-runtime").textContent)
      .toBe("TICK 42 | FIXED 2 | ACC 2.50 MS | PENDING 4.00 MS");
    expect(byId("surface-play-debug-player").textContent)
      .toBe("POS -1.00, 2.00, 3.00 | VEL 4.00, -5.00, 6.00 | GROUNDED");
    expect(byId("surface-play-debug-world").textContent).toBe("WORLD R7 | REGION R8");
    expect(byId("surface-play-debug-bodies").textContent)
      .toBe("STRUCTURAL BODIES 2 | FALLING 1 | RESTING 1");
    expect(byId("surface-play-debug-representations").textContent)
      .toBe("REP RESIDENT 4 | VISIBLE 3 | FALLBACK 1");
    expect(byId("surface-play-debug-backend").textContent)
      .toBe("CPU 1.00 MIB | GPU 2.00 MIB | REJECTED 5 | STALE 3");
    expect(byId("surface-play-debug-event").textContent)
      .toBe("EVENT StructuralHit @ TICK 41 | FIRE ACCEPTED Structural | VOXEL Applied");
    expect(byId("surface-play-debug-action").textContent)
      .toBe("ACTION TREE CUT PUBLISHED | REJECTION --");
    expect(byId("surface-play-debug-physics").textContent)
      .toBe("PHYSICS FAILURE NONE | CONTACTS -- | SUBSTEPS --");
    expect(byId("surface-play-debug-async").textContent)
      .toBe("ASYNC UNAVAILABLE | QUEUE -- | LATENCY --");

    const line = byId("surface-play-debug-frametime-line");
    expect(line.getAttribute("points")?.trim().split(/\s+/)).toHaveLength(3);
    for (let index = 0; index < 20; index += 1) overlay.update(sample(16 + index));
    expect(byId("surface-play-debug-overlay").dataset.sampleCount).toBe("3");
    expect(descendants(host)).toHaveLength(originalElementCount);
    expect(line.getAttribute("points")?.trim().split(/\s+/)).toHaveLength(3);

    overlay.dispose();
    overlay.dispose();
    expect(overlay.isVisible()).toBe(false);
    expect(host.children).toHaveLength(0);
  });

  it("hard-clamps default, 120, and 121 history requests to the exported 120-sample maximum", () => {
    const documentPort = new FakeDocument();
    const requests = [undefined, 120, 121] as const;

    for (const historyLimit of requests) {
      const host = new FakeElement("main");
      const overlay = createSurfacePlayDebugOverlay({
        host: host as unknown as HTMLElement,
        documentPort: documentPort as unknown as Document,
        historyLimit
      });
      const root = descendants(host).find((element) => element.id === "surface-play-debug-overlay")!;
      for (let index = 0; index <= 120; index += 1) overlay.update(sample(index + 1));

      expect(root.dataset.historyLimit).toBe("120");
      expect(root.dataset.sampleCount).toBe("120");
      overlay.dispose();
    }
  });

  it("computes deterministic p50 frame time for odd and even finite histories", () => {
    const documentPort = new FakeDocument();
    const host = new FakeElement("main");
    const overlay = createSurfacePlayDebugOverlay({
      host: host as unknown as HTMLElement,
      documentPort: documentPort as unknown as Document,
      historyLimit: 4
    });
    const root = descendants(host).find((element) => element.id === "surface-play-debug-overlay")!;
    const frameTime = descendants(host).find((element) => element.id === "surface-play-debug-frametime")!;

    overlay.toggle();
    overlay.update(sample(30));
    overlay.update(sample(10));
    overlay.update(sample(20));
    expect(root.dataset.p50FrameMilliseconds).toBe("20.00");
    expect(frameTime.textContent).toContain("P50 20.00");

    overlay.update(sample(40));
    expect(root.dataset.p50FrameMilliseconds).toBe("25.00");
    expect(frameTime.textContent).toContain("P50 25.00");
    overlay.dispose();
  });

  it("observes and aggregates long tasks only while visible and disconnects idempotently", () => {
    const documentPort = new FakeDocument();
    const host = new FakeElement("main");
    const observers: Array<{
      readonly observe: ReturnType<typeof vi.fn>;
      readonly disconnect: ReturnType<typeof vi.fn>;
      emit(entries: readonly Readonly<{ entryType: string; duration: number }>[] | null): void;
    }> = [];
    const createLongTaskObserver = vi.fn((onEntries: (
      entries: readonly Readonly<{ entryType: string; duration: number }>[]
    ) => void) => {
      const observer = {
        observe: vi.fn(),
        disconnect: vi.fn(),
        emit: (entries: readonly Readonly<{ entryType: string; duration: number }>[] | null) => {
          if (entries !== null) onEntries(entries);
        }
      };
      observers.push(observer);
      return observer;
    });
    const overlay = createSurfacePlayDebugOverlay({
      host: host as unknown as HTMLElement,
      documentPort: documentPort as unknown as Document,
      createLongTaskObserver
    });
    const longTasks = descendants(host).find((element) => element.id === "surface-play-debug-long-tasks")!;

    expect(createLongTaskObserver).not.toHaveBeenCalled();
    overlay.toggle();
    expect(createLongTaskObserver).toHaveBeenCalledOnce();
    expect(observers[0]?.observe).toHaveBeenCalledOnce();
    expect(longTasks.textContent).toBe("LONG 0 | TOTAL 0.00 MS | MAX 0.00 MS");

    observers[0]?.emit([
      { entryType: "longtask", duration: 55 },
      { entryType: "resource", duration: 999 },
      { entryType: "longtask", duration: 15 }
    ]);
    expect(longTasks.textContent).toBe("LONG 2 | TOTAL 70.00 MS | MAX 55.00 MS");

    overlay.toggle();
    expect(observers[0]?.disconnect).toHaveBeenCalledOnce();
    observers[0]?.emit([{ entryType: "longtask", duration: 100 }]);
    expect(longTasks.textContent).toBe("LONG 2 | TOTAL 70.00 MS | MAX 55.00 MS");

    overlay.toggle();
    expect(createLongTaskObserver).toHaveBeenCalledTimes(2);
    overlay.dispose();
    overlay.dispose();
    expect(observers[1]?.disconnect).toHaveBeenCalledOnce();
  });

  it("reports explicit long-task and internal status fallbacks without inventing missing facts", () => {
    const documentPort = new FakeDocument();
    const host = new FakeElement("main");
    const overlay = createSurfacePlayDebugOverlay({
      host: host as unknown as HTMLElement,
      documentPort: documentPort as unknown as Document,
      createLongTaskObserver: () => null
    });
    const all = (): FakeElement[] => descendants(host);
    const unavailableSnapshot = Object.freeze({
      ...snapshot(),
      combat: Object.freeze({ events: Object.freeze([]), latestFireResult: null }),
      hud: Object.freeze({ latestAction: null, latestBlock: null }),
      presentation: Object.freeze({ structural: null }),
      latestVoxelTransition: null,
      latestRejection: null
    }) as unknown as SurfacePlayRuntimeSnapshot;

    overlay.toggle();
    overlay.update(Object.freeze({ ...sample(16), snapshot: unavailableSnapshot }));
    expect(all().find((element) => element.id === "surface-play-debug-long-tasks")?.textContent)
      .toBe("LONG UNSUPPORTED");
    expect(all().find((element) => element.id === "surface-play-debug-event")?.textContent)
      .toBe("EVENT -- | FIRE -- | VOXEL --");
    expect(all().find((element) => element.id === "surface-play-debug-action")?.textContent)
      .toBe("ACTION -- | REJECTION --");
    expect(all().find((element) => element.id === "surface-play-debug-physics")?.textContent)
      .toBe("PHYSICS UNAVAILABLE | CONTACTS -- | SUBSTEPS --");
    expect(all().find((element) => element.id === "surface-play-debug-async")?.textContent)
      .toBe("ASYNC UNAVAILABLE | QUEUE -- | LATENCY --");
    overlay.dispose();
  });

  it("projects private Prepared Fire diagnostics with explicit clock and payload boundaries", () => {
    const documentPort = new FakeDocument();
    const host = new FakeElement("main");
    const overlay = createSurfacePlayDebugOverlay({
      host: host as unknown as HTMLElement,
      documentPort: documentPort as unknown as Document
    });
      const fireTrace = {
      phase: "Fire",
      status: "Running",
      reason: null,
      objectId: "tree:diagnostic",
      sourceObjectRevision: 1,
      sourceEditRevision: 0,
      sourceContentHash: "hash:source",
      rootJobId: "root:diagnostic",
      workerEpoch: 2,
       runtime: {
         inputAcceptedAtMilliseconds: 1,
         queuedAtMilliseconds: 2,
         runningAtMilliseconds: 3,
         workerPreparationStateStartAtMilliseconds: 4,
         workerPreparationStateEndAtMilliseconds: 5,
         readyToAdoptAtMilliseconds: null,
         prewarmStartAtMilliseconds: null,
         prewarmWorkerPreparationStateStartAtMilliseconds: null,
         prewarmWorkerPreparationStateEndAtMilliseconds: null,
         prewarmEndAtMilliseconds: null,
         queueWaitDurationMilliseconds: 1,
         workerPreparationStateDurationMilliseconds: 1,
         fireDurationMilliseconds: null,
         prewarmWorkerPreparationStateDurationMilliseconds: null,
         prewarmDurationMilliseconds: null
       },
       main: {
         prepareSeedStartAtMilliseconds: 8,
         prepareSeedEndAtMilliseconds: 14,
         prepareSeedPostStartAtMilliseconds: 10,
         prepareSeedPostEndAtMilliseconds: 12,
         seedPreparedReceiptAtMilliseconds: 13,
         seedValidationCompleteAtMilliseconds: 14,
         executePostStartAtMilliseconds: null,
         executePostReturnedAtMilliseconds: null,
         firstResultOrReadyReceiptAtMilliseconds: null,
         executeReadyReceiptAtMilliseconds: null,
         executeValidationCompleteAtMilliseconds: null
       },
       worker: {
         clockDomain: "Worker",
         prepareSeed: {
           receiptAtMilliseconds: 20,
            computeStartedAtMilliseconds: 21,
             computeCompletedAtMilliseconds: 34,
             computeDurationMilliseconds: 13,
            constructSeed: { startAtMilliseconds: 21, endAtMilliseconds: 22, durationMilliseconds: 1 },
            materializeAndRetainPages: { startAtMilliseconds: 22, endAtMilliseconds: 24, durationMilliseconds: 2 },
            bindSeed: { startAtMilliseconds: 24, endAtMilliseconds: 29, durationMilliseconds: 5 },
            views: [
              { logicalViewName: "seed.authority", itemCount: 1, byteLength: 40, pageCount: 1, decodeDurationMilliseconds: 1 },
              { logicalViewName: "seed.collision", itemCount: 1, byteLength: 30, pageCount: 1, decodeDurationMilliseconds: 2 },
              { logicalViewName: "seed.existingBodySourceFacts", itemCount: 0, byteLength: 0, pageCount: 0, decodeDurationMilliseconds: 0 },
              { logicalViewName: "seed.physicsImmutable", itemCount: 0, byteLength: 0, pageCount: 0, decodeDurationMilliseconds: 0 },
              { logicalViewName: "seed.physicsDynamicState", itemCount: 1, byteLength: 26, pageCount: 1, decodeDurationMilliseconds: 1 }
            ],
            authority: {
              treeAndObjectCanonicalValidation: { startAtMilliseconds: 25, endAtMilliseconds: 26, durationMilliseconds: 1 },
              structuralConnectivity: { startAtMilliseconds: 26, endAtMilliseconds: 27, durationMilliseconds: 1 },
              structuralMass: { startAtMilliseconds: 27, endAtMilliseconds: 28, durationMilliseconds: 1 },
              authorityPublicationAndFinalCompare: { startAtMilliseconds: 28, endAtMilliseconds: 29, durationMilliseconds: 1 }
            },
            collision: {
              collisionCanonicalValidation: { startAtMilliseconds: 29, endAtMilliseconds: 30, durationMilliseconds: 1 },
              collisionPublicationAndIndex: { startAtMilliseconds: 30, endAtMilliseconds: 31, durationMilliseconds: 1 }
            },
            facts: {
              authority: { brickCount: 3, occupiedCellCount: 12, anchorCount: 1, jointCount: 1 },
              connectivity: null,
              mass: { occupiedVoxelCount: 12 },
              collision: null,
              physics: { terrainColliderCount: 0, bodyCount: 0 },
              colliderDerivation: "NotApplicableBodyFreeSeed"
            }
          },
          execute: {
            receiptAtMilliseconds: 30,
            computeStartedAtMilliseconds: 31,
            computeCompletedAtMilliseconds: 34,
            computeDurationMilliseconds: 3
          },
         },
       seedCanonicalBytes: 96,
       resultCanonicalBytes: null,
       structuredCloneBytes: null,
       canonicalBytesBasis: "ManifestDescriptorByteLengthSum",
         publication: { status: "Unavailable" }
      };
      const warmTrace = {
        ...fireTrace,
        phase: "WarmSeed" as const,
        status: "Running" as const,
        rootJobId: null,
        workerEpoch: null
      };
      const diagnosticSnapshot = Object.freeze({
        ...snapshot(),
        preparedStructuralFireDiagnostics: Object.freeze({
          current: warmTrace,
          lastCompleted: {
            ...fireTrace,
            status: "ReadyToAdopt",
            reason: "FixedTickAdoptionUnavailable",
            runtime: {
              ...fireTrace.runtime,
              readyToAdoptAtMilliseconds: 42
            }
          }
       })
     }) as unknown as SurfacePlayRuntimeSnapshot;
     overlay.toggle();
     overlay.update(Object.freeze({ ...sample(16), snapshot: diagnosticSnapshot }));
     const text = descendants(host).find((element) => element.id === "surface-play-debug-prepared-fire")
       ?.textContent;
      expect(text).toContain("CURRENT WARMSEED RUNNING");
     expect(text).toContain("RUNTIME INPUT 1.00 MS QUEUE 2.00 MS RUNNING 3.00 MS");
     expect(text).toContain("MAIN PREPARE SEED START 8.00 MS END 14.00 MS");
     expect(text).toContain("POST START 10.00 MS RETURN 12.00 MS");
      expect(text).toContain("SEED CANONICAL 96 B");
      expect(text).toContain("RESULT CANONICAL -- B");
      expect(text).toContain("CANONICAL BASIS ManifestDescriptorByteLengthSum (MANIFEST DESCRIPTOR BYTE LENGTH SUM)");
      expect(text).toContain("CLONE BYTES UNAVAILABLE");
       expect(text).toContain("WORKER DOMAIN (CLOCKS NOT COMPARABLE)");
       expect(text).toContain("WORKER EXECUTE RECEIPT 30.00 MS START 31.00 MS END 34.00 MS DURATION 3.00 MS");
       expect(text).toContain("SUBPHASES CONSTRUCT 1.00 MS MATERIALIZE 2.00 MS BIND 5.00 MS");
       expect(text).toContain("VIEWS seed.authority I1 B40 P1 D1.00");
       expect(text).toContain("COLLIDER N/A BODY-FREE");
       expect(text).toContain("LAST FIRE READYTOADOPT");
     expect(text).toContain("TERMINAL REASON FixedTickAdoptionUnavailable");
     expect(text).toContain("ADOPTION UNAVAILABLE FixedTickAdoptionUnavailable");
     expect(text).toContain("PUBLISH UNAVAILABLE");
    overlay.dispose();
  });
});
