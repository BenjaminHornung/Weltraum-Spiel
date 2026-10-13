import * as T from 'three';
import {createWetnessSourceCache,createWetnessPreset,DEFAULT_WETNESS_PRESET,WET_LIMITS,ownerPose,fixtureRevision} from './reuse';
import type {LabFixtureV1,Vec3} from '../inputs/rd/src/contracts/fixture';
import type {LabFrameInput} from '../inputs/rd/src/contracts/experiment';

/** Receivers query the actual authored RD source; its coordinate owner is not a GPU resource lease. */
export function createViewerWetness(fixture:LabFixtureV1,meshes:readonly T.Mesh[],rain01:number){
 const preset=createWetnessPreset({...DEFAULT_WETNESS_PRESET,id:'atm-bound-current-rain',rainHistory:[{tick:0,rain01}]});
 let current=fixture,cache=createWetnessSourceCache(fixture),sourceStartTick=0,disposed=false;
 const update=(tick:number,weather:LabFrameInput['weather'],origin:Vec3)=>{
  if(disposed)throw Error('WETNESS_DISPOSED');
  if(current.objects.length!==1)throw Error('WETNESS_SOURCE_OWNER_UNSUPPORTED');
  const owner=ownerPose(current,current.objects[0].ownerId);if(!owner)throw Error('WETNESS_SOURCE_OWNER_MISSING');
  const inverse=new T.Quaternion(...owner.rotationXyzw).invert(),base=new T.Vector3(...owner.originMeters),shift=new T.Vector3(...origin);
  const points:{id:string;ownerId:string;positionLocalMeters:Vec3;normalLocal:Vec3}[]=[],surfaces:{mesh:T.Mesh;start:number;faces:number}[]=[];
  meshes.forEach((mesh,index)=>{
   if(!mesh.visible)return;
   mesh.updateWorldMatrix(true,false);
   const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),wet=mesh.geometry.getAttribute('labWetness'),indices=mesh.geometry.index;
   if(!p||!n||!wet||p.count%4!==0||n.count!==p.count||wet.count!==p.count||!indices||indices.count!==p.count/4*6)throw Error('WETNESS_QUAD_SOURCE_UNSUPPORTED');
   const start=points.length;
   for(let first=0;first<p.count;first+=4){
    const face=first/4;for(let i=0;i<6;i++){const v=indices.getX(face*6+i);if(v<first||v>=first+4)throw Error('WETNESS_QUAD_SOURCE_UNSUPPORTED');}
    const center=new T.Vector3();for(let i=0;i<4;i++)center.add(new T.Vector3().fromBufferAttribute(p,first+i));center.multiplyScalar(0.25).applyMatrix4(mesh.matrixWorld).add(shift).sub(base).applyQuaternion(inverse);
    const normal=new T.Vector3().fromBufferAttribute(n,first).transformDirection(mesh.matrixWorld).applyQuaternion(inverse);
    points.push({id:`atm.receiver.${index}.face.${face}`,ownerId:owner.ownerId,positionLocalMeters:center.toArray() as Vec3,normalLocal:normal.toArray() as Vec3});
   }
   surfaces.push({mesh,start,faces:p.count/4});
  });
  if(points.length>WET_LIMITS.surfaceSamples)throw Error('WETNESS_SAMPLE_BUDGET');
  const result=cache.evaluate({tick,seconds:tick/60,paused:false,cameraId:'near',sourceRevision:fixtureRevision(current),weather},preset,sourceStartTick,points);
  for(const surface of surfaces){const wet=surface.mesh.geometry.getAttribute('labWetness');for(let face=0;face<surface.faces;face++)for(let vertex=0;vertex<4;vertex++)wet.setX(face*4+vertex,result.samples[surface.start+face].wetness01);wet.needsUpdate=true;}
  return result;
 };
 return {update,replace(next:LabFixtureV1,tick:number){if(disposed)throw Error('WETNESS_DISPOSED');if(!Number.isSafeInteger(tick)||tick<0||tick>WET_LIMITS.maxTick)throw Error('WETNESS_SOURCE_TICK');const nextCache=createWetnessSourceCache(next);cache.dispose();cache=nextCache;current=next;sourceStartTick=tick;},
  dispose(){if(disposed)return;disposed=true;cache.dispose();}};
}

