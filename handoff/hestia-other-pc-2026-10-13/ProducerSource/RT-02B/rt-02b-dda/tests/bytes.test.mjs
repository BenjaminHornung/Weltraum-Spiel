import assert from 'node:assert/strict';
import test from 'node:test';
import { alignedBytes, packBytes, quoteResidency, readByte } from '../src/bytes.mts';

test('packs copied bytes into little-endian words and zero-pads the final word', () => {
  const bytes = Uint8Array.of(0x12, 0x34, 0x56, 0xff, 0x78);
  const packed = packBytes(bytes);
  const padded = Uint8Array.of(0x12, 0x34, 0x56, 0xff, 0x78, 0, 0, 0);
  const view = new DataView(padded.buffer);

  assert.deepEqual([...packed], [view.getUint32(0, true), view.getUint32(4, true)]);
  bytes[0] = 0;
  assert.equal(readByte(packed, 0), 0x12);
  assert.equal(readByte(packed, 3), 0xff);
  assert.equal(readByte(packed, 4), 0x78);
  assert.equal(readByte(packed, 7), 0);
  assert.deepEqual([...packBytes(new Uint8Array())], []);
});

test('rejects invalid byte indices and detached buffers', () => {
  const words = new Uint32Array([0x04030201]);
  for (const index of [-1, 0.5, Number.NaN, 4]) assert.throws(() => readByte(words, index), RangeError);

  const bytesBuffer = new ArrayBuffer(1);
  const bytes = new Uint8Array(bytesBuffer);
  structuredClone(bytesBuffer, { transfer: [bytesBuffer] });
  assert.throws(() => packBytes(bytes));

  const wordsBuffer = new ArrayBuffer(4);
  const detachedWords = new Uint32Array(wordsBuffer);
  structuredClone(wordsBuffer, { transfer: [wordsBuffer] });
  assert.throws(() => readByte(detachedWords, 0));
});

test('aligns large byte counts without 32-bit overflow and validates inputs', () => {
  assert.equal(alignedBytes(0x80000001, 0x1000), 0x80001000);
  assert.equal(alignedBytes(0, 8), 0);
  assert.throws(() => alignedBytes(-1, 4), RangeError);
  assert.throws(() => alignedBytes(1, 3), RangeError);
  assert.throws(() => alignedBytes(Number.MAX_SAFE_INTEGER, 2), RangeError);
});

test('quotes separately aligned buffers, double generations, and history', () => {
  const quote = quoteResidency({
    payloadBytes: 5,
    pageTableBytes: 0,
    hierarchyBytes: 8,
    metadataBytes: 128,
    historyBytes: 3,
  }, 4);

  assert.deepEqual(quote, {
    rawPayloadBytes: 5,
    perGenerationBytes: 148,
    oldNewGenerationsBytes: 296,
    historyBytes: 4,
    peakBytes: 300,
  });
  assert.equal(Object.isFrozen(quote), true);
  assert.throws(() => quoteResidency({
    payloadBytes: -1,
    pageTableBytes: 0,
    hierarchyBytes: 0,
    metadataBytes: 0,
    historyBytes: 0,
  }, 4), RangeError);
});
