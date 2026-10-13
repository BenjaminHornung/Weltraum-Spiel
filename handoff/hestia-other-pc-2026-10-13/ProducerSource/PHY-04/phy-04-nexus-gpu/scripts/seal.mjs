import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,sha256} from './commands.mjs';
import {verifyInputs} from './verify-inputs.mjs';
import {assertFreshSeal,assertNoForeignStage} from './seal-data.mjs';
const repo=resolve(root,'../..');
const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const baseline='17b1db4201a28e7b607c30707bdc2b75e3484a10';
const branch='feature/phy-04-2026-10-09';
const allowed=['spikes/phy-04-nexus-gpu/','.devtoolbox/specs/changes/phy-04-2026-10-09/'];
function command(args,codes=[0]){
  const r=spawnSync(git,['-c','filter.lfs.process=','-c','filter.lfs.clean=','-c','filter.lfs.smudge=','-c','filter.lfs.required=false',...args],
    {cwd:repo,windowsHide:true,maxBuffer:128*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
  if(!codes.includes(r.status))throw Error('GIT_ERROR:'+r.status+':'+r.stderr);
  return r.stdout;
}
const paths=args=>command(args).toString('utf8').split('\0').filter(Boolean);
function scoped(path){return allowed.some(x=>path.startsWith(x));}
function row(path){
  const absolute=resolve(repo,path);const stat=lstatSync(absolute);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('REGULAR_FILE_REQUIRED:'+path);
  const data=readFileSync(absolute);return {path,bytes:data.length,sha256:sha256(data)};
}
verifyInputs();
if(command(['rev-parse','HEAD']).toString().trim()!==baseline)throw Error('BASE_CHANGED');
if(command(['branch','--show-current']).toString().trim()!==branch)throw Error('BRANCH_CHANGED');
const stagedPaths=paths(['diff','--cached','--name-only','-z',baseline]);
assertNoForeignStage(stagedPaths,allowed);
const dirty=new Set([...paths(['diff','--name-only','-z',baseline]),...stagedPaths,
  ...paths(['ls-files','--others','--exclude-standard','-z'])]);
const canonicalLfs=[];
for(const path of [...dirty]){
  if(scoped(path))continue;
  const committed=command(['show',baseline+':'+path]).toString();
  const pointer=committed.match(/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([a-f0-9]{64})\nsize ([0-9]+)\n?$/);
  const actual=row(path);
  if(!pointer||actual.sha256!==pointer[1]||actual.bytes!==Number(pointer[2]))throw Error('OUT_OF_SCOPE:'+path);
  canonicalLfs.push({path,unchangedLfsObjectSha256:actual.sha256,bytes:actual.bytes});
  dirty.delete(path);
}
let changedFiles=[...dirty].sort().map(row);
if(!changedFiles.length)throw Error('EMPTY_REVIEW');
const tracked=command(['diff','--binary',baseline,'--',...allowed]);
const staged=command(['diff','--cached','--binary',baseline,'--',...allowed]);
const unstaged=command(['diff','--binary','--',...allowed]);
const gitPointer=readFileSync(resolve(repo,'.git'),'utf8').trim();
if(!gitPointer.startsWith('gitdir: '))throw Error('OWN_WORKTREE_REQUIRED');
const index=readFileSync(resolve(repo,gitPointer.slice(8),'index'));
const indexEntries=command(['ls-files','--stage','-z']);
const sidecar=resolve(root,'.runtime/final-seal');
mkdirSync(sidecar,{recursive:true});
function tree(base,prefix=''){
  return readdirSync(resolve(repo,base,prefix)).sort().flatMap(name=>{
    const path=prefix?prefix+'/'+name:name;
    if(base===allowed[0].slice(0,-1)&&['.runtime','.cargo-home','target','node_modules'].includes(path))return [];
    const stat=lstatSync(resolve(repo,base,path));
    if(stat.isSymbolicLink())throw Error('PAYLOAD_SYMLINK');
    return stat.isDirectory()?tree(base,path):['receipt.json','PayloadBindings.json'].includes(path)?[]:[row(base+'/'+path)];
  });
}
const payloadFiles=allowed.flatMap(x=>tree(x.slice(0,-1))).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
const payload={schema:'phy04.payload-bindings.v1',files:payloadFiles,digest:sha256(JSON.stringify(payloadFiles)),
  exclusions:['root receipt.json and PayloadBindings.json self-controls; both bound by detached full dirty seal',
    'own root .runtime, .cargo-home, target, node_modules caches; source archives, copied producer seals, source trees, fixtures, locks, tests and generated PLT dist included']};
if(!process.argv.includes('--check')){
  writeFileSync(resolve(root,'PayloadBindings.json'),JSON.stringify(payload,null,2)+'\n');
  const path=allowed[0]+'PayloadBindings.json';
  changedFiles=changedFiles.filter(x=>x.path!==path).concat([row(path)]).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
const patches=[tracked];
for(const path of paths(['ls-files','--others','--exclude-standard','-z']).sort()){
  if(!scoped(path))throw Error('UNTRACKED_OUT_OF_SCOPE:'+path);
  patches.push(command(['diff','--no-index','--binary','--','/dev/null',path],[1]));
}
const patch=Buffer.concat(patches);
const seal={schema:'phy04.scope-seal.v1',baseline,branch,scope:'PASS',changedFiles,
  dirtyTreeDigest:sha256(JSON.stringify(changedFiles)),indexBytesSha256:sha256(index),indexEntriesSha256:sha256(indexEntries),
  trackedDiffSha256:sha256(tracked),stagedDiffSha256:sha256(staged),unstagedDiffSha256:sha256(unstaged),
  reviewPatchSha256:sha256(patch),payloadDigest:payload.digest,canonicalLfs,
  definition:'All baseline tracked, staged, unstaged and nonignored untracked changes; complete raw Git index and staged entry list. Out-of-scope raw LFS differences accepted only when exact baseline LFS SHA and size match. Ignored own caches excluded; explicit payload/source/dependency bindings cover distributed/used bytes.'};
if(process.argv.includes('--check')){
  const previous=JSON.parse(readFileSync(resolve(sidecar,'scope-seal.json')));
  const pb=JSON.parse(readFileSync(resolve(root,'PayloadBindings.json')));
  assertFreshSeal(previous,seal,pb);
  if(sha256(readFileSync(resolve(sidecar,'review.patch')))!==seal.reviewPatchSha256)throw Error('PATCH_STALE');
} else {
  writeFileSync(resolve(sidecar,'review.patch'),patch);
  writeFileSync(resolve(sidecar,'scope-seal.json'),JSON.stringify(seal,null,2)+'\n');
}
console.log(JSON.stringify({scope:seal.scope,check:process.argv.includes('--check'),dirtyFiles:seal.changedFiles.length,
  payloadFiles:payloadFiles.length,dirtyTreeDigest:seal.dirtyTreeDigest,payloadDigest:seal.payloadDigest,reviewPatchSha256:seal.reviewPatchSha256}));
