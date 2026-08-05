import { CHUNK_EDGE, HALO_CELL_COUNT, HALO_EDGE, VOXEL_SIZE_METERS } from "./constants";
import { chunkKey } from "./coordinates";
import { VoxelMaterial, paletteRecord } from "./palette";
import type { HaloSnapshot } from "./types";

type Axis = 0 | 1 | 2;
type Sign = -1 | 1;
type Components = [number, number, number];
type AoTuple = readonly [number, number, number, number];

export interface MeshMaterialRange {
  readonly materialId: number;
  readonly indexStart: number;
  readonly indexCount: number;
}

export interface GreedyChunkMesh {
  readonly key: string;
  readonly coord: HaloSnapshot["coord"];
  readonly requestedRevision: number;
  readonly chunkAuthorityRevision: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly materialIds: Uint8Array;
  readonly ao: Uint8Array;
  readonly materialRanges: readonly MeshMaterialRange[];
  readonly quadCount: number;
  readonly triangleCount: number;
  readonly vertexCount: number;
  readonly byteLength: number;
}

interface FaceCell {
  readonly materialId: number;
  readonly sign: Sign;
  readonly ao: AoTuple;
}

interface GreedyQuad extends FaceCell {
  readonly axis: Axis;
  readonly slice: number;
  readonly u: number;
  readonly v: number;
  readonly width: number;
  readonly height: number;
}

const haloIndex = (x: number, y: number, z: number): number =>
  (x + 1) + HALO_EDGE * ((z + 1) + HALO_EDGE * (y + 1));

const haloCell = (snapshot: HaloSnapshot, cell: Components): number =>
  snapshot.cells[haloIndex(cell[0], cell[1], cell[2])] ?? VoxelMaterial.Air;

const validateSnapshot = (snapshot: HaloSnapshot): void => {
  if (snapshot.key !== chunkKey(snapshot.coord)) throw new Error("V2 halo key does not match its chunk coordinate.");
  if (
    !Number.isInteger(snapshot.coord.x) || !Number.isInteger(snapshot.coord.y) || !Number.isInteger(snapshot.coord.z)
    || !Number.isSafeInteger(snapshot.requestedRevision) || snapshot.requestedRevision < 0
    || !Number.isSafeInteger(snapshot.chunkAuthorityRevision) || snapshot.chunkAuthorityRevision < 0
  ) {
    throw new Error("V2 halo metadata is invalid.");
  }
  if (!(snapshot.cells instanceof Uint8Array) || snapshot.cells.length !== HALO_CELL_COUNT) {
    throw new Error("V2 meshing requires one complete copied 34-cubed halo.");
  }
  for (const material of snapshot.cells) paletteRecord(material);
};

const cornerAo = (
  snapshot: HaloSnapshot,
  owner: Components,
  axis: Axis,
  sign: Sign,
  uAxis: Axis,
  vAxis: Axis,
  uSign: Sign,
  vSign: Sign
): number => {
  const outside: Components = [...owner];
  outside[axis] += sign;
  const sideU: Components = [...outside];
  sideU[uAxis] += uSign;
  const sideV: Components = [...outside];
  sideV[vAxis] += vSign;
  const corner: Components = [...sideU];
  corner[vAxis] += vSign;
  const occupiedU = haloCell(snapshot, sideU) !== VoxelMaterial.Air ? 1 : 0;
  const occupiedV = haloCell(snapshot, sideV) !== VoxelMaterial.Air ? 1 : 0;
  const occupiedCorner = haloCell(snapshot, corner) !== VoxelMaterial.Air ? 1 : 0;
  return occupiedU === 1 && occupiedV === 1 ? 0 : 3 - occupiedU - occupiedV - occupiedCorner;
};

const faceAo = (
  snapshot: HaloSnapshot,
  owner: Components,
  axis: Axis,
  sign: Sign,
  uAxis: Axis,
  vAxis: Axis
): AoTuple => {
  const canonical: AoTuple = [
    cornerAo(snapshot, owner, axis, sign, uAxis, vAxis, -1, -1),
    cornerAo(snapshot, owner, axis, sign, uAxis, vAxis, 1, -1),
    cornerAo(snapshot, owner, axis, sign, uAxis, vAxis, 1, 1),
    cornerAo(snapshot, owner, axis, sign, uAxis, vAxis, -1, 1)
  ];
  return sign === 1 ? canonical : [canonical[0], canonical[3], canonical[2], canonical[1]];
};

const sameFace = (left: FaceCell | null, right: FaceCell | null): boolean =>
  left !== null && right !== null
  && left.materialId === right.materialId
  && left.sign === right.sign
  && left.ao[0] === right.ao[0]
  && left.ao[1] === right.ao[1]
  && left.ao[2] === right.ao[2]
  && left.ao[3] === right.ao[3];

const faceForBoundary = (
  snapshot: HaloSnapshot,
  axis: Axis,
  uAxis: Axis,
  vAxis: Axis,
  slice: number,
  u: number,
  v: number
): FaceCell | null => {
  const lower: Components = [0, 0, 0];
  lower[axis] = slice;
  lower[uAxis] = u;
  lower[vAxis] = v;
  const upper: Components = [...lower];
  upper[axis] += 1;
  const lowerMaterial = haloCell(snapshot, lower);
  const upperMaterial = haloCell(snapshot, upper);

  if (slice >= 0 && lowerMaterial !== VoxelMaterial.Air && upperMaterial === VoxelMaterial.Air) {
    return { materialId: lowerMaterial, sign: 1, ao: faceAo(snapshot, lower, axis, 1, uAxis, vAxis) };
  }
  if (slice + 1 < CHUNK_EDGE && lowerMaterial === VoxelMaterial.Air && upperMaterial !== VoxelMaterial.Air) {
    return { materialId: upperMaterial, sign: -1, ao: faceAo(snapshot, upper, axis, -1, uAxis, vAxis) };
  }
  return null;
};

const appendQuad = (
  quad: GreedyQuad,
  positions: number[],
  normals: number[],
  indices: number[],
  materialIds: number[],
  ao: number[]
): void => {
  const uAxis = ((quad.axis + 1) % 3) as Axis;
  const vAxis = ((quad.axis + 2) % 3) as Axis;
  const u0 = quad.u;
  const u1 = quad.u + quad.width;
  const v0 = quad.v;
  const v1 = quad.v + quad.height;
  const corners: readonly (readonly [number, number])[] = quad.sign === 1
    ? [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
    : [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];
  const vertexStart = positions.length / 3;

  for (let cornerIndex = 0; cornerIndex < corners.length; cornerIndex += 1) {
    const point: Components = [0, 0, 0];
    point[quad.axis] = quad.slice + 1;
    point[uAxis] = corners[cornerIndex]![0];
    point[vAxis] = corners[cornerIndex]![1];
    positions.push(point[0] * VOXEL_SIZE_METERS, point[1] * VOXEL_SIZE_METERS, point[2] * VOXEL_SIZE_METERS);
    const normal: Components = [0, 0, 0];
    normal[quad.axis] = quad.sign;
    normals.push(...normal);
    materialIds.push(quad.materialId);
    ao.push(quad.ao[cornerIndex]!);
  }

  if (quad.ao[0] + quad.ao[2] > quad.ao[1] + quad.ao[3]) {
    indices.push(vertexStart, vertexStart + 1, vertexStart + 3, vertexStart + 1, vertexStart + 2, vertexStart + 3);
  } else {
    indices.push(vertexStart, vertexStart + 1, vertexStart + 2, vertexStart, vertexStart + 2, vertexStart + 3);
  }
};

export const meshGreedyChunk = (snapshot: HaloSnapshot): GreedyChunkMesh => {
  validateSnapshot(snapshot);
  const quadsByMaterial = new Map<number, GreedyQuad[]>();

  for (let axisValue = 0; axisValue < 3; axisValue += 1) {
    const axis = axisValue as Axis;
    const uAxis = ((axis + 1) % 3) as Axis;
    const vAxis = ((axis + 2) % 3) as Axis;
    for (let slice = -1; slice < CHUNK_EDGE; slice += 1) {
      const mask: (FaceCell | null)[] = new Array(CHUNK_EDGE * CHUNK_EDGE).fill(null);
      for (let v = 0; v < CHUNK_EDGE; v += 1) {
        for (let u = 0; u < CHUNK_EDGE; u += 1) {
          mask[u + CHUNK_EDGE * v] = faceForBoundary(snapshot, axis, uAxis, vAxis, slice, u, v);
        }
      }

      for (let v = 0; v < CHUNK_EDGE; v += 1) {
        for (let u = 0; u < CHUNK_EDGE;) {
          const maskIndex = u + CHUNK_EDGE * v;
          const face = mask[maskIndex];
          if (face === null) {
            u += 1;
            continue;
          }
          let width = 1;
          while (u + width < CHUNK_EDGE && sameFace(face, mask[maskIndex + width] ?? null)) width += 1;
          let height = 1;
          heightLoop: while (v + height < CHUNK_EDGE) {
            for (let offset = 0; offset < width; offset += 1) {
              if (!sameFace(face, mask[u + offset + CHUNK_EDGE * (v + height)] ?? null)) break heightLoop;
            }
            height += 1;
          }
          const bucket = quadsByMaterial.get(face.materialId) ?? [];
          bucket.push({ ...face, axis, slice, u, v, width, height });
          quadsByMaterial.set(face.materialId, bucket);
          for (let clearV = 0; clearV < height; clearV += 1) {
            for (let clearU = 0; clearU < width; clearU += 1) {
              mask[u + clearU + CHUNK_EDGE * (v + clearV)] = null;
            }
          }
          u += width;
        }
      }
    }
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const materialIds: number[] = [];
  const ao: number[] = [];
  const materialRanges: MeshMaterialRange[] = [];
  let quadCount = 0;
  for (const materialId of [...quadsByMaterial.keys()].sort((left, right) => left - right)) {
    const indexStart = indices.length;
    const quads = quadsByMaterial.get(materialId)!;
    for (const quad of quads) appendQuad(quad, positions, normals, indices, materialIds, ao);
    const indexCount = indices.length - indexStart;
    materialRanges.push({ materialId, indexStart, indexCount });
    quadCount += quads.length;
  }

  const typedPositions = new Float32Array(positions);
  const typedNormals = new Float32Array(normals);
  const typedIndices = new Uint32Array(indices);
  const typedMaterialIds = new Uint8Array(materialIds);
  const typedAo = new Uint8Array(ao);
  return {
    key: snapshot.key,
    coord: { ...snapshot.coord },
    requestedRevision: snapshot.requestedRevision,
    chunkAuthorityRevision: snapshot.chunkAuthorityRevision,
    positions: typedPositions,
    normals: typedNormals,
    indices: typedIndices,
    materialIds: typedMaterialIds,
    ao: typedAo,
    materialRanges,
    quadCount,
    triangleCount: typedIndices.length / 3,
    vertexCount: typedPositions.length / 3,
    byteLength: typedPositions.byteLength + typedNormals.byteLength + typedIndices.byteLength
      + typedMaterialIds.byteLength + typedAo.byteLength
  };
};
