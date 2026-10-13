import {readFileSync,copyFileSync,cpSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {root,verifyInputs,save,walk,bytes} from './bindings.mjs';
// A pre-launch guard is mandatory too: NODE_OPTIONS can run before this script.
for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE','NODE_INSPECTOR_IPC','VSCODE_INSPECTOR_OPTIONS','ESBUILD_BINARY_PATH','ESBUILD_WORKER_THREADS','ESBUILD_MAX_BUFFER'])
 if(process.env[key])throw Error('BUILD_AMBIENT_EFFECT_REQUIRES_DISPOSITION:'+key);
for(const [path,sha] of [
 ['node_modules/esbuild/package.json','24655ca1d9c91fe7517a99ec27bf1125b46efae71b54a55125d2a930b6ad61f9'],
 ['node_modules/esbuild/lib/main.js','b090fe57c79c677256a242703ea07bb2191eced357bece2f9a25539443da070c'],
 ['node_modules/@esbuild/win32-x64/package.json','fba0a44e5f43b9175c4e538d7c6a9791430aaa61756aa082c9ddbe0cf36fa69e'],
 ['node_modules/@esbuild/win32-x64/esbuild.exe','f0dd2091eaf58d11b96c64e0c4516f8ecf94486a28d2a8e7a968bd6770db3ffe']])
 if(createHash('sha256').update(readFileSync(root+'/'+path)).digest('hex')!==sha)throw Error('BUILD_TOOL_DRIFT:'+path);
verifyInputs();
const {buildSync}=await import('esbuild');
mkdirSync(root+'/.runtime',{recursive:true});
for(const name of ['optics','occlusion','timer','init','reuse','composer','weather-port'])
 {const result=buildSync({entryPoints:[root+'/src/'+name+'.ts'],outfile:root+'/.runtime/'+name+'.mjs',bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.glsl':'text'},metafile:true});save('.runtime/'+name+'-metafile.json',result.metafile);}
const dataBindings=Object.fromEntries([...walk(root,'fixtures'),...walk(root,'inputs/rd/fixtures/F00-CONTROL')].map(path=>{const f=bytes(path);return [path.replace('inputs/rd/fixtures/F00-CONTROL','rd-fixture'),{bytes:f.bytes,sha256:f.sha256}];}));
const result=buildSync({entryPoints:[root+'/src/viewer.ts'],outfile:root+'/dist/viewer.js',bundle:true,format:'esm',platform:'browser',sourcemap:true,loader:{'.glsl':'text'},define:{__DATA_BINDINGS__:JSON.stringify(dataBindings)},metafile:true});
save('.runtime/browser-metafile.json',result.metafile);
copyFileSync(root+'/index.html',root+'/dist/index.html');cpSync(root+'/fixtures',root+'/dist/fixtures',{recursive:true});cpSync(root+'/inputs/rd/fixtures/F00-CONTROL',root+'/dist/rd-fixture',{recursive:true});
save('.runtime/build-bindings.json',{sourceBundling:'PASS',glsl:'TEXT_ONLY_GPU_COMPILATION_NOT_RUN',files:[...walk(root,'dist'),...walk(root,'.runtime').filter(p=>p.endsWith('.mjs'))].map(bytes)});
console.log(JSON.stringify({sourceBundling:'PASS',compiledEntries:7,browserGpu:'NOT_RUN'}));

