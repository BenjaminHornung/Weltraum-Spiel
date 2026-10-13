import { spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync,mkdirSync,lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { root,repo,baseline,hash } from './bind-inputs.mjs';
const branch='feature/cel-01-wxg-00-2026-10-09';
const allowed=['spikes/cel-01-wxg-00-contracts/','.devtoolbox/specs/changes/cel-01-wxg-00-2026-10-09/'];
function git(args,accepted=[0]) {
  const r=spawnSync('C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe',args,{cwd:repo,windowsHide:true,maxBuffer:32*1024*1024});
  if(!accepted.includes(r.status))throw new Error(`GIT_ERROR:${r.status}:${r.error?.code??''}:${r.stderr??''}`);
  return r.stdout;
}
if(git(['rev-parse','HEAD']).toString().trim()!==baseline)throw new Error('BASELINE_CHANGED');
if(git(['branch','--show-current']).toString().trim()!==branch)throw new Error('BRANCH_CHANGED');
const paths=args=>git(args).toString('utf8').split('\0').filter(Boolean);
const untracked=paths(['ls-files','--others','--exclude-standard','-z']);
const all=new Set([...paths(['diff','--name-only','-z',baseline]),...paths(['diff','--cached','--name-only','-z',baseline]),...untracked]);
const deleted=new Set(paths(['diff','--diff-filter=D','--name-only','-z',baseline]));
const files=[...all].sort().map(path=>{
  if(!allowed.some(p=>path.startsWith(p)))throw new Error('OUT_OF_SCOPE:'+path);
  const target=resolve(repo,path);let b;
  try{const s=lstatSync(target);if(s.isSymbolicLink()||!s.isFile())throw new Error('NON_REGULAR_FILE:'+path);b=readFileSync(target);}
  catch(error){if(error.code==='ENOENT'&&deleted.has(path))return {path,deleted:true};throw error;}
  return {path,bytes:b.length,digest:'sha256:'+hash(b)};
});
if(files.length===0)throw new Error('EMPTY_REVIEW');
const tracked=git(['diff','--binary',baseline]);
const staged=git(['diff','--cached','--binary',baseline]);
const unstaged=git(['diff','--binary']);
const patches=[tracked];
for(const path of untracked.sort())patches.push(git(['diff','--no-index','--binary','--','/dev/null',path],[1]));
const patch=Buffer.concat(patches);
const status=git(['status','--porcelain=v1','--untracked-files=all','-z']);
const seal={baseline,branch,scope:'PASS',changedFiles:files,dirtyTreeDigest:'sha256:'+hash(JSON.stringify(files)),
  indexBinding:{definition:'Complete semantic index: git ls-files --stage -z; includes all modes, blob ids and stages, omits mutable stat cache',digest:'sha256:'+hash(git(['ls-files','--stage','-z']))},
  stagedDiffDigest:'sha256:'+hash(staged),unstagedDiffDigest:'sha256:'+hash(unstaged),fullTrackedDiffDigest:'sha256:'+hash(tracked),statusDigest:'sha256:'+hash(status),
  reviewPatchDigest:'sha256:'+hash(patch),reviewPatchBytes:patch.length,
  definition:'Every baseline-changed tracked/staged/unstaged and nonignored-untracked file. Normal LFS filters retained; no hydrated PNG false diffs. Ignored own dependencies/dist/runtime are bound separately in DependencyBindings/receipt/build manifests. This detached ignored seal avoids self-reference. No human approval implied.'};
const dir=resolve(root,'.runtime/final-seal'),file=resolve(dir,'scope-seal.json');
if(process.argv.includes('--check')) {
  const previous=JSON.parse(readFileSync(file));
  if(JSON.stringify(previous)!==JSON.stringify(seal)||hash(readFileSync(resolve(dir,'review.patch')))!==seal.reviewPatchDigest.slice(7))throw new Error('SEAL_STALE');
}else{mkdirSync(dir,{recursive:true});writeFileSync(file,JSON.stringify(seal,null,2)+'\n');writeFileSync(resolve(dir,'review.patch'),patch);}
console.log(JSON.stringify({status:'PASS',files:files.length,dirtyTreeDigest:seal.dirtyTreeDigest,reviewPatchDigest:seal.reviewPatchDigest,reviewPatchBytes:patch.length,sealBytes:readFileSync(file).length,sealSha256:hash(readFileSync(file)),indexDigest:seal.indexBinding.digest}));
