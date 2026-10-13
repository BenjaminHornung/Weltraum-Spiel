import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {root,json,save,walk,bytes,hash} from './bindings.mjs';
mkdirSync(root+'/.runtime/tarballs',{recursive:true});
const archives=[],notInstalled=[],lock=json('package-lock.json');
for(const [path,entry] of Object.entries(lock.packages)){
 if(!path)continue;
 if(!existsSync(root+'/'+path)){
  if(!entry.optional)throw Error('REQUIRED_DEPENDENCY_MISSING:'+path);
  notInstalled.push({packagePath:path,version:entry.version,os:entry.os??null,cpu:entry.cpu??null,status:'NOT_INSTALLED_PLATFORM_OPTIONAL',integrity:entry.integrity});continue;
 }
 if(!entry.resolved?.startsWith('https://registry.npmjs.org/')||!entry.integrity?.startsWith('sha512-'))throw Error('NPM_UNBOUND:'+path);
 const file='.runtime/tarballs/'+path.replaceAll('/','_')+'.tgz';let b;
 if(existsSync(root+'/'+file))b=readFileSync(root+'/'+file);
 else{const r=await fetch(entry.resolved);if(!r.ok)throw Error('TARBALL_HTTP');b=Buffer.from(await r.arrayBuffer());}
 if('sha512-'+createHash('sha512').update(b).digest('base64')!==entry.integrity)throw Error('NPM_INTEGRITY:'+path);
 writeFileSync(root+'/'+file,b);
 const tar=gunzipSync(b);let members=0,archiveRoot=null;
 for(let offset=0;offset+512<=tar.length;){
  const header=tar.subarray(offset,offset+512);if(header.every(v=>v===0))break;
  const name=header.subarray(0,100).toString().replace(/\0.*$/s,''),size=parseInt(header.subarray(124,136).toString().replace(/\0.*$/s,'').trim()||'0',8),type=header[156];
  if(!Number.isSafeInteger(size)||size<0)throw Error('TAR_SIZE');
  if(type===0||type===48){
   const parts=name.split('/');
   if(parts.length<2||parts.some(p=>!p||p==='.'||p==='..')||name.includes('\\')||name.includes(':'))throw Error('TAR_PATH:'+name);
   archiveRoot??=parts[0];if(parts[0]!==archiveRoot)throw Error('TAR_MULTI_ROOT:'+name);
   const installed=root+'/'+path+'/'+parts.slice(1).join('/'),payload=tar.subarray(offset+512,offset+512+size);
   if(!existsSync(installed)||hash(readFileSync(installed))!==hash(payload))throw Error('INSTALLED_TARBALL_DRIFT:'+installed);
   members++;
  }
  offset+=512+Math.ceil(size/512)*512;
 }
 archives.push({...bytes(file),packagePath:path,version:entry.version,integrity:entry.integrity,url:entry.resolved,verifiedInstalledMembers:members});
}
for(const tag of ['clouds@0.7.6','atmosphere@0.19.1']){
 const r=await fetch('https://api.github.com/repos/takram-design-engineering/three-geospatial/git/ref/tags/'+encodeURIComponent(tag),{headers:{'User-Agent':'hestia-atm-finite-spike'}});
 const raw=await r.text();save('inputs/registry/tag-'+tag.replace('@','-')+'.json',{url:r.url,httpStatus:r.status,raw:JSON.parse(raw)});
 if(!r.ok)throw Error('GIT_TAG_UNAVAILABLE:'+tag);
 const ref=JSON.parse(raw);
 if(ref.object.type==='tag'){
  const peeled=await fetch(ref.object.url,{headers:{'User-Agent':'hestia-atm-finite-spike'}});
  if(!peeled.ok)throw Error('GIT_TAG_PEEL');
  const tagObject=await peeled.json();if(tagObject.object.type!=='commit'||!/^[a-f0-9]{40}$/.test(tagObject.object.sha))throw Error('GIT_COMMIT_PIN');
  save('inputs/registry/commit-'+tag.replace('@','-')+'.json',{tag,annotatedTag:ref.object.sha,sourceCommit:tagObject.object.sha,tagObject});
 }
}
const files=walk(root,'node_modules').map(bytes),wasm=files.filter(f=>f.path.endsWith('.wasm')),licenses=files.filter(f=>/\/(license|licence|copying|notice)(\.|$)/i.test(f.path));
save('DependencyBindings.json',{packageLock:bytes('package-lock.json'),installed:files,archives,notInstalled,licenses,wasm,pins:{three:'0.186.1',typesThree:'0.186.0',rapier:'0.21.0',typescript:'5.9.3',takramClouds:'0.7.6',takramAtmosphere:'0.19.1',postprocessing:'6.39.5'},react:'NOT_INSTALLED_OPTIONAL_PEER',runtimeWasm:'NONE_EXECUTED',nodeVersion:process.versions.node});
console.log(JSON.stringify({status:'PASS',archives:archives.length,installedFiles:files.length,licenseFiles:licenses.length,wasm:wasm.length}));
