import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const red=process.argv[2]==='RED';
if(process.argv.length>3||process.argv[2]&&!red)throw new Error('fixed source-only test argv');
const base=red?'../benni-pc-native24-harmless-qualification-source-r01/':'./';
const read=n=>readFileSync(new URL(base+n,import.meta.url),'utf8');
const c=read('HarmlessQualification.cs'),core=read('Native24Family.cs');
function body(s,name){
 const clean=s.replace(/@"(?:[^"]|"")*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,x=>' '.repeat(x.length));
 const m=new RegExp('\\b'+name+'\\s*\\([^;{}]*\\)\\s*\\{').exec(clean);if(!m)return '';
 const start=clean.indexOf('{',m.index);let level=1,i=start+1;for(;i<clean.length&&level;i++){if(clean[i]==='{')level++;else if(clean[i]==='}')level--}
 return s.slice(start,i);
}
function ordered(s,name,a,b){const t=body(s,name),i=t.indexOf(a),j=t.indexOf(b);return i>=0&&j>=0&&i<j}
let passed=0,failed=0;function test(n,f){try{f();passed++;console.log('PASS '+n)}catch(e){failed++;console.log('FAIL '+n+': '+e.message)}}
test('actual fixed control creator and verified suspended resume',()=>{assert.ok(body(c,'StartFixedControl').includes('CreateProcessW'));assert.ok(ordered(c,'StartFixedControl','CreateProcessW','VerifyControl'));assert.ok(body(c,'ResumeOwned').includes('actor.Verified'))});
test('actual Observer pump handles prepare commit abort and retained close',()=>{const b=body(c,'ObserverPump');for(const v of ['.prepare','.commit','.abort','VerifyTransferred','RetireObserved'])assert.ok(b.includes(v),v)});
test('suite clock precedes actual fixed six-case loop',()=>{assert.ok(ordered(c,'RunFutureQualificationSuite','PrepareSuiteClock','foreach(QualificationScenario'));assert.ok(body(c,'RunFutureQualificationSuite').includes('NOT_RUN'));assert.ok(body(c,'RunFutureCase').includes('RetireOwnedControl(q.Observer'))});
test('actual private Supervisor calls one original engine',()=>assert.ok(body(c,'FutureFixedSupervisorBody').includes('SuperviseFixedBatch(q.Run)')));
test('actual cause policy and cleanup govern result',()=>{const b=body(c,'FutureFixedSupervisorBody');for(const v of ['ObservedCause','ExpectedCause','q.FinalZero','q.FamilyRetired'])assert.ok(b.includes(v),v)});
test('both call positions exist in actual method bodies',()=>{assert.ok(ordered(core,'SuperviseFixedBatch','QualificationRootProof','ResumeThread'));assert.ok(ordered(core,'CaptureOwnedDescendants','QualificationCaptureProof','Require(all.Count <= 2'))});
test('removing root proof cannot pass order guard',()=>assert.equal(ordered(core.replace('QualificationRootProof(job.Value, root, run);',''),'SuperviseFixedBatch','QualificationRootProof','ResumeThread'),false));
test('removing capture proof cannot pass order guard',()=>assert.equal(ordered(core.replace('QualificationCaptureProof(job, root, lane, candidates, run);',''),'CaptureOwnedDescendants','QualificationCaptureProof','Require(all.Count <= 2'),false));
test('one-shot reclaim consumed before native call and absent proof required',()=>{assert.ok(ordered(c,'ReclaimBeforePrepare','t.ReclaimAttempted=true','DuplicateHandle'));assert.ok(body(c,'ReclaimBeforePrepare').includes('ProvedAbsent'));assert.ok(body(c,'ObserveOwned').includes('TransferState.DuplicatedLocal&&ProvedAbsent'))});
test('all transfer failures reach abort or prepublication reclaim',()=>{const b=body(c,'ObserveOwned');assert.ok(ordered(c,'ObserveOwned','q.Transfers.Add','Publish(prepare'));assert.ok(b.includes('ReclaimBeforePrepare'));assert.ok(b.includes('ForceObserverRetirement'));assert.ok(b.includes('.retired.ack'))});
test('watchdog is synchronous fixed 1500/50 before WaitExited',()=>{const b=body(c,'FixedWatchdog');assert.ok(b.includes('checked(now+1500)'));assert.ok(b.includes('Math.Min(50UL'));assert.ok(body(c,'QualificationCaptureProof').includes('FixedWatchdog(run)'))});
test('Controller actual crash uses exact creator and never Job accounting',()=>{const b=body(c,'RunFutureCase');assert.ok(b.includes('TerminateProcess(q.Supervisor.Owner.Process.Value'));assert.ok(b.includes('q.CrashLiveProof'));assert.ok(b.includes('CommandObserver("CRASH"'));assert.ok(!b.includes('QueryAccounting'))});
console.log(JSON.stringify({passed,failed,syntheticOnly:true,nativeMethodsInvoked:0,fixtureExecutions:0}));process.exitCode=failed?1:0;
