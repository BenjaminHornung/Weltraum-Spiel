import * as THREE from 'three';
import { ThreeRenderBackend, createThreeRendererPort } from '../../src/render/three/backend/threeRenderBackend.ts';
import { createFrameProjectionSnapshot } from '../../src/presentation/visibilityPlan.ts';
import { checkTerrainPixels } from './r1ContactPixels.scenario.mjs';

const edge=32;
export async function runProbe() {
  const canvas = document.querySelector('#raster');
  const target = new THREE.WebGLRenderTarget(edge,edge,{type:THREE.FloatType,colorSpace:THREE.LinearSRGBColorSpace,
    depthBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const material = new THREE.MeshStandardMaterial({color:0x7398ad,emissive:0x171007,roughness:1,metalness:0});
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  const ambient = new THREE.AmbientLight(0xffffff,1.25);
  const sun = new THREE.DirectionalLight(0xffe8c5,0.7);
  sun.position.set(0,0,2);
  let raster, readbacks;
  const backend = new ThreeRenderBackend({canvas,width:edge,height:edge,antialias:false,
    lightingMode:'None',backgroundColor:0,rendererFactory:(c,parameters)=>{
      raster = new THREE.WebGLRenderer({...parameters,canvas:c});
      raster.toneMapping=THREE.NoToneMapping;
      const port=createThreeRendererPort(raster);
      return {...port,render(scene,camera){
        const last=raster.getRenderTarget(),emission=material.emissive.clone(),si=sun.intensity,ai=ambient.intensity;
        raster.setRenderTarget(target);
        function component(direct,indirect,emissive){
          sun.intensity=direct?si:0;
          ambient.intensity=indirect?ai:0;
          material.emissive.copy(emission).multiplyScalar(emissive?1:0);
          raster.render(scene,camera);
          const rgba=new Float32Array(edge*edge*4);
          raster.readRenderTargetPixels(target,0,0,edge,edge,rgba);
          return rgba;
        }
        try { readbacks={direct:component(true,false,false),indirect:component(false,true,false),
          emissive:component(false,false,true),raster:component(true,true,true)}; }
        finally { material.emissive.copy(emission);sun.intensity=si;ambient.intensity=ai;raster.setRenderTarget(last); }
        return true;
      }};
    }});
  try {
    if(backend.dispatch({kind:'InitializeBackend',backendRevision:0}).status!=='Accepted')throw Error('renderer init');
    const gl=raster.getContext();
    if(!gl.getExtension('EXT_color_buffer_float'))throw Error('WebGL float render target unavailable');
    backend.scene.add(ambient,sun,plane);
    const projection=createFrameProjectionSnapshot({frameId:'world',frameRevision:1,
      cameraPositionRelative:{x:0,y:0,z:1},cameraOrientation:{x:0,y:0,z:0,w:1},
      projectionParameters:{kind:'Perspective',verticalFovDegrees:20,aspect:1,near:.01,far:3},representationTransforms:[]});
    if(backend.dispatch({kind:'ApplyFrameProjection',backendRevision:0,snapshot:projection}).status!=='Accepted')throw Error('projection');
    function submit(){
      backend.renderFrame();
      const frame=backend.readSubmittedFrameMetadata();
      if(!frame||!backend.isSubmittedFrameCurrent(frame))throw Error('actual G1 submit failed');
      return {frame,width:edge,height:edge,...readbacks};
    }
    const tile=submit(), view=new THREE.Vector3(), eye=backend.camera.getWorldPosition(new THREE.Vector3()),surfaces=[];
    for(let y=0;y<edge;y++)for(let x=0;x<edge;x++){
      view.set((x+.5)/edge*2-1,(y+.5)/edge*2-1,0).unproject(backend.camera).sub(eye).normalize();
      const distance=-eye.z/view.z;
      surfaces.push({pixel:y*edge+x,role:'opaque',ray:{id:'p'+x+'-'+y,
        origin:[eye.x+view.x*distance,eye.y+view.y*distance,.0001],
        direction:[0,0,1],maxDistance:.5,maxSteps:32}});
    }
    const {proof,shaded,relit}=await checkTerrainPixels(backend,tile,surfaces,submit);
    function display(id,data){
      const c=document.querySelector(id);c.width=edge;c.height=edge;const ctx=c.getContext('2d');
      const pixels=ctx.createImageData(edge,edge);
      for(let y=0;y<edge;y++)for(let x=0;x<edge;x++){
        const dst=((edge-1-y)*edge+x)*4,src=(y*edge+x)*4;
        for(let k=0;k<3;k++){const n=data[src+k];pixels.data[dst+k]=Math.round(255*(n<=.0031308?12.92*n:1.055*Math.pow(n,1/2.4)-.055));}
        pixels.data[dst+3]=Math.round(255*data[src+3]);
      }ctx.putImageData(pixels,0,0);
    }
    display('#before',shaded);display('#after',relit);
    const rendererInfo=gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer:rendererInfo?gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL):null,extent:[edge,edge],
      attachmentPublication:tile.frame.attachmentPublication,scene:'one opaque plane, one ambient and one directional light plus material emission',
      ...proof};
  } finally {plane.geometry.dispose();material.dispose();target.dispose();
    backend.dispatch({kind:'DisposeBackend',backendRevision:0});}
}
