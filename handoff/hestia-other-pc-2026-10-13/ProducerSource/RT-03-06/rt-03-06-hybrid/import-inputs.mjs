import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const spike=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(spike,'../..'),siblings=path.dirname(root);
const gitExe='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const sha=b=>createHash('sha256').update(b).digest('hex'),encoded=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const git=(directory,args)=>execFileSync(gitExe,['-C',directory,...args],{maxBuffer:32*1024*1024});
const producers=[
 ['rt02a','Hestia-Spike-RT-02A-2026-10-09','rt-02a-bvh','59fb65bc6f4b44346452c03fe020b7974460eb0b55066f4fc95eca8ed25cf48f','1f445c14e04f8606f02f8b8f72c0c930bd76665cbe9d7db4492c2b22f84496bc'],
 ['rt02b','Hestia-Spike-RT-02B-2026-10-09','rt-02b-dda','f9a1c2e5063e62aad45d698e0a3cf5b5cea7bd26faf5dcad1fdc6669204e898c','01fddc8a392765ba462d8accdecaae0d3c40caeef4266487fa9b9684cee865b5'],
 ['gfx03','Hestia-Spike-GFX-03-2026-10-09','gfx-03-backend-bakeoff','19cb90aa136ff917f35318fce26d76ca359ed802782ceae5f5508780cfb9f01e','b00e1d955341aad056dc4ea6cbbe147949c96af600f5bbd304313d82b0ff9386'],
 ['rt01','Hestia-Spike-RT-01-2026-10-09','rt-01-oracle','7ec2c677895d7a4d356814c94787824d61fad827dde99cff1d0f2e8c87d297c4','c1d7e4684eda0002b5ebe7d8187583ce4fc6fc33d8de637108abd73a1e21026c']
];
async function regular(p){const s=await lstat(p);assert.ok(s.isFile()&&!s.isSymbolicLink(),'Regular input '+p);return readFile(p);}
async function copy(origin,destination,producer,boundMember){
 const bytes=await regular(origin);await mkdir(path.dirname(destination),{recursive:true});
 try{await writeFile(destination,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;assert.ok(bytes.equals(await regular(destination)),'Existing copy drift');}
 return {producer,origin,destination:path.relative(spike,destination).replaceAll('\\','/'),byteLength:bytes.length,sha256:sha(bytes),boundMember};
}
const result={schema:'hestia.rt0306.closed-inputs.v1',executionLocation:'LOCAL_WINDOWS_ISOLATED',producers:[],copies:[],productExports:0};
for(const [id,folder,name,receiptPin,manifestPin] of producers){
 const producerRoot=path.join(siblings,folder),prefix='spikes/'+name+'/',origin=path.join(producerRoot,prefix);
 const receiptBytes=await regular(path.join(origin,'receipt.json')),manifestBytes=await regular(path.join(origin,'binding-manifest.json'));
 assert.equal(sha(receiptBytes),receiptPin,id+' receipt');assert.equal(sha(manifestBytes),manifestPin,id+' manifest');
 const manifest=JSON.parse(manifestBytes),rows=[...(manifest.files??[]),...(manifest.compiled??[]),...(manifest.dependencies??[]),...(manifest.evidence??[])];
 const unique=new Map();for(const r of rows){assert.ok(!path.isAbsolute(r.path)&&!r.path.split('/').includes('..'),'Relative manifest member');unique.set(r.path,r);}
 for(const [member,row] of unique){
  let b=await regular(path.join(producerRoot,member));
  if(row.normalization){const normalized=JSON.parse(b);normalized.source.dirtyTreeSha256=null;normalized.source.bindingManifestSha256=null;b=id==='rt01'?Buffer.from(JSON.stringify(normalized)+'\n'):encoded(normalized);}
  assert.equal(b.length,row.byteLength??row.bytes,id+' size '+member);assert.equal(sha(b),row.sha256,id+' SHA '+member);
 }
 const head=git(producerRoot,['rev-parse','HEAD']).toString().trim();assert.equal(head,'17b1db4201a28e7b607c30707bdc2b75e3484a10');
 const actualBranch=git(producerRoot,['branch','--show-current']).toString().trim();assert.equal(actualBranch,manifest.branch);
 const fullIndex=git(producerRoot,['ls-files','--stage','-z']);
 if(manifest.fullIndex)assert.equal(sha(fullIndex),manifest.fullIndex.sha256,id+' full index');
 if(Array.isArray(manifest.index)){const current=git(producerRoot,['ls-files','--stage','-z','--',prefix,'.devtoolbox/specs/changes/'+name.replace('rt-02a-bvh','rt-02a').replace('rt-02b-dda','rt-02b').replace('gfx-03-backend-bakeoff','gfx-03').replace('rt-01-oracle','rt-01')+'-2026-10-09/',...(id==='rt01'?['spikes/_shared/rt-2026-10-09/']:[])]).toString().split('\0').filter(Boolean).sort();assert.deepEqual(current,manifest.index,id+' scoped index');}
 const rawStatus=git(producerRoot,['status','--porcelain=v1','-z','--untracked-files=all']).toString();
 const dirty=rawStatus.split('\0').filter(Boolean);
 for(const r of dirty)assert.ok(r.slice(3).startsWith(prefix)||r.slice(3).startsWith('.devtoolbox/specs/changes/')||id==='rt01'&&r.slice(3).startsWith('spikes/_shared/rt-2026-10-09/'),id+' scope '+r);
 if(id==='rt02a'){
  const seal=await regular(path.join(origin,'seal.json'));assert.equal(sha(seal),'d8e63a4fb0af75e34bc9abcb7520bc7c98dad923daa8e98c0599ca766268c1af');
  for(const c of JSON.parse(seal).controls){const b=await regular(path.join(producerRoot,c.path));assert.equal(b.length,c.bytes??c.byteLength);assert.equal(sha(b),c.sha256);}
  for(const r of [...(manifest.tools??[]),...(manifest.externalArtifacts??[])]){const b=await regular(r.path);assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);}
 }
 const wanted=member=>{
  if(!member.startsWith(prefix))return false;const p=member.slice(prefix.length);
  return p.startsWith('src/')||p.startsWith('fixtures/')||p.startsWith('imports/')||p.startsWith('imported/')||
   p.startsWith('frozen/')||p.startsWith('historical/')||p.startsWith('.build/')||
   ['fixtures.mjs','HANDOFF.md','REPORT.md','README.md','package.json','package-lock.json','receipt.json','seal.json','binding-manifest.json','dirty-tree.json'].includes(p);
 };
 const members=new Set([...unique.keys()].filter(wanted));
 for(const p of ['receipt.json','binding-manifest.json',...(id==='rt02a'?['seal.json','dirty-tree.json']:[])])members.add(prefix+p);
 // Compiled source copies are controls, never execution dependencies; dist is rebuilt with own tools.
 for(const member of [...members].sort()){
  const destination=path.join(spike,'inputs',id,member.slice(prefix.length));
  result.copies.push(await copy(path.join(producerRoot,member),destination,id,unique.has(member)||member.endsWith('receipt.json')||member.endsWith('binding-manifest.json')||id==='rt02a'));
 }
 result.producers.push({id,originRoot:producerRoot,receiptSha256:receiptPin,bindingManifestSha256:manifestPin,fullVerifiedFiles:unique.size,head,branch:actualBranch,indexSha256:sha(fullIndex),dirtyStatusSha256:sha(Buffer.from(rawStatus)),dirtyMembers:dirty,verifiedFullBytes:true,hardware:'NOT_RUN',acceptedFor:'CPU_CODE_AND_SHADER_SOURCE_ONLY'});
}
const productPort='apps/weltraum-browser/src/hestia-prototype/presentation/shadowRevision.ts';
const controlBytes=git(root,['show','17b1db4201a28e7b607c30707bdc2b75e3484a10:'+productPort]);
assert.ok(controlBytes.equals(await regular(path.join(root,productPort))),'Base product port unchanged');
result.copies.push(await copy(path.join(root,productPort),path.join(spike,'inputs/base17b/shadowRevision.ts'),'base17b',true));
const packageRoot='C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-cloud-orchestration-2026-10-09';
for(const p of ['USER_OVERRIDES_2026-10-09.md','STATE.json','Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09/00_START_HIER.md','Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09/01_PRUEFUNG_UND_ENTSCHEIDUNG.md','Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09/03_SCHNITTSTELLEN_UND_UEBERNAHME.md','Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09/Cloud/00_GEMEINSAMER_VERTRAG.md','Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09/Auftraege/RT-03-06.md','Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09/Goals/RT-03-06.txt','Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09/Quellen/threejs-raytracing-intel-amd-nvidia-2026-10-09.md','Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09/Quellen/hestia-adaptive-shader-grafikarchitektur-threejs-webgpu-wasm-2026-10-09.md','Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09/Quellen/hestia-konzeptpaket-review-und-arbeitspaket-registry-2026-10-09.md']){
 result.copies.push(await copy(path.join(packageRoot,p),path.join(spike,'inputs/context',p),'original-context',true));
}
await writeFile(path.join(spike,'input-manifest.json'),encoded(result),{flag:'wx'});
console.log(JSON.stringify({status:'PASS',producers:result.producers.map(({id,fullVerifiedFiles})=>({id,fullVerifiedFiles})),copies:result.copies.length,productExports:0}));
