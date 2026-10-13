import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const modern=resolve(import.meta.dirname,'..'),root=resolve(modern,'../../..');
const runId=process.argv[2];
if(!runId||!/^local-functional-[0-9]{2}$/.test(runId))throw new Error('An unused explicit functional run ID is required');
const spec=resolve(root,'.devtoolbox/specs/changes/phy-03-2026-10-09/modern-r01/tests/runs',runId);
const node='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const sha=b=>createHash('sha256').update(b).digest('hex');
mkdirSync(spec,{recursive:true});mkdirSync(resolve(modern,'.runtime'),{recursive:true});
writeFileSync(resolve(spec,'run.json'),JSON.stringify({runId,location:'LOCAL_WINDOWS_ISOLATED',native:'NOT_RUN',browser:'NOT_RUN'})+'\n',{flag:'wx'});
const rows=[],checks=[];
function tree(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
  if(['.vite','.vite-temp','.cache'].includes(e.name))continue;
  const path=resolve(dir,e.name);if(e.isDirectory())tree(path);else if(e.isFile()){const b=readFileSync(path);rows.push({path,bytes:b.length,sha256:sha(b)});}
}}
tree(resolve(modern,'../node_modules'));
tree('C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm');
tree('C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/ucrt64/bin');
tree('C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/ucrt64/libexec/git-core');
for(const path of [node,'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe']){
  const b=readFileSync(path);rows.push({path,bytes:b.length,sha256:sha(b)});
}
rows.sort((a,b)=>a.path.localeCompare(b.path,'en'));
writeFileSync(resolve(modern,'tool-binding.json'),JSON.stringify({schema:'phy03.readonly-tool-closure.r01',nodeVersion:process.version,nodeBinary:node,files:rows,digest:sha(Buffer.from(JSON.stringify(rows)))},null,2)+'\n');
const sources=[];
function sourceTree(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
  if(dir===modern&&['inputs','dist','node_modules','.runtime'].includes(e.name))continue;
  const path=resolve(dir,e.name);if(e.isDirectory())sourceTree(path);else if(e.isFile()){
    const b=readFileSync(path);sources.push({path:relative(root,path).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)});
  }
}}
sourceTree(modern);sources.sort((a,b)=>a.path.localeCompare(b.path,'en'));
writeFileSync(resolve(spec,'source-before.json'),JSON.stringify({sources,digest:sha(Buffer.from(JSON.stringify(sources))),legacyBinding:'spikes/phy-03-migration-capsule/modern-r01/input-binding.json:legacyRows'},null,2)+'\n');
function run(id,args){
  const started=new Date().toISOString(),r=spawnSync(node,args,{cwd:modern,encoding:'utf8',maxBuffer:16*1024*1024});
  writeFileSync(resolve(spec,id+'.stdout.log'),r.stdout??'');writeFileSync(resolve(spec,id+'.stderr.log'),r.stderr??String(r.error??''));
  checks.push({id,command:[node,...args],cwd:modern,started,finished:new Date().toISOString(),exitCode:r.status,error:r.error?.message??null,
    stdoutSha256:sha(Buffer.from(r.stdout??'')),stderrSha256:sha(Buffer.from(r.stderr??String(r.error??'')))});
  console.log(JSON.stringify({id,exitCode:r.status,error:r.error?.message??null}));
  writeFileSync(resolve(spec,'exits.json'),JSON.stringify({location:'LOCAL_WINDOWS_ISOLATED',load:'UNCONTROLLED_PARALLEL',hardwareQualified:false,actualAdapter:null,gpuTimers:null,checks},null,2)+'\n');
  if(id==='unit')writeFileSync(resolve(spec,'unit-results.json'),readFileSync(resolve(modern,'.runtime/unit-results.json')));
  if(r.status!==0)process.exit(r.status??1);
}
run('inputs-before',['scripts/check-inputs.mjs']);
run('unit',['../node_modules/vitest/vitest.mjs','run','--config','vitest.config.ts']);
run('typecheck',['../node_modules/typescript/bin/tsc','-p','tsconfig.json']);
run('build',['../node_modules/vite/bin/vite.js','build','--config','vite.config.ts']);
run('cli-register',['scripts/cli.mjs','register']);
run('cli-transaction',['scripts/cli.mjs','transaction','rapier-0.21.0-phy01.migration2:legacy-impulse-v1']);
run('cli-a0-lab',['scripts/cli.mjs','lab','rapier-0.21.0-phy01.migration2:legacy-impulse-v1']);
run('inputs-after',['scripts/check-inputs.mjs']);
for(const row of rows){const b=readFileSync(row.path);if(b.length!==row.bytes||sha(b)!==row.sha256)throw new Error('Read-only tool changed: '+row.path);}
for(const row of sources){const b=readFileSync(resolve(root,row.path));if(b.length!==row.bytes||sha(b)!==row.sha256)throw new Error('Own source changed during run: '+row.path);}
writeFileSync(resolve(spec,'unit-results.json'),readFileSync(resolve(modern,'.runtime/unit-results.json')));
const build=[];for(const e of readdirSync(resolve(modern,'dist'),{recursive:true,withFileTypes:true})){
  if(e.isFile()){const path=resolve(e.parentPath,e.name),b=readFileSync(path);build.push({path:relative(modern,path).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)});}
}
writeFileSync(resolve(spec,'build-binding.json'),JSON.stringify({files:build,digest:sha(Buffer.from(JSON.stringify(build)))},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,toolFiles:rows.length,toolDigest:sha(Buffer.from(JSON.stringify(rows))),native:'NOT_RUN',browser:'NOT_RUN'}));
