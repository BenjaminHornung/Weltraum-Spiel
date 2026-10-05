import { expect,it } from 'vitest';
import { Group,InstancedMesh,Matrix4,Mesh,PerspectiveCamera,Scene } from 'three';
import { fixtureReplay } from '../../resume/fixtures';
import { createFrameInput } from '../../../src/contracts/experiment';
import { fixtureRevision,getFixtureDigest } from '../../../src/contracts/fixture';
import { ownerPose,type ThreeLabEffectContext } from '../../../src/runner/threeHost';
import { createVoxelSourceIndex } from '../../../src/experiments/rain-shield';
import { buildRainColumns,compareRainDepthProjection,createRainDepthProjection,mountThreeEffect } from '../../../src/experiments/rain';

it('RAIN01 independent depth candidate is honestly rejected at exact half-open roof boundaries',async()=>{
  const replay=await fixtureReplay('F03-SHELTER-REPLAY');
  for(const fixture of [replay.initialFixture,replay.scenario.snapshots[0].manifest]){
    const index=createVoxelSourceIndex(fixture),depth=createRainDepthProjection(fixture);
    const query=buildRainColumns(index,[0,-12,0],8),candidate=buildRainColumns(index,[0,-12,0],8,depth);
    expect(query.fixtureDigest).toBe(getFixtureDigest(fixture));expect(candidate.columns.length).toBe(64);
    const comparison=compareRainDepthProjection(query,candidate,index.quantumMeters);expect(comparison.decision).toBe('REJECT');expect(comparison.failedColumns.length).toBeGreaterThan(0);
    const boundary=query.columns.findIndex((c)=>c.originMeters[0]===3.4375&&c.originMeters[2]===3.25);
    expect(query.columns[boundary].hitDistanceMeters).toBe(3.75);expect(candidate.columns[boundary].hitDistanceMeters).toBe(0.96875);
    expect(comparison.toleranceMeters).toBe(0.031251);depth.dispose();index.dispose();
  }
});
it('RAIN01/RAIN02 actual instanced mount clips drops at source-bound roofs with repeatable pause/seek',async()=>{
  const replay=await fixtureReplay('F03-SHELTER-REPLAY'),fixture=replay.initialFixture;
  const root=new Group(),frame=createFrameInput({tick:300,seconds:5,paused:true,cameraId:fixture.cameras[0].id,sourceRevision:fixtureRevision(fixture),weather:{windMps:[0,0,0],rain01:1,snow01:0,cloud01:1}});
  const context:ThreeLabEffectContext={root,fixture,frame,scene:new Scene(),camera:new PerspectiveCamera(),resetTick:null,signal:new AbortController().signal,capabilities:{},ownerPose:(id)=>ownerPose(fixture,id)};
  const effect=await mountThreeEffect(context,{id:'source-query',parameters:{particles:96,splashes:16,columns:8,seed:23}});
  effect.setFrame(frame);const before=effect.readRainView();expect(before.tick).toBe(300);expect(before.visibleParticles).toBeGreaterThan(0);expect(before.clippedParticles).toBeGreaterThan(0);
  expect(before.sourceFrame).toEqual(fixture.frame);expect(before.coverageBindings.length).toBe(fixture.voxelRegions!.length);
  expect(before.field!.sourceFrame).toEqual(before.sourceFrame);expect(before.field!.coverageBindings).toEqual(before.coverageBindings);
  expect(effect.readFacts().logicalCosts.instanceUploadBytes.value).toBe((96+16)*16*4);
  const meshes:Mesh[]=[];root.traverse((o)=>{if(o instanceof Mesh)meshes.push(o);});expect(meshes).toHaveLength(2);
  const drop=meshes.find((m)=>m.name==='rain-drops')! as Mesh&{instanceMatrix:{array:ArrayLike<number>}},matrices=Array.from(drop.instanceMatrix.array);
  const matrix=new Matrix4();for(let i=0;i<(drop as InstancedMesh).count;i++){
    (drop as InstancedMesh).getMatrixAt(i,matrix);const e=matrix.elements,column=before.field!.columns.find((c)=>c.originMeters[0]===e[12]&&c.originMeters[2]===e[14])!;
    expect(column).toBeDefined();if(column.hitPointMeters)expect(e[13]).toBeGreaterThan(column.hitPointMeters[1]+0.04);
  }
  effect.setFrame(createFrameInput({...frame,tick:600,seconds:10}));effect.setFrame(frame);
  expect(Array.from(drop.instanceMatrix.array)).toEqual(matrices);expect(effect.readRainView()).toEqual(before);
  const digest=getFixtureDigest(fixture);await effect.replaceFixture(fixture);effect.setFrame(frame);expect(getFixtureDigest(fixture)).toBe(digest);
  await effect.replaceFixture(replay.scenario.snapshots[0].manifest);effect.setFrame(createFrameInput({...frame,sourceRevision:1}));
  const opened=effect.readRainView();expect(opened.sourceRevision).toBe(1);expect(opened.field!.columns.some((c,i)=>c.hitDistanceMeters!==before.field!.columns[i].hitDistanceMeters)).toBe(true);
  effect.setFrame(createFrameInput({...frame,sourceRevision:1,weather:{...frame.weather,rain01:0}}));
  expect(effect.readRainView().visibleParticles).toBe(0);expect(effect.readFacts().logicalCosts.instanceUploadBytes.value).toBe((96+16)*16*4);
  effect.setFrame(createFrameInput({...frame,sourceRevision:1,weather:{...frame.weather,windMps:[12,0,0]}}));
  const gust=effect.readRainView();expect(gust.field!.direction).toEqual(gust.direction);
  effect.setFrame(createFrameInput({...frame,sourceRevision:1,weather:{...frame.weather,rain01:0,windMps:[0,0,0]}}));
  const off=effect.readRainView();expect(off.coverage).toBe('not-sampled');expect(off.field).toBeNull();expect(off.direction).toEqual([0,-1,0]);
  await effect.dispose();expect(root.children).toHaveLength(0);expect(()=>effect.readRainView()).toThrow(/disposed/);
});
it('RAIN03 malformed comparison distances/direction/travel/variants cannot become parity',async()=>{
  const fixture=(await fixtureReplay('F03-SHELTER-REPLAY')).initialFixture,index=createVoxelSourceIndex(fixture),depth=createRainDepthProjection(fixture);
  const control=buildRainColumns(index,[0,-12,0],8),candidate=buildRainColumns(index,[0,-12,0],8,depth),i=candidate.columns.findIndex((c)=>c.status==='solid');
  for(const value of [NaN,Infinity,-1,100]){const columns=[...candidate.columns];columns[i]={...columns[i],hitDistanceMeters:value};
    expect(()=>compareRainDepthProjection(control,{...candidate,columns},index.quantumMeters)).toThrow();}
  expect(()=>compareRainDepthProjection(control,{...candidate,travelMeters:candidate.travelMeters+1},index.quantumMeters)).toThrow();
  expect(()=>compareRainDepthProjection(control,{...candidate,variant:'source-query'},index.quantumMeters)).toThrow();
  expect(()=>compareRainDepthProjection({...control,direction:[NaN,-1,0]},candidate,index.quantumMeters)).toThrow();
  depth.dispose();index.dispose();
});
it('RAIN03/RAIN04/RAIN05 unknown coverage stays unqualified and allocation/lifecycle inputs reject',async()=>{
  const fixture=(await fixtureReplay('F03-SHELTER-REPLAY')).initialFixture,index=createVoxelSourceIndex(fixture);
  const field=buildRainColumns(index,[6,-12,0],8);expect(field.columns.some((c)=>c.status==='unknown')).toBe(true);expect(field.queries).toBeLessThanOrEqual(65536);
  expect(()=>buildRainColumns(index,[0,-12,0],1000)).toThrow(/budget/);index.dispose();
  const root=new Group(),frame=createFrameInput({tick:0,seconds:0,paused:true,cameraId:fixture.cameras[0].id,sourceRevision:fixtureRevision(fixture),weather:{windMps:[0,0,0],rain01:1,snow01:0,cloud01:1}});
  const context:ThreeLabEffectContext={root,fixture,frame,scene:new Scene(),camera:new PerspectiveCamera(),resetTick:null,signal:new AbortController().signal,capabilities:{},ownerPose:(id)=>ownerPose(fixture,id)};
  await expect(mountThreeEffect(context,{id:'source-query',parameters:{particles:999999}})).rejects.toThrow(/budget/);expect(root.children).toHaveLength(0);
});
