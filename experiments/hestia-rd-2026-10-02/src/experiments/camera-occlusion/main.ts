import{createCameraOcclusionExperiment}from'./index';
import{loadInventory,loadReplay,publicAssetRoot}from'../../runner/assets';
import{createControlledClock,sampleScenario}from'../../contracts/scenario';
import{createFrameInput,mountExperiment,registeredMountCount,type LabExperimentHandle}from'../../contracts/experiment';
import{getFixtureDigest}from'../../contracts/fixture';
import{liveThreeHostCounts}from'../../runner/threeHost';
import{Mesh,Raycaster,Vector3,type Plane}from'three';
import{copyFixturePayload,importFixture}from'../../contracts/fixture';
import{sha256,requireValue}from'../../contracts/validation';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id)!as T,canvas=el<HTMLCanvasElement>('view'),camera=el<HTMLSelectElement>('camera'),variant=el<HTMLSelectElement>('variant'),root=publicAssetRoot(import.meta.env.BASE_URL,location.href);
let host:Awaited<ReturnType<typeof createCameraOcclusionExperiment>>|undefined,handle:LabExperimentHandle|undefined,life:AbortController|undefined,clock=createControlledClock(1800),timer:ReturnType<typeof setTimeout>|undefined,busy=false;
function stop(){if(timer!==undefined){clearTimeout(timer);timer=undefined;}}
function publish(){el('facts').textContent=JSON.stringify({mode:'VIEW_ONLY_CAMERA_EXPERIMENT',variant:variant.value,clock:clock.read(),occlusion:host?.readOcclusion(),facts:handle?.readFacts(),diagnostics:host?.readDiagnostics(),mounts:registeredMountCount(),liveHosts:liveThreeHostCounts(),productIntegrated:false,art:'PENDING_OWNER'},null,2);}
async function frame(){if(!host)return;const time=clock.read(),sample=sampleScenario(replay.scenario,time.tick,time.paused);if(getFixtureDigest(sample.fixture)!==host.readFacts().fixtureDigest)await handle!.replaceFixture(sample.fixture);host.setResetTick(sample.resetTick);handle!.setFrame(createFrameInput({...sample.frame,cameraId:camera.value}));publish();}
async function dispose(){stop();life?.abort();await handle?.dispose();host=undefined;handle=undefined;life=undefined;variant.disabled=false;}
async function command(action:()=>Promise<void>|void,message:string){if(busy)return;busy=true;try{await action();el('status').textContent=message;}catch(e){stop();el('status').textContent=`Rejected: ${String(e)}`;}finally{busy=false;publish();}}
el('mount').onclick=()=>{void command(async()=>{await dispose();clock=createControlledClock(replay.scenario.durationTicks);clock.pause(true);life=new AbortController();handle=await mountExperiment(async(c)=>{host=await createCameraOcclusionExperiment(c);return host;},{canvas,fixture:replay.initialFixture,preset:{id:variant.value},signal:life.signal,capabilities:{}});variant.disabled=true;await frame();},'Kamera-Labor aktiv');};
el('dispose').onclick=()=>{void command(dispose,'Disposed');};camera.onchange=()=>{void command(frame,'Kamera angewendet');};
el('seek').onclick=()=>{stop();void command(async()=>{clock.seek(el<HTMLInputElement>('tick').valueAsNumber);clock.pause(true);await frame();},'Seek angewendet');};
el('reset').onclick=()=>{stop();void command(async()=>{clock.reset();clock.pause(true);el<HTMLInputElement>('tick').value='0';await frame();},'Reset angewendet');};
el('pause').onclick=()=>{stop();void command(async()=>{clock.pause(true);await frame();},'Pausiert');};
function schedule(){if(!host||clock.read().paused)return;timer=setTimeout(()=>{timer=undefined;void command(async()=>{clock.advance(1);if(clock.read().tick>=replay.scenario.durationTicks)clock.pause(true);await frame();},'Play — kontrollierte Ticks').then(schedule);},1000/60);}
el('play').onclick=()=>{stop();void command(async()=>{clock.pause(false);await frame();},'Play').then(schedule);};canvas.addEventListener('three-lab-rendered',()=>{if(!busy)publish();});window.addEventListener('pagehide',()=>{void dispose();},{once:true});
const inventory=await loadInventory(root),replay=await loadReplay(inventory,'F05-CUTOUT-REPLAY',root);for(const c of replay.initialFixture.cameras)camera.add(new Option(c.id,c.id));camera.value='near';el<HTMLButtonElement>('mount').disabled=false;el('status').textContent='Bereit — lokale Ansicht, Source bleibt erhalten';publish();
if(new URLSearchParams(location.search).get('testBridge')==='1')Object.defineProperty(window,'CameraTestBridge',{value:Object.freeze({async rejectInvalidCameraCandidate(){
 requireValue(host&&handle&&variant.value==='push-in','Mounted push-in host required');const fixture=replay.initialFixture,near=fixture.cameras.find(c=>c.id==='near')!;
 const payloads=new Map(fixture.payloads.map(p=>[p.id,new Uint8Array(copyFixturePayload(fixture,p.id).buffer)])),bad=await importFixture(new TextEncoder().encode(JSON.stringify({...fixture,cameras:[{...near,targetMeters:[100,100,100]},...fixture.cameras.filter(c=>c.id!=='near')]})),payloads);
 const before={occlusion:host.readOcclusion(),diagnostics:host.readDiagnostics(),roots:host.scene.children.map(c=>c.uuid)};let error='';try{await handle.replaceFixture(bad);}catch(e){error=String(e);}const after={occlusion:host.readOcclusion(),diagnostics:host.readDiagnostics(),roots:host.scene.children.map(c=>c.uuid)};publish();return{error,rejectedDigest:getFixtureDigest(bad),before,after};
},async inspect(){
 requireValue(host,'Mounted camera host required');const fixture=sampleScenario(replay.scenario,clock.read().tick,true).fixture,sample=host.readOcclusion(),target=new Vector3(...sample.targetPosition!),ray=new Raycaster(new Vector3(...sample.cameraPosition),target.clone().sub(new Vector3(...sample.cameraPosition)).normalize());
 host.scene.updateMatrixWorld(true);const hits=ray.intersectObjects(host.scene.children,true).filter(h=>h.object instanceof Mesh).map(h=>({mesh:h.object.name,distance:h.distance,point:h.point.toArray(),faceIndex:h.faceIndex}));
 const source=[];for(const p of fixture.payloads)source.push({id:p.id,sha256:await sha256(new Uint8Array(copyFixturePayload(fixture,p.id).buffer))});
 const materials:any[]=[];host.scene.traverse(o=>{if(o instanceof Mesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.push({mesh:o.name,uuid:m.uuid,planes:m.clippingPlanes?.map((p:Plane)=>({normal:p.normal.toArray(),constant:p.constant}))??[],clipIntersection:m.clipIntersection,clipShadows:m.clipShadows});});
 const ndc=target.project(host.camera);return{source,hits,materials,targetNdc:ndc.toArray(),diagnostics:host.readDiagnostics()};
}}),configurable:false});
