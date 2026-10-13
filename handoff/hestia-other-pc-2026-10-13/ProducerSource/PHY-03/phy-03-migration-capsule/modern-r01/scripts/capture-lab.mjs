import {readFileSync,writeFileSync,mkdirSync,linkSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const modern=resolve(import.meta.dirname,'..'),a0='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05';
const base='.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0';
const frozen=base+'/phy01-lab-codec-r01/frozen/pure-lab-codec-r01';
const sha=b=>createHash('sha256').update(b).digest('hex'),files=new Map(),reuse=new Map();
for(const name of ['input-binding.json','context-binding.json'])for(const row of JSON.parse(readFileSync(resolve(modern,name))).files)reuse.set(row.bytes+':'+row.sha256,resolve(modern,row.path));
function copy(origin,path,bytes,hash){
  const b=readFileSync(origin),target=resolve(modern,path);assert(!relative(modern,target).startsWith('..'));
  assert.equal(b.length,bytes,origin);assert.equal(sha(b),hash,origin);mkdirSync(dirname(target),{recursive:true});
  try{
    const previous=reuse.get(bytes+':'+hash);
    if(previous){assert(readFileSync(previous).equals(b));linkSync(previous,target);}else writeFileSync(target,b,{flag:'wx'});
  }catch(e){if(e.code!=='EEXIST')throw e;assert(readFileSync(target).equals(b));}
  const old=files.get(path);if(old)assert.equal(old.sha256,hash);
  files.set(path,{path,bytes,sha256:hash});return b;
}
const input=copy(resolve(a0,frozen,'INPUT.json'),'inputs/a0-lab-codec/INPUT.json',2529128,'c1d4404a38d9ac27a767e6a4cab365b5feae1f037736d8a5ec6e3a1d93c02f9d');
const owner=copy(resolve(a0,base,'PHY01_LAB_CODEC_RECEIPT_R01.json'),'inputs/a0-lab-codec/RECEIPT.json',204263,'f60169ba4123ef426ccfc26f4d481b31f1cdc998a27e17eef55e1fdef9ca83b7');
copy(resolve(a0,base,'PHY01_LAB_CODEC_VERIFICATION_R01.md'),'inputs/a0-lab-codec/VERIFICATION.md',1487,'1000a3354436b757bc0a40ff64b718adc3b56c05adba40ab284d06b2246d0b89');
const parsed=JSON.parse(input),receipt=JSON.parse(owner),counts={};let count=0;
for(const [name,section] of Object.entries(parsed.inventories)){
  assert.equal(sha(Buffer.from(JSON.stringify(section.rows))),section.sha256,name);counts[name]=section.rows.length;
  for(const row of section.rows){
    assert(row.snapshot.startsWith(frozen+'/'));count++;
    copy(resolve(a0,row.snapshot),'inputs/a0-lab-codec/consumer/'+row.path,row.bytes,row.sha256);
  }
}
assert.equal(count,5004);assert.equal(sha(Buffer.from(parsed.index.text)),parsed.index.sha256);
assert.equal(sha(Buffer.from(parsed.trackedDirty.text)),parsed.trackedDirty.sha256);
for(const tool of parsed.tools){const b=readFileSync(tool.path);assert.equal(b.length,tool.bytes);assert.equal(sha(b),tool.sha256);}
for(const entry of Object.values(receipt.entries)){copy(resolve(a0,entry.path),'inputs/a0-lab-codec/owner-bindings/'+entry.path,entry.bytes,entry.sha256);}
const testPath='inputs/a0-lab-codec/consumer/apps/weltraum-browser/tests/unit/phy01-lab-codec.test.ts';
const test=readFileSync(resolve(modern,testPath),'utf8');
const prefix=test.slice(test.indexOf('\n')+1,test.indexOf('\nconst resignLab='));
assert(prefix.includes('const createSyntheticAuthoredCodecFixtures='));
const derived=prefix+'\nexport const createActualOwnerAuthoredFixtures=createSyntheticAuthoredCodecFixtures;\n';
const derivedPath='inputs/a0-lab-codec/consumer/apps/weltraum-browser/tests/unit/phy03-fixture.generated.ts';
writeFileSync(resolve(modern,derivedPath),derived,{flag:'wx'});
const rows=[...files.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
const out={schema:'phy03.actual-a0-pure-lab-contract.r01',files:rows,indexSha256:sha(Buffer.from(JSON.stringify(rows))),
  inputSha256:sha(input),ownerReceiptSha256:sha(owner),verificationSha256:'1000a3354436b757bc0a40ff64b718adc3b56c05adba40ab284d06b2246d0b89',
  classification:receipt.classification,counts,snapshotRows:count,ownerBindingRows:Object.keys(receipt.entries).length,
  independentReview:'ACCEPT_BOUNDED_PURE_LAB_CODEC_STATIC_INPUT',
  derivedFixture:{path:derivedPath,sha256:sha(Buffer.from(derived)),sourcePath:testPath,sourceSha256:sha(Buffer.from(test)),method:'Unchanged actual owner fixture factory prefix; add export only; synthetic authored codec data, no stored-save relabel'},
  publicContract:'IMPLEMENTATION_INTERNALS_CHANGED_EXPORTS_SCHEMAS_DEFAULTS_WRAPPERS_RETAINED',
  nativeIndexedDbWorkerBootstrapReplacementDormancyGameCold:'NOT_RUN',productIntegration:'NO'};
writeFileSync(resolve(modern,'lab-contract-binding.json'),JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',snapshotRows:count,copiedOrOwnImmutableLinkedRows:rows.length,ownerBindingRows:Object.keys(receipt.entries).length,inputSha256:out.inputSha256,native:'NOT_RUN'}));
