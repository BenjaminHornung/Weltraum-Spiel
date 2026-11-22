import { STARTER_BODY_IDS, STARTER_CELESTIAL_CATALOG } from "../celestial/starterSystem";
import type { HvpCellReader } from "../hestia-prototype/terrain/picking";
import { HVP_PHYSICS_DT } from "../hestia-prototype/physics/tick";
import { UNIVERSE_TICKS_PER_SECOND } from "../persistence/time";
import type { SpatialVector3 } from "../spatial/types";
import { createPlanetaryMacroSource } from "../world-generation/planetaryMacro";
import authored from "./model/authoredCoast.json";
import type { ClimateConfig } from "./model/climate";
import type { FixtureBundle, PlanetWeatherQuery, WeatherResult } from "./model/common";
import { candidateProfile } from "./model/macroProfile";
import { createAnalyticReadView, trajectoryQuery } from "./model/weather";

export interface HvpWeatherBinding {
  readonly worldId: string;
  readonly sessionId: string;
  readonly epoch: number;
  readonly revision: number;
  readonly sourceDigest: string;
}
export interface HvpWeatherInput extends HvpWeatherBinding {
  /** Confirmed solver tick (60 Hz). */
  readonly tick: number;
  /** Player position in the authored coast's local Y-up frame. */
  readonly position: SpatialVector3;
  /** Bound primary terrain. Other regions need their own confirmed reader. */
  readonly terrain?: HvpCellReader & Omit<HvpWeatherBinding,"worldId">;
}
export interface HvpWeatherFrame extends HvpWeatherBinding {
  /** Producer time in 120 Hz universe ticks. */
  readonly sampleTick: number;
  readonly weatherSnapshotId: string;
  readonly windMps: readonly [number, number, number];
  readonly extinctionPerM: number;
  readonly temperatureK: number;
  /** The atmosphere viewer's authored optical mask. It does not imply a water reservoir. */
  readonly cloudCoverage: number;
  readonly rain01: number;
  readonly snow01: number;
  readonly stormIds: readonly string[];
  readonly exposure: "Open" | "Sheltered" | "Unknown";
}

const samplingPeriod = UNIVERSE_TICKS_PER_SECOND;
const universeTicksPerPhysicsTick = UNIVERSE_TICKS_PER_SECOND * HVP_PHYSICS_DT;
const mask = 0.3;
const rainFluxAtFullIntensity = 10 / 3600; // kg m^-2 s^-1 for 10 mm/hour of liquid water

export async function createHvpCoastWeatherModel(worldId: string, sessionId: string) {
  const body = STARTER_CELESTIAL_CATALOG.indexes.bodyById[STARTER_BODY_IDS.hestia];
  const bundle = {...authored.bundle, catalog: STARTER_CELESTIAL_CATALOG,
    binding:{...authored.bundle.binding,worldId,sessionId}} as unknown as FixtureBundle;
  const macro = await createPlanetaryMacroSource(body, candidateProfile());
  return createAnalyticReadView({bundle, macro, config:authored.config as ClimateConfig});
}

function project(binding: HvpWeatherBinding, result: WeatherResult, query: PlanetWeatherQuery, exposure:HvpWeatherFrame["exposure"]): HvpWeatherFrame | undefined {
  if (result.status !== "Known" || result.binding.worldId !== binding.worldId ||
      result.binding.sessionId !== binding.sessionId || result.binding.simulationTick !== query.simulationTick ||
      result.query.frameId !== query.frameId || result.query.bodyId !== query.bodyId) return undefined;
  const {windBodyFixedMps: wind, precipitation} = result.sample;
  // The authored query starts at the prime meridian on the equator. At that anchor
  // +east = body +Y, +up = body +X, +south = body -Z. Use the actual sample basis.
  const n = query.bodyFixedPositionMeters;
  const length = Math.hypot(n.x,n.y,n.z), xy = Math.hypot(n.x,n.y);
  const eastX = -n.y/xy, eastY = n.x/xy;
  const upX = n.x/length, upY = n.y/length, upZ = n.z/length;
  const localWind = Object.freeze([wind.x*eastX+wind.y*eastY,wind.x*upX+wind.y*upY+wind.z*upZ,
    wind.x*upZ*eastY-wind.y*upZ*eastX+wind.z*(upY*eastX-upX*eastY)] as const);
  let rain = 0, snow = 0;
  for (const p of precipitation) {
    if (p.phase === "liquid") rain += p.massFluxKgPerM2S;
    else if (p.phase === "solid") snow += p.massFluxKgPerM2S;
  }
  return Object.freeze({...binding,sampleTick:query.simulationTick,weatherSnapshotId:result.WeatherSnapshotId,
    windMps:localWind,extinctionPerM:result.sample.extinctionPerM,temperatureK:result.sample.temperatureK,
    cloudCoverage:mask,exposure,
    rain01:exposure==="Open"?Math.min(1,rain/rainFluxAtFullIntensity):0,
    snow01:exposure==="Open"?Math.min(1,snow/rainFluxAtFullIntensity):0,
    stormIds:Object.freeze([...result.sample.stormIds])});
}

type Model = Pick<Awaited<ReturnType<typeof createHvpCoastWeatherModel>>,"input"|"read">;
type SampleRequest = {binding:HvpWeatherBinding; tick:number; x:number; y:number; z:number; exposure:HvpWeatherFrame["exposure"]};
const sameBinding = (a:HvpWeatherBinding, b:HvpWeatherBinding) => a.worldId===b.worldId && a.sessionId===b.sessionId &&
  a.epoch===b.epoch && a.revision===b.revision && a.sourceDigest===b.sourceDigest;

/** Call from the existing scene owner. Work starts once per spatial sample / simulation second.
 * One read is active and at most one later request is retained. */
export function createHvpWeatherReadView(loadModel:(world:string,session:string)=>Promise<Model>=createHvpCoastWeatherModel) {
  let desired:SampleRequest|undefined, frame:HvpWeatherFrame|undefined, active=false, disposed=false;
  let model:Promise<Model>|undefined, world="", session="";
  let column: {source:HvpWeatherInput["terrain"]; x:number; y:number; z:number; exposure:HvpWeatherFrame["exposure"]}|undefined;
  function localExposure(input:HvpWeatherInput):HvpWeatherFrame["exposure"] {
    const t=input.terrain;
    if(!t || t.revision!==input.revision || t.sessionId!==input.sessionId || t.epoch!==input.epoch || t.sourceDigest!==input.sourceDigest) return "Unknown";
    const x=Math.floor((input.position.x-t.originMeters.x)/t.cellMeters),
      y=Math.floor((input.position.y-t.originMeters.y)/t.cellMeters),
      z=Math.floor((input.position.z-t.originMeters.z)/t.cellMeters);
    if(column && column.source===t && column.x===x && column.y===y && column.z===z) return column.exposure;
    let exposure:HvpWeatherFrame["exposure"]="Unknown";
    if(x>=0 && x<t.sizeX && z>=0 && z<t.sizeZ && y>=0 && y<t.sizeY) {
      exposure="Open";
      for(let height=y;height<t.sizeY;height++){
        const slot=t.readSlot(x,height,z);
        if(slot===undefined){exposure="Unknown";break;}
        if(slot!==0){exposure="Sheltered";break;}
      }
    }
    column={source:t,x,y,z,exposure};
    return exposure;
  }
  const process = async (request:SampleRequest) => {
    active=true;
    try {
      const {binding,tick,x,y,z}=request;
      if(!model || binding.worldId!==world || binding.sessionId!==session) {
        world=binding.worldId; session=binding.sessionId;
        model=loadModel(world,session);
      }
      const producer=await model;
      if(disposed || desired!==request) return;
      const radius=producer.input.bundle.physics.radiusMeters;
      const direction={x:radius,y:x,z:-z};
      const altitude=Math.max(0,y);
      if(altitude>10_000) return;
      const query=trajectoryQuery(producer.input.bundle,direction,tick,altitude);
      const result=await producer.read(query);
      if(!disposed && desired===request) frame=project(binding,result,query,request.exposure);
    } catch {
      // A missing optional weather product leaves this frame unavailable.
      if(desired===request) model=undefined;
    } finally {
      active=false;
      if(!disposed && desired && desired!==request) void process(desired);
    }
  };
  return {
    update(input:HvpWeatherInput):HvpWeatherFrame|undefined {
      if(disposed) return;
      if(!input.worldId || !input.sessionId || !input.sourceDigest || !Number.isSafeInteger(input.tick) || input.tick<0 ||
          !Number.isSafeInteger(input.epoch) || input.epoch<0 || !Number.isSafeInteger(input.revision) || input.revision<0 ||
          !Number.isSafeInteger(input.tick*universeTicksPerPhysicsTick) ||
          ![input.position.x,input.position.y,input.position.z].every(Number.isFinite)) {
        desired=undefined; frame=undefined; return;
      }
      const tick=Math.floor(input.tick*universeTicksPerPhysicsTick/samplingPeriod)*samplingPeriod;
      const x=Math.round(input.position.x/4)*4, y=Math.round(input.position.y), z=Math.round(input.position.z/4)*4;
      const exposure=localExposure(input);
      if(frame && tick-frame.sampleTick>samplingPeriod) frame=undefined;
      if(!desired || !sameBinding(desired.binding,input) || exposure!==desired.exposure || desired.tick!==tick || desired.x!==x || desired.y!==y || desired.z!==z) {
        const {worldId,sessionId,epoch,revision,sourceDigest}=input;
        // An older sample may be displayed with its timestamp while the next second starts.
        // A new authority, world revision, rewind or location invalidates that sample immediately.
        if(!desired || !sameBinding(desired.binding,input) || tick<desired.tick || exposure!==desired.exposure || desired.x!==x || desired.y!==y || desired.z!==z) frame=undefined;
        desired={binding:{worldId,sessionId,epoch,revision,sourceDigest},tick,x,y,z,exposure};
        if(!active) void process(desired);
      }
      return frame;
    },
    dispose() { disposed=true;frame=undefined;desired=undefined;model=undefined; column=undefined; }
  };
}
