import assert from 'node:assert/strict';
import test from 'node:test';
import {PhotoSession} from '../src/session.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function setup(){const calls=[];let count=0;const driver={reset:()=>{count=0;calls.push('reset');},resize:(w,h)=>calls.push(['resize',w,h]),sample:async()=>({min:++count,max:count,avg:count}),dispose:()=>calls.push('dispose')};return {driver,calls,s:new PhotoSession(driver,'initial')};}
test('MOCK_DRIVER: finite 32/128/512 per-pixel spp; same binding does not reset',async()=>{
 const {s,calls}=setup();assert.throws(()=>s.start(31));s.start(32);for(let i=0;i<32;i++)await s.step();assert.equal(s.state,'complete');assert.equal(s.samples.min,32);assert.equal(s.invalidate('initial'),false);assert.equal(calls.length,0);
 for(const spp of [128,512]){s.start(spp);while(s.state==='running')await s.step();assert.equal(s.samples.min,spp);}await s.dispose();
});
test('MOCK_DRIVER: every snapshot dimension invalidates accumulated samples',async()=>{
 for(const kind of ['source','geometry','material','light','camera','frame']){const {s,calls}=setup();s.start(32);await s.step();assert.equal(s.invalidate(kind),true);assert.equal(s.samples.min,0);assert.equal(s.state,'ready');assert.deepEqual(calls,['reset']);await s.dispose();}
});
test('MOCK_DRIVER: cancel rejects late sample and needs explicit restart',async()=>{
 const {s,driver}=setup(),d=deferred();driver.sample=()=>d.promise;s.start(32);const p=s.step();s.cancel();d.resolve({min:32,max:32,avg:32});assert.equal(await p,false);assert.equal(s.state,'cancelled');assert.equal(s.samples.min,0);await s.dispose();
});
test('MOCK_DRIVER: resize validates size, resets and rejects in-flight result',async()=>{
 const {s,driver,calls}=setup(),d=deferred();assert.throws(()=>s.resize(0,20));assert.throws(()=>s.resize(8193,20));driver.sample=()=>d.promise;s.start(32);const p=s.step();s.resize(640,360);d.resolve({min:32,max:32,avg:32});assert.equal(await p,false);await s.settled();assert.equal(s.state,'ready');assert.ok(calls.some(x=>Array.isArray(x)&&x[0]==='resize'));await s.dispose();
});
test('MOCK_DRIVER: loss and idempotent disposal wait for pending readback',async()=>{
 for(const action of ['deviceLost','dispose']){const {s,driver,calls}=setup(),d=deferred();driver.sample=()=>d.promise;s.start(32);const p=s.step();const cleanup=s[action]();assert.equal(calls.includes('dispose'),false);d.resolve({min:1,max:1,avg:1});assert.equal(await p,false);await cleanup;assert.equal(calls.filter(c=>c==='dispose').length,1);assert.throws(()=>s.start(32));await s.dispose();assert.equal(calls.filter(c=>c==='dispose').length,1);}
});
test('MOCK_DRIVER: rejection and invalid count fail closed; concurrent sample rejected',async()=>{
 for(const sample of [async()=>{throw Error('readback');},async()=>({min:NaN,max:1,avg:1})]){const {s,driver}=setup();driver.sample=sample;s.start(32);await assert.rejects(s.step());assert.equal(s.state,'error');await s.dispose();}
 const {s,driver}=setup(),d=deferred();driver.sample=()=>d.promise;s.start(32);const p=s.step();await assert.rejects(s.step(),/pending/);d.resolve({min:1,max:1,avg:1});await p;await s.dispose();
});
