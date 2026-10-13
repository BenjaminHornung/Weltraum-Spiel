import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,repo,verifyFiles,verifyConsumer,bytes,hash,walk,json,captureInputs} from '../scripts/bindings.mjs';
import {verifyRun} from '../scripts/receipt.mjs';
test('own consumer verifies full exact copied membership and byte bindings',()=>{
  const m=verifyConsumer();assert.equal(m.modelImplementation,'sha256:6a51ff1ab2ca347befe5aca796e230034368671abb98d1fe83a504025ed20c4e');assert.equal(m.compiledBindings.files.length,63);assert.equal(m.dependencyBindings.nodeModules.fileCount,533);
  assert.ok(m.files.some(f=>f.path==='vendor/cel/vendor/plt/licenses/Random123.txt'));assert.ok(m.files.some(f=>f.path==='vendor/cel/dist/src/contracts.js'));assert.ok(m.files.some(f=>f.path==='vendor/cel/dist/src/types.d.ts'));
});
test('byte verifier rejects drift, duplicates and path traversal before import',()=>{
  const dir=mkdtempSync(resolve(root,'.runtime/byte-negative-'));writeFileSync(resolve(dir,'sample.txt'),'original');const proof=bytes(dir,'sample.txt');verifyFiles(dir,[proof]);writeFileSync(resolve(dir,'sample.txt'),'changed');assert.throws(()=>verifyFiles(dir,[proof]),/BYTE_DRIFT/);
  writeFileSync(resolve(dir,'sample.txt'),'original');assert.throws(()=>verifyFiles(dir,[proof,proof]),/INVALID_BINDING/);
  for(const path of ['../sample.txt','C:/foreign','a\\b','/absolute','a/./b'])assert.throws(()=>verifyFiles(dir,[{...proof,path}]),/INVALID_BINDING/);
  assert.throws(()=>verifyFiles(dir,[]),/EMPTY_BINDINGS/);
});
const proof=()=>({status:'PASS',passed:94,failed:0,skipped:0,checks:['use-time-binding','build','fixture-bytecheck','independent-oracle','focused-tests'].map(label=>({label,exitCode:0})),
  testedInputs:captureInputs(),compiledInputs:json(resolve(root,'.runtime/build-bindings.json')).files});
test('receipt cannot reuse historical PASS with stale tested source or incomplete membership',()=>{
  const p=proof();verifyRun(p);const stale=json(resolve(repo,'.devtoolbox/specs/changes/wxg-01-04-2026-10-09/tests/runs/local-functional-02/summary.json'));assert.throws(()=>verifyRun(stale),/RUN_NOT_COMPLETE_PASS/);
  const missing=structuredClone(p);missing.testedInputs.pop();assert.throws(()=>verifyRun(missing),/TESTED_MEMBERSHIP/);
  const drift=structuredClone(p);drift.testedInputs.find(f=>f.path==='src/weather.ts').sha256='0'.repeat(64);assert.throws(()=>verifyRun(drift),/BYTE_DRIFT/);
});
test('receipt binds declarations/compiled membership and refuses skipped or failed checks',()=>{
  const p=proof(),missing=structuredClone(p);missing.compiledInputs=missing.compiledInputs.filter(f=>f.path!=='dist/src/weather.d.ts');assert.throws(()=>verifyRun(missing),/RUN_COMPILED_MEMBERSHIP/);
  for(const change of [x=>x.skipped=1,x=>x.failed=1,x=>x.checks[0].exitCode=1,x=>x.checks.pop()]){const q=structuredClone(p);change(q);assert.throws(()=>verifyRun(q),/RUN_NOT_COMPLETE_PASS/);}
});
