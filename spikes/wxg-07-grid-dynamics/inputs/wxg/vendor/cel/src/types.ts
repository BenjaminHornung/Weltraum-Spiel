import type { CelestialBodyDefinition, CelestialCatalog, RotationDefinition } from '../snapshot/product/celestial/types';
import type { SimulationTick } from '../snapshot/product/persistence/time';
import type { SpatialVector3 } from '../snapshot/product/spatial/types';

export type Digest = `sha256:${string}`;
export interface ExactRef { readonly id:string; readonly version:number; readonly digest:Digest }
export interface Provenance { readonly kind:'Catalog'|'TestAssumption'|'Unavailable'; readonly note:string }
export interface AtmospherePhysicsProfile extends ExactRef {
  readonly schema:'cel.atmosphere-physics/v1';
  readonly body:ExactRef; readonly star:ExactRef; readonly ephemeris:ExactRef;
  readonly frameId:string; readonly units:{readonly temperature:'K';readonly pressure:'Pa';readonly length:'m'};
  readonly radiusMeters:number; readonly rotation:{readonly mode:'Free'|'Synchronous';readonly value:RotationDefinition;readonly provenance:Provenance};
  readonly hasAtmosphere:boolean; readonly classificationProvenance:Provenance;
  readonly referencePressurePa:number; readonly pressureCoordinate:'AltitudeMeters'|'PressurePa';
  readonly hazards:readonly string[];
  readonly temperatureRangeK:readonly [number,number]; readonly pressureRangePa:readonly [number,number];
  readonly gasMixture:readonly {readonly speciesId:string;readonly moleFraction:number}[]|null;
  readonly thermodynamics:{readonly molarMassKgPerMol:number;readonly specificHeatJPerKgK:number;readonly provenance:Provenance}|null;
  readonly condensibleSpecies:readonly {readonly speciesId:string;readonly saturation:ExactRef|null}[];
  readonly aerosolSpecies:readonly string[];
  readonly scaleHeightMeters:number|null; readonly outerRadiusMeters:number|null;
  readonly bondAlbedo:number; readonly internalHeatFluxWPerM2:number;
  readonly assumptionProvenance:Provenance;
}
export interface AtmosphereOpticsProfile extends ExactRef {
  readonly schema:'cel.atmosphere-optics/v1'; readonly physics:ExactRef;
  readonly coefficientUnit:'1/m'; readonly rayleighPerM:SpatialVector3;
  readonly miePerM:number; readonly mieAnisotropy:number; readonly provenance:Provenance;
}
export interface PlanetWeatherProfile extends ExactRef {
  readonly schema:'cel.planet-weather/v1'; readonly bodyId:string; readonly frameId:string;
  readonly physics:ExactRef; readonly optics:ExactRef; readonly numerics:ExactRef;
  readonly model:ExactRef; readonly macroGeography:ExactRef|null; readonly climateNormals:ExactRef;
  readonly ticksPerWeatherStep:number; readonly strategy:'analytic-synoptic-v1';
}
export interface WeatherEpochBinding {
  readonly worldId:string;readonly sessionId:string;readonly sourceOwner:string;
  readonly sourceEpoch:string;readonly sourceRevision:string;readonly sourceDigest:Digest;readonly atmosphereEpoch:string;
  readonly authorityRevision:string;readonly eventCursor:string;readonly eventDigest:Digest;
  readonly checkpointDigest:Digest|null;readonly profile:ExactRef;readonly model:ExactRef;
  readonly climateNormals:ExactRef;readonly macroGeography:ExactRef|null;
  readonly simulationTick:SimulationTick;
}
export interface PlanetWeatherQuery {
  readonly bodyId:string; readonly frameId:string; readonly frameKind:'BodyFixed';
  readonly bodyFixedPositionMeters:SpatialVector3; readonly simulationTick:SimulationTick;
  readonly vertical:{readonly kind:'AltitudeMeters';readonly altitudeMeters:number}|{readonly kind:'PressurePa';readonly pressurePa:number};
  readonly requiredAccuracy:'macro'|'regional'|'interacting';
}
export interface WeatherSample {
  readonly temperatureK:number;readonly pressurePa:number;readonly windBodyFixedMps:SpatialVector3;
  readonly extinctionPerM:number;readonly condensates:readonly {readonly speciesId:string;readonly massMixingRatio:number}[];
  readonly aerosols:readonly {readonly speciesId:string;readonly massMixingRatio:number}[];
  readonly precipitation:readonly {readonly speciesId:string;readonly phase:'liquid'|'solid';readonly massFluxKgPerM2S:number}[];
  readonly stormIds:readonly string[];
}
export type ReadRecord =
  | {readonly status:'Known';readonly query:PlanetWeatherQuery;readonly sample:WeatherSample;readonly supportRadiusMeters:number;readonly provenance:Provenance}
  | {readonly status:'Pending';readonly query:PlanetWeatherQuery;readonly dependency:string}
  | {readonly status:'UnknownCoverage';readonly query:PlanetWeatherQuery;readonly reasonCode:string};
interface ReadIdentity {
  readonly WeatherSnapshotId:Digest; readonly query:PlanetWeatherQuery; readonly binding:WeatherEpochBinding;
  readonly weatherStep:number;
}
export type WeatherReadState =
  | {readonly status:'Known';readonly sample:WeatherSample;readonly supportRadiusMeters:number;readonly accuracy:'macro';readonly provenance:Provenance}
  | {readonly status:'NoAtmosphere';readonly precipitation:readonly []}
  | {readonly status:'Pending';readonly dependency:string}
  | {readonly status:'UnknownCoverage'|'Unsupported';readonly reasonCode:string};
export type WeatherResult = ReadIdentity & WeatherReadState;
export interface FixtureBundle {
  readonly name:string;readonly catalog:CelestialCatalog;readonly physics:AtmospherePhysicsProfile;
  readonly optics:AtmosphereOpticsProfile;readonly profile:PlanetWeatherProfile;readonly binding:WeatherEpochBinding;
  readonly query:PlanetWeatherQuery;readonly records:readonly ReadRecord[];
  readonly geography:unknown|null;readonly climate:unknown;readonly events:readonly unknown[];
}
export interface PlanetWeatherReadView {
  readonly profile:PlanetWeatherProfile;readonly binding:WeatherEpochBinding;
  readonly read:(query:PlanetWeatherQuery)=>Promise<WeatherResult>;
}
export type BodySource = CelestialBodyDefinition;
