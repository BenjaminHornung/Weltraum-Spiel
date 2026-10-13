import test from 'node:test';
import assert from 'node:assert/strict';
import {background} from '../scripts/read-port.mjs';
test('frozen real W1 port same-tick read is immutable and exact',async()=>{const {view,result,input}=await background();assert.equal(result.status,'Known');assert.deepEqual(await view.read(input.bundle.query),result);assert.ok(Object.isFrozen(view.input));});
test('original Hestia lacks chemistry and remains Unsupported',async()=>{const {result}=await background(0);assert.equal(result.status,'Unsupported');});
