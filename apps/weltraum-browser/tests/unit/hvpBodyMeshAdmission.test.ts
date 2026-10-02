import { beforeAll, describe, expect, it } from "vitest";
import { ingestHvpStructuralCells, type HvpStructuralCell } from "../../src/hestia-prototype/terrain/structuralIngest";
import { prepareHvpLocalBodyCut } from "../../src/hestia-prototype/physics/bodyCutPlan";
import { meshHvpBodyCells } from "../../src/hestia-prototype/presentation/terrainFragment";
import {verifyHvpOwnedBodyMeshSteps} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import type { HvpCompactMesh } from "../../src/hvp/hvpCoastMesher";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId,
  workerJobKind, workerTargetKey } from "../../src/workers/ids";
import { fnv1aBytes, type TransferableBufferBundle, type WorkerJobRequest } from "../../src/workers/protocol";
import { decodeHvpBodyCutOutput, executeHvpBodyCutJob, HVP_BODY_CUT_JOB, HVP_BODY_CUT_MAX_OUTPUT,
  hvpBodyCutInputDigest, type HvpBodyCutPayload, type HvpBodyCutProducts } from "../../src/workers/hvpBodyCutJob";
import { readHvpBodyCutWire, type HvpBodyCutWireV2 } from "../../src/workers/hvpBodyCutWire";
import { integrateWorkerResult } from "../../src/workers/resultGate";

const materials = [
  { materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "wood", destructible: true, tags: null },
  { materialId: 2, densityKgPerCubicMeter: 1024, structuralClass: "stone", destructible: true, tags: null }
];
const channelLayout = [
  ["metadata", "Uint8Array", 1], ["cells", "Int32Array", 4], ["positions", "Float32Array", 4],
  ["normals", "Float32Array", 4], ["colors", "Float32Array", 4], ["indices", "Uint32Array", 4], ["ranges", "Uint32Array", 4]
] as const;

interface ExpectedPart {
  readonly local:ReturnType<typeof prepareHvpLocalBodyCut>["plan"]["parts"][number];
  readonly ownerId: string;
  readonly sourceDigest: string;
  readonly center: Readonly<{ x: number; y: number; z: number }>;
  readonly massKg: number;
  readonly cells: readonly HvpStructuralCell[];
  readonly mesh: HvpCompactMesh;
}

interface BodyFixture {
  readonly payload: HvpBodyCutPayload;
  readonly packet: TransferableBufferBundle;
  readonly request: WorkerJobRequest;
  readonly result: ReturnType<typeof executeHvpBodyCutJob>["result"];
  readonly ownerParts: readonly ExpectedPart[];
  readonly removedCells: number;
  readonly removedMassKg: number;
}

const pack = (buffers: ArrayBuffer[]): TransferableBufferBundle => ({
  buffers,
  ownership: "WorkerToConsumer",
  revision: contentRevision(1),
  byteLength: byteCount(buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0)),
  contentHash: fnv1aBytes(buffers),
  views: buffers.map((buffer, index) => ({
    name: channelLayout[index]![0], kind: channelLayout[index]![1], bufferIndex: index, byteOffset: 0,
    elementCount: buffer.byteLength / channelLayout[index]![2]
  }))
});

const readHeader = (packet: TransferableBufferBundle): HvpBodyCutWireV2 =>
  JSON.parse(new TextDecoder().decode(packet.buffers[0]!)) as HvpBodyCutWireV2;

function makeFixture(sourceId: string, cells: readonly HvpStructuralCell[], cutCell: readonly [number, number, number], edge: number): BodyFixture {
  const source = ingestHvpStructuralCells(sourceId, cells, materials);
  const massKg = cells.reduce((sum, cell) => sum + (cell.materialId === 1 ? 1 : 2), 0);
  const payload: HvpBodyCutPayload = {
    sessionId: "mesh-admission-test", epoch: 1, commandId: "body-cut", ownerId: "body-owner",
    sourceId: source.objectId, sourceDigest: source.contentHash, revision: source.objectRevision,
    cellCount: cells.length, massKg, brush: "Box", cell: cutCell, edge, materials: source.materials
  };

  // This is the oracle boundary: expectation comes from Physics-local frozen child inputs, before
  // the independently reconstructed compiler packet or any decoded worker data exists.
  const local = prepareHvpLocalBodyCut(source, cutCell, payload.commandId, edge, "Box");
  const ownerParts = Object.freeze(local.plan.parts.map(part => {
    const center = part.recipe.mass.centerOfMassMeters!;
    const sourceDigest = part.recipe.source.contentHash;
    return Object.freeze({ local:part,ownerId: part.ownerId, sourceDigest, center, massKg: part.recipe.mass.totalMassKg,
      cells: part.cells, mesh: meshHvpBodyCells(part.cells, center, sourceDigest) });
  }));

  const raw = new Int32Array(cells.flatMap(cell => [cell.x, cell.y, cell.z, cell.materialId]));
  const input: TransferableBufferBundle = {
    buffers: [raw.buffer], ownership: "SenderToWorker", revision: contentRevision(payload.revision),
    byteLength: byteCount(raw.byteLength),
    views: [{ name: "cells", kind: "Int32Array", bufferIndex: 0, byteOffset: 0, elementCount: raw.length }]
  };
  const request: WorkerJobRequest = {
    jobId: workerJobId("body-mesh-oracle"), jobKind: workerJobKind(HVP_BODY_CUT_JOB), targetKey: workerTargetKey(payload.ownerId),
    planningEpoch: planningEpoch(0), workerEpoch: workerEpoch(0), inputRevision: contentRevision(payload.revision),
    sourceInputDigest: hvpBodyCutInputDigest(payload, input.buffers), algorithmVersion: algorithmVersion(2), priority: "Urgent",
    deadline: jobDeadline(1), estimatedInputBytes: input.byteLength, estimatedOutputBytes: byteCount(HVP_BODY_CUT_MAX_OUTPUT), payload
  };
  const execution = executeHvpBodyCutJob(request, input);
  return { payload, packet: execution.bundle, request, result: execution.result, ownerParts,
    removedCells: local.plan.removedCells, removedMassKg: local.plan.removedMassKg };
}

function bytes(values: Float32Array | Uint16Array | Uint32Array): Uint8Array {
  return new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
}

function expectMeshEqual(expected: HvpCompactMesh, actual: HvpCompactMesh): void {
  expect(actual.faceCount).toBe(expected.faceCount);
  expect(actual.unitFaceCount).toBe(expected.unitFaceCount);
  expect(actual.outerFaceCount).toBe(expected.outerFaceCount);
  expect(actual.cavityFaceCount).toBe(expected.cavityFaceCount);
  expect(actual.algorithmVersion).toBe(expected.algorithmVersion);
  expect(actual.sourceDigest).toBe(expected.sourceDigest);
  expect(actual.tempEstimateBytes).toBe(expected.tempEstimateBytes);
  expect(bytes(actual.positions)).toEqual(bytes(expected.positions));
  expect(bytes(actual.normals)).toEqual(bytes(expected.normals));
  expect(actual.colors).not.toBeNull();
  expect(expected.colors).not.toBeNull();
  if (actual.colors === null || expected.colors === null) {
    throw new Error("Body mesh oracle requires AO colors");
  }
  expect(bytes(actual.colors)).toEqual(bytes(expected.colors));
  // V2 transports Uint32 indices; decoding may correctly narrow small local meshes to Uint16.
  expect(actual.indices).toBeInstanceOf(expected.positions.length / 3 > 65_535 ? Uint32Array : Uint16Array);
  expect([...actual.indices]).toEqual([...expected.indices]);
  expect(actual.materialRanges).toEqual(expected.materialRanges);
  expect(actual.boundsMeters).toEqual(expected.boundsMeters);
}

function decodeAtSemanticBoundary(fixture: BodyFixture, packet: TransferableBufferBundle): HvpBodyCutProducts {
  const binding = readHeader(packet).binding;
  expect(() => readHvpBodyCutWire(packet, binding)).not.toThrow();
  return decodeHvpBodyCutOutput(packet, fixture.payload);
}

function expectMatchesOwner(fixture: BodyFixture, products: HvpBodyCutProducts): void {
  expect(products.removedCells).toBe(fixture.removedCells);
  expect(products.removedMassKg).toBe(fixture.removedMassKg);
  expect(products.parts).toHaveLength(fixture.ownerParts.length);
  for (const [index, expected] of fixture.ownerParts.entries()) {
    const actual = products.parts[index]!;
    expect(actual.ownerId).toBe(expected.ownerId);
    expect(actual.sourceDigest).toBe(expected.sourceDigest);
    expect(actual.center).toEqual(expected.center);
    expect(actual.massKg).toBe(expected.massKg);
    expect(actual.cells).toEqual(expected.cells);
    expectMeshEqual(expected.mesh, actual.mesh);
    expect(()=>verifyOwnerMesh(expected,actual.mesh)).not.toThrow();
  }
}

function verifyOwnerMesh(expected:ExpectedPart,actual:HvpCompactMesh):void {
  const steps=verifyHvpOwnedBodyMeshSteps(expected.local,actual);
  for(;;){if(steps.next().done){return;}}
}

function editPacket(packet: TransferableBufferBundle,
  edit: (buffers: ArrayBuffer[], header: HvpBodyCutWireV2, wire: ReturnType<typeof readHvpBodyCutWire>) => void
): TransferableBufferBundle {
  const buffers = packet.buffers.map(buffer => buffer.slice(0));
  const copy = pack(buffers);
  const header = readHeader(copy);
  const wire = readHvpBodyCutWire(copy, header.binding);
  edit(buffers, header, wire);
  buffers[0] = new TextEncoder().encode(JSON.stringify(header)).buffer;
  return pack(buffers);
}

function quadHasNormal(mesh: HvpCompactMesh, face: number, normal: readonly [number, number, number]): boolean {
  const start = face * 12;
  for (let vertex = 0; vertex < 4; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      if (mesh.normals[start + vertex * 3 + axis] !== normal[axis]) {
        return false;
      }
    }
  }
  return true;
}

function worldQuadBounds(mesh: HvpCompactMesh, face: number, center: ExpectedPart["center"]): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let vertex = 0; vertex < 4; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = mesh.positions[face * 12 + vertex * 3 + axis]! + [center.x, center.y, center.z][axis]!;
      min[axis] = Math.min(min[axis]!, value);
      max[axis] = Math.max(max[axis]!, value);
    }
  }
  return { min, max };
}

function findExteriorQuad(mesh: HvpCompactMesh, center: ExpectedPart["center"], minX: number): number {
  for (let face = 0; face < mesh.faceCount; face += 1) {
    const bounds = worldQuadBounds(mesh, face, center);
    if (quadHasNormal(mesh, face, [-1, 0, 0]) && Math.abs(bounds.min[0]! - minX) < 1e-6
      && Math.abs(bounds.max[0]! - minX) < 1e-6) {
      return face;
    }
  }
  throw new Error("Fixture has no exposed minimum-X quad");
}

function findCavityQuad(mesh: HvpCompactMesh, center: ExpectedPart["center"]): number {
  const x = -1 * 0.125;
  for (let face = 0; face < mesh.faceCount; face += 1) {
    const bounds = worldQuadBounds(mesh, face, center);
    if (quadHasNormal(mesh, face, [1, 0, 0]) && Math.abs(bounds.min[0]! - x) < 1e-6
      && Math.abs(bounds.max[0]! - x) < 1e-6 && Math.abs(bounds.min[1]!) < 1e-6
      && Math.abs(bounds.max[1]! - 0.125) < 1e-6 && Math.abs(bounds.min[2]!) < 1e-6
      && Math.abs(bounds.max[2]! - 0.125) < 1e-6) {
      return face;
    }
  }
  throw new Error("Fixture has no enclosed-cavity quad");
}

function removeQuad(packet: TransferableBufferBundle, face: number): TransferableBufferBundle {
  return editPacket(packet, (buffers, header, wire) => {
    expect(header.parts).toHaveLength(1);
    const part = header.parts[0]!;
    expect(part.vertexOffset).toBe(0);
    expect(part.indexOffset).toBe(0);
    expect(part.rangeOffset).toBe(0);
    const vertexStart = face * 4;
    const floatStart = vertexStart * 3;
    const indexStart = face * 6;
    const dropFloatRange = (values: Float32Array, start: number, count: number): Float32Array<ArrayBuffer> => {
      const next = new Float32Array(values.length - count);
      next.set(values.subarray(0, start));
      next.set(values.subarray(start + count), start);
      return next;
    };
    buffers[2] = dropFloatRange(wire.positions, floatStart, 12).buffer;
    buffers[3] = dropFloatRange(wire.normals, floatStart, 12).buffer;
    buffers[4] = dropFloatRange(wire.colors, floatStart, 12).buffer;
    const indices = new Uint32Array(wire.indices.length - 6);
    let write = 0;
    for (let index = 0; index < wire.indices.length; index += 1) {
      if (index >= indexStart && index < indexStart + 6) {
        continue;
      }
      const value = wire.indices[index]!;
      indices[write++] = value >= vertexStart + 4 ? value - 4 : value;
    }
    buffers[5] = indices.buffer;

    const ranges: number[] = [];
    let covered = false;
    for (let range = 0; range < part.rangeCount; range += 1) {
      const offset = range * 3;
      const slot = wire.ranges[offset]!;
      const start = wire.ranges[offset + 1]!;
      const count = wire.ranges[offset + 2]!;
      if (indexStart >= start && indexStart < start + count) {
        covered = true;
        if (count > 6) {
          ranges.push(slot, start, count - 6);
        }
      } else {
        ranges.push(slot, start > indexStart ? start - 6 : start, count);
      }
    }
    if (!covered) {
      throw new Error("Removed quad was outside every material range");
    }
    buffers[6] = new Uint32Array(ranges).buffer;
    Reflect.set(part, "vertexCount", part.vertexCount - 4);
    Reflect.set(part, "indexCount", part.indexCount - 6);
    Reflect.set(part, "faceCount", part.faceCount - 1);
    // The current body mesher classifies all emitted quads as outer; preserve its counter convention.
    Reflect.set(part, "outerFaceCount", part.outerFaceCount - 1);
    if (ranges.length / 3 !== part.rangeCount) {
      Reflect.set(part, "rangeCount", ranges.length / 3);
    }
  });
}

// The current decoder checks transport/layout and mesh shape, not complete source-surface coverage.
// The standalone owner validator rejects these false accepts; it is not yet wired into production.
function expectOwnerOracleRejects(fixture: BodyFixture, packet: TransferableBufferBundle): void {
  const decoded = decodeAtSemanticBoundary(fixture, packet);
  expect(decoded.parts).toHaveLength(fixture.ownerParts.length);
  expect(() => expectMeshEqual(fixture.ownerParts[0]!.mesh, decoded.parts[0]!.mesh)).toThrow();
  expect(()=>verifyOwnerMesh(fixture.ownerParts[0]!,decoded.parts[0]!.mesh)).toThrow("Foreign local body mesh geometry");
}

function shellWithCavityAndRemovableCell(): HvpStructuralCell[] {
  const cells: HvpStructuralCell[] = [];
  for (let z = -1; z <= 1; z += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let x = -2; x <= 0; x += 1) {
        if (x === -1 && y === 0 && z === 0) {
          continue;
        }
        // An exterior notch gives nonuniform AO without opening the enclosed central cavity.
        if(x===-2&&y===1&&z===1){continue;}
        cells.push({ x, y, z, materialId: (x + y + z) % 2 === 0 ? 1 : 2 });
      }
    }
  }
  cells.push({ x: 1, y: 0, z: 0, materialId: 2 });
  return cells;
}

function foreignCellFixture(): { cells: HvpStructuralCell[]; foreign: HvpStructuralCell[] } {
  const cells: HvpStructuralCell[] = [], foreign: HvpStructuralCell[] = [];
  for (let z = -1; z <= 0; z += 1) {
    for (let y = -1; y <= 0; y += 1) {
      for (let x = -3; x <= -2; x += 1) {
        if (!((x === -3 && y === -1 && z === -1) || (x === -2 && y === 0 && z === 0))) {
          cells.push({ x, y, z, materialId: 1 });
        }
        if (!((x === -3 && y === -1 && z === 0) || (x === -2 && y === 0 && z === -1))) {
          foreign.push({ x, y, z, materialId: 1 });
        }
      }
    }
  }
  cells.push({ x: -4, y: -1, z: 0, materialId: 1 });
  return { cells, foreign };
}

describe("body-cut mesh admission oracle", () => {
  let fixture: BodyFixture;

  beforeAll(() => {
    fixture = makeFixture("mesh-oracle-shell", shellWithCavityAndRemovableCell(), [1, 0, 0], 1);
  });

  it("matches every decoded V2 mesh field to the owner-local immutable child plan", () => {
    expect(fixture.ownerParts).toHaveLength(1);
    const owner = fixture.ownerParts[0]!;
    expect(Object.isFrozen(owner.cells)).toBe(true);
    expect(owner.cells.some(cell => cell.x < 0)).toBe(true);
    expect(new Set(owner.cells.map(cell => cell.materialId))).toEqual(new Set([1, 2]));
    expect(Object.values(owner.center).some(value => Math.abs(value / 0.125 - Math.round(value / 0.125)) > 1e-8)).toBe(true);
    expectMatchesOwner(fixture, decodeAtSemanticBoundary(fixture, fixture.packet));
  });

  it("rejects an omitted exposed exterior quad after valid layout/count/range updates", () => {
    const owner = fixture.ownerParts[0]!;
    const minX = Math.min(...owner.cells.map(cell => cell.x)) * 0.125;
    const face = findExteriorQuad(owner.mesh, owner.center, minX);
    expectOwnerOracleRejects(fixture, removeQuad(fixture.packet, face));
  });

  it("rejects an omitted enclosed-cavity quad after valid layout/count/range updates", () => {
    const face = findCavityQuad(fixture.ownerParts[0]!.mesh, fixture.ownerParts[0]!.center);
    expectOwnerOracleRejects(fixture, removeQuad(fixture.packet, face));
  });

  it("rejects a duplicate-for-missing quad without changing counts", () => {
    const changed = editPacket(fixture.packet, (_buffers, header, wire) => {
      expect(header.parts).toHaveLength(1);
      const part = header.parts[0]!;
      const sourceFace = 0, targetFace = 1;
      wire.positions.copyWithin(targetFace * 12, sourceFace * 12, sourceFace * 12 + 12);
      wire.normals.copyWithin(targetFace * 12, sourceFace * 12, sourceFace * 12 + 12);
      wire.colors.copyWithin(targetFace * 12, sourceFace * 12, sourceFace * 12 + 12);
      const sourceVertex = sourceFace * 4, targetVertex = targetFace * 4;
      for (let index = 0; index < 6; index += 1) {
        wire.indices[targetFace * 6 + index] = targetVertex + wire.indices[sourceFace * 6 + index]! - sourceVertex;
      }
      expect(part.faceCount).toBe(fixture.ownerParts[0]!.mesh.faceCount);
      expect(part.indexCount).toBe(fixture.ownerParts[0]!.mesh.indices.length);
    });
    expectOwnerOracleRejects(fixture, changed);
  });

  it("rejects flipped winding", () => {
    const changed = editPacket(fixture.packet, (_buffers, header, wire) => {
      expect(header.parts).toHaveLength(1);
      [wire.indices[0], wire.indices[1]] = [wire.indices[1]!, wire.indices[0]!];
    });
    expectOwnerOracleRejects(fixture, changed);
  });

  it("rejects a degenerate quad whose positions remain finite and in source bounds", () => {
    const changed = editPacket(fixture.packet, (_buffers, header, wire) => {
      expect(header.parts).toHaveLength(1);
      wire.positions.set(wire.positions.subarray(0, 3), 3);
    });
    expectOwnerOracleRejects(fixture, changed);
  });

  it("rejects altered but in-range AO", () => {
    const changed = editPacket(fixture.packet, (_buffers, header, wire) => {
      expect(header.parts).toHaveLength(1);
      const value = wire.colors[0]!;
      wire.colors[0] = value === 1 ? 0.875 : Math.min(1, value + 0.125);
      expect(wire.colors[0]).not.toBe(value);
    });
    expectOwnerOracleRejects(fixture, changed);
  });

  it("rejects a changed AO-shaded quad diagonal", () => {
    const mesh = fixture.ownerParts[0]!.mesh;
    if (mesh.colors === null) {
      throw new Error("Fixture must carry AO colors");
    }
    let face = -1;
    for (let candidate = 0; candidate < mesh.faceCount; candidate += 1) {
      const levels = Array.from({ length: 4 }, (_, vertex) => mesh.colors![candidate * 12 + vertex * 3]!);
      if (new Set(levels).size > 1) {
        face = candidate;
        break;
      }
    }
    expect(face).toBeGreaterThanOrEqual(0);
    const changed = editPacket(fixture.packet, (_buffers, header, wire) => {
      expect(header.parts).toHaveLength(1);
      const base = face * 4;
      const normal = [base, base + 1, base + 2, base, base + 2, base + 3];
      const flipped = [base, base + 1, base + 3, base + 1, base + 2, base + 3];
      const start = face * 6;
      const current = [...wire.indices.subarray(start, start + 6)];
      const isNormal = current.every((value, index) => value === normal[index]);
      const isFlipped = current.every((value, index) => value === flipped[index]);
      expect(isNormal || isFlipped).toBe(true);
      wire.indices.set(isNormal ? flipped : normal, start);
    });
    expectOwnerOracleRejects(fixture, changed);
  });

  it("rejects a wrong but known material range", () => {
    const changed = editPacket(fixture.packet, (_buffers, header, wire) => {
      expect(header.parts).toHaveLength(1);
      const slotOffset = header.parts[0]!.rangeOffset * 3;
      wire.ranges[slotOffset] = wire.ranges[slotOffset] === 1 ? 2 : 1;
    });
    expectOwnerOracleRejects(fixture, changed);
  });

  it("uses a refreshed wire hash only to reach mesh admission, not as geometry proof", () => {
    const changed = editPacket(fixture.packet, (_buffers, header, wire) => {
      expect(header.parts).toHaveLength(1);
      wire.positions[0] = wire.positions[0]! + 0.03125;
    });
    const staleHash = { ...changed, contentHash: fixture.packet.contentHash! };
    const expectation = { ...fixture.request, cancelled: false, outputRevision: fixture.result.outputRevision,
      maximumOutputBytes: byteCount(HVP_BODY_CUT_MAX_OUTPUT) };
    expect(integrateWorkerResult(expectation, fixture.result, staleHash).kind).toBe("RejectedContentHashMismatch");
    expect(changed.contentHash).toBe(fnv1aBytes(changed.buffers));
    expect(integrateWorkerResult(expectation, { ...fixture.result, contentHash: changed.contentHash! }, changed).kind).toBe("Accepted");
    expectOwnerOracleRejects(fixture, changed);
  });

  it("keeps owner expectation independent of foreign child cells paired with a fake digest", () => {
    const { cells, foreign } = foreignCellFixture();
    const small = makeFixture("mesh-oracle-foreign", cells, [-4, -1, 0], 1);
    expect(small.ownerParts).toHaveLength(1);
    const owner = small.ownerParts[0]!;
    const ownerPositions = bytes(owner.mesh.positions).slice();
    const fakeDigest = "fnv1a64-v1:0000000000000000";
    expect(fakeDigest).not.toBe(owner.sourceDigest);
    const changed = editPacket(small.packet, (_buffers, header, wire) => {
      const part = header.parts[0]!;
      expect(part.cellCount).toBe(foreign.length);
      for (const [index, cell] of foreign.entries()) {
        wire.cells.set([cell.x, cell.y, cell.z, cell.materialId], (part.cellOffset + index) * 4);
      }
      Reflect.set(part, "sourceDigest", fakeDigest);
    });
    const foreignDecoded = decodeAtSemanticBoundary(small, changed);
    expect(foreignDecoded.parts[0]!.cells).not.toEqual(owner.cells);
    expect(foreignDecoded.parts[0]!.sourceDigest).toBe(fakeDigest);
    expect(foreignDecoded.parts[0]!.center).toEqual(owner.center);
    expect(foreignDecoded.parts[0]!.massKg).toBe(owner.massKg);
    expect(bytes(owner.mesh.positions)).toEqual(ownerPositions);
    expect(() => expectMeshEqual(owner.mesh, foreignDecoded.parts[0]!.mesh)).toThrow();
    expect(()=>verifyOwnerMesh(owner,foreignDecoded.parts[0]!.mesh)).toThrow("Foreign local body mesh geometry");
    // Existing decoding accepts this source/hash mismatch; the owner-local test oracle does not adopt it.
  });

  it("accepts the real V2 complete-removal receipt with zero children", () => {
    const complete = makeFixture("mesh-oracle-complete", [{ x: 0, y: 0, z: 0, materialId: 1 }], [0, 0, 0], 1);
    const decoded = decodeAtSemanticBoundary(complete, complete.packet);
    expect(complete.ownerParts).toEqual([]);
    expect(decoded.parts).toEqual([]);
    expect(decoded.removedCells).toBe(1);
    expect(decoded.removedMassKg).toBe(1);
    expectMatchesOwner(complete, decoded);
  });
});
