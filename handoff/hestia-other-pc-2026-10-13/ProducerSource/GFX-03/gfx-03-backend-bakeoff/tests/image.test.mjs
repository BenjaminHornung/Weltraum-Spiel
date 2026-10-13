import assert from 'node:assert/strict';
import test from 'node:test';
import { compareImages } from '../src/image-oracle.mjs';

function texturedImage(width, height) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 32 + (x * 3 + y * 5) % 128;
      pixels[offset + 1] = 40 + (x * 7 + y * 11) % 120;
      pixels[offset + 2] = 48 + (x * 13 + y * 17) % 112;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

function paintRect(pixels, width, x, y, rectWidth, rectHeight, paint) {
  for (let row = y; row < y + rectHeight; row++) {
    for (let column = x; column < x + rectWidth; column++) {
      paint((row * width + column) * 4, pixels);
    }
  }
}

test('identical nonblank RGBA8 captures pass', () => {
  const control = texturedImage(64, 64);
  const result = compareImages(new Uint8ClampedArray(control), new Uint8ClampedArray(control), 64, 64);
  assert.equal(result.pass, true);
  assert.equal(result.status, 'PASS');
  assert.equal(result.metrics.changedPixels, 0);
  assert.deepEqual(result.failedTiles, []);
});

test('a small but substantial local color patch fails spatially', () => {
  const control = texturedImage(64, 64);
  const candidate = control.slice();
  paintRect(candidate, 64, 2, 2, 2, 2, (offset, bytes) => { bytes[offset] = 255; });
  const result = compareImages(control, candidate, 64, 64);
  assert.equal(result.pass, false);
  assert.equal(result.status, 'DIFFERENT');
  assert.ok(result.metrics.changedFraction < 0.002, 'whole-frame changed fraction stays below its cap');
  assert.ok(result.failedTiles.length > 0, 'the localized tile exceeds its cap');
});

test('alpha ownership changes in a water patch fail', () => {
  const control = texturedImage(64, 64);
  const candidate = control.slice();
  paintRect(candidate, 64, 24, 24, 4, 4, (offset, bytes) => { bytes[offset + 3] = 0; });
  const result = compareImages(control, candidate, 64, 64);
  assert.equal(result.pass, false);
  assert.ok(result.failedTiles.length > 0);
  assert.ok(result.metrics.maxChannelDelta >= 255);
});

test('an AO-like darker patch fails', () => {
  const control = texturedImage(64, 64);
  const candidate = control.slice();
  paintRect(candidate, 64, 32, 32, 4, 4, (offset, bytes) => {
    bytes[offset] -= 40;
    bytes[offset + 1] -= 40;
    bytes[offset + 2] -= 40;
  });
  const result = compareImages(control, candidate, 64, 64);
  assert.equal(result.pass, false);
  assert.ok(result.failedTiles.length > 0);
});

test('empty, blank, and wrong-length captures fail closed', () => {
  const empty = new Uint8Array(0);
  assert.equal(compareImages(empty, empty, 0, 0).pass, false);
  assert.equal(compareImages(empty, empty, 1, 1).status, 'LENGTH_MISMATCH');
  assert.equal(compareImages(empty, empty, -1, 1).status, 'INVALID_DIMENSIONS');
  const blank = new Uint8Array(4 * 4 * 4);
  assert.equal(compareImages(blank, blank.slice(), 4, 4).status, 'BLANK_IMAGE');
  assert.equal(compareImages(new Uint8Array(63), new Uint8Array(64), 4, 4).status, 'LENGTH_MISMATCH');
});

test('one-byte channel variation stays within the immutable epsilon', () => {
  const control = texturedImage(64, 64);
  const candidate = control.slice();
  for (let offset = 0; offset < candidate.length; offset += 4) {
    candidate[offset]++;
    candidate[offset + 1]++;
    candidate[offset + 2]++;
  }
  const result = compareImages(control, candidate, 64, 64);
  assert.equal(result.pass, true);
  assert.equal(result.metrics.changedPixels, 0);
});
