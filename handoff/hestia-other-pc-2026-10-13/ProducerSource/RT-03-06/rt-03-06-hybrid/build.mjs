import ts from 'typescript';
import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises';
import path from 'node:path';
import {spike,sha,verifyInputs} from './inputs.mjs';
await verifyInputs();
const config=ts.readConfigFile(path.join(spike,'tsconfig.json'),ts.sys.readFile);
if(config.error)throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,spike);
const program=ts.createProgram(parsed.fileNames,parsed.options),diagnostics=[...parsed.errors,...ts.getPreEmitDiagnostics(program)];
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:n=>n,getCurrentDirectory:()=>spike,getNewLine:()=> '\n'}));process.exit(1);}
const emitted=program.emit();if(emitted.emitSkipped)throw new Error('Emit skipped');
const dist=path.join(spike,'dist');
for(const [from,to] of [['inputs/rt02a/fixtures','fixtures'],['fixtures','replay'],['node_modules/three/build','vendor/three'],['node_modules/three/src','vendor/three-src'],['node_modules/three/examples/jsm','vendor/addons'],['node_modules/three-mesh-bvh/src','vendor/bvh']]){
 await cp(path.join(spike,from),path.join(dist,to),{recursive:true});
}
async function walk(directory,prefix=''){const rows=[];for(const e of await readdir(directory,{withFileTypes:true})){if(e.isSymbolicLink())throw new Error('Symlink not allowed');const name=prefix+e.name,p=path.join(directory,e.name);if(e.isDirectory())rows.push(...await walk(p,name+'/'));else {const b=await readFile(p);rows.push({path:name,byteLength:b.length,sha256:sha(b)});}}return rows.sort((a,b)=>a.path.localeCompare(b.path,'en'));}
for(const r of await walk(path.join(spike,'src'),'src/'))if(r.path.endsWith('.wgsl')){await mkdir(path.dirname(path.join(dist,r.path)),{recursive:true});await cp(path.join(spike,r.path),path.join(dist,r.path));}
await cp(path.join(spike,'inputs/rt02b/src/dda.wgsl'),path.join(dist,'inputs/rt02b/src/dda.wgsl'));
for(const f of ['index.html','repro-profile.json'])await cp(path.join(spike,f),path.join(dist,f));
const inputs=[];for(const p of ['package.json','package-lock.json','tsconfig.json','build.mjs','input-manifest.json','index.html','repro-profile.json']){const b=await readFile(path.join(spike,p));inputs.push({path:p,byteLength:b.length,sha256:sha(b)});}
for(const dir of ['src','inputs','fixtures'])inputs.push(...await walk(path.join(spike,dir),dir+'/'));
const proof={schema:'hestia.rt0306.build.v1',node:process.version,inputs:inputs.sort((a,b)=>a.path.localeCompare(b.path,'en')),outputs:(await walk(dist)).filter(r=>r.path!=='build-proof.json'),selfDigestPolicy:'Only this proof excluded from its own outputs; exact proof bytes in outer payload binding'};
await writeFile(path.join(dist,'build-proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:'PASS',inputs:inputs.length,outputs:proof.outputs.length,compiler:'OWN_TS_5.9.3',gpuCompile:'NOT_RUN'}));
