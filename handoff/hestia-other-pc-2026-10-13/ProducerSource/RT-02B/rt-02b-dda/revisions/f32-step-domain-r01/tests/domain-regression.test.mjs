// NOT_RUN. Needs separately authorized serial CPU execution; receiver cases require candidate overlay.
import assert from 'node:assert/strict';
import test from 'node:test';
import {assessGpuTrialDomain} from '../candidate/eligibility.mts';
import {createSparseVolume} from '../../../src/sparse.mts';
import {packRays} from '../../../src/gpu.mts';
import {analyticalVolume,bindSource,setCell} from '../../../imported/rt01/fixtures.mjs';
import {traceBruteForce} from '../../../imported/rt01/src/bruteForce.mts';

const ray = (origin, direction = [1,0,0], maxSteps = 256, maxDistance = 8) =>
  ({id:'r01-supplemental',origin,direction,maxSteps,maxDistance});
const make = (size=[4,1,1], id='r01-face') => {
  const v=analyticalVolume(.125,size,id);v.origin=[0,0,0];return bindSource(v);
};
const expectsUnsupported = (fn, reason) => assert.throws(fn,e=>e.status==='UNSUPPORTED'&&e.reason===reason);

test('bound source domain separates256iterations from256/257 logical maxSteps',async()=>{
  const v=make([64,1,1],'r01-budget');setCell(v,[63,0,0],1);const s=await createSparseVolume(v,v.binding);
  try {
    assert.deepEqual(assessGpuTrialDomain(v.size,.125,[.5,.5,.5],[8,0,0],8),
      {status:'ELIGIBLE_FOR_FUNCTIONAL_TRIAL',shaderIterations:256,cellIntervalBound:64,conservativeIterationBound:69});
    for(const steps of [256,257]) {
      const r=ray([.0625,.0625,.0625],[1,0,0],steps),expected=traceBruteForce(v,r);
      assert.equal(expected.kind,'Hit');assert.equal(expected.distance,7.8125);
      assert.deepEqual(expected.cell,[63,0,0]);assert.equal(expected.materialId,1);
      for(const mode of ['flat','two-level'])assert.deepEqual(s.traceFrozen(r,v.binding,mode).result,expected);
      assert.equal(new DataView(packRays(s,[r],true)).getUint32(32,true),steps,'Do not clamp257 to256');
    }
    const zero=traceBruteForce(v,ray([.0625,.0625,.0625],[1,0,0],0));
    assert.equal(zero.kind,'BudgetExceeded');assert.deepEqual(zero.cell,[0,0,0]);
  } finally {s.dispose();}
});

test('near-face f64 owners cannot be silently merged by the actual Float32 receiver',async()=>{
  const v=make();setCell(v,[0,0,0],1);setCell(v,[1,0,0],2);const s=await createSparseVolume(v,v.binding);
  try {
    for(const [q,sign,material,cell] of [[1-2**-26,1,1,0],[1+2**-26,-1,2,1]]) {
      const r=ray([q*.125,.0625,.0625],[sign,0,0]),expected=traceBruteForce(v,r);
      assert.equal(Math.fround(q),1,'Analytical f32 collision');
      assert.equal(expected.kind,'Hit');assert.equal(expected.distance,0);
      assert.deepEqual(expected.cell,[cell,0,0]);assert.equal(expected.materialId,material);
      assert.deepEqual(s.traceFrozen(r,v.binding).result,expected);
      expectsUnsupported(()=>packRays(s,[r],true),'NON_DYADIC_GRID_ORIGIN');
    }
  } finally {s.dispose();}
});

test('near-tie CPU side cell and Y normal remain exact; noGPU tie tolerance widening',async()=>{
  const v=make([3,3,1],'r01-tie'),delta=2**-27,inv=1/Math.sqrt(2);
  setCell(v,[0,1,0],2);setCell(v,[1,1,0],3);const s=await createSparseVolume(v,v.binding);
  try {
    const r=ray([.0625,(.5+delta)*.125,.0625],[inv,inv,0]),expected=traceBruteForce(v,r);
    assert.equal(Math.fround(.5+delta),.5);
    assert.equal(expected.kind,'Hit');assert.deepEqual(expected.cell,[0,1,0]);
    assert.equal(expected.materialId,2);assert.deepEqual(expected.normal,[0,-1,0]);
    assert.ok(Math.abs(expected.distance-(.5-delta)*.125*Math.sqrt(2))<=1e-9);
    assert.deepEqual(s.traceFrozen(r,v.binding).result,expected);
    assert.equal(assessGpuTrialDomain(v.size,.125,[.5,.5,.5],[inv*8,inv*8,0],8).reason,'NON_AXIAL_OR_UNPROVEN_TIE_DOMAIN');
    assert.throws(()=>packRays(s,[r],true),e=>e.status==='UNSUPPORTED');
  } finally {s.dispose();}
});

test('negative grid frame, start-inside and zero axes retain the original oracle',async()=>{
  const v=make([4,1,1],'r01-negative');v.origin=[-.5,0,0];bindSource(v);setCell(v,[1,0,0],2);
  const s=await createSparseVolume(v,v.binding);
  try {
    for(const r of [ray([-.3125,.0625,.0625]),ray([-.25,.0625,.0625],[-1,0,0])]) {
      const expected=traceBruteForce(v,r);assert.equal(expected.kind,'Hit');assert.equal(expected.distance,0);
      assert.deepEqual(expected.cell,[1,0,0]);assert.deepEqual(expected.normal,[0,0,0]);
      for(const mode of ['flat','two-level'])assert.deepEqual(s.traceFrozen(r,v.binding,mode).result,expected);
    }
    assert.throws(()=>packRays(s,[ray([0,0,0],[0,0,0])],true),/Invalid/,'Whole-zero ray stays invalid');
  } finally {s.dispose();}
});

test('exact three-axis corner preserves diagonal hit and X-normal priority',async()=>{
  const v=make([3,3,3],'r01-corner');setCell(v,[1,0,0],2);setCell(v,[1,1,1],3);
  const s=await createSparseVolume(v,v.binding);
  try {
    const k=1/Math.sqrt(3),r=ray([.0625,.0625,.0625],[k,k,k]),expected=traceBruteForce(v,r);
    assert.equal(expected.kind,'Hit');assert.deepEqual(expected.cell,[1,1,1]);assert.equal(expected.materialId,3);
    assert.deepEqual(expected.normal,[-1,0,0]);assert.ok(Math.abs(expected.distance-Math.sqrt(3)*.0625)<=1e-9);
    for(const mode of ['flat','two-level'])assert.deepEqual(s.traceFrozen(r,v.binding,mode).result,expected);
    expectsUnsupported(()=>packRays(s,[r],true),'NON_AXIAL_OR_UNPROVEN_TIE_DOMAIN');
  } finally {s.dispose();}
});

test('nonzero subnormal component cannot silently become a zero GPU axis',async()=>{
  const v=make(),s=await createSparseVolume(v,v.binding);
  try {
    const r=ray([.0625,.0625,.0625],[2**-153,1,0]);
    assert.notEqual(r.direction[0],0);assert.equal(Math.fround(r.direction[0]*8),0);
    expectsUnsupported(()=>packRays(s,[r],true),'NON_AXIAL_OR_UNPROVEN_TIE_DOMAIN');
  } finally {s.dispose();}
});

test('Unknown is not a light opening, including zero-budget and exterior policy',async()=>{
  const v=make([4,1,1],'r01-unknown');v.coverage='partial';setCell(v,[1,0,0],-1);
  const s=await createSparseVolume(v,v.binding);
  try {
    const r=ray([.0625,.0625,.0625]);const expected=traceBruteForce(v,r);
    assert.equal(expected.kind,'Unknown');assert.equal(expected.distance,.0625);
    for(const mode of ['flat','two-level'])assert.deepEqual(s.traceFrozen(r,v.binding,mode).result,expected);
  } finally {s.dispose();}
  v.exteriorCoverage='Unknown';bindSource(v);
  assert.equal(traceBruteForce(v,ray([-.0625,.0625,.0625])).kind,'Unknown');
});

test('unknown/larger257-cell grids never inherit a support claim from the1000 fixtures',()=>{
  for(const size of [[],[257,1,1],[96,96,96],[64,64,undefined]]) {
    assert.equal(assessGpuTrialDomain(size,.125,[.5,.5,.5],[8,0,0],8).status,'UNSUPPORTED');
  }
  assert.equal(assessGpuTrialDomain([64,64,64],.125,[.5,.5,.5],[8,0,0],8).conservativeIterationBound,195);
});
