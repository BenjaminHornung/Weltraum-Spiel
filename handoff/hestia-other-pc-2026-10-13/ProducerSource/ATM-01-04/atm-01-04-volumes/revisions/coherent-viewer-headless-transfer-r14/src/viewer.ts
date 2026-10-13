import * as T from 'three';
import {surfaceMaterial,setWind,importFixture,copyFixturePayload,mountRain,ownerPose,applyWindInputs,fixtureRevision,WET_LIMITS,bindRestoredOrigin} from './reuse';
import {createVolumePort} from './composer';
import {createTakram} from './takram';
import {validateFrame,rebaseFrame,type AtmosphereFrame,type V3} from './optics';
import rainOptics from '../shaders/rain-optics.glsl';
import {createSingleFlight,disposeOwnedAsync} from './init';
import {createViewerWetness} from './wetness';
import {prepareTemporalRequests,type OwnerPortInputs} from './temporal-boundary';
import {createOpticalReadPort,assertCurrentAnalytic,tangentBasis,type AnalyticInput,type PlanetWeatherQuery} from './weather-port';
const status=document.querySelector('#status') as HTMLElement,canvas=document.querySelector('canvas')!,mode=document.querySelector('#mode') as HTMLSelectElement;
declare const __DATA_BINDINGS__:Record<string,{bytes:number;sha256:string}>;
declare const __ROOT_PATH__:string;
const checked=async(path:string)=>{const binding=__DATA_BINDINGS__[path];if(!binding)throw Error('UNBOUND_ASSET:'+path);
 const r=await fetch(path);if(!r.ok)throw Error('MISSING:'+path);const bytes=new Uint8Array(await r.arrayBuffer());
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(bytes.length!==binding.bytes||digest!==binding.sha256)throw Error('ASSET_DRIFT:'+path);return bytes;};
async function start(){
 let disposed=false,raf=0,loopScheduled=false,disposal:Promise<void>|undefined;
 const owned:(()=>void|Promise<void>)[]=[];
 const own=<R extends {dispose():void|Promise<void>}>(value:R)=>{owned.push(()=>value.dispose());return value;};
 const dispose=()=>disposal??=Promise.resolve().then(async()=>{disposed=true;cancelAnimationFrame(raf);loopScheduled=false;await disposeOwnedAsync(owned);});
 try {
 const input:AnalyticInput=JSON.parse(new TextDecoder().decode(await checked('fixtures/chosen-weather-input.json')));
 const query:PlanetWeatherQuery=JSON.parse(new TextDecoder().decode(await checked('fixtures/chosen-weather-query.json')));
 const optics=JSON.parse(new TextDecoder().decode(await checked('fixtures/optics-config.json')));
 const weatherPort=await createOpticalReadPort(input);
 const projected=await weatherPort.read(query,{cloudCoverage:optics.cloudCoverage,rain01:optics.rain01},{originMeters:[0,0,0],sourceRevision:0,atlasEpoch:1});
 if(projected.frame===null){status.textContent='WEATHER_'+projected.status+': no optical frame; no renderer started.';return;}
 await assertCurrentAnalytic(JSON.parse(new TextDecoder().decode(await checked('fixtures/chosen-weather-result.json'))),query,weatherPort.view);
 const frame:AtmosphereFrame=projected.frame,weather=projected.result,basis=tangentBasis(weather.query.bodyFixedPositionMeters);
 const up=new T.Vector3(...basis.up),east=new T.Vector3(...basis.east),north=new T.Vector3(...basis.north);
 const renderer=own(new T.WebGLRenderer({canvas,antialias:false,alpha:true,powerPreference:'high-performance'}));
 renderer.toneMapping=T.NoToneMapping;renderer.outputColorSpace=T.LinearSRGBColorSpace;
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info'),adapter=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null;
 if(!gl.getExtension('EXT_color_buffer_float')||!gl.getExtension('OES_texture_float_linear')){status.textContent='UNSUPPORTED: required float HDR/atlas filtering. No GPU or visual PASS.';await dispose();return;}
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,0.1,500000);
 scene.add(new T.HemisphereLight(0x9bb4c5,0x12352c,0.65));
 const sun=new T.DirectionalLight(0xffe3ae,2.1);sun.position.set(-28,42,-18);scene.add(sun,sun.target);
 const dir='rd-fixture',manifestBytes=await checked(dir+'/manifest.json'),manifest=JSON.parse(new TextDecoder().decode(manifestBytes));
 const fixture=await importFixture(manifestBytes,new Map(await Promise.all(manifest.payloads.map(async(p:{id:string;path:string})=>[p.id,await checked(dir+'/'+p.path)] as const))));
 const objects:T.Mesh[]=[];
 for(const object of fixture.objects)for(const source of object.meshes){
  const data=fixture.materials.find(m=>m.id===source.materialId)!;
  if(!source.normals)throw Error('BOUND_NORMALS_REQUIRED');
  const geometry=own(new T.BufferGeometry()),positions=copyFixturePayload(fixture,source.positions),normals=copyFixturePayload(fixture,source.normals),indices=copyFixturePayload(fixture,source.indices);
  geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(positions),3));geometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(normals),3));
  geometry.setIndex(new T.BufferAttribute(new Uint32Array(indices),1));
  const count=positions.length/3;
  geometry.setAttribute('color',new T.BufferAttribute(new Float32Array(count*3).fill(1),3));geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(count*2),2));
  geometry.setAttribute('labAo',new T.BufferAttribute(new Float32Array(count).fill(0.85),1));geometry.setAttribute('labWetness',new T.BufferAttribute(new Float32Array(count).fill(0.4),1));
  const mesh=new T.Mesh(geometry,own(surfaceMaterial(T,false,{...data,colorLinearRgb:[...data.colorLinearRgb]},false,data.role==='foliage')));
  const pose=ownerPose(fixture,object.ownerId);if(!pose)throw Error('FIXTURE_OWNER_MISSING');mesh.position.set(...pose.originMeters);mesh.quaternion.set(...pose.rotationXyzw);scene.add(mesh);objects.push(mesh);
 }
 const waterGeometry=own(new T.PlaneGeometry(12,12)),count=waterGeometry.getAttribute('position').count;
 for(const [name,size,value] of [['color',3,1],['labAo',1,1],['labWetness',1,0.5]] as const)waterGeometry.setAttribute(name,new T.BufferAttribute(new Float32Array(count*size).fill(value),size));
 const water=new T.Mesh(waterGeometry,own(surfaceMaterial(T,false,{id:'water',role:'water-presentation',colorLinearRgb:[0.05,0.28,0.35]},true)));water.rotation.x=-Math.PI/2;water.position.set(2,0.6,2);scene.add(water);
 const volume=own(createVolumePort(renderer,scene,camera,water,frame));
 const solids=JSON.parse(new TextDecoder().decode(await checked('fixtures/occluders.json'))).solids as {id:string;min:V3;max:V3}[];
 for(const box of solids){const size=box.max.map((v,i)=>v-box.min[i]),geometry=own(new T.BoxGeometry(size[0],size[1],size[2])),count=geometry.getAttribute('position').count;
  for(const [name,s,v] of [['color',3,1],['labAo',1,0.85],['labWetness',1,0.2]] as const)geometry.setAttribute(name,new T.BufferAttribute(new Float32Array(count*s).fill(v),s));
  const mesh=new T.Mesh(geometry,own(surfaceMaterial(T,false,{id:box.id,role:'wood',colorLinearRgb:[0.18,0.27,0.21]})));
  mesh.name=box.id;mesh.position.set(...box.min.map((v,i)=>(v+box.max[i])/2) as V3);scene.add(mesh);objects.push(mesh);
 }
 const restoredOrigin={value:new T.Vector3()};
 for(const mesh of [...objects,water])bindRestoredOrigin(mesh.material as T.Material,restoredOrigin);
 const rainScene=new T.Scene(),rainRoot=new T.Group();rainScene.add(rainRoot);
 const rdWeather={windMps:frame.windMps,rain01:frame.rain01,cloud01:frame.authoredCloudCoverage,snow01:0};
 const controller=new AbortController();
 owned.push(()=>controller.abort());
 async function rainFixture(name:string){const path='fixtures/authored-rain/',b=await checked(path+name+'.json'),m=JSON.parse(new TextDecoder().decode(b));
  return importFixture(b,new Map(await Promise.all(m.payloads.map(async(p:{id:string;path:string})=>[p.id,await checked(path+p.path)] as const))));}
 const closedRain=await rainFixture('closed'),openedRain=await rainFixture('open');let rainSourceRevision=fixtureRevision(closedRain),currentRain=closedRain,replacing=false;
 const rain=own(await mountRain({scene:rainScene,camera,root:rainRoot,fixture:closedRain,frame:{tick:0,seconds:0,paused:true,cameraId:'near',sourceRevision:rainSourceRevision,weather:rdWeather},
  resetTick:0,signal:controller.signal,capabilities:{},ownerPose:id=>ownerPose(currentRain,id)},{id:'source-query',parameters:{particles:128,splashes:16,columns:4,seed:23}}));
 const wetness=own(createViewerWetness(closedRain,objects,frame.rain01));
 rainRoot.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;const material=mesh.material as T.MeshBasicMaterial;
  if(!['rain-drops','rain-splashes'].includes(mesh.name)){mesh.visible=false;return;}
  material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,volume.rainUniforms);
   shader.vertexShader='varying vec3 vRainWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvRainWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;');
   shader.fragmentShader=rainOptics+'\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`vec2 screenUv=gl_FragCoord.xy/uViewport;float rainDist=length(vRainWorld-cameraPosition);
    float opaque=texture2D(uOpaqueDepth,screenUv).r;float wd=texture2D(uWaterDepth,screenUv).r;
    if(opaque<1.0&&rainDist>rainDistance(screenUv,opaque))discard;
    diffuseColor.a*=rainTransmittance(cameraPosition,vRainWorld);
    if(wd<1.0&&rainDist>rainDistance(screenUv,wd))diffuseColor.a*=0.44;
    #include <opaque_fragment>`);
  };material.customProgramCacheKey=()=> 'atm.rd-rain-optics.v1';});
 let takram:Awaited<ReturnType<typeof createTakram>>|undefined,presentationTick=0,rdTick=0,currentFrame=validateFrame({...frame,sourceRevision:rainSourceRevision}),wetnessResult:ReturnType<typeof wetness.update>|undefined;
 volume.setFrame(currentFrame);
 const matrix=new T.Matrix4().makeBasis(east,up,north);matrix.setPosition(up.clone().multiplyScalar(frame.bodyRadiusMeters));
 const initialize=own(createSingleFlight(signal=>createTakram(renderer,scene,camera,frame,matrix,new T.Vector3(-0.4,0.8,-0.4472135955).transformDirection(matrix),signal)));
 const poses={below:[5,3,-8],inside:[0,20,0],above:[8,45,-12],orbit:[0,100000,0]} as const;
 const targets={below:[2,14,2],inside:[15,20,5],above:[0,16,0],orbit:[0,0,0]} as const;
 const position=document.querySelector('#position') as HTMLSelectElement;
 function pose(){const key=position.value as keyof typeof poses,p=poses[key],t=targets[key];camera.position.set(...p.map((v,i)=>v-currentFrame.originMeters[i]) as V3);camera.lookAt(new T.Vector3(...t.map((v,i)=>v-currentFrame.originMeters[i]) as V3));camera.updateMatrixWorld();}
 pose();position.onchange=pose;
 function resize(width=960,height=540,dpr=1){if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isFinite(dpr)||dpr<1||dpr>4)throw Error('VIEW_SIZE');
  renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();const pixels=renderer.getDrawingBufferSize(new T.Vector2());volume.resize(pixels.x,pixels.y);volume.rainUniforms.uViewport.value.copy(pixels);takram?.resize(width,height);}
 resize();
 async function select(){const selected=mode.value;volume.setMode(selected==='lut'?1:selected==='low'?3:0);
  if(selected==='takram'&&frame.status!=='Known'){mode.value='analytic';status.textContent='TAKRAM_UNSUPPORTED: '+frame.status;return;}
  if(selected==='takram'&&!takram){
   status.textContent='Preparing pinned Takram LUT; GPU proof remains diagnostic until Runner records it.';
   takram=await initialize.load();if(disposed)return;takram.setOrigin(currentFrame.originMeters);const logical=renderer.getSize(new T.Vector2());takram.resize(logical.x,logical.y);
  }
 }
 mode.onchange=()=>{select().catch(e=>{status.textContent='TAKRAM FAIL: '+e.message;mode.value='analytic';});};
 function renderTick(tick:number){if(disposed)throw Error('VIEWER_DISPOSED');if(initialize.busy||replacing)throw Error('VIEWER_PREPARING');
  if(!Number.isSafeInteger(tick)||tick<0||tick>WET_LIMITS.maxTick)throw Error('VIEW_TICK');rdTick=tick;
  rain.setFrame({tick:rdTick,seconds:rdTick/60,paused:false,cameraId:'near',sourceRevision:rainSourceRevision,weather:rdWeather});
  wetnessResult=wetness.update(rdTick,rdWeather,currentFrame.originMeters);
  const wind=applyWindInputs('control.decor',rdTick,0.4,rdWeather,[0,0,0,1]);setWind(wind.angles.x,wind.angles.z);
  const result=volume.render(mode.value==='takram'&&takram?()=>takram!.render():undefined,rainScene);
  status.textContent=`${mode.value} / ${position.value} / LOCAL_WINDOWS_ISOLATED diagnostic\nStorm ${frame.stormIds[0]}\nAdapter ${adapter??'UNAVAILABLE'}\nGPU timer NOT_RUN, reference NOT_RUN, integration NO\n${result.status}`;
  return result;
 }
 const headless=new URLSearchParams(location.search).get('diagnostic')==='1';
 function schedule(){if(disposed)return;raf=requestAnimationFrame(loop);loopScheduled=true;}
 function loop(){loopScheduled=false;if(disposed)return;if(initialize.busy||replacing){schedule();return;}presentationTick++;const tick=Math.floor(presentationTick/2);
  if(tick>WET_LIMITS.maxTick){status.textContent='FINITE_TICK_BUDGET_REACHED';return;}
  try{renderTick(tick);}catch(error){status.textContent='FAIL: '+String(error);void dispose().catch(console.error);return;}schedule();}
 function rebase(offset:V3=[1024,0,0]){const next=rebaseFrame(currentFrame,offset),shift=new T.Vector3(...offset);scene.position.sub(shift);rainScene.position.sub(shift);camera.position.sub(shift);
  currentFrame=next;restoredOrigin.value.set(...currentFrame.originMeters);volume.setFrame(currentFrame);takram?.setOrigin(currentFrame.originMeters);}
 const onRebase=()=>rebase();document.querySelector('#rebase')!.addEventListener('click',onRebase);owned.push(()=>document.querySelector('#rebase')!.removeEventListener('click',onRebase));
 const onDefect=(e:Event)=>volume.setMode(mode.value==='lut'?1:mode.value==='low'?3:0,Number((e.target as HTMLSelectElement).value));document.querySelector('#defect')!.addEventListener('change',onDefect);owned.push(()=>document.querySelector('#defect')!.removeEventListener('change',onDefect));
 const lossExtension=gl.getExtension('WEBGL_lose_context');let restorationTimer:ReturnType<typeof setTimeout>|undefined;
 const onLoss=()=>{if(!lossExtension)return;lossExtension.loseContext();restorationTimer=setTimeout(()=>lossExtension.restoreContext(),250);};document.querySelector('#loss')!.addEventListener('click',onLoss);
 owned.push(()=>{if(restorationTimer!==undefined)clearTimeout(restorationTimer);document.querySelector('#loss')!.removeEventListener('click',onLoss);});
 async function openRoof(){if(disposed)throw Error('VIEWER_DISPOSED');if(replacing)throw Error('VIEWER_PREPARING');replacing=true;try{await rain.replaceFixture(openedRain);wetness.replace(openedRain,rdTick);currentRain=openedRain;rainSourceRevision=fixtureRevision(openedRain);
  scene.getObjectByName('roof')!.visible=false;scene.getObjectByName('cave.roof')!.visible=false;
  rainRoot.traverse(o=>{if((o as T.Mesh).isMesh&&!['rain-drops','rain-splashes'].includes(o.name))o.visible=false;});currentFrame=validateFrame({...currentFrame,sourceRevision:rainSourceRevision});volume.setFrame(currentFrame);}finally{replacing=false;}}
 const onOpen=()=>{void openRoof().catch(error=>{status.textContent='OPEN_ROOF_FAIL: '+String(error);});};document.querySelector('#open')!.addEventListener('click',onOpen);owned.push(()=>document.querySelector('#open')!.removeEventListener('click',onOpen));
 const api={diagnostics:()=>({volume:volume.diagnostics(),renderer:renderer.info.memory,actualAdapter:adapter,weatherSnapshotId:frame.weatherSnapshotId,weatherSimulationTick:frame.simulationTick,stormIds:frame.stormIds,rdTick,
  wetness:wetnessResult?{unknownSamples:wetnessResult.unknownSamples,fixtureDigest:wetnessResult.fixtureDigest,sourceRevision:wetnessResult.sourceRevision}:null,lightningOwner:'AUTHORED_DIAGNOSTIC_CONTROL_NOT_WEATHER_EVENT',canvases:document.querySelectorAll('canvas').length,mainLoops:loopScheduled?1:0,headlessManualPump:headless&&!disposed,temporalReady:false,referenceAcceptance:false}),
  step:(tick:number)=>{if(!headless)throw Error('HEADLESS_MANUAL_PUMP_REQUIRED');return renderTick(tick);},
  setView:(value:string)=>{if(!(value in poses))throw Error('VIEW');position.value=value;pose();},
  setMode:async(value:string)=>{if(!['analytic','lut','takram','low'].includes(value))throw Error('MODE');mode.value=value;await select();},
  setDefect:(value:number)=>volume.setMode(mode.value==='lut'?1:mode.value==='low'?3:0,value),
  setLightning:(id:string|null)=>volume.lightning(id),openRoof,rebase,resize,dispose,
  prepareTemporal:(owners:OwnerPortInputs={})=>{const path='fixtures/chosen-weather-result.json',binding=__DATA_BINDINGS__[path];return prepareTemporalRequests(currentFrame,{sourceId:'frozen-wxg-chosen-result',absolutePath:__ROOT_PATH__+'/'+path,...binding},owners);},
  loseContext:()=>{if(!lossExtension)return {status:'Unsupported',reason:'WEBGL_LOSE_CONTEXT_UNAVAILABLE'};lossExtension.loseContext();return {status:'REQUESTED'};},
  restoreContext:()=>{if(!lossExtension)return {status:'Unsupported',reason:'WEBGL_LOSE_CONTEXT_UNAVAILABLE'};lossExtension.restoreContext();return {status:'REQUESTED'};}};
 owned.push(()=>{mode.onchange=null;position.onchange=null;controller.abort();});
 Object.assign(window,{ATM:api});const onHide=()=>{void dispose().catch(console.error);};window.addEventListener('pagehide',onHide,{once:true});owned.push(()=>window.removeEventListener('pagehide',onHide));
 if(!headless)loop();return api;
 }catch(error){try{await dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'VIEWER_INIT_AND_CLEANUP_FAILED',{cause:error});}throw error;}
}
start().catch(e=>{status.textContent='FAIL: '+e.message;console.error(e);});
