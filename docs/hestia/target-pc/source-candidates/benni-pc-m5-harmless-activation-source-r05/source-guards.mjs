import {previousBody} from './r03-previous-body.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {checkQualification} from './qualification-model.mjs';
const scenarios=['nominal','unexpected-member','ipc-cancel','watchdog','premature-root-exit','supervisor-crash'];
function fixture(name='nominal'){
 return {scenario:name,suite:{issued:1000,workEnd:49000,overallEnd:61000,utcIssued:2000000,utcEnd:2060000},
 now:1001,admissionNow:1001,retirementNow:50000,ordinal:0,reset:false,rootProof:true,captureProof:true,observerAck:true,observerHasJob:false,
 identities:true,barrierBeforeEffects:true,canarySeparateJob:true,canarySurvived:true,
 total:name==='nominal'?13:4,active:0,emptyJob:true,rootTerminal:true,handlesTerminal:true,handlesClosed:true,
 expectedCause:name==='nominal'?'NONE':name,actualCause:name==='nominal'?'NONE':name,
 exactSupervisorTerminal:true,observerTerminal:true,crashLiveProof:true,crashAccountingClaim:false,watchdogMs:1500,pollMs:50,watchdogBeforeWait:true,unexpectedSiblingObservedBeforeThrow:true,
 grandchildOnlyExited:true,rootChildStayedLive:true,observedHandles:name==='unexpected-member'?4:3};
}
let passed=0,failed=0;
function test(name,run){try{run();passed++;console.log('PASS '+name)}catch(e){failed++;console.log('FAIL '+name+': '+e.stack)}}
const check=v=>checkQualification(v);
for(const scenario of scenarios)test('fixed '+scenario+' complete data only',()=>assert.equal(check(fixture(scenario)).disposition,'SOURCE_READY'));
for(const field of ['rootProof','captureProof','observerAck','identities','barrierBeforeEffects','canarySeparateJob','canarySurvived','rootTerminal','handlesTerminal','handlesClosed'])
 test('missing '+field+' HOLD',()=>{const v=fixture();v[field]=false;assert.equal(check(v).disposition,'HOLD')});
test('no Job handle shared with Observer',()=>{const v=fixture();v.observerHasJob=true;assert.equal(check(v).disposition,'HOLD')});
test('no per-case suite reset',()=>{const v=fixture();v.reset=true;assert.equal(check(v).disposition,'HOLD')});
test('late scenario ordinal0 still needs36000ms work',()=>{const v=fixture();v.now=14000;v.admissionNow=14000;assert.equal(check(v).disposition,'HOLD')});
test('exact36000ms work boundary accepted',()=>{const v=fixture();v.now=13000;v.admissionNow=13000;assert.equal(check(v).disposition,'SOURCE_READY')});
test('12s cleanup cannot extend60s end',()=>{const v=fixture();v.suite.workEnd++;assert.equal(check(v).disposition,'HOLD')});
test('unmatched internal HOLD is not qualification ready',()=>{const v=fixture('ipc-cancel');v.actualCause='other';assert.equal(check(v).disposition,'HOLD')});
test('crash never claims post-close Job accounting',()=>{const v=fixture('supervisor-crash');v.crashAccountingClaim=true;assert.equal(check(v).disposition,'HOLD')});
test('watchdog on supervisor thread before production wait',()=>{const v=fixture('watchdog');v.watchdogBeforeWait=false;assert.equal(check(v).disposition,'HOLD')});
test('unexpected sibling captured before original rejection',()=>{const v=fixture('unexpected-member');v.unexpectedSiblingObservedBeforeThrow=false;assert.equal(check(v).disposition,'HOLD')});
test('unexpected member retains four observed handles',()=>{const v=fixture('unexpected-member');v.observedHandles=3;assert.equal(check(v).disposition,'HOLD')});

const read=n=>previousBody(n,readFileSync(new URL(n,import.meta.url),'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
test('only enumerated31 transformations restore exact accepted R03 bytes',()=>{
 let derived=read('Native24Family.cs');for(const r of [...JSON.parse(read('R02_TRANSPORT_ADAPTATIONS.json')).rules].reverse().filter(x=>x.file==='Native24Family.cs')){assert.equal(derived.split(r.newText).length-1,1);derived=derived.replace(r.newText,r.oldText)}const a=JSON.parse(read('ADAPTATIONS.json'));
 for(const rule of [...a.rules].reverse()){
  assert.equal(derived.split(rule.newText).length-1,rule.count,rule.label);
  derived=derived.split(rule.newText).join(rule.oldText);
 }
 assert.equal(sha(Buffer.from(derived)),a.sourceSha256);
 assert.equal(derived,read('R03_NATIVE_ORIGINAL.cs.txt'));
});
test('one original six-lane engine, no second fixture engine',()=>{
 const source=read('Native24Family.cs'),companion=read('HarmlessQualification.cs');
 assert.equal((source.match(/for \(int ordinal = 0; ordinal < 6; ordinal\+\+\)/g)||[]).length,1);
 assert.doesNotMatch(companion,/for \(int ordinal = 0; ordinal < 6/);
});
test('root proof before resume and capture proof before original topology',()=>{
 const s=read('Native24Family.cs');
 const rootHook=s.indexOf('QualificationRootProof(job.Value, root, run)'),resume=s.indexOf('uint previous = ResumeThread(root.Thread.Value)');assert.ok(rootHook>=0&&resume>=0&&rootHook<resume);
 const capture=s.indexOf('QualificationCaptureProof(job, root, lane, candidates, run)'),topology=s.indexOf('Require(all.Count <= 2');assert.ok(capture>=0&&topology>=0&&capture<topology);
});
test('retirement hook covers lane, final and failure zero before close',()=>{
 const s=read('Native24Family.cs');assert.ok(s.includes('QualificationRetirementProof(job.Value, root, run, ordinal, false)'));
 assert.ok(s.includes('QualificationRetirementProof(job.Value, root, run, 6, true)'));
 assert.ok(s.includes('QualificationRetirementProof(job.Value, root, run, -1, true)'));
});
test('fixed activation entries remain gated and Native24 unconditional veto',()=>{
 const proof=JSON.parse(read('STATIC_AST_ENGINE_RESULT.json'));assert.equal(proof.errors,0);assert.equal(proof.fixedEntries,3);
 const a=read('ActivationAdmission.cs');assert.ok(a.includes('externalRootRuntimeVerifier=new RootRuntimeVerifier()'));
 for(const file of ['qualify.ps1','observe.ps1','supervise.ps1'])assert.ok(read(file).includes('VerifyIndependentRootProof($admitted)'));
 assert.match(read('Native24Family.cs'),/public static int SuperviseNative24\(\)\s*\{\s*throw new InvalidOperationException\("SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT"\);\s*\}/);
 const f=read('harmless-fixture.mjs');assert.ok(f.indexOf('const fixtureAdmission=requireFixtureAdmission();')<f.indexOf("await import('node:fs')"));
});

test('watchdog synchronous fixed1500/50 and no Job handle given to Observer',()=>{
 const s=read('HarmlessQualification.cs');assert.ok(s.includes('checked(now+1500)'));assert.ok(s.includes('Math.Min(50UL'));
 const body=s.slice(s.indexOf('private static void ObserveOwned('),s.indexOf('private static void QualificationRootProof'));
 assert.ok(body.includes('ProcessQueryLimitedInformation|Synchronize'));assert.doesNotMatch(body,/DuplicateHandle[^;]*job\.Value/s);
});
test('fixed fixture contains real 16field interval sampling and atomic publication',()=>{
 const s=read('harmless-fixture.mjs');assert.ok(s.includes('const lower=Math.floor(performance.now())'));assert.ok(s.includes('const utc=Date.now()'));assert.ok(s.includes('const upper=Math.ceil(performance.now())'));
 assert.ok(s.includes('issue.upper,s.upper'));assert.ok(s.includes('fs.linkSync(pending,final)'));
 assert.ok(s.includes('process.send'));assert.ok(s.includes("control(ordinal,'spawn-sibling')"));
});
test('emit-only both source inputs; assembly never loaded',()=>{
 const c=JSON.parse(read('COMPILE_FINAL_ENGINE_RESULT.json'));assert.equal(c.diagnostic,null);assert.equal(c.generatedAssemblyLoaded,false);assert.equal(c.nativeMethodsInvoked,0);
 assert.equal(c.sourceSha256,sha(readFileSync(new URL('Native24Family.cs',import.meta.url))));
 assert.equal(c.companionSha256,sha(readFileSync(new URL('HarmlessQualification.cs',import.meta.url))));
 assert.equal(c.admissionSha256,sha(readFileSync(new URL('ActivationAdmission.cs',import.meta.url))));
 assert.equal(c.verifierSha256,sha(readFileSync(new URL('RootRuntimeVerifier.cs',import.meta.url))));
});
console.log(JSON.stringify({passed,failed,syntheticOnly:true,fixtureExecutions:0,nativeMethodsInvoked:0,runtimeGrant:'NONE_HOLD'}));process.exitCode=failed?1:0;
