import {canonicalCelestialJson,canonicalizeCelestialValue} from '../vendor/cel/dist/snapshot/product/celestial/canonical.js';
export {contentDigest,exactRef,sealProfile,validateExactRef,validateQuery,validateBundle,createWeatherReadView} from '../vendor/cel/dist/src/contracts.js';
export {createSimulationTick,UNIVERSE_TICKS_PER_SECOND} from '../vendor/cel/dist/snapshot/product/persistence/time.js';
export {canonicalCelestialJson};
export type {ExactRef,Digest,FixtureBundle,PlanetWeatherQuery,WeatherEpochBinding,WeatherSample,AtmospherePhysicsProfile} from '../vendor/cel/dist/src/types.js';
import type {WeatherResult as BaseWeatherResult} from '../vendor/cel/dist/src/types.js';
export type WeatherResult = BaseWeatherResult & {readonly pmdElevationMeters?:number;readonly geographicKnowledge?:{readonly physicalComposition:'UNKNOWN';readonly realReservoirInventory:'UNKNOWN';readonly biome:'UNKNOWN'}};
export const immutable=<T>(v:T):T=>canonicalizeCelestialValue(v) as T;
export function number(v:unknown,min:number,max:number,name:string):number {
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('NUMBER_RANGE:'+name);return v;
}
export function keys(v:unknown,names:readonly string[],name:string):void {
  if(v===null||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join('|')!==[...names].sort().join('|'))throw Error('SCHEMA_KEYS:'+name);
}
export function same(a:unknown,b:unknown,name:string):void {if(canonicalCelestialJson(a)!==canonicalCelestialJson(b))throw Error('REFERENCE_MISMATCH:'+name);}
export const assumption={kind:'TestAssumption' as const,note:'Synthetic authoring constants, not accepted planetary climate or natural atmosphere data.'};
