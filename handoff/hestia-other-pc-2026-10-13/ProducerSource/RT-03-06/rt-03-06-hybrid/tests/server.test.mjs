import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createSealedServer} from '../sealed-server.mjs';
import {spike,sha} from '../inputs.mjs';
test('REAL LOCAL HTTP: serving after startup tamper fails closed for own/runtime/vendor/control bytes',async()=>{
 const root=path.join(spike,'runner-results','server-tamper-'+Date.now());await mkdir(path.join(root,'dist/src'),{recursive:true});
 const before=Buffer.from('export const frozen=1;\n'),control=Buffer.from('{}\n');await writeFile(path.join(root,'dist/src/hybrid.mjs'),before);await writeFile(path.join(root,'binding-manifest.json'),control);
 const row={path:'spikes/rt-03-06-hybrid/dist/src/hybrid.mjs',byteLength:before.length,sha256:sha(before)},controlRow={path:'binding-manifest.json',byteLength:control.length,sha256:sha(control)};
 const server=createSealedServer(root,{files:[row]},[controlRow]);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 try{const base='http://127.0.0.1:'+server.address().port;assert.equal((await fetch(base+'/src/hybrid.mjs')).status,200);
  await writeFile(path.join(root,'dist/src/hybrid.mjs'),'export const frozen=2;\n');const changed=await fetch(base+'/src/hybrid.mjs');assert.equal(changed.status,412);assert.equal(await changed.text(),'FROZEN_BYTES_DRIFT');
  await writeFile(path.join(root,'binding-manifest.json'),'changed');assert.equal((await fetch(base+'/binding-manifest.json')).status,412);assert.equal((await fetch(base+'/unbound.js')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
