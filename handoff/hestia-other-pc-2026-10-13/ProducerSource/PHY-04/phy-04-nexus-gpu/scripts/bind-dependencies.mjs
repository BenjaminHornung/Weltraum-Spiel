import { readFileSync, writeFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { root,node,rustRoot,cargo,sha256 } from './commands.mjs';
function tree(base,prefix=''){
  return readdirSync(resolve(root,base,prefix)).sort().flatMap(name=>{
    const path=prefix?prefix+'/'+name:name;
    const stat=lstatSync(resolve(root,base,path));
    if(stat.isSymbolicLink()) throw Error('DEPENDENCY_SYMLINK');
    return stat.isDirectory()?tree(base,path):[{path:base+'/'+path,bytes:stat.size,sha256:sha256(readFileSync(resolve(root,base,path)))}];
  });
}
const records=[...tree('upstream/source'),...tree('upstream/khal-builder-0.4.0')];
for(const name of readdirSync(resolve(root,'upstream')).sort()){
  if(lstatSync(resolve(root,'upstream',name)).isFile()) {
    const bytes=readFileSync(resolve(root,'upstream',name));records.push({path:'upstream/'+name,bytes:bytes.length,sha256:sha256(bytes)});
  }
}
for(const path of ['harness/Cargo.toml','harness/Cargo.lock','package.json','package-lock.json']){
  const data=readFileSync(resolve(root,path));records.push({path,bytes:data.length,sha256:sha256(data)});
}
const binaries=[
  {name:'node',path:node,version:'22.23.2'},
  {name:'npm-cli',path:'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js',version:'10.9.8'},
  {name:'rustc',path:rustRoot+'/bin/rustc.exe',version:'1.97.1'},
  {name:'cargo',path:cargo,version:'1.97.1'},
  {name:'git',path:'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe'},
  {name:'python',path:'C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe',version:'3.12.13'}
].map(x=>({...x,bytes:readFileSync(x.path).length,sha256:sha256(readFileSync(x.path))}));
const result={schema:'phy04.dependency-bindings.v1',pins:{
  nexus:{version:'0.6.0',commit:'7c94a9664ddd6468de892c2bad6f56db8f992ed7',license:'MIT OR Apache-2.0'},
  khal:{version:'0.4.0',commit:'57ad7b6badd5bbdaa59462de282847abe8080912',license:'MIT OR Apache-2.0'},
  vortx:{version:'0.5.0',commit:'e7b9add21702a2656d7c39dbd848d33157e51b17',license:'Apache-2.0'},
  wasmBindgen:'0.2.129',wasmBindgenFutures:'0.4.79',webTime:'1.1.0',wgpu:'30.0.1'},
  resolution:{cargoLock:'harness/Cargo.lock',packages:218,exitCode:0,sourceArtifacts:'PINNED_LOCAL_SOURCE_AND_REGISTRY_CHECKSUMS',
    transitiveCratesCompiled:false,optionalRustCudaGitResolution:'RESOLVED_METADATA_ONLY_NOT_BUILT_OR_USED'},
  records,recordsDigest:sha256(JSON.stringify(records)),binaries,
  missing:{cargoGpu:'ACTUAL_EXIT_101_NO_SUCH_COMMAND',wasmTarget:'NOT_PRESENT_IN_VERIFIED_EXISTING_TOOLCHAIN'},
  browser:{status:'NOT_RUN_NO_BROWSER_CONTEXT_CREATED',version:null,reason:'No Nexus browserbuild or GPU slot; runtime identity not claimed'},
  artifacts:{nexusWasm:{status:'NOT_BUILT',sha256:null},computeShaders:{status:'NOT_BUILT',files:[]},
    pltWasm:{purpose:'TRIVIAL_LOAD_AND_BYTEBINDING_ONLY'},rapierWasm:'ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9'},
  sourceFork:'Local path dependencies copy exact upstream bytes; no source patch except own harness. Registry crates retained as independent identity/license/integrity witnesses.'};
writeFileSync(resolve(root,'DependencyBindings.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',files:records.length,recordsDigest:result.recordsDigest}));
