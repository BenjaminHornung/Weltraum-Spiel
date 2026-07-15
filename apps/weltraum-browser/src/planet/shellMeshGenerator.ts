import type { Vec3 } from "../core/vector";
import { planetFaceUvToDirection } from "./cubeSphere";
import { planetTileId } from "./ids";
import { createPlanetTileKey, planetTileCenterDirection, planetTileFaceUvBounds } from "./tileAddress";
import type { PlanetTileId, PlanetTileKey } from "./types";

export const PLANET_SHELL_MESH_ALGORITHM_VERSION = "planet_shell:v1";
export const MAX_PLANET_SHELL_GRID_SEGMENTS = 1024;

export type PlanetShellMeshIndexArray = Uint16Array | Uint32Array;

export interface PlanetHeightSample {
  readonly bodyId: string;
  readonly tileId: PlanetTileId;
  readonly tileKey: PlanetTileKey;
  readonly direction: Vec3;
  readonly gridX: number;
  readonly gridY: number;
  readonly gridSegments: number;
  readonly sampleU: number;
  readonly sampleV: number;
  readonly faceU: number;
  readonly faceV: number;
}

export type PlanetHeightSampler = (sample: PlanetHeightSample) => number;

export interface PlanetShellBounds {
  readonly min: Vec3;
  readonly max: Vec3;
}

export interface PlanetShellMeshInput {
  readonly tileKey: PlanetTileKey;
  readonly radiusMeters: number;
  readonly gridSegments: number;
  readonly heightSampler: PlanetHeightSampler;
}

export interface PlanetShellMesh {
  readonly algorithmVersion: typeof PLANET_SHELL_MESH_ALGORITHM_VERSION;
  readonly tileId: PlanetTileId;
  readonly tileKey: PlanetTileKey;
  readonly radiusMeters: number;
  readonly gridSegments: number;
  /** Double-precision body-centered origin; never copied into GPU buffers. */
  readonly originBodyCentered: Vec3;
  /** Double-precision authoritative bounds in body-centered coordinates. */
  readonly boundsBodyCentered: PlanetShellBounds;
  readonly positionsRelative: Float32Array;
  readonly normals: Float32Array;
  readonly indices: PlanetShellMeshIndexArray;
  readonly uv: Float32Array;
  readonly boundsRelative: PlanetShellBounds;
}

export type PlanetShellMeshErrorCode =
  | "INVALID_SHELL_INPUT"
  | "INVALID_RADIUS"
  | "INVALID_GRID_SEGMENTS"
  | "INVALID_HEIGHT_SAMPLE"
  | "INVALID_SHELL_VERTEX"
  | "UNSUPPORTED_MESH_PRECISION";

export class PlanetShellMeshError extends Error {
  public constructor(
    public readonly code: PlanetShellMeshErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PlanetShellMeshError";
  }
}

const frozenVec3 = (x: number, y: number, z: number): Vec3 => Object.freeze({ x, y, z });

const frozenBounds = (
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
): PlanetShellBounds => Object.freeze({
  min: frozenVec3(minX, minY, minZ),
  max: frozenVec3(maxX, maxY, maxZ)
});

const finiteFloat32 = (value: number): number => {
  const result = Math.fround(value);
  if (!Number.isFinite(result)) {
    throw new PlanetShellMeshError(
      "INVALID_SHELL_VERTEX",
      "Planet shell relative vertices and normals must be finite Float32 values."
    );
  }
  return result === 0 ? 0 : result;
};

export const zeroPlanetHeightSampler: PlanetHeightSampler = () => 0;

export const createDeterministicPlanetHeightSampler = (amplitudeMeters = 1): PlanetHeightSampler => {
  if (!Number.isFinite(amplitudeMeters) || amplitudeMeters < 0) {
    throw new PlanetShellMeshError(
      "INVALID_HEIGHT_SAMPLE",
      "Deterministic harness height amplitude must be a finite non-negative number."
    );
  }
  return (sample) => amplitudeMeters * (
    0.55 * Math.sin(sample.direction.x * 11 + sample.direction.y * 7 + sample.direction.z * 5) +
    0.30 * Math.cos(sample.direction.x * 13 - sample.direction.y * 3 + sample.direction.z * 17) +
    0.15 * (sample.direction.x - sample.direction.y + sample.direction.z)
  );
};

const assertSupportedTriangleGeometry = (
  tileId: PlanetTileId,
  positionsRelative: Float32Array,
  normals: Float32Array,
  indices: PlanetShellMeshIndexArray
): void => {
  for (let indexOffset = 0; indexOffset < indices.length; indexOffset += 3) {
    const aOffset = indices[indexOffset] * 3;
    const bOffset = indices[indexOffset + 1] * 3;
    const cOffset = indices[indexOffset + 2] * 3;
    const abX = positionsRelative[bOffset] - positionsRelative[aOffset];
    const abY = positionsRelative[bOffset + 1] - positionsRelative[aOffset + 1];
    const abZ = positionsRelative[bOffset + 2] - positionsRelative[aOffset + 2];
    const acX = positionsRelative[cOffset] - positionsRelative[aOffset];
    const acY = positionsRelative[cOffset + 1] - positionsRelative[aOffset + 1];
    const acZ = positionsRelative[cOffset + 2] - positionsRelative[aOffset + 2];
    const crossX = abY * acZ - abZ * acY;
    const crossY = abZ * acX - abX * acZ;
    const crossZ = abX * acY - abY * acX;
    const areaSquared = crossX * crossX + crossY * crossY + crossZ * crossZ;
    const outwardX = normals[aOffset] + normals[bOffset] + normals[cOffset];
    const outwardY = normals[aOffset + 1] + normals[bOffset + 1] + normals[cOffset + 1];
    const outwardZ = normals[aOffset + 2] + normals[bOffset + 2] + normals[cOffset + 2];
    const outwardDot = crossX * outwardX + crossY * outwardY + crossZ * outwardZ;

    if (!Number.isFinite(areaSquared) || areaSquared <= 0 || !Number.isFinite(outwardDot) || outwardDot <= 0) {
      throw new PlanetShellMeshError(
        "UNSUPPORTED_MESH_PRECISION",
        `Planet shell tile ${tileId} cannot produce distinct positive-area outward triangles at available precision (triangle ${indexOffset / 3}).`
      );
    }
  }
};

export const generatePlanetShellMesh = (input: PlanetShellMeshInput): PlanetShellMesh => {
  if (input === null || typeof input !== "object" || typeof input.heightSampler !== "function") {
    throw new PlanetShellMeshError("INVALID_SHELL_INPUT", "Planet shell input and height sampler are required.");
  }
  if (!Number.isFinite(input.radiusMeters) || input.radiusMeters <= 0) {
    throw new PlanetShellMeshError("INVALID_RADIUS", "Planet radius must be a finite positive number.");
  }
  if (
    !Number.isSafeInteger(input.gridSegments) ||
    input.gridSegments < 1 ||
    input.gridSegments > MAX_PLANET_SHELL_GRID_SEGMENTS
  ) {
    throw new PlanetShellMeshError(
      "INVALID_GRID_SEGMENTS",
      `Planet shell gridSegments must be a safe integer in [1, ${MAX_PLANET_SHELL_GRID_SEGMENTS}].`
    );
  }

  const tileKey = createPlanetTileKey(input.tileKey);
  const tileId = planetTileId(tileKey);
  const faceBounds = planetTileFaceUvBounds(tileKey);
  const centerDirection = planetTileCenterDirection(tileKey);
  const originBodyCentered = frozenVec3(
    centerDirection.x * input.radiusMeters,
    centerDirection.y * input.radiusMeters,
    centerDirection.z * input.radiusMeters
  );
  if (![originBodyCentered.x, originBodyCentered.y, originBodyCentered.z].every(Number.isFinite)) {
    throw new PlanetShellMeshError("INVALID_SHELL_VERTEX", "Planet shell origin must remain finite in body coordinates.");
  }

  const rowLength = input.gridSegments + 1;
  const vertexCount = rowLength * rowLength;
  const positionsRelative = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const indexCount = input.gridSegments * input.gridSegments * 6;
  const indices: PlanetShellMeshIndexArray = vertexCount <= 0xffff
    ? new Uint16Array(indexCount)
    : new Uint32Array(indexCount);

  let minBodyX = Number.POSITIVE_INFINITY;
  let minBodyY = Number.POSITIVE_INFINITY;
  let minBodyZ = Number.POSITIVE_INFINITY;
  let maxBodyX = Number.NEGATIVE_INFINITY;
  let maxBodyY = Number.NEGATIVE_INFINITY;
  let maxBodyZ = Number.NEGATIVE_INFINITY;
  let minRelativeX = Number.POSITIVE_INFINITY;
  let minRelativeY = Number.POSITIVE_INFINITY;
  let minRelativeZ = Number.POSITIVE_INFINITY;
  let maxRelativeX = Number.NEGATIVE_INFINITY;
  let maxRelativeY = Number.NEGATIVE_INFINITY;
  let maxRelativeZ = Number.NEGATIVE_INFINITY;

  for (let gridY = 0; gridY <= input.gridSegments; gridY += 1) {
    const sampleV = gridY / input.gridSegments;
    const faceV = faceBounds.minV + (faceBounds.maxV - faceBounds.minV) * sampleV;
    for (let gridX = 0; gridX <= input.gridSegments; gridX += 1) {
      const sampleU = gridX / input.gridSegments;
      const faceU = faceBounds.minU + (faceBounds.maxU - faceBounds.minU) * sampleU;
      const direction = planetFaceUvToDirection({ face: tileKey.face, u: faceU, v: faceV });
      const height = input.heightSampler(Object.freeze({
        bodyId: tileKey.bodyId,
        tileId,
        tileKey,
        direction,
        gridX,
        gridY,
        gridSegments: input.gridSegments,
        sampleU,
        sampleV,
        faceU,
        faceV
      }));
      if (!Number.isFinite(height) || input.radiusMeters + height <= 0) {
        throw new PlanetShellMeshError(
          "INVALID_HEIGHT_SAMPLE",
          `Planet height sampler returned an invalid height at grid sample ${gridX},${gridY}.`
        );
      }

      const radialDistance = input.radiusMeters + height;
      const bodyX = direction.x * radialDistance;
      const bodyY = direction.y * radialDistance;
      const bodyZ = direction.z * radialDistance;
      if (![bodyX, bodyY, bodyZ].every(Number.isFinite)) {
        throw new PlanetShellMeshError("INVALID_SHELL_VERTEX", "Planet shell body-centered vertices must be finite.");
      }
      const relativeX = finiteFloat32(bodyX - originBodyCentered.x);
      const relativeY = finiteFloat32(bodyY - originBodyCentered.y);
      const relativeZ = finiteFloat32(bodyZ - originBodyCentered.z);
      const vertexIndex = gridY * rowLength + gridX;
      const positionOffset = vertexIndex * 3;
      const uvOffset = vertexIndex * 2;
      positionsRelative[positionOffset] = relativeX;
      positionsRelative[positionOffset + 1] = relativeY;
      positionsRelative[positionOffset + 2] = relativeZ;
      normals[positionOffset] = finiteFloat32(direction.x);
      normals[positionOffset + 1] = finiteFloat32(direction.y);
      normals[positionOffset + 2] = finiteFloat32(direction.z);
      uv[uvOffset] = finiteFloat32(sampleU);
      uv[uvOffset + 1] = finiteFloat32(sampleV);

      minBodyX = Math.min(minBodyX, bodyX);
      minBodyY = Math.min(minBodyY, bodyY);
      minBodyZ = Math.min(minBodyZ, bodyZ);
      maxBodyX = Math.max(maxBodyX, bodyX);
      maxBodyY = Math.max(maxBodyY, bodyY);
      maxBodyZ = Math.max(maxBodyZ, bodyZ);
      minRelativeX = Math.min(minRelativeX, relativeX);
      minRelativeY = Math.min(minRelativeY, relativeY);
      minRelativeZ = Math.min(minRelativeZ, relativeZ);
      maxRelativeX = Math.max(maxRelativeX, relativeX);
      maxRelativeY = Math.max(maxRelativeY, relativeY);
      maxRelativeZ = Math.max(maxRelativeZ, relativeZ);
    }
  }

  let indexOffset = 0;
  for (let gridY = 0; gridY < input.gridSegments; gridY += 1) {
    for (let gridX = 0; gridX < input.gridSegments; gridX += 1) {
      const lowerLeft = gridY * rowLength + gridX;
      const lowerRight = lowerLeft + 1;
      const upperLeft = lowerLeft + rowLength;
      const upperRight = upperLeft + 1;
      indices[indexOffset] = lowerLeft;
      indices[indexOffset + 1] = lowerRight;
      indices[indexOffset + 2] = upperLeft;
      indices[indexOffset + 3] = lowerRight;
      indices[indexOffset + 4] = upperRight;
      indices[indexOffset + 5] = upperLeft;
      indexOffset += 6;
    }
  }

  assertSupportedTriangleGeometry(tileId, positionsRelative, normals, indices);

  return Object.freeze({
    algorithmVersion: PLANET_SHELL_MESH_ALGORITHM_VERSION,
    tileId,
    tileKey,
    radiusMeters: input.radiusMeters,
    gridSegments: input.gridSegments,
    originBodyCentered,
    boundsBodyCentered: frozenBounds(minBodyX, minBodyY, minBodyZ, maxBodyX, maxBodyY, maxBodyZ),
    positionsRelative,
    normals,
    indices,
    uv,
    boundsRelative: frozenBounds(
      minRelativeX,
      minRelativeY,
      minRelativeZ,
      maxRelativeX,
      maxRelativeY,
      maxRelativeZ
    )
  });
};
