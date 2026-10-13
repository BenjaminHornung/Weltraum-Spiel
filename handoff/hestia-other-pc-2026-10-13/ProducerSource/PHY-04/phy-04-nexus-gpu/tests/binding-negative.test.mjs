import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyDependencies} from '../scripts/verify-inputs.mjs';
import {assertFreshSeal,assertNoForeignStage} from '../scripts/seal-data.mjs';
import {run,assertFreshOutputs,sha256} from '../scripts/commands.mjs';
test('required dependency map and changed source/tool bytes fail closed',()=>{
  const deps=JSON.parse(readFileSync(new URL('../DependencyBindings.json',import.meta.url)));
  assert.throws(()=>verifyDependencies(undefined),/BINDINGS_REQUIRED/);
  const broken=structuredClone(deps);broken.records[0].sha256='0'.repeat(64);broken.recordsDigest=sha256(JSON.stringify(broken.records));
  assert.throws(()=>verifyDependencies(broken),/DEPENDENCY_SHA/);
  const changedTool=structuredClone(deps);changedTool.binaries[0].sha256='0'.repeat(64);
  assert.throws(()=>verifyDependencies(changedTool),/TOOL_SHA/);
  const escape=structuredClone(deps);escape.records[0].path='../outside';escape.recordsDigest=sha256(JSON.stringify(escape.records));
  assert.throws(()=>verifyDependencies(escape),/OWN_INPUT_SCOPE/);
});
test('stored seal lists, payload lists and identity cannot change behind unchanged digest fields',()=>{
  const files=[{path:'a',bytes:1,sha256:'a'}];
  const current={schema:'phy04.scope-seal.v1',baseline:'base',branch:'branch',scope:'PASS',
    changedFiles:files,dirtyTreeDigest:sha256(JSON.stringify(files)),payloadDigest:sha256(JSON.stringify(files)),canonicalLfs:[]};
  const payload={files,digest:current.payloadDigest};
  assertFreshSeal(structuredClone(current),current,payload);
  const tampered=structuredClone(current);tampered.changedFiles[0].bytes=2;
  assert.throws(()=>assertFreshSeal(tampered,current,payload),/STORED_DIRTY/);
  assert.throws(()=>assertFreshSeal({...current,branch:'other'},current,payload),/SEAL_STALE/);
  assert.throws(()=>assertFreshSeal(current,current,{...payload,files:[]}),/STORED_PAYLOAD/);
});
test('unsafe or reused command/repro ID is rejected before execution or evidence overwrite',()=>{
  assert.throws(()=>assertFreshOutputs('../escape',[]),/SAFE_UNIQUE/);
  assert.throws(()=>assertFreshOutputs('repro-01',['tests/repro-01-summary.json']),/IMMUTABLE_OUTPUT/);
  // This nonexistent executable must never be read or started when the ID already exists.
  assert.throws(()=>run('build-02-cargo-gpu','C:/IFI_SourceCode/never-run.exe',[]),/IMMUTABLE_OUTPUT/);
});
test('a foreign staged change cannot be dismissed as an unchanged LFS working-tree object',()=>{
  assertNoForeignStage(['spikes/phy-04-nexus-gpu/src/fixtures.mjs'],['spikes/phy-04-nexus-gpu/']);
  assert.throws(()=>assertNoForeignStage(['art/foreign.fbx'],['spikes/phy-04-nexus-gpu/']),/STAGED_OUT_OF_SCOPE/);
});
