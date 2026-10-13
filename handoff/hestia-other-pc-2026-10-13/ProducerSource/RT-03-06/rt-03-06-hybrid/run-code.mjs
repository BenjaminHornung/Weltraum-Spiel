import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spike,evidence,sha,verifyInputs} from './inputs.mjs';
await verifyInputs();const commands=[];
for(const [name,args] of [['control',['--experimental-strip-types','tests/control.mjs']],['typecheck',['node_modules/typescript/lib/tsc.js','--noEmit']],['build',['build.mjs']],['focused-tests',['--test','--experimental-test-isolation=none','--test-concurrency=1','tests/dynamic.test.mjs','tests/history.test.mjs','tests/hybrid.test.mjs','tests/runner.test.mjs','tests/server.test.mjs']],['emitted-replay',['tests/replay.mjs']]]){
 const startedUtc=new Date().toISOString(),r=spawnSync(process.execPath,args,{cwd:spike,encoding:'utf8',maxBuffer:8*1024*1024}),log=Buffer.from((r.stdout??'')+(r.stderr??'')+(r.error?'\n'+r.error.stack:''));
 const logName='code-final-'+name+'.log';await writeFile(path.join(evidence,logName),log);commands.push({name,executable:process.execPath,arguments:args,cwd:spike,startedUtc,exitCode:r.status,signal:r.signal,spawnError:r.error?String(r.error):null,log:logName,logSha256:sha(log)});
 process.stdout.write(log);if(r.status!==0){await writeFile(path.join(evidence,'code-commands.json'),JSON.stringify({status:'FAIL',commands},null,2)+'\n');process.exit(r.status??1);}
}
await writeFile(path.join(evidence,'code-commands.json'),JSON.stringify({status:'PASS',commands,executionLocation:'LOCAL_WINDOWS_ISOLATED',gpu:'NOT_RUN',productIntegration:'NO'},null,2)+'\n');console.log(JSON.stringify({status:'PASS',commands:commands.length,exitCodes:commands.map(c=>c.exitCode),gpu:'NOT_RUN'}));
