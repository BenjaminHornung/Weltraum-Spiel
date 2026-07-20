import type { SurfaceLabLifecycleState } from "./surfaceLabController";

export interface SurfaceLabTelemetrySnapshot {
  readonly lifecycle: SurfaceLabLifecycleState;
  readonly seed: string;
  readonly presetId: string;
  readonly voxelSizeMeters: 0.25 | 0.5;
  readonly regionExtentMeters: Readonly<{ x: number; y: number; z: number }>;
  readonly requestedChunks: number;
  readonly readyChunks: number;
  readonly failedChunks: number;
  readonly cancelledJobs: number;
  readonly staleRejects: number;
  readonly workerQueueDepth: number;
  readonly runningWorkers: number;
  readonly workerRestarts: number;
  readonly planningEpoch: number;
  readonly latestWorkerEpoch: number;
  readonly vertices: number;
  readonly triangles: number;
  readonly meshBytes: number;
  readonly generationMilliseconds: number;
  readonly meshingMilliseconds: number;
  readonly uploadMilliseconds: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly cacheBypasses: number;
  readonly brickHashes: readonly string[];
  readonly meshHashes: readonly string[];
  readonly bodyId: string;
  readonly systemFrameId: string;
  readonly bodyInertialFrameId: string;
  readonly bodyFixedFrameId: string;
  readonly surfaceFrameId: string;
  readonly universeTick: number;
  readonly universeEpochSeconds: number;
}

export type SurfaceLabTelemetryListener = (snapshot: SurfaceLabTelemetrySnapshot) => void;

/** Creates an immutable read-only projection; telemetry never feeds controller decisions. */
export const snapshotSurfaceLabTelemetry = (
  source: SurfaceLabTelemetrySnapshot
): SurfaceLabTelemetrySnapshot => Object.freeze({
  ...source,
  regionExtentMeters: Object.freeze({ ...source.regionExtentMeters }),
  brickHashes: Object.freeze([...source.brickHashes]),
  meshHashes: Object.freeze([...source.meshHashes])
});
