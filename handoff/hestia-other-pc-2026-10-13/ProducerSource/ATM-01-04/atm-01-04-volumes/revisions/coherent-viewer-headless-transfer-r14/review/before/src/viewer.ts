import * as T from 'three';
import {surfaceMaterial,setWind,importFixture,copyFixturePayload,mountRain,ownerPose,applyWindInputs,DEFAULT_WETNESS_PRESET,sampleAnalyticWetness,bindRestoredOrigin} from './reuse';
import {createVolumePort} from './composer';
import {createTakram} from './takram';
import {validateFrame,rebaseFrame,type AtmosphereFrame,type V3} from './optics';
import rainOptics from '../shaders/rain-optics.glsl';
import {createSingleFlight} from './init';
import {createOpticalReadPort,assertCurrentAnalytic,tangentBasis,type AnalyticInput,type PlanetWeatherQuery} from './weather-port';
const status=document.querySelector('#status') as HTMLElement,canvas=document.querySelector('canvas')!,mode=document.querySelector('#mode') as HTMLSelectElement;
declare const __DATA_BINDINGS__:Record<string,{bytes:number;sha256:string}>;
const checked=async(path:string)=>{const binding=__DATA_BINDINGS__[path];if(!binding)throw Error('UNBOUND_ASSET:'+path);
 const r=await fetch(path);if(!r.ok)throw Error('MISSING:'+path);const bytes=new Uint8Array(await r.arrayBuffer());
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(bytes.length!==binding.bytes||digest!==binding.sha256)throw Error('ASSET_DRIFT:'+path);return bytes;};
async function start(){
 const input:AnalyticInput=JSON.parse(new TextDecoder().decode(await checked('fixtures/chosen-weather-input.json')));
 const query:PlanetWeatherQuery=JSON.parse(new TextDecoder().decode(await checked('fixtures/chosen-weather-query.json')));
 const optics=JSON.parse(new TextDecoder().decode(await checked('fixtures/optics-config.json')));
 const weatherPort=await createOpticalReadPort(input);
 const projected=await weatherPort.read(query,{cloudCoverage:optics.cloudCoverage,rain01:optics.rain01},{originMeters:[0,0,0],sourceRevision:0,atlasEpoch:1});
 if(projected.frame===null){status.textContent='WEATHER_'+projected.status+': no optical frame; no renderer started.';return;}
 await assertCurrentAnalytic(JSON.parse(new TextDecoder().decode(await checked('fixtures/chosen-weather-result.json'))),query,weatherPort.view);
 const frame:AtmosphereFrame=projected.frame,weather=projected.result,basis=tangentBasis(weather.query.bodyFixedPositionMeters);
 const up=new T.Vector3(...basis.up),east=new T.Vector3(...basis.east),north=new T.Vector3(...basis.north);
 const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:true,powerPreference:'high-performance'});
 renderer.toneMapping=T.NoToneMapping;renderer.outputColorSpace=T.LinearSRGBColorSpace;
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info'),adapter=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null;
 if(!gl.getExtension('EXT_color_buffer_float')||!gl.getExtension('OES_texture_float_linear')){status.textContent='UNSUPPORTED: required float HDR/atlas filtering. No GPU or visual PASS.';renderer.dispose();return;}
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,0.1,500000);
 scene.add(new T.HemisphereLight(0x9bb4c5,0x12352c,0.65));
 const sun=new T.DirectionalLight(0xffe3ae,2.1);sun.position.set(-28,42,-18);scene.add(sun,sun.target);
 const dir='rd-fixture',manifestBytes=await checked(dir+'/manifest.json'),manifest=JSON.parse(new TextDecoder().decode(manifestBytes));
 const fixture=await importFixture(manifestBytes,new Map(await Promise.all(manifest.payloads.map(async(p:{id:string;path:string})=>[p.id,await checked(dir+'/'+p.path)] as const))));
 const objects:T.Mesh[]=[];
 for(const object of fixture.objects)for(const source of object.meshes){
  const data=fixture.materials.find(m=>m.id===source.materialId)!;
  if(!source.normals)throw Error('BOUND_NORMALS_REQUIRED');
  const geometry=new T.BufferGeometry(),positions=copyFixturePayload(fixture,source.positions),normals=copyFixturePayload(fixture,source.normals),indices=copyFixturePayload(fixture,source.indices);
  geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(positions),3));geometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(normals),3));
  geometry.setIndex(new T.BufferAttribute(new Uint32Array(indices),1));
  const count=positions.length/3;
  geometry.setAttribute('color',new T.BufferAttribute(new Float32Array(count*3).fill(1),3));geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(count*2),2));
  geometry.setAttribute('labAo',new T.BufferAttribute(new Float32Array(count).fill(0.85),1));geometry.setAttribute('labWetness',new T.BufferAttribute(new Float32Array(count).fill(0.4),1));
  const mesh=new T.Mesh(geometry,surfaceMaterial(T,false,{...data,colorLinearRgb:[...data.colorLinearRgb]},false,data.role==='foliage'));scene.add(mesh);objects.push(mesh);
 }
 const waterGeometry=new T.PlaneGeometry(12,12),count=waterGeometry.getAttribute('position').count;
 for(const [name,size,value] of [['color',3,1],['labAo',1,1],['labWetness',1,0.5]] as const)waterGeometry.setAttribute(name,new T.BufferAttribute(new Float32Array(count*size).fill(value),size));
 const water=new T.Mesh(waterGeometry,surfaceMaterial(T,false,{id:'water',role:'water-presentation',colorLinearRgb:[0.05,0.28,0.35]},true));water.rotation.x=-Math.PI/2;water.position.set(2,0.6,2);scene.add(water);
 const volume=createVolumePort(renderer,scene,camera,water,frame);
 const solids=JSON.parse(new TextDecoder().decode(await checked('fixtures/occluders.json'))).solids as {id:string;min:V3;max:V3}[];
 for(const box of solids){const size=box.max.map((v,i)=>v-box.min[i]),geometry=new T.BoxGeometry(size[0],size[1],size[2]),count=geometry.getAttribute('position').count;
  for(const [name,s,v] of [['color',3,1],['labAo',1,0.85],['labWetness',1,0.2]] as const)geometry.setAttribute(name,new T.BufferAttribute(new Float32Array(count*s).fill(v),s));
  const mesh=new T.Mesh(geometry,surfaceMaterial(T,false,{id:box.id,role:'wood',colorLinearRgb:[0.18,0.27,0.21]}));
  mesh.name=box.id;mesh.position.set(...box.min.map((v,i)=>(v+box.max[i])/2) as V3);scene.add(mesh);objects.push(mesh);
 }
 const restoredOrigin={value:new T.Vector3()};
 for(const mesh of [...objects,water])bindRestoredOrigin(mesh.material as T.Material,restoredOrigin);
 const rainScene=new T.Scene(),rainRoot=new T.Group();rainScene.add(rainRoot);
 const rdWeather={windMps:frame.windMps,rain01:frame.rain01,cloud01:frame.authoredCloudCoverage,snow01:0};
 const controller=new AbortController();
 async function rainFixture(name:string){const path='fixtures/authored-rain/',b=await checked(path+name+'.json'),m=JSON.parse(new TextDecoder().decode(b));
  return importFixture(b,new Map(await Promise.all(m.payloads.map(async(p:{id:string;path:string})=>[p.id,await checked(path+p.path)] as const))));}
 const closedRain=await rainFixture('closed'),openedRain=await rainFixture('open');let rainSourceRevision=1;
 const rain=await mountRain({scene:rainScene,camera,root:rainRoot,fixture:closedRain,frame:{tick:0,seconds:0,paused:true,cameraId:'near',sourceRevision:1,weather:rdWeather},
  resetTick:0,signal:controller.signal,capabilities:{},ownerPose:id=>ownerPose(closedRain,id)},{id:'source-query',parameters:{particles:128,splashes:16,columns:4,seed:23}});
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
 let takram:Awaited<ReturnType<typeof createTakram>>|undefined,raf=0,disposed=false,presentationTick=0,currentFrame=frame;
 const matrix=new T.Matrix4().makeBasis(east,up,north);matrix.setPosition(up.clone().multiplyScalar(frame.bodyRadiusMeters));
 const initialize=createSingleFlight(signal=>createTakram(renderer,scene,camera,frame,matrix,new T.Vector3(-0.4,0.8,-0.4472135955).transformDirection(matrix),signal));
 const poses={below:[5,3,-8],inside:[0,20,0],above:[8,45,-12],orbit:[0,100000,0]} as const;
 const targets={below:[2,14,2],inside:[15,20,5],above:[0,16,0],orbit:[0,0,0]} as const;
 const position=document.querySelector('#position') as HTMLSelectElement;
 function pose(){const key=position.value as keyof typeof poses,p=poses[key],t=targets[key];camera.position.set(...p.map((v,i)=>v-currentFrame.originMeters[i]) as V3);camera.lookAt(new T.Vector3(...t.map((v,i)=>v-currentFrame.originMeters[i]) as V3));camera.updateMatrixWorld();}
 pose();position.onchange=pose;
 function resize(){renderer.setSize(960,540,false);camera.aspect=960/540;camera.updateProjectionMatrix();volume.resize(960,540);volume.rainUniforms.uViewport.value.set(960,540);takram?.resize(960,540);}
 resize();
 async function select(){const selected=mode.value;volume.setMode(selected==='lut'?1:selected==='low'?3:0);
  if(selected==='takram'&&frame.status!=='Known'){mode.value='analytic';status.textContent='TAKRAM_UNSUPPORTED: '+frame.status;return;}
  if(selected==='takram'&&!takram){
   status.textContent='Preparing pinned Takram LUT; GPU proof remains diagnostic until Runner records it.';
   takram=await initialize.load();if(disposed)return;takram.setOrigin(currentFrame.originMeters);takram.resize(960,540);
  }
 }
 mode.onchange=()=>{select().catch(e=>{status.textContent='TAKRAM FAIL: '+e.message;mode.value='analytic';});};
 function loop(){if(disposed)return;if(initialize.busy){raf=requestAnimationFrame(loop);return;}presentationTick++;
  const rdTick=Math.floor(presentationTick/2);rain.setFrame({tick:rdTick,seconds:rdTick/60,paused:false,cameraId:'near',sourceRevision:rainSourceRevision,weather:rdWeather});
  const wet=sampleAnalyticWetness(DEFAULT_WETNESS_PRESET,rdTick,0,'exposed').wetness01;
  for(const mesh of objects)(mesh.geometry.getAttribute('labWetness').array as Float32Array).fill(wet);
  for(const mesh of objects)mesh.geometry.getAttribute('labWetness').needsUpdate=true;
  const wind=applyWindInputs('control.decor',rdTick,0.4,rdWeather,[0,0,0,1]);setWind(wind.angles.x,wind.angles.z);
  const flash=presentationTick%240<8?'authored.lightning.'+Math.floor(presentationTick/240):null;volume.lightning(flash);
  const result=volume.render(mode.value==='takram'&&takram?()=>takram!.render():undefined,rainScene);
  status.textContent=`${mode.value} / ${position.value} / LOCAL_WINDOWS_ISOLATED diagnostic\nStorm ${frame.stormIds[0]}\nAdapter ${adapter??'UNAVAILABLE'}\nGPU timer NOT_RUN, reference NOT_RUN, integration NO\n${result.status}`;
  raf=requestAnimationFrame(loop);
 }
 document.querySelector('#rebase')!.addEventListener('click',()=>{const shift=new T.Vector3(1024,0,0);scene.position.sub(shift);rainScene.position.sub(shift);camera.position.sub(shift);
  currentFrame=rebaseFrame(currentFrame,[1024,0,0]);restoredOrigin.value.set(...currentFrame.originMeters);volume.setFrame(currentFrame);
  takram?.setOrigin(currentFrame.originMeters);});
 document.querySelector('#defect')!.addEventListener('change',e=>volume.setMode(mode.value==='lut'?1:0,Number((e.target as HTMLSelectElement).value)));
 document.querySelector('#loss')!.addEventListener('click',()=>{const ext=gl.getExtension('WEBGL_lose_context');ext?.loseContext();setTimeout(()=>ext?.restoreContext(),250);});
 document.querySelector('#open')!.addEventListener('click',()=>{void rain.replaceFixture(openedRain).then(()=>{rainSourceRevision=2;scene.getObjectByName('roof')!.visible=false;scene.getObjectByName('cave.roof')!.visible=false;
  rainRoot.traverse(o=>{if((o as T.Mesh).isMesh&&!['rain-drops','rain-splashes'].includes(o.name))o.visible=false;});currentFrame=validateFrame({...currentFrame,sourceRevision:2});volume.setFrame(currentFrame);});});
 const api={diagnostics:()=>({volume:volume.diagnostics(),renderer:renderer.info.memory,actualAdapter:adapter,weatherSnapshotId:frame.weatherSnapshotId,stormIds:frame.stormIds,canvases:document.querySelectorAll('canvas').length,mainLoops:disposed?0:1,referenceAcceptance:false}),
  dispose:async()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);controller.abort();await rain.dispose();await initialize.dispose();volume.dispose();objects.forEach(m=>{m.geometry.dispose();(m.material as T.Material).dispose();});water.geometry.dispose();(water.material as T.Material).dispose();renderer.dispose();}};
 Object.assign(window,{ATM:api});window.addEventListener('pagehide',()=>{void api.dispose();},{once:true});loop();
}
start().catch(e=>{status.textContent='FAIL: '+e.message;console.error(e);});
