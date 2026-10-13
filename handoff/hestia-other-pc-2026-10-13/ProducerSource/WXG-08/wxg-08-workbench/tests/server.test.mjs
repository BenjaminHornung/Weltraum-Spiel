import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,hash} from '../scripts/inputs.mjs';
test('real preview serves exact build bytes and rejects encoded escapes from static directories',async()=>{
 for(const [url,path] of [['/','web/index.html'],['/dist/src/core.js','dist/src/core.js']]){
  const r=await fetch('http://127.0.0.1:4188'+url);assert.equal(r.status,200);assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(readFileSync(resolve(root,path))));
 }
 for(const path of ['/dist/%2e%2e%2fREADME.md','/web/%2e%2e%2fInputBindings.json','/dist/%2e%2e%2f.runtime/final-seal/final-bindings.json','/receipt.json','/dist/%2e%2e%2f%2e%2e%2fAGENTS.md']){
  const r=await fetch('http://127.0.0.1:4188'+path);assert.equal(r.status,404,path);
 }
});
