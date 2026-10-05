import { Group,Quaternion,Vector3 } from 'three';
import { createFrameInput,validateFacts,type LabExperimentContext,type LabFrameInput,type LabPreset } from '../../contracts/experiment';
import { copyFixturePayload,fixtureRevision,getFixtureDigest,type LabFixtureV1,type Vec3 } from '../../contracts/fixture';
import { array,finite,freezeJson,id,integer,keys,requireValue,vector } from '../../contracts/validation';
import { createThreeLabHost,ownerPose,type ThreeLabEffect,type ThreeLabEffectContext,type ThreeLabHost } from '../../runner/threeHost';
import { mountThreeEffect as mountMaterial,type MaterialLightEffect,type MaterialSurfaceBinding } from '../material-light';
import { mountThreeEffect as mountControl } from '../three-control';
import { mountThreeEffect as mountRain,rainDirection,type RainEffect } from '../rain';
import { createVoxelSourceIndex,rainCoverageBindings,sampleRainExposure,RAIN_LIMITS,type RainExposure } from '../rain-shield';

export const WET_LIMITS=Object.freeze({surfaceSamples:8192,queriesPerRefresh:2_000_000,historyEvents:64,maxTick:3600});
export interface WetnessPreset {
  readonly schema:'hestia-rd-wetness-v1';readonly id:string;readonly sourcePolicy:'reset-at-snapshot';readonly model:'current-exposure-analytic';
  readonly wettingPerSecond:number;readonly dryingPerSecond:number;readonly rainHistory:readonly {readonly tick:number;readonly rain01:number}[];
}
const presets=new WeakSet<WetnessPreset>();
/** Presentation approximation: reconstruct history under the current source/exposure, never persistent old-world texels. */
export function createWetnessPreset(input:unknown):WetnessPreset {
  keys(input,['schema','id','sourcePolicy','model','wettingPerSecond','dryingPerSecond','rainHistory']);const raw=input as WetnessPreset;
  requireValue(raw.schema==='hestia-rd-wetness-v1'&&raw.sourcePolicy==='reset-at-snapshot'&&raw.model==='current-exposure-analytic','Unsupported wetness version/model/source policy');
  id(raw.id);finite(raw.wettingPerSecond,0,1);finite(raw.dryingPerSecond,0,1);array(raw.rainHistory);requireValue(raw.rainHistory.length>0&&raw.rainHistory.length<=WET_LIMITS.historyEvents,'Wetness history budget exceeded');
  let previous=-1;for(const event of raw.rainHistory){keys(event,['tick','rain01']);integer(event.tick);finite(event.rain01,0,1);requireValue(event.tick>previous&&event.tick<=WET_LIMITS.maxTick,'Wetness history must be sorted/bounded');previous=event.tick;}
  requireValue(raw.rainHistory[0].tick===0,'Wetness history needs initial input');
  const preset=freezeJson({...raw,rainHistory:raw.rainHistory.map((e)=>({...e}))});presets.add(preset);return preset;
}
export const DEFAULT_WETNESS_PRESET=createWetnessPreset({schema:'hestia-rd-wetness-v1',id:'analytic-frozen-replay',sourcePolicy:'reset-at-snapshot',model:'current-exposure-analytic',
  wettingPerSecond:0.35,dryingPerSecond:0.08,rainHistory:[{tick:0,rain01:0},{tick:240,rain01:0.8},{tick:900,rain01:0}]});
export function sampleWetnessRainInput(preset:WetnessPreset,tick:number):number {
  requireValue(presets.has(preset),'Wetness preset must pass validation');integer(tick);requireValue(tick<=WET_LIMITS.maxTick,'Wetness tick budget exceeded');
  let rain=0;for(const event of preset.rainHistory){if(event.tick>tick)break;rain=event.rain01;}return rain;
}
export function ownerWetnessCandidate(samples:readonly {ownerId:string;wetness01:number}[]):Readonly<Record<string,number>> {
  const owners=new Map<string,{sum:number;count:number}>();requireValue(samples.length<=WET_LIMITS.surfaceSamples,'Owner wetness sample budget exceeded');
  for(const sample of samples){id(sample.ownerId);finite(sample.wetness01,0,1);const owner=owners.get(sample.ownerId)??{sum:0,count:0};owner.sum+=sample.wetness01;owner.count++;owners.set(sample.ownerId,owner);}
  return freezeJson(Object.fromEntries([...owners].map(([ownerId,value])=>[ownerId,value.sum/value.count])));
}
export function sampleAnalyticWetness(preset:WetnessPreset,tick:number,sourceStartTick:number,exposure:RainExposure['status']) {
  requireValue(presets.has(preset),'Wetness preset must pass validation');integer(tick);integer(sourceStartTick);requireValue(tick<=WET_LIMITS.maxTick&&sourceStartTick<=tick,'Invalid wetness source epoch/time');
  requireValue(['shielded','exposed','unknown'].includes(exposure),'Invalid wetness exposure');let wetness=0;
  for(let i=0;i<preset.rainHistory.length;i++){
    const begin=Math.max(sourceStartTick,preset.rainHistory[i].tick),end=Math.min(tick,preset.rainHistory[i+1]?.tick??tick);if(end<=begin)continue;
    const rain=preset.rainHistory[i].rain01;
    wetness=Math.max(0,Math.min(1,wetness+(exposure==='exposed'?rain*preset.wettingPerSecond:0)*(end-begin)/60-(1-rain)*preset.dryingPerSecond*(end-begin)/60));
  }
  return freezeJson({wetness01:exposure==='unknown'?0:wetness,qualification:exposure==='unknown'?'unknown' as const:'known' as const});
}
export interface WetnessSurfacePoint {readonly id:string;readonly ownerId:string;readonly positionLocalMeters:Vec3;readonly normalLocal:Vec3;}
/** One source-bound, direction-aware cache; only current requested points survive a refresh. */
export function createWetnessSourceCache(fixture:LabFixtureV1) {
  const digest=getFixtureDigest(fixture),revision=fixtureRevision(fixture),index=createVoxelSourceIndex(fixture);
  let cache=new Map<string,RainExposure>(),directionKey='',disposed=false;
  return {
    copiedSourceBytes:index.copiedBytes,
    evaluate(input:LabFrameInput,preset:WetnessPreset,sourceStartTick:number,points:readonly WetnessSurfacePoint[]){
      requireValue(!disposed,'Wetness cache disposed');const frame=createFrameInput(input);requireValue(frame.sourceRevision===revision,'Stale wetness source');
      integer(sourceStartTick);requireValue(sourceStartTick<=frame.tick,'Wetness source epoch is in the future');requireValue(presets.has(preset),'Wetness preset must pass validation');
      requireValue(points.length<=WET_LIMITS.surfaceSamples,'Wetness surface sample budget exceeded');
      requireValue(frame.weather.rain01===sampleWetnessRainInput(preset,frame.tick),'Current rain input differs from the declared wetness history');
      const direction=rainDirection(frame.weather),key=JSON.stringify(direction);if(key!==directionKey){cache.clear();directionKey=key;}
      const maxTravel=(index.bounds.max[1]-index.bounds.min[1]+index.quantumMeters/4)/-direction[1],maxSteps=Math.ceil(maxTravel/(index.quantumMeters/4));
      requireValue(maxSteps<=512,'Wetness source ray-step budget exceeded');
      // Full-length multiplication over-rejected the combined shelter. The unchanged hard cap is enforced before each region query.
      const potentialQueries=points.length*maxSteps*index.regionCount;
      let queries=0;const next=new Map<string,RainExposure>(),ids=new Set<string>();
      const samples=points.map((point)=>{
        keys(point,['id','ownerId','positionLocalMeters','normalLocal']);id(point.id);id(point.ownerId);vector(point.positionLocalMeters);vector(point.normalLocal);
        requireValue(!ids.has(point.id),'Duplicate wetness surface ID');ids.add(point.id);
        requireValue(Math.abs(Math.hypot(...point.normalLocal)-1)<1e-6,'Wetness face normal must be unit length');
        const owner=ownerPose(fixture,point.ownerId);requireValue(owner,'staleOwner');const rotation=new Quaternion(...owner.rotationXyzw);
        const normal=new Vector3(...point.normalLocal).applyQuaternion(rotation),receiver=new Vector3(...point.positionLocalMeters).applyQuaternion(rotation).add(new Vector3(...owner.originMeters)).addScaledVector(normal,index.quantumMeters/4);
        const world=receiver.toArray() as unknown as Vec3,pointKey=JSON.stringify([point.ownerId,world]);let exposure=cache.get(pointKey);
        if(!exposure){
          const travel=(index.bounds.max[1]-index.quantumMeters/4-world[1])/-direction[1];
          if(travel<=0)exposure=freezeJson({status:'unknown',fixtureDigest:digest,sourceRevision:revision,queries:0,receiverMeters:world,direction,travelMeters:0,sourceFrame:fixture.frame,coverageBindings:index.coverageBindings});
          else exposure=sampleRainExposure(index,world,direction,travel,Math.min(RAIN_LIMITS.queries,WET_LIMITS.queriesPerRefresh-queries));
          queries+=exposure.queries;
        }
        next.set(pointKey,exposure);const value=sampleAnalyticWetness(preset,frame.tick,sourceStartTick,exposure.status);
        return freezeJson({id:point.id,ownerId:point.ownerId,ownerRevision:owner.sourceRevision,receiverWorldMeters:world,exposure:exposure.status,...value});
      });
      requireValue(queries<=WET_LIMITS.queriesPerRefresh,'Wetness refresh exceeded source query budget');cache=next;
      return freezeJson({fixtureDigest:digest,sourceRevision:revision,sourceFrame:fixture.frame,coverageBindings:rainCoverageBindings(fixture),frame,direction,sourceStartTick,sourcePolicy:preset.sourcePolicy,model:preset.model,
        samples,unknownSamples:samples.filter((s)=>s.qualification==='unknown').length,refreshQueries:queries,potentialQueries,copiedSourceBytes:index.copiedBytes});
    },
    dispose(){if(!disposed){disposed=true;cache.clear();index.dispose();}},
  };
}

function faceInputs(fixture:LabFixtureV1,bindings:readonly MaterialSurfaceBinding[]){
  const points:WetnessSurfacePoint[]=[],surfaces: {binding:MaterialSurfaceBinding;values:Float32Array;firstPoint:number;faces:number}[]=[];
  // Validate the original quad topology/budgets before private output allocation.
  const faces=bindings.reduce((sum,b)=>sum+b.vertexCount/4,0);requireValue(Number.isInteger(faces)&&faces<=WET_LIMITS.surfaceSamples,'UNSUPPORTED: wetness surface sample budget exceeded');
  for(const binding of bindings){
    const object=fixture.objects.find((o)=>o.ownerId===binding.ownerId)!,source=object.meshes[binding.meshIndex];
    requireValue(source&&source.positions===binding.sourcePositions&&source.materialId===binding.materialId,'Stale wetness mesh/material binding');
    requireValue(source.normals&&binding.vertexCount%4===0,'UNSUPPORTED: wetness needs source quad normals');
    const positions=copyFixturePayload(fixture,source.positions),normals=copyFixturePayload(fixture,source.normals),indices=copyFixturePayload(fixture,source.indices);
    requireValue((positions instanceof Float32Array||positions instanceof Float64Array)&&(normals instanceof Float32Array||normals instanceof Float64Array)
      &&(indices instanceof Uint16Array||indices instanceof Uint32Array)&&indices.length===binding.vertexCount/4*6,'UNSUPPORTED: source is not the bounded quad projection');
    const firstPoint=points.length;
    for(let first=0;first<binding.vertexCount;first+=4){
      const offset=first/4*6;requireValue(Array.from(indices.subarray(offset,offset+6)).every((i)=>i>=first&&i<first+4),'UNSUPPORTED: shared/nonquad source topology');
      const center:Vec3=[0,1,2].map((axis)=>[0,1,2,3].reduce((sum,i)=>sum+positions[(first+i)*3+axis],0)/4) as unknown as Vec3;
      points.push(freezeJson({id:`${binding.surfaceId}/face/${first/4}`,ownerId:binding.ownerId,positionLocalMeters:center,normalLocal:[normals[first*3],normals[first*3+1],normals[first*3+2]] as Vec3}));
    }
    surfaces.push({binding,values:new Float32Array(binding.vertexCount),firstPoint,faces:binding.vertexCount/4});
  }
  return {points:Object.freeze(points),surfaces};
}
export interface WetSurfaceEffect extends ThreeLabEffect {
  setWetnessTimeline(preset:WetnessPreset,sourceStartTick:number):void;
  readWetnessState():{readonly result:ReturnType<ReturnType<typeof createWetnessSourceCache>['evaluate']>|null;readonly sourceStartTick:number;readonly preset:WetnessPreset;readonly material:ReturnType<MaterialLightEffect['readMaterialState']>;readonly rain:ReturnType<RainEffect['readRainView']>};
  setViewMode:MaterialLightEffect['setViewMode'];
  setViewCutout:MaterialLightEffect['setViewCutout'];
}
/** RD14 owns the solid/water materials, RD31 the particles; this driver uses those exact modules. */
export async function mountThreeEffect(context:ThreeLabEffectContext,preset:LabPreset):Promise<WetSurfaceEffect>{
  requireValue(preset.id==='analytic-current-exposure','Unknown wet-surface variant');const parameters=preset.parameters??{};
  requireValue(Object.keys(parameters).every((k)=>['width','height','dpr'].includes(k)),'Unknown wet-surface parameter');
  let fixture=context.fixture,disposed=false,history=DEFAULT_WETNESS_PRESET,epoch=0;
  let material:MaterialLightEffect,rain:RainEffect,cache:ReturnType<typeof createWetnessSourceCache>|undefined,faces:ReturnType<typeof faceInputs>|undefined,result:ReturnType<ReturnType<typeof createWetnessSourceCache>['evaluate']>|null=null;
  const materialRoot=new Group(),rainRoot=new Group();context.root.add(materialRoot,rainRoot);
  const child=(root:Group):ThreeLabEffectContext=>({...context,root,get fixture(){return fixture;},ownerPose:(id)=>ownerPose(fixture,id)});
  try{material=await mountMaterial(child(materialRoot),{id:'rough-wet'});rain=await mountRain(child(rainRoot),{id:'source-query'});}
  catch(error){if(material!)await material.dispose();materialRoot.removeFromParent();rainRoot.removeFromParent();throw error;}
  function active(){context.signal.throwIfAborted();requireValue(!disposed,'Wet-surface effect disposed');}
  function clearCache(){cache?.dispose();cache=undefined;faces=undefined;result=null;}
  return {
    setFrame(input){
      active();const frame=createFrameInput(input);requireValue(frame.sourceRevision===fixtureRevision(fixture),'Stale wet-surface source');
      requireValue(epoch<=frame.tick,'Wetness source epoch is in the future');
      requireValue(frame.weather.rain01===sampleWetnessRainInput(history,frame.tick),'Current rain input differs from the declared wetness history');
      material.setFrame(frame);rain.setFrame(frame);
      const hasRainHistory=history.rainHistory.some((e)=>e.rain01>0&&e.tick<frame.tick&&Math.max(epoch,e.tick)<frame.tick);
      if(!hasRainHistory){
        if(faces)for(const surface of faces.surfaces){surface.values.fill(0);material.setSurfaceWetness(surface.binding,surface.values);}
        result=null;return;
      }
      faces??=faceInputs(fixture,material.readSurfaceBindings());cache??=createWetnessSourceCache(fixture);
      result=cache.evaluate(frame,history,epoch,faces.points);
      const rainView=rain.readRainView();requireValue(rainView.fixtureDigest===result.fixtureDigest&&rainView.sourceRevision===result.sourceRevision&&rainView.tick===frame.tick
        &&JSON.stringify(rainView.direction)===JSON.stringify(result.direction),'Rain/wetness frame binding mismatch');
      for(const surface of faces.surfaces){
        for(let i=0;i<surface.faces;i++)surface.values.fill(result.samples[surface.firstPoint+i].wetness01,i*4,i*4+4);
        material.setSurfaceWetness(surface.binding,surface.values);
      }
    },
    async replaceFixture(next){active();getFixtureDigest(next);await material.replaceFixture(next);await rain.replaceFixture(next);clearCache();fixture=next;epoch=0;},
    setWetnessTimeline(next,sourceStartTick){active();requireValue(presets.has(next),'Wetness preset must pass validation');integer(sourceStartTick);requireValue(sourceStartTick<=WET_LIMITS.maxTick,'Invalid source epoch');history=next;epoch=sourceStartTick;},
    readWetnessState(){active();return freezeJson({result,sourceStartTick:epoch,preset:history,material:material.readMaterialState(),rain:rain.readRainView()});},
    setViewMode(mode){active();material.setViewMode(mode);},
    setViewCutout(planes){active();material.setViewCutout(planes);},
    readFacts(){active();const m=material.readFacts(),r=rain.readFacts();return validateFacts({experimentId:'RD-32',variantId:preset.id,backend:m.backend,fixtureDigest:getFixtureDigest(fixture),sourceRevision:fixtureRevision(fixture),
      liveResources:{...Object.fromEntries(Object.entries(m.liveResources).map(([k,v])=>[`material-${k}`,v])),...Object.fromEntries(Object.entries(r.liveResources).map(([k,v])=>[`rain-${k}`,v]))},
      logicalCosts:{...Object.fromEntries(Object.entries(m.logicalCosts).map(([k,v])=>[`material-${k}`,v])),...Object.fromEntries(Object.entries(r.logicalCosts).map(([k,v])=>[`rain-${k}`,v])),
        wetnessSourceCopyBytes:{status:'estimated',value:cache?.copiedSourceBytes??0,unit:'byte',reason:'Retained private source-index typed copies, including same-source pre-rain backward seek; additional to the rain index'},
        wetnessDriverValueBytes:{status:'estimated',value:faces?.surfaces.reduce((n,s)=>n+s.values.byteLength,0)??0,unit:'byte',reason:'Private per-surface driver Float32 arrays, separate from material attributes'},
        wetnessQueryRefresh:{status:'estimated',value:result?.refreshQueries??0,unit:'count',reason:'Conservative region-test count in last direction/source refresh'},wetnessSamples:{status:'measured',value:result?.samples.length??0,unit:'count'}},
      unsupportedFeatures:[...new Set([...m.unsupportedFeatures,...r.unsupportedFeatures,'wetness-current-exposure-history-approximation',...(result?.unknownSamples?['wetness-coverage-partly-unknown']:[])])],errors:[...m.errors,...r.errors]});},
    async dispose(){if(!disposed){disposed=true;clearCache();await rain.dispose();await material.dispose();materialRoot.removeFromParent();rainRoot.removeFromParent();}},
  };
}
export interface WetSurfaceLabHost extends ThreeLabHost {
  setWetnessTimeline:WetSurfaceEffect['setWetnessTimeline'];readWetnessState:WetSurfaceEffect['readWetnessState'];setViewMode:WetSurfaceEffect['setViewMode'];
}
export async function createWetSurfaceExperiment(context:LabExperimentContext):Promise<WetSurfaceLabHost>{
  const host=await createThreeLabHost(context,[{mount:mountThreeEffect,preset:context.preset},{mount:mountControl,preset:{id:'fixture-control',parameters:{projection:'decor'}}}],'RD-32'),wet=()=>host.effectAt<WetSurfaceEffect>(0);
  return Object.assign(host,{setWetnessTimeline(preset:WetnessPreset,epoch:number){wet().setWetnessTimeline(preset,epoch);},readWetnessState(){return wet().readWetnessState();},setViewMode:((mode)=>{wet().setViewMode(mode);host.markPresentationChanged();}) as WetSurfaceEffect['setViewMode']});
}
