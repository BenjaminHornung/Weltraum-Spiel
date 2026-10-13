import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {readFileSync,copyFileSync,cpSync,mkdirSync} from 'node:fs';
import {root,verifyInputs,save,walk,bytes} from './bindings.mjs';
verifyInputs();
const fixture=spawnSync(process.execPath,['scripts/generate-rain-fixture.mjs'],{cwd:root,encoding:'utf8',windowsHide:true});
process.stdout.write(fixture.stdout??'');process.stderr.write(fixture.stderr??'');if(fixture.status!==0)process.exit(fixture.status??1);
const check=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],{cwd:root,encoding:'utf8',windowsHide:true});
process.stdout.write(check.stdout??'');process.stderr.write(check.stderr??'');if(check.status!==0)process.exit(check.status??1);
mkdirSync(root+'/dist',{recursive:true});
const dataBindings=Object.fromEntries([...walk(root,'fixtures'),...walk(root,'inputs/rd/fixtures/F00-CONTROL')].map(path=>{
 const f=bytes(path);return [path.replace('inputs/rd/fixtures/F00-CONTROL','rd-fixture'),{bytes:f.bytes,sha256:f.sha256}];}));
await build({entryPoints:[root+'/src/viewer.ts'],outfile:root+'/dist/viewer.js',bundle:true,format:'esm',platform:'browser',sourcemap:true,loader:{'.glsl':'text'},define:{__DATA_BINDINGS__:JSON.stringify(dataBindings)},plugins:[{name:'raw',setup(b){b.onLoad({filter:/\.json\?raw$/},args=>({contents:JSON.stringify(readFileSync(args.path.split('?')[0],'utf8')),loader:'text'}));}}],metafile:true}).then(r=>save('.runtime/browser-metafile.json',r.metafile));
copyFileSync(root+'/index.html',root+'/dist/index.html');cpSync(root+'/fixtures',root+'/dist/fixtures',{recursive:true});cpSync(root+'/inputs/rd/fixtures/F00-CONTROL',root+'/dist/rd-fixture',{recursive:true});
save('.runtime/build-bindings.json',{status:'PASS',typecheckExit:check.status,browserGpu:'NOT_RUN',files:walk(root,'dist').map(bytes)});
await build({entryPoints:[root+'/src/composer.ts'],outfile:root+'/.runtime/composer.mjs',bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.glsl':'text'}});
console.log(JSON.stringify({status:'PASS',typecheck:0,compiledFiles:walk(root,'dist').length}));
