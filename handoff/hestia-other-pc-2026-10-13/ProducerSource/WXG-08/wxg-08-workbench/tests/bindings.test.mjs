import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {root,repo,git,json,check} from '../scripts/inputs.mjs';
test('receipt binds actual ignored stdout/stderr and rejects wrong bytes without rewriting raw evidence',()=>{
 const logs=json('receipt.json').evidence.files.filter(f=>/stdout\.log$|stderr\.log$/.test(f.path));assert.ok(logs.length>=10);
 const f=logs.find(f=>f.path.includes('/core-r03/stdout.log'));assert.ok(f);check(f);
 const result=spawnSync(git,['check-ignore',f.path],{cwd:root,windowsHide:true});assert.equal(result.status,0);
 assert.throws(()=>check({...f,sha256:'0'.repeat(64)}),/BYTE_DRIFT/);assert.throws(()=>check({...f,bytes:f.bytes+1}),/BYTE_DRIFT/);
});
test('receipt source, compiled, lock, fixtures and all current raw evidence verify',()=>{
 const r=json('receipt.json');for(const f of [...r.source.files,...r.build.files,...r.fixtures,...r.evidence.files,r.dependencies.lock])check(f);
 assert.equal(r.productIntegration,'NO');assert.equal(r.executionLocation,'LOCAL_WINDOWS_ISOLATED');
});
