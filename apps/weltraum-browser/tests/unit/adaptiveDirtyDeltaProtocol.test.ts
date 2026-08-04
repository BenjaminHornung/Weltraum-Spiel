import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES,
  canAdoptAdaptiveDirtyBrickDelta,
  createAdaptiveDirtyBrickDelta,
  hashAdaptiveDirtyBrickDelta,
  validateAdaptiveDirtyBrickDelta,
  validateAdaptiveDirtyBrickDeltaForAtomicAdoption,
  type AdaptiveDirtyBrickDelta,
  type CreateAdaptiveDirtyBrickDeltaInput
} from "../../src/voxel/adaptive/dirtyDeltaProtocol";
import {
  ADAPTIVE_MATERIALIZATION_VERSION,
  ADAPTIVE_MAX_RESIDENT_SUMMARIES,
  authorityRevision,
  ADAPTIVE_AUTHORITY_PROTOCOL,
  canonicalAdaptiveJson,
  createAdaptiveAuthoritySnapshot,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveBrickKey,
  createAdaptiveEdit,
  createAdaptiveEditJournal,
  hashAdaptiveCanonical,
  materializeAdaptiveBrick,
  stableAuthorityId,
  type AdaptiveAuthoritySnapshot,
  type AdaptiveEditRecord
} from "../../src/voxel/adaptive";
import { byteCount, contentRevision, fnv1aBytes, validateTransferableBundle } from "../../src/workers";

const key = (x: number) => createAdaptiveBrickKey({
  bodyId: "planet.test",
  surfaceFrameId: "frame.surface",
  regionId: "region.test",
  generatorVersion: "generator.v1",
  level: 4,
  originQuantum: { x, y: 0, z: 0 }
});

const baseField = createAdaptiveBaseFieldDescriptor({
  kind: "constant-v1",
  identity: stableAuthorityId("base.test"),
  version: stableAuthorityId("base.test.v1"),
  sourceRevision: authorityRevision(0),
  sample: { density: -1, occupancy: 1, materialId: stableAuthorityId("material.rock") }
});

const edit = (overrides: Partial<AdaptiveEditRecord> = {}): AdaptiveEditRecord => createAdaptiveEdit({
  editId: "edit.cut",
  sequence: 1,
  expectedRegionRevision: 0,
  resultRegionRevision: 1,
  actorId: "actor.test",
  sourceId: "tool.test",
  operation: "SubtractBox",
  box: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 2, z: 2 } },
  ...overrides
});

const authorityFixture = (): Readonly<{
  readonly snapshot: AdaptiveAuthoritySnapshot;
  readonly target: ReturnType<typeof materializeAdaptiveBrick>;
  readonly neighbor: ReturnType<typeof materializeAdaptiveBrick>;
}> => {
  const target = materializeAdaptiveBrick({ key: key(0), baseField, editJournal: createAdaptiveEditJournal([]) });
  const neighbor = materializeAdaptiveBrick({ key: key(16), baseField, editJournal: createAdaptiveEditJournal([]) });
  const snapshot = createAdaptiveAuthoritySnapshot({
    authorityId: "authority.test",
    revision: 0,
    bricks: [{ role: "target", brick: target }, { role: "neighbor", brick: neighbor }],
    orderedInputs: []
  });
  return { snapshot, target, neighbor };
};

const bundle = (revision = 1): Readonly<{
  readonly buffer: ArrayBuffer;
  readonly value: ReturnType<typeof validateTransferableBundle>;
}> => {
  const buffer = new ArrayBuffer(8);
  new Uint8Array(buffer).set([1, 2, 3, 4, 5, 6, 7, 8]);
  const value = validateTransferableBundle({
    ownership: "WorkerToConsumer",
    revision: contentRevision(revision),
    byteLength: byteCount(buffer.byteLength),
    buffers: [buffer],
    views: [
      { name: "density", bufferIndex: 0, kind: "Uint8Array", byteOffset: 0, elementCount: 4 },
      { name: "fragment", bufferIndex: 0, kind: "Uint8Array", byteOffset: 4, elementCount: 4 }
    ],
    contentHash: fnv1aBytes([buffer])
  });
  return { buffer, value };
};

const inputFor = (
  fixture = authorityFixture(),
  options: Readonly<{
    readonly targets?: CreateAdaptiveDirtyBrickDeltaInput["targets"];
    readonly neighborManifest?: CreateAdaptiveDirtyBrickDeltaInput["neighborManifest"];
    readonly changedChannels?: CreateAdaptiveDirtyBrickDeltaInput["changedChannels"];
    readonly fragments?: CreateAdaptiveDirtyBrickDeltaInput["fragments"];
    readonly payload?: CreateAdaptiveDirtyBrickDeltaInput["payload"];
    readonly byteLength?: number;
    readonly protocol?: CreateAdaptiveDirtyBrickDeltaInput["protocol"];
    readonly materializationVersion?: string;
    readonly predecessorRevision?: number;
    readonly predecessorHash?: string;
    readonly resultRevision?: number;
    readonly resultHash?: string;
    readonly workerEpoch?: number;
  }> = {}
): CreateAdaptiveDirtyBrickDeltaInput => {
  const targetHash = hashAdaptiveCanonical(fixture.target.key);
  const neighborHash = hashAdaptiveCanonical(fixture.neighbor.key);
  const predecessorRevision = options.predecessorRevision ?? fixture.snapshot.revision;
  const resultRevision = options.resultRevision ?? predecessorRevision + 1;
  const transfer = options.payload ?? bundle(resultRevision).value;
  return {
    authorityId: fixture.snapshot.authorityId,
    targets: options.targets ?? [{ key: fixture.target.key, role: "target", requiredNeighborKeyHashes: [neighborHash] }],
    neighborManifest: options.neighborManifest ?? [{ key: fixture.neighbor.key, role: "neighbor", relation: "face" }],
    changedChannels: options.changedChannels ?? [{ targetKeyHash: targetHash, channel: "density", viewName: "density" }],
    fragments: options.fragments ?? [{ targetKeyHash: targetHash, fragmentId: "fragment.cut", viewName: "fragment" }],
    predecessorRevision,
    predecessorHash: options.predecessorHash ?? fixture.snapshot.contentHash,
    resultRevision,
    resultHash: options.resultHash ?? hashAdaptiveCanonical({ result: "candidate" }),
    journalDigest: fixture.target.provenance.journalDigest,
    baseFieldDescriptorDigest: fixture.target.baseFieldDescriptorDigest,
    protocol: options.protocol ?? ADAPTIVE_AUTHORITY_PROTOCOL,
    materializationVersion: options.materializationVersion ?? ADAPTIVE_MATERIALIZATION_VERSION,
    edit: edit(),
    planningEpoch: 3,
    workerEpoch: options.workerEpoch ?? 4,
    rootJobId: "dirty-root",
    cancellationId: "cancel-1",
    payload: transfer,
    byteLength: options.byteLength ?? transfer.byteLength
  };
};

const contextFor = (delta: AdaptiveDirtyBrickDelta, predecessor: AdaptiveAuthoritySnapshot): Parameters<typeof canAdoptAdaptiveDirtyBrickDelta>[1] => ({
  predecessor,
  planningEpoch: delta.planningEpoch,
  workerEpoch: delta.workerEpoch,
  rootJobId: delta.rootJobId,
  cancellationId: delta.cancellationId,
  cancelled: false,
  expectedResultHash: delta.resultHash
});

describe("production-unwired Adaptive dirty delta contract", () => {
  it("canonicalizes target and descriptor ordering to one hash", () => {
    const fixture = authorityFixture();
    const first = createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      targets: [
        { key: fixture.neighbor.key, role: "neighbor", requiredNeighborKeyHashes: [] },
        { key: fixture.target.key, role: "target", requiredNeighborKeyHashes: [] }
      ],
      neighborManifest: [],
      changedChannels: [
        { targetKeyHash: hashAdaptiveCanonical(fixture.neighbor.key), channel: "occupancy", viewName: "density" },
        { targetKeyHash: hashAdaptiveCanonical(fixture.target.key), channel: "density", viewName: "fragment" }
      ],
      fragments: []
    }));
    const second = createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      targets: [...first.targets].reverse().map((target) => ({ key: target.key, role: target.role, requiredNeighborKeyHashes: [] })),
      neighborManifest: [],
      changedChannels: [...first.changedChannels].reverse(),
      fragments: []
    }));
    expect(canonicalAdaptiveJson({
      targets: first.targets,
      changedChannels: first.changedChannels,
      fragments: first.fragments
    })).toBe(canonicalAdaptiveJson({
      targets: second.targets,
      changedChannels: second.changedChannels,
      fragments: second.fragments
    }));
    expect(hashAdaptiveDirtyBrickDelta(first)).toBe(first.deltaHash);
    expect(second.deltaHash).toBe(first.deltaHash);
  });

  it("keeps generic physical buffer order and view indices in the payload commitment", () => {
    const fixture = authorityFixture();
    const firstBuffer = new ArrayBuffer(2);
    const secondBuffer = new ArrayBuffer(2);
    new Uint8Array(firstBuffer).set([1, 2]);
    new Uint8Array(secondBuffer).set([3, 4]);
    const transfer = (buffers: readonly ArrayBuffer[], densityBufferIndex: number, fragmentBufferIndex: number) =>
      validateTransferableBundle({
        ownership: "WorkerToConsumer",
        revision: contentRevision(1),
        byteLength: byteCount(4),
        buffers,
        views: [
          { name: "density", bufferIndex: densityBufferIndex, kind: "Uint8Array", byteOffset: 0, elementCount: 2 },
          { name: "fragment", bufferIndex: fragmentBufferIndex, kind: "Uint8Array", byteOffset: 0, elementCount: 2 }
        ],
        contentHash: fnv1aBytes(buffers)
      });
    const first = createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      payload: transfer([firstBuffer, secondBuffer], 0, 1)
    }));
    const reversed = createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      payload: transfer([secondBuffer, firstBuffer], 1, 0)
    }));

    expect(reversed.payloadHash).not.toBe(first.payloadHash);
    expect(reversed.deltaHash).not.toBe(first.deltaHash);
  });

  it("accepts one edit and one dirty brick with a complete seam-neighbor manifest", () => {
    const fixture = authorityFixture();
    const delta = createAdaptiveDirtyBrickDelta(inputFor(fixture));
    expect(validateAdaptiveDirtyBrickDeltaForAtomicAdoption(delta, contextFor(delta, fixture.snapshot))).toEqual(delta);
    expect(canAdoptAdaptiveDirtyBrickDelta(delta, contextFor(delta, fixture.snapshot))).toBe(true);
    expect(delta.byteLength).toBe(8);
    expect(delta.byteLength).toBeLessThanOrEqual(ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES);
  });

  it("returns frozen metadata without mutating or publishing authority", () => {
    const fixture = authorityFixture();
    const transfer = bundle();
    const before = canonicalAdaptiveJson(fixture.snapshot);
    const delta = createAdaptiveDirtyBrickDelta(inputFor(fixture, { payload: transfer.value }));
    const validated = validateAdaptiveDirtyBrickDelta(delta);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.targets)).toBe(true);
    expect(Object.isFrozen(validated.targets[0])).toBe(true);
    expect(Object.isFrozen(validated.changedChannels)).toBe(true);
    expect(Object.isFrozen(validated.payload)).toBe(true);
    expect(Object.isFrozen(validated.payload.views)).toBe(true);
    expect(Object.isFrozen(transfer.buffer)).toBe(false);
    expect(canonicalAdaptiveJson(fixture.snapshot)).toBe(before);
    expect(canAdoptAdaptiveDirtyBrickDelta(validated, contextFor(validated, fixture.snapshot))).toBe(true);
    expect(canonicalAdaptiveJson(fixture.snapshot)).toBe(before);
  });

  it("rejects stale, mismatched, incomplete, cancelled, and malformed deltas", () => {
    const fixture = authorityFixture();
    const delta = createAdaptiveDirtyBrickDelta(inputFor(fixture));
    const context = contextFor(delta, fixture.snapshot);
    const reject = (candidate: AdaptiveDirtyBrickDelta, candidateContext = context) =>
      expect(() => validateAdaptiveDirtyBrickDeltaForAtomicAdoption(candidate, candidateContext)).toThrow();

    reject(createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      predecessorRevision: 1,
      predecessorHash: hashAdaptiveCanonical({ predecessor: "stale" }),
      resultRevision: 2,
      payload: bundle(2).value
    })));
    reject(createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      predecessorHash: hashAdaptiveCanonical({ predecessor: "fork" })
    })));
    reject({ ...delta, authorityId: stableAuthorityId("authority.other") });
    reject({ ...delta, resultRevision: 2 });
    const wrongResult = createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      resultHash: hashAdaptiveCanonical({ result: "wrong" })
    }));
    reject(wrongResult);
    reject(delta, { ...context, expectedResultHash: hashAdaptiveCanonical({ result: "wrong-context" }) });
    for (const protocol of [
      { ...delta.protocol, schemaVersion: "wrong-schema" },
      { ...delta.protocol, derivationAlgorithmVersion: "wrong-derivation" },
      { ...delta.protocol, materialTableVersion: "wrong-material" }
    ]) reject({ ...delta, protocol } as unknown as AdaptiveDirtyBrickDelta);
    reject({ ...delta, materializationVersion: "wrong-materialization" } as unknown as AdaptiveDirtyBrickDelta);
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      targets: [
        { key: fixture.target.key, role: "target", requiredNeighborKeyHashes: [hashAdaptiveCanonical(fixture.neighbor.key)] },
        { key: fixture.target.key, role: "target", requiredNeighborKeyHashes: [hashAdaptiveCanonical(fixture.neighbor.key)] }
      ]
    }))).toThrow();
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, { neighborManifest: [] }))).toThrow();
    const missingTarget = createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      changedChannels: [{ targetKeyHash: hashAdaptiveCanonical(key(32)), channel: "density", viewName: "density" }]
    }));
    reject(missingTarget);
    reject(delta, { ...context, planningEpoch: 4 });
    reject(delta, { ...context, workerEpoch: 5 });
    reject(delta, { ...context, cancelled: true });
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, { byteLength: delta.byteLength + 1 }))).toThrow();
    reject({ ...delta, payloadHash: hashAdaptiveCanonical({ payload: "wrong" }) });
  });

  it("rejects actual payload-byte mutation while retaining the original commitments", () => {
    const fixture = authorityFixture();
    const transfer = bundle();
    const delta = createAdaptiveDirtyBrickDelta(inputFor(fixture, { payload: transfer.value }));
    new Uint8Array(transfer.buffer)[0] ^= 0xff;
    expect(() => validateAdaptiveDirtyBrickDeltaForAtomicAdoption(delta, contextFor(delta, fixture.snapshot))).toThrow();
  });

  it("verifies optional payload content hashes and commits their presence", () => {
    const fixture = authorityFixture();
    const transfer = bundle();
    const withHash = createAdaptiveDirtyBrickDelta(inputFor(fixture, { payload: transfer.value }));
    const withoutHash = validateTransferableBundle({ ...transfer.value, contentHash: undefined });
    const without = createAdaptiveDirtyBrickDelta(inputFor(fixture, { payload: withoutHash }));
    expect(withHash.payloadHash).not.toBe(without.payloadHash);
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      payload: validateTransferableBundle({ ...transfer.value, contentHash: "00000000" })
    }))).toThrow();
  });

  it("rejects duplicate semantic channel and fragment identities", () => {
    const fixture = authorityFixture();
    const targetKeyHash = hashAdaptiveCanonical(fixture.target.key);
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      changedChannels: [
        { targetKeyHash, channel: "density", viewName: "density" },
        { targetKeyHash, channel: "density", viewName: "density-alias" }
      ],
      fragments: []
    }))).toThrow();
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      changedChannels: [],
      fragments: [
        { targetKeyHash, fragmentId: "fragment.cut", viewName: "fragment" },
        { targetKeyHash, fragmentId: "fragment.cut", viewName: "fragment-alias" }
      ]
    }))).toThrow();
  });

  it("rejects over-limit descriptor names before payload validation", () => {
    const fixture = authorityFixture();
    const targetKeyHash = hashAdaptiveCanonical(fixture.target.key);
    const overLimitName = "x".repeat(129);
    const invalidPayload = undefined as unknown as CreateAdaptiveDirtyBrickDeltaInput["payload"];

    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      changedChannels: [{ targetKeyHash, channel: "density", viewName: overLimitName }],
      fragments: [],
      payload: invalidPayload
    }))).toThrow(/generic transfer limit/);
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      changedChannels: [],
      fragments: [{ targetKeyHash, fragmentId: "fragment.cut", viewName: overLimitName }],
      payload: invalidPayload
    }))).toThrow(/generic transfer limit/);
  });

  it("rejects validation work above the finite descriptor limits and a genuinely oversized bundle", () => {
    const fixture = authorityFixture();
    const targetKeyHash = hashAdaptiveCanonical(fixture.target.key);
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      changedChannels: Array.from({ length: 4_097 }, (_, index) => ({
        targetKeyHash,
        channel: "density" as const,
        viewName: `density-${index}`
      })),
      fragments: []
    }))).toThrow();
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      targets: new Array(ADAPTIVE_MAX_RESIDENT_SUMMARIES + 1)
    }))).toThrow(/finite limit/);
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      neighborManifest: new Array(ADAPTIVE_MAX_RESIDENT_SUMMARIES + 1)
    }))).toThrow(/finite limit/);
    const oversizedBuffer = new ArrayBuffer(ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES + 1);
    const oversized = validateTransferableBundle({
      ownership: "WorkerToConsumer",
      revision: contentRevision(1),
      byteLength: byteCount(oversizedBuffer.byteLength),
      buffers: [oversizedBuffer],
      views: [{ name: "density", bufferIndex: 0, kind: "Uint8Array", byteOffset: 0, elementCount: oversizedBuffer.byteLength }]
    });
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      payload: oversized,
      fragments: []
    }))).toThrow(/16 MiB/);
  });

  it("rejects an oversized payload before checking its content hash", () => {
    const fixture = authorityFixture();
    const oversizedBuffer = new ArrayBuffer(ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES + 1);
    const oversized = validateTransferableBundle({
      ownership: "WorkerToConsumer",
      revision: contentRevision(1),
      byteLength: byteCount(oversizedBuffer.byteLength),
      buffers: [oversizedBuffer],
      views: [{ name: "density", bufferIndex: 0, kind: "Uint8Array", byteOffset: 0, elementCount: oversizedBuffer.byteLength }],
      contentHash: "fnv1a64-v1:0000000000000000"
    });

    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, {
      payload: oversized,
      fragments: []
    }))).toThrow(/16 MiB/);
  });

  it("accepts a true 16 MiB payload boundary without canonicalizing its bytes", () => {
    const fixture = authorityFixture();
    const buffer = new ArrayBuffer(ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES);
    const payload = validateTransferableBundle({
      ownership: "WorkerToConsumer",
      revision: contentRevision(1),
      byteLength: byteCount(buffer.byteLength),
      buffers: [buffer],
      views: [
        {
          name: "density",
          bufferIndex: 0,
          kind: "Uint8Array",
          byteOffset: 0,
          elementCount: ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES - 1
        },
        {
          name: "fragment",
          bufferIndex: 0,
          kind: "Uint8Array",
          byteOffset: ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES - 1,
          elementCount: 1
        }
      ]
    });

    const delta = createAdaptiveDirtyBrickDelta(inputFor(fixture, { payload }));
    expect(delta.byteLength).toBe(ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES);
    expect(delta.payloadHash).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
  });

  it("keeps generic typed-array ownership and descriptor validation delegated", () => {
    const fixture = authorityFixture();
    const transfer = bundle().value;
    const inputOwned = validateTransferableBundle({ ...transfer, ownership: "SenderToWorker", revision: contentRevision(0) });
    const predecessorLabeled = validateTransferableBundle({ ...transfer, revision: contentRevision(0) });
    expect(() => validateTransferableBundle(inputOwned)).not.toThrow();
    expect(() => validateTransferableBundle({
      ...transfer,
      views: [transfer.views[0], { ...transfer.views[1], name: transfer.views[0]!.name }]
    })).toThrow();
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, { payload: transfer }))).not.toThrow();
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, { payload: inputOwned }))).toThrow();
    expect(() => createAdaptiveDirtyBrickDelta(inputFor(fixture, { payload: predecessorLabeled }))).toThrow();
  });
});
