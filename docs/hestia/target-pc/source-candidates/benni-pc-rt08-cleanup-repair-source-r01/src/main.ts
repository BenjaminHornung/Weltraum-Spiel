import * as T from 'three/webgpu';
import {WebGPUPathTracer} from 'three-gpu-pathtracer/webgpu';
import {loadPort,digest} from '../inputs/gfx03/spikes/gfx-03-backend-bakeoff/src/port.js';
import {SceneSnapshot} from './snapshot.js';
import {PhotoSession} from './session.mjs';
import {capturePng} from './export.mjs';
import {awaitReadback,resizePhoto,photoDeadline,cleanupPhoto} from './photo-operations.mjs';
const get=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
const canvas=get<HTMLCanvasElement>('photo'),status=get('status'),details=get('details');
const start=get<HTMLButtonElement>('start'),cancel=get<HTMLButtonElement>('cancel'),save=get<HTMLButtonElement>('export');
const runner=new URLSearchParams(location.search).get('runner')==='1';
let snapshot:SceneSnapshot, session:PhotoSession|null=null, closed=false, initializing=false;
let resources:ReturnType<SceneSnapshot['build']>|null=null;
let failure:string|null=null;
let startedAt=0,dispatches=0;
let stopDeadline:(()=>void)|null=null,interruptReadback:(()=>void)|null=null;
let codeBindings:Record<string,unknown>|null=null;
let adapterEvidence:Record<string,unknown>={actualAdapter:'NOT_RUN',gpuTimer:'UNSUPPORTED_NOT_INSTRUMENTED',concurrentLoad:'OTHER_Hestia_SESSIONS_ACTIVE_NOT_REFERENCE'};
const size=()=>[Number(get<HTMLInputElement>('width').value),Number(get<HTMLInputElement>('height').value)] as const;
const dimensions=()=>{const [w,h]=size();if(![w,h].every(v=>Number.isInteger(v)&&v>=1&&v<=8192))throw Error('Größe muss 1 bis 8192 betragen');return [w,h] as const;};
function update(message?:string){
 if(message?.startsWith('FAIL'))failure=message;
 const state=closed?'disposed':session?.state??'ready';
 status.textContent=message??failure??`Modus: Snapshot-Foto / ${state}; min spp: ${session?.samples.min??'NOT_RUN'}`;
 start.disabled=!runner||closed||initializing||session?.busy===true||!snapshot||!['ready','complete','cancelled'].includes(state);
 cancel.disabled=state!=='running';save.disabled=state!=='complete';
 for(const id of ['resize','dispose','spp','width','height'])(get(id) as HTMLButtonElement|HTMLInputElement|HTMLSelectElement).disabled=closed;
 details.textContent=JSON.stringify({executionLocation:'LOCAL_WINDOWS_ISOLATED',mode:runner?'RUNNER_EXPLICIT_START':'DOM_ONLY_NO_GPU',
   digests:snapshot?.digests,unsupported:snapshot?.unsupported,skipped:resources?.skipped??[],samples:session?.samples??'NOT_RUN',...adapterEvidence},null,2);
}
async function initialize(){
 const [width,height]=dimensions();let device:GPUDevice|undefined,renderer:T.WebGPURenderer|undefined,tracer:WebGPUPathTracer|undefined;
 try{
   const proof=await fetch('./code-bindings.json');if(!proof.ok)throw Error('Sealed Runner preview required');codeBindings=await proof.json();
   if(codeBindings?.baseCommit!=='17b1db4201a28e7b607c30707bdc2b75e3484a10'||!codeBindings.bindingManifestSha256)throw Error('Unbound photo code');
   if(!navigator.gpu)throw Error('WebGPU UNSUPPORTED');
   const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('WebGPU adapter unavailable');
   adapterEvidence={...adapterEvidence,actualAdapter:{vendor:adapter.info.vendor||'unavailable',architecture:adapter.info.architecture||'unavailable',device:adapter.info.device||'unavailable',description:adapter.info.description||'unavailable',isFallbackAdapter:adapter.info.isFallbackAdapter},browser:navigator.userAgent,DPR:devicePixelRatio,resolution:[width,height],adapterFeatures:[...adapter.features]};
   device=await adapter.requestDevice();
   if(closed){device.destroy();throw Error('Closed during device initialization');}
   renderer=new T.WebGPURenderer({canvas,device,antialias:false,getFallback:()=>{throw Error('WebGPU required; fallback rejected');}});
   await renderer.init();if(closed)throw Error('Closed during renderer initialization');
   const backend=renderer.backend as unknown as {isWebGPUBackend?:boolean;device?:GPUDevice};
   if(!backend.isWebGPUBackend||backend.device!==device)throw Error('Actual renderer/device differs from requested adapter');
   renderer.setPixelRatio(1);renderer.setSize(width,height);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
   resources=snapshot.build(width,height);tracer=new WebGPUPathTracer(renderer);
   tracer.stableNoise=true;tracer.dynamicLowRes=false;tracer.renderDelay=0;tracer.fadeDuration=0;tracer.minSamples=0;
   tracer.setScene(resources.scene,resources.camera);tracer.setSize(width,height);
   const ownedRenderer=renderer,ownedTracer=tracer,ownedDevice=device,ownedResources=resources;
   const abortReadback=new AbortController();
   interruptReadback=()=>{abortReadback.abort();ownedDevice.destroy();};
   const driver={target(spp:number){ownedTracer.maxSamples=spp;},reset(){ownedTracer.reset();},resize(w:number,h:number){ownedRenderer.setSize(w,h);ownedResources.camera.aspect=w/h;ownedResources.camera.updateProjectionMatrix();ownedTracer.setSize(w,h);ownedTracer.updateCamera();adapterEvidence={...adapterEvidence,resolution:[w,h]};},
     async sample(){const before=performance.now();ownedTracer.renderSample();const counts=await awaitReadback(ownedTracer.getSampleCountsAsync(),abortReadback.signal);adapterEvidence={...adapterEvidence,lastCpuDispatchAndReadbackMs:performance.now()-before,rendererMemory:{...ownedRenderer.info.memory}};return counts;},
     dispose(){cleanupPhoto([()=>ownedDevice.destroy(),()=>ownedTracer.dispose(),()=>ownedResources.dispose(),()=>ownedRenderer.dispose()]);}};
   session=new PhotoSession(driver,snapshot.digests.snapshot);const ownedSession=session;
   const nativeLoss=renderer.onDeviceLost.bind(renderer);
   renderer.onDeviceLost=info=>{nativeLoss(info);const cleanup=ownedSession.deviceLost();abortReadback.abort();void cleanup.then(()=>update('DeviceLoss: Aufnahme verworfen'),error=>update(`FAIL: ${String(error)}`));};
   device.lost.then(info=>{if(ownedSession.state!=='disposed'){adapterEvidence={...adapterEvidence,loss:{reason:info.reason,message:info.message}};const cleanup=ownedSession.deviceLost();abortReadback.abort();void cleanup.then(()=>update('DeviceLoss: Aufnahme verworfen'),error=>update(`FAIL: ${String(error)}`));}});
 }catch(error){const failedResources=resources;resources=null;cleanupPhoto([()=>tracer?.dispose(),()=>failedResources?.dispose(),()=>renderer?.dispose(),()=>device?.destroy()],error);}
}
async function render(){
 if(!session||session.state!=='running')return;
 if(performance.now()-startedAt>180000||dispatches>=8192){const cleanup=session.deviceLost();interruptReadback?.();await cleanup;update('FAIL: Endliches Profil erreicht (180 s / 8192 Dispatches)');return;}
 dispatches++;
 const ownedSession=session;
 try{await ownedSession.step();await ownedSession.settled();update();if(session===ownedSession&&session.state==='running')requestAnimationFrame(()=>void render());else{stopDeadline?.();stopDeadline=null;}}
 catch(error){update(`FAIL: ${String(error)}`);}
}
start.onclick=()=>void(async()=>{
 if(!runner||closed||initializing||session?.busy)return;initializing=true;update();
 try{failure=null;if(!session)await initialize();const target=Number(get<HTMLSelectElement>('spp').value);session!.driver.target(target);session!.start(target);startedAt=performance.now();dispatches=0;stopDeadline?.();stopDeadline=photoDeadline(session!,()=>interruptReadback?.(),()=>update('FAIL: Deadline 180 s erreicht; Aufnahme verworfen'));update();void render();}
 catch(error){update(`FAIL: ${String(error)}`);}finally{initializing=false;update();}
})();
cancel.onclick=()=>{session?.cancel();update();};
get('resize').onclick=()=>void(async()=>{if(closed)return;try{const [w,h]=dimensions();if(session)await resizePhoto(session,w,h,()=>update());else{canvas.width=w;canvas.height=h;update();}}catch(error){update(`FAIL: ${String(error)}`);}})();
async function dispose(){closed=true;stopDeadline?.();stopDeadline=null;const cleanup=session?.dispose();interruptReadback?.();await cleanup;update();}
get('dispose').onclick=()=>void dispose();
async function capture(){
 if(!resources||!session)throw Error('Capture unavailable');
 const ownedSession=session,ownedSnapshot=snapshot,epoch=session.epoch;
 const camera=resources.camera;
 const captureFrame={width:canvas.width,height:canvas.height,DPR:1,projection:camera.projectionMatrix.elements,view:camera.matrixWorldInverse.elements,toneMapping:'ACESFilmic once at final output',exposure:1.05};
 const runtimeFrameDigest=await digest(new TextEncoder().encode(JSON.stringify(captureFrame)));
 if(session!==ownedSession||snapshot!==ownedSnapshot||session.epoch!==epoch)throw Error('Stale capture frame provenance');
 return capturePng(canvas,ownedSession,{codeBindings,digests:ownedSnapshot.digests,runtimeFrameDigest,captureFrame,unsupported:ownedSnapshot.unsupported,skipped:resources.skipped,adapter:adapterEvidence,
   elapsedDiagnosticMs:performance.now()-startedAt,dispatches,seedPolicy:'upstream stableNoise=true resets kernel seed; exact source bound',quality:'raw pathtracer; no denoiser/upscaler',sourceProvenance:'RD_SYNTHETIC_F00_CONTROL',gfx03VisualParity:'FAIL'});
}
save.onclick=()=>void(async()=>{
 try{
   const result=await capture();
   const a=document.createElement('a'),urls:string[]=[];
   for(const [blob,name] of [[result.blob,`RT08-${session!.target}spp.png`],[new Blob([JSON.stringify(result.sidecar,null,2)],{type:'application/json'}),`RT08-${session!.target}spp.json`]] as [Blob,string][]){const url=URL.createObjectURL(blob);urls.push(url);a.href=url;a.download=name;a.click();}
   setTimeout(()=>urls.forEach(u=>URL.revokeObjectURL(u)),1000);
 }catch(error){update(`FAIL: ${String(error)}`);}
})();
window.addEventListener('pagehide',()=>void dispose());
Object.assign(window,{rt08:{inspect:()=>({closed,mode:runner?'RUNNER':'DOM_ONLY',snapshot:snapshot?.digests,adapter:adapterEvidence,state:closed?'disposed':session?.state??'ready',gpuRequested:session!==null||initializing}),
 async captureBytes(){const result=await capture();return {bytes:Array.from(new Uint8Array(await result.blob.arrayBuffer())),sidecar:result.sidecar};},
 async loseDeviceForRunner(){if(!runner||!session)throw Error('Runner-only active photo required');const cleanup=session.deviceLost();interruptReadback?.();await cleanup;update('DeviceLoss injected: resources destroyed');},
 async replaceSnapshot(next:SceneSnapshot){if(closed||initializing)throw Error('Photo not replaceable');stopDeadline?.();const cleanup=session?.dispose();interruptReadback?.();await cleanup;session=null;resources=null;snapshot=next;update();}}});
try{snapshot=await SceneSnapshot.create(await loadPort());update(runner?'Bereit: Foto explizit starten (nur Runner/A0-Slot)':'Modus: DOM-Diagnose. Kein GPU-Start; Runnerprofil separat.');}
catch(error){closed=true;update(`FAIL: ${String(error)}`);}
