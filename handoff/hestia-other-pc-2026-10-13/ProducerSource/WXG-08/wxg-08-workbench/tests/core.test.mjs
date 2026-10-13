import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraft,validateDraft,previewDraft,scenarioView,parseStored,commitDraft,canonicalCelestialJson,Generation,planets,contentDigest,mapWind} from '../dist/src/core.js';
import {trajectoryQuery} from '../inputs/wxg/dist/src/weather.js';
import {createAnalyticReadView} from '../inputs/wxg/dist/src/weather.js';
import {validateFrame,rebaseFrame,integrate} from '../dist/inputs/atm/src/optics.js';
test('workbench samples the actual finite headless port',async()=>{
 const d=await createDraft('HestiaAuthoring');
 const v=await validateDraft(d);
 const p=await previewDraft(v,7200000);
 assert.equal(p.cells.length,72);
 assert.equal(p.cells[0].result.binding.model.digest,'sha256:78f9b7dd581faf7db0b09c37cdabda15814dd8884e173cf20eeaa722918a7f50');
});
test('all seven original fixtures keep explicit unsupported/airless states',async()=>{
 const expected={Hestia:'Unsupported',Airless:'NoAtmosphere',Dust:'Known',Methane:'Unsupported',GasGiant:'Known',TidallyLocked:'Known',HestiaAuthoring:'Known'};
 for(const name of planets){const d=await createDraft(name),p=await previewDraft(d,7200000);assert.ok(p.cells.every(c=>c.result.status===expected[name]));
  if(name==='Airless')assert.ok(p.cells.every(c=>c.atmosphere.status==='NoAtmosphere'&&c.atmosphere.weatherExtinctionPerM===0));
 }
});
test('map points match direct producer reads byte for byte; no second weather logic',async()=>{
 const d=await createDraft('HestiaAuthoring'),p=await previewDraft(d,7200000),v=await createAnalyticReadView(d.base);
 for(const c of p.cells)assert.equal(canonicalCelestialJson(c.result),canonicalCelestialJson(await v.read(trajectoryQuery(d.base.bundle,c.normal,7200000))));
 const f=p.cells[0].atmosphere;assert.equal(f.weatherSnapshotId,p.cells[0].result.WeatherSnapshotId);
 assert.equal(rebaseFrame(f,[100,0,0]).weatherSnapshotId,f.weatherSnapshotId);
 assert.ok(Math.abs(integrate(()=>0.1,10,16,[1,1,1]).T-Math.exp(-1))<1e-12);
});
const event=(d,edit={})=>({id:'change.1',name:'Named wind change',version:1,kind:'ConfigChanged',simulationTick:7200000,config:{...d.base.config,zonalWindMps:24},...edit});
test('versioned config event applies only at its tick and binds actual event identity',async()=>{
 const base=await createDraft('HestiaAuthoring'),d={...base,events:[event(base)]},before=await scenarioView(d,7199880),after=await scenarioView(d,7200000);
 assert.equal(before.input.config.zonalWindMps,12);assert.equal(after.input.config.zonalWindMps,24);
 const q=trajectoryQuery(after.input.bundle,{x:1,y:0,z:0},7200000),r=await after.read(q);
 assert.equal(r.binding.eventCursor,'1');assert.equal(r.binding.eventDigest,await contentDigest(d.events));
 assert.notEqual(r.WeatherSnapshotId,(await (await scenarioView(base,7200000)).read(q)).WeatherSnapshotId);
});
test('duplicate ID, event version/name/order and config ranges fail closed',async()=>{
 const d=await createDraft('HestiaAuthoring');
 for(const events of [[event(d),event(d)],[event(d,{version:2})],[event(d,{name:' '})],[event(d,{simulationTick:-1})],[event(d,{id:'bad id'})],[event(d,{config:{...d.base.config,zonalWindMps:101}})],[event(d),event(d,{id:'second',simulationTick:0})]])await assert.rejects(()=>validateDraft({...d,events}));
});
test('unknown species, mutated base and GPU/worker/camera/origin handles cannot export',async()=>{
 const d=await createDraft('HestiaAuthoring');
 for(const edit of [x=>x.base.bundle.physics.gasMixture[0].speciesId='unknown',x=>x.base.bundle.physics.temperatureRangeK=[500,100],x=>x.base.config.zonalWindMps=80,x=>x.camera={},x=>x.renderOrigin=[0,0,0],x=>x.worker={},x=>x.gpuHandle={},x=>x.events=[{...event(d),gpu:{}}]]){
  const bad=structuredClone(d);edit(bad);await assert.rejects(()=>validateDraft(bad));
 }
});
function store(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};}
function locks(){let tail=Promise.resolve();return {request:(key,cb)=>{const run=tail.then(()=>cb({name:key}));tail=run.catch(()=>{});return run;}};}
test('canonical CAS reload roundtrip and stale competing draft preserve old bytes',async()=>{
 const d=await createDraft('Dust'),s=store(),l=locks(),r=await commitDraft(d,0,s,l),raw=s.getItem('wxg08.lab.v1.Dust');
 assert.equal(canonicalCelestialJson(await parseStored(raw,'Dust')),canonicalCelestialJson(r));assert.equal(r.revision,1);
 await assert.rejects(()=>commitDraft(d,0,s,l),/STALE_DRAFT/);assert.equal(s.getItem('wxg08.lab.v1.Dust'),raw);
 const concurrent=await Promise.allSettled([commitDraft(d,1,s,l),commitDraft(d,1,s,l)]);assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
});
test('bad stored digest, revision, cross-planet and corrupted JSON reject',async()=>{
 const d=await createDraft('Dust'),r=await commitDraft(d,0,store(),locks());
 for(const x of [{...r,digest:'sha256:'+'0'.repeat(64)},{...r,revision:0},{...r,revision:0.5},{...r,gpu:{}},{...r,draft:{...d,planet:'Airless'}}])await assert.rejects(()=>parseStored(JSON.stringify(x),'Dust'));
 await assert.rejects(()=>parseStored('{','Dust'));
});
test('CAS without locks, cancelled transaction and storage failure never claim success',async()=>{
 const d=await createDraft('Dust'),s=store();
 await assert.rejects(()=>commitDraft(d,0,s,null),/CAS_UNSUPPORTED/);
 await assert.rejects(()=>commitDraft(d,0,s,locks(),()=>false),/CANCELLED/);assert.equal(s.getItem('wxg08.lab.v1.Dust'),null);
 await assert.rejects(()=>commitDraft(d,0,{getItem:()=>null,setItem:()=>{throw Error('QUOTA');}},locks()),/QUOTA/);
});
test('Cancel and load-switch invalidate prior generations',()=>{
 const g=new Generation(),old=g.begin();g.cancel();assert.equal(g.current(old),false);const a=g.begin(),b=g.begin();assert.equal(g.current(a),false);assert.equal(g.current(b),true);
});
test('equirectangular arrows use local east/north rather than raw body axes',()=>{
 assert.deepEqual(mapWind({x:1,y:0,z:0},{x:0,y:3,z:2}),{u:2,v:3});
 assert.deepEqual(mapWind({x:0,y:0,z:1},{x:-2,y:3,z:0}),{u:2,v:3});
});
test('numeric, mixed numeric/string and null event IDs must be rejected',async()=>{
 const d=await createDraft('HestiaAuthoring');
 for(const events of [[event(d,{id:7})],[event(d,{id:7}),event(d,{id:'7'})],[event(d,{id:null})]])await assert.rejects(()=>validateDraft({...d,events}));
});
test('nested provenance/direction handles and non-string provenance notes must be rejected',async()=>{
 const d=await createDraft('HestiaAuthoring');
 for(const config of [{...d.base.config,substellarDirection:{...d.base.config.substellarDirection,worker:{}}},{...d.base.config,provenance:{...d.base.config.provenance,gpuHandle:{}}},{...d.base.config,provenance:{...d.base.config.provenance,note:42}}])await assert.rejects(()=>validateDraft({...d,events:[event(d,{config})]}));
});
