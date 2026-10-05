import { expect,it } from 'vitest';
import { Group,Mesh,PerspectiveCamera,Scene } from 'three';
import { fixtureReplay } from '../resume/fixtures';
import { createFrameInput } from '../../src/contracts/experiment';
import { copyFixturePayload,fixtureRevision,getFixtureDigest } from '../../src/contracts/fixture';
import { createWetnessPreset,createWetnessSourceCache,sampleAnalyticWetness,ownerWetnessCandidate,mountThreeEffect,DEFAULT_WETNESS_PRESET } from '../../src/experiments/wet-surface';
import { ownerPose,type ThreeLabEffectContext } from '../../src/runner/threeHost';
const weather={windMps:[0,0,0] as const,rain01:0.8,snow01:0,cloud01:0.8};
const point=(id:string,x:number)=>({id,ownerId:'shelter-shell',positionLocalMeters:[x,0.25,1.25] as const,normalLocal:[0,1,0] as const});
it('WET01 protected source face remains dry; exposed new roof opening starts at declared zero',async()=>{
  const replay=await fixtureReplay('F03-SHELTER-REPLAY'),closed=createWetnessSourceCache(replay.initialFixture),open=createWetnessSourceCache(replay.scenario.snapshots[0].manifest);
  const frame=createFrameInput({tick:600,seconds:10,paused:true,cameraId:'near',sourceRevision:0,weather});
  const a=closed.evaluate(frame,DEFAULT_WETNESS_PRESET,0,[point('under',2.5),point('open-air',4.625)]);
  expect(a.samples[0].exposure).toBe('shielded');expect(a.samples[0].wetness01).toBe(0);
  expect(a.samples[1].exposure).toBe('exposed');expect(a.samples[1].wetness01).toBeGreaterThan(0);
  const ownerCandidate=ownerWetnessCandidate(a.samples);
  // REJECT: one owner contains both protected and exposed source faces; its mean changes both truths.
  expect(ownerCandidate['shelter-shell']).not.toBe(a.samples[0].wetness01);expect(ownerCandidate['shelter-shell']).not.toBe(a.samples[1].wetness01);
  const start=open.evaluate(createFrameInput({...frame,tick:360,seconds:6,sourceRevision:1}),DEFAULT_WETNESS_PRESET,360,[point('under',2.5)]);
  expect(start.samples[0].exposure).toBe('exposed');expect(start.samples[0].wetness01).toBe(0);
  expect(open.evaluate(createFrameInput({...frame,sourceRevision:1}),DEFAULT_WETNESS_PRESET,360,[point('under',2.5)]).samples[0].wetness01).toBeGreaterThan(0);closed.dispose();open.dispose();
});
it('WET02 declared source reset, detached owner rotation and unknown world coverage remain explicit',async()=>{
  const replay=await fixtureReplay('F04-DETACH-REPLAY'),fixture=replay.scenario.snapshots[1].manifest,cache=createWetnessSourceCache(fixture);
  const frame=createFrameInput({tick:720,seconds:12,paused:true,cameraId:'near',sourceRevision:2,weather});
  const result=cache.evaluate(frame,DEFAULT_WETNESS_PRESET,720,[{id:'fragment',ownerId:'fragment-branch',positionLocalMeters:[0.5,-0.125,0.0625],normalLocal:[0,1,0]}]);
  expect(result.fixtureDigest).toBe(getFixtureDigest(fixture));expect(result.sourceRevision).toBe(2);expect(result.sourcePolicy).toBe('reset-at-snapshot');
  expect(result.samples[0].receiverWorldMeters).toEqual([1.09375,1.5,0.3125]);expect(result.samples[0].wetness01).toBe(0);
  expect(()=>cache.evaluate(createFrameInput({...frame,sourceRevision:1}),DEFAULT_WETNESS_PRESET,720,[])).toThrow();cache.dispose();
});
it('WET03 wetness parameters never rewrite materials/source bytes and unknown is not certified dry',async()=>{
  const fixture=(await fixtureReplay('F03-SHELTER-REPLAY')).initialFixture,digest=getFixtureDigest(fixture),before=copyFixturePayload(fixture,fixture.objects[0].meshes[0].positions),cache=createWetnessSourceCache(fixture);
  const frame=createFrameInput({tick:600,seconds:10,paused:true,cameraId:'near',sourceRevision:fixtureRevision(fixture),weather});
  const result=cache.evaluate(frame,DEFAULT_WETNESS_PRESET,0,[point('unknown',4.9375)]);
  expect(result.samples[0].exposure).toBe('unknown');expect(result.samples[0].qualification).toBe('unknown');expect(result.unknownSamples).toBe(1);
  expect(copyFixturePayload(fixture,fixture.objects[0].meshes[0].positions)).toEqual(before);expect(getFixtureDigest(fixture)).toBe(digest);cache.dispose();
});
it('WET04 controlled pause/seek/current-exposure analytic history produces the same exact CPU facts',async()=>{
  const fixture=(await fixtureReplay('F03-SHELTER-REPLAY')).initialFixture,cache=createWetnessSourceCache(fixture),points=[point('exposed',4.625)];
  const frame=createFrameInput({tick:600,seconds:10,paused:true,cameraId:'near',sourceRevision:0,weather}),a=cache.evaluate(frame,DEFAULT_WETNESS_PRESET,0,points);
  cache.evaluate(createFrameInput({...frame,tick:1200,seconds:20,weather:{...weather,rain01:0}}),DEFAULT_WETNESS_PRESET,0,points);
  const b=cache.evaluate(frame,DEFAULT_WETNESS_PRESET,0,points);expect(b.samples).toEqual(a.samples);
  expect(sampleAnalyticWetness(DEFAULT_WETNESS_PRESET,1200,0,'exposed').wetness01).toBeLessThan(sampleAnalyticWetness(DEFAULT_WETNESS_PRESET,900,0,'exposed').wetness01);
  expect(()=>createWetnessPreset({...DEFAULT_WETNESS_PRESET,sourcePolicy:'old-world-texels'})).toThrow();cache.dispose();
});
it('WET05 fixed source-aware model adds no fog/bloom/geometry authority and bounded cache input rejects before work',async()=>{
  const fixture=(await fixtureReplay('F03-SHELTER-REPLAY')).initialFixture,cache=createWetnessSourceCache(fixture),frame=createFrameInput({tick:0,seconds:0,paused:true,cameraId:'near',sourceRevision:0,weather:{...weather,rain01:0}});
  expect(()=>cache.evaluate(frame,DEFAULT_WETNESS_PRESET,0,Array.from({length:8193},(_,i)=>point(String(i),1)))).toThrow(/budget/);
  expect(()=>createWetnessPreset({...DEFAULT_WETNESS_PRESET,fog:1})).toThrow();
  expect(()=>cache.evaluate(frame,DEFAULT_WETNESS_PRESET,1,[])).toThrow();cache.dispose();expect(()=>cache.evaluate(frame,DEFAULT_WETNESS_PRESET,0,[])).toThrow(/disposed/);
});
it('WET01/WET03/WET04 actual shared material/rain mount: source-clipped wet faces reconstruct dry/wet/reset without ghosting',async()=>{
  const replay=await fixtureReplay('F03-SHELTER-REPLAY'),fixture=replay.initialFixture,root=new Group(),frame=createFrameInput({tick:0,seconds:0,paused:true,cameraId:'near',sourceRevision:0,weather:{...weather,rain01:0}});
  const context:ThreeLabEffectContext={root,scene:new Scene(),camera:new PerspectiveCamera(),fixture,frame,resetTick:null,signal:new AbortController().signal,capabilities:{},ownerPose:(id)=>ownerPose(fixture,id)};
  const effect=await mountThreeEffect(context,{id:'analytic-current-exposure'});
  const buffers=()=>{const result:Float32Array[]=[];root.traverse((o)=>{if(o instanceof Mesh&&o.geometry.getAttribute('labWetness'))result.push(o.geometry.getAttribute('labWetness').array as Float32Array);});return result;};
  effect.setFrame(createFrameInput({...frame,tick:600,seconds:10,weather}));expect(buffers().some((b)=>b.some((v)=>v>0))).toBe(true);
  const wet=effect.readWetnessState();expect(wet.result!.samples.some((s)=>s.exposure==='shielded'&&s.wetness01===0)).toBe(true);expect(wet.result!.refreshQueries).toBeLessThanOrEqual(2_000_000);
  expect(wet.rain.fixtureDigest).toBe(wet.result!.fixtureDigest);expect(wet.rain.direction).toEqual(wet.result!.direction);
  const before=buffers().map((b)=>new Float32Array(b));effect.setFrame(frame);
  expect(buffers().every((b)=>b.every((v)=>v===0))).toBe(true);
  effect.setFrame(createFrameInput({...frame,tick:600,seconds:10,weather}));expect(buffers()).toEqual(before);
  await effect.replaceFixture(replay.scenario.snapshots[0].manifest);effect.setWetnessTimeline(DEFAULT_WETNESS_PRESET,360);
  effect.setFrame(createFrameInput({...frame,tick:360,seconds:6,sourceRevision:1,weather}));expect(buffers().every((b)=>b.every((v)=>v===0))).toBe(true);
  effect.setFrame(createFrameInput({...frame,tick:600,seconds:10,sourceRevision:1,weather}));expect(buffers().some((b)=>b.some((v)=>v>0))).toBe(true);
  await effect.dispose();expect(root.children).toHaveLength(0);expect(()=>effect.readWetnessState()).toThrow(/disposed/);
});
