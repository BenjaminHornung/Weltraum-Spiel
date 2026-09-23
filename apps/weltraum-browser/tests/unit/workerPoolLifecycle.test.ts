import { describe, expect, it } from "vitest";
import { fnv1aHash } from "../../src/core/hash";
import { PerformanceTelemetry, createWorkerPoolTelemetryObserver } from "../../src/diagnostics/performance";
import { collisionInputs } from "../../src/hestia-prototype/physics/terrainColliders";
import { HVP_COLLISION_JOB, HVP_COLLISION_MAX_OUTPUT, decodeHvpCollisionOutput } from "../../src/workers/hvpCollisionJob";
import {HVP_SUPPORT_JOB,HVP_SUPPORT_MAX_OUTPUT,hvpSupportInputDigest,decodeHvpSupportOutput,type HvpSupportPayload} from "../../src/workers/hvpSupportJob";
import { fnv1aBytes } from "../../src/workers/protocol";
import {HVP_NEIGHBOR_JOB,HVP_NEIGHBOR_MAX_OUTPUT,hvpNeighborInputDigest,decodeHvpNeighborOutput,type HvpNeighborPayload} from "../../src/workers/hvpNeighborJob";
import {encodeHvpProjectionPacket} from "../../src/hestia-prototype/runtime/projectionPacket";
import {meshHvpWaterPatch} from "../../src/hvp/hvpCoastMesher";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {HVP_BODY_CUT_JOB,HVP_BODY_CUT_MAX_OUTPUT,hvpBodyCutInputDigest,decodeHvpBodyCutOutput,type HvpBodyCutPayload} from "../../src/workers/hvpBodyCutJob";
import {
  StreamingWorkerRuntime,
  WorkerPool,
  algorithmVersion,
  byteCount,
  contentRevision,
  jobDeadline,
  planningEpoch,
  workerEpoch,
  workerJobId,
  workerJobKind,
  workerTargetKey,
  type HostToWorkerMessage,
  type TransferableBufferBundle,
  type WorkerEpoch,
  type WorkerJobRequest,
  type WorkerToHostMessage,
  type WorkerTransport
} from "../../src/workers";

class RuntimeTransport implements WorkerTransport {
  private messageHandler: ((event: MessageEvent<unknown>) => void) | null = null;
  private retiredMessageHandler: ((event: MessageEvent<unknown>) => void) | null = null;
  public get onmessage(): ((event: MessageEvent<unknown>) => void) | null { return this.messageHandler; }
  public set onmessage(value: ((event: MessageEvent<unknown>) => void) | null) {
    if (value !== null) this.retiredMessageHandler = value;
    this.messageHandler = value;
  }
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  public terminated = false;
  public corruptNextOutputOwnership = false;
  readonly #runtime = new StreamingWorkerRuntime((message, transfer = []) => {
    const cloned = structuredClone(message, { transfer: [...transfer] }) as WorkerToHostMessage;
    const delivered: WorkerToHostMessage = this.corruptNextOutputOwnership && cloned.type === "JobOutputData"
      ? { ...cloned, bundle: { ...cloned.bundle, ownership: "SenderToWorker" } }
      : cloned;
    if (cloned.type === "JobOutputData") this.corruptNextOutputOwnership = false;
    queueMicrotask(() => { if (!this.terminated) this.onmessage?.({ data: delivered } as MessageEvent<unknown>); });
  });

  public postMessage(message: HostToWorkerMessage, transfer: Transferable[] = []): void {
    const cloned = structuredClone(message, { transfer }) as HostToWorkerMessage;
    queueMicrotask(() => { if (!this.terminated) this.#runtime.handleMessage(cloned); });
  }

  public terminate(): void { this.terminated = true; }
  public fail(message = "synthetic worker error"): void { this.onerror?.({ message } as ErrorEvent); }
  public failMessage(): void { this.onmessageerror?.({ data: undefined } as MessageEvent<unknown>); }
  public emitMalformed(): void { this.onmessage?.({ data: { type: "WorkerReady" } } as MessageEvent<unknown>); }
  public emitAfterTermination(message: WorkerToHostMessage): void {
    this.retiredMessageHandler?.({ data: message } as MessageEvent<unknown>);
  }
}

it("transfers source-bound neighbour projections through the real pool and rejects a foreign ticket before transfer",async()=>{
  const pool=new WorkerPool({workerCount:1,queueCapacity:32,transportFactory:()=>new RuntimeTransport()});await pool.start();
  try{
    const a=new Uint8Array(8_388_608),b=new Uint8Array(8_388_608);
    for(let z=0;z<256;z+=1){a.fill(1,z*32768,z*32768+63*256);b.fill(1,z*32768,z*32768+63*256);}
    const empty=meshHvpWaterPatch(new Uint8Array(4),2,2,.125,{x:0,z:0},"12345678");
    const buffers=[a.buffer,b.buffer,encodeHvpProjectionPacket([empty,empty,empty])];
    const payload:HvpNeighborPayload={epoch:1,primaryRevision:0,eastRevision:0,primaryDigest:"12345678",eastDigest:"87654321",lod:.125,key:"east-source-fixture"};
    const bundle:TransferableBufferBundle={ownership:"SenderToWorker",revision:contentRevision(0),buffers,byteLength:byteCount(buffers.reduce((n,b)=>n+b.byteLength,0)),
      views:buffers.map((buffer,i)=>({name:["primary","east","proxies"][i]!,kind:"Uint8Array",bufferIndex:i,byteOffset:0,elementCount:buffer.byteLength}))};
    const job:WorkerJobRequest={...request("neighbor-projection",bundle.byteLength,0),inputRevision:contentRevision(0),jobKind:workerJobKind(HVP_NEIGHBOR_JOB),
      sourceInputDigest:hvpNeighborInputDigest(payload,buffers),estimatedOutputBytes:byteCount(HVP_NEIGHBOR_MAX_OUTPUT),payload};
    expect(()=>pool.enqueue({...job,payload:{...payload,epoch:2}},bundle)).toThrow(/mismatch/);expect(a.byteLength).toBe(8_388_608);
    const terminal=await pool.enqueue(job,bundle).result;
    if(terminal.kind!=="Completed"){throw new Error(JSON.stringify(terminal));}
    expect(pool.isAcceptedCompletedTerminal(terminal)).toBe(true);expect(a.byteLength).toBe(0);expect(b.byteLength).toBe(0);
    const products=decodeHvpNeighborOutput(terminal.output,payload);
    expect(products.region).toHaveLength(2);expect(products.region[0]!.faceCount).toBeGreaterThan(0);
    expect(products.waterPatch.indices.length).toBeGreaterThan(0);
    expect(()=>decodeHvpNeighborOutput(terminal.output,{...payload,lod:.5})).toThrow(/Incomplete/);
  }finally{await pool.shutdown();}
},120_000);

it("prepares local body cuts through the pool without accepting foreign owners or forged removed mass",async()=>{
  const pool=new WorkerPool({workerCount:1,queueCapacity:32,transportFactory:()=>new RuntimeTransport()});await pool.start();
  try{
    const cells=Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1}));
    const source=ingestHvpStructuralCells("moving-source",cells,[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
    const payload:HvpBodyCutPayload={sessionId:"session",epoch:3,commandId:"cut",ownerId:"hvp:body",sourceId:source.objectId,sourceDigest:source.contentHash,
      revision:source.objectRevision,cellCount:cells.length,massKg:5,cell:[2,0,0],edge:1,materials:source.materials};
    const values=new Int32Array(cells.flatMap(c=>[c.x,c.y,c.z,c.materialId]));
    const bundle:TransferableBufferBundle={ownership:"SenderToWorker",revision:contentRevision(0),byteLength:byteCount(values.byteLength),buffers:[values.buffer],
      views:[{name:"cells",kind:"Int32Array",bufferIndex:0,byteOffset:0,elementCount:values.length}]};
    const job:WorkerJobRequest={...request("body-cut",values.byteLength,0),inputRevision:contentRevision(0),jobKind:workerJobKind(HVP_BODY_CUT_JOB),
      sourceInputDigest:hvpBodyCutInputDigest(payload,bundle.buffers),estimatedOutputBytes:byteCount(HVP_BODY_CUT_MAX_OUTPUT),payload};
    expect(()=>pool.enqueue({...job,payload:{...payload,ownerId:"other"}},bundle)).toThrow(/binding/);
    expect(values.byteLength).toBe(80);
    const terminal=await pool.enqueue(job,bundle).result;
    if(terminal.kind!=="Completed"){throw new Error(JSON.stringify(terminal));}
    expect(values.byteLength).toBe(0);expect(pool.isAcceptedCompletedTerminal(terminal)).toBe(true);
    const result=decodeHvpBodyCutOutput(terminal.output,payload);
    expect(result.parts).toHaveLength(2);expect(result.parts.reduce((n,p)=>n+p.cells.length,0)).toBe(4);
    expect(result.removedCells).toBe(1);expect(result.removedMassKg).toBe(1);
    expect(()=>decodeHvpBodyCutOutput(terminal.output,{...payload,epoch:4})).toThrow(/binding/);
    const corrupt=JSON.parse(new TextDecoder().decode(terminal.output.buffers[0]!));corrupt.removedMassKg=2;
    const bytes=new TextEncoder().encode(JSON.stringify(corrupt));
    expect(()=>decodeHvpBodyCutOutput({...terminal.output,buffers:[bytes.buffer],contentHash:fnv1aBytes([bytes.buffer]),byteLength:byteCount(bytes.length),
      views:[{name:"products",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:bytes.length}]},payload)).toThrow(/mass partition/);
  }finally{await pool.shutdown();}
});

it("runs HVP canonical collision jobs through the real pool protocol and rejects tampered input", async () => {
  const pool = new WorkerPool({ workerCount: 2, queueCapacity: 32, transportFactory: () => new RuntimeTransport() });
  await pool.start();
  try {
    const sector = collisionInputs({ sizeX: 4, sizeY: 4, sizeZ: 4, cellMeters: 0.125,
      originMeters: { x: 0, y: 0, z: 0 }, readSlot: () => 1 }).next().value!;
    const { slots, ...shape } = sector;
    const payload = { ...shape, outputRevision: contentRevision(1) };
    const bundle: TransferableBufferBundle = { ownership: "SenderToWorker", revision: contentRevision(1),
      buffers: [slots.buffer as ArrayBuffer], byteLength: byteCount(slots.byteLength),
      views: [{ name: "slots", kind: "Uint8Array", bufferIndex: 0, byteOffset: 0, elementCount: slots.length }] };
    const job: WorkerJobRequest = { jobId: workerJobId("collision-ok"), jobKind: workerJobKind(HVP_COLLISION_JOB),
      targetKey: workerTargetKey("canonical-sector"), planningEpoch: planningEpoch(0), workerEpoch: workerEpoch(0),
      inputRevision: contentRevision(1), sourceInputDigest: fnv1aBytes(bundle.buffers), algorithmVersion: algorithmVersion(1),
      priority: "Urgent", deadline: jobDeadline(1), estimatedInputBytes: byteCount(slots.byteLength),
      estimatedOutputBytes: byteCount(HVP_COLLISION_MAX_OUTPUT), payload };
    expect(() => pool.enqueue({ ...job, sourceInputDigest: "wrong" }, bundle)).toThrow(/binding mismatch/);
    expect(slots.byteLength).toBeGreaterThan(0);
    const terminal = await pool.enqueue(job, bundle).result;
    expect(slots.byteLength).toBe(0);
    expect(terminal.kind).toBe("Completed");
    if (terminal.kind !== "Completed") { throw new Error("Collision worker failed"); }
    expect(pool.isAcceptedCompletedTerminal(terminal)).toBe(true);
    const mesh = decodeHvpCollisionOutput(terminal.output, payload);
    expect(mesh.indices.length).toBe(36);
    expect(Math.max(...mesh.vertices)).toBe(0.5);
    mesh.indices[0] = 999999;
    expect(() => decodeHvpCollisionOutput(terminal.output, payload)).toThrow(/geometry/);
  } finally { await pool.shutdown(); }
});

it("runs source-bound support analysis through the real worker protocol without adopting foreign coverage",async()=>{
  const pool=new WorkerPool({workerCount:1,queueCapacity:32,transportFactory:()=>new RuntimeTransport()});
  await pool.start();
  try{
    const slots=new Uint8Array(32*4*4);
    for(const [x,y,z] of [[15,0,1],[15,1,1],[15,2,1],[17,2,1],[18,2,1]]){slots[x!+y!*32+z!*128]=1;}
    const payload:HvpSupportPayload={sessionId:"support",epoch:2,generation:1,sourceDigest:"12345678",size:[32,4,4],changed:[[16,2,1]]};
    const bundle:TransferableBufferBundle={ownership:"SenderToWorker",revision:contentRevision(1),buffers:[slots.buffer],byteLength:byteCount(slots.byteLength),
      views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
    const job:WorkerJobRequest={...request("support",slots.byteLength,0),jobKind:workerJobKind(HVP_SUPPORT_JOB),
      sourceInputDigest:hvpSupportInputDigest(payload,bundle.buffers),estimatedOutputBytes:byteCount(HVP_SUPPORT_MAX_OUTPUT),payload};
    expect(()=>pool.enqueue({...job,payload:{...payload,epoch:3}},bundle)).toThrow(/binding/);
    expect(slots.byteLength).toBe(512);
    const terminal=await pool.enqueue(job,bundle).result;
    expect(slots.byteLength).toBe(0);
    if(terminal.kind!=="Completed"){throw new Error(`Support worker: ${terminal.kind}`);}
    expect(pool.isAcceptedCompletedTerminal(terminal)).toBe(true);
    const result=decodeHvpSupportOutput(terminal.output,payload);
    expect(result.status).toBe("Ready");expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0]!.cells.map(c=>c.x)).toEqual([17,18]);expect(result.fragments[0]!.massKg).toBe(9.375);
    expect(()=>decodeHvpSupportOutput(terminal.output,{...payload,epoch:3})).toThrow(/binding/);
    const corrupt=JSON.parse(new TextDecoder().decode(terminal.output.buffers[0]!));corrupt.report.fragments[0].massKg=0;
    const bytes=new TextEncoder().encode(JSON.stringify(corrupt));
    const changed={...terminal.output,buffers:[bytes.buffer],contentHash:fnv1aBytes([bytes.buffer]),byteLength:byteCount(bytes.length),
      views:[{name:"report",kind:"Uint8Array" as const,bufferIndex:0,byteOffset:0,elementCount:bytes.length}]};
    expect(()=>decodeHvpSupportOutput(changed,payload)).toThrow(/mass binding/);
  }finally{await pool.shutdown();}
});

it("cancels an HVP collision job after preparation without publishing buffers", async () => {
  const { slots, ...shape } = collisionInputs({ sizeX: 4, sizeY: 4, sizeZ: 4, cellMeters: 0.125,
    originMeters: { x: 0, y: 0, z: 0 }, readSlot: () => 1 }).next().value!;
  const bundle: TransferableBufferBundle = { ownership: "SenderToWorker", revision: contentRevision(1),
    buffers: [slots.buffer as ArrayBuffer], byteLength: byteCount(slots.byteLength),
    views: [{ name: "slots", kind: "Uint8Array", bufferIndex: 0, byteOffset: 0, elementCount: slots.length }] };
  const job: WorkerJobRequest = { ...request("collision-cancel", slots.byteLength),
    jobKind: workerJobKind(HVP_COLLISION_JOB), sourceInputDigest: fnv1aBytes(bundle.buffers),
    estimatedOutputBytes: byteCount(HVP_COLLISION_MAX_OUTPUT), payload: { ...shape, outputRevision: contentRevision(1) } };
  const emitted: WorkerToHostMessage[] = [];
  let finish!: () => void;
  const done = new Promise<void>(resolve => { finish = resolve; });
  let checkpoints = 0;
  const runtime = new StreamingWorkerRuntime(message => {
    emitted.push(message);
    if (["JobCompleted", "JobCancelled", "JobFailed"].includes(message.type)) { finish(); }
  }, async () => {
    checkpoints += 1;
    if (checkpoints === 2) { runtime.handleMessage({ type: "CancelJob", jobId: job.jobId, workerEpoch: job.workerEpoch }); }
  });
  runtime.handleMessage({ type: "InitializeWorker", workerEpoch: job.workerEpoch });
  runtime.handleMessage({ type: "EnqueueJob", request: job });
  runtime.handleMessage({ type: "JobInputData", jobId: job.jobId, workerEpoch: job.workerEpoch, bundle });
  await done;
  expect(checkpoints).toBe(2);
  expect(emitted.some(m => m.type === "JobCancelled")).toBe(true);
  expect(emitted.some(m => m.type === "JobOutputData" || m.type === "JobCompleted")).toBe(false);
});

class PendingStartupTransport implements WorkerTransport {
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  public terminated = false;
  public postMessage(_message: HostToWorkerMessage, _transfer?: Transferable[]): void {}
  public terminate(): void { this.terminated = true; }
}

class DeferredReadyTransport extends PendingStartupTransport {
  private epoch: WorkerEpoch | undefined;
  public postMessage(message: HostToWorkerMessage, _transfer?: Transferable[]): void {
    if (message.type === "InitializeWorker") this.epoch = message.workerEpoch;
  }
  public ready(): void {
    if (this.epoch === undefined) throw new Error("Worker was not initialized.");
    this.onmessage?.({ data: { type: "WorkerReady", workerEpoch: this.epoch } } as MessageEvent<unknown>);
  }
  public fail(message = "synthetic worker error"): void { this.onerror?.({ message } as ErrorEvent); }
}

class ThrowingInitializeTransport extends PendingStartupTransport {
  public postMessage(): void { throw new Error("synthetic initialize post failure"); }
}

class ThrowingShutdownTransport extends RuntimeTransport {
  public postMessage(message: HostToWorkerMessage, transfer: Transferable[] = []): void {
    if (message.type === "ShutdownWorker") throw new Error("synthetic shutdown post failure");
    super.postMessage(message, transfer);
  }
}

const request = (id: string, bytes: number, planning = 1): WorkerJobRequest => ({
  jobId: workerJobId(id), jobKind: workerJobKind("TransformBuffer"), targetKey: workerTargetKey(`target-${id}`),
  planningEpoch: planningEpoch(planning), workerEpoch: workerEpoch(0), inputRevision: contentRevision(1),
  algorithmVersion: algorithmVersion(1), priority: "Normal", deadline: jobDeadline(1),
  estimatedInputBytes: byteCount(bytes), estimatedOutputBytes: byteCount(bytes),
  payload: { xorMask: 0x33, chunkBytes: 1024, outputRevision: contentRevision(2) }
});

const input = (bytes: number): TransferableBufferBundle => {
  const buffer = new ArrayBuffer(bytes);
  return {
    ownership: "SenderToWorker", revision: contentRevision(1), byteLength: byteCount(bytes), buffers: [buffer],
    views: [{ name: "bytes", bufferIndex: 0, kind: "Uint8Array", byteOffset: 0, elementCount: bytes }]
  };
};

const createPool = async (workerCount = 1) => {
  const transports: RuntimeTransport[] = [];
  const pool = new WorkerPool({
    workerCount, queueCapacity: 16, initialPlanningEpoch: planningEpoch(1),
    transportFactory: () => { const transport = new RuntimeTransport(); transports.push(transport); return transport; }
  });
  await pool.start();
  return { pool, transports };
};

type SupportWireOutput = { binding: unknown; report: Record<string, unknown>; timings?: unknown };

const rewriteSupportOutput = (
  output: TransferableBufferBundle,
  mutate: (value: SupportWireOutput) => void
): TransferableBufferBundle => {
  const value = JSON.parse(new TextDecoder().decode(output.buffers[0]!)) as SupportWireOutput;
  mutate(value);
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return { ...output, buffers: [bytes.buffer], contentHash: fnv1aBytes([bytes.buffer]), byteLength: byteCount(bytes.length),
    views: [{ name: "report", kind: "Uint8Array", bufferIndex: 0, byteOffset: 0, elementCount: bytes.length }] };
};

const supportFixture = async () => {
  const { pool } = await createPool();
  try {
    const slots = new Uint8Array(32 * 4 * 4);
    for (const [x, y, z] of [[15, 0, 1], [15, 1, 1], [15, 2, 1], [17, 2, 1], [18, 2, 1]]) {
      slots[x! + y! * 32 + z! * 128] = 1;
    }
    const payload: HvpSupportPayload = { sessionId: "support", epoch: 2, generation: 1, sourceDigest: "12345678", size: [32, 4, 4], changed: [[16, 2, 1]] };
    const bundle: TransferableBufferBundle = { ownership: "SenderToWorker", revision: contentRevision(1), buffers: [slots.buffer], byteLength: byteCount(slots.byteLength),
      views: [{ name: "slots", kind: "Uint8Array", bufferIndex: 0, byteOffset: 0, elementCount: slots.length }] };
    const job: WorkerJobRequest = { ...request("support-decode", slots.byteLength, 1), jobKind: workerJobKind(HVP_SUPPORT_JOB),
      sourceInputDigest: hvpSupportInputDigest(payload, bundle.buffers), estimatedOutputBytes: byteCount(HVP_SUPPORT_MAX_OUTPUT), payload };
    const terminal = await pool.enqueue(job, bundle).result;
    if (terminal.kind !== "Completed") {
      throw new Error(`Support fixture: ${terminal.kind}`);
    }
    return { payload, output: terminal.output };
  } finally {
    await pool.shutdown();
  }
};

const supportBundle = (payload: HvpSupportPayload, report: Record<string, unknown>, timings?: unknown): TransferableBufferBundle => {
  const value = { binding: [payload.sessionId, payload.epoch, payload.generation, payload.sourceDigest, payload.size, payload.changed], report,
    ...(timings === undefined ? {} : { timings }) };
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return { ownership: "WorkerToConsumer", revision: contentRevision(payload.generation), buffers: [bytes.buffer], byteLength: byteCount(bytes.length),
    contentHash: fnv1aBytes([bytes.buffer]), views: [{ name: "report", kind: "Uint8Array", bufferIndex: 0, byteOffset: 0, elementCount: bytes.length }] };
};

const largeSupportReport = (): Record<string, unknown> => {
  const makeFragment = (minX: number, maxX: number) => {
    const cells: { x: number; y: number; z: number; materialId: number }[] = [];
    for (let z = 1; z < 17; z += 1) {
      for (let y = 1; y < 66; y += 1) {
        for (let x = minX; x < maxX; x += 1) {
          cells.push({ x, y, z, materialId: 1 });
        }
      }
    }
    const leaves = [...new Set(cells.map(cell => `${Math.floor(cell.x / 16)}:${Math.floor(cell.y / 16)}:${Math.floor(cell.z / 16)}`))].sort();
    const digest = fnv1aHash(JSON.stringify(cells));
    return { id: `hvp-terrain-fragment-${digest}`, digest, cells, min: [minX, 1, 1], max: [maxX, 66, 17],
      massKg: 16 * 65 * 16 * 2400 * .125 ** 3, colliders: 1, affectedLeaves: leaves,
      colliderBoxes: [{ min: [minX, 1, 1], max: [maxX, 66, 17] }] };
  };
  return { status: "Ready", reason: "", probes: 41_586, anchoredWitnesses: 0, workingBytes: 2_375_680,
    fragments: [makeFragment(1, 17), makeFragment(18, 34)] };
};

it("support decode accepts valid reports and rejects stale or mass-bound reports", async () => {
  const { payload, output } = await supportFixture();
  const decoded = decodeHvpSupportOutput(output, payload);
  expect(decoded.fragments).toHaveLength(1);
  expect(decoded.fragments[0]!.cells).toHaveLength(2);
  expect(() => decodeHvpSupportOutput(output, { ...payload, epoch: 3 })).toThrow(/binding/);
  const corrupt = rewriteSupportOutput(output, value => {
    const fragments = value.report.fragments as Record<string, unknown>[];
    fragments[0]!.massKg = 0;
  });
  expect(() => decodeHvpSupportOutput(corrupt, payload)).toThrow(/mass binding/);
});

it("support decode requires truthful collider and timing counts", async () => {
  const { payload, output } = await supportFixture();
  const colliderMismatch = rewriteSupportOutput(output, value => {
    const fragments = value.report.fragments as Record<string, unknown>[];
    fragments[0]!.colliders = 2;
  });
  expect(() => decodeHvpSupportOutput(colliderMismatch, payload)).toThrow(/collider/);
  const fragmentCellsMismatch = rewriteSupportOutput(output, value => {
    const timings = value.timings as Record<string, unknown>;
    timings.fragmentCells = 0;
  });
  expect(() => decodeHvpSupportOutput(fragmentCellsMismatch, payload)).toThrow(/timings/);
  const fragmentCountMismatch = rewriteSupportOutput(output, value => {
    const timings = value.timings as Record<string, unknown>;
    timings.fragmentCount = 2;
  });
  expect(() => decodeHvpSupportOutput(fragmentCountMismatch, payload)).toThrow(/timings/);
  const invalidColliderBounds = rewriteSupportOutput(output, value => {
    const fragments = value.report.fragments as Record<string, unknown>[];
    const box = (fragments[0]!.colliderBoxes as Record<string, unknown>[])[0]!;
    box.min = box.max;
  });
  expect(() => decodeHvpSupportOutput(invalidColliderBounds, payload)).toThrow(/collider box/);
  const fractionalCell = rewriteSupportOutput(output, value => {
    const fragments = value.report.fragments as Record<string, unknown>[];
    const cell = (fragments[0]!.cells as Record<string, unknown>[])[0]!;
    cell.x = 15.5;
  });
  expect(() => decodeHvpSupportOutput(fractionalCell, payload)).toThrow(/fragment cell/);
  const fractionalColliderBox = rewriteSupportOutput(output, value => {
    const fragments = value.report.fragments as Record<string, unknown>[];
    const box = (fragments[0]!.colliderBoxes as Record<string, unknown>[])[0]!;
    const min = [...(box.min as number[])];
    min[0] = min[0]! + 0.5;
    box.min = min;
  });
  expect(() => decodeHvpSupportOutput(fractionalColliderBox, payload)).toThrow(/collider box/);
  const tooManyColliderBoxes = rewriteSupportOutput(output, value => {
    const fragments = value.report.fragments as Record<string, unknown>[];
    const box = (fragments[0]!.colliderBoxes as Record<string, unknown>[])[0]!;
    fragments[0]!.colliderBoxes = Array.from({ length: 65 }, () => box);
  });
  expect(() => decodeHvpSupportOutput(tooManyColliderBoxes, payload)).toThrow(/collider boxes/);
  const colliderVolumeMismatch = rewriteSupportOutput(output, value => {
    const fragments = value.report.fragments as Record<string, unknown>[];
    const box = (fragments[0]!.colliderBoxes as Record<string, unknown>[])[0]!;
    const max = [...(box.max as number[])];
    max[0] = max[0]! + 1;
    box.max = max;
  });
  expect(() => decodeHvpSupportOutput(colliderVolumeMismatch, payload)).toThrow(/coverage mismatch/);
 });

it("support decode rejects malformed timing values and freezes diagnostics", async () => {
  const { payload, output } = await supportFixture();
  for (const mutate of [
    (value: SupportWireOutput) => { value.timings = null; },
    (value: SupportWireOutput) => { (value.timings as Record<string, unknown>).totalMs = -1; },
    (value: SupportWireOutput) => { (value.timings as Record<string, unknown>).totalMs = null; },
    (value: SupportWireOutput) => { (value.timings as Record<string, unknown>).totalMs = 262_145; },
    (value: SupportWireOutput) => { (value.timings as Record<string, unknown>).recipeBreakdown = null; }
  ]) {
    expect(() => decodeHvpSupportOutput(rewriteSupportOutput(output, mutate), payload)).toThrow(/timings/);
  }
  const decoded = decodeHvpSupportOutput(output, payload);
  expect(Object.isFrozen(decoded.timings)).toBe(true);
  expect(Reflect.set(decoded.timings as object, "fragmentCells", 0)).toBe(false);
  expect(Object.isFrozen(decoded.timings?.recipeBreakdown)).toBe(true);
  expect(Reflect.set(decoded.timings?.recipeBreakdown as object, "massMs", 0)).toBe(false);
  const withoutTimings = rewriteSupportOutput(output, value => { delete value.timings; });
  const without = decodeHvpSupportOutput(withoutTimings, payload);
  expect(without.fragments).toEqual(decoded.fragments);
  expect(without.timings).toBeUndefined();
});

it("support decode keeps report and transfer aggregate budgets distinct", () => {
  const payload: HvpSupportPayload = { sessionId: "large-support", epoch: 2, generation: 1, sourceDigest: "12345678", size: [64, 128, 32], changed: [[17, 1, 1]] };
  const report = largeSupportReport();
  const noTimings = decodeHvpSupportOutput(supportBundle(payload, report), payload);
  const withTimings = decodeHvpSupportOutput(supportBundle(payload, report, {
    seedsMs: 0, supportMs: 0, ingestMs: 0, recipeMs: 0, fragmentCount: 2, fragmentCells: 33_280, totalMs: 0,
    recipeBreakdown: { massMs: 0, classifyMs: 0, transitionMs: 0, axesMs: 0 }
  }), payload);
  expect(noTimings.fragments.reduce((sum, fragment) => sum + fragment.cells.length, 0)).toBe(33_280);
  expect(withTimings.fragments).toEqual(noTimings.fragments);
  expect(withTimings.timings?.fragmentCount).toBe(2);
  expect(withTimings.timings?.fragmentCells).toBe(33_280);
});

describe("WorkerPool lifecycle", () => {
  it("reports only ready workers as active across startup, replacement failure, and shutdown", async () => {
    const telemetry = new PerformanceTelemetry();
    const transports: DeferredReadyTransport[] = [];
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 1,
      initialPlanningEpoch: planningEpoch(1),
      observe: createWorkerPoolTelemetryObserver(telemetry, 1),
      transportFactory: () => {
        const transport = new DeferredReadyTransport();
        transports.push(transport);
        return transport;
      }
    });

    expect(telemetry.snapshot()).toMatchObject({ workerCount: 1, activeWorkers: 0 });
    const start = pool.start();
    expect(telemetry.snapshot()).toMatchObject({ workerCount: 1, activeWorkers: 0 });
    transports[0]!.ready();
    await start;
    expect(telemetry.snapshot()).toMatchObject({ workerCount: 1, activeWorkers: 1 });

    transports[0]!.fail("replacement telemetry failure");
    await expect.poll(() => telemetry.snapshot().activeWorkers).toBe(0);
    await expect.poll(() => transports.length).toBe(2);
    transports[1]!.ready();
    await expect.poll(() => telemetry.snapshot().activeWorkers).toBe(1);

    await pool.shutdown();
    expect(telemetry.snapshot()).toMatchObject({ workerCount: 1, activeWorkers: 0 });
  });

  it("completes deterministic work and detaches transferred input", async () => {
    const { pool } = await createPool();
    const source = input(32);
    const sender = source.buffers[0];
    const ticket = pool.enqueue(request("complete", 32), source);
    expect(sender.byteLength).toBe(0);
    const terminal = await ticket.result;
    expect(terminal.kind).toBe("Completed");
    if (terminal.kind === "Completed") expect(terminal.output.buffers[0].byteLength).toBe(32);
    await pool.shutdown();
  });

  it("authorizes only completed terminals produced by this pool", async () => {
    const first = await createPool();
    const second = await createPool();
    expect(first.pool.isAcceptedCompletedTerminal({ kind: "Completed" })).toBe(false);

    const terminal = await first.pool.enqueue(request("authorized-terminal", 32), input(32)).result;
    expect(terminal.kind).toBe("Completed");
    expect(first.pool.isAcceptedCompletedTerminal(terminal)).toBe(true);
    expect(second.pool.isAcceptedCompletedTerminal(terminal)).toBe(false);

    const secondTerminal = await second.pool.enqueue(request("second-authorized-terminal", 32), input(32)).result;
    expect(secondTerminal.kind).toBe("Completed");
    expect(second.pool.isAcceptedCompletedTerminal(secondTerminal)).toBe(true);
    expect(first.pool.isAcceptedCompletedTerminal(secondTerminal)).toBe(false);
    await first.pool.shutdown();
    await second.pool.shutdown();
  });

  it("takes transferable ownership before an accepted job waits in the queue", async () => {
    const { pool } = await createPool();
    const running = pool.enqueue(request("ownership-running", 512 * 1024), input(512 * 1024));
    const queuedInput = input(8);
    new Uint8Array(queuedInput.buffers[0]).fill(0x11);
    const sender = queuedInput.buffers[0];
    const queued = pool.enqueue(request("ownership-queued", 8), queuedInput);

    expect(sender.byteLength).toBe(0);
    expect(running.cancel()).toBe(true);
    expect(await running.result).toEqual({ kind: "Cancelled", reason: "CancelledDuringExecution" });
    const terminal = await queued.result;
    expect(terminal.kind).toBe("Completed");
    if (terminal.kind === "Completed") {
      expect([...new Uint8Array(terminal.output.buffers[0])]).toEqual(Array(8).fill(0x22));
    }
    await pool.shutdown();
  });

  it("cancels queued and running jobs with distinct outcomes", async () => {
    const { pool } = await createPool();
    const running = pool.enqueue(request("running", 512 * 1024), input(512 * 1024));
    const queued = pool.enqueue(request("queued", 8), input(8));
    expect(queued.cancel()).toBe(true);
    expect(running.cancel()).toBe(true);
    expect(await queued.result).toEqual({ kind: "Cancelled", reason: "CancelledBeforeStart" });
    expect(await running.result).toEqual({ kind: "Cancelled", reason: "CancelledDuringExecution" });
    await pool.shutdown();
  });

  it("settles affected requests on worker error and replaces with a higher epoch", async () => {
    const { pool, transports } = await createPool();
    const ticket = pool.enqueue(request("fault", 512 * 1024), input(512 * 1024));
    const before = pool.snapshot().latestWorkerEpoch;
    transports[0].fail();
    expect(await ticket.result).toMatchObject({ kind: "Failed", failure: { code: "WorkerFault" } });
    await expect.poll(() => pool.snapshot().workerRestarts).toBe(1);
    expect(pool.snapshot().latestWorkerEpoch).toBeGreaterThan(before);
    await pool.shutdown();
  });

  it("stops fail-closed when a fault replacement cannot start", async () => {
    const transports: RuntimeTransport[] = [];
    let creations = 0;
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => {
        creations += 1;
        if (creations > 1) throw new Error("synthetic replacement start failure");
        const transport = new RuntimeTransport();
        transports.push(transport);
        return transport;
      }
    });
    await pool.start();
    const running = pool.enqueue(request("failed-replacement-running", 512 * 1024), input(512 * 1024));
    const queued = pool.enqueue(request("failed-replacement-queued", 8), input(8));

    transports[0].fail();

    const terminals = await Promise.all([running.result, queued.result]);
    expect(terminals).toEqual([
      expect.objectContaining({ kind: "Failed", failure: expect.objectContaining({ code: "WorkerFault" }) }),
      expect.objectContaining({ kind: "Failed", failure: expect.objectContaining({ code: "WorkerFault" }) })
    ]);
    await expect.poll(() => pool.snapshot().state).toBe("Stopped");
    expect(pool.snapshot()).toMatchObject({ activeWorkers: 0, runningJobs: 0, queue: { size: 0 } });
    expect(() => pool.enqueue(request("after-failed-replacement", 8), input(8))).toThrow("WorkerPool is not accepting jobs");
  });

  it("keeps the admitted worker intact until a ready candidate swaps exactly once", async () => {
    const transports: DeferredReadyTransport[] = [];
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => {
        const transport = new DeferredReadyTransport();
        transports.push(transport);
        return transport;
      }
    });
    const starting = pool.start();
    transports[0]!.ready();
    await starting;
    const running = pool.enqueue(request("replace-running", 8), input(8));
    const queued = pool.enqueue(request("replace-queued", 8), input(8));
    const before = pool.snapshot();

    const replacing = pool.replaceWorker(0);

    expect(transports).toHaveLength(2);
    expect(pool.snapshot()).toEqual(before);
    expect(transports[0]!.terminated).toBe(false);
    transports[1]!.ready();
    const afterEpoch = await replacing;

    expect(afterEpoch).toBeGreaterThan(before.latestWorkerEpoch);
    expect(pool.snapshot()).toMatchObject({
      state: "Running",
      workerRestarts: before.workerRestarts + 1,
      latestWorkerEpoch: afterEpoch,
      runningJobs: 1,
      queue: { size: 0 },
      workers: [{ slot: 0, workerEpoch: afterEpoch, state: "Busy", jobId: workerJobId("replace-queued") }]
    });
    expect(transports[0]!.terminated).toBe(true);
    expect(await running.result).toMatchObject({ kind: "Failed", failure: { code: "WorkerFault" } });
    await pool.shutdown();
    expect(await queued.result).toMatchObject({ kind: "Failed", failure: { code: "Shutdown" } });
  });

  it("discards a failed candidate without changing the admitted worker, work, epochs, restarts, or pool state", async () => {
    const transports: DeferredReadyTransport[] = [];
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => {
        const transport = new DeferredReadyTransport();
        transports.push(transport);
        return transport;
      }
    });
    const starting = pool.start();
    transports[0]!.ready();
    await starting;
    const running = pool.enqueue(request("failed-candidate-running", 8), input(8));
    const queued = pool.enqueue(request("failed-candidate-queued", 8), input(8));
    const before = pool.snapshot();

    const replacing = pool.replaceWorker(0);

    expect(transports).toHaveLength(2);
    expect(pool.snapshot()).toEqual(before);
    transports[1]!.fail("synthetic candidate start failure");
    await expect(replacing).rejects.toThrow("synthetic candidate start failure");

    expect(pool.snapshot()).toEqual(before);
    expect(transports[0]!.terminated).toBe(false);
    expect(transports[1]!.terminated).toBe(true);
    await pool.shutdown();
    const terminals = await Promise.all([running.result, queued.result]);
    expect(terminals.map((terminal) => terminal.kind).sort()).toEqual(["Cancelled", "Failed"]);
  });

  it("prevents candidate admission when shutdown wins during replacement startup", async () => {
    const transports: DeferredReadyTransport[] = [];
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => {
        const transport = new DeferredReadyTransport();
        transports.push(transport);
        return transport;
      }
    });
    const starting = pool.start();
    transports[0]!.ready();
    await starting;
    const before = pool.snapshot();
    const replacing = pool.replaceWorker(0);
    expect(transports).toHaveLength(2);

    const shuttingDown = pool.shutdown();

    await expect(replacing).rejects.toThrow("Worker terminated before becoming ready");
    await shuttingDown;
    expect(transports.every((transport) => transport.terminated)).toBe(true);
    expect(pool.snapshot()).toMatchObject({
      state: "Stopped",
      activeWorkers: 0,
      runningJobs: 0,
      workerRestarts: before.workerRestarts,
      latestWorkerEpoch: before.latestWorkerEpoch,
      queue: { size: 0 },
      workers: []
    });
  });

  it("ignores late output from a terminated worker epoch after replacement", async () => {
    const { pool, transports } = await createPool();
    const oldEpoch = pool.snapshot().latestWorkerEpoch;
    const oldTicket = pool.enqueue(request("late-old", 512 * 1024), input(512 * 1024));
    await pool.replaceWorker(0);
    expect(await oldTicket.result).toMatchObject({ kind: "Failed", failure: { code: "WorkerFault" } });

    const staleBundle: TransferableBufferBundle = {
      ownership: "WorkerToConsumer", revision: contentRevision(2), byteLength: byteCount(8), buffers: [new ArrayBuffer(8)],
      views: [{ name: "bytes", bufferIndex: 0, kind: "Uint8Array", byteOffset: 0, elementCount: 8 }]
    };
    transports[0].emitAfterTermination({ type: "JobOutputData", jobId: workerJobId("late-old"), workerEpoch: oldEpoch, outputBytes: byteCount(8), bundle: staleBundle });
    transports[0].emitAfterTermination({
      type: "JobCompleted",
      result: {
        jobId: workerJobId("late-old"), targetKey: workerTargetKey("target-late-old"), planningEpoch: planningEpoch(1),
        workerEpoch: oldEpoch, inputRevision: contentRevision(1), outputRevision: contentRevision(2),
        algorithmVersion: algorithmVersion(1), outputBytes: byteCount(8)
      }
    });
    expect(pool.snapshot().workerRestarts).toBe(1);
    const replacement = pool.enqueue(request("replacement-work", 8), input(8));
    expect(await replacement.result).toMatchObject({ kind: "Completed" });
    await pool.shutdown();
  });

  it("does not let a rejected late cancellation replace a completed outcome", async () => {
    const transports: RuntimeTransport[] = [];
    let ticket: ReturnType<WorkerPool["enqueue"]> | undefined;
    let lateCancelAccepted: boolean | undefined;
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => {
        const transport = new RuntimeTransport();
        transports.push(transport);
        return transport;
      },
      observe: (event) => {
        if (event.type === "OutputTransferred") lateCancelAccepted = ticket?.cancel();
      }
    });
    await pool.start();
    ticket = pool.enqueue(request("late-cancel", 8), input(8));

    const terminal = await ticket.result;

    expect(lateCancelAccepted).toBe(false);
    expect(terminal).toMatchObject({ kind: "Completed" });
    await pool.shutdown();
  });

  it("rejects stale planning results after the planning epoch advances", async () => {
    const { pool } = await createPool();
    const ticket = pool.enqueue(request("stale", 64 * 1024), input(64 * 1024));
    pool.setPlanningEpoch(planningEpoch(2));
    const terminal = await ticket.result;
    expect(terminal).toMatchObject({
      kind: "Failed", integrationDecision: { kind: "RejectedStalePlanningEpoch" }
    });
    await pool.shutdown();
  });

  it("shutdown leaves no queued or running ticket unresolved", async () => {
    const { pool } = await createPool();
    const running = pool.enqueue(request("shutdown-running", 512 * 1024), input(512 * 1024));
    const queued = pool.enqueue(request("shutdown-queued", 8), input(8));
    await pool.shutdown();
    const terminals = await Promise.all([running.result, queued.result]);
    expect(terminals.map((terminal) => terminal.kind).sort()).toEqual(["Cancelled", "Failed"]);
    expect(pool.snapshot()).toMatchObject({ state: "Stopped", runningJobs: 0, queue: { size: 0 } });
  });

  it("replaces a ready worker that faults while another slot is still starting", async () => {
    const first = new RuntimeTransport();
    const second = new DeferredReadyTransport();
    const created: WorkerTransport[] = [];
    let calls = 0;
    const pool = new WorkerPool({
      workerCount: 2, queueCapacity: 4, initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => {
        const call = calls++;
        const transport = call === 0 ? first : call === 1 ? second : new RuntimeTransport();
        created.push(transport);
        return transport;
      }
    });
    const starting = pool.start();
    await expect.poll(() => pool.snapshot().workers.find((worker) => worker.slot === 0)?.state).toBe("Ready");
    first.fail();
    second.ready();
    await starting;
    expect(pool.snapshot()).toMatchObject({ state: "Running", activeWorkers: 2, workerRestarts: 1 });
    expect(created).toHaveLength(3);
    expect(first.terminated).toBe(true);
    await pool.shutdown();
  });
  it("rejects a pending pool start when shutdown terminates the starting handle", async () => {
    const transport = new PendingStartupTransport();
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => transport
    });
    const starting = pool.start();
    const rejectedStart = expect(starting).rejects.toThrow("Worker terminated before becoming ready");
    await Promise.resolve();

    await pool.shutdown();

    await rejectedStart;
    expect(transport.terminated).toBe(true);
    expect(pool.snapshot()).toMatchObject({ state: "Stopped", activeWorkers: 0, runningJobs: 0 });
  });

  it("rejects startup when the initialize control message cannot be posted", async () => {
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => new ThrowingInitializeTransport()
    });

    await expect(pool.start()).rejects.toThrow("synthetic initialize post failure");

    expect(pool.snapshot()).toMatchObject({ state: "Stopped", activeWorkers: 0, runningJobs: 0 });
  });

  it("finishes shutdown when the final control message cannot be posted", async () => {
    const transport = new ThrowingShutdownTransport();
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => transport
    });
    await pool.start();

    await expect(pool.shutdown()).resolves.toBeUndefined();

    expect(transport.terminated).toBe(true);
    expect(pool.snapshot()).toMatchObject({ state: "Stopped", activeWorkers: 0, runningJobs: 0 });
  });

  it("isolates throwing diagnostic observers from queue and lifecycle decisions", async () => {
    const transports: RuntimeTransport[] = [];
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => { const transport = new RuntimeTransport(); transports.push(transport); return transport; },
      observe: () => { throw new Error("observer failure"); }
    });
    await pool.start();
    let ticket!: ReturnType<WorkerPool["enqueue"]>;
    expect(() => { ticket = pool.enqueue(request("observer", 32), input(32)); }).not.toThrow();
    expect(await ticket.result).toMatchObject({ kind: "Completed" });
    expect(pool.snapshot().workerRestarts).toBe(0);
    await pool.shutdown();
  });

  it("faults malformed protocol and messageerror events and replaces each worker", async () => {
    const { pool, transports } = await createPool();
    const malformed = pool.enqueue(request("malformed", 512 * 1024), input(512 * 1024));
    transports[0].emitMalformed();
    expect(await malformed.result).toMatchObject({ kind: "Failed", failure: { code: "WorkerFault" } });
    await expect.poll(() => pool.snapshot().workerRestarts).toBe(1);

    const messageError = pool.enqueue(request("message-error", 512 * 1024), input(512 * 1024));
    transports[1].failMessage();
    expect(await messageError.result).toMatchObject({ kind: "Failed", failure: { code: "WorkerFault" } });
    await expect.poll(() => pool.snapshot().workerRestarts).toBe(2);
    await pool.shutdown();
  });

  it("retires a worker whose completed result violates the integration contract", async () => {
    const { pool, transports } = await createPool();
    transports[0].corruptNextOutputOwnership = true;
    const rejected = pool.enqueue(request("invalid-result-owner", 8), input(8));
    const queued = pool.enqueue(request("after-invalid-result", 8), input(8));

    expect(await rejected.result).toMatchObject({
      kind: "Failed",
      failure: { code: "ProtocolFault" },
      integrationDecision: { kind: "RejectedInvalidLayout" }
    });
    await expect.poll(() => pool.snapshot().workerRestarts).toBe(1);
    expect(await queued.result).toMatchObject({ kind: "Completed" });
    expect(transports).toHaveLength(2);
    await pool.shutdown();
  });

  it("settles duplicate and full-queue rejections explicitly", async () => {
    const transports: RuntimeTransport[] = [];
    const pool = new WorkerPool({ workerCount: 1, queueCapacity: 1, initialPlanningEpoch: planningEpoch(1), transportFactory: () => {
      const transport = new RuntimeTransport(); transports.push(transport); return transport;
    } });
    await pool.start();
    const active = pool.enqueue(request("active", 8), input(8));
    const queued = pool.enqueue(request("queued-full", 8), input(8));
    const full = pool.enqueue(request("overflow", 8), input(8));
    const duplicate = pool.enqueue(request("queued-full", 8), input(8));
    expect(await full.result).toMatchObject({ kind: "Failed", failure: { code: "QueueFull" } });
    expect(await duplicate.result).toMatchObject({ kind: "Failed", failure: { code: "DuplicateJob" } });
    expect(active.cancel()).toBe(true);
    expect(queued.cancel()).toBe(true);
    await Promise.all([active.result, queued.result]);
    await pool.shutdown();
  });
});
