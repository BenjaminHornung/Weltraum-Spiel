import { BufferAttribute, Group, Mesh, Quaternion, Vector3 } from 'three';
import { createFrameInput, validateFacts, validateWeather, type LabExperimentContext, type LabPreset, type LabWeatherSample } from '../../contracts/experiment';
import { copyFixturePayload,fixtureRevision, type Vec3 } from '../../contracts/fixture';
import { canonicalJson, finite, freezeJson, id, integer, requireValue, sha256, vector } from '../../contracts/validation';
import { mountThreeEffect as mountControlEffect } from '../three-control';
import { createThreeLabHost, ownerPose, type ThreeLabEffect, type ThreeLabEffectContext } from '../../runner/threeHost';

export const MAX_WIND_ANGLE_RADIANS = 0.16;
export interface WindPose { readonly localWindMps: Vec3; readonly angles: { readonly x: number; readonly z: number }; readonly phase: number; }

/** Stable source identity, controlled tick and owner rotation; no camera/index/wall clock state. */
export function applyWindInputs(clusterId: string, tick: number, stiffness: number, weather: LabWeatherSample,
  ownerRotationXyzw: readonly [number,number,number,number], reducedMotion = false): WindPose {
  id(clusterId); integer(tick); finite(stiffness,0,1); validateWeather(weather); vector(ownerRotationXyzw,4);
  requireValue(Math.abs(Math.hypot(...ownerRotationXyzw)-1)<=1e-6,'Owner rotation must be unit quaternion');
  let hash=2166136261; for(let i=0;i<clusterId.length;i++) hash=Math.imul(hash^clusterId.charCodeAt(i),16777619);
  const phase=(hash>>>0)/0x100000000*Math.PI*2+tick/60*1.8;
  const localWind=new Vector3(...weather.windMps).applyQuaternion(new Quaternion(...ownerRotationXyzw).invert());
  const response=reducedMotion?0:(1-stiffness)*(0.55+0.45*Math.sin(phase))*0.035;
  const clamp=(value:number)=>Math.max(-MAX_WIND_ANGLE_RADIANS,Math.min(MAX_WIND_ANGLE_RADIANS,value));
  return freezeJson({localWindMps:localWind.toArray() as unknown as Vec3,
    angles:response===0?{x:0,z:0}:{x:clamp(localWind.z*response),z:clamp(-localWind.x*response)},phase});
}

/** Preallocated bounded countercandidate. Only decoration vertices may be passed here. */
export function deformDecorVertices(target: Float32Array, source: Float32Array, angles: WindPose['angles'], anchor: Vec3): void {
  requireValue(target.buffer!==source.buffer && target.length===source.length && source.length%3===0
    && source.byteLength<=1024*1024,'Invalid or aliased bounded decor buffers');
  finite(angles.x,-MAX_WIND_ANGLE_RADIANS,MAX_WIND_ANGLE_RADIANS); finite(angles.z,-MAX_WIND_ANGLE_RADIANS,MAX_WIND_ANGLE_RADIANS); vector(anchor);
  requireValue(source.every((value)=>Number.isFinite(value)&&Math.abs(value)<=1000),'Invalid decor vertex');
  for(let index=0;index<source.length;index+=3) {
    const height=source[index+1]-anchor[1];
    target[index]=source[index]+angles.z*height;
    target[index+1]=source[index+1];
    target[index+2]=source[index+2]-angles.x*height;
  }
}

/** Radius-based padding covers both axis rotations and the bounded shear countercandidate. */
export function windBounds(bounds: {readonly min:Vec3;readonly max:Vec3}, maxAngle=MAX_WIND_ANGLE_RADIANS) {
  vector(bounds.min); vector(bounds.max); finite(maxAngle,0,MAX_WIND_ANGLE_RADIANS);
  requireValue(bounds.min.every((v,i)=>v<=bounds.max[i]),'Invalid source bounds');
  const padding=Math.hypot(...bounds.max.map((v,i)=>v-bounds.min[i]))*maxAngle*2;
  return freezeJson({min:bounds.min.map((v)=>v-padding) as unknown as Vec3,max:bounds.max.map((v)=>v+padding) as unknown as Vec3});
}

export interface WindEffect extends ThreeLabEffect {setWindParameters(stiffness:number,reducedMotion:boolean,phaseTicks:number):void;readWindState():{clusters:readonly {id:string;ownerId:string;anchor:Vec3}[];stiffness:number;reducedMotion:boolean;phaseTicks:number};}
export async function mountThreeEffect(context: ThreeLabEffectContext, preset: LabPreset,allowEmptyDecor=false): Promise<WindEffect> {
  requireValue(['static','rigid','vertex'].includes(preset.id),'Unknown wind variant');
  const parameters=preset.parameters??{};
  requireValue(Object.keys(parameters).every((key)=>['stiffness','reducedMotion','phaseTicks','projection','width','height','dpr'].includes(key)),'Unknown wind parameter');
  const projection=parameters.projection??'all';requireValue(projection==='all'||projection==='decor','Invalid wind projection ownership');
  const initialStiffness=parameters.stiffness??0.75;finite(initialStiffness,0,1);const initialPhase=parameters.phaseTicks??0;integer(initialPhase);requireValue(initialPhase<=3600,'Invalid wind phase');
  let stiffness:number=initialStiffness,reducedMotion=parameters.reducedMotion===true,phaseTicks:number=initialPhase;
  requireValue(parameters.reducedMotion===undefined||typeof parameters.reducedMotion==='boolean','Invalid reduced-motion flag');
  let fixture=context.fixture, disposed=false, uploadedBytes=0,generation=0;
  async function identities(next:typeof fixture){const result=new Map<string,string>();for(const object of next.objects)for(let i=0;i<object.meshes.length;i++)result.set(`${object.ownerId}/${i}`,`wind:${await sha256(new TextEncoder().encode(canonicalJson([object.ownerId,object.sourceNamespace,object.sourceIds,i,object.meshes[i].positions,object.meshes[i].materialId])))}`);context.signal.throwIfAborted();return result;}
  let clusterIds=await identities(fixture);
  const base=await mountControlEffect(context,{id:'fixture-control',parameters:{projection}});
  type Cluster={mesh:Mesh;pivot:Group;id:string;ownerId:string;anchor:Vec3;source:Float32Array;normals:Float32Array};
  let clusters:Cluster[]=[];
  function collect() {
    clusters=[];
    const meshes:Mesh[]=[]; const used=new Set<Mesh>();context.root.traverse((object)=>{if(object instanceof Mesh)meshes.push(object);});
    for(const object of fixture.objects) for(let meshIndex=0;meshIndex<object.meshes.length;meshIndex++) {
      const source=object.meshes[meshIndex];
      const role=fixture.materials.find((m)=>m.id===source.materialId)!.role;
      const attachment=fixture.attachments?.find((entry)=>entry.ownerId===object.ownerId);
      // The frozen F02 exporter separates grove-decor from grove-wood, but predates the presentationOnly flag.
      const authoredDecor=fixture.kind==='synthetic'&&fixture.id.startsWith('F02-ROOT-GROVE')&&source.positions.startsWith('grove-decor-');
      if(!['foliage','accent','reed'].includes(role) || (!source.presentationOnly&&!attachment&&!authoredDecor)
        || (role==='accent'&&!attachment&&!authoredDecor))continue;
      const mesh=meshes.find((entry)=>entry.name===`${object.ownerId}:${source.materialId}`&&!used.has(entry));
      requireValue(mesh,'Declared decor projection missing');
      used.add(mesh);
      mesh.geometry.computeBoundingBox(); const center=object.sourceNamespace==='rd20-support-anchor-v1'?new Vector3():mesh.geometry.boundingBox!.getCenter(new Vector3());
      // Frozen F04's explicit branch:wood/0/0/0 meaning is the fragment-wood region origin.
      if(object.sourceNamespace==='rd02-authored-cells-v1'&&attachment?.supportOwnerId===object.ownerId&&attachment.supportIds.length===1&&attachment.supportIds[0]==='branch:wood/0/0/0'){
        const region=fixture.voxelRegions?.find(r=>r.id==='fragment-wood'&&r.ownerId===object.ownerId);requireValue(region,'Missing F04 declared support region');
        requireValue(copyFixturePayload(fixture,region.occupancyPayload)[0]===1&&copyFixturePayload(fixture,region.knownCoveragePayload)[0]===1,'Removed/unknown F04 support cell');center.set(...region.originMeters);
      }
      const anchor=center.toArray() as unknown as Vec3; const pivot=new Group(); pivot.position.copy(center);
      mesh.parent!.add(pivot); pivot.add(mesh); mesh.position.copy(center).negate();
      const positions=mesh.geometry.getAttribute('position') as BufferAttribute;
      const normals=mesh.geometry.getAttribute('normal') as BufferAttribute;
      requireValue(positions.array instanceof Float32Array&&normals.array instanceof Float32Array,'Unsupported decor buffer format');
      // Copies are made once per source mount, never per frame. Canonical fixture buffers remain private.
      clusters.push({mesh,pivot,id:clusterIds.get(`${object.ownerId}/${meshIndex}`)!,ownerId:object.ownerId,anchor,
        source:new Float32Array(positions.array),normals:new Float32Array(normals.array)});
      if(preset.id==='vertex') {
        const box=mesh.geometry.boundingBox!, padded=windBounds({min:box.min.toArray() as unknown as Vec3,max:box.max.toArray() as unknown as Vec3});
        box.min.set(...padded.min);box.max.set(...padded.max);mesh.geometry.computeBoundingSphere();
        mesh.geometry.boundingSphere!.radius+=box.getSize(new Vector3()).length()*MAX_WIND_ANGLE_RADIANS*2;
      }
    }
  }
  try{collect();requireValue(allowEmptyDecor||preset.id==='static'||clusters.length>0,'UNSUPPORTED: no source-bound movable decoration');}catch(error){await base.dispose();throw error;}
  return {
    setFrame(input) {
      context.signal.throwIfAborted();requireValue(!disposed,'Wind effect disposed');const frame=createFrameInput(input);
      requireValue(frame.sourceRevision===fixtureRevision(fixture),'Stale wind source');base.setFrame(frame);uploadedBytes=0;
      for(const cluster of clusters) {
        const owner=ownerPose(fixture,cluster.ownerId);requireValue(owner,'staleOwner');
        const pose=applyWindInputs(cluster.id,frame.tick+phaseTicks,stiffness,frame.weather,owner.rotationXyzw,preset.id==='static'||reducedMotion);
        if(preset.id==='vertex') {
          const positions=cluster.mesh.geometry.getAttribute('position') as BufferAttribute;
          deformDecorVertices(positions.array as Float32Array,cluster.source,pose.angles,cluster.anchor);positions.needsUpdate=true;
          const normals=cluster.mesh.geometry.getAttribute('normal') as BufferAttribute;const target=normals.array as Float32Array;
          // Inverse-transpose of the exact local shear; shadows consume the same changed geometry.
          for(let i=0;i<target.length;i+=3){const x=cluster.normals[i],z=cluster.normals[i+2],y=cluster.normals[i+1]-pose.angles.z*x+pose.angles.x*z;
            const length=Math.hypot(x,y,z)||1;target[i]=x/length;target[i+1]=y/length;target[i+2]=z/length;}
          normals.needsUpdate=true;uploadedBytes+=positions.array.byteLength+target.byteLength;
        } else {cluster.pivot.rotation.set(pose.angles.x,0,pose.angles.z);}
      }
    },
    async replaceFixture(next){requireValue(!disposed,'Wind effect disposed');const version=++generation;const ids=await identities(next);requireValue(!disposed&&version===generation,'Stale/aborted wind incarnation');await base.replaceFixture(next);requireValue(!disposed&&version===generation,'Stale/aborted wind publication');fixture=next;clusterIds=ids;collect();},
    setWindParameters(next,reduced,phase){context.signal.throwIfAborted();requireValue(!disposed,'Wind effect disposed');finite(next,0,1);requireValue(typeof reduced==='boolean','Invalid reduced motion');integer(phase);requireValue(phase<=3600,'Invalid wind phase');stiffness=next;reducedMotion=reduced;phaseTicks=phase;},
    readWindState(){requireValue(!disposed,'Wind effect disposed');return freezeJson({clusters:clusters.map(({id,ownerId,anchor})=>({id,ownerId,anchor})),stiffness,reducedMotion,phaseTicks});},
    readFacts(){const facts=base.readFacts();return validateFacts({...facts,experimentId:'RD-21',variantId:preset.id,
      logicalCosts:{...facts.logicalCosts,windClusters:{status:'measured',value:clusters.length,unit:'count'},
        windRetainedCopyBytes:{status:'estimated',value:clusters.reduce((n,c)=>n+c.source.byteLength+c.normals.byteLength,0),unit:'byte',reason:'Private source/normal typed copies per cluster, additional to projection buffers; excludes native allocation'},
        windUploadBytes:{status:'estimated',value:uploadedBytes,unit:'byte',reason:'Changed attribute bytes; excludes native driver/matrix uniform traffic'}},
      unsupportedFeatures:[...facts.unsupportedFeatures,'wind-art-owner-pending','native-shadow-parity-unqualified']});},
    async dispose(){if(!disposed){disposed=true;generation++;clusters=[];await base.dispose();}},
  };
}

export async function createFoliageWindExperiment(context: LabExperimentContext) {
  const host=await createThreeLabHost(context,[{mount:mountThreeEffect,preset:context.preset}],'RD-21'),effect=()=>host.effectAt<WindEffect>(0);
  return Object.assign(host,{setWindParameters(next:number,reduced:boolean,phase:number){effect().setWindParameters(next,reduced,phase);host.setFrame(host.readDiagnostics().frame);},readWindState(){return effect().readWindState();}});
}
