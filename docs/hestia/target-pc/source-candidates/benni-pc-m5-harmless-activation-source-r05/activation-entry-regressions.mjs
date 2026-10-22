import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=n=>existsSync(new URL(n,import.meta.url))?readFileSync(new URL(n,import.meta.url),'utf8'):'';
const cs=read('HarmlessQualification.cs'),gate=read('ActivationAdmission.cs'),node=read('harmless-fixture.mjs');
let passed=0,failed=0;function test(n,f){try{f();passed++;console.log('PASS '+n)}catch(e){failed++;console.log('FAIL '+n+': '+e.message)}}
function before(s,a,b){const x=s.indexOf(a),y=s.indexOf(b);return x>=0&&y>=0&&x<y}
test('controller fixed entry admits before existing suite body',()=>{assert.ok(cs.includes('AdmitFixedEntry(ActivationRole.Controller'));assert.ok(cs.includes('RunFutureQualificationSuite(admitted)'))});
test('Observer entry admits before exact private Observer body',()=>{assert.ok(cs.includes('AdmitFixedEntry(ActivationRole.Observer'));assert.ok(cs.includes('FutureFixedRoleBody(ControlRole.Observer,requestPath,admitted)'))});
test('Supervisor entry admits before exact private Supervisor body',()=>{assert.ok(cs.includes('AdmitFixedEntry(ActivationRole.Supervisor'));assert.ok(cs.includes('FutureFixedRoleBody(ControlRole.Supervisor,requestPath,admitted)'))});
for(const [file,entry]of [['qualify.ps1','SuperviseHarmlessQualification'],['observe.ps1','ObserveHarmlessQualification'],['supervise.ps1','RunHarmlessSupervisor']])test(file+' actual gate precedes fixed DLL loader and method',()=>{
 const s=read(file);assert.ok(before(s,'Require-RootVerifiedAdmission','Import-FixedActivationAssembly'));assert.ok(before(s,'Import-FixedActivationAssembly','::'+entry+'('));
});
test('fixture preimport admission precedes every stdlib import',()=>assert.ok(before(node,'requireFixtureAdmission(', "await import('node:fs')")));
test('suite takes original admitted endpoints instead of capturing later clock',()=>{assert.ok(cs.includes('CaptureOriginalSuiteClock(admitted)'));assert.ok(!cs.includes('PrepareSuiteClock(HashFile('))});
test('external Root proof and independent expected package required',()=>{assert.ok(gate.includes('IExternalRootRuntimeVerifier'));assert.ok(gate.includes('ROOT_RUNTIME_VERIFIER_UNISSUED'));assert.ok(gate.includes('ExpectedPackagePinsSha256'));assert.ok(gate.includes('HARMLESS_SIX_ONCE'))});
test('Native24 entry remains unconditional veto',()=>assert.match(read('Native24Family.cs'),/public static int SuperviseNative24\(\)\s*\{\s*throw new InvalidOperationException\("SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT"\);/));
console.log(JSON.stringify({passed,failed,sourceTextOnly:true,fixtureExecutions:0,nativeMethodsInvoked:0,runtimeGrant:'NONE_HOLD'}));process.exitCode=failed?1:0;
