import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,copyFileSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export const root=resolve(import.meta.dirname,'..'),repo=resolve(root,'../..');
export const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const json=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
export const save=(p,v)=>{const f=resolve(root,p);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,JSON.stringify(v,null,2)+'\n');};
export function walk(dir){return readdirSync(dir).flatMap(n=>{const p=resolve(dir,n),s=lstatSync(p);if(s.isSymbolicLink())throw Error('LINK:'+p);return s.isDirectory()?walk(p):[p];}).sort();}
export const member=p=>{const b=readFileSync(p);return {path:relative(root,p).replaceAll('\\','/'),bytes:b.length,sha256:hash(b)};};
export function check(f,base=root){const p=resolve(base,f.path),b=readFileSync(p);if(b.length!==f.bytes||hash(b)!==(f.sha256??f.digest?.replace('sha256:','')))throw Error('BYTE_DRIFT:'+p);}
export function command(args,cwd=repo){const r=spawnSync(git,args,{cwd,windowsHide:true,maxBuffer:64*1024*1024});if(r.status!==0)throw Error('GIT:'+r.status+':'+(r.error?.message??r.stderr));return r.stdout;}
const sources=[
 ['wxg','Hestia-Spike-WXG-01-04-2026-10-09/spikes/wxg-01-04-analytic','1bc3442c6d068ed42b207857949dd168f3e7f6da64d0842b99228df4608c7106','03a072879c1d06484d3e8aec78883e8de3dcbef82866fa6722c056612055161e'],
 ['atm','Hestia-Spike-ATM-01-04-2026-10-09/spikes/atm-01-04-volumes','b5eacd65a0f323b74829698999faece0b505a999144f1555ea9549e71ede22a8','cc3864c7800d2646c27f99658edd8614e4e5f81e1b31c361e697ab5d9196031e']
];
function verifyDescriptors(v,base,seen=new Set()){
 if(!v||typeof v!=='object')return 0;let count=0;
 if(typeof v.path==='string'&&Number.isInteger(v.bytes)&&(v.sha256||/^sha256:/.test(v.digest??''))){const key=resolve(base,v.path);if(!seen.has(key)){check(v,base);seen.add(key);count++;}}
 for(const child of Object.values(v))count+=verifyDescriptors(child,base,seen);return count;
}
if(process.argv[2]==='freeze'){
 if(command(['rev-parse','HEAD']).toString().trim()!=='17b1db4201a28e7b607c30707bdc2b75e3484a10'||command(['branch','--show-current']).toString().trim()!=='feature/wxg-08-2026-10-09')throw Error('ISOLATION');
 const members=[],producers=[];
 for(const [id,path,receiptHash,sealHash] of sources){
  const src=resolve(repo,'..',path),wt=resolve(src,'../..'),receipt=JSON.parse(readFileSync(resolve(src,'receipt.json'))),seal=JSON.parse(readFileSync(resolve(src,'.runtime/final-seal/scope-seal.json')));
  if(hash(readFileSync(resolve(src,'receipt.json')))!==receiptHash||hash(readFileSync(resolve(src,'.runtime/final-seal/scope-seal.json')))!==sealHash)throw Error('ANCHOR:'+id);
  const dirty=seal.changedFiles??seal.state.dirty;for(const f of dirty)check(f,wt);
  const indexHash=hash(command(['ls-files','--stage','-z'],wt));if(indexHash!==(seal.indexBinding?.digest.replace('sha256:','')??seal.state.index.sha256))throw Error('INDEX:'+id);
  const status=command(['status','--porcelain=v1','--untracked-files=all','-z'],wt);
  const livePaths=status.toString().split('\0').filter(Boolean).map(entry=>entry.slice(3)).sort();
  if(JSON.stringify(livePaths)!==JSON.stringify(dirty.map(f=>f.path).sort()))throw Error('DIRTY_MEMBERSHIP:'+id);
  if(id==='wxg'){
   if(hash(JSON.stringify(dirty))!==seal.dirtyTreeDigest.slice(7)||hash(status)!==seal.statusDigest.slice(7))throw Error('DIRTY_DIGEST:'+id);
   for(const [args,digest] of [[['diff','--cached','--binary',seal.baseline],seal.stagedDiffDigest],[['diff','--binary'],seal.unstagedDiffDigest],[['diff','--binary',seal.baseline],seal.fullTrackedDiffDigest]])if(hash(command(args,wt))!==digest.slice(7))throw Error('DIFF:'+id);
  }else{
   const state=seal.state;
   if(hash(JSON.stringify({dirty:state.dirty,index:state.index,stageSha256:state.stage.sha256,unstagedSha256:state.unstaged.sha256}))!==state.dirtyTreeDigest.slice(7))throw Error('DIRTY_DIGEST:'+id);
   for(const [args,descriptor] of [[['diff','--cached','--binary','--no-ext-diff','--no-textconv',state.base],state.stage],[['diff','--binary','--no-ext-diff','--no-textconv'],state.unstaged]]){const bytes=command(args,wt);if(bytes.length!==descriptor.bytes||hash(bytes)!==descriptor.sha256)throw Error('DIFF:'+id);}
  }
  let verified=dirty.length;
  for(const f of [...(receipt.files??[]),...(receipt.testedInputs??[]),...(receipt.compiledInputs??[]),...(receipt.compiledFiles instanceof Array?receipt.compiledFiles:[]),...(seal.closure??[])]){check(f,src);verified++;}
  const binding=JSON.parse(readFileSync(resolve(src,id==='wxg'?'ConsumerBindings.json':'InputBindings.json')));for(const f of binding.files){check(f,src);verified++;}
  if(id==='atm'){const dep=JSON.parse(readFileSync(resolve(src,'DependencyBindings.json')));for(const f of [...dep.installed,...dep.archives]){check(f,src);verified++;}const tools=JSON.parse(readFileSync(resolve(src,'ToolBindings.json')));for(const f of tools.files){check(f,src);verified++;}}
  check(id==='wxg'?{path:'.runtime/final-seal/review.patch',bytes:seal.reviewPatchBytes,digest:seal.reviewPatchDigest}:seal.reviewPatch,src);
  const files=id==='wxg'?['receipt.json','.runtime/final-seal/scope-seal.json','ConsumerBindings.json','SourceBindings.json','package.json','package-lock.json',...['src','dist','fixtures','tests','vendor','node_modules'].flatMap(d=>walk(resolve(src,d)).map(f=>relative(src,f)))]:['receipt.json','.runtime/final-seal/scope-seal.json','InputBindings.json','DependencyBindings.json','ToolBindings.json','package.json','package-lock.json','src/optics.ts',...walk(resolve(src,'shaders')).map(f=>relative(src,f))];
  for(const file of files){const from=resolve(src,file),dest=resolve(root,'inputs',id,file),b=readFileSync(from);mkdirSync(dirname(dest),{recursive:true});try{const old=readFileSync(dest);if(!old.equals(b))throw Error('IMMUTABLE_EXISTS:'+dest);}catch(e){if(e.code!=='ENOENT')throw e;copyFileSync(from,dest);}members.push({...member(dest),producer:id,sourcePath:from});}
  producers.push({id,root:src,receiptSha256:receiptHash,sealSha256:sealHash,verifiedDescriptors:verified,indexSha256:indexHash,dirtyTreeDigest:seal.dirtyTreeDigest??seal.state.dirtyTreeDigest,liveDirtyMembership:'PASS',diffs:'PASS',acceptance:'FINITE_SYNTHETIC_INPUT_ONLY',productIntegration:'NO'});
 }
 save('InputBindings.json',{schema:'wxg08.inputs/v1',producers,members,copyPolicy:'EXACT_BYTES_NO_MOVING_IMPORTS',environment:'LOCAL_WINDOWS_ISOLATED'});
 console.log(JSON.stringify({status:'PASS',producers,members:members.length}));
}
if(process.argv[2]==='verify'){for(const f of json('InputBindings.json').members)check(f);console.log(JSON.stringify({status:'PASS',members:json('InputBindings.json').members.length}));}
