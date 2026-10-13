import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const own=path.dirname(fileURLToPath(import.meta.url));
const worktrees=path.resolve(own,'../../../');
const gitExe='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
export const sha=b=>createHash('sha256').update(b).digest('hex');
const pin='bc6e9be728c932b0fe6f88ea2d6024f61b2b53bc59d47aae0e941c499a34dbea';
const sources=[
 {id:'rt01',root:path.join(worktrees,'Hestia-Spike-RT-01-2026-10-09'),prefix:'spikes/rt-01-oracle',
  receipt:'7ec2c677895d7a4d356814c94787824d61fad827dde99cff1d0f2e8c87d297c4',manifest:'c1d7e4684eda0002b5ebe7d8187583ce4fc6fc33d8de637108abd73a1e21026c'},
 {id:'gfx03',root:path.join(worktrees,'Hestia-Spike-GFX-03-2026-10-09'),prefix:'spikes/gfx-03-backend-bakeoff',
  receipt:'19cb90aa136ff917f35318fce26d76ca359ed802782ceae5f5508780cfb9f01e',manifest:'b00e1d955341aad056dc4ea6cbbe147949c96af600f5bbd304313d82b0ff9386'}
];
const node='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const npm='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js';
const compiler=path.join(worktrees,'Hestia-CutV3-Resume-2026-10-05/apps/weltraum-browser/node_modules');
const external={
 'node-executable':node,'git-executable':gitExe,'approved-npm-cli-js':npm,
 'historical-preparation-npm-cli-js-not-reexecuted':'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
 'fixed-base-product-control-picking.ts':path.join(sources[0].root,'apps/weltraum-browser/src/hestia-prototype/terrain/picking.ts'),
 ...Object.fromEntries(['typescript/lib/tsc.js','typescript/lib/getExePath.js','typescript/lib/version.cjs','typescript/package.json',
  'typescript-win32-x64/lib/tsc.exe','typescript-win32-x64/package.json'].map(n=>[n,path.join(compiler,n.startsWith('typescript-win32')?'@typescript/'+n:n)]))
};
function safe(root,name){assert.ok(!path.isAbsolute(name)&&!name.split(/[\\/]/).includes('..'),'Unsafe manifest member');return path.join(root,name);}
async function record(file,label){const s=await lstat(file);assert.ok(s.isFile()&&!s.isSymbolicLink(),'Regular closed input required');const b=await readFile(file);return {path:label,byteLength:b.length,sha256:sha(b)};}
async function tree(dir,prefix){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){assert.ok(!e.isSymbolicLink(),'No symlink input');const n=prefix+'/'+e.name;if(e.isDirectory())out.push(...await tree(path.join(dir,e.name),n));else out.push(n);}return out;}
const git=(root,args)=>execFileSync(gitExe,['-C',root,...args],{encoding:'utf8',maxBuffer:32*1024*1024});
const records=[],checks=[],copies=[];
async function copy(source,name,dest){const b=await readFile(safe(source.root,name));copies.push({dest,bytes:b});records.push({producer:source.id,sourcePath:name,path:'imported/'+dest,byteLength:b.length,sha256:sha(b)});}
for(const s of sources){
 const rb=await readFile(path.join(s.root,s.prefix,'receipt.json')),mb=await readFile(path.join(s.root,s.prefix,'binding-manifest.json'));
 assert.equal(sha(rb),s.receipt,'Exact frozen producer receipt');assert.equal(sha(mb),s.manifest,'Exact frozen producer manifest');
 const receipt=JSON.parse(rb),m=JSON.parse(mb);assert.equal(receipt.source.bindingManifestSha256,s.manifest);
 assert.equal(receipt.status.productIntegrated,false);assert.equal(m.baseCommit,'17b1db4201a28e7b607c30707bdc2b75e3484a10');
 let verified=0;const named=new Set();
 for(const category of ['files','compiled','dependencies','evidence']){
  const localNames=new Set();
  for(const ref of m[category]??[]){
   assert.ok(!localNames.has(ref.path),'Duplicate manifest member');localNames.add(ref.path);named.add(ref.path);
   let actual;
   if(ref.normalization){const n=structuredClone(receipt);n.source.dirtyTreeSha256=null;n.source.bindingManifestSha256=null;
    const b=Buffer.from(JSON.stringify(n,null,s.id==='rt01'?undefined:2)+'\n');actual={path:ref.path,byteLength:b.length,sha256:sha(b)};
   }else actual=await record(safe(s.root,ref.path),ref.path);
   assert.equal(actual.byteLength,ref.byteLength,'Input length '+ref.path);assert.equal(actual.sha256,ref.sha256,'Input digest '+ref.path);verified++;
  }
 }
 for(const ref of m.external){assert.ok(external[ref.path],'Unmapped external input '+ref.path);const a=await record(external[ref.path],ref.path);assert.equal(a.byteLength,ref.byteLength);assert.equal(a.sha256,ref.sha256);verified++;}
 const status=git(s.root,['status','--porcelain=v1','-z','--untracked-files=all']).split('\0').filter(Boolean);
 const envelope=s.prefix+'/binding-manifest.json';
 const expected=m.files.map(f=>f.gitState+' '+f.path).sort();
 assert.equal(status.filter(n=>n.slice(3)===envelope).length,1,'One sealed envelope in actual dirty tree');
 assert.deepEqual(status.filter(n=>n.slice(3)!==envelope).sort(),expected,'Full frozen dirty membership');
 const scope=s.id==='rt01'?['spikes/rt-01-oracle/','spikes/_shared/rt-2026-10-09/','.devtoolbox/specs/changes/rt-01-2026-10-09/']:[s.prefix+'/','.devtoolbox/specs/changes/gfx-03-2026-10-09/'];
 assert.deepEqual(git(s.root,['ls-files','--stage','-z','--',...scope]).split('\0').filter(Boolean).sort(),m.index,'Exact scoped index');
 if(m.fullIndex)assert.equal(sha(Buffer.from(git(s.root,['ls-files','--stage','-z']))),m.fullIndex.sha256,'Full index');
 const excluded=n=>n===s.prefix+'/binding-manifest.json'||n.startsWith(s.prefix+'/.cache/')||n.startsWith(s.prefix+'/negative-copies/')||n.startsWith(s.prefix+'/tamper-negative-');
 for(const dir of scope)for(const name of await tree(path.join(s.root,dir),dir.replace(/\/$/,'')))assert.ok(named.has(name)||excluded(name),'Unbound producer membership '+name);
 for(const shader of m.shaders??[])assert.match(shader.sha256,/^[a-f0-9]{64}$/);
 checks.push({producer:s.id,receiptSha256:s.receipt,bindingManifestSha256:s.manifest,verifiedFiles:verified,membership:'PASS',index:'PASS'});
 await copy(s,s.prefix+'/receipt.json',s.id+'/receipt.json');
 await copy(s,s.prefix+'/binding-manifest.json',s.id+'/binding-manifest.json');
 await copy(s,s.prefix+'/HANDOFF.md',s.id+'/HANDOFF.md');
 if(s.id==='rt01'){
  for(const n of ['src/dda.mts','src/bruteForce.mts','src/types.mts','src/validate.mts','fixtures.mjs','package-lock.json'])
   await copy(s,s.prefix+'/'+n,'rt01/'+n);
  const fixturePrefix='spikes/_shared/rt-2026-10-09/v1',fb=await readFile(path.join(s.root,fixturePrefix,'manifest.json'));
  assert.equal(sha(fb),pin);const f=JSON.parse(fb);assert.equal(f.files.length,49);assert.equal(f.frozen,true);
  await copy(s,fixturePrefix+'/manifest.json','fixtures/manifest.json');
  for(const ref of f.files){const a=await record(safe(s.root,fixturePrefix+'/'+ref.path),ref.path);assert.equal(a.byteLength,ref.byteLength);assert.equal(a.sha256,ref.sha256);
   // Complete small fixture closure also supplies GFX camera/material port inputs.
   await copy(s,fixturePrefix+'/'+ref.path,'fixtures/'+ref.path);}
  for(const n of ['docs/coordination/input-package/03_LAB_VERTRAEGE_UND_FIXTURES.md','reports/planner-followup-ebb913d/RAY_FOLLOWUP.md','tests/RD-13/native.spec.ts'])
   await copy(s,s.prefix+'/imported/F00-CONTROL/historical/'+n,'historical/'+n);
 }else for(const n of ['src/port.ts','src/capability.mjs'])await copy(s,s.prefix+'/'+n,'gfx03/'+n);
}
for(const {dest,bytes} of copies){const f=path.join(own,'imported',dest);await mkdir(path.dirname(f),{recursive:true});await writeFile(f,bytes,{flag:'wx'});}
await writeFile(path.join(own,'import-manifest.json'),JSON.stringify({schema:'hestia.rt02b.import.v1',fixtureManifestSha256:pin,checks,files:records},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',checks,copied:records.length}));
