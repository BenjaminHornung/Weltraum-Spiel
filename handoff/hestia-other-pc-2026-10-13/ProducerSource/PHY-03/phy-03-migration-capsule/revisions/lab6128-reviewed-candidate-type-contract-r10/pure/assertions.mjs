import assert from 'node:assert/strict';
import {assert as chaiAssert} from './vendor/chai/index.js';

const cases = [], setup = [];
export const beforeAll = fn => { setup.push(fn); };
export const it = (name, fn) => { cases.push({name, fn}); };

// Authored toEqual compares data values, including null-prototype canonical records.
export const expect = actual => ({
  toBe: expected => assert.strictEqual(actual, expected),
  toEqual: expected => chaiAssert.deepEqual(actual, expected),
  toThrow: () => assert.throws(actual),
  not: {toThrow: () => assert.doesNotThrow(actual)},
  rejects: {
    toThrow: () => assert.rejects(actual),
    toMatchObject: expected => assert.rejects(actual, expected)
  }
});

export async function run() {
  chaiAssert.deepEqual(Object.assign(Object.create(null), {id: 'same', gyro: false}), {id: 'same', gyro: false});
  assert.throws(() => chaiAssert.deepEqual({gyro: false}, {gyro: true}));
  assert.throws(() => chaiAssert.deepEqual({mass: 1}, {mass: '1'}));
  assert.throws(() => chaiAssert.deepEqual({id: 'x'}, {id: 'x', checksum: 'required'}));
  assert.throws(() => chaiAssert.deepEqual([1, 2], [2, 1]));
  assert.strictEqual(cases.length, 8, 'Retain all eight original cases');
  for (const fn of setup) await fn();
  const results = [];
  for (const {name, fn} of cases) {
    try { await fn(); results.push({name, verdict: 'PASS'}); }
    catch (error) { results.push({name, verdict: 'FAIL', error: String(error.stack ?? error)}); }
  }
  const failed = results.filter(x => x.verdict === 'FAIL').length;
  console.log(JSON.stringify({population: 'R10_SYNTHETIC_AUTHORED_CODEC_MEMORY_ONLY',
    nodeVersion: process.versions.node, prepared: 8, executed: results.length,
    pass: results.length - failed, fail: failed, cases: results,
    matcherOracles: {population: 'ADAPTER_ONLY', executed: 5, pass: 5},
    verifiedSolverCandidateAdmission: 'NOT_EXERCISED_BY_ORIGINAL_EIGHT',
    nativeBrowserPublicSavePhysicalHeap: 'NOT_RUN'}, null, 2));
  if (failed) process.exitCode = 1;
}
