import * as T from 'three';
import {EffectComposer,RenderPass,EffectPass} from 'postprocessing';
import {CloudsEffect} from '@takram/three-clouds';
import {AtmosphereParameters,DensityProfileLayer,PrecomputedTexturesGenerator,AerialPerspectiveEffect} from '@takram/three-atmosphere';
import {Ellipsoid} from '@takram/three-geospatial';
import {validateFrame,type AtmosphereFrame} from './optics';
import {disposeOwned} from './init';
export async function createTakram(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,frame:AtmosphereFrame,worldToBody:T.Matrix4,sun:T.Vector3,signal:AbortSignal){
 frame=validateFrame(frame);
 if(frame.status!=='Known')throw Error('TAKRAM_UNSUPPORTED:'+frame.status);
 if(!worldToBody.elements.every(Number.isFinite)||!sun.toArray().every(Number.isFinite)||Math.abs(sun.length()-1)>1e-8)throw Error('TAKRAM_FRAME_TRANSFORM');
 signal.throwIfAborted();const previousTarget=renderer.getRenderTarget();
 // Every Earth default affecting this finite model is explicitly replaced with authored optics.
 const exponential=()=>[new DensityProfileLayer(0,0,0,0,0),new DensityProfileLayer(0,1,-1/8,0,0)] as [DensityProfileLayer,DensityProfileLayer];
 const atmosphere=new AtmosphereParameters({bottomRadius:frame.bodyRadiusMeters,topRadius:frame.bodyRadiusMeters+60000,
  solarIrradiance:new T.Vector3(1,1,1),sunAngularRadius:0.00465,rayleighDensity:exponential(),rayleighScattering:new T.Vector3(0.01,0.02,0.03),
  mieDensity:exponential(),mieScattering:new T.Vector3(0.005,0.005,0.005),mieExtinction:new T.Vector3(0.01,0.01,0.01),miePhaseFunctionG:0.5,
  absorptionDensity:[new DensityProfileLayer(0,0,0,0,0),new DensityProfileLayer(0,0,0,0,0)],absorptionExtinction:new T.Vector3(),
  groundAlbedo:new T.Color(0.1,0.15,0.12),muSMin:-0.5,skyRadianceToLuminance:new T.Vector3(1,1,1),sunRadianceToLuminance:new T.Vector3(1,1,1)});
 const generator=new PrecomputedTexturesGenerator(renderer,{type:T.HalfFloatType,combinedScattering:true,higherOrderScattering:false});
 let composer:EffectComposer|undefined,clouds:CloudsEffect|undefined,aerial:AerialPerspectiveEffect|undefined,effectsAttached=false,disposed=false;
 const weather=new T.DataTexture(new Uint8Array([Math.round(frame.authoredCloudCoverage*255),0,0,255]),1,1,T.RGBAFormat);
 weather.needsUpdate=true;weather.wrapS=weather.wrapT=T.RepeatWrapping;
 const shape=new T.Data3DTexture(new Uint8Array(8*8*8).map((_,i)=>Math.round(180+60*Math.sin(i*0.3))),8,8,8);
 shape.format=T.RedFormat;shape.wrapS=shape.wrapT=shape.wrapR=T.RepeatWrapping;shape.minFilter=shape.magFilter=T.LinearFilter;shape.needsUpdate=true;
 const dispose=()=>{if(disposed)return;disposed=true;disposeOwned([()=>shape.dispose(),()=>weather.dispose(),()=>generator.dispose({textures:true}),()=>{if(!effectsAttached)clouds?.dispose();},()=>{if(!effectsAttached)aerial?.dispose();},()=>composer?.dispose()]);};
 try {
  const textures=await generator.update(atmosphere);
  signal.throwIfAborted();
  clouds=new CloudsEffect(camera,{resolutionScale:0.5},atmosphere);clouds.qualityPreset='low';
  clouds.correctAltitude=false;clouds.temporalUpscale=false;clouds.shapeDetail=false;clouds.turbulence=false;clouds.haze=false;clouds.lightShafts=false;
  clouds.localWeatherTexture=weather;clouds.shapeTexture=shape;clouds.worldToECEFMatrix.copy(worldToBody);clouds.sunDirection.copy(sun);
  clouds.cloudLayers.set([{channel:'r',altitude:8,height:24,densityScale:0.02,shapeAmount:0.3,shapeDetailAmount:0,shadow:true}]);
  clouds.localWeatherVelocity.set(0,0);clouds.shapeVelocity.set(0,0,0);
  aerial=new AerialPerspectiveEffect(camera,{ellipsoid:new Ellipsoid(frame.bodyRadiusMeters,frame.bodyRadiusMeters,frame.bodyRadiusMeters),correctAltitude:false,correctGeometricError:false,sun:true,sky:true,ground:false},atmosphere);
  Object.assign(aerial,textures);Object.assign(clouds,textures);clouds.ellipsoid=new Ellipsoid(frame.bodyRadiusMeters,frame.bodyRadiusMeters,frame.bodyRadiusMeters);
  aerial.worldToECEFMatrix.copy(worldToBody);aerial.sunDirection.copy(sun);aerial.overlay=clouds.atmosphereOverlay;
  clouds.events.addEventListener('change',()=>{if(aerial&&clouds)aerial.overlay=clouds.atmosphereOverlay;});
  composer=new EffectComposer(renderer,{frameBufferType:T.HalfFloatType});composer.autoRenderToScreen=false;
  composer.addPass(new RenderPass(scene,camera));composer.addPass(new EffectPass(camera,clouds,aerial));effectsAttached=true;
  const initialMatrix=worldToBody.clone();
  return {render(){composer!.render(0);return composer!.outputBuffer.texture;},resize(w:number,h:number){composer!.setSize(w,h);},reset(){clouds!.temporalUpscale=false;},
   setOrigin(origin:[number,number,number]){const matrix=initialMatrix.clone();matrix.setPosition(new T.Vector3(...origin).applyMatrix3(new T.Matrix3().setFromMatrix4(initialMatrix)).add(new T.Vector3().setFromMatrixPosition(initialMatrix)));
    clouds!.worldToECEFMatrix.copy(matrix);aerial!.worldToECEFMatrix.copy(matrix);},
   diagnostics:{pin:'@takram/three-clouds@0.7.6 + atmosphere@0.19.1',react:false,weatherTexture:'AUTHORED_SYNTHETIC_SINGLE_FINITE_MASK',orbit:'PACKAGE_LIMITATION_NOT_ACCEPTED',lutGpu:'NOT_RUN_UNTIL_RUNNER'},
   dispose};
 }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'TAKRAM_INIT_AND_CLEANUP_FAILED',{cause:error});}throw error;}
 finally{renderer.setRenderTarget(previousTarget);}
}
