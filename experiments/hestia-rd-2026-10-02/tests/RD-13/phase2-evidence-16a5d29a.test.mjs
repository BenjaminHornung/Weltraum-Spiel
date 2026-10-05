import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBytes,checkPng,checkCompilerFailure } from '../../reports/RD-13/phase2-16a5d29a/audit-evidence.mjs';
import { RUN,LAB,PHASE,bytes,json,sha } from '../../reports/RD-13/phase2-16a5d29a/support.mjs';
test('sealed evidence rejects changed bytes, fake dimensions and relabelled/no-allocation shader failures',()=>{
 const index=json(LAB+'/'+PHASE+'/index.json');const record=index.entries[0].ui;const raw=bytes(LAB+'/'+PHASE+'/'+record.path);checkPng(record,raw);
 const altered=Buffer.from(raw);altered[altered.length-1]^=1;assert.throws(()=>checkBytes(record,altered));assert.throws(()=>checkPng({...record,width:record.width+1},raw));
 const data=json(RUN+'/numeric/visible-v1.json');const kernel=json(RUN+'/preflight.json').kernel;checkCompilerFailure(data.result,kernel);
 assert.throws(()=>checkCompilerFailure({...data.result,status:'PASS'},kernel));assert.throws(()=>checkCompilerFailure({...data.result,allocations:0},kernel));
 assert.throws(()=>checkCompilerFailure({...data.result,fragment:data.result.fragment.replace(kernel,'')},kernel));
 assert.equal(sha(raw),record.sha256);
});
