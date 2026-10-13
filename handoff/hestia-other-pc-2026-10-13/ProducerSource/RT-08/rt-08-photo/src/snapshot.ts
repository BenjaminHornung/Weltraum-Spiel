import * as T from 'three';
import {digest,lightDepthPolicy,type Fixture,type CameraData} from '../inputs/gfx03/spikes/gfx-03-backend-bakeoff/src/port.js';
import {surfaceMaterial} from '../inputs/gfx03/spikes/gfx-03-backend-bakeoff/src/materials.js';
type BufferData=Float32Array|Uint32Array;
type Port={fixture:Fixture;camera:CameraData;buffers:Map<string,BufferData>;policy:typeof lightDepthPolicy};
const hash=(value:unknown)=>digest(new TextEncoder().encode(JSON.stringify(value)));
const finite=(a:number[])=>a.every(Number.isFinite);
export class SceneSnapshot {
  #data:Port;
  readonly digests:Readonly<Record<string,string>>;
  readonly unsupported:readonly string[];
  private constructor(data:Port,digests:Record<string,string>){
    this.#data=data;this.digests=Object.freeze(digests);
    this.unsupported=Object.freeze(['water: UNSUPPORTED (omitted)','foliage: UNSUPPORTED (omitted)',
      'GFX03 procedural strata/AO/wetness/wind/sky/ambient: UNSUPPORTED; base PBR properties and direct sun only']);
    Object.freeze(this);
  }
  static async create(port:Port){
    const data={fixture:structuredClone(port.fixture),camera:structuredClone(port.camera),buffers:new Map<string,BufferData>(),policy:structuredClone(port.policy)};
    if(!data.fixture.sourceBinding.sourceDigest||!data.fixture.sourceBinding.materialDigest)throw Error('Missing source binding');
    const c=data.camera;if(!finite([...c.positionMeters,...c.targetMeters,...c.up,c.verticalFovDegrees])||c.verticalFovDegrees<=0||c.verticalFovDegrees>=180||Math.hypot(...c.up)<1e-9||c.positionMeters.every((v,i)=>v===c.targetMeters[i]))throw Error('Invalid camera');
    for(const m of data.fixture.materials)if(!finite(m.colorLinearRgb)||m.colorLinearRgb.some(v=>v<0||v>1))throw Error('Invalid material');
    const payloads=[];
    for(const ref of data.fixture.payloads){
      const input=port.buffers.get(ref.id);if(!input)throw Error('Missing mesh payload');
      const copy=input.slice();const bytes=new Uint8Array(copy.buffer,copy.byteOffset,copy.byteLength);
      if(copy.length!==ref.length||copy.byteLength!==ref.byteLength||await digest(bytes)!==ref.sha256||!Array.from(copy).every(Number.isFinite))throw Error('Mesh payload drift');
      data.buffers.set(ref.id,copy);payloads.push({id:ref.id,byteLength:bytes.length,sha256:ref.sha256});
    }
    const digests={source:await hash(data.fixture.sourceBinding),geometry:await hash({objects:data.fixture.objects,payloads}),
      material:await hash(data.fixture.materials),light:await hash(data.policy),camera:await hash(c),
      frame:await hash({frame:data.fixture.sourceBinding.frame,originEpoch:data.fixture.sourceBinding.originEpoch,transformGeneration:data.fixture.sourceBinding.transformGeneration,objects:data.fixture.objects.map(o=>(o as any).frame)})};
    return new SceneSnapshot(data,{...digests,snapshot:await hash(digests)});
  }
  build(width=960,height=540){
    if(![width,height].every(v=>Number.isInteger(v)&&v>=1&&v<=8192))throw Error('Invalid scene size');
    const {fixture,camera:settings,buffers,policy}=this.#data,scene=new T.Scene();
    scene.background=new T.Color(0.5294118,0.7098039,0.8509804);
    const camera=new T.PerspectiveCamera(settings.verticalFovDegrees,width/height,0.05,1000);
    camera.position.set(...settings.positionMeters);camera.up.set(...settings.up);camera.lookAt(...settings.targetMeters);camera.updateMatrixWorld();
    const sun=new T.DirectionalLight(0xffffff,policy.sunIntensity);sun.position.set(...policy.sun);scene.add(sun);
    const skipped:string[]=[],geometries:T.BufferGeometry[]=[],materials:T.Material[]=[];
    try{
      for(const object of fixture.objects){
        const frame=(object as any).frame;
        if(!frame||!finite([...frame.originMeters,...frame.rotationXyzw])||Math.abs(Math.hypot(...frame.rotationXyzw)-1)>1e-6)throw Error('Invalid owner frame');
        const group=new T.Group();group.name=object.ownerId;group.position.set(...frame.originMeters as [number,number,number]);group.quaternion.set(...frame.rotationXyzw as [number,number,number,number]);scene.add(group);
        for(const mesh of object.meshes){
          const profile=fixture.materials.find(m=>m.id===mesh.materialId);if(!profile)throw Error('Unknown material');
          if(/water|foliage|leaf/i.test(profile.role)){skipped.push(profile.id);continue;}
          const p=buffers.get(mesh.positions),n=buffers.get(mesh.normals),idx=buffers.get(mesh.indices);
          if(!(p instanceof Float32Array)||!(n instanceof Float32Array)||!(idx instanceof Uint32Array)||p.length%3||n.length!==p.length||idx.length%3||Array.from(idx).some(i=>i>=p.length/3))throw Error('Invalid mesh projection');
          const geometry=new T.BufferGeometry();geometries.push(geometry);
          geometry.setAttribute('position',new T.BufferAttribute(p.slice(),3));geometry.setAttribute('normal',new T.BufferAttribute(n.slice(),3));geometry.setIndex(new T.BufferAttribute(idx.slice(),1));geometry.computeBoundingBox();
          // Pathtracer consumes base PBR properties; GFX03 shader hooks are explicitly unsupported.
          const material=surfaceMaterial(T,false,profile) as T.MeshStandardMaterial;materials.push(material);material.vertexColors=false;
          const rendered=new T.Mesh(geometry,material);rendered.name=`${object.ownerId}/${profile.id}`;group.add(rendered);
        }
      }
      scene.updateMatrixWorld(true);
      let disposed=false;
      return {scene,camera,skipped:Object.freeze(skipped),digests:this.digests,unsupported:this.unsupported,
        dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.clear();}};
    }catch(error){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.clear();throw error;}
  }
}
