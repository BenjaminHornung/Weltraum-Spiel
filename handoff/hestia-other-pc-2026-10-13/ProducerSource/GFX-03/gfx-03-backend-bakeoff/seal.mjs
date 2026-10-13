import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const spike=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(spike,'../..');
const base='17b1db4201a28e7b607c30707bdc2b75e3484a10',branch='feature/gfx-03-2026-10-09';
const spikePrefix='spikes/gfx-03-backend-bakeoff/',specPrefix='.devtoolbox/specs/changes/gfx-03-2026-10-09/';
const receiptName=spikePrefix+'receipt.json',envelopeName=spikePrefix+'binding-manifest.json';
const gitExe='C:\\IFI_SourceCode\\Utils\\opencode-migration\\runtime\\git\\cmd\\git.exe';
const git=args=>execFileSync(gitExe,['-C',root,'-c','filter.lfs.process=','-c','filter.lfs.clean=','-c','filter.lfs.required=false',...args],{encoding:'utf8',maxBuffer:32*1024*1024});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const encoded=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
async function record(file,label){const info=await lstat(file);assert.ok(info.isFile()&&!info.isSymbolicLink(),`Regular file required ${label}`);const bytes=await readFile(file);return {path:label,byteLength:bytes.length,sha256:sha(bytes)};}
async function tree(dir,prefix){const out=[];for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){assert.ok(!e.isSymbolicLink(),'No symbolic link inputs');const p=`${prefix}/${e.name}`;if(e.isDirectory())out.push(...await tree(path.join(dir,e.name),p));else out.push(await record(path.join(dir,e.name),p));}return out;}
const receipt=JSON.parse(await readFile(path.join(root,receiptName)));
assert.equal(receipt.source.baseCommit,base);assert.equal(receipt.status.environmentEvidence,'LOCAL_WINDOWS_ISOLATED');assert.equal(receipt.status.productIntegrated,false);
assert.equal(git(['rev-parse','HEAD']).trim(),base);assert.equal(git(['branch','--show-current']).trim(),branch);
const status=git(['status','--porcelain=v1','-z','--untracked-files=all']);const files=[];
for(const entry of status.split('\0').filter(Boolean)){
  const state=entry.slice(0,2),name=entry.slice(3);assert.ok(!/[DRCU!]/.test(state),`Unsupported dirty operation ${state} ${name}`);
  assert.ok(name.startsWith(spikePrefix)||name.startsWith(specPrefix),`Out-of-scope dirty path ${name}`);
  if(name===envelopeName)continue;
  if(name===receiptName){const normalized=structuredClone(receipt);normalized.source.dirtyTreeSha256=null;normalized.source.bindingManifestSha256=null;
    const bytes=encoded(normalized);files.push({path:name,gitState:state,byteLength:bytes.length,sha256:sha(bytes),normalization:'Only dirtyTreeSha256 and bindingManifestSha256 set null'});
  }else files.push({...await record(path.join(root,name),name),gitState:state});
}
files.sort((a,b)=>a.path.localeCompare(b.path,'en'));assert.ok(files.some(f=>f.path===receiptName),'Receipt must be part of dirty inventory');
const indexAll=git(['ls-files','--stage','-z']);const index=git(['ls-files','--stage','-z','--',spikePrefix,specPrefix]).split('\0').filter(Boolean).sort();
const buildProof=JSON.parse(await readFile(path.join(spike,'dist/build-proof.json')));assert.equal(buildProof.schema,'hestia.gfx03-build-inputs.v1');
const buildInputNames=['index.html','tsconfig.json','package.json','package-lock.json','build.mjs',...(await tree(path.join(spike,'src'),'src')).map(f=>f.path),...(await tree(path.join(spike,'imported/rt01/fixtures'),'imported/rt01/fixtures')).map(f=>f.path)].sort();
assert.deepEqual(buildProof.inputs.map(f=>f.path),buildInputNames,'Build binds every current input');
for(const expected of buildProof.inputs)assert.deepEqual(await record(path.join(spike,expected.path),expected.path),expected,`Stale build input ${expected.path}`);
const compiled=await tree(path.join(spike,'dist'),spikePrefix+'dist');
const dependencies=await tree(path.join(spike,'node_modules'),spikePrefix+'node_modules');
const evidence=await tree(path.join(root,specPrefix,'tests'),specPrefix+'tests');
const external=[await record(process.execPath,'node-executable'),await record(gitExe,'git-executable'),
  await record('C:\\IFI_SourceCode\\Utils\\npm-tmp\\opencode\\node-v22.23.2-win-x64\\node_modules\\npm\\bin\\npm-cli.js','approved-npm-cli-js'),
  await record('C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js','historical-preparation-npm-cli-js-not-reexecuted')];
const metadata=[];const lock=JSON.parse(await readFile(path.join(spike,'package-lock.json')));
for(const [name,p] of Object.entries(lock.packages).filter(([n])=>n.startsWith('node_modules/')).sort(([a],[b])=>a.localeCompare(b))){
  const installed=JSON.parse(await readFile(path.join(spike,name,'package.json')));assert.equal(installed.version,p.version);
  metadata.push({path:name,name:installed.name,version:installed.version,license:installed.license??null,exports:installed.exports??null,peers:installed.peerDependencies??null,registryIntegrity:p.integrity??null});
}
const profile=JSON.parse(await readFile(path.join(root,specPrefix,'tests/browser-profile-review-corrections-v1.json')));
assert.equal(profile.functionality,'PASS');assert.equal(profile.checks.length,169);assert.ok(profile.checks.every(c=>c.status==='PASS'));
const shaders=profile.shaderBindings.map(s=>{const bytes=Buffer.from(s.code);assert.equal(bytes.length,s.byteLength);assert.equal(sha(bytes),s.sha256);return {language:s.language,byteLength:bytes.length,sha256:s.sha256};});
const envelope={schema:'hestia.gfx03.byte-binding.v1',baseCommit:base,branch,files,index,
  fullIndex:{sha256:sha(Buffer.from(indexAll)),entryCount:indexAll.split('\0').filter(Boolean).length},compiled,dependencies,dependencyMetadata:metadata,
  wasm:dependencies.filter(d=>d.path.endsWith('.wasm')).map(d=>({...d,purpose:'UNUSED_TRANSITIVE_TYPE_DEPENDENCY_NOT_EXECUTED'})),shaders,evidence,external,runtime:{node:process.version,platform:process.platform,arch:process.arch},
  exclusions:[{path:envelopeName,reason:'Self-referential envelope; digest is asserted in receipt'},
    {path:spikePrefix+'.cache',reason:'npm cache not a source/runtime input; installed dependencies fully bound'},
    {path:spikePrefix+'negative-copies',reason:'Retained unique tamper copies, not imported source/runtime inputs'}]};
const bytes=encoded(envelope),digest=sha(bytes);
assert.equal(receipt.source.lockSha256,sha(await readFile(path.join(spike,'package-lock.json'))));
assert.deepEqual(receipt.source.shaderDigests,shaders);
if(process.argv.includes('--freeze')){
  try{await lstat(path.join(root,envelopeName));throw new Error('Existing seal cannot be overwritten; use --verify');}catch(e){if(e.code!=='ENOENT')throw e;}
  await writeFile(path.join(root,envelopeName),bytes,{flag:'wx'});receipt.source.dirtyTreeSha256=digest;receipt.source.bindingManifestSha256=digest;
  await writeFile(path.join(root,receiptName),encoded(receipt));
}else{
  assert.ok(process.argv.includes('--verify'),'Choose --freeze or --verify');
  assert.ok((await readFile(path.join(root,envelopeName))).equals(bytes),'Full source/index/build/dependency/evidence envelope drift');
  assert.equal(receipt.source.dirtyTreeSha256,digest);assert.equal(receipt.source.bindingManifestSha256,digest);
}
console.log(`PASS ${files.length} dirty files, ${compiled.length} build files, ${dependencies.length} dependency files, ${evidence.length} evidence files, ${shaders.length} shaders; ${digest}`);
