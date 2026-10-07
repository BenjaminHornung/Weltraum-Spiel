// Explicit throwaway E1 host. Ordinary game entry and formal driver stay separate.
import '../../../../../apps/weltraum-browser/src/style.css';
import {startHvp,createHvpLookScene} from '../../../../../apps/weltraum-browser/src/hvp/hvpBootstrap';
import {createHvpLookProfile} from '../../../../../apps/weltraum-browser/src/hestia-prototype/presentation/look';
import {createHvpVisualRenderer} from '../../../../../apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects';
import {ThreeRenderBackend} from '../../../../../apps/weltraum-browser/src/render/three/backend';
import {adoptMeshArtifactBuffers,meshArtifactOwnedBuffers} from '../../../../../apps/weltraum-browser/src/presentation/meshArtifact';
import {createRenderCommand,type RenderCommand} from '../../../../../apps/weltraum-browser/src/presentation/renderCommands';
import type {RenderCommandResult} from '../../../../../apps/weltraum-browser/src/presentation';
import {createProbeCompiler} from './compiler-probe';
import {createHvpTerrainCompiler} from '../../../../../apps/weltraum-browser/src/hestia-prototype/terrain/terrainProducts';
import {createHvpPhysicsClient} from '../../../../../apps/weltraum-browser/src/hestia-prototype/physics/client';

type Upsert=Extract<RenderCommand,{kind:'UpsertMeshArtifact'}>;
const products=new Map<string,Upsert>(),journal:RenderCommand[]=[];
let projection:Extract<RenderCommand,{kind:'ApplyFrameProjection'}>|undefined;
let visibility:Extract<RenderCommand,{kind:'ApplyVisibilityPlan'}>|undefined;
let options:ConstructorParameters<typeof ThreeRenderBackend>[0]|undefined;
let backend:ThreeRenderBackend|undefined,drawing=true,capturing=false,frozen=false,replayed=false;
let disposal:unknown;
let replayDisposal:unknown,releaseReplay:(()=>void)|undefined;
const params=new URLSearchParams(location.search),selectedKernel=params.get('kernel'),ownedTerrain=selectedKernel==='owned-terrain',kernel=selectedKernel==='direct'||selectedKernel==='owned-moving'||ownedTerrain,
  delayNative=params.get('delay')==='native-source',delayMoving=params.get('delay')==='moving-plan';
if(delayNative&&!kernel){throw new Error('Delayed source probe requires a new direct session');}
let releaseNativeGate:(()=>void)|undefined,nativeGate:unknown=null,disposePending:Promise<void>|undefined;
let compiler:ReturnType<typeof createProbeCompiler>|undefined;
const poolStartup:Array<{start:number;duration:number;origin:number}>=[];
const observePoolStartup=(start:number,duration:number)=>{if(poolStartup.length<8){poolStartup.push({start,duration,origin:performance.timeOrigin});}};
const accepted=(r:RenderCommandResult)=>r.status==='Accepted'||r.status==='AlreadyApplied';
function retain(command:RenderCommand,result:RenderCommandResult){
  if(!accepted(result)||frozen){return;}
  // Metadata only until capture is requested; no removed mesh history is retained.
  if(command.kind==='RegisterEphemeralRepresentation'||command.kind==='CancelEphemeralRepresentation'||command.kind==='AdvanceEphemeralEpoch'){
    if(journal.length===4096){throw new Error('Replay metadata budget');}journal.push(command);
  }
  if(command.kind==='UpsertMeshArtifact'){products.set(command.artifact.representationKey,command);}
  else if(command.kind==='RemoveRepresentation'||command.kind==='EvictRepresentation'){products.delete(command.representationKey);}
  else if(command.kind==='ApplyFrameProjection'){projection=command;}
  else if(command.kind==='ApplyVisibilityPlan'){visibility=command;}
}
const handle=await startHvp({drawEnabled:()=>drawing,onDisposed:receipt=>{disposal=receipt;},
  createTerrainCompiler:()=>kernel?(compiler=createProbeCompiler(observePoolStartup,ownedTerrain)):createHvpTerrainCompiler(observePoolStartup),
  ...(kernel?{
    extraCpuBytes:()=>compiler?.extraCpuBytes()??0,
    createPhysics:async(sources,spawn,signal,player,inertia,branch,checkpoint,kind,onTimings)=>{
      const client=await createHvpPhysicsClient(sources,spawn,signal,player,inertia,branch,checkpoint,kind,onTimings,
        ownedTerrain?'owned-terrain-subset-v3':selectedKernel==='owned-moving'?'owned-moving-subset-v2':'direct-known-cells-v1');
      if(delayNative||ownedTerrain){const prepare=client.prepareTerrain.bind(client);
        client.prepareTerrain=(id,generation,replacements,fragments,work)=>prepare(id,generation,replacements,fragments,work===undefined?undefined:{...work,
          onSourcePrepared:async views=>{if(ownedTerrain){compiler?.confirmNativeAncestor();}
            if(delayNative){nativeGate={state:'Ready',id,generation,sourceViews:views};
              await new Promise<void>(resolve=>{releaseNativeGate=resolve;});nativeGate={state:'Released',id,generation,sourceViews:views};}
            await work.onSourcePrepared?.(views);}});}
      if(delayMoving){const prepare=client.prepareBodyMeshWork!.bind(client);
        client.prepareBodyMeshWork=async(...args)=>{const result=await prepare(...args);nativeGate={state:'Ready',id:args[0],projection:result.projection};
          await new Promise<void>(resolve=>{releaseNativeGate=resolve;});nativeGate={state:'Released',id:args[0]};return result;};}
      return client;}}:{}),
  createBackend:(source)=>{
  options=source;backend=new ThreeRenderBackend(source);
  const dispatch=backend.dispatch.bind(backend),owned=backend.dispatchOwnedSteps.bind(backend);
  backend.dispatch=(command)=>{const result=dispatch(command);retain(command,result);return result;};
  backend.dispatchOwnedSteps=function*(command){const result=yield* owned(command);retain(command,result);return result;};
  return backend;
}});
document.body.dataset.hestiaExperiment='E1-draw-and-prepared-replay';
const frame=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));
function capturedBytes(){const buffers=new Set<ArrayBuffer>();for(const p of products.values()){for(const b of meshArtifactOwnedBuffers(p.artifact)){buffers.add(b);}}
  return [...buffers].reduce((n,b)=>n+b.byteLength,0);}
const control={
  setDrawing(value:boolean){if(frozen||typeof value!=='boolean'){throw new Error('Invalid draw probe state');}drawing=value;},
  facts(){return {drawing,capturing,frozen,kernel:ownedTerrain?'owned-terrain-subset-v3':selectedKernel==='owned-moving'?'owned-moving-subset-v2':kernel?'direct-known-cells-v1':'checkpoint-reference',poolStartup,kernelFacts:compiler?.probeFacts()??null,products:products.size,capturedLogicalBytes:capturedBytes(),
    captureOwnership:frozen?'ReplayRetainedUntilConfirmedDispose':'BorrowedBackendResidentUntilDispose',backend:backend?.readDiagnostics(),nativeGate,disposal,replayDisposal,gpuElapsed:'UNSUPPORTED'};},
  beginDispose(){frozen=true;disposePending??=handle.dispose();void disposePending.catch(()=>{});return {requested:true};},
  releaseNativeSource(){if(!releaseNativeGate){throw new Error('No real prepared source waiting');}const release=releaseNativeGate;releaseNativeGate=undefined;release();},
  async replay(samples=120,fault?:'render'){
    if(replayed||!options||!projection||!visibility||!drawing||samples!==120){throw new Error('Replay requires a drawn frozen scene and exactly120 frames');}
    replayed=true;capturing=true;frozen=true;
    const bytes=capturedBytes();if(bytes>128*1024*1024){throw new Error('Replay retained mesh budget');}
    const original=[...products.values()],hashes=original.map(p=>({key:p.artifact.representationKey,hash:p.artifact.contentHash}));
    await handle.dispose();
    const receipt=disposal as {state?:string;disposed?:Record<string,number|null>}|undefined;
    if(receipt?.state!=='Disposed'||!receipt.disposed||Object.values(receipt.disposed).some(n=>n!==0)){
      throw new Error('Original scene logical disposal not confirmed');}
    let visual:Readonly<{geometries:number;textures:number}>|undefined;
    const replay=new ThreeRenderBackend({...options,rendererFactory:(canvas,parameters)=>
      createHvpVisualRenderer(canvas,parameters,undefined,remaining=>{visual=remaining;},true)});
    let look:ReturnType<typeof createHvpLookScene>|undefined,lookReleased=false,lookFailed=false;
    const require=(command:RenderCommand)=>{const r=replay.dispatch(command);if(!accepted(r)){throw new Error(`Replay ${command.kind}: ${r.status}/${r.reasonCode}`);}};
    const start=performance.now();
    const gl=options.canvas?.getContext('webgl2') as WebGL2RenderingContext|null;
    const timer=gl?.getExtension('EXT_disjoint_timer_query_webgl2');
    const queries=new Set<WebGLQuery>(),gpuMs:number[]=[];let gpuDisjoint=false,queryActive=false;
    releaseReplay=()=>{
      const errors:string[]=[];
      const attempt=(name:string,action:()=>void)=>{try{action();}catch(error){errors.push(name+':'+(error instanceof Error?error.name:'Unknown'));}};
      if(queryActive&&gl&&timer){attempt('endQuery',()=>{gl.endQuery(timer.TIME_ELAPSED_EXT);queryActive=false;});}
      if(gl){for(const q of queries){attempt('deleteQuery',()=>{gl.deleteQuery(q);if(gl.isQuery(q)){throw new Error('Query release unconfirmed');}queries.delete(q);});}}
      if(look&&!lookReleased&&!lookFailed){attempt('look',()=>{try{look!.dispose();lookReleased=true;}catch(error){lookFailed=true;throw error;}});}
      attempt('backend',()=>require(createRenderCommand({kind:'DisposeBackend',backendRevision:projection!.backendRevision})));
      const d=replay.readDiagnostics(),remaining={geometries:d.geometryAllocations-d.geometryDisposals,
        materials:d.materialAllocations-d.materialDisposals,ownedCpuBytes:d.ownedCpuBytes,representations:d.activeRepresentations,
        renderTargets:d.activeRenderTargets,queries:queries.size,visualGeometries:visual?.geometries??null,textures:visual?.textures??null};
      const confirmed=errors.length===0&&lookReleased&&!lookFailed&&!queryActive&&d.backendState==='Disposed'&&Object.values(remaining).every(n=>n===0);
      replayDisposal={state:confirmed?'Disposed':'UNKNOWN',remaining,lookReleased,lookFailed,queryActive,errors,
        scope:'Actual owned handles and logical counters; physical GPU memory not measured',recovery:confirmed?'None':'RetainedByCutProbe.dispose'};
      if(confirmed){products.clear();journal.length=0;capturing=false;releaseReplay=undefined;}
    };
    let result:Record<string,unknown>|undefined;
    try{
      look=createHvpLookScene(replay.scene,createHvpLookProfile('readable'));
      require(createRenderCommand({kind:'InitializeBackend',backendRevision:projection.backendRevision}));
      for(const command of journal){require(command);}
      const adoptionStart=performance.now();
      for(const command of original){const artifact=adoptMeshArtifactBuffers(command.artifact);
        if(artifact.contentHash!==command.artifact.contentHash){throw new Error('Replay product bytes changed');}
        require(createRenderCommand({...command,artifact}));}
      const adoptionAndUpsertMs=performance.now()-adoptionStart;
      require(projection);require(visibility);
      const first=performance.now();const firstResult=replay.renderFrame();if(!accepted(firstResult)){throw new Error('Replay first submit rejected');}
      const firstSubmitMs=performance.now()-first;
      await frame();const times:number[]=[],intervals:number[]=[];let previous=await frame();
      for(let i=0;i<samples;i++){const now=await frame();intervals.push(now-previous);previous=now;const before=performance.now();
        const query=timer&&gl&&i%10===0?gl.createQuery():null;
        if(query&&gl){queries.add(query);gl.beginQuery(timer.TIME_ELAPSED_EXT,query);queryActive=true;}
        try{if(fault==='render'&&i===0){throw new Error('Injected replay render failure');}
          const submitted=replay.renderFrame();if(!accepted(submitted)){throw new Error('Replay steady submit rejected');}}
        finally{if(queryActive&&gl){gl.endQuery(timer.TIME_ELAPSED_EXT);queryActive=false;}}
        times.push(performance.now()-before);}
      if(timer&&gl){const deadline=performance.now()+2000;
        while(performance.now()<deadline&&[...queries].some(q=>!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))){await frame();}
        gpuDisjoint=Boolean(gl.getParameter(timer.GPU_DISJOINT_EXT));
        if(!gpuDisjoint){for(const q of queries){if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){gpuMs.push(Number(gl.getQueryParameter(q,gl.QUERY_RESULT))/1e6);}}}}
      result={classification:'renderer-only-diagnostic',adoptionAndUpsertMs,firstSubmitMs,steadySubmitMs:times,frameIntervalsMs:intervals,
        productHashes:hashes,capturedLogicalBytes:bytes,sourceAndPhysicsWork:false,
        gpuElapsed:{status:gpuMs.length===12&&!gpuDisjoint?'MEASURED':'UNSUPPORTED',method:'EXT_disjoint_timer_query_webgl2',planned:12,observed:gpuMs.length,disjoint:gpuDisjoint,ms:gpuMs},
        disposal,totalMs:performance.now()-start};
    }finally{releaseReplay?.();}
    return {...result,replayDisposal};
  },
  async dispose(){frozen=true;await (disposePending??=handle.dispose());releaseReplay?.();
    if(!releaseReplay){products.clear();journal.length=0;}return replayDisposal??disposal;}
};
Object.defineProperty(window,'CutProbe',{value:Object.freeze(control)});
