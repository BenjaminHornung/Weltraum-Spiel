import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,lstat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {spike,root,evidence,sha,verifyInputs} from './inputs.mjs';
const prefix='spikes/rt-03-06-hybrid/',spec='.devtoolbox/specs/changes/rt-03-06-2026-10-09/',base='17b1db4201a28e7b607c30707bdc2b75e3484a10',branch='feature/rt-03-06-2026-10-09';
const controls=['binding-manifest.json','dirty-tree.json','receipt.json','seal.json'],gitExe='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const encoded=o=>Buffer.from(JSON.stringify(o,null,2)+'\n'),git=args=>execFileSync(gitExe,['--no-optional-locks','-C',root,...args],{maxBuffer:32*1024*1024});
async function record(file,label){const stat=await lstat(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Regular file '+label);const b=await readFile(file);return {path:label,byteLength:b.length,sha256:sha(b)};}
async function tree(dir,label){const rows=[];for(const e of await readdir(dir,{withFileTypes:true})){assert.ok(!e.isSymbolicLink(),'No symlink/reparse inputs');const p=label+'/'+e.name;if(e.isDirectory())rows.push(...await tree(path.join(dir,e.name),p));else rows.push(await record(path.join(dir,e.name),p));}return rows.sort((a,b)=>a.path.localeCompare(b.path,'en'));}
async function collect(){
 await verifyInputs();assert.equal(git(['rev-parse','HEAD']).toString().trim(),base);assert.equal(git(['branch','--show-current']).toString().trim(),branch);
 const status=git(['status','--porcelain=v1','-z','--untracked-files=all']),dirty=status.toString().split('\0').filter(Boolean);
 for(const row of dirty){assert.ok(!/[DRCU!]/.test(row.slice(0,2)),'Unsupported dirty operation');assert.ok(row.slice(3).startsWith(prefix)||row.slice(3).startsWith(spec),'Out-of-scope dirty path '+row.slice(3));}
 const fullIndex=git(['ls-files','--stage','-z']),ownIndex=git(['ls-files','--stage','-z','--',prefix,spec]);
 const indexPath=git(['rev-parse','--git-path','index']).toString().trim(),indexFile=await record(path.resolve(root,indexPath),'physical-git-index');
 const staged=git(['diff','--cached','--binary',base]),unstaged=git(['diff','--binary']),baseTree=git(['rev-parse',base+'^{tree}']).toString().trim();
 assert.equal(staged.length,0,'No staged repository changes authorized');assert.equal(unstaged.length,0,'Only new own-scope files expected');
 const all=[...await tree(spike,prefix.slice(0,-1)),...await tree(path.join(root,spec),spec.slice(0,-1))],files=all.filter(r=>!controls.some(c=>r.path===prefix+c));
 const input=JSON.parse(await readFile(path.join(spike,'input-manifest.json'))),commands=JSON.parse(await readFile(path.join(evidence,'code-commands.json')));
 assert.equal(commands.status,'PASS');assert.deepEqual(commands.commands.map(c=>c.exitCode),[0,0,0,0,0]);
 for(const c of commands.commands)assert.equal(sha(await readFile(path.join(evidence,c.log))),c.logSha256,'Raw command log '+c.name);
 const tests=await readFile(path.join(evidence,'code-final-focused-tests.log'),'utf8');assert.match(tests,/# tests 26\b/);assert.match(tests,/# fail 0\b/);
 const replay=JSON.parse(await readFile(path.join(evidence,'replay-runtime.json')));assert.equal(replay.status,'PASS');assert.equal(replay.events,125);assert.equal(replay.oracleComparisons,375);assert.equal(replay.finalResources.retainedGenerations,0);
 const build=JSON.parse(await readFile(path.join(spike,'dist/build-proof.json')));
 assert.ok(!build.outputs.some(r=>r.path==='build-proof.json'),'Build proof may not hash its previous self');
 for(const r of build.inputs)assert.deepEqual(await record(path.join(spike,r.path),r.path),r,'Stale emitted build source '+r.path);
 for(const r of build.outputs)assert.deepEqual(await record(path.join(spike,'dist',r.path),r.path),r,'Emitted payload drift '+r.path);
 const installed=files.filter(r=>r.path.startsWith(prefix+'node_modules/')),lock=JSON.parse(await readFile(path.join(spike,'package-lock.json')));
 const metadata=[];for(const [p,r] of Object.entries(lock.packages).filter(([p])=>p)){const d=JSON.parse(await readFile(path.join(spike,p,'package.json')));assert.equal(d.version,r.version);metadata.push({path:p,name:d.name,version:d.version,license:d.license??null,exports:d.exports??null,integrity:r.integrity});}
 assert.equal(metadata.find(r=>r.name==='@dimforge/rapier3d-compat').version,'0.21.0');
 const toolPaths=[process.execPath,gitExe,'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js','C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/lib/cli.js','C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/package.json','C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe','C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe'];
 const tools=[];for(const p of toolPaths)tools.push({...await record(p,p),execution:p.includes('chrome.exe')?'NOT_LAUNCHED_METADATA_ONLY':p.includes('python.exe')?'VERSION_ONLY':p===process.execPath?'ACTUAL_NODE22_CODE':'TOOLCHAIN'});
 const dirtyTree={schema:'hestia.rt0306.dirty.v1',head:base,branch,baseTree,fullIndexSha256:sha(fullIndex),fullIndexEntries:fullIndex.toString().split('\0').filter(Boolean).length,physicalIndex:indexFile,scopedIndexSha256:sha(ownIndex),scopedIndexEntries:ownIndex.toString().split('\0').filter(Boolean).length,
  stagedDiffSha256:sha(staged),unstagedDiffSha256:sha(unstaged),gitStatusSha256:sha(status),dirtyPaths:dirty,payloadRowsSha256:sha(encoded(files)),controlExclusions:controls.map(c=>prefix+c),policy:'All physical own-scope files, including ignored installed/vendor/build/evidence/npm-cache/test negatives. Four self-reference controls bound separately in exact outer seal.'};
 const manifest={schema:'hestia.rt0306.binding.v1',baseCommit:base,branch,sourceTreeBase:baseTree,files,tools,dependencyMetadata:metadata,sourceInputs:input.producers,sourceCopyMembers:input.copies.length,git:dirtyTree,
  before:{baseCommit:base,cleanInitialGitStatusExitCode:0,initialDirtyEntries:0,initialOwnScopes:'ABSENT',staged:'EMPTY',physicalIndexByteDigest:'NOT_CAPTURED_BEFORE_FIRST_STATUS; CURRENT_FULL_INDEX_AND_SOURCE_TREE_BOUND',producerBeforeCopy:'FULL_ORIGINAL_BYTES_INDEX_DIRTY_VERIFIED_INPUT_MANIFEST',sourceBeforeEmit:'ALL_BUILD_INPUT_BYTES_IN_BUILD_PROOF'},
  after:{commandsExitCodes:commands.commands.map(c=>c.exitCode),focusedTestGroups:26,fullSourceBuildInputMembers:build.inputs.length,emittedMembers:build.outputs.length,retainedGenerations:0},
  shaders:files.filter(r=>r.path.endsWith('.wgsl')).map(r=>({...r,realCompile:'NOT_RUN'})),wasm:installed.filter(r=>r.path.endsWith('.wasm')).map(r=>({...r,purpose:'UNUSED_TRANSITIVE_NOT_EXECUTED'})),buildProof:files.find(r=>r.path===prefix+'dist/build-proof.json'),
  runtime:{node:process.version,npm:'10.9.8',git:'2.56.0.windows.1',python:'3.12.13_VERSION_ONLY',browser:'CHROMIUM151.0.7922.34_BINARY_METADATA_NOT_LAUNCHED',rust:'NOT_USED',powershell:'7.6.4',hostLoad:'UNCONTROLLED_PARALLEL_SESSIONS',actualAdapter:null,gpuMilliseconds:null},
  reviewedDiff:files.find(r=>r.path===prefix+'review.patch'),reviewManifest:files.find(r=>r.path===prefix+'review-manifest.json'),controlPolicy:'Four named controls excluded from payload hashes only to avoid self cycles; exact bytes in seal.json, outer seal SHA reported externally'};
 return {manifest,dirtyTree};
}
async function reviewPatch(){
 const status=git(['status','--porcelain=v1','-z','--untracked-files=all']).toString().split('\0').filter(Boolean),exclude=[...controls,'review.patch','review-manifest.json'].map(p=>prefix+p),rows=[],parts=[];
 for(const row of status){const p=row.slice(3);assert.ok(p.startsWith(prefix)||p.startsWith(spec),'Scope');assert.equal(row.slice(0,2),'??','Expected new files only');if(exclude.includes(p))continue;const bytes=await readFile(path.join(root,p)),r=await record(path.join(root,p),p);
  const text=bytes.toString('utf8'),isText=!bytes.includes(0)&&Buffer.from(text).equals(bytes);rows.push({...r,gitState:row.slice(0,2),representation:isText?'EXACT_NEW_TEXT_PATCH':'BINARY_DIGEST_INVENTORY'});
  if(isText){if(bytes.length===0){parts.push('diff --git a/'+p+' b/'+p+'\nnew file mode 100644\nindex 0000000..e69de29\n');continue;}const lines=text.split('\n'),ends=text.endsWith('\n');if(ends)lines.pop();parts.push('diff --git a/'+p+' b/'+p+'\nnew file mode 100644\n--- /dev/null\n+++ b/'+p+'\n@@ -0,0 +1,'+lines.length+' @@\n'+lines.map(l=>'+'+l+'\n').join('')+(ends?'':'\\ No newline at end of file\n'));}
 }
 await writeFile(path.join(spike,'review.patch'),parts.join(''));
 await writeFile(path.join(spike,'review-manifest.json'),encoded({schema:'hestia.rt0306.review.v1',baseCommit:base,branch,files:rows,patchSha256:sha(Buffer.from(parts.join(''))),derivedExclusions:exclude,ignoredArtifacts:'Full exact binding-manifest inventory includes dist/node_modules/cache/logs. Four controls exact in outer seal.',humanPlannotator:'NOT_GRANTED'}));
}
async function freeze(){
 for(const name of controls)try{await writeFile(path.join(spike,name),'{}\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 await reviewPatch();const {manifest,dirtyTree}=await collect(),mb=encoded(manifest),db=encoded(dirtyTree);
 const owner=JSON.parse(await readFile(path.join(evidence,'owner-identity.json'))),fixture=await record(path.join(spike,'inputs/rt02a/fixtures/manifest.json'),'inputs/rt02a/fixtures/manifest.json'),lock=await record(path.join(spike,'package-lock.json'),'package-lock.json');
 const receipt={schema:'hestia.rt0306.receipt.v1',task:'RT-03-06',executionLocation:'LOCAL_WINDOWS_ISOLATED',source:{baseCommit:base,head:base,branch,candidateCommit:null,dirtyTreeSha256:sha(db),bindingManifestSha256:sha(mb),lock,fixture,copyManifest:await record(path.join(spike,'input-manifest.json'),'input-manifest.json'),replay:await record(path.join(spike,'fixtures/replay-manifest.json'),'fixtures/replay-manifest.json')},
  status:{implementation:'COMPLETE',implementationScope:'FINITE_LAB_CANDIDATE',taskAcceptance:'PARTIAL',localCode:'PASS',cpuOracle:'PASS',typecheck:'PASS',build:'PASS',browserCpuFunctional:'NOT_RUN',realShaderCompilation:'NOT_RUN',gpuOracle:'NOT_RUN',actualDeviceLoss:'NOT_RUN',visual:'NOT_RUN',hardware:'NOT_RUN',reference:'NOT_RUN',genuineHvpCutSave:'BLOCKED_NO_GENUINE_EXPORT',a0M2:'BLOCKED_NO_GENUINE_WORKLOAD',productIntegration:'NO',recommendation:'CANDIDATE_UNQUALIFIED',humanPlannotator:'NOT_GRANTED',commitPushMergePublication:'NOT_PERFORMED',inheritedProductGate:'FAIL_MODULE_NOT_FOUND'},
  owner:{nativeId:owner.nativeId,paseoAgentId:owner.task.paseoAgentId,provider:'codex',modelRequested:'gpt-6.1-sol',effortRequested:'ultra',runtimeOwnerMatchedState:true,a0NativeId:owner.a0.nativeId,parallelMainLimit:6,customAgents:'SERIAL_INSTALLED_ROLES_PARENT_WAITS_NO_RECURSION',hardwareSlot:'NOT_GRANTED',unloadedWindow:'NOT_GRANTED'},
  inputs:manifest.sourceInputs.map(({id,receiptSha256,bindingManifestSha256,fullVerifiedFiles,indexSha256,dirtyStatusSha256})=>({id,receiptSha256,bindingManifestSha256,fullVerifiedFiles,indexSha256,dirtyStatusSha256})),copiedMembers:302,originalProvenance:{ANALYTICAL:8,RD_SYNTHETIC:1,PRODUCT_EXPORT:0},
  verification:{commands:'../../.devtoolbox/specs/changes/rt-03-06-2026-10-09/tests/code-commands.json',serialExitCodes:[0,0,0,0,0],focusedGroups:26,unchangedOriginalRays:1000,independentCpuOracleComparisons:2000,backendCpuComparisons:3000,supplementalReplayEvents:125,supplementalOracleComparisons:375,syntheticEdits:100,syntheticRestores:20,realHttpTamper:'PASS_412_AFTER_STARTUP',apiDoubles:'CPU_CONTRACT_ONLY_NOT_GPU_PROOF',gpuDistanceTolerance:1e-5,originalCpuDistanceTolerance:1e-9},
  historical:{native:'4/6',helper:'10/12',RAY02:'FAIL_UNCHANGED',RAY03:'FAIL_UNCHANGED',GFX03visual:'FAIL_3/3_UNCHANGED',GFX03backend:'FAIL_3/3_UNCHANGED',goldenPixelThreshold:.002,fractions:[.042145,.038676,.028381],requalified:false},
  review:{codeReviewer:'/root/rt03_code_review',fiveInitialFindings:'FIXED_WITH_TARGETED_NEGATIVES',followup:'FOUR_READONLY_CONFIRMED_LAST_NODE_GUARDS_FIXED_AND_FINAL_SERIAL_TESTED',humanApproval:false,finalVerificationReviewer:'SEPARATE_READONLY_REVIEW_AFTER_FREEZE_NO_ACCEPTANCE_CLAIM'},
  limitations:['Actual GPU compile/MRT/device-loss/adapter/visual/cost not run; no hardware winner or reference result','CPU G-buffer replay is an explicit contract double, not real raster or HVP gameplay','Opaque non-emissive two-light64x64 diagnostic MRT slice; genuine A0 G-buffer/M2 needed for full product quality','Typed CPU buffer counts exclude JS heap; only actual optional compose timestamps may later measure that pass','Physical index byte hash before first status was not captured; initial clean/base identity and complete current index/source are bound','Early history-worker raw failed traces unavailable; reported truthfully. Preliminary CPU copy/test overlap superseded by final serial gate'],reproProfile:'repro-profile.json'};
 await writeFile(path.join(spike,'binding-manifest.json'),mb);await writeFile(path.join(spike,'dirty-tree.json'),db);await writeFile(path.join(spike,'receipt.json'),encoded(receipt));
 const bound=[];for(const name of controls.slice(0,3))bound.push(await record(path.join(spike,name),name));
 await writeFile(path.join(spike,'seal.json'),encoded({schema:'hestia.rt0306.seal.v1',controls:bound,policy:'Exact three control bytes; only this outer seal has no self hash. Report its actual SHA externally.'}));await verify();
}
async function verify(){
 const sealBytes=await readFile(path.join(spike,'seal.json')),seal=JSON.parse(sealBytes);
 for(const r of seal.controls)assert.deepEqual(await record(path.join(spike,r.path),r.path),r,'Control bytes');
 const {manifest,dirtyTree}=await collect(),mb=await readFile(path.join(spike,'binding-manifest.json')),db=await readFile(path.join(spike,'dirty-tree.json'));
 assert.equal(sha(encoded(manifest)),sha(mb),'Complete current payload/index/source/tool membership drift');assert.equal(sha(encoded(dirtyTree)),sha(db),'Dirty tree drift');
 const receipt=JSON.parse(await readFile(path.join(spike,'receipt.json')));assert.equal(receipt.source.bindingManifestSha256,sha(mb));assert.equal(receipt.source.dirtyTreeSha256,sha(db));assert.equal(receipt.status.productIntegration,'NO');
 console.log(JSON.stringify({status:'PASS',scope:'COMPLETE_BYTE_BINDING_ONLY',files:manifest.files.length,dirtyPaths:dirtyTree.dirtyPaths.length,sourceCopyMembers:manifest.sourceCopyMembers,shaderFiles:manifest.shaders.length,wasmFiles:manifest.wasm.length,bindingManifestSha256:sha(mb),dirtyTreeSha256:sha(db),receiptSha256:sha(await readFile(path.join(spike,'receipt.json'))),sealSha256:sha(sealBytes),hardware:'NOT_RUN',productIntegration:'NO'}));
}
if(process.argv[2]==='create')await freeze();else if(process.argv[2]==='verify')await verify();else throw new Error('Use create or verify');
