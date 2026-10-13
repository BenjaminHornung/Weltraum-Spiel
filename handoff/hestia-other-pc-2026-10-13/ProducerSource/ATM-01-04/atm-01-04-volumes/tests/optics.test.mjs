import test from 'node:test';
import assert from 'node:assert/strict';
import {integrate,composeWater,shellInterval,density,createHistory,validateFrame,buildLut,sampleLut,skyProfile} from '../.runtime/optics.mjs';
const close=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
test('empty T=1, homogeneous independent closed form and monotonic density',()=>{
 const empty=integrate(()=>0,10,64,[2,3,4]);assert.equal(empty.T,1);assert.deepEqual(empty.L,[0,0,0]);
 const full=integrate(()=>0.2,10,64,[2,3,4]);close(full.T,Math.exp(-2));
 full.L.forEach((v,i)=>close(v,[2,3,4][i]*(1-Math.exp(-2))));
 assert.ok(integrate(()=>0.4,10,64,[2,3,4]).T<full.T);
 assert.throws(()=>integrate(()=>-1,10,8,[1,1,1]));assert.throws(()=>integrate(()=>NaN,10,8,[1,1,1]));
});
test('water front/back algebra retains alpha and rejects opaque shortcut',()=>{
 const near=integrate(()=>0.1,2,16,[0.4,0.5,0.6]),far=integrate(()=>0.3,4,16,[0.1,0.2,0.3]);
 const background=[0.8,0.3,0.2],water=[0.05,0.3,0.5],alpha=0.56;
 const out=composeWater(near,far,background,water,alpha);
 for(let i=0;i<3;i++)close(out[i],near.L[i]+near.T*(alpha*water[i]+(1-alpha)*(far.L[i]+far.T*background[i])));
 assert.notDeepEqual(out,composeWater(near,far,background,water,1));
 assert.notDeepEqual(out,composeWater(far,near,background,water,alpha));
});
test('shell: below, inside, above, miss, surface, sun and meter units',()=>{
 assert.deepEqual(shellInterval([0,0,12],[0,0,-1],10,14),[0,2]);
 assert.deepEqual(shellInterval([0,0,16],[0,0,-1],10,14),[2,6]);
 assert.equal(shellInterval([0,0,16],[1,0,0],10,14),null);
 assert.equal(shellInterval([0,0,10],[0,0,-1],10,14),null);
 assert.throws(()=>shellInterval([0,0,12],[0,0,-2],10,14));
});
test('true 3D body density: same below/inside/above/orbit and origin rebase',()=>{
 const a=density([0,16,0],0.7),b=density([0,0,0],0.7);assert.ok(a>0);assert.equal(b,0);
 assert.equal(density([1000,16,0],0.7),0);assert.equal(density([0,16,0],0),0);
 const body=[0,16,0],origin=[1000000,-2000000,3000000],local=body.map((v,i)=>v-origin[i]);
 close(density(local.map((v,i)=>v+origin[i]),0.7),a);assert.throws(()=>density([NaN,0,0],1));
});
test('LUT zero medium and homogeneous atmosphere agree with independently calculated path',()=>{
 const lut=buildLut({radius:1000,height:100,scaleHeight:1e12,sigma:0.01},16,32);
 close(sampleLut(lut,0,1),Math.exp(-1),1e-6);
 const clear=buildLut({radius:1000,height:100,scaleHeight:100,sigma:0},8,8);
 close(sampleLut(clear,0,1),1);
});
test('chosen weather coefficient is identical in LUT/analytic and NoAtmosphere LUT is empty',()=>{
 const frame={bodyRadiusMeters:1000,status:'Known',weatherExtinctionPerM:0.000013998870849609376};
 assert.equal(skyProfile(frame).sigma,0.00001+frame.weatherExtinctionPerM);
 const vacuum=buildLut(skyProfile({...frame,status:'NoAtmosphere'}),8,8);
 assert.ok(vacuum.values.every(v=>v===1));
 assert.deepEqual(shellInterval([0,0,1100],[0,0,-1],1000,1200),[0,100]);
});
test('history is presentation-only; lightning/rebase/ascent/stale/context/dispose bounded',()=>{
 for(let cycle=0;cycle<10;cycle++){
  const h=createHistory(),frame={weather:'w',profile:'p',macro:'m',model:'v',optics:'o',source:1,atlas:1,epoch:1,origin:[0,0,0],height:0,lightning:null};
  assert.equal(h.set(frame),'FIRST');assert.equal(h.set(frame),'CURRENT');
  assert.equal(h.set({...frame,lightning:'event.1'}),'RESET');
  assert.equal(h.set({...frame,origin:[1000,0,0]}),'RESET');
  assert.equal(h.set({...frame,height:500}),'RESET');
  assert.throws(()=>h.acceptAtlas(0),/STALE_ATLAS/);h.contextLost();assert.equal(h.resources,0);
  h.dispose();h.dispose();assert.equal(h.resources,0);assert.throws(()=>h.set(frame));
 }
});
test('invalid frame/nan/unsupported cannot become Earth',()=>{
 assert.throws(()=>validateFrame({}));assert.throws(()=>validateFrame({status:'Unsupported'}));
});
