import assert from 'node:assert/strict';
import { appendFileSync, existsSync } from 'node:fs';
import { format } from 'node:util';
import path from 'node:path';
import { preview } from 'vite';
import { commands, lab, node, buildRoot, immutable, environment, assertPortFree, fresh, bound, sha } from './phase2-support.mjs';

const env = environment('preview'); Object.assign(process.env, env); const log = `${commands}/preview/raw.log`; fresh(log, '');
for (const method of ['log', 'info', 'warn', 'error']) {
  const original = console[method].bind(console);
  console[method] = (...args) => { appendFileSync(log, format(...args) + '\n'); original(...args); };
}
const proof = immutable(); await assertPortFree(); const started = new Date().toISOString();
fresh(`${commands}/preview/started.json`, { started, pid: process.pid, binary: node, script: bound(import.meta.filename), source: proof.start, buildRoot,
  env: { PATH: env.PATH, TEMP: env.TEMP, TMP: env.TMP }, sourceBindings: proof.sourceFiles, productIntegrated: false });
const server = await preview({ configFile: path.join(lab, 'vite.config.ts'), configLoader: 'native', build: { outDir: buildRoot }, preview: { host: '127.0.0.1', port: 5280, strictPort: true, open: false } });
assert.equal(server.httpServer.address().port, 5280); console.log('RD12_PREVIEW_READY http://127.0.0.1:5280 exact HEAD optimized build');
let stopped = false;
async function stop(reason) {
  if (stopped) { return; } stopped = true; clearInterval(control); clearTimeout(deadline);
  await new Promise((resolve, reject) => { server.httpServer.close((error) => { if (error) { reject(error); } else { resolve(); } }); server.httpServer.closeIdleConnections(); });
  console.log(`RD12_PREVIEW_STOPPED ${reason}`);
  fresh(`${commands}/preview/receipt.json`, { started, finished: new Date().toISOString(), pid: process.pid, exitCode: 0, timedOut: reason === 'deadline', reason,
    raw: bound(log), source: proof.start, buildRoot, productIntegrated: false }); process.exitCode = 0;
}
const control = setInterval(() => { if (existsSync(`${commands}/preview/stop.json`)) { void stop('owned-control-request'); } }, 200);
const deadline = setTimeout(() => { void stop('deadline'); }, 7_200_000);
