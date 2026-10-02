import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runs = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs';
const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const probe = mkdtempSync(`${runs}/RD-00/playwright-profile-`);
const suffix = path.basename(probe).toLowerCase();
const sourceSha256 = createHash('sha256').update(readFileSync(path.join(lab, 'playwright.config.ts'))).digest('hex');
const cases = [];
const code = "const { default: config } = await import('./playwright.config.ts'); console.log(JSON.stringify({ outputDir: config.outputDir, reporter: config.reporter }));";
for (const name of ['absent', 'regular', 'run-link', 'results-link', 'report-link', 'report-directory']) {
  const runId = `${suffix}-${name}`;
  const browserRun = `${runs}/RD-03/browser/${runId}`;
  const target = path.join(probe, name);
  mkdirSync(target);
  mkdirSync(path.dirname(browserRun), { recursive: true });
  if (name === 'run-link') { symlinkSync(target, browserRun, 'junction'); }
  else if (name !== 'absent') {
    mkdirSync(browserRun);
    if (name === 'regular') {
      mkdirSync(`${browserRun}/results`);
      writeFileSync(`${browserRun}/report.json`, 'owned-fixture-marker', { flag: 'wx' });
    } else if (name === 'results-link') { symlinkSync(target, `${browserRun}/results`, 'junction'); }
    else if (name === 'report-link') { symlinkSync(target, `${browserRun}/report.json`, 'junction'); }
    else { mkdirSync(`${browserRun}/report.json`); }
  }
  const result = spawnSync(node, ['--experimental-strip-types', '--input-type=module', '--eval', code], {
    cwd: lab, env: { ...process.env, HESTIA_RD_TASK: 'RD-03', HESTIA_RD_BROWSER_RUN_ID: runId },
    encoding: 'utf8', windowsHide: true, timeout: 15_000, maxBuffer: 1_048_576,
  });
  const expected = ['absent', 'regular'].includes(name) ? 'accepted' : 'rejected';
  cases.push({ name, runId, browserRun, target, expected, exitCode: result.status });
  writeFileSync(path.join(probe, 'evidence.json'), `${JSON.stringify({ sourceSha256, cases, writeSinksExecuted: false, productIntegrated: false }, null, 2)}\n`);
  console.log(JSON.stringify(cases.at(-1)));
  if (expected === 'accepted') {
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout);
    assert.equal(config.outputDir, `${browserRun}/results`);
    assert.equal(config.reporter[1][1].outputFile, `${browserRun}/report.json`);
  } else {
    assert.notEqual(result.status, 0, `Actual config admitted ${name}; no runner or write sink was executed`);
    assert.match(result.stderr, /Run root link\/non-directory forbidden|Browser report link\/non-file forbidden/);
  }
  assert.deepEqual(readdirSync(target), []);
  if (name === 'regular') { assert.equal(readFileSync(`${browserRun}/report.json`, 'utf8'), 'owned-fixture-marker'); }
}
console.log(JSON.stringify({ status: 'PASS', sourceSha256, cases: cases.length, evidence: path.join(probe, 'evidence.json'), writeSinksExecuted: false, productIntegrated: false }));
