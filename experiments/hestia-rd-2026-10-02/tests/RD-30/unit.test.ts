import { describe, expect, it } from 'vitest';
import { WEATHER_PRESETS, createWeatherPreset, exportWeatherPreset, importWeatherPreset, sampleWeatherAt } from '../../src/experiments/weather-field';
import { createControlledClock } from '../../src/contracts/scenario';

describe('RD-30 bounded presentation weather', () => {
  it('WEA01 identical seed/place/tick and reversed query order preserve all samples', () => {
    const preset = WEATHER_PRESETS['gust-rain'];
    const positions = [[0, 0, 0], [10, 2, -3], [-5, 0, 6]] as const;
    const first = positions.map((p) => sampleWeatherAt(p, 450, preset));
    expect([...positions].reverse().map((p) => sampleWeatherAt(p, 450, preset)).reverse()).toEqual(first);
    expect(WEATHER_PRESETS.clear.rain01).toBe(0);
    expect(first[0].rain01).toBeGreaterThan(0);
  });
  it('WEA02 invalid time/position/intensity/unknown fields/local-source count reject without mutation', () => {
    const preset = WEATHER_PRESETS.rain; const before = exportWeatherPreset(preset);
    expect(() => sampleWeatherAt([NaN, 0, 0], 0, preset)).toThrow();
    for (const tick of [-1, NaN, 1.5, Infinity]) expect(() => sampleWeatherAt([0, 0, 0], tick, preset)).toThrow();
    expect(() => createWeatherPreset({ ...preset, rain01: 1.01 })).toThrow();
    expect(() => createWeatherPreset({ ...preset, forces: true })).toThrow();
    const source = { positionMeters: [0, 0, 0], radiusMeters: 10, windMps: [1, 0, 0] };
    expect(() => createWeatherPreset({ ...preset, localSources: Array(5).fill(source) })).toThrow();
    expect(() => importWeatherPreset(new TextEncoder().encode(before.replace('hestia-rd-weather-v1', 'v0')))).toThrow();
    expect(exportWeatherPreset(preset)).toBe(before);
  });
  it('WEA03 pause/seek/reset, gust endpoints and presentation-origin shifts preserve world phase', () => {
    const clock = createControlledClock(1200); const preset = WEATHER_PRESETS['gust-rain'];
    clock.seek(450); clock.pause(true);
    const paused = sampleWeatherAt([4, 0, 3], clock.read().tick, preset);
    clock.advance(60); expect(sampleWeatherAt([4, 0, 3], clock.read().tick, preset)).toEqual(paused);
    expect(sampleWeatherAt([-996, 0, 3], 450, preset, [1000, 0, 0])).toEqual(paused);
    clock.seek(900); clock.seek(450); expect(sampleWeatherAt([4, 0, 3], clock.read().tick, preset)).toEqual(paused);
    clock.reset(); expect(clock.read().tick).toBe(0);
    expect(sampleWeatherAt([4, 0, 3], preset.gust.startTick, preset).windMps).toEqual(preset.windMps);
    expect(sampleWeatherAt([4, 0, 3], preset.gust.endTick, preset).windMps).toEqual(preset.windMps);
  });
  it('WEA04 immutable presentation data, no body/save effects, stable validated preset roundtrip', () => {
    for (const preset of Object.values(WEATHER_PRESETS)) {
      const before = exportWeatherPreset(preset);
      const sample = sampleWeatherAt([0, 0, 0], 300, preset);
      expect(Object.keys(sample).sort()).toEqual(['cloud01', 'rain01', 'snow01', 'windMps']);
      expect(Object.isFrozen(sample.windMps)).toBe(true);
      expect(exportWeatherPreset(importWeatherPreset(new TextEncoder().encode(before)))).toBe(before);
      expect(exportWeatherPreset(preset)).toBe(before);
    }
  });
});
