import assert from 'node:assert/strict';
import * as model from './qualification-model.mjs';
const fixture=()=>({scenario:'nominal',suite:{issued:1000,workEnd:49000,overallEnd:61000,utcIssued:2000000,utcEnd:2060000},now:1001,admissionNow:1001,retirementNow:50000,ordinal:0,reset:false,rootProof:true,captureProof:true,observerAck:true,observerHasJob:false,identities:true,barrierBeforeEffects:true,canarySeparateJob:true,canarySurvived:true,total:13,active:0,emptyJob:true,rootTerminal:true,handlesTerminal:true,handlesClosed:true,expectedCause:'NONE',actualCause:'NONE',crashAccountingClaim:false});
let passed=0,failed=0;function test(n,f){try{f();passed++;console.log('PASS '+n)}catch(e){failed++;console.log('FAIL '+n+': '+e.message)}}
const hold=v=>assert.equal(model.checkQualification(v).disposition,'HOLD');
test('missing explicit reset=false fails',()=>{let v=fixture();delete v.reset;hold(v)});
test('negative clock values fail',()=>{let v=fixture();Object.assign(v.suite,{issued:-1000,workEnd:47000,overallEnd:59000});v.now=0;v.admissionNow=0;hold(v)});
test('equal supplied NONE cannot authorize ipc cancellation',()=>{let v=fixture();Object.assign(v,{scenario:'ipc-cancel',expectedCause:'NONE',actualCause:'NONE',active:1,emptyJob:false});hold(v)});
test('noncrash requires actual Job zero',()=>{let v=fixture();Object.assign(v,{scenario:'ipc-cancel',expectedCause:'ipc-cancel',actualCause:'ipc-cancel',active:1,emptyJob:false});hold(v)});
test('retirement after common end fails',()=>{let v=fixture();v.retirementNow=61001;hold(v)});
test('valid cleanup-phase retirement accepted',()=>assert.equal(model.checkQualification(fixture()).disposition,'SOURCE_READY'));
test('CLOSE_SOURCE error is consumed and never retried',()=>{let v=fixture();v.transfer={publication:'ABSENT_PROVEN',reclaimed:true,reclaimAttempts:2,reclaimError:true,retired:true};hold(v)});
test('reclaim failure cannot claim readiness even once',()=>{let v=fixture();v.transfer={publication:'ABSENT_PROVEN',reclaimed:true,reclaimAttempts:1,reclaimError:true,retired:true};hold(v)});
test('crash needs exact supervisor and observer terminal evidence',()=>{let v=fixture();Object.assign(v,{scenario:'supervisor-crash',expectedCause:'supervisor-crash',actualCause:'supervisor-crash'});hold(v)});
test('fixed STOP aggregation exists and marks successors NOT_RUN',()=>{assert.equal(typeof model.aggregateQualification,'function');const a=model.aggregateQualification([{scenario:'nominal',disposition:'HOLD',overallEnd:61000,utcEnd:2060000}],61000,2060000);assert.deepEqual(a.map(x=>x.disposition),['HOLD','NOT_RUN','NOT_RUN','NOT_RUN','NOT_RUN','NOT_RUN'])});
test('aggregation refuses case deadline drift',()=>{assert.equal(typeof model.aggregateQualification,'function');assert.equal(model.aggregateQualification([{scenario:'nominal',disposition:'SOURCE_READY',overallEnd:61001,utcEnd:2060000}],61000,2060000)[0].disposition,'HOLD')});
console.log(JSON.stringify({passed,failed,syntheticOnly:true,nativeMethodsInvoked:0,fixtureExecutions:0}));process.exitCode=failed?1:0;
