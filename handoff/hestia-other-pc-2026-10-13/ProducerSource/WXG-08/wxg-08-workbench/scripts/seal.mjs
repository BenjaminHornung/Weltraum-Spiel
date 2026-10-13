import {readFileSync,mkdirSync,writeFileSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,repo,git,hash,json,check,command,member} from './inputs.mjs';
const base='17b1db4201a28e7b607c30707bdc2b75e3484a10';
const allowed=['spikes/wxg-08-workbench/','.devtoolbox/specs/changes/wxg-08-2026-10-09/'];
if(command(['rev-parse','HEAD']).toString().trim()!==base||command(['branch','--show-current']).toString().trim()!=='feature/wxg-08-2026-10-09')throw Error('ISOLATION');
for(const f of json('InputBindings.json').members)check(f);
for(const f of json('SourceBindings.json').sources)check(f);
for(const f of [...json('ToolBindings.json').files,...json('ToolBindings.json').npm,...json('BrowserBindings.json').files])check(f);
for(const f of json('.runtime/build-bindings.json').files)check(f);
for(const f of json('.runtime/evidence-bindings.json').files)check(f);
for(const f of json('receipt.json').evidence.files)check(f);
const status=command(['status','--porcelain=v1','--untracked-files=all','-z']),entries=status.toString().split('\0').filter(Boolean);
const dirty=entries.map(e=>{const state=e.slice(0,2),path=e.slice(3);if(/[RC]/.test(state)||!allowed.some(prefix=>path.startsWith(prefix)))throw Error('OUT_OF_SCOPE_OR_RENAME:'+path);const file=resolve(repo,path);if(!lstatSync(file).isFile())throw Error('NONREGULAR');const b=readFileSync(file);return {state,path,bytes:b.length,sha256:hash(b)};}).sort((a,b)=>a.path.localeCompare(b.path));
if(!dirty.length)throw Error('EMPTY_REVIEW');
const index=command(['ls-files','--stage','-z']),staged=command(['diff','--cached','--binary',base]),unstaged=command(['diff','--binary']),tracked=command(['diff','--binary',base]);
const state={base,branch:'feature/wxg-08-2026-10-09',dirty,indexSha256:hash(index),stagedSha256:hash(staged),unstagedSha256:hash(unstaged),trackedSha256:hash(tracked),statusSha256:hash(status)};
const scopeDigest=hash(JSON.stringify(state)),path=resolve(root,'.runtime/final-seal/scope-seal.json');
if(process.argv.includes('--check')){
 const old=json(path);if(scopeDigest!==old.dirtyTreeDigest.slice(7)||JSON.stringify(state)!==JSON.stringify(old.state))throw Error('SEAL_DRIFT');
 for(const f of old.detachedClosure)check(f);
 check(old.reviewPatch);console.log(JSON.stringify({status:'PASS',files:dirty.length,dirtyTreeDigest:old.dirtyTreeDigest,indexSha256:state.indexSha256,seal:member(path)}));process.exit(0);
}
const patches=[tracked];for(const f of dirty.filter(f=>f.state==='??')){const r=spawnSync(git,['diff','--no-index','--binary','--','/dev/null',f.path],{cwd:repo,windowsHide:true,maxBuffer:32*1024*1024});if(r.status!==1)throw Error('PATCH:'+r.status+':'+r.stderr);patches.push(r.stdout);}
mkdirSync(resolve(root,'.runtime/final-seal'),{recursive:true});writeFileSync(resolve(root,'.runtime/final-seal/review.patch'),Buffer.concat(patches));
const detachedClosure=['.runtime/build-bindings.json','.runtime/evidence-bindings.json'].map(p=>member(resolve(root,p)));
const seal={schema:'wxg08.full-dirty-index-seal/v1',state,dirtyTreeDigest:'sha256:'+scopeDigest,reviewPatch:member(resolve(root,'.runtime/final-seal/review.patch')),detachedClosure,scope:'PASS',definition:'ALL staged/unstaged/nonignored-untracked changed bytes including receipt/spec/evidence. Ignored input/compiler/build/tool bytes separately closed by manifests. Detached seal avoids self-reference.',humanPlannotator:'NOT_REQUESTED',productIntegration:'NO'};
writeFileSync(path,JSON.stringify(seal,null,2)+'\n');console.log(JSON.stringify({status:'SEALED',files:dirty.length,dirtyTreeDigest:seal.dirtyTreeDigest,reviewPatch:seal.reviewPatch,seal:member(path)}));
