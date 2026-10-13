import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {windInputs,assertOwner} from '../build-input/src/port.ts';
import {admitAdapter} from '../build-input/src/capability.mjs';
import {surfaceMaterial,sky} from '../build-input/src/b2-materials.ts';
import * as T from 'three';

test('actual pins and separate Three/TSL exports are compatible',async()=>{
  const expected=[['three','0.186.1'],['three-historical','0.185.1'],['@types/three','0.186.0']];
  for(const [name,version] of expected)assert.equal(JSON.parse(await readFile(new URL(`../../../node_modules/${name}/package.json`,import.meta.url))).version,version);
  const data={id:'wet',role:'limestone-wet',colorLinearRgb:[0.27,0.29,0.27]};
  const gl=surfaceMaterial(T,false,data,true),gpu=surfaceMaterial(T,true,data,true);
  assert.equal(gl.depthWrite,false);assert.equal(gpu.depthWrite,false);assert.equal(gpu.isNodeMaterial,true);
  assert.ok(gpu.normalNode&&gpu.outputNode&&gpu.colorNode);assert.equal(gpu.vertexColors,false);
  for(const node of [false,true]){const emission=surfaceMaterial(T,node,{...data,role:'emission'});assert.deepEqual(emission.emissive.toArray(),data.colorLinearRgb);emission.dispose();}
  for(const m of [gl,gpu])m.dispose();
  const skyData=sky(T,true);assert.ok(skyData.mesh.material.colorNode);skyData.mesh.geometry.dispose();skyData.mesh.material.dispose();skyData.map.dispose();
});
test('adapter admission rejects absence, unsupported feature and undersized limits',()=>{
  const a={features:new Set(['timestamp-query']),limits:{maxTextureDimension2D:4096}};
  assert.equal(admitAdapter(null).status,'UNSUPPORTED');
  assert.equal(admitAdapter(a,['missing']).status,'UNSUPPORTED');
  assert.equal(admitAdapter(a,[],{maxTextureDimension2D:8192}).status,'UNSUPPORTED');
  assert.equal(admitAdapter(a,[],{unknown:32}).status,'UNSUPPORTED');
  assert.equal(admitAdapter(a,[],{maxTextureDimension2D:384}).status,'PASS');
});
test('stable wind uses owner-local frame and rejects stale owner projections',()=>{
  const a=windInputs('leaf',120,0.35,[4,0,2],[0,0,0,1]);assert.deepEqual(a,windInputs('leaf',120,0.35,[4,0,2],[0,0,0,1]));
  assert.ok(Math.abs(a.x)<=0.16&&Math.abs(a.z)<=0.16);
  assert.notDeepEqual(a,windInputs('leaf',120,0.35,[4,0,2],[0,Math.SQRT1_2,0,Math.SQRT1_2]));
  const reduced=windInputs('leaf',120,0.35,[4,0,2],[0,0,0,1],true);assert.equal(reduced.x,0);assert.equal(reduced.z,0);
  assert.throws(()=>windInputs('leaf',120,0.35,[4,0,2],[0,0,0,2]),/Invalid/);
  assert.throws(()=>assertOwner({owner:'fragment',generation:1},{owner:'terrain',generation:0}),/Stale/);
});
