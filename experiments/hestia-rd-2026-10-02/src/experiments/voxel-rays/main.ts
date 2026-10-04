import { PerspectiveCamera, Vector3 } from 'three';
import { mountExperiment, type LabExperimentHandle } from '../../contracts/experiment';
import type { Vec3 } from '../../contracts/fixture';
import { requireValue } from '../../contracts/validation';
import { sampleScenario } from '../../contracts/scenario';
import { loadInventory, loadReplay, publicAssetRoot } from '../../runner/assets';
import { createScenarioRunner } from '../../runner/scenarioRunner';
import { createVoxelRayExperiment, type VoxelRayHost } from './index';
import { loadRayRecipe, admitProjection, prepareVolumes } from './volume';
import type { NativeFault } from './qualification';

const canvas=document.querySelector<HTMLCanvasElement>('#viewport')!;
const status=document.querySelector<HTMLElement>('#status')!; const facts=document.querySelector<HTMLElement>('#facts')!;
const select=(id:string)=>document.querySelector<HTMLSelectElement>(`#${id}`)!;
const tick=document.querySelector<HTMLInputElement>('#tick')!; const history:string[]=[];
const root=publicAssetRoot(import.meta.env.BASE_URL,window.location.href);
let mounted:LabExperimentHandle|undefined; let raw:VoxelRayHost|undefined; let lifetime:AbortController|undefined;
let runner:ReturnType<typeof createScenarioRunner>|undefined; let replay:Awaited<ReturnType<typeof loadReplay>>|undefined;
let cameraId:string|undefined; let pending=false; let sequence=0;
function qualificationCamera(origin:Vec3,direction:Vec3) {
  const camera=new PerspectiveCamera(55,1,0.01,2000); camera.position.set(...origin);
  const target=new Vector3(...origin).add(new Vector3(...direction)); camera.up.set(0,Math.abs(direction[1])>0.99?0:1,Math.abs(direction[1])>0.99?-1:0);
  camera.lookAt(target); camera.updateMatrixWorld(); return camera;
}
function describe() {
  facts.textContent=JSON.stringify({productIntegrated:false,facts:mounted?.readFacts(),private:raw?.readRayDiagnostics(),history},null,2);
  tick.value=String(runner?.read().tick??0);
}
function fail(error:unknown) { history.push(String(error)); status.textContent=`FAIL / hidden, no old version drawing: ${String(error)}. Explicit Remount is required.`;
  canvas.hidden=true; facts.textContent=JSON.stringify({productIntegrated:false,history,terminal:raw?.readPrivateDiagnostics()},null,2); }
async function dispose() { sequence+=1; lifetime?.abort(); const old=mounted; mounted=undefined; runner=undefined;
  await old?.dispose(); canvas.hidden=true; status.textContent='Disposed; no render loop owned by this entry. Failure history retained.'; }
async function remount() {
  await dispose(); const ownSequence=sequence; lifetime=new AbortController();
  const inventory=await loadInventory(root); const entry=inventory.scenarios.find((e)=>e.id===select('fixture').value); requireValue(entry,'Unknown frozen scenario');
  const loaded=await loadReplay(inventory,entry.id,root,fetch,lifetime.signal); requireValue(sequence===ownSequence,'Stale mount'); replay=loaded;
  select('camera').replaceChildren(...loaded.initialFixture.cameras.map((c)=>new Option(c.id,c.id)));
  cameraId=loaded.initialFixture.id==='F01-HVP-COAST'?'C02-SHORE':loaded.initialFixture.cameras[0].id; select('camera').value=cameraId;
  const [width,height]=select('resolution').value.split('x').map(Number); const dpr=Number(select('dpr').value);
  mounted=await mountExperiment(async(context)=>{raw=await createVoxelRayExperiment(context) as VoxelRayHost; return raw;},
    {canvas,fixture:loaded.initialFixture,preset:{id:select('variant').value,parameters:{width,height,dpr}},signal:lifetime.signal,capabilities:{}});
  requireValue(sequence===ownSequence,'Stale complete mount');
  const commands={replaceFixture:(next:Parameters<LabExperimentHandle['replaceFixture']>[0])=>mounted!.replaceFixture(next),
    setFrame:(frame:Parameters<LabExperimentHandle['setFrame']>[0])=>mounted!.setFrame({...frame,cameraId:cameraId??frame.cameraId})};
  runner=createScenarioRunner(loaded.scenario,commands,(reset)=>raw!.setResetTick(reset)); await runner.render();
  status.textContent='Source and projection prepared; waiting for an actual host render submission (not native qualification).'; describe();
}
async function command(work:()=>Promise<unknown>) {
  requireValue(!pending,'One sequential command at a time'); pending=true;status.textContent='Command pending; no new render submission claimed.';
  const controls=document.querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>('button,select,input');
  controls.forEach((control)=>{control.disabled=true;});
  try { await work(); if (mounted && raw) {
    const before=raw.readRayDiagnostics().host?.submittedFrames??0;const deadline=performance.now()+10000;
    // Bounded command wait only, not a second animation/render loop or a GPU timer.
    while ((raw.readRayDiagnostics().host?.submittedFrames??0)<=before) {
      requireValue(performance.now()<deadline,'Timed out waiting for actual host render submission');
      requireValue(!raw.readPrivateDiagnostics().disposed,'Projection terminated before render submission');
      await new Promise<void>((resolve)=>window.setTimeout(resolve,16));
    }
    status.textContent='Host render submitted. Native numeric/image/depth-water qualification still NOT RUN; this is not an art/performance PASS.';describe();
  } } catch (error) { fail(error); const failed=mounted;mounted=undefined;runner=undefined;await failed?.dispose().catch((e)=>history.push(String(e))); }
  finally { pending=false;controls.forEach((control)=>{control.disabled=false;}); }
}
for (const [id,work] of Object.entries({remount,dispose,seek:async()=>{requireValue(runner,'Not mounted');await runner.seek(Number(tick.value));},
  step:async()=>{requireValue(runner,'Not mounted');await runner.advance();},pause:async()=>{requireValue(runner,'Not mounted');await runner.pause(!runner.read().paused);},
  reset:async()=>{requireValue(runner,'Not mounted');await runner.reset();}})) {
  document.querySelector<HTMLButtonElement>(`#${id}`)!.addEventListener('click',()=>{void command(work).catch(fail);});
}
select('camera').addEventListener('change',()=>{void command(async()=>{requireValue(runner,'Not mounted');cameraId=select('camera').value;await runner.render();}).catch(fail);});
function resize() { requireValue(raw,'Not mounted'); const [w,h]=select('resolution').value.split('x').map(Number); raw.resize(w,h,Number(select('dpr').value)); }
select('resolution').addEventListener('change',()=>{void command(async()=>resize()).catch(fail);}); select('dpr').addEventListener('change',()=>{void command(async()=>resize()).catch(fail);});
canvas.addEventListener('voxel-rays-rendered',()=>{if (!pending && mounted && !raw?.readPrivateDiagnostics().disposed) {
  status.textContent='Host render submitted. Native numeric/image/depth-water qualification still NOT RUN; this is not an art/performance PASS.'; describe(); }});
canvas.addEventListener('voxel-rays-error',(event)=>fail((event as CustomEvent).detail));
window.addEventListener('pagehide',()=>{void dispose().catch(()=>{});},{once:true});

// No global bridge on the normal URL. Synthetic/numeric controls exist ONLY with this explicit query.
if (new URL(window.location.href).searchParams.get('testBridge')==='1') {
  (window as unknown as {TestBridge:unknown}).TestBridge={
    read:()=>({productIntegrated:false,facts:mounted?.readFacts(),diagnostics:raw?.readRayDiagnostics(),clock:runner?.read(),history:[...history],hidden:canvas.hidden}),
    volumes:()=>raw!.readVolumesForQualification().map((v)=>({source:v.source,dimensions:v.dimensions,offset:v.offset,materialIds:v.materialIds,sourceSlotSha256:v.sourceSlotSha256})),
    async probe(regionId:string,origin:Vec3,direction:Vec3,fault:NativeFault='none',oldTick?:number) {
      requireValue(raw && replay && runner && !pending,'Probe requires a stable explicit test mount');
      const volume=raw.readVolumesForQualification().find((v)=>v.source.regionId===regionId); requireValue(volume,'Missing admitted volume');
      let stale;
      if (oldTick!==undefined) {
        const source=sampleScenario(replay.scenario,oldTick,true).fixture;
        const recipe=await loadRayRecipe(source,root);
        stale=prepareVolumes(source,recipe,admitProjection(source,recipe,raw.readRayDiagnostics().caps)).find((v)=>v.source.regionId===regionId);
      }
      // Qualification camera is declared, not represented as an original gallery screenshot camera.
      return (await import('./qualification')).probeNative(volume,origin,direction,qualificationCamera(origin,direction),fault,stale);
    },
    async probeCases() {
      requireValue(raw && !pending,'Stable test mount required'); const {nativeCases}=await import('../../../tests/RD-13/native-cases');
      const {probeNative}=await import('./qualification'); const results=[];
      for (const c of nativeCases) { results.push({id:c.id,result:await probeNative(c.volume,c.origin,c.direction,qualificationCamera(c.origin,c.direction))}); }
      const unknown=nativeCases.find((c)=>c.id==='unknown-before-hit')!; const occupied=nativeCases[0];
      const faults=[];
      for (const fault of ['wrong-slot','wrong-normal','force-miss','proxy-depth'] as const) { faults.push(await probeNative(occupied.volume,occupied.origin,occupied.direction,qualificationCamera(occupied.origin,occupied.direction),fault)); }
      faults.push(await probeNative(unknown.volume,unknown.origin,unknown.direction,qualificationCamera(unknown.origin,unknown.direction),'hide-unknown'));
      return {results,faults};
    },
    async probeEdit(regionId:string) {
      requireValue(raw && replay && runner && !pending,'Stable edited mount required');
      const volume=raw.readVolumesForQualification().find((v)=>v.source.regionId===regionId); requireValue(volume,'Edited region missing');
      const source=sampleScenario(replay.scenario,0,true).fixture;
      const recipe=await loadRayRecipe(source,root);
      const old=prepareVolumes(source,recipe,admitProjection(source,recipe,raw.readRayDiagnostics().caps)).find((v)=>v.source.regionId===regionId);
      requireValue(old && old.slots.length===volume.slots.length,'Comparable original region required');
      const i=old.slots.findIndex((slot,index)=>slot!==0&&volume.slots[index]===0); requireValue(i>=0,'Actual removed source cell required');
      const [sx,sy]=volume.dimensions; const grid=new Vector3(i%sx+.5,Math.floor(i/sx)%sy+.5,Math.floor(i/(sx*sy))+.5);
      const point=grid.applyMatrix4(volume.worldFromGrid); const direction=new Vector3(0,-1,0).transformDirection(volume.worldFromGrid).toArray() as unknown as Vec3;
      const origin=point.addScaledVector(new Vector3(...direction),-5).toArray() as unknown as Vec3; const camera=qualificationCamera(origin,direction);
      const {probeNative}=await import('./qualification'); return {origin,direction,
        positive:await probeNative(volume,origin,direction,camera),stale:await probeNative(volume,origin,direction,camera,'stale-upload',old),
        proxy:await probeNative(volume,origin,direction,camera,'proxy-depth'),oldSource:old.source,currentSource:volume.source};
    },
    async failReplacement(fault:'format'|'overflow'='format') { requireValue(raw && replay && runner,'Not mounted');
      // Controlled admission fault only; actual caps, profile, original recipe and fixture bytes stay unchanged.
      await raw.rejectReplacementForQualification(sampleScenario(replay.scenario,runner.read().tick,true).fixture,fault); },
  };
}
void command(remount).catch(fail);
