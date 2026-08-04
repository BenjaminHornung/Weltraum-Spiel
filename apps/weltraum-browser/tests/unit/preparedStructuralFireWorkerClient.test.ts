import { beforeAll, describe, expect, it } from "vitest";
import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  hashAdaptiveCanonical
} from "../../src/voxel/adaptive";
import { getStructuralVoxel } from "../../src/voxel/structural";
import {
  type HostToWorkerMessage,
  type WorkerToHostMessage,
  type WorkerTransport
} from "../../src/workers";
import { createSurfaceRigidBodyWorld } from "../../src/surface-play/physics";
import { quantizeSurfaceHitCoordinateMeters } from "../../src/surface-play/surfacePlayQuantization";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeAuthority,
  deriveSurfaceTreeCanonicalHit,
  projectSurfaceTreeAuthoritySnapshotTransport,
  type SurfaceTreeAuthoritySnapshot
} from "../../src/surface-play/vegetation/surfaceTreeAuthority";
import {
  prepareSurfaceTreeFire,
  type SurfaceTreePreparedFire
} from "../../src/surface-play/vegetation/surfaceTreePreparedFire";
import {
  createSurfaceTreePreparedFireWorkerRunInput,
  createSurfaceTreeRuntimeStateFromAuthority,
  preflightSurfaceTreeFire,
  type SurfaceTreeRuntimeState
} from "../../src/surface-play/vegetation/surfaceTreeRuntime";
import {
  type PreparedStructuralFireCanonicalItem,
  type PreparedStructuralFireHash,
  type PreparedStructuralFireLogicalViewName
} from "../../src/surface-play/workers/preparedStructuralFireWire";
import {
  createPreparedStructuralFireCanonicalItemSource,
  createPreparedStructuralFireCommand,
  createPreparedStructuralFireLogicalViewDescriptor,
  createPreparedStructuralFireLogicalViewFacts,
  createPreparedStructuralFirePageEnvelope,
  createPreparedStructuralFirePhysicalPageFacts,
  createPreparedStructuralFireRequest,
  createPreparedStructuralFireSeedManifest,
  hashPreparedStructuralFireCanonical,
  preparedStructuralFireSeedHash,
  streamPreparedStructuralFireLogicalView,
  streamPreparedStructuralFirePages,
  validatePreparedStructuralFireReadyAgainstRequest
} from "../../src/surface-play/workers/preparedStructuralFireWireCodec";
import {
  PreparedStructuralFireDedicatedWorkerRuntime
} from "../../src/surface-play/workers/preparedStructuralFireWorker";
import {
  PreparedStructuralFireWorkerClient,
  type PreparedStructuralFireWorkerClientInput
} from "../../src/surface-play/workers/preparedStructuralFireWorkerClient";

class InProcessPreparedWorkerTransport implements WorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly privateInputKinds: string[] = [];
  readonly privateOutputKinds: string[] = [];
  readonly heldExecuteMessages: HostToWorkerMessage[] = [];
  failNextExecute = false;
  holdExecute = false;
  abortOnFirstPreparedResult: (() => void) | undefined;
  corruptNextReady = false;
  corruptNextRefused = false;
  corruptNextWorkerDiagnostics = false;
  corruptWorkerDiagnosticsKind: "SeedPrepared" | "Ready" | "Refused" | undefined = undefined;
  corruptNextSeedPreparedInput = false;
  corruptNextTimingHierarchy = false;
  corruptNextDiagnosticGroupOrdering = false;
  capturedSeedPreparedPayload: unknown | undefined = undefined;
  replaySeedPreparedPayload: unknown | undefined = undefined;
  replayNextSeedPrepared = false;
  terminated = false;
  readonly runtime: PreparedStructuralFireDedicatedWorkerRuntime;

  constructor(private readonly now: () => number = () => performance.now()) {
    this.runtime = new PreparedStructuralFireDedicatedWorkerRuntime((message, transfer = []) => {
    let outgoing: WorkerToHostMessage = message;
    if (message.type === "PreparedStructuralFirePrivateOutput"
      && typeof message.payload === "object"
      && message.payload !== null
      && "kind" in message.payload
      && message.payload.kind === "SeedPrepared") {
      if (this.replayNextSeedPrepared && this.replaySeedPreparedPayload !== undefined) {
        this.replayNextSeedPrepared = false;
        outgoing = {
          ...message,
          payload: structuredClone(this.replaySeedPreparedPayload)
        } as WorkerToHostMessage;
      } else {
        this.capturedSeedPreparedPayload = structuredClone(message.payload);
      }
    }
    if (message.type === "PreparedStructuralFirePrivateOutput"
      && this.corruptNextReady
      && typeof message.payload === "object"
      && message.payload !== null
      && "kind" in message.payload
      && message.payload.kind === "Ready"
      && "ready" in message.payload) {
      this.corruptNextReady = false;
      const payload = message.payload as {
        readonly kind: "Ready";
        readonly ready: {
          readonly receipt: { readonly receiptHash: PreparedStructuralFireHash };
        };
      };
      outgoing = {
        ...message,
        payload: {
          ...payload,
          ready: {
            ...payload.ready,
            receipt: {
              ...payload.ready.receipt,
              receiptHash: hashPreparedStructuralFireCanonical(
                "prepared-client-test/tamper/v1",
                { value: 1 }
              )
            }
          }
        }
      };
    }
    if (message.type === "PreparedStructuralFirePrivateOutput"
      && this.corruptNextRefused
      && typeof message.payload === "object"
      && message.payload !== null
      && "kind" in message.payload
      && message.payload.kind === "Refused") {
      this.corruptNextRefused = false;
      outgoing = { ...message, payload: { kind: "Refused" } };
    }
    if (message.type === "PreparedStructuralFirePrivateOutput"
      && this.corruptNextWorkerDiagnostics
      && typeof message.payload === "object"
      && message.payload !== null
      && "kind" in message.payload
      && (message.payload.kind === "SeedPrepared"
        || message.payload.kind === "Ready"
        || message.payload.kind === "Refused")
      && (this.corruptWorkerDiagnosticsKind === undefined
        || this.corruptWorkerDiagnosticsKind === message.payload.kind)
      && "workerDiagnostics" in message.payload) {
      this.corruptNextWorkerDiagnostics = false;
      this.corruptWorkerDiagnosticsKind = undefined;
      const payload = message.payload as {
        readonly kind: "SeedPrepared" | "Ready" | "Refused";
        readonly workerDiagnostics?: Readonly<Record<string, unknown>>;
      };
      outgoing = {
        ...message,
        payload: {
          ...payload,
          workerDiagnostics: {
            ...(payload.workerDiagnostics ?? {}),
            execute: {}
          }
        }
      };
    }
    if (message.type === "PreparedStructuralFirePrivateOutput"
      && this.corruptNextSeedPreparedInput
      && typeof message.payload === "object"
      && message.payload !== null
      && "kind" in message.payload
      && message.payload.kind === "SeedPrepared") {
      this.corruptNextSeedPreparedInput = false;
      const payload = message.payload as {
        readonly kind: "SeedPrepared";
        readonly input: Readonly<Record<string, unknown>>;
      };
      outgoing = {
        ...message,
        payload: {
          ...payload,
          input: { ...payload.input, unexpected: true }
        }
      } as WorkerToHostMessage;
    }
    if (message.type === "PreparedStructuralFirePrivateOutput"
      && this.corruptNextDiagnosticGroupOrdering
      && typeof message.payload === "object"
      && message.payload !== null
      && "kind" in message.payload
      && message.payload.kind === "SeedPrepared"
      && "workerDiagnostics" in message.payload
      && message.payload.workerDiagnostics !== undefined) {
      this.corruptNextDiagnosticGroupOrdering = false;
      const payload = message.payload as {
        readonly kind: "SeedPrepared";
        readonly workerDiagnostics: Readonly<Record<string, unknown>> & {
          readonly prepareSeed: Readonly<Record<string, unknown>>;
        };
      };
      const prepareSeed = payload.workerDiagnostics.prepareSeed;
      const authority = prepareSeed.authority as Readonly<Record<string, unknown>>;
      const authoritySpan = authority.treeAndObjectCanonicalValidation as Readonly<Record<string, number>>;
      const start = authoritySpan.startAtMilliseconds;
      const end = authoritySpan.endAtMilliseconds;
      outgoing = {
        ...message,
        payload: {
          ...payload,
          workerDiagnostics: {
            ...payload.workerDiagnostics,
            prepareSeed: {
              ...prepareSeed,
              collision: {
                ...(prepareSeed.collision as Readonly<Record<string, unknown>>),
                collisionCanonicalValidation: {
                  startAtMilliseconds: start,
                  endAtMilliseconds: end,
                  durationMilliseconds: end - start
                },
                collisionPublicationAndIndex: {
                  startAtMilliseconds: end,
                  endAtMilliseconds: end,
                  durationMilliseconds: 0
                }
              }
            }
          }
        }
      } as WorkerToHostMessage;
    }
    if (message.type === "PreparedStructuralFirePrivateOutput"
      && this.corruptNextTimingHierarchy
      && typeof message.payload === "object"
      && message.payload !== null
      && "kind" in message.payload
      && message.payload.kind === "SeedPrepared"
      && "workerDiagnostics" in message.payload
      && message.payload.workerDiagnostics !== undefined) {
      this.corruptNextTimingHierarchy = false;
      const payload = message.payload as {
        readonly kind: "SeedPrepared";
        readonly workerDiagnostics: Readonly<Record<string, unknown>> & {
          readonly prepareSeed: Readonly<Record<string, unknown>>;
        };
      };
      const prepareSeed = payload.workerDiagnostics.prepareSeed;
      const construct = prepareSeed.constructSeed as Readonly<Record<string, unknown>>;
      const start = construct.startAtMilliseconds as number;
      const end = construct.endAtMilliseconds as number;
      outgoing = {
        ...message,
        payload: {
          ...payload,
          workerDiagnostics: {
            ...payload.workerDiagnostics,
            prepareSeed: {
              ...prepareSeed,
              materializeAndRetainPages: {
                startAtMilliseconds: start,
                endAtMilliseconds: end,
                durationMilliseconds: end - start
              }
            }
          }
        }
      } as WorkerToHostMessage;
    }
    const copy = structuredClone(outgoing, { transfer: [...transfer] }) as WorkerToHostMessage;
    queueMicrotask(() => {
      if (copy.type === "PreparedStructuralFirePrivateOutput"
        && typeof copy.payload === "object"
        && copy.payload !== null
        && "kind" in copy.payload
         && typeof copy.payload.kind === "string") {
        this.privateOutputKinds.push(copy.payload.kind);
      }
      this.onmessage?.({ data: copy } as MessageEvent<unknown>);
    });
    if (message.type === "PreparedStructuralFirePrivateOutput"
      && typeof message.payload === "object"
      && message.payload !== null
      && "kind" in message.payload
      && message.payload.kind === "PreparedResultPage") {
      const abort = this.abortOnFirstPreparedResult;
      this.abortOnFirstPreparedResult = undefined;
      abort?.();
    }
    }, this.now);
  }

  postMessage(message: HostToWorkerMessage, transfer: Transferable[] = []): void {
    if (this.terminated) throw new Error("Prepared test transport is terminated.");
    let copy = structuredClone(message, { transfer }) as HostToWorkerMessage;
    if (copy.type === "PreparedStructuralFirePrivateInput"
      && typeof copy.payload === "object"
      && copy.payload !== null
      && "kind" in copy.payload
      && copy.payload.kind === "ExecuteCommand"
      && this.failNextExecute) {
      this.failNextExecute = false;
      const payload = copy.payload as {
        readonly kind: "ExecuteCommand";
        readonly control: Readonly<Record<string, unknown>>;
      };
      copy = {
        ...copy,
        payload: {
          ...payload,
          control: { ...payload.control, dispatchIndex: -1 }
        }
      } as HostToWorkerMessage;
    }
    if (copy.type === "PreparedStructuralFirePrivateInput"
      && typeof copy.payload === "object"
      && copy.payload !== null
      && "kind" in copy.payload
      && typeof copy.payload.kind === "string") {
      this.privateInputKinds.push(copy.payload.kind);
      if (copy.payload.kind === "ExecuteCommand" && this.holdExecute) {
        this.heldExecuteMessages.push(copy);
        return;
      }
    }
    queueMicrotask(() => this.runtime.handleMessage(copy));
  }

  releaseExecute(): void {
    const messages = this.heldExecuteMessages.splice(0);
    for (const message of messages) queueMicrotask(() => this.runtime.handleMessage(message));
  }

  triggerError(message = "Synthetic Prepared worker fault."): void {
    this.onerror?.({ message } as ErrorEvent);
  }

  terminate(): void {
    this.terminated = true;
  }
}

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for Prepared worker test state.");
};

const physicsWorld = () => createSurfaceRigidBodyWorld({
  simulationTick: 0,
  gravityMetersPerSecondSquared: 9.81,
  terrainColliders: []
});

const runtimeState = (authority: SurfaceTreeAuthoritySnapshot) =>
  createSurfaceTreeRuntimeStateFromAuthority(authority, physicsWorld());

const preparedInput = (
  state: Readonly<SurfaceTreeRuntimeState>,
  fireCommandId: string,
  ordinal = 0
) => {
  const canonicalHit = deriveSurfaceTreeCanonicalHit(state.authority, ordinal);
  const voxel = getStructuralVoxel(state.authority.object, canonicalHit.address);
  const hit = Object.freeze({
    address: canonicalHit.address,
    globalQuantum: Object.freeze({
      x: quantizeSurfaceHitCoordinateMeters(canonicalHit.pointMeters.x)
        / MICROVOXEL_BASE_QUANTUM_METERS,
      y: quantizeSurfaceHitCoordinateMeters(canonicalHit.pointMeters.y)
        / MICROVOXEL_BASE_QUANTUM_METERS,
      z: quantizeSurfaceHitCoordinateMeters(canonicalHit.pointMeters.z)
        / MICROVOXEL_BASE_QUANTUM_METERS
    }),
    pointMeters: canonicalHit.pointMeters,
    normal: Object.freeze({ x: -1, y: 0, z: 0 }),
    materialId: voxel?.materialId ?? canonicalHit.materialId
  });
  const value = Object.freeze({
    authority: state.authority,
    collision: state.collision,
    physicsWorld: state.physicsWorld,
    bodySources: state.bodySources.map((source) => ({
      sourceObject: source.sourceObject,
      component: source.component,
      fragment: source.fragment,
      massProperties: source.massProperties,
      candidate: source.candidate,
      meshArtifactIsLazy:
        Object.getOwnPropertyDescriptor(source, "meshArtifact")?.get !== undefined
    })),
    fireCommandId,
    hit,
    simulationTick: 0
  });
  const prepared = prepareSurfaceTreeFire(value);
  if (prepared.status !== "Ready") {
    throw new Error(`Expected Prepared Fire fixture, received ${prepared.status}.`);
  }
  return Object.freeze({ value, prepared });
};

const privateWorkerView = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  items: readonly Readonly<PreparedStructuralFireCanonicalItem>[],
  viewOrdinal: number
) => {
  const openItems = () => items.map((item) =>
    createPreparedStructuralFireCanonicalItemSource(logicalViewName, item));
  const logical = createPreparedStructuralFireLogicalViewFacts(logicalViewName, openItems);
  const openBytes = () => streamPreparedStructuralFireLogicalView(logicalViewName, openItems);
  const physical = createPreparedStructuralFirePhysicalPageFacts(logical, "Seed", openBytes);
  return Object.freeze({
    logical,
    openBytes,
    descriptor: createPreparedStructuralFireLogicalViewDescriptor(
      viewOrdinal,
      logical,
      "Seed",
      physical
    )
  });
};

interface PreparedClientFixture {
  readonly state: SurfaceTreeRuntimeState;
  readonly prepared: Extract<SurfaceTreePreparedFire, { readonly status: "Ready" }>;
  readonly seedViews: readonly ReturnType<typeof privateWorkerView>[];
  readonly seedManifest: ReturnType<typeof createPreparedStructuralFireSeedManifest>;
  readonly seedHash: PreparedStructuralFireHash;
  readonly command: ReturnType<typeof createPreparedStructuralFireCommand>;
}

let fixture: PreparedClientFixture;

beforeAll(() => {
  const state = runtimeState(createSurfaceTreeAuthority(createHestiaUmbrellaTree()));
  const source = preparedInput(state, "prepared.client.command");
  const seedDefinitions = [
    ["seed.authority", [{
      key: "@",
      payload: projectSurfaceTreeAuthoritySnapshotTransport(state.authority)
    }]],
    ["seed.collision", [{ key: "@", payload: state.collision }]],
    ["seed.existingBodySourceFacts", []],
    ["seed.physicsImmutable", []],
    ["seed.physicsDynamicState", [{
      key: "0:world",
      payload: {
        kind: "World",
        simulationTick: state.physicsWorld.simulationTick,
        gravityMetersPerSecondSquared: state.physicsWorld.gravityMetersPerSecondSquared,
        terrainColliders: state.physicsWorld.terrainColliders,
        physicsFailure: state.physicsWorld.physicsFailure
      }
    }]]
  ] as const;
  const seedViews = seedDefinitions.map(([name, items], viewOrdinal) =>
    privateWorkerView(name, items, viewOrdinal));
  const seedManifest = createPreparedStructuralFireSeedManifest(
    seedViews.map((view) => view.descriptor)
  );
  const seedHash = preparedStructuralFireSeedHash(seedManifest);
  const command = createPreparedStructuralFireCommand({
    seedHash,
    fireCommandId: source.value.fireCommandId,
    structuralCommandId: source.prepared.structuralCommandId,
    hit: source.value.hit,
    simulationTick: source.value.simulationTick
  });
  fixture = Object.freeze({
    state,
    prepared: source.prepared,
    seedViews,
    seedManifest,
    seedHash,
    command
  });
}, 120_000);

const clientInput = (
  nonce: string,
  includeSeed: boolean
): PreparedStructuralFireWorkerClientInput => {
  const request = createPreparedStructuralFireRequest({
    seedHash: fixture.seedHash,
    commandHash: fixture.command.commandHash,
    callerNonce: nonce,
    source: {
      objectId: fixture.state.authority.objectId,
      objectRevision: fixture.state.authority.objectRevision,
      editRevision: fixture.state.authority.editRevision,
      contentHash: fixture.state.authority.objectContentHash as PreparedStructuralFireHash
    },
    activationTick: 0,
    deadlineTick: 60
  });
  return Object.freeze({
    request,
    command: fixture.command,
    previousChainHash: hashAdaptiveCanonical({
      schemaVersion: "prepared-client-test-previous-chain-v1",
      nonce
    }) as PreparedStructuralFireHash,
    ...(includeSeed ? {
      seed: Object.freeze({
        manifest: fixture.seedManifest,
        openPages: function* (workerEpoch: number) {
          for (const view of fixture.seedViews) {
            for (const page of streamPreparedStructuralFirePages(
              view.logical,
              "Seed",
              view.openBytes
            )) {
              yield createPreparedStructuralFirePageEnvelope(
                request,
                workerEpoch,
                page.header,
                page.bytes
              );
            }
          }
        }
      })
    } : {})
  });
};

const currentSource = () => ({
  objectId: fixture.state.authority.objectId,
  objectRevision: fixture.state.authority.objectRevision,
  editRevision: fixture.state.authority.editRevision,
  contentHash: fixture.state.authority.objectContentHash as PreparedStructuralFireHash
});

const preparationHit = (state = fixture.state) => {
  const cell = state.collision.cells[0];
  if (cell === undefined) throw new Error("Expected a Prepared Fire collision cell.");
  return Object.freeze({
    address: cell.address,
    materialId: cell.materialId,
    semanticKey: cell.semanticKey,
    pointMeters: Object.freeze({
      x: (cell.minMeters.x + cell.maxMeters.x) / 2,
      y: (cell.minMeters.y + cell.maxMeters.y) / 2,
      z: (cell.minMeters.z + cell.maxMeters.z) / 2
    }),
    normal: Object.freeze({ x: 0, y: 1, z: 0 })
  });
};

describe("Prepared Structural Fire private V2 worker client", () => {
  it("records synchronous Main post brackets, manifest byte sums, and Worker-domain facts", async () => {
    let clockMilliseconds = 1_000;
    const clock = () => {
      clockMilliseconds += 1;
      return clockMilliseconds;
    };
    const transport = new InProcessPreparedWorkerTransport(clock);
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      now: clock,
      transportFactory: () => transport
    });
    const prepareDiagnostics: unknown[] = [];
    const runDiagnostics: unknown[] = [];
    await client.start();
    try {
      const prepared = await client.prepareSeed({
        state: fixture.state,
        input: {
          fireCommandId: "prepared.client.diagnostics",
          hit: preparationHit(),
          simulationTick: 0
        }
      }, { observeDiagnostics: (diagnostics) => prepareDiagnostics.push(diagnostics) });
      expect(prepared.state).toBe("Prepared");
      if (prepared.state !== "Prepared" || prepared.input.seedManifest === undefined) {
        throw new Error("Expected a retained Prepared Fire seed.");
      }
      const preparedObservation = prepareDiagnostics.at(-1) as {
        readonly main: {
          readonly prepareSeedPostStartAtMilliseconds: number | null;
          readonly prepareSeedPostEndAtMilliseconds: number | null;
          readonly seedPreparedReceiptAtMilliseconds: number | null;
          readonly seedValidationCompleteAtMilliseconds: number | null;
        };
        readonly worker: {
          readonly clockDomain: "Worker";
          readonly prepareSeed: { readonly computeDurationMilliseconds: number } | null;
        } | null;
        readonly seedCanonicalBytes: number | null;
        readonly structuredCloneBytes: null;
      };
      expect(preparedObservation.main.prepareSeedPostStartAtMilliseconds)
        .toBeLessThan(preparedObservation.main.prepareSeedPostEndAtMilliseconds!);
      expect(preparedObservation.main.prepareSeedPostEndAtMilliseconds)
        .toBeLessThanOrEqual(preparedObservation.main.seedPreparedReceiptAtMilliseconds!);
      expect(preparedObservation.main.seedPreparedReceiptAtMilliseconds)
        .toBeLessThanOrEqual(preparedObservation.main.seedValidationCompleteAtMilliseconds!);
      expect(preparedObservation.worker?.clockDomain).toBe("Worker");
      expect(preparedObservation.worker?.prepareSeed?.computeDurationMilliseconds).toBeGreaterThanOrEqual(0);
      expect(preparedObservation.seedCanonicalBytes)
        .toBe(fixture.seedManifest.views.reduce((total, view) => total + view.byteLength, 0));
      expect(preparedObservation.structuredCloneBytes).toBeNull();
      const prepareSeedDetails = preparedObservation.worker?.prepareSeed as unknown as {
        readonly constructSeed: { readonly startAtMilliseconds: number | null; readonly endAtMilliseconds: number | null; readonly durationMilliseconds: number | null };
        readonly materializeAndRetainPages: { readonly startAtMilliseconds: number | null; readonly endAtMilliseconds: number | null; readonly durationMilliseconds: number | null };
        readonly bindSeed: { readonly startAtMilliseconds: number | null; readonly endAtMilliseconds: number | null; readonly durationMilliseconds: number | null };
        readonly views: readonly Readonly<{ readonly logicalViewName: string; readonly byteLength: number | null; readonly itemCount: number | null; readonly pageCount: number | null; readonly decodeDurationMilliseconds: number | null }>[];
        readonly facts: { readonly colliderDerivation: string; readonly physics: { readonly terrainColliderCount: number; readonly bodyCount: number }; readonly authority: { readonly brickCount: number; readonly occupiedCellCount: number; readonly anchorCount: number; readonly jointCount: number }; };
      };
      expect(prepareSeedDetails.views.map((view) => view.logicalViewName)).toEqual([
        "seed.authority",
        "seed.collision",
        "seed.existingBodySourceFacts",
        "seed.physicsImmutable",
        "seed.physicsDynamicState"
      ]);
      expect(prepareSeedDetails.views.reduce((total, view) => total + (view.byteLength ?? 0), 0))
        .toBe(preparedObservation.seedCanonicalBytes);
      expect(prepareSeedDetails.constructSeed.endAtMilliseconds)
        .toBeLessThanOrEqual(prepareSeedDetails.materializeAndRetainPages.startAtMilliseconds!);
      expect(prepareSeedDetails.materializeAndRetainPages.endAtMilliseconds)
        .toBeLessThanOrEqual(prepareSeedDetails.bindSeed.startAtMilliseconds!);
      expect(prepareSeedDetails.facts.authority).toMatchObject({ brickCount: expect.any(Number) });
      expect(prepareSeedDetails.facts.physics).toEqual({ terrainColliderCount: 0, bodyCount: 0 });
      expect(prepareSeedDetails.facts.colliderDerivation).toBe("NotApplicableBodyFreeSeed");

      const runInput = createSurfaceTreePreparedFireWorkerRunInput(fixture.state, {
        fireCommandId: "prepared.client.diagnostics.run",
        hit: preparationHit(),
        simulationTick: 1
      }, prepared.input.seedManifest);
      const result = await client.run(runInput, {
        readSource: currentSource,
        readTick: () => 1,
        observeDiagnostics: (diagnostics) => runDiagnostics.push(diagnostics)
      });
      expect(result.state).toBe("Completed");
      const runObservation = runDiagnostics.at(-1) as {
        readonly main: {
          readonly executePostStartAtMilliseconds: number | null;
          readonly executePostReturnedAtMilliseconds: number | null;
          readonly firstResultOrReadyReceiptAtMilliseconds: number | null;
          readonly executeReadyReceiptAtMilliseconds: number | null;
          readonly executeValidationCompleteAtMilliseconds: number | null;
        };
        readonly worker: {
          readonly clockDomain: "Worker";
          readonly execute: { readonly computeDurationMilliseconds: number } | null;
        } | null;
        readonly resultCanonicalBytes: number | null;
      };
      expect(runObservation.main.executePostStartAtMilliseconds)
        .toBeLessThan(runObservation.main.executePostReturnedAtMilliseconds!);
      expect(runObservation.main.executePostReturnedAtMilliseconds)
        .toBeLessThanOrEqual(runObservation.main.firstResultOrReadyReceiptAtMilliseconds!);
      expect(runObservation.main.firstResultOrReadyReceiptAtMilliseconds)
        .toBeLessThanOrEqual(runObservation.main.executeReadyReceiptAtMilliseconds!);
      expect(runObservation.main.executeReadyReceiptAtMilliseconds)
        .toBeLessThanOrEqual(runObservation.main.executeValidationCompleteAtMilliseconds!);
      expect(runObservation.worker?.clockDomain).toBe("Worker");
      expect(runObservation.worker?.execute?.computeDurationMilliseconds).toBeGreaterThanOrEqual(0);
      if (result.state !== "Completed") throw new Error("Expected completed Prepared Fire run.");
      expect(runObservation.resultCanonicalBytes)
        .toBe(result.ready.manifest.views.reduce((total, view) => total + view.byteLength, 0));
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("reuses a prepared seed for a later command tick without reposting state", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    await client.start();
    try {
      const cell = fixture.state.collision.cells[0];
      if (cell === undefined) throw new Error("Expected a Prepared Fire collision cell.");
      const hit = Object.freeze({
        address: cell.address,
        materialId: cell.materialId,
        semanticKey: cell.semanticKey,
        pointMeters: Object.freeze({
          x: (cell.minMeters.x + cell.maxMeters.x) / 2,
          y: (cell.minMeters.y + cell.maxMeters.y) / 2,
          z: (cell.minMeters.z + cell.maxMeters.z) / 2
        }),
        normal: Object.freeze({ x: 0, y: 1, z: 0 })
      });
      const prepareStartedAt = performance.now();
      const prepared = await client.prepareSeed({
        state: fixture.state,
        input: { fireCommandId: "prepared.client.prewarm", hit, simulationTick: 0 }
      });
      const prepareDurationMs = performance.now() - prepareStartedAt;
      expect(prepared.state).toBe("Prepared");
      if (prepared.state !== "Prepared" || prepared.input.seedManifest === undefined) {
        throw new Error("Expected a retained Prepared Fire seed.");
      }
      const input = createSurfaceTreePreparedFireWorkerRunInput(fixture.state, {
        fireCommandId: "prepared.client.tick-overlay",
        hit,
        simulationTick: 21
      }, prepared.input.seedManifest);
      const runStartedAt = performance.now();
      const result = await client.run(input, { readSource: currentSource, readTick: () => 21 });
      const runDurationMs = performance.now() - runStartedAt;
      console.info("prepared-fire-phase-probe", { prepareDurationMs, runDurationMs });
      expect(result.state).toBe("Completed");
      expect(input.command.simulationTick).toBe(21);
      expect(transport.privateInputKinds.filter((kind) => kind === "PrepareSeed"))
        .toHaveLength(1);
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("refuses a replayed SeedPrepared payload from a later revision, command, and tick", async () => {
    const captureTransport = new InProcessPreparedWorkerTransport();
    const captureClient = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => captureTransport
    });
    await captureClient.start();
    try {
      await expect(captureClient.prepareSeed({
        state: fixture.state,
        input: {
          fireCommandId: "prepared.client.replay.original",
          hit: preparationHit(),
          simulationTick: 0
        }
      })).resolves.toMatchObject({ state: "Prepared" });
    } finally {
      await captureClient.dispose();
    }
    expect(captureTransport.capturedSeedPreparedPayload).toBeDefined();

    const laterPreflight = preflightSurfaceTreeFire(fixture.state, {
      fireCommandId: "prepared.client.replay.revision",
      hit: preparationHit(),
      simulationTick: 1
    });
    expect(laterPreflight.status).toBe("Ready");
    if (laterPreflight.status !== "Ready") throw new Error("Expected a later prepared state.");

    const replayTransport = new InProcessPreparedWorkerTransport();
    replayTransport.replaySeedPreparedPayload = captureTransport.capturedSeedPreparedPayload;
    replayTransport.replayNextSeedPrepared = true;
    const replayClient = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => replayTransport
    });
    await replayClient.start();
    try {
      const replayed = await replayClient.prepareSeed({
        state: laterPreflight.state,
        input: {
          fireCommandId: "prepared.client.replay.later",
          hit: preparationHit(laterPreflight.state),
          simulationTick: 2
        }
      });
      expect(replayed).toMatchObject({ state: "Failed" });
      expect(replayClient.hasPreparedSeed(
        laterPreflight.state.authority.objectId,
        fixture.seedHash
      )).toBe(false);
    } finally {
      await replayClient.dispose();
    }
  }, 120_000);

  it("reports worker-local PrepareSeed timing on failure without mixing clock domains", async () => {
    let mainClockMilliseconds = 100;
    let workerClockMilliseconds = 10_000;
    const transport = new InProcessPreparedWorkerTransport(() => {
      workerClockMilliseconds += 10;
      return workerClockMilliseconds;
    });
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      now: () => {
        mainClockMilliseconds += 1;
        return mainClockMilliseconds;
      },
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const invalidState = Object.freeze({
        ...fixture.state,
        bodySources: Object.freeze([Object.freeze({})])
      }) as unknown as SurfaceTreeRuntimeState;
      const result = await client.prepareSeed({
        state: invalidState,
        input: {
          fireCommandId: "prepared.client.prepare-failure",
          hit: preparationHit(),
          simulationTick: 0
        }
      }, { observeDiagnostics: (value) => diagnostics.push(value) });
      expect(result).toMatchObject({ state: "Failed" });
      const observation = diagnostics.at(-1) as {
        readonly main: {
          readonly prepareSeedStartAtMilliseconds: number | null;
          readonly prepareSeedEndAtMilliseconds: number | null;
          readonly prepareSeedDurationMilliseconds: number | null;
        };
        readonly worker: {
          readonly clockDomain: "Worker";
          readonly prepareSeed: {
            readonly receiptAtMilliseconds: number;
            readonly computeStartedAtMilliseconds: number;
            readonly computeCompletedAtMilliseconds: number;
            readonly computeDurationMilliseconds: number;
          } | null;
        } | null;
      };
      const workerTiming = observation.worker?.prepareSeed;
      expect(observation.worker?.clockDomain).toBe("Worker");
      expect(workerTiming?.receiptAtMilliseconds).toBeGreaterThan(10_000);
      expect(workerTiming?.computeDurationMilliseconds).toBe(
        workerTiming === null || workerTiming === undefined
          ? undefined
          : workerTiming.computeCompletedAtMilliseconds - workerTiming.computeStartedAtMilliseconds
      );
      expect(observation.main.prepareSeedDurationMilliseconds).toBe(
        observation.main.prepareSeedStartAtMilliseconds === null
          || observation.main.prepareSeedEndAtMilliseconds === null
          ? null
          : observation.main.prepareSeedEndAtMilliseconds - observation.main.prepareSeedStartAtMilliseconds
      );
      expect(observation.main.prepareSeedStartAtMilliseconds).toBeLessThan(1_000);
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("reports only worker receipt timing for an Execute preflight refusal", async () => {
    let mainClockMilliseconds = 200;
    let workerClockMilliseconds = 20_000;
    const transport = new InProcessPreparedWorkerTransport(() => {
      workerClockMilliseconds += 10;
      return workerClockMilliseconds;
    });
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      now: () => {
        mainClockMilliseconds += 1;
        return mainClockMilliseconds;
      },
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const prepared = await client.prepareSeed({
        state: fixture.state,
        input: {
          fireCommandId: "prepared.client.execute-failure-seed",
          hit: preparationHit(),
          simulationTick: 0
        }
      });
      expect(prepared.state).toBe("Prepared");
      if (prepared.state !== "Prepared" || prepared.input.seedManifest === undefined) {
        throw new Error("Expected a retained Prepared Fire seed.");
      }
      transport.failNextExecute = true;
      const { seedManifest: _seedManifest, ...retainedInput } =
        createSurfaceTreePreparedFireWorkerRunInput(fixture.state, {
          fireCommandId: "prepared.client.execute-failure",
          hit: preparationHit(),
          simulationTick: 1
        }, prepared.input.seedManifest);
      const result = await client.run(retainedInput, {
        readSource: currentSource,
        readTick: () => 1,
        observeDiagnostics: (value) => diagnostics.push(value)
      });
      expect(result).toMatchObject({ state: "Failed" });
      const observation = diagnostics.at(-1) as {
        readonly main: {
          readonly executePostStartAtMilliseconds: number | null;
          readonly executePostReturnedAtMilliseconds: number | null;
        };
        readonly worker: {
          readonly clockDomain: "Worker";
          readonly execute: {
            readonly receiptAtMilliseconds: number;
            readonly computeStartedAtMilliseconds: number | null;
            readonly computeCompletedAtMilliseconds: number | null;
            readonly computeDurationMilliseconds: number | null;
          } | null;
        } | null;
      };
      const workerTiming = observation.worker?.execute;
      expect(observation.worker?.clockDomain).toBe("Worker");
      expect(workerTiming?.receiptAtMilliseconds).toBeGreaterThan(20_000);
      expect(workerTiming?.computeStartedAtMilliseconds).toBeNull();
      expect(workerTiming?.computeCompletedAtMilliseconds).toBeNull();
      expect(workerTiming?.computeDurationMilliseconds).toBeNull();
      expect(observation.main.executePostStartAtMilliseconds).toBeLessThan(1_000);
      expect(observation.main.executePostReturnedAtMilliseconds).toBeGreaterThanOrEqual(
        observation.main.executePostStartAtMilliseconds!
      );
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("keeps worker Execute timing when owner computation fails after its marker", async () => {
    let mainClockMilliseconds = 300;
    let workerClockMilliseconds = 30_000;
    const transport = new InProcessPreparedWorkerTransport(() => {
      workerClockMilliseconds += 10;
      return workerClockMilliseconds;
    });
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      now: () => {
        mainClockMilliseconds += 1;
        return mainClockMilliseconds;
      },
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const prepared = await client.prepareSeed({
        state: fixture.state,
        input: {
          fireCommandId: "prepared.client.execute-post-marker-seed",
          hit: preparationHit(),
          simulationTick: 0
        }
      });
      expect(prepared.state).toBe("Prepared");

      const invalidCommand = createPreparedStructuralFireCommand({
        seedHash: fixture.seedHash,
        fireCommandId: "prepared.client.execute-post-marker-failure",
        structuralCommandId: "prepared.client.execute-post-marker-structural",
        hit: Object.freeze({
          ...preparationHit(),
          normal: Object.freeze({ x: 0, y: 0, z: 0 })
        }),
        simulationTick: 1
      });
      const request = createPreparedStructuralFireRequest({
        seedHash: fixture.seedHash,
        commandHash: invalidCommand.commandHash,
        callerNonce: "00000000000000000000000000000009",
        source: currentSource(),
        activationTick: 0,
        deadlineTick: 60
      });
      const result = await client.run(Object.freeze({
        request,
        command: invalidCommand,
        previousChainHash: hashAdaptiveCanonical({
          schemaVersion: "prepared-client-test-post-marker-failure-v1"
        }) as PreparedStructuralFireHash
      }), {
        readSource: currentSource,
        readTick: () => 1,
        observeDiagnostics: (value) => diagnostics.push(value)
      });
      expect(result).toMatchObject({ state: "Failed" });
      const observation = diagnostics.at(-1) as {
        readonly worker: {
          readonly clockDomain: "Worker";
          readonly execute: {
            readonly receiptAtMilliseconds: number;
            readonly computeStartedAtMilliseconds: number | null;
            readonly computeCompletedAtMilliseconds: number | null;
            readonly computeDurationMilliseconds: number | null;
          } | null;
        } | null;
      };
      const workerTiming = observation.worker?.execute;
      expect(observation.worker?.clockDomain).toBe("Worker");
      expect(workerTiming?.receiptAtMilliseconds).toBeGreaterThan(30_000);
      expect(workerTiming?.computeStartedAtMilliseconds).toBeGreaterThan(30_000);
      expect(workerTiming?.computeCompletedAtMilliseconds).toBeGreaterThan(
        workerTiming?.computeStartedAtMilliseconds ?? Number.POSITIVE_INFINITY
      );
      expect(workerTiming?.computeDurationMilliseconds).toBe(
        workerTiming === null || workerTiming === undefined
          ? undefined
          : workerTiming.computeCompletedAtMilliseconds! - workerTiming.computeStartedAtMilliseconds!
      );
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("seeds one worker replica once and returns only a prepared result receipt", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    await client.start();
    try {
      const firstInput = clientInput("00000000000000000000000000000001", true);
      const first = await client.run(
        firstInput,
        { readSource: currentSource, readTick: () => 0 }
      );
      expect(first.state).toBe("Completed");
      if (first.state !== "Completed") throw new Error("First client run failed.");
      expect(first.ready.receipt).toMatchObject({
        rootJobId: first.ready.manifest.rootJobId,
        seedHash: fixture.seedHash,
        commandHash: fixture.command.commandHash
      });
      expect(first).not.toHaveProperty("deltaBytes");
      expect(client).not.toHaveProperty("confirmAdoption");
      const cloneSafeReady = structuredClone(first.ready);
      for (let warmup = 0; warmup < 10; warmup += 1) {
        validatePreparedStructuralFireReadyAgainstRequest(firstInput.request, cloneSafeReady, 0, 0);
      }
      const validationDurations = Array.from({ length: 100 }, () => {
        const startedAt = performance.now();
        validatePreparedStructuralFireReadyAgainstRequest(firstInput.request, cloneSafeReady, 0, 0);
        return performance.now() - startedAt;
      }).sort((left, right) => left - right);
      expect(validationDurations[94]).toBeLessThanOrEqual(4);
      expect(validationDurations[99]).toBeLessThanOrEqual(8);

      const second = await client.run(
        clientInput("00000000000000000000000000000002", false),
        { readSource: currentSource, readTick: () => 0 }
      );
      if (second.state !== "Completed") {
        throw new Error(`Second client run failed: ${JSON.stringify(second)}.`);
      }
      expect(transport.privateInputKinds.filter((kind) => kind === "BindSeed"))
        .toHaveLength(1);
      expect(client.readTelemetry()).toMatchObject({
        completedCount: 2,
        failedCount: 0,
        scheduler: { queueDepth: 0, inFlight: 0, completedCount: 2 }
      });
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("cancels promptly and rejects a late result against changed Main source facts", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    transport.holdExecute = true;
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    await client.start();
    try {
      const controller = new AbortController();
      const cancelledRun = client.run(
        clientInput("00000000000000000000000000000003", true),
        { readSource: currentSource, readTick: () => 0, signal: controller.signal }
      );
      await waitFor(() => transport.heldExecuteMessages.length === 1);
      controller.abort();
      await expect(cancelledRun).resolves.toEqual({ state: "Cancelled" });

      transport.heldExecuteMessages.splice(0);
      let changed = false;
      const staleRun = client.run(
        clientInput("00000000000000000000000000000004", true),
        {
          readSource: () => changed
            ? { ...currentSource(), editRevision: currentSource().editRevision + 1 }
            : currentSource(),
          readTick: () => 0
        }
      );
      await waitFor(() => transport.heldExecuteMessages.length === 1);
      changed = true;
      transport.releaseExecute();
      await expect(staleRun).resolves.toEqual({ state: "Stale" });
      expect(client.readTelemetry()).toMatchObject({ cancelledCount: 1, staleCount: 1 });
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("keeps the worker reusable when abort races a synchronous private derivation", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    await client.start();
    try {
      const controller = new AbortController();
      transport.abortOnFirstPreparedResult = () => controller.abort();
      await expect(client.run(
        clientInput("00000000000000000000000000000007", true),
        { readSource: currentSource, readTick: () => 0, signal: controller.signal }
      )).resolves.toEqual({ state: "Cancelled" });

      await waitFor(() => transport.privateOutputKinds.includes("Cancelled"));
      expect(transport.privateOutputKinds).toContain("Ready");
      expect(client.readTelemetry()).toMatchObject({
        cancelledCount: 1,
        failedCount: 0,
        scheduler: { queueDepth: 0, inFlight: 0 },
        pool: {
          runningJobs: 0,
          workerRestarts: 0,
          workers: [{ state: "Ready" }]
        }
      });

      const next = await client.run(
        clientInput("00000000000000000000000000000008", false),
        { readSource: currentSource, readTick: () => 0 }
      );
      expect(next.state).toBe("Completed");
      expect(client.readTelemetry()).toMatchObject({
        completedCount: 1,
        cancelledCount: 1,
        failedCount: 0,
        pool: { workerRestarts: 0 }
      });
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("fails closed on a clone-safe Ready tamper", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    transport.corruptNextReady = true;
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    await client.start();
    try {
      const result = await client.run(
        clientInput("00000000000000000000000000000005", true),
        { readSource: currentSource, readTick: () => 0 }
      );
      expect(result).toMatchObject({ state: "Failed" });
      if (result.state === "Failed") expect(result.reason).toMatch(/receipt|ready|invalid/i);
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("fails closed when a Refused output has no bounded reason", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    transport.failNextExecute = true;
    transport.corruptNextRefused = true;
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const result = await client.run(
        clientInput("00000000000000000000000000000009", true),
        {
          readSource: currentSource,
          readTick: () => 0,
          observeDiagnostics: (value) => diagnostics.push(value)
        }
      );
      expect(result).toEqual({ state: "Failed", reason: "Private worker output is invalid." });
      expect((diagnostics.at(-1) as { readonly worker: unknown }).worker).toBeNull();
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("drops malformed optional worker diagnostics without failing valid preparation", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    transport.corruptNextWorkerDiagnostics = true;
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const prepared = await client.prepareSeed({
        state: fixture.state,
        input: {
          fireCommandId: "prepared.client.invalid-diagnostics",
          hit: preparationHit(),
          simulationTick: 0
        }
      }, { observeDiagnostics: (value) => diagnostics.push(value) });
      expect(prepared.state).toBe("Prepared");
      expect((diagnostics.at(-1) as { readonly worker: unknown }).worker).toBeNull();
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("drops malformed optional worker diagnostics without changing a valid Ready result", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    transport.corruptNextWorkerDiagnostics = true;
    transport.corruptWorkerDiagnosticsKind = "Ready";
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const result = await client.run(
        clientInput("0000000000000000000000000000000a", true),
        {
          readSource: currentSource,
          readTick: () => 0,
          observeDiagnostics: (value) => diagnostics.push(value)
        }
      );
      expect(result.state).toBe("Completed");
      expect((diagnostics.at(-1) as { readonly worker: unknown }).worker).toBeNull();
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("drops malformed optional worker diagnostics without changing a valid Refused result", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    transport.failNextExecute = true;
    transport.corruptNextWorkerDiagnostics = true;
    transport.corruptWorkerDiagnosticsKind = "Refused";
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const result = await client.run(
        clientInput("0000000000000000000000000000000b", true),
        {
          readSource: currentSource,
          readTick: () => 0,
          observeDiagnostics: (value) => diagnostics.push(value)
        }
      );
      expect(result).toEqual({
        state: "Failed",
        reason: "dispatchIndex must be a non-negative safe integer."
      });
      expect((diagnostics.at(-1) as { readonly worker: unknown }).worker).toBeNull();
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("fails safely on malformed or excess SeedPrepared core input", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    transport.corruptNextSeedPreparedInput = true;
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const prepared = await client.prepareSeed({
        state: fixture.state,
        input: {
          fireCommandId: "prepared.client.invalid-seed-input",
          hit: preparationHit(),
          simulationTick: 0
        }
      }, { observeDiagnostics: (value) => diagnostics.push(value) });
      expect(prepared).toEqual({ state: "Failed", reason: "Private worker output is invalid." });
      expect((diagnostics.at(-1) as { readonly worker: unknown }).worker).toBeNull();
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("drops reordered or overlapping optional timing spans while keeping the response valid", async () => {
    const transport = new InProcessPreparedWorkerTransport();
    transport.corruptNextTimingHierarchy = true;
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const prepared = await client.prepareSeed({
        state: fixture.state,
        input: {
          fireCommandId: "prepared.client.invalid-timing-hierarchy",
          hit: preparationHit(),
          simulationTick: 0
        }
      }, { observeDiagnostics: (value) => diagnostics.push(value) });
      expect(prepared.state).toBe("Prepared");
      expect((diagnostics.at(-1) as { readonly worker: unknown }).worker).toBeNull();
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("drops optional diagnostics when authority and collision child groups overlap", async () => {
    let workerClock = 0;
    const transport = new InProcessPreparedWorkerTransport(() => {
      workerClock += 1;
      return workerClock;
    });
    transport.corruptNextDiagnosticGroupOrdering = true;
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const prepared = await client.prepareSeed({
        state: fixture.state,
        input: {
          fireCommandId: "prepared.client.invalid-diagnostic-groups",
          hit: preparationHit(),
          simulationTick: 0
        }
      }, { observeDiagnostics: (value) => diagnostics.push(value) });
      expect(prepared.state).toBe("Prepared");
      expect((diagnostics.at(-1) as { readonly worker: unknown }).worker).toBeNull();
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it.each([
    ["throws", () => { throw new Error("clock unavailable"); }],
    ["returns NaN", () => Number.NaN],
    ["moves backwards", (() => {
      const values = [100, 99, 101, 102, 103, 104, 105];
      return () => values.shift() ?? 106;
    })()]
  ])("keeps valid preparation when the Worker clock %s", async (_label, workerClock) => {
    const transport = new InProcessPreparedWorkerTransport(workerClock);
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => transport
    });
    const diagnostics: unknown[] = [];
    await client.start();
    try {
      const prepared = await client.prepareSeed({
        state: fixture.state,
        input: {
          fireCommandId: `prepared.client.clock-${_label}`,
          hit: preparationHit(),
          simulationTick: 0
        }
      }, { observeDiagnostics: (value) => diagnostics.push(value) });
      expect(prepared.state).toBe("Prepared");
      const worker = (diagnostics.at(-1) as {
        readonly worker: {
          readonly prepareSeed: {
            readonly computeStartedAtMilliseconds: number | null;
            readonly constructSeed: {
              readonly startAtMilliseconds: number | null;
              readonly endAtMilliseconds: number | null;
              readonly durationMilliseconds: number | null;
            };
          } | null;
        } | null;
      }).worker;
      expect(worker?.prepareSeed?.computeStartedAtMilliseconds === null
        || worker?.prepareSeed?.constructSeed.startAtMilliseconds === null
        || worker?.prepareSeed?.constructSeed.durationMilliseconds === null).toBe(true);
    } finally {
      await client.dispose();
    }
  }, 120_000);

  it("requires exactly one reseed after a worker restart", async () => {
    const transports: InProcessPreparedWorkerTransport[] = [];
    const events: string[] = [];
    const client = new PreparedStructuralFireWorkerClient({
      workerCount: 1,
      transportFactory: () => {
        const transport = new InProcessPreparedWorkerTransport();
        transports.push(transport);
        return transport;
      },
      observe: (event) => events.push(event.type)
    });
    await client.start();
    try {
      expect((await client.run(
        clientInput("00000000000000000000000000000006", true),
        { readSource: currentSource, readTick: () => 0 }
      )).state).toBe("Completed");
      transports[0].triggerError();
      await waitFor(() => transports.length === 2 && events.includes("WorkerRestarted"));

      await expect(client.run(
        clientInput("00000000000000000000000000000007", false),
        { readSource: currentSource, readTick: () => 0 }
      )).resolves.toEqual({
        state: "ResyncRequired",
        objectId: fixture.state.authority.objectId,
        reason: "WorkerReplicaRestarted"
      });
      expect((await client.run(
        clientInput("00000000000000000000000000000008", true),
        { readSource: currentSource, readTick: () => 0 }
      )).state).toBe("Completed");
      expect(transports.flatMap((transport) => transport.privateInputKinds)
        .filter((kind) => kind === "BindSeed")).toHaveLength(2);
    } finally {
      await client.dispose();
    }
  }, 120_000);
});
