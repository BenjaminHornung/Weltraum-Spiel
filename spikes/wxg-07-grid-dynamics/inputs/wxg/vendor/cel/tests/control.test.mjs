import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_CELESTIAL_CATALOG as catalog } from '../dist/snapshot/product/celestial/starterSystem.js';
import { createUniverseClock, advanceUniverseTicks, convertSecondsToTicks } from '../dist/snapshot/product/persistence/time.js';
import { createBodyFixedFrameId } from '../dist/snapshot/product/spatial/ids.js';
import { q16Smoothstep, threefry2x32 } from '../vendor/plt/src/numerics.mjs';
test('unchanged celestial/Universe/Frame/PLT control',()=>{
  const h=catalog.indexes.bodyById['planet.hestia'];
  assert.equal(h.radiusMeters,8282000);assert.equal(h.rotation.rotationPeriodSeconds,129600);
  assert.deepEqual(h.atmosphere,{schemaVersion:1,hasAtmosphere:true,surfacePressurePa:145000,hazards:['HighOxygen','HighPressure','Storms']});
  assert.equal(advanceUniverseTicks(createUniverseClock(120),120).epochSeconds,2);
  assert.equal(convertSecondsToTicks(0.5,'exact'),60);
  assert.equal(createBodyFixedFrameId(h.bodyId),'frame:body-fixed.planet.hestia');
  assert.equal(q16Smoothstep(32768),32768);
  assert.deepEqual(threefry2x32([0,0],[0,0]),[0x6b200159,0x99ba4efe]);
});
