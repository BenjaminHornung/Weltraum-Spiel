import { fnv1aHash } from "../core/hash";
import { meshHvpOwnedBodyCellsSteps, verifyHvpOwnedBodyMeshSteps } from "../hestia-prototype/presentation/bodyMeshAdmission";
import type { HvpBodyChildProjection, HvpBodyPlanHost } from "../hestia-prototype/physics/bodyCutSession";
import type { HvpBodyCutPlan } from "../hestia-prototype/physics/bodyCut";
import type { HvpStructuralCell } from "../hestia-prototype/terrain/structuralIngest";
import { requireStructuralHash } from "../voxel/structural";
import { ADAPTIVE_BRICK_ESTIMATED_BYTES } from "../voxel/adaptive";
import { requireExactKeys, requirePlainRecord } from "../voxel/adaptive/validation";
import type { HvpCompactMesh } from "../hvp/hvpCoastMesher";
import { byteCount, contentRevision } from "./ids";
import { fnv1aBytes, validateTransferableBundle, type TransferableBufferBundle, type WorkerJobRequest, type WorkerJobResult } from "./protocol";
import { checkedEnd, encodeHvpBodyCutWire, HVP_BODY_CUT_MAX_OUTPUT, readHvpBodyCutWire,fnv1aBytesSteps } from "./hvpBodyCutWire";
import type { HvpBodyCutProducts } from "./hvpBodyCutJob";
import {structuralFreezeArraySteps,type StructuralOwnedReserve} from "../voxel/structural/validation";

/** Mesh only the owner's finished child-cell projection; this job issues no native authority. */
export const HVP_BODY_MESH_JOB = "BuildHvpChildBodyMesh";
export const HVP_BODY_MESH_ALGORITHM = 1;
export const HVP_BODY_MESH_MAX_OUTPUT = HVP_BODY_CUT_MAX_OUTPUT;
const MAX_PARTS = 32;
const MAX_CELLS = 32_768;
const MAX_REMOVED_CELLS = 512;
const MAX_CELL_COORDINATE = 1_000_000;
const MESH_MATERIAL_MIN = 1;
const MESH_MATERIAL_MAX = 65_535;
const identifier = /^[A-Za-z0-9:._-]{1,128}$/;
const arrayBufferByteLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;
const arrayBufferResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;

export interface HvpBodyMeshPartPayload {
  readonly ownerId: string;
  readonly sourceDigest: string;
  readonly center: Readonly<{ x: number; y: number; z: number }>;
  readonly massKg: number;
  readonly sourceBytes: number;
  readonly cellOffset: number;
  readonly cellCount: number;
}

export interface HvpBodyMeshPayload {
  readonly sessionId: string;
  readonly epoch: number;
  readonly commandId: string;
  readonly ownerId: string;
  readonly sourceId: string;
  readonly sourceDigest: string;
  readonly revision: number;
  readonly issuedTick: number;
  readonly removedCells: number;
  readonly removedMassKg: number;
  readonly parts: readonly HvpBodyMeshPartPayload[];
}

type PreparedProjection = Readonly<{ payload: HvpBodyMeshPayload; cells: readonly (readonly HvpStructuralCell[])[] }>;

const drainBodyMeshSteps=<T>(steps:Generator<string,T,unknown>):T=>{
  for(;;){const step=steps.next();if(step.done){return step.value;}}
};
function* freezeBodyMeshArraySteps<T>(values:T[],reserve?:StructuralOwnedReserve):Generator<string,readonly T[],unknown>{
  if(reserve===undefined){return Object.freeze(values);}
  const steps=structuralFreezeArraySteps(values,reserve);let failed=false;
  try{for(;;){const step=steps.next();if(step.done){return step.value;}yield "meshDecode";}}
  catch(error){failed=true;throw error;}
  finally{try{steps.return(undefined as never);}catch(error){if(!failed){throw error;}}}
}

const requireIdentifier = (value: unknown, path: string): string => {
  if (typeof value !== "string" || !identifier.test(value)) { throw new Error(`Invalid body-mesh ${path}`); }
  return value;
};

const requireNonNegativeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) { throw new Error(`Invalid body-mesh ${path}`); }
  return value;
};

const requirePositiveFinite = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) { throw new Error(`Invalid body-mesh ${path}`); }
  return value;
};

const requireCenter = (value: unknown, path: string): Readonly<{ x: number; y: number; z: number }> => {
  const center = requirePlainRecord(value, path);
  requireExactKeys(center, ["x", "y", "z"], path);
  if (![center.x, center.y, center.z].every((axis) => typeof axis === "number" && Number.isFinite(axis))) {
    throw new Error(`Invalid body-mesh ${path}`);
  }
  return Object.freeze({ x: center.x as number, y: center.y as number, z: center.z as number });
};

/**
 * Keep occupied structural IDs unchanged through Int32 framing and local mesh storage.
 * Validation precedes typed-array writes; Air, negative zero and overflow are not occupied IDs.
 */
const prepareProjection = (value:unknown):PreparedProjection=>drainBodyMeshSteps(prepareProjectionSteps(value));
function* prepareProjectionSteps(value:unknown,reserve?:StructuralOwnedReserve):Generator<string,PreparedProjection,unknown>{
  reserve?.(16_384);
  const projection = requirePlainRecord(value, "projection");
  requireExactKeys(projection, ["sessionId", "epoch", "commandId", "ownerId", "sourceId", "sourceDigest", "revision",
    "issuedTick", "removedCells", "removedMassKg", "parts"], "projection");
  const sessionId = requireIdentifier(projection.sessionId, "sessionId");
  const epoch = requireNonNegativeInteger(projection.epoch, "epoch");
  const commandId = requireIdentifier(projection.commandId, "commandId");
  const ownerId = requireIdentifier(projection.ownerId, "ownerId");
  const sourceId = requireIdentifier(projection.sourceId, "sourceId");
  const sourceDigest = requireStructuralHash(projection.sourceDigest, "bodyMesh/sourceDigest");
  const revision = contentRevision(requireNonNegativeInteger(projection.revision, "revision"));
  if (revision === Number.MAX_SAFE_INTEGER) { throw new Error("Invalid body-mesh next revision"); }
  const issuedTick = requireNonNegativeInteger(projection.issuedTick, "issuedTick");
  const removedCells = projection.removedCells;
  const removedMassKg = requirePositiveFinite(projection.removedMassKg, "removedMassKg");
  if (typeof removedCells !== "number" || !Number.isSafeInteger(removedCells) || removedCells < 1 || removedCells > MAX_REMOVED_CELLS) {
    throw new Error("Invalid body-mesh removed cell count");
  }
  if (!Array.isArray(projection.parts) || Object.getPrototypeOf(projection.parts) !== Array.prototype || projection.parts.length > MAX_PARTS) {
    throw new Error("Body mesh parts BudgetExceeded");
  }

  let totalCells = 0;
  reserve?.(64+MAX_PARTS*2_048);
  const seen = new Set<string>();
  const cells: (readonly HvpStructuralCell[])[] = [];
  const parts: HvpBodyMeshPartPayload[] = [];
  for (const [index, input] of projection.parts.entries()) {
    const part = requirePlainRecord(input, `bodyMesh/parts/${index}`);
    requireExactKeys(part, ["ownerId", "sourceDigest", "center", "massKg", "sourceBytes", "cells"], `bodyMesh/parts/${index}`);
    const expectedOwnerId = `${sourceId}:r${revision + 1}:p${index}`;
    if (requireIdentifier(part.ownerId, `parts/${index}/ownerId`) !== expectedOwnerId) {
      throw new Error("Body mesh part order/identity mismatch");
    }
    const partDigest = requireStructuralHash(part.sourceDigest, `bodyMesh/parts/${index}/sourceDigest`);
    const center = requireCenter(part.center, `bodyMesh/parts/${index}/center`);
    const massKg = requirePositiveFinite(part.massKg, `bodyMesh/parts/${index}/massKg`);
    const sourceBytes = requireNonNegativeInteger(part.sourceBytes, `parts/${index}/sourceBytes`);
    if (sourceBytes === 0 || !Array.isArray(part.cells) || Object.getPrototypeOf(part.cells) !== Array.prototype || part.cells.length < 1) {
      throw new Error("Invalid body-mesh part cells");
    }
    if (part.cells.length > MAX_CELLS - totalCells) { throw new Error("Body mesh cells BudgetExceeded"); }
    const normalized: HvpStructuralCell[] = [];
    reserve?.(64+part.cells.length*8,true);
    for (const [cellIndex, inputCell] of part.cells.entries()) {
      // Logical allowance for cell/key/seen-entry and temporaries; not a JS allocator size claim.
      reserve?.(768,true);
      const cell = requirePlainRecord(inputCell, `bodyMesh/parts/${index}/cells/${cellIndex}`);
      requireExactKeys(cell, ["x", "y", "z", "materialId"], `bodyMesh/parts/${index}/cells/${cellIndex}`);
      const { x, y, z, materialId } = cell;
      if (![x, y, z].every((axis) => typeof axis === "number" && Number.isSafeInteger(axis) && Math.abs(axis) <= MAX_CELL_COORDINATE)
        || typeof materialId !== "number" || !Number.isSafeInteger(materialId) || materialId < MESH_MATERIAL_MIN || materialId > MESH_MATERIAL_MAX) {
        throw new Error("Body mesh input is outside the occupancy mesher profile");
      }
      const key = `${x}:${y}:${z}`;
      if (seen.has(key)) { throw new Error("Duplicate body-mesh input cell"); }
      seen.add(key);
      normalized.push(Object.freeze({ x: x as number, y: y as number, z: z as number, materialId }));
      if(reserve!==undefined){yield "meshDecode";}
    }
    const cellOffset = totalCells;
    totalCells += normalized.length;
    cells.push(yield* freezeBodyMeshArraySteps(normalized,reserve));
    parts.push(Object.freeze({ ownerId: expectedOwnerId, sourceDigest: partDigest, center, massKg, sourceBytes,
      cellOffset, cellCount: normalized.length }));
  }

  return Object.freeze({
    payload: Object.freeze({ sessionId, epoch, commandId, ownerId, sourceId, sourceDigest, revision, issuedTick,
      removedCells, removedMassKg, parts: yield* freezeBodyMeshArraySteps(parts,reserve) }),
    cells: yield* freezeBodyMeshArraySteps(cells,reserve),
  });
}

const payloadIdentity = (payload: HvpBodyMeshPayload): readonly unknown[] => [
  payload.sessionId, payload.epoch, payload.commandId, payload.ownerId, payload.sourceId, payload.sourceDigest,
  payload.revision, payload.issuedTick, payload.removedCells, payload.removedMassKg,
  payload.parts.map((part) => [part.ownerId, part.sourceDigest, part.center.x, part.center.y, part.center.z,
    part.massKg, part.sourceBytes, part.cellOffset, part.cellCount]),
];

const outputBinding = (request: WorkerJobRequest, payload: HvpBodyMeshPayload): readonly unknown[] => [
  HVP_BODY_MESH_JOB, HVP_BODY_MESH_ALGORITHM, request.jobId, request.jobKind, request.targetKey,
  request.planningEpoch, request.workerEpoch, request.inputRevision, request.sourceInputDigest,
  ...payloadIdentity(payload),
];

export const hvpBodyMeshInputDigest = (payload: HvpBodyMeshPayload, buffers: readonly ArrayBuffer[]): string =>
  fnv1aHash(JSON.stringify([payloadIdentity(payload), fnv1aBytes(buffers)]));

export const validateHvpBodyMeshPayload = (value: unknown): HvpBodyMeshPayload => {
  const payload = requirePlainRecord(value, "payload");
  requireExactKeys(payload, ["sessionId", "epoch", "commandId", "ownerId", "sourceId", "sourceDigest", "revision",
    "issuedTick", "removedCells", "removedMassKg", "parts"], "bodyMesh/payload");
  const sessionId = requireIdentifier(payload.sessionId, "sessionId");
  const epoch = requireNonNegativeInteger(payload.epoch, "epoch");
  const commandId = requireIdentifier(payload.commandId, "commandId");
  const ownerId = requireIdentifier(payload.ownerId, "ownerId");
  const sourceId = requireIdentifier(payload.sourceId, "sourceId");
  const sourceDigest = requireStructuralHash(payload.sourceDigest, "bodyMesh/sourceDigest");
  const revision = contentRevision(requireNonNegativeInteger(payload.revision, "revision"));
  if (revision === Number.MAX_SAFE_INTEGER) { throw new Error("Invalid body-mesh next revision"); }
  const issuedTick = requireNonNegativeInteger(payload.issuedTick, "issuedTick");
  const removedCells = payload.removedCells;
  const removedMassKg = requirePositiveFinite(payload.removedMassKg, "removedMassKg");
  if (typeof removedCells !== "number" || !Number.isSafeInteger(removedCells) || removedCells < 1 || removedCells > MAX_REMOVED_CELLS
    || !Array.isArray(payload.parts) || Object.getPrototypeOf(payload.parts) !== Array.prototype || payload.parts.length > MAX_PARTS) {
    throw new Error("Invalid body-mesh payload");
  }
  let totalCells = 0;
  const parts = payload.parts.map((input, index): HvpBodyMeshPartPayload => {
    const part = requirePlainRecord(input, `bodyMesh/payload/parts/${index}`);
    requireExactKeys(part, ["ownerId", "sourceDigest", "center", "massKg", "sourceBytes", "cellOffset", "cellCount"],
      `bodyMesh/payload/parts/${index}`);
    const ownerPartId = requireIdentifier(part.ownerId, `payload/parts/${index}/ownerId`);
    if (ownerPartId !== `${sourceId}:r${revision + 1}:p${index}`) { throw new Error("Body mesh part order/identity mismatch"); }
    const partDigest = requireStructuralHash(part.sourceDigest, `bodyMesh/payload/parts/${index}/sourceDigest`);
    const center = requireCenter(part.center, `bodyMesh/payload/parts/${index}/center`);
    const massKg = requirePositiveFinite(part.massKg, `bodyMesh/payload/parts/${index}/massKg`);
    const sourceBytes = requireNonNegativeInteger(part.sourceBytes, `payload/parts/${index}/sourceBytes`);
    const cellOffset = requireNonNegativeInteger(part.cellOffset, `payload/parts/${index}/cellOffset`);
    const cellCount = requireNonNegativeInteger(part.cellCount, `payload/parts/${index}/cellCount`);
    if (sourceBytes === 0 || cellCount < 1 || cellOffset !== totalCells) { throw new Error("Invalid body-mesh cell span"); }
    totalCells = checkedEnd(cellOffset, cellCount, MAX_CELLS);
    return Object.freeze({ ownerId: ownerPartId, sourceDigest: partDigest, center, massKg, sourceBytes, cellOffset, cellCount });
  });
  return Object.freeze({ sessionId, epoch, commandId, ownerId, sourceId, sourceDigest, revision, issuedTick,
    removedCells, removedMassKg, parts: Object.freeze(parts) });
};

const fixedBufferLength = (buffer: ArrayBuffer): number => {
  const size = arrayBufferByteLength.call(buffer) as number;
  if (arrayBufferResizable?.call(buffer) === true || size !== buffer.byteLength) { throw new Error("Resizable/detached body-mesh buffer"); }
  return size;
};

export const validateHvpBodyMeshRequest = (request: WorkerJobRequest, input: TransferableBufferBundle): HvpBodyMeshPayload => {
  const payload = validateHvpBodyMeshPayload(request.payload);
  const cellCount = payload.parts.reduce((sum, part) => checkedEnd(sum, part.cellCount, MAX_CELLS), 0);
  const view = input.views[0];
  if (request.jobKind !== HVP_BODY_MESH_JOB || request.algorithmVersion !== HVP_BODY_MESH_ALGORITHM
    || request.targetKey !== payload.ownerId || request.inputRevision !== payload.revision
    || request.estimatedInputBytes !== input.byteLength || request.estimatedOutputBytes !== HVP_BODY_MESH_MAX_OUTPUT
    || input.ownership !== "SenderToWorker" || input.revision !== payload.revision || input.buffers.length !== 1 || input.views.length !== 1
    || input.byteLength !== cellCount * 16 || fixedBufferLength(input.buffers[0]!) !== input.byteLength
    || view?.name !== "cells" || view.kind !== "Int32Array" || view.byteOffset !== 0 || view.bufferIndex !== 0
    || view.elementCount !== cellCount * 4 || !request.sourceInputDigest
    || (input.contentHash !== undefined && input.contentHash !== fnv1aBytes(input.buffers))
    || request.sourceInputDigest !== hvpBodyMeshInputDigest(payload, input.buffers)) {
    throw new Error("Body-mesh input binding/layout mismatch");
  }
  return payload;
};

const readInputCells = (payload: HvpBodyMeshPayload, input: TransferableBufferBundle): readonly (readonly HvpStructuralCell[])[] => {
  const raw = new Int32Array(input.buffers[0]!);
  const seen = new Set<string>();
  return Object.freeze(payload.parts.map((part) => {
    const cells = Array.from({ length: part.cellCount }, (_, index) => {
      const offset = (part.cellOffset + index) * 4;
      const x = raw[offset]!, y = raw[offset + 1]!, z = raw[offset + 2]!, materialId = raw[offset + 3]!;
      if ([x, y, z].some((axis) => Math.abs(axis) > MAX_CELL_COORDINATE)
        || materialId < MESH_MATERIAL_MIN || materialId > MESH_MATERIAL_MAX) {
        throw new Error("Body-mesh input is outside the occupancy mesher profile");
      }
      const key = `${x}:${y}:${z}`;
      if (seen.has(key)) { throw new Error("Duplicate body-mesh input cell"); }
      seen.add(key);
      return Object.freeze({ x, y, z, materialId });
    });
    return Object.freeze(cells);
  }));
};

/** Owns one packed copy; projection order is never sorted or rewritten. */
export const buildHvpBodyMeshInput = (projection: HvpBodyChildProjection) => {
  const prepared = prepareProjection(projection);
  const cellCount = prepared.payload.parts.reduce((sum, part) => checkedEnd(sum, part.cellCount, MAX_CELLS), 0);
  const raw = new Int32Array(cellCount * 4);
  let offset = 0;
  for (const cells of prepared.cells) {
    for (const cell of cells) {
      raw[offset++] = cell.x;
      raw[offset++] = cell.y;
      raw[offset++] = cell.z;
      raw[offset++] = cell.materialId;
    }
  }
  const buffers = [raw.buffer as ArrayBuffer];
  const input: TransferableBufferBundle = { buffers, ownership: "SenderToWorker", revision: contentRevision(prepared.payload.revision),
    byteLength: byteCount(raw.byteLength), contentHash: fnv1aBytes(buffers),
    views: [{ name: "cells", kind: "Int32Array", bufferIndex: 0, byteOffset: 0, elementCount: raw.length }] };
  return Object.freeze({ payload: prepared.payload, input, sourceInputDigest: hvpBodyMeshInputDigest(prepared.payload, buffers) });
};

export const executeHvpBodyMeshJob = async (request: WorkerJobRequest, bundle: TransferableBufferBundle,
  host: HvpBodyPlanHost) => {
  const input = validateTransferableBundle(bundle);
  const payload = validateHvpBodyMeshRequest(request, input);
  host.assertCurrent();
  const cells = readInputCells(payload, input);
  const products: HvpBodyCutProducts["parts"][number][] = [];
  let retainedMeshBytes = 0;
  for (const [index, part] of payload.parts.entries()) {
    const steps = meshHvpOwnedBodyCellsSteps(cells[index]!, part.center, part.sourceDigest);
    let mesh: HvpCompactMesh;
    let failed = false;
    try {
      for (;;) {
        host.assertCurrent();
        const step = steps.next();
        if (step.done) { mesh = step.value; break; }
        await host.yieldTask();
      }
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      try { steps.return(undefined as never); } catch (error) { if (!failed) { throw error; } }
    }
    host.assertCurrent();
    if (mesh.colors === null) { throw new Error("Body-mesh mesher omitted AO colors"); }
    const meshBytes = mesh.positions.byteLength + mesh.normals.byteLength + mesh.colors.byteLength + mesh.indices.byteLength;
    if (!Number.isSafeInteger(meshBytes) || meshBytes > HVP_BODY_MESH_MAX_OUTPUT - retainedMeshBytes) {
      throw new Error("Body-mesh products BudgetExceeded");
    }
    retainedMeshBytes += meshBytes;
    products.push({ ownerId: part.ownerId, sourceDigest: part.sourceDigest, center: part.center, massKg: part.massKg,
      sourceBytes: part.sourceBytes, cells: cells[index]!, mesh: mesh as HvpCompactMesh });
  }
  host.assertCurrent();
  const output = encodeHvpBodyCutWire({ parts: products, removedCells: payload.removedCells, removedMassKg: payload.removedMassKg },
    outputBinding(request, payload), payload.revision);
  host.assertCurrent();
  const result: WorkerJobResult = { jobId: request.jobId, targetKey: request.targetKey, planningEpoch: request.planningEpoch,
    workerEpoch: request.workerEpoch, inputRevision: request.inputRevision, sourceInputDigest: request.sourceInputDigest,
    outputRevision: output.revision, algorithmVersion: request.algorithmVersion, outputBytes: output.byteLength, contentHash: output.contentHash };
  return { result, bundle: output };
};

function* validatePartGeometrySteps(wire:ReturnType<typeof readHvpBodyCutWire>,partIndex:number,cells:readonly HvpStructuralCell[],center:HvpBodyMeshPartPayload["center"],reserve?:StructuralOwnedReserve):Generator<string,HvpCompactMesh,unknown>{
  reserve?.(8_192+cells.length*64);
  const part = wire.header.parts[partIndex]!;
  const vertexStart = part.vertexOffset * 3;
  const vertexEnd = (part.vertexOffset + part.vertexCount) * 3;
  const indexStart = part.indexOffset;
  const indexEnd = part.indexOffset + part.indexCount;
  const rangeStart = part.rangeOffset * 3;
  const rangeEnd = (part.rangeOffset + part.rangeCount) * 3;
  const centerValues = [center.x, center.y, center.z];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const materials = new Set<number>();
  for (const cell of cells) {
    const coordinates = [cell.x, cell.y, cell.z];
    materials.add(cell.materialId);
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis]!, coordinates[axis]! * 0.125);
      max[axis] = Math.max(max[axis]!, (coordinates[axis]! + 1) * 0.125);
    }
    if(reserve!==undefined){yield "meshDecode";}
  }
  const boundsMin = min.map((value, axis) => Math.fround(value - centerValues[axis]!));
  const boundsMax = max.map((value, axis) => Math.fround(value - centerValues[axis]!));
  for (let index = vertexStart; index < vertexEnd; index += 1) {
    const axis = (index - vertexStart) % 3;
    const value = wire.positions[index]!;
    if (!Number.isFinite(value) || value < boundsMin[axis]! || value > boundsMax[axis]!) {
      throw new Error("Body-mesh position exceeds projected cell bounds");
    }
    const normal = wire.normals[index]!;
    const color = wire.colors[index]!;
    if ((normal !== 0 && normal !== 1 && normal !== -1) || !Number.isFinite(color) || color < 0 || color > 1) {
      throw new Error("Invalid body-mesh normal/color data");
    }
    if(reserve!==undefined&&(index-vertexStart+1)%4096===0){yield "meshDecode";}
  }
  for (let index = indexStart; index < indexEnd; index += 1) {
    if (wire.indices[index]! >= part.vertexCount) { throw new Error("Body-mesh index exceeds its part span"); }
    if(reserve!==undefined&&(index-indexStart+1)%4096===0){yield "meshDecode";}
  }
  let rangeCursor = 0;
  const materialRanges: HvpCompactMesh["materialRanges"][number][] = [];
  reserve?.(64+part.rangeCount*136,true);
  for (let index = rangeStart; index < rangeEnd; index += 3) {
    const slot = wire.ranges[index]!, startIndex = wire.ranges[index + 1]!, indexCount = wire.ranges[index + 2]!;
    if (!materials.has(slot) || startIndex !== rangeCursor || indexCount < 1 || indexCount % 6 !== 0) {
      throw new Error("Invalid body-mesh material range");
    }
    rangeCursor = checkedEnd(rangeCursor, indexCount, part.indexCount);
    materialRanges.push(Object.freeze({ slot, startIndex, indexCount }));
    if(reserve!==undefined){yield "meshDecode";}
  }
  if (rangeCursor !== part.indexCount) { throw new Error("Incomplete body-mesh material ranges"); }
  let vertices:Float32Array,normals:Float32Array,colors:Float32Array,wideIndices:Uint32Array,indices:Uint16Array|Uint32Array;
  if(reserve===undefined){
    vertices=wire.positions.slice(vertexStart,vertexEnd);normals=wire.normals.slice(vertexStart,vertexEnd);
    colors=wire.colors.slice(vertexStart,vertexEnd);wideIndices=wire.indices.slice(indexStart,indexEnd);
    indices=part.vertexCount>65_535?wideIndices:new Uint16Array(wideIndices);
  }else{
    const floats=vertexEnd-vertexStart,indexCount=indexEnd-indexStart,small=part.vertexCount<=65_535;
    reserve(256+floats*12,true);reserve(128+indexCount*4,!small);if(small){reserve(128+indexCount*2,true);}
    vertices=new Float32Array(floats);normals=new Float32Array(floats);colors=new Float32Array(floats);
    for(let i=0;i<floats;i+=1){vertices[i]=wire.positions[vertexStart+i]!;normals[i]=wire.normals[vertexStart+i]!;colors[i]=wire.colors[vertexStart+i]!;
      if((i+1)%4096===0){yield "meshDecode";}}
    wideIndices=new Uint32Array(indexCount);for(let i=0;i<indexCount;i+=1){wideIndices[i]=wire.indices[indexStart+i]!;if((i+1)%4096===0){yield "meshDecode";}}
    if(small){const narrow=new Uint16Array(indexCount);for(let i=0;i<indexCount;i+=1){narrow[i]=wideIndices[i]!;if((i+1)%4096===0){yield "meshDecode";}}indices=narrow;}
    else{indices=wideIndices;}
  }
  return Object.freeze({ sourceDigest: part.sourceDigest, algorithmVersion: "hvp-terrain-fragment-v1", positions: vertices,
    normals, colors, indices, materialRanges: yield* freezeBodyMeshArraySteps(materialRanges,reserve), faceCount: part.faceCount,
    unitFaceCount: part.unitFaceCount, outerFaceCount: part.outerFaceCount, cavityFaceCount: part.cavityFaceCount,
    tempEstimateBytes: part.tempEstimateBytes,
    boundsMeters: Object.freeze({ min: Object.freeze({ x: boundsMin[0]!, y: boundsMin[1]!, z: boundsMin[2]! }),
      max: Object.freeze({ x: boundsMax[0]!, y: boundsMax[1]!, z: boundsMax[2]! }) }) });
}

/**
 * The semantic decoder checks framing, bindings, projected cells, order, shape and bounds only.
 * It does not prove complete surface coverage or issue source/native authority: the native owner
 * must later compare the decoded geometry with its retained local plan, never returned cells.
 */
export const decodeHvpBodyMeshOutput = (request: WorkerJobRequest, projection: HvpBodyChildProjection,
  output: TransferableBufferBundle): HvpBodyCutProducts =>drainBodyMeshSteps(bodyMeshOutputSteps(request,projection,output));
/** Internal borrowed decoder of the same wire/geometry algorithm; no native or source admission. */
export const decodeHvpBodyMeshOutputSteps=(request:WorkerJobRequest,projection:HvpBodyChildProjection,output:TransferableBufferBundle,reserve:StructuralOwnedReserve)=>
  bodyMeshOutputSteps(request,projection,output,reserve);
function* bodyMeshOutputSteps(request:WorkerJobRequest,projection:HvpBodyChildProjection,output:TransferableBufferBundle,reserve?:StructuralOwnedReserve):Generator<string,HvpBodyCutProducts,unknown>{
  const expected = yield* prepareProjectionSteps(projection,reserve);
  const payload = validateHvpBodyMeshPayload(request.payload);
  const totalCells = expected.payload.parts.reduce((sum, part) => checkedEnd(sum, part.cellCount, MAX_CELLS), 0);
  if (JSON.stringify(payloadIdentity(payload)) !== JSON.stringify(payloadIdentity(expected.payload))
    || request.jobKind !== HVP_BODY_MESH_JOB || request.algorithmVersion !== HVP_BODY_MESH_ALGORITHM
    || request.targetKey !== expected.payload.ownerId || request.inputRevision !== expected.payload.revision
    || request.estimatedInputBytes !== totalCells * 16 || request.estimatedOutputBytes !== HVP_BODY_MESH_MAX_OUTPUT
    || !request.sourceInputDigest) {
    throw new Error("Body-mesh output request binding mismatch");
  }
  const bundle = validateTransferableBundle(output);
  reserve?.(16_384+bundle.byteLength);
  if (bundle.ownership !== "WorkerToConsumer" || bundle.revision !== expected.payload.revision
    || bundle.byteLength > HVP_BODY_MESH_MAX_OUTPUT || bundle.contentHash !== (reserve===undefined?fnv1aBytes(bundle.buffers):yield* fnv1aBytesSteps(bundle.buffers))) {
    throw new Error("Invalid body-mesh output ownership/revision/hash/budget");
  }
  const wire = readHvpBodyCutWire(bundle, outputBinding(request, payload));
  if (request.sourceInputDigest !== (reserve===undefined?hvpBodyMeshInputDigest(payload,[bundle.buffers[1]!])
    :fnv1aHash(JSON.stringify([payloadIdentity(payload),yield* fnv1aBytesSteps([bundle.buffers[1]!])])))
    || wire.header.removedCells !== expected.payload.removedCells
    || !Object.is(wire.header.removedMassKg, expected.payload.removedMassKg)
    || wire.header.parts.length !== expected.payload.parts.length) {
    throw new Error("Body-mesh output projection binding mismatch");
  }
  const parts: HvpBodyCutProducts["parts"][number][] = [];
  reserve?.(64+expected.payload.parts.length*2_048,true);
  for (const [index, metadata] of expected.payload.parts.entries()) {
    const part = wire.header.parts[index]!;
    const expectedCells = expected.cells[index]!;
    if (part.ownerId !== metadata.ownerId || part.sourceDigest !== metadata.sourceDigest
      || !Object.is(part.center.x, metadata.center.x) || !Object.is(part.center.y, metadata.center.y) || !Object.is(part.center.z, metadata.center.z)
      || !Object.is(part.massKg, metadata.massKg) || part.sourceBytes !== metadata.sourceBytes || part.cellCount !== expectedCells.length) {
      throw new Error("Body-mesh output owner order/metadata mismatch");
    }
    for (let cellIndex = 0; cellIndex < expectedCells.length; cellIndex += 1) {
      const offset = (part.cellOffset + cellIndex) * 4, cell = expectedCells[cellIndex]!;
      if (wire.cells[offset] !== cell.x || wire.cells[offset + 1] !== cell.y || wire.cells[offset + 2] !== cell.z
        || wire.cells[offset + 3] !== cell.materialId) {
        throw new Error("Body-mesh output cells differ from owner projection");
      }
      if(reserve!==undefined){yield "meshDecode";}
    }
    const mesh = yield* validatePartGeometrySteps(wire,index,expectedCells,metadata.center,reserve);
    let cells:readonly HvpStructuralCell[];
    if(reserve===undefined){cells=Object.freeze(expectedCells.map(cell=>Object.freeze({...cell})));}
    else{reserve(64+expectedCells.length*264,true);const copied:HvpStructuralCell[]=[];
      for(const cell of expectedCells){copied.push(Object.freeze({...cell}));yield "meshDecode";}
      cells=yield* freezeBodyMeshArraySteps(copied,reserve);}
    parts.push(Object.freeze({ ownerId: metadata.ownerId, sourceDigest: metadata.sourceDigest, center: metadata.center,
      massKg: metadata.massKg, sourceBytes: metadata.sourceBytes, cells, mesh }));
  }
  return Object.freeze({ parts: yield* freezeBodyMeshArraySteps(parts,reserve), removedCells: expected.payload.removedCells,
    removedMassKg: expected.payload.removedMassKg });
}

/**
 * Owner-local use AFTER wire decoding, with the actual retained plan and a live-ticket task pump.
 * No returned cells are an oracle; no transferable certificate or Stage authority is issued.
 * Exact checking shares the mesh kernel; independent surface qualification and live admission
 * remain required. This private slice is NOT activation-ready.
 */
export function* verifyHvpBodyMeshPartsSteps(plan: HvpBodyCutPlan, products: HvpBodyCutProducts): Generator<string, void, unknown> {
  const expected = plan.local.plan;
  if (products.parts.length !== expected.parts.length || !Object.is(products.removedCells, expected.removedCells)
    || !Object.is(products.removedMassKg, expected.removedMassKg)) {
    throw new Error("Foreign local body mesh products");
  }
  for (const [index, part] of expected.parts.entries()) {
    const actual = products.parts[index]!, center = part.recipe.mass.centerOfMassMeters!;
    if (actual.ownerId !== part.ownerId || actual.sourceDigest !== part.recipe.source.contentHash
      || !Object.is(actual.massKg, part.recipe.mass.totalMassKg)
      || !Object.is(actual.sourceBytes, part.recipe.source.bricks.length * ADAPTIVE_BRICK_ESTIMATED_BYTES)
      || !Object.is(actual.center.x, center.x) || !Object.is(actual.center.y, center.y) || !Object.is(actual.center.z, center.z)
      || actual.cells.length !== part.cells.length) {
      throw new Error("Foreign local body mesh products");
    }
    for (let cellIndex = 0; cellIndex < part.cells.length; cellIndex += 1) {
      const a = actual.cells[cellIndex]!, e = part.cells[cellIndex]!;
      if (!Object.is(a.x, e.x) || !Object.is(a.y, e.y) || !Object.is(a.z, e.z) || !Object.is(a.materialId, e.materialId)) {
        throw new Error("Foreign local body mesh products");
      }
      if ((cellIndex + 1) % 128 === 0) { yield "meshOwnerCells"; }
    }
    yield* verifyHvpOwnedBodyMeshSteps(part, actual.mesh);
  }
}
