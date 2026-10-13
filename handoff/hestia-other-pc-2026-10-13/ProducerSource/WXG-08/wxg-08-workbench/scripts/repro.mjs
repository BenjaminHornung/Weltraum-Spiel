import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {root} from './inputs.mjs';
const out=resolve(root,'.runtime/repro',String(Date.now()));mkdirSync(out,{recursive:true});
const jobs=[['inputs','scripts/inputs.mjs','verify'],['seal','scripts/seal.mjs','--check'],['control','--test','--test-concurrency=1','inputs/wxg/tests/geometry.test.mjs'],['core','--test','--test-concurrency=1','tests/core.test.mjs']];
for(const [name,...args] of jobs){const r=spawnSync(process.execPath,args,{cwd:root,windowsHide:true,maxBuffer:8*1024*1024});writeFileSync(resolve(out,name+'.stdout.log'),r.stdout??'');writeFileSync(resolve(out,name+'.stderr.log'),r.stderr??String(r.error??''));console.log(JSON.stringify({name,executable:process.execPath,args,cwd:root,exitCode:r.status,evidence:out}));if(r.status!==0)process.exit(r.status??1);}
