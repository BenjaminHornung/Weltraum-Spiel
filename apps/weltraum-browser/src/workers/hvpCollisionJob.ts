import { meshCollisionInput, type HvpCollisionInput, type HvpCollisionSector } from "../hestia-prototype/physics/terrainColliders";
import { byteCount, contentRevision, type ContentRevision } from "./ids";
import { fnv1aBytes, validateTransferableBundle, type TransferableBufferBundle, type WorkerJobRequest, type WorkerJobResult } from "./protocol";

export const HVP_COLLISION_JOB = "BuildHvpCollisionSector";
export const HVP_COLLISION_ALGORITHM = 1;
export const HVP_COLLISION_MAX_OUTPUT = 4 * 1024 * 1024;
export type HvpCollisionPayload = Omit<HvpCollisionInput, "slots"> & { readonly outputRevision: ContentRevision };

export const validateHvpCollisionPayload = (value: unknown): HvpCollisionPayload => {
  const p = value as HvpCollisionPayload | null;
  if (p === null || typeof p !== "object" || ![p.sizeX, p.sizeY, p.sizeZ].every(v => Number.isSafeInteger(v) && v > 0)
    || p.sizeX > 32 || p.sizeZ > 32 || p.sizeY > 256 || p.originMeters === undefined
    || ![p.originMeters.x, p.originMeters.y, p.originMeters.z].every(v => Number.isFinite(v) && Number.isSafeInteger(v * 8))) {
    throw new RangeError("Invalid HVP collision payload");
  }
  contentRevision(p.outputRevision);
  return p;
};

export const validateHvpCollisionRequest = (request: WorkerJobRequest, bundle: TransferableBufferBundle): HvpCollisionPayload => {
  const p = validateHvpCollisionPayload(request.payload);
  const bytes = (p.sizeX + 2) * (p.sizeY + 2) * (p.sizeZ + 2);
  if (request.algorithmVersion !== HVP_COLLISION_ALGORITHM || request.inputRevision !== p.outputRevision
    || request.estimatedOutputBytes !== HVP_COLLISION_MAX_OUTPUT || bundle.byteLength !== bytes || bundle.buffers.length !== 1
    || bundle.views.length !== 1 || bundle.views[0]!.kind !== "Uint8Array" || bundle.views[0]!.name !== "slots"
    || bundle.views[0]!.bufferIndex !== 0 || bundle.views[0]!.byteOffset !== 0 || bundle.views[0]!.elementCount !== bytes
    || request.sourceInputDigest !== fnv1aBytes(bundle.buffers)) {
    throw new RangeError("HVP collision input binding mismatch");
  }
  return p;
};

export const decodeHvpCollisionOutput = (source: TransferableBufferBundle, p: HvpCollisionPayload): HvpCollisionSector => {
  const b = validateTransferableBundle(source);
  if (b.byteLength > HVP_COLLISION_MAX_OUTPUT || b.buffers.length !== 2 || b.views.length !== 2
    || b.ownership !== "WorkerToConsumer" || b.revision !== p.outputRevision) {
    throw new RangeError("Invalid HVP collision output");
  }
  for (const [i, name, kind] of [[0, "vertices", "Float32Array"], [1, "indices", "Uint32Array"]] as const) {
    const v = b.views[i]!;
    if (v.bufferIndex !== i || v.name !== name || v.kind !== kind || v.byteOffset !== 0 || v.elementCount * 4 !== b.buffers[i]!.byteLength) {
      throw new RangeError("Invalid HVP collision output layout");
    }
  }
  const vertices = new Float32Array(b.buffers[0]!);
  const indices = new Uint32Array(b.buffers[1]!);
  const min = [p.originMeters.x, p.originMeters.y, p.originMeters.z];
  const max = [p.sizeX, p.sizeY, p.sizeZ].map((n, i) => min[i]! + n * 0.125);
  if (vertices.length % 3 !== 0 || indices.length % 3 !== 0
    || vertices.some((v, i) => !Number.isFinite(v) || !Number.isInteger(v * 8) || v < min[i % 3]! || v > max[i % 3]!)
    || indices.some(i => i >= vertices.length / 3)) {
    throw new RangeError("Invalid HVP collision output geometry");
  }
  return { vertices, indices };
};

export const executeHvpCollisionJob = (request: WorkerJobRequest, source: TransferableBufferBundle) => {
  const input = validateTransferableBundle(source);
  const payload = validateHvpCollisionRequest(request, input);
  const slots = new Uint8Array(input.buffers[0]!);
  if (slots.some(v => v > 1)) { throw new RangeError("Collision occupancy must be binary"); }
  const mesh = meshCollisionInput({ ...payload, slots });
  const buffers = [mesh.vertices.buffer as ArrayBuffer, mesh.indices.buffer as ArrayBuffer];
  const output: TransferableBufferBundle = { ownership: "WorkerToConsumer", revision: contentRevision(payload.outputRevision), buffers,
    byteLength: byteCount(buffers.reduce((sum, b) => sum + b.byteLength, 0)), contentHash: fnv1aBytes(buffers), views: [
      { name: "vertices", bufferIndex: 0, kind: "Float32Array", byteOffset: 0, elementCount: mesh.vertices.length },
      { name: "indices", bufferIndex: 1, kind: "Uint32Array", byteOffset: 0, elementCount: mesh.indices.length }
    ] };
  decodeHvpCollisionOutput(output, payload);
  const result: WorkerJobResult = { jobId: request.jobId, targetKey: request.targetKey, planningEpoch: request.planningEpoch,
    workerEpoch: request.workerEpoch, inputRevision: request.inputRevision, sourceInputDigest: request.sourceInputDigest,
    outputRevision: contentRevision(payload.outputRevision), algorithmVersion: request.algorithmVersion,
    outputBytes: output.byteLength, contentHash: output.contentHash };
  return { result, bundle: output };
};
