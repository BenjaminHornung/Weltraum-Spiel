import { ingestHvpStructuralCells, type HvpStructuralCell } from "../../../src/hestia-prototype/terrain/structuralIngest";
import { prepareHvpLocalBodyCut } from "../../../src/hestia-prototype/physics/bodyCutPlan";
import type { HvpMovingCutPreparation } from "../../../src/hestia-prototype/physics/bodyCutSession";
import { HVP_BODY_CUT_ALGORITHM, HVP_BODY_CUT_JOB, HVP_BODY_CUT_MAX_OUTPUT, executeHvpBodyCutJob, hvpBodyCutInputDigest } from "../../../src/workers/hvpBodyCutJob";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId, workerJobKind, workerTargetKey } from "../../../src/workers/ids";
import { fnv1aBytes, type TransferableBufferBundle, type WorkerJobRequest } from "../../../src/workers/protocol";

export const p05Materials = [
  { materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "wood", destructible: true, tags: null },
  { materialId: 2, densityKgPerCubicMeter: 1024, structuralClass: "stone", destructible: true, tags: null }
];

// Small authored input, not a historical oracle or evidence copied from another package.
export const createP05BodyFixture = () => {
  const cells: HvpStructuralCell[] = Array.from({ length: 5 }, (_, index) => ({
    x: index - 1, y: -1, z: -1, materialId: index === 2 ? 2 : 1
  }));
  const source = ingestHvpStructuralCells("p05-source", cells, p05Materials);
  const preparation: HvpMovingCutPreparation = {
    cells, issuedTick: 0,
    payload: { sessionId: "p05-session", epoch: 0, commandId: "p05-cut", ownerId: "p05-parent",
      sourceId: source.objectId, sourceDigest: source.contentHash, revision: source.objectRevision,
      cellCount: 5, massKg: 6, cell: [-1, -1, -1], edge: 1, materials: source.materials }
  };
  // Expectation comes from the immutable owner source BEFORE the compiler packet exists.
  const local = prepareHvpLocalBodyCut(source, preparation.payload.cell, preparation.payload.commandId, 1);
  return { source, preparation, local, ...buildP05BodyPacket(preparation) };
};

export const buildP05BodyPacket = (preparation: HvpMovingCutPreparation) => {
  const p = preparation.payload;
  const raw = new Int32Array(preparation.cells.flatMap(cell => [cell.x, cell.y, cell.z, cell.materialId]));
  const input: TransferableBufferBundle = { buffers: [raw.buffer], ownership: "SenderToWorker",
    revision: contentRevision(p.revision), byteLength: byteCount(raw.byteLength),
    views: [{ name: "cells", kind: "Int32Array", bufferIndex: 0, byteOffset: 0, elementCount: raw.length }] };
  const request: WorkerJobRequest = { jobId: workerJobId("p05-job"), jobKind: workerJobKind(HVP_BODY_CUT_JOB),
    targetKey: workerTargetKey(p.ownerId), workerEpoch: workerEpoch(0), planningEpoch: planningEpoch(0),
    inputRevision: contentRevision(p.revision), sourceInputDigest: hvpBodyCutInputDigest(p, input.buffers),
    algorithmVersion: algorithmVersion(HVP_BODY_CUT_ALGORITHM), priority: "Urgent", deadline: jobDeadline(1),
    estimatedInputBytes: input.byteLength, estimatedOutputBytes: byteCount(HVP_BODY_CUT_MAX_OUTPUT), payload: p };
  return { request, ...executeHvpBodyCutJob(request, input) };
};

export const rehashP05Packet = (packet: TransferableBufferBundle, buffers: ArrayBuffer[]): TransferableBufferBundle => ({
  ...packet, buffers, contentHash: fnv1aBytes(buffers),
  byteLength: byteCount(buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0)),
  views: packet.views.map((view, index) => ({ ...view,
    elementCount: buffers[index]!.byteLength / (view.kind === "Uint8Array" ? 1 : 4) }))
});

export const drainP05Steps = <T>(steps: Generator<string, T, unknown>): T => {
  for (;;) {
    const step = steps.next();
    if (step.done) {
      return step.value;
    }
  }
};
