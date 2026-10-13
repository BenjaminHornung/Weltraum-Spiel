import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { root,hash } from '../scripts/bind-inputs.mjs';
import { verifyRunBindings } from '../scripts/run-bindings.mjs';
test('historical PASS without tested-source/compiled byteproof cannot certify receipt',()=>{
  const old=JSON.parse(readFileSync(new URL('../../../.devtoolbox/specs/changes/cel-01-wxg-00-2026-10-09/tests/runs/local-functional-02/summary.json',import.meta.url)));
  assert.throws(()=>verifyRunBindings(old),/MISSING_RUN_BYTEPROOFS/);
});
test('receipt boundary rejects actual post-test own-source and declaration drift',t=>{
  const runtime=resolve(root,'.runtime'),base=resolve(runtime,'receipt-proof-'+randomUUID());mkdirSync(base);
  t.after(()=>{assert.equal(dirname(base),runtime);rmSync(base,{recursive:true,force:true});});
  const required=['src/contracts.ts','src/types.ts','src/fixtures.ts','src/model-pin.ts','fixtures/profiles.json','fixtures/schema-goldens.json','fixtures/read-goldens-input.json','SourceBindings.json','package-lock.json'];
  const bind=localPath=>{const p=resolve(base,localPath);mkdirSync(dirname(p),{recursive:true});const b=Buffer.from('original');writeFileSync(p,b);return {localPath,bytes:b.length,sha256:hash(b)};};
  const summary={status:'PASS',passed:1,failed:0,checks:['tool-bytecheck','build','independent-oracle','focused-tests'].map(label=>({label,exitCode:0})),testedInputs:required.map(bind),compiledInputs:[bind('dist/src/types.d.ts')]};
  verifyRunBindings(summary,base);
  for(const path of ['src/contracts.ts','fixtures/profiles.json','dist/src/types.d.ts']){
    const p=resolve(base,path);writeFileSync(p,'modified');assert.throws(()=>verifyRunBindings(summary,base),/LOCAL_SNAPSHOT_DRIFT/);writeFileSync(p,'original');
  }
});
test('failed run cannot be relabelled by receipt verifier',()=>{
  assert.throws(()=>verifyRunBindings({status:'FAIL',passed:69,failed:0,checks:[]}),/RUN_NOT_PASS/);
});
