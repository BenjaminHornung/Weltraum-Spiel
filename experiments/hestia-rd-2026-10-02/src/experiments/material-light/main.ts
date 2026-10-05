import { createFrameInput,mountExperiment,registeredMountCount,type LabExperimentHandle } from '../../contracts/experiment';
import { getFixtureDigest } from '../../contracts/fixture';
import { createControlledClock,sampleScenario } from '../../contracts/scenario';
import { loadInventory,loadReplay,publicAssetRoot } from '../../runner/assets';
import { liveThreeHostCounts } from '../../runner/threeHost';
import { canonicalJson } from '../../contracts/validation';
import { createMaterialLightExperiment,type MaterialLabHost,type MaterialViewMode } from './index';
import { WEATHER_PRESETS,sampleWeatherAt } from '../weather-field';
const element=<T extends HTMLElement>(id:string)=>document.getElementById(id)! as T;
const canvas=element<HTMLCanvasElement>('view'),status=element('status'),facts=element('facts'),scenario=element<HTMLSelectElement>('scenario'),variant=element<HTMLSelectElement>('variant'),camera=element<HTMLSelectElement>('camera'),weather=element<HTMLSelectElement>('weather'),viewMode=element<HTMLSelectElement>('viewMode'),wetness=element<HTMLInputElement>('wetness');
const root=publicAssetRoot(import.meta.env.BASE_URL,location.href);
let host:MaterialLabHost|undefined,handle:LabExperimentHandle|undefined,abort:AbortController|undefined,replay:Awaited<ReturnType<typeof loadReplay>>|undefined,clock=createControlledClock(1800),timer:number|undefined,busy=false;
function stop(){if(timer!==undefined){clearInterval(timer);timer=undefined;}}
function publish(){facts.textContent=JSON.stringify({mode:'presentation-replay / manual-material-parameters',clock:clock.read(),facts:host?.readFacts(),material:host?.readMaterialState(),manualWetness:Number(wetness.value),diagnostics:host?.readDiagnostics(),mounts:registeredMountCount(),liveHosts:liveThreeHostCounts(),productIntegrated:false},null,2);}
function parameters(){if(!host)return;host.setViewMode(viewMode.value as MaterialViewMode);const value=Number(wetness.value);element('wetnessValue').textContent=wetness.value;
  for(const binding of host.readSurfaceBindings())host.setSurfaceWetness(binding,new Float32Array(binding.vertexCount).fill(value));}
async function frame(){if(!host||!replay)return;const time=clock.read(),sample=sampleScenario(replay.scenario,time.tick,time.paused);
  if(host.readFacts().fixtureDigest!==getFixtureDigest(sample.fixture)){await handle!.replaceFixture(sample.fixture);parameters();}
  host.setResetTick(sample.resetTick);handle!.setFrame(createFrameInput({...sample.frame,cameraId:camera.value,weather:sampleWeatherAt(sample.fixture.frame.originMeters,time.tick,WEATHER_PRESETS[weather.value as keyof typeof WEATHER_PRESETS])}));publish();}
async function command(action:()=>Promise<void>|void,message:string){if(busy)return;busy=true;try{await action();status.textContent=message;}catch(error){stop();status.textContent=`Rejected: ${String(error)}`;}finally{busy=false;publish();}}
async function dispose(){stop();abort?.abort();await handle?.dispose();host=undefined;handle=undefined;abort=undefined;scenario.disabled=false;variant.disabled=false;}
element('mount').onclick=()=>{void command(async()=>{await dispose();replay=await loadReplay(inventory,scenario.value,root);clock=createControlledClock(replay.scenario.durationTicks);abort=new AbortController();
  handle=await mountExperiment(async(context)=>{host=await createMaterialLightExperiment(context);return host;},{canvas,fixture:replay.initialFixture,preset:{id:variant.value},signal:abort.signal,capabilities:{}});
  camera.replaceChildren();for(const entry of replay.initialFixture.cameras){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.id;camera.add(option);}camera.value=replay.initialFixture.cameras.some((c)=>c.id==='near')?'near':replay.initialFixture.cameras[0].id;
  scenario.disabled=true;variant.disabled=true;parameters();await frame();},'Materiallabor aktiv — manuelle Probeparameter');};
element('dispose').onclick=()=>{void command(dispose,'Disposed');};
element('seek').onclick=()=>{stop();void command(async()=>{clock.seek(Number(element<HTMLInputElement>('tick').value));await frame();},'Seek angewendet');};
element('reset').onclick=()=>{stop();void command(async()=>{clock.reset();element<HTMLInputElement>('tick').value='0';await frame();},'Reset angewendet');};
element('pause').onclick=()=>{stop();void command(async()=>{clock.pause(true);await frame();},'Pausiert');};
element('play').onclick=()=>{stop();void command(async()=>{if(!host||!replay)throw Error('Zuerst Laborquelle starten');clock.pause(false);await frame();timer=window.setInterval(()=>{if(clock.read().tick>=replay!.scenario.durationTicks){stop();return;}void command(async()=>{clock.advance(1);await frame();},'Play — kontrollierte 60-Hz-Ticks');},1000/60);},'Play');};
weather.onchange=camera.onchange=()=>{void command(frame,'Frameinput angewendet');};
viewMode.onchange=wetness.onchange=()=>{void command(async()=>{parameters();await frame();},'Materialparameter angewendet');};
canvas.addEventListener('three-lab-rendered',()=>{if(!busy&&host)publish();});
canvas.addEventListener('three-lab-error',()=>{stop();status.textContent='Rendererfehler — siehe native Konsole';});
window.addEventListener('pagehide',()=>{void dispose();},{once:true});
// Explicit test-only adapter calls: no UI frame command, renderer replacement or product bridge.
if(new URLSearchParams(location.search).get('testBridge')==='1'){
  const bridge={read(){if(!host)throw Error('Material host missing');return host.readDiagnostics();},
    setViewMode(mode:MaterialViewMode){if(!host)throw Error('Material host missing');host.setViewMode(mode);return host.readDiagnostics();},
    setWetness(value:number){if(!host||!Number.isFinite(value)||value<0||value>1)throw Error('Invalid direct wetness');for(const binding of host.readSurfaceBindings())host.setSurfaceWetness(JSON.parse(canonicalJson(binding)),new Float32Array(binding.vertexCount).fill(value));return host.readDiagnostics();}};
  Object.assign(window,{MaterialTestBridge:Object.freeze(bridge)});
}
const inventory=await loadInventory(root);for(const entry of inventory.scenarios){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.id;scenario.add(option);}
scenario.value='F06-MATERIAL-REPLAY';element<HTMLButtonElement>('mount').disabled=false;status.textContent='Bereit — Laborquelle eingefroren';publish();
