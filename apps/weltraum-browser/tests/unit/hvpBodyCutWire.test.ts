import { describe, expect, it, vi } from "vitest";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId, workerJobKind, workerTargetKey } from "../../src/workers/ids";
import { fnv1aBytes, type TransferableBufferBundle, type WorkerJobRequest } from "../../src/workers/protocol";
import { checkedEnd, encodeHvpBodyCutWire, readHvpBodyCutWire, type HvpBodyCutWireV2 } from "../../src/workers/hvpBodyCutWire";
import { decodeHvpBodyCutOutput, executeHvpBodyCutJob, HVP_BODY_CUT_JOB, HVP_BODY_CUT_MAX_OUTPUT, hvpBodyCutInputDigest,
  type HvpBodyCutPayload, type HvpBodyCutProducts } from "../../src/workers/hvpBodyCutJob";
import { ingestHvpStructuralCells, type HvpStructuralCell } from "../../src/hestia-prototype/terrain/structuralIngest";
import { integrateWorkerResult } from "../../src/workers/resultGate";
import { StreamingWorkerRuntime } from "../../src/workers/streamingWorker";
import { WorkerPool } from "../../src/workers/workerPool";
import type { WorkerTransport } from "../../src/workers/workerHandle";
import * as bodyMeshes from "../../src/hestia-prototype/presentation/terrainFragment";
import * as bodyWire from "../../src/workers/hvpBodyCutWire";

const binding = ["layout-only"];
const channels = [
  ["metadata", "Uint8Array", 1], ["cells", "Int32Array", 4],
  ["positions", "Float32Array", 4], ["normals", "Float32Array", 4],
  ["colors", "Float32Array", 4], ["indices", "Uint32Array", 4], ["ranges", "Uint32Array", 4]
] as const;
const pack = (buffers: ArrayBuffer[]): TransferableBufferBundle => ({
  buffers, ownership: "WorkerToConsumer", revision: contentRevision(1),
  byteLength: byteCount(buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0)),
  contentHash: fnv1aBytes(buffers),
  views: buffers.map((buffer, index) => ({ name: channels[index]![0], kind: channels[index]![1],
    bufferIndex: index, byteOffset: 0, elementCount: buffer.byteLength / channels[index]![2] }))
});
// Layout-only data, not a claim of mechanically validated body products.
const fixture = (partCount = 2): TransferableBufferBundle => {
  const header: HvpBodyCutWireV2 = { wire: "hvp-body-cut-binary-v2", binding, removedCells: 1, removedMassKg: 1,
    parts: Array.from({ length: partCount }, (_, index) => ({
      ownerId: `layout:r1:p${index}`, sourceDigest: "layout-only", center: { x: 0, y: 0, z: 0 }, massKg: 1,
      sourceBytes: 1, cellOffset: index, cellCount: 1, vertexOffset: index * 4, vertexCount: 4,
      indexOffset: index * 6, indexCount: 6, rangeOffset: index, rangeCount: 1,
      faceCount: 1, unitFaceCount: 1, outerFaceCount: 1, cavityFaceCount: 0, tempEstimateBytes: 0
    })) };
  const cells = new Int32Array(partCount * 4), indices = new Uint32Array(partCount * 6), ranges = new Uint32Array(partCount * 3);
  for (let index = 0; index < partCount; index += 1) {
    cells.set([index * 2, 0, 0, 1], index * 4);
    indices.set([0, 1, 2, 0, 2, 3], index * 6);
    ranges.set([1, 0, 6], index * 3);
  }
  return pack([new TextEncoder().encode(JSON.stringify(header)).buffer, cells.buffer,
    new Float32Array(partCount * 12).buffer, new Float32Array(partCount * 12).buffer,
    new Float32Array(partCount * 12).buffer, indices.buffer, ranges.buffer]);
};
const changeHeader = (packet: TransferableBufferBundle, change: (header: HvpBodyCutWireV2) => void): TransferableBufferBundle => {
  const header = JSON.parse(new TextDecoder().decode(packet.buffers[0]!)) as HvpBodyCutWireV2;
  change(header);
  return pack([new TextEncoder().encode(JSON.stringify(header)).buffer, ...packet.buffers.slice(1)]);
};
const bodyFixture = (cells: readonly HvpStructuralCell[] = Array.from({ length: 5 }, (_, x) => ({ x, y: 0, z: 0, materialId: 1 })),
  brush: "Box" | "Sphere" = "Box", cell: readonly [number, number, number] = [2, 0, 0], edge = 1) => {
  const materials = [{ materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "wood", destructible: true, tags: null },
    { materialId: 2, densityKgPerCubicMeter: 1024, structuralClass: "stone", destructible: true, tags: null }];
  const source = ingestHvpStructuralCells("body-wire-source", cells, materials);
  const payload: HvpBodyCutPayload = { sessionId: "session", epoch: 3, commandId: "cut", ownerId: "hvp:body",
    sourceId: source.objectId, sourceDigest: source.contentHash, revision: source.objectRevision, cellCount: cells.length,
    massKg: cells.reduce((sum, value) => sum + value.materialId, 0), brush, cell, edge, materials: source.materials };
  const raw = new Int32Array(cells.flatMap(value => [value.x, value.y, value.z, value.materialId]));
  const input: TransferableBufferBundle = { buffers: [raw.buffer], ownership: "SenderToWorker", revision: contentRevision(payload.revision),
    byteLength: byteCount(raw.byteLength), views: [{ name: "cells", kind: "Int32Array", bufferIndex: 0, byteOffset: 0, elementCount: raw.length }] };
  const request: WorkerJobRequest = { jobId: workerJobId("body-wire"), jobKind: workerJobKind(HVP_BODY_CUT_JOB), targetKey: workerTargetKey(payload.ownerId),
    planningEpoch: planningEpoch(0), workerEpoch: workerEpoch(0), inputRevision: contentRevision(payload.revision),
    sourceInputDigest: hvpBodyCutInputDigest(payload, input.buffers), algorithmVersion: algorithmVersion(1), priority: "Urgent",
    deadline: jobDeadline(1), estimatedInputBytes: input.byteLength, estimatedOutputBytes: byteCount(HVP_BODY_CUT_MAX_OUTPUT), payload };
  const legacy = executeHvpBodyCutJob(request, input);
  const legacyBinding = (JSON.parse(new TextDecoder().decode(legacy.bundle.buffers[0]!)) as { binding: readonly unknown[] }).binding;
  return { payload, input, request, legacy, legacyBinding, products: decodeHvpBodyCutOutput(legacy.bundle, payload) };
};
const mixedCells = (): HvpStructuralCell[] => {
  const cells: HvpStructuralCell[] = [];
  for (let z = -1; z <= 1; z += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let x = -3; x <= 3; x += 1) { cells.push({ x, y, z, materialId: (x & 1) + 1 }); }
    }
  }
  return cells;
};

describe("body-cut V2 layout", () => {
  it("allows exact and empty ends without arithmetic overflow", () => {
    expect(checkedEnd(4, 4, 8)).toBe(8);
    expect(checkedEnd(0, 0, 0)).toBe(0);
  });
  it.each([[4, 5, 8], [Number.MAX_SAFE_INTEGER, 2, 8], [-1, 1, 8], [0, -1, 8],
    [0.5, 1, 8], [0, Infinity, 8], [0, 1, NaN]])("rejects invalid span %s/%s/%s", (offset, count, total) => {
    expect(() => checkedEnd(offset, count, total)).toThrow("Invalid body wire span");
  });
  it("reads seven full separate channels and keeps part-local index/range values", () => {
    const packet = fixture(), decoded = readHvpBodyCutWire(packet, binding);
    expect(decoded.header.parts.map(part => [part.cellOffset, part.vertexOffset, part.indexOffset, part.rangeOffset]))
      .toEqual([[0, 0, 0, 0], [1, 4, 6, 1]]);
    expect([...decoded.indices]).toEqual([0, 1, 2, 0, 2, 3, 0, 1, 2, 0, 2, 3]);
    expect([...decoded.ranges]).toEqual([1, 0, 6, 1, 0, 6]);
    expect(decoded.positions.buffer).toBe(packet.buffers[2]); // Borrowed only inside layout decoding.
    expect(new Set(packet.buffers).size).toBe(7);
  });
  it("allows empty numeric channels for a complete-removal header", () => {
    const decoded = readHvpBodyCutWire(fixture(0), binding);
    expect(decoded.header.parts).toEqual([]);
    expect(decoded.cells.length + decoded.positions.length + decoded.indices.length + decoded.ranges.length).toBe(0);
  });
  it("rejects a detached zero-length channel rather than treating it as an owned empty buffer", () => {
    const packet = fixture(0), empty = packet.buffers[1]!;
    structuredClone(empty, { transfer: [empty] });
    expect(() => readHvpBodyCutWire(packet, binding)).toThrow();
  });
  it.each(["cellOffset", "vertexOffset", "indexOffset", "rangeOffset"] as const)("rejects overlap or gaps in %s", field => {
    for (const value of [0, Number.MAX_SAFE_INTEGER]) {
      const packet = changeHeader(fixture(), header => { Reflect.set(header.parts[1]!, field, value); });
      expect(() => readHvpBodyCutWire(packet, binding)).toThrow();
    }
  });
  it("rejects trailing channel data not covered by any part", () => {
    const buffers = [...fixture().buffers];
    buffers[1] = new Int32Array(12).buffer;
    expect(() => readHvpBodyCutWire(pack(buffers), binding)).toThrow();
  });
  it("rejects unsupported wire/binding and non-closed header/part/center keys", () => {
    const changes: ((header: HvpBodyCutWireV2) => void)[] = [
      header => { Reflect.set(header, "wire", "hvp-body-cut-binary-v3"); },
      header => { Reflect.set(header, "binding", ["foreign"]); },
      header => { Reflect.set(header, "extra", true); },
      header => { Reflect.set(header.parts[0]!, "extra", true); },
      header => { Reflect.set(header.parts[0]!.center, "w", 1); }
    ];
    for (const change of changes) {
      expect(() => readHvpBodyCutWire(changeHeader(fixture(), change), binding)).toThrow();
    }
  });
  it("rejects aliases, shared buffers, resizable buffers and shadowed resizable flags", () => {
    const original = fixture();
    const alias = [...original.buffers]; alias[3] = alias[2]!;
    expect(() => readHvpBodyCutWire(pack(alias), binding)).toThrow();
    const shared = [...original.buffers]; shared[2] = new SharedArrayBuffer(shared[2]!.byteLength) as unknown as ArrayBuffer;
    expect(() => readHvpBodyCutWire(pack(shared), binding)).toThrow();
    const resizable = Reflect.construct(ArrayBuffer, [original.buffers[2]!.byteLength, { maxByteLength: 1024 }]) as ArrayBuffer;
    expect(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")!.get!.call(resizable)).toBe(true);
    for (const shadowed of [false, true]) {
      if (shadowed) { Object.defineProperty(resizable, "resizable", { value: false }); }
      const buffers = [...original.buffers]; buffers[2] = resizable;
      expect(() => readHvpBodyCutWire(pack(buffers), binding)).toThrow();
    }
  });
  it("rejects wrong view kinds, offsets and partial buffers", () => {
    const packet = fixture();
    for (const patch of [{ kind: "Uint32Array" as const }, { byteOffset: 4 }, { elementCount: 1 }]) {
      const views = packet.views.map((view, index) => index === 2 ? { ...view, ...patch } : view);
      expect(() => readHvpBodyCutWire({ ...packet, views }, binding)).toThrow();
    }
  });
  it("rejects metadata at 65537 bytes before creating numeric result arrays", () => {
    const packet = fixture();
    const text = new TextDecoder().decode(packet.buffers[0]!).padEnd(65537, " ");
    const oversized = pack([new TextEncoder().encode(text).buffer, ...packet.buffers.slice(1)]);
    expect(() => readHvpBodyCutWire(oversized, binding)).toThrow(/metadata.*BudgetExceeded/);
  });
  it("accepts exact metadata and total-byte cap boundaries (layout-only)", () => {
    const packet = fixture(1), text = new TextDecoder().decode(packet.buffers[0]!);
    const exactMetadata = pack([new TextEncoder().encode(text.padEnd(65_536, " ")).buffer, ...packet.buffers.slice(1)]);
    expect(() => readHvpBodyCutWire(exactMetadata, binding)).not.toThrow();
    const header = JSON.parse(text) as HvpBodyCutWireV2;
    const vertices = 199_680, indices = vertices * 3 / 2;
    Object.assign(header.parts[0]!, { vertexCount: vertices, indexCount: indices, faceCount: vertices / 4,
      unitFaceCount: vertices / 4, outerFaceCount: vertices / 4 });
    const numericBytes = vertices * 36 + indices * 4 + 16 + 12;
    const metadata = new TextEncoder().encode(JSON.stringify(header).padEnd(8 * 1024 * 1024 - numericBytes, " "));
    const exact = pack([metadata.buffer, new Int32Array(4).buffer, new Float32Array(vertices * 3).buffer,
      new Float32Array(vertices * 3).buffer, new Float32Array(vertices * 3).buffer, new Uint32Array(indices).buffer, new Uint32Array(3).buffer]);
    expect(exact.byteLength).toBe(8 * 1024 * 1024);
    expect(() => readHvpBodyCutWire(exact, binding)).not.toThrow();
  });
  it("rejects an exact 8MiB+1 packet before interpreting part data", () => {
    const packet = fixture(), text = new TextDecoder().decode(packet.buffers[0]!);
    const metadata = new TextEncoder().encode(text.padEnd(text.length + (1 - text.length % 4 + 4) % 4, " "));
    const buffers = [metadata.buffer, ...packet.buffers.slice(1)];
    const others = buffers.reduce((sum, buffer, index) => sum + (index === 2 ? 0 : buffer.byteLength), 0);
    buffers[2] = new ArrayBuffer(8 * 1024 * 1024 + 1 - others);
    const oversized = pack(buffers);
    expect(oversized.byteLength).toBe(8 * 1024 * 1024 + 1);
    expect(() => readHvpBodyCutWire(oversized, binding)).toThrow(/products BudgetExceeded/);
  });
});

describe("body-cut V2 encoder", () => {
  it("packs actual legacy products without global rebasing or changing input arrays", () => {
    const f = bodyFixture(), before = f.products.parts.map(part => part.mesh.positions.slice());
    const packet = encodeHvpBodyCutWire(f.products, f.legacyBinding, 1), decoded = readHvpBodyCutWire(packet, f.legacyBinding);
    expect(decoded.header.parts).toHaveLength(2);
    for (const [index, part] of f.products.parts.entries()) {
      const header = decoded.header.parts[index]!;
      expect([...decoded.indices.subarray(header.indexOffset, header.indexOffset + header.indexCount)]).toEqual([...part.mesh.indices]);
      expect(decoded.positions.subarray(header.vertexOffset * 3, (header.vertexOffset + header.vertexCount) * 3)).toEqual(part.mesh.positions);
      expect(part.mesh.positions).toEqual(before[index]);
    }
    expect(new Set(packet.buffers).size).toBe(7);
    expect(packet.byteLength).toBe(packet.buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0));
    expect(packet.contentHash).toBe(fnv1aBytes(packet.buffers));
  });
  it("encodes a real complete-removal receipt with six distinct empty numeric buffers", () => {
    const f = bodyFixture([{ x: 0, y: 0, z: 0, materialId: 1 }], "Box", [0, 0, 0]);
    expect(f.products).toMatchObject({ parts: [], removedCells: 1, removedMassKg: 1 });
    const packet = encodeHvpBodyCutWire(f.products, f.legacyBinding, 1);
    expect(new Set(packet.buffers).size).toBe(7);
    expect(packet.buffers.slice(1).every(buffer => buffer.byteLength === 0)).toBe(true);
    expect(readHvpBodyCutWire(packet, f.legacyBinding).header).toMatchObject({ parts: [], removedCells: 1, removedMassKg: 1 });
  });
  it("rejects oversized metadata and aggregate arrays before channel copies", () => {
    const f = bodyFixture(), first = f.products.parts[0]!;
    const oversized: HvpBodyCutProducts = { ...f.products, parts: [{ ...first, mesh: { ...first.mesh,
      positions: new Float32Array(720_000), normals: new Float32Array(720_000), colors: new Float32Array(720_000),
      indices: new Uint32Array(360_000), faceCount: 60_000, unitFaceCount: 60_000, outerFaceCount: 60_000, cavityFaceCount: 0 } }] };
    const copies = vi.spyOn(Float32Array.prototype, "set");
    try {
      expect(() => encodeHvpBodyCutWire(f.products, ["x".repeat(65_537)], 1)).toThrow(/metadata.*BudgetExceeded/);
      expect(() => encodeHvpBodyCutWire(oversized, f.legacyBinding, 1)).toThrow(/products BudgetExceeded/);
      expect(copies).not.toHaveBeenCalled();
    } finally { copies.mockRestore(); }
  });
});

describe("body-cut V2 semantic decoding", () => {
  it.each([65_532, 65_536])("keeps full owned index width at %i vertices (decoder-only allocation fixture)", vertexCount => {
    const f = bodyFixture(), first = f.products.parts[0]!, faceCount = vertexCount / 4;
    const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), colors = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(faceCount * 6);
    for (let face = 0; face < faceCount; face += 1) {
      positions.set(first.mesh.positions.subarray(0, 12), face * 12);
      normals.set(first.mesh.normals.subarray(0, 12), face * 12);
      colors.set(first.mesh.colors!.subarray(0, 12), face * 12);
      const v = face * 4;
      indices.set([v, v + 1, v + 2, v, v + 2, v + 3], face * 6);
    }
    // Repeated in-bounds quads exercise allocation/index policy, not source meshing or native success.
    const products: HvpBodyCutProducts = { ...f.products, parts: [{ ...first, mesh: { ...first.mesh,
      positions, normals, colors, indices, faceCount, unitFaceCount: faceCount, outerFaceCount: faceCount, cavityFaceCount: 0,
      materialRanges: [{ slot: 1, startIndex: 0, indexCount: indices.length }] } }, f.products.parts[1]!] };
    const packet = encodeHvpBodyCutWire(products, f.legacyBinding, 1), decoded = decodeHvpBodyCutOutput(packet, f.payload).parts[0]!;
    expect(decoded.mesh.indices).toBeInstanceOf(vertexCount <= 65_535 ? Uint16Array : Uint32Array);
    expect(decoded.mesh.indices[indices.length - 1]).toBe(vertexCount - 1);
    expect(decoded.mesh.indices.byteOffset).toBe(0);
    expect(decoded.mesh.indices.byteLength).toBe(decoded.mesh.indices.buffer.byteLength);
    expect(packet.buffers).not.toContain(decoded.mesh.indices.buffer);
  });
  it("preserves every actual box product, local array byte and mechanical field", () => {
    const f = bodyFixture(), packet = encodeHvpBodyCutWire(f.products, f.legacyBinding, 1);
    const decoded = decodeHvpBodyCutOutput(packet, f.payload);
    expect(decoded).toEqual(f.products);
    for (const [index, part] of decoded.parts.entries()) {
      for (const field of ["positions", "normals", "colors", "indices"] as const) {
        const actual = part.mesh[field]!, expected = f.products.parts[index]!.mesh[field]!;
        expect(new Uint8Array(actual.buffer)).toEqual(new Uint8Array(expected.buffer));
        expect(actual.byteOffset).toBe(0);
        expect(actual.byteLength).toBe(actual.buffer.byteLength);
        expect(packet.buffers).not.toContain(actual.buffer);
      }
      expect(part.mesh.indices).toBeInstanceOf(Uint16Array);
    }
  });
  it("preserves sphere selection, mixed materials and negative object coordinates", () => {
    const f = bodyFixture(mixedCells(), "Sphere", [0, 0, 0], 2);
    const decoded = decodeHvpBodyCutOutput(encodeHvpBodyCutWire(f.products, f.legacyBinding, 1), f.payload);
    expect(decoded).toEqual(f.products);
    expect(decoded.removedCells).toBe(7);
    expect(decoded.parts.some(part => part.cells.some(cell => cell.x < 0))).toBe(true);
  }, 30_000);
  it("preserves the real complete-removal receipt", () => {
    const f = bodyFixture([{ x: 0, y: 0, z: 0, materialId: 1 }], "Box", [0, 0, 0]);
    expect(decodeHvpBodyCutOutput(encodeHvpBodyCutWire(f.products, f.legacyBinding, 1), f.payload)).toEqual(f.products);
  });
  it("keeps the original absolute mass and COM tolerances", () => {
    const f = bodyFixture(), packet = encodeHvpBodyCutWire(f.products, f.legacyBinding, 1);
    const within = changeHeader(packet, header => {
      Reflect.set(header.parts[0]!, "massKg", header.parts[0]!.massKg + 5e-9);
      Reflect.set(header.parts[0]!.center, "x", header.parts[0]!.center.x + 5e-10);
    });
    expect(decodeHvpBodyCutOutput(within, f.payload).parts[0]!.massKg).toBe(f.products.parts[0]!.massKg);
    for (const field of ["massKg", "center"] as const) {
      const outside = changeHeader(packet, header => {
        if (field === "massKg") { Reflect.set(header.parts[0]!, field, header.parts[0]!.massKg + 2e-8); }
        else { Reflect.set(header.parts[0]!.center, "x", header.parts[0]!.center.x + 2e-9); }
      });
      expect(() => decodeHvpBodyCutOutput(outside, f.payload)).toThrow(/mass\/source mismatch/);
    }
  });
  it.each(["ownerId", "sourceDigest", "massKg", "center", "sourceBytes", "removedCells", "removedMassKg"] as const)("rejects forged %s despite a fresh transport hash", field => {
    const f = bodyFixture(), packet = encodeHvpBodyCutWire(f.products, f.legacyBinding, 1);
    const changed = changeHeader(packet, header => {
      if (field === "removedMassKg" || field === "removedCells") { Reflect.set(header, field, header[field] + 1); }
      else if (field === "ownerId" || field === "sourceDigest") { Reflect.set(header.parts[0]!, field, "foreign"); }
      else if (field === "center") { Reflect.set(header.parts[0]!.center, "x", header.parts[0]!.center.x + 0.1); }
      else { Reflect.set(header.parts[0]!, field, header.parts[0]![field] + 1); }
    });
    expect(changed.contentHash).toBe(fnv1aBytes(changed.buffers));
    expect(() => readHvpBodyCutWire(changed, f.legacyBinding)).not.toThrow();
    expect(() => decodeHvpBodyCutOutput(changed, f.payload)).toThrow();
  });
  it.each(["positionNaN", "positionInfinity", "normal", "color", "index", "duplicate", "removed", "material", "rangeSlot", "rangeStart", "rangeCount"])("rejects %s with unchanged valid layout and refreshed hash", fault => {
    const f = bodyFixture(), packet = encodeHvpBodyCutWire(f.products, f.legacyBinding, 1);
    const wire = readHvpBodyCutWire(packet, f.legacyBinding);
    if (fault === "positionNaN") { wire.positions[0] = NaN; }
    else if (fault === "positionInfinity") { wire.positions[0] = Infinity; }
    else if (fault === "normal") { wire.normals[0] = 0.5; }
    else if (fault === "color") { wire.colors[0] = 2; }
    else if (fault === "index") { wire.indices[0] = wire.header.parts[0]!.vertexCount; }
    else if (fault === "duplicate") { wire.cells.set(wire.cells.subarray(4, 8), 0); }
    else if (fault === "removed") { wire.cells[0] = 2; }
    else if (fault === "material") { wire.cells[3] = 99; }
    else if (fault === "rangeSlot") { wire.ranges[0] = 99; }
    else if (fault === "rangeStart") { wire.ranges[1] = 1; }
    else { wire.ranges[2] = wire.header.parts[0]!.indexCount - 6; }
    const changed = pack([...packet.buffers]);
    expect(() => readHvpBodyCutWire(changed, f.legacyBinding)).not.toThrow();
    expect(() => decodeHvpBodyCutOutput(changed, f.payload)).toThrow();
  });
  it("rejects a JSON numeric overflow in COM, not only a JSON null", () => {
    const f = bodyFixture(), packet = encodeHvpBodyCutWire(f.products, f.legacyBinding, 1);
    const original = new TextDecoder().decode(packet.buffers[0]!);
    const text = original.replace(/"center":\{"x":[^,]+/, '"center":{"x":1e400');
    expect(text).not.toBe(original);
    const changed = pack([new TextEncoder().encode(text).buffer, ...packet.buffers.slice(1)]);
    expect(() => decodeHvpBodyCutOutput(changed, f.payload)).toThrow();
  });
  it("owns returned arrays/cells and validates later transport mutations again", () => {
    const f = bodyFixture(), packet = encodeHvpBodyCutWire(f.products, f.legacyBinding, 1);
    const decoded = decodeHvpBodyCutOutput(packet, f.payload), first = decoded.parts[0]!;
    const before = first.mesh.positions.slice(), cell = { ...first.cells[0]! };
    new Float32Array(packet.buffers[2]!)[0] = NaN;
    new Int32Array(packet.buffers[1]!)[0] = 99;
    expect(first.mesh.positions).toEqual(before);
    expect(first.cells[0]).toEqual(cell);
    expect(Object.isFrozen(first.cells[0])).toBe(true);
    expect(() => decodeHvpBodyCutOutput(pack([...packet.buffers]), f.payload)).toThrow();
  });
});

describe("body-cut dual job path", () => {
  it("rejects an oversized source-mesh set before retaining more parts or aggregating buffers", () => {
    const f = bodyFixture(), mesh = f.products.parts[0]!.mesh;
    const oversized = { ...mesh, positions: new Float32Array(720_000), normals: new Float32Array(720_000), colors: new Float32Array(720_000),
      indices: new Uint32Array(360_000), faceCount: 60_000, unitFaceCount: 60_000, outerFaceCount: 60_000, cavityFaceCount: 0 };
    const makeMesh = vi.spyOn(bodyMeshes, "meshHvpBodyCells").mockReturnValue(oversized);
    const aggregate = vi.spyOn(bodyWire, "encodeHvpBodyCutWire");
    try {
      expect(() => executeHvpBodyCutJob({ ...f.request, algorithmVersion: algorithmVersion(2) }, f.input)).toThrow(/products BudgetExceeded/);
      expect(makeMesh).toHaveBeenCalledTimes(1);
      expect(aggregate).not.toHaveBeenCalled();
    } finally { aggregate.mockRestore(); makeMesh.mockRestore(); }
  });
  it.each(["box", "sphere", "complete"])("executes actual V1/V2 jobs with identical %s products", scenario => {
    const f = scenario === "sphere" ? bodyFixture(mixedCells(), "Sphere", [0, 0, 0], 2)
      : scenario === "complete" ? bodyFixture([{ x: 0, y: 0, z: 0, materialId: 1 }], "Box", [0, 0, 0]) : bodyFixture();
    const binary = executeHvpBodyCutJob({ ...f.request, algorithmVersion: algorithmVersion(2) }, f.input);
    expect(f.legacy.result.algorithmVersion).toBe(1);
    expect(f.legacy.bundle.views.map(view => view.name)).toEqual(["products"]);
    expect(binary.result.algorithmVersion).toBe(2);
    expect(binary.bundle.views.map(view => view.name)).toEqual(channels.map(channel => channel[0]));
    expect(decodeHvpBodyCutOutput(binary.bundle, f.payload)).toEqual(f.products);
    expect(f.input.buffers[0]!.byteLength).toBe(f.payload.cellCount * 16);
    expect(() => executeHvpBodyCutJob({ ...f.request, algorithmVersion: algorithmVersion(3) }, f.input)).toThrow(/binding mismatch/);
  }, 30_000); // Two full source/mechanics pipelines, not a CI latency assertion.
  it("leaves algorithm/hash/epoch admission at the unchanged result gate", () => {
    const f = bodyFixture(), binary = executeHvpBodyCutJob({ ...f.request, algorithmVersion: algorithmVersion(2) }, f.input);
    const expectation = { ...f.request, cancelled: false, outputRevision: contentRevision(1), maximumOutputBytes: byteCount(HVP_BODY_CUT_MAX_OUTPUT) };
    expect(integrateWorkerResult(expectation, binary.result, binary.bundle).kind).toBe("RejectedAlgorithmMismatch");
    const matching = { ...expectation, algorithmVersion: algorithmVersion(2) };
    expect(integrateWorkerResult(matching, binary.result, binary.bundle).kind).toBe("Accepted");
    const altered = [...binary.bundle.buffers]; altered[1] = altered[1]!.slice(0);
    new Int32Array(altered[1]!)[0] += 1;
    expect(integrateWorkerResult(matching, binary.result, { ...binary.bundle, buffers: altered }).kind).toBe("RejectedContentHashMismatch");
    expect(integrateWorkerResult({ ...matching, workerEpoch: workerEpoch(1) }, binary.result, binary.bundle).kind).toBe("RejectedStaleWorkerEpoch");
  });
  it("transfers all seven buffers through the existing real runtime/pool protocol", async () => {
    let outputDetached = false, transferredBuffers = 0;
    const pool = new WorkerPool({ workerCount: 1, queueCapacity: 32, transportFactory: () => {
      let closed = false;
      const runtime = new StreamingWorkerRuntime((message, transfer = []) => {
        const cloned = structuredClone(message, { transfer: [...transfer] });
        if (message.type === "JobOutputData") {
          transferredBuffers = transfer.length;
          outputDetached = message.bundle.buffers.every(buffer => buffer.byteLength === 0);
        }
        queueMicrotask(() => { if (!closed) { transport.onmessage?.({ data: cloned } as MessageEvent<unknown>); } });
      });
      const transport: WorkerTransport = { onmessage: null, onerror: null, onmessageerror: null,
        postMessage(message, transfer = []) {
          const cloned = structuredClone(message, { transfer });
          queueMicrotask(() => { if (!closed) { runtime.handleMessage(cloned); } });
        },
        terminate() { closed = true; }
      };
      return transport;
    } });
    try {
      await pool.start();
      const f = bodyFixture();
      const terminal = await pool.enqueue({ ...f.request, algorithmVersion: algorithmVersion(2) }, f.input).result;
      if (terminal.kind !== "Completed") { throw new Error(JSON.stringify(terminal)); }
      expect(pool.isAcceptedCompletedTerminal(terminal)).toBe(true);
      expect(f.input.buffers[0]!.byteLength).toBe(0);
      expect(transferredBuffers).toBe(7);
      expect(outputDetached).toBe(true);
      expect(decodeHvpBodyCutOutput(terminal.output, f.payload)).toEqual(f.products);
    } finally { await pool.shutdown(); }
  });
});
