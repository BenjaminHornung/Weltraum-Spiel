import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeNumbers,decodeNumbers,threefry2x32} from '../inputs/plt/src/numerics.mjs';
import {UNIVERSE_TICKS_PER_SECOND,createSimulationTick} from '../inputs/plt/snapshot/time.mjs';
test('historic PLT golden, LE numeric codec and actual Universe time control',()=>{
  assert.deepEqual(threefry2x32([0,0],[0,0]),[0x6b200159,0x99ba4efe]);
  const v={u32:32,tick:7*86400*120,f64:8282000};assert.deepEqual(decodeNumbers(encodeNumbers(v)),v);
  assert.equal(UNIVERSE_TICKS_PER_SECOND,120);assert.equal(createSimulationTick(v.tick),v.tick);
  assert.throws(()=>createSimulationTick(NaN));assert.throws(()=>decodeNumbers(new Uint8Array(24)));
});
