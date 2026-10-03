import { expect, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

it('P2_PHASE2 owning publication comparison accepts optional undefined SDK admission but rejects real hash/value changes', () => {
  const source = readFileSync(new URL('../../../reports/RD-10/phase2-evidence.mjs', import.meta.url), 'utf8');
  const blocks = [...source.matchAll(/const published = json\(report\);\r?\n([\s\S]*?)\r?\n\s*write\('candidate\.json'/g)];
  expect(blocks).toHaveLength(1);
  // Execute the committed owning comparison only, never its candidate writer or historical preconditions.
  const compare = new Function('assert', 'published', 'proof', blocks[0][1]) as
    (assertion: typeof assert, published: unknown, proof: unknown) => void;
  const hash = 'a'.repeat(64);
  const proof = {
    shared: [{ path: 'package-lock.json', sha256: hash }],
    graph: [{ path: 'assets/renderer-probe.js', sha256: hash }],
    browser: { media: [
      { path: 'attachments/webgpu.png', sha256: hash, bytes: 135541, admission: undefined },
      { path: 'webgpu.png', sha256: hash, bytes: 135541, admission: { point: 'PREWRITE-ADMITTED', optional: undefined } },
    ] },
    negativeEvidence: { firstFailure: { reason: 'first compile failure' } },
    behavioralRedGreen: { oracleSha256: hash, green: { passed: 2 } },
    profileAvailability: { C2: 'NOT_IMPLEMENTED' },
    qualifications: { targetGpu: 'NOT_RUN', optional: undefined },
  };
  const published: typeof proof = JSON.parse(JSON.stringify(proof));
  expect(Object.hasOwn(proof.browser.media[0], 'admission')).toBe(true);
  expect(Object.hasOwn(published.browser.media[0], 'admission')).toBe(false);
  expect(() => compare(assert, published, proof)).not.toThrow();

  const mutations: Array<[string, (value: typeof proof) => void]> = [
    ['shared', (value) => { value.shared[0].sha256 = 'b'.repeat(64); }],
    ['graph', (value) => { value.graph[0].sha256 = 'b'.repeat(64); }],
    ['browser', (value) => { value.browser.media[0].sha256 = 'b'.repeat(64); }],
    ['browser', (value) => { value.browser.media[0].bytes += 1; }],
    ['browser', (value) => { value.browser.media[1].admission!.point = 'NOT-ADMITTED'; }],
    ['negativeEvidence', (value) => { value.negativeEvidence.firstFailure.reason = 'overwritten cause'; }],
    ['behavioralRedGreen', (value) => { value.behavioralRedGreen.oracleSha256 = 'b'.repeat(64); }],
    ['profileAvailability', (value) => { value.profileAvailability.C2 = 'IMPLEMENTED'; }],
    ['qualifications', (value) => { value.qualifications.targetGpu = 'QUALIFIED'; }],
  ];
  for (const [key, mutate] of mutations) {
    const changed = structuredClone(published); mutate(changed);
    expect(() => compare(assert, changed, proof)).toThrow(`Published ${key} binding`);
  }
});
