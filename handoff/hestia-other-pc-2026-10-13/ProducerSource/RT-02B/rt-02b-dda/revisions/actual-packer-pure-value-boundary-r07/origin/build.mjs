import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,readdir,mkdir,copyFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {spike,sha,verifyImports} from './inputs.mjs';
await verifyImports();const r=spawnSync(process.execPath,[path.join(spike,'node_modules/typescript/bin/tsc'),'-p',path.join(spike,'tsconfig.json')],{cwd:spike,encoding:'utf8'});
process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;assert.equal(r.status,0,'Own compiler exit');
const dist=path.join(spike,'dist');await mkdir(path.join(dist,'src'),{recursive:true});await copyFile(path.join(spike,'src/dda.wgsl'),path.join(dist,'src/dda.wgsl'));
await copyFile(path.join(spike,'index.html'),path.join(dist,'index.html'));await copyFile(path.join(spike,'browser-profile.mjs'),path.join(dist,'browser-profile.mjs'));
await mkdir(path.join(dist,'imported/gfx03/src'),{recursive:true});await copyFile(path.join(spike,'imported/gfx03/src/capability.mjs'),path.join(dist,'imported/gfx03/src/capability.mjs'));
async function copyTree(from,to){await mkdir(to,{recursive:true});for(const e of await readdir(from,{withFileTypes:true})){assert.ok(!e.isSymbolicLink());if(e.isDirectory())await copyTree(path.join(from,e.name),path.join(to,e.name));else await copyFile(path.join(from,e.name),path.join(to,e.name));}}
await copyTree(path.join(spike,'imported/fixtures'),path.join(dist,'fixtures'));await mkdir(path.join(dist,'vendor'),{recursive:true});
for(const name of ['three.module.js','three.core.js'])await copyFile(path.join(spike,'node_modules/three/build',name),path.join(dist,'vendor',name));
async function tree(dir,prefix){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=prefix+'/'+e.name;if(e.isDirectory())result.push(...await tree(path.join(dir,e.name),p));else{assert.ok(!e.isSymbolicLink());const b=await readFile(path.join(dir,e.name));result.push({path:p,byteLength:b.length,sha256:sha(b)});}}return result;}
const names=['package.json','package-lock.json','tsconfig.json','build.mjs','index.html','browser-profile.mjs','import-manifest.json',...(await tree(path.join(spike,'src'),'src')).map(f=>f.path),...(await tree(path.join(spike,'imported'),'imported')).map(f=>f.path)].sort();
const inputs=[];for(const n of names){const b=await readFile(path.join(spike,n));inputs.push({path:n,byteLength:b.length,sha256:sha(b)});}
await writeFile(path.join(dist,'build-proof.json'),JSON.stringify({schema:'hestia.rt02b.build.v1',node:process.version,inputs},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',typeScript:'5.9.3',sourceInputs:inputs.length,gpuCompilation:'NOT_RUN'}));
