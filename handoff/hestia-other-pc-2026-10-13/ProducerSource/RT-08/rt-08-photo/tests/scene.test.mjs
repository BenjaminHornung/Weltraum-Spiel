import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {SceneSnapshot} from '../dist/snapshot.mjs';
import {verifyInputs} from '../verify-inputs.mjs';
const base='inputs/gfx03/spikes/gfx-03-backend-bakeoff/imported/rt01/fixtures/';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function port(){const fixture=JSON.parse(await readFile(base+'meshes/F00-CONTROL/manifest.json'));const cameras=JSON.parse(await readFile(base+'cameras/presets.json'));const buffers=new Map();for(const r of fixture.payloads){const b=await readFile(base+'meshes/F00-CONTROL/'+r.path),a=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);buffers.set(r.id,r.elementType==='float32'?new Float32Array(a):new Uint32Array(a));}
 const {lightDepthPolicy}=await import('../inputs/gfx03/spikes/gfx-03-backend-bakeoff/src/port.ts');return {fixture,buffers,camera:cameras.rdCameras.find(c=>c.id==='near'),policy:structuredClone(lightDepthPolicy)};}
test('actual CPU scene: immutable snapshot; all base PBR projections and cleanup; foliage explicitly omitted',async()=>{
 await verifyInputs();const p=await port(),before=hash(JSON.stringify(p.fixture)),s=await SceneSnapshot.create(p);
 const a=s.build();assert.equal(a.scene.children.length,2);assert.ok(a.skipped.includes('leaf'));
 const meshes=[];a.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});assert.equal(meshes.length,5);assert.ok(meshes.every(m=>m.material.isMeshStandardMaterial));
 const emitted=meshes.find(m=>m.name.endsWith('/emission'));assert.ok(emitted.material.emissive.r>0);
 p.buffers.values().next().value.fill(99);p.fixture.materials[0].colorLinearRgb[0]=0.1;
 const b=s.build();assert.equal(hash(JSON.stringify((await port()).fixture)),before);assert.deepEqual(b.digests,a.digests);
 const original=b.scene.children[1].children[0].geometry.attributes.position.array.slice();a.scene.children[1].children[0].geometry.attributes.position.array.fill(88);
 assert.deepEqual(b.scene.children[1].children[0].geometry.attributes.position.array,original);
 let disposed=0;meshes.forEach(m=>{m.geometry.addEventListener('dispose',()=>disposed++);m.material.addEventListener('dispose',()=>disposed++);});a.dispose();a.dispose();assert.equal(disposed,10);b.dispose();
});
test('actual snapshot digests: source/material/light/camera/geometry/frame changes each invalidate key',async()=>{
 const initial=await SceneSnapshot.create(await port());
 for(const dimension of ['source','geometry','material','light','camera','frame']){const p=await port();
  if(dimension==='source')p.fixture.sourceBinding.sourceRevision++;
  if(dimension==='material')p.fixture.materials[0].colorLinearRgb[0]+=0.01;
  if(dimension==='light')p.policy.sunIntensity+=0.01;
  if(dimension==='camera')p.camera.positionMeters[0]+=0.01;
  if(dimension==='frame')p.fixture.sourceBinding.originEpoch++;
  if(dimension==='geometry'){const r=p.fixture.payloads.find(r=>r.id===p.fixture.objects[0].meshes[0].positions),a=p.buffers.get(r.id);a[0]+=0.01;r.sha256=hash(new Uint8Array(a.buffer));}
  const next=await SceneSnapshot.create(p);assert.notEqual(next.digests[dimension],initial.digests[dimension],dimension);assert.notEqual(next.digests.snapshot,initial.digests.snapshot);
 }
});
test('actual CPU BVH triangle intersection agrees with independent Three raycast; no GPU oracle claim',async()=>{
 const scene=(await SceneSnapshot.create(await port())).build(),meshes=[];scene.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});let hits=0;
 for(const mesh of meshes){const bvh=new MeshBVH(mesh.geometry),raycast=new T.Raycaster();
  const box=mesh.geometry.boundingBox,center=box.getCenter(new T.Vector3()),origin=center.clone().add(new T.Vector3(0,0,-20));const ray=new T.Ray(origin,new T.Vector3(0,0,1));
  const actual=bvh.raycastFirst(ray,T.DoubleSide);raycast.ray.copy(ray);const expected=raycast.intersectObject(mesh,false)[0];assert.equal(Boolean(actual),Boolean(expected));if(actual){hits++;assert.ok(Math.abs(actual.distance-expected.distance)<1e-5);}}
 assert.ok(hits>0);scene.dispose();
});
test('snapshot rejects tampered/missing payloads, camera, material and bad indices/frames',async()=>{
 let p=await port();p.buffers.values().next().value[0]+=1;await assert.rejects(SceneSnapshot.create(p),/drift/);
 p=await port();p.buffers.clear();await assert.rejects(SceneSnapshot.create(p),/Missing/);
 p=await port();p.camera.verticalFovDegrees=NaN;await assert.rejects(SceneSnapshot.create(p),/camera/);
 p=await port();p.fixture.materials[0].colorLinearRgb[0]=-1;await assert.rejects(SceneSnapshot.create(p),/material/);
 p=await port();p.fixture.objects[0].meshes[0].materialId='missing';let s=await SceneSnapshot.create(p);assert.throws(()=>s.build(),/material/);
 p=await port();p.fixture.objects[0].frame.rotationXyzw=[0,0,0,2];s=await SceneSnapshot.create(p);assert.throws(()=>s.build(),/frame/);
 p=await port();const ref=p.fixture.payloads.find(r=>r.id===p.fixture.objects[0].meshes[0].indices),a=p.buffers.get(ref.id);a[0]=999999;ref.sha256=hash(new Uint8Array(a.buffer));s=await SceneSnapshot.create(p);assert.throws(()=>s.build(),/projection/);
});
test('installed upstream WebGPU API imports on CPU; source confirms stableNoise reset and geometry rebuild',async()=>{
 const {WebGPUPathTracer}=await import('three-gpu-pathtracer/webgpu');for(const method of ['setScene','updateCamera','updateMaterials','updateLights','setSize','reset','dispose','getSampleCountsAsync','renderSample'])assert.equal(typeof WebGPUPathTracer.prototype[method],'function');
 const source=await readFile('node_modules/three-gpu-pathtracer/src/webgpu/WebGPUPathTracer.js','utf8');assert.match(source,/if \( this\.stableNoise \)\s*\{\s*this\._pathTracer\.resetSeed\(\)/);assert.match(source,/new MeshBVH\( child\.geometry/);
});
