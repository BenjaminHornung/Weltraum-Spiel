import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {deflateSync} from 'node:zlib';
import {root,repo,hash,json,save,walk,bytes,verifyInputs,verifyMembers} from './bindings.mjs';
import {newFilePatch} from './patch.mjs';
import {createHash} from 'node:crypto';
const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe',base='17b1db4201a28e7b607c30707bdc2b75e3484a10';
const scope='spikes/atm-01-04-volumes',spec='.devtoolbox/specs/changes/atm-01-04-2026-10-09',sealPath='.runtime/final-seal/scope-seal.json';
const command=(args,allowed=[0])=>{const r=spawnSync(git,args,{cwd:repo,windowsHide:true,maxBuffer:64*1024*1024});if(!allowed.includes(r.status))throw Error('GIT_ERROR:'+r.status+':'+r.stderr);return r.stdout;};
const normalize=p=>p.replaceAll('\\','/');
function file(p){const b=readFileSync(resolve(repo,p));return {path:p,bytes:b.length,sha256:hash(b)};}
function checkRun(runPath){
 const summary=json(runPath);if(summary.status!=='PASS'||summary.commands.some(c=>c.exitCode!==0))throw Error('TEST_NOT_PASS');
 verifyMembers(summary.inputs);verifyMembers(summary.compiled);
 const runDir=resolve(root,runPath,'..');
 for(const c of summary.commands)for(const kind of ['stdout','stderr']){const b=readFileSync(resolve(runDir,c.label+'.'+kind+'.log'));if(b.length!==c[kind].bytes||hash(b)!==c[kind].sha256)throw Error('RAW_LOG_DRIFT');}
 return summary;
}
function capture(){
 if(command(['rev-parse','HEAD']).toString().trim()!==base||command(['branch','--show-current']).toString().trim()!=='feature/atm-01-04-2026-10-09')throw Error('ISOLATION');
 verifyInputs();const deps=json('DependencyBindings.json');verifyMembers(deps.installed,['node_modules']);verifyMembers(deps.archives);
 for(const f of json('ToolBindings.json').files){const b=readFileSync(f.path);if(b.length!==f.bytes||hash(b)!==f.sha256)throw Error('EXTERNAL_TOOL_DRIFT:'+f.path);}
 const status=command(['status','--porcelain=v1','-z','--untracked-files=all']),paths=[];
 for(const entry of status.toString().split('\0').filter(Boolean)){
  const state=entry.slice(0,2),p=entry.slice(3);if(/[RC]/.test(state)||!p)throw Error('UNSUPPORTED_RENAME_STATE');
  if(!p.startsWith(scope+'/')&&!p.startsWith(spec+'/'))throw Error('OUT_OF_SCOPE:'+p);paths.push({state,path:p});
 }
 if(!paths.length)throw Error('EMPTY_REVIEW');
 const dirty=paths.sort((a,b)=>a.path.localeCompare(b.path)).map(f=>({...f,...file(f.path)}));
 const indexBytes=command(['ls-files','--stage','-z']),entries=indexBytes.toString().split('\0').filter(Boolean);
 if(entries.length<10800)throw Error('INDEX_INCOMPLETE');
 const index={entryCount:entries.length,sha256:hash(indexBytes)};
 const stage=command(['diff','--cached','--binary','--no-ext-diff','--no-textconv',base]);
 const unstaged=command(['diff','--binary','--no-ext-diff','--no-textconv']);
 return {base,branch:'feature/atm-01-04-2026-10-09',dirty,index,stage:{bytes:stage.length,sha256:hash(stage)},unstaged:{bytes:unstaged.length,sha256:hash(unstaged)},dirtyTreeDigest:'sha256:'+hash(JSON.stringify({dirty,index,stageSha256:hash(stage),unstagedSha256:hash(unstaged)}))};
}
function patchFor(state){
 let patch=command(['diff',base,'--binary','--no-ext-diff','--no-textconv']).toString();
 for(const f of state.dirty.filter(f=>f.state==='??')){
  patch+=newFilePatch(f.path,readFileSync(resolve(repo,f.path)));
 }return Buffer.from(patch);
}
if(process.argv.includes('--verify')){
 const old=json(sealPath),state=capture();if(JSON.stringify(old.state)!==JSON.stringify(state))throw Error('SEAL_DIRTY_INDEX_DRIFT');
 verifyMembers(old.closure);const patch=readFileSync(resolve(root,'.runtime/final-seal/review.patch'));
 if(hash(patch)!==old.reviewPatch.sha256||patch.length!==old.reviewPatch.bytes)throw Error('REVIEW_PATCH_DRIFT');
 checkRun(old.finalRun);
 console.log(JSON.stringify({status:'PASS',dirtyFiles:state.dirty.length,indexFiles:state.index.entryCount,dirtyTreeDigest:state.dirtyTreeDigest,patch:old.reviewPatch}));process.exit(0);
}
const run=process.argv[2];if(!/^[a-z0-9-]+$/.test(run??''))throw Error('FINAL_RUN_REQUIRED');
const runPath='../../'+spec+'/tests/runs/'+run+'/summary.json',summary=checkRun(runPath);
const state=capture(),patch=patchFor(state);mkdirSync(root+'/.runtime/final-seal',{recursive:true});writeFileSync(root+'/.runtime/final-seal/review.patch',patch);
const closure=[...walk(root,'dist'),...walk(root,'.runtime').filter(p=>p.endsWith('.mjs')||p.endsWith('.tgz'))].map(bytes);
save(sealPath,{schema:'atm.full-dirty-index-seal.v1',state,finalRun:runPath,closure,reviewPatch:{path:'.runtime/final-seal/review.patch',bytes:patch.length,sha256:hash(patch)},humanPlannotatorApproval:'NOT_REQUESTED',productIntegration:'NO'});
console.log(JSON.stringify({status:'SEALED',dirtyFiles:state.dirty.length,dirtyTreeDigest:state.dirtyTreeDigest,index:state.index,patchBytes:patch.length,patchSha256:hash(patch)}));
