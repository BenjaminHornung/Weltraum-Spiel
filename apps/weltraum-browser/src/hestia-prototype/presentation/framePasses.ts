import type { CpuContactPass } from "../../ray/cpuContactPass";
import { composeContactPixels, type LinearContactTile, type SurfaceContactRay } from "../../ray/composeContactPixels";
import type { ThreeSubmittedFrameMetadata, ThreeSubmittedFrameSource } from "../../render/three/backend/threeRenderBackend";
import { UNIVERSE_TICKS_PER_SECOND } from "../../persistence/time";
import type { HvpWeatherBinding, HvpWeatherFrame } from "../../weather/hvpWeather";
import { HVP_PHYSICS_DT } from "../physics/tick";

export interface HvpFrameInputs extends HvpWeatherBinding {
  readonly tick: number;
  readonly weather?: HvpWeatherFrame;
  readonly contact?: HvpWeatherBinding & { readonly pass: CpuContactPass };
}

const sameBinding = (a: HvpWeatherBinding, b: HvpWeatherBinding): boolean => a.worldId === b.worldId &&
  a.sessionId === b.sessionId && a.epoch === b.epoch && a.revision === b.revision && a.sourceDigest === b.sourceDigest;

function weatherFor(inputs: HvpFrameInputs): HvpWeatherFrame | undefined {
  const weather = inputs.weather;
  if (!weather || !sameBinding(inputs, weather) || !weather.weatherSnapshotId || !Number.isSafeInteger(weather.sampleTick) ||
      weather.sampleTick < 0 || weather.sampleTick > inputs.tick * (HVP_PHYSICS_DT * UNIVERSE_TICKS_PER_SECOND) ||
      weather.windMps.length !== 3 || !weather.windMps.every(Number.isFinite) || !Number.isFinite(weather.extinctionPerM) || weather.extinctionPerM < 0 ||
      ![weather.rain01, weather.snow01, weather.cloudCoverage].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) return;
  return weather;
}

/** The renderer stages one input binding. Only G1's submission of that same draw can publish it. */
export function createHvpFramePasses(readInputs: () => HvpFrameInputs | undefined,
  readFrames: () => ThreeSubmittedFrameSource | undefined) {
  let staged: HvpFrameInputs | undefined, source: ThreeSubmittedFrameSource | undefined;
  let published: ThreeSubmittedFrameMetadata | undefined;
  let disposed = false;
  const reset = (): void => {
    staged = undefined; source = undefined; published = undefined;
  };
  const current = () => {
    if (!published || !staged || !source || readFrames() !== source || !source.isSubmittedFrameCurrent(published) ||
        source.isSubmittedViewUnchanged?.(published) === false) return;
    const input = readInputs();
    if (!input || !sameBinding(staged, input) || input.tick !== staged.tick || input.weather !== staged.weather ||
        input.contact?.pass !== staged.contact?.pass || (input.contact && staged.contact && !sameBinding(input.contact, staged.contact))) return;
    return { input, frame: published };
  };
  return {
    beginDraw() {
      reset();
      if (disposed) return;
      const input = readInputs();
      if (!input || !Number.isSafeInteger(input.tick) || input.tick < 0) return;
      staged = { ...input, contact: input.contact && { ...input.contact } };
      source = readFrames();
      const weather = weatherFor(input);
      if (weather) return { weather, tick: input.tick };
    },
    confirmDraw(frame: ThreeSubmittedFrameMetadata): void {
      if (staged && source === readFrames() && source?.isSubmittedFrameCurrent(frame)) published = frame;
    },
    readSubmitted() {
      const result = current();
      if (result) return { frame: result.frame, weather: weatherFor(result.input) };
    },
    composeContact(tile: LinearContactTile, surfaces: readonly SurfaceContactRay[]): Float32Array {
      const result = current(), contact = result?.input.contact;
      if (!result || result.frame !== tile.frame || !contact || !sameBinding(result.input, contact)) return tile.raster;
      const pixels = composeContactPixels(contact.pass, tile, surfaces);
      const final = current();
      return final?.frame === tile.frame && final.input.contact && sameBinding(final.input, final.input.contact) ? pixels : tile.raster;
    },
    reset,
    dispose(): void { disposed = true; reset(); }
  };
}

export type HvpFramePasses = ReturnType<typeof createHvpFramePasses>;
