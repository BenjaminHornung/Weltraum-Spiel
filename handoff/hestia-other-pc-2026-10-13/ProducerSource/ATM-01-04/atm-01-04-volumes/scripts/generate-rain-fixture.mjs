import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import * as T from 'three';
import {root,json,hash,save} from './bindings.mjs';
const source=json('fixtures/occluders.json'),base=json('inputs/rd/fixtures/F00-CONTROL/manifest.json'),q=0.5;
const out=root+'/fixtures/authored-rain';mkdirSync(out+'/payloads',{recursive:true});
function generate(open=false){
 const boxes=source.solids.filter(b=>!open||!source.openRemoval.includes(b.id));
 const dimensions=source.bounds.max.map((v,i)=>Math.round((v-source.bounds.min[i])/q)),[nx,ny,nz]=dimensions;
 const occupancy=new Uint8Array(nx*ny*nz),coverage=new Uint8Array(occupancy.length).fill(1);
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const p=[x,y,z].map((v,i)=>source.bounds.min[i]+(v+0.5)*q);
  occupancy[(z*ny+y)*nx+x]=boxes.some(b=>p.every((v,i)=>v>=b.min[i]&&v<b.max[i]))?1:0;
 }
 const positions=[],normals=[],indices=[];
 for(const box of boxes){
  const size=box.max.map((v,i)=>v-box.min[i]),g=new T.BoxGeometry(...size),offset=positions.length/3,p=g.getAttribute('position'),n=g.getAttribute('normal');
  for(let i=0;i<p.count;i++){positions.push(p.getX(i)+(box.min[0]+box.max[0])/2,p.getY(i)+(box.min[1]+box.max[1])/2,p.getZ(i)+(box.min[2]+box.max[2])/2);normals.push(n.getX(i),n.getY(i),n.getZ(i));}
  indices.push(...g.index.array.map(i=>i+offset));g.dispose();
 }
 const buffers={'positions':new Float32Array(positions),'normals':new Float32Array(normals),'indices':new Uint32Array(indices),'occupancy':occupancy,'coverage':coverage},payloads=[];
 const suffix=open?'open':'closed';
 for(const [id,data] of Object.entries(buffers)){
  const b=Buffer.from(data.buffer),path='payloads/'+suffix+'-'+id+'.bin';writeFileSync(out+'/'+path,b);
  payloads.push({id:suffix+'-'+id,path,byteLength:b.length,length:data.length,byteOrder:'little',elementType:data instanceof Float32Array?'float32':data instanceof Uint32Array?'uint32':'uint8',sha256:hash(b)});
 }
 const geometryBounds={min:[0,1,2].map(axis=>Math.min(...positions.filter((_,i)=>i%3===axis))),max:[0,1,2].map(axis=>Math.max(...positions.filter((_,i)=>i%3===axis)))};
 const fixture={...base,id:'ATM-OPTICAL-'+suffix.toUpperCase(),sourceRevision:open?2:1,quantumMeters:q,
  sourceRefs:[{...base.sourceRefs[0],generatorVersion:'atm-optical-solids-v1',generatorPath:'scripts/generate-rain-fixture.mjs',generatorCodeSha256:hash(readFileSync(import.meta.filename)),sourceDigest:hash(JSON.stringify({source,open})),seed:20261009}],
  materials:base.materials.filter(m=>m.id==='wood'),cameras:base.cameras,
  objects:[{...base.objects[0],bounds:geometryBounds,materialRoles:['wood'],sourceIds:['atm-optical-solids'],meshes:[{positions:suffix+'-positions',normals:suffix+'-normals',indices:suffix+'-indices',materialId:'wood'}]}],
  payloads,voxelRegions:[{id:'atm-optical-solids',ownerId:'control',originMeters:source.bounds.min,dimensions,occupancyPayload:suffix+'-occupancy',knownCoveragePayload:suffix+'-coverage'}]};
 save('fixtures/authored-rain/'+suffix+'.json',fixture);
}
generate(false);generate(true);console.log(JSON.stringify({status:'GENERATED_AUTHORED_SYNTHETIC',authority:'NONE'}));
