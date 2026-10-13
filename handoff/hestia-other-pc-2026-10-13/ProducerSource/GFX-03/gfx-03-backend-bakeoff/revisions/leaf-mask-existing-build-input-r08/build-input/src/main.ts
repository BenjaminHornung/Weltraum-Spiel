import * as T from 'three';
import {WebGPURenderer,MeshBasicNodeMaterial} from 'three/webgpu';
import {texture,uv} from 'three/tsl';
import {loadPort,digest,windInputs,assertOwner,createDepthCameraPort,lightDepthPolicy,type Variant,type SceneId,type Defect} from './port.ts';
import {surfaceMaterial,sky,setWind,glUniforms} from './b2-materials.ts';
import {admitAdapter} from './capability.mjs';
import {compareImages} from './image-oracle.mjs';

const port=await loadPort();
const status=document.querySelector<HTMLPreElement>('#status')!;
const host=document.querySelector<HTMLDivElement>('#view')!;
let renderer:T.WebGLRenderer|WebGPURenderer|null=null,device:GPUDevice|null=null,canvas:HTMLCanvasElement|null=null;
let scene:T.Scene|null=null,camera:T.PerspectiveCamera|null=null,target:T.WebGLRenderTarget|null=null;
let outputScene:T.Scene|null=null,outputCamera:T.OrthographicCamera|null=null;
let lib:typeof T=T,variant:Variant='current-webgl',sceneId:SceneId='terrain-ao',defect:Defect='none';
let width=384,height=256,tick=120,owner={owner:'terrain',generation:0},leafRoot:T.Group|null=null;
let waterView:'above'|'below'='above';
let generation=0,presentationEpoch=0,scheduled=0,frames=0,mounts=0,disposes=0,drawPromise:Promise<void>=Promise.resolve();
let facts:Record<string,unknown>={},shaderSources:{language:string;code:string}[]=[];
const errors:string[]=[];
let lifecycle:Promise<unknown>=Promise.resolve();
const ownedTextures=new Set<T.Texture>();
const ownedShadows=new Set<T.RenderTarget>();let observedShadowDisposals=0;
function publish(){status.textContent=JSON.stringify({...facts,scene:sceneId,defect,owner,frames,mounts,disposes,liveRenderers:renderer?1:0,liveLoops:scheduled?1:0,
  presentationEpoch,waterView,liveShadowTargets:ownedShadows.size,observedShadowDisposals,
  resolution:[width,height],dpr:1,concurrentSessions:true,qualifiedPerformance:'NOT_RUN',gpuTimerMs:null,policy:lightDepthPolicy,errors},null,2);}
function releaseScene(){
  presentationEpoch++;
  scene?.traverse(o=>{if(o instanceof T.DirectionalLight||'isDirectionalLight' in o)(o as T.DirectionalLight).shadow.dispose();});
  for(const root of [scene,outputScene])root?.traverse(o=>{if(o instanceof T.Mesh||'isMesh' in o){const m=o as T.Mesh;m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material]){for(const value of Object.values(mat))if(value instanceof T.Texture)value.dispose();mat.dispose();}m.customDepthMaterial?.dispose();m.customDistanceMaterial?.dispose();}});
  for(const texture of ownedTextures)texture.dispose();ownedTextures.clear();
  scene=null;outputScene=null;leafRoot=null;target?.dispose();target=null;
}
async function disposeNow(){
  generation++;if(scheduled)cancelAnimationFrame(scheduled);scheduled=0;await drawPromise;
  releaseScene();renderer?.setAnimationLoop(null);renderer?.dispose();device?.destroy();device=null;
  if(renderer){disposes++;renderer=null;}canvas?.remove();canvas=null;publish();
}
export function dispose(){const result=lifecycle.then(disposeNow);lifecycle=result.catch(()=>{});return result;}
function attrs(g:T.BufferGeometry,ao=1){
  const p=g.getAttribute('position');const colors=new Float32Array(p.count*3),aos=new Float32Array(p.count),wet=new Float32Array(p.count);
  for(let i=0;i<p.count;i++){colors.set(defect==='vertex-colors'?[1,1,1]:[0.72,0.92,0.68],i*3);aos[i]=defect==='ao'?1:ao;wet[i]=i%2?0.45:0.05;}
  g.setAttribute('color',new lib.BufferAttribute(colors,3));g.setAttribute('labAo',new lib.BufferAttribute(aos,1));g.setAttribute('labWetness',new lib.BufferAttribute(wet,1));
  if(!g.hasAttribute('uv'))g.setAttribute('uv',new lib.BufferAttribute(new Float32Array(p.count*2),2));return g;
}
function material(id:string,water=false,leaf=false){const data=port.fixture.materials.find(m=>m.id===id)!;
  return surfaceMaterial(lib,variant==='current-webgpu',defect==='emission'?{...data,role:data.role==='emission'?'accent':data.role}:data,water,leaf);}
function makeScene(){
  if(!renderer)throw new Error('Mount renderer first');releaseScene();scene=new lib.Scene();
  camera=new lib.PerspectiveCamera(port.camera.verticalFovDegrees,width/height,0.02,1000);camera.position.fromArray(port.camera.positionMeters);camera.up.fromArray(port.camera.up);camera.lookAt(new lib.Vector3().fromArray(port.camera.targetMeters));
  if(sceneId==='water-depth'&&waterView==='below'){camera.position.set(5,-3,-5);camera.lookAt(2,0.6,0);}
  const skyData=sky(lib,variant==='current-webgpu');ownedTextures.add(skyData.map);scene.add(skyData.mesh);
  const ambient=new lib.AmbientLight(0xffffff,lightDepthPolicy.ambient);const sun=new lib.DirectionalLight(0xffffff,lightDepthPolicy.sunIntensity);sun.position.set(...lightDepthPolicy.sun);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-6;sun.shadow.camera.right=6;sun.shadow.camera.top=6;sun.shadow.camera.bottom=-6;sun.shadow.camera.far=100;
  scene.add(ambient,sun,sun.target);
  for(const object of port.fixture.objects)for(const data of object.meshes){
    const g=new lib.BufferGeometry();g.setAttribute('position',new lib.BufferAttribute((port.buffers.get(data.positions) as Float32Array).slice(),3));
    g.setAttribute('normal',new lib.BufferAttribute((port.buffers.get(data.normals) as Float32Array).slice(),3));g.setIndex(new lib.BufferAttribute((port.buffers.get(data.indices) as Uint32Array).slice(),1));
    const mesh=new lib.Mesh(attrs(g),material(data.materialId));mesh.castShadow=mesh.receiveShadow=true;mesh.name=`${object.ownerId}:${data.materialId}`;scene.add(mesh);
  }
  // ANALYTICAL augmentation: hard seam, alpha decor and depth probes; original RT payloads are unchanged.
  const cube=(pos:[number,number,number],size:[number,number,number],id:string,ao=1)=>{const m=new lib.Mesh(attrs(new lib.BoxGeometry(...size),ao),material(id));m.castShadow=m.receiveShadow=true;m.position.set(...pos);scene!.add(m);return m;};
  if(sceneId==='terrain-ao'){
    cube([1,0.3,-0.75],[2.2,0.6,0.8],'dry',0.36);cube([2,0.8,-0.65],[0.6,1.6,0.8],'dry',0.72);
  }else if(sceneId==='alpha-wind'){
    leafRoot=new lib.Group();leafRoot.position.set(1.6,0.5,-0.7);leafRoot.userData.binding={...owner};
    const g=new lib.PlaneGeometry(1.7,1.7,4,4);g.translate(0,0.85,0);const leaf=new lib.Mesh(attrs(g),material('leaf',false,true));leaf.castShadow=leaf.receiveShadow=true;
    if(variant!=='current-webgpu'){
      const depth=new lib.MeshDepthMaterial({depthPacking:lib.RGBADepthPacking,alphaTest:0.5,side:lib.DoubleSide});
      depth.onBeforeCompile=shader=>{shader.uniforms.uWind=glUniforms.wind;
        shader.vertexShader=`uniform vec2 uWind;varying vec2 vLeafUv;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nvLeafUv=uv;transformed.x+=uWind.y*position.y;transformed.z-=uWind.x*position.y;');
        shader.fragmentShader=`varying vec2 vLeafUv;\n${shader.fragmentShader}`.replace('#include <alphatest_fragment>','vec2 q=vLeafUv-vec2(0.5);diffuseColor.a*=1.0-smoothstep(0.15,0.22,q.x*q.x*2.0+q.y*q.y);\n#include <alphatest_fragment>');};
      depth.customProgramCacheKey=()=> 'gfx03-decor-wind-alpha-depth-v1';leaf.customDepthMaterial=depth;
    }
    leafRoot.add(leaf);scene.add(leafRoot);applyWind();
  }else{
    cube([0.8,0.4,-0.8],[0.8,0.8,0.8],'accent');cube([2.2,1.8,0.3],[0.7,0.7,0.7],'wood');
    const water=new lib.Mesh(attrs(new lib.PlaneGeometry(3.8,3.2,8,8)),material(defect==='water-assignment'?'emission':'wet',true));
    water.material.depthTest=defect!=='water-depth';
    if(defect==='water-side')water.material.side=waterView==='above'?lib.BackSide:lib.FrontSide;
    water.rotation.x=-Math.PI/2;water.position.set(1.8,1.02,-0.1);water.name='single-sheet-water';scene.add(water);
    // A bounded optical candidate layer, explicitly separate from atmospheric/gameplay authority.
    const volumeMat=variant==='current-webgpu'?new MeshBasicNodeMaterial():new lib.MeshBasicMaterial();
    volumeMat.color.setRGB(0.64,0.27,0.78,T.LinearSRGBColorSpace);volumeMat.transparent=true;volumeMat.opacity=0.36;volumeMat.depthWrite=false;volumeMat.side=T.FrontSide;
    const volume=new lib.Mesh(new lib.SphereGeometry(0.4,16,12),volumeMat);volume.position.set(1.8,0.5,-0.6);volume.name='analytical-optical-layer';scene.add(volume);
  }
  target=new lib.WebGLRenderTarget(width,height,{type:lib.HalfFloatType,depthBuffer:true});target.texture.colorSpace=lib.LinearSRGBColorSpace;
  target.depthTexture=new lib.DepthTexture(width,height);target.depthTexture.type=lib.UnsignedIntType;
  outputScene=new lib.Scene();outputCamera=new lib.OrthographicCamera(-1,1,1,-1,0,1);
  const outputMaterial=variant==='current-webgpu'?new MeshBasicNodeMaterial():new lib.MeshBasicMaterial({map:target.texture});
  // WebGPU attachments have top-left texture coordinates; the common quad UV starts bottom-left.
  if(outputMaterial instanceof MeshBasicNodeMaterial)outputMaterial.colorNode=texture(target.texture,uv().flipY());
  outputMaterial.depthTest=false;outputMaterial.depthWrite=false;
  outputScene.add(new lib.Mesh(new lib.PlaneGeometry(2,2),outputMaterial));
}
function applyWind(){const pose=windInputs('rt01-decor-leaf',tick,0.35,[4,0,2],leafRoot?leafRoot.quaternion.toArray() as [number,number,number,number]:[0,0,0,1]);setWind(pose.x,pose.z);}
function renderNow(){
  if(!renderer||!scene||!camera||!target||!outputScene||!outputCamera)return;
  renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(outputScene,outputCamera);frames++;
  scene.traverse(o=>{if(o instanceof T.DirectionalLight||'isDirectionalLight' in o){const shadow=(o as T.DirectionalLight).shadow;
    for(const map of [shadow.map,shadow.mapPass])if(map&&!ownedShadows.has(map)){ownedShadows.add(map);map.addEventListener('dispose',()=>{ownedShadows.delete(map);observedShadowDisposals++;});}}});
}
async function draw(){
  renderNow();
  if(!renderer)return;
  if(device)await device.queue.onSubmittedWorkDone();
  if(renderer instanceof T.WebGLRenderer||'isWebGLRenderer' in renderer){const r=renderer as T.WebGLRenderer;const gl=r.getContext();
    shaderSources=[];for(const program of r.info.programs??[]){const p=program as unknown as {vertexShader:WebGLShader;fragmentShader:WebGLShader};for(const shader of [p.vertexShader,p.fragmentShader])if(shader){const code=gl.getShaderSource(shader);if(code)shaderSources.push({language:'GLSL',code});}}}
  publish();
}
function schedule(){if(!scheduled){const version=generation;scheduled=requestAnimationFrame(()=>{scheduled=0;if(version===generation){drawPromise=draw().catch(e=>{errors.push(String(e));publish();});}});}}
async function mountNow(next:Variant,opts:{requiredFeatures?:GPUFeatureName[];requiredLimits?:Record<string,number>;forceNoAdapter?:boolean}={}){
  await disposeNow();variant=next;defect='none';waterView='above';shaderSources=[];facts={requestedBackend:next,status:'INITIALIZING'};
  canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;host.append(canvas);
  try{
    if(next==='current-webgpu'){
      const adapter=opts.forceNoAdapter?null:await navigator.gpu?.requestAdapter({powerPreference:'high-performance'})??null;
      const admission=admitAdapter(adapter,opts.requiredFeatures??[],{maxTextureDimension2D:Math.max(width,height),...opts.requiredLimits});
      if(admission.status!=='PASS'){facts={...facts,...admission,actualBackend:null,actualAdapter:null};canvas.remove();canvas=null;publish();return facts;}
      const a=adapter!;const limits:Record<string,number>={};for(const key of ['maxTextureDimension2D','maxBindGroups','maxBufferSize','maxStorageBuffersPerShaderStage'])limits[key]=Reflect.get(a.limits,key);
      facts={...facts,adapterInfo:{vendor:a.info.vendor||null,architecture:a.info.architecture||null,device:a.info.device||null,description:a.info.description||null,isFallbackAdapter:Reflect.get(a,'isFallbackAdapter')??null},features:[...a.features],limits};
      device=await a.requestDevice({requiredFeatures:opts.requiredFeatures??[],requiredLimits:opts.requiredLimits??{}});
      const create=device.createShaderModule.bind(device);device.createShaderModule=(descriptor)=>{shaderSources.push({language:'WGSL',code:descriptor.code});return create(descriptor);};
      device.addEventListener('uncapturederror',e=>{errors.push(e.error.message);publish();});
      const gpu=new WebGPURenderer({canvas,device,antialias:false});await gpu.init();
      if(!('isWebGPUBackend' in gpu.backend)){gpu.dispose();throw new Error('UNSUPPORTED: WEBGL_FALLBACK');}
      renderer=gpu;const ownDevice=device,incarnation=generation,standardLoss=gpu.onDeviceLost.bind(gpu);
      gpu.onDeviceLost=info=>{standardLoss(info);if(renderer!==gpu)return;facts={...facts,status:'DEVICE_LOST',lossReason:info.reason};generation++;presentationEpoch++;if(scheduled)cancelAnimationFrame(scheduled);scheduled=0;publish();};
      device.lost.then(info=>{if(device===ownDevice&&generation===incarnation&&info.reason==='destroyed')gpu.onDeviceLost({api:'WebGPU',reason:info.reason,message:info.message,originalEvent:info});});
    }else{
      lib=next==='historical-webgl'?await import(new URL('../vendor/historical/three.module.js',import.meta.url).href) as typeof T:T;
      const glRenderer=new lib.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});renderer=glRenderer;
      const gl=glRenderer.getContext();const ext=gl.getExtension('WEBGL_debug_renderer_info');
      facts={...facts,actualAdapter:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,features:gl.getSupportedExtensions(),limits:{maxTextureDimension2D:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxVertexAttribs:gl.getParameter(gl.MAX_VERTEX_ATTRIBS)}};
      const ownCanvas=canvas;
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(canvas!==ownCanvas||renderer!==glRenderer)return;facts={...facts,status:'CONTEXT_LOST'};generation++;presentationEpoch++;if(scheduled)cancelAnimationFrame(scheduled);scheduled=0;publish();});
      canvas.addEventListener('webglcontextrestored',()=>{if(canvas!==ownCanvas||renderer!==glRenderer)return;facts={...facts,status:'CONTEXT_RESTORED'};presentationEpoch++;publish();});
    }
    if(next==='current-webgpu')lib=T;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=T.SRGBColorSpace;renderer.setPixelRatio(1);renderer.setSize(width,height,false);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
    mounts++;facts={...facts,status:'PASS',actualBackend:next==='current-webgpu'?'WebGPU':'WebGL2',threeVersion:next==='historical-webgl'?'0.185.1':'0.186.1',browser:navigator.userAgent};
    makeScene();drawPromise=draw();await drawPromise;return facts;
  }catch(e){facts={...facts,status:'FAIL',reason:String(e)};await disposeNow();return facts;}
}
export function mount(next:Variant,opts:Parameters<typeof mountNow>[1]={}){const result=lifecycle.then(()=>mountNow(next,opts));lifecycle=result.catch(()=>{});return result;}
async function capture(){if(!canvas||!renderer||facts.status!=='PASS')throw new Error('Capture requires live successful renderer');await drawPromise;
  if(device){
    // Copy the presented texture in the same task as submission, before browser presentation clears it.
    renderNow();const present=canvas.getContext('webgpu')!.getCurrentTexture();const pitch=Math.ceil(width*4/256)*256;
    const buffer=device.createBuffer({size:pitch*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    try{const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture:present},{buffer,bytesPerRow:pitch},{width,height});device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(GPUMapMode.READ);const source=new Uint8Array(buffer.getMappedRange()),pixels=new Uint8ClampedArray(width*height*4);
      for(let y=0;y<height;y++)pixels.set(source.subarray(y*pitch,y*pitch+width*4),y*width*4);
      if(present.format.startsWith('bgra'))for(let i=0;i<pixels.length;i+=4){const r=pixels[i];pixels[i]=pixels[i+2];pixels[i+2]=r;}
      buffer.unmap();return pixels;
    }finally{buffer.destroy();}
  }
  const temp=document.createElement('canvas');temp.width=width;temp.height=height;const ctx=temp.getContext('2d')!;ctx.drawImage(canvas,0,0);
  return ctx.getImageData(0,0,width,height).data;
}
async function setScene(next:SceneId){if(!['terrain-ao','alpha-wind','water-depth'].includes(next))throw new Error('Invalid scene');sceneId=next;makeScene();drawPromise=draw();await drawPromise;}
async function setDefect(next:Defect){if(!['none','vertex-colors','ao','emission','water-assignment','water-depth','water-side'].includes(next))throw new Error('Invalid defect');defect=next;makeScene();drawPromise=draw();await drawPromise;}
async function setWaterView(next:'above'|'below'){if(!['above','below'].includes(next))throw new Error('Invalid water camera');waterView=next;makeScene();drawPromise=draw();await drawPromise;}
async function transferOwner(expected={...owner}){assertOwner(owner,expected);owner={owner:owner.owner==='terrain'?'fragment-1':'terrain',generation:owner.generation+1};
  presentationEpoch++;
  if(leafRoot){leafRoot.position.x+=0.55;leafRoot.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2);leafRoot.userData.binding={...owner};applyWind();}drawPromise=draw();await drawPromise;return {...owner};}
async function resize(w:number,h:number){if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<32||h<32||w>1024||h>1024)throw new Error('Bounded resize only');presentationEpoch++;width=w;height=h;renderer?.setSize(w,h,false);target?.setSize(w,h);if(camera){camera.aspect=w/h;camera.updateProjectionMatrix();}drawPromise=draw();await drawPromise;}
async function injectLoss(){if(device){device.destroy();await device.lost;await Promise.resolve();return 'DEVICE_LOST';}
  if(renderer){const gl=(renderer as T.WebGLRenderer).getContext();const ext=gl.getExtension('WEBGL_lose_context');if(!ext)return 'UNSUPPORTED';
    const lost=new Promise(resolve=>canvas!.addEventListener('webglcontextlost',resolve,{once:true}));ext.loseContext();await lost;return 'CONTEXT_LOST';}return 'UNSUPPORTED';}
document.querySelector('#mount')!.addEventListener('click',async()=>{sceneId=(document.querySelector('#scene') as HTMLSelectElement).value as SceneId;await mount((document.querySelector('#backend') as HTMLSelectElement).value as Variant);});
document.querySelector('#dispose')!.addEventListener('click',()=>{void dispose();});document.querySelector('#owner')!.addEventListener('click',()=>{void transferOwner();});
document.querySelector('#water-view')!.addEventListener('click',()=>{void setWaterView(waterView==='above'?'below':'above');});
window.addEventListener('pagehide',()=>{void dispose();});
if(new URLSearchParams(location.search).get('testBridge')==='1'){
  Object.assign(window,{GfxBridge:{mount,dispose,setScene,setDefect,setWaterView,transferOwner,resize,injectLoss,
    async setTick(next:number){if(!Number.isSafeInteger(next)||next<0)throw new Error('Invalid tick');tick=next;applyWind();drawPromise=draw();await drawPromise;},
    facts:()=>({...facts,owner:{...owner},frames,mounts,disposes,liveRenderers:renderer?1:0,liveLoops:scheduled?1:0,liveShadowTargets:ownedShadows.size,observedShadowDisposals,presentationEpoch,waterView,resolution:[width,height],dpr:1,errors:[...errors]}),
    async capture(){const pixels=await capture();return {pixels:Array.from(pixels),sha256:await digest(pixels),width,height};},
    async shaderBindings(){return Promise.all(shaderSources.map(async s=>({language:s.language,byteLength:new TextEncoder().encode(s.code).length,sha256:await digest(new TextEncoder().encode(s.code)),code:s.code})));},
    readPresentationInputs(){if(!camera||!target?.depthTexture||!renderer||facts.status!=='PASS')throw new Error('Presentation port unavailable');return createDepthCameraPort(camera,target.depthTexture,presentationEpoch,port.fixture.sourceBinding);},
    isPresentationCurrent(epoch:number){return renderer!==null&&facts.status==='PASS'&&epoch===presentationEpoch;},
    compareImages,port:{fixtureBinding:port.fixture.sourceBinding,camera:port.camera,policy:port.policy},schedule}});
}
await mount('current-webgl');
