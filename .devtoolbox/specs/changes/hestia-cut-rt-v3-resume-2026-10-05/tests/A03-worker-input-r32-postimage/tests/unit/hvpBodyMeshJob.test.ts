import { beforeAll, beforeEach, afterEach, expect, it, vi } from "vitest";
import { R, initializeHvpRapier } from "../../src/hestia-prototype/physics/rapierPort";
import { ingestHvpStructuralCells } from "../../src/hestia-prototype/terrain/structuralIngest";
import { prepareHvpRigidBody, installHvpRigidBody } from "../../src/hestia-prototype/physics/rigidBody";
import { createHvpBodyCutSession, type HvpBodyChildProjection, type HvpBodyPlanHost } from "../../src/hestia-prototype/physics/bodyCutSession";
import { prepareHvpBodyCutSteps, type HvpBodyCutPlan } from "../../src/hestia-prototype/physics/bodyCut";
import { meshHvpOwnedBodyCellsSteps } from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import type { HvpStructuralCell } from "../../src/hestia-prototype/terrain/structuralIngest";
import type { HvpCompactMesh } from "../../src/hvp/hvpCoastMesher";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch,
  workerJobId, workerJobKind, workerTargetKey } from "../../src/workers/ids";
import { fnv1aBytes, type TransferableBufferBundle, type WorkerJobRequest } from "../../src/workers/protocol";
import { buildHvpBodyMeshInput, executeHvpBodyMeshJob, decodeHvpBodyMeshOutput, verifyHvpBodyMeshPartsSteps,
  HVP_BODY_MESH_JOB, HVP_BODY_MESH_ALGORITHM, HVP_BODY_MESH_MAX_OUTPUT } from "../../src/workers/hvpBodyMeshJob";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";

// Same real-owner interception as hvp-body-plan-owner: observe the issued plan, never derive a second one.
const owner = vi.hoisted(() => ({ plan: undefined as HvpBodyCutPlan | undefined }));
vi.mock("../../src/hestia-prototype/physics/bodyCut", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/hestia-prototype/physics/bodyCut")>();
  return { ...actual, prepareHvpBodyCutSteps: vi.fn(function* (...args: Parameters<typeof actual.prepareHvpBodyCutSteps>) {
    const plan = yield* actual.prepareHvpBodyCutSteps(...args);
    owner.plan = plan;
    return plan;
  }) };
});
vi.mock("../../src/hestia-prototype/presentation/bodyMeshAdmission", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/hestia-prototype/presentation/bodyMeshAdmission")>();
  return { ...actual, meshHvpOwnedBodyCellsSteps: vi.fn(actual.meshHvpOwnedBodyCellsSteps) };
});

beforeAll(initializeHvpRapier);
beforeEach(() => {
  owner.plan = undefined;
  vi.mocked(prepareHvpBodyCutSteps).mockClear();
  vi.mocked(meshHvpOwnedBodyCellsSteps).mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  owner.plan = undefined;
  vi.mocked(prepareHvpBodyCutSteps).mockClear();
  vi.mocked(meshHvpOwnedBodyCellsSteps).mockClear();
});

const taskHost = (): HvpBodyPlanHost => ({
  yieldTask: () => new Promise<void>(resolve => { setTimeout(resolve, 0); }),
  assertCurrent: () => {}
});

// Unchanged five-cell/x2-hit native fixture from hvp-body-plan-owner, including real World cleanup.
const withProjection = async (materialIds: readonly number[], run: (projection: HvpBodyChildProjection, plan: HvpBodyCutPlan) => Promise<void>) => {
  const world = new R.World({ x: 0, y: 0, z: 0 });
  let session: ReturnType<typeof createHvpBodyCutSession> | undefined;
  try {
    const source = ingestHvpStructuralCells("plan-owner-source", Array.from({ length: 5 }, (_, x) => ({ x, y: 0, z: 0, materialId: materialIds[x % materialIds.length]! })),
      [...new Set(materialIds)].map(materialId => ({ materialId, densityKgPerCubicMeter: 512, structuralClass: "wood", destructible: true, tags: null })));
    const recipe = prepareHvpRigidBody(source), body = installHvpRigidBody(world, recipe);
    const target = { ownerId: "plan-owner-parent", body, recipe };
    session = createHvpBodyCutSession(world, new Map([[target.ownerId, target]]), new Map([[target.ownerId, body]]), "plan-owner");
    const request = { id: "plan-cut", ownerId: target.ownerId, sourceDigest: source.contentHash, edge: 1, direction: { x: 0, y: 0, z: 1 } };
    session.begin(request, { x: .3125, y: .0625, z: -1 }, 7);
    const projection = await session.prepareChildProjection(request.id, taskHost());
    expect(await session.prepareChildProjection(request.id, taskHost())).toBe(projection);
    expect(owner.plan).toBeDefined();
    expect(vi.mocked(prepareHvpBodyCutSteps)).toHaveBeenCalledTimes(1);
    const colliders = world.colliders.len();
    await run(projection, owner.plan!);
    expect(vi.mocked(prepareHvpBodyCutSteps)).toHaveBeenCalledTimes(1);
    expect(world.bodies.len()).toBe(1);
    expect(world.colliders.len()).toBe(colliders);
    expect(session.holdsWorld).toBe(false);
  } finally {
    try { if (session?.busy) { session.rollback("plan-cut"); } } finally { world.free(); }
  }
};

const requestFor = (packed: ReturnType<typeof buildHvpBodyMeshInput>): WorkerJobRequest => ({
  jobId: workerJobId("private-body-mesh"), jobKind: workerJobKind(HVP_BODY_MESH_JOB), targetKey: workerTargetKey(packed.payload.ownerId),
  planningEpoch: planningEpoch(0), workerEpoch: workerEpoch(0), inputRevision: contentRevision(packed.payload.revision),
  sourceInputDigest: packed.sourceInputDigest, algorithmVersion: algorithmVersion(HVP_BODY_MESH_ALGORITHM), priority: "Urgent",
  deadline: jobDeadline(1), estimatedInputBytes: packed.input.byteLength, estimatedOutputBytes: byteCount(HVP_BODY_MESH_MAX_OUTPUT), payload: packed.payload
});

it("rejects borrowed worker input credit before cell materialization or meshing",()=>withProjection([1],async projection=>{
  const packed=buildHvpBodyMeshInput(projection),first=new Error("worker input parent credit rejected");let calls=0;
  await expect(executeHvpBodyMeshJob(requestFor(packed),packed.input,taskHost(),()=>{calls+=1;throw first;})).rejects.toBe(first);
  expect(calls).toBe(1);expect(vi.mocked(meshHvpOwnedBodyCellsSteps)).not.toHaveBeenCalled();
}));
it("keeps exact mixed wide-ID wire bytes when every worker phase borrows one parent",()=>withProjection([1,65535],async projection=>{
  const packed=buildHvpBodyMeshInput(projection),request=requestFor(packed),expected=await executeHvpBodyMeshJob(request,packed.input,taskHost());
  const ledger=createStructuralOwnerLedger(32*1024*1024);
  try{
    const actual=await executeHvpBodyMeshJob(request,packed.input,{...taskHost(),continuePlan:()=>true},ledger.reserve);
    expect(actual).toEqual(expected);expect(ledger.resources.reservedBytes).toBeGreaterThan(actual.bundle.byteLength);
    for(let i=0;i<7;i+=1){expect(new Uint8Array(actual.bundle.buffers[i]!)).toEqual(new Uint8Array(expected.bundle.buffers[i]!));}
  }finally{ledger.release();}
}));
it("cancels at the first borrowed input task before meshing and keeps parent credit until caller cleanup",()=>withProjection([1],async projection=>{
  const packed=buildHvpBodyMeshInput(projection),ledger=createStructuralOwnerLedger(32*1024*1024),first=new Error("worker input cancelled");
  try{
    await expect(executeHvpBodyMeshJob(requestFor(packed),packed.input,{assertCurrent:()=>{},yieldTask:async()=>{throw first;}},ledger.reserve)).rejects.toBe(first);
    expect(vi.mocked(meshHvpOwnedBodyCellsSteps)).not.toHaveBeenCalled();expect(ledger.resources.reservedBytes).toBeGreaterThan(0);
  }finally{ledger.release();}
}));

it("keeps generic cell-array freeze lookup after its Array.from record callbacks",()=>withProjection([1],async projection=>{
  const packed=buildHvpBodyMeshInput(projection),descriptor=Object.getOwnPropertyDescriptor(Object,"freeze")!,freeze=Object.freeze;
  const events:string[]=[];const preceding:string[]=[];
  Object.defineProperty(Object,"freeze",{configurable:true,get:()=>{
    events.push("lookup");return <T>(value:T):Readonly<T>=>{
      if(Array.isArray(value)&&value.length>0&&typeof value[0]?.materialId==="number"){preceding.push(events.at(-1)!);events.push("cellArray");}
      else{events.push("record");}return freeze(value);
    };
  }});
  try{await executeHvpBodyMeshJob(requestFor(packed),packed.input,taskHost());}
  finally{Object.defineProperty(Object,"freeze",descriptor);}
  expect(preceding).toEqual(["lookup","lookup"]);
}));
const verify = (plan: HvpBodyCutPlan, products: ReturnType<typeof decodeHvpBodyMeshOutput>) => {
  const steps = verifyHvpBodyMeshPartsSteps(plan, products);
  try { for (;;) { if (steps.next().done) { return; } } } finally { steps.return(undefined); }
};
// Reuse the adjacent admission test's raw-buffer mutation: recompute transport hash, not source identity.
const clonePacket = (packet: TransferableBufferBundle): TransferableBufferBundle => ({
  ...packet, buffers: packet.buffers.map(buffer => buffer.slice(0))
});

// Independent tiny surface oracle: six-neighbor cell faces, NOT another greedy mesh
// or a shared material/AO pack. Returned quads must cover each labelled unit face once.
const expectUnitFaces = (mesh: HvpCompactMesh, cells: readonly HvpStructuralCell[], center: Readonly<{ x: number; y: number; z: number }>) => {
  expect(cells.length).toBeLessThanOrEqual(16);
  const occupied = new Set(cells.map(cell => `${cell.x},${cell.y},${cell.z}`));
  const expected = new Map<string, number>(), actual = new Map<string, number>();
  const faceKey = (axis: number, sign: number, plane: number, u: number, v: number) => `${axis}:${sign}:${plane}:${u}:${v}`;
  for (const cell of cells) {
    const p = [cell.x, cell.y, cell.z];
    for (let axis = 0; axis < 3; axis += 1) {
      for (const sign of [-1, 1]) {
        const neighbor = [...p]; neighbor[axis]! += sign;
        if (!occupied.has(neighbor.join(","))) {
          expected.set(faceKey(axis, sign, p[axis]! + (sign === 1 ? 1 : 0), p[(axis + 1) % 3]!, p[(axis + 2) % 3]!), cell.materialId);
        }
      }
    }
  }
  expect(mesh.positions.length).toBe(mesh.faceCount * 12);
  expect(mesh.normals.length).toBe(mesh.positions.length);
  expect(mesh.indices.length).toBe(mesh.faceCount * 6);
  const offset = [center.x, center.y, center.z];
  for (let face = 0; face < mesh.faceCount; face += 1) {
    const normal = Array.from(mesh.normals.subarray(face * 12, face * 12 + 3));
    const axis = normal.findIndex(value => value !== 0), sign = normal[axis]!;
    expect(axis).toBeGreaterThanOrEqual(0);
    expect(sign === -1 || sign === 1).toBe(true);
    expect(normal.filter(value => value !== 0)).toHaveLength(1);
    const vertices = Array.from({ length: 4 }, (_, vertex) => Array.from({ length: 3 }, (_, a) => {
      const value = mesh.positions[face * 12 + vertex * 3 + a]!;
      const quantum = Math.round((value + offset[a]!) / .125);
      expect(value).toBe(Math.fround(quantum * .125 - offset[a]!));
      expect(mesh.normals[face * 12 + vertex * 3 + a]).toBe(normal[a]);
      return quantum;
    }));
    expect(new Set(vertices.map(p => p.join(","))).size).toBe(4);
    const u = (axis + 1) % 3, v = (axis + 2) % 3, plane = vertices[0]![axis]!;
    const minU = Math.min(...vertices.map(p => p[u]!)), maxU = Math.max(...vertices.map(p => p[u]!));
    const minV = Math.min(...vertices.map(p => p[v]!)), maxV = Math.max(...vertices.map(p => p[v]!));
    for (const p of vertices) {
      expect(p[axis]).toBe(plane);
      expect(p[u] === minU || p[u] === maxU).toBe(true);
      expect(p[v] === minV || p[v] === maxV).toBe(true);
    }
    const indices = Array.from(mesh.indices.subarray(face * 6, face * 6 + 6), index => index - face * 4);
    expect(indices.every(index => Number.isInteger(index) && index >= 0 && index < 4)).toBe(true);
    const diagonal = [0, 1, 2, 3].filter(index => indices.filter(value => value === index).length === 2);
    expect(new Set(indices).size).toBe(4);
    expect(diagonal).toHaveLength(2);
    expect(vertices[diagonal[0]!]![u]).not.toBe(vertices[diagonal[1]!]![u]);
    expect(vertices[diagonal[0]!]![v]).not.toBe(vertices[diagonal[1]!]![v]);
    for (const start of [0, 3]) {
      const a = vertices[indices[start]!]!, b = vertices[indices[start + 1]!]!, c = vertices[indices[start + 2]!]!;
      expect(sign * ((b[u]! - a[u]!) * (c[v]! - a[v]!) - (b[v]! - a[v]!) * (c[u]! - a[u]!))).toBe((maxU - minU) * (maxV - minV));
    }
    const range = mesh.materialRanges.find(r => r.startIndex <= face * 6 && r.startIndex + r.indexCount >= face * 6 + 6);
    expect(range).toBeDefined();
    for (let a = minU; a < maxU; a += 1) {
      for (let b = minV; b < maxV; b += 1) {
        const key = faceKey(axis, sign, plane, a, b);
        expect(actual.has(key)).toBe(false);
        expect(range!.slot).toBe(expected.get(key));
        actual.set(key, range!.slot);
      }
    }
  }
  expect(mesh.unitFaceCount).toBe(expected.size);
  expect(actual.size).toBe(expected.size);
};

const meshTiny = (cells: readonly HvpStructuralCell[]) => {
  const immutable = Object.freeze(cells.map(cell => Object.freeze({ ...cell })));
  const steps = meshHvpOwnedBodyCellsSteps(immutable, { x: 0, y: 0, z: 0 }, "analytic-fixture");
  try { for (;;) { const step = steps.next(); if (step.done) { return step.value; } } } finally { steps.return(undefined as never); }
};

it("keeps original ordered owner cells and source identities through mesh-only packing and exact local verification", async () => {
  await withProjection([1], async (projection, plan) => {
    // Literal immutable-b3 fixture oracle, not an expectation generated by the mesh job.
    expect(projection.parts.map(part => part.cells.map(cell => cell.x))).toEqual([[3, 4], [0, 1]]);
    const packed = buildHvpBodyMeshInput(projection), request = requestFor(packed);
    expect([...new Int32Array(packed.input.buffers[0]!)]).toEqual([3, 0, 0, 1, 4, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1]);
    let yields = 0;
    const host = taskHost();
    const execution = await executeHvpBodyMeshJob(request, packed.input, {
      ...host, yieldTask: async () => { yields += 1; await host.yieldTask(); }
    });
    expect(yields).toBeGreaterThan(0);
    const decoded = decodeHvpBodyMeshOutput(request, projection, execution.bundle);
    expect(decoded.parts.map(part => part.cells)).toEqual(projection.parts.map(part => part.cells));
    expect(decoded.parts.map(part => [part.ownerId, part.sourceDigest])).toEqual(projection.parts.map(part => [part.ownerId, part.sourceDigest]));
    for (const [index, part] of decoded.parts.entries()) { expectUnitFaces(part.mesh, projection.parts[index]!.cells, projection.parts[index]!.center); }
    verify(plan, decoded);
    const first = decoded.parts[0]!;
    const changedCells = [{ ...first.cells[0]!, materialId: 8 }, ...first.cells.slice(1)];
    expect(() => verify(plan, { ...decoded, parts: [{ ...first, cells: changedCells }, ...decoded.parts.slice(1)] })).toThrow("Foreign local body mesh products");
    expect(() => verify(plan, { ...decoded, parts: [decoded.parts[1]!, first] })).toThrow("Foreign local body mesh products");
  });
});

// Mandatory owning contract, NOT skipped/expected-failure; qualification remains NOT_RUN.
it.each([8, 256, 65_535])("preserves original occupied material %i through the complete private mesh-only roundtrip", async materialId => {
  await withProjection([materialId], async (projection, plan) => {
    for (const part of projection.parts) {
      expect(part.cells.map(cell => cell.materialId)).toEqual([materialId, materialId]);
    }
    const packed = buildHvpBodyMeshInput(projection), request = requestFor(packed);
    const execution = await executeHvpBodyMeshJob(request, packed.input, taskHost());
    const decoded = decodeHvpBodyMeshOutput(request, projection, execution.bundle);
    expect(decoded.parts.map(part => part.cells)).toEqual(projection.parts.map(part => part.cells));
    for (const [index, part] of decoded.parts.entries()) { expectUnitFaces(part.mesh, projection.parts[index]!.cells, projection.parts[index]!.center); }
    verify(plan, decoded);
  });
});

it("preserves mixed Uint16 materials at their original coordinates without aliasing or sorting owner parts", async () => {
  const sourceIds = [8, 256, 1, 65_535, 8];
  await withProjection(sourceIds, async (projection, plan) => {
    for (const part of projection.parts) {
      for (const cell of part.cells) { expect(cell.materialId).toBe(sourceIds[cell.x]); }
    }
    const packed = buildHvpBodyMeshInput(projection), request = requestFor(packed);
    const execution = await executeHvpBodyMeshJob(request, packed.input, taskHost());
    const decoded = decodeHvpBodyMeshOutput(request, projection, execution.bundle);
    expect(decoded.parts.map(part => part.cells)).toEqual(projection.parts.map(part => part.cells));
    for (const [index, part] of decoded.parts.entries()) { expectUnitFaces(part.mesh, projection.parts[index]!.cells, projection.parts[index]!.center); }
    verify(plan, decoded);
  });
});

it("rejects Air, negative zero and overflow before packing without rewriting valid owner data", async () => {
  await withProjection([1], async projection => {
    for (const materialId of [0, -0, 65_536]) {
      const corrupt = structuredClone(projection);
      const first = corrupt.parts[0]!;
      const changed = { ...corrupt, parts: [{ ...first, cells: [{ ...first.cells[0]!, materialId }, ...first.cells.slice(1)] }, ...corrupt.parts.slice(1)] };
      expect(() => buildHvpBodyMeshInput(changed)).toThrow();
      expect(projection.parts[0]!.cells[0]!.materialId).toBe(1);
    }
  });
});

it("rejects wrong input and output bindings without replacing the retained source", async () => {
  await withProjection([1], async projection => {
    const packed = buildHvpBodyMeshInput(projection), request = requestFor(packed);
    await expect(executeHvpBodyMeshJob({ ...request, targetKey: workerTargetKey("foreign") }, packed.input, taskHost())).rejects.toThrow(/binding/);
    const execution = await executeHvpBodyMeshJob(request, packed.input, taskHost());
    expect(() => decodeHvpBodyMeshOutput({ ...request, jobId: workerJobId("foreign") }, projection, execution.bundle)).toThrow(/binding/);
  });
});

it("rejects damaged in-bounds geometry against the retained native plan even when framing and hashes pass", async () => {
  await withProjection([1], async (projection, plan) => {
    const packed = buildHvpBodyMeshInput(projection), request = requestFor(packed);
    const execution = await executeHvpBodyMeshJob(request, packed.input, taskHost());
    const changed = clonePacket(execution.bundle), positions = new Float32Array(changed.buffers[2]!);
    positions[3] = positions[0]!; positions[4] = positions[1]!; positions[5] = positions[2]!;
    const rehashed = { ...changed, contentHash: fnv1aBytes(changed.buffers) };
    const decoded = decodeHvpBodyMeshOutput(request, projection, rehashed);
    expect(() => expectUnitFaces(decoded.parts[0]!.mesh, projection.parts[0]!.cells, projection.parts[0]!.center)).toThrow();
    expect(() => verify(plan, decoded)).toThrow("Foreign local body mesh geometry");
  });
});

it.each([1, 2, 3, 4, 5, 6, 7, 8, 256, 65_535])("keeps literal cube bytes, open AO, winding and original material %i", materialId => {
  const cells = [{ x: 0, y: 0, z: 0, materialId }], mesh = meshTiny(cells);
  // Literal axis-aligned corners and outward diagonals, independent of the mesh/AO helpers.
  const positions = new Float32Array([
    0,0,0, 0,0,1, 0,1,1, 0,1,0, 1,0,0, 1,1,0, 1,1,1, 1,0,1,
    0,0,0, 1,0,0, 1,0,1, 0,0,1, 0,1,0, 0,1,1, 1,1,1, 1,1,0,
    0,0,0, 0,1,0, 1,1,0, 1,0,0, 0,0,1, 1,0,1, 1,1,1, 0,1,1
  ].map(value => value * .125));
  const normals = new Float32Array([[-1,0,0], [1,0,0], [0,-1,0], [0,1,0], [0,0,-1], [0,0,1]]
    .flatMap(normal => Array.from({ length: 4 }, () => normal).flat()));
  const indices = new Uint16Array([0,1,2,0,2,3, 7,4,5,7,5,6, 11,8,9,11,9,10, 12,13,14,12,14,15, 19,16,17,19,17,18, 20,21,22,20,22,23]);
  const colors = new Float32Array(72).fill(1);
  for (const [actual, expected] of [[mesh.positions, positions], [mesh.normals, normals], [mesh.indices, indices], [mesh.colors!, colors]]) {
    expect(actual!.constructor).toBe(expected!.constructor);
    expect(new Uint8Array(actual!.buffer, actual!.byteOffset, actual!.byteLength)).toEqual(new Uint8Array(expected!.buffer, expected!.byteOffset, expected!.byteLength));
  }
  expect(mesh.materialRanges).toEqual([{ slot: materialId, startIndex: 0, indexCount: 36 }]);
  expect([mesh.faceCount, mesh.unitFaceCount, mesh.outerFaceCount, mesh.cavityFaceCount]).toEqual([6, 6, 6, 0]);
  expect(mesh.tempEstimateBytes).toBe(2640 + (materialId > 255 ? 2 : 1));
  expectUnitFaces(mesh, cells, { x: 0, y: 0, z: 0 });
});

it.each([
  { name: "adjacent original materials", cells: [{ x: 0, y: 0, z: 0, materialId: 8 }, { x: 1, y: 0, z: 0, materialId: 65_535 }] },
  { name: "greedy outside-column probe", cells: [{ x: 0, y: 0, z: 4096, materialId: 8 }, { x: 1, y: 0, z: 0, materialId: 8 }] },
  { name: "positive boundary at volume cap", cells: [{ x: 0, y: 0, z: 0, materialId: 256 }, { x: 262143, y: 0, z: 0, materialId: 65_535 }] }
])("covers independent tiny unit faces: $name", ({ cells }) => {
  const mesh = meshTiny(cells);
  expectUnitFaces(mesh, cells, { x: 0, y: 0, z: 0 });
});

it("closes the cursor once on cancellation and preserves the first error when cleanup also throws", async () => {
  await withProjection([1], async projection => {
    const packed = buildHvpBodyMeshInput(projection), request = requestFor(packed);
    const cancelled = new Error("private mesh cancelled"), cleanup = new Error("private cleanup failed");
    let current = true;
    let cursor: ReturnType<typeof meshHvpOwnedBodyCellsSteps> | undefined;
    let closes = 0;
    const host = taskHost();
    await expect(executeHvpBodyMeshJob(request, packed.input, {
      assertCurrent: () => { if (!current) { throw cancelled; } },
      yieldTask: async () => {
        cursor = vi.mocked(meshHvpOwnedBodyCellsSteps).mock.results[0]!.value;
        const close = cursor!.return.bind(cursor);
        vi.spyOn(cursor!, "return").mockImplementation(value => { closes += 1; close(value); throw cleanup; });
        await host.yieldTask();
        current = false;
      }
    })).rejects.toBe(cancelled);
    expect(closes).toBe(1);
    expect(cursor!.next().done).toBe(true);
  });
});
