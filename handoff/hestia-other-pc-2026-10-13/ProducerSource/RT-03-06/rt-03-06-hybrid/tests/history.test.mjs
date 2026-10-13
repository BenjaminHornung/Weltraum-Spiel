import test from 'node:test';
import assert from 'node:assert/strict';
import {OcclusionHistory,spatialFilter} from '../dist/src/history.mjs';

const binding=(owner='ship-a')=>({domain:'hestia',world:'world-1',session:'session-1',epoch:'epoch-1',owner,sourceRevision:1,sourceGeneration:1,sourceDigest:'a'.repeat(64),frame:'world',originEpoch:1,transformGeneration:1,materialDigest:'b'.repeat(64),algorithm:'dda-v1'});
const shadow=()=>({light:['sun-1',1],casters:[{id:'ship-a',values:['fragment-1',1]}]});
const frame=(values={})=>({width:3,height:3,frameIndex:0,deviceEpoch:1,cameraEpoch:1,windEpoch:1,sourceBindings:[binding()],shadowRevision:shadow(),...values});
const pixel=(values={})=>({owner:'ship-a',materialId:'steel',depth:5,normal:[0,0,1],velocity:[0,0],occlusion:.5,status:'CURRENT',...values});
const image=(values={})=>Array.from({length:9},()=>pixel(values));

test('reprojects the nearest prior pixel and clamps history to the current surface neighborhood',()=>{
 const history=new OcclusionHistory(),previous=image({occlusion:.9}),current=image({occlusion:.3});
 current[4].occlusion=.5;current[4].velocity=[1,0];current[5].occlusion=.6;
 assert.equal(history.apply(frame(),previous).reused,0);
 const result=history.apply(frame({frameIndex:1}),current);
 assert.equal(result.reused,9);
 assert.equal(result.pixels[4].occlusion,.55);
 assert.equal(result.pixels[4].owner,'ship-a');
 history.dispose();
});

test('frame, source, light, caster, camera, device, wind, and resize changes invalidate the prior frame',()=>{
 const variants=[
  ['frame gap',f=>({...f,frameIndex:2})],['device epoch',f=>({...f,deviceEpoch:2})],
  ['camera teleport',f=>({...f,cameraEpoch:2})],['wind epoch',f=>({...f,windEpoch:2})],
  ['resize',f=>({...f,width:2,height:2})],
  ['sun revision',f=>({...f,shadowRevision:{...f.shadowRevision,light:['sun-1',2]}})],
  ['caster revision',f=>({...f,shadowRevision:{...f.shadowRevision,casters:[{id:'ship-a',values:['fragment-1',2]}]}})],
 ];
 for(const [name,change] of variants){
  const history=new OcclusionHistory();history.apply(frame(),image());
  const next=change(frame({frameIndex:1})),pixels=next.width===2?Array.from({length:4},()=>pixel()):image();
  const result=history.apply(next,pixels);
  assert.equal(result.invalidated,true,name);assert.equal(result.reused,0,name);history.dispose();
 }
 const fields=['domain','world','session','epoch','owner','sourceRevision','sourceGeneration','sourceDigest','frame','originEpoch','transformGeneration','materialDigest','algorithm'];
 for(const key of fields){
  const history=new OcclusionHistory(),first=binding();history.apply(frame({sourceBindings:[first]}),image());
  const next={...first,[key]:typeof first[key]==='number'?first[key]+1:(key.endsWith('Digest')?(first[key][0]==='a'?'c':'a')+first[key].slice(1):`${first[key]}-next`)};
  const pixels=image({owner:next.owner});
  const result=history.apply(frame({frameIndex:1,sourceBindings:[next]}),pixels);
  assert.equal(result.invalidated,true,key);assert.equal(result.reused,0,key);history.dispose();
 }
 const a=binding('ship-a'),b=binding('ship-b');
 for(const [priorBindings,nextBindings] of [[[a,b],[b,a]],[[a],[a,b]]]){
  const history=new OcclusionHistory();
  history.apply(frame({sourceBindings:priorBindings}),image());
  const result=history.apply(frame({frameIndex:1,sourceBindings:nextBindings}),image());
  assert.equal(result.invalidated,true);assert.equal(result.reused,0);history.dispose();
 }
});

test('reprojection rejects outside, depth, normal, owner, and material mismatches',()=>{
 const mismatches=[
  ['outside',pixel({velocity:[1,0]})],['depth',pixel({depth:5.002})],
  ['normal',pixel({normal:[0,1,0]})],['owner',pixel({owner:'ship-b'})],
  ['material',pixel({materialId:'glass'})],
 ];
 for(const [name,oldPixel] of mismatches){
  const history=new OcclusionHistory();history.apply(frame({width:1,height:1}),[oldPixel]);
  const current=pixel({occlusion:.2});
  if(name==='outside')current.velocity=[1,0];
  const result=history.apply(frame({width:1,height:1,frameIndex:1}),[current]);
  assert.equal(result.reused,0,name);assert.equal(result.pixels[0].occlusion,.2,name);history.dispose();
 }
});

test('UNKNOWN, BUDGET, and INVALID_SOURCE discard every retained frame; background never contributes',()=>{
 for(const status of ['UNKNOWN','BUDGET','INVALID_SOURCE']){
  const history=new OcclusionHistory();history.apply(frame(),image({occlusion:.9}));
  const unresolved=image();unresolved[4]=pixel({status});
  const result=history.apply(frame({frameIndex:1}),unresolved);
  assert.equal(result.invalidated,true,status);assert.equal(result.reused,0,status);
  assert.equal(result.retainedPixels,0,status);assert.equal(history.resources().retainedPixels,0,status);
  const later=history.apply(frame({frameIndex:2}),image({occlusion:.2}));
  assert.equal(later.reused,0,status);history.dispose();
 }
 const history=new OcclusionHistory();history.apply(frame(),image({occlusion:.9}));
 const opening=image();opening[4]=pixel({status:'BACKGROUND',owner:'',materialId:''});
 const opened=history.apply(frame({frameIndex:1}),opening);assert.equal(opened.pixels[4].status,'BACKGROUND');
 const after=history.apply(frame({frameIndex:2}),image({occlusion:.2}));assert.equal(after.reused,8);history.dispose();
});

test('malformed input resets history, returned and input mutations cannot alter retained snapshots',()=>{
 const history=new OcclusionHistory(),first=frame(),previous=image({occlusion:.9});
 const emitted=history.apply(first,previous);previous[3].occlusion=0;emitted.pixels[3].occlusion=0;
 first.sourceBindings[0].sourceRevision=9;
 const current=image({occlusion:.2});current[4].occlusion=.4;current[4].velocity=[1,0];current[5].occlusion=.6;
 const next=history.apply(frame({frameIndex:1}),current);
 assert.equal(next.pixels[4].occlusion,.5);
 assert.throws(()=>history.apply(frame({frameIndex:2,width:65,height:65}),Array(4225).fill(pixel())),/pixel|dimension|frame/i);
 assert.equal(history.resources().retainedPixels,0);
 assert.throws(()=>history.apply(frame(),[pixel({owner:''}),...image().slice(1)]),/owner|pixel|invalid/i);
 assert.equal(history.resources().retainedPixels,0);history.dispose();
});

test('spatial filter respects surface edges and history remains bounded with idempotent release',()=>{
 const pixels=image();pixels.forEach((p,i)=>p.occlusion=(i+1)/10);
 pixels[0].status='UNKNOWN';pixels[1].status='BACKGROUND';pixels[2].materialId='glass';
 pixels[3].depth=5.002;pixels[5].owner='ship-b';pixels[7].normal=[0,1,0];
 const filtered=spatialFilter(frame(),pixels);
 assert.ok(Math.abs(filtered[4].occlusion-.7)<1e-12);
 assert.equal(filtered[0].occlusion,.1);
 assert.equal(filtered[5].owner,'ship-b');
 const history=new OcclusionHistory();let result;
 for(let frameIndex=0;frameIndex<10;frameIndex++)result=history.apply(frame({frameIndex}),image());
 assert.ok(result.retainedPixels<=36);assert.equal(history.resources().retainedPixels,result.retainedPixels);
 history.reset();assert.equal(history.resources().retainedPixels,0);history.reset();
 assert.equal(history.dispose(),true);assert.equal(history.dispose(),false);assert.equal(history.resources().retainedPixels,0);
 assert.throws(()=>history.apply(frame(),image()),/disposed/i);
});
