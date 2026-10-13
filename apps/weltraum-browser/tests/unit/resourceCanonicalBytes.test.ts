import { describe, expect, it } from "vitest";
import { canonicalJson, canonicalSignature, canonicalizeJsonValue, CanonicalSerializationError } from "../../src/resources/serialization";

describe("persistent canonical byte contract", () => {
  it("pins lexical numeric keys, exact numbers, negative zero and Unicode bytes/signature", () => {
    const input = {"2": 2, "10": 10, text: "A\n😀", n: .123456789, a: -0};
    expect(canonicalJson(input)).toBe('{"10":10,"2":2,"a":0,"n":0.123456789,"text":"A\\n😀"}');
    expect(canonicalSignature(input)).toBe("18a5dbce");
  });

  it("reads each getter once in sorted depth-first order", () => {
    const reads: string[] = [];
    const input = {get z() { reads.push("z"); return 2; }, get a() {
      reads.push("a"); return {get x() { reads.push("x"); return 1; }};
    }};
    expect(canonicalJson(input)).toBe('{"a":{"x":1},"z":2}');
    expect(reads).toEqual(["a", "x", "z"]);
  });

  it("allows shared children while rejecting an actual parent cycle", () => {
    const child = {value: 1};
    expect(canonicalJson({b: child, a: child})).toBe('{"a":{"value":1},"b":{"value":1}}');
    const cycle: {self?: unknown} = {}; cycle.self = cycle;
    expect(() => canonicalJson(cycle)).toThrow("Canonical JSON does not permit cyclic values");
  });

  it("keeps the actual array iterator and ignores caller map", () => {
    const array = [1];
    Object.defineProperty(array, "map", {value: () => { throw Error("Caller map must not run"); }});
    const proxy = new Proxy(array, {get(target, key, receiver) {
      return key === Symbol.iterator ? () => [2, 3][Symbol.iterator]() : Reflect.get(target, key, receiver);
    }});
    expect(canonicalJson(proxy)).toBe("[2,3]");
  });

  it("checks dense own indexes before iteration and closes a failing iterator", () => {
    let opened = false, closed = false;
    const sparse = new Array(2);
    sparse[Symbol.iterator] = function* () { opened = true; yield 1; return undefined; };
    expect(() => canonicalJson(sparse)).toThrow("Canonical JSON does not permit sparse arrays");
    expect(opened).toBe(false);
    const array: unknown[] = [1];
    array[Symbol.iterator] = function* () { try { yield 1; yield undefined; return undefined; } finally { closed = true; } };
    expect(() => canonicalJson(array)).toThrow(CanonicalSerializationError);
    expect(closed).toBe(true);
  });

  it.each([undefined, Symbol("unsupported"), 1n, Infinity, NaN, () => 1, new Date(0)])("rejects unsupported values %s", value => {
    expect(() => canonicalJson({value})).toThrow(CanonicalSerializationError);
  });

  it("retains the public defensive deeply frozen canonical tree", () => {
    const input = {nested: {value: 1}, array: [2]};
    const tree = canonicalizeJsonValue(input) as {nested: {value: number}; array: number[]};
    input.nested.value = 9; input.array[0] = 9;
    expect(tree.nested.value).toBe(1); expect(tree.array).toEqual([2]);
    expect(Object.getPrototypeOf(tree)).toBeNull();
    expect(Object.isFrozen(tree)).toBe(true);
    expect(Object.isFrozen(tree.nested)).toBe(true);
    expect(Object.isFrozen(tree.array)).toBe(true);
  });
});
