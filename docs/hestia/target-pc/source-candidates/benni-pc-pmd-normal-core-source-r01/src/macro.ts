import {contentDigest,exactRef,immutable,number,keys,validateExactRef,same,assumption} from './common';
import type {ExactRef,FixtureBundle} from './common';
import {FACES,dot,unit,cellCenter,cellArea,cellAddress} from './geometry';
import type {Face,Vec3,CellAddress} from './geometry';
import {validatePlanetaryMacro,samplePlanetaryMacro} from '../../../apps/weltraum-browser/src/world-generation/planetaryMacro';
import type {PlanetaryMacroSource} from '../../../apps/weltraum-browser/src/world-generation/planetaryMacro';
import {createCelestialBodyDefinition} from '../../../apps/weltraum-browser/src/celestial/validation';
import {candidateProfile} from './world-generation/planetaryMacroProfile';

export interface SyntheticMacroSource extends ExactRef {
  readonly schema:'wxg.synthetic-macro/v1'; readonly bodyId:string; readonly sourceOwner:string;readonly sourceRevision:string;
  readonly terrainGenerator:ExactRef;readonly provenance:typeof assumption;
  readonly continentAxis:Vec3;readonly maximumElevationMeters:number;readonly roughness:number;
  readonly reservoirSpeciesId:string|null;readonly reservoirKgPerM2:number;
  readonly missingFaces:readonly Face[];
}
export type MacroSource = SyntheticMacroSource | PlanetaryMacroSource;
export interface MacroSample {
  readonly landFraction:number;readonly openLiquidFraction:number;readonly elevationMeters:number;readonly roughness:number;
  readonly reservoir: {readonly speciesId:string;readonly massKgPerM2:number}|{readonly status:'UNKNOWN'}|null;
  readonly physicalComposition?:'UNKNOWN';readonly realReservoirInventory?:'UNKNOWN';readonly biome?:'UNKNOWN';
}
export async function validateMacro(raw:MacroSource,body:FixtureBundle['catalog']['indexes']['bodyById'][string]):Promise<MacroSource> {
  if(raw.schema==='pmd.generated-global/v1')return validatePlanetaryMacro(raw,createCelestialBodyDefinition(body),candidateProfile(raw.profile.amplitudeMeters));
  const s=immutable(raw);keys(s,['id','version','digest','schema','bodyId','sourceOwner','sourceRevision','terrainGenerator','provenance','continentAxis','maximumElevationMeters','roughness','reservoirSpeciesId','reservoirKgPerM2','missingFaces'],'macro');
  validateExactRef(exactRef(s));validateExactRef(s.terrainGenerator);
  const {digest,...payload}=s;same(digest,await contentDigest(payload),'macro.digest');
  if(s.schema!=='wxg.synthetic-macro/v1'||s.bodyId!==body.bodyId||!s.sourceOwner||!s.sourceRevision||s.provenance.kind!=='TestAssumption')throw Error('MACRO_SOURCE');
  unit(s.continentAxis);number(s.maximumElevationMeters,0,10000,'elevation');number(s.roughness,0,1,'roughness');number(s.reservoirKgPerM2,0,1e9,'reservoir');
  if(s.reservoirSpeciesId===null?s.reservoirKgPerM2!==0:typeof s.reservoirSpeciesId!=='string'||!s.reservoirSpeciesId)throw Error('RESERVOIR_SPECIES');
  if(!Array.isArray(s.missingFaces)||s.missingFaces.some(f=>!FACES.includes(f))||new Set(s.missingFaces).size!==s.missingFaces.length||[...s.missingFaces].sort().join('|')!==s.missingFaces.join('|'))throw Error('FACE_COVERAGE');
  return s;
}
export function sampleMacro(s:MacroSource,nRaw:Vec3):MacroSample {
  if(s.schema==='pmd.generated-global/v1')return samplePlanetaryMacro(s,nRaw);
  const n=unit(nRaw);const signal=dot(n,unit(s.continentAxis));
  const landFraction=Math.max(0,Math.min(1,0.5+0.75*signal));
  return immutable({landFraction,openLiquidFraction:1-landFraction,elevationMeters:Math.max(0,signal)*s.maximumElevationMeters,roughness:s.roughness*landFraction,
    reservoir:s.reservoirSpeciesId===null?null:{speciesId:s.reservoirSpeciesId,massKgPerM2:s.reservoirKgPerM2*(1-landFraction)}});
}
export async function projectMacro(f:FixtureBundle,raw:MacroSource,level:number) {
  const source=await validateMacro(raw,f.catalog.indexes.bodyById[f.profile.bodyId]);cellAddress({x:1,y:0,z:0},level);
  const cells=[];const res=2**level;
  for(const face of FACES)for(let y=0;y<res;y++)for(let x=0;x<res;x++) {
    const address:CellAddress={face,level,x,y};const n=cellCenter(face,level,x,y);
    cells.push(source.missingFaces.some(missing=>missing===face)?{address,status:'UnknownCoverage' as const,reasonCode:'MACRO_FACE_MISSING'}:
      {address,status:'Known' as const,areaM2:cellArea(face,level,x,y,f.physics.radiusMeters),sample:sampleMacro(source,n)});
  }
  const payload={schema:'wxg.macro-projection/v1',bodyId:f.profile.bodyId,source:exactRef(source),level,cells,provenance:source.provenance};
  return immutable({...payload,digest:await contentDigest(payload)});
}
