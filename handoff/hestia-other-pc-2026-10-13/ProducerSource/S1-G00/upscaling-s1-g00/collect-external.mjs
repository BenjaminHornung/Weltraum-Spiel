import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const spike=path.dirname(fileURLToPath(import.meta.url));
const carrier=path.resolve(spike,'../..');
const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const runId=process.argv[2];assert.match(runId??'',/^[a-zA-Z0-9-]+$/);
assert.equal(path.basename(carrier),'Hestia-Upscaling-S1-G00-2026-10-09');
const out=path.join(spike,'evidence',runId,'external');
const inspectExisting=process.argv[3]==='--inspect-existing';
if(inspectExisting)assert(existsSync(out));else{assert(!existsSync(out),'Choose a new run ID; preserve earlier external evidence');mkdirSync(out,{recursive:true});}
const digest=(b,a='sha256',e='hex')=>createHash(a).update(b).digest(e);
const save=(p,b)=>{const full=path.resolve(out,p);assert(full.startsWith(out+path.sep));mkdirSync(path.dirname(full),{recursive:true});writeFileSync(full,b);};
const requests=[],packages=[];
const request=async(url,file)=>{
  const at=new Date().toISOString();
  try{const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Hestia-S1-G00-read-only-inventory'}});
    const b=Buffer.from(await r.arrayBuffer());save(file,b);requests.push({url,file,at,endedAt:new Date().toISOString(),httpStatus:r.status,bytes:b.length,sha256:digest(b),etag:r.headers.get('etag'),date:r.headers.get('date')});
    assert(r.ok,`HTTP ${r.status}`);return b;
  }catch(e){requests.push({url,file,at,status:'LIVE_PROOF_BLOCKED',error:e.message});return null;}
};
// Read tar members in memory; never run or install downloaded package code.
const tarMembers=b=>{
  const tar=gunzipSync(b,{maxOutputLength:64*1024*1024}), result=[];let offset=0,longName;
  while(offset+512<=tar.length){const h=tar.subarray(offset,offset+512);if(h.every(n=>n===0))break;
    const field=(a,n)=>h.subarray(a,a+n).toString().split('\0')[0];
    const size=parseInt(field(124,12).trim()||'0',8);assert(Number.isSafeInteger(size)&&size>=0);
    const data=tar.subarray(offset+512,offset+512+size);assert.equal(data.length,size);
    const type=field(156,1),name=longName??[field(345,155),field(0,100)].filter(Boolean).join('/');
    longName=type==='L'?data.toString().replace(/\0.*$/s,''):undefined;
    if(type==='0'||type===''){assert(!name.startsWith('/')&&!name.split('/').includes('..'));result.push({name,data});}
    offset+=512+Math.ceil(size/512)*512;
  }return result;
};
// Small parser self-check with an ordinary regular tar member.
const testHeader=Buffer.alloc(512);testHeader.write('package/test.txt');testHeader.write('00000000003\0',124);testHeader.write('0',156);
const {gzipSync}=await import('node:zlib');const self=tarMembers(gzipSync(Buffer.concat([testHeader,Buffer.from('abc'),Buffer.alloc(509),Buffer.alloc(1024)])));
assert.equal(self[0].name,'package/test.txt');assert.equal(self[0].data.toString(),'abc');
const rejectedHeader=Buffer.from(testHeader);rejectedHeader.fill(0,0,100);rejectedHeader.write('../escape');assert.throws(()=>tarMembers(gzipSync(Buffer.concat([rejectedHeader,Buffer.from('abc'),Buffer.alloc(509)]))));
if(inspectExisting){
  const manifest=JSON.parse(readFileSync(path.join(out,'external-manifest.json'))),selected=[];
  assert(!existsSync(path.join(out,'package-contract-source-manifest.json')),'Inspection already exists');
  for(const id of ['three','types-three']){
    const b=readFileSync(path.join(out,`packages/${id}/package.tgz`));
    assert.equal(digest(b),manifest.packages.find(p=>p.id===id).tarballSha256);
    for(const m of tarMembers(b)){
      if(/(?:WebGPUBackend|WebGPURenderer|WebGPUTextureUtils|RenderPipeline|\/Backend\.|\/DataMap\.|VelocityNode|Object3D|TSLBase)/.test(m.name)&&/\.(js|ts)$/.test(m.name)){
        const file=`package-contract-source/${id}/${m.name}`;save(file,m.data);selected.push({file,bytes:m.data.length,sha256:digest(m.data)});
      }
    }
  }
  save('package-contract-source-manifest.json',JSON.stringify({at:new Date().toISOString(),status:'SOURCE_INSPECTED_NOT_DEVICE_CONTRACT_TESTED',files:selected},null,2)+'\n');
  console.log(JSON.stringify({status:'SOURCE_EXTRACTED_FROM_VERIFIED_TARBALLS',files:selected.length}));process.exit(0);
}
for(const [id,name,version] of [['three','three','0.186.1'],['types-three','@types/three','0.186.0'],['rapier','@dimforge/rapier3d-compat','0.21.0'],['upscaler','@pmndrs/upscaler','0.5.0']]){
  const url=`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
  const metaBytes=await request(url,`packages/${id}/registry.json`);if(!metaBytes)continue;
  const meta=JSON.parse(metaBytes);assert.equal(meta.name,name);assert.equal(meta.version,version);
  const row={id,name,version,source:url,gitHead:meta.gitHead??null,license:meta.license,repository:meta.repository,engines:meta.engines??null,exports:meta.exports??null,peerDependencies:meta.peerDependencies??null,dependencies:meta.dependencies??null,dist:meta.dist,metadataSha256:digest(metaBytes),packageIntegrityVerified:false};
  const tgz=await request(meta.dist.tarball,`packages/${id}/package.tgz`);
  if(tgz){const integrity=meta.dist.integrity.split(' ').find(s=>s.startsWith('sha512-'));assert(integrity,`${name}: sha512 SRI absent`);
    assert.equal('sha512-'+digest(tgz,'sha512','base64'),integrity);assert.equal(digest(tgz,'sha1'),meta.dist.shasum);
    row.packageIntegrityVerified=true;row.tarballSha256=digest(tgz);row.tarballBytes=tgz.length;
    const members=tarMembers(tgz);row.members=members.map(m=>({name:m.name,bytes:m.data.length,sha256:digest(m.data)}));
    const hits=[];
    for(const m of members){
      if(/\.(js|mjs|ts|md)$/.test(m.name)&&id==='upscaler'){
        m.data.toString().split(/\r?\n/).forEach((line,i)=>{if(/backend\.device|backend\.get|textureGPU|GPUTexture|isWebGPUBackend|resetHistory|invalidate|0\.186|r186|logarithmic|reversed|velocity|reactive|MSAA|TRAA|TAAU/.test(line))hits.push({member:m.name,line:i+1,text:line.length>1200?line.slice(0,1200)+' [truncated line]':line});});
      }
      if(/(?:^|\/)(package\.json|LICENSE[^/]*|README\.md)$/.test(m.name)||(id==='upscaler'&&/\.(ts|md)$/.test(m.name))){save(`packages/${id}/selected/${m.name}`,m.data);}
    }
    if(id==='upscaler')save('upscaler-private-handle-source-hits.json',JSON.stringify(hits,null,2)+'\n');
  }packages.push(row);
}
const api='https://api.github.com/repos/BenjaminHornung/Weltraum-Spiel';
for(const [suffix,file] of [['git/ref/heads/main','main-ref.json'],['pulls?state=open&per_page=100','open-prs.json'],['pulls?state=all&head=BenjaminHornung%3Aperf%2Fhvp-hud-frame-hotpath-2026-10-02&per_page=5','hud-prs.json'],['pulls?state=all&head=BenjaminHornung%3Aperf%2Fhvp-route-bundle-isolation-2026-10-02&per_page=5','route-prs.json']])await request(api+'/'+suffix,file);
for(const number of [70,71,72])await request(api+`/pulls/${number}/files?per_page=100`,`pr-${number}-files.json`);
for(const [url,file] of [
  ['https://api.github.com/repos/pmndrs/upscaler/git/ref/tags/v0.5.0','upscaler-tag.json'],
  ['https://raw.githubusercontent.com/pmndrs/upscaler/v0.5.0/docs/compatibility.md','upscaler-compatibility.md'],
  ['https://raw.githubusercontent.com/pmndrs/upscaler/v0.5.0/docs/inputs-and-contracts.md','upscaler-inputs-and-contracts.md'],
  ['https://raw.githubusercontent.com/pmndrs/upscaler/v0.5.0/README.md','upscaler-readme.md'],
  ['https://raw.githubusercontent.com/wiki/mrdoob/three.js/Migration-Guide.md','three-migration-guide.md']])await request(url,file);
const r=spawnSync(git,['--no-optional-locks','-C',carrier,'ls-remote','--heads','origin'],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024,windowsHide:true});
save('ls-remote.json',JSON.stringify({at:new Date().toISOString(),exitCode:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message??null},null,2)+'\n');
save('external-manifest.json',JSON.stringify({at:new Date().toISOString(),requests,packages,status:packages.length===4&&packages.every(p=>p.packageIntegrityVerified)?'PACKAGE_BYTES_VERIFIED_RUNTIME_NOT_RUN':'PARTIAL_EXTERNAL_PROOF'},null,2)+'\n');
console.log(JSON.stringify({packages:packages.map(p=>({name:p.name,version:p.version,integrityVerified:p.packageIntegrityVerified,sha256:p.tarballSha256})),blocked:requests.filter(r=>r.status==='LIVE_PROOF_BLOCKED'),gitExit:r.status}));
