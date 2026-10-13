import {buildSync} from 'esbuild';
import {readFileSync,copyFileSync,cpSync,mkdirSync} from 'node:fs';
import {root,verifyInputs,save,walk,bytes} from './bindings.mjs';
verifyInputs();
mkdirSync(root+'/.runtime',{recursive:true});
for(const name of ['optics','occlusion','timer','init','reuse','composer','weather-port'])
 {const result=buildSync({entryPoints:[root+'/src/'+name+'.ts'],outfile:root+'/.runtime/'+name+'.mjs',bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.glsl':'text'},metafile:true});save('.runtime/'+name+'-metafile.json',result.metafile);}
const dataBindings=Object.fromEntries([...walk(root,'fixtures'),...walk(root,'inputs/rd/fixtures/F00-CONTROL')].map(path=>{const f=bytes(path);return [path.replace('inputs/rd/fixtures/F00-CONTROL','rd-fixture'),{bytes:f.bytes,sha256:f.sha256}];}));
const result=buildSync({entryPoints:[root+'/src/viewer.ts'],outfile:root+'/dist/viewer.js',bundle:true,format:'esm',platform:'browser',sourcemap:true,loader:{'.glsl':'text'},define:{__DATA_BINDINGS__:JSON.stringify(dataBindings)},metafile:true});
save('.runtime/browser-metafile.json',result.metafile);
copyFileSync(root+'/index.html',root+'/dist/index.html');cpSync(root+'/fixtures',root+'/dist/fixtures',{recursive:true});cpSync(root+'/inputs/rd/fixtures/F00-CONTROL',root+'/dist/rd-fixture',{recursive:true});
save('.runtime/build-bindings.json',{sourceBundling:'PASS',glsl:'TEXT_ONLY_GPU_COMPILATION_NOT_RUN',files:[...walk(root,'dist'),...walk(root,'.runtime').filter(p=>p.endsWith('.mjs'))].map(bytes)});
console.log(JSON.stringify({sourceBundling:'PASS',compiledEntries:7,browserGpu:'NOT_RUN'}));

