import test from 'node:test';import assert from 'node:assert/strict';import {PhotoSession} from '../src/session.mjs';import {awaitReadback,resizePhoto,photoDeadline,cleanupPhoto} from '../src/photo-operations.mjs';
test('review regression MOCK_DRIVER: complete photo -> queued resize -> UI start reenabled -> new capture',async()=>{
 let count=0;const s=new PhotoSession({reset(){count=0;},resize(){},sample:async()=>({min:++count,max:count,avg:count}),dispose(){}},'snapshot');s.start(32);while(s.state==='running')await s.step();
 const buttons=[];await resizePhoto(s,640,360,()=>buttons.push({disabled:s.busy||!['ready','complete','cancelled'].includes(s.state)}));assert.equal(buttons[0].disabled,true);assert.equal(buttons.at(-1).disabled,false);s.start(32);await s.step();assert.equal(s.samples.min,1);await s.dispose();
});
test('review regression MOCK_DRIVER: independent deadline bounds never-resolving readback and disposal',async()=>{
 const controller=new AbortController();let disposed=0,reported=0;
 const s=new PhotoSession({reset(){},resize(){},sample:()=>awaitReadback(new Promise(()=>{}),controller.signal),dispose(){disposed++;}},'snapshot');s.start(32);const pending=s.step();
 const stop=photoDeadline(s,()=>controller.abort(),()=>reported++,10);assert.equal(await pending,false);await s.settled();await new Promise(r=>setTimeout(r,0));assert.equal(s.state,'lost');assert.equal(disposed,1);assert.equal(reported,1);stop();await s.dispose();assert.equal(disposed,1);
});
test('MOCK_DRIVER: explicit disposed phase before readback interruption; no late adoption',async()=>{
 const controller=new AbortController();let disposed=0;const s=new PhotoSession({reset(){},resize(){},sample:()=>awaitReadback(new Promise(()=>{}),controller.signal),dispose(){disposed++;}},'snapshot');s.start(32);const p=s.step();const cleanup=s.dispose();controller.abort();assert.equal(await p,false);await cleanup;assert.equal(disposed,1);assert.equal(s.state,'disposed');
});

function caught(action){let threw=false,value;try{action();}catch(error){threw=true;value=error;}return {threw,value};}
function mocks(order,failures){const calls=[],errors=Object.fromEntries(order.map(name=>[name,Error('cleanup '+name)]));const cleanups=order.map(name=>()=>{calls.push(name);if(Object.hasOwn(failures,name))throw failures[name];});return {calls,errors,cleanups};}
const normalOrder=['device','tracer','resources','renderer'],failedOrder=['tracer','resources','renderer','device'];
for(const order of [normalOrder,failedOrder])for(const failed of order)test('REAL_HELPER MOCK_RESOURCE '+order.join('->')+': '+failed+' throws, all attempts exactly once',()=>{
 const error=Error(failed),m=mocks(order,{[failed]:error}),result=caught(()=>cleanupPhoto(m.cleanups));assert.deepEqual(m.calls,order);assert.equal(result.threw,true);assert.equal(result.value,error);
});
for(const primary of [Error('initialization'),null,undefined])for(const failed of failedOrder)test('REAL_HELPER preserves primary '+String(primary)+' and '+failed+' cleanup error',()=>{
 const error=Error(failed),m=mocks(failedOrder,{[failed]:error}),result=caught(()=>cleanupPhoto(m.cleanups,primary));assert.deepEqual(m.calls,failedOrder);assert.equal(result.threw,true);assert.ok(result.value instanceof AggregateError);assert.equal(result.value.cause,primary);assert.deepEqual(result.value.errors,[primary,error]);
});
for(const primary of [Error('initialization'),null,undefined,false,0,''])test('REAL_HELPER successful cleanup rethrows exact primary '+String(primary),()=>{
 const m=mocks(failedOrder,{}),result=caught(()=>cleanupPhoto(m.cleanups,primary));assert.deepEqual(m.calls,failedOrder);assert.equal(result.threw,true);assert.equal(result.value,primary);
});
for(const value of [null,undefined,false,0,''])test('REAL_HELPER single cleanup thrown '+String(value)+' is never a no-error sentinel',()=>{
 const m=mocks(normalOrder,{device:value}),result=caught(()=>cleanupPhoto(m.cleanups));assert.equal(result.threw,true);assert.equal(result.value,value);assert.deepEqual(m.calls,normalOrder);
});
test('REAL_HELPER normal success returns undefined and attempts original order once',()=>{
 const m=mocks(normalOrder,{});assert.equal(cleanupPhoto(m.cleanups),undefined);assert.deepEqual(m.calls,normalOrder);assert.equal(cleanupPhoto([]),undefined);
});
test('REAL_HELPER all cleanup errors aggregate once in deterministic attempt order',()=>{
 const failures={device:null,tracer:undefined,resources:Error('resources'),renderer:'renderer'},m=mocks(normalOrder,failures),result=caught(()=>cleanupPhoto(m.cleanups));assert.deepEqual(m.calls,normalOrder);assert.ok(result.value instanceof AggregateError);assert.equal(result.value.cause,null);assert.deepEqual(result.value.errors,normalOrder.map(name=>failures[name]));
});
test('REAL_HELPER primary precedes every cleanup error including null undefined',()=>{
 const primary=undefined,failures={tracer:null,resources:undefined,renderer:Error('renderer'),device:'device'},m=mocks(failedOrder,failures),result=caught(()=>cleanupPhoto(m.cleanups,primary));assert.deepEqual(m.calls,failedOrder);assert.ok(result.value instanceof AggregateError);assert.equal(result.value.cause,primary);assert.deepEqual(result.value.errors,[primary,...failedOrder.map(name=>failures[name])]);
});
test('REAL_HELPER original optional absent resources are no-op steps, later present resources still attempted',()=>{
 let calls=0;const missing=undefined;cleanupPhoto([()=>missing?.dispose(),()=>{calls++;}]);assert.equal(calls,1);
});
test('REAL_HELPER with actual PhotoSession: failing driver cleanup attempted once despite repeated terminal requests',async()=>{
 const failure=Error('device'),m=mocks(normalOrder,{device:failure}),s=new PhotoSession({reset(){},resize(){},sample:async()=>({min:1,max:1,avg:1}),dispose(){cleanupPhoto(m.cleanups);}},'snapshot');
 const first=s.dispose();let threw=false,value;try{await first;}catch(error){threw=true;value=error;}assert.equal(threw,true);assert.equal(value,failure);assert.equal(s.dispose(),first);await first.catch(()=>{});assert.deepEqual(m.calls,normalOrder);assert.equal(s.state,'disposed');
});
