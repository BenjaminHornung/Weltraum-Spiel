import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const commands = readFileSync(`${run}/commands.jsonl`, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
const required = ['red', 'ci-final', 'check-boundary-review', 'green-boundary-review', 'build-final', 'browser-final', 'port-after-browser-final', 'boundary-final'];
for (const label of required) {
  const record = commands.findLast((entry) => entry.label === label); assert.ok(record, `Missing gate: ${label}`);
  assert.equal(record.exitCode, label === 'red' ? 1 : 0, `Wrong exit: ${label}`);
}
const browser = commands.findLast((entry) => entry.label === 'browser-final');
const id = browser.processLocal.browserRunId;
const artifacts = [`${run}/red-source-snapshot.json`, `${run}/b3-read-only/bindings.json`,
  ...['report.json', 'diagnostic.json', 'result.json', 'byte-bindings.json'].map((name) => `${run}/browser/${id}/${name}`),
  `${run}/media/${id}.png`];
const files = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vitest.config.ts',
  'playwright.config.ts', 'index.html', '.gitignore', 'src/registration.ts', 'scripts/verify-boundary.mjs',
  ...readdirSync(`${lab}/src/contracts`).map((name) => `src/contracts/${name}`),
  'tests/RD-00/unit.test.ts', 'tests/RD-00/browser.spec.ts'];
const frozenFiles = files.sort().map((name) => ({ path: name, sha256: sha(readFileSync(path.join(lab, name))) }));
const processes = JSON.parse(readFileSync(`${lab}/reports/RD-00/managed-processes.json`, 'utf8'));
for (const [index, process] of processes.runs.entries()) {
  writeFileSync(`${run}/logs/server-${index + 1}.log`, `${process.outputLines.join('\n')}\n`);
}
const result = JSON.parse(readFileSync(`${run}/browser/${id}/result.json`, 'utf8'));
assert.equal(result.productIntegrated, false); assert.equal(result.samples.observed, 1);
for (const metric of Object.values(result.metrics)) {
  assert.ok(metric.status === 'not-run' || metric.status === 'unsupported'); assert.ok(!Object.hasOwn(metric, 'value'));
}
const evidence = { schema: 'rd00-verification-v1', collectedAt: new Date().toISOString(),
  productReadBase: 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e',
  start: '807e8b4cc4528bd9d02122109e08e2e869305047', productIntegrated: false,
  commands: commands.map((entry) => ({ ...entry, logSha256: sha(readFileSync(entry.log)) })),
  frozenFiles, artifacts: artifacts.map((file) => ({ path: file, sha256: sha(readFileSync(file)) })),
  serverRawLogs: [`${run}/logs/server-1.log`, `${run}/logs/server-2.log`],
  review: 'Self-review only; no independent/human review', GPU: 'NOT_RUN: no lease',
  art: 'NOT_RUN', productTests: 'NOT_RUN: read-only product; RD-00 lab only' };
writeFileSync(`${lab}/reports/RD-00/verification.json`, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ gates: required, frozenFiles: frozenFiles.length, artifacts: artifacts.length,
  result: 'PASS', snapshot: `${lab}/reports/RD-00/verification.json` }, null, 2));
