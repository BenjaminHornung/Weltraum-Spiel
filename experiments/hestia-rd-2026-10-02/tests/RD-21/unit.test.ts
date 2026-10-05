import { expect, it } from 'vitest';
import { Group, Mesh, PerspectiveCamera, Quaternion, Scene, Vector3 } from 'three';
import { buildPlantRecipe } from '../../src/experiments/foliage-shapes';
import { applyWindInputs, deformDecorVertices, mountThreeEffect, windBounds } from '../../src/experiments/foliage-wind';
import { createFrameInput,type LabPreset } from '../../src/contracts/experiment';
import { copyFixturePayload, fixtureRevision, getFixtureDigest } from '../../src/contracts/fixture';
import { ownerPose, type ThreeLabEffectContext } from '../../src/runner/threeHost';
import { fixtureReplay } from '../resume/fixtures';
const weather = { windMps: [4,0,1] as const, rain01: 0.8, cloud01: 0.8, snow01: 0 };
const rotation = [0,0,0,1] as const;

it('WND01 wood/collision/source/mass remain identical through every wind time', () => {
  const plant=buildPlantRecipe('umbrella',23); const before=JSON.stringify(plant);
  for(const tick of [0,1,60,300,900,3600]) for(const d of plant.decor) applyWindInputs(d.id,tick,d.stiffness,weather,rotation);
  expect(JSON.stringify(plant)).toBe(before);
});
it('WND02 30/60/144 render cadences and instance ordering preserve the same source phase', () => {
  const ids=['decor:2','decor:0','decor:1'];
  const first=ids.map((id)=>applyWindInputs(id,600,0.8,weather,rotation));
  expect([...ids].reverse().map((id)=>applyWindInputs(id,600,0.8,weather,rotation)).reverse()).toEqual(first);
  for(const fps of [30,60,144]){for(let frame=0;frame<fps*10;frame++)applyWindInputs(ids[0],Math.round(frame*60/fps),0.8,weather,rotation);expect(applyWindInputs(ids[0],600,0.8,weather,rotation)).toEqual(first[0]);}
});
it('WND03 world wind is transformed exactly once into a rotated owner frame', () => {
  const q = [0,Math.SQRT1_2,0,Math.SQRT1_2] as const;
  const pose=applyWindInputs('decor:test',300,0.7,{...weather,windMps:[4,0,0]},q);
  expect(pose.localWindMps[0]).toBeCloseTo(0); expect(pose.localWindMps[2]).toBeCloseTo(4);
  const restored=new Vector3(...pose.localWindMps).applyQuaternion(new Quaternion(...q));
  expect(restored.x).toBeCloseTo(4); expect(restored.z).toBeCloseTo(0);
});
it('WND04 conservative animated bounds contain rigid and vertex extreme poses', () => {
  const plant=buildPlantRecipe('buttress',23); const bounds=windBounds(plant.bounds,0.16);
  const source=new Float32Array([-1,0,-1, 1,3,1, 0,2,0]), target=new Float32Array(source.length);
  deformDecorVertices(target,source,{x:0.16,z:-0.16},[0,0,0]);
  expect(target[3]).toBeLessThan(source[3]); expect(target[5]).toBeLessThan(source[5]);
  expect(bounds.min.every((v,i)=>v<=plant.bounds.min[i])).toBe(true);
  expect(bounds.max.every((v,i)=>v>=plant.bounds.max[i])).toBe(true);
  expect(() => deformDecorVertices(source,source,{x:0,z:0},[0,0,0])).toThrow();
});
it('WND05 off/reduced motion is static, invalid lifecycle inputs reject before writes', () => {
  const pose=applyWindInputs('decor:test',300,0.7,weather,rotation,true); expect(pose.angles).toEqual({x:0,z:0});
  expect(() => applyWindInputs('decor:test',NaN,0.7,weather,rotation)).toThrow();
  expect(() => applyWindInputs('decor:test',0,0.7,weather,[0,0,0,0])).toThrow();
  const target=new Float32Array([9,9,9]); expect(()=>deformDecorVertices(target,new Float32Array([0,0,0]),{x:1,z:0},[0,0,0])).toThrow();
  expect([...target]).toEqual([9,9,9]);
});

it('WND01/WND04/WND05 real detached F02 mount: only decor moves, vertex extrema fit, stiffness/off and dispose are real',async()=>{
  const replay=await fixtureReplay('F02-ROOT-GROVE-REPLAY'),fixture=replay.initialFixture,digest=getFixtureDigest(fixture);
  const wood=fixture.objects.find((o)=>o.ownerId==='root-tree')!.meshes.find((m)=>m.materialId==='wood')!;
  const canonicalWood=copyFixturePayload(fixture,wood.positions);
  for(const variant of ['static','rigid','vertex'] as const){
    const root=new Group(),abort=new AbortController();
    const input=createFrameInput({tick:0,seconds:0,paused:false,cameraId:fixture.cameras[0].id,sourceRevision:fixtureRevision(fixture),weather:{...weather,windMps:[60,0,60]}});
    const context:ThreeLabEffectContext={root,scene:new Scene(),camera:new PerspectiveCamera(),fixture,frame:input,resetTick:null,signal:abort.signal,capabilities:{},ownerPose:(id)=>ownerPose(fixture,id)};
    const effect=await mountThreeEffect(context,{id:variant,parameters:{stiffness:0}});
    const meshes:Mesh[]=[];root.traverse((object)=>{if(object instanceof Mesh)meshes.push(object);});
    const woodMesh=meshes.find((m)=>m.name==='root-tree:wood')!,woodBefore=new Float32Array(woodMesh.geometry.getAttribute('position').array);
    const leaf=meshes.find((m)=>m.name==='root-tree:leaf')!,leafBefore=new Float32Array(leaf.geometry.getAttribute('position').array);
    const positionBuffer=leaf.geometry.getAttribute('position').array.buffer,normalBuffer=leaf.geometry.getAttribute('normal').array.buffer;
    effect.setFrame(input);effect.setFrame(createFrameInput({...input,tick:60,seconds:1}));
    expect(woodMesh.geometry.getAttribute('position').array).toEqual(woodBefore);expect(woodMesh.position.toArray()).toEqual([0,0,0]);
    expect(copyFixturePayload(fixture,wood.positions)).toEqual(canonicalWood);expect(getFixtureDigest(fixture)).toBe(digest);
    expect(effect.readFacts().logicalCosts.windClusters.value).toBe(2);
    if(variant==='vertex'){
      expect(leaf.geometry.getAttribute('position').array).not.toEqual(leafBefore);
      const positions=leaf.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){const p=new Vector3().fromBufferAttribute(positions,i);expect(leaf.geometry.boundingSphere!.containsPoint(p)).toBe(true);expect(leaf.geometry.boundingBox!.containsPoint(p)).toBe(true);}
    }else{expect(leaf.geometry.getAttribute('position').array).toEqual(leafBefore);if(variant==='rigid')expect(leaf.parent!.rotation.z).not.toBe(0);}
    expect(leaf.geometry.getAttribute('position').array.buffer).toBe(positionBuffer);expect(leaf.geometry.getAttribute('normal').array.buffer).toBe(normalBuffer);
    let disposed=0;for(const mesh of meshes)mesh.geometry.addEventListener('dispose',()=>disposed++);
    await effect.replaceFixture(fixture);expect(disposed).toBe(meshes.length);
    await effect.dispose();expect(root.children).toHaveLength(0);expect(()=>effect.setFrame(input)).toThrow(/disposed/);
  }
});

it('WND05 actual unsaturated mounts consume stiffness1 and reduced-motion rather than a hardcoded default',async()=>{
  const fixture=(await fixtureReplay('F02-ROOT-GROVE-REPLAY')).initialFixture;
  const parameterCases:NonNullable<LabPreset['parameters']>[]=[{stiffness:1},{stiffness:0,reducedMotion:true}];
  for(const variant of ['rigid','vertex'] as const)for(const parameters of parameterCases){
    const root=new Group(),input=createFrameInput({tick:0,seconds:0,paused:false,cameraId:fixture.cameras[0].id,sourceRevision:fixtureRevision(fixture),weather:{...weather,windMps:[2,0,0.5]}});
    const context:ThreeLabEffectContext={root,scene:new Scene(),camera:new PerspectiveCamera(),fixture,frame:input,resetTick:null,signal:new AbortController().signal,capabilities:{},ownerPose:(id)=>ownerPose(fixture,id)};
    const effect=await mountThreeEffect(context,{id:variant,parameters});let leaf:Mesh|undefined;
    root.traverse((object)=>{if(object instanceof Mesh&&object.name==='root-tree:leaf')leaf=object;});
    expect(leaf).toBeDefined();const before=new Float32Array(leaf!.geometry.getAttribute('position').array);
    effect.setFrame(createFrameInput({...input,tick:60,seconds:1}));
    expect(leaf!.parent!.rotation.toArray().slice(0,3)).toEqual([0,0,0]);expect(leaf!.geometry.getAttribute('position').array).toEqual(before);
    await effect.dispose();expect(root.children).toHaveLength(0);
  }
});
