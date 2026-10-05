import { createFrameInput,mountExperiment,registeredMountCount,type LabExperimentHandle } from '../../contracts/experiment';
import { getFixtureDigest } from '../../contracts/fixture';
import { createControlledClock,sampleScenario } from '../../contracts/scenario';
import { loadInventory,loadReplay,publicAssetRoot } from '../../runner/assets';
import { liveThreeHostCounts } from '../../runner/threeHost';
import type { MaterialViewMode } from '../material-light';
import { WEATHER_PRESETS,sampleWeatherAt } from '../weather-field';
import { createWetSurfaceExperiment,DEFAULT_WETNESS_PRESET,sampleWetnessRainInput,type WetSurfaceLabHost } from './index';
const element=<T extends HTMLElement>(id:string)=>document.getElementById(id)! as T;
const canvas=element<HTMLCanvasElement>('view'),status=element('status'),facts=element('facts'),scenario=element<HTMLSelectElement>('scenario'),camera=element<HTMLSelectElement>('camera'),viewMode=element<HTMLSelectElement>('viewMode');
const root=publicAssetRoot(import.meta.env.BASE_URL,location.href);
let host:WetSurfaceLabHost|undefined,handle:LabExperimentHandle|undefined,abort:AbortController|undefined,replay:Awaited<ReturnType<typeof loadReplay>>|undefined,clock=createControlledClock(1800),timer:number|undefined,busy=false;
function stop(){if(timer!==undefined){clearInterval(timer);timer=undefined;}}
function publish(){
  const wet=host?.readWetnessState(),result=wet?.result;
  const samples=result?.samples??[],summary=result?{...result,samples:[...samples.filter((s)=>s.exposure==='shielded').slice(0,8),...samples.filter((s)=>s.exposure==='exposed').slice(0,8),...samples.filter((s)=>s.exposure==='unknown').slice(0,8)],
    sampleCount:samples.length,protectedSamples:samples.filter((s)=>s.exposure==='shielded').length,wetSamples:samples.filter((s)=>s.wetness01>0).length,maximumWetness01:Math.max(0,...samples.map((s)=>s.wetness01))}:null;
  facts.textContent=JSON.stringify({mode:'presentation-replay / current-exposure analytic',clock:clock.read(),facts:host?.readFacts(),wetness:wet?{...wet,result:summary}:null,diagnostics:host?.readDiagnostics(),mounts:registeredMountCount(),liveHosts:liveThreeHostCounts(),productIntegrated:false},null,2);
}
async function frame(){if(!host||!replay)return;const time=clock.read(),sample=sampleScenario(replay.scenario,time.tick,time.paused);
  if(host.readFacts().fixtureDigest!==getFixtureDigest(sample.fixture))await handle!.replaceFixture(sample.fixture);
  const sourceTick=replay.scenario.snapshots.filter((entry)=>entry.tick<=time.tick).at(-1)?.tick??0;
  host.setWetnessTimeline(DEFAULT_WETNESS_PRESET,Math.max(sourceTick,sample.resetTick??0));host.setResetTick(sample.resetTick);
  const rain=sampleWetnessRainInput(DEFAULT_WETNESS_PRESET,time.tick),preset=rain>0?WEATHER_PRESETS.rain:time.tick<240?WEATHER_PRESETS.clear:WEATHER_PRESETS.breeze;
  host.setViewMode(viewMode.value as MaterialViewMode);
  handle!.setFrame(createFrameInput({...sample.frame,cameraId:camera.value,weather:sampleWeatherAt(sample.fixture.frame.originMeters,time.tick,preset)}));publish();}
async function command(action:()=>Promise<void>|void,message:string){if(busy)return;busy=true;try{await action();status.textContent=message;}catch(error){stop();const reason=String(error);
  try{host?.readFacts();}catch{await dispose();}status.textContent=`Rejected: ${reason}`;}finally{busy=false;publish();}}
async function dispose(){stop();abort?.abort();await handle?.dispose();host=undefined;handle=undefined;abort=undefined;scenario.disabled=false;}
element('mount').onclick=()=>{void command(async()=>{await dispose();replay=await loadReplay(inventory,scenario.value,root);clock=createControlledClock(replay.scenario.durationTicks);abort=new AbortController();
  handle=await mountExperiment(async(context)=>{host=await createWetSurfaceExperiment(context);return host;},{canvas,fixture:replay.initialFixture,preset:{id:'analytic-current-exposure'},signal:abort.signal,capabilities:{}});
  camera.replaceChildren();for(const entry of replay.initialFixture.cameras){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.id;camera.add(option);}camera.value='near';scenario.disabled=true;await frame();},'Nässe + Regen aktiv — gemeinsamer Materialkanal');};
element('dispose').onclick=()=>{void command(dispose,'Disposed');};
element('seek').onclick=()=>{stop();void command(async()=>{clock.seek(Number(element<HTMLInputElement>('tick').value));await frame();},'Seek angewendet');};
element('reset').onclick=()=>{stop();void command(async()=>{clock.reset();element<HTMLInputElement>('tick').value='0';await frame();},'Reset angewendet');};
element('pause').onclick=()=>{stop();void command(async()=>{clock.pause(true);await frame();},'Pausiert');};
element('play').onclick=()=>{stop();void command(async()=>{if(!host||!replay)throw Error('Zuerst Laborquelle starten');clock.pause(false);await frame();timer=window.setInterval(()=>{if(clock.read().tick>=replay!.scenario.durationTicks){stop();return;}void command(async()=>{clock.advance(1);await frame();},'Play — kontrollierte 60-Hz-Ticks');},1000/60);},'Play');};
camera.onchange=viewMode.onchange=()=>{void command(frame,'Ansicht angewendet');};
canvas.addEventListener('three-lab-rendered',()=>{if(!busy&&host)publish();});
canvas.addEventListener('three-lab-error',()=>{stop();status.textContent='Rendererfehler — siehe native Konsole';});
window.addEventListener('pagehide',()=>{void dispose();},{once:true});
const inventory=await loadInventory(root);for(const entry of inventory.scenarios.filter((s)=>['F03-SHELTER-REPLAY','F06-MATERIAL-REPLAY','F04-DETACH-REPLAY'].includes(s.id))){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.id;scenario.add(option);}
scenario.value='F03-SHELTER-REPLAY';element<HTMLButtonElement>('mount').disabled=false;status.textContent='Bereit — Laborquelle eingefroren';publish();
