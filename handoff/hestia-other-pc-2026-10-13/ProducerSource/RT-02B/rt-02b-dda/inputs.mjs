import assert from 'node:assert/strict';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRay,validateVolume,assertCurrent} from './imported/rt01/src/validate.mts';
import {bindSource} from './imported/rt01/fixtures.mjs';

export const spike=path.dirname(fileURLToPath(import.meta.url));
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const fixturePin='bc6e9be728c932b0fe6f88ea2d6024f61b2b53bc59d47aae0e941c499a34dbea';
export const importPin='89f8e7ac20015996b49fc7e008dde23979ea3bdad9699e084416dcbdd7b960fb';
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
async function files(dir,prefix){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){assert.ok(!e.isSymbolicLink(),'No linked input');const p=prefix+'/'+e.name;if(e.isDirectory())out.push(...await files(path.join(dir,e.name),p));else out.push(p);}return out;}
export async function verifyImports(root=spike){
 const bytes=await readFile(path.join(root,'import-manifest.json'));assert.equal(sha(bytes),importPin,'Trusted local import manifest');
 const m=JSON.parse(bytes);
 assert.equal(m.schema,'hestia.rt02b.import.v1');assert.equal(m.fixtureManifestSha256,fixturePin);
 assert.equal(new Set(m.files.map(f=>f.path)).size,m.files.length,'Unique imported membership');
 assert.deepEqual((await files(path.join(root,'imported'),'imported')).sort(),m.files.map(f=>f.path).sort(),'Exact closed import membership');
 for(const f of m.files){assert.ok(f.path.startsWith('imported/')&&!f.path.split('/').includes('..'),'Safe import path');
  const p=path.join(root,f.path),s=await lstat(p);assert.ok(s.isFile()&&!s.isSymbolicLink());const b=await readFile(p);
  assert.equal(b.length,f.byteLength,'Imported byte length');assert.equal(sha(b),f.sha256,'Imported byte digest '+f.path);}
 return m;
}
export async function loadInputs(root=spike){
 await verifyImports(root);
 const fixtureRoot=path.join(root,'imported/fixtures'),mb=await readFile(path.join(fixtureRoot,'manifest.json'));
 assert.equal(sha(mb),fixturePin);const m=JSON.parse(mb);assert.equal(m.files.length,49);
 const load=async name=>{const ref=m.files.find(f=>f.path===name);assert.ok(ref,'Bound fixture membership');const b=await readFile(path.join(fixtureRoot,name));assert.equal(b.length,ref.byteLength);assert.equal(sha(b),ref.sha256);return b;};
 const rays=JSON.parse(await load('rays/golden-1000.json'));assert.equal(rays.length,1000);
 assert.equal(new Set(rays.map(r=>r.ray.id)).size,1000,'Unique ray identity');
 const volumes=new Map();
 for(const id of new Set(rays.map(r=>r.volumeId))){
  const v=JSON.parse(await load('voxels/'+id+'.json'));validateVolume(v);
  const recomputed=bindSource(structuredClone(v));assert.equal(recomputed.binding.sourceDigest,v.binding.sourceDigest);assert.equal(recomputed.binding.materialDigest,v.binding.materialDigest);
  const b=await load('voxels/'+id+'.bin');assert.equal(b.length,v.cells.length);
  assert.deepEqual([...b],v.cells.map(n=>n===-1?255:n),'x-fastest uint8 Unknown byte order');
  volumes.set(id,freeze(v));
 }
 for(const r of rays){validateRay(r.ray);assertCurrent(volumes.get(r.volumeId).binding,r.sourceBinding);}
 assert.equal([...volumes.values()].filter(v=>v.provenance==='ANALYTICAL').length,8);
 assert.equal([...volumes.values()].filter(v=>v.provenance==='RD_SYNTHETIC').length,1);
 assert.equal([...volumes.values()].filter(v=>v.provenance==='PRODUCT_EXPORT').length,0);
 return {rays:freeze(rays),volumes,manifest:m};
}
export function compare(actual,expected,label='ray',epsilon=1e-9){
 const {distance:a,normal:an,...ar}=actual,{distance:b,normal:bn,...br}=expected;
 assert.deepEqual(ar,br,label);assert.ok(Math.abs(a-b)<=epsilon,label+' distance '+a+' != '+b);
 an.forEach((n,i)=>assert.ok(Math.abs(n-bn[i])<=epsilon,label+' normal'));
}
