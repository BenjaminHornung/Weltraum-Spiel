import { createFrameInput, mountExperiment, registeredMountCount, type LabExperimentHandle } from '../../contracts/experiment';
import { getFixtureDigest } from '../../contracts/fixture';
import { createControlledClock, sampleScenario } from '../../contracts/scenario';
import { loadInventory, loadReplay, publicAssetRoot } from '../../runner/assets';
import { liveThreeHostCounts, type ThreeLabHost } from '../../runner/threeHost';
import { createFoliageWindExperiment } from './index';
import {createFoliageLifecycleExperiment,type LifecycleView} from '../foliage-lifecycle';
import { WEATHER_PRESETS, sampleWeatherAt } from '../weather-field';
const element=<T extends HTMLElement>(id:string)=>document.getElementById(id)! as T;
const canvas=element<HTMLCanvasElement>('view'),status=element('status'),facts=element('facts'),scenario=element<HTMLSelectElement>('scenario'),variant=element<HTMLSelectElement>('variant'),weather=element<HTMLSelectElement>('weather');
const root=publicAssetRoot(import.meta.env.BASE_URL,location.href);
const lifecycle=new URLSearchParams(location.search).get('mode')==='lifecycle';
let host:ThreeLabHost|undefined,handle:LabExperimentHandle|undefined,abort:AbortController|undefined,replay:Awaited<ReturnType<typeof loadReplay>>|undefined,clock=createControlledClock(3600),timer:number|undefined,busy=false;
function stop(){if(timer!==undefined){window.clearInterval(timer);timer=undefined;}}
function publish(){facts.textContent=JSON.stringify({mode:lifecycle?'F04_DETACH_ROTATE_REMOVE_RELOAD_REPLAY':'presentation-replay',clock:clock.read(),facts:host?.readFacts(),diagnostics:host?.readDiagnostics(),lifecycle:lifecycle&&host?(host as Awaited<ReturnType<typeof createFoliageLifecycleExperiment>>).readLifecycle():null,mounts:registeredMountCount(),liveHosts:liveThreeHostCounts(),productIntegrated:false},null,2);}
async function frame(){if(!host||!replay)return;const time=clock.read(),sample=sampleScenario(replay.scenario,time.tick,time.paused);
  if(host.readFacts().fixtureDigest!==getFixtureDigest(sample.fixture))await handle!.replaceFixture(sample.fixture);
  host.setResetTick(sample.resetTick);
  const preset=WEATHER_PRESETS[weather.value as keyof typeof WEATHER_PRESETS];
  handle!.setFrame(createFrameInput({...sample.frame,weather:sampleWeatherAt(sample.fixture.frame.originMeters,time.tick,preset)}));publish();}
async function command(action:()=>Promise<void>|void,message:string){if(busy)return;busy=true;try{await action();status.textContent=message;}catch(error){stop();status.textContent=`Rejected: ${String(error)}`;}finally{busy=false;publish();}}
async function dispose(){stop();abort?.abort();await handle?.dispose();host=undefined;handle=undefined;abort=undefined;scenario.disabled=false;variant.disabled=false;}
element('mount').onclick=()=>{void command(async()=>{await dispose();replay=await loadReplay(inventory,scenario.value,root);clock=createControlledClock(replay.scenario.durationTicks);abort=new AbortController();
  handle=await mountExperiment(async(context)=>{host=await (lifecycle?createFoliageLifecycleExperiment:createFoliageWindExperiment)(context);return host;},{canvas,fixture:replay.initialFixture,preset:{id:variant.value,parameters:{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}},signal:abort.signal,capabilities:{}});
  scenario.disabled=true;variant.disabled=true;await frame();},'Winddarstellung aktiv — Source-Replay, kein nativer Cut');};
element('dispose').onclick=()=>{void command(dispose,'Disposed');};
element('seek').onclick=()=>{stop();void command(async()=>{clock.seek(Number(element<HTMLInputElement>('tick').value));await frame();},'Seek angewendet');};
element('reset').onclick=()=>{stop();void command(async()=>{clock.reset();element<HTMLInputElement>('tick').value='0';await frame();},'Reset angewendet');};
element('pause').onclick=()=>{stop();void command(async()=>{clock.pause(true);await frame();},'Pausiert');};
element('play').onclick=()=>{stop();void command(async()=>{if(!host||!replay)throw Error('Zuerst Laborquelle starten');clock.pause(false);await frame();timer=window.setInterval(()=>{if(clock.read().tick>=replay!.scenario.durationTicks){stop();return;}void command(async()=>{clock.advance(1);await frame();},'Play — kontrollierte 60-Hz-Ticks');},1000/60);},'Play');};
weather.onchange=()=>{void command(frame,'Wetterinput angewendet');};
element<HTMLSelectElement>('lifecycleView').disabled=!lifecycle;
element<HTMLSelectElement>('lifecycleView').onchange=()=>{void command(()=>{if(lifecycle&&host)(host as Awaited<ReturnType<typeof createFoliageLifecycleExperiment>>).setLifecycleView(element<HTMLSelectElement>('lifecycleView').value as LifecycleView);},'Lifecycle-Overlay angewendet');};
canvas.addEventListener('three-lab-rendered',()=>{if(!busy&&host)publish();});
canvas.addEventListener('three-lab-error',()=>{stop();status.textContent='Rendererfehler — siehe native Konsole';});
window.addEventListener('pagehide',()=>{void dispose();},{once:true});
const inventory=await loadInventory(root);
for(const entry of inventory.scenarios){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.id;scenario.add(option);}
scenario.value=lifecycle?'F04-DETACH-REPLAY':'F02-ROOT-GROVE-REPLAY';if(lifecycle){document.title='Hestia Source-Lifecycle';document.querySelector('h1')!.textContent='Source-Lifecycle: Detach → Rotate → Remove → Reload';}element<HTMLButtonElement>('mount').disabled=false;status.textContent='Bereit — Laborquelle eingefroren';publish();
