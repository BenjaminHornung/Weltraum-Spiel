import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const base=process.argv[2]||'.';
const read=n=>{const p=new URL(base.replaceAll('\\','/')+'/'+n,import.meta.url);return existsSync(p)?readFileSync(p,'utf8'):''};
const host=read('root-handoff.ps1'),ps=read('root-contract.ps1'),native=read('RootRuntimeVerifier.cs'),fixture=read('fixture-admission.mjs'),gate=read('ActivationAdmission.cs'),core=read('Native24Family.cs'),companion=read('HarmlessQualification.cs');
let passed=0,failed=0;function test(n,f){try{f();passed++;console.log('PASS '+n)}catch(e){failed++;console.log('FAIL '+n+': '+e.message)}}
const ordered=(s,...parts)=>{let i=-1;return parts.every(p=>{i=s.indexOf(p,i+1);return i>=0})};
test('concrete host captures original clock before Root reads and consumption before controller',()=>assert.ok(ordered(host,'$entryTick=[Environment]::TickCount64','Read-RootRecords','[IO.FileMode]::CreateNew','$controller.Start()')));
test('host retains controller and supplies private stdin',()=>{for(const s of ['RedirectStandardInput=$true','StandardInput.WriteLine','SafeHandle','actualHandleClosed','M5_ACK_V1'])assert.ok(host.includes(s),s)});
test('fixed independent Root records, no caller-selected trusted paths',()=>{for(const n of ['M5_HARMLESS_REVIEWED_PACKAGE.json','M5_HARMLESS_RUNTIME_CONTEXT.json','M5_HARMLESS_RUNTIME_GRANT.json'])assert.ok(ps.includes(n));assert.ok(!ps.includes('param($TrustedPath'))});
test('concrete native verifier replaces null slot',()=>{assert.ok(gate.includes('new RootRuntimeVerifier()'));assert.ok(native.includes('class RootRuntimeVerifier : IExternalRootRuntimeVerifier'));assert.ok(!gate.includes('externalRootRuntimeVerifier=null'))});
for(const name of ['VerifyCurrentFixedEntry','VerifyCurrentPhase','ConsumeControllerOnce','VerifiedNodeOrigin'])test('native concrete '+name,()=>assert.ok(native.includes(name+'(')&&native.includes('ReadRootRecords')));
test('PS concrete provider and native loader gate',()=>assert.ok(ps.includes('function Get-ExternalRootRuntimeVerifier')&&ps.includes('Read-PrivateHandoff')&&ps.includes('VerifyIndependentRootProof')));
test('fixture concrete five-method adapter before effects',()=>{for(const n of ['verifyCurrentFixedFixture','verifyIndependentRootProof','verifyCurrentPhase','verifyFixedRequest','verifyOriginalClockBracket'])assert.ok(fixture.includes(n+'('),n);assert.ok(fixture.includes('readFileSync(0'))});
test('native controller consumption is same-host ACK, never another CreateNew',()=>{assert.ok(native.includes('M5_ACK_V1'));assert.ok(native.includes('M5_ACK_OK_V1'));assert.ok(!native.includes('FileMode.CreateNew'))});
test('existing role/root creators receive real private stdin handles',()=>{assert.ok(companion.includes('CreateAdmissionInput'));assert.ok(core.includes('CreateAdmissionInput'));assert.ok(companion.includes('WriteChildAdmission'));assert.ok(core.includes('WriteChildAdmission'))});
test('Native24 remains unconditionally closed',()=>assert.match(core,/public static int SuperviseNative24\(\)\s*\{\s*throw new InvalidOperationException\("SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT"\);/));

// These execute the actual import-free fixture production decision with synthetic data, never an adapter/host.
const {validateRootDecision,parseFlat}=await import('./handoff-decision.mjs');
const {checkNativeRecordPolicies,fixtureRequestGates,hostConsumeOrder}=await import('./policy-source.mjs');
import vm from 'node:vm';
const realNative=read('RootRuntimeVerifier.cs'),realFixture=read('harmless-fixture.mjs');
test('actual native scope/owner Require expressions admit valid and reject invalid records',()=>assert.ok(checkNativeRecordPolicies(realNative)));
for(const [name,mutate]of [
 ['scope true with marker retained',s=>s.replace('Field(g,"scope")=="HARMLESS_SIX_ONCE"&&Field(g,"authorizationClass")=="DIRECT_HUMAN_RUNTIME_ONCE"&&Field(g,"retry")=="0"','true')],
 ['scope false with marker retained',s=>s.replace('Field(g,"scope")=="HARMLESS_SIX_ONCE"','false')],
 ['scope if(false) with marker retained',s=>s.replace('    Require(Field(g,"scope")','    if(false) Require(Field(g,"scope")')],
 ['owner true with marker retained',s=>s.replace('Field(p,"ownerNative")=="01a13648-c55b-7250-bf07-34921d70b43b"&&Field(c,"ownerNative")==Field(p,"ownerNative")','true')]
])test('reject actual '+name,()=>{const m=mutate(realNative);assert.notEqual(m,realNative);assert.ok(m.includes('DATA_HOLD_SCOPE')&&m.includes('DATA_HOLD_OWNER'));assert.equal(checkNativeRecordPolicies(m),false)});
test('actual fixture request read/verification/phase precede effects',()=>assert.ok(fixtureRequestGates(realFixture)));
for(const text of ['externalRootFixtureVerifier.verifyFixedRequest(fixtureAdmission,request);',"externalRootFixtureVerifier.verifyCurrentPhase(fixtureAdmission,'fixture-after-request');"])test('removed actual fixture call rejected '+text,()=>{assert.ok(realFixture.includes(text));assert.equal(fixtureRequestGates(realFixture.replace(text,'/* original phase/request marker retained */')),false)});
test('if(false) fixture verification cannot satisfy source branch checker',()=>assert.equal(fixtureRequestGates(realFixture.replace('externalRootFixtureVerifier.verifyFixedRequest(fixtureAdmission,request);','if(false){externalRootFixtureVerifier.verifyFixedRequest(fixtureAdmission,request);}')),false));
test('actual host consume ordering validates',()=>assert.ok(hostConsumeOrder(host)));
test('consume after controller rejected with consume marker retained',()=>{const start=host.indexOf('$controller.Start()');const call=host.indexOf('[IO.FileMode]::CreateNew');assert.ok(start>call);const m=host.slice(0,call)+host.slice(call).replace('[IO.FileMode]::CreateNew','[IO.FileMode]::Open')+'\n$controller.Start()\n[IO.FileMode]::CreateNew';assert.equal(hostConsumeOrder(m),false)});
test('caller-selected trusted context rejected by literal-route contract',()=>{const fixed="RootContextPath='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\artifacts\\hestia-target-pc-2026-10-13\\M5_HARMLESS_RUNTIME_CONTEXT.json'";assert.ok(ps.includes(fixed));assert.equal(ps.replace(fixed,'RootContextPath=$RequestPath').includes(fixed),false)});
function data(){
 const fill=fields=>Object.fromEntries(fields.split(' ').map(k=>[k,'bound']));
 const p=fill('schema version packageId ownerNative sourceRoot packagePinsSha256 nodeSha256 powerShellSha256 dllSha256 fixtureSha256 coreLibrarySha256 profile scenarios roles'),c=fill('schema version contextId packageId packageRecordSha256 ownerNative ownerProcessId ownerCreation ownerImage ownerParentPid runnerId runnerProcessId runnerCreation runnerImage runnerParentPid paseoAgent workspace leaseId leaseExpiresUtc capacity outputExclusive outputCustodyId suiteToken nativeOrigin nativeClockDomain nativeClockApi utcClockApi clockMode issued workEnd overallEnd utcIssued utcEnd sourceRoot suiteOutputRoot hostParentPid hostParentCreation hostParentImage hostParentParentPid nodeOrigins bootStamp'),g=fill('schema version grantId contextId contextRecordSha256 packageId scope authorizationClass humanMessageRef humanMessageSha256 retry suiteToken outputCustodyId notBeforeUtc expiresUtc'),h='a'.repeat(64),id='11111111-1111-1111-1111-111111111111';
 Object.assign(p,{schema:'hestia.m5.package.v1',version:'1',ownerNative:'01a13648-c55b-7250-bf07-34921d70b43b',sourceRoot:'C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\.worktrees\\Hestia-A0-BenniPC-2026-10-13\\.a0-runtime\\benni-pc-m5-harmless-activation-source-r02',packageId:id,profile:'WINDOWS_PWSH7.6.4_NET10.0.10_GETTICKCOUNT64'});
 Object.assign(c,{schema:'hestia.m5.context.v1',version:'1',ownerNative:p.ownerNative,sourceRoot:p.sourceRoot,packageId:id,contextId:id,packageRecordSha256:h,capacity:'ONE_CONTROLLER_SIX_SERIAL_LANES_ACTIVE3',outputExclusive:'true',suiteToken:id,outputCustodyId:id,nativeClockApi:'GetTickCount64',utcClockApi:'DateTimeOffset.UtcNow',leaseExpiresUtc:'2060000'});c.suiteOutputRoot=p.sourceRoot+'\\qualification-runs\\'+id;
 Object.assign(g,{schema:'hestia.m5.grant.v1',version:'1',scope:'HARMLESS_SIX_ONCE',authorizationClass:'DIRECT_HUMAN_RUNTIME_ONCE',retry:'0',humanMessageRef:'future-direct-human-ref',humanMessageSha256:h,contextId:id,packageId:id,contextRecordSha256:h,grantId:id,suiteToken:id,outputCustodyId:id,notBeforeUtc:'2000000',expiresUtc:'2060000'});
 const f={schema:'hestia.m5.handoff.v1',version:'1',role:'root',scenario:'nominal',packageRecordSha256:h,contextRecordSha256:h,grantRecordSha256:h,consumedSha256:h,subjectPid:'20',subjectParentPid:'19',subjectImage:'C:\\IFI_SourceCode\\node.exe',issued:'1000',workEnd:'49000',overallEnd:'61000',utcIssued:'2000000',utcEnd:'2060000',hostPid:'10',hostCreation:'100',hostImage:'C:\\IFI_SourceCode\\pwsh.exe',hostParentPid:'9'};
 const spent={...f,schema:'hestia.m5.consumed.v1',grantId:id};
 return {p,c,g,f,spent,hashes:{package:h,context:h,grant:h,consumed:h},self:{pid:20,ppid:19,execPath:f.subjectImage},now:2001000};
}
const run=v=>validateRootDecision(v.p,v.c,v.g,v.f,v.spent,v.hashes,v.self,v.now);
test('actual production fixture decision accepts valid synthetic evidence only',()=>assert.equal(run(data()),undefined));
for(const group of ['p','c','g'])for(const field of Object.keys(data()[group]))test('actual decision missing '+group+'.'+field,()=>{const v=data();delete v[group][field];assert.throws(()=>run(v),/DATA_HOLD/)});
for(const [group,field,value]of [['g','scope','NATIVE24'],['g','scope','R05'],['g','authorizationClass','SOURCE_ONLY'],['g','retry','1'],['p','ownerNative','foreign'],['c','capacity','unissued'],['c','outputExclusive','false'],['g','humanMessageRef','call_f75fff55e3a34653b255fd83365457ca'],['f','role','Controller'],['f','subjectPid','21'],['f','subjectParentPid','18'],['f','contextRecordSha256','b'.repeat(64)],['spent','grantId','foreign'],['f','overallEnd','61001'],['f','utcEnd','2060001']])test('actual decision wrong '+group+'.'+field,()=>{const v=data();v[group][field]=value;assert.throws(()=>run(v),/DATA_HOLD/)});
for(const value of ['{"a":"1","a":"2"}','{"a":1}','{"a":"1","unknown":null}','{"a":"1"}false','{"a":"1",}'])test('actual production flat parser rejects '+value,()=>assert.throws(()=>parseFlat(value)));
const decision=read('handoff-decision.mjs');
test('disabled actual fixture scope predicate with marker retained is exposed',()=>{
 const m=decision.replace("g.scope==='HARMLESS_SIX_ONCE'&&g.authorizationClass==='DIRECT_HUMAN_RUNTIME_ONCE'&&g.retry==='0'",'true').replaceAll('export ','');
 assert.ok(m.includes("'runtime scope'"));assert.notEqual(m,decision.replaceAll('export ',''));
 const v=data();v.g.scope='NATIVE24';
 assert.throws(()=>run(v),/DATA_HOLD/);
 const result=vm.runInNewContext(m+';validateRootDecision(v.p,v.c,v.g,v.f,v.spent,v.hashes,v.self,v.now)',{v},{timeout:50});
 assert.equal(result,undefined); // The same rejection assertion would now fail: this mutation is killed.
});
test('fixed phase vocabularies reject unknown labels',()=>{assert.ok(realNative.includes('Phases.Contains(phase)'));assert.ok(ps.includes("'unknown Root phase'"));assert.ok(fixture.includes("'unknown fixture phase'"))});


test('fixture Root-owned subject gate precedes actual argv/request access',()=>{assert.ok(fixture.indexOf('requireRootSubject(r,frame);')>0);assert.ok(fixture.indexOf('requireRootSubject(r,frame);')<fixture.indexOf('need(proc.argv.length'))});
test('Root subject producer remains explicit source completion gap',()=>{assert.ok(fixture.includes("retainedHandleState==='LIVE_OWNED_ROOT_HANDLE'"));assert.ok(!host.includes('function Publish-RootSubject'))});

console.log(JSON.stringify({passed,failed,sourceOnly:true,fixtureExecutions:0,nativeMethodsInvoked:0,rootHostExecutions:0,runtimeGrant:'NONE_HOLD'}));process.exitCode=failed?1:0;
