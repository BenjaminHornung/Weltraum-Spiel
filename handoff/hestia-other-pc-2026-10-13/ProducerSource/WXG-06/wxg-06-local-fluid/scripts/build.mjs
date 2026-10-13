import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,node,verifyIsolation,verifyInputs,walk,bytes,save,hash} from './bindings.mjs';

const sourcePaths=()=>[...walk(root,'src'),'fixtures/profile.json','tsconfig.json','package.json','package-lock.json','InputBindings.json','scripts/build.mjs'].sort();
const snapshot=()=>sourcePaths().map(p=>bytes(root,p));
verifyIsolation();
const inputBindings=verifyInputs();
if(process.versions.node!=='22.23.2'||resolve(process.execPath).toLowerCase()!==resolve(node).toLowerCase())throw Error('NODE_PIN');
const project=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const lock=JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'));
const compilerRoot='inputs/wxg/node_modules/typescript';
const compilerPackage=JSON.parse(readFileSync(resolve(root,compilerRoot,'package.json'),'utf8'));
if(project.devDependencies?.typescript!=='7.0.2'||lock.packages?.['node_modules/typescript']?.version!=='7.0.2'||compilerPackage.version!=='7.0.2')throw Error('TYPESCRIPT_PIN');
const compilerFiles=inputBindings.files.filter(f=>f.path.startsWith(`${compilerRoot}/`));
if(!compilerFiles.length)throw Error('TYPESCRIPT_BINDINGS');
const source=snapshot();
const r=spawnSync(node,[resolve(root,compilerRoot,'bin/tsc'),'-p','tsconfig.json'],{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:64*1024*1024});
process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');
if(r.error)process.stderr.write(`${r.error.message}\n`);
if(r.error||r.status!==0)process.exitCode=r.status??1;
else{
  verifyIsolation();verifyInputs();
  const after=snapshot();
  if(JSON.stringify(source)!==JSON.stringify(after))throw Error('SOURCE_DRIFT');
  const compiled=walk(root,'dist').map(p=>bytes(root,p));
  if(!compiled.length)throw Error('EMPTY_BUILD');
  save(resolve(root,'.runtime/BuildBindings.json'),{status:'PASS',typescript:compilerPackage.version,node:{path:node,version:process.versions.node},compiler:{root:compilerRoot,files:compilerFiles,digest:`sha256:${hash(JSON.stringify(compilerFiles))}`},source,sourceDigest:`sha256:${hash(JSON.stringify(source))}`,compiled,outputDigest:`sha256:${hash(JSON.stringify(compiled))}`});
  console.log(JSON.stringify({status:'PASS',typescript:compilerPackage.version,sourceFiles:source.length,compiledFiles:compiled.length,sourceDigest:`sha256:${hash(JSON.stringify(source))}`,outputDigest:`sha256:${hash(JSON.stringify(compiled))}`}));
}
