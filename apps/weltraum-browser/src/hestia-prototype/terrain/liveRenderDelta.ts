import {hvpAoDarknessFactor, hvpFaceAoSamples, hvpQuadIndexPattern, hvpUnpackAoSignature,
  hvpVertexAo, type HvpAoFace} from "../../voxel/blockAmbientOcclusion";
import type {HvpCompactMaterialRange, HvpCompactMesh} from "../../hvp/hvpCoastMesher";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";
import {HVP_CHUNK_MAX_OUTPUT, validateHvpChunkPayload} from "../../workers/hvpChunkJob";
import type {HvpChunkPayload} from "./terrainChunkInput";

const edge = 32, halo = 34, planeSize = edge * edge, planeCount = 6 * (edge + 1);
const offset = (p: readonly number[]) => p[0]! + p[1]! * halo + p[2]! * halo * halo;
const faces = ([0, 1, 2, 3, 4, 5] as const).map(face => {
  const axis = Math.floor(face / 2), positive = face % 2, direction = positive ? 1 : -1;
  const samples = [0, 1, 2, 3].map(corner => {
    const s = hvpFaceAoSamples(0, 0, 0, face, corner);
    return [offset(s.side1), offset(s.side2), offset(s.corner)] as const;
  });
  return {axis, positive, direction,
    row: axis === 0 ? 1 : 0, col: axis === 2 ? 1 : 2, rowFirst: face === 1 || face === 2 || face === 5, samples};
});
const factors = ([0, 1, 2, 3] as const).map(hvpAoDarknessFactor);
interface Quad {face: number; slice: number; row: number; col: number; height: number; width: number; key: number}

function packOccupancyRows(slots: Uint8Array, rows: Uint32Array, first: number, end: number): void {
  for (let row = first; row < end; row++) {
    const start = row * halo;
    let mask = 0;
    if (slots[start]! > 4 || slots[start + halo - 1]! > 4) throw new Error("Invalid chunk material");
    for (let x = 0; x < edge; x++) {
      const slot = slots[start + x + 1]!;
      if (slot > 4) throw new Error("Invalid chunk material");
      if (slot !== 0) mask |= 1 << x;
    }
    rows[row] = mask;
  }
}

interface FacePlanes {
  planes: Uint16Array;
  active: Uint8Array;
  exposed: Uint32Array;
  unitFaceCount: number;
}

function collectFaceRows(slots: Uint8Array, rows: Uint32Array, buffer: FacePlanes, z: number, first: number, end: number): void {
  const {planes, active, exposed} = buffer;
  for (let y = first; y < end; y++) {
    const row = y + 1 + (z + 1) * halo, occupied = rows[row]!, start = row * halo + 1;
    if (occupied === 0) continue;
    exposed[0] = occupied & ~((occupied << 1) | Number(slots[start - 1] !== 0));
    exposed[1] = occupied & ~((occupied >>> 1) | (Number(slots[start + edge] !== 0) << 31));
    exposed[2] = occupied & ~rows[row - 1]!;
    exposed[3] = occupied & ~rows[row + 1]!;
    exposed[4] = occupied & ~rows[row - halo]!;
    exposed[5] = occupied & ~rows[row + halo]!;
    for (let face = 0; face < 6; face++) {
      const orient = faces[face]!;
      let mask = exposed[face]!;
      while (mask !== 0) {
        const x = 31 - Math.clz32(mask & -mask), index = start + x;
        mask &= mask - 1;
        if (++buffer.unitFaceCount > 50_000) throw new Error("Chunk exposed face BudgetExceeded");
        let signature = 0;
        for (let corner = 0; corner < 4; corner++) {
          const [a, b, c] = orient.samples[corner]!;
          const level = hvpVertexAo(slots[index + a] !== 0, slots[index + b] !== 0, slots[index + c] !== 0);
          signature |= level << (corner * 2);
        }
        const slice = (orient.axis === 0 ? x : orient.axis === 1 ? y : z) + orient.positive;
        const plane = face * (edge + 1) + slice;
        const faceRow = orient.axis === 0 ? y : x, col = orient.axis === 2 ? y : z;
        active[plane] = 1;
        planes[plane * planeSize + faceRow * edge + col] = (signature << 3) | slots[index]!;
      }
    }
  }
}

function mergePlaneRows(planes: Uint16Array, plane: number, first: number, end: number, quads: Quad[], reserve: StructuralOwnedReserve): void {
  const face = Math.floor(plane / (edge + 1)), slice = plane % (edge + 1), base = plane * planeSize;
  for (let row = first; row < end; row++) {
    for (let col = 0; col < edge; col++) {
      const start = base + row * edge + col, key = planes[start]!;
      if (key === 0) continue;
      let width = 1, height = 1;
      while (col + width < edge && planes[start + width] === key) width++;
      rows: while (row + height < edge) {
        for (let i = 0; i < width; i++) if (planes[start + height * edge + i] !== key) break rows;
        height++;
      }
      for (let i = 0; i < height; i++) planes.fill(0, start + i * edge, start + i * edge + width);
      reserve(128);
      quads.push({face, slice, row, col, height, width, key});
    }
  }
}

interface MeshBuffers {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

function writeQuads(quads: Quad[], first: number, end: number, origin: number[], buffers: MeshBuffers, ranges: HvpCompactMaterialRange[]): void {
  const {positions, normals, colors, indices} = buffers;
  for (let i = first; i < end; i++) {
    const q = quads[i]!, f = faces[q.face]!, levels = hvpUnpackAoSignature(q.key >> 3);
    const winding = hvpQuadIndexPattern(q.face as HvpAoFace, levels);
    for (let c = 0; c < 4; c++) {
      const at = i * 12 + c * 3;
      const rowEnd = c === 2 || c === (f.rowFirst ? 1 : 3), colEnd = c === 2 || c === (f.rowFirst ? 3 : 1);
      positions[at + f.axis] = origin[f.axis]! + q.slice * .125;
      positions[at + f.row] = origin[f.row]! + (q.row + (rowEnd ? q.height : 0)) * .125;
      positions[at + f.col] = origin[f.col]! + (q.col + (colEnd ? q.width : 0)) * .125;
      normals[at + f.axis] = f.direction;
      colors[at] = colors[at + 1] = colors[at + 2] = factors[levels[c]!]!;
    }
    for (let j = 0; j < 6; j++) indices[i * 6 + j] = i * 4 + winding[j]!;
    const slot = q.key & 7, last = ranges.at(-1);
    if (last?.slot === slot) ranges[ranges.length - 1] = {...last, indexCount: last.indexCount + 6};
    else ranges.push({slot, startIndex: i * 6, indexCount: 6});
  }
}

/** Render the committed chunk from its normal worker halo. The cursor yields only
 * between bounded batches; all scanning and mesh writes finish in ordinary functions. */
export function* buildHvpLiveRenderChunkSteps(slots: Uint8Array, input: HvpChunkPayload, collisionBytes: number,
  reserve: StructuralOwnedReserve): Generator<string, HvpCompactMesh, unknown> {
  const payload = validateHvpChunkPayload(input);
  if (slots.length !== halo ** 3 || !Number.isSafeInteger(collisionBytes) || collisionBytes < 0) {
    throw new Error("Invalid live render chunk input");
  }
  reserve(16_384 + planeCount * (1 + planeSize * Uint16Array.BYTES_PER_ELEMENT));
  // Each row covers the 32 core x positions, including rows in the y/z halo.
  // Border x samples supply the missing neighbor bit for the first and last cell.
  reserve(halo * halo * Uint32Array.BYTES_PER_ELEMENT);
  const rows = new Uint32Array(halo * halo);
  for (let row = 0; row < rows.length; row += 64) {
    packOccupancyRows(slots, rows, row, Math.min(row + 64, rows.length));
    yield "liveRenderInputs";
  }
  const buffer: FacePlanes = {planes: new Uint16Array(planeCount * planeSize), active: new Uint8Array(planeCount),
    exposed: new Uint32Array(6), unitFaceCount: 0};
  for (let z = 0; z < edge; z++) {
    for (let row = 0; row < edge; row += 8) {
      collectFaceRows(slots, rows, buffer, z, row, row + 8);
      yield "liveRenderFaces";
    }
  }
  const {planes, active, unitFaceCount} = buffer;
  const quads: Quad[] = [];
  // Ascending normal, slice, row, column matches the reference packed-key sort. Each seed
  // expands columns first, then rows containing the entire matching material/AO interval.
  for (let plane = 0; plane < planeCount; plane++) {
    if (!active[plane]) continue;
    for (let row = 0; row < edge; row += 8) {
      mergePlaneRows(planes, plane, row, row + 8, quads, reserve);
      yield "liveRenderGreedy";
    }
  }
  const count = quads.length, outputBytes = count * 168 + 40;
  if (outputBytes + collisionBytes > HVP_CHUNK_MAX_OUTPUT) throw new Error("Chunk output BudgetExceeded");
  reserve(outputBytes + count * 128 + 4096, true);
  const positions = new Float32Array(count * 12), normals = new Float32Array(count * 12);
  const colors = new Float32Array(count * 12), indices = new Uint32Array(count * 6);
  const ranges: HvpCompactMaterialRange[] = [];
  const min = payload.originMeters, origin = [min.x, min.y, min.z];
  const buffers: MeshBuffers = {positions, normals, colors, indices};
  for (let first = 0; first < count; first += 128) {
    writeQuads(quads, first, Math.min(first + 128, count), origin, buffers, ranges);
    yield "liveRenderQuads";
  }
  if (outputBytes + collisionBytes + ranges.length * 12 > HVP_CHUNK_MAX_OUTPUT) throw new Error("Chunk output BudgetExceeded");
  return {positions, normals, colors, indices, materialRanges: ranges, faceCount: count, outerFaceCount: count,
    unitFaceCount, cavityFaceCount: 0, tempEstimateBytes: unitFaceCount * 8 + count * (96 + 42 * 8),
    sourceDigest: payload.sourceDigest, algorithmVersion: payload.renderVersion,
    boundsMeters: {min, max: {x: min.x + 4, y: min.y + 4, z: min.z + 4}}};
}
