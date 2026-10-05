import{Matrix4,Quaternion,Vector3}from'three';
import{fixtureRevision,getFixtureDigest,type LabFixtureV1,type Vec3}from'../../contracts/fixture';
import{createFrameInput,validateFacts,type LabExperimentContext,type LabPreset}from'../../contracts/experiment';
import{finite,freezeJson,requireValue,vector}from'../../contracts/validation';
import{createThreeLabHost,ownerPose,type ThreeCameraView,type ThreeLabEffectContext}from'../../runner/threeHost';
import{createVoxelSourceIndex,type VoxelSourceIndex}from'../rain-shield';
import{mountThreeEffect as mountMaterial,type MaterialLightEffect,type ViewCutoutPlane}from'../material-light';
import{mountThreeEffect as mountControl}from'../three-control';
export type CameraVariant='control'|'push-in'|'clip-corridor';
export const CAMERA_LIMITS=Object.freeze({maxPushMeters:16,maxTravelMeters:16,raySteps:512,radiusMeters:.45,cameraMarginMeters:.2,targetMarginMeters:.35});
function planes(camera:Vector3,target:Vector3):readonly ViewCutoutPlane[]{const direction=target.clone().sub(camera),length=direction.length();if(length<=.4)return[];direction.normalize();const u=new Vector3().crossVectors(direction,Math.abs(direction.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0)).normalize(),v=new Vector3().crossVectors(direction,u).normalize();
 const plane=(normal:Vector3,constant:number)=>({normal:normal.toArray()as unknown as Vec3,constant});
 return freezeJson([plane(u,-u.dot(camera)-CAMERA_LIMITS.radiusMeters),plane(u.clone().negate(),u.dot(camera)-CAMERA_LIMITS.radiusMeters),plane(v,-v.dot(camera)-CAMERA_LIMITS.radiusMeters),plane(v.clone().negate(),v.dot(camera)-CAMERA_LIMITS.radiusMeters),plane(direction,-direction.dot(camera)-length+CAMERA_LIMITS.targetMarginMeters),plane(direction.clone().negate(),direction.dot(camera)+.05)]);
}
export function corridorContains(planes:readonly ViewCutoutPlane[],point:Vec3){vector(point);return planes.length===6&&planes.every(p=>p.normal.reduce((n,v,a)=>n+v*point[a],p.constant)<0);}
export function cameraOcclusionSample(fixture:LabFixtureV1,cameraId:string,variant:CameraVariant,index?:VoxelSourceIndex){const digest=getFixtureDigest(fixture);requireValue(['control','push-in','clip-corridor'].includes(variant),'Unknown camera variant');const source=fixture.cameras.find(c=>c.id===cameraId);requireValue(source,'Unknown camera');const root=new Matrix4().compose(new Vector3(...fixture.frame.originMeters),new Quaternion(...fixture.frame.rotationXyzw),new Vector3(1,1,1)),camera=new Vector3(...source.positionMeters).applyMatrix4(root),marker=fixture.objects.find(o=>o.ownerId==='figure-marker');
 const binding={fixtureDigest:digest,sourceRevision:fixtureRevision(fixture),cameraId,variant,stability:'DISCRETE_CAMERA_PRESETS' as const,cameraPosition:camera.toArray()as unknown as Vec3};
 const empty={planes:[]as readonly ViewCutoutPlane[],cameraView:null as ThreeCameraView|null,queries:0};if(!marker)return freezeJson({...binding,...empty,status:'NOT_APPLICABLE_NO_TARGET',targetPosition:null as Vec3|null});
 requireValue(marker.meshes.every(m=>m.presentationOnly)&&Math.abs(marker.bounds.max[1]-marker.bounds.min[1]-1.8)<=1e-9,'Unsupported camera target source');const pose=ownerPose(fixture,marker.ownerId)!,target=new Vector3(...marker.bounds.min.map((v,a)=>(v+marker.bounds.max[a])/2)as unknown as Vec3).applyQuaternion(new Quaternion(...pose.rotationXyzw)).add(new Vector3(...pose.originMeters)),targetPosition=target.toArray()as unknown as Vec3;
 if(variant==='control')return freezeJson({...binding,...empty,targetPosition,status:'CONTROL_OFF'});
 if(variant==='clip-corridor')return freezeJson({...binding,...empty,targetPosition,planes:planes(camera,target),status:'VIEW_ONLY_FINITE_CORRIDOR'});
 requireValue(index&&index.fixtureDigest===digest&&index.sourceRevision===fixtureRevision(fixture),'Missing/stale camera source index');const direction=camera.clone().sub(target),length=direction.length(),steps=Math.ceil(length/(fixture.quantumMeters/4));
 if(length>CAMERA_LIMITS.maxTravelMeters||steps>CAMERA_LIMITS.raySteps)return freezeJson({...binding,...empty,targetPosition,status:'UNSUPPORTED_QUERY_RANGE'});if(length<=.4)return freezeJson({...binding,...empty,targetPosition,status:'CAMERA_ALREADY_NEAR_TARGET'});direction.normalize();let queries=0;
 for(let step=1;step<=steps;step++){const distance=length*step/steps,point=target.clone().addScaledVector(direction,distance),hit=index.sample(point.toArray()as unknown as Vec3);queries+=index.regionCount;if(hit.status==='unknown')return freezeJson({...binding,...empty,targetPosition,queries,status:'UNSUPPORTED_UNKNOWN_COVERAGE'});if(hit.status==='solid'){const newDistance=Math.max(.4,distance-CAMERA_LIMITS.cameraMarginMeters),position=target.clone().addScaledVector(direction,newDistance);finite(camera.distanceTo(position),0,CAMERA_LIMITS.maxPushMeters);return freezeJson({...binding,...empty,targetPosition,queries,status:'SOURCE_QUERY_PUSH_IN',cameraView:{fixtureDigest:digest,sourceRevision:fixtureRevision(fixture),cameraId,positionMeters:position.toArray()as unknown as Vec3,targetMeters:targetPosition}});}}
 return freezeJson({...binding,...empty,targetPosition,queries,status:'SOURCE_QUERY_UNOCCLUDED'});
}
/** Camera effect requests a view pose; only the shared host applies it. Native planes go through the material owner. */
export async function mountThreeEffect(context:ThreeLabEffectContext,preset:LabPreset,setCutout?:MaterialLightEffect['setViewCutout']){requireValue(['control','push-in','clip-corridor'].includes(preset.id),'Unknown camera variant');let fixture=context.fixture,disposed=false,variant=preset.id as CameraVariant,index:VoxelSourceIndex|undefined;
 if(variant==='push-in'&&fixture.objects.some(o=>o.ownerId==='figure-marker'))index=createVoxelSourceIndex(fixture);let sample=cameraOcclusionSample(fixture,context.frame.cameraId,variant,index);
 if(variant==='clip-corridor')requireValue(setCutout,'UNSUPPORTED: explicit material-owned native clipping seam required');
 function apply(){setCutout?.(sample.planes);}
 apply();return{setFrame(input:Parameters<typeof createFrameInput>[0]){context.signal.throwIfAborted();requireValue(!disposed,'Camera effect disposed');const frame=createFrameInput(input);requireValue(frame.sourceRevision===fixtureRevision(fixture),'Stale camera frame');sample=cameraOcclusionSample(fixture,frame.cameraId,variant,index);apply();},
  async replaceFixture(next:LabFixtureV1){context.signal.throwIfAborted();requireValue(!disposed,'Camera disposed');getFixtureDigest(next);const candidate=variant==='push-in'&&next.objects.some(o=>o.ownerId==='figure-marker')?createVoxelSourceIndex(next):undefined;index?.dispose();index=candidate;fixture=next;sample=cameraOcclusionSample(next,next.cameras[0].id,variant,index);apply();},
  readCameraView:()=>sample.cameraView,readOcclusion:()=>sample,
  readFacts(){requireValue(!disposed,'Camera disposed');return validateFacts({experimentId:'RD-15',variantId:variant,backend:'Three-WebGLRenderer-WebGL2',fixtureDigest:getFixtureDigest(fixture),sourceRevision:fixtureRevision(fixture),liveResources:{sourceIndices:{status:'measured',value:index?1:0,unit:'count'}},logicalCosts:{sourceQueryCopies:{status:'estimated',value:index?.copiedBytes??0,unit:'byte',reason:'Canonical source-query typed copies, no physics world'},queries:{status:'measured',value:sample.queries,unit:'count'},nativeGpuBytes:{status:'unsupported',unit:'byte',reason:'Native allocation unavailable'}},unsupportedFeatures:['camera-discrete-presets-only-no-free-look-hysteresis','native-shadow-and-product-pick-parity-unqualified','camera-art-owner-pending'],errors:[]});},
  async dispose(){if(!disposed){disposed=true;index?.dispose();index=undefined;if(!context.signal.aborted)setCutout?.([]);}}
 };
}
export async function createCameraOcclusionExperiment(context:LabExperimentContext){let material:MaterialLightEffect;
 const host=await createThreeLabHost(context,[{mount:async(c)=>{material=await mountMaterial(c,{id:'basic-lit'});return material;},preset:{id:'basic-lit'}},{mount:mountControl,preset:{id:'fixture-control',parameters:{projection:'decor'}}},{mount:async(c,p)=>{const target=material;return mountThreeEffect(c,p,planes=>target.setViewCutout(planes));},preset:context.preset}],'RD-15');
 return Object.assign(host,{readOcclusion(){return host.effectAt<Awaited<ReturnType<typeof mountThreeEffect>>>(2).readOcclusion();}});
}
