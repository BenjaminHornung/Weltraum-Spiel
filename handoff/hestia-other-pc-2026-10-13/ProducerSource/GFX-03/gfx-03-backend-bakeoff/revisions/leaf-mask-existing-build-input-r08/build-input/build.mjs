import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
execFileSync(process.execPath, ['../../../node_modules/typescript/lib/_tsc.js','-p','tsconfig.json'], {stdio:'inherit'});
await mkdir('dist',{recursive:true});
for (const [from,to] of [['index.html','dist/index.html'],['vendor/current','dist/vendor/current'],['vendor/historical','dist/vendor/historical'],['fixtures','dist/fixtures'],['src/image-oracle.mjs','dist/src/image-oracle.mjs']]) await cp(from,to,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const inputFiles=['index.html','tsconfig.json','package.json','package-lock.json','build.mjs'];
async function walk(dir){for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=`${dir}/${entry.name}`;if(entry.isDirectory())await walk(name);else inputFiles.push(name);}}
await walk('src');await walk('fixtures');
const inputs=[];for(const name of inputFiles.sort()){const bytes=await readFile(name);inputs.push({path:name,byteLength:bytes.length,sha256:sha(bytes)});}
await writeFile('dist/build-proof.json',JSON.stringify({schema:'hestia.gfx03-build-inputs.v1',node:process.version,inputs},null,2)+'\n');
console.log('Detached ES modules built; shader/shadow/pixel/product acceptance NOT_RUN');
