import {readFileSync,writeFileSync,mkdirSync,readdirSync,linkSync,existsSync,openSync,closeSync,createReadStream,createWriteStream,statSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {finished} from 'node:stream/promises';
const modern=resolve(import.meta.dirname,'..'),root=resolve(modern,'../../..');
const spec=resolve(root,'.devtoolbox/specs/changes/phy-03-2026-10-09/modern-r01');
const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const mode=process.argv[2]??'--check';assert(['--prepare','--seal','--check'].includes(mode));
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const read=p=>JSON.parse(readFileSync(p));
const run=args=>execFileSync(git,['--no-optional-locks',...args],{cwd:root,maxBuffer:32*1024*1024});
const split=b=>b.toString('utf8').split('\0').filter(Boolean);
const base='17b1db4201a28e7b607c30707bdc2b75e3484a10';
const indexPath=resolve(modern,'SourceDirtyIndex.json'),receiptPath=resolve(modern,'receipt.json');
const terminalPath=resolve(modern,'.runtime/seal.json'),patchPath=resolve(modern,'.runtime/full-review.diff');
const allowed=p=>p.startsWith('spikes/phy-03-migration-capsule/')||p.startsWith('.devtoolbox/specs/changes/phy-03-2026-10-09/');
function gitState(){
  assert.equal(run(['rev-parse','HEAD']).toString().trim(),base);
  assert.equal(run(['branch','--show-current']).toString().trim(),'feature/phy-03-2026-10-09');
  const rawIndex=run(['ls-files','--stage','-z']),rawXY=run(['status','--porcelain=v1','-z','--untracked-files=all']);
  const rows=split(rawIndex).map(s=>{const m=/^(\d+) ([a-f0-9]+) (\d+)\t([\s\S]+)$/.exec(s);assert(m);return {mode:m[1],blob:m[2],stage:Number(m[3]),path:m[4]};});
  const xy=split(rawXY).map(s=>{assert.equal(s[2],' ');return {x:s[0],y:s[1],path:s.slice(3)};});
  assert(xy.every(r=>allowed(r.path)),'Dirty path outside exclusive scope');
  assert.equal(new Set(rows.map(r=>r.path+'\0'+r.stage)).size,rows.length);
  return {head:base,branch:'feature/phy-03-2026-10-09',indexRows:rows,porcelainRows:xy,
    indexDigest:sha(Buffer.from(JSON.stringify(rows))),porcelainDigest:sha(Buffer.from(JSON.stringify(xy))),rawIndexSha256:sha(rawIndex),rawPorcelainSha256:sha(rawXY)};
}
function paths(){
  const set=new Set(read(resolve(modern,'input-binding.json')).legacyRows.map(r=>r.path));
  function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
    if(dir===modern&&['.runtime','dist','node_modules'].includes(e.name))continue;
    const p=resolve(dir,e.name);if(p===indexPath)continue;
    if(e.isDirectory())walk(p);else {assert(e.isFile(),'No unknown symlink/type');set.add(relative(root,p).replaceAll('\\','/'));}
  }}
  walk(modern);walk(spec);return [...set].sort();
}
function records(all,receipt){return all.map(path=>{
  assert(allowed(path));let b=readFileSync(resolve(root,path));
  if(resolve(root,path)===receiptPath)b=json(receipt);
  return {path,bytes:b.length,sha256:sha(b),encoding:resolve(root,path)===receiptPath?'RECEIPT_SELF_DIGEST_NORMALIZED':'ACTUAL_BYTES'};
});}
function normalize(receipt,count){const r=structuredClone(receipt);r.bindings.fullDirtyTreeSha256=null;r.bindings.fullDirtyFileCount=count;return r;}
const legacy=read(resolve(modern,'input-binding.json'));
for(const row of legacy.legacyRows){const b=readFileSync(resolve(root,row.path));assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256,row.path);}
assert.equal(sha(readFileSync(resolve(modern,'../.runtime/final-review.diff'))),legacy.legacyReviewDiff.sha256);
const checks=read(resolve(spec,'tests/runs/local-functional-07/exits.json'));
assert.equal(checks.checks.length,8);assert(checks.checks.every(c=>c.exitCode===0));
const units=read(resolve(spec,'tests/runs/local-functional-07/unit-results.json'));assert.equal(units.numPassedTests,47);assert.equal(units.numFailedTests,0);
const artifactOnly=new Set(['README.md','REPORT.md','HANDOFF.md','receipt.json','SourceDirtyIndex.json','runner-profile.json','scripts/seal.mjs','scripts/receipt.mjs']);
for(const row of read(resolve(spec,'tests/runs/local-functional-07/source-before.json')).sources){
  // Runtime code/config/input metadata must match the tested build; terminal reports/sealing helpers are checked by this seal.
  if(artifactOnly.has(relative(modern,resolve(root,row.path)).replaceAll('\\','/')))continue;
  const b=readFileSync(resolve(root,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);
}
for(const row of read(resolve(spec,'tests/runs/local-functional-07/build-binding.json')).files){
  const b=readFileSync(resolve(modern,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);
}
const tools=read(resolve(modern,'tool-binding.json'));assert.equal(sha(Buffer.from(JSON.stringify(tools.files))),tools.digest);
for(const row of tools.files){const b=readFileSync(row.path);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256,row.path);}

if(mode!=='--check'){
  assert(!existsSync(terminalPath),'Already sealed: use a new capsule revision');
  if(!existsSync(indexPath))writeFileSync(indexPath,'{}\n',{flag:'wx'});
  const all=paths(),receipt=normalize(read(receiptPath),all.length),rows=records(all,receipt);
  const digest=sha(Buffer.from('phy03-modern-full-scope-r01\0'+JSON.stringify(rows)));
  receipt.bindings.fullDirtyTreeSha256=digest;writeFileSync(receiptPath,json(receipt));
  const state=gitState(),gitPaths=new Set(state.porcelainRows.map(r=>r.path));
  assert(state.porcelainRows.every(r=>r.path===relative(root,indexPath).replaceAll('\\','/')||all.includes(r.path)));
  writeFileSync(indexPath,json({schema:'phy03.complete-source-dirty-index.r01',normalization:'Only modern receipt self-digest is null; index self-reference is bound by ignored terminal seal',
    records:rows,digest,git:state,boundInputPathsIgnoredByGit:all.filter(p=>!gitPaths.has(p)),productIntegration:'NO'}));
  const review=resolve(modern,'.runtime/review-'+randomUUID()),empty=resolve(review,'empty'),tree=resolve(review,'tree');
  mkdirSync(empty,{recursive:true});mkdirSync(tree,{recursive:true});
  for(const p of [...all,relative(root,indexPath).replaceAll('\\','/')]){
    const target=resolve(tree,p);mkdirSync(dirname(target),{recursive:true});linkSync(resolve(root,p),target);
  }
  const rawPatch=resolve(review,'raw.diff'),rawFd=openSync(rawPatch,'wx');
  const result=spawnSync(git,['--no-optional-locks','-c','core.longpaths=true','-c','core.quotePath=false','-c','core.autocrlf=false',
    'diff','--no-index','--binary','--no-ext-diff','--no-textconv','--no-color','--src-prefix=a/','--dst-prefix=b/',empty.replaceAll('\\','/'),tree.replaceAll('\\','/')],
    {cwd:root,stdio:['ignore',rawFd,'pipe'],maxBuffer:16*1024*1024,encoding:'utf8'});
  closeSync(rawFd);
  assert.equal(result.status,1,String(result.error??result.stderr));assert(statSync(rawPatch).size>0,'Empty review forbidden');
  const treePath=tree.replaceAll('\\','/');
  mkdirSync(dirname(patchPath),{recursive:true});const output=createWriteStream(patchPath);
  let pending='';
  for await(const chunk of createReadStream(rawPatch,{encoding:'utf8'})){
    pending+=chunk;const end=pending.lastIndexOf('\n');if(end<0)continue;
    // Split only on LF: bare CR in captured terminal logs is source data, not a patch line boundary.
    const normalized=pending.slice(0,end+1).replaceAll(treePath+'/','').replaceAll(treePath.replace(/^[A-Z]:/,'')+'/','');
    pending=pending.slice(end+1);assert(!normalized.includes(treePath),'Detached review prefix not stripped');
    if(!output.write(normalized))await once(output,'drain');
  }
  if(pending)output.write(pending.replaceAll(treePath+'/','').replaceAll(treePath.replace(/^[A-Z]:/,'')+'/',''));
  output.end();await finished(output);
  const patchFd=openSync(patchPath,'r');
  const parsed=spawnSync(git,['--no-optional-locks','apply','--numstat'],{cwd:root,stdio:[patchFd,'pipe','pipe'],encoding:'utf8',maxBuffer:16*1024*1024});closeSync(patchFd);
  assert.equal(parsed.status,0,String(parsed.error??parsed.stderr));
  const reviewed=parsed.stdout.trim().split('\n').map(line=>line.split('\t').slice(2).join('\t'));
  assert.deepEqual(reviewed.sort(),[...all,relative(root,indexPath).replaceAll('\\','/')].sort(),'Review does not cover exact bound paths');
  assert.deepEqual(records(all,normalize(read(receiptPath),all.length)),rows,'Source changed while sealing');
  assert.deepEqual(gitState(),state,'Git membership/index changed while sealing');
  const receiptBytes=readFileSync(receiptPath),indexBytes=readFileSync(indexPath);
  const patchHash=createHash('sha256');for await(const chunk of createReadStream(patchPath))patchHash.update(chunk);
  const seal={schema:'phy03.terminal-local-seal.r01',status:'PARTIAL_FULL_PHY03_COMPLETE_INDEPENDENT_CAPSULE',head:base,branch:state.branch,
    sourceDirtyTreeSha256:digest,sourceFileCount:rows.length,indexSha256:sha(indexBytes),indexBytes:indexBytes.length,
    receiptSha256:sha(receiptBytes),receiptBytes:receiptBytes.length,reviewDiffSha256:patchHash.digest('hex'),reviewDiffBytes:statSync(patchPath).size,
    gitIndexSha256:state.indexDigest,gitPorcelainSha256:state.porcelainDigest,toolDigest:tools.digest,
    legacyDigest:legacy.legacyDigest,legacyReviewDiffSha256:legacy.legacyReviewDiff.sha256,
    terminalExcluded:'Ignored .runtime/seal.json and review scaffolding; full bound records and SourceDirtyIndex are in review diff',productIntegration:'NO',humanApproval:'NOT_GRANTED'};
  if(mode==='--seal')writeFileSync(terminalPath,json(seal),{flag:'wx'});
  console.log(JSON.stringify({status:mode==='--seal'?'SEALED':'PREPARED_NOT_TERMINAL',files:rows.length,sourceDirtyTreeSha256:digest,sealSha256:mode==='--seal'?sha(json(seal)):null,reviewDiffBytes:seal.reviewDiffBytes,reviewDiffSha256:seal.reviewDiffSha256}));
}else{
  const seal=read(terminalPath),index=read(indexPath),receipt=read(receiptPath),all=paths();
  assert.equal(seal.schema,'phy03.terminal-local-seal.r01');
  assert.equal(sha(readFileSync(indexPath)),seal.indexSha256);assert.equal(sha(readFileSync(receiptPath)),seal.receiptSha256);
  const patchHash=createHash('sha256');for await(const chunk of createReadStream(patchPath))patchHash.update(chunk);
  assert.equal(patchHash.digest('hex'),seal.reviewDiffSha256);
  assert.deepEqual(gitState(),index.git);assert.deepEqual(records(all,normalize(receipt,all.length)),index.records);
  assert.equal(sha(Buffer.from('phy03-modern-full-scope-r01\0'+JSON.stringify(index.records))),seal.sourceDirtyTreeSha256);
  assert.equal(receipt.bindings.fullDirtyTreeSha256,seal.sourceDirtyTreeSha256);assert.equal(index.records.length,seal.sourceFileCount);
  // Negative control is in memory: one changed source hash must break the bound digest.
  const changed=structuredClone(index.records);changed[0].sha256='0'.repeat(64);
  assert.notEqual(sha(Buffer.from('phy03-modern-full-scope-r01\0'+JSON.stringify(changed))),seal.sourceDirtyTreeSha256);
  console.log(JSON.stringify({status:'PASS',readOnly:true,files:all.length,sourceDirtyTreeSha256:seal.sourceDirtyTreeSha256,
    sealSha256:sha(readFileSync(terminalPath)),reviewDiffSha256:seal.reviewDiffSha256,legacyUnchangedFiles:252,native:'NOT_RUN',browser:'NOT_RUN',productIntegration:'NO'}));
}
