import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const modern=resolve(import.meta.dirname,'..'),root=resolve(modern,'../../..');
const spec='.devtoolbox/specs/changes/phy-03-2026-10-09/modern-r01';
const run=resolve(root,spec,'tests/runs/local-functional-07');
const read=p=>JSON.parse(readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const ref=p=>{const b=readFileSync(resolve(root,p));return {path:p,bytes:b.length,sha256:sha(b)};};
const unit=read(resolve(run,'unit-results.json')),exits=read(resolve(run,'exits.json'));
assert.equal(unit.numPassedTests,47);assert.equal(unit.numFailedTests,0);assert.equal(exits.checks.length,8);assert(exits.checks.every(c=>c.exitCode===0));
const proof=read(resolve(run,'cli-register.stdout.log'));
assert.equal(proof.status,'PASS');assert.equal(proof.profile.dynamicGyroscopicForces,false);
const inputs=read(resolve(modern,'input-binding.json')),context=read(resolve(modern,'context-binding.json')),supplement=read(resolve(modern,'supplement-binding-r03.json'));
const lab=read(resolve(modern,'lab-contract-binding.json'));
const modernRel='spikes/phy-03-migration-capsule/modern-r01';
const out={schema:'phy03.actual-private-capsule.receipt.r01',status:'PARTIAL',independentImplementation:'COMPLETE',executionLocation:'LOCAL_WINDOWS_ISOLATED',
  session:{native:'01a12004-8b04-7b41-b64d-5fcf3076d6a6',paseo:'5ead133e-5607-4405-b9fb-c5adbb021246',modelRequested:'gpt-6.1-sol',thinkingRequested:'ultra',providerRequested:'codex'},
  source:{head:'17b1db4201a28e7b607c30707bdc2b75e3484a10',branch:'feature/phy-03-2026-10-09',writeScope:[modernRel,spec]},
  productIntegration:'NO',productOwner:{native:'01a120eb-c6c5-7b40-bb95-cdf703ecb5c3',paseo:'37dddeb2-1688-47cc-af00-b03edd394215'},
  actualSolver:{package:proof.package,profile:proof.profile,reference:proof.reference,source:proof.source},
  actualInputs:{phy01:{files:inputs.files.length,indexSha256:inputs.inputIndexSha256,counts:inputs.counts},
    partialR01R02AndSourcePort:{files:context.files.length,indexSha256:context.indexSha256},
    currentR03AndReviewedOwner:{files:supplement.files.length,indexSha256:supplement.indexSha256,phy02:supplement.phy02,owner:supplement.owner},
    currentA0PureLab:{files:lab.files.length,indexSha256:lab.indexSha256,inputSha256:lab.inputSha256,ownerReceiptSha256:lab.ownerReceiptSha256,snapshotRows:lab.snapshotRows,
      ownerBindingRows:lab.ownerBindingRows,review:lab.independentReview,publicContract:lab.publicContract}},
  archivedMatrix:{cases:192,raw:proof.partialEvidence.raw,acceptance:proof.partialEvidence.acceptance,selectedProfileRaw:proof.partialEvidence.selectedProfileRaw,
    gyro:'SEPARATE_UNSELECTED',execution:'ARCHIVED_NOT_RERUN',representationChoice:'NONE',sourceV2:'UNSUPPORTED'},
  verification:{current:'local-functional-07',tests:{pass:unit.numPassedTests,fail:unit.numFailedTests,skip:unit.numPendingTests,scope:'43_OWN_PURE_PLUS4_UNCHANGED_A0_AUTHORED_NO_NATIVE_WORLD'},
    commands:exits.checks.map(c=>({id:c.id,exitCode:c.exitCode})),
    exits:ref(spec+'/tests/runs/local-functional-07/exits.json'),sourceBefore:ref(spec+'/tests/runs/local-functional-07/source-before.json'),
    build:ref(spec+'/tests/runs/local-functional-07/build-binding.json'),toolClosure:ref(modernRel+'/tool-binding.json'),
    lock:ref(modernRel+'/package-lock.json'),fixture:ref('spikes/phy-03-migration-capsule/snapshot/tests/fixtures/hvp-contact-r90-body384.json'),
    native:'NOT_RUN',browser:'NOT_RUN',modernIndexedDB:'NOT_RUN',referenceCpuGpuHvp:'NOT_RUN',actualAdapter:null,gpuTimers:null,hostLoad:'UNCONTROLLED_PARALLEL',
    typecheck:'PASS_STRICT_APPLICATION_SOURCE_SKIPLIBCHECK_TRUE',buildStatus:'PASS_PREPARED_NATIVE_ENTRY_NOT_EXECUTED'},
  historical:{legacyFiles:252,legacyDigest:inputs.legacyDigest,legacyReview:inputs.legacyReviewDiff,legacyPopulation:'55PASS_1SKIP_AND12_INDEXEDDB_HISTORICAL_NOT21_ACCEPTANCE',
    modernInitial:'31PASS_7EXIT0_PRE_GUARD_REPAIR_NO_FINAL_SOURCE_BINDING',setup02:'EXIT1_TOOL_PATH_BEFORE_TESTS',functional03:'38PASS_1TIMEOUT_TYPECHECK_BUILD_NOT_RUN',
    functional04:'41PASS_7EXIT0_PRE_R03_SUPPLEMENT',functional05:'41PASS_7EXIT0_R03_AWARE_PRE_LAB_CONTRACT',functional06:'46PASS_1OWN_LISTRESULT_ASSERTION_FAIL_TYPECHECK_BUILD_NOT_RUN',deadlines:'5SECOND_ORIGINAL_NEW_TEST_DEADLINES_UNCHANGED'},
  missing:['Actual complete PHY021_LAB_FUNCTIONAL_R01 runtime-wiring freeze','Actual collider/semantic-surface/ownership choice','Frozen S2 codec and generational world identity',
    'Real native/contact/moving-body/Cold/IndexedDB lifecycle evidence','Public Save/schema/default/human gates and explicit A0/Runner hardware slot'],
  gates:{mainCapacity:6,customAgents:'SERIAL_PARENT_WAITS_NO_RECURSION',hardwareSlot:'NOT_GRANTED',humanPlannotator:'NOT_GRANTED',commitPushMergePublication:'NOT_PERFORMED'},
  bindings:{fullDirtyTreeSha256:null,fullDirtyFileCount:0,index:'SourceDirtyIndex.json',terminalSeal:'.runtime/seal.json',reviewDiff:'.runtime/full-review.diff',
    normalization:'Modern receipt self-digest only; terminal ignored seal binds actual receipt/index/diff bytes'}};
writeFileSync(resolve(modern,'receipt.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',scope:'RECEIPT_FROM_ACTUAL_CURRENT_ARTIFACTS',profile:out.actualSolver.profile.id,tests:out.verification.tests,productIntegration:'NO'}));
