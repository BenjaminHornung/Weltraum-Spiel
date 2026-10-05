import fs from'node:fs';
import path from'node:path';
import{createHash}from'node:crypto';
import{spawnSync}from'node:child_process';
import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),node='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe',[runId,kind,...targets]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
if(!/^[a-z0-9-]+$/.test(runId??'')||!['unit','browser','typecheck','build'].includes(kind)||process.cwd()!==root)throw Error('Fresh bounded run and explicit lab working root required');
const output=path.join(root,'.resume-runs',runId);if(fs.existsSync(output))throw Error('Run receipt cannot overwrite evidence');
function snapshot(){const files=[];function walk(relative,codeOnly=false){const absolute=path.join(root,relative),stat=fs.lstatSync(absolute);if(stat.isSymbolicLink())throw Error('Source symlink rejected');if(stat.isDirectory()){for(const name of fs.readdirSync(absolute).sort())walk(relative+'/'+name,codeOnly);}else if(!codeOnly||/\.(ts|mjs)$/.test(relative)){const bytes=fs.readFileSync(absolute);files.push({path:relative,bytes:bytes.length,sha256:sha(bytes)});}}for(const p of['src','tests','scripts','exporters','fixtures','reference-cards','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','vitest.config.ts','vitest.delivery.config.ts','playwright.resume.config.ts'])walk(p);walk('reports',true);if(kind==='browser')walk('dist');files.sort((a,b)=>a.path<b.path?-1:1);return files;}
const before=snapshot();fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'source-before.json'),JSON.stringify(before,null,2)+'\n',{flag:'wx'});
const relative='.resume-runs/'+runId,env={...process.env};let args,reportPath;
if(kind==='unit'){reportPath=relative+'/unit.json';args=['node_modules/vitest/vitest.mjs','run',...targets,'--reporter=json','--outputFile='+reportPath];}
if(kind==='browser'){reportPath=relative+'/report.json';env.HESTIA_RESUME_RUN=runId;env.HESTIA_RESUME_ADMITTED=runId;env.PLAYWRIGHT_BROWSERS_PATH=path.resolve(root,'.resume-runs/runtime');args=['node_modules/@playwright/test/cli.js','test','--config=playwright.resume.config.ts',...targets];}
if(kind==='typecheck'){reportPath=relative+'/command.log';args=['node_modules/typescript/bin/tsc','--noEmit'];}
if(kind==='build'){reportPath=relative+'/command.log';args=['node_modules/vite/bin/vite.js','build'];}
const startedUtc=new Date().toISOString(),log=fs.openSync(path.join(output,'command.log'),'wx'),result=spawnSync(node,args,{cwd:root,env,windowsHide:true,stdio:['ignore',log,log]});fs.closeSync(log);
const after=snapshot(),sourceUnchanged=JSON.stringify(before)===JSON.stringify(after),report=fs.existsSync(path.join(root,reportPath))?{path:reportPath,sha256:sha(fs.readFileSync(path.join(root,reportPath)))}:null,receipt={schema:'hestia-rd-run-source-receipt-v1',runId,kind,startedUtc,endedUtc:new Date().toISOString(),executionAnchor:'16a5d29a5cddea372abae139da618aa000a058be',sourceState:'UNCOMMITTED_HASH_BOUND',sourceFiles:before,sourceDigest:sha(Buffer.from(JSON.stringify(before))),sourceUnchanged,report,command:{executable:node,args},exitCode:result.status,signal:result.signal??null,productIntegrated:false,qualification:'Q0_FUNCTIONAL_UNQUALIFIED'};
fs.writeFileSync(path.join(output,'source-after.json'),JSON.stringify(after,null,2)+'\n',{flag:'wx'});fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({runId,kind,exitCode:result.status,sourceUnchanged,sourceFiles:before.length,report,receipt:relative+'/receipt.json'}));process.exitCode=result.status===0&&sourceUnchanged&&report?0:1;
