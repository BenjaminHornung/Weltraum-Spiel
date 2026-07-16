import type { DefinitionResolutionSnapshot, SaveGameEnvelopeV1, SimulationTick } from "../persistence";
import type { SaveRecordRevision, SaveRepositorySchemaVersion, SaveSlotId } from "./ids";

declare const saveContentHashBrand: unique symbol;

export type SaveContentHash = `sha256:${string}` & { readonly [saveContentHashBrand]: "SaveContentHash" };
export type SaveSchemaVersion = 1;

export interface SaveSlotMetadata {
  readonly slotId: SaveSlotId;
  readonly displayName: string;
  readonly recordRevision: SaveRecordRevision;
  readonly saveSchemaVersion: SaveSchemaVersion;
  readonly gameVersion: string;
  readonly universeTick: SimulationTick;
  readonly payloadBytes: number;
  readonly contentHash: SaveContentHash;
  readonly lastWriteReason: string;
}

export interface StoredSaveRecord {
  readonly metadata: SaveSlotMetadata;
  readonly payloadBytes: Uint8Array;
}

export interface SaveWriteRequest {
  readonly slotId: SaveSlotId | string;
  readonly expectedRevision: SaveRecordRevision | number | null;
  readonly envelope: unknown;
  readonly lastWriteReason: string;
}

export interface SaveReadResult {
  readonly metadata: SaveSlotMetadata;
  readonly envelope: SaveGameEnvelopeV1;
  readonly payloadBytes: Uint8Array;
}

export type SaveWriteResult = SaveReadResult;

export interface SaveDeleteResult {
  readonly slotId: SaveSlotId;
  readonly deletedRevision: SaveRecordRevision;
}

export interface SaveListResult {
  readonly slots: readonly SaveSlotMetadata[];
}

export interface SaveExportBundle {
  readonly bundleVersion: 1;
  readonly repositorySchemaVersion: SaveRepositorySchemaVersion;
  readonly saveSchemaVersion: SaveSchemaVersion;
  readonly metadata: SaveSlotMetadata;
  readonly canonicalPayload: string;
  readonly payloadBytes: number;
  readonly contentHash: SaveContentHash;
}

export type SaveImportPolicy =
  | { readonly kind: "RejectIfExists" }
  | { readonly kind: "ReplaceExpectedRevision"; readonly expectedRevision: SaveRecordRevision | number }
  | { readonly kind: "CreateNewSlot"; readonly targetSlotId: SaveSlotId | string };

export interface EncodedSavePayload {
  readonly envelope: SaveGameEnvelopeV1;
  readonly canonicalPayload: string;
  readonly payloadBytes: Uint8Array;
  readonly contentHash: SaveContentHash;
}

export interface DecodedExportBundle {
  readonly bundle: SaveExportBundle;
  readonly envelope: SaveGameEnvelopeV1;
  readonly payloadBytes: Uint8Array;
}

export interface SaveCodec {
  readonly definitionSnapshots: readonly DefinitionResolutionSnapshot[];
  encode(value: unknown): Promise<EncodedSavePayload>;
  decodeStoredRecord(value: unknown): Promise<SaveReadResult>;
  decodeExportBundle(value: unknown): Promise<DecodedExportBundle>;
}
