import {expect, it} from "vitest";
import {buildHvpLiveRenderChunkSteps} from "../../src/hestia-prototype/terrain/liveRenderDelta";
import {buildHvpChunkInput, buildHvpChunkInputSteps, hvpDirtyChunks} from "../../src/hestia-prototype/terrain/terrainChunkInput";
import {createHvpTerrainRoot, createHvpPrivateTerrainRoot, prepareHvpPrivateTerrainCut, type HvpTerrainSnapshot} from "../../src/hestia-prototype/terrain/cutPlan";
import {analyzeHvpTerrainSupport} from "../../src/hestia-prototype/terrain/supportPlan";
import {prepareHvpTerrainTransfer} from "../../src/hestia-prototype/terrain/terrainTransfer";
import {materializeHvpCoastSource, prepareHvpCoastSource, prepareHvpOwnedCoastSource} from "../../src/hvp/hvpCoastSource";
import {HVP_CHUNK_JOB, HVP_CHUNK_MAX_OUTPUT, decodeHvpChunkOutput, executeHvpChunkJob, hvpChunkInputDigest} from "../../src/workers/hvpChunkJob";
import {algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId,
  workerJobKind, workerTargetKey} from "../../src/workers/ids";
import type {TransferableBufferBundle, WorkerJobRequest} from "../../src/workers/protocol";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";

function drain<T>(steps: Generator<string, T, unknown>) {
  for (;;) { const step = steps.next(); if (step.done) return step.value; }
}
function compare(source: HvpTerrainSnapshot, id: number, halo: HvpTerrainSnapshot["readSlot"], neighbor?: HvpTerrainSnapshot) {
  const {slots, payload} = buildHvpChunkInput(source, id, halo, "live-render-oracle", source.sessionId, neighbor);
  const revision = contentRevision(source.revision), buffers = [slots.buffer as ArrayBuffer];
  const bundle: TransferableBufferBundle = {buffers, revision, ownership: "SenderToWorker", byteLength: byteCount(slots.length),
    views: [{name: "slots", kind: "Uint8Array", bufferIndex: 0, byteOffset: 0, elementCount: slots.length}]};
  const request: WorkerJobRequest = {jobId: workerJobId("render-oracle"), targetKey: workerTargetKey(`render-${id}`),
    jobKind: workerJobKind(HVP_CHUNK_JOB), workerEpoch: workerEpoch(0), planningEpoch: planningEpoch(0), inputRevision: revision,
    sourceInputDigest: hvpChunkInputDigest(payload, buffers), algorithmVersion: algorithmVersion(1), priority: "Urgent",
    deadline: jobDeadline(0), estimatedInputBytes: bundle.byteLength, estimatedOutputBytes: byteCount(HVP_CHUNK_MAX_OUTPUT), payload};
  const started = performance.now();
  const reference = decodeHvpChunkOutput(executeHvpChunkJob(request, bundle).bundle, payload);
  const referenceMs = performance.now() - started;
  const ledger = createStructuralOwnerLedger(0, 96 * 1024 * 1024, 128);
  try {
    const candidateStart = performance.now();
    const candidate = drain(buildHvpLiveRenderChunkSteps(slots, payload,
      reference.collision.vertices.byteLength + reference.collision.indices.byteLength, ledger.reserve));
    const renderMs = performance.now() - candidateStart;
    for (const channel of ["positions", "normals", "colors", "indices"] as const) {
      const actual = candidate[channel]!, expected = reference.render[channel]!;
      expect(actual.constructor).toBe(expected.constructor);
      expect(Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength)
        .equals(Buffer.from(expected.buffer, expected.byteOffset, expected.byteLength)), channel).toBe(true);
    }
    const {positions, normals, colors, indices, ...metadata} = candidate;
    expect({...metadata, positions, normals, colors, indices}).toEqual({...reference.render, positions, normals, colors, indices});
    return {id, faces: candidate.faceCount, referenceMs, renderMs};
  } finally { ledger.release(); }
}
const source = (read: HvpTerrainSnapshot["readSlot"]): HvpTerrainSnapshot => ({readSlot: read, sizeX: 256, sizeY: 128,
  sizeZ: 256, cellMeters: .125, originMeters: {x: -16, y: -8, z: -16}, sessionId: "live-render-suite", epoch: 0,
  revision: 1, sourceDigest: "12345678", baseDigest: "87654321", overlayBytes: 0, copyLeaf: () => new Uint8Array(4096), leafRevision: () => 0});

it.each(["empty", "solid", "caves", "seam", "irregular"])("matches full worker bytes for %s", fixture => {
  const read = (x: number, y: number, z: number) => {
    if (fixture === "empty") return 0;
    if (fixture === "solid") return 2;
    if (fixture === "seam") return ((y + 2 * z) % 11 < 6 && x < 32) || (x >= 32 && y % 3 === 0) ? 4 : 0;
    if (fixture === "irregular") return ((x * x + 3 * y * y + z * z + 17 * z) % 29) < 2 ? 1 + (x + y + z + 128) % 4 : 0;
    if (x > 4 && x < 26 && z > 3 && z < 27 && ((y > 4 && y < 9) || (y > 14 && y < 19))) return 0;
    return y < 28 && x >= 0 && z >= 0 ? 1 + (x + (z >> 1) + (y >> 1)) % 4 : 0;
  };
  const terrain = source(read);
  compare(terrain, 0, read);
  if (fixture === "seam") {
    compare(terrain, 1, read);
    const east = {...terrain, originMeters: {x: 16, y: -8, z: -16}, sessionId: "live-render-east"};
    compare(terrain, 7, (x, y, z) => x >= 256 ? east.readSlot(x - 256, y, z) : 0, east);
  }
}, 30_000);

it("renders the committed rock arm after direct removal and detached-body transfer", () => {
  const root = createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()), "render-rock", 1), before = root.read();
  const cut = root.prepare({sessionId: before.sessionId, epoch: before.epoch, revision: before.revision, sourceDigest: before.sourceDigest,
    commandId: "rock-cut", toolPolicy: "hvp-plasma-v1", shape: {kind: "Box", min: [176, 78, 76], max: [180, 82, 80]}});
  const transfer = prepareHvpTerrainTransfer(root, analyzeHvpTerrainSupport(cut));
  expect(transfer.transferredCells).toBe(384);
  expect(transfer.directRemovedCells).toBe(64);
  const runs = hvpDirtyChunks(transfer.plan).map(id => compare(transfer.plan.after, id, () => 0));
  console.info("Rock arm chunk render outputs", JSON.stringify(runs));
}, 30_000);

it("packs private changed leaves, unchanged pages and exterior halos identically to scalar reads", () => {
  const root = createHvpPrivateTerrainRoot(prepareHvpOwnedCoastSource(materializeHvpCoastSource()), "pack-rock", 1);
  const before=root.read();
  const cut=prepareHvpPrivateTerrainCut(root,{sessionId:before.sessionId,epoch:before.epoch,revision:before.revision,
    sourceDigest:before.sourceDigest,commandId:"pack",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[176,78,76],max:[180,82,80]}});
  for(const id of [...hvpDirtyChunks(cut),0]){
    const halo=(x:number,y:number,z:number)=>Math.abs(x+y+z)%5;
    const base=buildHvpChunkInput(cut.after,id,halo);
    const steps=buildHvpChunkInputSteps(cut.after,id,halo,"explicit-halo-v1",()=>{},cut.after.sessionId,undefined,true);
    let count=0;
    for(;;){
      const next=steps.next();
      if(next.done){
        expect(Buffer.from(next.value.slots).equals(Buffer.from(base.slots))).toBe(true);
        expect(next.value.payload).toEqual(base.payload);
        break;
      }
      if(next.value==="chunkCoreLeaf")count++;
    }
    expect(count).toBe(8);
  }
},30_000);
