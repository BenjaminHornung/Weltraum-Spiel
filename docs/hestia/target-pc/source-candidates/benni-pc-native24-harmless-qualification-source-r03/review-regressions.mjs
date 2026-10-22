import assert from 'node:assert/strict';
import {checkQualification} from './qualification-model.mjs';
import {projectRoles,releaseGate} from './custody-model.mjs';
const scenarios=['nominal','unexpected-member','ipc-cancel','watchdog','premature-root-exit','supervisor-crash'];
function fixture(name='nominal'){
 return {scenario:name,suite:{issued:1000,workEnd:49000,overallEnd:61000,utcIssued:2000000,utcEnd:2060000},
 now:1001,admissionNow:1001,retirementNow:50000,ordinal:0,reset:false,rootProof:true,captureProof:true,observerAck:true,observerHasJob:false,
 identities:true,barrierBeforeEffects:true,canarySeparateJob:true,canarySurvived:true,
 total:name==='nominal'?13:4,active:0,emptyJob:true,rootTerminal:true,handlesTerminal:true,handlesClosed:true,
 expectedCause:name==='nominal'?'NONE':name,actualCause:name==='nominal'?'NONE':name,
 crashAccountingClaim:false,watchdogMs:1500,pollMs:50,watchdogBeforeWait:true,unexpectedSiblingObservedBeforeThrow:true,
 grandchildOnlyExited:true,rootChildStayedLive:true,observedHandles:name==='unexpected-member'?4:3};
}

let passed=0,failed=0;
function test(n,f){try{f();passed++;console.log('PASS '+n)}catch(e){failed++;console.log('FAIL '+n+': '+e.stack)}}
test('postpublication numeric reclaim is forbidden',()=>{const v=fixture();v.transfer={publication:'CONFIRMED',reclaimed:true,retired:false};assert.equal(checkQualification(v).disposition,'HOLD')});
test('ambiguous publication never permits remote reclaim',()=>{const v=fixture();v.transfer={publication:'UNCERTAIN',reclaimed:true,retired:false};assert.equal(checkQualification(v).disposition,'HOLD')});
test('missing retirement cannot be source-ready',()=>{const v=fixture();v.transfer={publication:'CONFIRMED',reclaimed:false,retired:false,observerTerminal:false};assert.equal(checkQualification(v).disposition,'HOLD')});
test('sibling ignores persistent grandchild gate',()=>assert.equal(releaseGate('sibling',{release:false,grandchildRelease:true,siblingRelease:false}),false));
const items=[{pid:2,parent:1},{pid:3,parent:2},{pid:4,parent:1}];
for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]])test('all candidate order '+order.join('-'),()=>{
 const result=projectRoles(1,2,order.map(i=>items[i])).sort((a,b)=>a.pid-b.pid);
 assert.deepEqual(result,[{pid:2,role:'child'},{pid:3,role:'grandchild'},{pid:4,role:'sibling'}]);
});
console.log(JSON.stringify({passed,failed,syntheticOnly:true,nativeMethodsInvoked:0,fixtureExecutions:0,runtimeGrant:'NONE_HOLD'}));process.exitCode=failed?1:0;
