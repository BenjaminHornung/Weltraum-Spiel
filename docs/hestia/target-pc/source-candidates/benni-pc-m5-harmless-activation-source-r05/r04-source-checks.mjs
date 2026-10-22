import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const base=process.argv[2]||'.',read=n=>readFileSync(new URL(base+'/'+n,import.meta.url),'utf8');
const verifier=read('RootRuntimeVerifier.cs'),client=read('RootSubjectClient.cs'),core=read('Native24Family.cs'),host=read('RootHost.cs');
const write=verifier.slice(verifier.indexOf('private static void WriteChildAdmission')),close=client.slice(client.indexOf('public static void CloseChannel'),client.indexOf('public static void CloseProposals'));
let passed=0,failed=0;function test(n,f){try{f();passed++;console.log('PASS '+n)}catch(e){failed++;console.log('FAIL '+n+': '+e.message)}}function order(s,...parts){let p=-1;for(const x of parts){const i=s.indexOf(x,p+1);assert.ok(i>p,x);p=i}}
function writeGate(s){order(s,'ulong now=GetTickCount64();long utcNow=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();','Require(now<run.OverallEnd&&utcNow<run.OverallUtcMs','var write=pipe.WriteAsync','Math.Min(1000UL,run.OverallEnd-now)');assert.ok(!s.includes('run.OverallEnd-GetTickCount64()'))}
function drainGate(s){order(s,'WaitForSingleObject(p.Process.Value,0)==WaitObject0','Require(now<end&&utcNow<utcEnd','PumpAll();','channel.Eof&&channel.Lines.Count==0&&!channel.HasPartialFrame','RetireHeld(p);','finally{','channel.Dispose();');assert.ok(s.includes('Require(channel.Closed'));assert.ok(s.includes('channels.Remove(p);p.RootChannel=null;'));assert.ok(!s.includes('channel.Eof=true'))}
test('actual prewrite native UTC gate before WriteAsync',()=>writeGate(write));
test('actual terminal EOF queue partial and finally close source',()=>drainGate(close));
test('only shared CloseChannel owns drain and retirement before handle closes',()=>{const b=core.slice(core.indexOf('public void CloseChecked() {',core.indexOf('private sealed class BoundProcess')),core.indexOf('// No instance exists'));assert.ok(b.includes('RootSubjectClient.CloseChannel(this)'));assert.ok(!b.includes('RootSubjectClient.RetireHeld(this)'));order(b,'RootSubjectClient.CloseChannel(this)','Thread.CloseChecked()','Process.CloseChecked()')});
test('partial EOF proof comes only from completed read, never disposal',()=>{assert.ok(host.includes('public bool HasPartialFrame{get{return pending.Length!=0;}}'));order(host,'if(n==0){Eof=true;Require(pending.Length==0','PRIVATE_PARTIAL_FINAL_LINE');assert.ok(!host.slice(host.indexOf('public void Dispose()'),host.indexOf('private static AnonymousPipeServerStream')).includes('Eof=true'))});
test('creation failure releases creator stdout writer before terminal channel drain',()=>{const from=core.indexOf('} catch (Exception primary)',core.indexOf('private static BoundProcess CreateFixedRoot'));const failure=core.slice(from,core.indexOf('} finally {',from));order(failure,'relayOutput.CloseChecked();relayOutput=null;','root.CloseChecked();');assert.ok(core.includes('if (root==null&&channel!=null)try{channel.Dispose();}'))});
test('process/thread custody transfers before fallible pipe attach',()=>order(core,'root = new BoundProcess{Process=new OwnedHandle(pi.hProcess),Thread=new OwnedHandle(pi.hThread),Pid=pi.dwProcessId,RootChannel=channel}','RootSubjectClient.Attach(root);channel.Output.DisposeLocalCopyOfClientHandle();'));
test('creator writer release omission rejected with later finally marker retained',()=>{const from=core.indexOf('} catch (Exception primary)',core.indexOf('private static BoundProcess CreateFixedRoot'));const failure=core.slice(from,core.indexOf('} finally {',from));assert.ok(core.includes('if (relayOutput != null)try{relayOutput.CloseChecked();}'));const changed=failure.replace('relayOutput.CloseChecked();relayOutput=null;','relayOutput=null;');assert.notEqual(changed,failure);assert.throws(()=>order(changed,'relayOutput.CloseChecked();relayOutput=null;','root.CloseChecked();'))});
const writeMutants=[
 ['write before native UTC guard',s=>s.replace('var write=pipe.WriteAsync(bytes,0,bytes.Length);','').replace('ulong now=GetTickCount64();','var write=pipe.WriteAsync(bytes,0,bytes.Length);ulong now=GetTickCount64();')],
 ['UTC predicate relaxed',s=>s.replace('now<run.OverallEnd&&utcNow<run.OverallUtcMs','now<run.OverallEnd||utcNow<run.OverallUtcMs')],
 ['native boundary inclusive',s=>s.replace('now<run.OverallEnd&&','now<=run.OverallEnd&&')],
 ['second clock read permits subtraction crossing',s=>s.replace('run.OverallEnd-now','run.OverallEnd-GetTickCount64()')],
 ['one second cap widened',s=>s.replace('Math.Min(1000UL','Math.Min(5000UL')]
];
for(const[n,mutate]of writeMutants)test('marker-preserving write mutant '+n,()=>{const m=mutate(write);assert.notEqual(m,write);assert.throws(()=>writeGate(m))});
const drainMutants=[
 ['terminal process bypass',s=>s.replace('WaitForSingleObject(p.Process.Value,0)==WaitObject0','true')],
 ['native expiry bypass',s=>s.replace('now<end&&utcNow<utcEnd','true')],
 ['partial frame accepted',s=>s.replace('&&!channel.HasPartialFrame','')],
 ['queue ignored',s=>s.replace('&&channel.Lines.Count==0','')],
 ['EOF inferred from terminal',s=>s.replace('channel.Eof&&channel.Lines.Count==0&&!channel.HasPartialFrame','true')],
 ['relay not pumped',s=>s.replace('PumpAll();','')],
 ['retire before draining',s=>s.replace('RetireHeld(p);','').replace('PumpAll();','RetireHeld(p);PumpAll();')],
 ['finally removed',s=>s.replace('finally{','if(failure==null){')],
 ['owned close skipped',s=>s.replace('channel.Dispose();','')],
 ['unchecked disposal',s=>s.replace('Require(channel.Closed','Require(true')]
];
for(const[n,mutate]of drainMutants)test('marker-preserving drain mutant '+n,()=>{const m=mutate(close);assert.notEqual(m,close);assert.throws(()=>drainGate(m))});
// LIMITED C# guard/transition projections anchored to the actual predicates above; no C# methods or interop execute.
const canWrite=(n,u,end=160,utcEnd=1060)=>n<end&&u<utcEnd;
for(const[n,u,want]of [[159,1059,true],[160,1059,false],[159,1060,false],[161,1061,false]])test('limited prewrite dual-clock boundary '+n+'/'+u,()=>{writeGate(write);assert.equal(canWrite(n,u),want)});
test('limited boundary crossing has no write before rejection',()=>{writeGate(write);let writes=0;const events=[];const n=160,u=1059;if(canWrite(n,u)){events.push('write');writes++}else events.push('HOLD');assert.equal(writes,0);assert.deepEqual(events,['HOLD'])});
test('limited same valid snapshot yields nonnegative capped wait',()=>{writeGate(write);for(const n of [100,159])assert.ok(Math.min(1000,160-n)>=0);assert.equal(canWrite(160,1059),false)});
function drain(events){let closed=0,removed=0,normal=false;try{for(const e of events){if(!e.terminal)throw Error('terminal');if(!canWrite(e.now,e.utc))throw Error('deadline');if(e.partial&&e.eof||e.malformed)throw Error('frame');if(e.eof&&e.queued===0){normal=true;break}}if(!normal)throw Error('EOF');return true}finally{closed++;removed++;assert.equal(closed,1);assert.equal(removed,1)}}
const live={terminal:true,now:120,utc:1020,eof:false,queued:0,partial:false};
test('limited pending final read is pumped until actual EOF',()=>{drainGate(close);assert.equal(drain([live,{...live,eof:true}]),true)});
test('limited pending fragment may complete before EOF',()=>{drainGate(close);assert.equal(drain([{...live,partial:true},{...live,eof:true}]),true)});
test('limited pending queue is pumped before final EOF proof',()=>{drainGate(close);assert.equal(drain([{...live,queued:1},{...live,eof:true}]),true)});
for(const[n,e]of [['missing EOF',[live]],['trailing partial',[{...live,eof:true,partial:true}]],['nonempty queue',[{...live,eof:true,queued:1}]],['malformed final frame',[{...live,eof:true,malformed:true}]],['native timeout',[{...live,now:160}]],['UTC timeout',[{...live,utc:1060}]],['live subject',[{...live,terminal:false}]]])test('limited drain HOLD and finally close '+n,()=>{drainGate(close);assert.throws(()=>drain(e))});
console.log(JSON.stringify({passed,failed,sourceMutants:16,limitedCSharpProjection:true,nativeMethodsInvoked:0,fixtureExecutions:0,runtimeGrant:'NONE_HOLD'}));process.exitCode=failed?1:0;
