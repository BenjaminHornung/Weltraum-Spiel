// Pure replay of the actual diagnostic Root cell: every tool/load/store/clock is replaced.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const cell=fs.readFileSync(new URL('./Root.cell.mjs',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
let now=1800000000000, saved, passedSnapshot, issueEnteredUtc, nativeFailure, actualToolEndUtc, snapshotReadUtc;
let toolCalls=0, reads=0, terminalPolls=0, issueCalls=0, threadStatus='active';
const messages=[];
const cfg={appThread:'01a13648-c55b-7250-bf07-34921d70b43b',appTurn:'00000000-0000-0000-0000-000000000002',
 appStartEpochMs:1799999999000,appDeadlineEpochMs:1800000600000,cwd:'REPLAY_ONLY_NO_FILES',humanRef:'NEW_UNISSUED_REPLAY_FIXTURE'};
const tools={
 async exec_command(args){
  toolCalls++;
  const mode=args.cmd.match(/-Mode '([^']+)'/)[1];
  if(mode==='RootWait'){now+=100;return {session_id:77,output:''};}
  assert.equal(mode,'Issue');
  issueCalls++;
  const input=JSON.parse(args.cmd.match(/ -InputJson '(.*)'$/s)[1].replaceAll("''","'"));
  passedSnapshot=input.appSnapshot;issueEnteredUtc=now;
  // Fixed failed-tool fixture, not a native predicate implementation.
  nativeFailure='HOLD:fresh independent App snapshot observedUtc='+passedSnapshot.observedUtc+
    ' checkedUtc='+(passedSnapshot.observedUtc+12000)+' ageMs=12000';
  now+=15000;actualToolEndUtc=now;
  throw new Error(nativeFailure);
 },
 async write_stdin(args){
  assert.equal(args.session_id,77);assert.equal(args.chars,'');terminalPolls++;now+=100;
  return {exit_code:0,output:'{"replayReady":true}'};
 },
 async mcp__codex_app__read_thread(){
  reads++;now+=5;snapshotReadUtc=now;
  return {content:[{type:'text',text:JSON.stringify({thread:{id:cfg.appThread,cwd:cfg.cwd,status:{type:threadStatus},unrelated:'must not enter snapshot'},
    turns:[{id:cfg.appTurn,status:'inProgress',startedAt:cfg.appStartEpochMs/1000}]})}]};
 }
};
class FakeDate extends Date {static now(){return now++;}}
await new AsyncFunction('tools','load','store','text','Date',cell)(tools,()=>cfg,
 (key,value)=>{assert.equal(key,'M5_PRESTART_ROOT_TOOL_EVIDENCE');saved=value;},
 value=>messages.push(value),FakeDate);
assert.equal(toolCalls,2);assert.equal(reads,1);assert.equal(terminalPolls,1);
assert.equal(issueCalls,1);
assert.ok(saved.ownSessions.every(x=>x.terminal));
const issue=saved.evidence.find(x=>x.mode==='Issue');
assert.deepEqual(issue.appSnapshot,passedSnapshot);
assert.deepEqual(Object.keys(issue.appSnapshot),['thread','turn','status','startedAt','cwd','observedUtc']);
assert.equal(issue.toolCallStartedUtc,issueEnteredUtc-1);
assert.equal(issue.toolCallEndedUtc,actualToolEndUtc);
assert.equal(issue.toolError,'Error: '+nativeFailure);
assert.ok(issue.toolCallEndedUtc-issue.toolCallStartedUtc>=15000);
assert.equal(messages.at(-1).status,'HOLD_NO_RETRY');
assert.match(messages.at(-1).failure,/Root|HOLD:fresh independent App snapshot/);
const validGuard=saved.evidence.find(x=>x.mode==='AppSnapshotGuard');
assert.deepEqual(Object.keys(validGuard),['mode','observedUtc','observed','comparisons']);
assert.deepEqual(Object.keys(validGuard.observed),['threadId','cwd','threadStatusType','turnId','turnStatus','startedAt']);
assert.deepEqual(validGuard.observed,{threadId:cfg.appThread,cwd:cfg.cwd,threadStatusType:'active',turnId:cfg.appTurn,turnStatus:'inProgress',startedAt:cfg.appStartEpochMs/1000});
assert.deepEqual(validGuard.comparisons,{threadIdMatches:true,cwdMatches:true,threadStatusActive:true,turnIdMatches:true,turnInProgress:true,startedAtMatches:true});
assert.ok(Number.isInteger(validGuard.observedUtc));
assert.equal(validGuard.observedUtc,snapshotReadUtc);
assert.ok(!JSON.stringify(validGuard).includes('unrelated')&&!JSON.stringify(validGuard).includes('must not enter snapshot'));
const valid={snapshotActuallyPassed:passedSnapshot,retainedGuard:validGuard,retainedIssue:issue,hold:messages.at(-1),toolCalls,reads,terminalPolls,issueCalls};
now=1800000000000;saved=undefined;passedSnapshot=undefined;toolCalls=0;reads=0;terminalPolls=0;issueCalls=0;threadStatus='idle';messages.length=0;
await new AsyncFunction('tools','load','store','text','Date',cell)(tools,()=>cfg,
 (key,value)=>{assert.equal(key,'M5_PRESTART_ROOT_TOOL_EVIDENCE');saved=value;},
 value=>messages.push(value),FakeDate);
assert.equal(toolCalls,1);assert.equal(issueCalls,0);assert.equal(reads,1);assert.equal(terminalPolls,1);
assert.ok(saved.ownSessions.every(x=>x.terminal));
assert.equal(saved.evidence.filter(x=>x.mode==='Issue').length,0);
assert.equal(passedSnapshot,undefined);
const wrongGuard=saved.evidence.find(x=>x.mode==='AppSnapshotGuard');
assert.deepEqual(Object.keys(wrongGuard),['mode','observedUtc','observed','comparisons']);
assert.deepEqual(wrongGuard.observed,{threadId:cfg.appThread,cwd:cfg.cwd,threadStatusType:'idle',turnId:cfg.appTurn,turnStatus:'inProgress',startedAt:cfg.appStartEpochMs/1000});
assert.deepEqual(wrongGuard.comparisons,{threadIdMatches:true,cwdMatches:true,threadStatusActive:false,turnIdMatches:true,turnInProgress:true,startedAtMatches:true});
assert.ok(Number.isInteger(wrongGuard.observedUtc));
assert.equal(wrongGuard.observedUtc,snapshotReadUtc);
assert.ok(!JSON.stringify(wrongGuard).includes('unrelated')&&!JSON.stringify(wrongGuard).includes('must not enter snapshot'));
assert.equal(messages.at(-1).status,'HOLD_NO_RETRY');
assert.equal(messages.at(-1).failure,'Error: Independent current App snapshot drift');
console.log(JSON.stringify({status:'PURE_DIAGNOSTIC_REPLAY_PASS',valid,wrongThreadStatus:{retainedGuard:wrongGuard,hold:messages.at(-1),issueCalls,toolCalls,reads,terminalPolls},snapshotActuallyPassed:valid.snapshotActuallyPassed,
 retainedIssue:issue,hold:messages.at(-1),toolCalls,reads,terminalPolls,allToolsAndClocksReplaced:true,
 realRootBodyOrToolsExecuted:false,nativeError:'FIXTURE_ONLY_NATIVE_BODY_NOT_EXECUTED'}));

