import {contentDigest,exactRef,immutable,number,same,validateExactRef,keys} from '../common';
import type {ExactRef} from '../common';
import {unit,FACES} from '../geometry';
import type {Vec3} from '../geometry';
import {fbm3} from '../engine/world-generation/hestia/noise';
import {fnv1a32Ascii} from '../engine/world-generation/hestia/seed';
import {createBodyFixedFrameId} from '../engine/spatial/ids';
import {IMPLEMENTATION_DIGEST} from '../model-pin';
import {PMD_PROFILE_ID,PMD_GENERATOR_VERSION,PMD_SEED,PMD_PROVENANCE,PMD_KNOWLEDGE} from './planetaryMacroProfile';
import type {CelestialBodyDefinition} from '../engine/celestial/types';
import {createCelestialBodyDefinition} from '../engine/celestial/validation';

export interface PlanetaryMacroSource extends ExactRef {
  readonly schema:'pmd.generated-global/v1';readonly bodyId:string;readonly radiusMeters:number;
  readonly sourceOwner:'pmd.generated-global';readonly sourceRevision:'1';readonly terrainGenerator:ExactRef;
  readonly bodyFixed:{readonly frameId:string;readonly northAxis:'+Z';readonly datum:'RadiusSphere'};
  readonly profile:{readonly id:typeof PMD_PROFILE_ID;readonly seed:typeof PMD_SEED;readonly amplitudeMeters:number;
    readonly longScale:2;readonly detailScale:16;readonly longOctaves:4;readonly detailOctaves:3;
    readonly liquidEnvelope:'GeometricCandidateBelowDatum0';readonly materialPolicy:'ExplicitId0SolidRockAndUnusedAirSamples'};
  readonly longSeed:number;readonly detailSeed:number;readonly minimumElevationMeters:number;readonly maximumElevationMeters:number;
  readonly missingFaces:readonly [];readonly coverage:typeof FACES;readonly provenance:typeof PMD_PROVENANCE;
  readonly knowledge:typeof PMD_KNOWLEDGE;
}
const domainSeed=(bodyId:string,domain:'long'|'detail')=>fnv1a32Ascii(`${PMD_SEED}\0${bodyId}\0${PMD_GENERATOR_VERSION}\0${domain}`);
export async function createPlanetaryMacroSource(rawBody:CelestialBodyDefinition,amplitudeMeters=2500):Promise<PlanetaryMacroSource> {
  const body=createCelestialBodyDefinition(rawBody);
  number(amplitudeMeters,1,2500,'pmd.amplitude');
  const payload={id:PMD_PROFILE_ID,version:1,schema:'pmd.generated-global/v1' as const,bodyId:body.bodyId,radiusMeters:body.radiusMeters,
    sourceOwner:'pmd.generated-global' as const,sourceRevision:'1' as const,
    terrainGenerator:{id:PMD_GENERATOR_VERSION,version:1,digest:IMPLEMENTATION_DIGEST},
    bodyFixed:{frameId:createBodyFixedFrameId(body.bodyId),northAxis:'+Z' as const,datum:'RadiusSphere' as const},
    profile:{id:PMD_PROFILE_ID,seed:PMD_SEED,amplitudeMeters,longScale:2 as const,detailScale:16 as const,longOctaves:4 as const,detailOctaves:3 as const,
      liquidEnvelope:'GeometricCandidateBelowDatum0' as const,materialPolicy:'ExplicitId0SolidRockAndUnusedAirSamples' as const},
    longSeed:domainSeed(body.bodyId,'long'),detailSeed:domainSeed(body.bodyId,'detail'),minimumElevationMeters:-amplitudeMeters,maximumElevationMeters:amplitudeMeters,
    missingFaces:[] as const,coverage:FACES,provenance:PMD_PROVENANCE,knowledge:PMD_KNOWLEDGE};
  return immutable({...payload,digest:await contentDigest(payload)});
}
export async function validatePlanetaryMacro(raw:PlanetaryMacroSource,expectedBody:CelestialBodyDefinition):Promise<PlanetaryMacroSource> {
  const s=immutable(raw);validateExactRef(exactRef(s));
  keys(s,['id','version','schema','bodyId','radiusMeters','sourceOwner','sourceRevision','terrainGenerator','bodyFixed','profile','longSeed','detailSeed','minimumElevationMeters','maximumElevationMeters','missingFaces','coverage','provenance','knowledge','digest'],'pmd');
  const expected=await createPlanetaryMacroSource(expectedBody,s.profile.amplitudeMeters);same(s,expected,'pmd.source');return s;
}
export function samplePlanetaryMacro(s:PlanetaryMacroSource,nRaw:Vec3) {
  const n=unit(nRaw),p=s.profile;
  const long=fbm3(s.longSeed,2*n.x,2*n.y,2*n.z,4),detail=fbm3(s.detailSeed,16*n.x,16*n.y,16*n.z,3);
  number(long,-1,1,'pmd.longFbmBounds');number(detail,-1,1,'pmd.detailFbmBounds');
  const elevationMeters=p.amplitudeMeters*(0.75*long+0.25*detail);
  number(elevationMeters,s.minimumElevationMeters,s.maximumElevationMeters,'pmd.heightBounds');
  const landFraction=elevationMeters>=0?1:0;
  return immutable({elevationMeters,landFraction,openLiquidFraction:1-landFraction,roughness:Math.abs(detail),
    reservoir:{status:'UNKNOWN' as const},...PMD_KNOWLEDGE});
}
export function samplePlanetaryBodyPoint(s:PlanetaryMacroSource,p:Vec3) {
  return samplePlanetaryMacro(s,p);
}
