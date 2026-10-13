import {readFileSync,writeFileSync,mkdirSync,copyFileSync,cpSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {root,verifyInputs,verifyMembers,json,save,walk,bytes} from './bindings.mjs';
for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE','NODE_INSPECTOR_IPC','VSCODE_INSPECTOR_OPTIONS','ESBUILD_BINARY_PATH','ESBUILD_WORKER_THREADS','ESBUILD_MAX_BUFFER'])
 if(process.env[key])throw Error('BUILD_AMBIENT_EFFECT_REQUIRES_DISPOSITION:'+key);
for(const [path,sha] of [
 ['node_modules/esbuild/package.json','24655ca1d9c91fe7517a99ec27bf1125b46efae71b54a55125d2a930b6ad61f9'],
 ['node_modules/esbuild/lib/main.js','b090fe57c79c677256a242703ea07bb2191eced357bece2f9a25539443da070c'],
 ['node_modules/@esbuild/win32-x64/package.json','fba0a44e5f43b9175c4e538d7c6a9791430aaa61756aa082c9ddbe0cf36fa69e'],
 ['node_modules/@esbuild/win32-x64/esbuild.exe','f0dd2091eaf58d11b96c64e0c4516f8ecf94486a28d2a8e7a968bd6770db3ffe']])
 if(createHash('sha256').update(readFileSync(root+'/'+path)).digest('hex')!==sha)throw Error('BUILD_TOOL_DRIFT:'+path);
verifyInputs();verifyMembers(json('r14-controls/BUILD_INPUTS_R03.json').files);
if(existsSync(root+'/.r14-runtime')||existsSync(root+'/dist-r14'))throw Error('FRESH_OUTPUT_REQUIRED_NO_OVERWRITE');
const {buildSync}=await import('esbuild'),pending=[],metadata=[];
const names=['optics','occlusion','timer','init','reuse','composer','weather-port','wetness','borrowed-port','temporal-boundary'];
for(const name of names){
 const result=buildSync({entryPoints:[root+'/src/'+name+'.ts'],outfile:root+'/.r14-runtime/'+name+'.mjs',bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.glsl':'text'},metafile:true,write:false});
 pending.push(...result.outputFiles);metadata.push(['.r14-runtime/'+name+'-metafile.json',result.metafile]);
}
const dataBindings=Object.fromEntries([...walk(root,'fixtures'),...walk(root,'inputs/rd/fixtures/F00-CONTROL')].map(path=>{const f=bytes(path);return [path.replace('inputs/rd/fixtures/F00-CONTROL','rd-fixture'),{bytes:f.bytes,sha256:f.sha256}];}));
const result=buildSync({entryPoints:[root+'/src/viewer.ts'],outfile:root+'/dist-r14/viewer.js',bundle:true,format:'esm',platform:'browser',sourcemap:true,loader:{'.glsl':'text'},define:{__DATA_BINDINGS__:JSON.stringify(dataBindings),__ROOT_PATH__:JSON.stringify(root)},metafile:true,write:false});
pending.push(...result.outputFiles);metadata.push(['.r14-runtime/browser-metafile.json',result.metafile]);
// All Source bundling must succeed before any generated JS is written.
for(const dir of ['.r14-runtime','dist-r14'])mkdirSync(root+'/'+dir,{recursive:true});
for(const file of pending){const path=resolve(file.path),base=root.replaceAll('\\','/');if(![base+'/.r14-runtime/',base+'/dist-r14/'].some(prefix=>path.replaceAll('\\','/').startsWith(prefix)))throw Error('OUTPUT_ESCAPE');writeFileSync(path,file.contents,{flag:'wx'});}
for(const [name,value]of metadata)save(name,value);
copyFileSync(root+'/index.html',root+'/dist-r14/index.html');cpSync(root+'/fixtures',root+'/dist-r14/fixtures',{recursive:true});cpSync(root+'/inputs/rd/fixtures/F00-CONTROL',root+'/dist-r14/rd-fixture',{recursive:true});
save('.r14-runtime/build-bindings.json',{sourceBundling:'PASS',glsl:'TEXT_ONLY_GPU_COMPILATION_NOT_RUN',files:[...walk(root,'dist-r14'),...walk(root,'.r14-runtime').filter(p=>p.endsWith('.mjs'))].map(bytes)});
console.log(JSON.stringify({sourceBundling:'PASS',compiledEntries:names.length,browserGpu:'NOT_RUN',headlessCapturedScreens:0}));

