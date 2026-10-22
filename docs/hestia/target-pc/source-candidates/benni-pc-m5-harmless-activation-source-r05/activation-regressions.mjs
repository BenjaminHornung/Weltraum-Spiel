import assert from 'node:assert/strict';
import {bindingKeys,evaluateActivation} from './activation-model.mjs';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
let passed=0,failed=0;
function test(n,f){try{f();passed++;console.log('PASS '+n)}catch(e){failed++;console.log('FAIL '+n+': '+e.message)}}
const id='11111111-1111-1111-1111-111111111111',h='a'.repeat(64);
function valid(){
 const e=Object.fromEntries(bindingKeys.map(k=>[k,'bound-value']));
 Object.assign(e,{issuer:'ROOT_INDEPENDENT_RUNTIME_HANDOFF',ownerNative:'01a13648-c55b-7250-bf07-34921d70b43b',ownerProcessId:'10',ownerCreation:'100',ownerImage:'C:\\IFI_SourceCode\\owner.exe',runnerId:id,runnerProcessId:'11',runnerCreation:'101',paseoAgent:id,workspace:'wks_synthetic',leaseId:id,leaseExpiresUtc:'2060000',capacity:'ONE_CONTROLLER_SIX_SERIAL_LANES_ACTIVE3',outputExclusive:'true',outputCustodyId:id,suiteToken:id,nativeOrigin:id,nativeClockDomain:id,nativeClockApi:'GetTickCount64',utcClockApi:'DateTimeOffset.UtcNow',issued:'1000',workEnd:'49000',overallEnd:'61000',utcIssued:'2000000',utcEnd:'2060000',sourceRoot:'C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\.worktrees\\Hestia-A0-BenniPC-2026-10-13\\.a0-runtime\\benni-pc-m5-harmless-activation-source-r01',role:'Controller',requestPath:'NONE',scope:'HARMLESS_SIX_ONCE',mode:'REAL_RUNTIME',authorityState:'UNCONSUMED',subjectPid:'12',subjectCreation:'102',subjectParentPid:'11',subjectImage:'C:\\IFI_SourceCode\\pwsh.exe'});
 e.suiteOutputRoot=e.sourceRoot+'\\qualification-runs\\'+id;
 for(const k of ['packagePinsSha256','nodeSha256','powerShellSha256','dllSha256','fixtureSha256'])e[k]=h;
 return {expectedRoot:e,observed:{...e},claim:{...e},verifierFact:true,identityFact:true,leaseFact:true,clockDomainFact:true,synthetic:false,reset:false,actualBytes:{packagePinsSha256:h,nodeSha256:h,powerShellSha256:h,dllSha256:h,fixtureSha256:h},phases:Object.fromEntries(['preflight','beforeLoader','afterLoader','afterStart','afterLastCase','afterCleanup','afterPublication'].map((p,i)=>[p,{now:1001+i*7000,utc:2000001+i*7000}]))};
}
const hold=v=>assert.equal(evaluateActivation(v).disposition,'HOLD');
test('valid model remains non-runnable source review only',()=>assert.deepEqual(evaluateActivation(valid()),{disposition:'SOURCE_REVIEW_READY',launchCapability:false,syntheticModelOnly:true}));
for(const fact of ['verifierFact','identityFact','leaseFact','clockDomainFact'])test('missing independent '+fact,()=>{const v=valid();v[fact]=false;hold(v)});
for(const field of bindingKeys)for(const bad of [undefined,null,'',123,'wrong-old-binding'])test(field+' rejects '+String(bad),()=>{const v=valid();v.claim[field]=bad;hold(v)});
for(const field of bindingKeys)test('equal manipulated claim/observed cannot replace Root '+field,()=>{const v=valid();v.claim[field]=v.observed[field]='tampered';hold(v)});
for(const key of ['expectedRoot','observed','claim'])test('missing '+key,()=>{const v=valid();v[key]=null;hold(v)});
for(const k of ['packagePinsSha256','nodeSha256','powerShellSha256','dllSha256','fixtureSha256'])test('actual bytes drift '+k,()=>{const v=valid();v.actualBytes[k]='b'.repeat(64);hold(v)});
for(const [field,value]of [['scope','NATIVE24'],['scope','R05'],['mode','SOURCE_REVIEW_READY'],['authorityState','CONSUMED'],['issuer','self'],['role','Wrong'],['requestPath','foreign'],['nativeClockApi','performance.now'],['outputExclusive','false'],['packagePinsSha256','bad']])test('matching wrong policy '+field+'/'+value,()=>{const v=valid();v.expectedRoot[field]=v.claim[field]=v.observed[field]=value;hold(v)});
for(const flag of ['synthetic','reset'])test(flag+' cannot admit',()=>{const v=valid();v[flag]=true;hold(v)});
for(const phase of Object.keys(valid().phases))for(const clock of ['now','utc'])test(phase+' expiry '+clock,()=>{const v=valid();v.phases[phase][clock]=clock==='now'?61001:2060001;hold(v)});
for(const [k,value]of [['issued','1001'],['workEnd','49001'],['overallEnd','61001'],['utcEnd','2060001'],['leaseExpiresUtc','2059999']])test('original endpoint '+k+' drift',()=>{const v=valid();v.expectedRoot[k]=v.claim[k]=v.observed[k]=value;hold(v)});
for(const role of ['Observer','Supervisor'])test('fixed '+role+' consumes own active session only',()=>{const v=valid();const e=v.expectedRoot;Object.assign(e,{role,authorityState:'ACTIVE_OWN_CONTROLLER',requestPath:e.suiteOutputRoot+'\\nominal\\'+(role==='Observer'?'observer.control.tsv':'supervisor.control.tsv'),requestSha256:h});v.observed={...e};v.claim={...e};v.actualRequestSha256=h;assert.equal(evaluateActivation(v).disposition,'SOURCE_REVIEW_READY');v.actualRequestSha256='b'.repeat(64);hold(v)});
const cs=read('HarmlessQualification.cs'),gate=read('ActivationAdmission.cs'),fx=read('harmless-fixture.mjs');
function method(s,name){const start=s.indexOf(name+'(');if(start<0)return '';const begin=s.indexOf('{',start);let depth=1,i=begin+1;for(;i<s.length&&depth;i++){if(s[i]==='{')depth++;if(s[i]==='}')depth--}return s.slice(begin+1,i-1)}
function gateBefore(s,g,b){return s.indexOf(g)>=0&&s.indexOf(b)>s.indexOf(g)}
for(const [entry,role,body]of [['SuperviseHarmlessQualification','Controller','RunFutureQualificationSuite(admitted)'],['ObserveHarmlessQualification','Observer','FutureFixedRoleBody(ControlRole.Observer,requestPath,admitted)'],['RunHarmlessSupervisor','Supervisor','FutureFixedRoleBody(ControlRole.Supervisor,requestPath,admitted)']]){
 const bodyText=method(cs,entry),admit='AdmitFixedEntry(ActivationRole.'+role;
 test(entry+' true gate order',()=>assert.ok(gateBefore(bodyText,admit,body)));
 test(entry+' removing actual gate rejected',()=>assert.equal(gateBefore(bodyText.replace(admit,'removed('),admit,body),false));
 test(entry+' wrong target rejected',()=>assert.equal(gateBefore(bodyText.replace(body,'wrongTarget()'),admit,body),false));
}
for(const file of ['qualify.ps1','observe.ps1','supervise.ps1']){
 const s=read(file),start=s.indexOf('$admitted=Require-RootVerifiedAdmission'),tail=s.slice(start);
 const check=t=>start>=0&&gateBefore(t,'Require-RootVerifiedAdmission','Import-FixedActivationAssembly')&&gateBefore(t,'Import-FixedActivationAssembly','[Hestia.M5.Native24Source.Native24Family]::');
 test(file+' terminal pipeline gate order',()=>assert.ok(check(tail)));
 test(file+' removing actual entry gate rejected',()=>assert.equal(check(tail.replace('Require-RootVerifiedAdmission','removed')),false));
 test(file+' removing fixed loader rejected',()=>assert.equal(check(tail.replace('Import-FixedActivationAssembly','removed')),false));
}
const fxCheck=s=>gateBefore(s,'const fixtureAdmission=requireFixtureAdmission();',"await import('node:fs')");
test('fixture actual call precedes imports',()=>assert.ok(fxCheck(fx)));
test('fixture removed actual call rejected',()=>assert.equal(fxCheck(fx.replace('const fixtureAdmission=requireFixtureAdmission();','')),false));
for(const target of ['Require(verifier!=null','proof.IdentityAndLeaseVerified&&proof.NativeClockDomainVerified&&proof.ScopeVerified','HashFile(Path.Combine(SourceRoot,"QUAL_SOURCE_PINS.tsv"))==ExpectedPackagePinsSha256(proof)','verifier.VerifyCurrentPhase(proof,"native-pre-effects")','verifier.ConsumeControllerOnce(proof)']){test('native gate exists '+target,()=>assert.ok(gate.includes(target)));test('native gate removal detectable '+target,()=>assert.equal(gate.replace(target,'removed').includes(target),false))}
test('original clock passage contains no new origin or fresh current capture',()=>{const b=method(cs,'CaptureOriginalSuiteClock');assert.ok(b.includes('RequiredRootField(e,"issued")'));assert.ok(!b.includes('GetTickCount64()'));assert.ok(!b.includes('Guid.NewGuid()'))});
test('all activation companion changes reverse exactly to frozen R03',()=>{const a=JSON.parse(read('ACTIVATION_ADAPTATIONS.json'));let s=cs;for(const r of [...a.companionRules].reverse()){assert.equal(s.split(r.newText).length-1,1,r.label);s=s.replace(r.newText,r.oldText)}assert.equal(s,read('../benni-pc-native24-harmless-qualification-source-r03/HarmlessQualification.cs'))});
function consumeBoundary(s){
 const after=s.indexOf('verifier.VerifyCurrentPhase(proof,"native-after-bytes")'),guard=s.indexOf('"HOLD_AFTER_BYTES_BEFORE_CONSUME_DEADLINE"'),consume=s.indexOf('verifier.ConsumeControllerOnce(proof)');
 return after>=0&&guard>after&&consume>guard&&s.slice(after,guard).includes('GetTickCount64()<=(ulong)end')&&s.slice(after,guard).includes('DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=utcEnd');
}
test('real local dual-clock check after bytes before grant consumption',()=>assert.ok(consumeBoundary(gate)));
test('removing post-byte monotone check rejected',()=>{const i=gate.indexOf('verifier.VerifyCurrentPhase(proof,"native-after-bytes")');const s=gate.slice(0,i)+gate.slice(i).replace('GetTickCount64()<=(ulong)end','true');assert.equal(consumeBoundary(s),false)});
test('removing post-byte UTC check rejected',()=>{const i=gate.indexOf('verifier.VerifyCurrentPhase(proof,"native-after-bytes")');const s=gate.slice(0,i)+gate.slice(i).replace('DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=utcEnd','true');assert.equal(consumeBoundary(s),false)});
console.log(JSON.stringify({passed,failed,pureSyntheticModelOnly:true,launchCapabilities:0,fixtureExecutions:0,nativeMethodsInvoked:0,runtimeGrant:'NONE_HOLD'}));process.exitCode=failed?1:0;
