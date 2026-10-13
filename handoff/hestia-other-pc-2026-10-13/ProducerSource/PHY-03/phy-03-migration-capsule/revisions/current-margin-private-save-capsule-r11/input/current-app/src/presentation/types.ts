import type { MaterialProfileId, RepresentationKey } from "./ids";

export interface Vector3Snapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface QuaternionSnapshot extends Vector3Snapshot {
  readonly w: number;
}

export interface AxisAlignedBounds {
  readonly min: Vector3Snapshot;
  readonly max: Vector3Snapshot;
}

export interface MeshArtifactAttributes {
  readonly uv?: Float32Array;
  readonly color?: Float32Array;
}

export interface MaterialRange {
  readonly materialProfileId: MaterialProfileId;
  readonly startIndex: number;
  readonly indexCount: number;
}

export interface RepresentationTransformSnapshot {
  readonly representationKey: RepresentationKey;
  readonly positionRelative: Vector3Snapshot;
  readonly orientation: QuaternionSnapshot;
  readonly scale: Vector3Snapshot;
}
