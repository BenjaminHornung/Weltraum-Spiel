import assert from 'node:assert/strict';import test from 'node:test';
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {verifyInputs} from '../verify-inputs.mjs';
test('use-time frozen fixture tamper negative retained separately; source unchanged',async()=>{
 const before=await readFile('input-bindings.json'),copy='negative-copies/'+randomUUID();await mkdir(copy,{recursive:true});await cp('inputs',copy+'/inputs',{recursive:true});await cp('input-bindings.json',copy+'/input-bindings.json');
 const target=JSON.parse(before).files.find(f=>f.path.endsWith('/src/port.ts')).path,b=await readFile(copy+'/'+target);b[0]^=1;await writeFile(copy+'/'+target,b);
 await assert.rejects(verifyInputs(copy));await verifyInputs();assert.deepEqual(await readFile('input-bindings.json'),before);
});
