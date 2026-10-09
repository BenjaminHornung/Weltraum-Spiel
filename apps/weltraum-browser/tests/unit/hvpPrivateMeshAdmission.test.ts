import {expect,it,vi} from "vitest";
import {ThreeRenderBackend} from "../../src/render/three/backend/threeRenderBackend";
import {ThreeMaterialFactory} from "../../src/render/three/backend/threeMaterialFactory";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
import {HvpRenderStageRecoveryError} from "../../src/hestia-prototype/presentation/renderStageRecovery";
import {artifactRevision,backendRevision,createMaterialProfile,ephemeralRepresentationKey,frameId,materialProfileId,representationKey,sourceRevision,type MeshArtifactInput,type MaterialProfile,type RenderCommandResult} from "../../src/presentation";

type Binding={worldId:string;sessionId:string;sourceEpoch:number;sourceRevision:number;sourceDigest:string;renderEpoch:number;backendRevision:ReturnType<typeof backendRevision>};
type Handle={readonly receipt:{readonly representationKey:ReturnType<typeof representationKey>;readonly contentHash:string;readonly vertexCount:number;readonly indexCount:number;readonly estimatedBytes:number}};
type PrivateBackend=ThreeRenderBackend&{
  admitPrivateMeshSteps(input:MeshArtifactInput,profiles:readonly MaterialProfile[],binding:Binding):Generator<string,Handle,unknown>;
  upsertPrivateMeshSteps(handle:Handle,profiles:readonly MaterialProfile[],binding:Binding):Generator<string,RenderCommandResult,unknown>;
  releasePrivateMesh(handle:Handle,binding:Binding):RenderCommandResult;
};
const drain=<T>(steps:Generator<string,T,unknown>):T=>{for(;;){const step=steps.next();if(step.done){return step.value;}}};
const binding=():Binding=>({worldId:"private-world",sessionId:"private-session",sourceEpoch:0,sourceRevision:1,sourceDigest:"private-source-digest",renderEpoch:0,backendRevision:backendRevision(0)});
const profile=()=>createMaterialProfile({id:materialProfileId("private:rock"),kind:"Unlit",baseColor:{r:.5,g:.5,b:.5},opacity:1,doubleSided:true,wireframe:false,depthWrite:true});
const input=():MeshArtifactInput=>({representationKey:representationKey("planet:private"),sourceRevision:sourceRevision(1),artifactRevision:artifactRevision(1),algorithmVersion:"private-mesh-v1",frameId:frameId("local:private"),
  positions:new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]),normals:new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]),indices:new Uint16Array([0,1,2,0,2,3]),
  materialRanges:[{materialProfileId:materialProfileId("private:rock"),startIndex:0,indexCount:6}],bounds:{min:{x:-1,y:-1,z:0},max:{x:1,y:1,z:0}}});
const setup=():PrivateBackend=>{
  const backend=new ThreeRenderBackend({canvas:{} as HTMLCanvasElement,lightingMode:"None",rendererFactory:()=>({setPixelRatio(){},setSize(){},render(){},dispose(){}})}) as PrivateBackend;
  expect(backend.dispatch({kind:"InitializeBackend",backendRevision:backendRevision(0)}).status).toBe("Accepted");return backend;
};
const dispose=(backend:PrivateBackend)=>backend.dispatch({kind:"DisposeBackend",backendRevision:backendRevision(0)});

it("mints only opaque scalar receipts after private custody and separates scene arrays",()=>{
  const backend=setup(),source=input(),context=binding(),profiles=[profile()];
  try{
    const handle=drain(backend.admitPrivateMeshSteps(source,profiles,context)),hash=handle.receipt.contentHash;
    expect(handle.receipt).toMatchObject({vertexCount:4,indexCount:6});expect(Object.values(handle).some(v=>ArrayBuffer.isView(v))).toBe(false);
    source.positions.fill(99);source.indices.fill(3);
    expect(drain(backend.upsertPrivateMeshSteps(handle,profiles,context)).status).toBe("Accepted");
    const node=backend.representationRoot.children[0]! as import("three").Mesh;
    expect(node.geometry.getAttribute("position").getX(0)).toBe(-1);
    node.geometry.getAttribute("position").array.fill(88);expect(handle.receipt.contentHash).toBe(hash);
    expect(drain(backend.upsertPrivateMeshSteps(handle,profiles,context)).status).toBe("AlreadyApplied");
    expect(backend.releasePrivateMesh(handle,context).status).toBe("Accepted");expect(backend.representationRoot.children).toHaveLength(0);
    expect(drain(backend.upsertPrivateMeshSteps(handle,profiles,context)).status).toMatch(/Rejected|Unavailable/);
  }finally{dispose(backend);}
});
it("rejects forged, cloned, proxy and foreign-backend handles",()=>{
  const backend=setup(),foreign=setup(),context=binding(),profiles=[profile()];
  try{
    const handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context));
    for(const forged of [{} as Handle,{...handle},new Proxy(handle,{})]){expect(drain(backend.upsertPrivateMeshSteps(forged,profiles,context)).status).toMatch(/Rejected/);}
    expect(drain(foreign.upsertPrivateMeshSteps(handle,profiles,context)).status).toMatch(/Rejected/);
  }finally{dispose(backend);dispose(foreign);}
});
it.each(["worldId","sessionId","sourceEpoch","sourceRevision","sourceDigest","renderEpoch","backendRevision"] as const)("rejects changed complete binding %s",field=>{
  const backend=setup(),context=binding(),profiles=[profile()];
  try{
    const handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context)),changed={...context,[field]:typeof context[field]==="number"?Number(context[field])+1:"foreign"};
    expect(drain(backend.upsertPrivateMeshSteps(handle,profiles,changed)).status).toMatch(/Rejected/);expect(backend.representationRoot.children).toHaveLength(0);
  }finally{dispose(backend);}
});
it.each(["shared","resizable","subview","alias","nan","index","bounds","range"] as const)("rejects invalid private intake %s",kind=>{
  const backend=setup(),source=input(),profiles=[profile()];
  try{
    if(kind==="shared"){Object.assign(source,{positions:new Float32Array(new SharedArrayBuffer(48))});}
    if(kind==="resizable"){const ResizableBuffer=ArrayBuffer as unknown as new(length:number,options:{maxByteLength:number})=>ArrayBuffer;Object.assign(source,{positions:new Float32Array(new ResizableBuffer(48,{maxByteLength:96}))});}
    if(kind==="subview"){Object.assign(source,{positions:new Float32Array(15).subarray(0,12)});}
    if(kind==="alias"){Object.assign(source,{normals:source.positions});}
    if(kind==="nan"){source.positions[0]=NaN;}
    if(kind==="index"){source.indices[0]=4;}
    if(kind==="bounds"){Object.assign(source,{bounds:{min:{x:0,y:0,z:0},max:{x:1,y:1,z:1}}});}
    if(kind==="range"){Object.assign(source,{materialRanges:[]});}
    expect(backend.admitPrivateMeshSteps).toBeTypeOf("function");
    expect(()=>drain(backend.admitPrivateMeshSteps(source,profiles,binding()))).toThrow();expect(backend.representationRoot.children).toHaveLength(0);
  }finally{dispose(backend);}
});

it.each(["infinity","normal-width","uv-width","color-width","triangle-width","reversed-bounds","range-overlap","claimed-hash","typed-proxy"] as const)("retains full private geometry validation for %s",kind=>{
  const backend=setup(),source=input(),profiles=[profile()];
  try{
    if(kind==="infinity"){source.positions[0]=Infinity;}
    if(kind==="normal-width"){Object.assign(source,{normals:new Float32Array(9)});}
    if(kind==="uv-width"){Object.assign(source,{attributes:{uv:new Float32Array(6)}});}
    if(kind==="color-width"){Object.assign(source,{attributes:{color:new Float32Array(9)}});}
    if(kind==="triangle-width"){Object.assign(source,{indices:new Uint16Array([0,1,2,3])});}
    if(kind==="reversed-bounds"){Object.assign(source,{bounds:{min:{x:1,y:1,z:1},max:{x:-1,y:-1,z:-1}}});}
    if(kind==="range-overlap"){Object.assign(source,{materialRanges:[{materialProfileId:profiles[0]!.id,startIndex:0,indexCount:6},{materialProfileId:profiles[0]!.id,startIndex:3,indexCount:3}]});}
    if(kind==="claimed-hash"){Object.assign(source,{contentHash:"fnv1a64-v1:0000000000000000"});}
    if(kind==="typed-proxy"){Object.assign(source,{positions:new Proxy(source.positions,{})});}
    expect(()=>drain(backend.admitPrivateMeshSteps(source,profiles,binding()))).toThrow();expect(backend.readDiagnostics().ownedCpuBytes).toBe(0);
  }finally{dispose(backend);}
});

it("counts private custody separately and releases it on reset or dispose",()=>{
  for(const terminal of ["ResetBackend","DisposeBackend"] as const){
    const backend=setup(),context=binding(),profiles=[profile()];
    const handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context));
    expect(backend.readDiagnostics().ownedCpuBytes).toBe(handle.receipt.estimatedBytes);
    expect(drain(backend.upsertPrivateMeshSteps(handle,profiles,context)).status).toBe("Accepted");
    expect(backend.readDiagnostics().ownedCpuBytes).toBe(2*handle.receipt.estimatedBytes);
    const command=terminal==="ResetBackend"?{kind:terminal,backendRevision:backendRevision(0),nextBackendRevision:backendRevision(1)}:{kind:terminal,backendRevision:backendRevision(0)};
    expect(backend.dispatch(command).status).toBe("Accepted");expect(backend.readDiagnostics().ownedCpuBytes).toBe(0);
    expect(drain(backend.upsertPrivateMeshSteps(handle,profiles,context)).status).toMatch(/Rejected|Unavailable/);
    expect(backend.releasePrivateMesh(handle,context).status).toMatch(/Rejected|Unavailable/);
  }
});
it("revokes private custody after an ordinary exact removal",()=>{
  const backend=setup(),context=binding(),profiles=[profile()],handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context));
  try{
    drain(backend.upsertPrivateMeshSteps(handle,profiles,context));
    expect(backend.dispatch({kind:"RemoveRepresentation",backendRevision:context.backendRevision,representationKey:handle.receipt.representationKey,
      expectedSourceRevision:sourceRevision(1),expectedArtifactRevision:artifactRevision(1),expectedContentHash:handle.receipt.contentHash as import("../../src/presentation").ContentHash}).status).toBe("Accepted");
    expect(backend.readDiagnostics().ownedCpuBytes).toBe(0);expect(backend.releasePrivateMesh(handle,context).status).toMatch(/Rejected/);
  }finally{dispose(backend);}
});
it("retains both custody copies when ordinary geometry release throws",()=>{
  const backend=setup(),context=binding(),profiles=[profile()],handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context));
  drain(backend.upsertPrivateMeshSteps(handle,profiles,context));
  const node=backend.representationRoot.children[0]! as import("three").Mesh;let releases=0;
  node.geometry.dispose=()=>{releases++;throw new Error("injected private release failure");};
  expect(backend.releasePrivateMesh(handle,context)).toMatchObject({status:"BackendUnavailable",ownership:"AlreadyOwnedByBackend"});
  expect(backend.readDiagnostics().ownedCpuBytes).toBe(2*handle.receipt.estimatedBytes);
  expect(dispose(backend).status).toBe("BackendUnavailable");expect(releases).toBe(1);
  expect(backend.readDiagnostics().ownedCpuBytes).toBe(2*handle.receipt.estimatedBytes);
});
it("never passes private custody buffers to ambient Object.freeze",()=>{
  const backend=setup(),context=binding(),profiles=[profile()],original=Object.freeze;const escaped:ArrayBuffer[]=[];
  Object.freeze=((value:object)=>{if(Array.isArray(value)){for(const item of value){if(item instanceof ArrayBuffer){escaped.push(item);}}}return original(value);}) as typeof Object.freeze;
  try{drain(backend.admitPrivateMeshSteps(input(),profiles,context));expect(escaped).toHaveLength(0);}
  finally{Object.freeze=original;dispose(backend);}
});
it("rechecks material definitions after a staging yield",()=>{
  const backend=setup(),context=binding(),profiles=[profile()],source=input();
  Object.assign(source,{positions:new Float32Array(3072),normals:new Float32Array(3072),indices:new Uint16Array([0,1,2]),
    materialRanges:[{materialProfileId:profiles[0]!.id,startIndex:0,indexCount:3}],bounds:{min:{x:0,y:0,z:0},max:{x:0,y:0,z:0}}});
  try{
    const handle=drain(backend.admitPrivateMeshSteps(source,profiles,context)),steps=backend.upsertPrivateMeshSteps(handle,profiles,context);
    expect(steps.next().done).toBe(false);profiles[0]=createMaterialProfile({...profiles[0]!,opacity:.5});
    expect(drain(steps).status).toMatch(/Rejected/);expect(backend.representationRoot.children).toHaveLength(0);
  }finally{dispose(backend);}
});

it("rejects two interleaved distinct admissions of one mesh revision",()=>{
  const backend=setup(),context=binding(),profiles=[profile()],a=drain(backend.admitPrivateMeshSteps(input(),profiles,context)),b=drain(backend.admitPrivateMeshSteps(input(),profiles,context));
  try{
    const first=backend.upsertPrivateMeshSteps(a,profiles,context),second=backend.upsertPrivateMeshSteps(b,profiles,context);
    expect(first.next().done).toBe(false);expect(second.next().done).toBe(false);
    expect(drain(first).status).toBe("Accepted");expect(drain(second).status).toMatch(/Rejected/);
    expect(backend.representationRoot.children).toHaveLength(1);expect(drain(backend.upsertPrivateMeshSteps(a,profiles,context)).status).toBe("AlreadyApplied");
  }finally{dispose(backend);}
});
it("rejects unused material definitions",()=>{
  const backend=setup(),profiles=[profile(),createMaterialProfile({...profile(),id:materialProfileId("private:unused")})];
  try{expect(()=>drain(backend.admitPrivateMeshSteps(input(),profiles,binding()))).toThrow();}finally{dispose(backend);}
});
it("cannot release a replacement using a pre-reset handle",()=>{
  const backend=setup(),context=binding(),profiles=[profile()],old=drain(backend.admitPrivateMeshSteps(input(),profiles,context));
  drain(backend.upsertPrivateMeshSteps(old,profiles,context));
  backend.dispatch({kind:"ResetBackend",backendRevision:backendRevision(0),nextBackendRevision:backendRevision(1)});
  const nextContext={...context,backendRevision:backendRevision(1)},next=drain(backend.admitPrivateMeshSteps(input(),profiles,nextContext));
  drain(backend.upsertPrivateMeshSteps(next,profiles,nextContext));
  expect(backend.releasePrivateMesh(old,context).status).toMatch(/Rejected/);expect(backend.representationRoot.children).toHaveLength(1);
  backend.dispatch({kind:"DisposeBackend",backendRevision:backendRevision(1)});
});

it("reserves suspended intake and scene copies and debits cancellation once",()=>{
  const backend=setup(),context=binding(),profiles=[profile()];
  try{
    const intake=backend.admitPrivateMeshSteps(input(),profiles,context);
    expect(intake.next().done).toBe(false);expect(backend.readDiagnostics().ownedCpuBytes).toBe(108);
    intake.return(undefined as never);expect(backend.readDiagnostics().ownedCpuBytes).toBe(0);
    const handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context)),stage=backend.upsertPrivateMeshSteps(handle,profiles,context);
    expect(stage.next().done).toBe(false);expect(backend.readDiagnostics().ownedCpuBytes).toBe(216);
    stage.return(undefined as never);expect(backend.readDiagnostics().ownedCpuBytes).toBe(108);
    expect(backend.releasePrivateMesh(handle,context).status).toBe("Accepted");expect(backend.readDiagnostics().ownedCpuBytes).toBe(0);
  }finally{dispose(backend);}
});

it("handles first Dispose failure without dropping private records or retrying uncertain releases",()=>{
  const backend=setup(),context=binding(),profiles=[profile()],handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context));
  drain(backend.upsertPrivateMeshSteps(handle,profiles,context));let calls=0;
  const node=backend.representationRoot.children[0]! as import("three").Mesh;
  node.geometry.dispose=()=>{calls++;throw new Error("first Dispose failure");};
  expect(dispose(backend)).toMatchObject({status:"BackendUnavailable",ownership:"AlreadyOwnedByBackend"});
  expect(dispose(backend)).toMatchObject({status:"BackendUnavailable",ownership:"AlreadyOwnedByBackend"});
  expect(calls).toBe(1);expect(backend.readDiagnostics().ownedCpuBytes).toBe(216);
  expect(backend.readDiagnostics().residentRepresentationKeys).toHaveLength(0);
});

it("binds cancellation checks to the captured intake key",()=>{
  const backend=setup(),source=input(),context=binding(),profiles=[profile()],key=ephemeralRepresentationKey({kind:"fragment"},0,1);
  Object.assign(source,{representationKey:key});backend.dispatch({kind:"RegisterEphemeralRepresentation",backendRevision:backendRevision(0),representationKey:key,serial:1,epoch:0});
  try{
    const steps=backend.admitPrivateMeshSteps(source,profiles,context);expect(steps.next().done).toBe(false);
    backend.dispatch({kind:"CancelEphemeralRepresentation",backendRevision:backendRevision(0),representationKey:key,serial:1});Object.assign(source,{representationKey:representationKey("planet:private")});
    expect(()=>drain(steps)).toThrow();expect(backend.readDiagnostics().ownedCpuBytes).toBe(0);
  }finally{dispose(backend);}
});
it.each(["ResetBackend","DisposeBackend"] as const)("fails closed after first renderer teardown failure in %s",terminal=>{
  let calls=0,creates=0;const backend=new ThreeRenderBackend({canvas:{} as HTMLCanvasElement,lightingMode:"None",rendererFactory:()=>{creates++;return {setPixelRatio(){},setSize(){},render(){},dispose(){calls++;throw new Error("first renderer release failure");}};}}) as PrivateBackend;
  backend.dispatch({kind:"InitializeBackend",backendRevision:backendRevision(0)});
  const context=binding(),profiles=[profile()],handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context));drain(backend.upsertPrivateMeshSteps(handle,profiles,context));
  const suspended=backend.admitPrivateMeshSteps(input(),profiles,context);expect(suspended.next().done).toBe(false);
  expect(backend.dispatch(terminal==="ResetBackend"?{kind:terminal,backendRevision:backendRevision(0),nextBackendRevision:backendRevision(1)}:{kind:terminal,backendRevision:backendRevision(0)})).toMatchObject({status:"BackendUnavailable",reasonCode:"RendererTeardownUncertain"});
  expect(()=>drain(backend.admitPrivateMeshSteps(input(),profiles,context))).toThrow();expect(calls).toBe(1);
  expect(backend.dispatch({kind:"InitializeBackend",backendRevision:backendRevision(0)}).status).toBe("BackendUnavailable");expect(creates).toBe(1);
  expect(()=>drain(suspended)).toThrow();expect(backend.readDiagnostics().ownedCpuBytes).toBe(0);
});

it("separates synchronous upload/commit CPU from suspended scene copies",()=>{
  const timings:{phase:string;start:number;duration:number}[]=[];
  const backend=new ThreeRenderBackend({canvas:{} as HTMLCanvasElement,lightingMode:"None",rendererFactory:()=>({setPixelRatio(){},setSize(){},render(){},dispose(){}}),onTiming(phase,start,duration){timings.push({phase,start,duration});}}) as PrivateBackend;
  backend.dispatch({kind:"InitializeBackend",backendRevision:backendRevision(0)});
  try{
    const context=binding(),profiles=[profile()],handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context)),steps=backend.upsertPrivateMeshSteps(handle,profiles,context);
    expect(steps.next().done).toBe(false);expect(timings).toHaveLength(0);expect(drain(steps).status).toBe("Accepted");
    const total=timings.find(t=>t.phase==="privateUploadCommitCpuMs")!;
    expect(timings.map(t=>t.phase)).toEqual(["prepareThreeMeshCpuMs","representationAddCpuMs","registryCommitCpuMs","privateUploadCommitCpuMs"]);
    for(const child of timings.slice(0,3)){expect(child.start).toBeGreaterThanOrEqual(total.start);expect(child.start+child.duration).toBeLessThanOrEqual(total.start+total.duration);}
  }finally{dispose(backend);}
});

it("rehydrates exact private custody after eviction without retaining scene arrays",()=>{
  const backend=setup(),context=binding(),profiles=[profile()],handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context));
  try{
    drain(backend.upsertPrivateMeshSteps(handle,profiles,context));
    expect(backend.dispatch({kind:"EvictRepresentation",backendRevision:context.backendRevision,representationKey:handle.receipt.representationKey,expectedSourceRevision:sourceRevision(1),expectedArtifactRevision:artifactRevision(1),expectedContentHash:handle.receipt.contentHash as import("../../src/presentation").ContentHash}).status).toBe("Accepted");
    expect(backend.readDiagnostics()).toMatchObject({residentRepresentationKeys:[],ownedCpuBytes:108});
    expect(drain(backend.upsertPrivateMeshSteps(handle,profiles,context)).status).toBe("Accepted");
    expect(backend.readDiagnostics().ownedCpuBytes).toBe(216);expect(backend.releasePrivateMesh(handle,context).status).toBe("Accepted");
    expect(backend.readDiagnostics().ownedCpuBytes).toBe(0);
  }finally{dispose(backend);}
});

it("retains copied scene bytes when ephemeral material preparation has an uncertain outcome",()=>{
  const backend=setup(),context=binding(),profiles=[profile()],source=input(),key=ephemeralRepresentationKey({kind:"fragment"},0,1);
  Object.assign(source,{representationKey:key});backend.dispatch({kind:"RegisterEphemeralRepresentation",backendRevision:context.backendRevision,representationKey:key,serial:1,epoch:0});
  const handle=drain(backend.admitPrivateMeshSteps(source,profiles,context));
  const acquire=vi.spyOn(ThreeMaterialFactory.prototype,"acquire").mockImplementation(()=>{throw new Error("injected material preparation uncertainty");});
  try{
    expect(drain(backend.upsertPrivateMeshSteps(handle,profiles,context)).status).toBe("BackendUnavailable");
    expect(backend.releasePrivateMesh(handle,context)).toMatchObject({status:"BackendUnavailable",ownership:"AlreadyOwnedByBackend"});
    expect(backend.readDiagnostics().ownedCpuBytes).toBe(216);expect(dispose(backend).status).toBe("BackendUnavailable");expect(backend.readDiagnostics().ownedCpuBytes).toBe(216);
  }finally{acquire.mockRestore();}
});

it("preserves cancellation and an actual prefix-release failure from generator return",async()=>{
  const backend=setup(),context=binding(),profiles=[profile()],handle=drain(backend.admitPrivateMeshSteps(input(),profiles,context));
  const cancellation=new Error("stale owner"),cleanup=new Error("actual geometry release failure");let checks=0,releases=0;
  const pump=createHvpBodyMeshTaskPump(()=>{if(++checks===2){throw cancellation;}});
  function* stages():Generator<string,void,unknown>{
    drain(backend.upsertPrivateMeshSteps(handle,profiles,context));
    const node=backend.representationRoot.children[0]! as import("three").Mesh;node.geometry.dispose=()=>{releases++;throw cleanup;};
    try{yield "uploadedPrefix";}finally{const result=backend.releasePrivateMesh(handle,context);
      if(result.status!=="Accepted"){throw new HvpRenderStageRecoveryError([cleanup],"prefix release unproven");}}
  }
  try{
    let caught:unknown;try{await pump.run(stages());}catch(error){caught=error;}
    expect(caught).toBeInstanceOf(HvpRenderStageRecoveryError);expect((caught as AggregateError).errors[0]).toBe(cancellation);
    expect(((caught as AggregateError).errors[1] as AggregateError).errors).toContain(cleanup);
    expect(releases).toBe(1);expect(backend.readDiagnostics().ownedCpuBytes).toBe(216);expect(dispose(backend).status).toBe("BackendUnavailable");
  }finally{pump.dispose();}
});
