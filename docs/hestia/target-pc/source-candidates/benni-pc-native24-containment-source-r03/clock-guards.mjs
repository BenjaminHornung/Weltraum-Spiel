import assert from 'node:assert/strict';
import {checkBridge,checkNodeRequestClock} from './bridge-contract.mjs';
const hash='a'.repeat(64);
function fixture(action = 'LANE_START') {
  const root = { pid: 101, created: '133000000000000001', imageSha256: hash, ownedHandle: true, identityVerified: true };
  const expected = { schema: 'hestia.native24.bridge.v1', originalRoleCount: 1250, originalRolesSha256: hash,
    nodeSha256: hash, bridgePins: [{ role: 'BATCH_ENTRY', path: 'fixed/batch.mjs', bytes: 123, sha256: hash }],
    runtimeBindingsIssued: false, fixedArgv: ['fixed-node', 'fixed-batch', 'fixed-slot'], manifestSha256: hash };
  const trusted = { kind: 'SYNTHETIC_DATA_TEST', batchToken: 'batch-1', nextOrdinal: 0, usedTokens: [],
    root, nativeOrigin: 'native-origin-1', nodeOrigin: 'node-origin-1', utcNowMs: 1000000 };
  const observed = { action, kind: trusted.kind, batchToken: 'batch-1', ordinal: 0, token: 'lane-unique-0',
    originalRoleCount: 1250, originalRolesSha256: hash, bridgePins: structuredClone(expected.bridgePins),
    argv: ['fixed-node', 'fixed-batch', 'fixed-slot'], manifestSha256: hash,
    root: structuredClone(root), members: [structuredClone(root)], activeCount: 1, exclusive: true,
    job: { unnamed: true, inherited: false, killOnClose: true, breakaway: false, hardCap: 3 },
    atomicJobList: true, suspended: true, membershipVerifiedBeforeResume: true,
    previousLaneRetired: true, childTerminal: true, childClose: true, streamsComplete: true,
    frameworkClose: true, terminalExitMatches: true, cancelled: false, unknownEffects: false,
    wholeJobZero: false, jobClosed: false, rootTerminal: false, rootHandleClosed: false, allOwnedHandlesClosed: false,
    nativeClock: { domain: 'WINDOWS_BOOT_MONOTONIC_MILLISECONDS', origin: 'native-origin-1',
      issued: 900000000, now: 900001000, workDeadline: 901140000, overallEnd: 901200000, cleanupMs: 60000 },
    nodeClock: { domain: 'PROCESS_LOCAL_MONOTONIC_MILLISECONDS', origin: 'node-origin-1',
      issued: 5000, now: 6000, workDeadline: 1145000, overallEnd: 1205000, cleanupMs: 60000 },
    issuedUtcMs: 999000, caseMs: 5000, childMs: 600000, outerMs: 1200000, cleanupMs: 60000, maxLanes: 6, retry: 0,
    utcOverallEndMs: 2199000, utcWorkDeadlineMs: 2139000,
    publication: {status: 'PUBLISHED', noReplace: true, events: ['OPEN_PENDING_EXCLUSIVE', 'WRITE_PENDING_COMPLETE', 'CLOSE_PENDING', 'LINK_FINAL_NO_REPLACE', 'UNLINK_PENDING']},
    receiptTotalProcesses: action === 'LANE_RETIRE' ? 3 : 1,
    ownership: {verified: true, transferredOnce: true, unverifiedWaitOrTerminate: false, waitSucceeded: true, threadCloseAttempted: true, processCloseAttempted: true, threadClosed: true, processClosed: true},
    totalProcesses: action === 'BATCH_RETIRE' ? 13 : action === 'LANE_RETIRE' ? 3 : 1,
    descendants: [102, 103].map((pid, index) => ({ pid, parentPid: 101 + index, created: '13300000000000000' + (index + 2),
      imageSha256: hash, identityVerified: true, memberWasVerified: true, terminal: true, handleClosed: true })) };
  if (action === 'BATCH_RETIRE' || action === 'ERROR_RETIRE') {
    observed.members = []; observed.activeCount = 0; observed.wholeJobZero = true; observed.jobClosed = true;
    observed.rootTerminal = true; observed.rootHandleClosed = true; observed.allOwnedHandlesClosed = true;
    observed.ordinal = trusted.nextOrdinal = action === 'BATCH_RETIRE' ? 6 : 0;
  }
  return { expected, observed, trusted };
}

let passed=0,failed=0;
function test(name,run){try{run();passed++;console.log('PASS '+name)}catch(e){failed++;console.log('FAIL '+name+': '+e.stack)}}
function clockFixture(){
 const v=fixture('LANE_START');
 v.observed.issuedUtcMs=2000000;v.trusted.utcNowMs=2000000;v.observed.nativeClock.now=v.observed.nativeClock.issued;
 v.observed.utcOverallEndMs=3200000;v.observed.utcWorkDeadlineMs=3140000;
 Object.assign(v.observed.nodeClock,{issued:1000,issuedUpper:1001,now:1001,nowUpper:1002,utcIssued:2000000,utcNow:2000000,overallEnd:1200999,workDeadline:1140999});
 return v;
}
const clockCheck=v=>checkBridge(v.expected,v.observed,v.trusted);
test('real UTC unchanged while floor crosses a millisecond is valid interval data',()=>assert.equal(clockCheck(clockFixture()).disposition,'ROOT_REVIEW_READY'));
test('identical overlapping mono brackets are valid',()=>{
 const v=clockFixture();v.observed.nodeClock.now=1000;v.observed.nodeClock.nowUpper=1001;
 assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY');
});

function clockHold(name, mutate){test(name,()=>{const v=clockFixture();mutate(v);assert.equal(clockCheck(v).disposition,'HOLD')})}
test('matching actual UTC transition brackets overlap',()=>{const v=clockFixture();Object.assign(v.observed.nodeClock,{now:1002,nowUpper:1003,utcNow:2000001});assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY')});
test('genuine observed sample duration is preserved',()=>{const v=clockFixture();Object.assign(v.observed.nodeClock,{now:1100,nowUpper:1101,utcNow:2000100});assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY')});
clockHold('disjoint offset intervals fail',v=>{v.observed.nodeClock.utcNow=2000100});
clockHold('merely touching offset intervals fail',v=>{v.observed.nodeClock.utcNow=2000003});
clockHold('backward own UTC fails',v=>{v.observed.nodeClock.utcNow=1999999});
clockHold('backward lower endpoint fails',v=>{v.observed.nodeClock.now=999});
clockHold('backward upper endpoint fails',v=>{v.observed.nodeClock.now=1000;v.observed.nodeClock.nowUpper=1000});
clockHold('inverted bracket fails',v=>{v.observed.nodeClock.nowUpper=1000});
for(const field of ['issuedUpper','nowUpper','utcIssued','utcNow'])clockHold('missing '+field+' fails',v=>{delete v.observed.nodeClock[field]});
clockHold('wrong process origin fails',v=>{v.observed.nodeClock.origin='other'});
clockHold('unsafe input fails',v=>{v.observed.nodeClock.nowUpper=9007199254740992});
clockHold('integer-plus-one overflow fails',v=>{v.observed.nodeClock.utcIssued=v.observed.nodeClock.utcNow=Number.MAX_SAFE_INTEGER});
clockHold('numeric string input fails without coercion',v=>{v.observed.nodeClock.now='1001'});
clockHold('fractional endpoint fails',v=>{v.observed.nodeClock.nowUpper=1002.5});
test('negative signed offset bounds are valid',()=>{const v=clockFixture();Object.assign(v.observed.nodeClock,{issued:3000000,issuedUpper:3000001,now:3000001,nowUpper:3000002,overallEnd:4199999,workDeadline:4139999});assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY')});
function exactUpper(){const v=clockFixture();Object.assign(v.observed.nodeClock,{now:540998,nowUpper:540999,utcNow:2539998});return v}
test('fresh upper with exact full reserve passes',()=>assert.equal(clockCheck(exactUpper()).disposition,'ROOT_REVIEW_READY'));
test('one millisecond less than fresh-upper reserve fails',()=>{const v=exactUpper();v.observed.nodeClock.now++;v.observed.nodeClock.nowUpper++;v.observed.nodeClock.utcNow++;assert.equal(clockCheck(v).disposition,'HOLD')});
test('prewait exact reserve is not reused after100ms',()=>{const v=exactUpper();v.observed.nodeClock.now+=100;v.observed.nodeClock.nowUpper+=100;v.observed.nodeClock.utcNow+=100;assert.equal(clockCheck(v).disposition,'HOLD')});
clockHold('expired real UTC fails',v=>{v.observed.nodeClock.utcNow=3200000});
test('conservative end uses UTC upper representation without extension',()=>{const v=clockFixture();assert.equal(v.observed.nodeClock.overallEnd,1200999);assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY');v.observed.nodeClock.overallEnd++;v.observed.nodeClock.workDeadline++;assert.equal(clockCheck(v).disposition,'HOLD')});
test('Node issue UTC may differ from earlier Native issue UTC',()=>{const v=clockFixture();Object.assign(v.observed.nodeClock,{utcIssued:2000050,utcNow:2000050,overallEnd:1200949,workDeadline:1140949});assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY')});
function wireClock(){return ['N24','LANE_START','batch','0','token','node-origin-1','1000','1001','1140999','1200999','2000000','2000000','1','1','1001','1002']}
test('exact16field canonical request matches interval model',()=>assert.equal(checkNodeRequestClock(wireClock(),'node-origin-1',3200000),'CLOCK_DATA_PROVEN'));
test('old14field request is HOLD',()=>assert.equal(checkNodeRequestClock(wireClock().slice(0,14),'node-origin-1',3200000),'HOLD'));
for(const value of ['01000','+1000','1000.0','1e3','9007199254740992'])test('noncanonical/unsafe wire integer '+value,()=>{const f=wireClock();f[6]=value;assert.equal(checkNodeRequestClock(f,'node-origin-1',3200000),'HOLD')});
test('wire wrong origin fails',()=>assert.equal(checkNodeRequestClock(wireClock(),'wrong',3200000),'HOLD'));

console.log(JSON.stringify({passed,failed,syntheticOnly:true,actualClockMeasurements:0,nativeMethodsInvoked:0,payloadExecutions:0,runtimeGrant:'NONE_HOLD'}));
process.exitCode=failed?1:0;
