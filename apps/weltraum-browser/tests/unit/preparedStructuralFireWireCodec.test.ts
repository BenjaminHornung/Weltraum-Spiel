import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { projectStructuralObject, projectStructuralResult } from "../../src/voxel/structural/canonical";
import { createSurfaceRigidBodyWorld } from "../../src/surface-play/physics/surfaceRigidBodyWorld";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeAuthority,
  deriveSurfaceTreeCanonicalHit,
  projectSurfaceTreeAuthoritySnapshotTransport
} from "../../src/surface-play/vegetation/surfaceTreeAuthority";
import { createSurfaceTreeCollisionSnapshot } from "../../src/surface-play/vegetation/surfaceTreeCollision";
import { prepareSurfaceTreeFire } from "../../src/surface-play/vegetation/surfaceTreePreparedFire";
import {
  PREPARED_STRUCTURAL_FIRE_COLLISION_RESULT_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_ITEM_FRAGMENT_BYTES,
  PREPARED_STRUCTURAL_FIRE_PAGE_BYTES,
  PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES,
  PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES,
  PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES,
  type PreparedStructuralFireCanonicalItem,
  type PreparedStructuralFireCollisionResult,
  type PreparedStructuralFireHash,
  type PreparedStructuralFireLogicalViewDescriptor,
  type PreparedStructuralFireLogicalViewName
} from "../../src/surface-play/workers/preparedStructuralFireWire";
import {
  PreparedStructuralFireHashAccumulator,
  PreparedStructuralFirePhysicalPageAccumulator,
  PreparedStructuralFireOwnerPayloadValidator,
  createPreparedStructuralFireBodyPlan,
  createPreparedStructuralFireCanonicalItemSource,
  createPreparedStructuralFireCommand,
  createPreparedStructuralFireContinuationCursor,
  createPreparedStructuralFireLogicalViewFacts,
  createPreparedStructuralFireLogicalViewDescriptor,
  createPreparedStructuralFirePhysicalPageFacts,
  createPreparedStructuralFirePageEnvelope,
  createPreparedStructuralFirePageHeader,
  createPreparedStructuralFireReady,
  createPreparedStructuralFireRequest,
  createPreparedStructuralFireResultManifest,
  createPreparedStructuralFireResultReceipt,
  createPreparedStructuralFireResultViewProjections,
  createPreparedStructuralFireSeedManifest,
  decodePreparedStructuralFireItemChunks,
  hashPreparedStructuralFireBytes,
  preparedStructuralFireBackpressureDecision,
  preparedStructuralFireJobId,
  preparedStructuralFirePageCount,
  preparedStructuralFirePageRange,
  preparedStructuralFireReplicaKey,
  preparedStructuralFireRootJobId,
  preparedStructuralFireSeedHash,
  preparedStructuralFireU32Be,
  preparedStructuralFireU64Be,
  streamPreparedStructuralFireLogicalView,
  streamPreparedStructuralFirePages,
  validatePreparedDerivationTransaction,
  validatePreparedStructuralFireCollisionResult,
  validatePreparedStructuralFireCommand,
  validatePreparedStructuralFireJobId,
  validatePreparedStructuralFirePageSequence,
  validatePreparedStructuralFireRequest,
  validatePreparedStructuralFireResultManifest,
  validatePreparedStructuralFireResultReceipt,
  type PreparedStructuralFireItemSource
} from "../../src/surface-play/workers/preparedStructuralFireWireCodec";
import { encodePreparedStructuralFireContinuationInput } from "../../src/surface-play/workers/preparedStructuralFireCodec";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const here = dirname(fileURLToPath(import.meta.url));

const referenceU32Be = (value: number): Uint8Array => {
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, value, false);
  return result;
};

const referenceU64Be = (value: number): Uint8Array => {
  const result = new Uint8Array(8);
  new DataView(result.buffer).setBigUint64(0, BigInt(value), false);
  return result;
};

const independentReferenceHash = (domain: string, payload: Uint8Array): PreparedStructuralFireHash => {
  const domainBytes = encoder.encode(domain);
  let hash = 0xcbf29ce484222325n;
  for (const bytes of [
    referenceU32Be(domainBytes.byteLength),
    domainBytes,
    referenceU64Be(payload.byteLength),
    payload
  ]) {
    for (const byte of bytes) {
      hash ^= BigInt(byte);
      hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
  }
  return `fnv1a64-v1:${hash.toString(16).padStart(16, "0")}`;
};

const independentCanonicalJson = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Independent canonical JSON requires finite numbers.");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => independentCanonicalJson(entry)).join(",")}]`;
  }
  if (typeof value !== "object") {
    throw new TypeError("Independent canonical JSON received an unsupported value.");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => {
    const length = Math.min(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const delta = left.charCodeAt(index) - right.charCodeAt(index);
      if (delta !== 0) return delta;
    }
    return left.length - right.length;
  });
  return `{${keys.map((key) =>
    `${JSON.stringify(key)}:${independentCanonicalJson(record[key])}`).join(",")}}`;
};

const independentCanonicalHash = (
  domain: string,
  value: unknown
): PreparedStructuralFireHash =>
  independentReferenceHash(domain, encoder.encode(independentCanonicalJson(value)));

const independentRawHashBytes = (value: PreparedStructuralFireHash): Uint8Array => {
  const hex = value.slice("fnv1a64-v1:".length);
  return Uint8Array.from(hex.match(/../g) ?? [], (byte) => Number.parseInt(byte, 16));
};

const independentLogicalRoot = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  items: readonly Readonly<{ readonly key: string; readonly payload: unknown }>[]
): PreparedStructuralFireHash => {
  let tailHash = independentCanonicalHash(
    "prepared-structural-fire/logical-empty/v1",
    { logicalViewName }
  );
  for (const [ordinal, item] of items.entries()) {
    const itemHash = independentCanonicalHash(
      `prepared-structural-fire/item/${logicalViewName}/v1`,
      item.payload
    );
    tailHash = independentReferenceHash(
      "prepared-structural-fire/logical-step/v1",
      join([
        independentRawHashBytes(tailHash),
        encoder.encode(independentCanonicalJson({ ordinal, key: item.key, itemHash }))
      ])
    );
  }
  return independentCanonicalHash(
    "prepared-structural-fire/logical-root/v1",
    { logicalViewName, itemCount: items.length, tailHash }
  );
};

const independentPhysicalRoot = (
  direction: "Seed" | "PreparedResult",
  logicalViewName: PreparedStructuralFireLogicalViewName,
  pageHashes: readonly PreparedStructuralFireHash[]
): PreparedStructuralFireHash => {
  let tailHash = independentCanonicalHash(
    "prepared-structural-fire/physical-empty/v1",
    { direction, logicalViewName }
  );
  for (const [pageIndex, pageHash] of pageHashes.entries()) {
    tailHash = independentReferenceHash(
      "prepared-structural-fire/physical-step/v1",
      join([
        independentRawHashBytes(tailHash),
        encoder.encode(independentCanonicalJson({ pageIndex, pageHash }))
      ])
    );
  }
  return independentCanonicalHash(
    "prepared-structural-fire/physical-root/v1",
    {
      schemaVersion: "prepared-structural-fire-physical-page-root-v1",
      direction,
      logicalViewName,
      pageCount: pageHashes.length,
      tailHash
    }
  );
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const join = (parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
};

const fixtureHash = (label: string): PreparedStructuralFireHash =>
  independentReferenceHash(`fixture/${label}/v1`, encoder.encode(label));

const acceptCanonicalPayload = (
  _view: PreparedStructuralFireLogicalViewName,
  _key: string,
  payload: unknown
) => payload;

const encodeTestItem = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  item: Readonly<PreparedStructuralFireCanonicalItem>
) => {
  const source = createPreparedStructuralFireCanonicalItemSource(logicalViewName, item);
  return {
    record: {
      itemByteLength: source.payloadByteLength,
      itemHash: source.itemHash,
      key: source.key,
      payload: item.payload
    },
    bytes: join([...streamPreparedStructuralFireLogicalView(
      logicalViewName,
      () => [source]
    )])
  };
};

const directionFor = (name: PreparedStructuralFireLogicalViewName) =>
  name.startsWith("seed.") ? "Seed" as const : "PreparedResult" as const;

const logicalView = (
  name: PreparedStructuralFireLogicalViewName,
  items: readonly Readonly<PreparedStructuralFireCanonicalItem>[]
) => {
  const openItems = () => items.map((item) =>
    createPreparedStructuralFireCanonicalItemSource(name, item));
  const facts = createPreparedStructuralFireLogicalViewFacts(name, openItems);
  const openBytes = () => streamPreparedStructuralFireLogicalView(name, openItems);
  return { ...facts, openBytes };
};

const largeCanonicalStringSource = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  key: string,
  payloadByteLength: number
): PreparedStructuralFireItemSource => {
  if (payloadByteLength < 2) throw new RangeError("String payload needs two quote bytes.");
  const openPayload = function* (): Generator<Uint8Array> {
    let offset = 0;
    while (offset < payloadByteLength) {
      const byteLength = Math.min(PREPARED_STRUCTURAL_FIRE_ITEM_FRAGMENT_BYTES, payloadByteLength - offset);
      const fragment = new Uint8Array(byteLength);
      fragment.fill(0x61);
      if (offset === 0) fragment[0] = 0x22;
      if (offset + byteLength === payloadByteLength) fragment[byteLength - 1] = 0x22;
      yield fragment;
      offset += byteLength;
    }
  };
  const hash = new PreparedStructuralFireHashAccumulator(
    `prepared-structural-fire/item/${logicalViewName}/v1`,
    payloadByteLength
  );
  for (const fragment of openPayload()) hash.update(fragment);
  return Object.freeze({ key, payloadByteLength, itemHash: hash.finish(), openPayload });
};

const largeCanonicalZeroArraySource = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  key: string,
  itemCount: number
): PreparedStructuralFireItemSource => {
  const openPayload = function* (): Generator<Uint8Array> {
    yield encoder.encode('{"values":[');
    let remaining = itemCount;
    while (remaining > 0) {
      const count = Math.min(500_000, remaining);
      const final = count === remaining;
      yield encoder.encode(final
        ? `${"0,".repeat(count - 1)}0`
        : "0,".repeat(count));
      remaining -= count;
    }
    yield encoder.encode("]}");
  };
  let payloadByteLength = 0;
  for (const fragment of openPayload()) payloadByteLength += fragment.byteLength;
  const hash = new PreparedStructuralFireHashAccumulator(
    `prepared-structural-fire/item/${logicalViewName}/v1`,
    payloadByteLength
  );
  for (const fragment of openPayload()) hash.update(fragment);
  return Object.freeze({
    key,
    payloadByteLength,
    itemHash: hash.finish(),
    openPayload
  });
};

const descriptor = (
  name: PreparedStructuralFireLogicalViewName,
  items: readonly Readonly<PreparedStructuralFireCanonicalItem>[],
  ordinal: number
): PreparedStructuralFireLogicalViewDescriptor => {
  const logical = logicalView(name, items);
  const physical = createPreparedStructuralFirePhysicalPageFacts(
    logical,
    directionFor(name),
    logical.openBytes
  );
  return createPreparedStructuralFireLogicalViewDescriptor(
    ordinal,
    logical,
    directionFor(name),
    physical
  );
};

const decodeOwnerView = (
  owner: PreparedStructuralFireOwnerPayloadValidator,
  name: PreparedStructuralFireLogicalViewName,
  items: readonly Readonly<PreparedStructuralFireCanonicalItem>[],
  ordinal: number
): PreparedStructuralFireLogicalViewDescriptor => {
  const logical = logicalView(name, items);
  const direction = directionFor(name);
  const physical = createPreparedStructuralFirePhysicalPageFacts(
    logical,
    direction,
    logical.openBytes
  );
  const value = createPreparedStructuralFireLogicalViewDescriptor(
    ordinal,
    logical,
    direction,
    physical
  );
  return owner.decodeView(
    value,
    streamPreparedStructuralFirePages(logical, direction, logical.openBytes)
  );
};

const seedDescriptors = (): readonly PreparedStructuralFireLogicalViewDescriptor[] => [
  descriptor("seed.authority", [{ key: "@", payload: { objectId: "tree:fixture" } }], 0),
  descriptor("seed.collision", [{ key: "@", payload: { contentHash: fixtureHash("collision") } }], 1),
  descriptor("seed.existingBodySourceFacts", [], 2),
  descriptor("seed.physicsImmutable", [], 3),
  descriptor("seed.physicsDynamicState", [{
    key: "0:world",
    payload: {
      kind: "World",
      simulationTick: 7,
      gravityMetersPerSecondSquared: 9.81,
      terrainColliders: [],
      physicsFailure: null
    }
  }], 4)
];

describe("Prepared Structural Fire Wire V1 codec", () => {
  it("pins independent FNV-1a64 framing, endian bytes, and domain separation", () => {
    const payload = Uint8Array.from([0, 1, 2, 127, 128, 255]);
    const expectedFramedHex =
      "00000010676f6c64656e2e646f6d61696e2f763100000000000000060001027f80ff";
    const expectedHash = "fnv1a64-v1:b0bdbb9e9bae7425";

    expect(toHex(preparedStructuralFireU32Be(0x01020304))).toBe("01020304");
    expect(toHex(preparedStructuralFireU64Be(0x01020304))).toBe("0000000001020304");
    expect(toHex(join([
      referenceU32Be(16),
      encoder.encode("golden.domain/v1"),
      referenceU64Be(payload.byteLength),
      payload
    ]))).toBe(expectedFramedHex);
    expect(independentReferenceHash("golden.domain/v1", payload)).toBe(expectedHash);
    expect(hashPreparedStructuralFireBytes("golden.domain/v1", payload)).toBe(expectedHash);
    expect(hashPreparedStructuralFireBytes("golden.domain/v2", payload)).not.toBe(expectedHash);
    expect(hashPreparedStructuralFireBytes("golden.domain/v1", payload.subarray(0, 5)))
      .not.toBe(expectedHash);
  });

  it("pins independent empty, singleton, and two-item logical and physical roots", () => {
    const emptyItems = [] as const;
    const singletonItems = [{ key: "@", payload: { value: 1 } }] as const;
    const twoItems = [
      { key: "a", payload: { value: 1 } },
      { key: "b", payload: { value: 2 } }
    ] as const;
    const empty = logicalView("result.detachedFacts", emptyItems);
    const singleton = logicalView("result.work", singletonItems);
    const two = logicalView("result.detachedFacts", twoItems);
    const emptyPhysical = createPreparedStructuralFirePhysicalPageFacts(
      empty,
      "PreparedResult",
      empty.openBytes
    );
    const singletonPages = [...streamPreparedStructuralFirePages(
      singleton,
      "PreparedResult",
      singleton.openBytes
    )];
    const singletonPhysical = createPreparedStructuralFirePhysicalPageFacts(
      singleton,
      "PreparedResult",
      singleton.openBytes
    );
    const syntheticRoot = fixtureHash("two-page-logical-root");
    const twoPageHashes = [0, 1].map((pageIndex) => {
      const headerCore = {
        schemaVersion: "prepared-structural-fire-page-v1" as const,
        direction: "PreparedResult" as const,
        logicalViewName: "result.work" as const,
        pageIndex,
        byteOffset: pageIndex * PREPARED_STRUCTURAL_FIRE_PAGE_BYTES,
        byteLength: pageIndex === 0 ? PREPARED_STRUCTURAL_FIRE_PAGE_BYTES : 1,
        logicalViewRoot: syntheticRoot,
        pageBytesHash: fixtureHash(`page-bytes-${pageIndex}`)
      };
      return {
        ...headerCore,
        pageHash: independentCanonicalHash(
          "prepared-structural-fire/page/v1",
          headerCore
        )
      };
    });
    const twoPageAccumulator = new PreparedStructuralFirePhysicalPageAccumulator(
      "PreparedResult",
      "result.work"
    );
    for (const header of twoPageHashes) twoPageAccumulator.append(header);
    const twoPagePhysical = twoPageAccumulator.finish();

    const expected = {
      emptyLogical: "fnv1a64-v1:9acf88a344e6371d",
      singletonLogical: "fnv1a64-v1:e2fba65b5836840a",
      twoLogical: "fnv1a64-v1:ab57431738affc15",
      emptyPhysical: "fnv1a64-v1:481231719ddfb8f5",
      singletonPhysical: "fnv1a64-v1:f32cbe1d8dde490b",
      twoPhysical: "fnv1a64-v1:1ed23a27890ce147"
    } as const;
    expect(empty.logicalViewRoot).toBe(expected.emptyLogical);
    expect(singleton.logicalViewRoot).toBe(expected.singletonLogical);
    expect(two.logicalViewRoot).toBe(expected.twoLogical);
    expect(emptyPhysical.physicalPageRoot).toBe(expected.emptyPhysical);
    expect(singletonPhysical.physicalPageRoot).toBe(expected.singletonPhysical);
    expect(twoPagePhysical.physicalPageRoot).toBe(expected.twoPhysical);
    expect(empty.logicalViewRoot).toBe(independentLogicalRoot("result.detachedFacts", emptyItems));
    expect(singleton.logicalViewRoot).toBe(independentLogicalRoot("result.work", singletonItems));
    expect(two.logicalViewRoot).toBe(independentLogicalRoot("result.detachedFacts", twoItems));
    expect(emptyPhysical.physicalPageRoot).toBe(independentPhysicalRoot(
      "PreparedResult",
      "result.detachedFacts",
      []
    ));
    expect(singletonPhysical.physicalPageRoot).toBe(independentPhysicalRoot(
      "PreparedResult",
      "result.work",
      singletonPages.map((page) => page.header.pageHash)
    ));
    expect(twoPagePhysical.physicalPageRoot).toBe(independentPhysicalRoot(
      "PreparedResult",
      "result.work",
      twoPageHashes.map((header) => header.pageHash)
    ));
  });

  it("pins canonical RS/JSON/LF bytes, Unicode streaming, and -0 normalization", () => {
    const encoded = encodeTestItem("result.work", {
      key: "@",
      payload: { value: -0 }
    });
    const expectedHex =
      "1e7b226974656d427974654c656e677468223a31312c226974656d48617368223a22666e76316136342d76313a64396663613234376463353038636532222c226b6579223a2240222c227061796c6f6164223a7b2276616c7565223a307d7d0a";
    expect(encoded.record.itemHash).toBe("fnv1a64-v1:d9fca247dc508ce2");
    expect(toHex(encoded.bytes)).toBe(expectedHex);
    expect(decodePreparedStructuralFireItemChunks(
      "result.work",
      [encoded.bytes],
      acceptCanonicalPayload
    ).payload)
      .toEqual({ value: 0 });

    const unicode = encodeTestItem("result.work", {
      key: "@",
      payload: { label: "Küste 🌊" }
    });
    const ocean = encoder.encode("🌊");
    const splitAt = unicode.bytes.findIndex((byte, index, source) =>
      byte === ocean[0] && source[index + 1] === ocean[1]);
    expect(splitAt).toBeGreaterThan(0);
    expect(decodePreparedStructuralFireItemChunks("result.work", [
      unicode.bytes.subarray(0, splitAt + 1),
      unicode.bytes.subarray(splitAt + 1)
    ], acceptCanonicalPayload)).toEqual(unicode.record);
  });

  it("rejects noncanonical records and malformed, truncated, or overlong UTF-8", () => {
    const encoded = encodeTestItem("result.work", {
      key: "@",
      payload: { value: 1 }
    });
    const text = decoder.decode(encoded.bytes);
    const noncanonical = encoder.encode(text.replace('{"itemByteLength"', '{ "itemByteLength"'));
    expect(() => decodePreparedStructuralFireItemChunks(
      "result.work",
      [noncanonical],
      acceptCanonicalPayload
    ))
      .toThrow(/canonical JSON/i);
    const extraKey = encoder.encode(text.replace(',"key"', ',"extra":0,"key"'));
    expect(() => decodePreparedStructuralFireItemChunks(
      "result.work",
      [extraKey],
      acceptCanonicalPayload
    ))
      .toThrow(/exactly/i);
    expect(() => decodePreparedStructuralFireItemChunks("result.work", [
      encoded.bytes.subarray(0, encoded.bytes.byteLength - 1)
    ], acceptCanonicalPayload)).toThrow(/RS\/JSON\/LF/i);
    expect(() => decodePreparedStructuralFireItemChunks("result.work", [
      Uint8Array.of(0x1e, 0xc0),
      Uint8Array.of(0xaf, 0x0a)
    ], acceptCanonicalPayload)).toThrow(/malformed UTF-8/i);
    expect(() => decodePreparedStructuralFireItemChunks("result.work", [
      Uint8Array.of(0x1e, 0xf0, 0x9f, 0x8c)
    ], acceptCanonicalPayload)).toThrow(/malformed UTF-8/i);
    const trailingObjectComma = encoder.encode(text.replace('{"value":1}', '{"value":1,}'));
    expect(() => decodePreparedStructuralFireItemChunks(
      "result.work",
      [trailingObjectComma],
      acceptCanonicalPayload
    )).toThrow(/trailing comma/i);
    const arrayItem = encodeTestItem("result.work", {
      key: "@",
      payload: { values: [1] }
    });
    const trailingArrayComma = encoder.encode(
      decoder.decode(arrayItem.bytes).replace('[1]', '[1,]')
    );
    expect(() => decodePreparedStructuralFireItemChunks(
      "result.work",
      [trailingArrayComma],
      acceptCanonicalPayload
    )).toThrow(/trailing comma/i);
  });

  it("handles a split payload marker and __proto__ as an own canonical data property", () => {
    const payload = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(payload, "__proto__", {
      value: 1,
      enumerable: true,
      configurable: true,
      writable: true
    });
    const encoded = encodeTestItem("result.work", { key: "@", payload });
    const markerOffset = decoder.decode(encoded.bytes).indexOf(',"payload":');
    expect(markerOffset).toBeGreaterThan(0);
    const decoded = decodePreparedStructuralFireItemChunks("result.work", [
      encoded.bytes.subarray(0, markerOffset + 4),
      encoded.bytes.subarray(markerOffset + 4)
    ], acceptCanonicalPayload);
    expect(Object.hasOwn(decoded.payload as object, "__proto__")).toBe(true);
    expect((decoded.payload as Record<string, unknown>).__proto__).toBe(1);
  });

  it("enforces singleton, optional-singleton, exact payload, ordering, and duplicate gates", () => {
    expect(() => logicalView("result.work", []))
      .toThrow(/exactly one/i);
    expect(logicalView("result.detachedFacts", []).itemCount).toBe(0);
    expect(() => logicalView("result.transferResult", [
      { key: "@transfer", payload: { status: "Applied" } },
      { key: "@transfer", payload: { status: "Applied" } }
    ])).toThrow(/at most one|strictly canonical/i);
    expect(() => logicalView("result.detachedFacts", [
      { key: "b", payload: { value: 1 } },
      { key: "a", payload: { value: 2 } }
    ])).toThrow(/strictly canonical/i);
    expect(() => logicalView("result.detachedFacts", [
      { key: "a", payload: { value: 1 } },
      { key: "a", payload: { value: 2 } }
    ])).toThrow(/strictly canonical/i);
    expect(() => createPreparedStructuralFireCanonicalItemSource("seed.physicsImmutable", {
      key: "body:1",
      payload: { bodyId: "body:1", colliders: [] }
    })).toThrow(/exactly/i);
  });

  it("handles empty, boundary, 64 MiB plus one, and maximum-safe paging without wide arrays", () => {
    expect(preparedStructuralFirePageCount(0)).toBe(0);
    expect(preparedStructuralFirePageCount(PREPARED_STRUCTURAL_FIRE_PAGE_BYTES)).toBe(1);
    expect(preparedStructuralFirePageCount(PREPARED_STRUCTURAL_FIRE_PAGE_BYTES + 1)).toBe(2);
    expect(preparedStructuralFirePageCount(67_108_865)).toBe(5);
    expect(PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES).toBe(67_108_864);
    expect(preparedStructuralFireBackpressureDecision(0, 67_108_864)).toEqual({
      kind: "Accepted",
      retainedBytesAfterAcceptance: 67_108_864
    });
    expect(preparedStructuralFireBackpressureDecision(67_108_864, 1)).toEqual({
      kind: "Deferred",
      reason: "RetainedInFlightBackpressure"
    });
    expect(preparedStructuralFirePageRange(67_108_865, 4)).toEqual({
      pageIndex: 4,
      byteOffset: 67_108_864,
      byteLength: 1
    });
    expect(preparedStructuralFirePageCount(Number.MAX_SAFE_INTEGER)).toBe(536_870_912);
    expect(preparedStructuralFirePageRange(Number.MAX_SAFE_INTEGER, 536_870_911)).toEqual({
      pageIndex: 536_870_911,
      byteOffset: 9_007_199_237_963_776,
      byteLength: 16_777_215
    });
    expect(() => preparedStructuralFirePageRange(Number.MAX_SAFE_INTEGER, 536_870_912))
      .toThrow(/outside/i);

    const source = largeCanonicalStringSource("result.work", "@", 67_108_865);
    const openItems = () => [source];
    const logical = createPreparedStructuralFireLogicalViewFacts("result.work", openItems);
    const openBytes = () => streamPreparedStructuralFireLogicalView("result.work", openItems);
    const physical = createPreparedStructuralFirePhysicalPageFacts(
      logical,
      "PreparedResult",
      openBytes
    );
    expect(logical.byteLength).toBeGreaterThan(67_108_865);
    expect(physical.pageCount).toBe(5);

    let retainedBytes = 0;
    let pageCount = 0;
    for (const page of streamPreparedStructuralFirePages(logical, "PreparedResult", openBytes)) {
      const decision = preparedStructuralFireBackpressureDecision(retainedBytes, page.bytes.byteLength);
      if (pageCount < 4) {
        expect(decision.kind).toBe("Accepted");
        if (decision.kind === "Accepted") retainedBytes = decision.retainedBytesAfterAcceptance;
      } else {
        expect(decision).toEqual({
          kind: "Deferred",
          reason: "RetainedInFlightBackpressure"
        });
      }
      pageCount += 1;
    }
    expect(pageCount).toBe(5);
    expect(retainedBytes).toBe(PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES);
  }, 120_000);

  it("decodes an item larger than one page with bounded transport and one owner payload", () => {
    const payloadByteLength = PREPARED_STRUCTURAL_FIRE_PAGE_BYTES + 1;
    const source = largeCanonicalStringSource("result.work", "@", payloadByteLength);
    const openItems = () => [source];
    const logical = createPreparedStructuralFireLogicalViewFacts("result.work", openItems);
    const openBytes = () => streamPreparedStructuralFireLogicalView("result.work", openItems);
    const physical = createPreparedStructuralFirePhysicalPageFacts(
      logical,
      "PreparedResult",
      openBytes
    );
    const view = createPreparedStructuralFireLogicalViewDescriptor(
      8,
      logical,
      "PreparedResult",
      physical
    );
    let observedLength = 0;
    const decoded = validatePreparedStructuralFirePageSequence(
      view,
      streamPreparedStructuralFirePages(logical, "PreparedResult", openBytes),
      (_name, _key, payload) => {
        if (typeof payload !== "string") throw new TypeError("Expected streamed string payload.");
        observedLength = payload.length;
        return payload;
      }
    );
    expect(physical.pageCount).toBe(2);
    expect(decoded.logicalViewRoot).toBe(logical.logicalViewRoot);
    expect(observedLength).toBe(payloadByteLength - 2);
  }, 120_000);

  it("decodes a canonical array larger than one page without a logical byte buffer", () => {
    const source = largeCanonicalZeroArraySource("result.work", "@", 8_388_609);
    const logical = createPreparedStructuralFireLogicalViewFacts(
      "result.work",
      () => [source]
    );
    const openBytes = () => streamPreparedStructuralFireLogicalView(
      "result.work",
      () => [source]
    );
    const physical = createPreparedStructuralFirePhysicalPageFacts(
      logical,
      "PreparedResult",
      openBytes
    );
    const view = createPreparedStructuralFireLogicalViewDescriptor(
      8,
      logical,
      "PreparedResult",
      physical
    );
    let observedItemCount = 0;
    validatePreparedStructuralFirePageSequence(
      view,
      streamPreparedStructuralFirePages(logical, "PreparedResult", openBytes),
      (_name, _key, payload) => {
        observedItemCount = (payload as { readonly values: readonly number[] }).values.length;
        return payload;
      }
    );
    expect(view.byteLength).toBeGreaterThan(PREPARED_STRUCTURAL_FIRE_PAGE_BYTES);
    expect(observedItemCount).toBe(8_388_609);
  }, 120_000);

  it("keeps logical roots independent of transport chunks and validates page-set integrity", () => {
    const items = [
      { key: "a", payload: { value: 1 } },
      { key: "b", payload: { value: 2 } }
    ] as const;
    const logical = logicalView("result.detachedFacts", items);
    const physical = createPreparedStructuralFirePhysicalPageFacts(
      logical,
      "PreparedResult",
      logical.openBytes
    );
    const view = createPreparedStructuralFireLogicalViewDescriptor(
      1,
      logical,
      "PreparedResult",
      physical
    );
    const pages = () => streamPreparedStructuralFirePages(
      logical,
      "PreparedResult",
      logical.openBytes
    );
    expect(validatePreparedStructuralFirePageSequence(
      view,
      pages(),
      (_name, _key, payload) => payload
    ).logicalViewRoot).toBe(logical.logicalViewRoot);
    expect(() => validatePreparedStructuralFirePageSequence(
      view,
      [],
      (_name, _key, payload) => payload
    )).toThrow(/incomplete/i);

    const page = pages().next().value!;
    const conflictingBytes = page.bytes.slice();
    conflictingBytes[0] ^= 1;
    expect(() => validatePreparedStructuralFirePageSequence(
      view,
      [{ header: page.header, bytes: conflictingBytes }],
      (_name, _key, payload) => payload
    )).toThrow(/invalid/i);
  });

  it("pins the seed-command-request-job DAG and rejects identity tampering", () => {
    const seedManifest = createPreparedStructuralFireSeedManifest(seedDescriptors());
    const seedHash = preparedStructuralFireSeedHash(seedManifest);
    const command = createPreparedStructuralFireCommand({
      seedHash,
      fireCommandId: "fire:fixture",
      structuralCommandId: "structural:fixture",
      hit: { materialId: 2, point: { x: 1, y: 2, z: 3 } },
      simulationTick: 7
    });
    expect(validatePreparedStructuralFireCommand(command)).toEqual(command);
    expect(() => validatePreparedStructuralFireCommand({
      ...command,
      commandHash: fixtureHash("tampered-command")
    })).toThrow(/commitment/i);
    const callerNonce = "0123456789abcdef0123456789abcdef";
    const request = createPreparedStructuralFireRequest({
      seedHash,
      commandHash: command.commandHash,
      callerNonce,
      source: {
        objectId: "tree:fixture",
        objectRevision: 1,
        editRevision: 1,
        contentHash: fixtureHash("source")
      },
      activationTick: 7,
      deadlineTick: 67
    });
    expect(validatePreparedStructuralFireRequest(request)).toEqual(request);
    expect(() => validatePreparedStructuralFireRequest({
      ...request,
      requestHash: fixtureHash("tampered-request")
    })).toThrow(/commitment/i);
    expect(request.rootJobId).toBe(
      preparedStructuralFireRootJobId(seedHash, command.commandHash, callerNonce)
    );
    expect(preparedStructuralFireJobId(request, 0, 0)).toMatch(/^psf-job-v1:[0-9a-f]{16}$/);
    expect(validatePreparedStructuralFireJobId(
      request,
      0,
      0,
      preparedStructuralFireJobId(request, 0, 0)
    )).toBe(preparedStructuralFireJobId(request, 0, 0));
    expect(() => validatePreparedStructuralFireJobId(
      request,
      0,
      0,
      "psf-job-v1:0000000000000000"
    )).toThrow(/commitment/i);
    expect(preparedStructuralFireJobId(request, 0, 1))
      .not.toBe(preparedStructuralFireJobId(request, 0, 0));
    const expected = {
      seedManifestHash: "fnv1a64-v1:d9433bff111b438d",
      seedHash: "fnv1a64-v1:7533f796bf4656e2",
      commandHash: "fnv1a64-v1:4c6349e4e0830819",
      rootJobId: "psf-root-v1:a5d55eb8123fb1b4",
      requestHash: "fnv1a64-v1:9babdb1f168df514",
      initialJobId: "psf-job-v1:18fcdef1caa1e4c2",
      retryJobId: "psf-job-v1:2534da9e72d3c075"
    } as const;
    const { manifestHash: _manifestHash, ...seedManifestCore } = seedManifest;
    const { commandHash: _commandHash, ...commandHashCore } = command;
    const { requestHash: _requestHash, ...requestHashCore } = request;
    expect(seedManifest.manifestHash).toBe(expected.seedManifestHash);
    expect(independentCanonicalHash(
      "prepared-structural-fire/seed-manifest/v1",
      seedManifestCore
    )).toBe(expected.seedManifestHash);
    expect(seedHash).toBe(expected.seedHash);
    expect(independentCanonicalHash(
      "prepared-structural-fire/seed/v1",
      { seedManifestHash: expected.seedManifestHash }
    )).toBe(expected.seedHash);
    expect(command.commandHash).toBe(expected.commandHash);
    expect(independentCanonicalHash(
      "prepared-structural-fire/command/v1",
      commandHashCore
    )).toBe(expected.commandHash);
    expect(request.rootJobId).toBe(expected.rootJobId);
    expect(`psf-root-v1:${independentCanonicalHash(
      "prepared-structural-fire/root-job-id/v1",
      { seedHash, commandHash: command.commandHash, callerNonce }
    ).slice("fnv1a64-v1:".length)}`).toBe(expected.rootJobId);
    expect(request.requestHash).toBe(expected.requestHash);
    expect(independentCanonicalHash(
      "prepared-structural-fire/request/v2",
      requestHashCore
    )).toBe(expected.requestHash);
    for (const [attemptIndex, jobId] of [
      [0, expected.initialJobId],
      [1, expected.retryJobId]
    ] as const) {
      expect(preparedStructuralFireJobId(request, 0, attemptIndex)).toBe(jobId);
      expect(`psf-job-v1:${independentCanonicalHash(
        "prepared-structural-fire/job-id/v1",
        { rootJobId: request.rootJobId, requestHash: request.requestHash, dispatchIndex: 0, attemptIndex }
      ).slice("fnv1a64-v1:".length)}`).toBe(jobId);
    }
    expect(preparedStructuralFireReplicaKey(1, seedHash))
      .not.toBe(preparedStructuralFireReplicaKey(2, seedHash));
    const smallLogical = logicalView("result.work", [
      { key: "@", payload: { completedUnits: 1 } }
    ]);
    const smallBytes = join([...smallLogical.openBytes()]);
    const pageHeader = createPreparedStructuralFirePageHeader(
      smallLogical,
      "PreparedResult",
      0,
      smallBytes
    );
    const envelope = createPreparedStructuralFirePageEnvelope(
      request,
      1,
      pageHeader,
      smallBytes
    );
    const otherRequest = createPreparedStructuralFireRequest({
      seedHash,
      commandHash: command.commandHash,
      callerNonce: "fedcba9876543210fedcba9876543210",
      source: request.source,
      activationTick: 7,
      deadlineTick: 67
    });
    const otherEnvelope = createPreparedStructuralFirePageEnvelope(
      otherRequest,
      1,
      pageHeader,
      smallBytes
    );
    expect(otherEnvelope.header.pageHash).toBe(envelope.header.pageHash);
    expect(otherEnvelope.pageEnvelopeHash).not.toBe(envelope.pageEnvelopeHash);
    expect(() => createPreparedStructuralFireRequest({
      seedHash,
      commandHash: command.commandHash,
      callerNonce: callerNonce.toUpperCase(),
      source: request.source,
      activationTick: 7,
      deadlineTick: 67
    })).toThrow(/callerNonce/i);
  });

  it("owns page, command, and manifest inputs without freezing caller objects", () => {
    const mutableDescriptors = JSON.parse(JSON.stringify(seedDescriptors())) as
      PreparedStructuralFireLogicalViewDescriptor[];
    const originalDescriptorRoot = mutableDescriptors[0].logicalViewRoot;
    const manifest = createPreparedStructuralFireSeedManifest(mutableDescriptors);
    (mutableDescriptors[0] as { logicalViewRoot: PreparedStructuralFireHash }).logicalViewRoot =
      fixtureHash("caller-mutated-root");
    expect(manifest.views[0].logicalViewRoot).toBe(originalDescriptorRoot);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.views)).toBe(true);
    expect(Object.isFrozen(manifest.views[0])).toBe(true);

    const mutableHit = { materialId: 2, point: { x: 1, y: 2, z: 3 } };
    const command = createPreparedStructuralFireCommand({
      seedHash: preparedStructuralFireSeedHash(manifest),
      fireCommandId: "fire:owned",
      structuralCommandId: "structural:owned",
      hit: mutableHit,
      simulationTick: 7
    });
    const commandJson = independentCanonicalJson(command);
    mutableHit.materialId = 9;
    mutableHit.point.x = 99;
    expect(independentCanonicalJson(command)).toBe(commandJson);
    expect(command.hit).not.toBe(mutableHit);
    expect(Object.isFrozen(command.hit)).toBe(true);
    expect(Object.isFrozen((command.hit as typeof mutableHit).point)).toBe(true);
    expect(Object.isFrozen(mutableHit)).toBe(false);
    expect(validatePreparedStructuralFireCommand(command)).toEqual(command);

    const request = createPreparedStructuralFireRequest({
      seedHash: command.seedHash,
      commandHash: command.commandHash,
      callerNonce: "0123456789abcdef0123456789abcdef",
      source: {
        objectId: "tree:fixture",
        objectRevision: 1,
        editRevision: 1,
        contentHash: fixtureHash("source")
      },
      activationTick: 7,
      deadlineTick: 67
    });
    const logical = logicalView("result.work", [{ key: "@", payload: { completedUnits: 1 } }]);
    const callerBytes = join([...logical.openBytes()]);
    const callerHeader = {
      ...createPreparedStructuralFirePageHeader(
        logical,
        "PreparedResult",
        0,
        callerBytes
      )
    };
    const envelope = createPreparedStructuralFirePageEnvelope(
      request,
      1,
      callerHeader,
      callerBytes
    );
    const envelopeJson = independentCanonicalJson(envelope.header);
    const ownedByte = envelope.bytes[0];
    callerBytes[0] ^= 1;
    (callerHeader as { pageIndex: number }).pageIndex = 99;
    expect(independentCanonicalJson(envelope.header)).toBe(envelopeJson);
    expect(envelope.bytes[0]).toBe(ownedByte);
    expect(envelope.bytes).not.toBe(callerBytes);
    expect(envelope.header).not.toBe(callerHeader);
    expect(Object.isFrozen(envelope.header)).toBe(true);
    expect(() => createPreparedStructuralFirePageEnvelope(
      request,
      1,
      { ...envelope.header, extra: true } as typeof envelope.header,
      envelope.bytes
    )).toThrow(/exactly/i);
    const { pageHash: _pageHash, ...mismatchedHeaderCore } = {
      ...envelope.header,
      direction: "Seed" as const
    };
    const mismatchedHeader = {
      ...mismatchedHeaderCore,
      pageHash: independentCanonicalHash(
        "prepared-structural-fire/page/v1",
        mismatchedHeaderCore
      )
    };
    expect(() => createPreparedStructuralFirePageEnvelope(
      request,
      1,
      mismatchedHeader,
      envelope.bytes
    )).toThrow(/invalid page commitment/i);
  });

  it("keeps BodyPlan create-only and collision NoGeometryChange revision-bound", () => {
    const root = fixtureHash("body-plan");
    expect(createPreparedStructuralFireBodyPlan([], root, new Set())).toEqual({
      schemaVersion: "prepared-structural-fire-body-plan-v1",
      kind: "Empty",
      count: 0,
      bodyPlanRoot: root
    });
    expect(createPreparedStructuralFireBodyPlan(
      ["body:a", "body:b"],
      root,
      new Set()
    )).toMatchObject({
      kind: "CreateOnly",
      count: 2,
      firstBodyId: "body:a",
      lastBodyId: "body:b"
    });
    expect(() => createPreparedStructuralFireBodyPlan(
      ["body:a"],
      root,
      new Set(["body:a"])
    )).toThrow(/collides/i);

    const collision: PreparedStructuralFireCollisionResult = {
      schemaVersion: PREPARED_STRUCTURAL_FIRE_COLLISION_RESULT_SCHEMA_VERSION,
      kind: "NoGeometryChange",
      sourceBinding: {
        objectId: "tree:fixture",
        objectRevision: 1,
        objectContentHash: fixtureHash("same-content")
      },
      resultingBinding: {
        objectId: "tree:fixture",
        objectRevision: 2,
        objectContentHash: fixtureHash("same-content")
      },
      unchangedCellSetRoot: fixtureHash("cell-root"),
      sourceCollisionCommitmentHash: fixtureHash("collision-before"),
      resultingCollisionCommitmentHash: fixtureHash("collision-after")
    };
    expect(validatePreparedStructuralFireCollisionResult(collision)).toBeTruthy();
    expect(() => validatePreparedStructuralFireCollisionResult({
      ...collision,
      resultingCollisionCommitmentHash: collision.sourceCollisionCommitmentHash
    })).toThrow(/advance/i);

    for (const count of [9, 64, 256, 1_024]) {
      const bodyIds = Array.from(
        { length: count },
        (_, index) => `body:projection:${index.toString().padStart(4, "0")}`
      );
      expect(createPreparedStructuralFireBodyPlan(
        bodyIds,
        fixtureHash(`body-plan-${count}`),
        new Set()
      )).toMatchObject({
        kind: "CreateOnly",
        count,
        firstBodyId: bodyIds[0],
        lastBodyId: bodyIds[count - 1]
      });
    }
  });

  it("reconstructs every seeded owner and rejects result facts outside the synchronous oracle", () => {
    const authority = createSurfaceTreeAuthority(createHestiaUmbrellaTree());
    const collision = createSurfaceTreeCollisionSnapshot(authority);
    const physics = createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 9.81,
      terrainColliders: []
    });
    const hit = deriveSurfaceTreeCanonicalHit(authority, 0);
    const fireInput = {
      authority,
      collision,
      physicsWorld: physics,
      bodySources: [],
      fireCommandId: "fire:wire-owner-fixture",
      hit: {
        address: hit.address,
        globalQuantum: hit.globalQuantum,
        pointMeters: hit.pointMeters,
        normal: { x: -1, y: 0, z: 0 },
        materialId: hit.materialId
      },
      simulationTick: 0
    } as const;
    const expected = prepareSurfaceTreeFire(fireInput);
    expect(expected.status).toBe("Ready");
    if (expected.status !== "Ready") throw new Error("Expected owner fixture to prepare.");

    const seedItems = {
      authority: [{ key: "@", payload: projectSurfaceTreeAuthoritySnapshotTransport(authority) }],
      collision: [{ key: "@", payload: collision }],
      existingBodySourceFacts: [],
      physicsImmutable: [],
      physicsDynamicState: [{
        key: "0:world",
        payload: {
          kind: "World",
          simulationTick: physics.simulationTick,
          gravityMetersPerSecondSquared: physics.gravityMetersPerSecondSquared,
          terrainColliders: physics.terrainColliders,
          physicsFailure: physics.physicsFailure
        }
      }]
    } as const;
    const createBoundOwner = () => {
      const owner = new PreparedStructuralFireOwnerPayloadValidator();
      const decodedSeedDescriptors = [
        decodeOwnerView(owner, "seed.authority", seedItems.authority, 0),
        decodeOwnerView(owner, "seed.collision", seedItems.collision, 1),
        decodeOwnerView(owner, "seed.existingBodySourceFacts", seedItems.existingBodySourceFacts, 2),
        decodeOwnerView(owner, "seed.physicsImmutable", seedItems.physicsImmutable, 3),
        decodeOwnerView(owner, "seed.physicsDynamicState", seedItems.physicsDynamicState, 4)
      ] as const;
      const seedHash = owner.bindSeedManifest(
        createPreparedStructuralFireSeedManifest(decodedSeedDescriptors)
      );
      const command = createPreparedStructuralFireCommand({
        seedHash,
        fireCommandId: fireInput.fireCommandId,
        structuralCommandId: expected.structuralCommandId,
        hit: fireInput.hit,
        simulationTick: fireInput.simulationTick
      });
      owner.bindCommand(command);
      return { owner, command };
    };
    const { owner, command } = createBoundOwner();
    const request = createPreparedStructuralFireRequest({
      seedHash: command.seedHash,
      commandHash: command.commandHash,
      callerNonce: "0123456789abcdef0123456789abcdef",
      source: {
        objectId: authority.objectId,
        objectRevision: authority.objectRevision,
        editRevision: authority.editRevision,
        contentHash: authority.objectContentHash as PreparedStructuralFireHash
      },
      activationTick: fireInput.simulationTick,
      deadlineTick: fireInput.simulationTick + 60
    });
    const bodyPlanItems = expected.newBodySourcePlans.map((source) => ({
      key: source.candidate.bodyId,
      payload: {
        schemaVersion: "prepared-structural-fire-body-create-v1",
        bodyId: source.candidate.bodyId,
        bodySource: {
          sourceObject: projectStructuralObject(source.sourceObject),
          component: source.component,
          fragment: source.fragment,
          massProperties: source.massProperties
        },
        physicsImmutable: {
          schemaVersion: "prepared-structural-fire-physics-immutable-v1",
          bodyId: source.candidate.bodyId,
          componentId: source.candidate.componentId,
          objectId: source.candidate.objectId,
          sourceObjectRevision: source.candidate.sourceObjectRevision,
          sourceContentHash: source.candidate.sourceContentHash,
          massKg: source.candidate.massKg,
          inverseMassPerKg: source.candidate.inverseMassPerKg,
          centerOfMassMeters: source.candidate.centerOfMassMeters,
          inertiaTensorKgMetersSquared: source.candidate.inertiaTensorKgMetersSquared,
          inverseInertiaTensorPerKgMetersSquared:
            source.candidate.inverseInertiaTensorPerKgMetersSquared,
          colliderRepresentation: source.candidate.colliderRepresentation,
          colliderRevision: source.candidate.colliderRevision,
          detachedAtSimulationTick: source.candidate.detachedAtSimulationTick,
          activationSimulationTick: source.candidate.activationSimulationTick
        },
        initialDynamic: {
          positionMeters: source.candidate.positionMeters,
          orientation: source.candidate.orientation,
          linearVelocityMetersPerSecond: source.candidate.linearVelocityMetersPerSecond,
          angularVelocityRadiansPerSecond: source.candidate.angularVelocityRadiansPerSecond
        }
      }
    }));
    const descriptors = [
      decodeOwnerView(owner, "result.damageResult", [{ key: "@", payload: projectStructuralResult(expected.damageResult) }], 0),
      decodeOwnerView(owner, "result.detachedFacts", expected.detachedFacts.map((facts) => ({
        key: facts.component.componentId,
        payload: facts
      })), 1),
      decodeOwnerView(owner, "result.bodyPlan", bodyPlanItems, 2),
      decodeOwnerView(owner, "result.transferResult", expected.transferResult === null ? [] : [{
        key: "@transfer",
        payload: projectStructuralResult(expected.transferResult)
      }], 3),
      decodeOwnerView(owner, "result.finalAuthority", [{
        key: "@",
        payload: projectSurfaceTreeAuthoritySnapshotTransport(expected.finalAuthority)
      }], 4),
      decodeOwnerView(owner, "result.authorityTransfer", expected.authorityTransfer === null ? [] : [{
        key: "@transfer",
        payload: expected.authorityTransfer
      }], 5),
      decodeOwnerView(owner, "result.collision", [{ key: "@", payload: expected.collision }], 6),
      decodeOwnerView(owner, "result.transition", [{ key: "@", payload: expected.transition }], 7),
      decodeOwnerView(owner, "result.work", [{
        key: "@",
        payload: {
          work: expected.work,
          suggestedEditRadiusMeters: expected.suggestedEditRadiusMeters
        }
      }], 8)
    ] as const;
    const manifest = createPreparedStructuralFireResultManifest(request, descriptors);
    expect(validatePreparedStructuralFireResultManifest(request, manifest)).toEqual(manifest);
    expect(() => validatePreparedStructuralFireResultManifest(request, {
      ...manifest,
      manifestHash: fixtureHash("tampered-manifest")
    })).toThrow(/commitment/i);
    const terminalJobId = preparedStructuralFireJobId(request, 0, 0);
    const previousChainHash = fixtureHash("previous-chain");
    const continuation = createPreparedStructuralFireContinuationCursor({
      rootJobId: request.rootJobId,
      requestHash: request.requestHash,
      domain: "result.work",
      lastItemKey: "@",
      ordinal: 1,
      globalOrdinal: descriptors.reduce((count, value) => count + value.itemCount, 0)
    }, previousChainHash);
    const transaction = owner.createTransaction({
      request,
      manifest,
      dispatchIndex: 0,
      attemptIndex: 0,
      terminalJobId,
      previousChainHash,
      terminalContinuation: continuation
    });
    const receipt = createPreparedStructuralFireResultReceipt(transaction);
    const expectedGoldens = {
      resultManifestHash: "fnv1a64-v1:ee5e86c64e20db6c",
      continuationChainHash: "fnv1a64-v1:62beeb31b1d88bb1",
      transactionHash: "fnv1a64-v1:4c5b2559323db123",
      receiptHash: "fnv1a64-v1:5ae5f7f37633f635"
    } as const;
    const { manifestHash: _manifestHash, ...manifestCore } = manifest;
    const { preparedDerivationTransactionHash: _transactionHash, ...transactionHashCore } =
      transaction;
    const { receiptHash: _receiptHash, ...receiptHashCore } = receipt;
    expect(manifest.manifestHash).toBe(expectedGoldens.resultManifestHash);
    expect(independentCanonicalHash(
      "prepared-structural-fire/result-manifest/v1",
      manifestCore
    )).toBe(expectedGoldens.resultManifestHash);
    expect(continuation.chainHash).toBe(expectedGoldens.continuationChainHash);
    expect(independentCanonicalHash(
      "prepared-structural-fire/continuation/v1",
      {
        schemaVersion: continuation.schemaVersion,
        rootJobId: continuation.rootJobId,
        requestHash: continuation.requestHash,
        domain: continuation.domain,
        lastItemKey: continuation.lastItemKey,
        ordinal: continuation.ordinal,
        globalOrdinal: continuation.globalOrdinal,
        previousChainHash
      }
    )).toBe(expectedGoldens.continuationChainHash);
    expect(transaction.preparedDerivationTransactionHash).toBe(expectedGoldens.transactionHash);
    expect(independentCanonicalHash(
      "prepared-derivation-transaction/v1",
      transactionHashCore
    )).toBe(expectedGoldens.transactionHash);
    expect(receipt.receiptHash).toBe(expectedGoldens.receiptHash);
    expect(independentCanonicalHash(
      "prepared-structural-fire/result-receipt/v1",
      receiptHashCore
    )).toBe(expectedGoldens.receiptHash);
    expect(validatePreparedDerivationTransaction(transaction, transaction)).toEqual(transaction);
    expect(validatePreparedStructuralFireResultReceipt(transaction, receipt)).toEqual(receipt);
    expect(() => validatePreparedDerivationTransaction({
      ...transaction,
      preparedDerivationTransactionHash: fixtureHash("tampered-transaction")
    }, transaction)).toThrow(/commitment/i);
    expect(() => validatePreparedStructuralFireResultReceipt(transaction, {
      ...receipt,
      receiptHash: fixtureHash("tampered-receipt")
    })).toThrow(/commitment/i);
    expect(receipt.kind).toBe(
      expected.damageResult.status === "NoChange" ? "NoChangeReceipt" : "AppliedReceipt"
    );
    const ready = createPreparedStructuralFireReady(manifest, transaction, receipt);
    expect(ready).toMatchObject({
      schemaVersion: "prepared-structural-fire-ready-v1",
      type: "Ready",
      manifest,
      receipt
    });
    expect(ready.manifest).not.toBe(manifest);
    expect(ready.receipt).not.toBe(receipt);
    expect(Object.isFrozen(ready.manifest.views)).toBe(true);
    expect(() => createPreparedStructuralFireReady(manifest, transaction, {
      ...receipt,
      requestHash: fixtureHash("tampered-request")
    })).toThrow(/commitment|does not bind/i);

    const resultProjections = createPreparedStructuralFireResultViewProjections(expected);
    expect(resultProjections.map((projection) => projection.logicalViewName)).toEqual(
      PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES
    );
    expect([...resultProjections[2].openItems()]).toEqual(bodyPlanItems);

    const tamperedDescriptors = descriptors.map((value, index) => index === 8
      ? { ...value, logicalViewRoot: fixtureHash("tampered-result-root") }
      : value);
    const tamperedManifest = createPreparedStructuralFireResultManifest(
      request,
      tamperedDescriptors
    );
    expect(() => owner.createTransaction({
      request,
      manifest: tamperedManifest,
      dispatchIndex: 0,
      attemptIndex: 0,
      terminalJobId,
      previousChainHash,
      terminalContinuation: continuation
    })).toThrow(/does not bind decoded view/i);
    const { owner: tamperedOwner } = createBoundOwner();
    expect(() => decodeOwnerView(tamperedOwner, "result.work", [{
      key: "@",
      payload: {
        work: expected.work,
        suggestedEditRadiusMeters: expected.suggestedEditRadiusMeters + 1
      }
    }], 8)).toThrow(/does not reproduce/i);
    expect(() => owner.createTransaction({
      request,
      manifest,
      dispatchIndex: 0,
      attemptIndex: 0,
      terminalJobId,
      previousChainHash,
      terminalContinuation: { ...continuation, chainHash: fixtureHash("tampered-chain") }
    })).toThrow(/terminal continuation/i);
    expect(() => owner.createTransaction({
      request,
      manifest,
      dispatchIndex: 0,
      attemptIndex: 0,
      terminalJobId,
      previousChainHash,
      terminalContinuation: { ...continuation, domain: "result.transition" }
    })).toThrow(/terminal continuation/i);
    expect(() => owner.createTransaction({
      request,
      manifest,
      dispatchIndex: 0,
      attemptIndex: 0,
      terminalJobId,
      previousChainHash,
      terminalContinuation: { ...continuation, extra: true } as typeof continuation
    })).toThrow(/terminal continuation/i);
  }, 120_000);

  it("keeps V1 bytes untouched and forbids runtime/public/adoption/FNV32 dependencies", () => {
    const v1 = encodePreparedStructuralFireContinuationInput(0, {
      rootJobId: "prepared-fire:golden",
      batchIndex: 1,
      tokenHash: "token",
      chainHash: "chain"
    });
    expect(decoder.decode(new Uint8Array(v1.buffers[0]))).toBe(
      '{"rootJobId":"prepared-fire:golden","batchIndex":1,"tokenHash":"token","chainHash":"chain"}'
    );
    expect(v1.views.map((view) => view.name)).toEqual([
      "preparedStructuralFireContinuation"
    ]);

    const sourceFiles = [
      resolve(here, "../../src/surface-play/workers/preparedStructuralFireWire.ts"),
      resolve(here, "../../src/surface-play/workers/preparedStructuralFireWireCodec.ts")
    ].map((path) => readFileSync(path, "utf8"));
    for (const source of sourceFiles) {
      expect(source).not.toMatch(/from\s+["'][^"']*(?:three|contracts|runtime|persistence)[^"']*["']/i);
      expect(source).not.toContain("fnv1aBytes");
      expect(source).not.toContain("AdoptionReceipt");
      expect(source).not.toMatch(/registryRoot|spatialRoot|residencyRoot/i);
    }
    const v1Source = readFileSync(
      resolve(here, "../../src/surface-play/workers/preparedStructuralFireCodec.ts"),
      "utf8"
    );
    expect(v1Source).not.toContain("preparedStructuralFireWire");
    expect(PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES).toHaveLength(5);
    expect(PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES).toHaveLength(9);
  });
});
