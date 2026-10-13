import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSource } from '../scripts/audit-source.mjs';
import { requireRunnerLease,runBoundNexus } from '../src/browser-runner.mjs';
test('pinned real Nexus source witnesses preserve unsupported features and one-way MPM classification',()=>{
  const r=auditSource();
  assert.equal(r.recommendation,'NO_ADOPTION_FOR_HVP');
  assert.equal(r.features.find(x=>x.name==='heightfield').status,'UNSUPPORTED');
  assert.equal(r.features.find(x=>x.name==='MPM directional coupling').status,'ONE_WAY_SOURCE');
  assert.ok(r.features.every(x=>x.runtime==='NOT_RUN'));
});
test('POLICY_UNIT: missing lease, missing build and invalid fixture stop before any device/backend work',async()=>{
  let touched=false;
  const args={fetchBytes:()=>{touched=true;throw Error('unexpected');},loadModule:()=>{touched=true;}};
  assert.throws(()=>requireRunnerLease({slotGranted:true}),/SLOT_REQUIRED/);
  await assert.rejects(runBoundNexus(args),/SLOT_REQUIRED/);
  const lease={task:'PHY-04',runnerId:'policy-unit-mock-not-a-real-slot',slotGranted:true};
  await assert.rejects(runBoundNexus({...args,lease,bindings:{status:'BLOCKED'}}),/BUILD_BLOCKED/);
  await assert.rejects(runBoundNexus({...args,lease,count:10000}),/Count/);
  assert.equal(touched,false);
});
test('POLICY_UNIT: corrupt served WASM is rejected; no mock result is labeled Nexus PASS',async()=>{
  const lease={task:'PHY-04',runnerId:'policy-unit-mock-not-a-real-slot',slotGranted:true};
  let loaded=false;
  await assert.rejects(runBoundNexus({lease,
    bindings:{status:'PASS',wasm:{path:'a',sha256:'0'.repeat(64)},module:{path:'b',sha256:'0'.repeat(64)},shaders:[{path:'c',sha256:'0'.repeat(64)}]},
    fetchBytes:async()=>new Uint8Array([1,2,3]),loadModule:async()=>{loaded=true;}
  }),/BYTE_MISMATCH/);
  assert.equal(loaded,false);
});
