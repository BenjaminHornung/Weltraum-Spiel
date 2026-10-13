import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname, relative, isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const modern=resolve(import.meta.dirname,'..'), root=resolve(modern,'../../..');
const a0='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05';
const consumer='.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/phy01-migration2-input-r01';
const decision='.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/PHY01_PROFILE_DECISION_R01.md';
const sha=b=>createHash('sha256').update(b).digest('hex');
const put=(path,bytes)=>{
  mkdirSync(dirname(path),{recursive:true});
  try{writeFileSync(path,bytes,{flag:'wx'});}catch(error){
    if(error.code!=='EEXIST')throw error;
    assert(readFileSync(path).equals(bytes),'Existing immutable input differs: '+path);
  }
};
const receiptBytes=readFileSync(resolve(a0,consumer,'CONSUMER_RECEIPT.json'));
assert.equal(receiptBytes.length,955855);
assert.equal(sha(receiptBytes),'ea7b76f5e577550dc9dd64e4a9a0b8ddf110a06db52cdf390e14fe9b258b3afe');
const ownerBytes=readFileSync(resolve(a0,decision));
assert.equal(sha(ownerBytes),'e9b191c097bf4bd2ff1366222cb47bb8c60fcb8b71be47c58c204b1084b53a51');
const receipt=JSON.parse(receiptBytes);
assert.equal(receipt.mappings.length,1935);
const rows=[];
for(const m of receipt.mappings){
  assert(m.snapshot.startsWith(consumer+'/'));
  const suffix=m.snapshot.slice(consumer.length+1), path='inputs/a0/'+suffix;
  const source=resolve(a0,m.snapshot), target=resolve(modern,path);
  assert(!isAbsolute(suffix)&&!relative(modern,target).startsWith('..'));
  const bytes=readFileSync(source);
  assert.equal(bytes.length,m.bytes,m.snapshot);assert.equal(sha(bytes),m.sha256,m.snapshot);
  rows.push({path,bytes:bytes.length,sha256:m.sha256,origin:m.origin});
  if(process.argv.includes('--capture'))put(target,bytes);
}
for(const [path,bytes] of [['inputs/CONSUMER_RECEIPT.json',receiptBytes],['inputs/PHY01_PROFILE_DECISION_R01.md',ownerBytes]]){
  rows.push({path,bytes:bytes.length,sha256:sha(bytes)});
  if(process.argv.includes('--capture'))put(resolve(modern,path),bytes);
}
rows.sort((a,b)=>a.path.localeCompare(b.path,'en'));
const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const run=args=>execFileSync(git,args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
assert.equal(run(['rev-parse','HEAD']).trim(),'17b1db4201a28e7b607c30707bdc2b75e3484a10');
assert.equal(run(['branch','--show-current']).trim(),'feature/phy-03-2026-10-09');
const split=s=>s.split('\0').filter(Boolean);
const paths=[...new Set([...split(run(['diff','--name-only','-z','HEAD'])),...split(run(['diff','--cached','--name-only','-z'])),...split(run(['ls-files','--others','--exclude-standard','-z']))])].sort();
assert(paths.every(p=>p.startsWith('spikes/phy-03-migration-capsule/')||p.startsWith('.devtoolbox/specs/changes/phy-03-2026-10-09/')));
const oldPaths=paths.filter(p=>!p.startsWith('spikes/phy-03-migration-capsule/modern-r01/')&&!p.startsWith('.devtoolbox/specs/changes/phy-03-2026-10-09/modern-r01/'));
assert.equal(oldPaths.length,252);
const legacyRows=oldPaths.map(path=>({path,bytes:readFileSync(resolve(root,path)).length,sha256:sha(readFileSync(resolve(root,path)))}));
const normalized=oldPaths.map(path=>{
  let bytes=readFileSync(resolve(root,path));
  if(path==='spikes/phy-03-migration-capsule/receipt.json'){
    const r=JSON.parse(bytes);r.bindings.dirtyTreeSha256=null;r.bindings.dirtyFileCount=252;
    bytes=Buffer.from(JSON.stringify(r,null,2)+'\n');
  }
  return {path,sha256:sha(bytes)};
});
const legacyDigest=sha(Buffer.from('phy03-full-dirty-tree-v1\0'+JSON.stringify(normalized)));
assert.equal(legacyDigest,'b1444e68c40756cc07a07239f529cf7d110fc7ef5cba91b54d51a47a78f17f30');
const review=readFileSync(resolve(modern,'../.runtime/final-review.diff'));
const result={schema:'phy03.actual-input-binding.r01',candidate:receipt.candidate,legacyDigest,
  legacyReviewDiff:{bytes:review.length,sha256:sha(review)},legacyRows,files:rows,
  inputIndexSha256:sha(Buffer.from(JSON.stringify(rows))),counts:receipt.counts,location:'LOCAL_WINDOWS_ISOLATED'};
if(process.argv.includes('--capture'))put(resolve(modern,'input-binding.json'),Buffer.from(JSON.stringify(result,null,2)+'\n'));
console.log(JSON.stringify({status:'PASS',legacyFiles:oldPaths.length,legacyDigest,actualCopiedRows:rows.length,bytes:rows.reduce((n,r)=>n+r.bytes,0),inputIndexSha256:result.inputIndexSha256}));
