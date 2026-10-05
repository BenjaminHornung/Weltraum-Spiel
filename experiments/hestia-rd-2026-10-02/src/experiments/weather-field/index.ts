import type { LabWeatherSample } from '../../contracts/experiment';
import type { Vec3 } from '../../contracts/fixture';
import { array, canonicalJson, finite, freezeJson, id, integer, keys, parseBoundedJson, requireValue, vector } from '../../contracts/validation';
import clearJson from './presets/clear.json?raw';
import breezeJson from './presets/breeze.json?raw';
import rainJson from './presets/rain.json?raw';
import gustRainJson from './presets/gust-rain.json?raw';

export interface WeatherPreset {
  readonly schema: 'hestia-rd-weather-v1'; readonly id: string; readonly seed: number;
  readonly windMps: Vec3; readonly rain01: number; readonly cloud01: number;
  readonly gust: { readonly startTick: number; readonly endTick: number; readonly amplitudeMps: number; readonly periodTicks: number };
  readonly localSources: readonly { readonly positionMeters: Vec3; readonly radiusMeters: number; readonly windMps: Vec3 }[];
}
const validated = new WeakSet<WeatherPreset>();

export function createWeatherPreset(input: unknown): WeatherPreset {
  keys(input, ['schema', 'id', 'seed', 'windMps', 'rain01', 'cloud01', 'gust', 'localSources']);
  const preset = input as WeatherPreset;
  requireValue(preset.schema === 'hestia-rd-weather-v1', 'Unsupported weather preset version');
  id(preset.id); integer(preset.seed); requireValue(preset.seed <= 0xffffffff, 'Seed exceeds uint32');
  vector(preset.windMps); requireValue(Math.hypot(...preset.windMps) <= 60, 'Lab wind exceeds 60 m/s');
  finite(preset.rain01, 0, 1); finite(preset.cloud01, 0, 1);
  keys(preset.gust, ['startTick', 'endTick', 'amplitudeMps', 'periodTicks']);
  integer(preset.gust.startTick); integer(preset.gust.endTick);
  requireValue(preset.gust.endTick > preset.gust.startTick, 'Empty gust interval');
  finite(preset.gust.amplitudeMps, 0, 20); integer(preset.gust.periodTicks, 1);
  array(preset.localSources); requireValue(preset.localSources.length <= 4, 'At most four local weather sources');
  for (const source of preset.localSources) {
    keys(source, ['positionMeters', 'radiusMeters', 'windMps']); vector(source.positionMeters); vector(source.windMps);
    finite(source.radiusMeters, 0.125, 1000); requireValue(Math.hypot(...source.windMps) <= 20, 'Local wind exceeds 20 m/s');
  }
  const result = freezeJson(JSON.parse(canonicalJson(preset)) as WeatherPreset);
  validated.add(result); return result;
}

export const WEATHER_PRESETS: Readonly<Record<'clear' | 'breeze' | 'rain' | 'gust-rain', WeatherPreset>> = Object.freeze({
  clear: createWeatherPreset(JSON.parse(clearJson)), breeze: createWeatherPreset(JSON.parse(breezeJson)),
  rain: createWeatherPreset(JSON.parse(rainJson)), 'gust-rain': createWeatherPreset(JSON.parse(gustRainJson)),
});

/** Presentation only. Position and optional render origin reconstruct the same absolute world frame. */
export function sampleWeatherAt(positionMeters: Vec3, tick: number, preset: WeatherPreset, renderOriginMeters: Vec3 = [0, 0, 0]): LabWeatherSample {
  requireValue(validated.has(preset), 'Weather preset must pass validation');
  vector(positionMeters); vector(renderOriginMeters); integer(tick);
  const x = positionMeters[0] + renderOriginMeters[0], y = positionMeters[1] + renderOriginMeters[1], z = positionMeters[2] + renderOriginMeters[2];
  requireValue([x, y, z].every(Number.isFinite), 'World position overflow');
  const { gust } = preset;
  const progress = (tick - gust.startTick) / (gust.endTick - gust.startTick);
  const envelope = progress <= 0 || progress >= 1 ? 0 : Math.sin(Math.PI * progress) ** 2;
  const phase = tick / gust.periodTicks * Math.PI * 2 + preset.seed * 0.013 + x * 0.07 + z * 0.11;
  const strength = envelope * gust.amplitudeMps * (0.5 + 0.5 * Math.sin(phase));
  const wind = [preset.windMps[0] + strength, preset.windMps[1], preset.windMps[2] + strength * 0.35];
  for (const local of preset.localSources) {
    const falloff = Math.max(0, 1 - Math.hypot(x - local.positionMeters[0], y - local.positionMeters[1], z - local.positionMeters[2]) / local.radiusMeters);
    for (let axis = 0; axis < 3; axis += 1) wind[axis] += local.windMps[axis] * falloff * falloff;
  }
  return freezeJson({ windMps: wind as unknown as Vec3, rain01: preset.rain01, cloud01: preset.cloud01, snow01: 0 });
}

export function importWeatherPreset(bytes: Uint8Array): WeatherPreset { return createWeatherPreset(parseBoundedJson(bytes)); }
export function exportWeatherPreset(preset: WeatherPreset): string {
  requireValue(validated.has(preset), 'Weather preset must pass validation'); return canonicalJson(preset);
}
