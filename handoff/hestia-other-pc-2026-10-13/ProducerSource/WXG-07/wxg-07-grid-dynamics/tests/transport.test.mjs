import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGrid} from '../dist/grid.js';
import {Transport,totalMass,stepLimit,selectStepTicks} from '../dist/transport.js';
const zero={source:[0,0],sink:[0,0]},radius=8282000,axis={x:0.3,y:1,z:0.2};
const near=(x,y,t=1e-10)=>assert.ok(Math.abs(x-y)<=t*Math.max(1,Math.abs(y)),`${x} vs ${y}`);
test('constant field, closed mass and positive impulse travel through face/corner edges',()=>{
  for(const n of [32,48,64]){
    const g=buildGrid(n,radius,100,axis),m=new Transport(g,zero),v=new Float64Array(g.cells.length*2).fill(1),initial=m.initial(v),s=m.replay(initial,3600*120);
    for(const x of s.values)near(x,1,2e-13);totalMass(g,s.values).forEach((x,k)=>near(x,totalMass(g,v)[k],2e-13));
    const e=g.edges.find(e=>e.seam&&e.corner&&e.flux!==0),donor=e.flux>0?e.a:e.b,receiver=e.flux>0?e.b:e.a;
    v.fill(0);v[donor*2]=1;const step=m.step(m.initial(v));assert.ok(step.values[receiver*2]>0);near(totalMass(g,step.values)[0],g.cells[donor].area,2e-13);
  }
});
test('uniform source/sink has independent forward-Euler recurrence and explicit budget',()=>{
  const g=buildGrid(32,radius,0,axis),p={source:[1e-5,0],sink:[1e-4,0]},m=new Transport(g,p),v=new Float64Array(g.cells.length*2).fill(1),s=m.replay(m.initial(v),24*3600*120);
  const dt=m.dtTicks/120,expected=0.1+0.9*(1-1e-4*dt)**s.steps;for(let i=0;i<g.cells.length;i++){near(s.values[2*i],expected,2e-12);near(s.values[2*i+1],1);}
  const initial=totalMass(g,v),actual=totalMass(g,s.values);for(let k=0;k<2;k++)near(actual[k],initial[k]+s.added[k]-s.removed[k],2e-10);
});
test('actual geometry and spectrum bound dt; unstable 30/60 minute requests reject',()=>{
  for(const n of [32,48,64]){
    const g=buildGrid(n,radius,100,axis),limit=stepLimit(g,zero),dt=selectStepTicks(g,zero)/120;
    assert.equal(g.waveSpeed,0);assert.ok(dt<=0.8*g.minimumLength/100);assert.ok(dt*g.maximumOutflowRate<=0.8);assert.ok(limit>0);
    assert.throws(()=>new Transport(g,zero,[],30*60*120),/UNSTABLE_DT/);assert.throws(()=>new Transport(g,zero,[],60*60*120),/UNSTABLE_DT/);
  }
});
test('smooth advected tracer agrees with analytic rotation and converges under refinement',()=>{
  const errors=[];const aLen=Math.hypot(axis.x,axis.y,axis.z),a={x:axis.x/aLen,y:axis.y/aLen,z:axis.z/aLen},p={x:1,y:0.1,z:0.2},seconds=24*3600,angle=100/radius*seconds;
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const c=cross(a,p),ap=dot(a,p),rot={x:p.x*Math.cos(angle)+c.x*Math.sin(angle)+a.x*ap*(1-Math.cos(angle)),y:p.y*Math.cos(angle)+c.y*Math.sin(angle)+a.y*ap*(1-Math.cos(angle)),z:p.z*Math.cos(angle)+c.z*Math.sin(angle)+a.z*ap*(1-Math.cos(angle))};
  for(const n of [32,48,64]){
    const g=buildGrid(n,radius,100,axis),m=new Transport(g,zero),v=new Float64Array(g.cells.length*2);g.cells.forEach((c,i)=>{v[i*2]=1+0.5*dot(p,c.center);});
    const s=m.replay(m.initial(v),seconds*120);let err=0,area=0;g.cells.forEach((c,i)=>{err+=Math.abs(s.values[2*i]-(1+0.5*dot(rot,c.center)))*c.area;area+=c.area;});errors.push(err/area);
    near(totalMass(g,s.values)[0],totalMass(g,v)[0],2e-12);assert.ok(s.values.every(x=>x>=0));
  }
  assert.ok(errors[0]<0.04,JSON.stringify(errors));assert.ok(errors[1]<errors[0]&&errors[2]<0.75*errors[0],JSON.stringify(errors));console.log('analytic_tracer_L1='+JSON.stringify(errors));
});
test('negative/NaN/overflow state, invalid policy, ticks/events and absent topology fail closed',()=>{
  const g=buildGrid(32,radius,100,axis),m=new Transport(g,zero),v=new Float64Array(g.cells.length*2);
  for(const x of [-1,NaN,Infinity,-0]){v[0]=x;assert.throws(()=>m.initial(v),/INVALID_DENSITY/);}v[0]=0;
  assert.throws(()=>m.initial(new Float64Array(3)),/STATE_LENGTH/);
  for(const x of [-1,NaN,Infinity])assert.throws(()=>new Transport(g,{source:[x,0],sink:[0,0]}));
  const e={tick:3600*120,priority:0,sourceId:'a',commandId:'a',cell:0,channel:0,massKg:1};
  assert.throws(()=>new Transport(g,zero,[e,{...e,tick:0,commandId:'b'}]),/EVENT_ORDER/);assert.throws(()=>new Transport(g,zero,[e,{...e,tick:7200*120}]),/DUPLICATE_EVENT/);
  assert.throws(()=>new Transport(g,zero,[{...e,massKg:-1}]));assert.throws(()=>new Transport(g,zero,[{...e,tick:1}]));
  assert.throws(()=>buildGrid(96,radius,100,axis),/UNSUPPORTED/);assert.throws(()=>buildGrid(32,NaN,100,axis));assert.throws(()=>buildGrid(32,radius,100,{x:0,y:0,z:0}));
  const s=m.initial(v);for(const t of [-1,NaN,1,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>m.replay(s,t));assert.throws(()=>m.step(s,0));
  const bad={...s,values:v.slice()};bad.values[0]=NaN;assert.throws(()=>m.step(bad));assert.equal(s.values[0],0);
});
test('finite density causing sink-budget overflow rejects before publishing a new state',()=>{
  const g=buildGrid(32,radius,0,axis),m=new Transport(g,{source:[0,0],sink:[1e-4,0]}),v=new Float64Array(g.cells.length*2);v[0]=1e308;
  const s=m.initial(v);assert.throws(()=>m.step(s),/BUDGET/);assert.equal(s.removed[0],0);assert.equal(s.values[0],1e308);
});
