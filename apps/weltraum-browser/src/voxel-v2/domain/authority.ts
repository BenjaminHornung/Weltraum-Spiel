import {
  CHUNK_CELL_COUNT,
  CHUNK_EDGE,
  DEFAULT_WORLD_SEED,
  HALO_EDGE,
  WORLD_VERSION,
  isWorldCell,
  isWorldChunk
} from "./constants";
import { contentSignature } from "./contentSignature";
import { chunkKey, globalToChunkLocal, localCellIndex, parseChunkKey } from "./coordinates";
import { HESTIA_V2_PALETTE, VoxelMaterial, paletteRecord } from "./palette";
import type {
  AuthorityChunkMetadata,
  AuthorityChunkSnapshot,
  CellAabb,
  CellCoord,
  ChunkCoord,
  EditChunkChange,
  EditResult,
  GeneratedChunk,
  HaloSnapshot,
  SubtractSphereCommand
} from "./types";

interface AuthorityChunkInternal {
  readonly key: string;
  readonly coord: ChunkCoord;
  readonly sourceRevision: number;
  authorityRevision: number;
  readonly cells: Uint8Array;
  dirtyLocalAabb: CellAabb | null;
  contentSignature: string;
  nonAirCells: number;
}

interface MutableBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

const countNonAir = (cells: Uint8Array): number => {
  let count = 0;
  for (const material of cells) if (material !== VoxelMaterial.Air) count += 1;
  return count;
};

const compareChunkKeys = (left: string, right: string): number => {
  const a = parseChunkKey(left);
  const b = parseChunkKey(right);
  return a.y - b.y || a.z - b.z || a.x - b.x;
};

const metadataOf = (chunk: AuthorityChunkInternal): AuthorityChunkMetadata => ({
  key: chunk.key,
  coord: { ...chunk.coord },
  sourceRevision: chunk.sourceRevision,
  authorityRevision: chunk.authorityRevision,
  dirtyLocalAabb: chunk.dirtyLocalAabb === null
    ? null
    : { min: { ...chunk.dirtyLocalAabb.min }, max: { ...chunk.dirtyLocalAabb.max } },
  contentSignature: chunk.contentSignature,
  nonAirCells: chunk.nonAirCells
});

const rejectedEdit = (command: SubtractSphereCommand, status: EditResult["status"], worldRevision: number): EditResult => ({
  status,
  editId: command.editId,
  sequence: command.sequence,
  worldRevision,
  changedCells: 0,
  changedChunks: [],
  remeshChunkKeys: []
});

const cellAabb = (bounds: MutableBounds): CellAabb => ({
  min: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
  max: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ }
});

const validateCommand = (command: SubtractSphereCommand): void => {
  if (command.editId.trim().length === 0) throw new Error("V2 edit ID is required.");
  if (!Number.isSafeInteger(command.sequence) || command.sequence < 1) throw new Error("V2 edit sequence must be a positive safe integer.");
  if (!Number.isSafeInteger(command.expectedWorldRevision) || command.expectedWorldRevision < 0) {
    throw new Error("V2 expected world revision must be a non-negative safe integer.");
  }
  if (!Number.isInteger(command.center.x) || !Number.isInteger(command.center.y) || !Number.isInteger(command.center.z)) {
    throw new Error("V2 edit centre must be a quantized cell coordinate.");
  }
  if (!Number.isFinite(command.radiusCells) || command.radiusCells < 0 || command.radiusCells > 4) {
    throw new Error("V2 edit radius must be between zero and four cells.");
  }
};

export class VoxelAuthority {
  private readonly chunks = new Map<string, AuthorityChunkInternal>();
  private readonly appliedEditIds = new Set<string>();
  private currentWorldRevision = 0;
  private currentSequence = 0;
  public readonly palette = HESTIA_V2_PALETTE;

  public constructor(
    public readonly seed = DEFAULT_WORLD_SEED,
    public readonly worldVersion = WORLD_VERSION
  ) {
    if (seed.trim().length === 0 || worldVersion.trim().length === 0) throw new Error("V2 authority seed and version are required.");
  }

  public get worldRevision(): number { return this.currentWorldRevision; }
  public get lastEditSequence(): number { return this.currentSequence; }
  public get residentChunkCount(): number { return this.chunks.size; }

  public adoptGeneratedChunk(generated: GeneratedChunk): AuthorityChunkMetadata | null {
    if (this.currentWorldRevision !== 0 || this.currentSequence !== 0) throw new Error("V2 generation cannot be adopted after edits begin.");
    if (!isWorldChunk(generated.coord.x, generated.coord.y, generated.coord.z)) throw new Error("Generated V2 chunk is outside the bounded world.");
    if (!Number.isSafeInteger(generated.sourceRevision) || generated.sourceRevision < 0) throw new Error("Generated V2 source revision is invalid.");
    if (!(generated.cells instanceof Uint8Array) || generated.cells.length !== CHUNK_CELL_COUNT) {
      throw new Error("Generated V2 chunk has an invalid cell buffer.");
    }
    for (const material of generated.cells) paletteRecord(material);
    const cells = generated.cells.slice();
    const nonAirCells = countNonAir(cells);
    const key = chunkKey(generated.coord);
    if (nonAirCells === 0) {
      this.chunks.delete(key);
      return null;
    }
    const chunk: AuthorityChunkInternal = {
      key,
      coord: { ...generated.coord },
      sourceRevision: generated.sourceRevision,
      authorityRevision: 0,
      cells,
      dirtyLocalAabb: null,
      contentSignature: contentSignature(cells),
      nonAirCells
    };
    this.chunks.set(key, chunk);
    return metadataOf(chunk);
  }

  public chunkMetadata(): readonly AuthorityChunkMetadata[] {
    return [...this.chunks.values()].sort((a, b) => compareChunkKeys(a.key, b.key)).map(metadataOf);
  }

  public metadata(key: string): AuthorityChunkMetadata | null {
    const chunk = this.chunks.get(key);
    return chunk ? metadataOf(chunk) : null;
  }

  public getCell(cell: CellCoord): number {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y) || !Number.isInteger(cell.z)) {
      throw new Error("V2 cell reads require integer coordinates.");
    }
    if (!isWorldCell(cell.x, cell.y, cell.z)) return VoxelMaterial.Air;
    const mapped = globalToChunkLocal(cell);
    return this.chunks.get(chunkKey(mapped.chunk))?.cells[localCellIndex(mapped.local)] ?? VoxelMaterial.Air;
  }

  public snapshotChunk(coord: ChunkCoord, requestedRevision = this.currentWorldRevision): AuthorityChunkSnapshot {
    if (!isWorldChunk(coord.x, coord.y, coord.z)) throw new Error("V2 snapshot chunk is outside the bounded world.");
    if (!Number.isSafeInteger(requestedRevision) || requestedRevision < 0) throw new Error("V2 requested revision is invalid.");
    const chunk = this.chunks.get(chunkKey(coord));
    if (!chunk) {
      const cells = new Uint8Array(CHUNK_CELL_COUNT);
      return {
        key: chunkKey(coord),
        coord: { ...coord },
        sourceRevision: 0,
        authorityRevision: 0,
        requestedRevision,
        dirtyLocalAabb: null,
        contentSignature: contentSignature(cells),
        nonAirCells: 0,
        cells
      };
    }
    return { ...metadataOf(chunk), requestedRevision, cells: chunk.cells.slice() };
  }

  public createHaloSnapshot(coord: ChunkCoord, requestedRevision = this.currentWorldRevision): HaloSnapshot {
    if (!isWorldChunk(coord.x, coord.y, coord.z)) throw new Error("V2 halo chunk is outside the bounded world.");
    if (!Number.isSafeInteger(requestedRevision) || requestedRevision < 0) throw new Error("V2 requested revision is invalid.");
    const cells = new Uint8Array(HALO_EDGE ** 3);
    let index = 0;
    for (let haloY = -1; haloY <= CHUNK_EDGE; haloY += 1) {
      for (let haloZ = -1; haloZ <= CHUNK_EDGE; haloZ += 1) {
        for (let haloX = -1; haloX <= CHUNK_EDGE; haloX += 1) {
          cells[index] = this.getCell({
            x: coord.x * CHUNK_EDGE + haloX,
            y: coord.y * CHUNK_EDGE + haloY,
            z: coord.z * CHUNK_EDGE + haloZ
          });
          index += 1;
        }
      }
    }
    return {
      key: chunkKey(coord),
      coord: { ...coord },
      requestedRevision,
      chunkAuthorityRevision: this.chunks.get(chunkKey(coord))?.authorityRevision ?? 0,
      cells
    };
  }

  public applySubtractSphere(command: SubtractSphereCommand): EditResult {
    validateCommand(command);
    if (this.appliedEditIds.has(command.editId) || command.sequence <= this.currentSequence) {
      return rejectedEdit(command, "Duplicate", this.currentWorldRevision);
    }
    if (command.sequence !== this.currentSequence + 1) return rejectedEdit(command, "OutOfOrder", this.currentWorldRevision);
    if (command.expectedWorldRevision !== this.currentWorldRevision) return rejectedEdit(command, "Stale", this.currentWorldRevision);
    if (!isWorldCell(command.center.x, command.center.y, command.center.z)) {
      return rejectedEdit(command, "OutOfRange", this.currentWorldRevision);
    }

    const changed = new Map<string, { chunk: AuthorityChunkInternal; bounds: MutableBounds }>();
    let changedCells = 0;
    const radiusSquared = command.radiusCells * command.radiusCells;
    const minX = Math.ceil(command.center.x - command.radiusCells);
    const maxX = Math.floor(command.center.x + command.radiusCells);
    const minY = Math.ceil(command.center.y - command.radiusCells);
    const maxY = Math.floor(command.center.y + command.radiusCells);
    const minZ = Math.ceil(command.center.z - command.radiusCells);
    const maxZ = Math.floor(command.center.z + command.radiusCells);

    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (!isWorldCell(x, y, z)) continue;
          const dx = x - command.center.x;
          const dy = y - command.center.y;
          const dz = z - command.center.z;
          if (dx * dx + dy * dy + dz * dz > radiusSquared + Number.EPSILON) continue;
          const mapped = globalToChunkLocal({ x, y, z });
          const chunk = this.chunks.get(chunkKey(mapped.chunk));
          if (!chunk) continue;
          const index = localCellIndex(mapped.local);
          const material = chunk.cells[index];
          if (material === VoxelMaterial.Air || !paletteRecord(material).destructible) continue;
          chunk.cells[index] = VoxelMaterial.Air;
          chunk.nonAirCells -= 1;
          changedCells += 1;
          const existing = changed.get(chunk.key);
          if (!existing) {
            changed.set(chunk.key, {
              chunk,
              bounds: {
                minX: mapped.local.x,
                minY: mapped.local.y,
                minZ: mapped.local.z,
                maxX: mapped.local.x,
                maxY: mapped.local.y,
                maxZ: mapped.local.z
              }
            });
          } else {
            existing.bounds.minX = Math.min(existing.bounds.minX, mapped.local.x);
            existing.bounds.minY = Math.min(existing.bounds.minY, mapped.local.y);
            existing.bounds.minZ = Math.min(existing.bounds.minZ, mapped.local.z);
            existing.bounds.maxX = Math.max(existing.bounds.maxX, mapped.local.x);
            existing.bounds.maxY = Math.max(existing.bounds.maxY, mapped.local.y);
            existing.bounds.maxZ = Math.max(existing.bounds.maxZ, mapped.local.z);
          }
        }
      }
    }

    this.appliedEditIds.add(command.editId);
    this.currentSequence = command.sequence;
    if (changedCells === 0) return rejectedEdit(command, "NoChange", this.currentWorldRevision);

    this.currentWorldRevision += 1;
    const remeshKeys = new Set<string>();
    const changedChunks: EditChunkChange[] = [];
    for (const { chunk, bounds } of changed.values()) {
      chunk.authorityRevision = this.currentWorldRevision;
      chunk.dirtyLocalAabb = cellAabb(bounds);
      chunk.contentSignature = contentSignature(chunk.cells);
      remeshKeys.add(chunk.key);
      const addNeighbour = (x: number, y: number, z: number): void => {
        if (isWorldChunk(x, y, z)) remeshKeys.add(chunkKey({ x, y, z }));
      };
      if (bounds.minX === 0) addNeighbour(chunk.coord.x - 1, chunk.coord.y, chunk.coord.z);
      if (bounds.maxX === CHUNK_EDGE - 1) addNeighbour(chunk.coord.x + 1, chunk.coord.y, chunk.coord.z);
      if (bounds.minY === 0) addNeighbour(chunk.coord.x, chunk.coord.y - 1, chunk.coord.z);
      if (bounds.maxY === CHUNK_EDGE - 1) addNeighbour(chunk.coord.x, chunk.coord.y + 1, chunk.coord.z);
      if (bounds.minZ === 0) addNeighbour(chunk.coord.x, chunk.coord.y, chunk.coord.z - 1);
      if (bounds.maxZ === CHUNK_EDGE - 1) addNeighbour(chunk.coord.x, chunk.coord.y, chunk.coord.z + 1);
      changedChunks.push({
        key: chunk.key,
        coord: { ...chunk.coord },
        authorityRevision: chunk.authorityRevision,
        dirtyLocalAabb: { min: { ...chunk.dirtyLocalAabb.min }, max: { ...chunk.dirtyLocalAabb.max } },
        contentSignature: chunk.contentSignature
      });
    }

    changedChunks.sort((a, b) => compareChunkKeys(a.key, b.key));
    return {
      status: "Accepted",
      editId: command.editId,
      sequence: command.sequence,
      worldRevision: this.currentWorldRevision,
      changedCells,
      changedChunks,
      remeshChunkKeys: [...remeshKeys].sort(compareChunkKeys)
    };
  }
}
