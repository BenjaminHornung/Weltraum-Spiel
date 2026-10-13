import test from 'node:test';
import assert from 'node:assert/strict';
import {createSingleFlight} from '../.runtime/init.mjs';
test('re-entered async init is single-flight and late value disposed before parent renderer',async()=>{
 let finish,calls=0,disposals=0;const flight=createSingleFlight(async signal=>{calls++;return new Promise(resolve=>{finish=()=>resolve({dispose(){disposals++;}});});});
 const first=flight.load(),second=flight.load();assert.equal(first,second);await Promise.resolve();assert.equal(calls,1);
 let rendererDisposed=false;const dispose=flight.dispose().then(()=>{rendererDisposed=true;});assert.equal(rendererDisposed,false);
 finish();await assert.rejects(first,/CANCELLED/);await dispose;assert.equal(disposals,1);assert.equal(rendererDisposed,true);assert.equal(flight.busy,false);
 await assert.rejects(flight.load(),/DISPOSED/);
});
test('successful async resource is retained once and disposed once',async()=>{
 let calls=0,disposals=0;const flight=createSingleFlight(async()=>{calls++;return {dispose(){disposals++;}};});
 const a=await flight.load(),b=await flight.load();assert.equal(a,b);assert.equal(calls,1);
 await flight.dispose();await flight.dispose();assert.equal(disposals,1);
});
