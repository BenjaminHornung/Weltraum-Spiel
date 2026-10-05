import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,existsSync,readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { LAB,RUN,PHASE,START,TREE,bytes,bound,json,sha,safe,files,fresh } from './support.mjs';
const target=LAB+'/'+PHASE;
const report=json(RUN+'/native-results.json');assert.equal(JSON.stringify(report).includes('ws://127.0.0.1:'),false,'No private browser transport in published evidence');
assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped],[2,8,0]);
const cases=files(RUN+'/cases').map((r)=>({...r,value:json(RUN+'/cases/'+r.path)}));assert.equal(cases.length,10);
const original=cases.filter((r)=>!r.value.title.startsWith('supplement v1:'));assert.equal(original.length,6);assert(original.every((r)=>r.value.status==='failed'));
const native=json(RUN+'/native-job-receipt.json');assert.equal(native.exitCode,1);assert.equal(native.timedOut,false);assert.equal(bound(native.raw.path).sha256,native.raw.sha256);
const cleanup=json(RUN+'/cleanup-complete.json');assert.equal(cleanup.servicesRetained,false);for(const r of [cleanup.native,cleanup.preview,cleanup.port]){assert.equal(bound(r.path).sha256,r.sha256);}
const cpu=json(RUN+'/cpu39-results.json');assert.deepEqual([cpu.numTotalTests,cpu.numPassedTests,cpu.numFailedTests],[39,39,0]);
const matrix=json(RUN+'/flows/matrix-v1.json');assert.equal(matrix.results.length,12);const r1=json(RUN+'/flows/r1-terminal-v1.json');assert.equal(r1.status,'EXECUTED_REAL_ADOPTED_R1');
const numeric=json(RUN+'/numeric/visible-v1.json');assert.equal(numeric.result.status,'FAIL');assert.equal(numeric.result.rows.length,0);assert.match(numeric.result.reason,/'sample' : Illegal use of reserved word/);
const rootFiles=readdirSync(RUN).filter((p)=>p.endsWith('.json')||p==='native.raw.log'||p==='command.mjs');
const raw=[...rootFiles.map((path)=>({...bound(RUN+'/'+path),path})),...['cases','captures','flows','diagnosis','numeric','commands','helper-history'].flatMap((p)=>files(RUN+'/'+p).map((r)=>({...r,path:p+'/'+r.path})))].sort((a,b)=>a.path.localeCompare(b.path));
function local(path,value){const full=target+'/'+path;safe(full,target);assert(!existsSync(full),'Write-once '+full);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});return {...bound(full,target),path};}
for(const r of raw){const b=bytes(RUN+'/'+r.path,RUN);assert.equal(sha(b),r.sha256,r.path);local('evidence/'+r.path,b);}
const entries=files(RUN+'/captures').filter((r)=>r.path.endsWith('.json')).map((r)=>{const c=json(RUN+'/captures/'+r.path);assert.equal(c.source,START);assert.equal(c.stableSourceFrame,true,c.name);
 const request=matrix.results.find((v)=>v.name===c.name);const frame=c.before.projected?.private?.host?.frame;const rendered=c.before.projected?.private?.host?.rendered;
 return {id:c.name,facts:'evidence/captures/'+r.path,requestedTick:request?.tick??null,actualSelectedTick:c.before.selections.tick,actualRenderedTick:rendered?.tick??null,
  status:c.before.status,actualSubmission:/Host render submitted/.test(c.before.status??''),testBridgePresent:c.before.bridgePresent,fixture:c.before.selections.fixture,variant:c.before.selections.variant,
  cameraId:c.before.selections.camera,frame:frame??null,fixtureDigest:c.before.projected?.facts?.fixtureDigest??null,sourceRevision:c.before.projected?.facts?.sourceRevision??null,
  source:c.before.projected?.private?.source??null,quality:c.before.projected?.facts?.unsupportedFeatures??null,firstTerminal:c.before.projected?.terminal??c.before.projected?.private?.terminal??null,
  stableSourceFrame:c.stableSourceFrame,browserDpr:c.before.canvas?.devicePixelRatio,rendererDpr:Number(c.before.selections.dpr),drawingBuffer:{width:c.before.canvas?.width,height:c.before.canvas?.height},
  fractionalElementBox:c.fractionalElementBox,ui:{...c.ui,path:'evidence/captures/'+c.ui.path},canvas:c.canvas?{...c.canvas,path:'evidence/captures/'+c.canvas.path}:null,
  imageAuthority:c.imageAuthority};});
assert.equal(entries.length,15);assert(entries.every((r)=>!r.testBridgePresent));assert.equal(entries.filter((r)=>r.actualSubmission).length,7);
local('index.json',{schema:'rd13-local-functional-slice-index-v1',status:'FAIL_NATIVE_RAY_SHADER_COMPILE',sourceExecuted:START,sourceTree:TREE,runId:'phase2-16a5d29a-20261004-a',
 productIntegrated:false,entries,contactSheet:'contact-sheet.png',contactSheetAuthority:'Derived visualization of this index only, not an additional capture/readback',
 nativeGpuMs:'UNKNOWN',nativeVram:'UNKNOWN',qualifiedGpuPerformance:'NOT_GRANTED',missingReferences:{unseenReddit:7,missingConceptImages:6,lfsPointerOnlyImages:5}});
const networks=cases.flatMap((r)=>r.value.network);const observedErrors=cases.flatMap((r)=>r.value.errors);const transports=networks.filter((r)=>r.failure||r.bodyError);
const observedShaders=cases.flatMap((r)=>(r.value.afterCleanup?.shaders??[]).map((s)=>({...s,case:r.path,sha256:sha(Buffer.from(s.code))})));
const kernel=json(RUN+'/preflight.json').kernel;assert.equal(sha(Buffer.from(kernel)),numeric.kernelSha256);assert(observedShaders.some((s)=>s.code.includes(kernel)));
local('summary.json',{schema:'rd13-functional-native-diagnostic-summary-v1',status:'FAIL_NATIVE_RAY_SHADER_COMPILE',sourceExecuted:START,sourceTree:TREE,runId:'phase2-16a5d29a-20261004-a',productIntegrated:false,
 original:{bodies:6,passed:0,failed:6,skipped:0,assertionBoundary:'Unchanged initial ready gate; later semantic assertions not reached',cases:original.map((r)=>({path:'evidence/cases/'+r.path,title:r.value.title,status:r.value.status}))},
 supplements:{passed:2,failed:2,notNativeAcceptance:true},ordinaryMatrix:{rows:12,greedySubmitted:matrix.results.filter((r)=>r.variant==='greedy-no-ao'&&r.actualSubmission).length,
   raysSubmitted:matrix.results.filter((r)=>r.variant==='rays-no-ao'&&r.actualSubmission).length,controls:matrix.controls.map((r)=>({command:r.command,status:r.state.status,selections:r.state.selections}))},
 numeric:{status:numeric.result.status,reason:numeric.result.reason,kernelSha256:numeric.kernelSha256,shaderSha256:numeric.shaderSha256,vertexSha256:numeric.vertexSha256,depthShaderSha256:numeric.depthShaderSha256,
   readbacks:0,allocations:numeric.result.allocations,firstTerminal:numeric.result.firstTerminal,cleanup:numeric.result.cleanup,device:numeric.result.device,caps:numeric.result.caps,formatQueries:numeric.result.formatQueries,
   targetFbo:numeric.result.targetFbo,shaderLogs:numeric.result.shaderLogs,depthAndInducedFaultQualification:'NOT RUN after shader compile failure; FAIL outputs are not fault-sensitivity proof'},
 r1Terminal:{status:r1.status,failure:r1.failure,digestBeforeFault:r1.current.projected.facts.fixtureDigest,digestAtTerminal:r1.terminal.facts.fixtureDigest,hidden:r1.terminal.hidden,terminal:r1.terminal.diagnostics.terminal},
 network:{observations:networks.length,offsiteOrVendorTranslatorRequests:networks.filter((r)=>!r.url.startsWith('http://127.0.0.1:5280/')).length,
   blockedOffsiteAttempts:observedErrors.filter((r)=>r.startsWith('BLOCKED_OFFSITE')).length,transportCaptureFailures:transports,coverageAuthority:'All 517 exact response bodies separately captured before and after native run; aborted remount requests remain raw failures'},
 ownership:cases.map((r)=>({path:'evidence/cases/'+r.path,title:r.value.title,before:r.value.beforeCleanup&&{created:r.value.beforeCleanup.created,deleted:r.value.beforeCleanup.deleted,raf:r.value.beforeCleanup.raf},
   after:r.value.afterCleanup&&{created:r.value.afterCleanup.created,deleted:r.value.afterCleanup.deleted,raf:r.value.afterCleanup.raf,listeners:r.value.afterCleanup.listeners},
   claim:'Logical counters/canvas listeners and context/browser teardown only; eager deletion of every renderer allocation and native VRAM are not established'})),
 shaderBindings:observedShaders.map(({case:casePath,context,shader,sha256,code})=>({case:'evidence/cases/'+casePath,context,shader,sha256,containsExactKernel:code.includes(kernel)})),
 verification:{cpu39:'PASS',focusedTypes:'PASS',rootTypes:'PASS',launcherCheck:'PASS',boundary52:'Recorded separately in fresh precommit/postcommit audit',build:'Existing HEAD build only; no rebuild'},
 cleanup,commandTimingAuthority:'Recorded wall/CPU command durations and unchanged diagnostic facts are not GPU benchmark evidence',nativeGpuMs:'UNKNOWN',nativeVram:'UNKNOWN',qualifiedGpuPerformance:'NOT_GRANTED'});
local('manifest.json',{schema:'rd13-raw-evidence-copy-manifest-v1',sourceExecuted:START,sourceTree:TREE,productIntegrated:false,externalRoot:RUN,
 rawArtifacts:raw.map((r)=>({path:'evidence/'+r.path,externalPath:RUN+'/'+r.path,bytes:r.bytes,sha256:r.sha256})),
 externalTraceArtifacts:files(RUN+'/pw-output').map((r)=>({...r,path:RUN+'/pw-output/'+r.path})),
 externalTraceReason:'Original screenshots/errors/Playwright ZIP traces retained byte-identically in write-once run sink; no archive rewrite or transport metadata republishing',
 immutableSourceAuthority:'evidence/preflight.json',servedBefore:'evidence/served-before-native.json',servedAfter:'evidence/served-after-native.json',
 actualNativeSourceSeal:'evidence/native-job-source-seal.json',receiptScope:'Copies reflect completed operations at package time; fresh package audits and actual commit identity are separately bound external receipts'});
const markdown=['# RD13 functional diagnostic slice — native ray FAIL','',`Executed source: \`${START}\` / tree \`${TREE}\`; \`productIntegrated=false\`.`,
 '',"Frozen kernel rejects GLSL `sample`: 6/6 original gates FAIL at unchanged ready gate; 2 native numeric supplements FAIL before readback. Separate ordinary greedy flow and R1 terminal-facts collections PASS, not native-ray acceptance.",
 '', '[Raw-copy manifest](manifest.json) · [Typed summary](summary.json) · [Slice index](index.json) · [Derived contact sheet](contact-sheet.png) · [Original native report](evidence/native-results.json)',
 '', 'Raw PNGs are Chromium compositor captures, not native MRT/depth-buffer proof. Fractional native element bounds and actual PNG/buffer dimensions are recorded. Filenames use **requested** ticks; labels below distinguish actual selected/rendered ticks. Stable manual-clock frames are not an invented pause or ready state.',
 '', 'F01 is the frozen selected 64³ terrain window plus original water; vegetation and face AO omitted. No full scene/water image/art parity. Missing references: 7 unseen Reddit, 6 missing concept images, 5 LFS-pointer-only images. GPU timing and native VRAM UNKNOWN.', ''];
for(const r of entries){markdown.push(`## ${r.id}`,`${r.variant} · ${r.fixture} · camera ${r.cameraId} · requested tick ${r.requestedTick??'n/a'}; actual selected ${r.actualSelectedTick}, rendered ${r.actualRenderedTick??'not submitted'} · renderer DPR ${r.rendererDpr}, browser DPR ${r.browserDpr}.`,
 `Status: ${r.status}`,`[Before/after facts](${r.facts}) · [Raw UI PNG](${r.ui.path}) (${r.ui.width}×${r.ui.height})${r.canvas?` · [Raw canvas PNG](${r.canvas.path}) (${r.canvas.width}×${r.canvas.height}; buffer ${r.drawingBuffer.width}×${r.drawingBuffer.height})`:' · canvas hidden; no canvas pixels captured'}`,
 `![${r.id}: compositor only](${r.ui.path})`,'');}
local('INDEX.md',markdown.join('\n')+'\n');
fresh(RUN+'/package-receipt.json',{source:START,tree:TREE,packageHelper:bound(target+'/package-evidence.mjs'),rawArtifacts:raw.length,images:entries.reduce((n,r)=>n+1+Number(Boolean(r.canvas)),0),
 index:bound(target+'/index.json'),manifest:bound(target+'/manifest.json'),summary:bound(target+'/summary.json'),nativeRunRepeated:false,servicesStarted:false,productIntegrated:false});
console.log('RD13_PACKAGE_CREATED raw='+raw.length+' captures='+entries.length+' original=6FAIL supplements=2FAIL/2PASS; no native repeat');
