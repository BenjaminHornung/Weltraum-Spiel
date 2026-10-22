import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AUTHORITY_FIELDS,CLOCK_FIELDS,CREATE_STAGES,CLOSE_STAGES,atomicModel,readAbortModel,localRetired,remaining,parseAuthorityV2,checkedClock,admitAuthorityV2,outerAttempt,ORIGIN_FIELDS,originSamples,admitOrigin,originAttempt,conservativeNativeObservation} from './root-runner-model.mjs';
assert.equal(process.versions.node,'22.23.2');
const baseline=process.argv[2]==='baseline';
const current=new URL('./',import.meta.url),base=baseline?new URL('../benni-pc-m5-root-runner-source-r03/',import.meta.url):current;
const read=(n,b=base)=>readFileSync(new URL(n,b),'utf8');
const files={o:read('root-outer.ps1'),d:read('root-dispatch.ps1'),r:read('root-runner.ps1'),cs:read('RootOuterAtomicLauncher.cs',current)};
const f=(s,n)=>{const i=s.indexOf('function '+n+'(');assert.ok(i>=0,n);const j=s.indexOf('\nfunction ',i+1),end=j<0?s.indexOf('\n# ENTRY',i):j;return s.slice(i,end<0?s.length:end)};
const tail=s=>s.slice(s.lastIndexOf('# ENTRY'));
const order=(s,...bits)=>{let at=-1;for(const bit of bits){const next=s.indexOf(bit,at+1);assert.ok(next>at,bit);at=next}};
const seam=({o})=>{
 assert.ok(!o.includes('Diagnostics.Process]::new'));assert.ok(!o.includes('$p.Start()'));
 order(tail(o),'CheckLauncherBytes','NewImmutable $clockPath','$launchBytes=ReadLauncherDll','$assembly=[Reflection.Assembly]::Load($launchBytes)',"$type=$assembly.GetType('Hestia.M5.RootOuterR04.RootOuterAtomicLauncher'","$method=$type.GetMethod('RunDispatcher'","$done=$method.Invoke");
 for(const bit of ['$done.Success','$done.Terminal','$done.ExitCode-eq0','$done.StdoutEof','$done.StderrEof','$done.JobZero','$done.HandlesClosed','-not$done.PartialFrame'])assert.ok(tail(o).includes(bit),bit);
 assert.ok(!o.includes('.stdout.Contains('));
};
const p2=({d,r})=>{for(const s of [d,r]){
 const x=f(s,'Drain');assert.ok(x.includes('catch{$s.broken=$true;$child.abort=$true;$child.errors.Add($_.Exception);throw}'));
 const finish=f(s,'FinishChild');assert.ok(finish.includes('catch{$child.abort=$true;'));order(finish,'finally{','$child.process.Kill()');
 assert.ok(s.includes('$custody.startAttempted=$true'));
}};
let passed=0,failed=0;const results=[];function test(name,fn){try{fn();passed++;results.push({name,pass:true})}catch(e){failed++;results.push({name,pass:false,error:e.message})}}
test('P1 outer managed Start fully replaced by fixed atomic seam',()=>seam(files));
test('P2 actual immediate pump-error propagation in both PS callers',()=>p2(files));
if(baseline){
 console.log(JSON.stringify({mode:'frozen R03 P1/P2 source RED',expectedFailures:2,passed,failed,expected:failed===2,results,psBodiesExecuted:0}));process.exitCode=failed===2?0:1;
}else{
 const {o,d,r,cs}=files;
 const nativeGate=s=>{
  assert.ok(!/Process\.Start|AssignProcessToJobObject|CREATE_BREAKAWAY/.test(s));
  for(const bit of ['LimitFlags = KillOnClose;','actual.BasicLimitInformation.LimitFlags == KillOnClose','actual.BasicLimitInformation.ActiveProcessLimit == 0','NonInheritable(job.Value)','whitelist.Length == 3 && Array.IndexOf(whitelist, job) < 0','new UIntPtr(JobListAttribute)','new UIntPtr(HandleListAttribute)'])assert.ok(s.includes(bit),bit);
  order(s,'attributes.Prepare(job.Value, new[] { stdinRead.Value, stdoutWrite.Value, stderrWrite.Value })','bool created = CreateProcessW','out pi);','process.Value = pi.hProcess; thread.Value = pi.hThread','stdinRead.CloseChecked(); stdoutWrite.CloseChecked(); stderrWrite.CloseChecked()','output = new PipeReader(stdoutRead)','ParentPid(process.Value)','IsProcessInJob(process.Value, job.Value','Require(ResumeThread(thread.Value) == 1');
  assert.ok(s.includes('CreateSuspended | ExtendedStartupInfoPresent | CreateUnicodeEnvironment | CreateNoWindow'));
  assert.ok(s.includes('private ProcessInformation pi;'));
  assert.ok(s.includes('Clock(); Require(Remaining(true) > 0, "original work budget before native create")'));
  assert.ok(s.includes('Clock(); Require(Remaining(true) > 0, "original work budget immediately before Resume")'));
  assert.ok(s.includes('if (process.Value == IntPtr.Zero && pi.hProcess != IntPtr.Zero) process.Value = pi.hProcess'));
  assert.ok(s.includes('private void Pump() { output.Pump(); errorOutput.Pump(); }'));
  order(s,'} catch (Exception primary) {','errors.Add(primary);','Capture(() => AbortJob());');
  assert.ok(s.includes('errors.Add(primary);\n     Capture(() => AbortJob());'));
  assert.ok(s.includes('accounting.ActiveProcesses == 0 && assigned == 0 && count == 0'));
  assert.ok(s.includes('Require(result.ExitCode == 0, "nonzero Dispatcher exit")')&&s.includes('exit0 with remaining outer Job members'));
 };
 test('CSharp actual atomic creation and immediate whole-job abort',()=>nativeGate(cs));
 test('CSharp three-clock original budget and no reset',()=>{
  for(const bit of ['workEnd == issued + 48000','overallEnd == issued + 60000','utcEnd == utcIssued + 60000','originalWatch.ElapsedMilliseconds','Math.Min(Math.Min(native, utc), elapsed)'])assert.ok(cs.includes(bit),bit);
  assert.ok(!cs.includes('Stopwatch.StartNew'));
 });
 test('nonblocking bounded pipe reads with true EOF and no partial frames',()=>{
  order(cs,'PeekNamedPipe(pipe.Value','if (available == 0) return','ReadFile(pipe.Value, bytes, Math.Min');
  for(const bit of ['new UTF8Encoding(false, true).GetDecoder()','Require(!PartialFrame','Math.Min(available, (uint)bytes.Length)','1048576','65536','ErrorBrokenPipe'])assert.ok(cs.includes(bit),bit);
 });
 test('all raw slots and readers independently close with retained failures',()=>{
  for(const bit of ['Capture(() => stdinRead.CloseChecked())','Capture(() => stdinWrite.CloseChecked())','Capture(() => stdoutRead.CloseChecked())','Capture(() => stdoutWrite.CloseChecked())','Capture(() => stderrRead.CloseChecked())','Capture(() => stderrWrite.CloseChecked())','Capture(() => thread.CloseChecked())','Capture(() => process.CloseChecked())','Capture(() => attributes.CloseChecked())','Capture(() => job.CloseChecked())','new AggregateException(errors)'])assert.ok(cs.includes(bit),bit);
 });
 test('success conjunctively requires actual zero terminal EOF frames and handles',()=>{
  for(const bit of ['errors.Count == 0 && result.Created && result.Resumed && result.Terminal','result.StdoutEof && result.StderrEof && !result.PartialFrame && result.JobZero && result.HandlesClosed && Remaining(false) > 0'])assert.ok(cs.includes(bit),bit);
 });
 test('wrapper binds current actual CSharp and DLL hashes before latch',()=>{
  const sh=createHash('sha256').update(cs).digest('hex'),dh=createHash('sha256').update(readFileSync(new URL('RootOuterAtomicLauncher.dll',current))).digest('hex');
  assert.ok(o.includes("$LauncherSourceSha256='"+sh+"'"));assert.ok(o.includes("$LauncherDllSha256='"+dh+"'"));
  order(tail(o),'CheckLauncherBytes','NewImmutable $clockPath','ReadLauncherDll');
  assert.ok(f(o,'ReadLauncherDll').includes('(HashBytes $bytes)-ceq$LauncherDllSha256'));
 });
 for(const [name,s]of Object.entries({o,d,r}))test('Authority/v2 exact19 and installed three-source pin '+name,()=>{
  assert.ok(f(s,'Authority').includes(AUTHORITY_FIELDS.join(' ')));
  assert.ok(f(s,'Authority').includes("'hestia.m5.authority.v2' '2'"));
  assert.ok(f(s,'ClosedBytes').includes('$d.version-ceq$version'));
  assert.ok(f(s,'CheckSources').includes("@('root-outer.ps1','outerSourceSha256')"));
  assert.ok(f(s,'ExactPath').includes('if($i-is[IO.FileInfo]){$i=$i.Directory}else{$i=$i.Parent}'));
 });
 test('unchanged15-field OuterClock and first original measurements',()=>{
  assert.ok(o.includes("$ClockFields='"+CLOCK_FIELDS.join(' ')+"'"));
  order(o,'$OuterStopwatch=[Diagnostics.Stopwatch]::StartNew()','$t0=[Environment]::TickCount64','$u0=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()','$a=Authority');
  const ni=f(o,'NewImmutable');order(ni,'[IO.FileMode]::CreateNew','$script:OuterSpent=$true','$s.Flush($true)','finally{$s.Dispose()}','$actual=Bytes $path');
  assert.ok(!/Remove-Item|File\]::Delete/.test(o));
 });
 test('exact separate managed and CIFI profiles remain pinned',()=>{
  for(const bit of ['7.6.5','.NET 10.0.11','362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139','ed80a1a5dd066c0407ad59686f9af90a4f3e55dbf3e4c973b53cc8c9d0706f82'])assert.ok(f(o,'CheckOuterProfile').includes(bit));
  for(const s of [d,r])assert.ok(f(s,'CheckSources').includes('.NET 10.0.10'));
 });
 test('retained R02 dispatcher tuple backend reservations and trusted registry chain',()=>{
  for(const s of [d,r])for(const key of ['dispatcherPid','dispatcherCreation','dispatcherImage','dispatcherParentPid'])assert.ok(f(s,'ValidateSlot').includes(key));
  assert.ok(tail(d).includes('owner=$chain.backend'));assert.ok(tail(r).includes('Match $owner $chain.backend'));
  assert.ok((tail(d).match(/AssertHeld \$held \$f \$slotHash \$c/g)||[]).length>=4);
  assert.ok(tail(r).includes('TrustedHandoffProof $done.stdout $a $c $expectedHost $records'));
  assert.ok(f(r,'TrustedHandoffProof').includes('$closedIds.SetEquals($initialIds)'));
  assert.ok(f(r,'TrustedHandoffProof').includes('Assert-ClosedPacket'));
  assert.ok(tail(d).includes('$retired=(-not$custody.startAttempted)-or($custody.started-and'));
 });
 test('existing managed inner Start failures remain uncertain not local retirement',()=>assert.equal(localRetired({startAttempted:true,started:false,terminal:false,streams:false,handleClosed:false}),false));
 for(const stage of [...CREATE_STAGES,...CLOSE_STAGES,'native-created-before-return','hidden-downstream-managed-start','nonzero-exit','exit0-members-remain','terminate-job','job-zero-proof'])test('atomic model fault '+stage,()=>{
  const faults=stage==='terminate-job'?[stage,'pump-stdout']:[stage],x=atomicModel(faults);
  assert.equal(x.pass,false);
  for(const close of CLOSE_STAGES)assert.ok(x.events.includes(close),close);
  if(x.created)assert.ok(x.events.includes('immediate-TerminateJob'));
  if(stage==='native-created-before-return'){assert.equal(x.created,true);assert.ok(x.events.indexOf('born-in-held-job')<x.events.indexOf('immediate-TerminateJob'));}
 });
 test('nominal atomic model succeeds only with all actual proof surrogates',()=>assert.equal(atomicModel().pass,true));
 for(const channel of ['stdout','stderr'])test('P2 model '+channel+' abort before further work wait',()=>{const e=readAbortModel(channel);order(e.join(','),'abort=true','throw-primary','finally-kill','drain-other-channel');assert.ok(!e.includes('wait48'))});
 test('primary plus close failures are all preserved',()=>{const x=atomicModel(['wrap-stdout','reader-stderr-close','process-close']);for(const n of ['wrap-stdout','reader-stderr-close','process-close'])assert.ok(x.errors.includes(n))});
 const c={work:49000,end:61000,utc:2000,utcEnd:62000};
 for(const now of [{native:61001,utc:2000,elapsed:0},{native:1000,utc:62001,elapsed:0},{native:1000,utc:2000,elapsed:60001}])test('independent original hard-end intersection',()=>assert.equal(remaining(c,now),0));
 const edit=(s,a,b)=>{assert.ok(s.includes(a),a);return s.replace(a,()=>b)};
 const csMutants=[
  ['drop atomic Job attribute',s=>edit(s,'new UIntPtr(JobListAttribute)','new UIntPtr(HandleListAttribute)')],
  ['weaken Job flags',s=>edit(s,'LimitFlags = KillOnClose;','LimitFlags = 0;')],
  ['inherit Job instead of stdin',s=>edit(s,'new[] { stdinRead.Value, stdoutWrite.Value, stderrWrite.Value }','new[] { job.Value, stdoutWrite.Value, stderrWrite.Value }')],
  ['drop raw ownership',s=>edit(s,'process.Value = pi.hProcess; thread.Value = pi.hThread','process.Value = IntPtr.Zero; thread.Value = IntPtr.Zero')],
  ['resume before copy close',s=>edit(s,'stdinRead.CloseChecked(); stdoutWrite.CloseChecked(); stderrWrite.CloseChecked()','stdinRead.CloseChecked()')],
  ['remove pre-resume membership',s=>edit(s,'IsProcessInJob(process.Value, job.Value','IsProcessInJob(process.Value, IntPtr.Zero')],
  ['weaken exact resume',s=>edit(s,'Require(ResumeThread(thread.Value) == 1','Require(ResumeThread(thread.Value) != 0')],
  ['omit original clock before native create',s=>edit(s,'Clock(); Require(Remaining(true) > 0, "original work budget before native create")','Require(true, "original work budget before native create")')],
  ['omit fresh clock before resume',s=>edit(s,'Clock(); Require(Remaining(true) > 0, "original work budget immediately before Resume")','Require(true, "original work budget immediately before Resume")')],
  ['swallow CSharp Pump error',s=>edit(s,'private void Pump() { output.Pump(); errorOutput.Pump(); }','private void Pump() { try { output.Pump(); errorOutput.Pump(); } catch { } }')],
  ['delay terminate after primary',s=>edit(s,'Capture(() => AbortJob()); // First failure cleanup action','Capture(() => Clock()); // First failure cleanup action')],
  ['weaken JobZero to accounting only',s=>edit(s,'accounting.ActiveProcesses == 0 && assigned == 0 && count == 0','accounting.ActiveProcesses == 0')],
  ['accept nonzero exit',s=>edit(s,'result.ExitCode == 0','result.ExitCode >= 0')],
 ];
 for(const [name,mutate]of csMutants)test('actual CSharp mutation '+name,()=>assert.throws(()=>nativeGate(mutate(cs))));
 for(const [name,mutate]of [
  ['old outer managed route',s=>s+'\n$p.Start()\n'],
  ['load before clock',s=>edit(s,'$launchBytes=ReadLauncherDll',"$launchBytes=$null")],
  ['marker result accepted',s=>edit(s,'$done.JobZero',"$done.stdout.Contains('jobZero')")],
 ])test('actual outer mutation '+name,()=>assert.throws(()=>seam({...files,o:mutate(o)})));
 for(const [name,mutate]of [
  ['swallowed read',s=>edit(s,'$child.errors.Add($_.Exception);throw','$child.errors.Add($_.Exception)')],
  ['abort flag removed',s=>edit(s,'$s.broken=$true;$child.abort=$true;','$s.broken=$true;')],
 ])test('P2 marker-preserving mutant '+name,()=>assert.throws(()=>p2({...files,d:mutate(d)})));

 // Restored accepted behavioral contracts; all objects below are synthetic, in-memory only.
 const tupleGate=s=>{const x=f(s,'CheckAncestry');for(const bit of ['pid=$slot.dispatcherPid;creation=$slot.dispatcherCreation;image=$slot.dispatcherImage;parentPid=$slot.dispatcherParentPid','Match $dispatcher (Observe','Match $managed (Observe','Match $backend (Observe'])assert.ok(x.includes(bit),bit);};
 const reservationGate=s=>{const x=f(s,'AssertHeld');for(const bit of ['$h.Name-ceq$paths[$i]','$h.SafeFileHandle.IsClosed','$h.Length-eq$expected.Length','$h.Read($actual,0,$actual.Length)-eq$actual.Length','Need ([Convert]::ToBase64String($actual)-ceq[Convert]::ToBase64String($expected))'])assert.ok(x.includes(bit),bit);};
 const ownershipGate=s=>{const t=tail(s),b=f(s,'BeginChild');assert.ok(!t.includes('FinishChild $child $c'));assert.match(t,/\$owned=\$child;\$child=\$null;\s+\$done=FinishChild \$owned \$c/);assert.ok(t.includes('$owned=$child;$child=$null;$owned.abort=$true;try{[void](FinishChild $owned $c)}'));order(b,'$custody.child=$child','$custody.startAttempted=$true',"Need ($p.Start()) 'fixed child start'",'$custody.started=$true','$child.handle=$p.SafeHandle');};
 const typedGate=s=>assert.ok(tail(s).includes("Need ($null-ne$done-and$done.GetType().Assembly-eq$assembly-and$done.GetType().FullName-ceq'Hestia.M5.RootOuterR04.LaunchResult')"));
 for(const [name,s]of [['dispatcher',d],['runner',r]]){
  test('restored actual tuple values '+name,()=>tupleGate(s));
  test('restored actual reservation bytes/path '+name,()=>reservationGate(s));
  test('restored inner ownership before every finisher '+name,()=>ownershipGate(s));
  test('tuple creation-to-PID marker-preserving mutant '+name,()=>assert.throws(()=>tupleGate(edit(s,'creation=$slot.dispatcherCreation','creation=$slot.dispatcherPid'))));
  test('held-byte predicate true mutant '+name,()=>assert.throws(()=>reservationGate(edit(s,'Need ([Convert]::ToBase64String($actual)-ceq[Convert]::ToBase64String($expected))','Need ($true)'))));
  test('normal ownership after finish mutant '+name,()=>assert.throws(()=>ownershipGate(edit(s,'$owned=$child;$child=$null;\n $done=FinishChild $owned $c','$owned=$child;\n $done=FinishChild $owned $c;$child=$null;'))));
  test('finally ownership after finish mutant '+name,()=>assert.throws(()=>ownershipGate(edit(s,'$owned=$child;$child=$null;$owned.abort=$true;try{[void](FinishChild $owned $c)}','$owned=$child;$owned.abort=$true;try{[void](FinishChild $owned $c);$child=$null}'))));
 }
 test('actual exact launcher result assembly/type',()=>typedGate(o));
 test('typed result Need true mutant',()=>assert.throws(()=>typedGate(edit(o,"Need ($null-ne$done-and$done.GetType().Assembly-eq$assembly-and$done.GetType().FullName-ceq'Hestia.M5.RootOuterR04.LaunchResult')",'Need ($true)'))));
 const clockGate=(s,outer=false)=>{const x=f(s,'Clock');for(const bit of ['$n=[Environment]::TickCount64','$u=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()','$n-ge(Dec $c.issued)','$n-le(Dec $c.overallEnd)','$u-ge(Dec $c.utcIssued)','$u-le(Dec $c.utcEnd)'])assert.ok(x.includes(bit),bit);if(outer){assert.ok(x.includes('$OuterStopwatch.ElapsedMilliseconds-le60000'));const rem=f(s,'Remaining');for(const z of ['$nativeEnd-[Environment]::TickCount64','$utcEnd-[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()','$swEnd-$OuterStopwatch.ElapsedMilliseconds'])assert.ok(rem.includes(z),z);assert.ok(f(s,'AddClock').includes('[long]::MaxValue-$delta'));}};
 for(const [name,s]of [['outer',o],['dispatcher',d],['runner',r]]){
  test('actual original clocks '+name,()=>clockGate(s,name==='outer'));
  for(const [from,to]of [['$n=[Environment]::TickCount64','$n=0'],['$n-le(Dec $c.overallEnd)','$n-ge(Dec $c.overallEnd)'],['$u-le(Dec $c.utcEnd)','$true']])test('clock behavioral mutant '+name+' '+from,()=>assert.throws(()=>clockGate(edit(s,from,to),name==='outer')));
 }
 for(const [from,to]of [['$OuterStopwatch.ElapsedMilliseconds-le60000','$true'],['$nativeEnd-[Environment]::TickCount64','$nativeEnd'],['$utcEnd-[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()','$utcEnd'],['$swEnd-$OuterStopwatch.ElapsedMilliseconds','$swEnd'],['[long]::MaxValue-$delta','[long]::MaxValue']])test('outer original clock intersection mutant '+from,()=>assert.throws(()=>clockGate(edit(o,from,to),true)));
 const a=Object.fromEntries(AUTHORITY_FIELDS.map(k=>[k,'PURE_MODEL']));
 Object.assign(a,{schema:'hestia.m5.authority.v2',version:'2',humanMessageRef:'PURE_MODEL_REF',authorizationClass:'DIRECT_HUMAN_RUNTIME_ONCE',scope:'HARMLESS_SIX_ONCE',retry:'0',actualAppThread:'01a13648-c55b-7250-bf07-34921d70b43b',actualAppTurn:'11111111-1111-4111-8111-111111111111',paseoAgent:'11111111-1111-4111-8111-111111111111',appStatus:'LOADED_CURRENT_A0',workspace:'wks_pure_model',notBeforeUtc:'1000',expiresUtc:'61000'});
 for(const k of ['humanMessageSha256','candidateManifestSha256','packagePinsSha256','outerSourceSha256','dispatcherSourceSha256','runnerSourceSha256'])a[k]='a'.repeat(64);
 const text=JSON.stringify(a),facts={genuineRootAuthority:true,currentLoadedA0:true,utcIssued:1000n,utcEnd:61000n};
 test('restored closed Authority canonical model',()=>assert.deepEqual(admitAuthorityV2(text,facts),a));
 for(const [name,v]of [['missing',(()=>{const q={...a};delete q.outerSourceSha256;return q})()],['unknown',{...a,extra:'x'}],['nonstring',{...a,retry:0}],['v1',{...a,schema:'hestia.m5.authority.v1',version:'1'}],['badouterhash',{...a,outerSourceSha256:'bad'}],['badnumeric',{...a,notBeforeUtc:'01'}],['overflow',{...a,expiresUtc:'9223372036854775808'}],['oldgrant',{...a,humanMessageRef:'call_f75fff55e3a34653b255fd83365457ca'}],['wrongthread',{...a,actualAppThread:'other'}],['retry',{...a,retry:'1'}],['scope',{...a,scope:'OTHER'}]])test('closed authority rejects '+name,()=>assert.throws(()=>admitAuthorityV2(JSON.stringify(v),facts)));
 for(const [name,v]of [['duplicate',text.slice(0,-1)+',"outerSourceSha256":"'+a.outerSourceSha256+'"}'],['BOM','\ufeff'+text],['noncanonical',' '+text],['oversize','x'.repeat(65537)],['order',JSON.stringify(Object.fromEntries(Object.entries(a).reverse()))]])test('closed authority bytes reject '+name,()=>assert.throws(()=>parseAuthorityV2(v)));
 for(const v of [{...facts,genuineRootAuthority:false},{...facts,currentLoadedA0:false},{...facts,utcIssued:999n},{...facts,utcEnd:61001n}])test('independent logical authority and full original coverage',()=>assert.throws(()=>admitAuthorityV2(text,v)));
 for(const [origin,delta]of [[1000n,48000n],[1000n,60000n]])test('checked original clock arithmetic '+delta,()=>assert.equal(checkedClock(origin,delta),origin+delta));
 for(const [origin,delta]of [[-1n,48000n],[9223372036854775807n,1n],[0n,-1n]])test('checked clock overflow/negative rejects',()=>assert.throws(()=>checkedClock(origin,delta)));
 for(const [name,v]of [['profile',{profile:false}],['authority',{authority:false}],['pins',{pins:false}],['preflight expiry',{expiredPreflight:true}],['preexisting valid',{slot:'valid'}],['preexisting partial',{slot:'partial'}],['preexisting malformed',{slot:'malformed'}],['work expiry after publication',{workExpired:true}],['flush',{fail:'flush'}],['close',{fail:'close'}],['readback',{fail:'readback'}]])test('outer no-retry zero starts '+name,()=>assert.equal(outerAttempt(v).starts,0));
 for(const v of [{workExpired:true},{fail:'flush'},{fail:'close'},{fail:'readback'}])test('post-creation failure stays spent',()=>assert.equal(outerAttempt(v).status,'SPENT_HOLD'));
 const preservedR04Passed=passed;

 // PRESTART additions preserve all 158 accepted R04 predicates above.
 const producer=read('OriginProducer.mjs',current);
 const originFields='schema version authorityRecordSha256 humanMessageSha256 outerSourceSha256 producerSourceSha256 producerHostProfile platform nodeTimeOriginMicros clockMode nativeClockApi utcClockApi monotonicClockApi nativeIssued workEnd overallEnd utcIssued utcEnd monotonicIssuedMicros nativeBeforeWrite utcBeforeWrite monotonicBeforeWriteMicros';
 const producerGate=p=>{
  const i=p.indexOf('export function issueOrigin(){'),j=p.indexOf('export function finishAfterExec');
  assert.ok(i>=0&&j>i);const body=p.slice(i,j);
  order(body,'const monotonicIssued=performance.now();','const utcIssued=Date.now();','const uptimeSeconds=os.uptime();','const profile=qualifiedHostProfile()','readBounded(AUTHORITY)',"fs.openSync(ORIGIN,'wx')",'fs.fsyncSync(fd)','fs.closeSync(fd)','const back=readBounded(ORIGIN)');
  assert.ok(body.includes('const nativeIssued=Math.floor(uptimeSeconds)*1000'));
  assert.ok(p.includes('native=Math.ceil(os.uptime()*1000)'));
  assert.ok(p.includes('Number.isSafeInteger(native)&&native>=0'));
  assert.ok(p.includes('String(proof.nativeWorkEnd)===String(issuedTicket.workEnd)'));
  assert.ok(p.includes("throw Error('NODE_PROFILE_HOLD:"));assert.ok(p.includes("status:'UNKNOWN'"));
  assert.ok(!/node:process|node:vm|node:module|inspector|require\(/.test(p));
  assert.ok(body.includes("matches[0][1]===sha(selfBytes)"));
  assert.ok(body.includes('sha(outerBytes)===a.outerSourceSha256'));
  assert.ok(body.includes("need(!attemptBegan,'one attempt only; no second issuer/root call');attemptBegan=true"));
  const end=p.slice(j);
  for(const bit of ['micros(performance.timeOrigin)===ticket.nodeTimeOriginMicros','mono-ticket.monotonicIssuedMicros<=60000000',"reply.exit_code===0&&reply.session_id===undefined",'p.StdoutEof===true&&p.StderrEof===true&&p.JobZero===true&&p.HandlesClosed===true'])assert.ok(p.includes(bit),bit);
 };
 const originConsumerGate=({o,d,r})=>{
  for(const s of [o,d,r]){
   const x=f(s,'ReadExternalOrigin');assert.ok(x.includes(originFields));assert.ok(x.includes("ExpectedProducerHostProfile-cne'UNKNOWN'"));assert.ok(x.includes('producerSourceSha256-ceq(ExpectedOriginProducerHash $a)'));
   for(const bit of ['original external 48/60','pre-start origin <= actual managed entry','NODE_PROFILE_HOLD','monotonicBeforeWriteMicros'])assert.ok(x.includes(bit),bit);
   assert.ok(f(s,'ExpectedOriginProducerHash').includes('(HashBytes $bytes)-ceq$a.outerSourceSha256'));
  }
  order(tail(o),'$a=Authority','$origin=ReadExternalOrigin $a $t0 $u0','NewImmutable $clockPath','$assembly=[Reflection.Assembly]::Load');
  assert.ok(tail(o).includes('$nativeIssued=Dec $origin.nativeIssued'));
  assert.ok(tail(o).includes('$workEnd=Dec $origin.workEnd;$overallEnd=Dec $origin.overallEnd;$utcIssued=Dec $origin.utcIssued;$utcEnd=Dec $origin.utcEnd'));
  assert.ok(tail(o).includes('@([long]$nativeIssued,[long]$workEnd,[long]$overallEnd,[long]$utcIssued,[long]$utcEnd,$OuterStopwatch'));
  for(const s of [d,r]){
   const x=f(s,'OuterClock');order(x,'$o=ReadExternalOrigin','ReadClosed');
   assert.ok(x.includes("'ROOT_EXTERNAL_ORIGIN_V1:'+(HashBytes (Compact $o))"));
   assert.ok(x.includes('$c.issued-ceq$o.nativeIssued'));
   assert.ok(x.includes('$c.nativeClockApi-ceq$o.nativeClockApi-and$c.utcClockApi-ceq$o.utcClockApi'));
  }
 };
 test('actual preloaded Producer earliest samples floor and immutable issue chain',()=>producerGate(producer));
 test('actual all three consumers require original origin and truthful profile hold',()=>originConsumerGate(files));
 const prior=new URL('../benni-pc-m5-root-runner-source-r04/',current);
 test('PRESTART RED: actual frozen R04 consumers are rejected',()=>assert.throws(()=>originConsumerGate({o:read('root-outer.ps1',prior),d:read('root-dispatch.ps1',prior),r:read('root-runner.ps1',prior)})));
 test('Producer SHA fixed transitively in actual outer',()=>assert.ok(o.includes("$OriginProducerSha256='"+createHash('sha256').update(producer).digest('hex')+"'")));
 for(const [name,mutate]of [
  ['late first monotonic sample',p=>edit(p,'const monotonicIssued=performance.now();','const monotonicIssued=0;')],
  ['round instead of floor',p=>edit(p,'Math.floor(uptimeSeconds)*1000','Math.round(uptimeSeconds)*1000')],
  ['later native floor mutant',p=>edit(p,'native=Math.ceil(os.uptime()*1000)','native=Math.floor(os.uptime())*1000')],
  ['completion work endpoint dropped',p=>edit(p,'String(proof.nativeWorkEnd)===String(issuedTicket.workEnd)&&','')],
  ['ceil instead of floor',p=>edit(p,'Math.floor(uptimeSeconds)*1000','Math.ceil(uptimeSeconds)*1000')],
  ['overwrite origin instead of wx',p=>edit(p,"fs.openSync(ORIGIN,'wx')","fs.openSync(ORIGIN,'w')")],
  ['drop fsync',p=>edit(p,'fs.fsyncSync(fd)','void fd')],
  ['drop separate readback',p=>edit(p,'const back=readBounded(ORIGIN)','const back=bytes')],
  ['drop expected outer binding',p=>edit(p,'sha(outerBytes)===a.outerSourceSha256','true')],
  ['drop no retry',p=>edit(p,'attemptBegan=true','attemptBegan=false')],
  ['allow running session completion',p=>edit(p,'reply.exit_code===0&&reply.session_id===undefined','reply.exit_code===0')],
  ['weaken persistent origin completion',p=>edit(p,'micros(performance.timeOrigin)===ticket.nodeTimeOriginMicros','true')],
 ])test('Producer behavior mutant '+name,()=>assert.throws(()=>producerGate(mutate(producer))));
 test('managed-native reset mutant rejected',()=>assert.throws(()=>originConsumerGate({...files,o:edit(o,'$nativeIssued=Dec $origin.nativeIssued','$nativeIssued=$t0')})));
 test('weaken Origin hash in actual Runner rejected',()=>assert.throws(()=>originConsumerGate({...files,r:edit(r,"'ROOT_EXTERNAL_ORIGIN_V1:'+(HashBytes (Compact $o))","'ROOT_EXTERNAL_ORIGIN_V1:ignored'")})));
 test('remove actual Dispatcher origin read rejected',()=>assert.throws(()=>originConsumerGate({...files,d:edit(d,'$o=ReadExternalOrigin $a','$o=$a;# ReadExternalOrigin $a')})));
 const sample=originSamples(100.999,1000000,5000,1000000000);
 test('floor second is conservative and preserves 48/60',()=>{assert.equal(sample.issued,100000);assert.equal(sample.work,148000);assert.equal(sample.end,160000);assert.equal(sample.utcEnd,1060000)});
 const rec=Object.fromEntries(ORIGIN_FIELDS.map(k=>[k,'PURE_MODEL']));
 Object.assign(rec,{schema:'hestia.m5.external-origin.v1',version:'1',producerHostProfile:'SYNTHETIC_QUALIFIED_PROFILE',platform:'win32',nodeTimeOriginMicros:'1000000000',clockMode:'PRESTART_NODE_PRODUCER',nativeClockApi:'node:os.uptime/libuv:GetTickCount64/FLOOR_ORIGIN_CEIL_OBSERVATION',utcClockApi:'Date.now',monotonicClockApi:'node:perf_hooks.performance.now',nativeIssued:'100000',workEnd:'148000',overallEnd:'160000',utcIssued:'1000000',utcEnd:'1060000',monotonicIssuedMicros:'5000',nativeBeforeWrite:'101000',utcBeforeWrite:'1001000',monotonicBeforeWriteMicros:'1005000'});
 for(const k of ['authorityRecordSha256','humanMessageSha256','outerSourceSha256','producerSourceSha256'])rec[k]='b'.repeat(64);
 const of={genuineRootBinding:true,profileQualified:true,imageSourceProven:true,apiDomainQualified:true,profile:rec.producerHostProfile,timeOrigin:rec.nodeTimeOriginMicros,completionTimeOrigin:rec.nodeTimeOriginMicros,entryNative:110000,entryUtc:1010000,nowNative:150000,nowUtc:1050000,workEndReceived:148000,monotonicElapsed:50000000,terminal:true,streams:true,handlesClosed:true,running:false};
 for(const k of ['authorityRecordSha256','humanMessageSha256','outerSourceSha256','producerSourceSha256'])of[k]=rec[k];
 test('synthetic qualified origin model only',()=>assert.deepEqual(admitOrigin(JSON.stringify(rec),of),rec));
 test('actual endpoint plus1ms conservative observation rejects',()=>assert.throws(()=>admitOrigin(JSON.stringify(rec),{...of,nowNative:conservativeNativeObservation(160.001)})));
 test('completion work end reset rejects',()=>assert.throws(()=>admitOrigin(JSON.stringify(rec),{...of,workEndReceived:158000})));
 for(const k of ['genuineRootBinding','profileQualified','imageSourceProven','apiDomainQualified','terminal','streams','handlesClosed'])test('missing independent '+k+' denies Origin',()=>assert.throws(()=>admitOrigin(JSON.stringify(rec),{...of,[k]:false})));
 for(const bad of [{...of,entryNative:148000},{...of,entryUtc:1048000},{...of,nowNative:160001},{...of,nowUtc:1060001},{...of,monotonicElapsed:60000001},{...of,timeOrigin:'other'},{...of,completionTimeOrigin:'other'},{...of,running:true}])test('origin startup/completion original budget or host negative',()=>assert.throws(()=>admitOrigin(JSON.stringify(rec),bad)));
 const badRecords=[
  {...rec,platform:'linux'},{...rec,nativeClockApi:'System.Environment.TickCount64'},{...rec,producerHostProfile:'CALLER_GUID'},{...rec,overallEnd:'170000'},{...rec,workEnd:'158000'},{...rec,nativeIssued:'110000'},{...rec,nativeBeforeWrite:'148000'},{...rec,monotonicBeforeWriteMicros:'48005000'},{...rec,producerSourceSha256:'a'.repeat(64)},{...rec,version:1},{...rec,extra:'unknown'}
 ];
 for(const v of badRecords)test('closed origin wrong domain/profile/hash/endpoint/type rejects',()=>assert.throws(()=>admitOrigin(JSON.stringify(v),of)));
 const rt=JSON.stringify(rec);
 for(const v of [' '+rt,rt.slice(0,-1)+',"platform":"win32"}',JSON.stringify(Object.fromEntries(Object.entries(rec).reverse()))])test('canonical origin duplicate/order/whitespace rejected',()=>assert.throws(()=>admitOrigin(v,of)));
 test('exec failure spends origin and forbids second producer',()=>assert.throws(()=>originAttempt(['create','root','exec-fail','create'])));
 test('preexisting Origin denies producer and Root',()=>assert.throws(()=>originAttempt(['preexisting','create','root'])));
 test('partial Origin denies repair and Root',()=>assert.throws(()=>originAttempt(['partial','create','root'])));
 test('exec failure never permits second Root',()=>assert.throws(()=>originAttempt(['create','root','exec-fail','root'])));
 test('Source copies CS DLL helper exactly equal frozen R04',()=>{
  for(const n of ['RootOuterAtomicLauncher.cs','RootOuterAtomicLauncher.dll','compile-root-outer-launcher.ps1'])assert.deepEqual(readFileSync(new URL(n,current)),readFileSync(new URL(n,prior)),n);
 });
 const sha=s=>createHash('sha256').update(s).digest('hex');
 console.log(JSON.stringify({mode:'R04 actual native/wrapper source guards and pure models',passed,failed,results,hashes:{outer:sha(o),dispatcher:sha(d),runner:sha(r),launcherSource:sha(cs),launcherDll:sha(readFileSync(new URL('RootOuterAtomicLauncher.dll',current)))},generatedAssemblyLoaded:false,psBodiesExecuted:0,nativeMethodsInvoked:0,actualRootRecordsCreated:0}));
 process.exitCode=failed?1:0;
}
