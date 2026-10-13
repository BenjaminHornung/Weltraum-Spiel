import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {importFixture,copyFixturePayload,ownerPose} from '../.r14-runtime-r02/reuse.mjs';
import {createViewerWetness} from '../.r14-runtime-r02/wetness.mjs';
const json=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
async function imported(path){const manifest=json(path+'/manifest.json');return importFixture(readFileSync(new URL('../'+path+'/manifest.json',import.meta.url)),new Map(manifest.payloads.map(p=>[p.id,new Uint8Array(readFileSync(new URL('../'+path+'/'+p.path,import.meta.url)))])));}
async function rain(name){const dir='fixtures/authored-rain/',manifest=json(dir+name+'.json');return importFixture(readFileSync(new URL('../'+dir+name+'.json',import.meta.url)),new Map(manifest.payloads.map(p=>[p.id,new Uint8Array(readFileSync(new URL('../'+dir+p.path,import.meta.url)))])));}
test('actual full viewer fixture receiver caller: source import, 2076 faces, open roof and rebase',async()=>{
 const fixture=await imported('inputs/rd/fixtures/F00-CONTROL'),closed=await rain('closed'),open=await rain('open'),scene=new T.Scene(),meshes=[];
 for(const object of fixture.objects)for(const source of object.meshes){
  const geometry=new T.BufferGeometry(),positions=copyFixturePayload(fixture,source.positions),normals=copyFixturePayload(fixture,source.normals),indices=copyFixturePayload(fixture,source.indices);
  geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(positions),3));geometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(normals),3));geometry.setIndex(new T.BufferAttribute(new Uint32Array(indices),1));
  geometry.setAttribute('labWetness',new T.BufferAttribute(new Float32Array(positions.length/3),1));
  const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial()),pose=ownerPose(fixture,object.ownerId);mesh.position.set(...pose.originMeters);mesh.quaternion.set(...pose.rotationXyzw);scene.add(mesh);meshes.push(mesh);
 }
 for(const box of json('fixtures/occluders.json').solids){const size=box.max.map((v,i)=>v-box.min[i]),geometry=new T.BoxGeometry(...size);geometry.setAttribute('labWetness',new T.BufferAttribute(new Float32Array(geometry.getAttribute('position').count),1));const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial());mesh.name=box.id;mesh.position.set(...box.min.map((v,i)=>(v+box.max[i])/2));scene.add(mesh);meshes.push(mesh);}
 const wet=createViewerWetness(closed,meshes,0.8),weather={windMps:[8,0,-4],rain01:0.8,cloud01:0.7,snow01:0};
 try{
  const before=wet.update(300,weather,[0,0,0]);assert.equal(before.samples.length,2076);assert.equal(before.sourceRevision,1);assert.ok(before.samples.some(s=>s.exposure==='shielded'));for(const s of before.samples.filter(s=>s.exposure==='unknown'))assert.equal(s.wetness01,0);
  wet.replace(open,300);scene.getObjectByName('roof').visible=false;scene.getObjectByName('cave.roof').visible=false;
  const after=wet.update(360,weather,[0,0,0]);assert.equal(after.samples.length,2064);assert.equal(after.sourceRevision,2);assert.ok(after.samples.some(s=>s.exposure==='exposed'&&s.wetness01>0));for(const s of after.samples.filter(s=>s.exposure==='unknown'))assert.equal(s.wetness01,0);
  scene.position.x=-1024;const rebased=wet.update(360,weather,[1024,0,0]);assert.deepEqual(rebased.samples,after.samples);
 }finally{wet.dispose();for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}scene.clear();}
});
