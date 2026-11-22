import { expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Vector3 } from 'three';
import type { LinearContactTile, SurfaceContactRay } from '../../src/ray/composeContactPixels';
import { ThreeRenderBackend } from '../../src/render/three/backend/threeRenderBackend.ts';
import { backendRevision,frameId,frameRevision } from '../../src/presentation/ids';
import { createFrameProjectionSnapshot } from '../../src/presentation/visibilityPlan.ts';
import { checkTerrainPixels } from '../visual/r1ContactPixels.scenario.mjs';

// This CPU raster probe shades a flat plane with a specified linear test pattern.
// The camera/projection, exact BVH contact queries and terrain cut use the production classes.
it('withdraws precisely the occluded pixels and restores the original image after a committed HVP cut',async()=>{
  const size=32;
  let buffers!: Pick<LinearContactTile,'raster'|'direct'|'indirect'|'emissive'>, surfaces:SurfaceContactRay[]=[];
  const backend=new ThreeRenderBackend({canvas:{} as HTMLCanvasElement,width:size,height:size,lightingMode:'None',rendererFactory:()=>({
    setSize(){}, setPixelRatio(){}, dispose(){},
    render(_scene,camera){
      camera.updateMatrixWorld();
      const eye=camera.getWorldPosition(new Vector3()),point=new Vector3();
      const make=()=>new Float32Array(size*size*4);
      const raster=make(),direct=make(),indirect=make(),emissive=make();
      surfaces=[];
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const pixel=y*size+x,offset=4*pixel;
        point.set((x+.5)/size*2-1,(y+.5)/size*2-1,0).unproject(camera).sub(eye).normalize();
        point.multiplyScalar(-eye.z/point.z).add(eye);
        surfaces.push({pixel,role:'opaque',ray:{id:'contact-'+pixel,origin:[point.x,point.y,.0001],
          direction:[0,0,1],maxDistance:.5,maxSteps:32}});
        const albedo=(x+y)/(2*(size-1));
        direct.set([.18+.12*albedo,.14+.07*albedo,.09+.04*albedo,1],offset);
        indirect.set([.21,.3,.37,1],offset);emissive.set([.03125,.015625,.0078125,1],offset);
        for(let c=0;c<3;c++)raster[offset+c]=direct[offset+c]+indirect[offset+c]+emissive[offset+c];
        raster[offset+3]=1;
      }
      buffers={raster,direct,indirect,emissive};
      return true;
    }
  })});
  try {
    expect(backend.dispatch({kind:'InitializeBackend',backendRevision:backendRevision(0)}).status).toBe('Accepted');
    const snapshot=createFrameProjectionSnapshot({frameId:frameId('world'),frameRevision:frameRevision(1),cameraPositionRelative:{x:0,y:0,z:1},
      cameraOrientation:{x:0,y:0,z:0,w:1},projectionParameters:{kind:'Perspective',verticalFovDegrees:20,aspect:1,near:.01,far:3},
      representationTransforms:[]});
    expect(backend.dispatch({kind:'ApplyFrameProjection',backendRevision:backendRevision(0),snapshot}).status).toBe('Accepted');
    const submit=()=>{expect(backend.renderFrame().status).toBe('Accepted');return backend.readSubmittedFrameMetadata()!;};
    const tile={frame:submit(),width:size,height:size,...buffers};
    const {proof,shaded,relit}=await checkTerrainPixels(backend,tile,surfaces,submit);
    expect(proof).toMatchObject({beforeRevision:0,afterRevision:1,cutCells:1,changedPixels:144,centerUnknown:'Unknown'});
    expect(proof.digests.shaded).not.toBe(proof.digests.raster);
    for(const key of ['unknown','sourceStale','oldFrame','relit'])expect(proof.digests[key]).toBe(proof.digests.raster);
    for(let k=0;k<3;k++)expect(proof.centerBefore[k]).toBe(Math.fround(proof.direct[k]+proof.emissive[k]));
    const out=process.env.R1_CPU_PIXEL_EVIDENCE;
    if(out){
      await mkdir(out,{recursive:true});
      const report={kind:'CPU linear image fixture, real Three submitted-frame owner and HVP terrain commit',extent:[size,size],...proof};
      await Promise.all([writeFile(path.join(out,'cpu.json'),JSON.stringify(report,null,2)+'\n'),
        writeFile(path.join(out,'before.f32'),Buffer.from(shaded.buffer)),writeFile(path.join(out,'after.f32'),Buffer.from(relit.buffer))]);
    }
  }finally{backend.dispatch({kind:'DisposeBackend',backendRevision:backendRevision(0)});}
});
