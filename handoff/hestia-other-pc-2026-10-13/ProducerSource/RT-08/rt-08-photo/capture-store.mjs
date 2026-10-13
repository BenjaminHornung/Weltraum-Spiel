import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {sha} from './verify-inputs.mjs';
export async function storeCapture(root,runId,name,value){
 assert.match(runId,/^rt08-[a-z0-9-]{1,64}$/);assert.ok(['32','128','512','diagnostics'].includes(name));
 const dir=path.join(root,'captures',runId);await mkdir(dir,{recursive:true});
 if(name==='diagnostics'){assert.equal(value.productIntegration,'NO');await writeFile(path.join(dir,'diagnostics.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});return;}
 const {bytes,sidecar}=value;assert.ok(Array.isArray(bytes)&&bytes.length<=8*1024*1024&&bytes.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
 const png=Uint8Array.from(bytes);assert.deepEqual(Array.from(png.slice(0,8)),[137,80,78,71,13,10,26,10]);
 assert.equal(sidecar.productIntegration,'NO');assert.equal(sidecar.executionLocation,'LOCAL_WINDOWS_ISOLATED');assert.ok(sidecar.samples.min>=Number(name));
 assert.equal(sidecar.png.byteLength,png.length);assert.equal(sidecar.png.sha256,sha(png));
 await writeFile(path.join(dir,name+'spp.png'),png,{flag:'wx'});await writeFile(path.join(dir,name+'spp.json'),JSON.stringify(sidecar,null,2)+'\n',{flag:'wx'});
}
