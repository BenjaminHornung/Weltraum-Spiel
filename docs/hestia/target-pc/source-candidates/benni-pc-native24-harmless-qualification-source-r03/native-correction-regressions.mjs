import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import * as model from './qualification-model.mjs';
import {closeOnlyReclaim,parentQueryTransfers,finalPublicationDeadline} from './correction-source-checks.mjs';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const source=read('HarmlessQualification.cs'),modelSource=read('qualification-model.mjs');
let passed=0,failed=0;
function test(name,run){try{run();passed++;console.log('PASS '+name)}catch(e){failed++;console.log('FAIL '+name+': '+e.message)}}
const names=['nominal','unexpected-member','ipc-cancel','watchdog','premature-root-exit','supervisor-crash'];
function suite(){
 return {suite:{issued:1000,workEnd:49000,overallEnd:61000,utcIssued:2000000,utcEnd:2060000},reset:false,publicationComplete:true,
 candidates:names.map(scenario=>({scenario,disposition:'SOURCE_READY',overallEnd:61000,utcEnd:2060000})),
 afterLastCase:{now:45000,utc:2044000},afterCleanup:{now:50000,utc:2049000},afterPublication:{now:51000,utc:2050000}};
}
function check(v){assert.equal(typeof model.checkSuiteCompletion,'function');return model.checkSuiteCompletion(v)}
test('valid six candidates require final same-end verdict',()=>assert.equal(check(suite()).disposition,'SOURCE_READY'));
for(const phase of ['afterLastCase','afterCleanup','afterPublication'])for(const clock of ['now','utc'])test(phase+' expiry independent '+clock,()=>{
 const v=suite();v[phase][clock]=clock==='now'?61001:2060001;assert.equal(check(v).disposition,'HOLD');
});
test('incomplete publication is HOLD',()=>{const v=suite();v.publicationComplete=false;assert.equal(check(v).disposition,'HOLD')});
test('suite reset rejected',()=>{const v=suite();v.reset=true;assert.equal(check(v).disposition,'HOLD')});
test('case end drift rejected',()=>{const v=suite();v.candidates[5].overallEnd++;assert.equal(check(v).disposition,'HOLD')});
test('six candidate PASS labels cannot waive final clock',()=>{const v=suite();v.afterPublication.now=62000;assert.equal(check(v).disposition,'HOLD')});
test('HOLD stops candidates and remaining cases stay NOT_RUN',()=>{const v=suite();v.candidates[1].disposition='HOLD';assert.equal(check(v).disposition,'HOLD');assert.deepEqual(model.aggregateQualification(v.candidates,61000,2060000).map(x=>x.disposition),['SOURCE_READY','HOLD','NOT_RUN','NOT_RUN','NOT_RUN','NOT_RUN'])});
test('same original end is accepted at inclusive boundary',()=>{const v=suite();v.afterPublication={now:61000,utc:2060000};assert.equal(check(v).disposition,'SOURCE_READY')});
test('real private final publication has terminal dual-clock verdict',()=>assert.equal(finalPublicationDeadline(source),true));
test('removing final publication clock check is rejected',()=>assert.equal(finalPublicationDeadline(source.replace('bool publicationWithinDeadline=SuiteDeadlineHolds','bool removedPublicationCheck=SuiteDeadlineHolds')),false));
test('real reclaim is close-only once into null target',()=>assert.equal(closeOnlyReclaim(source),true));
test('reclaim mutation restoring local target is rejected',()=>assert.equal(closeOnlyReclaim(source.replace('remote,IntPtr.Zero,out ignored','remote,GetCurrentProcess(),out ignored')),false));
test('reclaim mutation adding SAME_ACCESS is rejected',()=>assert.equal(closeOnlyReclaim(source.replace('false,0x00000001)','false,0x00000001|0x00000002)')),false));
test('removing pre-call consumed mark is rejected',()=>assert.equal(closeOnlyReclaim(source.replace('t.ReclaimAttempted=true;','')),false));
test('all parent-query transfers carry required0400 access',()=>assert.equal(parentQueryTransfers(source),true));
for(const call of [
 'out t.Remote,ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize,false,0',
 'DuplicateTo(q.Observer.Owner.Process,q.Supervisor,ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize|0x0040)',
 'DuplicateTo(q.Canary.Owner.Process,q.Supervisor,ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize)'
])test('removing0400 from specific transfer '+call.split(',')[0],()=>{assert.ok(source.includes(call),'mutation target missing');assert.equal(parentQueryTransfers(source.replace(call,call.replace('ProcessQueryInformation|',''))),false)});
const validIpc={scenario:'ipc-cancel',suite:{issued:1000,workEnd:49000,overallEnd:61000,utcIssued:2000000,utcEnd:2060000},admissionNow:1001,retirementNow:50000,ordinal:0,reset:false,rootProof:true,captureProof:true,observerAck:true,observerHasJob:false,identities:true,barrierBeforeEffects:true,canarySeparateJob:true,canarySurvived:true,rootTerminal:true,handlesTerminal:true,handlesClosed:true,active:0,emptyJob:true,total:4,expectedCause:'ipc-cancel',actualCause:'ipc-cancel'};
test('isolated cause input has every other requirement valid',()=>assert.equal(model.checkQualification(validIpc).disposition,'SOURCE_READY'));
test('equal wrong cause with valid cleanup must HOLD',()=>assert.equal(model.checkQualification({...validIpc,expectedCause:'NONE',actualCause:'NONE'}).disposition,'HOLD'));
test('removing scenario cause policy makes isolated rejection test fail',()=>{
 const original="if(v.actualCause!==cause[v.scenario]||v.expectedCause!==cause[v.scenario])";
 assert.ok(modelSource.includes(original),'fixed policy mutation target missing');
 const mutated=modelSource.replace(original,'if(v.expectedCause!==v.actualCause)').replaceAll('export function ','function ');
 const value={...validIpc,expectedCause:'NONE',actualCause:'NONE'};
 // Only this import-free pure-data model is evaluated; no fixture/application/native source.
 const result=vm.runInNewContext(mutated+';checkQualification('+JSON.stringify(value)+')',Object.create(null),{timeout:50});
 assert.equal(result.disposition,'SOURCE_READY','mutation must expose the formerly masked cause defect');
 assert.throws(()=>assert.equal(result.disposition,'HOLD'));
});

function validCases(){
 return names.map((scenario,i)=>{
  const cause=scenario==='nominal'?'NONE':scenario;
  const v={...validIpc,scenario,suite:{...validIpc.suite,utcIssued:2000000+i*10,utcEnd:2060000+i*10},expectedCause:cause,actualCause:cause,total:scenario==='nominal'?13:4,
   exactSupervisorTerminal:true,observerTerminal:true,crashLiveProof:true,crashAccountingClaim:false,watchdogMs:1500,pollMs:50,watchdogBeforeWait:true,
   unexpectedSiblingObservedBeforeThrow:true,grandchildOnlyExited:true,rootChildStayedLive:true,observedHandles:4};
  assert.equal(model.checkQualification(v).disposition,'SOURCE_READY','each drifting-UTC input is otherwise individually valid');
  return {scenario,disposition:'SOURCE_READY',overallEnd:61000,utcEnd:v.suite.utcEnd};
 });
}
test('individually valid UTC drift cannot be aggregated as same suite',()=>{
 const rows=validCases();assert.equal(model.aggregateQualification(rows,61000,2060000)[1].disposition,'HOLD');
});
test('missing original UTC end is rejected',()=>{
 assert.throws(()=>model.aggregateQualification(validCases(),61000),TypeError);
});
test('removing UTC binding exposes drift and makes rejection fail',()=>{
 const target='&&v.utcEnd===utcEnd';assert.ok(modelSource.includes(target),'UTC mutation target missing');
 const mutated=modelSource.replace(target,'').replaceAll('export function ','function ');
 const result=vm.runInNewContext(mutated+';aggregateQualification('+JSON.stringify(validCases())+',61000,2060000)',Object.create(null),{timeout:50});
 assert.equal(result[1].disposition,'SOURCE_READY');
 assert.throws(()=>assert.equal(result[1].disposition,'HOLD'));
});


test('removing actual final monotone check is rejected',()=>assert.equal(finalPublicationDeadline(source.replace('now<=suite.OverallEnd','true')),false));
test('removing actual final UTC check is rejected',()=>assert.equal(finalPublicationDeadline(source.replace('utcNow<=suite.UtcEnd','true')),false));
test('only seven reviewed companion edits restore frozen R02 exactly',()=>{
 const manifest=JSON.parse(read('COMPANION_CORRECTIONS.json'));let restored=source;
 for(const rule of [...manifest.rules].reverse()){assert.equal(restored.split(rule.newText).length-1,rule.count,rule.label);restored=restored.split(rule.newText).join(rule.oldText)}
 assert.equal(createHash('sha256').update(restored).digest('hex'),manifest.sourceSha256);
 assert.equal(restored,read('snapshots/red/HarmlessQualification.cs'));
});

console.log(JSON.stringify({passed,failed,syntheticOnly:true,pureModelMutationOnly:true,fixtureExecutions:0,nativeMethodsInvoked:0,runtimeGrant:'NONE_HOLD'}));process.exitCode=failed?1:0;
