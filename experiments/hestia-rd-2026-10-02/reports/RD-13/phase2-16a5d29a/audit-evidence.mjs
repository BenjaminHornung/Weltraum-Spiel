import assert from 'node:assert/strict';
import { existsSync,readdirSync,mkdirSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inspectBoundary } from '../../../scripts/verify-boundary.mjs';
import { ROOT,LAB,RUN,PHASE,START,TREE,GIT,URL_ROOT,bytes,bound,json,sha,files,fresh,safe,git,immutable,environment } from './support.mjs';

const target=LAB+'/'+PHASE;
export function checkBytes(record,data,label=record.path) {assert.equal(data.length,record.bytes,label);assert.equal(sha(data),record.sha256,label);}
function checkArtifact(record,path=record.path) {checkBytes(record,bytes(path),path);}
export function checkPng(record,data) {checkBytes(record,data);assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(data.subarray(12,16).toString(),'IHDR');assert.equal(data.readUInt32BE(16),record.width);assert.equal(data.readUInt32BE(20),record.height);}
export function checkCompilerFailure(result,kernel) {
 assert.equal(result.status,'FAIL');assert.equal(result.rows.length,0);assert(result.fragment.includes(kernel),'Exact frozen kernel in numeric shader');
 assert.match(result.reason,/'sample' : Illegal use of reserved word/);assert.equal(result.firstTerminal.reason,result.reason);assert.equal(result.firstTerminal.allocations,result.allocations);
 assert.equal(result.allocations,10);assert.deepEqual(result.cleanup,{textures:6,programs:1,shaders:2,framebuffers:1,vaos:0,logicalOnly:true});
 assert.equal(result.targetFbo,36053);assert(result.shaderLogs.some((r)=>r.type===35632&&r.status===false&&r.log.includes("'sample' : Illegal use of reserved word")));
}
function staticFrame(s) {return JSON.stringify({selections:s.selections,facts:s.projected?.facts&&{fixtureDigest:s.projected.facts.fixtureDigest,sourceRevision:s.projected.facts.sourceRevision},
 source:s.projected?.private?.source,frame:s.projected?.private?.host?.frame,rendered:s.projected?.private?.host?.rendered,hidden:s.canvas?.hidden,width:s.canvas?.width,height:s.canvas?.height});}
function scope() {
 const list=(...args)=>execFileSync(GIT,args,{cwd:ROOT,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024}).split('\0').filter(Boolean);
 const baseline=new Set(list('ls-tree','-r','--name-only','-z',START));
 const staged=list('diff','--cached','--name-only','-z');const committed=list('diff','--name-only','-z',START,'HEAD');
 assert.equal(git('diff','--name-only'),'','No unstaged tracked edits');
 const untracked=list('ls-files','--others','--exclude-standard','-z');const automatic=['.opencode/throughput.jsonl','.opencode/throughput.md'];
 const prefix='experiments/hestia-rd-2026-10-02/';
 const own=(p)=>p.startsWith(prefix+PHASE+'/')||p.startsWith(prefix+'tests/RD-13/phase2-');
 const added=[...new Set([...staged,...committed,...untracked.filter((p)=>!automatic.includes(p))])].sort();
 for(const p of added){assert(own(p),'Outside new evidence slice: '+p);assert(!baseline.has(p),'Frozen existing file: '+p);}
 return {added,staged,committed,untracked:untracked.filter((p)=>!automatic.includes(p)),automaticUntracked:untracked.filter((p)=>automatic.includes(p))};
}
function validate() {
 const original=json(RUN+'/preflight.json');const current=immutable(process.argv[2]==='postcommit');
 for(const key of ['sourceFiles','sharedPins','publicFiles','buildFiles','packages','api','executables','sourceLfs','sourceTextFilters']){assert.deepEqual(current[key],original[key],key+' unchanged');}
 assert.equal(current.kernelSha256,original.kernelSha256);
 const admission=json(RUN+'/admission.json');checkArtifact(admission.preflight);checkArtifact(admission.freeze);checkArtifact(admission.lease);checkArtifact(admission.buildProof);checkArtifact(admission.executable);
 const sourceSeal=json(RUN+'/native-job-source-seal.json');assert.equal(sourceSeal.source,START);assert.equal(sourceSeal.tree,TREE);assert.equal(sourceSeal.kernelSha256,current.kernelSha256);
 for(const r of [sourceSeal.admission,sourceSeal.originalSpec,sourceSeal.originalCases,sourceSeal.config]){checkArtifact(r);}
 const nativeSeal=json(RUN+'/helper-history/native-v1/seal.json');assert.deepEqual(nativeSeal.pins,sourceSeal.newHarnessFiles);assert.equal(nativeSeal.pins.length,15);
 for(const r of nativeSeal.pins){checkArtifact(r,RUN+'/helper-history/native-v1/'+r.path);if(!r.path.endsWith('/PLAN.md')){checkArtifact(r,LAB+'/'+r.path);}}
 for(const name of ['served-before-native','served-after-native']){const served=json(RUN+'/'+name+'.json');assert.equal(served.start,START);assert.equal(served.tree,TREE);assert.equal(served.responses.length,517);
  for(const r of current.buildFiles){const actual=served.responses.find((s)=>s.path===r.path);assert(actual,r.path);assert.equal(actual.status,200);assert.equal(actual.bytes,r.bytes);assert.equal(actual.sha256,r.sha256);}}
 const manifest=json(target+'/manifest.json');assert.equal(manifest.rawArtifacts.length,162);
 for(const r of manifest.rawArtifacts){checkArtifact(r,target+'/'+r.path);checkArtifact(r,r.externalPath);}
 for(const r of manifest.externalTraceArtifacts){checkArtifact(r);}
 const report=json(RUN+'/native-results.json');assert(!JSON.stringify(report).includes('ws://127.0.0.1:'));assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[2,8,0,0]);
 const cases=files(RUN+'/cases').map((r)=>({...r,data:json(RUN+'/cases/'+r.path)}));assert.equal(cases.length,10);
 const originalCases=cases.filter((r)=>!r.data.title.startsWith('supplement v1:'));assert.equal(originalCases.length,6);assert(originalCases.every((r)=>r.data.status==='failed'));
 const bodyByPath=new Map(current.buildFiles.map((r)=>[r.path,r]));const network=[];const kernels=[];let totalQueries=0;let nonzeroDriverErrors=0;let readbacks=0;
 for(const c of cases){assert.equal(c.data.originalSpecSha256,sourceSeal.originalSpec.sha256);assert.equal(c.data.errors.length,0);assert.equal(c.data.afterCleanup.raf.active,0);
  for(const r of c.data.network){const u=new URL(r.url);assert.equal(u.origin,URL_ROOT,r.url);const p=decodeURIComponent(u.pathname).slice(1)||'index.html';const expected=bodyByPath.get(p);assert(expected,'Unserved request: '+p);
   if(r.sha256){assert.equal(r.status,200,p);assert.equal(r.bytes,expected.bytes,p);assert.equal(r.sha256,expected.sha256,p);}network.push({...r,case:c.path});}
  for(const context of c.data.afterCleanup.contexts){assert.equal(context.actualWebGL2,true);assert.equal(context.request,'webgl2');assert(!/SwiftShader|llvmpipe|softpipe|software|Microsoft Basic|OSMesa/i.test(context.renderer));}
  for(const s of c.data.afterCleanup.shaders){if(s.code.includes(current.kernel)){kernels.push({case:c.path,context:s.context,shader:s.shader,sha256:sha(Buffer.from(s.code))});}}
  totalQueries+=c.data.afterCleanup.queries.length;nonzeroDriverErrors+=c.data.afterCleanup.queries.filter((r)=>r.name==='getError'&&r.value!==0).length;readbacks+=c.data.afterCleanup.readbacks.length;
 }
 assert(kernels.length>0);assert(nonzeroDriverErrors>0,'Actual owning driver failure retained');
 const numeric=json(RUN+'/numeric/visible-v1.json');assert.equal(numeric.kernelSha256,current.kernelSha256);checkCompilerFailure(numeric.result,current.kernel);
 assert.equal(sha(Buffer.from(numeric.result.fragment)),numeric.shaderSha256);assert.equal(sha(Buffer.from(numeric.result.vertex)),numeric.vertexSha256);assert.equal(sha(Buffer.from(numeric.result.depthShader)),numeric.depthShaderSha256);
 assert(kernels.some((r)=>r.sha256===numeric.shaderSha256),'Actual native observer saw exact numeric shader');assert(kernels.some((r)=>r.sha256==='4abe5b154bde3712f4ed8d176f0b92b27d3e8f993acc7f21a2edaa40ebb792fb'),'Exact original geometric probe shader observed');
 assert.deepEqual(numeric.originalIndependentGeometricOracle.point,[1,.5,.5]);assert.deepEqual(numeric.originalIndependentGeometricOracle.normal,[1,0,0]);assert.equal(numeric.originalIndependentGeometricOracle.t,.5);
 const index=json(target+'/index.json');assert.equal(index.entries.length,15);assert.equal(index.sourceExecuted,START);assert.equal(index.sourceTree,TREE);assert.equal(index.status,'FAIL_NATIVE_RAY_SHADER_COMPILE');let images=0;
 for(const r of index.entries){const c=json(target+'/'+r.facts);assert.equal(c.source,START);assert.equal(c.stableSourceFrame,true);assert.equal(staticFrame(c.before),staticFrame(c.after),r.id);assert.equal(c.before.status,c.after.status);
  assert.equal(c.before.bridgePresent,false);assert.equal(c.after.bridgePresent,false);assert.equal(r.actualSelectedTick,c.before.selections.tick);assert.equal(r.actualSubmission,/Host render submitted/.test(c.before.status));
  checkPng(r.ui,bytes(target+'/'+r.ui.path));images+=1;if(r.canvas){assert.equal(c.before.canvas.hidden,false);assert.equal(r.canvas.width,c.canvas.width);assert.equal(r.canvas.height,c.canvas.height);assert.deepEqual(r.fractionalElementBox,c.fractionalElementBox);checkPng(r.canvas,bytes(target+'/'+r.canvas.path));images+=1;}
 }
 assert.equal(images,22);assert.equal(index.entries.filter((r)=>r.actualSubmission).length,7);assert(index.entries.find((r)=>r.id==='explicit-dispose').status.startsWith('Disposed;'));
 const contact=json(target+'/'+index.contactSheetProof);assert.equal(contact.indexSha256,bound(target+'/index.json').sha256);assert.equal(contact.helperSha256,bound(target+'/contact-sheet.py').sha256);
 assert.equal(contact.inputs.length,15);assert.equal(contact.rawInputsUnchanged,true);checkPng(contact.output,bytes(target+'/'+contact.output.path));
 for(const r of contact.inputs){checkPng(r,bytes(target+'/'+r.path));assert(index.entries.some((c)=>c.ui.path===r.path&&c.ui.sha256===r.sha256));}
 assert.equal(bound(contact.pythonExecutable.path).sha256,contact.pythonExecutable.sha256);
 const pillow=json(RUN+'/contact-helper-staging.json');assert.equal(pillow.pins.length,114);for(const r of pillow.pins){checkArtifact(r,pillow.target+'/'+r.path);}
 const cpu=json(RUN+'/cpu39-results.json');assert.deepEqual([cpu.numTotalTests,cpu.numPassedTests,cpu.numFailedTests,cpu.numPendingTests],[39,39,0,0]);
 const commands=files(RUN+'/commands').filter((r)=>r.path.endsWith('.json')).map((r)=>({path:r.path,data:json(RUN+'/commands/'+r.path)}));
 for(const r of commands){const p=RUN+'/commands/'+r.path.slice(0,-5);assert.equal(bound(p+'.stdout').sha256,r.data.stdoutSha256);assert.equal(bound(p+'.stderr').sha256,r.data.stderrSha256);assert.equal(r.data.helperSha256,bound(RUN+'/command.mjs').sha256);}
 for(const name of ['fresh-cpu39','fresh-focused-types','fresh-root-types','native-launcher-focused-check','derived-contact-sheet-caption-v3']){const r=commands.find((c)=>c.data.label===name);assert(r,name);assert.equal(r.data.exit,0,name);assert.equal(r.data.timedOut,false,name);}
 const r1=json(RUN+'/flows/r1-terminal-v1.json');assert.equal(r1.status,'EXECUTED_REAL_ADOPTED_R1');assert.equal(r1.current.projected.facts.fixtureDigest,r1.terminal.facts.fixtureDigest);assert.equal(r1.terminal.hidden,true);assert.equal(r1.terminal.diagnostics.terminal.disposed,true);
 const job=json(RUN+'/native-job-receipt.json');assert.equal(job.exitCode,1);assert.equal(job.timedOut,false);checkArtifact(job.raw);
 const cleanup=json(RUN+'/cleanup-complete.json');assert.equal(cleanup.servicesRetained,false);assert.equal(cleanup.noForeignCleanup,true);for(const r of [cleanup.native,cleanup.preview,cleanup.port]){checkArtifact(r);}
 const nativeCleanup=json(cleanup.native.path);assert.equal(nativeCleanup.busy,false);assert.equal(nativeCleanup.cooperative,true);assert.equal(nativeCleanup.browserExit.exitCode,0);assert.equal(nativeCleanup.browserExit.signal,null);
 assert.equal(json(cleanup.preview.path).closed,true);assert.equal(json(cleanup.port.path).status,'FREE_EXCLUSIVE_BIND_RELEASED');
 const boundary=inspectBoundary({repoRoot:ROOT,start:START,task:'RD-13'});assert.equal(boundary.ok,true);assert.equal(boundary.inputHashesVerified,52);assert.equal(boundary.links.length,0);assert.equal(boundary.violations.length,0);
 return {schema:'rd13-evidence-audit-v1',status:'PASS_EVIDENCE_BINDINGS_NATIVE_FUNCTIONAL_FAIL',sourceExecuted:START,sourceTree:TREE,productIntegrated:false,
  immutable:current,admission:bound(RUN+'/admission.json'),nativeSourceSeal:bound(RUN+'/native-job-source-seal.json'),rawArtifacts:manifest.rawArtifacts.length,externalTraceArtifacts:manifest.externalTraceArtifacts.length,
  media:{rawPngs:images,staticCaptures:15,index:bound(target+'/index.json'),contact:bound(target+'/'+index.contactSheet),contactProof:bound(target+'/'+index.contactSheetProof),derivedCaptionReview:'PASS v3 disposal label visually checked; v2 retired and preserved'},
  native:{originalFailed:6,originalPassed:0,supplementFailed:2,supplementPassed:2,firstCompilerFailure:numeric.result.reason,numericReadbacks:0,totalObservedReadbackCalls:readbacks,depthAndFaultQualification:'NOT RUN after compile failure',
   shaderBindings:kernels,queries:totalQueries,nonzeroDriverErrors,gpuMs:'UNKNOWN',vram:'UNKNOWN',qualifiedGpuPerformance:'NOT_GRANTED'},
  network:{observations:network.length,hashedResponses:network.filter((r)=>r.sha256).length,offsite:0,transportOrBodyFailures:network.filter((r)=>r.failure||r.bodyError),all517BeforeAfter:'PASS exact immutable build bodies, no replay'},
  cpu:{passed:39,failed:0,focusedTypes:'PASS preserved fresh receipt',rootTypes:'PASS preserved fresh receipt',nativeLauncherCheck:'PASS preserved fresh receipt'},
  commands:commands.map((r)=>({path:r.path,label:r.data.label,exit:r.data.exit,stdoutSha256:r.data.stdoutSha256,stderrSha256:r.data.stderrSha256})),cleanup,boundary,scope:scope(),
  cOnlyHelperHistory:{status:'FAIL_PRIOR_CONTACT_HELPER_IMPORT_THEN_CORRECTED',prior:'Contact helper v1 imported user-site PIL outside C:/IFI_SourceCode before rejection; no PNG output from that attempt. Raw failure preserved.',
   current:'Existing Pillow 114 byte-identical files staged under C; later helpers run with isolated Python -I -B',staging:bound(RUN+'/contact-helper-staging.json')},
  review:'Own source/diff/evidence review only; independent HEAD acceptance pending',nativeRunRepeated:false,servicesStarted:false};
}
function completionCopies(final=false) {
 const earlier=final?json(target+'/completion-manifest.json').rawArtifacts:[];
 const previous=new Set([...json(target+'/manifest.json').rawArtifacts,...earlier].map((r)=>r.externalPath));
 const candidates=[...readdirSync(RUN).filter((p)=>p.endsWith('.json')).map((p)=>({...bound(RUN+'/'+p),path:p})),
  ...['commands','helper-history'].flatMap((p)=>files(RUN+'/'+p).map((r)=>({...r,path:p+'/'+r.path})))].filter((r)=>!previous.has(RUN+'/'+r.path));
 const copied=[];for(const r of candidates){const dest=target+'/evidence/completion/'+r.path;safe(dest,target);assert(!existsSync(dest),'Write-once '+dest);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,bytes(RUN+'/'+r.path),{flag:'wx'});copied.push({path:'evidence/completion/'+r.path,externalPath:RUN+'/'+r.path,bytes:r.bytes,sha256:r.sha256});}
 const output=target+(final?'/completion-manifest-final.json':'/completion-manifest.json');assert(!existsSync(output));writeFileSync(output,JSON.stringify({schema:'rd13-completion-evidence-copy-v1',sourceExecuted:START,productIntegrated:false,rawArtifacts:[...earlier,...copied],
  receiptScope:'Write-once appendix; current audit/commit/postcheck receipts remain external to avoid self-reference'},null,2)+'\n',{flag:'wx'});return [...earlier,...copied];
}
function committedBytes(expected) {
 const out=[];for(const r of expected){const p='experiments/hestia-rd-2026-10-02/'+r.path;const oid=git('rev-parse','HEAD:'+p);const blob=execFileSync(GIT,['cat-file','blob',oid],{cwd:ROOT,maxBuffer:32*1024*1024});const working=bytes(LAB+'/'+r.path);checkBytes(r,working,p);
  const pointer=blob.length<256?/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([0-9a-f]{64})\nsize (\d+)\n?$/.exec(blob.toString()):null;
  if(pointer){assert.equal(pointer[1],r.sha256,p);assert.equal(Number(pointer[2]),r.bytes,p);}
  else{checkBytes(r,blob,p+' exact committed non-LFS bytes');}
  out.push({path:r.path,gitBlob:oid,rawSha256:r.sha256,rawBytes:r.bytes,blobSha256:sha(blob),blobBytes:blob.length,lfsPointer:Boolean(pointer),gitTextFilter:!pointer&&sha(blob)!==r.sha256});}
 return out;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 Object.assign(process.env,environment());const mode=process.argv[2];assert(['precommit','precommit-final','postcommit'].includes(mode));const proof=validate();
 if(mode!=='postcommit'){const final=mode==='precommit-final';const appendix=completionCopies(final);const verification=target+(final?'/verification-final.json':'/verification.json');assert(!existsSync(verification));writeFileSync(verification,JSON.stringify({...proof,completionArtifacts:appendix.length},null,2)+'\n',{flag:'wx'});
  const newFiles=[...files(target).map((r)=>({...r,path:PHASE+'/'+r.path})),...files(LAB+'/tests/RD-13').filter((r)=>r.path.startsWith('phase2-')).map((r)=>({...r,path:'tests/RD-13/'+r.path}))].sort((a,b)=>a.path.localeCompare(b.path));
  fresh(RUN+(final?'/final-precommit-audit.json':'/precommit-audit.json'),{...proof,verification:bound(verification),completionManifest:bound(target+(final?'/completion-manifest-final.json':'/completion-manifest.json')),newFiles,
   priorPrecommitAudit:final?bound(RUN+'/precommit-audit.json'):null,committedRawByteContract:final?'Slice-only * -text; non-LFS blobs must equal raw bytes; inherited PNG LFS OID/size must match':'Initial audit retained before staged text-filter diagnosis'});
  console.log('RD13_PRECOMMIT_EVIDENCE_PASS original=6FAIL numeric=2FAIL CPU=39PASS source=1011 build=517 guard=52 rawPNG=22 noNativeRepeat');
 }else{const before=json(RUN+'/final-precommit-audit.json');checkArtifact(before.verification);checkArtifact(before.completionManifest);for(const r of json(target+'/completion-manifest-final.json').rawArtifacts){checkArtifact(r,target+'/'+r.path);checkArtifact(r,r.externalPath);}
  const delta=git('diff-tree','--no-commit-id','--name-status','-r','HEAD').split('\n').filter(Boolean);assert(delta.every((r)=>r.startsWith('A\t')));assert.equal(delta.length,before.newFiles.length);assert.deepEqual(delta.map((r)=>r.slice(2)).sort(),before.newFiles.map((r)=>'experiments/hestia-rd-2026-10-02/'+r.path).sort());
  assert.equal(proof.scope.staged.length,0);assert.equal(proof.scope.untracked.length,0);const committed=committedBytes(before.newFiles);
  fresh(RUN+'/postcommit-audit.json',{...proof,commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),soleParent:START,delta,committedBindings:committed,
   sourceExecutedVersusEvidenceCommit:'Native executed frozen 16a source and native-v1 harness; this child adds only evidence/new harness and no runtime change',precommitAudit:bound(RUN+'/final-precommit-audit.json'),verification:before.verification,
   stageAudit:bound(RUN+'/stage-audit.json'),retainedInitialPrecommitAudit:bound(RUN+'/precommit-audit.json')});
  console.log('RD13_POSTCOMMIT_EVIDENCE_PASS commit='+git('rev-parse','HEAD')+' directParent='+START+' additions='+delta.length+' newLFS='+committed.filter((r)=>r.lfsPointer).length+' noNativeRepeat');}
}
