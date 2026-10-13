import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,repo,node,python,hash,verifyFiles,verifyConsumer,verifyBuild,verifyIsolation,walk,bytes,save,captureInputs} from './bindings.mjs';
const id=process.argv[process.argv.indexOf('--run-id')+1];if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id??''))throw Error('RUN_ID_REQUIRED');
const dir=resolve(repo,'.devtoolbox/specs/changes/wxg-01-04-2026-10-09/tests/runs',id);if(existsSync(dir))throw Error('RUN_EXISTS');
verifyIsolation();verifyConsumer();mkdirSync(dir,{recursive:true});
const steps=process.argv.includes('--initial')?[['build',node,['scripts/build.mjs']],['tests',node,['--experimental-test-isolation=none','--test','--test-concurrency=1','tests/geometry.test.mjs','tests/climate.test.mjs','tests/wxg.test.mjs']]]:
  [['use-time-binding',node,['scripts/check-bindings.mjs']],['build',node,['scripts/build.mjs']],['fixture-bytecheck',node,['scripts/export-fixtures.mjs','--check']],['independent-oracle',python,['scripts/oracle.py']],['focused-tests',node,['--experimental-test-isolation=none','--test','--test-concurrency=1','tests/bindings.test.mjs','tests/cache-race.test.mjs','tests/geometry.test.mjs','tests/climate.test.mjs','tests/wxg.test.mjs','vendor/cel/tests/control.test.mjs','vendor/cel/tests/contracts.test.mjs','vendor/cel/tests/goldens.test.mjs','vendor/cel/tests/negative.test.mjs','vendor/cel/tests/read.test.mjs']]];
const inputs=captureInputs();
const checks=[];for(const [label,executable,args] of steps){
  if(!['use-time-binding','build'].includes(label))verifyBuild();
  const startedAtUtc=new Date().toISOString(),start=performance.now();
  const r=spawnSync(executable,args,{cwd:root,windowsHide:true,maxBuffer:16*1024*1024});
  writeFileSync(resolve(dir,label+'.stdout.log'),r.stdout??'');writeFileSync(resolve(dir,label+'.stderr.log'),r.stderr??'');
  checks.push({label,executable,args,cwd:root,startedAtUtc,elapsedDiagnosticMs:performance.now()-start,exitCode:r.status,errorCode:r.error?.code??null,stdout:bytes(dir,label+'.stdout.log'),stderr:bytes(dir,label+'.stderr.log')});
  if(r.status!==0){process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');break;}
}
// The model pin is a build output; bind its post-build bytes, all declarations and copied modules.
const testedInputs=inputs.filter(f=>f.path!=='src/model-pin.ts');testedInputs.push(bytes(root,'src/model-pin.ts'));
const compiledInputs=existsSync(resolve(root,'.runtime/build-bindings.json'))?JSON.parse(readFileSync(resolve(root,'.runtime/build-bindings.json'))).files:[];
const testCheck=checks.find(c=>c.label==='focused-tests'||c.label==='tests');const output=testCheck?readFileSync(resolve(dir,testCheck.stdout.path),'utf8'):'';
const count=n=>Number(output.match(new RegExp('# '+n+' (\\d+)'))?.[1]??0);
const result={schema:'wxg.local-functional-run/v1',id,executionLocation:'LOCAL_WINDOWS_ISOLATED',status:checks.length===steps.length&&checks.every(c=>c.exitCode===0)?'PASS':'FAIL',checks,
  passed:count('pass'),failed:count('fail'),skipped:count('skipped'),testedInputs,compiledInputs,consumerManifest:bytes(root,'ConsumerBindings.json'),model:existsSync(resolve(root,'.runtime/model-binding.json'))?JSON.parse(readFileSync(resolve(root,'.runtime/model-binding.json'))):null,
  hostLoad:'Concurrent other sessions, uncontrolled; FUNCTIONAL_DIAGNOSTIC_ONLY',actualAdapter:'NOT_APPLICABLE_CPU_ONLY',gpuTimer:'NOT_REQUESTED',referenceHardware:'NOT_RUN',productIntegration:'NO'};
save(resolve(dir,'summary.json'),result);console.log(JSON.stringify({status:result.status,id,checks:checks.map(c=>({label:c.label,exitCode:c.exitCode})),passed:result.passed,failed:result.failed,skipped:result.skipped}));if(result.status!=='PASS')process.exit(1);
