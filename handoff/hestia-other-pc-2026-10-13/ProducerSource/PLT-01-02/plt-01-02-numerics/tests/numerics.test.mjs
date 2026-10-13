import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertU32,
  decodeNumbers,
  encodeNumbers,
  normalizeIdentity,
  q16Smoothstep,
  tickCounter,
  threefry2x32
} from "../src/numerics.mjs";

const kat = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/rng-kat.json", import.meta.url)), "utf8"));
const words = (values) => values.map((value) => Number.parseInt(value, 16));

test("assertU32 accepts only integer words in the unsigned 32-bit range", () => {
  assert.equal(assertU32(0), 0);
  assert.equal(assertU32(0xffffffff), 0xffffffff);
  for (const value of [-1, 0x1_0000_0000, 1.5, NaN, Infinity, "1", null]) {
    assert.throws(() => assertU32(value));
  }
});

test("Threefry2x32-20 matches the published Random123 known-answer vectors", () => {
  for (const vector of kat.vectors) {
    const result = threefry2x32(words(vector.counter), words(vector.key));
    assert.deepEqual(result, words(vector.expected));
    assert.equal(Object.isFrozen(result), true);
  }
});

test("Threefry2x32 rejects malformed counters, keys, and words", () => {
  assert.throws(() => threefry2x32([0], [0, 0]));
  assert.throws(() => threefry2x32([0, 0, 0], [0, 0]));
  assert.throws(() => threefry2x32([0, 0], [0]));
  assert.throws(() => threefry2x32([0, 0], [0, 0, 0]));
  assert.throws(() => threefry2x32([-1, 0], [0, 0]));
  assert.throws(() => threefry2x32([0, 1.5], [0, 0]));
});

test("Threefry output for a counter is independent of query order", () => {
  const key = [0x13198a2e, 0x03707344];
  const counters = [[0, 0], [1, 0], [0xffffffff, 0x12345678], [7, 9]];
  const forward = new Map(counters.map((counter) => [counter.join(":"), threefry2x32(counter, key)]));
  const reverse = new Map([...counters].reverse().map((counter) => [counter.join(":"), threefry2x32(counter, key)]));
  assert.deepEqual([...reverse].sort(), [...forward].sort());
});

test("q16Smoothstep exactly rounds every Q16 input and stays within the rational error bound", () => {
  const scale = 65_536n;
  const denominator = scale * scale;
  let previous = -1;
  for (let value = 0; value <= 65_536; value += 1) {
    const n = BigInt(value);
    const numerator = 3n * n * n * scale - 2n * n * n * n;
    const expected = (numerator + denominator / 2n) / denominator;
    const actual = q16Smoothstep(value);
    const signedError = BigInt(actual) * scale * scale - numerator;
    const absoluteError = signedError < 0n ? -signedError : signedError;
    assert.equal(actual, Number(expected), `nearest half-up at ${value}`);
    assert.ok(2n * absoluteError <= scale * scale, `error bound at ${value}`);
    assert.ok(actual >= previous, `monotonic at ${value}`);
    previous = actual;
  }
  assert.equal(q16Smoothstep(0), 0);
  assert.equal(q16Smoothstep(65_536), 65_536);
  for (const value of [-1, 65_537, 1.5, NaN, Infinity]) {
    assert.throws(() => q16Smoothstep(value));
  }
});

test("tickCounter splits safe nonnegative 120 Hz ticks into low and high words", () => {
  assert.deepEqual(tickCounter(0), [0, 0]);
  assert.deepEqual(tickCounter(0xffffffff), [0xffffffff, 0]);
  assert.deepEqual(tickCounter(0x1_0000_0000), [0, 1]);
  assert.deepEqual(tickCounter(Number.MAX_SAFE_INTEGER), [0xffffffff, 0x001fffff]);
  for (const tick of [-1, Number.MAX_SAFE_INTEGER + 1, 1.5, NaN, Infinity, "1"]) {
    assert.throws(() => tickCounter(tick));
  }
});

test("encodeNumbers writes the fixed canonical little-endian record and decodeNumbers reads it", () => {
  const input = { u32: 0x12345678, tick: 0x01020304050607, f64: 1.5 };
  const bytes = encodeNumbers(input);
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual([...bytes], [
    0x4e, 0x4d, 1, 0,
    0x78, 0x56, 0x34, 0x12,
    0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf8, 0x3f
  ]);
  assert.deepEqual(decodeNumbers(bytes), input);
  assert.deepEqual([...encodeNumbers({ ...input, f64: -0 })].slice(16), [0, 0, 0, 0, 0, 0, 0, 0]);
});

test("encodeNumbers rejects invalid fields and unsafe ticks", () => {
  for (const input of [
    { u32: -1, tick: 0, f64: 0 },
    { u32: 0x1_0000_0000, tick: 0, f64: 0 },
    { u32: 1.5, tick: 0, f64: 0 },
    { u32: 0, tick: -1, f64: 0 },
    { u32: 0, tick: Number.MAX_SAFE_INTEGER + 1, f64: 0 },
    { u32: 0, tick: 1.5, f64: 0 },
    { u32: 0, tick: 0, f64: NaN },
    { u32: 0, tick: 0, f64: Infinity }
  ]) {
    assert.throws(() => encodeNumbers(input));
  }
});

test("decodeNumbers rejects wrong lengths, headers, reserved bytes, unsafe ticks, and noncanonical floats", () => {
  const valid = encodeNumbers({ u32: 1, tick: 2, f64: 3 });
  assert.throws(() => decodeNumbers(valid.subarray(0, 23)));
  assert.throws(() => decodeNumbers(new Uint8Array(25)));
  for (const offset of [0, 1, 2, 3]) {
    const malformed = valid.slice();
    malformed[offset] ^= 1;
    assert.throws(() => decodeNumbers(malformed));
  }

  const unsafeTick = valid.slice();
  new DataView(unsafeTick.buffer).setBigUint64(8, BigInt(Number.MAX_SAFE_INTEGER) + 1n, true);
  assert.throws(() => decodeNumbers(unsafeTick));

  for (const value of [NaN, Infinity, -Infinity, -0]) {
    const malformed = valid.slice();
    new DataView(malformed.buffer).setFloat64(16, value, true);
    assert.throws(() => decodeNumbers(malformed));
  }
});

test("normalizeIdentity returns NFC text and enforces well-formed UTF-8 byte bounds", () => {
  assert.equal(normalizeIdentity("é"), "é");
  assert.equal(normalizeIdentity("e\u0301"), "é");
  assert.equal(normalizeIdentity("é".repeat(128)).length, 128);
  assert.equal(normalizeIdentity("a".repeat(256)).length, 256);
  assert.throws(() => normalizeIdentity(""));
  assert.throws(() => normalizeIdentity("é".repeat(129)));
  assert.throws(() => normalizeIdentity("a".repeat(257)));
  assert.throws(() => normalizeIdentity("\ud800"));
  assert.throws(() => normalizeIdentity("\udc00"));
  assert.throws(() => normalizeIdentity(1));
});
