import{createThreeLabHost,type ThreeLabHost}from'../../runner/threeHost';
import{type LabExperimentContext}from'../../contracts/experiment';
import{requireValue}from'../../contracts/validation';
import{mountThreeEffect as mountWet,createWetnessPreset,type WetSurfaceEffect}from'../../experiments/wet-surface';
import{mountThreeEffect as mountWind,type WindEffect}from'../../experiments/foliage-wind';
import{mountThreeEffect as mountCamera}from'../../experiments/camera-occlusion';
export const COMBINED_WETNESS=createWetnessPreset({schema:'hestia-rd-wetness-v1',id:'combined-rain-timeline',sourcePolicy:'reset-at-snapshot',model:'current-exposure-analytic',wettingPerSecond:.35,dryingPerSecond:.08,rainHistory:[{tick:0,rain01:0},{tick:240,rain01:.8},{tick:1320,rain01:0}]});
export async function createCombinedSceneExperiment(context:LabExperimentContext){
 requireValue(context.preset.id==='combined-rigid'||context.preset.id==='combined-static','Unknown combined variant');let candidateWet:WetSurfaceEffect;
 const host=await createThreeLabHost(context,[{mount:async(c,p)=>{candidateWet=await mountWet(c,p);return candidateWet;},preset:{id:'analytic-current-exposure'}},{mount:(c,p)=>mountWind(c,p,true),preset:{id:context.preset.id==='combined-static'?'static':'rigid',parameters:{projection:'decor'}}},{mount:(c,p)=>{const owner=candidateWet;return mountCamera(c,p,planes=>owner.setViewCutout(planes));},preset:{id:'clip-corridor'}}],'RD-51');
 return Object.assign(host,{setTimeline(epoch:number){host.effectAt<WetSurfaceEffect>(0).setWetnessTimeline(COMBINED_WETNESS,epoch);},readCombined(){const wet=host.effectAt<WetSurfaceEffect>(0),wind=host.effectAt<WindEffect>(1),camera=host.effectAt<Awaited<ReturnType<typeof mountCamera>>>(2);return{wet:wet.readWetnessState(),wind:wind.readWindState(),camera:camera.readOcclusion(),effects:[wet.readFacts(),wind.readFacts(),camera.readFacts()]};},setViewMode:((view)=>{host.effectAt<WetSurfaceEffect>(0).setViewMode(view);host.markPresentationChanged();})as WetSurfaceEffect['setViewMode'],setWindReduced(value:boolean){const wind=host.effectAt<WindEffect>(1);wind.setWindParameters(.75,value,0);wind.setFrame(host.readDiagnostics().frame);host.markPresentationChanged();}});
}
export type CombinedSceneHost=Awaited<ReturnType<typeof createCombinedSceneExperiment>> & ThreeLabHost;
