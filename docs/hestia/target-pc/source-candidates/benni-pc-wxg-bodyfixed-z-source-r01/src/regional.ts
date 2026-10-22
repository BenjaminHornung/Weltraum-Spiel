import {contentDigest,exactRef,immutable,number,keys,same,validateExactRef,assumption} from './common';
import type {ExactRef,PlanetWeatherQuery,WeatherResult,Digest} from './common';
import type {AnalyticReadView} from './weather';
import {scale} from './geometry';
import {IMPLEMENTATION_DIGEST} from './model-pin';
export interface LocalExposure extends ExactRef {
  readonly schema:'wxg.local-exposure/v1';readonly worldId:string;readonly sessionId:string;readonly sourceOwner:string;
  readonly sourceEpoch:string;readonly sourceRevision:string;readonly terrain:ExactRef;readonly regionId:string;
  readonly frameId:string;readonly neighborDigest:Digest;readonly coverage:'Complete'|'UnknownCoverage';
  readonly shelterFraction:number;readonly roughness:number;readonly provenance:typeof assumption;
}
async function validateExposure(raw:LocalExposure,weather:WeatherResult):Promise<LocalExposure> {
  const e=immutable(raw);keys(e,['id','version','digest','schema','worldId','sessionId','sourceOwner','sourceEpoch','sourceRevision','terrain','regionId','frameId','neighborDigest','coverage','shelterFraction','roughness','provenance'],'exposure');
  validateExactRef(exactRef(e));validateExactRef(e.terrain);validateExactRef({id:'halo',version:1,digest:e.neighborDigest});
  const {digest,...payload}=e;same(digest,await contentDigest(payload),'exposure.digest');
  if(e.schema!=='wxg.local-exposure/v1'||!e.sourceOwner||!e.sourceEpoch||!e.sourceRevision||!e.regionId||e.provenance.kind!=='TestAssumption'||!['Complete','UnknownCoverage'].includes(e.coverage))throw Error('EXPOSURE_SOURCE');
  same(e.worldId,weather.binding.worldId,'exposure.world');same(e.sessionId,weather.binding.sessionId,'exposure.session');same(e.frameId,weather.query.frameId,'exposure.frame');
  number(e.shelterFraction,0,1,'shelter');number(e.roughness,0,1,'roughness');return e;
}
export interface RegionalProduct {
  readonly regionalProductId:Digest;readonly query:PlanetWeatherQuery;readonly weather:WeatherResult;readonly localSource:LocalExposure;
  readonly algorithm:ExactRef;readonly status:'Known'|'UnknownCoverage'|'Unavailable';
  readonly sample?:{readonly windBodyFixedMps:{readonly x:number;readonly y:number;readonly z:number};readonly temperatureK:number};
}
export class RegionalCacheCandidate {
  private entries=new Map<string,{product:RegionalProduct;bytes:number}>();private logicalBytes=0;private hits=0;private misses=0;private evictions=0;
  constructor(private readonly view:AnalyticReadView,private readonly maximumBytes:number){if(!Number.isSafeInteger(maximumBytes)||maximumBytes<1024||maximumBytes>1e7)throw Error('CACHE_BUDGET');}
  async read(raw:PlanetWeatherQuery,exposureRaw:LocalExposure):Promise<RegionalProduct> {
    const query=immutable(raw),exposure=immutable(exposureRaw);const weather=await this.view.read(query.requiredAccuracy==='regional'?{...query,requiredAccuracy:'macro'}:query);
    const localSource=await validateExposure(exposure,weather);
    const algorithm={id:'wxg.regional-exposure/v1',version:1,digest:IMPLEMENTATION_DIGEST};
    const key=await contentDigest({query,weather:weather.WeatherSnapshotId,localSource:exactRef(localSource),algorithm});
    const cached=this.entries.get(key);if(cached){this.hits++;this.entries.delete(key);this.entries.set(key,cached);return cached.product;}
    this.misses++;
    const state=localSource.coverage==='UnknownCoverage'?{status:'UnknownCoverage' as const}:weather.status!=='Known'?{status:'Unavailable' as const}:
      {status:'Known' as const,sample:{windBodyFixedMps:scale(weather.sample.windBodyFixedMps,1-localSource.shelterFraction),temperatureK:weather.sample.temperatureK}};
    const payload={query,weather,localSource,algorithm,...state};const product:RegionalProduct=immutable({...payload,regionalProductId:await contentDigest(payload)});
    // Another read can insert this key while its digest is awaited; count retained bytes once.
    const winner=this.entries.get(key);if(winner){this.entries.delete(key);this.entries.set(key,winner);return winner.product;}
    const bytes=new TextEncoder().encode(JSON.stringify(product)).length+new TextEncoder().encode(key).length;
    if(bytes<=this.maximumBytes){while(this.logicalBytes+bytes>this.maximumBytes){const oldest=this.entries.entries().next().value!;this.entries.delete(oldest[0]);this.logicalBytes-=oldest[1].bytes;this.evictions++;}this.entries.set(key,{product,bytes});this.logicalBytes+=bytes;}
    return product;
  }
  async prefetch(queries:readonly PlanetWeatherQuery[],exposure:LocalExposure):Promise<void>{for(const q of queries)await this.read(q,exposure);}
  evictAll():void{this.evictions+=this.entries.size;this.entries.clear();this.logicalBytes=0;}
  stats(){return Object.freeze({entries:this.entries.size,logicalBytes:this.logicalBytes,maximumBytes:this.maximumBytes,hits:this.hits,misses:this.misses,evictions:this.evictions,memoryMeaning:'UTF8 product+key bytes; JS/native heap overhead NOT_MEASURED'});}
  async assertCurrent(product:RegionalProduct,query:PlanetWeatherQuery,exposure:LocalExposure):Promise<RegionalProduct>{const copy=immutable(product);same(copy,await this.read(query,exposure),'STALE_REGIONAL_PRODUCT');return copy;}
}
