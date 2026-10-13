import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,repo,hash,json,save,walk,bytes,verifyInputs,verifyMembers} from './bindings.mjs';
const id=process.argv[2];if(!/^[a-z0-9-]+$/.test(id??''))throw Error('RUN_ID');
const summaryPath='../../.devtoolbox/specs/changes/atm-01-04-2026-10-09/tests/runs/'+id+'/summary.json',run=json(summaryPath);
if(run.status!=='PASS'||run.commands.some(c=>c.exitCode!==0))throw Error('RECEIPT_FAILED_RUN');
verifyInputs();verifyMembers(run.inputs);verifyMembers(run.compiled);
for(const c of run.commands)for(const kind of ['stdout','stderr']){
 const b=readFileSync(resolve(root,summaryPath,'..',c.label+'.'+kind+'.log'));
 if(b.length!==c[kind].bytes||hash(b)!==c[kind].sha256)throw Error('RAW_LOG_DRIFT');
}
const dependencies=json('DependencyBindings.json');verifyMembers(dependencies.installed,['node_modules']);verifyMembers(dependencies.archives);
const tools=[
 ['node','C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe','22.23.2','EXECUTED'],
 ['npm-entry','C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js','10.9.8','OWN_IGNORE_SCRIPTS_INSTALL'],
 ['git-entry','C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe','2.56.0.windows.1','ISOLATION_PATCH_AND_SEAL'],
 ['python','C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe','3.12.13','VERSION_ONLY_NO_KERNEL'],
 ['browser','C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe','151.0.7922.34','PE_VERSION_ONLY_NOT_EXECUTED']
].map(([name,path,version,purpose])=>{const b=readFileSync(path);return {name,path,version,purpose,bytes:b.length,sha256:hash(b)};});
const weather=json('fixtures/chosen-weather-result.json'),images=json('../../.devtoolbox/specs/changes/atm-01-04-2026-10-09/tests/image-oracle.json');
const log=readFileSync(resolve(root,summaryPath,'..','focused-tests.stdout.log'),'utf8'),passed=Number(log.match(/# pass (\d+)/)?.[1]??NaN),failed=Number(log.match(/# fail (\d+)/)?.[1]??NaN);
if(!Number.isSafeInteger(passed)||failed!==0)throw Error('TEST_COUNTS');
save('receipt.json',{
 schema:'hestia.atm01-04.receipt.v1',task:'ATM-01-04',environment:'LOCAL_WINDOWS_ISOLATED',implementation:'COMPLETE',codeVerification:'PASS',qualification:'PARTIAL',adoption:'REQUIRES_DECISION',productIntegration:'NO',
 identity:{baseCommit:'17b1db4201a28e7b607c30707bdc2b75e3484a10',branch:'feature/atm-01-04-2026-10-09',worktree:repo,nativeSession:'01a1220c-d492-7e82-965e-e6d074980e13',paseoAgent:'67c2a1c9-7b63-463f-90d6-239646463328',dispatchRequestedModel:'gpt-6.1-sol',dispatchRequestedEffort:'ultra',owner:'EXCLUSIVE_SPIKE_NOT_PRODUCT'},
 source:{inputBindings:bytes('InputBindings.json'),members:json('InputBindings.json').files.length,anchors:json('InputBindings.json').anchors,originalZipSha256:json('InputBindings.json').originalZipSha256,upstreamManifest66:'USER_ORCHESTRATOR_VERIFIED_NOT_REEXECUTED'},
 dependencies:{bindings:bytes('DependencyBindings.json'),pins:dependencies.pins,archives:dependencies.archives,installedMembers:dependencies.installed.length,licenseFiles:dependencies.licenses,wasm:dependencies.wasm,wasmExecuted:false,reactInstalled:false},
 tools,toolCodeClosure:bytes('ToolBindings.json'),rust:'NOT_REQUIRED_NOT_EXECUTED',shaderSources:walk(root,'shaders').map(bytes),generatedGpuPrograms:'NOT_RUN',
 inheritedWasmBindings:json('InputBindings.json').files.filter(f=>f.path.endsWith('.wasm')).map(f=>({...f,purpose:'UNUSED_UPSTREAM_PROBE_NOT_WEATHER_KERNEL'})),
 tests:{summary:bytes(summaryPath),commands:run.commands,passed,failed,inputBindings:run.inputs,compiledBindings:run.compiled,imageOracle:{...images,shaderRasterAcceptance:false},independentChecks:'PRE_REVIEW_CORRECTION_E03_ONLY'},
 weather:{WeatherSnapshotId:weather.WeatherSnapshotId,stormIds:weather.sample.stormIds,binding:weather.binding,query:weather.query,profileProvenance:'HestiaAuthoring_SYNTHETIC_N2_THERMAL_NOT_ACTUAL_HVP_ACCEPTANCE',condensates:weather.sample.condensates,precipitation:weather.sample.precipitation,cloudRainMask:'SEPARATE_AUTHORED_SYNTHETIC_PRESENTATION_NO_METEOROLOGY'},
 limits:{temporalAccumulation:'DISABLED_FULL_IDENTITY_REACTIVE_INVALIDATION',water:'NEAREST_PLANAR_TRANSPARENT_LAYER_ALPHA0.56',cpuLifecycle:'REAL_THREE_OBJECTS_FAKE_RENDERER_EVENTTARGET',fakeGl:'SUPPLEMENTAL_TIMER_STATE_TEST',actualGpuBrowser:'NOT_RUN',actualAdapter:{status:'NOT_RUN',value:null},gpuTimer:{status:'NOT_RUN',value:null},uploadPassTiming:'NOT_RUN',nativeHvp:'NOT_RUN',actualHvpStructuralExports:0,referenceHardware:'NOT_RUN',humanArt:'NOT_RUN',referenceAcceptance:false,hostLoad:run.hostLoad},
 history:{originalRays:'4/6',correctedHelper:'10/12',RAY02:'FAIL',RAY03:'FAIL',gfxVisualParity:'FAIL_3_OF_3_UNCHANGED_0.2_PERCENT',gfxBackend:'FAIL',productTypecheck:'FAIL_MODULE_NOT_FOUND_RETAINED',externalVideoConceptRunSink:'NOT_VERIFIED',requalification:false},
 review:{r01:'FIVE_P1_FIXED_WITH_REGRESSIONS',postfix:json('../../.devtoolbox/specs/changes/atm-01-04-2026-10-09/tests/review-r02.json').verdict,evidence:bytes('../../.devtoolbox/specs/changes/atm-01-04-2026-10-09/tests/review-r02.json'),humanPlannotator:'NOT_REQUESTED',commitPushMergePublish:'NOT_PERFORMED'},
 devToolbox:{specs:'PASS_EXIT0',defaultProductTypecheck:'FAIL_MODULE_NOT_FOUND_EXIT1_RETAINED',completionPreflight:'WARNING_CAN_PROCEED_FOCUSED_EVIDENCE_SUFFICIENT'},
 handoff:{readme:bytes('README.md'),report:bytes('REPORT.md'),handoff:bytes('HANDOFF.md'),profile:bytes('repro-profile.json'),finalDirtyIndexAndExactPatch:'.runtime/final-seal/scope-seal.json; detached after all final files; later edits invalidate'}
});
console.log(JSON.stringify({status:'BOUND_RECEIPT',passed,failed,environment:'LOCAL_WINDOWS_ISOLATED',productIntegration:'NO',hardware:'NOT_RUN'}));
