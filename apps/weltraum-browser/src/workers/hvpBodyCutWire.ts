import { requireExactKeys, requirePlainRecord } from "../voxel/adaptive/validation";
import { fnv1aBytes, validateTransferableBundle, type TransferableBufferBundle } from "./protocol";
import { byteCount, contentRevision } from "./ids";
import type { HvpBodyCutProducts } from "./hvpBodyCutJob";

export const HVP_BODY_CUT_MAX_OUTPUT = 8 * 1024 * 1024;
const MAX_METADATA_BYTES = 65_536;
const layout = [
  ["metadata", "Uint8Array", 1], ["cells", "Int32Array", 4],
  ["positions", "Float32Array", 4], ["normals", "Float32Array", 4],
  ["colors", "Float32Array", 4], ["indices", "Uint32Array", 4], ["ranges", "Uint32Array", 4]
] as const;
const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;
const bufferResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;

export interface HvpBodyPartWireV2 {
  readonly ownerId: string;
  readonly sourceDigest: string;
  readonly center: Readonly<{ x: number; y: number; z: number }>;
  readonly massKg: number;
  readonly sourceBytes: number;
  readonly cellOffset: number; // Cells, not Int32 elements.
  readonly cellCount: number;
  readonly vertexOffset: number; // Vertices, not Float32 elements.
  readonly vertexCount: number;
  readonly indexOffset: number; // Uint32 elements; values stay part-local.
  readonly indexCount: number;
  readonly rangeOffset: number; // Triples, not Uint32 elements.
  readonly rangeCount: number;
  readonly faceCount: number;
  readonly unitFaceCount: number;
  readonly outerFaceCount: number;
  readonly cavityFaceCount: number;
  readonly tempEstimateBytes: number;
}
export interface HvpBodyCutWireV2 {
  readonly wire: "hvp-body-cut-binary-v2";
  readonly binding: readonly unknown[];
  readonly removedCells: number;
  readonly removedMassKg: number;
  readonly parts: readonly HvpBodyPartWireV2[];
}
const integerFields = ["sourceBytes", "cellOffset", "cellCount", "vertexOffset", "vertexCount",
  "indexOffset", "indexCount", "rangeOffset", "rangeCount", "faceCount", "unitFaceCount",
  "outerFaceCount", "cavityFaceCount", "tempEstimateBytes"] as const;

export function checkedEnd(offset: number, count: number, total: number): number {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(count) || !Number.isSafeInteger(total)
    || offset < 0 || count < 0 || total < 0 || offset > total || count > total - offset) {
    throw new Error("Invalid body wire span");
  }
  return offset + count;
}

/** Validates layout only; the job decoder still owns all mechanical/source checks. */
export function readHvpBodyCutWire(output: TransferableBufferBundle, binding: readonly unknown[]) {
  if (output.buffers.length !== 7 || output.views.length !== 7) {
    throw new Error("Invalid body-cut binary layout");
  }
  const bundle = validateTransferableBundle(output);
  if (bundle.ownership !== "WorkerToConsumer") { throw new Error("Invalid body-cut binary ownership"); }
  if (bundle.byteLength > HVP_BODY_CUT_MAX_OUTPUT) { throw new Error("Body-cut products BudgetExceeded"); }
  const sizes = bundle.buffers.map((buffer, index) => {
    const size = bufferLength.call(buffer) as number;
    const view = bundle.views[index]!, [name, kind, width] = layout[index]!;
    if (bufferResizable?.call(buffer) === true || size !== buffer.byteLength
      || view.name !== name || view.kind !== kind || view.bufferIndex !== index
      || view.byteOffset !== 0 || size % width !== 0 || view.elementCount !== size / width) {
      throw new Error("Invalid body-cut binary channel");
    }
    return size;
  });
  if (sizes[0]! > MAX_METADATA_BYTES) { throw new Error("Body-cut metadata BudgetExceeded"); }
  if (sizes[1]! % 16 !== 0 || sizes[2]! % 12 !== 0 || sizes[3] !== sizes[2] || sizes[4] !== sizes[2]
    || sizes[6]! % 12 !== 0 || sizes[1]! / 16 > 32_768) {
    throw new Error("Invalid body-cut binary channel dimensions");
  }
  const value = requirePlainRecord(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bundle.buffers[0]!)), "body/wire");
  requireExactKeys(value, ["wire", "binding", "removedCells", "removedMassKg", "parts"], "body/wire");
  if (value.wire !== "hvp-body-cut-binary-v2" || !Array.isArray(value.binding)
    || JSON.stringify(value.binding) !== JSON.stringify(binding) || !Array.isArray(value.parts) || value.parts.length > 32
    || typeof value.removedCells !== "number" || !Number.isSafeInteger(value.removedCells) || value.removedCells < 1 || value.removedCells > 512
    || typeof value.removedMassKg !== "number" || !Number.isFinite(value.removedMassKg) || value.removedMassKg <= 0) {
    throw new Error("Invalid body-cut output binding");
  }
  for (const input of value.parts) {
    const part = requirePlainRecord(input, "body/part");
    requireExactKeys(part, ["ownerId", "sourceDigest", "center", "massKg", ...integerFields], "body/part");
    const center = requirePlainRecord(part.center, "body/part/center");
    requireExactKeys(center, ["x", "y", "z"], "body/part/center");
    if (typeof part.ownerId !== "string" || typeof part.sourceDigest !== "string"
      || typeof part.massKg !== "number" || !Number.isFinite(part.massKg)
      || ![center.x, center.y, center.z].every(n => typeof n === "number" && Number.isFinite(n))) {
      throw new Error("Invalid body-cut binary part metadata");
    }
    for (const field of integerFields) {
      const n = part[field];
      if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) { throw new Error("Invalid body wire span"); }
    }
  }
  // The closed JSON header and scalar types are checked before this boundary cast.
  const header = value as unknown as HvpBodyCutWireV2;
  let cells = 0, vertices = 0, indices = 0, ranges = 0;
  for (const part of header.parts) {
    if (part.cellOffset !== cells || part.vertexOffset !== vertices || part.indexOffset !== indices || part.rangeOffset !== ranges
      || part.cellCount < 1 || part.cellCount > 32_768 || part.vertexCount < 1 || part.vertexCount > 256_000 || part.vertexCount % 4 !== 0
      || part.indexCount !== part.vertexCount * 3 / 2 || part.indexCount > 384_000 || part.faceCount !== part.indexCount / 6
      || part.unitFaceCount < part.faceCount || part.outerFaceCount + part.cavityFaceCount !== part.faceCount
      || part.rangeCount > part.faceCount || part.tempEstimateBytes > 64 * 1024 * 1024) {
      throw new Error("Invalid body-cut binary part spans");
    }
    cells = checkedEnd(cells, part.cellCount, sizes[1]! / 16);
    vertices = checkedEnd(vertices, part.vertexCount, sizes[2]! / 12);
    indices = checkedEnd(indices, part.indexCount, sizes[5]! / 4);
    ranges = checkedEnd(ranges, part.rangeCount, sizes[6]! / 12);
  }
  if (cells !== sizes[1]! / 16 || vertices !== sizes[2]! / 12 || indices !== sizes[5]! / 4 || ranges !== sizes[6]! / 12) {
    throw new Error("Incomplete body-cut binary channel coverage");
  }
  return { header, cells: new Int32Array(bundle.buffers[1]!), positions: new Float32Array(bundle.buffers[2]!),
    normals: new Float32Array(bundle.buffers[3]!), colors: new Float32Array(bundle.buffers[4]!),
    indices: new Uint32Array(bundle.buffers[5]!), ranges: new Uint32Array(bundle.buffers[6]!) };
}

export function encodeHvpBodyCutWire(products: HvpBodyCutProducts, binding: readonly unknown[], revision: number): TransferableBufferBundle {
  if (products.parts.length > 32) { throw new Error("Body-cut parts BudgetExceeded"); }
  const outputRevision = contentRevision(revision);
  let cellCount = 0, vertexCount = 0, indexCount = 0, rangeCount = 0;
  const parts: HvpBodyPartWireV2[] = products.parts.map(part => {
    const mesh = part.mesh;
    if (!(mesh.positions instanceof Float32Array) || !(mesh.normals instanceof Float32Array) || !(mesh.colors instanceof Float32Array)
      || !(mesh.indices instanceof Uint16Array || mesh.indices instanceof Uint32Array)
      || mesh.positions.length % 3 !== 0 || mesh.normals.length !== mesh.positions.length || mesh.colors.length !== mesh.positions.length) {
      throw new Error("Invalid body-cut encoder arrays");
    }
    const entry: HvpBodyPartWireV2 = { ownerId: part.ownerId, sourceDigest: part.sourceDigest, center: part.center,
      massKg: part.massKg, sourceBytes: part.sourceBytes, cellOffset: cellCount, cellCount: part.cells.length,
      vertexOffset: vertexCount, vertexCount: mesh.positions.length / 3, indexOffset: indexCount, indexCount: mesh.indices.length,
      rangeOffset: rangeCount, rangeCount: mesh.materialRanges.length, faceCount: mesh.faceCount, unitFaceCount: mesh.unitFaceCount,
      outerFaceCount: mesh.outerFaceCount, cavityFaceCount: mesh.cavityFaceCount, tempEstimateBytes: mesh.tempEstimateBytes };
    cellCount = checkedEnd(cellCount, entry.cellCount, 32_768);
    vertexCount = checkedEnd(vertexCount, entry.vertexCount, Number.MAX_SAFE_INTEGER);
    indexCount = checkedEnd(indexCount, entry.indexCount, Number.MAX_SAFE_INTEGER);
    rangeCount = checkedEnd(rangeCount, entry.rangeCount, Number.MAX_SAFE_INTEGER);
    return entry;
  });
  const header: HvpBodyCutWireV2 = { wire: "hvp-body-cut-binary-v2", binding,
    removedCells: products.removedCells, removedMassKg: products.removedMassKg, parts };
  const text = JSON.stringify(header);
  if (text.length > MAX_METADATA_BYTES) { throw new Error("Body-cut metadata BudgetExceeded"); }
  const metadata = new TextEncoder().encode(text);
  if (metadata.byteLength > MAX_METADATA_BYTES) { throw new Error("Body-cut metadata BudgetExceeded"); }
  const bytes = metadata.byteLength + cellCount * 16 + vertexCount * 36 + indexCount * 4 + rangeCount * 12;
  if (!Number.isSafeInteger(bytes) || bytes > HVP_BODY_CUT_MAX_OUTPUT) { throw new Error("Body-cut products BudgetExceeded"); }
  // All aggregate sizes are admitted before these numeric allocations/copies.
  const cells = new Int32Array(cellCount * 4), positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3), colors = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount), ranges = new Uint32Array(rangeCount * 3);
  for (const [index, part] of products.parts.entries()) {
    const entry = parts[index]!, mesh = part.mesh;
    let cellOffset = entry.cellOffset * 4, rangeOffset = entry.rangeOffset * 3;
    for (const cell of part.cells) {
      if (![cell.x, cell.y, cell.z, cell.materialId].every(n => Number.isInteger(n) && n >= -0x80000000 && n <= 0x7fffffff)) {
        throw new Error("Invalid body-cut Int32 cell");
      }
      cells[cellOffset++] = cell.x; cells[cellOffset++] = cell.y;
      cells[cellOffset++] = cell.z; cells[cellOffset++] = cell.materialId;
    }
    positions.set(mesh.positions, entry.vertexOffset * 3);
    normals.set(mesh.normals, entry.vertexOffset * 3);
    colors.set(mesh.colors!, entry.vertexOffset * 3);
    indices.set(mesh.indices, entry.indexOffset);
    for (const range of mesh.materialRanges) {
      if (![range.slot, range.startIndex, range.indexCount].every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff)) {
        throw new Error("Invalid body-cut Uint32 range");
      }
      ranges[rangeOffset++] = range.slot; ranges[rangeOffset++] = range.startIndex; ranges[rangeOffset++] = range.indexCount;
    }
  }
  const buffers = [metadata.buffer, cells.buffer, positions.buffer, normals.buffer, colors.buffer, indices.buffer, ranges.buffer];
  return { buffers, ownership: "WorkerToConsumer", revision: outputRevision, byteLength: byteCount(bytes), contentHash: fnv1aBytes(buffers),
    views: buffers.map((buffer, index) => ({ name: layout[index]![0], kind: layout[index]![1], bufferIndex: index,
      byteOffset: 0, elementCount: buffer.byteLength / layout[index]![2] })) };
}

/** Borrowed channel windows, never published as validated/owned mesh products. */
export function unpackHvpBodyCutWire(output: TransferableBufferBundle, binding: readonly unknown[]) {
  const wire = readHvpBodyCutWire(output, binding);
  const parts = wire.header.parts.map(part => {
    const cells = Array.from({ length: part.cellCount }, (_, index) => {
      const offset = (part.cellOffset + index) * 4;
      return { x: wire.cells[offset]!, y: wire.cells[offset + 1]!, z: wire.cells[offset + 2]!, materialId: wire.cells[offset + 3]! };
    });
    const materialRanges = Array.from({ length: part.rangeCount }, (_, index) => {
      const offset = (part.rangeOffset + index) * 3;
      return { slot: wire.ranges[offset]!, startIndex: wire.ranges[offset + 1]!, indexCount: wire.ranges[offset + 2]! };
    });
    const start = part.vertexOffset * 3, end = (part.vertexOffset + part.vertexCount) * 3;
    return { ownerId: part.ownerId, sourceDigest: part.sourceDigest, center: part.center, massKg: part.massKg, sourceBytes: part.sourceBytes, cells,
      mesh: { sourceDigest: part.sourceDigest, algorithmVersion: "hvp-terrain-fragment-v1",
        positions: wire.positions.subarray(start, end), normals: wire.normals.subarray(start, end), colors: wire.colors.subarray(start, end),
        indices: wire.indices.subarray(part.indexOffset, part.indexOffset + part.indexCount), materialRanges,
        faceCount: part.faceCount, unitFaceCount: part.unitFaceCount, outerFaceCount: part.outerFaceCount,
        cavityFaceCount: part.cavityFaceCount, tempEstimateBytes: part.tempEstimateBytes } };
  });
  return { binding: wire.header.binding, parts, removedCells: wire.header.removedCells, removedMassKg: wire.header.removedMassKg };
}
