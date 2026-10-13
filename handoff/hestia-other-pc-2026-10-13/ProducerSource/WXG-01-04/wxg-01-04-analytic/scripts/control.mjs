import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,repo,node,verifyConsumer,save,bytes} from './bindings.mjs';
verifyConsumer();const dir=resolve(repo,'.devtoolbox/specs/changes/wxg-01-04-2026-10-09/tests/control');
if(existsSync(dir))throw Error('CONTROL_EXISTS');mkdirSync(dir,{recursive:true});
const rows=[];for(const [label,args] of [['unchanged-cel-control',['--experimental-test-isolation=none','--test','--test-concurrency=1','vendor/cel/tests/control.test.mjs']],['wxg-initial-red',['--experimental-test-isolation=none','--test','--test-concurrency=1','tests/wxg.test.mjs']]]){
  const r=spawnSync(node,args,{cwd:root,windowsHide:true,maxBuffer:8*1024*1024});
  writeFileSync(resolve(dir,label+'.stdout.log'),r.stdout??'');writeFileSync(resolve(dir,label+'.stderr.log'),r.stderr??'');
  rows.push({label,executable:node,args,cwd:root,exitCode:r.status,error:r.error?.code??null,stdout:bytes(dir,label+'.stdout.log'),stderr:bytes(dir,label+'.stderr.log')});
}
save(resolve(dir,'summary.json'),{checks:rows,expected:'unchanged control exits 0; absent WXG implementation initial red exits 1'});
console.log(JSON.stringify(rows.map(({label,exitCode,error})=>({label,exitCode,error}))));
if(rows[0].exitCode!==0||rows[1].exitCode!==1)process.exit(1);
