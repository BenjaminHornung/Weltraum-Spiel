import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root,repo,baseline,hash,verifyLocal,verifyProducer } from './bind-inputs.mjs';
import { verifyRunBindings } from './run-bindings.mjs';
const evidence='.devtoolbox/specs/changes/cel-01-wxg-00-2026-10-09/tests';
const runPath=evidence+'/runs/local-functional-04';
const summaryBytes=readFileSync(resolve(repo,runPath,'summary.json'));
const summary=JSON.parse(summaryBytes);
const review=JSON.parse(readFileSync(resolve(repo,evidence,'review.json')));
if(summary.status!=='PASS'||summary.failed!==0||review.status!=='PASS')throw new Error('HANDOFF_NOT_READY');
verifyLocal();verifyProducer();
verifyRunBindings(summary);
for(const check of summary.checks)for(const stream of ['stdout','stderr']){
  const b=readFileSync(resolve(repo,runPath,check.label+'.'+stream+'.log'));
  if(b.length!==check[stream].bytes||hash(b)!==check[stream].sha256)throw new Error('TEST_LOG_DRIFT:'+check.label+':'+stream);
}
const binding=path=>{const b=readFileSync(resolve(root,path));return {path,bytes:b.length,sha256:hash(b)};};
const source=JSON.parse(readFileSync(resolve(root,'SourceBindings.json')));
const dependencies=JSON.parse(readFileSync(resolve(root,'DependencyBindings.json')));
const ownSource=['src/contracts.ts','src/types.ts','src/fixtures.ts','src/model-pin.ts'].map(binding);
const files=['SourceBindings.json','DependencyBindings.json','dependencies.lock.json','package.json','package-lock.json','tsconfig.json',
  'fixtures/profiles.json','fixtures/schema-goldens.json','fixtures/read-goldens-input.json','runner-profile.json','README.md','REPORT.md','HANDOFF.md','PRODUCT_PATCH_CANDIDATE.md'].map(binding);
const verification=JSON.parse(readFileSync(resolve(repo,evidence,'devtoolbox-verification.json')));
const receipt={schema:'cel.finite-handoff-receipt/v1',date:'2026-10-09',baseline,branch:'feature/cel-01-wxg-00-2026-10-09',
  implementation:'COMPLETE',codeOracle:'PASS',environment:'LOCAL_WINDOWS_ISOLATED',recommendation:'CANDIDATE',fixtureAdoption:'NO_ADOPTION_SYNTHETIC_DATA',
  productIntegration:'NO',productTypecheck:'FAIL_MODULE_NOT_FOUND',referenceHardware:'NOT_RUN',crossDeviceArm:'NOT_RUN',headerSabDeployment:'NOT_RUN_REQUIRES_SEPARATE_DECISION',
  browser:'NOT_REQUIRED_PURE_CORE_SLICE',actualAdapter:'NOT_APPLICABLE',gpuTimer:'NOT_REQUESTED',hostLoad:'CONCURRENT_UNCONTROLLED',
  source:{...source,ownSource},files,modelImplementation:summary.binding.model,compiledRuntime:summary.binding.build,testedInputs:summary.testedInputs,compiledInputs:summary.compiledInputs,
  tools:dependencies.tools,compilerDependencies:{fileCount:dependencies.nodeModules.fileCount,manifest:binding('DependencyBindings.json'),lock:binding('dependencies.lock.json'),runtimeDependencies:[]},
  wasm:{status:'UPSTREAM_BYTE_VERIFIED_NOT_USED',purpose:'TRIVIAL_LOAD_AND_BYTEBINDING_PROBE_ONLY',files:source.producer.anchors.filter(f=>f.path.endsWith('.wasm'))},shader:{status:'NOT_APPLICABLE'},
  tests:{passed:summary.passed,failed:summary.failed,checks:summary.checks,evidence:{path:runPath+'/summary.json',bytes:summaryBytes.length,sha256:hash(summaryBytes)},goldens:binding('fixtures/schema-goldens.json'),maxWorkers:1,workerRuntime:'REAL_NODE_WORKER_THREADS_REORDER'},
  independentReview:review,workflow:{executionId:verification.executionId,status:verification.status,steps:verification.verificationResults,
    completionPreflight:'DEGRADED_ADVISORY_CAN_PROCEED_TRUE; own scoped evidence assessed separately',archive:'NOT_PERFORMED'},
  dirtyTreeBinding:{status:'DETACHED_FULL_SCOPE_SEAL',path:'.runtime/final-seal/scope-seal.json',reviewPatch:'.runtime/final-seal/review.patch',
    definition:'Receipt included in full changed tracked/staged/unstaged/nonignored-untracked manifest; complete semantic index and exact patch separately bound. Detached sidecar avoids self-reference. Recheck scripts/seal.mjs --check before use.'},
  publication:{commit:'NO',push:'NO',merge:'NO',humanPlannotatorApproval:'NOT_REQUESTED'},remainingProfile:'runner-profile.json'};
writeFileSync(resolve(root,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',receipt:binding('receipt.json'),modelDigest:summary.binding.model.modelDigest,tests:summary.passed}));
