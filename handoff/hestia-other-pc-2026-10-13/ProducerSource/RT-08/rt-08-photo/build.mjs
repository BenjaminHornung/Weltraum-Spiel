import {build} from 'esbuild';
import {cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {verifyInputs,sha} from './verify-inputs.mjs';
await verifyInputs();await mkdir('dist',{recursive:true});
const result=await build({entryPoints:['src/main.ts'],bundle:true,format:'esm',outdir:'dist',metafile:true,minify:false,target:'es2022',sourcemap:true});
await build({entryPoints:['src/snapshot.ts'],bundle:true,format:'esm',platform:'node',outfile:'dist/snapshot.mjs',target:'es2022'});
await cp('index.html','dist/index.html');await cp('inputs/gfx03/spikes/gfx-03-backend-bakeoff/imported/rt01/fixtures','dist/fixtures',{recursive:true});
const names=['build.mjs','index.html','package.json','package-lock.json','tsconfig.json','input-bindings.json'];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const n=dir+'/'+e.name;if(e.isDirectory())await walk(n);else names.push(n);}}
await walk('src');await walk('inputs');
const inputs=[];for(const name of names.sort()){const bytes=await readFile(name);inputs.push({path:name,byteLength:bytes.length,sha256:sha(bytes)});}
await writeFile('dist/build-proof.json',JSON.stringify({schema:'rt08.build.v1',node:process.version,inputs,bundlerInputs:result.metafile.inputs},null,2)+'\n');
console.log('PASS photo production build and bound CPU scene module');
