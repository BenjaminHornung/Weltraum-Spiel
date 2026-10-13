import { MeshBVH, CENTER } from 'three-mesh-bvh';
import { Mesh } from 'three';
import { BVHComputeData,wgslTagFn,bvhNodeBoundsStruct } from 'three-mesh-bvh/webgpu';
import { StorageBufferAttribute,StructTypeNode } from 'three/webgpu';
import { storage,instanceIndex } from 'three/tsl';
import type { Binding,Ray,RayResult,Vec3,Volume } from '../imports/rt/src/types.mts';
import { assertCurrent,validateRay } from '../imports/rt/src/validate.mts';
import { checkedVolume,geometryFor,localRay } from './backend.js';

export interface ComputeHost {
  deviceEpoch:number;
  actualAdapter:Record<string,unknown>|null;
  computeAsync(node:any):Promise<void>;
  getArrayBufferAsync(attribute:StorageBufferAttribute):Promise<ArrayBuffer>;
}
/** One borrowed existing host; no renderer, device, render loop or authority is created here. */
export class ComputeBvhBackend {
  #v:Volume|null=null;#geometry:ReturnType<typeof geometryFor>|null=null;#data:any=null;#disposed=false;#busy=false;#epoch:number;#serial=0;
  readonly costs:{packMs:number[];uploadAndQueryMs:number[];readbackMs:number[];gpuMs:null;uploadMs:null;retainedBytes:number}={packMs:[],uploadAndQueryMs:[],readbackMs:[],gpuMs:null,uploadMs:null,retainedBytes:0};
  constructor(readonly host:ComputeHost){if(!Number.isSafeInteger(host.deviceEpoch)||host.deviceEpoch<0)throw new Error('Invalid device epoch');this.#epoch=host.deviceEpoch;}
  #check(){if(this.#disposed)throw new Error('Compute disposed');if(this.host.deviceEpoch!==this.#epoch)throw new Error('Stale device epoch');}
  async prepare(input:Volume,current:Binding,signal?:AbortSignal){
    this.#check();if(this.#busy)throw new Error('Compute busy');const serial=++this.#serial;signal?.throwIfAborted();const v=await checkedVolume(input,current);signal?.throwIfAborted();this.#check();
    if(this.#busy)throw new Error('Compute busy');if(serial!==this.#serial)throw new Error('Superseded compute build');const start=performance.now(),geometry=geometryFor(v);
    let data:any;try{const bvh=new MeshBVH(geometry,{indirect:true,strategy:CENTER,targetLeafSize:8});
      (geometry as typeof geometry & {boundsTree:MeshBVH}).boundsTree=bvh;
      data=new BVHComputeData(new Mesh(geometry,[]),{attributes:{position:'vec4f',cellIndex:'float'},autogenerateBvh:false});data.update();signal?.throwIfAborted();this.#check();if(this.#busy)throw new Error('Compute busy');if(serial!==this.#serial)throw new Error('Superseded compute build');
    }catch(e){data?.dispose();geometry.dispose();throw e;}
    this.#data?.dispose();this.#geometry?.dispose();this.#v=v;this.#data=data;this.#geometry=geometry;
    this.costs.packMs.push(performance.now()-start);this.costs.retainedBytes=Object.values(data.storage).reduce((n:number,s:any)=>n+(s.value?.array?.byteLength??0),0);return this.costs.retainedBytes;
  }
  async update(input:Volume,current:Binding,signal?:AbortSignal){
    this.#check();if(!this.#v)throw new Error('Not prepared');if(this.#busy)throw new Error('Compute busy');const old=this.#v,serial=this.#serial,v=await checkedVolume(input,current);signal?.throwIfAborted();this.#check();if(this.#busy)throw new Error('Compute busy');if(serial!==this.#serial||old!==this.#v)throw new Error('Superseded compute update');
    if(v.binding.sourceDigest!==old.binding.sourceDigest||v.binding.materialDigest!==old.binding.materialDigest){if(v.binding.sourceGeneration<=old.binding.sourceGeneration)throw new Error('Topology generation must advance');return this.prepare(v,current,signal);}
    const changed=JSON.stringify([v.rotation,v.translation,v.binding.frame,v.binding.originEpoch])!==JSON.stringify([old.rotation,old.translation,old.binding.frame,old.binding.originEpoch]);
    if(changed&&v.binding.transformGeneration<=old.binding.transformGeneration&&v.binding.originEpoch<=old.binding.originEpoch)throw new Error('Transform generation must advance');
    this.#v=v;++this.#serial;return this.costs.retainedBytes;
  }
  createBatch(rays:readonly Ray[],current:Binding,mode:'ClosestHit'|'AnyHit'='ClosestHit'){
    this.#check();if(this.#busy)throw new Error('Compute busy');if(!this.#v)throw new Error('Not prepared');if(!['ClosestHit','AnyHit'].includes(mode))throw new Error('Invalid query mode');
    if(!rays.length||rays.length>1000)throw new Error('Finite batch must have 1..1000 rays');const v=this.#v;assertCurrent(v.binding,current);
    const inputs=new Float32Array(rays.length*12);rays.forEach((r,i)=>{validateRay(r);if(r.maxSteps>65535)throw new Error('Unsupported compute cell budget');const local=localRay(v,r);const o=local.origin.map((n,a)=>(n-v.origin[a])/v.cellMeters);
      for(let a=0;a<3;a++){
        const rounded=Math.round(o[a]),edge=v.origin[a]+rounded*v.cellMeters;
        const roundoff=Math.min(Number.EPSILON*8*Math.max(1,Math.abs(local.origin[a]),Math.abs(edge)),v.cellMeters*1e-6);
        if(Math.abs(local.origin[a]-edge)<=roundoff)o[a]=rounded;
        else if(Number.isInteger(Math.fround(o[a])))throw new Error('Unsupported FP32 ownership precision');
        if(local.direction[a]!==0&&Math.fround(local.direction[a])===0)throw new Error('Unsupported FP32 direction precision');
      }
      const values=[...o,r.maxDistance/v.cellMeters,...local.direction,r.maxSteps,0,0,0,0];if(values.some(n=>!Number.isFinite(Math.fround(n))))throw new Error('Unsupported FP32 ray');inputs.set(values,i*12);});
    const inputAttribute=new StorageBufferAttribute(inputs,4),outputAttribute=new StorageBufferAttribute(new Float32Array(rays.length*12),4);
    const cellAttribute=new StorageBufferAttribute(Float32Array.from(v.cells),1);
    const input=storage(inputAttribute,'vec4',rays.length*3).toReadOnly(),output=storage(outputAttribute,'vec4',rays.length*3),cells=storage(cellAttribute,'float',v.cells.length).toReadOnly();
    const shape=new StructTypeNode({origin:'vec3f',direction:'vec3f',maxDist:'float',cursor:'float'},'RT02Ray');
    const hit=new StructTypeNode({entry:'float',end:'float',normal:'vec3f',cell:'uint',found:'bool'},'RT02CellHit');
    const cellInterval=wgslTagFn`
      fn rt02_interval(ray:${shape},lo:vec3f,hi:vec3f) -> ${hit} {
        var result:${hit};result.found=false;var nearT=vec3f(-1e30);var farT=vec3f(1e30);var inside=true;
        for(var a=0u;a<3u;a++){
          let o=ray.origin[a];let d=ray.direction[a];
          var owned=o>lo[a] && o<hi[a];
          if(o==lo[a]){owned=d>=0.0;}if(o==hi[a]){owned=d<0.0;}
          inside=inside && owned;
          if(d==0.0){if(!owned){return result;}}
          else{let p=(lo[a]-o)/d;let q=(hi[a]-o)/d;nearT[a]=min(p,q);farT[a]=max(p,q);}
        }
        let raw=max(nearT.x,max(nearT.y,nearT.z));let entry=select(max(0.0,raw),0.0,inside);let end=min(ray.maxDist,min(farT.x,min(farT.y,farT.z)));
        if(entry>=ray.maxDist || end-entry<=1e-10*max(${1/v.cellMeters}.0,abs(end)) || end<=ray.cursor || entry<ray.cursor){return result;}
        result.entry=entry;result.end=end;result.normal=vec3f(0.0);result.found=true;
        if(!inside){for(var a=0u;a<3u;a++){if(abs(nearT[a]-raw)<=1e-10*max(${1/v.cellMeters}.0,abs(raw))){result.normal[a]=select(1.0,-1.0,ray.direction[a]>0.0);break;}}}
        return result;
      }`;
    const bounds=wgslTagFn`fn rt02_bounds(ray:${shape},box:${bvhNodeBoundsStruct},result:ptr<function,${hit}>) -> u32 {
      let lo=vec3f(box.min[0],box.min[1],box.min[2])-vec3f(1e-5);let hi=vec3f(box.max[0],box.max[1],box.max[2])+vec3f(1e-5);
      var near=0.0;var far=ray.maxDist;for(var a=0u;a<3u;a++){let d=ray.direction[a];if(d==0.0){if(ray.origin[a]<lo[a]||ray.origin[a]>hi[a]){return 0u;}}else{let p=(lo[a]-ray.origin[a])/d;let q=(hi[a]-ray.origin[a])/d;near=max(near,min(p,q));far=min(far,max(p,q));}}
      return select(0u,1u,far>=near && far>ray.cursor);
    }`;
    const data=this.#data,index=data.storage.index,attributes=data.storage.attributes;
    const range=wgslTagFn`fn rt02_range(ray:${shape},offset:u32,count:u32,result:ptr<function,${hit}>) -> bool {
      for(var ti=offset;ti<offset+count;ti++){
        let vertex=${index}[ti*3u];let cell=u32(${attributes}[vertex].cellIndex);
        let lo=vec3f(f32(cell % ${v.size[0]}u),f32((cell / ${v.size[0]}u) % ${v.size[1]}u),f32(cell / ${v.size[0]*v.size[1]}u));
        var h=${cellInterval}(ray,lo,lo+vec3f(1.0));h.cell=cell;
        if(h.found && (!result.found || h.entry<result.entry || (h.entry==result.entry && cell<result.cell))){*result=h;}
      }return result.found;
    }`;
    const cast=data.getShapecastFn({name:'rt02_cast',shapeStruct:shape,resultStruct:hit,intersectsBoundsFn:bounds,intersectRangeFn:range});
    const kernel=wgslTagFn`fn rt02_query(i:u32) -> void {
      let o=${input}[i*3u];let d=${input}[i*3u+1u];var ray:${shape};ray.origin=o.xyz;ray.direction=d.xyz;ray.maxDist=o.w;ray.cursor=0.0;
      let size=vec3f(${v.size[0]}.0,${v.size[1]}.0,${v.size[2]}.0);var outside=false;var volumeExit=1e30;
      for(var a=0u;a<3u;a++){if(ray.origin[a]<0.0||ray.origin[a]>size[a]||(ray.origin[a]==0.0&&ray.direction[a]<0.0)||(ray.origin[a]==size[a]&&ray.direction[a]>=0.0)){outside=true;}if(ray.direction[a]!=0.0){volumeExit=min(volumeExit,(select(0.0,size[a],ray.direction[a]>0.0)-ray.origin[a])/ray.direction[a]);}}
      var kind=0.0;var distance=ray.maxDist;var normal=vec3f(0.0);var cell=-1.0;var material=0.0;var visited=0u;
      if(${v.exteriorCoverage==='Unknown'?'true':'false'} && outside){kind=2.0;distance=0.0;}
      else{loop{var h:${hit};h.found=false;let found=${cast}(ray,&h);
        if(!found){if(${v.exteriorCoverage==='Unknown'?'true':'false'} && !outside && volumeExit<ray.maxDist-1e-10*max(${1/v.cellMeters}.0,abs(ray.maxDist))){kind=2.0;distance=volumeExit;}break;}
        let slot=${cells}[h.cell];if(visited>=u32(d.w)){kind=3.0;}else if(slot<0.0){kind=2.0;}else if(slot>0.0){kind=1.0;material=slot;}
        if(kind!=0.0){distance=h.entry;normal=h.normal;cell=f32(h.cell);break;}visited++;ray.cursor=h.end;
      }}
      ${output}[i*3u]=vec4f(distance,normal);${output}[i*3u+1u]=vec4f(kind,cell,material,f32(visited));${output}[i*3u+2u]=vec4f(0.0);
    }`;
    const node=kernel(instanceIndex).compute(rays.length,[32]);let released=false;
    const release=()=>{if(!released){released=true;node.dispose();inputAttribute.dispose();outputAttribute.dispose();cellAttribute.dispose();}};
    return {node,inputAttribute,outputAttribute,cellAttribute,release,volume:v,serial:this.#serial,rays,mode};
  }
  async query(rays:readonly Ray[],current:Binding,mode:'ClosestHit'|'AnyHit'='ClosestHit',signal?:AbortSignal):Promise<RayResult[]>{
    const batch=this.createBatch(rays,current,mode);this.#busy=true;let start=performance.now();
    try{signal?.throwIfAborted();await this.host.computeAsync(batch.node);this.#check();signal?.throwIfAborted();if(batch.serial!==this.#serial)throw new Error('Stale compute result');
      this.costs.uploadAndQueryMs.push(performance.now()-start);start=performance.now();const bytes=await this.host.getArrayBufferAsync(batch.outputAttribute);this.#check();signal?.throwIfAborted();assertCurrent(batch.volume.binding,current);if(batch.serial!==this.#serial)throw new Error('Stale readback');this.costs.readbackMs.push(performance.now()-start);
      if(bytes.byteLength!==rays.length*48)throw new Error('Invalid readback length');const values=new Float32Array(bytes),v=batch.volume;
      return rays.map((r,i)=>{const p=i*12,kind=['Miss','Hit','Unknown','BudgetExceeded'][values[p+4]] as RayResult['kind'];if(!kind||![...values.slice(p,p+8)].every(Number.isFinite))throw new Error('Invalid compute tuple');const ci=values[p+5];
        if(!Number.isInteger(ci)||ci< -1||ci>=v.cells.length)throw new Error('Invalid compute membership');const cell:Vec3|null=ci<0?null:[ci%v.size[0],Math.floor(ci/v.size[0])%v.size[1],Math.floor(ci/(v.size[0]*v.size[1]))];
        const local:Vec3=[values[p+1],values[p+2],values[p+3]],normal=[0,1,2].map(a=>v.rotation[a*3]*local[0]+v.rotation[a*3+1]*local[1]+v.rotation[a*3+2]*local[2]) as Vec3;
        const distance=values[p]*v.cellMeters,norm=Math.hypot(...local),slot=ci<0?null:v.cells[ci],rawMaterial=values[p+6];
        const material=kind==='Hit'?v.materials.find(m=>m.id===rawMaterial):null;
        const epsilon=1e-5*Math.max(1,r.maxDistance);
        if(distance<0||distance>r.maxDistance+epsilon||(kind==='Miss'&&(ci!==-1||rawMaterial!==0||norm!==0||Math.abs(distance-r.maxDistance)>epsilon))
          ||(kind==='Hit'&&(!material||ci<0||slot!==rawMaterial||slot<=0))
          ||(kind==='Unknown'&&(rawMaterial!==0||(ci<0?v.exteriorCoverage!=='Unknown'||norm!==0:slot!==-1)))
          ||(kind==='BudgetExceeded'&&(ci<0||rawMaterial!==0||values[p+7]!==r.maxSteps))
          ||(kind!=='Miss'&&distance>=r.maxDistance)||!Number.isInteger(values[p+7])||values[p+7]<0
          ||(norm!==0&&Math.abs(norm-1)>1e-5))throw new Error('Contradictory compute tuple');
        return {kind,distance:kind==='Miss'?r.maxDistance:values[p]*v.cellMeters,normal,cell,materialId:material?.id??null,materialSource:material?.source??null,owner:kind==='Miss'?null:v.binding.owner,cellId:ci<0?null:v.cellIds[ci],sourceRevision:kind==='Miss'?null:v.binding.sourceRevision,sourceGeneration:kind==='Miss'?null:v.binding.sourceGeneration,transformGeneration:kind==='Miss'?null:v.binding.transformGeneration,originEpoch:kind==='Miss'?null:v.binding.originEpoch};});
    }finally{this.#busy=false;batch.release();}
  }
  dispose(){if(this.#disposed)return false;if(this.#busy)throw new Error('Cannot dispose in-flight compute; await drain');++this.#serial;this.#data?.dispose();this.#geometry?.dispose();this.#data=null;this.#geometry=null;this.#v=null;this.#disposed=true;this.costs.retainedBytes=0;return true;}
}
