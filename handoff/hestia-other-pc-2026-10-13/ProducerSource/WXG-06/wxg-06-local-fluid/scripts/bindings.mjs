import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..');
export const baseline='17b1db4201a28e7b607c30707bdc2b75e3484a10',branch='feature/wxg-06-2026-10-09';
export const node='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
export const python='C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe';
export const gitPath='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
export const hash=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(readFileSync(p));
export function save(p,v){mkdirSync(dirname(p),{recursive:true});writeFileSync(p,JSON.stringify(v,null,2)+'\n');}
export function walk(base,sub=''){const out=[];for(const e of readdirSync(resolve(base,sub),{withFileTypes:true})){const p=sub?sub+'/'+e.name:e.name;if(e.isDirectory())out.push(...walk(base,p));else if(e.isFile())out.push(p);else throw Error('NON_REGULAR:'+p);}return out.sort();}
export function bytes(base,p){const b=readFileSync(resolve(base,p));return {path:p,bytes:b.length,sha256:hash(b)};}
export function safePath(base,p){if(typeof p!=='string'||p.includes('\\')||p.includes(':')||p.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('PATH:'+p);let q=resolve(base);for(const part of p.split('/')){q=resolve(q,part);if(lstatSync(q).isSymbolicLink())throw Error('SYMLINK:'+p);}return q;}
export function verifyFiles(base,files){if(!Array.isArray(files)||!files.length)throw Error('EMPTY_BINDINGS');const seen=new Set();for(const f of files){if(seen.has(f.path))throw Error('DUPLICATE_BINDING');seen.add(f.path);const b=readFileSync(safePath(base,f.path));if(b.length!==f.bytes||hash(b)!==f.sha256)throw Error('BYTE_DRIFT:'+f.path);}return files;}
export function verifyInputs(){const m=json(resolve(root,'InputBindings.json'));verifyFiles(root,m.files);const actual=walk(root,'inputs');if(JSON.stringify(actual)!==JSON.stringify(m.files.filter(f=>f.path.startsWith('inputs/')).map(f=>f.path).sort()))throw Error('INPUT_MEMBERSHIP');for(const t of m.tools){const b=readFileSync(t.path);if(b.length!==t.bytes||hash(b)!==t.sha256)throw Error('TOOL_DRIFT:'+t.name);}
 for(const [id,rsha,ssha] of [['wxg','1bc3442c6d068ed42b207857949dd168f3e7f6da64d0842b99228df4608c7106','03a072879c1d06484d3e8aec78883e8de3dcbef82866fa6722c056612055161e'],['fld','f7e1d2b684fa4ec6ae5ccf46b522d9d16b82a1a9e3d4ac56854bcdce7873ef0a','86bc67d36ee052c65c9c36ab143d874d9f578a910e003ae94b9096aec0a64f22']]){
  const base=resolve(root,'inputs',id),r=json(resolve(base,'receipt.json')),s=json(resolve(base,'.runtime/final-seal/scope-seal.json'));
  if(bytes(base,'receipt.json').sha256!==rsha||bytes(base,'.runtime/final-seal/scope-seal.json').sha256!==ssha||bytes(base,'.runtime/final-seal/review.patch').sha256!==s.reviewPatchDigest.slice(7))throw Error('UPSTREAM_ANCHOR_DRIFT');
  const refs=id==='wxg'?[...r.files,...r.testedInputs,...r.compiledFiles,...json(resolve(base,'ConsumerBindings.json')).files,r.source.sourceBindings]:[...r.bindings,...json(resolve(base,'SourceBindings.json')).code];
  const map=new Map(refs.map(f=>[f.path,f]));for(const f of s.changedFiles){const marker=id==='wxg'?'spikes/wxg-01-04-analytic/':'spikes/fld-01-phy-05-fluid/';if(f.path.startsWith(marker))map.set(f.path.slice(marker.length),{...f,sha256:f.sha256??f.digest?.slice(7)});}
  for(const f of m.files.filter(f=>f.path.startsWith('inputs/'+id+'/'))){const p=f.path.slice(('inputs/'+id+'/').length);if(p==='receipt.json'||p.startsWith('.runtime/'))continue;const ref=map.get(p);if(!ref||ref.bytes!==f.bytes||ref.sha256!==f.sha256)throw Error('UNAPPROVED_PRODUCER_MEMBER:'+f.path);}
  if(id==='wxg'&&(JSON.stringify(json(resolve(base,'.runtime/build-bindings.json')).files)!==JSON.stringify(r.compiledFiles)||JSON.stringify(json(resolve(base,'.runtime/model-binding.json')))!==JSON.stringify(r.modelImplementation)))throw Error('WXG_MODEL_OR_BUILD_DRIFT');
 }
 return m;}
export function git(args,accepted=[0]){const r=spawnSync(gitPath,['--no-optional-locks',...args],{cwd:repo,windowsHide:true,maxBuffer:128*1024*1024});if(!accepted.includes(r.status))throw Error('GIT_ERROR:'+r.status+':'+(r.error?.code??'')+':'+r.stderr);return r.stdout;}
export function verifyIsolation(){if(git(['rev-parse','HEAD']).toString().trim()!==baseline||git(['branch','--show-current']).toString().trim()!==branch)throw Error('ISOLATION_DRIFT');}
export function inputs(){return [...['src','scripts','tests','fixtures'].flatMap(p=>walk(root,p)),...['InputBindings.json','package.json','package-lock.json','tsconfig.json']].sort().map(p=>bytes(root,p));}
export function verifyBuild(){const m=json(resolve(root,'.runtime/BuildBindings.json'));verifyFiles(root,m.source);verifyFiles(root,m.compiled);if(JSON.stringify(walk(root,'dist'))!==JSON.stringify(m.compiled.map(f=>f.path)))throw Error('BUILD_MEMBERSHIP');return m;}
