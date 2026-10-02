import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-01';
const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const cli = path.join(lab, 'src/tools/reference-index/cli.mjs');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = (relative) => JSON.parse(readFileSync(path.join(lab, relative)));
const args = process.argv.slice(2);
assert(args.every((arg) => ['--generate', '--write-report'].includes(arg)) && new Set(args).size === args.length);
const directory = `${run}/catalog/${new Date().toISOString().replace(/[:.]/g, '-')}`;
mkdirSync(directory, { recursive: true });
const commands = [];
const executeCli = (label, flags) => {
  const started = new Date().toISOString();
  const result = spawnSync(node, [cli, ...flags], { cwd: lab, env: process.env, timeout: 15_000, maxBuffer: 2 * 1024 * 1024 });
  const stdout = result.stdout ?? Buffer.alloc(0);
  const stderr = result.stderr ?? Buffer.alloc(0);
  const stdoutPath = `${directory}/${label}.json`;
  const stderrPath = `${directory}/${label}.stderr.log`;
  writeFileSync(stdoutPath, stdout, { flag: 'wx' });
  writeFileSync(stderrPath, stderr, { flag: 'wx' });
  commands.push({ label, started, finished: new Date().toISOString(), binary: node, args: [cli, ...flags], cwd: lab,
    exitCode: result.status, signal: result.signal, error: result.error?.message ?? null,
    stdoutPath, stdoutBytes: stdout.length, stdoutSha256: sha256(stdout),
    stderrPath, stderrBytes: stderr.length, stderrSha256: sha256(stderr) });
  assert.equal(result.status, 0, `${label}: CLI must succeed`);
  return stdout;
};
if (args.includes('--generate')) {
  executeCli('generate', ['--write']);
}
const normal = executeCli('normal', []);
const reverse = executeCli('reverse', ['--reverse']);
assert(normal.equals(reverse), 'Normal/reverse CLI output must be byte-identical');
assert(normal.equals(readFileSync(path.join(lab, 'reference-cards/index.json'))), 'Fresh output must equal tracked catalog bytes');
const index = JSON.parse(normal);
assert.deepEqual(index.issues, []);
assert.equal(index.references.length, 7);
const manifest = readJson('docs/coordination/input-package/sources/web_sources.json');
const requests = readJson('reports/RD-01/sources-current.json');
const audit = readJson('reports/RD-01/source-audit.json');
assert.equal(requests.sourceManifestSha256, sha256(readFileSync(path.join(lab, 'docs/coordination/input-package/sources/web_sources.json'))));
const bodyBindings = [];
for (const record of requests.records) {
  const card = index.references.find((reference) => reference.id === record.id);
  assert.equal(record.requestedUrl, manifest.sources.find((source) => source.id === record.id).url);
  assert.equal(card.sourceRef.url, record.requestedUrl);
  assert.equal(card.accessStatus.checkedAt, record.requestedAt);
  assert.equal(card.accessStatus.httpStatus, record.httpStatus);
  assert.equal(card.accessStatus.contentType, record.contentType);
  assert.equal(card.accessStatus.accessClass, record.accessClass);
  assert.equal(card.accessStatus.media, record.mediaStatus);
  assert.deepEqual(card.observedIntervals, []);
  assert.equal(record.accessClass, 'JS_CHALLENGE');
  assert.equal(record.httpStatus, 200);
  assert.equal(record.body.complete, true);
  assert(record.body.byteLength <= record.byteCap);
  assert(realpathSync(record.body.path).startsWith(`${realpathSync(run)}${path.sep}http${path.sep}`));
  const body = readFileSync(record.body.path);
  assert.equal(body.length, record.body.byteLength);
  assert.equal(sha256(body), record.body.sha256);
  assert(body.toString('utf8').includes('name="js_challenge"'));
  const publicAnchorCount = [...body.toString('utf8').matchAll(/<a\b[^>]*\bhref=/gi)].length;
  assert.equal(publicAnchorCount, 0, 'No public developer links can be derived from these challenge bodies');
  assert.deepEqual(record.publicDeveloperLinks, []);
  bodyBindings.push({ id: record.id, path: record.body.path, byteLength: body.length, sha256: sha256(body), publicAnchorCount });
}
assert.equal(requests.records.length, 7);
const sortAssets = (assets) => [...assets].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
assert.deepEqual(index.concepts.assets, sortAssets(audit.assets));
for (const entry of [...index.references, index.concepts]) {
  for (const binding of Object.values(entry.sourceRef)) {
    if (binding && typeof binding === 'object' && binding.gitCommit) {
      const audited = audit.inputs.find((input) => input.path === binding.path);
      assert(audited, `Source audit must include ${binding.path}`);
      for (const field of ['gitCommit', 'blob', 'sha256']) {
        assert.equal(binding[field], audited[field]);
      }
    }
  }
}
const result = { taskId: 'RD-01', verifiedAt: new Date().toISOString(), productIntegrated: false, status: 'PASS',
  indexBytes: normal.length, indexSha256: sha256(normal), normalReverseByteEqual: true, trackedIndexByteEqual: true,
  commands, inputBindings: index.inputBindings, bodyBindings,
  missingConceptTargets: audit.assets.filter((asset) => asset.availability === 'MISSING_AT_PIN').length,
  lfsPointerOnlyImages: audit.assets.filter((asset) => asset.availability === 'LFS_POINTER_ONLY').length,
  browser: 'NOT_APPLICABLE', mediaPlayback: 'NOT_RUN', art: 'NOT_RUN', gpuPerformance: 'NOT_AUTHORIZED' };
const receiptPath = `${directory}/result.json`;
writeFileSync(receiptPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
if (args.includes('--write-report')) {
  writeFileSync(new URL('./catalog-verification.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
}
console.log(JSON.stringify({ status: result.status, receiptPath, indexBytes: result.indexBytes,
  indexSha256: result.indexSha256, normalReverseByteEqual: true, trackedIndexByteEqual: true,
  childCommands: commands.map((command) => ({ label: command.label, binary: command.binary, args: command.args, exitCode: command.exitCode })),
  sourceBodyBindings: bodyBindings.length, inputBindings: index.inputBindings.length,
  missingConceptTargets: result.missingConceptTargets, lfsPointerOnlyImages: result.lfsPointerOnlyImages,
  productIntegrated: false }, null, 2));
