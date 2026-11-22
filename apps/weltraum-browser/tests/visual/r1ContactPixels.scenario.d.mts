import type { ThreeSubmittedFrameMetadata, ThreeSubmittedFrameSource } from '../../src/render/three/backend/threeRenderBackend';
import type { LinearContactTile, SurfaceContactRay } from '../../src/ray/composeContactPixels';
export function checkTerrainPixels(backend: ThreeSubmittedFrameSource, tile: LinearContactTile, surfaces: SurfaceContactRay[],
  submit: () => ThreeSubmittedFrameMetadata): Promise<{ proof: {beforeRevision: number; afterRevision: number; cutCells: number;
    centerBefore: number[];centerAfter: number[];direct: number[];indirect: number[];emissive: number[];changedPixels: number;
    centerUnknown: string | null;digests: Record<string,string>};shaded: Float32Array;relit: Float32Array;
    unknown: Float32Array;sourceStale: Float32Array;oldFrame: Float32Array }>;
