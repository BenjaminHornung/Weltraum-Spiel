import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {root,sha,load,walk,binding,verifyInputs,save} from './bindings.mjs';
const repo=resolve(root,'../..'),base='17b1db4201a28e7b607c30707bdc2b75e3484a10',scope=['spikes/wxg-07-grid-dynamics/','.devtoolbox/specs/changes/wxg-07-2026-10-09/'],git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const env={...process.env,GIT_OPTIONAL_LOCKS:'0'};
const run=args=>execFileSync(git,args,{cwd:repo,env,maxBuffer:64*1024*1024});
const paths=b=>b.toString().split('\0').filter(Boolean).sort();
const allowed=p=>scope.some(s=>p.startsWith(s));
const file=p=>{const b=readFileSync(resolve(repo,p));return {path:p,bytes:b.length,sha256:sha(b)};};
function current(){
  verifyInputs();if(run(['rev-parse','HEAD']).toString().trim()!==base||run(['branch','--show-current']).toString().trim()!=='feature/wxg-07-2026-10-09')throw Error('ISOLATION_IDENTITY');
  const tracked=run(['diff',base,'--binary','--no-ext-diff']),staged=run(['diff','--cached','--binary','--no-ext-diff']),unstaged=run(['diff','--binary','--no-ext-diff']);
  const changed=[...new Set([...paths(run(['diff',base,'--name-only','-z'])),...paths(run(['diff','--cached','--name-only','-z'])),...paths(run(['diff','--name-only','-z'])),...paths(run(['ls-files','--others','--exclude-standard','-z']))])].sort();
  if(changed.some(p=>!allowed(p)))throw Error('FOREIGN_CHANGED_PATH:'+changed.find(p=>!allowed(p)));
  const ignored=paths(run(['ls-files','--others','--ignored','--exclude-standard','-z']));if(ignored.some(p=>!allowed(p)))throw Error('UNEXPECTED_EXTERNAL_ARTIFACT:'+ignored.find(p=>!allowed(p)));
  const changedFiles=changed.map(file),payloadFiles=scope.flatMap(s=>walk(relative(root,resolve(repo,s)).replaceAll('\\','/')).map(p=>relative(repo,resolve(root,p)).replaceAll('\\','/'))).filter(p=>!p.startsWith(scope[0]+'.runtime/final-seal/')).sort().map(file);
  const index=run(['ls-files','--stage','-z']),indexPath=run(['rev-parse','--git-path','index']).toString().trim(),rawIndex=readFileSync(resolve(repo,indexPath));
  const bindings={baseline:base,branch:'feature/wxg-07-2026-10-09',scope:'PASS',changedFiles,payloadFiles,indexBinding:{semanticSha256:sha(index),rawSha256:sha(rawIndex),bytes:rawIndex.length},stagedDiffSha256:sha(staged),unstagedDiffSha256:sha(unstaged),fullTrackedDiffSha256:sha(tracked),statusSha256:sha(run(['status','--porcelain=v1','--untracked-files=all','-z']))};
  return {bindings,changed,tracked};
}
const sealPath=resolve(root,'.runtime/final-seal/scope-seal.json');
if(process.argv.includes('--preflight')){
  const actual=current().bindings;console.log(JSON.stringify({status:'PASS',scope:actual.scope,changedFiles:actual.changedFiles.length,payloadFiles:actual.payloadFiles.length,dirtyTreeDigest:'sha256:'+sha(JSON.stringify(actual))}));
}else if(process.argv.includes('--check')){
  const expected=load('.runtime/final-seal/scope-seal.json'),actual=current().bindings;
  if(sha(JSON.stringify(actual))!==expected.dirtyTreeDigest.replace(/^sha256:/,''))throw Error('DIRTY_TREE_DRIFT');
  const patch=binding('.runtime/final-seal/review.patch');if(patch.bytes!==expected.reviewPatch.bytes||patch.sha256!==expected.reviewPatch.sha256)throw Error('PATCH_DRIFT');
  console.log(JSON.stringify({status:'PASS',dirtyTreeDigest:expected.dirtyTreeDigest,changedFiles:actual.changedFiles.length,payloadFiles:actual.payloadFiles.length,reviewPatch:patch}));
}else{
  if(existsSync(sealPath))throw Error('PRESERVE_EXISTING_SEAL');
  const {bindings,changed,tracked}=current(),chunks=[tracked];
  const untracked=new Set(paths(run(['ls-files','--others','--exclude-standard','-z'])));
  const ignoredEvidence=bindings.payloadFiles.map(f=>f.path).filter(p=>p.startsWith(scope[1])&&p.endsWith('.log'));
  for(const p of [...changed.filter(p=>untracked.has(p)),...ignoredEvidence]){
    const r=spawnSync(git,['diff','--no-index','--binary','--no-ext-diff','--','/dev/null',p],{cwd:repo,env,maxBuffer:64*1024*1024});if(r.status!==1||!r.stdout?.length)throw Error('REVIEW_DIFF:'+p);chunks.push(r.stdout);
  }
  const patch=Buffer.concat(chunks);mkdirSync(resolve(root,'.runtime/final-seal'),{recursive:true});writeFileSync(resolve(root,'.runtime/final-seal/review.patch'),patch);
  save('.runtime/final-seal/scope-seal.json',{...bindings,dirtyTreeDigest:'sha256:'+sha(JSON.stringify(bindings)),reviewPatch:binding('.runtime/final-seal/review.patch'),definition:'All whole-repository Git changes/index/diffs and every own ignored payload byte, including tools, compiled inputs and logs. Only detached final-seal directory excluded to avoid self-reference. Review patch contains actual Git change population plus ignored evidence logs; compiler/build payload is explicitly byte-bound. No human approval.'});
  console.log(JSON.stringify({status:'PASS',dirtyTreeDigest:'sha256:'+sha(JSON.stringify(bindings)),reviewPatchBytes:patch.length,changedFiles:changed.length,payloadFiles:bindings.payloadFiles.length}));
}
