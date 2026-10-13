import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const modern=resolve(import.meta.dirname,'..'),phy2='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-PHY-02-2026-10-09';
const r3='spikes/phy-02-collider-bakeoff/revisions/git-closure-r03';
const a0='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0';
const sha=b=>createHash('sha256').update(b).digest('hex'),files=new Map();
function copy(origin,path,bytes,hash){
  const b=readFileSync(origin),target=resolve(modern,path);assert(!relative(modern,target).startsWith('..'));
  assert.equal(b.length,bytes,origin);assert.equal(sha(b),hash,origin);mkdirSync(dirname(target),{recursive:true});
  try{writeFileSync(target,b,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;assert(readFileSync(target).equals(b));}
  files.set(path,{path,bytes:b.length,sha256:hash});return b;
}
const receipt=copy(resolve(phy2,r3,'receipt.json'),'inputs/phy02-r03/receipt.json',5481,'ca7abf1c4fc5aa9c705f0267c4c2bc87b757e152c02e2596d36cfb6b7928cf6d');
const seal=JSON.parse(copy(resolve(phy2,r3,'seal.json'),'inputs/phy02-r03/seal.json',5331,'22cdb698d5e82d52adfb77028a6412e1c43b206c6f95de293d2c1834998bcaf5'));
for(const row of seal.files)copy(resolve(phy2,row.path),'inputs/phy02-r03/payload/'+row.path,row.bytes,row.sha256);
const read=name=>JSON.parse(readFileSync(resolve(modern,'inputs/phy02-r03/payload',r3,name)));
const index=read('git-index.rows.json'),xy=read('git-status.rows.json'),source=read('source-bytes.json');
assert.equal(index.rows.length,10800);assert.equal(xy.rows.length,1737);assert.equal(source.rows.length,12530);
assert.equal(sha(Buffer.from(JSON.stringify(index.rows))),'c18efeb1517cf9812beb58118b081cfab6aab7a1c4aaddfb308e18241d9a2511');
assert.equal(sha(Buffer.from(JSON.stringify(xy.rows))),'137d04d057c7baa3d56972f2782dce06b71dab815b3e8b1fc3e311758320e884');
assert.equal(sha(Buffer.from(JSON.stringify(source.rows))),'6da332c8f28dc2b40dee32cec68a9dc959820e45a14278e89e39b1539c03e531');
assert.equal(seal.indexRowExclusions.length,0);assert.equal(seal.porcelainRowExclusions.length,0);
for(const row of source.rows){
  const origin=resolve(phy2,row.path);assert(!relative(phy2,origin).startsWith('..'));assert.equal(row.type,'file');assert.equal(row.exists,true);
  const b=readFileSync(origin);assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);
}
const owner=JSON.parse(copy(resolve(a0,'PHY01_SOURCE_PORT_RECEIPT_R02.json'),'inputs/a0-reviewed-r02/RECEIPT.json',206375,'1062c6320c0251b97d392ad772ccb98ed17de69a8993a3804ae10901a25baca2'));
assert.equal(owner.independentPostApplyReview,'ACCEPT_BOUNDED_FROZEN_SOURCE_PORT_INPUT');
assert.equal(owner.selectedProfile,'rapier-0.21.0-phy01.migration2:legacy-impulse-v1');assert.equal(owner.gyro,false);
assert.equal(owner.parentReceipt.sha256,'9e3aac6059d5f96f4a2a864bf7adc341a087f9f0b4e74795c01a3f5f41ee4bc0');
assert.equal(sha(readFileSync(resolve(modern,'inputs/a0-source-port/INPUT.json'))),'331609c7342b39cbd68e0253e24c24228772003bb085e8ff46b98a7c7bf96150');
const packet='C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-cloud-orchestration-2026-10-09/handoffs/FINAL_PHY02_R03_RT02B_RUNNER_R02_OWNER_REVIEW.txt';
const b=readFileSync(packet);copy(packet,'inputs/FINAL_ROOT_CONTEXT_R03.txt',b.length,sha(b));
const rows=[...files.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
const out={schema:'phy03.final-index-reviewed-owner-binding.r03',files:rows,indexSha256:sha(Buffer.from(JSON.stringify(rows))),
  phy02:{receiptSha256:sha(receipt),sealSha256:'22cdb698d5e82d52adfb77028a6412e1c43b206c6f95de293d2c1834998bcaf5',
    indexRows:10800,xyRows:1737,sourceRowsChecked:12530,sourceDigest:source.digest,indexDigest:index.digest,xyDigest:xy.digest,
    currentIndex:'R03_INDEX_XY_CLOSED',semantics:'GIT_MODE_BLOB_STAGE_PATH_NOT_S2_WORLD_IDENTITY',matrix:'UNCHANGED_R01_PARTIAL_146PASS_46FAIL',sourceByteExclusions:source.excludedSourceByteControls},
  owner:{receiptSha256:'1062c6320c0251b97d392ad772ccb98ed17de69a8993a3804ae10901a25baca2',priorPendingReceiptSha256:owner.parentReceipt.sha256,
    inputSha256:'331609c7342b39cbd68e0253e24c24228772003bb085e8ff46b98a7c7bf96150',decision:owner.independentPostApplyReview,
    selectedProfile:owner.selectedProfile,gyro:false,privateExpectedSolverContract:'AWAIT_ACTUAL_FROZEN_A0_PRODUCT_CONTRACT',publicSave:'LEGACY_GUARDS_UNCHANGED_NO_CUTOVER'},
  location:'LOCAL_WINDOWS_ISOLATED',productIntegration:'NO'};
const target=resolve(modern,'supplement-binding-r03.json');
try{writeFileSync(target,JSON.stringify(out,null,2)+'\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;assert(readFileSync(target).equals(Buffer.from(JSON.stringify(out,null,2)+'\n')));}
console.log(JSON.stringify({status:'PASS',copiedPayloads:rows.length,indexRows:10800,xyRows:1737,sourceRowsChecked:12530,owner:out.owner.decision,sourceV2:'UNSUPPORTED',publicCold:'NOT_RUN'}));
