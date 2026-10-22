import {createAnalyticReadView,assertCurrentAnalytic,type AnalyticInput} from '../../benni-pc-wxg-bodyfixed-z-source-r01/dist/src/weather.js';
import type {PlanetWeatherQuery,WeatherResult} from '../../benni-pc-wxg-bodyfixed-z-source-r01/dist/src/common.js';
import {validateFrame,type AtmosphereFrame,type V3} from './optics.js';
export {createAnalyticReadView,assertCurrentAnalytic};
export type {AnalyticInput,PlanetWeatherQuery,WeatherResult};
export interface AuthoredOpticalMask {cloudCoverage:number;rain01:number}
export interface OpticalPresentation {originMeters:V3;sourceRevision:number;atlasEpoch:number}
export function tangentBasis(position:{x:number;y:number;z:number}){
 const length=Math.hypot(position.x,position.y,position.z);
 if(!Number.isFinite(length)||length===0)throw Error('TANGENT_POSITION');
 const up:V3=[position.x/length,position.y/length,position.z/length];
 // The pole fallback is a deterministic presentation basis, never a weather default.
 const east:V3=Math.abs(up[1])<0.999999? [up[2],0,-up[0]]:[0,-up[2],up[1]];
 const e=Math.hypot(...east);for(let i=0;i<3;i++)east[i]/=e;
 const north:V3=[east[1]*up[2]-east[2]*up[1],east[2]*up[0]-east[0]*up[2],east[0]*up[1]-east[1]*up[0]];
 return {up,east,north};
}
/** Read-only optical projection of the frozen WXG model. Mask/epochs are authored presentation inputs, not producer resources. */
export async function createOpticalReadPort(input:AnalyticInput){
 const view=await createAnalyticReadView(input);
 return Object.freeze({view,read:async(query:PlanetWeatherQuery,mask:AuthoredOpticalMask,presentation:OpticalPresentation)=>{
  const result=await view.read(query);
  if(result.status!=='Known'&&result.status!=='NoAtmosphere')return {status:result.status,result,frame:null};
  const {up,east,north}=tangentBasis(result.query.bodyFixedPositionMeters);
  const wind=result.status==='Known'?result.sample.windBodyFixedMps:{x:0,y:0,z:0};
  const project=(axis:V3)=>wind.x*axis[0]+wind.y*axis[1]+wind.z*axis[2];
  const frame:AtmosphereFrame=validateFrame({status:result.status,simulationTick:result.query.simulationTick,
   weatherSnapshotId:result.WeatherSnapshotId,binding:result.binding as unknown as Record<string,unknown>,
   bodyId:result.query.bodyId,bodyRadiusMeters:view.input.bundle.physics.radiusMeters,bodyNormal:up,
   ...presentation,weatherExtinctionPerM:result.status==='Known'?result.sample.extinctionPerM:0,
   windMps:[project(east),project(up),project(north)],stormIds:result.status==='Known'?[...result.sample.stormIds]:[],
   authoredCloudCoverage:result.status==='Known'?mask.cloudCoverage:0,rain01:result.status==='Known'?mask.rain01:0,
   opticsDigest:view.input.bundle.optics.digest});
  return {status:result.status,result,frame};
 }});
}

