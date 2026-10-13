import test from 'node:test';
import assert from 'node:assert/strict';
test('preimplementation control: bounded F2 kernel exists',async()=>{const m=await import('../dist/f2.js');assert.equal(typeof m.createF2,'function');});
