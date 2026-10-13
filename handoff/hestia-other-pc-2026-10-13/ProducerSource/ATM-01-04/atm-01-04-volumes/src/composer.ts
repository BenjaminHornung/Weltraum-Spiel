import * as T from 'three';
import {createDepthCameraPort} from './reuse';
import {buildLut,density,createHistory,validateFrame,skyProfile,type AtmosphereFrame} from './optics';
import volumeSource from '../shaders/volume.frag.glsl';
import vertexSource from '../shaders/fullscreen.vert.glsl';
import outputSource from '../shaders/output.frag.glsl';
import {createDiagnosticTimer} from './timer';
export function createVolumePort(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,water:T.Object3D,initial:AtmosphereFrame){
 let frame=validateFrame(initial),disposed=false,lost=false,epoch=1,lightning=0,mode=0,defect=0;
 const savedFog=scene.fog;scene.fog=null;
 const context=renderer.getContext?.()??null;
 const timer=createDiagnosticTimer(context&&'beginQuery' in context?context as WebGL2RenderingContext:null);let uploaded=false;
 const history=createHistory(),targets:T.WebGLRenderTarget[]=[];
 const make=(depth=true)=>{const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,format:T.RGBAFormat,depthBuffer:depth});
  if(depth)target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);targets.push(target);return target;};
 const opaque=make(),waterColor=make(),waterDepth=make(),hdr=make(false);
 const waterScene=new T.Scene(),waterCopy=water.clone(true);waterScene.add(waterCopy);
 scene.traverse(o=>{if((o as T.Light).isLight)waterScene.add(o.clone());});
 const depthMaterial=new T.MeshDepthMaterial({side:T.DoubleSide});depthMaterial.colorWrite=false;
 const fullScene=new T.Scene(),fullCamera=new T.Camera(),geometry=new T.PlaneGeometry(2,2);
 const lut=buildLut(skyProfile(frame),32,64);
 const skyMap=new T.DataTexture(lut.values,lut.width,lut.rows,T.RedFormat,T.FloatType);skyMap.minFilter=skyMap.magFilter=T.LinearFilter;skyMap.needsUpdate=true;
 const n=32,atlasData=new Float32Array(n*n*n*2);
 for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const p:[number,number,number]=[-80+160*(x+0.5)/n,8+24*(y+0.5)/n,-80+160*(z+0.5)/n],i=((z*n+y)*n+x)*2;
  atlasData[i]=density(p,1);let depth=0;
  for(let s=0;s<16;s++)depth+=density([p[0]-0.4*s*3,p[1]+0.8*s*3,p[2]-0.4472135955*s*3],1)*3;
  atlasData[i+1]=Math.exp(-depth);
 }
 const atlas=new T.Data3DTexture(atlasData,n,n,n);atlas.format=T.RGFormat;atlas.type=T.FloatType;atlas.minFilter=atlas.magFilter=T.LinearFilter;atlas.needsUpdate=true;
 const uniforms={opaqueColor:{value:opaque.texture},opaqueDepth:{value:opaque.depthTexture},waterColor:{value:waterColor.texture},waterDepth:{value:waterDepth.depthTexture},
  cloudAtlas:{value:atlas},skyLut:{value:skyMap},inverseProjection:{value:camera.projectionMatrixInverse},cameraWorld:{value:camera.matrixWorld},
  originOffset:{value:new T.Vector3(...frame.originMeters)},sunDirection:{value:new T.Vector3(-0.4,0.8,-0.4472135955)},
  radiusMeters:{value:frame.bodyRadiusMeters},skyHeight:{value:60000},skyScaleHeight:{value:8000},rayleighPerM:{value:0.00001},miePerM:{value:frame.weatherExtinctionPerM},
  cloudCoverage:{value:frame.authoredCloudCoverage},fogPerM:{value:frame.status==='Known'?0.025:0},lightning:{value:0},farLimit:{value:500000},
  waterOpacity:{value:0.56},steps:{value:64},skyMode:{value:0},defect:{value:0}};
 const material=new T.ShaderMaterial({glslVersion:T.GLSL3,vertexShader:vertexSource,fragmentShader:volumeSource,uniforms,depthTest:false,depthWrite:false,toneMapped:false});
 const output=new T.ShaderMaterial({glslVersion:T.GLSL3,vertexShader:vertexSource,fragmentShader:outputSource,uniforms:{colorBuffer:{value:hdr.texture}},depthTest:false,depthWrite:false,toneMapped:false});
 const quad=new T.Mesh(geometry,material);quad.frustumCulled=false;fullScene.add(quad);
 const onLost=(e:Event)=>{e.preventDefault();lost=true;history.contextLost();};
 const onRestored=()=>{lost=false;epoch++;history.contextLost();};
 renderer.domElement.addEventListener('webglcontextlost',onLost);renderer.domElement.addEventListener('webglcontextrestored',onRestored);
 function active(){if(disposed)throw Error('VOLUME_DISPOSED');}
 return {
  setFrame(input:AtmosphereFrame){active();const next=validateFrame(input);if(next.atlasEpoch!==frame.atlasEpoch)throw Error('STALE_ATLAS');
   if(next.bodyId!==frame.bodyId||next.bodyRadiusMeters!==frame.bodyRadiusMeters||next.opticsDigest!==frame.opticsDigest||JSON.stringify(next.bodyNormal)!==JSON.stringify(frame.bodyNormal))throw Error('REBUILD_OPTICS_REQUIRED');
   if(skyProfile(next).sigma!==skyProfile(frame).sigma){skyMap.image.data=buildLut(skyProfile(next),32,64).values;skyMap.needsUpdate=true;uploaded=false;}frame=next;},
  setMode(sky:number,wrong=0){active();if(![0,1,2,3].includes(sky)||![0,1,2,3].includes(wrong))throw Error('MODE');mode=sky;defect=wrong;},
  lightning(id:string|null){active();lightning=id?2:0;},
  resize(w:number,h:number){active();for(const target of targets)target.setSize(w,h);epoch++;},
  render(takram?:()=>T.Texture,overlay?:T.Scene){
   active();if(lost)return {status:'CONTEXT_LOST'};
   camera.updateMatrixWorld();const binding=frame.binding as Record<string,{digest?:string}>;
   const state=history.set({weather:frame.weatherSnapshotId,profile:binding.profile?.digest??'bound',macro:binding.macroGeography?.digest??'NONE',
    model:binding.model?.digest??'bound',optics:frame.opticsDigest,source:frame.sourceRevision,atlas:frame.atlasEpoch,epoch,origin:frame.originMeters,height:camera.position.y,lightning:lightning?'fixture.lightning':null});
   history.acceptAtlas(frame.atlasEpoch);
   const borrowed=createDepthCameraPort(camera,opaque.depthTexture!,epoch,{weatherSnapshotId:frame.weatherSnapshotId,...frame.binding});
   if(borrowed.epoch!==epoch)throw Error('BORROWED_EPOCH');
   const target=renderer.getRenderTarget(),clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),oldBackground=scene.background,autoClear=renderer.autoClear,waterVisible=water.visible;
   try{
    if(!uploaded){timer.measure('atlas-and-lut-upload',()=>{renderer.initTexture(atlas);renderer.initTexture(skyMap);});uploaded=true;}
    renderer.setClearColor(0,0);water.visible=false;scene.background=null;
    timer.measure('opaque-hdr',()=>{renderer.setRenderTarget(opaque);renderer.clear();renderer.render(scene,camera);});
    uniforms.opaqueColor.value=takram?timer.measure('takram-cloud-aerial',takram):opaque.texture;
    water.getWorldPosition(waterCopy.position);water.getWorldQuaternion(waterCopy.quaternion);water.getWorldScale(waterCopy.scale);waterCopy.updateMatrixWorld();
    timer.measure('water-color',()=>{renderer.setRenderTarget(waterColor);renderer.clear();renderer.render(waterScene,camera);});
    timer.measure('water-depth',()=>{waterScene.overrideMaterial=depthMaterial;renderer.setRenderTarget(waterDepth);renderer.clear();renderer.render(waterScene,camera);waterScene.overrideMaterial=null;});
    uniforms.originOffset.value.set(...frame.originMeters);uniforms.lightning.value=lightning;uniforms.skyMode.value=takram?2:mode;
    uniforms.cloudCoverage.value=takram||mode===3||frame.status==='NoAtmosphere'?0:frame.authoredCloudCoverage;
    uniforms.fogPerM.value=mode===3||frame.status==='NoAtmosphere'?0:0.025;uniforms.miePerM.value=frame.weatherExtinctionPerM;
    uniforms.rayleighPerM.value=frame.status==='NoAtmosphere'?0:0.00001;uniforms.steps.value=mode===3?16:64;uniforms.defect.value=defect;
    timer.measure('volumes-water-composite',()=>{quad.material=material;renderer.setRenderTarget(hdr);renderer.clear();renderer.render(fullScene,fullCamera);});
    if(overlay)timer.measure('depth-aware-rain',()=>{renderer.autoClear=false;renderer.render(overlay,camera);renderer.autoClear=true;});
    timer.measure('tone-map-output',()=>{quad.material=output;renderer.setRenderTarget(target);renderer.render(fullScene,fullCamera);});timer.poll();
    return {status:'RENDERED',history:state,epoch,weatherSnapshotId:frame.weatherSnapshotId,stormIds:frame.stormIds};
   }finally{water.visible=waterVisible;scene.background=oldBackground;renderer.autoClear=autoClear;renderer.setClearColor(clear,alpha);renderer.setRenderTarget(target);waterScene.overrideMaterial=null;}
  },
  rainUniforms:{uOpaqueDepth:{value:opaque.depthTexture},uWaterDepth:{value:waterDepth.depthTexture},uAtlas:{value:atlas},uInvProjection:{value:camera.projectionMatrixInverse},uCameraWorld:{value:camera.matrixWorld},uViewport:{value:new T.Vector2()},uCloudCoverage:uniforms.cloudCoverage,uFog:uniforms.fogPerM,uOrigin:uniforms.originOffset},
  diagnostics(){return {ownedTargets:disposed?0:targets.length,disposed,lost,epoch,actualAdapter:null,gpuTimer:timer.read(),borrowedDepth:'NOT_DISPOSED',historyResources:history.resources,temporalAccumulation:'DISABLED_REACTIVE_VALIDATION_ONLY'};},
  dispose(){if(disposed)return;disposed=true;scene.fog=savedFog;renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.domElement.removeEventListener('webglcontextrestored',onRestored);
   history.dispose();timer.dispose();for(const target of targets)target.dispose();atlas.dispose();skyMap.dispose();material.dispose();output.dispose();depthMaterial.dispose();geometry.dispose();fullScene.clear();waterScene.clear();}
 };
}
