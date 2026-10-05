import { mountExperiment, registeredMountCount, type LabExperimentHandle } from '../../contracts/experiment';
import { requireValue } from '../../contracts/validation';
import{Group,Mesh,type Material}from'three';
import { loadInventory, loadReplay, publicAssetRoot, type LabInventory } from '../../runner/assets';
import { createScenarioRunner } from '../../runner/scenarioRunner';
import { createThreeWebGpuExperiment, liveWebGpuHostCounts, type ThreeWebGpuHost } from './index';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id)! as T;
let canvas = element<HTMLCanvasElement>('view'); const status = element('status'); const facts = element('facts');
const scenario = element<HTMLSelectElement>('scenario'); const mode = element<HTMLSelectElement>('mode');
const tick = element<HTMLInputElement>('tick'); const pause = element<HTMLInputElement>('pause'); const params = new URLSearchParams(location.search);
const root = publicAssetRoot(import.meta.env.BASE_URL, location.href);
let inventory: LabInventory | undefined; let handle: LabExperimentHandle | undefined; let host: ThreeWebGpuHost | undefined;
let runner: ReturnType<typeof createScenarioRunner> | undefined; let replay: Awaited<ReturnType<typeof loadReplay>> | undefined;
let abort: AbortController | undefined; let mounting: Promise<void> | undefined; let closing: Promise<void> | undefined;
let version = 0; let busy = false; let timer: number | undefined; let error: string | undefined;
let diagnosticError: string | undefined;
let terminalSnapshot: ReturnType<ThreeWebGpuHost['readDiagnostics']> | undefined;
function controls() {
  for (const id of ['play', 'pause', 'advance', 'tick', 'seek', 'reset', 'resize', 'restore-size']) { (element(id) as HTMLButtonElement).disabled = !handle || busy || Boolean(closing); }
  scenario.disabled = mode.disabled = Boolean(handle || mounting || closing);
  element<HTMLButtonElement>('mount').disabled = !inventory || Boolean(handle || mounting || closing);
  element<HTMLButtonElement>('dispose').disabled = !handle && !mounting;
}
function publish(cleanup?: ReturnType<ThreeWebGpuHost['readCleanup']>) {
  let currentFacts; let diagnostics;
  try { currentFacts = handle?.readFacts(); } catch (failure) { error ??= String(failure); }
  try { diagnostics = host?.readDiagnostics(); } catch (failure) { error ??= String(failure); }
  const state = { scenarioId: replay?.scenario.id, scenarioDigest: replay?.scenarioDigest, requestedMode: mode.value,
    facts: currentFacts, diagnostics, error, diagnosticError, terminalSnapshot, cleanup, mounts: registeredMountCount(), liveHosts: liveWebGpuHostCounts(),
    execution: import.meta.env.DEV ? 'DEV-DIAGNOSTIC-NOT-OPTIMIZED' : 'OPTIMIZED-DIAGNOSTIC-NOT-BENCHMARK', productIntegrated: false };
  facts.textContent = JSON.stringify(state, null, 2); facts.dataset.mounts = String(state.mounts); facts.dataset.tick = String(runner?.read().tick ?? 0);
  if (runner) { tick.value = String(runner.read().tick); pause.checked = runner.read().paused; }
  controls();
}
function stopPlayback() { if (timer !== undefined) { clearInterval(timer); timer = undefined; } }
async function perform(action: () => Promise<unknown> | unknown, label: string) {
  if (busy || closing || !handle) { return; } const ownVersion = version; busy = true; controls();
  try { await action(); if (ownVersion === version) { status.textContent = label; } }
  catch (failure) { if (ownVersion === version) { stopPlayback(); error = String(failure); status.textContent = `Rejected: ${error}`; } }
  finally { busy = false; publish(); }
}
function bindCanvas() {
  canvas.addEventListener('rd11-rendered', () => { if (handle && !busy) { publish(); } });
  canvas.addEventListener('rd11-error', (event) => {
    error = (event as CustomEvent<string>).detail; stopPlayback();
    try { terminalSnapshot = host?.readDiagnostics(); } catch (failure) { diagnosticError = String(failure); }
    status.textContent = `Terminal: ${error}`; void dispose(true).catch((failure) => { status.textContent = `Cleanup error: ${String(failure)}`; });
  });
}
function freshCanvas() {
  // r185 fallback disposal loses its native context; failed init also needs a fresh canvas.
  const fresh = canvas.cloneNode(false) as HTMLCanvasElement; canvas.replaceWith(fresh); canvas = fresh; bindCanvas();
}
async function mount() {
  requireValue(inventory && !handle && !mounting && !closing, 'Mount unavailable/reserved'); const ownVersion = ++version;
  abort = new AbortController(); error = undefined; diagnosticError = undefined; terminalSnapshot = undefined;
  mounting = (async () => {
    status.textContent = 'Importing bounded frozen replay; awaiting renderer init and node compilation…';
    replay = await loadReplay(inventory!, scenario.value, root, fetch, abort!.signal); let candidate: ThreeWebGpuHost | undefined;
    const mounted = await mountExperiment(async (context) => { candidate = await createThreeWebGpuExperiment(context); return candidate; },
      { canvas, fixture: replay.initialFixture, preset: { id: mode.value, parameters: { width: 1280, height: 720, dpr: 1 } }, signal: abort!.signal, capabilities: {} });
    if (ownVersion !== version) { await mounted.dispose(); return; }
    handle = mounted; host = candidate!; runner = createScenarioRunner(replay.scenario, handle, host.setResetTick);
    await runner.render(); tick.max = String(replay.scenario.durationTicks); status.textContent = `Mounted ${mode.value} — observed ${host.readDiagnostics().backend.actual}; awaiting submitted-frame facts`;
  })();
  controls();
  try { await mounting; }
  catch (failure) { if (ownVersion === version) {
    error = String(failure); if (!handle) { freshCanvas(); }
    status.textContent = `${error.includes('UNSUPPORTED:') ? 'UNSUPPORTED' : 'FAILED'}: ${error}`;
  } }
  finally { mounting = undefined; publish(); }
}
async function dispose(terminal = false): Promise<void> {
  if (closing) { return closing; }
  closing = (async () => {
    ++version; stopPlayback(); abort?.abort(); await mounting?.catch(() => {}); await runner?.settled(); const old = host;
    try { await handle?.dispose(); }
    finally {
      handle = undefined; host = undefined; runner = undefined; abort = undefined;
      freshCanvas();
      publish(old?.readCleanup()); status.textContent = terminal ? `Terminal: ${error} — owned cleanup complete` : 'Disposed — fresh unmounted canvas; no owned render loop';
    }
  })();
  controls(); try { await closing; } finally { closing = undefined; controls(); }
}
element('mount').addEventListener('click', () => { void mount(); }); element('dispose').addEventListener('click', () => { void dispose(); });
element('advance').addEventListener('click', () => { void perform(() => runner!.advance(60), 'Advanced controlled ticks'); });
pause.addEventListener('change', () => { stopPlayback(); void perform(() => runner!.pause(pause.checked), 'Pause state applied'); });
element('seek').addEventListener('click', () => { void perform(() => runner!.seek(Number(tick.value)), 'Seek applied — immutable snapshot adopted'); });
element('reset').addEventListener('click', () => { stopPlayback(); void perform(() => runner!.reset(), 'Reset to initial presentation'); });
element('resize').addEventListener('click', () => { void perform(() => host!.resize(640, 360, 2), 'Resize applied 640×360 DPR2'); });
element('restore-size').addEventListener('click', () => { void perform(() => host!.resize(1280, 720, 1), 'Resize restored 1280×720 DPR1'); });
element('play').addEventListener('click', () => {
  stopPlayback(); void perform(() => runner!.pause(false), 'Playing controlled ticks; not a benchmark');
  timer = window.setInterval(() => { if (!runner || runner.read().tick >= replay!.scenario.durationTicks) { stopPlayback(); return; }
    void perform(() => runner!.advance(1), 'Playing controlled ticks; not a benchmark'); }, 1000 / 60);
});
if (params.get('testBridge') === '1') {
  let faultHost:ThreeWebGpuHost|undefined,restore:()=>void=()=>{};
  const visualFaults=['vertex-colors-off','missing-bank','wrong-owner-pose','water-opacity-one','water-depth-off','holdout-hero-hidden'] as const;
  Object.defineProperty(window, 'TestBridge', { value: Object.freeze({
    inspect(){requireValue(host,'Mounted native host required');return host.readDiagnostics();},
    visualFault(fault:string){
      requireValue(host&&replay?.initialFixture.id==='F01-HVP-COAST','Fault controls require actual mounted F01 source');requireValue(fault==='restore'||visualFaults.some(v=>v===fault),'Unknown native visual fault');
      if(faultHost===host)restore();faultHost=host;restore=()=>{};const changed:string[]=[];
      const meshes:Mesh[]=[],owners:Group[]=[];host.scene.traverse(o=>{if(o instanceof Mesh)meshes.push(o);if(o instanceof Group&&o.userData.ownerId)owners.push(o);});
      const changes:Array<()=>void>=[];
      const materialChange=(mesh:Mesh,key:'vertexColors'|'opacity'|'depthTest',value:boolean|number)=>{for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material])as Material[]){const m=material as Material&{vertexColors:boolean};const before=m[key];(m as any)[key]=value;m.needsUpdate=true;changes.push(()=>{(m as any)[key]=before;m.needsUpdate=true;});changed.push(mesh.name+':'+key);}};
      if(fault==='vertex-colors-off')for(const m of meshes)materialChange(m,'vertexColors',false);
      if(fault==='missing-bank'){const mesh=meshes.find(m=>m.name==='hvp:terrain:hvp-limestone-dry');requireValue(mesh?.parent,'Missing known bank mesh');const parent=mesh.parent;mesh.removeFromParent();changes.push(()=>parent.add(mesh));changed.push(mesh.name+':removed');}
      if(fault==='wrong-owner-pose'||fault==='holdout-hero-hidden'){const owner=owners.find(o=>o.userData.ownerId==='hvp:flora:hero');requireValue(owner,'Missing known hero owner');const position=owner.position.clone(),visible=owner.visible;if(fault==='wrong-owner-pose')owner.position.x+=1.5;else owner.visible=false;changes.push(()=>{owner.position.copy(position);owner.visible=visible;});changed.push(owner.name+':'+fault);}
      if(fault==='water-opacity-one'||fault==='water-depth-off'){const water=meshes.find(m=>m.name==='hvp:water:hvp-water');requireValue(water,'Missing known native water mesh');materialChange(water,fault==='water-opacity-one'?'opacity':'depthTest',fault==='water-opacity-one'?1:false);}
      restore=()=>{for(const undo of changes.reverse())undo();};if(fault!=='restore')requireValue(changed.length>0,'Fault made no native mutation');
      const before=host.readDiagnostics();return{fault,changed,fixtureDigest:before.fixtureDigest,cameraId:before.frame.cameraId,tick:before.frame.tick,submittedFrames:before.submittedFrames,backend:before.backend};
    },
    omitVertexColors() {
      requireValue(host, 'Test bridge requires owned mounted host');
      host.scene.traverse((object) => {
        const mesh = object as unknown as { isMesh?: boolean; material?: { vertexColors: boolean; needsUpdate: boolean }[] };
        if (mesh.isMesh && Array.isArray(mesh.material)) { for (const material of mesh.material) { material.vertexColors = false; material.needsUpdate = true; } }
      });
      error = 'TESTBRIDGE-CONTROLLED-VERTEX-COLOR-OMISSION; not a supported profile'; publish();
    },
    loseOwnedDevice() { requireValue(host, 'Test bridge requires owned mounted host'); host.loseOwnedDeviceForTest(); },
  }), configurable: false });
}
bindCanvas(); window.addEventListener('pagehide', () => { void dispose(); }, { once: true });
try {
  requireValue(!params.get('experiment') || params.get('experiment') === 'RD-11', 'Unknown experiment');
  const selected = params.get('mode') ?? 'C1'; requireValue(selected === 'C1' || selected === 'C2', 'Unknown mode'); mode.value = selected;
  inventory = await loadInventory(root);
  for (const id of ['F01-HVP-COAST-REPLAY', 'F04-DETACH-REPLAY', 'F06-MATERIAL-REPLAY']) {
    requireValue(inventory.scenarios.some((entry) => entry.id === id), 'Frozen scenario missing'); const option = document.createElement('option'); option.value = id; option.textContent = id; scenario.add(option);
  }
  scenario.value = params.get('scenario') ?? 'F01-HVP-COAST-REPLAY'; requireValue(Boolean(scenario.value), 'Unknown/frozen-out scenario');
  status.textContent = 'Ready — no renderer; choose explicit C1/C2 and frozen replay'; publish();
} catch (failure) { error = String(failure); status.textContent = `Rejected: ${error}`; publish(); }
