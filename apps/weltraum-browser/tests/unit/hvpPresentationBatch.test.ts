import { describe, expect, it, vi } from "vitest";
import { createSynchronousBatch } from "../../src/hestia-prototype/presentation/synchronousBatch";
import { createHvpPresentationBackend } from "../../src/hvp/hvpBootstrap";
import { ThreeRenderBackend } from "../../src/render/three/backend/threeRenderBackend";
import * as projectionModule from "../../src/presentation/visibilityPlan";
import * as canonicalModule from "../../src/presentation/canonical";
import { artifactRevision, backendRevision, createMaterialProfile, createMeshArtifact, createRenderCommand,
  frameId, frameRevision, createFrameProjectionSnapshot, materialProfileId, representationKey, sourceRevision } from "../../src/presentation";

describe("HVP synchronous presentation batch", () => {
  it("coalesces nested requests at the outer boundary and preserves return identity", () => {
    const flush = vi.fn();
    const batch = createSynchronousBatch(flush);
    const value = {};
    expect(batch.run(() => {
      batch.request();
      expect(batch.run(() => { batch.request(); batch.request(); return 17; })).toBe(17);
      expect(flush).not.toHaveBeenCalled();
      return value;
    })).toBe(value);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("does not flush without requests and flushes outside requests immediately", () => {
    const flush = vi.fn();
    const batch = createSynchronousBatch(flush);
    expect(batch.run(() => batch.run(() => false))).toBe(false);
    expect(flush).not.toHaveBeenCalled();
    batch.request();
    batch.request();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("preserves an action failure, flushes its pending work and remains usable", () => {
    const original = new Error("upload failed");
    const flush = vi.fn();
    const batch = createSynchronousBatch(flush);
    let caught: unknown;
    try {
      batch.run(() => { batch.request(); throw original; });
    } catch (error) { caught = error; }
    expect(caught).toBe(original);
    expect(flush).toHaveBeenCalledTimes(1);
    batch.request();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("preserves a flush failure without a stale dirty flag or batch depth", () => {
    const original = new Error("projection failed");
    const flush = vi.fn().mockImplementationOnce(() => { throw original; });
    const batch = createSynchronousBatch(flush);
    let caught: unknown;
    try { batch.run(() => { batch.request(); }); } catch (error) { caught = error; }
    expect(caught).toBe(original);
    batch.run(() => undefined);
    expect(flush).toHaveBeenCalledTimes(1);
    batch.request();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("retains both original causes when action and flush fail", () => {
    const actionError = new Error("upload failed");
    const flushError = new Error("projection failed");
    const batch = createSynchronousBatch(() => { throw flushError; });
    let caught: unknown;
    try { batch.run(() => { batch.request(); throw actionError; }); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors[0]).toBe(actionError);
    expect((caught as AggregateError).errors[1]).toBe(flushError);
    expect((caught as Error).message).toContain(actionError.message);
    expect((caught as Error).message).toContain(flushError.message);
  });

  it("preserves even an undefined thrown value", () => {
    const batch = createSynchronousBatch(() => undefined);
    let caught: unknown = Symbol("not thrown");
    try { batch.run(() => { throw undefined; }); } catch (error) { caught = error; }
    expect(caught).toBeUndefined();
  });

  it("keeps both causes even when an error cannot be formatted", () => {
    const original = { toString: () => { throw new Error("format failure"); } };
    const flushError = new Error("flush failure");
    const batch = createSynchronousBatch(() => { throw flushError; });
    let caught: unknown;
    try { batch.run(() => { batch.request(); throw original; }); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors).toEqual([original, flushError]);
  });

  it("rejects a thenable without executing it and still releases the batch", () => {
    const flush = vi.fn();
    const then = vi.fn();
    const batch = createSynchronousBatch(flush);
    expect(() => batch.run(() => { batch.request(); return { then }; })).toThrow("must be synchronous");
    expect(then).not.toHaveBeenCalled();
    expect(flush).toHaveBeenCalledTimes(1);
    batch.request();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("flushes once when an outer action catches a nested failure", () => {
    const flush = vi.fn();
    const batch = createSynchronousBatch(flush);
    batch.run(() => {
      expect(() => batch.run(() => { batch.request(); throw new Error("inner"); })).toThrow("inner");
      batch.request();
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

const adapterFixture = (defer = false, onTiming?: (name:string,start:number,duration:number)=>void,
  onBackendTiming?: (phase:string,start:number,duration:number,key:string)=>void) => {
  const backend = new ThreeRenderBackend({ canvas: {} as HTMLCanvasElement,
    onTiming:onBackendTiming,
    rendererFactory: () => ({ setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => {} }) });
  const active = new Set<string>();
  const adapter = createHvpPresentationBackend(backend, () => ({ position: { x: 0, y: 0, z: 3 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }, verticalFovDegrees: 60, aspect: 1, near: 0.1, far: 100 }),
  representationKey("hvp:water"), () => [], key => active.has(key), onTiming, defer);
  adapter.dispatch(createRenderCommand({ kind: "InitializeBackend", backendRevision: backendRevision(0) }));
  const material = createMaterialProfile({ id: materialProfileId("hvp:batch:material"), kind: "BasicLit",
    baseColor: { r: 0.5, g: 0.5, b: 0.5 }, opacity: 1, doubleSided: false, wireframe: false, depthWrite: true });
  const artifact = (name: string, frame = "hvp:batch:frame") => createMeshArtifact({ representationKey: representationKey(name),
    frameId: frameId(frame), sourceRevision: sourceRevision(1), artifactRevision: artifactRevision(1),
    algorithmVersion: "hvp-batch-test-v1", positions: new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0]),
    normals: new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]), indices: new Uint16Array([0,1,2,0,2,3]),
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
    materialRanges: [{ materialProfileId: material.id, startIndex: 0, indexCount: 6 }] });
  const upsert = (mesh: ReturnType<typeof artifact>) => adapter.dispatch(createRenderCommand({
    kind: "UpsertMeshArtifact", backendRevision: backendRevision(0), artifact: mesh, materialProfiles: [material] }));
  const remove = (mesh: ReturnType<typeof artifact>) => adapter.dispatch(createRenderCommand({
    kind: "RemoveRepresentation", backendRevision: backendRevision(0), representationKey: mesh.representationKey,
    expectedSourceRevision: mesh.sourceRevision, expectedArtifactRevision: mesh.artifactRevision, expectedContentHash: mesh.contentHash }));
  const dispose = () => adapter.dispatch(createRenderCommand({ kind: "DisposeBackend", backendRevision: backendRevision(0) }));
  return { backend, adapter, active, artifact, upsert, remove, dispose };
};

it("measures projection and visibility as contained nonoverlapping publication breakdowns",()=>{
  const spans:{name:string;start:number;duration:number}[]=[];
  const f=adapterFixture(false,(name,start,duration)=>spans.push({name,start,duration}));
  try{
    const mesh=f.artifact("hvp:batch:timing");f.active.add(mesh.representationKey);f.upsert(mesh);spans.length=0;
    f.adapter.updateProjection();
    expect(spans.map(span=>span.name)).toEqual(["startupProjectionSnapshotCpuMs","startupVisibilityPlanBuildCpuMs","startupVisibilityPlanDispatchCpuMs","startupProjectionMs"]);
    const [projection,build,dispatch,total]=spans;
    expect(projection!.start).toBeGreaterThanOrEqual(total!.start);
    expect(projection!.start+projection!.duration).toBeLessThanOrEqual(build!.start);
    expect(build!.start+build!.duration).toBeLessThanOrEqual(dispatch!.start);
    expect(dispatch!.start+dispatch!.duration).toBeLessThanOrEqual(total!.start+total!.duration);
    expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([mesh.representationKey]);
  }finally{f.dispose();}
});

it("measures contained backend projection phases without giving the timing sink authority",()=>{
  const spans:{name:string;start:number;duration:number;key:string}[]=[],parents:{name:string;start:number;duration:number}[]=[];
  const f=adapterFixture(false,(name,start,duration)=>parents.push({name,start,duration}),(name,start,duration,key)=>{
    spans.push({name,start,duration,key});throw new Error("Backend timing sink failed");
  });
  const dispatch=vi.spyOn(f.backend,"dispatch");
  try{
    const mesh=f.artifact("hvp:batch:backend-timing");f.active.add(mesh.representationKey);f.upsert(mesh);spans.length=0;parents.length=0;
    f.adapter.updateProjection();
    expect(spans.map(span=>span.name)).toEqual(["projectionSignatureCpuMs","projectionCameraMapCpuMs","projectionSceneApplyCpuMs"]);
    const parent=parents.find(span=>span.name==="startupProjectionSnapshotCpuMs")!;
    for(let index=0;index<spans.length;index+=1){
      const span=spans[index]!;expect(span.key).toBe(mesh.representationKey);expect(span.duration).toBeGreaterThanOrEqual(0);
      expect(span.start).toBeGreaterThanOrEqual(index===0?parent.start:spans[index-1]!.start+spans[index-1]!.duration);
      expect(span.start+span.duration).toBeLessThanOrEqual(parent.start+parent.duration);
    }
    expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([mesh.representationKey]);
    const command=dispatch.mock.calls.filter(([value])=>value.kind==="ApplyFrameProjection").at(-1)![0];
    expect(f.backend.dispatch(command).status).toBe("AlreadyApplied");expect(spans).toHaveLength(3);
    if(command.kind!=="ApplyFrameProjection"){throw new Error("Projection command missing");}
    expect(f.backend.dispatch({...command,snapshot:{...command.snapshot,cameraPositionRelative:{x:1,y:0,z:3}}}).status).toBe("RejectedContentConflict");
    expect(spans).toHaveLength(3);expect(f.adapter.renderFrame().status).toBe("Accepted");
  }finally{dispatch.mockRestore();f.dispose();}
});

it("adds no projection measurement clocks without a timing sink",()=>{
  const f=adapterFixture();let now:ReturnType<typeof vi.spyOn>|undefined;
  try{
    const mesh=f.artifact("hvp:batch:no-timing");f.active.add(mesh.representationKey);f.upsert(mesh);
    now=vi.spyOn(performance,"now");f.adapter.updateProjection();expect(now).not.toHaveBeenCalled();
  }finally{now?.mockRestore();f.dispose();}
});

it("does not invent a timing key or read measurement clocks for an empty projection",()=>{
  const timing=vi.fn(),f=adapterFixture(false,undefined,timing),dispatch=vi.spyOn(f.backend,"dispatch");
  let now:ReturnType<typeof vi.spyOn>|undefined;
  try{
    const mesh=f.artifact("hvp:batch:empty-timing");f.active.add(mesh.representationKey);f.upsert(mesh);
    const projection=dispatch.mock.calls.find(([command])=>command.kind==="ApplyFrameProjection")![0];
    if(projection.kind!=="ApplyFrameProjection"){throw new Error("Projection command missing");}
    const empty=createRenderCommand({kind:"ApplyFrameProjection",backendRevision:backendRevision(0),snapshot:createFrameProjectionSnapshot({
      ...projection.snapshot,frameRevision:frameRevision(100),representationTransforms:[]})});
    timing.mockClear();now=vi.spyOn(performance,"now");
    expect(f.backend.dispatch(empty).status).toBe("Accepted");expect(timing).not.toHaveBeenCalled();expect(now).not.toHaveBeenCalled();
    expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([]);
  }finally{now?.mockRestore();dispatch.mockRestore();f.dispose();}
});

it("hashes factory projections only for same-revision comparisons",()=>{
  const f=adapterFixture(),dispatch=vi.spyOn(f.backend,"dispatch");let publicHash:ReturnType<typeof vi.spyOn>|undefined,privateHash:ReturnType<typeof vi.spyOn>|undefined;
  try{
    const mesh=f.artifact("hvp:batch:lazy-signature");f.active.add(mesh.representationKey);f.upsert(mesh);
    const command=dispatch.mock.calls.find(([c])=>c.kind==="ApplyFrameProjection")![0];if(command.kind!=="ApplyFrameProjection"){throw new Error("Missing projection");}
    const make=(revision:number,x=0)=>createFrameProjectionSnapshot({...command.snapshot,frameRevision:frameRevision(revision),cameraPositionRelative:{x,y:0,z:3}});
    const send=(snapshot:ReturnType<typeof make>)=>f.backend.dispatch({...command,snapshot});
    publicHash=vi.spyOn(projectionModule,"frameProjectionSignature");privateHash=vi.spyOn(canonicalModule,"canonicalSignaturePrivateSteps");
    expect(send(make(10)).status).toBe("Accepted");expect(send(make(11)).status).toBe("Accepted");
    expect(publicHash).not.toHaveBeenCalled();expect(privateHash).not.toHaveBeenCalled();
    expect(send(make(11)).status).toBe("AlreadyApplied");expect(privateHash).toHaveBeenCalledTimes(2);
    expect(send(make(11,1)).status).toBe("RejectedContentConflict");expect(privateHash).toHaveBeenCalledTimes(3);
    expect(send(createFrameProjectionSnapshot({...make(11),frameId:frameId("hvp:other:frame")})).status).toBe("RejectedContentConflict");
    expect(send(make(10)).status).toBe("RejectedStaleRevision");expect(publicHash).not.toHaveBeenCalled();
    expect(f.adapter.renderFrame().status).toBe("Accepted");
    expect(f.backend.dispatch({kind:"ResetBackend",backendRevision:backendRevision(0),nextBackendRevision:backendRevision(1)}).status).toBe("Accepted");
    expect(f.backend.dispatch({...command,backendRevision:backendRevision(1),snapshot:make(1)}).status).toBe("Accepted");
  }finally{publicHash?.mockRestore();privateHash?.mockRestore();dispatch.mockRestore();f.backend.dispatch({kind:"DisposeBackend",backendRevision:f.backend.readDiagnostics().backendRevision});}
});

it("retains eager original hashes for raw, cloned and extended factory snapshots",()=>{
  const f=adapterFixture(),dispatch=vi.spyOn(f.backend,"dispatch");let hash:ReturnType<typeof vi.spyOn>|undefined;
  try{
    const mesh=f.artifact("hvp:batch:raw-signature");f.active.add(mesh.representationKey);f.upsert(mesh);
    const command=dispatch.mock.calls.find(([c])=>c.kind==="ApplyFrameProjection")![0];if(command.kind!=="ApplyFrameProjection"){throw new Error("Missing projection");}
    hash=vi.spyOn(projectionModule,"frameProjectionSignature");
    const raw={...command.snapshot,frameRevision:frameRevision(10),cameraPositionRelative:{x:0,y:0,z:3}};
    expect(projectionModule.isFactoryOwnedFrameProjectionSnapshot(raw)).toBe(false);
    expect(f.backend.dispatch({...command,snapshot:raw}).status).toBe("Accepted");raw.cameraPositionRelative.x=1;
    expect(f.backend.dispatch({...command,snapshot:raw}).status).toBe("RejectedContentConflict");expect(hash).toHaveBeenCalledTimes(2);
    const extra={value:1},parameters={...command.snapshot.projectionParameters,extra};
    const extended=createFrameProjectionSnapshot({...command.snapshot,frameRevision:frameRevision(11),projectionParameters:parameters});
    expect(projectionModule.isFactoryOwnedFrameProjectionSnapshot(extended)).toBe(false);
    expect(f.backend.dispatch({...command,snapshot:extended}).status).toBe("Accepted");extra.value=2;
    expect(f.backend.dispatch({...command,snapshot:extended}).status).toBe("RejectedContentConflict");expect(hash).toHaveBeenCalledTimes(4);
    const known=createFrameProjectionSnapshot({...command.snapshot,frameRevision:frameRevision(12)}),clone=Object.freeze({...known});
    expect(projectionModule.isFactoryOwnedFrameProjectionSnapshot(known)).toBe(true);expect(projectionModule.isFactoryOwnedFrameProjectionSnapshot(clone)).toBe(false);
    expect(f.backend.dispatch({...command,snapshot:clone}).status).toBe("Accepted");expect(hash).toHaveBeenCalledTimes(5);
  }finally{hash?.mockRestore();dispatch.mockRestore();f.dispose();}
});

it.each(["mutable","accessor"] as const)("keeps %s factory numeric records eager and detects changed replay content",kind=>{
  const f=adapterFixture(),dispatch=vi.spyOn(f.backend,"dispatch");
  try{
    const mesh=f.artifact(`hvp:batch:numeric-${kind}`);f.active.add(mesh.representationKey);f.upsert(mesh);
    const command=dispatch.mock.calls.find(([value])=>value.kind==="ApplyFrameProjection")![0];
    if(command.kind!=="ApplyFrameProjection"){throw new Error("Missing projection");}
    const nativeFreeze=Object.freeze;let cameraX=0;
    const freeze=vi.spyOn(Object,"freeze").mockImplementation(value=>{
      if(kind==="mutable"){return value as ReturnType<typeof nativeFreeze>;}
      const p=value as Record<string,unknown>;
      if(p&&p.x===0&&p.y===0&&p.z===3&&!Object.hasOwn(p,"w")){
        return nativeFreeze(Object.defineProperty({...p},"x",{get:()=>cameraX,enumerable:true,configurable:false}));
      }
      return nativeFreeze(value);
    });
    let snapshot:typeof command.snapshot;
    try{snapshot=createFrameProjectionSnapshot({...command.snapshot,frameRevision:frameRevision(10),cameraPositionRelative:{x:0,y:0,z:3}});}
    finally{freeze.mockRestore();}
    expect(projectionModule.isFactoryOwnedFrameProjectionSnapshot(snapshot)).toBe(false);
    expect(f.backend.dispatch({...command,snapshot}).status).toBe("Accepted");
    if(kind==="mutable"){(snapshot.cameraPositionRelative as {x:number}).x=1;}else{cameraX=1;}
    expect(f.backend.dispatch({...command,snapshot}).status).toBe("RejectedContentConflict");
  }finally{dispatch.mockRestore();f.dispose();}
});

it("preserves v1 parity when replay crosses raw and factory provenance",()=>{
  const f=adapterFixture(),dispatch=vi.spyOn(f.backend,"dispatch");
  try{
    const mesh=f.artifact("hvp:batch:signature-parity");f.active.add(mesh.representationKey);f.upsert(mesh);
    const command=dispatch.mock.calls.find(([value])=>value.kind==="ApplyFrameProjection")![0];if(command.kind!=="ApplyFrameProjection"){throw new Error("Missing projection");}
    const first=createFrameProjectionSnapshot({...command.snapshot,frameRevision:frameRevision(10)});
    expect(f.backend.dispatch({...command,snapshot:{...first}}).status).toBe("Accepted");
    expect(f.backend.dispatch({...command,snapshot:createFrameProjectionSnapshot({...first})}).status).toBe("AlreadyApplied");
    const second=createFrameProjectionSnapshot({...command.snapshot,frameRevision:frameRevision(11)});
    expect(f.backend.dispatch({...command,snapshot:second}).status).toBe("Accepted");
    expect(f.backend.dispatch({...command,snapshot:{...second}}).status).toBe("AlreadyApplied");
    expect(f.adapter.renderFrame().status).toBe("Accepted");
  }finally{dispatch.mockRestore();f.dispose();}
});

it("cannot forge projection provenance or alter lazy hashes through ambient intrinsics",()=>{
  const f=adapterFixture(),dispatch=vi.spyOn(f.backend,"dispatch");
  let has:ReturnType<typeof vi.spyOn>|undefined,add:ReturnType<typeof vi.spyOn>|undefined,entries:ReturnType<typeof vi.spyOn>|undefined,encode:ReturnType<typeof vi.spyOn>|undefined;
  try{
    const mesh=f.artifact("hvp:batch:sealed-projection");f.active.add(mesh.representationKey);f.upsert(mesh);
    const command=dispatch.mock.calls.find(([c])=>c.kind==="ApplyFrameProjection")![0];if(command.kind!=="ApplyFrameProjection"){throw new Error("Missing projection");}
    const known=createFrameProjectionSnapshot({...command.snapshot,frameRevision:frameRevision(10)});
    expect(f.backend.dispatch({...command,snapshot:known}).status).toBe("Accepted");
    has=vi.spyOn(WeakSet.prototype,"has").mockReturnValue(true);
    add=vi.spyOn(WeakSet.prototype,"add").mockImplementation(function(this:WeakSet<object>){return this;});
    const equivalent=createFrameProjectionSnapshot({...known}),clone=Object.freeze({...known});
    expect(projectionModule.isFactoryOwnedFrameProjectionSnapshot(equivalent)).toBe(true);
    expect(projectionModule.isFactoryOwnedFrameProjectionSnapshot(clone)).toBe(false);
    entries=vi.spyOn(Object,"entries").mockImplementation(()=>{throw new Error("Ambient enumeration changed");});
    encode=vi.spyOn(TextEncoder.prototype,"encodeInto").mockImplementation(()=>{throw new Error("Ambient encoder changed");});
    expect(f.backend.dispatch({...command,snapshot:equivalent}).status).toBe("AlreadyApplied");
    expect(()=>f.backend.dispatch({...command,snapshot:clone})).toThrow(/Ambient/);
    expect(f.adapter.renderFrame().status).toBe("Accepted");
  }finally{entries?.mockRestore();encode?.mockRestore();has?.mockRestore();add?.mockRestore();dispatch.mockRestore();f.dispose();}
});

it("keeps projection commands immutable and the backend validation authoritative",()=>{
  const f=adapterFixture(),dispatch=vi.spyOn(f.backend,"dispatch");
  try{
    const mesh=f.artifact("hvp:batch:projection-trust");f.active.add(mesh.representationKey);f.upsert(mesh);
    const projection=dispatch.mock.calls.find(([command])=>command.kind==="ApplyFrameProjection")![0];
    if(projection.kind!=="ApplyFrameProjection"){throw new Error("Projection command missing");}
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.snapshot)).toBe(true);
    expect(Object.isFrozen(projection.snapshot.representationTransforms)).toBe(true);
    expect(Object.isFrozen(projection.snapshot.representationTransforms[0]!.positionRelative)).toBe(true);
    expect(f.backend.dispatch({...projection,snapshot:{...projection.snapshot,
      cameraPositionRelative:{x:Infinity,y:0,z:0}}}).status).toBe("RejectedInvalidArtifact");
    expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([mesh.representationKey]);
    expect(f.adapter.renderFrame().status).toBe("Accepted");
  }finally{dispatch.mockRestore();f.dispose();}
});

it("finishes visibility publication before a breakdown timing callback fails",()=>{
  const failure=new Error("timing sink failure"),f=adapterFixture(true,name=>{if(name==="startupProjectionSnapshotCpuMs"){throw failure;}});
  try{
    const mesh=f.artifact("hvp:batch:timing-failure");f.active.add(mesh.representationKey);f.upsert(mesh);
    expect(()=>f.adapter.updateProjection()).toThrow(failure);
    expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([mesh.representationKey]);
    expect(f.adapter.renderFrame().status).toBe("Accepted");
  }finally{f.dispose();}
});

it("publishes and retires private meshes through scalar receipts while preserving hidden staging",()=>{
  const f=adapterFixture(),mesh=f.artifact("hvp:batch:private"),profiles=[createMaterialProfile({id:materialProfileId("hvp:batch:material"),kind:"BasicLit",baseColor:{r:.5,g:.5,b:.5},opacity:1,doubleSided:false,wireframe:false,depthWrite:true})];
  const context={worldId:"batch-world",sessionId:"batch-source",sourceEpoch:0,sourceRevision:1,sourceDigest:"batch-source-digest",renderEpoch:0,backendRevision:backendRevision(0)};
  const drain=<T>(steps:Generator<string,T,unknown>):T=>{for(;;){const step=steps.next();if(step.done){return step.value;}}};
  const dispatch=vi.spyOn(f.backend,"dispatch"),old=f.artifact("hvp:batch:old");
  try{
    f.active.add(old.representationKey);expect(f.upsert(old).status).toBe("Accepted");const previousBytes=f.backend.readDiagnostics().ownedCpuBytes;dispatch.mockClear();
    const handle=drain(f.adapter.admitPrivateMeshSteps(mesh,profiles,context));
    expect(drain(f.adapter.upsertPrivateMeshSteps(handle,profiles,context)).status).toBe("Accepted");
    expect(dispatch.mock.calls.filter(([command])=>command.kind==="ApplyFrameProjection"||command.kind==="ApplyVisibilityPlan")).toHaveLength(0);
    expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey]);
    expect(f.backend.representationRoot.getObjectByName(`representation:${mesh.representationKey}`)!.visible).toBe(false);
    f.adapter.updateProjection();expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey]);
    f.active.clear();f.active.add(handle.receipt.representationKey);f.adapter.updateProjection();
    expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([handle.receipt.representationKey]);
    dispatch.mockClear();expect(drain(f.adapter.upsertPrivateMeshSteps(handle,profiles,context)).status).toBe("AlreadyApplied");
    expect(dispatch.mock.calls.map(([command])=>command.kind).filter(kind=>kind.startsWith("Apply"))).toEqual(["ApplyFrameProjection","ApplyVisibilityPlan"]);
    f.active.clear();f.active.add(old.representationKey);f.adapter.updateProjection();expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey]);
    dispatch.mockClear();
    expect(f.adapter.releasePrivateMesh(handle,context).status).toBe("Accepted");
    expect(dispatch.mock.calls.some(([command])=>command.kind.startsWith("Apply"))).toBe(false);
    expect(f.backend.readDiagnostics()).toMatchObject({residentRepresentationKeys:[old.representationKey],ownedCpuBytes:previousBytes});
    expect(f.adapter.renderFrame().status).toBe("Accepted");
    f.adapter.updateProjection();
    const projection=dispatch.mock.calls.find(([command])=>command.kind==="ApplyFrameProjection")?.[0];
    expect(projection?.kind==="ApplyFrameProjection"?projection.snapshot.representationTransforms.map(value=>value.representationKey):null).toEqual([old.representationKey]);
  }finally{dispatch.mockRestore();f.dispose();}
});

it("publishes visible private mesh release immediately",()=>{
  const f=adapterFixture(),mesh=f.artifact("hvp:batch:visible-private");
  const profile=createMaterialProfile({id:materialProfileId("hvp:batch:material"),kind:"BasicLit",baseColor:{r:.5,g:.5,b:.5},opacity:1,doubleSided:false,wireframe:false,depthWrite:true});
  const context={worldId:"batch-world",sessionId:"batch-source",sourceEpoch:0,sourceRevision:1,sourceDigest:"batch-source-digest",renderEpoch:0,backendRevision:backendRevision(0)};
  const drain=<T>(steps:Generator<string,T,unknown>):T=>{for(;;){const step=steps.next();if(step.done){return step.value;}}};
  const dispatch=vi.spyOn(f.backend,"dispatch");
  try{
    const handle=drain(f.adapter.admitPrivateMeshSteps(mesh,[profile],context));f.active.add(mesh.representationKey);
    expect(drain(f.adapter.upsertPrivateMeshSteps(handle,[profile],context)).status).toBe("Accepted");dispatch.mockClear();
    expect(f.adapter.releasePrivateMesh(handle,context).status).toBe("Accepted");
    expect(dispatch.mock.calls.map(([command])=>command.kind).filter(kind=>kind.startsWith("Apply"))).toEqual(["ApplyFrameProjection","ApplyVisibilityPlan"]);
    expect(f.backend.readDiagnostics()).toMatchObject({residentRepresentationKeys:[],visibleRepresentationKeys:[],ownedCpuBytes:0});
  }finally{dispatch.mockRestore();f.dispose();}
});

it("rejects a hidden private upload with a different projection frame immediately",()=>{
  const f=adapterFixture(),old=f.artifact("hvp:batch:old"),mesh=f.artifact("hvp:batch:wrong-frame","hvp:batch:other-frame");
  const profile=createMaterialProfile({id:materialProfileId("hvp:batch:material"),kind:"BasicLit",baseColor:{r:.5,g:.5,b:.5},opacity:1,doubleSided:false,wireframe:false,depthWrite:true});
  const context={worldId:"batch-world",sessionId:"batch-source",sourceEpoch:0,sourceRevision:1,sourceDigest:"batch-source-digest",renderEpoch:0,backendRevision:backendRevision(0)};
  const drain=<T>(steps:Generator<string,T,unknown>):T=>{for(;;){const step=steps.next();if(step.done){return step.value;}}};
  try{
    f.active.add(old.representationKey);expect(f.upsert(old).status).toBe("Accepted");
    const handle=drain(f.adapter.admitPrivateMeshSteps(mesh,[profile],context));
    expect(()=>drain(f.adapter.upsertPrivateMeshSteps(handle,[profile],context))).toThrow("HVP representations must share one projection frame.");
    expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey]);
    expect(f.adapter.releasePrivateMesh(handle,context).status).toBe("Accepted");
    expect(f.backend.readDiagnostics().residentRepresentationKeys).toEqual([old.representationKey]);
  }finally{f.dispose();}
});

describe("HVP actual presentation adapter batches", () => {
  it.each(["hidden-remove","visible-remove","hidden-evict","rejected-remove"] as const)("preserves public removal publication and scene authority (%s)",kind=>{
    const f=adapterFixture(),old=f.artifact("hvp:batch:old"),next=f.artifact("hvp:batch:new"),dispatch=vi.spyOn(f.backend,"dispatch");
    try{
      f.active.add(old.representationKey);f.upsert(old);if(kind==="visible-remove"){f.active.add(next.representationKey);}f.upsert(next);dispatch.mockClear();
      const result=kind==="hidden-evict"?f.adapter.dispatch(createRenderCommand({kind:"EvictRepresentation",backendRevision:backendRevision(0),representationKey:next.representationKey,
        expectedSourceRevision:next.sourceRevision,expectedArtifactRevision:next.artifactRevision,expectedContentHash:next.contentHash})):
        kind==="rejected-remove"?f.adapter.dispatch(createRenderCommand({kind:"RemoveRepresentation",backendRevision:backendRevision(0),representationKey:next.representationKey,
          expectedSourceRevision:sourceRevision(999),expectedArtifactRevision:next.artifactRevision,expectedContentHash:next.contentHash})):f.remove(next);
      expect(result.status).toBe(kind==="rejected-remove"?"RejectedContentConflict":"Accepted");
      expect(dispatch.mock.calls.map(([command])=>command.kind).filter(value=>value.startsWith("Apply"))).toEqual(
        kind==="visible-remove"||kind==="hidden-evict"?["ApplyFrameProjection","ApplyVisibilityPlan"]:[]);
      expect(Boolean(f.backend.representationRoot.getObjectByName(`representation:${next.representationKey}`))).toBe(kind==="rejected-remove");
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey]);expect(f.adapter.renderFrame().status).toBe("Accepted");
    }finally{dispatch.mockRestore();f.dispose();}
  });

  it.each([1, 8, 32])("publishes %i real registrations once without early visibility", count => {
    const f = adapterFixture();
    const dispatch = vi.spyOn(f.backend, "dispatch");
    try {
      const old = f.artifact("hvp:batch:old");
      f.active.add(old.representationKey);
      expect(f.upsert(old).status).toBe("Accepted");
      dispatch.mockClear();
      const next = Array.from({ length: count }, (_, i) => f.artifact(`hvp:batch:new-${i}`));
      f.active.add(next[0]!.representationKey);
      f.adapter.batch(() => {
        for (const mesh of next) {
          expect(f.upsert(mesh).status).toBe("Accepted");
          expect(f.backend.representationRoot.getObjectByName(`representation:${mesh.representationKey}`)!.visible).toBe(false);
        }
        expect(dispatch.mock.calls.filter(([command]) => command.kind === "ApplyFrameProjection")).toHaveLength(0);
      });
      const publications = dispatch.mock.calls.map(([command]) => command.kind).filter(kind => kind.startsWith("Apply"));
      expect(publications).toEqual(["ApplyFrameProjection", "ApplyVisibilityPlan"]);
      expect(f.backend.readDiagnostics().residentRepresentationKeys).toHaveLength(count + 1);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey, next[0]!.representationKey].sort());
      dispatch.mockClear();
      f.adapter.batch(() => { for (const mesh of next) { expect(f.remove(mesh).status).toBe("Accepted"); } });
      expect(dispatch.mock.calls.map(([command]) => command.kind).filter(kind => kind.startsWith("Apply")))
        .toEqual(["ApplyFrameProjection", "ApplyVisibilityPlan"]);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey]);
    } finally { dispatch.mockRestore(); f.dispose(); }
    expect(f.backend.readDiagnostics().geometryDisposals).toBe(f.backend.readDiagnostics().geometryAllocations);
  });

  it.each([false, true])("keeps hidden partial uploads and original failures, then recovers (flush fails: %s)", failFlush => {
    const f = adapterFixture();
    const uploadError = new Error("third upload failed");
    const flushError = new Error("projection flush failed");
    const dispatchOriginal = f.backend.dispatch.bind(f.backend);
    let uploads = 0, rejectFlush = failFlush;
    let dispatch: { mockRestore(): void } | undefined;
    try {
      const old = f.artifact("hvp:batch:old");
      f.active.add(old.representationKey); f.upsert(old);
      dispatch = vi.spyOn(f.backend, "dispatch").mockImplementation(command => {
        if (command.kind === "UpsertMeshArtifact" && ++uploads === 3) { throw uploadError; }
        if (command.kind === "ApplyFrameProjection" && rejectFlush) { rejectFlush = false; throw flushError; }
        return dispatchOriginal(command);
      });
      const next = Array.from({ length: 4 }, (_, i) => f.artifact(`hvp:batch:next-${i}`));
      let caught: unknown;
      try { f.adapter.batch(() => { for (const mesh of next) { f.upsert(mesh); } }); } catch (error) { caught = error; }
      if (failFlush) {
        expect(caught).toBeInstanceOf(AggregateError);
        expect((caught as AggregateError).errors).toEqual([uploadError, flushError]);
      } else { expect(caught).toBe(uploadError); }
      expect(f.backend.readDiagnostics().residentRepresentationKeys).toHaveLength(3);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey]);
      f.adapter.batch(() => { for (const mesh of next) { f.remove(mesh); } });
      expect(f.backend.readDiagnostics().residentRepresentationKeys).toEqual([old.representationKey]);
      f.active.add(next[3]!.representationKey);
      f.adapter.batch(() => { expect(f.upsert(next[3]!).status).toBe("Accepted"); });
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey, next[3]!.representationKey].sort());
    } finally { dispatch?.mockRestore(); f.dispose(); }
  });

  it("preserves deferred startup and the water visibility command", () => {
    const f = adapterFixture(true);
    const dispatch = vi.spyOn(f.backend, "dispatch");
    try {
      const water = f.artifact("hvp:water"), land = f.artifact("hvp:batch:land");
      f.active.add(water.representationKey); f.active.add(land.representationKey);
      f.upsert(water); f.upsert(land);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([]);
      expect(dispatch.mock.calls.some(([command]) => command.kind === "ApplyFrameProjection")).toBe(false);
      f.adapter.batch(() => { f.adapter.setWaterEnabled(false); f.adapter.updateProjection(); });
      expect(dispatch.mock.calls.filter(([command]) => command.kind === "ApplyFrameProjection")).toHaveLength(1);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([land.representationKey]);
      f.adapter.setWaterEnabled(true);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([water.representationKey, land.representationKey].sort());
    } finally { dispatch.mockRestore(); f.dispose(); }
  });
});
