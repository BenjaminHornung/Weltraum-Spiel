import { spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync,mkdirSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { root,repo,hash,verifyLocal,verifyProducer } from './bind-inputs.mjs';
import { captureTestedInputs,verifyRunBindings } from './run-bindings.mjs';
const name=process.argv[process.argv.indexOf('--run-id')+1];
if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name??'')||!process.argv.includes('--run-id'))throw new Error('RUN_ID_REQUIRED');
const run=resolve(repo,'.devtoolbox/specs/changes/cel-01-wxg-00-2026-10-09/tests/runs',name);
mkdirSync(run,{recursive:false});
const checks=[];
function command(label,exe,args,cwd=root) {
  const r=spawnSync(exe,args,{cwd,windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024});
  const stdout=r.stdout??'',stderr=r.stderr??'';
  writeFileSync(resolve(run,label+'.stdout.log'),stdout,{flag:'wx'});writeFileSync(resolve(run,label+'.stderr.log'),stderr,{flag:'wx'});
  const item={label,executable:exe,args,cwd,exitCode:r.status,errorCode:r.error?.code??null,stdout:{bytes:Buffer.byteLength(stdout),sha256:hash(stdout)},stderr:{bytes:Buffer.byteLength(stderr),sha256:hash(stderr)}};
  checks.push(item);return r;
}
const tools=command('tool-bytecheck',process.execPath,['scripts/tool-bindings.mjs','--check']);
const build=tools.status===0?command('build',process.execPath,['scripts/build.mjs']):{status:1};
let passed=0,failed=0,status='FAIL',testedInputs=[],compiledInputs=[];
if(build.status===0){
  testedInputs=captureTestedInputs();
  compiledInputs=JSON.parse(readFileSync(resolve(root,'.runtime/build-bindings.json'))).files.map(({path,...f})=>({localPath:path,...f}));
  const python='C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe';
  const oracle=command('independent-oracle',python,['scripts/oracle.py','--check']);
  const tests=readdirSync(resolve(root,'tests')).filter(x=>x.endsWith('.test.mjs')).sort().map(x=>'tests/'+x);
  const r=command('focused-tests',process.execPath,['--experimental-test-isolation=none','--test','--test-concurrency=1',...tests]);
  passed=Number(r.stdout?.match(/^# pass (\d+)$/m)?.[1]??0);failed=Number(r.stdout?.match(/^# fail (\d+)$/m)?.[1]??0);
  status=oracle.status===0&&r.status===0&&passed>0&&failed===0?'PASS':'FAIL';
}
let binding=null;
try {
  verifyLocal();verifyProducer();
  binding={sourceBindings:{bytes:readFileSync(resolve(root,'SourceBindings.json')).length,sha256:hash(readFileSync(resolve(root,'SourceBindings.json')))},packageLock:hash(readFileSync(resolve(root,'package-lock.json'))),
    fixture:hash(readFileSync(resolve(root,'fixtures/profiles.json'))),goldens:hash(readFileSync(resolve(root,'fixtures/schema-goldens.json'))),
    model:JSON.parse(readFileSync(resolve(root,'.runtime/model-binding.json'))),build:JSON.parse(readFileSync(resolve(root,'.runtime/build-bindings.json'))),
    dependencies:{bytes:readFileSync(resolve(root,'DependencyBindings.json')).length,sha256:hash(readFileSync(resolve(root,'DependencyBindings.json')))},
    dependencyLock:{bytes:readFileSync(resolve(root,'dependencies.lock.json')).length,sha256:hash(readFileSync(resolve(root,'dependencies.lock.json')))}};
}catch(error){status='FAIL';checks.push({label:'binding-check',exitCode:1,error:String(error)});}
const summary={status,environment:'LOCAL_WINDOWS_ISOLATED',implementation:status==='PASS'?'COMPLETE':'PARTIAL',passed,failed,checks,binding,
  testedInputs,compiledInputs,
  hostLoad:'CONCURRENT_UNCONTROLLED',testIsolation:'none',maxConcurrentTestWorkers:1,actualAdapter:'NOT_APPLICABLE',gpuTimer:'NOT_REQUESTED',reference:'NOT_RUN',productIntegration:'NO'};
if(status==='PASS'){try{verifyRunBindings(summary);}catch(error){summary.status='FAIL';summary.implementation='PARTIAL';summary.byteproofError=String(error);status='FAIL';}}
writeFileSync(resolve(run,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status,passed,failed,evidence:run,checks:checks.map(c=>({label:c.label,exitCode:c.exitCode,errorCode:c.errorCode}))}));
process.exit(status==='PASS'?0:1);
