import { isAuthorityAabbFree } from "../domain/collision";
import { WORLD_VERSION, DEFAULT_WORLD_SEED, VOXEL_SIZE_METERS } from "../domain/constants";
import { enumerateWorldChunks, parseChunkKey } from "../domain/coordinates";
import { suggestedSpawnCell } from "../domain/generator";
import { raycastAuthority } from "../domain/dda";
import { VoxelAuthority } from "../domain/authority";
import { createMacroWorldDescriptor } from "../domain/macroDescriptor";
import type { CellCoord, Vec3 } from "../domain/types";
import { VoxelV2WorkerScheduler, type VoxelV2JobTerminal } from "../worker/scheduler";
import { VoxelV2PlayerController } from "./playerController";
import type {
  VoxelV2InputState,
  VoxelV2PlayerSnapshot,
  VoxelV2RenderStats,
  VoxelV2RendererPort
} from "./ports";

export type VoxelV2RuntimeState = "Loading" | "Ready" | "Failed" | "Disposed";

export interface VoxelV2LatencySnapshot {
  readonly count: number;
  readonly current: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
}

export interface VoxelV2FireResult {
  readonly status: "Hit" | "Miss" | "Accepted" | "NoChange" | "Stale" | "Duplicate" | "OutOfOrder" | "OutOfRange";
  readonly cell: CellCoord | null;
  readonly worldRevision: number;
  readonly changedCells: number;
}

export interface VoxelV2RuntimeDiagnostics {
  readonly state: VoxelV2RuntimeState;
  readonly worldRevision: number;
  readonly residentChunks: number;
  readonly player: VoxelV2PlayerSnapshot | null;
  readonly lastHit: VoxelV2FireResult | null;
  readonly acceptedEdits: number;
  readonly rejectedEdits: number;
  readonly pendingMeshJobs: number;
  readonly visibleMeshWorldRevision: number;
  readonly frameTimeMs: VoxelV2LatencySnapshot;
  readonly inputToHitMs: VoxelV2LatencySnapshot;
  readonly inputToAuthorityMs: VoxelV2LatencySnapshot;
  readonly inputToVisibleMeshMs: VoxelV2LatencySnapshot;
  readonly meshAdoptionMs: VoxelV2LatencySnapshot;
  readonly remeshChunksPerEdit: VoxelV2LatencySnapshot;
  readonly longTaskCount: number;
  readonly longTaskMaxMs: number;
  readonly render: VoxelV2RenderStats;
  readonly scheduler: ReturnType<VoxelV2WorkerScheduler["telemetry"]>;
}

interface RuntimeOptions {
  readonly renderer: VoxelV2RendererPort;
  readonly view: "player" | "coast" | "archipelago" | "river";
  readonly seed?: string;
  readonly worldVersion?: string;
  readonly now?: () => number;
}

interface PendingEditConvergence {
  readonly worldRevision: number;
  readonly startedAt: number;
  readonly keys: Set<string>;
}

class Samples {
  private readonly values: number[] = [];
  private current = 0;

  public add(value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    this.current = value;
    this.values.push(value);
    if (this.values.length > 512) this.values.shift();
  }

  public snapshot(): VoxelV2LatencySnapshot {
    if (this.values.length === 0) return Object.freeze({ count: 0, current: 0, p50: 0, p95: 0, p99: 0, max: 0 });
    const sorted = [...this.values].sort((left, right) => left - right);
    const percentile = (ratio: number): number => sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)]!;
    return Object.freeze({
      count: this.values.length,
      current: this.current,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      max: sorted[sorted.length - 1]!
    });
  }
}

const centerOfCell = (cell: CellCoord): Vec3 => ({
  x: (cell.x + 0.5) * VOXEL_SIZE_METERS,
  y: (cell.y + 0.5) * VOXEL_SIZE_METERS,
  z: (cell.z + 0.5) * VOXEL_SIZE_METERS
});

export class VoxelV2Runtime {
  public readonly authority: VoxelAuthority;
  public readonly scheduler: VoxelV2WorkerScheduler;
  private readonly renderer: VoxelV2RendererPort;
  private readonly now: () => number;
  private readonly frameSamples = new Samples();
  private readonly inputToHitSamples = new Samples();
  private readonly inputToAuthoritySamples = new Samples();
  private readonly inputToVisibleMeshSamples = new Samples();
  private readonly meshAdoptionSamples = new Samples();
  private readonly remeshChunksPerEditSamples = new Samples();
  private readonly pendingMeshJobs = new Map<string, Promise<VoxelV2JobTerminal>>();
  private readonly pendingEditConvergence = new Map<number, PendingEditConvergence>();
  private player: VoxelV2PlayerController | null = null;
  private state: VoxelV2RuntimeState = "Loading";
  private lastHit: VoxelV2FireResult | null = null;
  private editSequence = 0;
  private acceptedEdits = 0;
  private rejectedEdits = 0;
  private visibleMeshWorldRevision = 0;
  private longTaskCount = 0;
  private longTaskMaxMs = 0;
  private disposed = false;

  public constructor(options: RuntimeOptions) {
    this.renderer = options.renderer;
    this.now = options.now ?? (() => performance.now());
    const seed = options.seed ?? DEFAULT_WORLD_SEED;
    const worldVersion = options.worldVersion ?? WORLD_VERSION;
    this.authority = new VoxelAuthority(seed, worldVersion);
    this.renderer.setWorldDescriptor(createMacroWorldDescriptor(seed, worldVersion));
    this.scheduler = new VoxelV2WorkerScheduler({ now: this.now });
    this.renderer.setView(options.view);
  }

  public get runtimeState(): VoxelV2RuntimeState { return this.state; }

  public async initialize(): Promise<void> {
    if (this.disposed) throw new Error("V2 runtime is disposed.");
    try {
      const generationTickets = enumerateWorldChunks().map((coord) => this.scheduler.scheduleGeneration({
        coord,
        requestedRevision: 0,
        seed: this.authority.seed,
        worldVersion: this.authority.worldVersion
      }));
      for (const ticket of generationTickets) {
        const terminal = await ticket.result;
        if (terminal.kind !== "Completed" || terminal.result.operation !== "Generate") {
          throw new Error(`V2 generation failed for ${terminal.key}: ${terminal.kind}.`);
        }
        this.authority.adoptGeneratedChunk(terminal.result.generated);
      }

      for (const metadata of this.authority.chunkMetadata()) await this.scheduleMesh(metadata.key);
      const spawnCell = suggestedSpawnCell(this.authority.seed);
      const spawn = {
        x: (spawnCell.x + 0.5) * VOXEL_SIZE_METERS,
        y: spawnCell.y * VOXEL_SIZE_METERS,
        z: (spawnCell.z + 0.5) * VOXEL_SIZE_METERS
      };
      if (!isAuthorityAabbFree(this.authority, spawn)) throw new Error("V2 generated spawn is not collision-free.");
      this.player = new VoxelV2PlayerController(this.authority, spawn);
      this.state = "Ready";
    } catch (error) {
      this.state = "Failed";
      this.disposeWorkerOnly();
      throw error;
    }
  }

  public setInput(input: VoxelV2InputState): void { this.player?.setInput(input); }

  public rotate(deltaX: number, deltaY: number): void { this.player?.rotate(deltaX, deltaY); }

  public advanceFrame(deltaSeconds: number): void {
    if (this.disposed) return;
    if (this.player) {
      const playerSnapshot = this.player.advanceFrame(deltaSeconds);
      const angles = this.player.viewAngles();
      this.renderer.setPlayerPose(playerSnapshot.position, angles.yaw, angles.pitch);
    }
    this.renderer.render(deltaSeconds);
  }

  public recordFrameTime(milliseconds: number): void { this.frameSamples.add(milliseconds); }

  public fire(): VoxelV2FireResult {
    if (this.disposed || this.player === null || this.state !== "Ready") {
      const unavailable: VoxelV2FireResult = { status: "OutOfRange", cell: null, worldRevision: this.authority.worldRevision, changedCells: 0 };
      this.lastHit = unavailable;
      return unavailable;
    }
    const started = this.now();
    const ray = this.player.viewRay();
    const hit = raycastAuthority(this.authority, ray.origin, ray.direction, 8);
    if (!hit) {
      const result: VoxelV2FireResult = { status: "Miss", cell: null, worldRevision: this.authority.worldRevision, changedCells: 0 };
      this.lastHit = result;
      this.rejectedEdits += 1;
      this.inputToHitSamples.add(this.now() - started);
      this.renderer.setHitMarker(null, false);
      return result;
    }

    this.inputToHitSamples.add(this.now() - started);
    this.renderer.setHitMarker(centerOfCell(hit.cell), false);
    const result = this.authority.applySubtractSphere({
      editId: `voxel-v2-edit-${this.editSequence + 1}`,
      sequence: this.editSequence + 1,
      expectedWorldRevision: this.authority.worldRevision,
      center: hit.cell,
      radiusCells: 1
    });
    this.editSequence = result.sequence;
    const authorityTime = this.now() - started;
    if (result.status === "Accepted" || result.status === "NoChange") {
      this.acceptedEdits += result.status === "Accepted" ? 1 : 0;
      this.inputToAuthoritySamples.add(authorityTime);
      this.renderer.setHitMarker(centerOfCell(hit.cell), result.status === "Accepted");
      if (result.status === "Accepted") {
        this.renderer.invalidateVegetation(result.changedChunks);
        this.remeshChunksPerEditSamples.add(result.remeshChunkKeys.length);
        this.pendingEditConvergence.set(result.worldRevision, {
          worldRevision: result.worldRevision,
          startedAt: started,
          keys: new Set(result.remeshChunkKeys)
        });
        for (const key of result.remeshChunkKeys) void this.scheduleMesh(key);
      }
    } else {
      this.rejectedEdits += 1;
      this.renderer.setHitMarker(centerOfCell(hit.cell), false);
    }
    const fireResult: VoxelV2FireResult = {
      status: result.status,
      cell: { ...hit.cell },
      worldRevision: result.worldRevision,
      changedCells: result.changedCells
    };
    this.lastHit = fireResult;
    return fireResult;
  }

  public recordLongTask(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    this.longTaskCount += 1;
    this.longTaskMaxMs = Math.max(this.longTaskMaxMs, durationMs);
  }

  public diagnostics(): VoxelV2RuntimeDiagnostics {
    return Object.freeze({
      state: this.state,
      worldRevision: this.authority.worldRevision,
      residentChunks: this.authority.residentChunkCount,
      player: this.player?.snapshot() ?? null,
      lastHit: this.lastHit,
      acceptedEdits: this.acceptedEdits,
      rejectedEdits: this.rejectedEdits,
      pendingMeshJobs: this.pendingMeshJobs.size,
      visibleMeshWorldRevision: this.visibleMeshWorldRevision,
      frameTimeMs: this.frameSamples.snapshot(),
      inputToHitMs: this.inputToHitSamples.snapshot(),
      inputToAuthorityMs: this.inputToAuthoritySamples.snapshot(),
      inputToVisibleMeshMs: this.inputToVisibleMeshSamples.snapshot(),
      meshAdoptionMs: this.meshAdoptionSamples.snapshot(),
      remeshChunksPerEdit: this.remeshChunksPerEditSamples.snapshot(),
      longTaskCount: this.longTaskCount,
      longTaskMaxMs: this.longTaskMaxMs,
      render: this.renderer.stats(),
      scheduler: this.scheduler.telemetry()
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.state = "Disposed";
    this.pendingMeshJobs.clear();
    this.pendingEditConvergence.clear();
    this.disposeWorkerOnly();
    this.renderer.dispose();
  }

  private async scheduleMesh(key: string): Promise<void> {
    if (this.disposed) return;
    const coord = parseChunkKey(key);
    const snapshot = this.authority.createHaloSnapshot(coord, this.authority.worldRevision);
    const ticket = this.scheduler.scheduleMeshing(snapshot);
    const completion = ticket.result;
    this.pendingMeshJobs.set(key, completion);
    try {
      const terminal = await completion;
      if (terminal.kind !== "Completed" || terminal.result.operation !== "Mesh") return;
      const currentMetadata = this.authority.metadata(key);
      const currentAuthorityRevision = currentMetadata?.authorityRevision ?? 0;
      if (terminal.result.mesh.chunkAuthorityRevision !== currentAuthorityRevision) return;
      if (terminal.result.mesh.requestedRevision > this.authority.worldRevision) return;
      const adoptionStarted = this.now();
      if (!this.renderer.adoptMesh(terminal.result.mesh)) return;
      this.meshAdoptionSamples.add(this.now() - adoptionStarted);
      this.visibleMeshWorldRevision = Math.max(this.visibleMeshWorldRevision, terminal.result.mesh.requestedRevision);
      this.recordMeshConvergence(key, terminal.result.mesh.requestedRevision);
    } finally {
      if (this.pendingMeshJobs.get(key) === completion) this.pendingMeshJobs.delete(key);
    }
  }

  private disposeWorkerOnly(): void {
    this.scheduler.dispose();
  }

  private recordMeshConvergence(key: string, meshRequestedRevision: number): void {
    for (const [worldRevision, pending] of this.pendingEditConvergence) {
      if (meshRequestedRevision < pending.worldRevision) continue;
      pending.keys.delete(key);
      if (pending.keys.size === 0) {
        this.inputToVisibleMeshSamples.add(this.now() - pending.startedAt);
        this.pendingEditConvergence.delete(worldRevision);
      }
    }
  }
}
