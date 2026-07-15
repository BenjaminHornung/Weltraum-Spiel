import type { Vec3 } from "../core/vector";

export const PLANET_FACES = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"] as const;
export type PlanetFace = (typeof PLANET_FACES)[number];

export const PLANET_TILE_EDGES = ["u-", "u+", "v-", "v+"] as const;
export type PlanetTileEdge = (typeof PLANET_TILE_EDGES)[number];

export interface PlanetFaceBasis {
  readonly face: PlanetFace;
  readonly ordinal: number;
  readonly normal: Vec3;
  readonly uAxis: Vec3;
  readonly vAxis: Vec3;
}

export interface PlanetFaceUv {
  readonly face: PlanetFace;
  readonly u: number;
  readonly v: number;
}

export interface PlanetTileKey {
  readonly bodyId: string;
  readonly face: PlanetFace;
  readonly level: number;
  readonly x: number;
  readonly y: number;
}

export type PlanetTileId = `planet-tile:v1:${string}:${PlanetFace}:${number}:${number}:${number}`;

export interface PlanetTileFaceUvBounds {
  readonly minU: number;
  readonly maxU: number;
  readonly minV: number;
  readonly maxV: number;
}

export type PlanetTileNeighborMap = Readonly<Record<PlanetTileEdge, PlanetTileKey>>;

export type PlanetTopologyErrorCode =
  | "INVALID_FACE"
  | "INVALID_FACE_UV"
  | "INVALID_DIRECTION"
  | "INVALID_BODY_ID"
  | "INVALID_LEVEL"
  | "INVALID_TILE_COORDINATE"
  | "INVALID_TILE_EDGE"
  | "INVALID_TILE_ID";

export class PlanetTopologyError extends Error {
  public constructor(
    public readonly code: PlanetTopologyErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PlanetTopologyError";
  }
}
