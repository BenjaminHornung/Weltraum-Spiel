import{it,expect}from'vitest';
import{fixtureReplay}from'../resume/fixtures';
import{buildCombinedScenario,sampleCombined}from'../../src/qa/combined-scene/scenario';
import{getFixtureDigest,copyFixturePayload}from'../../src/contracts/fixture';
import{sampleWeatherAt,WEATHER_PRESETS}from'../../src/experiments/weather-field';
import{Group,Scene,PerspectiveCamera}from'three';
import{ownerPose,type ThreeLabEffectContext}from'../../src/runner/threeHost';
import{mountThreeEffect as mountWet}from'../../src/experiments/wet-surface';
import{mountThreeEffect as mountWind}from'../../src/experiments/foliage-wind';
import{mountThreeEffect as mountCamera}from'../../src/experiments/camera-occlusion';
import{COMBINED_WETNESS}from'../../src/qa/combined-scene';
import{createVoxelSourceIndex,sampleRainExposure}from'../../src/experiments/rain-shield';
it('COM01 fixed original source composition and shared weather/tick binding is reproducible through direct seek',async()=>{
 const replays=await Promise.all(['F01-HVP-COAST-REPLAY','F03-SHELTER-REPLAY','F04-DETACH-REPLAY','F05-CUTOUT-REPLAY'].map(fixtureReplay)),input={coast:replays[0],shelter:replays[1],detach:replays[2],figure:replays[3]},route=await buildCombinedScenario(input),again=await buildCombinedScenario(input);
 expect(route.scenarioDigest).toBe(again.scenarioDigest);for(const tick of[0,120,240,360,480,720,900,1080,1200,1320,1440,0]){
  const sample=sampleCombined(route,tick,true);expect(sample.frame.weather).toEqual(sampleWeatherAt([2,1,2],tick,WEATHER_PRESETS[sample.weatherId]));expect(sample.frame.tick).toBe(tick);expect(sample.frame.sourceRevision).toBe(sample.fixture.sourceRevision);expect(getFixtureDigest(sample.fixture)).toBe(getFixtureDigest(sampleCombined(again,tick,true).fixture));
 }
 const composite=sampleCombined(route,120,true).fixture,water=composite.objects.find(o=>o.ownerId==='hvp:water')!,original=replays[0].initialFixture;
 expect(copyFixturePayload(composite,water.meshes[0].positions)).toEqual(copyFixturePayload(original,water.meshes[0].positions));expect(route.inputBindings).toHaveLength(4);expect(composite.kind).toBe('synthetic');expect(original.kind).toBe('product-derived');
});
it('COM02/COM03 real composed effect mounts stay within original whole budgets with simultaneous rain wind wetness and cutout',async()=>{
 const replays=await Promise.all(['F01-HVP-COAST-REPLAY','F03-SHELTER-REPLAY','F04-DETACH-REPLAY','F05-CUTOUT-REPLAY'].map(fixtureReplay)),route=await buildCombinedScenario({coast:replays[0],shelter:replays[1],detach:replays[2],figure:replays[3]});
 for(const tick of[300,420,600,780,960,1140,1260,1500]){const sample=sampleCombined(route,tick,true),fixture=sample.fixture,scene=new Scene(),camera=new PerspectiveCamera(),wetRoot=new Group(),windRoot=new Group(),cameraRoot=new Group(),signal=new AbortController().signal,context=(root:Group):ThreeLabEffectContext=>({scene,camera,root,fixture,frame:sample.frame,resetTick:null,signal,capabilities:{},ownerPose:id=>ownerPose(fixture,id)}),wet=await mountWet(context(wetRoot),{id:'analytic-current-exposure'}),wind=await mountWind(context(windRoot),{id:'rigid',parameters:{projection:'decor'}},true),cutout=await mountCamera(context(cameraRoot),{id:'clip-corridor'},p=>wet.setViewCutout(p));
  wet.setWetnessTimeline(COMBINED_WETNESS,sample.sourceEpoch);wet.setFrame(sample.frame);wind.setFrame(sample.frame);cutout.setFrame(sample.frame);const actual=wet.readWetnessState();
  expect(actual.rain.tick).toBe(tick);expect(actual.rain.fixtureDigest).toBe(getFixtureDigest(fixture));expect(cutout.readOcclusion().planes).toHaveLength(6);expect([wet,wind,cutout].every(e=>e.readFacts().fixtureDigest===getFixtureDigest(fixture))).toBe(true);
  if(tick<1320){expect(actual.rain.field).not.toBeNull();expect(actual.rain.visibleParticles+actual.rain.clippedParticles+actual.rain.unknownParticles).toBe(614);expect(actual.result!.samples.length).toBeLessThanOrEqual(8192);expect(actual.result!.refreshQueries).toBeLessThanOrEqual(2_000_000);}
  if(tick===300)expect(actual.result!.potentialQueries).toBeGreaterThan(2_000_000);
  if(tick===300){const before=wet.readFacts().logicalCosts.wetnessSourceCopyBytes;expect((before as {value:number}).value).toBeGreaterThan(0);wet.setFrame(sampleCombined(route,120,true).frame);expect(wet.readWetnessState().result).toBeNull();expect(wet.readFacts().logicalCosts.wetnessSourceCopyBytes).toEqual(before);wet.setFrame(sample.frame);}
  if(tick===780||tick===960)expect(wind.readWindState().clusters.some(c=>c.ownerId==='fragment-branch'&&JSON.stringify(c.anchor)==='[0,0,0]')).toBe(true);
  if(tick===1140)expect(wind.readWindState().clusters).toHaveLength(0);
  const index=createVoxelSourceIndex(fixture),under=sampleRainExposure(index,[2.5,.28125,1.25],[0,-1,0],3.6875);if(tick===300)expect(under.status).toBe('shielded');if(tick===600)expect(under.status).toBe('exposed');index.dispose();
  await cutout.dispose();await wind.dispose();await wet.dispose();expect(wetRoot.children).toHaveLength(0);expect(windRoot.children).toHaveLength(0);
 }
});
it('COM03/WET05 bounded actual query admission refuses before exceeding the supplied remaining cap',async()=>{
 const fixture=(await fixtureReplay('F03-SHELTER-REPLAY')).initialFixture,index=createVoxelSourceIndex(fixture);let calls=0;const sample=index.sample.bind(index),bounded={...index,sample:(point:Parameters<typeof sample>[0])=>{calls++;return sample(point);}};
 expect(()=>sampleRainExposure(bounded,[2.5,.28125,1.25],[0,-1,0],3.6875,3)).toThrow(/remaining query budget/);expect(calls*index.regionCount).toBeLessThanOrEqual(3);index.dispose();
});
