import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {spike,sha} from './inputs.mjs';
const root=path.resolve(spike,'../..'),evidence=path.join(root,'.devtoolbox/specs/changes/rt-02b-2026-10-09/tests');
assert.ok(path.resolve(process.execPath).toLowerCase().startsWith('c:\\ifi_sourcecode\\'),'Use approved Node22 path');
assert.match(process.version,/^v22\./);await mkdir(evidence,{recursive:true});
const runId=process.argv[2]??'repro-'+new Date().toISOString().replace(/[:.]/g,'-');assert.match(runId,/^[\w-]+$/);
const steps=[['control',['control.mjs']],['typecheck',['node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.json']],
 ['tests',['--test','--experimental-test-isolation=none','--test-concurrency=1','tests/bytes.test.mjs','tests/sparse.test.mjs','tests/port.test.mjs','tests/inputs-gpu.test.mjs','tests/gpu-lifetime.test.mjs']],
 ['build',['build.mjs']],['diagnostics',['diagnostics.mjs',path.join(evidence,runId+'-diagnostics.json')]]],commands=[];
for(const [name,args] of steps){const r=spawnSync(process.execPath,args,{cwd:spike,encoding:'utf8',maxBuffer:8*1024*1024});
 const output=(r.stdout??'')+(r.stderr??''),log=runId+'-'+name+'.log';await writeFile(path.join(evidence,log),output,{flag:'wx'});
 commands.push({name,executable:process.execPath,args,cwd:spike,exitCode:r.status,error:r.error?.code??null,log,logSha256:sha(Buffer.from(output))});
 console.log(name+': '+(r.status===0?'PASS':'FAIL')+' exit='+r.status);if(r.status!==0||r.error)break;}
const result={schema:'hestia.rt02b.command-exits.v1',status:commands.length===steps.length&&commands.every(c=>c.exitCode===0)?'PASS':'FAIL',runId,node:process.version,commands,hardware:'NOT_RUN',actualAdapter:null,hostLoad:'UNCONTROLLED_PARALLEL_SESSIONS'};
await writeFile(path.join(evidence,runId+'-commands.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});if(result.status!=='PASS')process.exitCode=1;
