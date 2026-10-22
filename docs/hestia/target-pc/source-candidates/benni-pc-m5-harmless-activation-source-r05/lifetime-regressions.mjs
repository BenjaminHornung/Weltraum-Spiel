import {previousBody} from './r03-previous-body.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sourceRaw=readFileSync(new URL(process.argv[2]==='RED'?'../benni-pc-native24-harmless-qualification-source-r02/snapshots/compile-final-before-review/HarmlessQualification.cs':'HarmlessQualification.cs',import.meta.url),'utf8');
const source=process.argv[2]==='RED'?sourceRaw:previousBody('HarmlessQualification.cs',sourceRaw);
let passed=0,failed=0;function test(n,f){try{f();passed++;console.log('PASS '+n)}catch(e){failed++;console.log('FAIL '+n+': '+e.message)}}
test('verified unexpected member has actual3 total4 four identities',()=>{assert.ok(source.includes('accounting.ActiveProcesses==3&&accounting.TotalProcesses==4&&q.Roles.Count==4'));assert.ok(source.includes('CommandObserver("LIVE_UNEXPECTED"'));assert.ok(source.includes('&&q.UnexpectedEvidence'))});
test('Observer independently checks Root Child Sibling live Grandchild terminal',()=>{const i=source.indexOf('command=="LIVE_UNEXPECTED"'),j=source.indexOf('command=="RETIRE_LANE"',i);assert.ok(i>=0&&j>i);const b=source.slice(i,j);for(const r of ['"root"','"child"','"sibling"','"grandchild"'])assert.ok(b.includes(r));assert.ok(b.includes('RequireTerminal'))});
test('Supervisor terminal wait preserves common cleanup end',()=>assert.ok(source.includes('WaitExited(q.Supervisor.Owner.Process.Value,q.Run.OverallEnd)')));
test('Observer nonzero after ACK cannot qualify',()=>assert.ok(source.includes('Require(actor.ExitCode==0,"Observer failure after retirement ACK")')));
test('all exact creator terminal close proofs govern final outcome',()=>{for(const a of ['Supervisor','Canary','Observer'])assert.ok(source.includes('q.'+a+'.Terminal&&q.'+a+'.Closed'))});
test('controller claims exclusive directory before startup',()=>assert.ok(source.includes('Publish(Path.Combine(run.OutputRoot,"controller.claim"),run.BatchToken)')));
console.log(JSON.stringify({passed,failed,syntheticOnly:true,fixtureExecutions:0,nativeMethodsInvoked:0}));process.exitCode=failed?1:0;
