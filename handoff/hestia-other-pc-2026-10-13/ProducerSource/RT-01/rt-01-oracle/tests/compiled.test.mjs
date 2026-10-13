import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { traceDda } from '../.build/dda.mjs';
import { traceBruteForce } from '../.build/bruteForce.mjs';
import { frozenRoot } from '../export.mjs';
import path from 'node:path';

test('emitted JavaScript preserves all 1000 frozen ray results', async () => {
  const goldens = JSON.parse(await readFile(path.join(frozenRoot, 'rays/golden-1000.json')));
  const volumes = new Map();
  for (const golden of goldens) {
    if (!volumes.has(golden.volumeId)) volumes.set(golden.volumeId,
      JSON.parse(await readFile(path.join(frozenRoot, `voxels/${golden.volumeId}.json`))));
    const volume = volumes.get(golden.volumeId);
    for (const trace of [traceDda, traceBruteForce]) {
      const actual = trace(volume, golden.ray);
      assert.ok(Math.abs(actual.distance - golden.expected.distance) <= 1e-9);
      actual.normal.forEach((n, i) => assert.ok(Math.abs(n - golden.expected.normal[i]) <= 1e-9));
      assert.deepEqual({ ...actual, normal: [], distance: 0 }, { ...golden.expected, normal: [], distance: 0 });
    }
  }
});
