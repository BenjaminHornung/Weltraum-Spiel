import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { commands, lab, node, playwrightCli, immutable, environment, fresh, bound, ownBindings, servedManifest, json, sha, nativeOutput } from './phase2-support.mjs';

Object.assign(process.env, environment('launcher')); const proof = immutable(); await servedManifest('readiness-01');
assert(!process.env.HESTIA_RD12_ADMITTED_BROWSER_ROOT && !process.env.HESTIA_RD12_ADMISSION_SHA256, 'Do not supply an invented admission capability');
// The unchanged config creates the admission and its inherited worker capability.
await import(pathToFileURL(path.join(lab, 'reports/RD-12/playwright.config.ts')).href);
fresh(`${commands}/launcher/admission-owner.json`, { pid: process.pid, nativeOutput, admission: bound(`${nativeOutput}/admission.json`), source: proof.start, productIntegrated: false });
async function run(label, config, list = false) {
  assert.match(label, /^[a-z0-9-]+$/); immutable(); const bindings = ownBindings(); const env = environment(label);
  const args = [playwrightCli, 'test', '--config', config, ...(list ? ['--list'] : [])]; const log = `${commands}/${label}/raw.log`; fresh(log, '');
  fresh(`${commands}/${label}/source-seal.json`, { schema: 'rd12-phase2-pre-run-seal-v1', source: proof.start, tree: proof.tree, bindings, config: bound(path.join(lab, config)), executable: bound(node), browser: proof.executables.find((entry) => entry.path.endsWith('/chrome.exe')), productIntegrated: false });
  const started = new Date().toISOString(); let timedOut = false; const child = spawn(node, args, { cwd: lab, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  fresh(`${commands}/${label}/started.json`, { started, pid: child.pid, binary: node, args, cwd: lab, TEMP: env.TEMP, PATH: env.PATH, source: proof.start, bindings, nativeExecution: list ? 'NOT_RUN_INVENTORY' : 'ATTEMPTED_FUNCTIONAL_DIAGNOSTIC', productIntegrated: false });
  const append = (bytes) => { appendFileSync(log, bytes); process.stdout.write(bytes); }; child.stdout.on('data', append); child.stderr.on('data', append);
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, 3_600_000);
  const result = await new Promise((resolve) => { child.once('error', (error) => append(Buffer.from(String(error)))); child.once('close', (exitCode, signal) => resolve({ exitCode, signal })); }); clearTimeout(timer);
  const receipt = { label, ...result, started, finished: new Date().toISOString(), timedOut, binary: node, args, cwd: lab, source: proof.start, tree: proof.tree,
    bindings, raw: bound(log), sourceSeal: bound(`${commands}/${label}/source-seal.json`), nativeExecution: list ? 'NOT_RUN_INVENTORY' : 'ATTEMPTED_FUNCTIONAL_DIAGNOSTIC', productIntegrated: false };
  fresh(`${commands}/${label}/receipt.json`, receipt); console.log(`RD12_JOB_COMPLETE ${label} exit=${result.exitCode} timedOut=${timedOut}`); return result;
}
const inventory = await run('original-inventory-01', 'reports/RD-12/playwright.config.ts', true); assert.equal(inventory.exitCode, 0);
const listing = readFileSync(`${commands}/original-inventory-01/raw.log`, 'utf8'); const total = listing.match(/Total: (\d+) tests? in (\d+) files?/);
assert(total, 'Actual Playwright inventory count required'); const titles = listing.split(/\r?\n/).filter((line) => /browser\.spec\.ts:\d+:\d+/.test(line)).map((line) => line.trim());
assert.equal(titles.length, Number(total[1])); fresh(`${commands}/inventory-01.json`, { source: proof.start, count: Number(total[1]), files: Number(total[2]), titles, raw: bound(`${commands}/original-inventory-01/raw.log`), productIntegrated: false });
await run('original-native-01', 'reports/RD-12/playwright.config.ts'); console.log('RD12_ORIGINAL_COMPLETE; waiting for explicitly sealed supplemental request or stop');
const accepted = new Set(); let busy = false;
const control = setInterval(async () => {
  if (busy) { return; }
  if (existsSync(`${commands}/launcher/stop.json`)) { clearInterval(control); clearTimeout(deadline); console.log('RD12_LAUNCHER_STOPPED'); return; }
  const requests = readdirSync(`${commands}/launcher`).filter((file) => /^request-[a-z0-9-]+\.json$/.test(file) && !accepted.has(file));
  if (requests.length === 0) { return; } assert.equal(requests.length, 1, 'Only one sequential native request'); busy = true; const file = requests[0]; accepted.add(file);
  try {
    const request = json(`${commands}/launcher/${file}`); assert(['reports/RD-12/native-diagnosis-v1.config.ts', 'reports/RD-12/native-functional-v2.config.ts'].includes(request.config));
    assert.equal(sha(Buffer.from(JSON.stringify(ownBindings()))), request.ownBindingsSha256, 'Supplement changed after explicit pre-run seal');
    await run(request.label, request.config, request.list === true);
  } catch (error) { console.error(error); fresh(`${commands}/launcher/error-${file}`, { error: String(error), productIntegrated: false }); }
  finally { busy = false; }
}, 200);
const deadline = setTimeout(() => { if (!busy) { clearInterval(control); console.log('RD12_LAUNCHER_DEADLINE'); process.exitCode = 1; } }, 7_200_000);
