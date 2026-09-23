import { describe, expect, it } from "vitest";
import { fnv1a64Bytes } from "../../src/core/fnv1a64";
import { AdaptiveAuthorityError, canonicalAdaptiveJson, hashAdaptiveCanonical } from "../../src/voxel/adaptive";

const oracle = (bytes: Uint8Array): string => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
};

describe("P01 byte-identical FNV-1a 64-bit", () => {
  it.each([
    ["", "cbf29ce484222325"],
    ["a", "af63dc4c8601ec8c"],
    ["foobar", "85944171f73967e8"]
  ])("preserves the known vector %j", (text, expected) => {
    expect(fnv1a64Bytes(new TextEncoder().encode(text))).toBe(expected);
  });

  it("agrees with independent BigInt arithmetic for 1200 deterministic buffers", () => {
    let seed = 0x17309a7;
    const next = (): number => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return seed >>> 0;
    };
    for (let sample = 0; sample < 1200; sample += 1) {
      const bytes = new Uint8Array(next() % 8193);
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = next() & 255;
      }
      expect(fnv1a64Bytes(bytes)).toBe(oracle(bytes));
    }
  });

  it.each([
    ["all byte values", Uint8Array.from({ length: 256 }, (_, index) => index)],
    ["long 0xff sequence", new Uint8Array(65_536).fill(255)],
    ["UTF-8 umlauts and emoji", new TextEncoder().encode("ÄÖÜ äöü ß 🚀 🌍")]
  ] as const)("preserves %s and leaves its input unchanged", (_name, bytes) => {
    const before = bytes.slice();
    expect(fnv1a64Bytes(bytes)).toBe(oracle(bytes));
    expect(bytes).toEqual(before);
  });

  it("hashes only an unaligned subview without changing the backing array", () => {
    const backing = Uint8Array.from({ length: 263 }, (_, index) => (index * 73 + 11) & 255);
    const before = backing.slice();
    const view = backing.subarray(3, 260);
    expect(fnv1a64Bytes(view)).toBe(oracle(view));
    expect(backing).toEqual(before);
  });

  it("preserves canonical framing, prefix and negative-zero handling", () => {
    const value = { z: [null, true, -0, "Größe 🚀"], a: { number: 1.25 } };
    const bytes = new TextEncoder().encode(canonicalAdaptiveJson(value));
    expect(hashAdaptiveCanonical(value)).toBe(`fnv1a64-v1:${oracle(bytes)}`);
    expect(hashAdaptiveCanonical(value)).toBe(hashAdaptiveCanonical({ a: { number: 1.25 }, z: [null, true, 0, "Größe 🚀"] }));
    expect(hashAdaptiveCanonical("é")).not.toBe(hashAdaptiveCanonical("e\u0301"));
  });

  it("does not memoize mutable caller objects", () => {
    const value = { count: 1 };
    const before = hashAdaptiveCanonical(value);
    value.count = 2;
    expect(hashAdaptiveCanonical(value)).toBe(`fnv1a64-v1:${oracle(new TextEncoder().encode(canonicalAdaptiveJson(value)))}`);
    expect(hashAdaptiveCanonical(value)).not.toBe(before);
  });

  it.each([
    ["undefined", undefined],
    ["NaN", NaN],
    ["positive infinity", Infinity],
    ["negative infinity", -Infinity],
    ["sparse array", new Array(2)],
    ["lone high surrogate", "\ud800"],
    ["lone low surrogate", "\udc00"],
    ["BigInt", 1n],
    ["symbol", Symbol("not-canonical")],
    ["function", () => 1]
  ])("keeps rejecting %s at the canonical boundary", (_name, value) => {
    expect(() => hashAdaptiveCanonical(value)).toThrow(AdaptiveAuthorityError);
  });

  it("rejects accessors without executing caller code", () => {
    let reads = 0;
    const value = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => { reads += 1; return 1; }
    });
    expect(() => hashAdaptiveCanonical(value)).toThrow(AdaptiveAuthorityError);
    expect(reads).toBe(0);
  });
});
