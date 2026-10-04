import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { commands, lab, node, git, immutable, environment, fresh, bound, ownBindings, START2 } from './phase2-support.mjs';
const [label, operation] = process.argv.slice(2); assert.match(label ?? '', /^[a-z0-9-]+$/);
const proof = immutable(); const bindings = ownBindings(); const started = new Date().toISOString();
if (operation === 'semantic') {
  const original = readFileSync(path.join(lab, 'tests/RD-12/browser.spec.ts'), 'utf8'); const supplement = readFileSync(path.join(lab, 'tests/RD-12/native-functional-v2.spec.ts'), 'utf8');
  const expected = original.slice(original.indexOf('const entry =')).replace('return JSON.parse(await page.locator(\'#facts\').innerText());', 'return observedV2(page);').replaceAll('test(`BAB', 'test(`SUPP-V2 BAB').trim();
  const actual = supplement.slice(supplement.indexOf('const entry ='), supplement.indexOf('// Supplemental evidence hooks')).trim();
  assert.equal(actual, expected, 'Only declared reader delegation and versioned title prefixes may differ in BAB bodies');
  fresh(`${commands}/${label}/receipt.json`, { started, finished: new Date().toISOString(), exitCode: 0, timedOut: false, source: START2, bindings,
    original: bound(path.join(lab, 'tests/RD-12/browser.spec.ts')), supplement: bound(path.join(lab, 'tests/RD-12/native-functional-v2.spec.ts')), result: 'PASS_VERBATIM_BAB_SEMANTICS_EXCEPT_EXPLICIT_READER_AND_TITLES', nativeExecution: 'NOT_RUN_CPU_CHECK', productIntegrated: false });
  console.log('PASS_VERBATIM_BAB_SEMANTICS_EXCEPT_EXPLICIT_READER_AND_TITLES');
} else {
  const tsc = path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe');
  const definitions = {
    types: [tsc, ['--noEmit', '-p', 'reports/RD-12/tsconfig.json', '--singleThreaded']],
    'root-types': [tsc, ['--noEmit', '-p', 'tsconfig.json', '--singleThreaded']],
    guard: [node, ['scripts/verify-boundary.mjs', '--task', 'RD-12', '--start', START2, '--base', 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e']],
    'review-diff': [git, ['--no-pager', 'diff', '--cached', '--', 'reports/RD-12', 'tests/RD-12']],
    'review-check': [git, ['diff', '--cached', '--check']],
    commit: [git, ['commit', '-m', 'RD-12 Record frozen native diagnostic evidence and owning findings', '--', 'reports/RD-12', 'tests/RD-12']],
  };
  assert(Object.hasOwn(definitions, operation)); const [binary, args] = definitions[operation]; const env = environment(label); const log = `${commands}/${label}/raw.log`; fresh(log, '');
  const child = spawn(binary, args, { cwd: lab, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let timedOut = false;
  fresh(`${commands}/${label}/started.json`, { started, pid: child.pid, binary, args, source: START2, bindings, nativeExecution: 'NOT_RUN_CPU_CHECK', productIntegrated: false });
  const append = (bytes) => { appendFileSync(log, bytes); process.stdout.write(bytes); }; child.stdout.on('data', append); child.stderr.on('data', append);
  const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 240_000);
  const result = await new Promise((resolve) => { child.once('error', (error) => append(Buffer.from(String(error)))); child.once('close', (exitCode, signal) => resolve({ exitCode, signal })); }); clearTimeout(timeout);
  fresh(`${commands}/${label}/receipt.json`, { ...result, started, finished: new Date().toISOString(), timedOut, binary, args, source: START2, bindings, raw: bound(log), nativeExecution: 'NOT_RUN_CPU_CHECK', productIntegrated: false }); process.exitCode = result.exitCode ?? 1;
}
