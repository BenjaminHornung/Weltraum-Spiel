import { describe, expect, it } from "vitest";
import { CpuContactPass, type Ray, type Volume } from "../../src/ray/cpuContactPass";
import { composeContactPixels, type LinearContactTile, type SurfaceContactRay } from "../../src/ray/composeContactPixels";
import type { ThreeSubmittedFrameMetadata } from "../../src/render/three/backend/threeRenderBackend";
import unknownHit from "./fixtures/r1Contact/UNKNOWN_HIT.json";

async function setup() {
  const v = structuredClone(unknownHit.volume) as Volume;
  const [unknown, hit] = unknownHit.rays as Ray[];
  const frame = { coordinateFrameId: "world", projectionRevision: 1 } as ThreeSubmittedFrameMetadata;
  const current = { frame };
  const pass = new CpuContactPass({readSubmittedFrameMetadata: () => current.frame,
    isSubmittedFrameCurrent: candidate => candidate === current.frame},
    () => ({ coordinateFrameId:"world", projectionRevision:1, owners:[v.binding] }));
  pass.setEnabled(true);
  await pass.refresh([v]);
  const tile: LinearContactTile = { frame, width:2,height:1,
    raster:Float32Array.of(3,2,1,.25,4,3,2,.5), direct:Float32Array.of(1,.5,.25,1,1,.5,.25,1),
    indirect:Float32Array.of(1.5,1.25,.625,1,2.5,2.25,1.625,1), emissive:Float32Array.of(.5,.25,.125,1,.5,.25,.125,1) };
  const opaque = (pixel:number,ray:Ray): SurfaceContactRay => ({pixel,role:"opaque",ray});
  return { pass, current, tile, hit, unknown, opaque };
}

describe("RT03 linear contact compositing",()=>{
  it("attenuates only the indirect component of the hit and copies unknown RGBA bytes exactly",async()=>{
    const {pass,tile,hit,unknown,opaque} = await setup();
    try {
      const result=composeContactPixels(pass,tile,[opaque(0,unknown),opaque(1,hit)]);
      expect([...result]).toEqual([3,2,1,.25,1.5,.75,.375,.5]);
      expect([...tile.raster]).toEqual([3,2,1,.25,4,3,2,.5]);
      expect(result).not.toBe(tile.raster);
    } finally {pass.dispose();}
  });
  it("keeps the primary image for budget, transparency, miss, disable and stale frames",async()=>{
    const {pass,current,tile,hit,opaque}=await setup();
    try {
      expect(composeContactPixels(pass,tile,[opaque(0,{...hit,maxSteps:0})])).toBe(tile.raster);
      expect(composeContactPixels(pass,tile,[{...opaque(0,hit),role:"water"}])).toBe(tile.raster);
      expect(composeContactPixels(pass,tile,[opaque(0,{...hit,origin:[50,50,50]})])).toBe(tile.raster);
      current.frame={...tile.frame};
      expect(composeContactPixels(pass,tile,[opaque(0,hit)])).toBe(tile.raster);
      pass.setEnabled(false);
      expect(composeContactPixels(pass,tile,[opaque(0,hit)])).toBe(tile.raster);
    } finally {pass.dispose();}
  });
  it("drops staged light edits if the source changes between two samples",async()=>{
    const {pass,tile,hit,opaque}=await setup();
    try {
      const first=opaque(0,hit);
      const invalidating = {pixel:1,role:"opaque" as const,get ray(){pass.setEnabled(false);return hit;}};
      expect(composeContactPixels(pass,tile,[first,invalidating])).toBe(tile.raster);
    } finally {pass.dispose();}
  });
  it("rejects malformed or duplicate pixel addresses and preserves caller buffers",async()=>{
    const {pass,tile,hit,opaque}=await setup();
    try {
      expect(()=>composeContactPixels(pass,tile,[opaque(0,hit),opaque(0,hit)])).toThrow(/duplicate/);
      expect(()=>composeContactPixels(pass,{...tile,direct:new Float32Array(3)},[opaque(0,hit)])).toThrow(/tile/);
      expect(tile.raster[0]).toBe(3);
    } finally {pass.dispose();}
  });
});
