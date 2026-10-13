import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {spike,sha,verifyImports} from './inputs.mjs';
const root=path.resolve(spike,'../..'),prefix='spikes/rt-02b-dda/',spec='.devtoolbox/specs/changes/rt-02b-2026-10-09/';
const gitExe='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe',base='17b1db4201a28e7b607c30707bdc2b75e3484a10';
const git=args=>execFileSync(gitExe,['-C',root,...args],{encoding:'utf8',maxBuffer:32*1024*1024});
const encoded=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const receiptPath=prefix+'receipt.json',sealPath=prefix+'binding-manifest.json';
const record=async(file,label)=>{const stat=await lstat(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Regular bound file '+label);const b=await readFile(file);return {path:label,byteLength:b.length,sha256:sha(b)};};
async function tree(directory,prefix){const out=[];for(const e of await readdir(directory,{withFileTypes:true})){assert.ok(!e.isSymbolicLink(),'No symlink/reparse binding');const p=prefix+'/'+e.name;if(e.isDirectory())out.push(...await tree(path.join(directory,e.name),p));else out.push(await record(path.join(directory,e.name),p));}return out.sort((a,b)=>a.path.localeCompare(b.path,'en'));}
await verifyImports();assert.equal(git(['rev-parse','HEAD']).trim(),base);assert.equal(git(['branch','--show-current']).trim(),'feature/rt-02b-2026-10-09');
const receipt=JSON.parse(await readFile(path.join(root,receiptPath)));assert.equal(receipt.status.environmentEvidence,'LOCAL_WINDOWS_ISOLATED');assert.equal(receipt.status.productIntegration,'NO');
const raw=git(['status','--porcelain=v1','-z','--untracked-files=all']),status=raw.split('\0').filter(Boolean),files=[];
for(const row of status){const state=row.slice(0,2),name=row.slice(3);assert.ok(!/[DRCU!]/.test(state),'Unsupported dirty operation '+row);
 assert.ok(name.startsWith(prefix)||name.startsWith(spec),'Dirty path outside exclusive RT02B scope '+name);if(name===sealPath)continue;
 if(name===receiptPath){const normalized=structuredClone(receipt);normalized.source.dirtyTreeSha256=null;normalized.source.bindingManifestSha256=null;const b=encoded(normalized);files.push({path:name,gitState:state,byteLength:b.length,sha256:sha(b),normalization:'Only source.dirtyTreeSha256 and source.bindingManifestSha256 are null'});
 }else files.push({...await record(path.join(root,name),name),gitState:state});}
files.sort((a,b)=>a.path.localeCompare(b.path,'en'));assert.ok(files.some(f=>f.path===receiptPath));
const allIndex=git(['ls-files','--stage','-z']),index=git(['ls-files','--stage','-z','--',prefix,spec]).split('\0').filter(Boolean).sort();
const compiled=await tree(path.join(spike,'dist'),prefix+'dist'),dependencies=await tree(path.join(spike,'node_modules'),prefix+'node_modules');
const proof=JSON.parse(await readFile(path.join(spike,'dist/build-proof.json')));
const sourceNames=['package.json','package-lock.json','tsconfig.json','build.mjs','index.html','browser-profile.mjs','import-manifest.json',...(await tree(path.join(spike,'src'),'src')).map(f=>f.path),...(await tree(path.join(spike,'imported'),'imported')).map(f=>f.path)].sort();
assert.deepEqual(proof.inputs.map(f=>f.path),sourceNames,'Exact complete build source membership');
for(const f of proof.inputs)assert.deepEqual(await record(path.join(spike,f.path),f.path),f,'Stale build source '+f.path);
const browser=JSON.parse(await readFile(path.join(root,spec+'tests/browser-cpu-final-v5.json')));
assert.equal(browser.result.status,'PASS');assert.equal(browser.result.checks.length,3051);assert.ok(browser.result.checks.every(c=>c.status==='PASS'));
for(const f of browser.servedBindings)assert.deepEqual(await record(path.join(spike,'dist',f.path),f.path),f,'Served build binding '+f.path);
const commands=JSON.parse(await readFile(path.join(root,spec+'tests/code-final-v5-commands.json')));assert.equal(commands.status,'PASS');assert.ok(commands.commands.every(c=>c.exitCode===0));
for(const c of commands.commands)assert.equal(sha(await readFile(path.join(root,spec+'tests',c.log))),c.logSha256);
const emitted=JSON.parse(await readFile(path.join(root,spec+'tests/compiled-runtime-final-v5.json')));assert.equal(emitted.status,'PASS');assert.equal(emitted.processExitCode,0);assert.equal(emitted.golden.totalComparisons,3000);
for(const [name,f] of Object.entries(emitted.emittedArtifacts))assert.deepEqual(await record(path.join(spike,'dist',name),name),{path:name,...f});
const evidence=await tree(path.join(root,spec+'tests'),spec.replace(/\/$/,'')+'/tests');
const external=[];for(const [p,n] of [[process.execPath,'node-executable'],[gitExe,'git-executable'],
 ['C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js','npm-cli-js'],
 ['C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/lib/cli.js','npm-lib-cli-js'],
 ['C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/package.json','npm-package-json'],
 ['C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe','python-executable-metadata-only'],
 ['C:/Program Files/Google/Chrome/Application/chrome.exe','installed-chrome-binary-version-matches-observed-UA']])external.push(await record(p,n));
const dependencyMetadata=[],lock=JSON.parse(await readFile(path.join(spike,'package-lock.json')));
for(const [name,p] of Object.entries(lock.packages).filter(([n])=>n)){const d=JSON.parse(await readFile(path.join(spike,name,'package.json')));assert.equal(d.version,p.version);dependencyMetadata.push({path:name,name:d.name,version:d.version,license:d.license??null,exports:d.exports??null,registryIntegrity:p.integrity});}
assert.equal(receipt.source.lockSha256,sha(await readFile(path.join(spike,'package-lock.json'))));
const shader=await record(path.join(spike,'src/dda.wgsl'),'src/dda.wgsl');assert.equal(receipt.source.shaderDigests[0].sha256,shader.sha256);
const membership=await tree(spike,prefix.replace(/\/$/,''));
const names=new Set([...files,...compiled,...dependencies].map(f=>f.path));for(const f of membership)assert.ok(names.has(f.path)||f.path===sealPath||f.path.startsWith(prefix+'.cache/')||f.path.startsWith(prefix+'negative-copies/'),'Unbound physical scope member '+f.path);
const envelope={schema:'hestia.rt02b.byte-binding.v1',baseCommit:base,branch:'feature/rt-02b-2026-10-09',files,index,fullIndex:{sha256:sha(Buffer.from(allIndex)),entryCount:allIndex.split('\0').filter(Boolean).length},compiled,dependencies,dependencyMetadata,evidence,external,
 shaders:[{...shader,language:'WGSL',compilation:'NOT_RUN',gpuExecution:'NOT_RUN'}],wasm:dependencies.filter(f=>f.path.endsWith('.wasm')).map(f=>({...f,purpose:'UNUSED_TRANSITIVE_THREE_TYPE_DEPENDENCY_NOT_EXECUTED'})),
 runtime:{node:process.version,platform:process.platform,arch:process.arch},exclusions:[{path:sealPath,reason:'Self-reference; exact bytes/digest in receipt; file membership checked separately'},
 {path:prefix+'.cache/',reason:'Own npm cache is not a source/runtime input; actual installed dependencies fully bound'},
 {path:prefix+'negative-copies/',reason:'Retained uniquely named test tamper outputs, never consumer/runtime inputs'}]};
const bytes=encoded(envelope),hash=sha(bytes);
if(process.argv.includes('--freeze')){await writeFile(path.join(root,sealPath),bytes,{flag:'wx'});receipt.source.dirtyTreeSha256=hash;receipt.source.bindingManifestSha256=hash;await writeFile(path.join(root,receiptPath),encoded(receipt));}
else{assert.ok(process.argv.includes('--verify'),'Use --freeze once, then --verify');assert.ok(bytes.equals(await readFile(path.join(root,sealPath))),'Full source/index/build/installed/evidence/tool binding drift');assert.equal(receipt.source.dirtyTreeSha256,hash);assert.equal(receipt.source.bindingManifestSha256,hash);}
console.log(JSON.stringify({status:'PASS',dirtyFiles:files.length,compiledFiles:compiled.length,dependencyFiles:dependencies.length,evidenceFiles:evidence.length,wasmFiles:envelope.wasm.length,shaders:1,dirtyTreeSha256:hash,productIntegration:'NO',hardware:'NOT_RUN'}));
