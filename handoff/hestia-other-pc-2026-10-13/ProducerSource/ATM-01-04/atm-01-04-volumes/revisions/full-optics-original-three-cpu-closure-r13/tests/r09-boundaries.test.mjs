import test from 'node:test';
import assert from 'node:assert/strict';
import {integrate,composeWater,shellInterval,validateFrame} from '../.runtime/optics.mjs';
import {firstSolid} from '../.runtime/occlusion.mjs';
const empty={T:1,L:[0,0,0]},bg=[1,1,1],water=[0,0,0];
test('water contract rejects invalid segment transmittance/radiance rather than propagating NaN',()=>{
 for(const bad of [{T:NaN,L:[0,0,0]},{T:1.1,L:[0,0,0]},{T:1,L:[0,-1,0]},{T:1,L:[0,,0]}])
  assert.throws(()=>composeWater(bad,empty,bg,water,0.56));
});
test('shell requires a strictly positive thickness at planetary meter scale',()=>{
 assert.throws(()=>shellInterval([0,0,1100],[0,0,-1],1000,1000));
});
test('occluder contract rejects malformed vectors including holes',()=>{
 const box={id:'roof',min:[-1,4,-1],max:[1,5,1]};
 assert.throws(()=>firstSolid([0,1],[0,1,0],[box],10));
 assert.throws(()=>firstSolid([0,1,0],[0,1,0],[{...box,min:[-1,, -1]}],10));
});
test('parallel slab rays outside either face miss, face and inside rays hit',()=>{
 const box={id:'roof',min:[-1,4,-1],max:[1,5,1]};
 assert.equal(firstSolid([-2,0,0],[0,1,0],[box],10),null);
 assert.equal(firstSolid([2,0,0],[0,1,0],[box],10),null);
 assert.equal(firstSolid([-1,0,0],[0,1,0],[box],10),4);
 assert.equal(firstSolid([0,4.5,0],[0,1,0],[box],10),0);
});
test('opaque surface clips shell and density monotonicity survives long segments',()=>{
 assert.deepEqual(shellInterval([0,0,1010],[0,0,-1],1000,2000),[0,10]);
 assert.equal(shellInterval([0,0,1000],[0,0,-1],1000,2000),null);
 assert.ok(integrate(()=>1e-6,1e6,128,[1,1,1]).T>integrate(()=>2e-6,1e6,128,[1,1,1]).T);
});

