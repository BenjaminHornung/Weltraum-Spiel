import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {spike,sha} from './inputs.mjs';
import {createSealedServer} from './sealed-server.mjs';
const root=path.join(spike,'dist'),port=Number(process.argv[2]??8736);if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('Invalid local port');
const sealBytes=await readFile(path.join(spike,'seal.json')),seal=JSON.parse(sealBytes),manifestBytes=await readFile(path.join(spike,'binding-manifest.json')),ref=seal.controls.find(r=>r.path==='binding-manifest.json');
if(!ref||sha(manifestBytes)!==ref.sha256||manifestBytes.length!==ref.byteLength)throw new Error('Manifest seal mismatch');
const controls=[...seal.controls,{path:'seal.json',byteLength:sealBytes.length,sha256:sha(sealBytes)}];
createSealedServer(spike,JSON.parse(manifestBytes),controls).listen(port,'127.0.0.1',()=>console.log('LOCAL_LOOPBACK_ONLY http://127.0.0.1:'+port+' GPU_NOT_STARTED BYTE_CHECK_EACH_RESPONSE'));
