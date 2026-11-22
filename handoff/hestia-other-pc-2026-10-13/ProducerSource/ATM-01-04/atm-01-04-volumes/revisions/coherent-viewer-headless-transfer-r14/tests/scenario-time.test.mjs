import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaybackTickReader, scenarioTime, scenarioTickFromSource} from '../src/scenario-time.ts';
import {applyWindInputs, createWetnessPreset, DEFAULT_WETNESS_PRESET, sampleAnalyticWetness} from '../.r14-runtime-r02/reuse.mjs';

test('elapsed Universe ticks drive one second of the existing RD wind and wetness models', () => {
  const epoch = Number.MAX_SAFE_INTEGER - 1000;
  const rdTick = scenarioTickFromSource(epoch + 120, epoch, 120);
  assert.deepEqual(scenarioTime(rdTick), {tick:60, seconds:1});
  assert.equal(scenarioTickFromSource(epoch + 121, epoch, 120), 60);
  const weather = {windMps:[7,0,-2], rain01:1, cloud01:1, snow01:0};
  const wind = tick => applyWindInputs('w1.tree', tick, 0.4, weather, [0,0,0,1]);
  assert.ok(Math.abs(wind(rdTick).phase - wind(0).phase - 1.8) < 1e-12);
  const wet = createWetnessPreset({...DEFAULT_WETNESS_PRESET, rainHistory:[{tick:0,rain01:1}]});
  assert.equal(sampleAnalyticWetness(wet, rdTick, 0, 'exposed').wetness01, wet.wettingPerSecond);
  assert.equal(sampleAnalyticWetness(wet, rdTick, rdTick, 'exposed').wetness01, 0);
});

test('the same playback time yields the same RD tick at different refresh rates', () => {
  for (const hz of [30,60,120,144]) {
    const advance=createPlaybackTickReader();
    for (let i=0;i<=hz;i++) advance(5000+i*1000/hz);
    assert.equal(advance(6000),60);
  }
  const advance=createPlaybackTickReader();
  assert.equal(advance(0),0);
  assert.equal(advance(500),30);
  assert.equal(advance(650,true),30);
  assert.equal(advance(10000,true),30);
  assert.equal(advance(11000),30);
  assert.equal(advance(11500),60);
  assert.throws(()=>advance(11499), RangeError);
});

test('conversion respects the source rate, pre-epoch bounds and safe integer range', () => {
  assert.equal(scenarioTickFromSource(1250, 1000, 1000),15);
  assert.equal(scenarioTickFromSource(1000, 1000, 120),0);
  assert.equal(scenarioTickFromSource(Number.MAX_SAFE_INTEGER,0,120),Math.floor(Number.MAX_SAFE_INTEGER/2));
  for(const args of [[99,100,120],[3,0,0],[1.5,0,120],[1,-1,120],[3,0,Infinity],[Number.MAX_SAFE_INTEGER,0,1]]) {
    assert.throws(()=>scenarioTickFromSource(...args),RangeError);
  }
  for(const value of [-1,NaN,1.5]) assert.throws(()=>scenarioTime(value), RangeError);
  assert.throws(()=>createPlaybackTickReader()(NaN),RangeError);
});
