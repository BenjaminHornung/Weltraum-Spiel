import { describe, expect, it } from "vitest";
import * as adaptiveBarrel from "../../src/voxel/adaptive";
import { AdaptiveAuthorityError, canonicalAdaptiveJson, deepFreeze, hashAdaptiveCanonical } from "../../src/voxel/adaptive";
import { createOwnedCanonicalHashCursor } from "../../src/voxel/adaptive/ownedCanonicalHashSteps";
import { HVP_COAST_MATERIAL_REGISTRY, materializeHvpCoastSource, prepareHvpCoastSource } from "../../src/hvp/hvpCoastSource";
import { ingestHvpStructuralCells, type HvpStructuralCell } from "../../src/hestia-prototype/terrain/structuralIngest";
import { prepareHvpLocalBodyCut } from "../../src/hestia-prototype/physics/bodyCutPlan";
import {
  deriveStructuralComponentClassification,
  deriveStructuralPhysicsTransition,
  deriveStructuralSingleComponentPhysicsPreparation
} from "../../src/voxel/structural";

const oracle = (bytes: Uint8Array): string => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
};

const materials = HVP_COAST_MATERIAL_REGISTRY.map((material) => ({ materialId: material.slot,
  densityKgPerCubicMeter: material.densityKgPerM3, structuralClass: material.role, destructible: true, tags: null }));
const budgets = { maxVisitedCells: 32768, maxConnectivityCells: 32768, maxComponents: 32, maxConnectivityFacts: 262144 };
const limits = { maxFragments: 1, maxCollidersPerFragment: 64, maxVoxelsPerFragment: 32768 };
const zero = { x: 0, y: 0, z: 0 };
const motion = { velocityMetersPerSecond: zero, angularVelocityRadPerSecond: zero };

/** The hashed payload exactly as the transition producer builds it: the deep-frozen record without contentHash. */
const ownedPayload = (transition: object): unknown =>
  deepFreeze(Object.fromEntries(Object.entries(transition).filter(([key]) => key !== "contentHash")));

const buildInstalledFixture = () => {
  const coast = prepareHvpCoastSource(materializeHvpCoastSource());
  const cells: HvpStructuralCell[] = [];
  for (let z = 76; z < 80; z += 1) {
    for (let y = 82; y < 86; y += 1) {
      for (let x = 176; x < 200; x += 1) {
        const slot = coast.readSlot(x, y, z);
        if (slot === undefined || slot === 0) {
          throw new Error("Authored roof coverage changed");
        }
        cells.push({ x, y, z, materialId: slot });
      }
    }
  }
  const source = ingestHvpStructuralCells("v3-parity-rock", cells, materials);
  const cut = prepareHvpLocalBodyCut(source, [180, 84, 76], "p0-box384", 4, "Box");
  const child = cut.plan.parts[0]!.recipe.source;
  const transition = deriveStructuralSingleComponentPhysicsPreparation(child, motion, limits, budgets, () => {}, () => {}).transition;
  return { source, cut, child, transition };
};
let installed: ReturnType<typeof buildInstalledFixture> | undefined;
const installedFixture = () => (installed ??= buildInstalledFixture());

const thrown = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected a throw");
};

const drain = (payload: unknown, units: number) => {
  const chunks: Uint8Array[] = [];
  let perAdvance = 0;
  let maxPerAdvance = 0;
  const cursor = createOwnedCanonicalHashCursor(payload, (bytes) => {
    expect(bytes.length).toBeLessThanOrEqual(4096);
    perAdvance += bytes.length;
    chunks.push(bytes.slice());
  });
  let advances = 0;
  for (;;) {
    perAdvance = 0;
    const result = cursor.advance(units);
    advances += 1;
    maxPerAdvance = Math.max(maxPerAdvance, perAdvance);
    if (result !== undefined) {
      const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return { result, bytes, advances, maxPerAdvance, cursor };
    }
  }
};

const expectPublicParity = (payload: unknown, units: number) => {
  const run = drain(payload, units);
  const json = canonicalAdaptiveJson(payload);
  expect(run.bytes).toEqual(new TextEncoder().encode(json));
  expect(new TextDecoder("utf-8", { fatal: true }).decode(run.bytes)).toBe(json);
  expect(run.result.byteLength).toBe(run.bytes.length);
  expect(run.result.contentHash).toBe(hashAdaptiveCanonical(payload));
  expect(run.result.contentHash).toBe(`fnv1a64-v1:${oracle(run.bytes)}`);
  expect(Object.isFrozen(run.result)).toBe(true);
  return run;
};

const publicError = (value: unknown): AdaptiveAuthorityError => {
  try {
    canonicalAdaptiveJson(value);
  } catch (error) {
    return error as AdaptiveAuthorityError;
  }
  throw new Error("Expected the public canonical path to reject");
};

const ownedError = (value: unknown, units: number): unknown => {
  const cursor = createOwnedCanonicalHashCursor(value);
  for (;;) {
    try {
      cursor.advance(units);
    } catch (error) {
      return error;
    }
  }
};

const shape = (error: unknown) => {
  const typed = error as AdaptiveAuthorityError;
  return { name: typed.name, code: typed.code, path: typed.path, message: typed.message };
};

const alias = deepFreeze({ shared: [1, "alias"] });
const edgePayload = deepFreeze({
  z: [null, true, false, -0, 0, 1.5e-7, 1e21, -12.25, 5e-324, Number.MAX_SAFE_INTEGER],
  strings: ["", "Größe 🚀 🌍 ", "\u0000\u0001\u001f\"\\\b\f\n\r\t/  \u007f"],
  a: {},
  "": [],
  "é": 1,
  "é": 2,
  "\ud800lone-key": "public keys are escaped, not validated",
  "\"quoted\\key\n": [[], {}, [[]]],
  left: alias,
  right: [alias, alias],
  // Surrogate pairs and 6-byte escapes on the 128-unit chunk and 4 KiB buffer boundaries.
  pairAtChunk: `${"x".repeat(127)}🚀${"y".repeat(126)}🌍`,
  multiByte: "é€🚀".repeat(1500),
  escapes: "\u0001\u0010\"".repeat(1500),
  longKeyRecord: { [`k${"ä".repeat(300)}🚀`]: "v" }
});

describe("B1 Stage B private owned canonical hash cursor", () => {
  it("is not reachable through the public adaptive barrel", () => {
    expect(Object.keys(adaptiveBarrel)).not.toContain("createOwnedCanonicalHashCursor");
    expect(Object.keys(adaptiveBarrel)).not.toContain("OWNED_RECORD_MAX_KEYS");
  });

  it.each([1, 7, 64, 257])("streams the real Installed child352 transition exactly in %i-unit advances", (units) => {
    const { source, cut, child, transition } = installedFixture();
    expect(source.contentHash).toBe("fnv1a64-v1:f8cfbfc86fa161d2");
    expect(cut.plan.removedCells).toBe(32);
    expect(cut.plan.parts).toHaveLength(1);
    expect(child.contentHash).toBe("fnv1a64-v1:5b8c2e0e4b93d69c");
    expect(transition.status).toBe("Installed");
    expect(transition.contentHash).toBe("fnv1a64-v1:aa78d1531921ebf7");
    const payload = ownedPayload(transition);
    const before = canonicalAdaptiveJson(payload);
    const run = expectPublicParity(payload, units);
    expect(run.result.contentHash).toBe("fnv1a64-v1:aa78d1531921ebf7");
    // Bounded physical output per advance (a unit encodes at most 1024 code units and folds at most 4 KiB).
    expect(run.maxPerAdvance).toBeLessThanOrEqual(units * 8192);
    expect(run.advances).toBeGreaterThan(run.bytes.length / (units * 8192));
    expect(canonicalAdaptiveJson(payload)).toBe(before);
  });

  it.each([1, 7, 64, 257])("streams an actual Fallback debris transition exactly in %i-unit advances", (units) => {
    const cells = [0, 3, 6].map((x) => ({ x, y: 0, z: 0, materialId: 1 }));
    const source = ingestHvpStructuralCells("owned-hash-debris", cells, materials);
    const classification = deriveStructuralComponentClassification(source, { maxVisitedCells: budgets.maxVisitedCells,
      maxComponents: budgets.maxComponents, maxIndexedFacts: budgets.maxConnectivityFacts });
    const transition = deriveStructuralPhysicsTransition(source, classification, motion, limits, budgets);
    expect(transition.status).toBe("Fallback");
    if (transition.status !== "Fallback") {
      throw new Error("Expected the producer's debris fallback");
    }
    expect(transition.debris.mergedFragmentIds).toHaveLength(2);
    const run = expectPublicParity(ownedPayload(transition), units);
    expect(run.result.contentHash).toBe(transition.contentHash);
  });

  it.each([1, 7, 64, 257])("matches public bytes for numbers, -0, escapes, Unicode, aliases and empties in %i-unit advances", (units) => {
    expectPublicParity(edgePayload, units);
    for (const value of [null, true, false, -0, 0.1, "", "🚀", deepFreeze([]), deepFreeze({})]) {
      expectPublicParity(value, units);
    }
  });

  it.each([1, 7, 64])("fails closed with the public first error for unexpected shapes in %i-unit advances", (units) => {
    let reads = 0;
    const cycleRecord: Record<string, unknown> = {};
    cycleRecord.self = cycleRecord;
    const cycleArray: unknown[] = [];
    cycleArray.push(cycleArray);
    const cases: unknown[] = [
      deepFreeze({ a: [1, , 2] }),
      // The dense check precedes children: the hole wins over the earlier NaN, as in public.
      deepFreeze([Number.NaN, , 1]),
      // A later present non-enumerable/accessor entry wins over an earlier hole, as in public.
      Object.freeze(Object.defineProperty([, 1], "1", { value: 1, enumerable: false })),
      Object.freeze(Object.defineProperty([, 1], "1", { enumerable: true, get: () => { reads += 1; return 1; } })),
      Object.freeze(Object.defineProperty([, 1, , 3, 4], "4", { value: 4, enumerable: false })),
      Object.freeze(Object.defineProperty({}, "value", { enumerable: true, get: () => { reads += 1; return 1; } })),
      Object.freeze(Object.defineProperty([1, 2], "1", { enumerable: true, get: () => { reads += 1; return 2; } })),
      Object.freeze(Object.defineProperty([1, 2], "1", { enumerable: false, value: 2 })),
      Object.freeze(cycleRecord),
      Object.freeze(cycleArray),
      deepFreeze({ list: [1, Number.NaN] }),
      deepFreeze({ list: [Infinity] }),
      deepFreeze({ value: undefined }),
      deepFreeze({ nested: { fn: () => 1 } }),
      deepFreeze({ big: 1n }),
      deepFreeze({ text: `${"x".repeat(200)}\ud800y` }),
      deepFreeze({ text: `${"x".repeat(128)}\udc00` }),
      deepFreeze({ text: `${"x".repeat(127)}\ud800` }),
      deepFreeze({ date: new Date(0) }),
      deepFreeze({ [Symbol("s")]: 1, a: 1 })
    ];
    for (const value of cases) {
      const expected = publicError(value);
      const actual = ownedError(value, units);
      expect(actual).toBeInstanceOf(AdaptiveAuthorityError);
      expect(shape(actual)).toEqual(shape(expected));
    }
    expect(reads).toBe(0);
  });

  it("reports a later bad entry before an earlier hole with the exact public cause", () => {
    let reads = 0;
    const cases = [
      Object.freeze(Object.defineProperty([, 1], "1", { value: 1, enumerable: false })),
      Object.freeze(Object.defineProperty([, 1], "1", { enumerable: true, get: () => { reads += 1; return 1; } }))
    ];
    for (const value of cases) {
      const expected = { name: "AdaptiveAuthorityError", code: "InvalidCanonicalValue", path: "/1",
        message: "Array entries must be enumerable data properties." };
      expect(shape(publicError(value))).toEqual(expected);
      expect(shape(ownedError(value, 1))).toEqual(expected);
    }
    expect(shape(ownedError(deepFreeze([Number.NaN, , 1]), 1))).toMatchObject({ path: "/1", message: "Sparse arrays are rejected." });
    expect(reads).toBe(0);
  });

  it("keeps aliases legal but rejects an ancestor cycle deep in the tree", () => {
    const shared = deepFreeze({ leaf: 1 });
    expectPublicParity(deepFreeze({ a: shared, b: [shared, { c: shared }] }), 1);
    const inner: Record<string, unknown> = {};
    const outer = { list: [1, inner] };
    inner.back = outer;
    deepFreeze(outer);
    expect(shape(ownedError(outer, 1))).toEqual(shape(publicError(outer)));
  });

  it("fails closed on owned-only construction violations the public path would accept", () => {
    class Tagged extends Array<number> {}
    const tagged = Object.freeze(Tagged.from([1]));
    const wide = deepFreeze(Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`k${index}`, index])));
    for (const [value, message] of [
      [{ a: 1 }, "Owned canonical containers must be frozen."],
      [Object.freeze({ list: [1] }), "Owned canonical containers must be frozen."],
      [tagged, "Owned canonical arrays must be plain arrays."],
      [wide, "Owned canonical records may have at most 16 fields."]
    ] as const) {
      expect(() => canonicalAdaptiveJson(value)).not.toThrow();
      const error = ownedError(value, 1);
      expect(error).toBeInstanceOf(AdaptiveAuthorityError);
      expect(shape(error)).toMatchObject({ code: "InvalidCanonicalValue", message });
    }
  });

  it("rejects bad unit budgets without changing state", () => {
    const cursor = createOwnedCanonicalHashCursor(edgePayload);
    for (const units of [0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => cursor.advance(units)).toThrow(RangeError);
    }
    let result = cursor.advance(64);
    while (result === undefined) {
      result = cursor.advance(64);
    }
    expect(result.contentHash).toBe(hashAdaptiveCanonical(edgePayload));
  });

  it("returns one result, then stays exhausted and keeps it through dispose", () => {
    const run = drain(edgePayload, 257);
    expect(() => run.cursor.advance(1)).toThrow("Owned canonical hash cursor is exhausted.");
    run.cursor.dispose();
    run.cursor.dispose();
    expect(() => run.cursor.advance(1)).toThrow("Owned canonical hash cursor is exhausted.");
    expect(run.result.contentHash).toBe(hashAdaptiveCanonical(edgePayload));
  });

  it("keeps the first failure sticky and never overwrites it on dispose", () => {
    const cursor = createOwnedCanonicalHashCursor(deepFreeze({ a: "ok", b: [1, , 2] }));
    let first: unknown;
    for (;;) {
      try {
        cursor.advance(1);
      } catch (error) {
        first = error;
        break;
      }
    }
    expect(first).toBeInstanceOf(AdaptiveAuthorityError);
    expect(thrown(() => cursor.advance(1))).toBe(first);
    expect(() => cursor.dispose()).not.toThrow();
    expect(() => cursor.dispose()).not.toThrow();
    expect(thrown(() => cursor.advance(1))).toBe(first);
  });

  it("disposes mid-stream idempotently, emits nothing afterwards and leaves the payload untouched", () => {
    const payload = edgePayload;
    const before = canonicalAdaptiveJson(payload);
    let emitted = 0;
    const cursor = createOwnedCanonicalHashCursor(payload, (bytes) => {
      emitted += bytes.length;
    });
    while (emitted === 0) {
      expect(cursor.advance(7)).toBeUndefined();
    }
    const atDispose = emitted;
    expect(() => cursor.dispose()).not.toThrow();
    expect(() => cursor.dispose()).not.toThrow();
    expect(() => cursor.advance(1)).toThrow("Owned canonical hash cursor is disposed.");
    expect(emitted).toBe(atDispose);
    expect(canonicalAdaptiveJson(payload)).toBe(before);
  });

  it("does not let emitted chunk copies change a later identical digest", () => {
    const first = drain(edgePayload, 64);
    first.bytes.fill(0);
    expect(drain(edgePayload, 64).result).toEqual(first.result);
  });

  it("propagates a sink failure unswallowed and keeps it sticky", () => {
    const boom = new Error("sink failed");
    const cursor = createOwnedCanonicalHashCursor(edgePayload, () => {
      throw boom;
    });
    let caught: unknown;
    for (;;) {
      try {
        if (cursor.advance(64) !== undefined) {
          break;
        }
      } catch (error) {
        caught = error;
        break;
      }
    }
    expect(caught).toBe(boom);
    expect(thrown(() => cursor.advance(1))).toBe(boom);
  });

  it("cancels a result when the sink disposes during the final flush", () => {
    let calls = 0;
    const cursor = createOwnedCanonicalHashCursor(null, () => {
      calls += 1;
      cursor.dispose();
    });
    expect(cursor.advance(1)).toBeUndefined();
    expect(calls).toBe(0);
    expect(cursor.advance(1)).toBeUndefined();
    expect(calls).toBe(1);
    expect(() => cursor.dispose()).not.toThrow();
    expect(() => cursor.advance(1)).toThrow("Owned canonical hash cursor is disposed.");
    expect(calls).toBe(1);
  });

  it("keeps the exact sentinel when the sink disposes and then throws", () => {
    const sentinel = new Error("sink disposed and threw");
    const cursor = createOwnedCanonicalHashCursor(edgePayload, () => {
      cursor.dispose();
      throw sentinel;
    });
    let caught: unknown;
    while (caught === undefined) {
      caught = thrown(() => {
        if (cursor.advance(7) !== undefined) {
          throw new Error("Expected no result");
        }
        throw undefined;
      });
    }
    expect(caught).toBe(sentinel);
    expect(() => cursor.dispose()).not.toThrow();
    expect(thrown(() => cursor.advance(1))).toBe(sentinel);
  });

  it("emits nothing after a sink disposal between the two folds of a final unit", () => {
    // 53 full 128-unit ASCII chunks: the final unit's pending encode must flush and then the last
    // buffer flushes too (checked below on a normal run before relying on it).
    const payload = "a".repeat(53 * 128);
    const emittedAt: number[] = [];
    let advances = 0;
    const normal = createOwnedCanonicalHashCursor(payload, () => {
      emittedAt.push(advances);
    });
    let result: ReturnType<typeof normal.advance>;
    do {
      advances += 1;
      result = normal.advance(1);
    } while (result === undefined);
    expect(result?.contentHash).toBe(hashAdaptiveCanonical(payload));
    expect(emittedAt.length).toBeGreaterThanOrEqual(2);
    expect(emittedAt.slice(-2)).toEqual([advances, advances]);

    let calls = 0;
    const cursor = createOwnedCanonicalHashCursor(payload, () => {
      calls += 1;
      if (calls === emittedAt.length - 1) {
        cursor.dispose();
      }
    });
    for (let index = 0; index < advances; index += 1) {
      expect(cursor.advance(1)).toBeUndefined();
    }
    expect(calls).toBe(emittedAt.length - 1);
    expect(() => cursor.advance(1)).toThrow("Owned canonical hash cursor is disposed.");
  });
});
