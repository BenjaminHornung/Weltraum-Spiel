import { BoxGeometry,BufferAttribute,BufferGeometry,CircleGeometry,DoubleSide,DynamicDrawUsage,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Quaternion,Raycaster,Vector3 } from 'three';
import { createFrameInput,validateFacts,validateWeather,type LabExperimentContext,type LabFrameInput,type LabPreset,type LabWeatherSample } from '../../contracts/experiment';
import { copyFixturePayload,fixtureRevision,getFixtureDigest,type LabFixtureV1,type LabFrame,type Vec3 } from '../../contracts/fixture';
import { finite,freezeJson,integer,requireValue,vector } from '../../contracts/validation';
import { createThreeLabHost,ownerPose,type ThreeLabEffect,type ThreeLabEffectContext,type ThreeLabHost } from '../../runner/threeHost';
import { mountThreeEffect as mountControl,projectFloat32 } from '../three-control';
import { createVoxelSourceIndex,rainCoverageBindings,RAIN_LIMITS,validateRainBudget,type VoxelSourceIndex } from '../rain-shield';

export interface RainColumn {readonly originMeters:Vec3;readonly status:'solid'|'air'|'unknown';readonly hitDistanceMeters?:number;readonly hitPointMeters?:Vec3;}
export interface RainColumns {readonly fixtureDigest:string;readonly sourceRevision:number;readonly sourceFrame:LabFrame;readonly coverageBindings:VoxelSourceIndex['coverageBindings'];readonly direction:Vec3;readonly travelMeters:number;readonly columns:readonly RainColumn[];readonly queries:number;readonly variant:'source-query'|'depth-projection';}
export interface RainDepthProjection {readonly fixtureDigest:string;readonly sourceRevision:number;readonly geometryBytes:number;sample(origin:Vec3,direction:Vec3,travelMeters:number):number|undefined;dispose():void;}
export function compareRainDepthProjection(control:RainColumns,candidate:RainColumns,quantumMeters:number){
  finite(quantumMeters,Number.MIN_VALUE);requireValue(control.fixtureDigest===candidate.fixtureDigest&&control.sourceRevision===candidate.sourceRevision
    &&JSON.stringify(control.direction)===JSON.stringify(candidate.direction)&&JSON.stringify(control.sourceFrame)===JSON.stringify(candidate.sourceFrame)
    &&JSON.stringify(control.coverageBindings)===JSON.stringify(candidate.coverageBindings)&&control.travelMeters===candidate.travelMeters
    &&control.variant==='source-query'&&candidate.variant==='depth-projection'&&control.columns.length===candidate.columns.length
    &&control.columns.length>0&&control.columns.length<=RAIN_LIMITS.fieldSamples,'Rain comparison binding mismatch');
  finite(control.travelMeters,Number.MIN_VALUE,32);vector(control.direction);requireValue(Math.abs(Math.hypot(...control.direction)-1)<1e-6&&control.direction[1]<0,'Invalid comparison direction');
  for(const field of [control,candidate])for(const column of field.columns){
    vector(column.originMeters);requireValue(['solid','air','unknown'].includes(column.status),'Invalid comparison coverage status');
    requireValue(column.status!=='solid'||column.hitDistanceMeters!==undefined,'Solid comparison needs hit distance');
    requireValue(column.status!=='air'||column.hitDistanceMeters===undefined,'Air comparison cannot have hit distance');
    if(column.hitDistanceMeters!==undefined)finite(column.hitDistanceMeters,0,field.travelMeters);
  }
  const failures:number[]=[];
  control.columns.forEach((column,i)=>{const other=candidate.columns[i];requireValue(JSON.stringify(column.originMeters)===JSON.stringify(other.originMeters),'Rain emitter mismatch');
    if(column.status!==other.status||(column.hitDistanceMeters!==undefined&&(other.hitDistanceMeters===undefined||Math.abs(column.hitDistanceMeters-other.hitDistanceMeters)>quantumMeters/4+1e-6)))failures.push(i);});
  return freezeJson({decision:failures.length?'REJECT':'FUNCTIONAL_PARITY_ONLY',failedColumns:failures,toleranceMeters:quantumMeters/4+1e-6});
}
function unitDown(value:Vec3):Vec3 {vector(value);const length=Math.hypot(...value);requireValue(value[1]<0&&length>0&&length<=60,'Rain direction must be bounded and downward');return value.map((v)=>v/length) as unknown as Vec3;}
export function rainVelocityMps(weather:LabWeatherSample):Vec3 {validateWeather(weather);return Object.freeze([weather.windMps[0]*0.2,-12,weather.windMps[2]*0.2]) as Vec3;}
export function rainDirection(weather:LabWeatherSample):Vec3{return Object.freeze(unitDown(rainVelocityMps(weather)));}

/** Independent first-surface projection against source mesh triangles; CPU reference, not a claimed GPU depth pass. */
export function createRainDepthProjection(fixture:LabFixtureV1):RainDepthProjection {
  const meshes:Mesh[]=[],material=new MeshBasicMaterial({side:DoubleSide}),ray=new Raycaster();let disposed=false,geometryBytes=0;
  try {
    for(const object of fixture.objects)for(const source of object.meshes){
      const role=fixture.materials.find((m)=>m.id===source.materialId)!.role;
      if(source.presentationOnly||['foliage','accent','reed','water-presentation'].includes(role))continue;
      const geometry=new BufferGeometry(),positions=projectFloat32(copyFixturePayload(fixture,source.positions)),indices=copyFixturePayload(fixture,source.indices);
      requireValue(indices instanceof Uint16Array||indices instanceof Uint32Array,'Invalid depth-projection indices');
      geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setIndex(new BufferAttribute(indices,1));geometryBytes+=positions.byteLength+indices.byteLength;
      const mesh=new Mesh(geometry,material),pose=ownerPose(fixture,object.ownerId)!;
      mesh.position.set(...pose.originMeters);mesh.quaternion.set(...pose.rotationXyzw);mesh.updateMatrixWorld();meshes.push(mesh);
    }
  }catch(error){meshes.forEach((m)=>m.geometry.dispose());material.dispose();throw error;}
  return Object.freeze({fixtureDigest:getFixtureDigest(fixture),sourceRevision:fixtureRevision(fixture),geometryBytes,
    sample(origin:Vec3,direction:Vec3,travelMeters:number){requireValue(!disposed,'Depth projection disposed');vector(origin);const down=unitDown(direction);finite(travelMeters,Number.MIN_VALUE,32);
      ray.set(new Vector3(...origin),new Vector3(...down));ray.near=0;ray.far=travelMeters;return ray.intersectObjects(meshes,false)[0]?.distance;},
    dispose(){if(!disposed){disposed=true;meshes.forEach((m)=>m.geometry.dispose());meshes.length=0;material.dispose();}},
  });
}

/** ponytail: one bounded orthographic emitter grid; increase coverage only after measuring refresh cost. */
export function buildRainColumns(index:VoxelSourceIndex,velocityMps:Vec3,columnsPerSide:number,depth?:RainDepthProjection):RainColumns {
  integer(columnsPerSide,1);requireValue(columnsPerSide<=16&&columnsPerSide*columnsPerSide<=RAIN_LIMITS.fieldSamples,'Rain field sample budget exceeded');
  requireValue(index.regionCount>0,'UNSUPPORTED: no source coverage for rain');const down=unitDown(velocityMps),q=index.quantumMeters;
  const height=index.bounds.max[1]-index.bounds.min[1]-q/2,travel=height/-down[1],steps=Math.ceil(travel/(q/4));
  finite(travel,Number.MIN_VALUE,32);requireValue(steps<=RAIN_LIMITS.raySteps,'Rain ray-step budget exceeded');
  validateRainBudget({particles:0,splashes:0,queries:columnsPerSide*columnsPerSide*(steps+1)*index.regionCount});
  if(depth)requireValue(depth.fixtureDigest===index.fixtureDigest&&depth.sourceRevision===index.sourceRevision,'Stale depth projection');
  const columns:RainColumn[]=[];let queries=0;
  for(let z=0;z<columnsPerSide;z++)for(let x=0;x<columnsPerSide;x++){
    const origin:Vec3=[index.bounds.min[0]+(x+0.5)/columnsPerSide*(index.bounds.max[0]-index.bounds.min[0]),index.bounds.max[1]-q/4,index.bounds.min[2]+(z+0.5)/columnsPerSide*(index.bounds.max[2]-index.bounds.min[2])];
    let hitDistance:number|undefined,unknown=false;
    for(let step=0;step<=steps;step++){
      const distance=travel*step/steps,point=origin.map((v,i)=>v+down[i]*distance) as unknown as Vec3;
      const hit=index.sample(point);queries+=index.regionCount;
      if(hit.status==='unknown')unknown=true;
      if(hit.status==='solid'){hitDistance=distance;break;}
    }
    // The candidate uses mesh depth for the first hit; canonical coverage remains the authority for unknown.
    if(depth)hitDistance=depth.sample(origin,down,travel);
    const hitPoint=hitDistance===undefined?undefined:origin.map((v,i)=>v+down[i]*hitDistance!) as unknown as Vec3;
    columns.push({originMeters:origin,status:unknown?'unknown':hitDistance===undefined?'air':'solid',
      ...(hitDistance===undefined?{}:{hitDistanceMeters:hitDistance,hitPointMeters:hitPoint})});
  }
  return freezeJson({fixtureDigest:index.fixtureDigest,sourceRevision:index.sourceRevision,sourceFrame:index.sourceFrame,coverageBindings:index.coverageBindings,direction:down,travelMeters:travel,columns,queries,variant:depth?'depth-projection':'source-query'});
}

export interface RainExposureView {readonly fixtureDigest:string;readonly sourceRevision:number;readonly sourceFrame:LabFrame;readonly coverageBindings:VoxelSourceIndex['coverageBindings'];readonly tick:number;readonly direction:Vec3;readonly coverage:'known'|'partly-unknown'|'not-sampled';
  readonly field:RainColumns|null;readonly visibleParticles:number;readonly clippedParticles:number;readonly unknownParticles:number;readonly splashes:number;}
export interface RainEffect extends ThreeLabEffect {readRainView():RainExposureView;}
export async function mountThreeEffect(context:ThreeLabEffectContext,preset:LabPreset):Promise<RainEffect> {
  requireValue(['source-query','depth-projection','unshielded-control'].includes(preset.id),'Unknown rain variant');
  const parameters=preset.parameters??{};requireValue(Object.keys(parameters).every((k)=>['particles','splashes','columns','seed','width','height','dpr'].includes(k)),'Unknown rain parameter');
  const numeric=(key:string,fallback:number)=>{const value=parameters[key]??fallback;integer(value);return value as number;};
  const particles=numeric('particles',768),splashCount=numeric('splashes',64),columns=numeric('columns',8),seed=numeric('seed',23);
  requireValue(particles>0&&columns>0&&seed<=0xffffffff&&columns<=16,'Invalid bounded rain parameters');
  validateRainBudget({particles,splashes:splashCount,queries:0});
  context.signal.throwIfAborted();let fixture=context.fixture,disposed=false,index:VoxelSourceIndex|undefined,depth:RainDepthProjection|undefined,field:RainColumns|undefined,directionKey='';
  const geometry=new BoxGeometry(0.012,0.09,0.012),material=new MeshBasicMaterial({color:0xc0dce8,transparent:true,opacity:0.72,depthWrite:false});
  const drops=new InstancedMesh(geometry,material,particles);drops.name='rain-drops';drops.instanceMatrix.setUsage(DynamicDrawUsage);drops.frustumCulled=false;drops.count=0;
  const splashGeometry=new CircleGeometry(0.06,8),splashMaterial=new MeshBasicMaterial({color:0xc0dce8,transparent:true,opacity:0.5,depthWrite:false,side:DoubleSide});
  const splashes=new InstancedMesh(splashGeometry,splashMaterial,splashCount);splashes.name='rain-splashes';splashes.instanceMatrix.setUsage(DynamicDrawUsage);splashes.frustumCulled=false;splashes.count=0;
  context.root.add(drops,splashes);const matrix=new Matrix4(),position=new Vector3(),scale=new Vector3(),rotation=new Quaternion(),splashRotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);
  let view:RainExposureView=freezeJson({fixtureDigest:getFixtureDigest(fixture),sourceRevision:fixtureRevision(fixture),sourceFrame:fixture.frame,coverageBindings:rainCoverageBindings(fixture),tick:0,direction:[0,-1,0],coverage:'not-sampled',field:null,visibleParticles:0,clippedParticles:0,unknownParticles:0,splashes:0});
  function active(){context.signal.throwIfAborted();requireValue(!disposed,'Rain effect disposed');}
  function clearSource(){index?.dispose();depth?.dispose();index=undefined;depth=undefined;field=undefined;directionKey='';}
  function refresh(velocity:Vec3){
    index??=createVoxelSourceIndex(fixture);if(preset.id==='depth-projection')depth??=createRainDepthProjection(fixture);
    const key=JSON.stringify(velocity);if(key!==directionKey){field=buildRainColumns(index,velocity,columns,depth);directionKey=key;}
  }
  function update(input:LabFrameInput){
    active();const frame=createFrameInput(input);requireValue(frame.sourceRevision===fixtureRevision(fixture),'Stale rain source');
    const velocity=rainVelocityMps(frame.weather),down=unitDown(velocity),downVector=new Vector3(...down);
    let visible=0,clipped=0,unknown=0,visibleSplashes=0;
    if(frame.weather.rain01>0){
      refresh(velocity);const speed=Math.hypot(...velocity),period=field!.travelMeters/speed,population=Math.floor(particles*frame.weather.rain01);
      rotation.setFromUnitVectors(new Vector3(0,-1,0),new Vector3(...down));
      for(let i=0;i<population;i++){
        const column=field!.columns[i%field!.columns.length],hash=(Math.imul(seed^i,1664525)+1013904223)>>>0;
        const distance=((frame.seconds/period+hash/0x100000000)%1)*field!.travelMeters;
        const isUnknown=column.status==='unknown',blocked=preset.id!=='unshielded-control'&&column.hitDistanceMeters!==undefined&&distance>=column.hitDistanceMeters-0.05;
        if(isUnknown){unknown++;continue;}if(blocked){clipped++;continue;}
        position.set(...column.originMeters).addScaledVector(downVector,distance);matrix.compose(position,rotation,scale.set(1,1,1));drops.setMatrixAt(visible++,matrix);
      }
      for(const column of field!.columns){
        if(visibleSplashes>=splashCount)break;if(column.status!=='solid'||!column.hitPointMeters)continue;
        const pulse=((frame.tick+visibleSplashes*13)%30)/30;position.set(...column.hitPointMeters);position.y+=0.035;
        matrix.compose(position,splashRotation,scale.setScalar(0.3+pulse));splashes.setMatrixAt(visibleSplashes++,matrix);
      }
    }
    drops.count=visible;splashes.count=visibleSplashes;drops.instanceMatrix.needsUpdate=true;splashes.instanceMatrix.needsUpdate=true;
    const activeField=frame.weather.rain01>0?field:undefined;
    view=freezeJson({fixtureDigest:getFixtureDigest(fixture),sourceRevision:fixtureRevision(fixture),sourceFrame:fixture.frame,coverageBindings:rainCoverageBindings(fixture),tick:frame.tick,direction:down,
      coverage:activeField?(activeField.columns.some((c)=>c.status==='unknown')?'partly-unknown':'known'):'not-sampled',field:activeField??null,visibleParticles:visible,clippedParticles:clipped,unknownParticles:unknown,splashes:visibleSplashes});
  }
  return {
    setFrame:update,
    async replaceFixture(next){active();getFixtureDigest(next);clearSource();fixture=next;drops.count=0;splashes.count=0;view=freezeJson({...view,fixtureDigest:getFixtureDigest(next),sourceRevision:fixtureRevision(next),sourceFrame:next.frame,coverageBindings:rainCoverageBindings(next),coverage:'not-sampled',field:null,visibleParticles:0,clippedParticles:0,unknownParticles:0,splashes:0});},
    readRainView(){active();return view;},
    readFacts(){active();return validateFacts({experimentId:'RD-31',variantId:preset.id,backend:'Three-WebGLRenderer-WebGL2',fixtureDigest:getFixtureDigest(fixture),sourceRevision:fixtureRevision(fixture),
      liveResources:{geometries:{status:'measured',value:2,unit:'count'},materials:{status:'measured',value:2,unit:'count'},particles:{status:'measured',value:drops.count,unit:'count'},splashes:{status:'measured',value:splashes.count,unit:'count'}},
      logicalCosts:{fieldQueries:{status:'estimated',value:field?.queries??0,unit:'count',reason:'Conservative region-test count for last source/direction refresh, not per-particle queries'},sourceIndexBytes:{status:'estimated',value:index?.copiedBytes??0,unit:'byte',reason:'Private source occupancy/coverage buffers'},depthProjectionBytes:{status:'estimated',value:depth?.geometryBytes??0,unit:'byte',reason:'CPU mesh depth candidate buffers'},instanceUploadBytes:{status:'estimated',value:drops.instanceMatrix.array.byteLength+splashes.instanceMatrix.array.byteLength,unit:'byte',reason:'Full reserved matrix attributes marked dirty without update ranges, including zero visible population; excludes native driver allocations'}},
      unsupportedFeatures:['native-gpu-depth-projection-not-measured','rain-shadow-art-owner-pending',...(view.coverage==='partly-unknown'?['rain-coverage-partly-unknown']:[]),...(preset.id==='unshielded-control'?['deliberately-incorrect-unshielded-control']:[])],errors:[]});},
    async dispose(){if(!disposed){disposed=true;clearSource();drops.removeFromParent();splashes.removeFromParent();drops.dispose();splashes.dispose();geometry.dispose();splashGeometry.dispose();material.dispose();splashMaterial.dispose();}},
  };
}
export interface RainLabHost extends ThreeLabHost {readRainView():RainExposureView;}
export async function createRainExperiment(context:LabExperimentContext):Promise<RainLabHost>{
  const host=await createThreeLabHost(context,[{mount:mountControl,preset:{id:'fixture-control'}},{mount:mountThreeEffect,preset:context.preset}],'RD-31');
  return Object.assign(host,{readRainView(){return host.effectAt<RainEffect>(1).readRainView();}});
}
