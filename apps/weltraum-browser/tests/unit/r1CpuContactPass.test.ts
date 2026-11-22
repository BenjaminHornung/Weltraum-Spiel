import { describe, expect, it } from "vitest";
import { createFrameProjectionSnapshot } from "../../src/presentation";
import { ThreeRenderBackend } from "../../src/render/three/backend/threeRenderBackend";
import { backendRevision, frameId, frameRevision } from "../../src/presentation/ids";
import { CpuContactPass, type Ray, type RaySceneBinding, type Volume } from "../../src/ray/cpuContactPass";
import type { ThreeSubmittedFrameMetadata } from "../../src/render/three/backend/threeRenderBackend";
import nearTie from "./fixtures/r1Contact/NEAR_TIE_NORMAL.json";
import partial from "./fixtures/r1Contact/UNKNOWN_HIT.json";
import before from "./fixtures/r1Contact/fragment.json";
import after from "./fixtures/r1Contact/fragment-rotated.json";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function setup(volumes: Volume[]) {
  const camera = { viewMatrix: identity, projectionMatrix: identity, cameraWorldMatrix: identity,
    position: [0, 0, 0], orientation: [0, 0, 0, 1], near: 0.01, far: 100, verticalFovDegrees: 60,
    aspect: 1, drawingBuffer: { widthPx: 32, heightPx: 32 } };
  const frame: ThreeSubmittedFrameMetadata = { kind: "SubmittedCameraMetadataOnly", metadataGeneration: 1,
    renderFrameId: 1, backendRevision: backendRevision(0), coordinateFrameId: frameId("world"),
    projectionRevision: frameRevision(1), current: camera, previous: null, resetReason: null,
    attachmentPublication: "UNAVAILABLE", originEpoch: "UNAVAILABLE" };
  const state = { frame, scene: { coordinateFrameId: "world", projectionRevision: 1,
    owners: volumes.map(v => v.binding) } as RaySceneBinding };
  const pass = new CpuContactPass({readSubmittedFrameMetadata: () => state.frame,
    isSubmittedFrameCurrent: candidate => candidate === state.frame}, () => state.scene);
  pass.setEnabled(true);
  return { pass, frame, state };
}

describe("revision-bound CPU ray contact pass", () => {
  it("retains both exact R12 near-tie cells, materials and normals", async () => {
    const v = nearTie.volume as Volume, { pass, frame } = setup([v]);
    expect(await pass.refresh([v])).toBe(true);
    for (const [i, ray] of (nearTie.rays as Ray[]).entries()) {
      expect(pass.sample(frame, ray)).toEqual({kind:"Contact", occluded:true, result:nearTie.oracle[i]});
    }
    pass.dispose();
  });

  it("returns Unknown and exhausted budgets to raster while retaining their source tuples", async () => {
    const v = partial.volume as Volume, { pass, frame } = setup([v]);
    await pass.refresh([v]);
    const [unknown, hit] = partial.rays as Ray[];
    expect(pass.sample(frame, unknown)).toEqual({kind:"RasterFallback",reason:"Unknown",result:partial.oracle[0]});
    expect(pass.sample(frame, hit)).toEqual({kind:"Contact",occluded:true,result:partial.oracle[1]});
    expect(pass.sample(frame,{...hit,maxSteps:0})).toMatchObject({kind:"RasterFallback",reason:"BudgetExceeded",
      result:{kind:"BudgetExceeded",cell:[1,0,0]}});
    pass.dispose();
  });

  it("rejects stale owner revisions, a copied frame and an incompatible projection revision", async () => {
    const v = nearTie.volume as Volume, { pass, state, frame } = setup([v]), ray = nearTie.rays[0] as Ray;
    await pass.refresh([v]);
    expect(pass.sample({...frame},ray)).toEqual({kind:"RasterFallback",reason:"Stale"});
    state.scene={...state.scene,projectionRevision:2};
    expect(pass.sample(frame,ray)).toEqual({kind:"RasterFallback",reason:"Stale"});
    state.scene={...state.scene,projectionRevision:1,owners:[{...v.binding,sourceRevision:1}]};
    expect(pass.sample(frame,ray)).toEqual({kind:"RasterFallback",reason:"Stale"});
    expect(await pass.refresh([v])).toBe(false);
    pass.dispose();
  });

  it("adopts a rotated, translated fragment with its stable cell identity and withdraws old light immediately", async () => {
    const old = before as Volume, moved = after as Volume, { pass, state, frame } = setup([old]);
    const cast = (origin: Ray["origin"], direction: Ray["direction"]): Ray => ({id:"fragment",origin,direction,maxDistance:2,maxSteps:16});
    const base = old.translation;
    const initialRay=cast([base[0]-.5,base[1]+.0625,base[2]+.0625],[1,0,0]);
    await pass.refresh([old]);
    expect(pass.sample(frame,initialRay)).toMatchObject({kind:"Contact",result:{kind:"Hit",cellId:old.cellIds[0],normal:[-1,0,0]}});
    state.scene={...state.scene,owners:[moved.binding]};
    expect(pass.sample(frame,initialRay)).toEqual({kind:"RasterFallback",reason:"Stale"});
    const next=pass.refresh([moved]);
    expect(pass.sample(frame,initialRay)).toEqual({kind:"RasterFallback",reason:"Unavailable"});
    expect(await next).toBe(true);
    const p=moved.translation;
    const movedRay=cast([p[0]+.0625,p[1]+.0625,p[2]+.5],[0,0,-1]);
    expect(pass.sample(frame,movedRay)).toMatchObject({kind:"Contact",occluded:true,
      result:{distance:.5,normal:[0,0,1],owner:moved.binding.owner,cellId:old.cellIds[0],transformGeneration:1}});
    pass.dispose();
  });

  it("consumes the actual G1 submitted-frame owner and withdraws contact after its next submit", async () => {
    const backend = new ThreeRenderBackend({canvas: {} as HTMLCanvasElement, lightingMode: "None",
      rendererFactory: () => ({setPixelRatio() {}, setSize() {}, render: () => true, dispose() {}})});
    const revision = backendRevision(0);
    expect(backend.dispatch({kind:"InitializeBackend",backendRevision:revision}).status).toBe("Accepted");
    const snapshot = createFrameProjectionSnapshot({frameId:frameId("world"),frameRevision:frameRevision(1),
      cameraPositionRelative:{x:0,y:0,z:1},cameraOrientation:{x:0,y:0,z:0,w:1},
      projectionParameters:{kind:"Perspective",verticalFovDegrees:60,aspect:1,near:.01,far:100},representationTransforms:[]});
    expect(backend.dispatch({kind:"ApplyFrameProjection",backendRevision:revision,snapshot}).status).toBe("Accepted");
    backend.renderFrame();
    const frame=backend.readSubmittedFrameMetadata();
    expect(frame?.coordinateFrameId).toBe("world");
    const v=nearTie.volume as Volume, ray=nearTie.rays[0] as Ray;
    const pass=new CpuContactPass(backend,()=>({coordinateFrameId:"world",projectionRevision:1,owners:[v.binding]}));
    pass.setEnabled(true);
    expect(await pass.refresh([v])).toBe(true);
    expect(pass.sample(frame,ray)).toEqual({kind:"Contact",occluded:true,result:nearTie.oracle[0]});
    backend.renderFrame();
    expect(pass.sample(frame,ray)).toEqual({kind:"RasterFallback",reason:"Stale"});
    expect(pass.sample(backend.readSubmittedFrameMetadata(),ray)).toMatchObject({kind:"Contact",occluded:true});
    pass.dispose();
    backend.dispatch({kind:"DisposeBackend",backendRevision:revision});
  });

  it("uses all current owners, preserves the nearer Unknown, and rejects duplicate occupied cells", async () => {
    const v=nearTie.volume as Volume, other=structuredClone(partial.volume) as Volume;
    other.binding.owner="other";
    const {pass,frame,state}=setup([v,other]);
    expect(await pass.refresh([v,other])).toBe(true);
    expect(pass.sample(frame,partial.rays[0] as Ray)).toMatchObject({kind:"RasterFallback",reason:"Unknown",
      result:{owner:"other",distance:0}});
    const duplicate=structuredClone(v);
    duplicate.binding.owner="duplicate";
    state.scene={...state.scene,owners:[v.binding,duplicate.binding]};
    await expect(pass.refresh([v,duplicate])).rejects.toThrow(/duplicate current ownership/);
    expect(pass.sample(frame,nearTie.rays[0] as Ray)).toEqual({kind:"RasterFallback",reason:"Unavailable"});
    state.scene={...state.scene,owners:[]};
    expect(await pass.refresh([])).toBe(false);
    pass.dispose();
  });

  it("withdraws late preparation, releases on disable, and permits no adoption after dispose", async () => {
    const v=nearTie.volume as Volume, {pass, frame}=setup([v]), ray=nearTie.rays[0] as Ray;
    const a=pass.refresh([v]), b=pass.refresh([v]);
    expect(await a).toBe(false);
    expect(await b).toBe(true);
    pass.setEnabled(false);
    expect(pass.sample(frame,ray)).toEqual({kind:"RasterFallback",reason:"Disabled"});
    pass.setEnabled(true);
    expect(pass.sample(frame,ray)).toEqual({kind:"RasterFallback",reason:"Unavailable"});
    const pending=pass.refresh([v]);
    pass.dispose(); pass.dispose(); pass.setEnabled(true);
    expect(await pending).toBe(false);
    expect(await pass.refresh([v])).toBe(false);
    expect(pass.sample(frame,ray)).toEqual({kind:"RasterFallback",reason:"Disabled"});
  });
});
