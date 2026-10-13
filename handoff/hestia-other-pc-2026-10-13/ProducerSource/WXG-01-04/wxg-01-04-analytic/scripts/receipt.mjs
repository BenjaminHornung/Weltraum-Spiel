import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {root,repo,baseline,branch,hash,json,save,bytes,walk,verifyFiles,verifyConsumer,verifyBuild,verifyIsolation,captureInputs} from './bindings.mjs';
export function verifyRun(summary,base=root,runDir=null){
  if(summary.status!=='PASS'||summary.failed!==0||summary.skipped!==0||summary.passed!==94||summary.checks?.map(c=>c.label).join('|')!=='use-time-binding|build|fixture-bytecheck|independent-oracle|focused-tests'||summary.checks.some(c=>c.exitCode!==0))throw Error('RUN_NOT_COMPLETE_PASS');
  const required=captureInputs(base).map(f=>f.path);
  if(JSON.stringify(summary.testedInputs.map(f=>f.path).sort())!==JSON.stringify(required))throw Error('TESTED_MEMBERSHIP');
  verifyFiles(base,summary.testedInputs);verifyFiles(base,summary.compiledInputs);
  if(JSON.stringify(walk(base,'dist'))!==JSON.stringify(summary.compiledInputs.map(f=>f.path)))throw Error('RUN_COMPILED_MEMBERSHIP');
  if(runDir)for(const c of summary.checks){verifyFiles(runDir,[c.stdout,c.stderr]);}
  return summary;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scripts/receipt.mjs')){
  verifyIsolation();const consumer=verifyConsumer(),build=verifyBuild();
  const id=process.argv[process.argv.indexOf('--run-id')+1];if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id??''))throw Error('RUN_ID');
  const run=resolve(repo,'.devtoolbox/specs/changes/wxg-01-04-2026-10-09/tests/runs',id),summary=verifyRun(json(resolve(run,'summary.json')),root,run);
  const docs=['README.md','REPORT.md','HANDOFF.md','runner-profile.json'];for(const p of docs)if(!existsSync(resolve(root,p)))throw Error('HANDOFF_MISSING:'+p);
  const files=[...['src','tests','scripts','fixtures'].flatMap(p=>walk(root,p)),...docs,'ConsumerBindings.json','package.json','package-lock.json','tsconfig.json'].sort().map(p=>bytes(root,p));
  const payload={schema:'wxg.finite-spike-receipt/v1',baseline,branch,implementation:'COMPLETE',codeOracle:'PASS',executionLocation:'LOCAL_WINDOWS_ISOLATED',boundStatus:'BOUND_LOCAL_ONLY',recommendation:'CANDIDATE',productIntegration:'NO',fixtureAdoption:'SYNTHETIC_AUTHORING_ONLY',
    source:{consumerManifest:bytes(root,'ConsumerBindings.json'),upstream:consumer.anchors,celModel:consumer.modelImplementation,closedFiles:consumer.files.length,sourceBindings:bytes(root,'SourceBindings.json')},
    modelImplementation:build.model,compiledFiles:build.compiled.files,compiler:{pin:'typescript@7.0.2',installedFileCount:533,lock:bytes(root,'package-lock.json'),closure:'ConsumerBindings.json dependencyBindings + exact own node_modules copies'},
    files,testedInputs:summary.testedInputs,compiledInputs:summary.compiledInputs,tests:{passed:94,failed:0,skipped:0,upstreamHistorical:72,upstreamFreshCore:65,ownFresh:29,summary:bytes(run,'summary.json'),summaryRepoPath:'.devtoolbox/specs/changes/wxg-01-04-2026-10-09/tests/runs/'+id+'/summary.json',checks:summary.checks},
    tools:consumer.dependencyBindings.tools.map(t=>({...t,executablePath:t.name==='typescript-js'?resolve(root,'node_modules/typescript/bin/tsc'):t.name==='typescript-native'?resolve(root,'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe'):t.executablePath})),
    wasm:'NOT_APPLICABLE_OWN_WEATHER_KERNEL; PLT scalar/SIMD upstream trivial byte/load only',shader:'NOT_APPLICABLE',browser:'NOT_APPLICABLE_HEADLESS_CPU_CARD',rust:'NOT_USED',
    productTypecheck:'FAIL_MODULE_NOT_FOUND_RETAINED',productStatus:'NOT_RUN_NO_INTEGRATION',referenceHardware:'NOT_RUN_NO_SLOT',crossDeviceArm:'NOT_RUN',actualAdapter:'NOT_APPLICABLE_CPU_ONLY',gpuTimer:'NOT_REQUESTED',headerSabDeployment:'NOT_RUN',hostLoad:'Concurrent uncontrolled local sessions; timings FUNCTIONAL_DIAGNOSTIC_ONLY',
    independentReview:json(resolve(root,'review.json')),publication:{humanPlannotator:'NOT_REQUESTED_EXACT_DIFF_DELIVERED',commit:'NOT_PERFORMED',push:'NOT_PERFORMED',merge:'NOT_PERFORMED',publish:'NOT_PERFORMED'},
    dirtyTreeBinding:{status:'DETACHED_FULL_SCOPE_SEAL',path:'.runtime/final-seal/scope-seal.json',patch:'.runtime/final-seal/review.patch',definition:'Full tracked/staged/unstaged/nonignored-untracked scope including receipt/docs/evidence and semantic whole Git index; separate own consumer/compiler/build/test bindings. No self-reference.'}};
  save(resolve(root,'receipt.json'),payload);console.log(JSON.stringify({status:'PASS',receipt:bytes(root,'receipt.json'),passed:94,compiledFiles:build.compiled.files.length}));
}
