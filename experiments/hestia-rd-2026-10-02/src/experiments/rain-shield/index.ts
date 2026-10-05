import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import { copyFixturePayload, fixtureRevision, getFixtureDigest, type LabFixtureV1, type LabFrame, type Vec3 } from '../../contracts/fixture';
import { finite, freezeJson, integer, requireValue, vector } from '../../contracts/validation';
import { ownerPose } from '../../runner/threeHost';

export const RAIN_LIMITS=Object.freeze({particles:4096,splashes:128,queries:65536,indexedCells:2_000_000,fieldSamples:1024,raySteps:512});
export type SourceSample={readonly status:'solid'|'air'|'unknown';readonly ownerId?:string;readonly regionId?:string;readonly cell?:Vec3};
export interface VoxelSourceIndex {
  readonly fixtureDigest:string;readonly sourceRevision:number;readonly quantumMeters:number;readonly regionCount:number;readonly copiedBytes:number;
  readonly sourceFrame:LabFrame;readonly coverageBindings:readonly {readonly regionId:string;readonly ownerId:string;readonly payloadId:string;readonly sha256:string}[];
  readonly bounds:{readonly min:Vec3;readonly max:Vec3};sample(point:Vec3):SourceSample;dispose():void;
}
export function validateRainBudget(value:{particles:number;splashes:number;queries:number}):void {
  for(const key of ['particles','splashes','queries'] as const){integer(value[key]);requireValue(value[key]<=RAIN_LIMITS[key],`Rain ${key} budget exceeded`);}
}
export function rainCoverageBindings(fixture:LabFixtureV1):VoxelSourceIndex['coverageBindings'] {
  getFixtureDigest(fixture);return freezeJson((fixture.voxelRegions??[]).map((r)=>({regionId:r.id,ownerId:r.ownerId,payloadId:r.knownCoveragePayload,sha256:fixture.payloads.find((p)=>p.id===r.knownCoveragePayload)!.sha256})));
}

/** Private copied occupancy/coverage and owner-frame matrices. Outside coverage is never air. */
export function createVoxelSourceIndex(fixture:LabFixtureV1):VoxelSourceIndex {
  const fixtureDigest=getFixtureDigest(fixture),definitions=fixture.voxelRegions??[],quantumMeters=fixture.quantumMeters;
  const count=definitions.reduce((sum,r)=>sum+r.dimensions[0]*r.dimensions[1]*r.dimensions[2],0);
  requireValue(count<=RAIN_LIMITS.indexedCells,'UNSUPPORTED: bounded source-query index exceeds its declared cell budget');
  const box=new Box3();let copiedBytes=0,disposed=false;
  let regions=definitions.map((r)=>{
    const pose=ownerPose(fixture,r.ownerId);requireValue(pose,'staleOwner');
    const world=new Matrix4().compose(new Vector3(...pose.originMeters),new Quaternion(...pose.rotationXyzw),new Vector3(1,1,1));
    const occupancy=copyFixturePayload(fixture,r.occupancyPayload),coverage=copyFixturePayload(fixture,r.knownCoveragePayload);
    requireValue(occupancy instanceof Uint8Array&&coverage instanceof Uint8Array,'Invalid source-query byte format');
    copiedBytes+=occupancy.byteLength+coverage.byteLength;
    box.union(new Box3(new Vector3(...r.originMeters),new Vector3(...r.originMeters.map((v,i)=>v+r.dimensions[i]*fixture.quantumMeters))).applyMatrix4(world));
    return {definition:r,inverse:world.invert().elements,occupancy,coverage};
  });
  const bounds=freezeJson({min:(box.isEmpty()?[0,0,0]:box.min.toArray()) as Vec3,max:(box.isEmpty()?[0,0,0]:box.max.toArray()) as Vec3});
  const coverageBindings=rainCoverageBindings(fixture);
  return Object.freeze({fixtureDigest,sourceRevision:fixtureRevision(fixture),quantumMeters:fixture.quantumMeters,regionCount:regions.length,copiedBytes,bounds,sourceFrame:fixture.frame,coverageBindings,
    sample(point:Vec3):SourceSample {
      requireValue(!disposed,'Source index disposed');vector(point);let known=false,unknown=false;
      for(const region of regions){const e=region.inverse,r=region.definition,q=quantumMeters;
        const px=e[0]*point[0]+e[4]*point[1]+e[8]*point[2]+e[12],py=e[1]*point[0]+e[5]*point[1]+e[9]*point[2]+e[13],pz=e[2]*point[0]+e[6]*point[1]+e[10]*point[2]+e[14];
        const x=Math.floor((px-r.originMeters[0])/q),y=Math.floor((py-r.originMeters[1])/q),z=Math.floor((pz-r.originMeters[2])/q);
        if(x<0||y<0||z<0||x>=r.dimensions[0]||y>=r.dimensions[1]||z>=r.dimensions[2])continue;
        const offset=x+r.dimensions[0]*(y+r.dimensions[1]*z);
        if(region.coverage[offset]===0){unknown=true;continue;}known=true;
        if(region.occupancy[offset]!==0)return freezeJson({status:'solid',ownerId:r.ownerId,regionId:r.id,cell:[x,y,z] as Vec3});
      }
      return Object.freeze({status:unknown||!known?'unknown':'air'});
    },
    dispose(){if(!disposed){disposed=true;regions=[];}},
  });
}

export interface RainExposure {readonly status:'shielded'|'exposed'|'unknown';readonly fixtureDigest:string;readonly sourceRevision:number;readonly queries:number;readonly hit?:SourceSample;
  readonly receiverMeters:Vec3;readonly direction:Vec3;readonly travelMeters:number;readonly sourceFrame:LabFrame;readonly coverageBindings:VoxelSourceIndex['coverageBindings'];}
function upstream(direction:Vec3):Vec3{vector(direction);requireValue(direction[1]<0,'Rain direction must be downward');const length=Math.hypot(...direction);requireValue(Number.isFinite(length)&&length>0,'Invalid rain direction');return direction.map((v)=>-v/length) as unknown as Vec3;}
/** Bounded bundled-source-query control. No camera/render visibility enters shielding. */
export function sampleRainExposure(index:VoxelSourceIndex,receiver:Vec3,direction:Vec3,travelMeters:number,queryBudget:number=RAIN_LIMITS.queries):RainExposure {
  integer(queryBudget,1);requireValue(queryBudget<=RAIN_LIMITS.queries,'Rain per-ray query budget exceeded');
  vector(receiver);finite(travelMeters,Number.MIN_VALUE,32);const ray=upstream(direction),steps=Math.ceil(travelMeters/(index.quantumMeters/4));
  requireValue(steps<=RAIN_LIMITS.raySteps,'Rain ray-step budget exceeded');let unknown=false,queries=0;
  const binding={fixtureDigest:index.fixtureDigest,sourceRevision:index.sourceRevision,receiverMeters:[...receiver] as unknown as Vec3,
    direction:ray.map((v)=>v===0?0:-v) as unknown as Vec3,travelMeters,sourceFrame:index.sourceFrame,coverageBindings:index.coverageBindings};
  for(let step=1;step<=steps;step++) {
    requireValue(queries+index.regionCount<=queryBudget,'Rain remaining query budget exceeded');
    const distance=travelMeters*step/steps,point=receiver.map((v,i)=>v+ray[i]*distance) as unknown as Vec3;
    const hit=index.sample(point);queries+=index.regionCount;
    if(hit.status==='solid')return freezeJson({...binding,status:'shielded',queries,hit});
    if(hit.status==='unknown')unknown=true;
  }
  return freezeJson({...binding,status:unknown?'unknown':'exposed',queries});
}

export interface RainFieldParameters {readonly originMeters:Vec3;readonly width:number;readonly height:number;readonly spacingMeters:number;readonly direction:Vec3;readonly travelMeters:number;}
/** Cache of the query control on a bounded receiver plane; this is not the independent depth-projection candidate. */
export function createRainExposureProjection(index:VoxelSourceIndex,parameters:RainFieldParameters) {
  vector(parameters.originMeters);integer(parameters.width,1);integer(parameters.height,1);finite(parameters.spacingMeters,0.03125,1);finite(parameters.travelMeters,Number.MIN_VALUE,32);upstream(parameters.direction);
  const count=parameters.width*parameters.height,steps=Math.ceil(parameters.travelMeters/(index.quantumMeters/4));
  requireValue(Number.isSafeInteger(count)&&count<=RAIN_LIMITS.fieldSamples,'Rain field sample budget exceeded');
  requireValue(steps<=RAIN_LIMITS.raySteps,'Rain ray-step budget exceeded');validateRainBudget({particles:0,splashes:0,queries:count*steps*index.regionCount});
  const samples:RainExposure[]=[];
  for(let z=0;z<parameters.height;z++)for(let x=0;x<parameters.width;x++)samples.push(sampleRainExposure(index,
    [parameters.originMeters[0]+(x+0.5)*parameters.spacingMeters,parameters.originMeters[1],parameters.originMeters[2]+(z+0.5)*parameters.spacingMeters],parameters.direction,parameters.travelMeters));
  return freezeJson({variant:'bounded-query-grid',fixtureDigest:index.fixtureDigest,sourceRevision:index.sourceRevision,parameters:JSON.parse(JSON.stringify(parameters)) as RainFieldParameters,
    samples,queries:samples.reduce((sum,sample)=>sum+sample.queries,0)});
}

/** Deterministic cosmetic drops on a fixed world emitter; current camera never reseeds the population. */
export function sampleRainTrajectory(seed:number,particleId:number,tick:number,velocityMps:Vec3):Vec3 {
  integer(seed);integer(particleId);integer(tick);vector(velocityMps);requireValue(seed<=0xffffffff&&particleId<RAIN_LIMITS.particles&&velocityMps[1]<0&&Math.hypot(...velocityMps)<=60,'Invalid bounded rain trajectory');
  let state=Math.imul((seed^particleId)>>>0,1664525)+1013904223;const x=(state>>>0)/0x100000000*4;
  state=Math.imul(state,1664525)+1013904223;const z=(state>>>0)/0x100000000*4;
  state=Math.imul(state,1664525)+1013904223;const phase=(state>>>0)/0x100000000;
  const period=4/-velocityMps[1],age=(tick/60+phase*period)%period;
  return Object.freeze([x+velocityMps[0]*age,4+velocityMps[1]*age,z+velocityMps[2]*age]) as Vec3;
}
