import { BufferGeometry, Float32BufferAttribute, Box3 } from 'three';
import { MeshBVH, CENTER } from 'three-mesh-bvh';
import type { Binding, Ray, RayResult, Vec3, Volume } from '../imports/rt/src/types.mts';
import { assertCurrent, validateVolume, validateRay } from '../imports/rt/src/validate.mts';

export const tolerance=(a:number,b:number)=>1e-10*Math.max(1,Number.isFinite(a)?Math.abs(a):0,Number.isFinite(b)?Math.abs(b):0);
const near=(n:number,edge:number,width:number)=>Math.abs(n-edge)<=Math.min(Number.EPSILON*8*Math.max(1,Math.abs(n),Math.abs(edge)),width*1e-6);
export function owns(o:number,d:number,lo:number,hi:number){
  if(d===0)return o<hi&&!near(o,hi,hi-lo)&&(o>lo||near(o,lo,hi-lo));
  if(near(o,lo,hi-lo))return d>0;if(near(o,hi,hi-lo))return d<0;return o>lo&&o<hi;
}
export function localRay(v:Volume,ray:Ray):{origin:Vec3;direction:Vec3}{
  const inverse=(p:Vec3)=>[0,1,2].map(a=>v.rotation[a]*p[0]+v.rotation[3+a]*p[1]+v.rotation[6+a]*p[2]) as Vec3;
  const origin=inverse(ray.origin.map((n,a)=>n-v.translation[a]) as Vec3),direction=inverse(ray.direction);
  if(![...origin,...direction].every(Number.isFinite))throw new RangeError('Nonfinite ray transform');
  return {origin,direction};
}
export function interval(o:Vec3,d:Vec3,lo:Vec3,hi:Vec3,limit:number){
  const enter:Vec3=[-Infinity,-Infinity,-Infinity],exit:Vec3=[Infinity,Infinity,Infinity];
  const inside=lo.every((n,a)=>owns(o[a],d[a],n,hi[a]));
  for(let a=0;a<3;a++){
    if(d[a]===0){if(!owns(o[a],d[a],lo[a],hi[a]))return null;continue;}
    const p=(lo[a]-o[a])/d[a],q=(hi[a]-o[a])/d[a];enter[a]=Math.min(p,q);exit[a]=Math.max(p,q);
  }
  const raw=Math.max(...enter),entry=inside?0:Math.max(0,raw),end=Math.min(limit,...exit);
  if(entry>=limit||end-entry<=tolerance(entry,end))return null;
  const normal:Vec3=[0,0,0];if(!inside){const a=enter.findIndex(n=>Math.abs(n-raw)<=tolerance(n,raw));normal[a]=d[a]>0?-1:1;}
  return {entry,end,normal};
}
const cellAt=(v:Volume,i:number):Vec3=>[i%v.size[0],Math.floor(i/v.size[0])%v.size[1],Math.floor(i/(v.size[0]*v.size[1]))];
const freeze=(v:any):any=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const hex=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),n=>n.toString(16).padStart(2,'0')).join('');
export async function checkedVolume(input:Volume,current:Binding):Promise<Volume>{
  const v=structuredClone(input);validateVolume(v);assertCurrent(v.binding,current);
  const payload={size:v.size,cellMeters:v.cellMeters,origin:v.origin,cells:v.cells,cellIds:v.cellIds,
    authorityLeafEdge:v.authorityLeafEdge,rayPageEdge:v.rayPageEdge,coverage:v.coverage,exteriorCoverage:v.exteriorCoverage};
  if(await hex(payload)!==v.binding.sourceDigest||await hex(v.materials)!==v.binding.materialDigest)throw new Error('Source/material payload digest mismatch');
  if(new Set(v.cellIds).size!==v.cellIds.length||v.cellIds.some(id=>!id))throw new Error('Invalid cell membership');
  return freeze(v);
}
export function geometryFor(v:Volume){
  // A non-rendered triangle per cell supplies exact integer AABB bounds and stable membership.
  const data=new Float32Array(v.cells.length*9);
  for(let i=0;i<v.cells.length;i++){const [x,y,z]=cellAt(v,i);data.set([x,y,z,x+1,y+1,z+1,x,y+1,z],i*9);}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(data,3));
  geometry.setAttribute('cellIndex',new Float32BufferAttribute(Float32Array.from({length:v.cells.length*3},(_,i)=>Math.floor(i/3)),1));
  return geometry;
}
type Generation={volume:Volume;geometry:BufferGeometry;bvh:MeshBVH;id:number};
export class BvhRayBackend {
  #generation:Generation|null=null;#disposed=false;#transaction=0;#deviceEpoch:number;
  readonly authority='PRESENTATION_ONLY';
  readonly costs:{buildMs:number[];transformMs:number[];queryMs:number[];disposeMs:number[];refitMs:null;uploadMs:null;readbackMs:null;gpuMs:null}={buildMs:[],transformMs:[],queryMs:[],disposeMs:[],refitMs:null,uploadMs:null,readbackMs:null,gpuMs:null};
  constructor(deviceEpoch=0){if(!Number.isSafeInteger(deviceEpoch)||deviceEpoch<0)throw new Error('Invalid device epoch');this.#deviceEpoch=deviceEpoch;}
  #check(deviceEpoch:number){if(this.#disposed)throw new Error('Backend disposed');if(deviceEpoch!==this.#deviceEpoch)throw new Error('Stale device epoch');}
  async prepare(v:Volume,current:Binding,deviceEpoch=this.#deviceEpoch,signal?:AbortSignal){
    this.#check(deviceEpoch);if(this.#generation)throw new Error('Already prepared');return this.#replace(v,current,deviceEpoch,signal);
  }
  async #replace(input:Volume,current:Binding,deviceEpoch:number,signal?:AbortSignal){
    const transaction=++this.#transaction;signal?.throwIfAborted();const v=await checkedVolume(input,current);signal?.throwIfAborted();
    this.#check(deviceEpoch);if(transaction!==this.#transaction)throw new Error('Superseded build');
    const start=performance.now(),geometry=geometryFor(v);let next:Generation;
    try{const bvh=new MeshBVH(geometry,{indirect:true,strategy:CENTER,targetLeafSize:8});
      next={volume:v,geometry,bvh,id:(this.#generation?.id??0)+1};signal?.throwIfAborted();this.#check(deviceEpoch);
      if(transaction!==this.#transaction)throw new Error('Superseded build');
    }catch(error){geometry.dispose();throw error;}
    const old=this.#generation;this.#generation=next;old?.geometry.dispose();this.costs.buildMs.push(performance.now()-start);
    return this.resources();
  }
  async update(input:Volume,current:Binding,deviceEpoch=this.#deviceEpoch,signal?:AbortSignal){
    this.#check(deviceEpoch);if(!this.#generation)throw new Error('Not prepared');
    const previous=this.#generation,transaction=this.#transaction,start=performance.now(),v=await checkedVolume(input,current);signal?.throwIfAborted();
    this.#check(deviceEpoch);if(previous!==this.#generation||transaction!==this.#transaction)throw new Error('Superseded update');
    if(v.binding.sourceDigest!==previous.volume.binding.sourceDigest||v.binding.materialDigest!==previous.volume.binding.materialDigest){
      if(v.binding.sourceGeneration<=previous.volume.binding.sourceGeneration)throw new Error('Topology generation must advance');
      return this.#replace(v,current,deviceEpoch,signal);
    }
    const changed=JSON.stringify([v.rotation,v.translation,v.binding.frame,v.binding.originEpoch])!==JSON.stringify([previous.volume.rotation,previous.volume.translation,previous.volume.binding.frame,previous.volume.binding.originEpoch]);
    if(changed&&v.binding.transformGeneration<=previous.volume.binding.transformGeneration&&v.binding.originEpoch<=previous.volume.binding.originEpoch)throw new Error('Transform generation must advance');
    if(v.binding.sourceGeneration!==previous.volume.binding.sourceGeneration||v.binding.sourceRevision!==previous.volume.binding.sourceRevision||v.binding.owner!==previous.volume.binding.owner) return this.#replace(v,current,deviceEpoch,signal);
    this.#generation={...previous,volume:v};++this.#transaction;this.costs.transformMs.push(performance.now()-start);return this.resources();
  }
  query(ray:Ray,current:Binding,mode:'ClosestHit'|'AnyHit'='ClosestHit',deviceEpoch=this.#deviceEpoch):RayResult{
    this.#check(deviceEpoch);if(!this.#generation)throw new Error('Not prepared');if(!['ClosestHit','AnyHit'].includes(mode))throw new Error('Invalid query mode');
    validateRay(ray);const {volume:v,bvh}=this.#generation;assertCurrent(v.binding,current);const start=performance.now();
    const {origin:o,direction:d}=localRay(v,ray),max=v.origin.map((n,a)=>n+v.size[a]*v.cellMeters) as Vec3;
    const revisions={owner:v.binding.owner,sourceRevision:v.binding.sourceRevision,sourceGeneration:v.binding.sourceGeneration,transformGeneration:v.binding.transformGeneration,originEpoch:v.binding.originEpoch};
    const miss:RayResult={kind:'Miss',distance:ray.maxDistance,normal:[0,0,0],cell:null,materialId:null,materialSource:null,cellId:null,owner:null,sourceRevision:null,sourceGeneration:null,transformGeneration:null,originEpoch:null};
    const finish=(r:RayResult)=>{this.costs.queryMs.push(performance.now()-start);return r;};
    const outside=!v.origin.every((n,a)=>owns(o[a],d[a],n,max[a]));
    if(outside&&v.exteriorCoverage==='Unknown')return finish({...miss,...revisions,kind:'Unknown',distance:0});
    const q=o.map((n,a)=>(n-v.origin[a])/v.cellMeters) as Vec3;
    const candidates=new Set<number>();
    bvh.shapecast({intersectsBounds:(box:Box3)=>{
      let entry=0,exit=ray.maxDistance/v.cellMeters;
      for(let a=0;a<3;a++){const lo=box.min.getComponent(a)-1e-6,hi=box.max.getComponent(a)+1e-6;
        if(d[a]===0){if(q[a]<lo||q[a]>hi)return false;}
        else{const p=(lo-q[a])/d[a],r=(hi-q[a])/d[a];entry=Math.max(entry,Math.min(p,r));exit=Math.min(exit,Math.max(p,r));}}
      return exit>=entry;
    },intersectsRange:(offset,count)=>{for(let i=offset;i<offset+count;i++)candidates.add(bvh.resolveTriangleIndex(i));return false;}});
    const intervals=[...candidates].flatMap(i=>{const cell=cellAt(v,i),lo=cell.map((n,a)=>v.origin[a]+n*v.cellMeters) as Vec3;
      const hit=interval(o,d,lo,lo.map(n=>n+v.cellMeters) as Vec3,ray.maxDistance);return hit?[{...hit,cell,i}]:[];});
    intervals.sort((a,b)=>a.entry-b.entry||a.cell[0]-b.cell[0]||a.cell[1]-b.cell[1]||a.cell[2]-b.cell[2]);
    for(let visited=0;visited<intervals.length;visited++){
      const h=intervals[visited],slot=v.cells[h.i],kind=visited>=ray.maxSteps?'BudgetExceeded':slot===-1?'Unknown':slot>0?'Hit':null;
      if(!kind)continue;
      const normal=[0,1,2].map(a=>v.rotation[a*3]*h.normal[0]+v.rotation[a*3+1]*h.normal[1]+v.rotation[a*3+2]*h.normal[2]) as Vec3;
      return finish({kind,distance:h.entry,normal,cell:h.cell,materialId:kind==='Hit'?slot:null,materialSource:kind==='Hit'?v.materials.find(m=>m.id===slot)!.source:null,cellId:v.cellIds[h.i],...revisions});
    }
    if(v.exteriorCoverage==='Unknown'&&!outside){let exit=Infinity;for(let a=0;a<3;a++)if(d[a]!==0)exit=Math.min(exit,((d[a]>0?max[a]:v.origin[a])-o[a])/d[a]);
      if(exit<ray.maxDistance-tolerance(exit,ray.maxDistance))return finish({...miss,...revisions,kind:'Unknown',distance:exit});}
    return finish(miss);
  }
  resources(){const g=this.#generation,serialized=g?MeshBVH.serialize(g.bvh,{cloneBuffers:false}):null;return {geometryGeneration:g?.id??null,retainedGeometries:g?1:0,retainedCpuBytes:g?g.geometry.getAttribute('position').array.byteLength+g.geometry.getAttribute('cellIndex').array.byteLength+(g.geometry.index?.array.byteLength??0)+(serialized?.indirectBuffer?.byteLength??0)+serialized!.roots.reduce((n,r)=>n+r.byteLength,0):0,retainedCpuByteScope:'TYPED_GEOMETRY_INDEX_BVH_BUFFERS_ONLY; JS_HEAP_NOT_MEASURED',retainedSnapshotCells:g?.volume.cells.length??0,retainedGpuBytes:null,deviceEpoch:this.#deviceEpoch};}
  snapshot():Volume{this.#check(this.#deviceEpoch);if(!this.#generation)throw new Error('Not prepared');return this.#generation.volume;}
  dispose(){if(this.#disposed)return false;const start=performance.now();++this.#transaction;this.#generation?.geometry.dispose();this.#generation=null;this.#disposed=true;this.costs.disposeMs.push(performance.now()-start);return true;}
}
