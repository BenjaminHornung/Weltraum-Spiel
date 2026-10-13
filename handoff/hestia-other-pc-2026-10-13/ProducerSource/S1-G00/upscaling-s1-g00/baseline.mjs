import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const spike=path.dirname(fileURLToPath(import.meta.url)),carrier=path.resolve(spike,'../..');
const runId=process.argv[2];assert.match(runId??'',/^[a-zA-Z0-9-]+$/);
assert.equal(path.basename(carrier),'Hestia-Upscaling-S1-G00-2026-10-09');
const out=path.join(spike,'evidence',runId,'baseline');assert(!existsSync(out),'Preserve earlier runs');mkdirSync(out,{recursive:true});
const node='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';assert(existsSync(node));
const cwd=path.join(carrier,'apps/weltraum-browser'),manifest=JSON.parse(readFileSync(path.join(cwd,'package.json')));
assert.equal(manifest.scripts.build,'tsc -p tsconfig.json && vite build');assert.equal(manifest.scripts.test,'vitest run');
const hash=b=>createHash('sha256').update(b).digest('hex');
const tests=['tests/unit/renderBackendLifecycle.test.ts','tests/unit/three-material-factory.test.ts','tests/unit/hvp-visual-effects.test.ts','tests/unit/hvpShadowRevision.test.ts','tests/unit/hvp-route-bundle.test.ts','tests/unit/hvp-hud-hotpath.test.ts','tests/unit/hvp-camera.test.ts','tests/unit/graphicsSettingsAdapter.test.ts'];
tests.forEach(p=>assert(existsSync(path.join(cwd,p)),p));
const rows=[];
for(const [id,args,entry] of [['typecheck-build-first-stage',['node_modules/typescript/bin/tsc','-p','tsconfig.json'],'node_modules/typescript/bin/tsc'],['focused-unit',['node_modules/vitest/vitest.mjs','run',...tests,'--maxWorkers=1'],'node_modules/vitest/vitest.mjs']]){
  const at=new Date().toISOString(),r=spawnSync(node,args,{cwd,encoding:'utf8',timeout:60000,maxBuffer:1024*1024,windowsHide:true});
  const log=(r.stdout??'')+(r.stderr??'')+(r.error?'\n'+r.error.message:'');writeFileSync(path.join(out,id+'.log'),log);
  rows.push({id,at,endedAt:new Date().toISOString(),binary:node,args,cwd,exitCode:r.status,signal:r.signal,error:r.error?.message??null,
    localEntrypointPresent:existsSync(path.join(cwd,entry)),status:!existsSync(path.join(cwd,entry))?'FAIL_ENV':r.status===0?'PASS':'FAIL',log:id+'.log',logSha256:hash(log)});
}
writeFileSync(path.join(out,'results.json'),JSON.stringify({schema:'hestia.s1g00.baseline.v1',carrier:'17b1db4201a28e7b607c30707bdc2b75e3484a10',nodeSha256:hash(readFileSync(node)),nodeVersion:spawnSync(node,['--version'],{encoding:'utf8',windowsHide:true}).stdout.trim(),manifestSha256:hash(readFileSync(path.join(cwd,'package.json'))),manifestScripts:manifest.scripts,steps:rows,
  buildRemainder:'NOT_RUN: Vite is conditional on successful TypeScript in actual build script; product node_modules absent',e2e:'NOT_RUN: no dependency install, server or GPU/browser pilot',a0Worktree:'READ_ONLY_NOT_EXECUTED',productPass:false},null,2)+'\n');
console.log(JSON.stringify({steps:rows.map(r=>({id:r.id,exitCode:r.exitCode,status:r.status})),productPass:false}));
