import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import native from './playwright.config';
import { admit, lab, sha } from './run.mjs';

export function supplementalConfig(version: 'diagnosis-v1' | 'functional-v2', spec: string) {
  const root = process.env.HESTIA_RD12_NATIVE_OUTPUT!; const outputDir = `${root}/${version}-results`;
  const record = `${root}/${version}-admission.json`;
  const identity = JSON.stringify({ schema: 'rd12-supplemental-admission-v1', version, originalAdmission: process.env.HESTIA_RD12_ADMISSION_SHA256,
    runId: process.env.HESTIA_RD_BROWSER_RUN_ID, source: process.env.HESTIA_RD12_PHASE2_SNAPSHOT_SHA256,
    spec, specSha256: sha(readFileSync(join(lab, 'tests/RD-12', spec))), outputDir, productIntegrated: false }, null, 2);
  const digest = sha(Buffer.from(identity));
  if (process.env.HESTIA_RD12_SUPPLEMENT_ADMISSION !== digest) {
    admit(record, { owner: root }); admit(outputDir, { owner: root }); writeFileSync(record, identity, { flag: 'wx' });
    process.env.HESTIA_RD12_SUPPLEMENT_ADMISSION = digest;
  } else {
    admit(record, { owner: root, fresh: false }); assert.equal(sha(readFileSync(record)), digest);
    admit(outputDir, { owner: root, fresh: false, directory: true });
  }
  return defineConfig({ ...native, testMatch: spec, outputDir, reporter: [['list'], ['json', { outputFile: `${root}/${version}-results.json` }]],
    metadata: { version, originalSuite: 'FAIL_RETAINED_UNCHANGED', productIntegrated: false } });
}
