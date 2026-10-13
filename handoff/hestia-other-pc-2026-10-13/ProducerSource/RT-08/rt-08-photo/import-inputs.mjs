import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../..'), workspace=path.resolve(repo,'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const inputs=[
 {id:'gfx03',worktree:'Hestia-Spike-GFX-03-2026-10-09',scope:'spikes/gfx-03-backend-bakeoff',receipt:'19cb90aa136ff917f35318fce26d76ca359ed802782ceae5f5508780cfb9f01e',seal:'b00e1d955341aad056dc4ea6cbbe147949c96af600f5bbd304313d82b0ff9386',receiptBytes:16521,sealBytes:950615},
 {id:'rt01',worktree:'Hestia-Spike-RT-01-2026-10-09',scope:'spikes/rt-01-oracle',receipt:'7ec2c677895d7a4d356814c94787824d61fad827dde99cff1d0f2e8c87d297c4',seal:'c1d7e4684eda0002b5ebe7d8187583ce4fc6fc33d8de637108abd73a1e21026c',receiptBytes:7225,sealBytes:39776}
];
const records=[], checks=[];
for(const input of inputs){
 const root=path.join(workspace,'.worktrees',input.worktree),spike=path.join(root,input.scope);
 const receipt=await readFile(path.join(spike,'receipt.json')),seal=await readFile(path.join(spike,'binding-manifest.json'));
 assert.equal(sha(receipt),input.receipt);assert.equal(receipt.length,input.receiptBytes);
 assert.equal(sha(seal),input.seal);assert.equal(seal.length,input.sealBytes);
 const result=execFileSync(process.execPath,[path.join(spike,'seal.mjs'),'--verify'],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
 checks.push({id:input.id,command:`node ${input.scope}/seal.mjs --verify`,exitCode:0,output:result.trim(),receiptSha256:sha(receipt),sealSha256:sha(seal)});
 const manifest=JSON.parse(seal), wanted=manifest.files.filter(f=>input.id==='gfx03'?
   /\/src\/(port|materials)\.ts$/.test(f.path)||/\/imported\/rt01\/fixtures\//.test(f.path)||/\/(REPORT|HANDOFF)\.md$/.test(f.path):
   f.path.startsWith('spikes/_shared/rt-2026-10-09/')||f.path.startsWith('spikes/rt-01-oracle/')&&(/\.(mjs|mts)$/.test(f.path)||/\/imported\//.test(f.path)));
 wanted.push({path:input.scope+'/receipt.json',byteLength:receipt.length,sha256:sha(receipt)}, {path:input.scope+'/binding-manifest.json',byteLength:seal.length,sha256:sha(seal)});
 for(const ref of wanted){
  assert.ok(!ref.path.includes('..')&&!path.isAbsolute(ref.path));
  const source=path.join(root,ref.path);assert.ok((await lstat(source)).isFile());
  const bytes=await readFile(source);assert.equal(bytes.length,ref.byteLength);assert.equal(sha(bytes),ref.sha256,ref.path);
  const dest=path.join(here,'inputs',input.id,ref.path);await mkdir(path.dirname(dest),{recursive:true});
  try{assert.deepEqual(await readFile(dest),bytes,'Existing immutable input drift');}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(dest,bytes,{flag:'wx'});}
  records.push({producer:input.id,sourcePath:source.replaceAll('\\','/'),path:path.relative(here,dest).replaceAll('\\','/'),byteLength:bytes.length,sha256:sha(bytes)});
 }
}
// The historical control imports this exact fixed-base product function.
const control='apps/weltraum-browser/src/hestia-prototype/terrain/picking.ts';
const controlBytes=await readFile(path.join(repo,control));
const rtSeal=JSON.parse(await readFile(path.join(here,'inputs/rt01/spikes/rt-01-oracle/binding-manifest.json')));
const ref=rtSeal.external.find(f=>f.path==='fixed-base-product-control-picking.ts');
assert.equal(sha(controlBytes),ref.sha256);assert.equal(controlBytes.length,ref.byteLength);
const controlDest=path.join(here,'inputs/rt01',control);await mkdir(path.dirname(controlDest),{recursive:true});
await writeFile(controlDest,controlBytes);
records.push({producer:'rt01',sourcePath:path.join(repo,control).replaceAll('\\','/'),path:'inputs/rt01/'+control,byteLength:controlBytes.length,sha256:sha(controlBytes)});
const output={schema:'rt08.immutable-inputs.v1',checks,files:records.sort((a,b)=>a.path.localeCompare(b.path,'en')),gfx03VisualParity:'FAIL',productIntegration:'NO'};
await writeFile(path.join(here,'input-bindings.json'),JSON.stringify(output,null,2)+'\n');
console.log(`PASS producer seals and ${records.length} immutable copied inputs`);
