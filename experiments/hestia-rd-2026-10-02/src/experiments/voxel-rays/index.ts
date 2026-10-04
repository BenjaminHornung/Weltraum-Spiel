import { BufferAttribute, BufferGeometry, Color, Data3DTexture, DoubleSide, FrontSide, GLSL3, Group, LinearSRGBColorSpace,
  Matrix3, Mesh, MeshLambertMaterial, NearestFilter, RGBAIntegerFormat, ShaderMaterial, UniformsLib, UniformsUtils,
  UnsignedByteType, Vector2, Vector3, type Camera, type Material, type Scene, type Texture, type WebGLRenderer } from 'three';
import { createFrameInput, validateFacts, type LabExperimentContext, type LabExperimentFactory, type LabExperimentHandle,
  type LabExperimentFacts } from '../../contracts/experiment';
import { copyFixturePayload, fixtureRevision, getFixtureDigest, type LabFixtureV1 } from '../../contracts/fixture';
import type { LabMetric } from '../../contracts/result';
import { requireValue } from '../../contracts/validation';
import { publicAssetRoot } from '../../runner/assets';
import { createThreeLabHost, type ThreeLabEffectContext, type ThreeLabHost } from '../../runner/threeHost';
import { projectFloat32 } from '../three-control';
import { admitProjection, buildGreedy, LIMITS, loadRayRecipe, prepareVolumes, type RayAdmission, type RayCaps, type RayVolume } from './volume';
import { VISIBLE_FRAGMENT, VISIBLE_VERTEX } from './ray';

const measured=(value:number,unit='count'):LabMetric=>({status:'measured',value,unit});
const estimated=(value:number,reason:string):LabMetric=>({status:'estimated',value,unit:'byte',reason});
export const UNSUPPORTED = ['native-numeric-qualification-not-run','native-pcf-shadow-parity','native-sky-shader-parity',
  'native-water-shader-parity','native-material-shader-hooks','face-ambient-occlusion','gi-and-reflections',
  'unknown-is-not-world-clearance','native-vram-unavailable','gpu-timing-not-qualified'];
export function queryRayCaps(gl:WebGL2RenderingContext):RayCaps & {formatSampleCounts:readonly number[]} {
  const samples=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA8UI,gl.SAMPLES) as Int32Array;
  const viewport=gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
  return Object.freeze({max3D:Number(gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)),maxTexture:Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    maxViewport:[viewport[0],viewport[1]] as const,fragmentSamplers:Number(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)),
    rgba8ui:gl.RGBA8UI===0x8d7c && gl.RGBA_INTEGER===0x8d99 && gl.UNSIGNED_BYTE===0x1401 && gl.getError()===gl.NO_ERROR,
    contextLost:gl.isContextLost(),formatSampleCounts:Object.freeze(Array.from(samples))});
}
interface TerminalHost extends LabExperimentHandle { terminate(error:unknown):Promise<void>;
  readPrivateDiagnostics():{firstFailure:string|null;pending:boolean;disposed:boolean;productIntegrated:false}; }
/** Shared host's retain-old behaviour is explicitly repaired locally, not changed for other leaves. */
export function wrapTerminalHost(base:LabExperimentHandle,retire:()=>void,canvas:HTMLCanvasElement):TerminalHost {
  let firstFailure:string|null=null; let pending=false; let disposed=false; let disposal:Promise<void>|undefined;
  let lastFacts:LabExperimentFacts|undefined=base.readFacts(); // Prepared CPU snapshot, never a native/render READY claim.
  function active() { requireValue(!firstFailure&&!disposed&&!pending,firstFailure??'RD13 disposed/replacement pending'); }
  async function dispose() {
    if (!disposal) { disposed=true; retire(); canvas.hidden=true; disposal=base.dispose(); }
    await disposal;
  }
  function fail(error:unknown) {
    firstFailure??=String(error); retire(); canvas.hidden=true;
    void dispose().catch(()=>{}); return error;
  }
  return {
    setFrame(input) { active(); try { base.setFrame(input); } catch (error) { throw fail(error); } },
    async replaceFixture(next) {
      active(); pending=true; retire(); canvas.hidden=true;
      try {
        await base.replaceFixture(next); requireValue(!disposed&&!firstFailure,firstFailure??'Replacement disposed');
        const adopted=validateFacts(base.readFacts());
        requireValue(adopted.fixtureDigest===getFixtureDigest(next)&&adopted.sourceRevision===fixtureRevision(next),'Adopted facts are not bound to the replacement fixture');
        lastFacts=adopted; // Cache the newly adopted source before unlocking; a later driver fault must retain it.
      }
      catch (error) { fail(error); await disposal?.catch(()=>{}); throw error; }
      finally { pending=false; }
    },
    readFacts() {
      if (!firstFailure) { active(); lastFacts=base.readFacts(); }
      requireValue(lastFacts,'Terminal host has no valid facts snapshot');
      return validateFacts({...lastFacts,experimentId:'RD-13',errors:[...lastFacts.errors,...(firstFailure?[firstFailure]:[])]});
    },
    readPrivateDiagnostics:()=>({firstFailure,pending,disposed,productIntegrated:false}),dispose,
    async terminate(error) { fail(error); await disposal?.catch(()=>{}); },
  };
}
interface Projection {
  root:Group; volumes:readonly RayVolume[]; admission:RayAdmission; geometries:BufferGeometry[]; materials:Material[]; textures:Texture[];
  bufferBytes:number; projectionBytes:number; triangles:number; prepareMs:number; greedyMs:number; buildMs:number; dispose():void;
}
function presentations(fixture:LabFixtureV1) {
  return fixture.objects.flatMap((object)=>{
    const voxelOwner=fixture.voxelRegions?.some((r)=>r.ownerId===object.ownerId);
    return object.meshes.filter((source)=>!(fixture.id==='F01-HVP-COAST'&&!object.materialRoles.includes('water-presentation'))
      && (!voxelOwner||source.presentationOnly)).map((source)=>({object,source}));
  });
}
function lambert(fixture:LabFixtureV1,id:string,vertexColors=false) {
  const m=fixture.materials.find((m)=>m.id===id)!;
  const material=new MeshLambertMaterial({color:new Color().setRGB(...m.colorLinearRgb,LinearSRGBColorSpace),vertexColors,
    opacity:m.opacity??1,transparent:(m.opacity??1)<1,depthWrite:m.depthWrite??true,side:m.doubleSided?DoubleSide:FrontSide});
  if (m.role==='emission') { material.emissive.copy(material.color); } return material;
}
function buildProjection(context:ThreeLabEffectContext,volumes:RayVolume[],admission:RayAdmission,variant:string,
  gl:WebGL2RenderingContext,prepareMs:number,previousProjectionBytes:number,submitted:()=>void):Projection {
  const start=performance.now(); const fixture=context.fixture; const root=new Group();
  const geometries:BufferGeometry[]=[]; const materials:Material[]=[]; const textures:Texture[]=[];
  const checkedPrograms=new WeakSet<WebGLProgram>();
  let bufferBytes=0; let triangles=0; let greedyMs=0;
  function dispose() { root.visible=false; root.removeFromParent(); root.clear();
    geometries.forEach((g)=>g.dispose()); materials.forEach((m)=>m.dispose()); textures.forEach((t)=>t.dispose()); }
  function ownGeometry(g:BufferGeometry) { geometries.push(g); return g; }
  function driverCheck(renderer:WebGLRenderer,_scene:Scene,_camera:Camera,_geometry:BufferGeometry,material:Material) {
    requireValue(!gl.isContextLost(),'WebGL context lost after projection allocation');
    const error=gl.getError(); requireValue(error===gl.NO_ERROR,`Driver upload/link/draw failure after allocation: GL ${error}`);
    // Read-only installed Three 0.185.1 program binding, not renderer configuration/authority.
    // Link failure need not set a GL error; a previously bound program must not disguise it.
    const binding=renderer.properties.get(material) as {currentProgram?:{program:WebGLProgram}};
    const program=binding.currentProgram?.program;
    requireValue(program,'Projection draw has no actual Three native program AFTER allocation');
    if (!checkedPrograms.has(program)) {
      requireValue(gl.getProgramParameter(program,gl.LINK_STATUS),`Native program link failure AFTER allocation: ${gl.getProgramInfoLog(program)}`);
      requireValue(gl.getParameter(gl.CURRENT_PROGRAM)===program,'Wrong/stale native draw program AFTER allocation');
      requireValue(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE,'Native draw framebuffer incomplete AFTER allocation');
      checkedPrograms.add(program);
    }
    submitted();
  }
  try {
    // Build/count actual greedy candidates before allocating any Three texture or geometry.
    const greedy=variant==='greedy-no-ao'?volumes.map((v)=>{const t=performance.now(); const mesh=buildGreedy(v); greedyMs+=performance.now()-t; return mesh;}):[];
    const greedyBytes=greedy.reduce((n,m)=>n+m.positions.byteLength+m.normals.byteLength+m.indices.byteLength,0);
    const nonVoxel=presentations(fixture); let presentationBytes=0; let presentationTriangles=0;
    for (const {source} of nonVoxel) {
      const payload=(id:string)=>{const p=fixture.payloads.find((p)=>p.id===id);requireValue(p,'Missing presentation payload');return p;};
      const positions=payload(source.positions); const indices=payload(source.indices);
      requireValue(['float32','float64'].includes(positions.elementType) && positions.length%3===0
        && ['uint16','uint32'].includes(indices.elementType) && indices.length%3===0,'Presentation payload format/length');
      presentationBytes+=positions.length*4+indices.byteLength+(source.normals?payload(source.normals).length:positions.length)*4
        +(source.colors?payload(source.colors).length*4:0); presentationTriangles+=indices.length/3;
    }
    const plannedBufferBytes=greedyBytes+(variant==='rays-no-ao'?volumes.length*36:0)+presentationBytes;
    const plannedProjectionBytes=plannedBufferBytes+(variant==='rays-no-ao'?admission.costs.projectionBytes:0);
    requireValue(Number.isSafeInteger(plannedProjectionBytes+previousProjectionBytes)
      && plannedProjectionBytes+previousProjectionBytes<=LIMITS.output && plannedProjectionBytes<=LIMITS.mesh,'Old/new + presentation/output byte budget exceeded before projection allocation');
    const plannedTriangles=greedy.reduce((n,m)=>n+m.indices.length/3,0)+(variant==='rays-no-ao'?volumes.length:0)+presentationTriangles;
    const plannedDraws=greedy.reduce((n,m)=>n+m.materialRanges.length,0)+(variant==='rays-no-ao'?volumes.length:0)+nonVoxel.length;
    requireValue(plannedTriangles<=LIMITS.triangles && plannedDraws<=LIMITS.draws,'Triangle/draw budget exceeded before projection allocation');
    requireValue(admission.costs.cpuPeakEstimateBytes+greedy.reduce((n,m)=>n+m.tempEstimateBytes,0)+plannedBufferBytes<=LIMITS.cpu,'Combined CPU mesher/presentation budget exceeded');
    for (const [index,v] of volumes.entries()) {
      context.signal.throwIfAborted();
      if (variant==='rays-no-ao') {
        const [sx,sy,sz]=v.dimensions; const texture=new Data3DTexture(v.packed,sx,sy,sz); textures.push(texture);
        texture.format=RGBAIntegerFormat; texture.type=UnsignedByteType; texture.internalFormat='RGBA8UI';
        texture.minFilter=texture.magFilter=NearestFilter; texture.generateMipmaps=false; texture.unpackAlignment=1; texture.needsUpdate=true;
        const uniforms=UniformsUtils.merge([UniformsLib.lights,UniformsLib.fog]);
        Object.assign(uniforms,{voxelData:{value:texture},gridSize:{value:new Vector3(sx,sy,sz)},gridFromWorld:{value:v.gridFromWorld},
          worldNormalMatrix:{value:new Matrix3().getNormalMatrix(v.worldFromGrid)},drawingBuffer:{value:new Vector2()},
          rayInverseProjection:{value:context.camera.projectionMatrixInverse.clone()},rayCameraWorld:{value:context.camera.matrixWorld.clone()},
          slotColor:{value:[new Vector3(),...v.materials.map((m)=>new Vector3(...m.colorLinearRgb)),...Array.from({length:7-v.materials.length},()=>new Vector3())]},
          slotEmission:{value:[new Vector3(),...v.materials.map((m)=>m.role==='emission'?new Vector3(...m.colorLinearRgb):new Vector3()),...Array.from({length:7-v.materials.length},()=>new Vector3())]},
          slotDoubleSided:{value:[0,...v.materials.map((m)=>m.doubleSided?1:0),...Array(7-v.materials.length).fill(0)]}});
        const material=new ShaderMaterial({glslVersion:GLSL3,uniforms,vertexShader:VISIBLE_VERTEX,fragmentShader:VISIBLE_FRAGMENT,
          lights:true,fog:true,depthTest:true,depthWrite:true}); materials.push(material);
        const geometry=ownGeometry(new BufferGeometry()); geometry.setAttribute('position',new BufferAttribute(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3));
        const mesh=new Mesh(geometry,material); mesh.frustumCulled=false; mesh.name=`RD13:${v.source.regionId}`;
        mesh.onBeforeRender=(renderer,_scene,camera)=>{ renderer.getDrawingBufferSize(uniforms.drawingBuffer.value);
          uniforms.rayInverseProjection.value.copy((camera as typeof context.camera).projectionMatrixInverse); uniforms.rayCameraWorld.value.copy(camera.matrixWorld); };
        mesh.onAfterRender=driverCheck; root.add(mesh); triangles+=1; bufferBytes+=36;
      } else {
        const output=greedy[index]; const geometry=ownGeometry(new BufferGeometry());
        geometry.setAttribute('position',new BufferAttribute(output.positions,3)); geometry.setAttribute('normal',new BufferAttribute(output.normals,3));
        geometry.setIndex(new BufferAttribute(output.indices,1)); bufferBytes+=output.positions.byteLength+output.normals.byteLength+output.indices.byteLength; triangles+=output.indices.length/3;
        const palette=v.materialIds.map((id)=>lambert(fixture,id)); materials.push(...palette);
        output.materialRanges.forEach((r)=>geometry.addGroup(r.startIndex,r.indexCount,r.slot-1));
        const mesh=new Mesh(geometry,palette); const pose=context.ownerPose(v.source.ownerId)!;
        mesh.position.set(...pose.originMeters); mesh.quaternion.set(...pose.rotationXyzw); mesh.name=`RD13:${v.source.regionId}`;
        mesh.onAfterRender=driverCheck; root.add(mesh);
      }
    }
    // Original non-voxel water/marker only; do not also mount source voxel meshes.
    for (const {object,source} of nonVoxel) {
        const geometry=ownGeometry(new BufferGeometry()); const positions=projectFloat32(copyFixturePayload(fixture,source.positions));
        const indices=copyFixturePayload(fixture,source.indices); requireValue(indices instanceof Uint16Array||indices instanceof Uint32Array,'Invalid presentation indices');
        geometry.setAttribute('position',new BufferAttribute(positions,3)); geometry.setIndex(new BufferAttribute(indices,1)); bufferBytes+=positions.byteLength+indices.byteLength;
        if (source.normals) { const n=projectFloat32(copyFixturePayload(fixture,source.normals)); geometry.setAttribute('normal',new BufferAttribute(n,3)); bufferBytes+=n.byteLength; }
        else { geometry.computeVertexNormals(); bufferBytes+=geometry.getAttribute('normal').array.byteLength; }
        if (source.colors) { requireValue(source.colorSpace==='linear-srgb','Unbound presentation colours');
          const c=projectFloat32(copyFixturePayload(fixture,source.colors)); geometry.setAttribute('color',new BufferAttribute(c,3)); bufferBytes+=c.byteLength; }
        const material=lambert(fixture,source.materialId,Boolean(source.colors)); materials.push(material); const mesh=new Mesh(geometry,material);
        const pose=context.ownerPose(object.ownerId)!; mesh.position.set(...pose.originMeters); mesh.quaternion.set(...pose.rotationXyzw);
        mesh.name=`RD13:presentation:${object.ownerId}`; if (material.transparent) { mesh.renderOrder=1; }
        mesh.userData={ownerId:object.ownerId,sourceIds:object.sourceIds,presentationOnly:source.presentationOnly??false};
        mesh.onAfterRender=driverCheck; root.add(mesh); triangles+=indices.length/3;
    }
    requireValue(bufferBytes===plannedBufferBytes && triangles===plannedTriangles,'Projection accounting mismatch; terminal cleanup, never a pre-allocation PASS');
    return {root,volumes,admission,geometries,materials,textures,bufferBytes,projectionBytes:plannedProjectionBytes,triangles,prepareMs,greedyMs,buildMs:performance.now()-start,dispose};
  } catch (error) { dispose(); throw error; }
}
export interface VoxelRayHost extends TerminalHost {
  resize(width:number,height:number,dpr:number):void; setResetTick(tick:number|null):void;
  readRayDiagnostics():{productIntegrated:false;variant:string;caps:RayCaps;host:ReturnType<ThreeLabHost['readDiagnostics']>|null;source:unknown;costs:unknown;terminal:ReturnType<TerminalHost['readPrivateDiagnostics']>};
  readVolumesForQualification():readonly RayVolume[];
  rejectReplacementForQualification(next:LabFixtureV1,fault:'format'|'overflow'):Promise<void>;
}
export const createVoxelRayExperiment:LabExperimentFactory = async (context:LabExperimentContext):Promise<VoxelRayHost>=>{
  const variant=context.preset.id; requireValue(['rays-no-ao','greedy-no-ao'].includes(variant),'Unsupported RD13 variant; no fallback');
  requireValue(Object.keys(context.preset.parameters??{}).every((k)=>['width','height','dpr'].includes(k)),'Unsupported RD13 parameters');
  context.signal.throwIfAborted(); context.canvas.hidden=true;
  const gl=context.canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
  requireValue(gl,'UNSUPPORTED: WebGL2 required'); const caps=queryRayCaps(gl);
  const assetRoot=publicAssetRoot(import.meta.env.BASE_URL,window.location.href); const projections=new Set<Projection>();
  let latest:Projection|undefined; let host:ThreeLabHost|undefined;
  let activeTerminal:TerminalHost|undefined; let submissionQueued=false;
  let qualificationFault:'format'|'overflow'|undefined;
  function retire() { for (const p of projections) { p.root.visible=false; } }
  const mount=async (effect:ThreeLabEffectContext)=>{
    const recipe=await loadRayRecipe(effect.fixture,assetRoot,fetch,effect.signal);
    const previous={cpuBytes:[...projections].reduce((n,p)=>n+p.admission.costs.canonicalPayloadBytes*3+p.admission.costs.selectedCpuBytes+p.bufferBytes,0),
      projectionBytes:[...projections].reduce((n,p)=>n+p.projectionBytes,0)};
    const parameters=context.preset.parameters;
    const fault=qualificationFault; qualificationFault=undefined;
    // Deliberately invalid TEST INPUT, not a mutated/claimed hardware capability or original threshold.
    const admission=admitProjection(effect.fixture,recipe,fault==='format'?{...caps,rgba8ui:false}:caps,
      fault==='overflow'?{cpuBytes:Number.MAX_SAFE_INTEGER,projectionBytes:Number.MAX_SAFE_INTEGER}:previous,undefined,
      {width:Number(parameters?.width??1280),height:Number(parameters?.height??720),dpr:Number(parameters?.dpr??1)});
    const t=performance.now(); const volumes=prepareVolumes(effect.fixture,recipe,admission);
    const p=buildProjection(effect,volumes,admission,variant,gl,performance.now()-t,previous.projectionBytes,()=>{
      if (!context.canvas.hidden||submissionQueued) {return;}submissionQueued=true;
      queueMicrotask(()=>{submissionQueued=false;
        if (latest===p && activeTerminal && !activeTerminal.readPrivateDiagnostics().pending && !activeTerminal.readPrivateDiagnostics().disposed) {
          // Same-digest reset/remount need not trigger the shared host's identity event.
          // This callback follows an actual owned draw, after the complete render returns.
          context.canvas.hidden=false;context.canvas.dispatchEvent(new CustomEvent('voxel-rays-rendered'));
        }
      });
    }); projections.add(p); effect.root.add(p.root); latest=p;
    return {
      setFrame(input:Parameters<LabExperimentHandle['setFrame']>[0]) { const frame=createFrameInput(input); effect.signal.throwIfAborted();
        requireValue(frame.sourceRevision===fixtureRevision(effect.fixture),'Stale RD13 frame'); },
      async replaceFixture() { throw new Error('RD13 host owns complete detached replacement'); },
      readFacts() { return validateFacts({experimentId:'RD-13',variantId:variant,backend:'Three-WebGLRenderer-WebGL2',
        fixtureDigest:getFixtureDigest(effect.fixture),sourceRevision:fixtureRevision(effect.fixture),
        liveResources:{geometries:measured(p.geometries.length),textures:measured(p.textures.length),materials:measured(p.materials.length)},
        logicalCosts:{projectionBytes:estimated(p.projectionBytes,'Typed texture/mesh payload; excludes native allocator/driver/context'),
          cpuPeakBytes:estimated(p.admission.costs.cpuPeakEstimateBytes,'Conservative source transport/private/copy/old-new estimate, not JS heap'),
          prepareMs:measured(p.prepareMs,'ms'),greedyBuildMs:measured(p.greedyMs,'ms'),projectionBuildMs:measured(p.buildMs,'ms'),triangles:measured(p.triangles),
          fullScreenVolumes:measured(p.textures.length),maxStepsPerRay:measured(Math.max(...volumes.map((v)=>v.dimensions.reduce((a,b)=>a+b,1)))),
          nativeGpuBytes:{status:'unsupported',unit:'byte',reason:'Native context/driver VRAM cannot be measured here'},
          uploadCommandCpuMs:{status:'not-run',unit:'ms',reason:'Three upload occurs during native render; CPU preparation is not upload time'}},
        unsupportedFeatures:[...UNSUPPORTED,...(effect.fixture.id==='F01-HVP-COAST'?['selected-f01-not-full-parity','f01-vegetation-omitted']:[])],errors:[]}); },
      async dispose() { p.dispose(); projections.delete(p); },
    };
  };
  try { host=await createThreeLabHost(context,[{mount,preset:context.preset}]); }
  catch (error) { retire(); for (const p of projections) { p.dispose(); } projections.clear(); throw error; }
  const terminal=wrapTerminalHost(host,retire,context.canvas);activeTerminal=terminal;
  const rendered=()=>{ if (!terminal.readPrivateDiagnostics().pending&&!terminal.readPrivateDiagnostics().disposed) { context.canvas.hidden=false; } };
  const error=(event:Event)=>{ retire(); context.canvas.hidden=true; void terminal.terminate((event as CustomEvent).detail??'Context/render failure');
    context.canvas.dispatchEvent(new CustomEvent('voxel-rays-error',{detail:(event as CustomEvent).detail??'Context/render failure'})); };
  context.canvas.addEventListener('three-lab-rendered',rendered); context.canvas.addEventListener('three-lab-error',error);
  const dispose=async()=>{ context.canvas.removeEventListener('three-lab-rendered',rendered); context.canvas.removeEventListener('three-lab-error',error); await terminal.dispose(); };
  return {...terminal,resize:(w,h,dpr)=>{
      requireValue(Number.isInteger(w)&&Number.isInteger(h)&&w>=1&&h>=1&&Number.isFinite(dpr)&&dpr>=1&&dpr<=4
        && w*dpr<=Math.min(caps.maxTexture,caps.maxViewport[0])&&h*dpr<=Math.min(caps.maxTexture,caps.maxViewport[1]),'Viewport dimension/format limit');
      requireValue(!terminal.readPrivateDiagnostics().disposed&&!terminal.readPrivateDiagnostics().pending,'No active RD13 resize');host!.resize(w,h,dpr);
    },setResetTick:(tick)=>host!.setResetTick(tick),dispose,
    readRayDiagnostics:()=>({productIntegrated:false,variant,caps,host:terminal.readPrivateDiagnostics().disposed?null:host!.readDiagnostics(),
      source:latest?.volumes.map((v)=>({...v.source,dimensions:v.dimensions,offset:v.offset,sourceSlotSha256:v.sourceSlotSha256})),costs:latest?.admission.costs,terminal:terminal.readPrivateDiagnostics()}),
    readVolumesForQualification:()=>{ requireValue(!terminal.readPrivateDiagnostics().disposed && !terminal.readPrivateDiagnostics().pending,'No live qualified source'); return latest!.volumes; },
    rejectReplacementForQualification:async(next,fault)=>{requireValue(!qualificationFault&&(fault==='format'||fault==='overflow'),'Only one sequential declared test fault');qualificationFault=fault;await terminal.replaceFixture(next);}};
};
