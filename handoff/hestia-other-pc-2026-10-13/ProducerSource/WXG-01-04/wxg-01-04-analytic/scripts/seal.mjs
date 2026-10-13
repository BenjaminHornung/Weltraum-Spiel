import {readFileSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,repo,baseline,branch,hash,git,verifyIsolation,verifyConsumer,verifyBuild} from './bindings.mjs';
verifyIsolation();verifyConsumer();verifyBuild();
const allowed=['spikes/wxg-01-04-analytic/','.devtoolbox/specs/changes/wxg-01-04-2026-10-09/'];
const paths=args=>git(args).toString().split('\0').filter(Boolean);
const untracked=paths(['ls-files','--others','--exclude-standard','-z']);
const all=new Set([...paths(['diff','--name-only','-z',baseline]),...paths(['diff','--cached','--name-only','-z',baseline]),...untracked]);
const deleted=new Set(paths(['diff','--diff-filter=D','--name-only','-z',baseline]));
const files=[...all].sort().map(path=>{if(!allowed.some(p=>path.startsWith(p)))throw Error('OUT_OF_SCOPE:'+path);const target=resolve(repo,path);let data;
  try{const stat=lstatSync(target);if(stat.isSymbolicLink()||!stat.isFile())throw Error('NON_REGULAR:'+path);data=readFileSync(target);}catch(e){if(e.code==='ENOENT'&&deleted.has(path))return {path,deleted:true};throw e;}
  return {path,bytes:data.length,digest:'sha256:'+hash(data)};});
if(files.length===0)throw Error('EMPTY_REVIEW');
const tracked=git(['diff','--binary',baseline]),staged=git(['diff','--cached','--binary',baseline]),unstaged=git(['diff','--binary']);
const patches=[tracked];for(const path of untracked.sort())patches.push(git(['diff','--no-index','--binary','--','/dev/null',path],[1]));const patch=Buffer.concat(patches);
const seal={baseline,branch,scope:'PASS',changedFiles:files,dirtyTreeDigest:'sha256:'+hash(JSON.stringify(files)),indexBinding:{definition:'Complete semantic git ls-files --stage -z, including blob IDs/modes/stages',digest:'sha256:'+hash(git(['ls-files','--stage','-z']))},
  stagedDiffDigest:'sha256:'+hash(staged),unstagedDiffDigest:'sha256:'+hash(unstaged),fullTrackedDiffDigest:'sha256:'+hash(tracked),statusDigest:'sha256:'+hash(git(['status','--porcelain=v1','--untracked-files=all','-z'])),reviewPatchDigest:'sha256:'+hash(patch),reviewPatchBytes:patch.length,
  definition:'Every changed tracked/staged/unstaged/nonignored-untracked file including receipt/docs/spec/evidence. Normal LFS filters retained. Ignored own compiler/dist/runtime separately bound by consumer/build/receipt. Detached seal avoids self-reference. Human Plannotator NOT_REQUESTED.'};
const dir=resolve(root,'.runtime/final-seal'),file=resolve(dir,'scope-seal.json');
if(process.argv.includes('--check')){if(JSON.stringify(JSON.parse(readFileSync(file)))!==JSON.stringify(seal)||hash(readFileSync(resolve(dir,'review.patch')))!==seal.reviewPatchDigest.slice(7))throw Error('SEAL_STALE');}
else{mkdirSync(dir,{recursive:true});writeFileSync(file,JSON.stringify(seal,null,2)+'\n');writeFileSync(resolve(dir,'review.patch'),patch);}
console.log(JSON.stringify({status:'PASS',files:files.length,dirtyTreeDigest:seal.dirtyTreeDigest,indexDigest:seal.indexBinding.digest,reviewPatchDigest:seal.reviewPatchDigest,reviewPatchBytes:patch.length,sealBytes:readFileSync(file).length,sealSha256:hash(readFileSync(file))}));
