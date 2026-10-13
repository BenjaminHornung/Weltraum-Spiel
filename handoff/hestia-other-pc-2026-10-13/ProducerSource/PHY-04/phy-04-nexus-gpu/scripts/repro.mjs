import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { root,sha256,assertFreshOutputs } from './commands.mjs';
import { verifyInputs } from './verify-inputs.mjs';
import { makeFixture,canonicalBytes } from '../src/fixtures.mjs';
const id=process.env.PHY04_REPRO_ID??process.argv[2]??'repro-01';
assertFreshOutputs(id,['tests/'+id+'-summary.json','tests/'+id+'-comparator.json','tests/'+id+'-source-audit.json']);
verifyInputs();
mkdirSync(resolve(root,'fixtures'),{recursive:true});
const fixtures=[...[10,100,1000].flatMap(count=>['freefall','zeroGravity'].map(scenario=>makeFixture(count,scenario))),
  makeFixture(10,'dynamicGeometry')];
const fixtureBindings=[];
for(const fixture of fixtures){
  const path='fixtures/'+fixture.scenario+'-'+fixture.count+'.json';
  writeFileSync(resolve(root,path),JSON.stringify(fixture,null,2)+'\n');
  fixtureBindings.push({path,fileSha256:sha256(readFileSync(resolve(root,path))),canonicalSha256:sha256(canonicalBytes(fixture))});
}
writeFileSync(resolve(root,'fixtures/manifest.json'),JSON.stringify({fixtureBindings},null,2)+'\n');
await import('./control.mjs');
for(const file of readdirSync(resolve(root,'tests')).filter(x=>x.endsWith('.test.mjs')).sort()){
  await import('../tests/'+file);
}
const {auditSource}=await import('./audit-source.mjs');
writeFileSync(resolve(root,'tests/'+id+'-source-audit.json'),JSON.stringify(auditSource(),null,2)+'\n');
const {comparatorMatrix}=await import('../src/rapier-comparator.mjs');
writeFileSync(resolve(root,'tests/'+id+'-comparator.json'),JSON.stringify({cases:comparatorMatrix(),qualifiedBenchmark:false,nexusComparison:'NOT_RUN'},null,2)+'\n');
const summary={id,environment:'LOCAL_WINDOWS_ISOLATED',purpose:'FUNCTIONAL_DIAGNOSTIC_NOT_REFERENCE',
  harnessProcess:'IN_PROCESS_TEST_ISOLATION_NONE_SINGLE_CONCURRENCY',implementation:'BLOCKED',
  browserBuild:'BLOCKED_MISSING_CARGO_GPU_AND_WASM_TARGET',rustTypecheck:'NOT_RUN',
  gpuRuntime:'NOT_RUN_NO_A0_SLOT',actualAdapter:null,deviceLoss:'NOT_RUN',restart:'NOT_RUN',
  crossDevice:'NOT_RUN',hardwareCost:'NOT_RUN',productIntegration:'NO'};
process.on('exit',exitCode=>{
  summary.exitCode=exitCode;
  summary.independentCodeChecks=exitCode===0?'PASS':'FAIL';
  writeFileSync(resolve(root,'tests/'+id+'-summary.json'),JSON.stringify(summary,null,2)+'\n');
});
