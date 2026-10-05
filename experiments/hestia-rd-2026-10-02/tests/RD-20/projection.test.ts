import { expect,it } from 'vitest';
import { Group,Mesh,PerspectiveCamera,Scene } from 'three';
import { buildPatchRecipe } from '../../src/experiments/foliage-shapes';
import { buildPatchFixture,validatePatchProjection } from '../../src/experiments/foliage-shapes/fixture';
import { mountThreeEffect } from '../../src/experiments/foliage-wind';
import { fixtureRevision,getFixtureDigest } from '../../src/contracts/fixture';
import { createFrameInput } from '../../src/contracts/experiment';
import { ownerPose } from '../../src/runner/threeHost';
import { id } from '../../src/contracts/validation';
import { fixtureReplay } from '../resume/fixtures';
const sites=[{id:'land',positionMeters:[0,0,0],slope01:0,water:false,clearing:false},{id:'shore',positionMeters:[2,0,0],slope01:0,water:true,clearing:false}];
it('FOL04/WND02 native projection adapter shares payloads, binds real support anchors and keeps wood static',async()=>{
 const patch=buildPatchRecipe({seed:23,density01:1,maxSlope01:.4,candidates:[...sites,{...sites[0],id:'second',positionMeters:[3,0,0]}],plant:{shape:'young',heightCells:24,crownRadiusCells:3,rootScale01:1}}),build=await buildPatchFixture(patch),fixture=build.fixture;
 for(const p of patch.plants)for(const w of p.recipe.wood)id(w.id);
 const woods=fixture.objects.filter(o=>o.materialRoles.includes('wood'));expect(woods[0].meshes[0].positions).toBe(woods[1].meshes[0].positions);
 expect(build.costs.decorMassKg).toBe(0);expect(fixture.voxelRegions!.every(r=>!r.ownerId.includes('decor:')&&!r.ownerId.startsWith('under:'))).toBe(true);
 const root=new Group(),frame=createFrameInput({tick:60,seconds:1,paused:true,cameraId:fixture.cameras[0].id,sourceRevision:fixtureRevision(fixture),weather:{windMps:[2,0,1],rain01:0,cloud01:0,snow01:0}}),effect=await mountThreeEffect({root,scene:new Scene(),camera:new PerspectiveCamera(),fixture,frame,resetTick:null,signal:new AbortController().signal,capabilities:{},ownerPose:owner=>ownerPose(fixture,owner)},{id:'rigid'});
 effect.setFrame(frame);const leaves:Mesh[]=[],wood:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh){if(o.name.endsWith(':foliage'))leaves.push(o);if(o.name.endsWith(':wood'))wood.push(o);}});
 expect(leaves).toHaveLength(10);expect(leaves.every(m=>m.parent!.position.length()===0)).toBe(true);expect(leaves[0].parent!.rotation.z).not.toBe(leaves[5].parent!.rotation.z);
 expect(wood.every(m=>m.position.length()===0&&m.rotation.z===0)).toBe(true);expect(effect.readFacts().fixtureDigest).toBe(getFixtureDigest(fixture));await effect.dispose();expect(root.children).toHaveLength(0);
});
it('FOL03/FOL04 whole-population budget and overlong generated identities reject explicitly',async()=>{
 expect(()=>buildPatchRecipe({seed:23,density01:1,maxSlope01:.4,candidates:[{...sites[0],id:'a'.repeat(128)}]})).toThrow(/identities/);
 const recipe=buildPatchRecipe({seed:23,density01:1,maxSlope01:.4,candidates:[{...sites[0],positionMeters:[999,0,0]},{...sites[0],id:'other',positionMeters:[-999,0,0]}]});await expect(buildPatchFixture(recipe)).rejects.toThrow(/bounded flat/);
});
it('WND01 fixed 1.8m F05 human presentation marker is never treated as movable flora',async()=>{
 const fixture=(await fixtureReplay('F05-CUTOUT-REPLAY')).initialFixture,root=new Group(),frame=createFrameInput({tick:0,seconds:0,paused:true,cameraId:fixture.cameras[0].id,sourceRevision:fixtureRevision(fixture),weather:{windMps:[4,0,1],rain01:0,cloud01:0,snow01:0}});
 await expect(mountThreeEffect({root,scene:new Scene(),camera:new PerspectiveCamera(),fixture,frame,resetTick:null,signal:new AbortController().signal,capabilities:{},ownerPose:owner=>ownerPose(fixture,owner)},{id:'rigid'})).rejects.toThrow(/no source-bound/);expect(root.children).toHaveLength(0);
});
it('FOL03 repeated shared templates are counted per projected owner before native projection',async()=>{const recipe=buildPatchRecipe({seed:23,density01:1,maxSlope01:.4,candidates:Array.from({length:64},(_,i)=>({...sites[0],id:`repeat-${i}`})),plant:{shape:'young',heightCells:16,crownRadiusCells:8,rootScale01:.25}}),built=await buildPatchFixture(recipe);expect(built.costs.projectionBytes).toBe(validatePatchProjection(built.fixture));expect(built.costs.projectionBytes).toBeGreaterThan(built.costs.payloadBytes*10);expect(()=>validatePatchProjection({...built.fixture,objects:[...built.fixture.objects,...built.fixture.objects]})).toThrow(/whole-population projection budget/);});
