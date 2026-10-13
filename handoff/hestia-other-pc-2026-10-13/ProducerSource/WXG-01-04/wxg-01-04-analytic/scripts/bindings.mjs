import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,lstatSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const repo=resolve(root,'../..');
export const baseline='17b1db4201a28e7b607c30707bdc2b75e3484a10';
export const branch='feature/wxg-01-04-2026-10-09';
export const node='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
export const python='C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe';
export const gitPath='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const json=p=>JSON.parse(readFileSync(p));
export function save(path,value){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(value,null,2)+'\n');}
export function bytes(base,path){const b=readFileSync(resolve(base,path));return {path,bytes:b.length,sha256:hash(b)};}
export function walk(base,sub=''){
  const out=[]; for(const e of readdirSync(resolve(base,sub),{withFileTypes:true})){
    const p=sub?sub+'/'+e.name:e.name;
    if(e.isDirectory())out.push(...walk(base,p));else if(e.isFile())out.push(p);else throw Error('NON_REGULAR:'+p);
  }return out.sort();
}
export function verifyFiles(base,files){
  if(!Array.isArray(files)||!files.length)throw Error('EMPTY_BINDINGS'); const seen=new Set();
  for(const f of files){const p=f.path??f.localPath;
    if(typeof p!=='string'||p.includes('\\')||p.includes(':')||p.split('/').some(x=>!x||x==='.'||x==='..')||seen.has(p)||!Number.isSafeInteger(f.bytes)||f.bytes<0||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('INVALID_BINDING:'+p);
    seen.add(p);let current=resolve(base);if(lstatSync(current).isSymbolicLink())throw Error('SYMLINK_ROOT');
    for(const part of p.split('/')){current=resolve(current,part);if(lstatSync(current).isSymbolicLink())throw Error('SYMLINK:'+p);}
    const b=readFileSync(current);if(b.length!==f.bytes||hash(b)!==f.sha256)throw Error('BYTE_DRIFT:'+p);
  }return files;
}
export function git(args,accepted=[0]){const r=spawnSync(gitPath,args,{cwd:repo,windowsHide:true,maxBuffer:32*1024*1024});if(!accepted.includes(r.status))throw Error('GIT_ERROR:'+r.status+':'+(r.error?.code??'')+':'+r.stderr);return r.stdout;}
export function verifyIsolation(){if(git(['rev-parse','HEAD']).toString().trim()!==baseline||git(['branch','--show-current']).toString().trim()!==branch)throw Error('ISOLATION_CHANGED');}
export function verifyConsumer(){const m=json(resolve(root,'ConsumerBindings.json'));verifyFiles(root,m.files);
  for(const dir of ['vendor/cel','node_modules']){const expected=m.files.filter(f=>f.path.startsWith(dir+'/')).map(f=>f.path).sort();if(JSON.stringify(walk(root,dir))!==JSON.stringify(expected))throw Error('MEMBERSHIP_DRIFT:'+dir);}
  if(existsSync(resolve(root,'SourceBindings.json'))){const s=json(resolve(root,'SourceBindings.json'));verifyFiles(root,s.files);if(JSON.stringify(walk(root,'snapshot'))!==JSON.stringify(s.files.map(f=>f.path).sort()))throw Error('SOURCE_MEMBERSHIP');}
  return m;
}
export function captureInputs(base=root){return [...['src','tests','scripts','fixtures','snapshot'].flatMap(p=>walk(base,p)),...['ConsumerBindings.json','SourceBindings.json','package.json','package-lock.json','tsconfig.json']].sort().map(p=>bytes(base,p));}
export function verifyBuild(){
  const m=json(resolve(root,'.runtime/model-binding.json')),b=json(resolve(root,'.runtime/build-bindings.json'));
  verifyFiles(root,m.inputs);verifyFiles(root,[m.config]);
  if(bytes(root,'ConsumerBindings.json').sha256!==m.consumerDigest)throw Error('MODEL_CONSUMER_DRIFT');
  if('sha256:'+hash(JSON.stringify({inputs:m.inputs,consumerDigest:m.consumerDigest,config:m.config}))!==m.modelDigest)throw Error('MODEL_BINDING_DRIFT');
  const actual=walk(root,'src').filter(p=>p!=='src/model-pin.ts');if(JSON.stringify(actual)!==JSON.stringify(m.inputs.map(f=>f.path)))throw Error('MODEL_MEMBERSHIP');
  if(!readFileSync(resolve(root,'src/model-pin.ts'),'utf8').includes(m.modelDigest))throw Error('MODEL_PIN_DRIFT');
  verifyFiles(root,b.files);if(JSON.stringify(walk(root,'dist'))!==JSON.stringify(b.files.map(f=>f.path)))throw Error('COMPILED_MEMBERSHIP');
  return {model:m,compiled:b};
}
