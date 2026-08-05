export interface CellCoord {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type ChunkCoord = CellCoord;
export type LocalCellCoord = CellCoord;

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CellAabb {
  readonly min: CellCoord;
  readonly max: CellCoord;
}

export type PhysicalClass = "air" | "soil" | "rock" | "sand" | "wet" | "wood" | "foliage" | "flora";

export interface PaletteRecord {
  readonly id: number;
  readonly name: string;
  readonly baseColor: `#${string}`;
  readonly roughness: number;
  readonly emissive: number;
  readonly physicalClass: PhysicalClass;
  readonly destructible: boolean;
}

export interface GeneratedChunk {
  readonly coord: ChunkCoord;
  readonly sourceRevision: number;
  readonly cells: Uint8Array;
}

export interface AuthorityChunkMetadata {
  readonly key: string;
  readonly coord: ChunkCoord;
  readonly sourceRevision: number;
  readonly authorityRevision: number;
  readonly dirtyLocalAabb: CellAabb | null;
  readonly contentSignature: string;
  readonly nonAirCells: number;
}

export interface AuthorityChunkSnapshot extends AuthorityChunkMetadata {
  readonly requestedRevision: number;
  readonly cells: Uint8Array;
}

export interface HaloSnapshot {
  readonly key: string;
  readonly coord: ChunkCoord;
  readonly requestedRevision: number;
  readonly chunkAuthorityRevision: number;
  readonly cells: Uint8Array;
}

export interface SubtractSphereCommand {
  readonly editId: string;
  readonly sequence: number;
  readonly expectedWorldRevision: number;
  readonly center: CellCoord;
  readonly radiusCells: number;
}

export type EditStatus = "Accepted" | "NoChange" | "Duplicate" | "OutOfOrder" | "Stale" | "OutOfRange";

export interface EditChunkChange {
  readonly key: string;
  readonly coord: ChunkCoord;
  readonly authorityRevision: number;
  readonly dirtyLocalAabb: CellAabb;
  readonly contentSignature: string;
}

export interface EditResult {
  readonly status: EditStatus;
  readonly editId: string;
  readonly sequence: number;
  readonly worldRevision: number;
  readonly changedCells: number;
  readonly changedChunks: readonly EditChunkChange[];
  readonly remeshChunkKeys: readonly string[];
}
