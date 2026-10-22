import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const base=process.argv[2]||'.';const core=readFileSync(new URL(base+'/Native24Family.cs',import.meta.url),'utf8');
const from=core.indexOf('} catch (Exception primary)',core.indexOf('private static BoundProcess CreateFixedRoot')),end=core.indexOf('} finally {',from),cleanup=core.slice(from,end),factory=core.slice(core.indexOf('private static BoundProcess CreateFixedRoot'),end);
const host=readFileSync(new URL(base+'/RootHost.cs',import.meta.url),'utf8'),companion=readFileSync(new URL(base+'/HarmlessQualification.cs',import.meta.url),'utf8');
const registry=readFileSync(new URL(base+'/RootSubjectRegistry.cs',import.meta.url),'utf8'),client=readFileSync(new URL(base+'/RootSubjectClient.cs',import.meta.url),'utf8');
let passed=0,failed=0;function test(n,f){try{f();passed++;console.log('PASS '+n)}catch(e){failed++;console.log('FAIL '+n+': '+e.message)}}function order(s,...parts){let p=-1;for(const n of parts){const i=s.indexOf(n,p+1);assert.ok(i>p,n);p=i}}
const gated=s=>/if\s*\(\s*cleanupFailure\s*==\s*null\s*\)/.test(s);
function cleanupGate(s){assert.ok(!gated(s),'earlier failure must never gate owned close');order(s,'TerminateJobObject(job, ExpectedJobExitCode)','WaitExited(pi.hProcess, cleanupEnd)','QueryAccounting(job).ActiveProcesses == 0','try { if(relayOutput!=null){relayOutput.CloseChecked();relayOutput=null;} } catch(Exception e) { CaptureCleanupFailure(ref cleanupFailure,e); }','if (root != null)','try { root.CloseChecked(); } catch(Exception e) { CaptureCleanupFailure(ref cleanupFailure,e); }','else {','try { CloseRawChecked(pi.hThread, "failed root thread"); } catch(Exception e) { CaptureCleanupFailure(ref cleanupFailure,e); }','try { CloseRawChecked(pi.hProcess, "failed root process"); } catch(Exception e) { CaptureCleanupFailure(ref cleanupFailure,e); }');assert.ok(s.includes('primary, cleanupFailure'));assert.ok(!/Eof\s*=\s*true|jobZero\s*=\s*true|Terminal\s*=\s*true/.test(s))}
test('actual shared catch always attempts owned cleanup after prior error',()=>cleanupGate(cleanup));
test('actual ownership exists before fallible attach and before publication',()=>order(factory,'root = new BoundProcess{Process=new OwnedHandle(pi.hProcess),Thread=new OwnedHandle(pi.hThread),Pid=pi.dwProcessId,RootChannel=channel}','RootSubjectClient.Attach(root);channel.Output.DisposeLocalCopyOfClientHandle();','publishedRoot = root;'));
test('actual BoundProcess keeps independent channel thread process attempts',()=>{const f=core.slice(core.indexOf('public void CloseChecked() {',core.indexOf('private sealed class BoundProcess')),core.indexOf('// No instance exists'));order(f,'RootSubjectClient.CloseChannel(this)','Thread.CloseChecked()','Process.CloseChecked()','if (failure != null) throw failure');assert.equal((f.match(/CaptureCleanupFailure/g)||[]).length,3)});
const mutants=[
 ['reintroduced cleanupFailure gate with all close markers retained',s=>s.replace('try { if(relayOutput!=null)','if (cleanupFailure == null) { try { if(relayOutput!=null)').replace('                }\n                if (cleanupFailure != null)','                    }\n                }\n                if (cleanupFailure != null)')],
 ['conditional gate around all owned attempts',s=>s.replace('try { if(relayOutput!=null)','if(cleanupFailure==null) try { if(relayOutput!=null)')],
 ['relay close failure skips BoundProcess close',s=>s.replace('} catch(Exception e) { CaptureCleanupFailure(ref cleanupFailure,e); }\n                    if (root != null)', '; if (root != null)')],
 ['BoundProcess close removed',s=>s.replace('root.CloseChecked();','')],
 ['raw thread and process sequential in one try',s=>s.replace(' } catch(Exception e) { CaptureCleanupFailure(ref cleanupFailure,e); }\n                        try { CloseRawChecked(pi.hProcess', '; CloseRawChecked(pi.hProcess')],
 ['raw process close removed',s=>s.replace('CloseRawChecked(pi.hProcess, "failed root process");','')],
 ['raw thread close removed',s=>s.replace('CloseRawChecked(pi.hThread, "failed root thread");','')],
 ['primary exception dropped',s=>s.replace('primary, cleanupFailure','cleanupFailure')],
 ['fabricated EOF after cleanup',s=>s+' channel.Eof=true;'],
 ['fabricated jobzero after failed accounting',s=>s+' jobZero=true;']
];
for(const[n,mutate]of mutants)test('marker-preserving source mutant '+n,()=>{const m=mutate(cleanup);assert.notEqual(m,cleanup);assert.throws(()=>cleanupGate(m))});
// LIMITED C# branch/ownership projection driven by presence of the actual cleanupFailure gate and independent raw catches.
// This does not execute C# or any generated/native method.
function project(s,{prior=null,root=true,published=false,relayFail=false,threadFail=false,processFail=false,boundFail=false}={}){
 const events=[],errors=['primary'];let zero=false;
 if(prior){events.push(prior);errors.push(prior)}else{events.push('Terminate','Wait','Accounting');zero=true}
 const priorFailure=prior!==null;
 if(!gated(s)||!priorFailure){
  events.push('relay');if(relayFail)errors.push('relay');
  if(root){
   events.push('bound','channel','thread','process');if(boundFail)errors.push('bound');if(threadFail)errors.push('thread');if(processFail)errors.push('process');
  }else{
   events.push('raw-thread');if(threadFail)errors.push('raw-thread');
   const independent=s.includes('try { CloseRawChecked(pi.hProcess, "failed root process"); } catch(Exception e)');
   if(!threadFail||independent){events.push('raw-process');if(processFail)errors.push('raw-process')}
  }
 }
 return {events,errors,hold:true,zero,published,retirementProven:zero&&!priorFailure};
}
for(const prior of ['Terminate','Wait','Accounting'])for(const root of [true,false])test('limited prior '+prior+' failure still closes '+(root?'bound':'raw')+' ownership',()=>{const v=project(cleanup,{prior,root});assert.ok(v.events.includes('relay'));assert.ok(v.events.includes(root?'bound':'raw-process'));assert.equal(v.zero,false);assert.equal(v.retirementProven,false);assert.equal(v.hold,true);assert.ok(v.errors.includes(prior))});
for(const phase of ['attach','client-copy'])test('limited '+phase+' failure before publication retains local owned cleanup',()=>{const v=project(cleanup,{prior:'Wait',root:true,published:false});assert.equal(v.published,false);assert.ok(v.events.includes('channel'));assert.ok(v.events.includes('thread'));assert.ok(v.events.includes('process'));assert.equal(v.hold,true)});
test('limited relay close failure still attempts BoundProcess close',()=>{cleanupGate(cleanup);const v=project(cleanup,{prior:'Accounting',relayFail:true});assert.ok(v.events.indexOf('relay')<v.events.indexOf('bound'));assert.ok(v.errors.includes('relay'));assert.ok(v.events.includes('process'));assert.equal(v.hold,true)});
test('limited raw thread close failure still attempts raw process close',()=>{const v=project(cleanup,{root:false,threadFail:true});assert.ok(v.events.includes('raw-process'));assert.ok(v.errors.includes('raw-thread'));assert.equal(v.hold,true)});
test('limited all close errors retain primary and HOLD',()=>{cleanupGate(cleanup);const v=project(cleanup,{prior:'Terminate',relayFail:true,boundFail:true,threadFail:true,processFail:true});for(const e of ['primary','Terminate','relay','bound','thread','process'])assert.ok(v.errors.includes(e));assert.equal(v.zero,false);assert.equal(v.hold,true)});
test('limited successful owned close never turns original creation failure into PASS',()=>{cleanupGate(cleanup);assert.equal(project(cleanup).hold,true)});

const control=companion.slice(companion.indexOf('private static ControlActor StartFixedControl'),companion.indexOf('private static void RetireOwnedControl'));
const creator=host.slice(host.indexOf('private void CreateController'),host.indexOf('private string controllerFrameHash'));
const outer=host.slice(host.indexOf('public int Run()'));
function controlGate(s){assert.doesNotMatch(s,/if\s*\(\s*(?:failure\s*==\s*null|null\s*==\s*failure)\s*\)/,'owned cleanup must not depend on absence of an earlier failure');for(const part of ['try{if(attrs!=null)attrs.Dispose();}','try{if(relayOutput!=null)relayOutput.CloseChecked();}','try{if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);}','try{if(input!=null)input.CloseChecked();}'])assert.ok(s.includes(part+'catch(Exception e){CaptureCleanupFailure(ref failure,e);}'),part);assert.ok(s.includes('failure=e;throw;'));assert.ok(s.includes('throw new InvalidOperationException("HOLD_CONTROL_CREATION_OR_RELEASE",failure)'))}
function creatorGate(s){assert.doesNotMatch(s,/if\s*\(\s*(?:failure\s*==\s*null|null\s*==\s*failure)\s*\)/,'owned cleanup must not depend on absence of an earlier failure');for(const part of ['try{if(attrs!=null)attrs.Dispose();}','try{if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);}','try{if(stdinClient!=null)stdinClient.CloseChecked();}','try{if(stdoutClient!=null)stdoutClient.CloseChecked();}','try{if(stderrClient!=null)stderrClient.CloseChecked();}'])assert.ok(s.includes(part+'catch(Exception e){CaptureCleanupFailure(ref failure,e);}'),part);order(s,'catch(Exception e){failure=e;}','finally{','if(failure!=null&&controller==null&&pi.hProcess!=IntPtr.Zero)controller=new BoundProcess','if(failure!=null)throw failure;')}
function outerGate(s){assert.doesNotMatch(s,/if\s*\(\s*(?:failure\s*==\s*null|null\s*==\s*failure)\s*\)/,'owned cleanup must not depend on absence of an earlier failure');order(s,'streamsComplete=channel.Eof&&errorChannel.Eof;','if(channel!=null)try{channel.Dispose();Require(channel.Closed','catch(Exception e){CaptureCleanupFailure(ref failure,e);}','if(errorChannel!=null)try{errorChannel.Dispose();Require(errorChannel.Closed','catch(Exception e){CaptureCleanupFailure(ref failure,e);}','controller.CloseChecked()');assert.ok(s.includes('bool pass=failure==null&&controllerTerminal&&jobZero'))}
test('actual fixed control independently closes relay env and input with primary',()=>controlGate(control));
test('actual Root creator independently attempts all local closes and preserves controller',()=>creatorGate(creator));
test('actual Root stdout and stderr close independently even drain failure',()=>outerGate(outer));
const more=[
 ['control relay failure skips input',control,controlGate,s=>s.replace('try{if(relayOutput!=null)relayOutput.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','if(relayOutput!=null)relayOutput.CloseChecked();')],
 ['control env failure skips input',control,controlGate,s=>s.replace('try{if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);')],
 ['control primary lost',control,controlGate,s=>s.replace('failure=e;throw;','failure=null;throw;')],
 ['Root attrs failure skips all streams',creator,creatorGate,s=>s.replace('try{if(attrs!=null)attrs.Dispose();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','if(attrs!=null)attrs.Dispose();')],
 ['Root stdin failure skips stdout stderr',creator,creatorGate,s=>s.replace('try{if(stdinClient!=null)stdinClient.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','if(stdinClient!=null)stdinClient.CloseChecked();')],
 ['Root stdout failure skips stderr',creator,creatorGate,s=>s.replace('try{if(stdoutClient!=null)stdoutClient.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','if(stdoutClient!=null)stdoutClient.CloseChecked();')],
 ['Root creation primary masked',creator,creatorGate,s=>s.replace('catch(Exception e){failure=e;}','catch(Exception e){failure=null;}')],
 ['Root created unpublished controller stranded',creator,creatorGate,s=>s.replace('controller==null&&pi.hProcess!=IntPtr.Zero','controller==null&&false')],
 ['Root second channel close skipped after first error',outer,outerGate,s=>s.replace('if(errorChannel!=null)try{errorChannel.Dispose();Require(errorChannel.Closed','if(errorChannel!=null)try{Require(errorChannel.Closed')],
 ['Root HOLD lost after cleanup error',outer,outerGate,s=>s.replace('bool pass=failure==null&&controllerTerminal&&jobZero','bool pass=controllerTerminal&&jobZero')]
];
for(const[n,s,gate,mutate]of more)test('marker-preserving addendum mutant '+n,()=>{const m=mutate(s);assert.notEqual(m,s);assert.throws(()=>gate(m))});
function independentProjection(names,failures){const attempted=[],errors=['primary'];for(const name of names){try{attempted.push(name);if(failures.includes(name))throw Error(name)}catch(e){errors.push(e.message)}}return {attempted,errors,hold:errors.length>0,eofClaim:false,jobzeroClaim:false}}
for(const failed of [['relay'],['env'],['attrs','relay','input']])test('limited fixed control error combination '+failed,()=>{controlGate(control);const v=independentProjection(['attrs','relay','env','input'],failed);assert.deepEqual(v.attempted,['attrs','relay','env','input']);for(const e of ['primary',...failed])assert.ok(v.errors.includes(e));assert.equal(v.hold,true)});
for(const failed of [['attrs'],['stdin','stdout'],['attrs','env','stdin','stdout','stderr']])test('limited Root creator error combination '+failed,()=>{creatorGate(creator);const v=independentProjection(['attrs','env','stdin','stdout','stderr'],failed);assert.deepEqual(v.attempted,['attrs','env','stdin','stdout','stderr']);for(const e of ['primary',...failed])assert.ok(v.errors.includes(e));assert.equal(v.hold,true)});
test('limited first channel dispose error still attempts second and later own closes',()=>{outerGate(outer);const v=independentProjection(['stdout-channel','stderr-channel','controller','job'],['stdout-channel']);assert.deepEqual(v.attempted,['stdout-channel','stderr-channel','controller','job']);assert.equal(v.eofClaim,false);assert.equal(v.jobzeroClaim,false);assert.equal(v.hold,true)});


test('actual Native creator finally cannot skip owned pipe cleanup on attrs or env error',()=>{const f=core.slice(end,core.indexOf('private static string ProtocolPath',end));assert.ok(f.includes('if (attributes != null)try{attributes.Dispose();}catch(Exception e){CaptureCleanupFailure(ref cleanupFailure,e);}'));assert.ok(f.includes('if (environment != IntPtr.Zero)try{Marshal.FreeHGlobal(environment);}catch(Exception e){CaptureCleanupFailure(ref cleanupFailure,e);}'))});
test('Native attrs marker retained but unchecked close mutant is rejected',()=>{const f=core.slice(end,core.indexOf('private static string ProtocolPath',end));const target='if (attributes != null)try{attributes.Dispose();}catch(Exception e){CaptureCleanupFailure(ref cleanupFailure,e);}';assert.ok(f.includes(target));const changed=f.replace(target,'if (attributes != null) attributes.Dispose();');assert.ok(changed.includes('relayOutput.CloseChecked()'));assert.equal(changed.includes(target),false)});
test('actual control closes only its never-transferred channel independently',()=>assert.ok(control.includes('try{if(channel!=null&&(a.Owner==null||!Object.ReferenceEquals(a.Owner.RootChannel,channel)))channel.Dispose();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}')));


function allocationGate(s){order(s,'private void CreateController()','   try{','channel=new PrivateChannel();','channel.Input=CreateAdmissionInput(out stdinClient);','channel.Output=CreateRelayOutput(out stdoutClient);','errorChannel=new PrivateChannel();errorChannel.Output=CreateRelayOutput(out stderrClient);','catch(Exception e){failure=e;}','finally{');creatorGate(s.slice(s.indexOf('private void CreateController'),s.indexOf('private string controllerFrameHash')))}
function closedGate(s){assert.ok(s.includes('(stdinClient==null||stdinClient.IsClosed)&&(stdoutClient==null||stdoutClient.IsClosed)'));assert.ok(s.includes('controller.Thread==null||controller.Thread.IsClosed'));assert.ok(s.includes('(stderrClient==null||stderrClient.IsClosed)'))}
test('actual Root all pipe/client allocations are inside creator try/finally',()=>allocationGate(host));
test('actual final owned-close state includes stdin stdout stderr and controller thread',()=>closedGate(host));
for(const[n,mutate,gate]of [
 ['pipe allocation outside try',s=>s.replace('   try{\n    channel=new PrivateChannel();','    channel=new PrivateChannel();').replace('    attrs=new ProcAttributes(2);','   try{\n    attrs=new ProcAttributes(2);'),allocationGate],
 ['stdin closed state omitted',s=>s.replace('&&(stdinClient==null||stdinClient.IsClosed)',''),closedGate],
 ['stdout closed state omitted',s=>s.replace('&&(stdoutClient==null||stdoutClient.IsClosed)',''),closedGate],
 ['controller thread closed state omitted',s=>s.replace('&&(controller.Thread==null||controller.Thread.IsClosed)',''),closedGate]
])test('marker-preserving allocation/closed mutant '+n,()=>{const changed=mutate(host);assert.notEqual(changed,host);assert.throws(()=>gate(changed))});
for(const stage of ['admission-input','stdout-output','stderr-output'])test('limited Root '+stage+' allocation failure still reaches owned client cleanup',()=>{allocationGate(host);const created=stage==='admission-input'?[]:stage==='stdout-output'?['stdin']:['stdin','stdout'];const v=independentProjection(created,created.slice(0,1));assert.deepEqual(v.attempted,created);assert.equal(v.hold,true);assert.equal(v.eofClaim,false);assert.equal(v.jobzeroClaim,false)});


const retire=companion.slice(companion.indexOf('private static void RetireOwnedControl'),companion.indexOf('private static void',companion.indexOf('private static void RetireOwnedControl')+20));
const reverse=registry.slice(registry.indexOf('public void CloseTerminalReverse'));
const transfer=registry.slice(registry.indexOf('OwnedHandle owned=null;'),registry.indexOf('private Dictionary<string,string> Probe'));
const proposals=client.slice(client.indexOf('public static void CloseProposals'));
function jobGate(s){assert.doesNotMatch(s,/if\s*\(\s*(?:failure\s*==\s*null|null\s*==\s*failure)\s*\)/,'owned cleanup must not depend on absence of an earlier failure');order(s,'Canary Job zero");}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','try{actor.Job.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}') }
function registryHostGate(s){assert.doesNotMatch(s,/if\s*\(\s*(?:failure\s*==\s*null|null\s*==\s*failure)\s*\)/,'owned cleanup must not depend on absence of an earlier failure');order(s,'try{if(jobZero)registry.ReleasePendingAfterOuterZero();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','try{registry.CloseTerminalReverse();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}') }
function transferGate(s){assert.doesNotMatch(s,/if\s*\(\s*(?:failure\s*==\s*null|null\s*==\s*failure)\s*\)/,'owned cleanup must not depend on absence of an earlier failure');order(s,'catch(Exception e){failure=e;throw;}','finally{','try{if(owned!=null)owned.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','try{source.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','if(failure!=null)throw failure;') }
function reverseGate(s){assert.doesNotMatch(s,/if\s*\(\s*(?:failure\s*==\s*null|null\s*==\s*failure)\s*\)/,'owned cleanup must not depend on absence of an earlier failure');assert.ok(s.includes('for(int i=order.Count-1;i>=0;i--)'));order(s,'try{Require(WaitForSingleObject(e.Handle.Value,0)==WaitObject0','Retire(d);}catch(Exception error){CaptureCleanupFailure(ref failure,error);}','try{Require(RegistryZero,"ROOT_REGISTRY_NOT_ZERO");}catch(Exception error){CaptureCleanupFailure(ref failure,error);}','if(failure!=null)throw failure;');assert.ok(!s.includes('entries.Clear()'))}
function proposalGate(s){assert.doesNotMatch(s,/if\s*\(\s*(?:failure\s*==\s*null|null\s*==\s*failure)\s*\)/,'owned cleanup must not depend on absence of an earlier failure');order(s,'foreach(var h in proposed.Values)try{h.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','if(failure!=null)throw failure;','proposed.Clear();')}
for(const[n,s,gate]of [['Canary proof then independent owned Job close',retire,jobGate],['Root pending release then independent registry close',outer,registryHostGate],['subject and source-process close plus primary',transfer,transferGate],['registry reverse per-entry attempts and no false zero',reverse,reverseGate],['proposal query per-handle attempts before clear',proposals,proposalGate]])test('actual '+n,()=>gate(s));
const chainMutants=[
 ['job proof skips owned close',retire,jobGate,s=>s.replace('Canary Job zero");}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','Canary Job zero");')],
 ['job close unchecked',retire,jobGate,s=>s.replace('try{actor.Job.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','actor.Job.CloseChecked();')],
 ['Root pending error skips registry',outer,registryHostGate,s=>s.replace('registry.ReleasePendingAfterOuterZero();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','registry.ReleasePendingAfterOuterZero();')],
 ['subject close skips source-process close',transfer,transferGate,s=>s.replace('try{if(owned!=null)owned.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}','if(owned!=null)owned.CloseChecked();')],
 ['source close loses primary',transfer,transferGate,s=>s.replace('catch(Exception e){failure=e;throw;}','catch(Exception e){failure=null;throw;}')],
 ['first registry entry failure stops later entries',reverse,reverseGate,s=>s.replace('Retire(d);}catch(Exception error){CaptureCleanupFailure(ref failure,error);}','Retire(d);}catch(Exception error){CaptureCleanupFailure(ref failure,error);throw;}')],
 ['registry zero forged',reverse,reverseGate,s=>s.replace('try{Require(RegistryZero,"ROOT_REGISTRY_NOT_ZERO");}','entries.Clear();try{Require(RegistryZero,"ROOT_REGISTRY_NOT_ZERO");}')],
 ['first proposal error stops later queries',proposals,proposalGate,s=>s.replace('catch(Exception e){CaptureCleanupFailure(ref failure,e);}','catch(Exception e){CaptureCleanupFailure(ref failure,e);throw;}')],
 ['proposal refs cleared before HOLD',proposals,proposalGate,s=>s.replace('if(failure!=null)throw failure;proposed.Clear();','proposed.Clear();if(failure!=null)throw failure;')]
];
for(const[n,s,gate,mutate]of chainMutants)test('actual chain source mutant '+n,()=>{const changed=mutate(s);assert.notEqual(changed,s);assert.throws(()=>gate(changed))});
for(const[n,names,failures]of [
 ['Canary zero proof error',['proof','job-close'],['proof']],
 ['Root pending release error',['release','registry-close'],['release']],
 ['subject close error',['subject','source-process'],['subject']],
 ['reverse first entry error',['entry3','entry2','entry1'],['entry3']],
 ['query first handle error',['query1','query2','query3'],['query1']],
 ['combined reverse errors',['entry3','entry2','entry1'],['entry3','entry2']]
])test('limited independent chain '+n,()=>{jobGate(retire);registryHostGate(outer);transferGate(transfer);reverseGate(reverse);proposalGate(proposals);const v=independentProjection(names,failures);assert.deepEqual(v.attempted,names);for(const e of ['primary',...failures])assert.ok(v.errors.includes(e));assert.equal(v.hold,true);assert.equal(v.eofClaim,false);assert.equal(v.jobzeroClaim,false)});


for(const[n,s,gate,target]of [
 ['control input',control,controlGate,'try{if(input!=null)input.CloseChecked();}'],
 ['Root creator stderr',creator,creatorGate,'try{if(stderrClient!=null)stderrClient.CloseChecked();}'],
 ['Root second channel',outer,outerGate,'if(errorChannel!=null)try{errorChannel.Dispose();'],
 ['Canary Job close',retire,jobGate,'try{actor.Job.CloseChecked();}'],
 ['Root registry close',outer,registryHostGate,'try{registry.CloseTerminalReverse();}'],
 ['Root source-process close',transfer,transferGate,'try{source.CloseChecked();}'],
 ['Root reverse entries',reverse,reverseGate,'try{Require(WaitForSingleObject(e.Handle.Value,0)==WaitObject0'],
 ['proposal handles',proposals,proposalGate,'try{h.CloseChecked();}']
])test('valid C# earlier-failure re-gating rejected with every close marker retained '+n,()=>{assert.ok(s.includes(target));const mutated=s.replace(target,'if(failure==null) '+target);assert.notEqual(mutated,s);assert.ok(mutated.includes(target));assert.equal(mutated.replace('if(failure==null) '+target,target),s);assert.throws(()=>gate(mutated))});

console.log(JSON.stringify({passed,failed,sourceMutants:42,limitedCSharpProjection:true,nativeMethodsInvoked:0,fixtureExecutions:0,runtimeGrant:'NONE_HOLD'}));process.exitCode=failed?1:0;
