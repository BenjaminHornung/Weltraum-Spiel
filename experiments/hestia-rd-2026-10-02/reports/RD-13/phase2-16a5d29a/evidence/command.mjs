import { spawnSync } from 'node:child_process';
import { mkdirSync,writeFileSync,readFileSync,existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const run='C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase2-16a5d29a-20261004-a';
const cwd='C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees/Hestia-RD-RD13/experiments/hestia-rd-2026-10-02';
const node='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64';
const [label,executable,...args]=process.argv.slice(2);
if(!/^[a-z0-9-]+$/.test(label)||!executable.startsWith('C:/IFI_SourceCode/')){throw new Error('Unsafe command binding');}
for(const p of ['commands','temp','cache']){mkdirSync(`${run}/${p}`,{recursive:true});}
const base=`${run}/commands/${label}`;if(existsSync(`${base}.json`)){throw new Error('Write-once command receipt already exists');}
const env={...process.env,PATH:`${node};C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell`,TEMP:`${run}/temp`,TMP:`${run}/temp`,TMPDIR:`${run}/temp`,npm_config_cache:`${run}/cache`,NO_COLOR:'1'};
const start=new Date().toISOString();const t=performance.now();const r=spawnSync(executable,args,{cwd,env,encoding:null,windowsHide:true,timeout:240000,maxBuffer:32*1024*1024});
const stdout=r.stdout??Buffer.alloc(0);const stderr=r.stderr??Buffer.alloc(0);writeFileSync(`${base}.stdout`,stdout,{flag:'wx'});writeFileSync(`${base}.stderr`,stderr,{flag:'wx'});
const sha=(b)=>createHash('sha256').update(b).digest('hex');const receipt={label,executable,args,cwd,start,elapsedMs:performance.now()-t,exit:r.status,signal:r.signal,timedOut:r.error?.code==='ETIMEDOUT',error:r.error?String(r.error):null,
 stdoutSha256:sha(stdout),stderrSha256:sha(stderr),helperSha256:sha(readFileSync(import.meta.filename)),productIntegrated:false,nativeExecuted:false};
writeFileSync(`${base}.json`,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(stdout.toString());console.error(stderr.toString());console.log(JSON.stringify(receipt));process.exitCode=r.status??1;
