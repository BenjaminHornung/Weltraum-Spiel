import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const modern=resolve(import.meta.dirname,'..');
const phy2='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-PHY-02-2026-10-09';
const r1='spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01';
const r2='spikes/phy-02-collider-bakeoff/revisions/a0-profile-decision-r02';
const a0='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05';
const a0base='.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0';
const frozen=a0base+'/phy01-port-r04/frozen/source-port-r01';
const sha=b=>createHash('sha256').update(b).digest('hex'), rows=new Map();
function copy(source,path,bytes,hash){
  const target=resolve(modern,path);assert(!relative(modern,target).startsWith('..'));
  const data=readFileSync(source);assert.equal(data.length,bytes,source);assert.equal(sha(data),hash,source);
  mkdirSync(dirname(target),{recursive:true});
  try{writeFileSync(target,data,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;assert(readFileSync(target).equals(data),'Immutable copy differs: '+target);}
  rows.set(path,{path,bytes:data.length,sha256:hash});return data;
}
const receipt=copy(resolve(phy2,r2,'receipt.json'),'inputs/phy02/r02/receipt.json',240553,'d65e11d4cc07c96dec9ab45653f9a70a0cb423f1fa7eb84a0d410343b2ed8d49');
const sealBytes=copy(resolve(phy2,r2,'seal.json'),'inputs/phy02/r02/seal.json',9848,'9feabba100528c80ebda4ee34761063841f39ccea2871c2e28fef4d3b7e00f5f');
const seal=JSON.parse(sealBytes),oldSeal=JSON.parse(copy(seal.priorSeal.path,'inputs/phy02/r01-seal.json',seal.priorSeal.bytes,seal.priorSeal.sha256));
for(const row of seal.files)copy(resolve(phy2,row.path),'inputs/phy02/payload/'+row.path,row.bytes,row.sha256);
for(const row of oldSeal.files)copy(resolve(phy2,row.path),'inputs/phy02/payload/'+row.path,row.bytes,row.sha256);
const dirtyPath='inputs/phy02/payload/'+r2+'/DirtyIndex.json';
assert.equal(sha(readFileSync(resolve(modern,dirtyPath))),'f69e176becd9ccbcdd1c891640a0f96455382282a3841c390a4d0522eba0753c');
const matrixPath='inputs/phy02/payload/'+r1+'/matrix.json';
const matrixBytes=readFileSync(resolve(modern,matrixPath));
assert.equal(sha(matrixBytes),'a9c98b8b8814103e35dc37dd83574f4dc36ce7468585f7c234ec679c4c6fab8e');
const matrix=JSON.parse(matrixBytes);assert.equal(matrix.cases.length,192);
const raw={PASS:0,FAIL:0};for(const c of matrix.cases)raw[c.status]++;
assert.deepEqual(raw,{PASS:146,FAIL:46});
const input=copy(resolve(a0,frozen,'INPUT.json'),'inputs/a0-source-port/INPUT.json',2493681,'331609c7342b39cbd68e0253e24c24228772003bb085e8ff46b98a7c7bf96150');
copy(resolve(a0,a0base,'PHY01_SOURCE_PORT_RECEIPT_R01.json'),'inputs/a0-source-port/RECEIPT.json',205833,'9e3aac6059d5f96f4a2a864bf7adc341a087f9f0b4e74795c01a3f5f41ee4bc0');
const port=JSON.parse(input),counts={};let count=0;
for(const [name,section] of Object.entries(port.inventories)){
  assert.equal(sha(Buffer.from(JSON.stringify(section.rows))),section.sha256,name);
  counts[name]=section.rows.length;
  for(const row of section.rows){
    assert(row.snapshot.startsWith(frozen+'/'));count++;
    const suffix=row.snapshot.slice(frozen.length+1);
    copy(resolve(a0,row.snapshot),'inputs/a0-source-port/'+suffix,row.bytes,row.sha256);
    if(name==='vendor'){
      const suffix=row.path.split('/vendor/rapier-phy01-migration2/')[1];
      assert(readFileSync(resolve(modern,'inputs/a0/snapshot/spike/upstream/candidate-package/migration2',suffix)).equals(readFileSync(resolve(a0,row.snapshot))),row.path);
    }
  }
}
assert.equal(count,5015);assert.equal(sha(Buffer.from(port.index.text)),port.index.sha256);
assert.equal(sha(Buffer.from(port.trackedDirty.text)),port.trackedDirty.sha256);
for(const tool of port.tools){const b=readFileSync(tool.path);assert.equal(b.length,tool.bytes);assert.equal(sha(b),tool.sha256);}
const rootPacket='C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-cloud-orchestration-2026-10-09/handoffs/PHY02_PARTIAL_RT02A_WXG_A0_SOURCE_PORT_R01.txt';
const packet=readFileSync(rootPacket);copy(rootPacket,'inputs/ROOT_CONTEXT_R01.txt',packet.length,sha(packet));
const files=[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
const out={schema:'phy03.partial-context-binding.r01',status:'PARTIAL_NOT_FINAL_INDEX',files,indexSha256:sha(Buffer.from(JSON.stringify(files))),
  phy02:{matrixPath,matrixSha256:sha(matrixBytes),matrixCases:192,raw,rawPopulation:'ARCHIVED_NOT_RERUN',r02ReceiptSha256:sha(receipt),r03SemanticIndex:'MISSING',representationChoice:'NONE'},
  a0SourcePort:{inputSha256:sha(input),files:count,counts,toolRowsChecked:port.tools.length,adoption:'TECHNICAL_CONTEXT_ONLY_POSTREVIEW_PENDING',nativeLifecycle:'NOT_RUN'},
  executionLocation:'LOCAL_WINDOWS_ISOLATED',productIntegration:'NO'};
const target=resolve(modern,'context-binding.json');
try{writeFileSync(target,JSON.stringify(out,null,2)+'\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;assert(readFileSync(target).equals(Buffer.from(JSON.stringify(out,null,2)+'\n')));}
console.log(JSON.stringify({status:'PASS',scope:'IMMUTABLE_PARTIAL_CONTEXT_BYTES_ONLY',copiedFiles:files.length,phy02Raw:raw,portFiles:count,indexSha256:out.indexSha256}));
