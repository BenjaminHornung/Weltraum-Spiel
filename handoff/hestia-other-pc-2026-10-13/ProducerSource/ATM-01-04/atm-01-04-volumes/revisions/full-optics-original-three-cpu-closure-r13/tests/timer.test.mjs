import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiagnosticTimer} from '../.runtime/timer.mjs';
test('unsupported timer has no zero measurement and executes work',()=>{
 const timer=createDiagnosticTimer(null);assert.equal(timer.measure('work',()=>7),7);
 assert.equal(timer.read().status,'UNAVAILABLE');assert.deepEqual(timer.read().results,[]);timer.dispose();
});
test('supplemental fake GL checks finite query cap, disjoint null and teardown',()=>{
 let created=0,deleted=0,disjoint=false;
 const gl={QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,getExtension:()=>({TIME_ELAPSED_EXT:3,GPU_DISJOINT_EXT:4}),createQuery:()=>({id:created++}),beginQuery(){},endQuery(){},
  getParameter:()=>disjoint,getQueryParameter:(q,key)=>key===1?true:2500000,deleteQuery(){deleted++;}};
 const timer=createDiagnosticTimer(gl);for(let i=0;i<50;i++)timer.measure('pass',()=>{});timer.poll();
 assert.equal(created,48);assert.equal(deleted,48);assert.equal(timer.read().results[0].milliseconds,2.5);timer.dispose();
 const other=createDiagnosticTimer(gl);other.measure('pass',()=>{});disjoint=true;other.poll();assert.equal(other.read().results[0].milliseconds,null);other.dispose();
});
