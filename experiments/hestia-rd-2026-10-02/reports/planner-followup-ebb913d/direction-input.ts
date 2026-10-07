import { sampleCombined as originalSample } from '../../src/qa/combined-scene/scenario';
import { createWeatherPreset, sampleWeatherAt, WEATHER_PRESETS } from '../../src/experiments/weather-field';
import { createFrameInput } from '../../src/contracts/experiment';
import { freezeJson } from '../../src/contracts/validation';

/** Explicit test input: same rain/history/populations, actual continuous wind/rain direction changes. */
export const directionPreset = createWeatherPreset({ ...WEATHER_PRESETS.rain, id: 'followup-direction-gust',
  gust: { startTick: 240, endTick: 1320, amplitudeMps: 4, periodTicks: 120 } });
export function sampleCombined(...args: Parameters<typeof originalSample>) {
  const sample = originalSample(...args);
  if (sample.weatherId !== 'rain') return sample;
  return freezeJson({ ...sample, frame: createFrameInput({ ...sample.frame,
    weather: sampleWeatherAt([2, 1, 2], sample.frame.tick, directionPreset) }) });
}
