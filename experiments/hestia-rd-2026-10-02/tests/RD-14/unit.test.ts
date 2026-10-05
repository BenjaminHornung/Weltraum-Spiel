import { expect,it } from 'vitest';
import { Group,Mesh,MeshDepthMaterial,MeshNormalMaterial,MeshStandardMaterial,PerspectiveCamera,Scene } from 'three';
import { fixtureReplay } from '../resume/fixtures';
import { createFrameInput } from '../../src/contracts/experiment';
import { copyFixturePayload,fixtureRevision,getFixtureDigest,importFixture,type LabFixtureV1 } from '../../src/contracts/fixture';
import { canonicalJson,sha256 } from '../../src/contracts/validation';
import unitSource from './unit.test.ts?raw';
import { labSunDirection,ownerPose,type ThreeLabEffectContext } from '../../src/runner/threeHost';
import { mountThreeEffect } from '../../src/experiments/material-light';
import { mountThreeEffect as mountWind } from '../../src/experiments/foliage-wind';
import { mountThreeEffect as mountControl } from '../../src/experiments/three-control';
import { mountThreeEffect as mountWet } from '../../src/experiments/wet-surface';
it('MAT02 concurrent same-name snapshot incarnations discard pre-publication identity work',async()=>{const replay=await fixtureReplay('F04-DETACH-REPLAY'),effect=await mountThreeEffect(context(replay.initialFixture),{id:'rough-wet'}),fixtures=[...replay.fixtures.values()].filter(f=>f.sourceRevision===1||f.sourceRevision===2).sort((a,b)=>a.sourceRevision-b.sourceRevision);const results=await Promise.allSettled(fixtures.map(f=>effect.replaceFixture(f)));expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);expect(effect.readFacts().fixtureDigest).toBe(getFixtureDigest(fixtures[1]));await effect.dispose();});
function context(fixture:LabFixtureV1):ThreeLabEffectContext{return {root:new Group(),scene:new Scene(),camera:new PerspectiveCamera(),fixture,
  frame:createFrameInput({tick:0,seconds:0,paused:true,cameraId:fixture.cameras[0].id,sourceRevision:fixtureRevision(fixture),weather:{windMps:[0,0,0],rain01:0,snow01:0,cloud01:0}}),
  resetTick:null,signal:new AbortController().signal,capabilities:{},ownerPose:(id)=>ownerPose(fixture,id)};}
it('MAT01 material wetness channel changes no fixture/material/source positions or physical authority',async()=>{
  const fixture=(await fixtureReplay('F06-MATERIAL-REPLAY')).initialFixture,c=context(fixture),digest=getFixtureDigest(fixture),before=copyFixturePayload(fixture,fixture.objects[0].meshes[0].positions);
  const effect=await mountThreeEffect(c,{id:'rough-wet'}),binding=effect.readSurfaceBindings()[0];let mesh:Mesh|undefined;
  c.root.traverse((o)=>{if(o instanceof Mesh&&o.userData.surfaceId===binding.surfaceId)mesh=o;});
  expect(mesh).toBeDefined();const positions=new Float32Array(mesh!.geometry.getAttribute('position').array);
  effect.setSurfaceWetness(binding,new Float32Array(binding.vertexCount).fill(0.8));
  effect.setSurfaceWetness(JSON.parse(canonicalJson(binding)),new Float32Array(binding.vertexCount).fill(0.8));
  expect(mesh!.geometry.getAttribute('labWetness').array).toEqual(new Float32Array(binding.vertexCount).fill(0.8));
  expect(mesh!.geometry.getAttribute('position').array).toEqual(positions);expect(copyFixturePayload(fixture,binding.sourcePositions)).toEqual(before);expect(getFixtureDigest(fixture)).toBe(digest);
  const values=new Float32Array(binding.vertexCount).fill(0.2);values[0]=NaN;
  expect(()=>effect.setSurfaceWetness(binding,values)).toThrow();expect(()=>effect.setSurfaceWetness({...binding,sourceRevision:99},new Float32Array(binding.vertexCount))).toThrow();
  expect(mesh!.geometry.getAttribute('labWetness').getX(0)).toBeCloseTo(0.8);await effect.dispose();
});
it('MAT02 shared native key-light direction is one fixture-frame-derived policy',async()=>{
  const fixture=(await fixtureReplay('F06-MATERIAL-REPLAY')).initialFixture,c=context(fixture),effect=await mountThreeEffect(c,{id:'rough-wet'});
  const sun=labSunDirection(fixture);[-1/Math.sqrt(6),2/Math.sqrt(6),-1/Math.sqrt(6)].forEach((v,i)=>expect(sun[i]).toBeCloseTo(v,12));
  expect(effect.readMaterialState().sunDirectionWorld).toEqual(sun);expect(effect.readFacts().unsupportedFeatures).toContain('native-pcf-shadow-parity');await effect.dispose();
});
it('MAT03 opening/source swap rebuilds owned material projection and drops all prior private temporal state',async()=>{
  const replay=await fixtureReplay('F06-MATERIAL-REPLAY'),c=context(replay.initialFixture),effect=await mountThreeEffect(c,{id:'rough-wet'}),binding=effect.readSurfaceBindings()[0];
  effect.setSurfaceWetness(binding,new Float32Array(binding.vertexCount).fill(1));let disposals=0,geometryDisposals=0;
  c.root.traverse((o)=>{if(o instanceof Mesh){const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach((m)=>m.addEventListener('dispose',()=>disposals++));o.geometry.addEventListener('dispose',()=>geometryDisposals++);}});
  await effect.replaceFixture(replay.scenario.snapshots[0].manifest);expect(disposals).toBeGreaterThan(0);expect(geometryDisposals).toBeGreaterThan(0);
  expect(effect.readMaterialState().generation).toBe(1);expect(effect.readFacts().sourceRevision).toBe(1);
  c.root.traverse((o)=>{if(o instanceof Mesh)expect(Array.from(o.geometry.getAttribute('labWetness').array).every((v)=>v===0)).toBe(true);});
  expect(()=>effect.setSurfaceWetness(binding,new Float32Array(binding.vertexCount))).toThrow();await effect.dispose();expect(c.root.children).toHaveLength(0);
});
it('MAT04 actual owned normal/depth/roughness views and water opacity remain inspectable',async()=>{
  const fixture=(await fixtureReplay('F06-MATERIAL-REPLAY')).initialFixture,c=context(fixture),effect=await mountThreeEffect(c,{id:'rough-wet'}),materials=()=>{const result:unknown[]=[];c.root.traverse((o)=>{if(o instanceof Mesh)result.push((o.material as unknown[])[0]);});return result;};
  expect(materials().every((m)=>m instanceof MeshStandardMaterial)).toBe(true);
  effect.setViewMode('normal');expect(materials().every((m)=>m instanceof MeshNormalMaterial)).toBe(true);
  effect.setViewMode('depth');expect(materials().every((m)=>m instanceof MeshDepthMaterial)).toBe(true);
  effect.setViewMode('roughness');expect(effect.readMaterialState().viewMode).toBe('roughness');
  effect.setViewMode('color');expect(materials().every((m)=>m instanceof MeshStandardMaterial)).toBe(true);
  expect(()=>effect.setViewMode('bloom' as never)).toThrow();expect(effect.readMaterialState().viewMode).toBe('color');await effect.dispose();
});
it('MAT01/RD21 composition splits source projections by ownership without duplicate terrain or lost decor',async()=>{
  const fixture=(await fixtureReplay('F02-ROOT-GROVE-REPLAY')).initialFixture,controlContext=context(fixture),materialContext=context(fixture),windContext=context(fixture);
  const control=await mountControl(controlContext,{id:'fixture-control'}),material=await mountThreeEffect(materialContext,{id:'rough-wet'}),wind=await mountWind(windContext,{id:'rigid',parameters:{projection:'decor'}});
  const names=(root:Group)=>{const entries:string[]=[];root.traverse((o)=>{if(o instanceof Mesh)entries.push(o.name);});return entries.sort();};
  const solids=names(materialContext.root),decor=names(windContext.root);
  expect([...solids,...decor].sort()).toEqual(names(controlContext.root));expect(solids).not.toContain('root-tree:leaf');expect(solids).toContain('root-tree:wood');
  expect(decor).toEqual(['root-tree:accent','root-tree:leaf']);expect(wind.readFacts().logicalCosts.windClusters.value).toBe(2);
  await control.dispose();await material.dispose();await wind.dispose();expect(materialContext.root.children).toHaveLength(0);expect(windContext.root.children).toHaveLength(0);
});
it('MAT01 shared canonical payloads across owners and same-owner meshes have independent surface bindings and wet face IDs',async()=>{
  const original=(await fixtureReplay('F03-SHELTER-REPLAY')).initialFixture,roof=original.objects.find((o)=>o.ownerId==='removable-roof')!;
  const shared={...roof,ownerId:'shared-roof',frame:{...roof.frame,id:'shared-roof',originMeters:[0.5,0,0]},meshes:[...roof.meshes,{...roof.meshes[0],materialId:'wet'}],materialRoles:['limestone-dry','limestone-wet']};
  const recipe={...original,id:'RD14-SHARED-PAYLOAD-TEST',objects:[...original.objects,shared],sourceRefs:[]};
  const sourceRefs=[{kind:'synthetic',generatorPath:'tests/RD-14/unit.test.ts',generatorCodeSha256:await sha256(new TextEncoder().encode(unitSource)),generatorVersion:'shared-payload-unit-v1',seed:0,testOnly:true,sourceDigest:await sha256(new TextEncoder().encode(canonicalJson(recipe)))}];
  const payloads=new Map(original.payloads.map((p)=>{const values=copyFixturePayload(original,p.id);return [p.id,new Uint8Array(values.buffer,values.byteOffset,values.byteLength).slice()] as const;}));
  const fixture=await importFixture(new TextEncoder().encode(canonicalJson({...recipe,sourceRefs})),payloads),c=context(fixture),effect=await mountThreeEffect(c,{id:'rough-wet'});
  const bindings=effect.readSurfaceBindings().filter((b)=>b.sourcePositions===roof.meshes[0].positions);expect(bindings).toHaveLength(3);expect(new Set(bindings.map((b)=>b.surfaceId)).size).toBe(3);
  for(let i=0;i<bindings.length;i++)effect.setSurfaceWetness(bindings[i],new Float32Array(bindings[i].vertexCount).fill(i/2));
  const projected=new Map<string,number>();c.root.traverse((o)=>{if(o instanceof Mesh&&bindings.some((b)=>b.surfaceId===o.userData.surfaceId))projected.set(o.userData.surfaceId,o.geometry.getAttribute('labWetness').getX(0));});
  bindings.forEach((b,i)=>expect(projected.get(b.surfaceId)).toBe(i/2));await effect.dispose();
  const w=context(fixture),wet=await mountWet(w,{id:'analytic-current-exposure'});wet.setFrame(createFrameInput({...w.frame,tick:600,seconds:10,weather:{windMps:[0,0,0],rain01:0.8,snow01:0,cloud01:0.8}}));
  const samples=wet.readWetnessState().result!.samples;expect(new Set(samples.map((s)=>s.id)).size).toBe(samples.length);await wet.dispose();
});
