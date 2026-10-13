import test from 'node:test';import assert from 'node:assert/strict';import {PhotoSession} from '../src/session.mjs';import {awaitReadback,resizePhoto,photoDeadline} from '../src/photo-operations.mjs';
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
