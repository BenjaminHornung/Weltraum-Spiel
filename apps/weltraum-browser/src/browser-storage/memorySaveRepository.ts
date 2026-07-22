import type { DefinitionResolutionSnapshot, SimulationTick } from "../persistence";
import {
  copySaveSlotMetadata,
  createSaveCodec,
  createStoredSaveRecord
} from "./codec";
import { SaveRepositoryError } from "./errors";
import {
  createImportedMetadata,
  createImportedWriteResult,
  createSaveExportBundle,
  prepareSaveImport
} from "./exportImport";
import {
  parseSaveRecordRevision,
  parseSaveSlotId,
  type SaveRecordRevision,
  type SaveSlotId
} from "./ids";
import type { SaveRepository } from "./saveRepository";
import type {
  EncodedSavePayload,
  SaveDeleteResult,
  SaveExportBundle,
  SaveImportPolicy,
  SaveListResult,
  SaveReadResult,
  SaveSlotMetadata,
  SaveWriteRequest,
  SaveWriteResult,
  StoredSaveRecord
} from "./types";
import { parseSaveWriteRequest } from "./saveWriteRequest";

type RepositoryState = "new" | "open" | "closed";

const ordinalCompare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const writeResultFrom = (
  metadata: SaveSlotMetadata,
  encoded: Pick<EncodedSavePayload, "envelope" | "payloadBytes">
): SaveWriteResult => Object.freeze({
  metadata: copySaveSlotMetadata(metadata),
  envelope: encoded.envelope,
  payloadBytes: new Uint8Array(encoded.payloadBytes)
});

export class MemorySaveRepository implements SaveRepository {
  readonly #codec;
  readonly #records = new Map<string, StoredSaveRecord>();
  #state: RepositoryState = "new";

  public constructor(definitionSnapshots: readonly DefinitionResolutionSnapshot[]) {
    this.#codec = createSaveCodec(definitionSnapshots);
  }

  public async initialize(): Promise<void> {
    if (this.#state === "closed") {
      throw new SaveRepositoryError("ClosedRepository", "initialize", "Repository instance is permanently closed.");
    }
    this.#state = "open";
  }

  public async listSlots(): Promise<SaveListResult> {
    this.#assertOpen("listSlots");
    const slots = [...this.#records.values()]
      .map((record) => copySaveSlotMetadata(record.metadata))
      .sort((left, right) => ordinalCompare(left.slotId, right.slotId));
    return Object.freeze({ slots: Object.freeze(slots) });
  }

  public async readSlot(slotIdValue: SaveSlotId | string): Promise<SaveReadResult> {
    this.#assertOpen("readSlot");
    const slotId = parseSaveSlotId(slotIdValue, "readSlot");
    const record = this.#records.get(slotId);
    if (record === undefined) {
      throw new SaveRepositoryError("SlotNotFound", "readSlot", "Save slot does not exist.", slotId);
    }
    return this.#codec.decodeStoredRecord(createStoredSaveRecord(record.metadata, record.payloadBytes));
  }

  public async writeSlot(request: SaveWriteRequest): Promise<SaveWriteResult> {
    this.#assertOpen("writeSlot");
    const { slotId, expectedRevision, envelope, lastWriteReason } = parseSaveWriteRequest(request);
    const encoded = await this.#codec.encode(envelope);
    const current = this.#records.get(slotId);
    const revision = this.#nextWriteRevision(slotId, current, expectedRevision, "writeSlot");
    const metadata = this.#metadataFor(
      slotId,
      current?.metadata.displayName ?? slotId,
      revision,
      encoded,
      lastWriteReason
    );
    const committed = createStoredSaveRecord(metadata, encoded.payloadBytes);
    const result = writeResultFrom(metadata, encoded);
    this.#records.set(slotId, committed);
    return result;
  }

  public async deleteSlot(
    slotIdValue: SaveSlotId | string,
    expectedRevisionValue: SaveRecordRevision | number
  ): Promise<SaveDeleteResult> {
    this.#assertOpen("deleteSlot");
    const slotId = parseSaveSlotId(slotIdValue, "deleteSlot");
    const expectedRevision = parseSaveRecordRevision(expectedRevisionValue, "deleteSlot", false);
    const current = this.#records.get(slotId);
    if (current === undefined) {
      throw new SaveRepositoryError("SlotNotFound", "deleteSlot", "Save slot does not exist.", slotId);
    }
    if (current.metadata.recordRevision !== expectedRevision) {
      throw new SaveRepositoryError("RevisionConflict", "deleteSlot", "Delete revision does not match.", slotId);
    }
    const result = Object.freeze({ slotId, deletedRevision: current.metadata.recordRevision });
    this.#records.delete(slotId);
    return result;
  }

  public async exportSlot(slotIdValue: SaveSlotId | string): Promise<SaveExportBundle> {
    this.#assertOpen("exportSlot");
    return createSaveExportBundle(await this.readSlot(slotIdValue));
  }

  public async importSlot(bundleValue: unknown, policy: SaveImportPolicy): Promise<SaveWriteResult> {
    this.#assertOpen("importSlot");
    const prepared = await prepareSaveImport(this.#codec, bundleValue, policy);
    const { policy: parsedPolicy, targetSlotId } = prepared;
    const current = this.#records.get(targetSlotId);
    let revision: SaveRecordRevision;

    if (parsedPolicy.kind === "RejectIfExists" || parsedPolicy.kind === "CreateNewSlot") {
      if (current !== undefined) {
        throw new SaveRepositoryError("ImportConflict", "importSlot", "Import target already exists.", targetSlotId);
      }
      revision = 1 as SaveRecordRevision;
    } else {
      if (current === undefined || current.metadata.recordRevision !== parsedPolicy.expectedRevision) {
        throw new SaveRepositoryError("ImportConflict", "importSlot", "Import replacement revision does not match.", targetSlotId);
      }
      revision = this.#incrementRevision(current.metadata.recordRevision, "importSlot", targetSlotId);
    }

    const metadata = createImportedMetadata(prepared, revision);
    const committed = createStoredSaveRecord(metadata, prepared.decoded.payloadBytes);
    const result = createImportedWriteResult(prepared, metadata);
    this.#records.set(targetSlotId, committed);
    return result;
  }

  public async close(): Promise<void> {
    this.#state = "closed";
  }

  #assertOpen(operation: string): void {
    if (this.#state === "closed") {
      throw new SaveRepositoryError("ClosedRepository", operation, "Repository instance is permanently closed.");
    }
    if (this.#state !== "open") {
      throw new SaveRepositoryError("RepositoryUnavailable", operation, "Repository has not been initialized.");
    }
  }

  #nextWriteRevision(
    slotId: SaveSlotId,
    current: StoredSaveRecord | undefined,
    expectedRevision: SaveRecordRevision | null,
    operation: string
  ): SaveRecordRevision {
    if (current === undefined) {
      if (expectedRevision !== null && expectedRevision !== 0) {
        throw new SaveRepositoryError("RevisionConflict", operation, "Missing slot cannot satisfy expected revision.", slotId);
      }
      return 1 as SaveRecordRevision;
    }
    if (expectedRevision === null) {
      throw new SaveRepositoryError("SlotAlreadyExists", operation, "Create-only write target already exists.", slotId);
    }
    if (current.metadata.recordRevision !== expectedRevision) {
      throw new SaveRepositoryError("RevisionConflict", operation, "Write revision does not match.", slotId);
    }
    return this.#incrementRevision(current.metadata.recordRevision, operation, slotId);
  }

  #incrementRevision(current: SaveRecordRevision, operation: string, slotId: SaveSlotId): SaveRecordRevision {
    if (current >= Number.MAX_SAFE_INTEGER) {
      throw new SaveRepositoryError("TransactionFailed", operation, "Record revision cannot be incremented safely.", slotId);
    }
    return (current + 1) as SaveRecordRevision;
  }

  #metadataFor(
    slotId: SaveSlotId,
    displayName: string,
    revision: SaveRecordRevision,
    encoded: Pick<EncodedSavePayload, "envelope" | "payloadBytes" | "contentHash">,
    lastWriteReason: string
  ): SaveSlotMetadata {
    return Object.freeze({
      slotId,
      displayName,
      recordRevision: revision,
      saveSchemaVersion: 1,
      gameVersion: encoded.envelope.gameVersion,
      universeTick: encoded.envelope.universeTime.tick as SimulationTick,
      payloadBytes: encoded.payloadBytes.byteLength,
      contentHash: encoded.contentHash,
      lastWriteReason
    });
  }

}

export const createMemorySaveRepository = (
  definitionSnapshots: readonly DefinitionResolutionSnapshot[]
): MemorySaveRepository => new MemorySaveRepository(definitionSnapshots);
