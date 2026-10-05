import { Box3,Box3Helper,Group,Mesh } from 'three';
import { fixtureRevision,getFixtureDigest,type LabFixtureV1 } from '../../contracts/fixture';
import { createFrameInput,validateFacts,type LabExperimentContext,type LabPreset } from '../../contracts/experiment';
import { requireValue,freezeJson } from '../../contracts/validation';
import { createThreeLabHost,type ThreeLabEffectContext } from '../../runner/threeHost';
import { mountThreeEffect as mountWind,type WindEffect } from '../foliage-wind';
export type LifecycleView='all'|'wood'|'decor'|'bounds';
export function lifecycleBindings(fixture:LabFixtureV1){getFixtureDigest(fixture);return freezeJson({fixtureDigest:getFixtureDigest(fixture),sourceRevision:fixtureRevision(fixture),
 owners:fixture.objects.map(o=>({ownerId:o.ownerId,namespace:o.sourceNamespace,revision:o.sourceRevision,sourceIds:o.sourceIds,frame:o.frame,bounds:o.bounds})),attachments:fixture.attachments??[],
 shadow:'UNSUPPORTED_NATIVE_SHADOWS',mass:'SOURCE_UNCHANGED_NO_NATIVE_PHYSICS_ACCEPTANCE'});}
/** Snapshot lifecycle, not a cut implementation. Empty post-removal decoration is an accepted terminal state. */
export async function mountThreeEffect(context:ThreeLabEffectContext,preset:LabPreset){
 requireValue(['static','rigid','vertex'].includes(preset.id),'Unknown lifecycle variant');let fixture=context.fixture,disposed=false,view:LifecycleView='all';
 const projection=context.root,overlay=new Group();projection.add(overlay);let boxes:Box3Helper[]=[];
 let native:WindEffect;try{native=await mountWind(context,preset,true);}catch(error){overlay.removeFromParent();throw error;}
 function clearBoxes(){for(const b of boxes){b.removeFromParent();b.geometry.dispose();for(const material of Array.isArray(b.material)?b.material:[b.material])material.dispose();}boxes=[];}
 function apply(){const meshes:Mesh[]=[];projection.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});for(const mesh of meshes){const decor=mesh.userData.presentationOnly===true||mesh.name.endsWith(':leaf');mesh.visible=view==='all'||view==='bounds'||(view==='decor'?decor:!decor);}
  if(view!=='bounds'){clearBoxes();return;}projection.updateMatrixWorld(true);
  if(boxes.length===0)for(const object of fixture.objects){const owner=projection.getObjectByName(object.ownerId);if(owner){const box=new Box3Helper(new Box3().setFromObject(owner),0xffc665);box.userData.ownerId=object.ownerId;overlay.add(box);boxes.push(box);}}
  for(const box of boxes){const owner=projection.getObjectByName(box.userData.ownerId);if(owner)box.box.setFromObject(owner);}}
 const effect:WindEffect&{setLifecycleView(v:LifecycleView):void;readLifecycle():ReturnType<typeof lifecycleBindings>}={
  setFrame(input){requireValue(!disposed,'Lifecycle disposed');const frame=createFrameInput(input);requireValue(frame.sourceRevision===fixtureRevision(fixture),'Stale lifecycle source');native.setFrame(frame);apply();},
  async replaceFixture(next){requireValue(!disposed,'Lifecycle disposed');await native.replaceFixture(next);clearBoxes();fixture=next;apply();},
  setWindParameters: (...args)=>native.setWindParameters(...args),readWindState:()=>native.readWindState(),
  setLifecycleView(next){requireValue(!disposed&&['all','wood','decor','bounds'].includes(next),'Invalid lifecycle view');view=next;apply();},readLifecycle:()=>lifecycleBindings(fixture),
  readFacts(){const facts=native.readFacts();return validateFacts({...facts,experimentId:'RD-23',liveResources:{...facts.liveResources,boundsHelpers:{status:'measured',value:boxes.length,unit:'count'}}});},
  async dispose(){if(!disposed){disposed=true;clearBoxes();overlay.removeFromParent();await native.dispose();}}
 };return effect;
}
export async function createFoliageLifecycleExperiment(context:LabExperimentContext){
 const host=await createThreeLabHost(context,[{mount:mountThreeEffect,preset:context.preset}],'RD-23'),effect=()=>host.effectAt<Awaited<ReturnType<typeof mountThreeEffect>>>(0);
 return Object.assign(host,{setLifecycleView(view:LifecycleView){effect().setLifecycleView(view);host.markPresentationChanged();},readLifecycle:()=>effect().readLifecycle(),readWindState:()=>effect().readWindState()});}
