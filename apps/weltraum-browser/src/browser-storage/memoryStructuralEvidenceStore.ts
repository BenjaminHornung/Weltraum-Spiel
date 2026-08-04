import {
  createStructuralEvidenceStoredRecordV2,
  StructuralEvidenceStoreError,
  structuralEvidencePutReceipt,
  validateStructuralEvidenceHashV2,
  validateStructuralEvidenceStoredRecordV2,
  type StructuralEvidenceRecordStoreV2,
  type StructuralEvidencePutReceiptV2
} from "./structuralEvidenceStore";

export class MemoryStructuralEvidenceStore implements StructuralEvidenceRecordStoreV2 {
  public readonly records = new Map<string, unknown>();
  #state: "new" | "open" | "closed" = "new";

  public async initialize(): Promise<void> {
    if (this.#state === "closed") {
      throw new StructuralEvidenceStoreError("ClosedRepository", "initialize", "Structural Evidence store is permanently closed.");
    }
    this.#state = "open";
  }

  public async resolve(hash: string): Promise<string | null> {
    this.#assertOpen("resolve", hash);
    validateStructuralEvidenceHashV2(hash, "resolve");
    const record = this.records.get(hash);
    if (record === undefined) return null;
    return validateStructuralEvidenceStoredRecordV2(hash, record, "resolve").canonicalBytes;
  }

  public async putIfAbsent(hash: string, canonicalBytes: string): Promise<StructuralEvidencePutReceiptV2> {
    this.#assertOpen("putIfAbsent", hash);
    const record = createStructuralEvidenceStoredRecordV2(hash, canonicalBytes);
    const existing = this.records.get(hash);
    if (existing !== undefined) {
      const validated = validateStructuralEvidenceStoredRecordV2(hash, existing, "putIfAbsent");
      if (validated.canonicalBytes !== record.canonicalBytes) {
        throw new StructuralEvidenceStoreError("RecordConflict", "putIfAbsent", "Structural Evidence key already stores different bytes.", hash);
      }
      return structuralEvidencePutReceipt(hash, record.byteLength, true);
    }
    this.records.set(hash, record);
    return structuralEvidencePutReceipt(hash, record.byteLength, false);
  }

  public async close(): Promise<void> {
    this.#state = "closed";
  }

  #assertOpen(operation: string, hash?: string): void {
    if (this.#state === "closed") {
      throw new StructuralEvidenceStoreError("ClosedRepository", operation, "Structural Evidence store is permanently closed.", hash);
    }
    if (this.#state !== "open") {
      throw new StructuralEvidenceStoreError("RepositoryUnavailable", operation, "Structural Evidence store has not been initialized.", hash);
    }
  }
}

export const createMemoryStructuralEvidenceStore = (): MemoryStructuralEvidenceStore =>
  new MemoryStructuralEvidenceStore();