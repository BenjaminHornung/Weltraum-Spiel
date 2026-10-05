import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join,dirname,relative,resolve,isAbsolute } from 'node:path';
import { createServer } from 'node:net';
export const ROOT='C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees/Hestia-RD-RD13';
export const LAB=ROOT+'/experiments/hestia-rd-2026-10-02';
export const RUN='C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase2-16a5d29a-20261004-a';
export const HEAD_RUN='C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD';
export const START='16a5d29a5cddea372abae139da618aa000a058be';
export const TREE='abb0bdde3039c33d1a815d2f2754103fcb16c100';
export const NODE='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
export const GIT='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
export const CHROME='C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe';
export const URL_ROOT='http://127.0.0.1:5280';
export const BUILD=HEAD_RUN+'/rd13-wiring-c5307386-20261004-b/build';
export const PHASE='reports/RD-13/phase2-16a5d29a';
export const sha=(b)=>createHash('sha256').update(b).digest('hex');
export function safe(full,owner='C:/IFI_SourceCode') {
  const p=resolve(full);const rel=relative(resolve(owner),p);assert(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..\\')&&!rel.startsWith('../'),full);
  for(let q=p;dirname(q)!==q;q=dirname(q)){if(existsSync(q)){assert(!lstatSync(q).isSymbolicLink(),q);}}
  return p;
}
export function bytes(full,owner) {safe(full,owner);const s=lstatSync(full);assert(s.isFile()&&s.nlink===1,full);return readFileSync(full);}
export function bound(full,owner) {const b=bytes(full,owner);return {path:full,bytes:b.length,sha256:sha(b)};}
export function json(full,expected) {const b=bytes(full);if(expected){assert.equal(sha(b),expected,full);}return JSON.parse(b.toString());}
export function fresh(full,value) {safe(full,RUN);assert(!existsSync(full),'Write-once '+full);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});return bound(full,RUN);}
export function files(root) {safe(root);const out=[];for(const e of readdirSync(root,{withFileTypes:true})){const p=join(root,e.name);assert(!e.isSymbolicLink(),p);if(e.isDirectory()){out.push(...files(p).map((r)=>({...r,path:e.name+'/'+r.path})));}else{const r=bound(p,root);out.push({...r,path:e.name});}}return out.sort((a,b)=>a.path.localeCompare(b.path));}
export function git(...args) {return execFileSync(GIT,args,{cwd:ROOT,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024}).trim();}
export function environment() {for(const p of ['temp','cache','cache/local','cache/roaming']){mkdirSync(RUN+'/'+p,{recursive:true});}return {...process.env,
  PATH:RUN+'/bin;'+dirname(NODE)+';'+dirname(GIT)+';C:/IFI_SourceCode/Utils/PowerShell',COMSPEC:RUN+'/bin/cmd.exe',TEMP:RUN+'/temp',TMP:RUN+'/temp',TMPDIR:RUN+'/temp',
  LOCALAPPDATA:RUN+'/cache/local',APPDATA:RUN+'/cache/roaming',npm_config_cache:RUN+'/cache',npm_config_update_notifier:'false',NO_COLOR:'1'};}
export async function freePort(label) {const t=Date.now();const s=createServer();try{await new Promise((ok,no)=>{s.once('error',no);s.listen({host:'127.0.0.1',port:5280,exclusive:true},ok);});await new Promise((ok,no)=>s.close((e)=>e?no(e):ok()));return fresh(RUN+'/'+label+'.json',{status:'FREE_EXCLUSIVE_BIND_RELEASED',host:'127.0.0.1',port:5280,checked:new Date(t).toISOString(),productIntegrated:false});}
  catch(e){fresh(RUN+'/'+label+'-blocked.json',{status:'BLOCKED_NO_FOREIGN_CLEANUP',error:String(e),host:'127.0.0.1',port:5280,productIntegrated:false});throw e;}}
export function immutable(postcommit=false) {
  assert.equal(process.version,'v22.23.2');const head=git('rev-parse','HEAD');assert.equal(git('rev-parse',START+'^{tree}'),TREE);
  if(!postcommit){assert.equal(head,START);assert.equal(git('rev-parse','HEAD^{tree}'),TREE);}else{assert.equal(git('rev-list','--parents','-n','1','HEAD'),head+' '+START);}
  assert.equal(git('branch','--show-current'),'feature/hestia-rd-rd13-2026-10-04');
  const freezePath=HEAD_RUN+'/freezes/'+START+'.json';const leasePath=HEAD_RUN+'/leases/RD13-native-16a5d29a-20261004-a.json';
  const freeze=json(freezePath,'55abac71cdde12a6e52471f1a182d8d63adaed08bd8c87e827634b46250e6eb7');
  const lease=json(leasePath,'cf5c7bc69ea208ab0678e9286062d54a10b8b2eca7046aba31509eca0953a4da');
  const proof=json(lease.buildProof,'46f5441ffd0075cc5c61977169ddf86330dead39f650d7bd50828d7d19a26bcc');
  const repairProof=bound(HEAD_RUN+'/rd13-repair-head-c5307386.json');assert.equal(repairProof.sha256,'200cd6f35018585134610510ef7c97dea75423a9b631ee286c4109f84fa44259');
  assert.equal(lease.status,'RD13_NATIVE_AUTHORIZED');assert.equal(lease.id,'rd13-native-16a5d29a-20261004-a');assert.equal(lease.runId,'phase2-16a5d29a-20261004-a');
  assert.equal(lease.functionalNativeDiagnosticOnly,true);assert.equal(lease.qualifiedGpuPerformance,'NOT_GRANTED');assert.equal(lease.productIntegrated,false);
  for(const [key,value] of Object.entries({start:START,tree:TREE,outputRoot:RUN,executablePath:CHROME,baseURL:URL_ROOT})){assert.equal(lease[key],value,key);}
  assert.equal(resolve(lease.buildRoot),resolve(BUILD));assert.equal(freeze.start,START);assert.equal(freeze.tree,TREE);assert.equal(proof.start,START);
  assert.equal(freeze.sourceFiles.length,1011);assert.equal(freeze.frozenFiles.length,18);assert.equal(proof.sourceFiles.length,1011);assert.equal(proof.buildAssets.length,517);
  const source=freeze.sourceFiles.map((r)=>{const p=join(LAB,r.path);const b=bytes(p,LAB);assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha256,r.path);return r;});
  for(const r of freeze.frozenFiles){assert.equal(bound(join(LAB,r.path)).sha256,r.sha256,r.path);}
  const build=files(BUILD);assert.deepEqual(build,proof.buildAssets.slice().sort((a,b)=>a.path.localeCompare(b.path)));
  const publicFiles=files(LAB+'/fixtures');assert.equal(publicFiles.length,429);for(const r of publicFiles){const b=bound(join(BUILD,r.path));assert.equal(b.sha256,r.sha256,r.path);}
  // Batch actual Git blobs. Expanded LFS working bytes are proven by pointer OID/size, never compared as pointer bytes.
  const listing=execFileSync(GIT,['ls-tree','-r','-z',START,'--','experiments/hestia-rd-2026-10-02'],{cwd:ROOT,maxBuffer:32*1024*1024}).toString().split('\0').filter(Boolean);
  const objects=listing.map((line)=>{const [meta,path]=line.split('\t');return {path:path.slice('experiments/hestia-rd-2026-10-02/'.length),oid:meta.split(' ')[2]};});assert.equal(objects.length,1011);
  const blobs=execFileSync(GIT,['cat-file','--batch'],{cwd:ROOT,input:objects.map((r)=>r.oid).join('\n')+'\n',maxBuffer:512*1024*1024,timeout:120000});let at=0;const lfs=[];const textFilters=[];
  for(const r of objects){const end=blobs.indexOf(10,at);const header=blobs.subarray(at,end).toString().split(' ');assert.equal(header[0],r.oid);assert.equal(header[1],'blob');const n=Number(header[2]);const blob=blobs.subarray(end+1,end+1+n);at=end+n+2;
    const pin=source.find((s)=>s.path===r.path);assert(pin,r.path);const text=blob.length<256?blob.toString():'';const pointer=/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([0-9a-f]{64})\nsize (\d+)\n?$/.exec(text);
    if(pointer){assert.equal(pointer[1],pin.sha256,r.path);assert.equal(Number(pointer[2]),pin.bytes,r.path);lfs.push({path:r.path,oid:pointer[1],bytes:pin.bytes,pointerSha256:sha(blob),gitBlob:r.oid});}
    else if(sha(blob)!==pin.sha256){const p='experiments/hestia-rd-2026-10-02/'+r.path;const filtered=git('hash-object','--path='+p,p);assert.equal(filtered,r.oid,r.path+' Git-native text filter');textFilters.push({path:r.path,rawSha256:pin.sha256,rawBytes:pin.bytes,gitBlob:r.oid,blobSha256:sha(blob),blobBytes:blob.length,filteredOid:filtered});}
    else{assert.equal(blob.length,pin.bytes,r.path);}}
  assert.equal(at,blobs.length);const browser=bound(CHROME);assert.equal(browser.sha256,lease.executableSha256);assert.equal(browser.sha256,'409805a16d6416087e6b2f778df1cf8f7bbb267d6b99f6b5bb0a618eace234f2');
  const packages=['three','@types/three','typescript','@typescript/typescript-win32-x64','vite','vitest','@playwright/test','playwright','playwright-core'].map((name)=>({name,version:json(LAB+'/node_modules/'+name+'/package.json').version,...bound(LAB+'/node_modules/'+name+'/package.json')}));
  const api=['three/src/renderers/WebGLRenderer.js','three/src/renderers/webgl/WebGLProgram.js','three/src/renderers/webgl/WebGLTextures.js','three/src/renderers/shaders/ShaderChunk/common.glsl.js','three/src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js','playwright-core/lib/coreBundle.js','@playwright/test/cli.js'].map((p)=>bound(LAB+'/node_modules/'+p));
  const ray=bytes(LAB+'/src/experiments/voxel-rays/ray.ts').toString();const kernel=/export const PRODUCTION_KERNEL = \/\* glsl \*\/`([\s\S]*?)`;/m.exec(ray)?.[1];assert(kernel&&!kernel.includes('${'),'Literal unchanged production kernel required');
  return {schema:'rd13-phase2-immutable-v1',start:START,tree:TREE,head,freeze:bound(freezePath),lease:bound(leasePath),buildProof:bound(lease.buildProof),repairProof,
    sourceFiles:source,sharedPins:freeze.frozenFiles,publicFiles,buildRoot:BUILD,buildFiles:build,sourceLfs:lfs,sourceTextFilters:textFilters,packages,api,executables:[bound(NODE),bound(GIT),browser],
    kernel,kernelSha256:sha(Buffer.from(kernel)),productIntegrated:false,qualifiedGpuPerformance:'NOT_GRANTED'};
}
export async function served(label) {const proof=json(HEAD_RUN+'/rd13-wired-head-16a5d29a.json','46f5441ffd0075cc5c61977169ddf86330dead39f650d7bd50828d7d19a26bcc');const responses=[];
  for(const r of proof.buildAssets){const url=URL_ROOT+'/'+r.path.split('/').map(encodeURIComponent).join('/');const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});const b=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,r.path);assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha256,r.path);responses.push({path:r.path,status:response.status,bytes:b.length,sha256:sha(b),contentType:response.headers.get('content-type')});}
  return fresh(RUN+'/'+label+'.json',{start:START,tree:TREE,buildRoot:BUILD,baseURL:URL_ROOT,responses,offsiteRequests:0,productIntegrated:false});
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname.slice(1))) {
  const mode=process.argv[2];if(mode==='preflight'){Object.assign(process.env,environment());const proof=immutable();const port=await freePort('port-preflight');fresh(RUN+'/preflight.json',{...proof,port});
    fresh(RUN+'/admission.json',{schema:'rd13-native-admission-v1',leaseId:'rd13-native-16a5d29a-20261004-a',runId:'phase2-16a5d29a-20261004-a',start:START,tree:TREE,baseURL:URL_ROOT,buildRoot:BUILD,outputRoot:RUN,
      freeze:proof.freeze,lease:proof.lease,buildProof:proof.buildProof,executable:proof.executables[2],kernelSha256:proof.kernelSha256,preflight:bound(RUN+'/preflight.json'),productIntegrated:false});
    console.log('RD13_PREFLIGHT_PASS source=1011 build=517 public=429 port=FREE');}
  else if(mode==='served'){await served('served-before-native');console.log('RD13_SERVED_PASS 517 exact response bodies');}
  else if(mode==='free-after'){await freePort('port-after-cleanup');console.log('RD13_PORT_FREE_AFTER_CLEANUP');}else{throw new Error('Unknown bounded support operation');}
}
