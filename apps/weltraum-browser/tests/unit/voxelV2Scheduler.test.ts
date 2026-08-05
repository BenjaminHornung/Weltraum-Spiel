import { describe, expect, it } from "vitest";
import { HALO_CELL_COUNT, HALO_EDGE } from "../../src/voxel-v2/domain/constants";
import { chunkKey } from "../../src/voxel-v2/domain/coordinates";
import { VoxelMaterial } from "../../src/voxel-v2/domain/palette";
import type { ChunkCoord, HaloSnapshot } from "../../src/voxel-v2/domain/types";
import {
  VoxelV2WorkerScheduler,
  type VoxelV2WorkerTransport
} from "../../src/voxel-v2/worker/scheduler";
import {
  workerResponseTransferList,
  type VoxelV2WorkerRequest,
  type VoxelV2WorkerResponse
} from "../../src/voxel-v2/worker/protocol";
import { executeVoxelV2WorkerRequest } from "../../src/voxel-v2/worker/runtime";

class ManualRuntimeTransport implements VoxelV2WorkerTransport {
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  public readonly requests: VoxelV2WorkerRequest[] = [];
  public terminated = false;

  public postMessage(message: VoxelV2WorkerRequest, transfer: Transferable[] = []): void {
    if (this.terminated) throw new Error("Synthetic V2 worker is terminated.");
    this.requests.push(structuredClone(message, { transfer }) as VoxelV2WorkerRequest);
  }

  public terminate(): void { this.terminated = true; }

  public completeNext(): VoxelV2WorkerResponse {
    const request = this.requests.shift();
    if (!request) throw new Error("No synthetic V2 worker request is pending.");
    let clock = 10;
    const response = executeVoxelV2WorkerRequest(request, () => {
      clock += 2;
      return clock;
    });
    const delivered = structuredClone(response, { transfer: workerResponseTransferList(response) }) as VoxelV2WorkerResponse;
    this.onmessage?.({ data: delivered } as MessageEvent<unknown>);
    return delivered;
  }
}

const haloSnapshot = (coord: ChunkCoord, requestedRevision: number): HaloSnapshot => {
  const cells = new Uint8Array(HALO_CELL_COUNT);
  const localIndex = (0 + 1) + HALO_EDGE * ((0 + 1) + HALO_EDGE * (0 + 1));
  cells[localIndex] = VoxelMaterial.LightRock;
  return {
    key: chunkKey(coord),
    coord,
    requestedRevision,
    chunkAuthorityRevision: requestedRevision,
    cells
  };
};

const emptyHaloSnapshot = (coord: ChunkCoord, requestedRevision: number): HaloSnapshot => ({
  key: chunkKey(coord),
  coord,
  requestedRevision,
  chunkAuthorityRevision: requestedRevision,
  cells: new Uint8Array(HALO_CELL_COUNT)
});

const createScheduler = (queueCapacity = 256) => {
  const transport = new ManualRuntimeTransport();
  let clock = 0;
  const scheduler = new VoxelV2WorkerScheduler({
    queueCapacity,
    transportFactory: () => transport,
    now: () => {
      clock += 1;
      return clock;
    }
  });
  return { scheduler, transport };
};

describe("Voxel V2 worker scheduler", () => {
  it("accepts a valid empty mesh product and keeps the worker alive", async () => {
    const { scheduler, transport } = createScheduler();
    const ticket = scheduler.scheduleMeshing(emptyHaloSnapshot({ x: 0, y: 0, z: 0 }, 1));
    transport.completeNext();
    const terminal = await ticket.result;
    expect(terminal.kind).toBe("Completed");
    if (terminal.kind === "Completed" && terminal.result.operation === "Mesh") {
      expect(terminal.result.mesh.vertexCount).toBe(0);
      expect(terminal.result.mesh.indices).toHaveLength(0);
    }
    expect(scheduler.telemetry()).toMatchObject({ disposed: false, failedJobs: 0, completedJobs: 1 });
    scheduler.dispose();
  });

  it("runs deterministic generation in the V2 worker protocol and transfers its buffer", async () => {
    const { scheduler, transport } = createScheduler();
    const ticket = scheduler.scheduleGeneration({ coord: { x: 0, y: 3, z: 0 }, requestedRevision: 0 });
    expect(transport.requests).toHaveLength(1);
    transport.completeNext();
    const terminal = await ticket.result;
    expect(terminal.kind).toBe("Completed");
    if (terminal.kind === "Completed") {
      expect(terminal.result.operation).toBe("Generate");
      if (terminal.result.operation === "Generate") {
        expect(terminal.result.generated.cells).toHaveLength(32 ** 3);
      }
    }
    expect(scheduler.telemetry()).toMatchObject({
      workerCount: 1,
      completedJobs: 1,
      transferredFromWorkerBytes: 32 ** 3,
      pendingJobs: 0,
      inFlightJobs: 0
    });
    scheduler.dispose();
  });

  it("coalesces a queued chunk to the newest revision and rejects the stale in-flight result", async () => {
    const { scheduler, transport } = createScheduler();
    const coord = { x: 0, y: 0, z: 0 };
    const oldest = scheduler.scheduleMeshing(haloSnapshot(coord, 0));
    const replaced = scheduler.scheduleMeshing(haloSnapshot(coord, 1));
    const newestSnapshot = haloSnapshot(coord, 2);
    const newest = scheduler.scheduleMeshing(newestSnapshot);

    await expect(replaced.result).resolves.toMatchObject({ kind: "Coalesced", requestedRevision: 1 });
    expect(transport.requests).toHaveLength(1);
    transport.completeNext();
    await expect(oldest.result).resolves.toMatchObject({ kind: "Stale", requestedRevision: 0 });
    expect(transport.requests).toHaveLength(1);
    expect(newestSnapshot.cells.byteLength).toBe(HALO_CELL_COUNT);

    transport.completeNext();
    await expect(newest.result).resolves.toMatchObject({ kind: "Completed", requestedRevision: 2 });
    expect(scheduler.telemetry()).toMatchObject({
      completedJobs: 1,
      coalescedJobs: 1,
      staleResults: 1,
      pendingJobs: 0,
      inFlightJobs: 0,
      transferredToWorkerBytes: HALO_CELL_COUNT * 2
    });
    scheduler.dispose();
  });

  it("rejects older and duplicate revisions without adding work", async () => {
    const { scheduler, transport } = createScheduler();
    const coord = { x: 1, y: 0, z: 0 };
    const current = scheduler.scheduleMeshing(haloSnapshot(coord, 4));
    const duplicate = scheduler.scheduleMeshing(haloSnapshot(coord, 4));
    const stale = scheduler.scheduleMeshing(haloSnapshot(coord, 3));
    await expect(duplicate.result).resolves.toMatchObject({ kind: "Coalesced" });
    await expect(stale.result).resolves.toMatchObject({ kind: "Stale" });
    expect(transport.requests).toHaveLength(1);
    transport.completeNext();
    await expect(current.result).resolves.toMatchObject({ kind: "Completed" });
    expect(scheduler.telemetry()).toMatchObject({ coalescedJobs: 1, staleRequests: 1 });
    scheduler.dispose();
  });

  it("bounds the pending queue and resolves all owned jobs on disposal", async () => {
    const { scheduler, transport } = createScheduler(1);
    const inFlight = scheduler.scheduleMeshing(haloSnapshot({ x: 0, y: 0, z: 0 }, 0));
    const queued = scheduler.scheduleMeshing(haloSnapshot({ x: 1, y: 0, z: 0 }, 0));
    const rejected = scheduler.scheduleMeshing(haloSnapshot({ x: 2, y: 0, z: 0 }, 0));
    await expect(rejected.result).resolves.toMatchObject({ kind: "Rejected" });
    expect(scheduler.telemetry()).toMatchObject({ pendingJobs: 1, inFlightJobs: 1, rejectedJobs: 1 });

    scheduler.dispose();
    await expect(inFlight.result).resolves.toMatchObject({ kind: "Disposed" });
    await expect(queued.result).resolves.toMatchObject({ kind: "Disposed" });
    expect(transport.terminated).toBe(true);
    const telemetry = scheduler.telemetry();
    expect(telemetry).toMatchObject({ disposed: true, activeWorkers: 0, pendingJobs: 0, inFlightJobs: 0, disposedJobs: 2 });
    expect(Object.isFrozen(telemetry)).toBe(true);
    expect(Object.isFrozen(telemetry.queueWaitMs)).toBe(true);
  });
});
