import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,save,sha,binding,walk,verifyInputs} from './bindings.mjs';
verifyInputs();const label=process.argv[2]??'local-'+new Date().toISOString().replace(/[^0-9]/g,'');if(!/^[a-zA-Z0-9_-]+$/.test(label))throw Error('RUN_LABEL');
const output='../../.devtoolbox/specs/changes/wxg-07-2026-10-09/tests/'+label;if(existsSync(resolve(root,output)))throw Error('PRESERVE_EXISTING_RUN');mkdirSync(resolve(root,output),{recursive:true});
const commands=[['node-version',process.execPath,['--version']],['node-syntax',process.execPath,['--check','src/checkpoint.mjs']],['bindings',process.execPath,['scripts/bindings.mjs']],['producer-closure',process.execPath,['scripts/verify-producers.mjs']],['build-typecheck',process.execPath,['scripts/build.mjs']],['fixtures',process.execPath,['scripts/prepare-fixtures.mjs']],['historic-and-focused-tests',process.execPath,['--experimental-test-isolation=none','--test','--test-concurrency=1','inputs/wxg/tests/geometry.test.mjs',...walk('tests').filter(p=>p.endsWith('.test.mjs'))]],['finite-runtime-matrix',process.execPath,['scripts/matrix.mjs',output+'/matrix']]];
const records=[],before={sources:walk('src').map(binding),tests:walk('tests').map(binding),scripts:walk('scripts').map(binding),inputManifest:binding('InputBindings.json'),tool: {path:process.execPath,bytes:readFileSync(process.execPath).length,sha256:sha(readFileSync(process.execPath))}};
for(const [name,executable,args] of commands){
  const start=new Date().toISOString(),r=spawnSync(executable,args,{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:16*1024*1024});
  writeFileSync(resolve(root,output,name+'.stdout.log'),r.stdout??'');writeFileSync(resolve(root,output,name+'.stderr.log'),r.stderr??'');
  records.push({name,executable,args,cwd:root,start,end:new Date().toISOString(),exitCode:r.status,error:r.error?.code??null,stdout:binding(output+'/'+name+'.stdout.log'),stderr:binding(output+'/'+name+'.stderr.log')});
  console.log(name+' exit='+r.status);save(output+'/summary.json',{schema:'wxg07.repro/v1',status:records.every(r=>r.exitCode===0)?'PASS':'FAIL',executionLocation:'LOCAL_WINDOWS_ISOLATED',before,commands:records,after:{compiled:existsSync(resolve(root,'dist'))?walk('dist').map(binding):[],fixtures:walk('fixtures').map(binding)}});
  if(r.status!==0)process.exit(r.status??1);
}
console.log('PASS finite serial repro; reference qualification NOT_RUN');
