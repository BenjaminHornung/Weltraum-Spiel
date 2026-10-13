import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const spike=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(spike,'../..');
export const evidence=path.join(root,'.devtoolbox/specs/changes/rt-03-06-2026-10-09/tests');
export const sha=b=>createHash('sha256').update(b).digest('hex');
export async function verifyInputs(){
 const m=JSON.parse(await readFile(path.join(spike,'input-manifest.json')));
 for(const r of m.copies){const b=await readFile(path.join(spike,r.destination));assert.equal(b.length,r.byteLength,r.destination);assert.equal(sha(b),r.sha256,r.destination);}
 return m;
}
export async function loadFixtures(){
 const directory=path.join(spike,'inputs/rt02a/fixtures'),bytes=await readFile(path.join(directory,'manifest.json'));
 assert.equal(sha(bytes),'bc6e9be728c932b0fe6f88ea2d6024f61b2b53bc59d47aae0e941c499a34dbea');
 const m=JSON.parse(bytes);assert.deepEqual(m.provenance,{ANALYTICAL:8,RD_SYNTHETIC:1,PRODUCT_EXPORT:0});
 for(const r of m.files){const b=await readFile(path.join(directory,r.path));assert.equal(b.length,r.byteLength);assert.equal(sha(b),r.sha256);}
 const rays=JSON.parse(await readFile(path.join(directory,'rays/golden-1000.json')));
 assert.equal(rays.length,1000);assert.equal(new Set(rays.map(r=>r.ray.id)).size,1000);
 const volumes=new Map();for(const r of rays)if(!volumes.has(r.volumeId))volumes.set(r.volumeId,JSON.parse(await readFile(path.join(directory,'voxels',r.volumeId+'.json'))));
 return {rays,volumes,manifest:m,fixtureSha256:sha(bytes)};
}
export function parity(actual,expected,label='tuple'){
 assert.ok(Math.abs(actual.distance-expected.distance)<=1e-9,label+' distance');
 actual.normal.forEach((n,i)=>assert.ok(Math.abs(n-expected.normal[i])<=1e-9,label+' normal'));
 assert.deepEqual({...actual,distance:0,normal:[]},{...expected,distance:0,normal:[]},label);
}
