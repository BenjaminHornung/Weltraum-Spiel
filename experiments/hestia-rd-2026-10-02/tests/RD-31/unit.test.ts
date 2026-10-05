import { expect, it } from 'vitest';
import { fixtureReplay } from '../resume/fixtures';
import { createVoxelSourceIndex, sampleRainExposure, createRainExposureProjection, sampleRainTrajectory, validateRainBudget } from '../../src/experiments/rain-shield';
import { getFixtureDigest } from '../../src/contracts/fixture';

it('RAIN01 canonical closed roof shields; its removed part exposes only the actual opening',async()=>{
  const replay=await fixtureReplay('F03-SHELTER-REPLAY');const closed=createVoxelSourceIndex(replay.initialFixture);
  const open=createVoxelSourceIndex(replay.scenario.snapshots[0].manifest);
  // Frozen shelter floor occupies y=[0,.25). Receiver is above it; upstream endpoint remains in known coverage below y=4.
  const under=[2.5,0.28125,1.25] as const,offset=[1,0.28125,1.25] as const;
  expect(sampleRainExposure(closed,under,[0,-1,0],3.6875).status).toBe('shielded');
  expect(sampleRainExposure(open,under,[0,-1,0],3.6875).status).toBe('exposed');
  expect(sampleRainExposure(open,offset,[0,-1,0],3.6875).status).toBe('shielded');
  const grid=createRainExposureProjection(open,{originMeters:[2,0.28125,0.375],width:8,height:17,spacingMeters:0.125,direction:[0,-1,0],travelMeters:3.6875});
  expect(grid.samples.some((s)=>s.status==='exposed')).toBe(true);expect(grid.fixtureDigest).toBe(getFixtureDigest(replay.scenario.snapshots[0].manifest));
});
it('RAIN02 controlled time/seed and reversed cadence queries retain world-anchored rain, no camera truth',()=>{
  const first=sampleRainTrajectory(23,7,300,[3,-12,1]);
  for(const tick of [0,60,120,300])sampleRainTrajectory(23,7,tick,[3,-12,1]);
  expect(sampleRainTrajectory(23,7,300,[3,-12,1])).toEqual(first);
  expect(sampleRainTrajectory(23,7,301,[3,-12,1])).not.toEqual(first);
});
it('RAIN03 missing source coverage is explicit unknown, never air or physical protection',async()=>{
  const replay=await fixtureReplay('F03-SHELTER-REPLAY'),index=createVoxelSourceIndex(replay.initialFixture);
  expect(index.sample([100,100,100]).status).toBe('unknown');
  expect(sampleRainExposure(index,[100,0,100],[0,-1,0],3).status).toBe('unknown');
});
it('RAIN04 particle/splash/query/field caps reject before allocation or source mutation',async()=>{
  const replay=await fixtureReplay('F03-SHELTER-REPLAY'),before=getFixtureDigest(replay.initialFixture),index=createVoxelSourceIndex(replay.initialFixture);
  expect(()=>validateRainBudget({particles:100000,splashes:0,queries:1})).toThrow();
  expect(()=>validateRainBudget({particles:1,splashes:1000,queries:1})).toThrow();
  expect(()=>createRainExposureProjection(index,{originMeters:[0,0,0],width:10000,height:10000,spacingMeters:0.125,direction:[0,-1,0],travelMeters:4})).toThrow();
  expect(getFixtureDigest(replay.initialFixture)).toBe(before);
});
it('RAIN05 fixed projection source binding, backward seek and invalid directions cannot mutate earlier exposure',async()=>{
  const replay=await fixtureReplay('F03-SHELTER-REPLAY'),index=createVoxelSourceIndex(replay.initialFixture);
  const a=sampleRainExposure(index,[2.5,0.28125,1.25],[0,-1,0],3.6875);const before=JSON.stringify(a);
  expect(()=>sampleRainExposure(index,[2.5,0.28125,1.25],[0,0,0],3.6875)).toThrow();
  expect(()=>sampleRainTrajectory(0,0,-1,[0,-12,0])).toThrow();
  expect(JSON.stringify(a)).toBe(before);expect(Object.isFrozen(a)).toBe(true);index.dispose();expect(()=>index.sample([1,1,1])).toThrow(/disposed/);
});

it('RAIN01/RAIN03 source-bound low/high roofs, side entry, oblique rain and x39 unknown',async()=>{
  const fixture=(await fixtureReplay('F03-SHELTER-REPLAY')).initialFixture,index=createVoxelSourceIndex(fixture);
  const low=sampleRainExposure(index,[1.3125,0.28125,1.3125],[0,-1,0],3.6875),high=sampleRainExposure(index,[3.8125,0.28125,1.3125],[0,-1,0],3.6875);
  expect(low.status).toBe('shielded');expect(low.hit?.cell).toEqual([10,12,10]);
  expect(high.status).toBe('shielded');expect(high.hit?.cell).toEqual([30,22,10]);
  expect(sampleRainExposure(index,[1.3125,0.28125,1.3125],[0.25,-1,0],3.6875).status).toBe('shielded');
  // The stronger oblique upstream ray exits frozen coverage: it may not claim either protection or exposure.
  expect(sampleRainExposure(index,[1.3125,0.28125,1.3125],[1,-1,0],3.6875).status).toBe('unknown');
  expect(index.sample([0.875,0.75,1.375]).status).toBe('air');
  expect(index.sample([0.875,0.75,1.0625]).status).toBe('solid');
  expect(sampleRainExposure(index,[4.9375,0.28125,1.25],[0,-1,0],3.6875).status).toBe('unknown');
  expect(low.receiverMeters).toEqual([1.3125,0.28125,1.3125]);expect(low.direction).toEqual([0,-1,0]);
  expect(low.travelMeters).toBe(3.6875);expect(low.sourceFrame).toEqual(fixture.frame);
  expect(low.coverageBindings.every((b)=>fixture.payloads.some((payload)=>payload.id===b.payloadId&&payload.sha256===b.sha256))).toBe(true);index.dispose();
});
it('RAIN01/RAIN05 moving F04 shield is rebound to detached, rotated and truncated source owners',async()=>{
  const replay=await fixtureReplay('F04-DETACH-REPLAY');
  const indexes=replay.scenario.snapshots.slice(0,3).map((snapshot)=>createVoxelSourceIndex(snapshot.manifest));
  const oldReceiver=[1.0625,2,-0.1875] as const,newReceiver=[0.9375,0.875,0.3125] as const,aboveTruncated=[0.9375,1.625,0.3125] as const;
  expect(sampleRainExposure(indexes[0],oldReceiver,[0,-1,0],0.5).status).toBe('shielded');
  expect(sampleRainExposure(indexes[1],oldReceiver,[0,-1,0],0.5).status).toBe('exposed');
  expect(sampleRainExposure(indexes[1],newReceiver,[0,-1,0],1.5).status).toBe('shielded');
  expect(sampleRainExposure(indexes[1],aboveTruncated,[0,-1,0],1).status).toBe('shielded');
  expect(sampleRainExposure(indexes[2],aboveTruncated,[0,-1,0],1).status).toBe('exposed');
  indexes.forEach((index,i)=>{expect(index.fixtureDigest).toBe(getFixtureDigest(replay.scenario.snapshots[i].manifest));expect(index.sourceRevision).toBe(i+1);index.dispose();});
});
