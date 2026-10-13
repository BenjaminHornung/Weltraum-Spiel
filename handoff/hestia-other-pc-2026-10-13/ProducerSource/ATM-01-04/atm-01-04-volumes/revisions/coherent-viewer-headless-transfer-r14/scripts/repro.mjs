import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {freemem,totalmem} from 'node:os';
import {root,repo,hash,save,walk,bytes,json,verifyInputs,verifyMembers} from './bindings.mjs';
const id=process.argv[2];if(!/^[a-z0-9][a-z0-9-]{0,60}$/.test(id??''))throw Error('UNIQUE_RUN_ID_REQUIRED');
if(process.versions.node!=='22.23.2')throw Error('NODE_PIN');
verifyInputs();const dependencies=json('DependencyBindings.json');verifyMembers(dependencies.installed,['node_modules']);verifyMembers(dependencies.archives);
const runRoot=resolve(repo,'.devtoolbox/specs/changes/atm-01-04-2026-10-09/tests/runs');mkdirSync(runRoot,{recursive:true});
const dir=resolve(runRoot,id);mkdirSync(dir);
const capture=()=>[...['src','scripts','tests','shaders','fixtures'].flatMap(p=>walk(root,p)),...['InputBindings.json','DependencyBindings.json','ToolBindings.json','package.json','package-lock.json','tsconfig.json']].sort().map(bytes);
const inputsBefore=capture(),steps=[
 ['tool-closure',['scripts/tool-bindings.mjs','--verify']],['control',['scripts/control.mjs']],['compile-core',['scripts/compile-core.mjs']],['build-typecheck',['scripts/build.mjs']],
 ['focused-tests',['--test','--experimental-test-isolation=none','--test-concurrency=1',...walk(root,'tests').filter(p=>p.endsWith('.test.mjs'))]],
 ['image-oracle',['scripts/image-oracle.mjs']],['server-self-check',['scripts/serve.mjs','--self-check']]
],commands=[];
for(const [label,args] of steps){
 const run=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024}),stdout=run.stdout??'',stderr=run.stderr??'';
 writeFileSync(dir+'/'+label+'.stdout.log',stdout);writeFileSync(dir+'/'+label+'.stderr.log',stderr);
 commands.push({label,executable:process.execPath,args,cwd:root,exitCode:run.status,errorCode:run.error?.code??null,stdout:{bytes:Buffer.byteLength(stdout),sha256:hash(stdout)},stderr:{bytes:Buffer.byteLength(stderr),sha256:hash(stderr)}});
 console.log(JSON.stringify({label,exitCode:run.status}));
 if(run.status!==0){save('../../.devtoolbox/specs/changes/atm-01-04-2026-10-09/tests/runs/'+id+'/summary.json',{status:'FAIL',commands});process.exit(run.status??1);}
}
const inputs=capture();if(JSON.stringify(inputsBefore)!==JSON.stringify(inputs))throw Error('RUN_INPUT_DRIFT');
const source=json('fixtures/chosen-weather-result.json');
save('../../.devtoolbox/specs/changes/atm-01-04-2026-10-09/tests/runs/'+id+'/summary.json',{status:'PASS',environment:'LOCAL_WINDOWS_ISOLATED',commands,inputs,compiled:[...walk(root,'dist'),...walk(root,'.runtime').filter(p=>p.endsWith('.mjs'))].map(bytes),testConcurrency:1,
 node:{version:process.versions.node,bytes:readFileSync(process.execPath).length,sha256:hash(readFileSync(process.execPath))},hostLoad:{parallelSessions:'ACTIVE_AS_DECLARED_IN_DISPATCH',cpuLoad:null,gpuLoad:null,unloadedWindow:false,freeMemoryBytes:freemem(),totalMemoryBytes:totalmem()},
 actualAdapter:{status:'NOT_RUN',value:null},gpuTimer:{status:'NOT_RUN',value:null},reference:'NOT_RUN',productIntegration:'NO',WeatherSnapshotId:source.WeatherSnapshotId,stormIds:source.sample.stormIds});
