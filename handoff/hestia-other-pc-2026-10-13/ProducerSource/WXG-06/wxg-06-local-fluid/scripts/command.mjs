import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,repo,save,bytes,node,python} from './bindings.mjs';
export function run(id,commands){
 if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id))throw Error('RUN_ID');
 const dir=resolve(repo,'.devtoolbox/specs/changes/wxg-06-2026-10-09/tests',id);if(existsSync(dir))throw Error('RUN_EXISTS');mkdirSync(dir,{recursive:true});const results=[];
 for(const c of commands){const startedAtUtc=new Date().toISOString(),start=performance.now();const r=spawnSync(c.executable??node,c.args,{cwd:root,windowsHide:true,encoding:'buffer',maxBuffer:16*1024*1024,env:{...process.env,OMP_NUM_THREADS:'1'},timeout:120000});
  const stdout=c.label+'.stdout.log',stderr=c.label+'.stderr.log';writeFileSync(resolve(dir,stdout),r.stdout??Buffer.alloc(0));writeFileSync(resolve(dir,stderr),r.stderr??Buffer.from(String(r.error??'')));
  results.push({...c,executable:c.executable??node,cwd:root,startedAtUtc,elapsedDiagnosticMs:performance.now()-start,exitCode:r.status,signal:r.signal,error:r.error?.code??null,stdout:bytes(dir,stdout),stderr:bytes(dir,stderr)});
 }
 const summary={id,status:results.every(c=>c.exitCode===0)?'PASS':'FAIL',executionLocation:'LOCAL_WINDOWS_ISOLATED',hostLoad:'CONCURRENT_SESSIONS_UNCONTROLLED',actualAdapter:'NOT_APPLICABLE_CPU_ONLY',gpuTimer:null,commands:results};save(resolve(dir,'summary.json'),summary);console.log(JSON.stringify({id,status:summary.status,exitCodes:results.map(c=>c.exitCode)}));return {dir,summary};
}
if(process.argv.includes('--control'))run('initial-controls',[{label:'frozen-w1-control',args:['--experimental-test-isolation=none','--test','--test-concurrency=1','tests/control.test.mjs']},{label:'preimplementation-red',args:['--experimental-test-isolation=none','--test','--test-concurrency=1','tests/red.test.mjs']}]);
if(process.argv.includes('--w1'))run('correct-fixture-control',[{label:'frozen-w1-control',args:['--experimental-test-isolation=none','--test','--test-concurrency=1','tests/control.test.mjs']}]);
