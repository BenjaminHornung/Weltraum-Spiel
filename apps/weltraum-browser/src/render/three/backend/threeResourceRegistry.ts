import type {
  ArtifactRevision,
  ContentHash,
  MeshArtifact,
  RepresentationKey,
  SourceRevision
} from "../../../presentation";
import type { PreparedThreeMesh } from "./threeMeshFactory";

export interface ThreeResourceRecord {
  readonly representationKey: RepresentationKey;
  readonly sourceRevision: SourceRevision;
  readonly artifactRevision: ArtifactRevision;
  readonly contentHash: ContentHash;
  readonly commandSignature: ContentHash;
  readonly estimatedBytes: number;
  readonly artifact: MeshArtifact;
  readonly geometry: PreparedThreeMesh["geometry"];
  readonly materials: PreparedThreeMesh["materialLease"]["materials"];
  readonly sceneNode: PreparedThreeMesh["sceneNode"];
  readonly prepared: PreparedThreeMesh;
  pinnedAsFallback: boolean;
}

export type ResourceLedgerState = "Resident" | "Evicted" | "Removed";

export interface ResourceLedgerEntry {
  readonly sourceRevision: SourceRevision;
  readonly artifactRevision: ArtifactRevision;
  readonly contentHash: ContentHash;
  readonly commandSignature: ContentHash;
  state: ResourceLedgerState;
}

export class ThreeResourceRegistry {
  private readonly records = new Map<RepresentationKey, ThreeResourceRecord>();
  private readonly ledger = new Map<RepresentationKey, ResourceLedgerEntry>();

  get(key: RepresentationKey): ThreeResourceRecord | undefined {
    return this.records.get(key);
  }

  getLedger(key: RepresentationKey): ResourceLedgerEntry | undefined {
    return this.ledger.get(key);
  }

  residentRecords(): readonly ThreeResourceRecord[] {
    return [...this.records.values()];
  }

  residentKeys(): readonly RepresentationKey[] {
    return [...this.records.keys()];
  }

  commit(record: ThreeResourceRecord): ThreeResourceRecord | undefined {
    const previous = this.records.get(record.representationKey);
    this.records.set(record.representationKey, record);
    this.ledger.set(record.representationKey, {
      sourceRevision: record.sourceRevision,
      artifactRevision: record.artifactRevision,
      contentHash: record.contentHash,
      commandSignature: record.commandSignature,
      state: "Resident"
    });
    return previous;
  }

  markEvicted(key: RepresentationKey): ThreeResourceRecord | undefined {
    const record = this.records.get(key);
    if (record === undefined) return undefined;
    this.records.delete(key);
    const ledger = this.ledger.get(key);
    if (ledger !== undefined) ledger.state = "Evicted";
    return record;
  }

  markRemoved(key: RepresentationKey): ThreeResourceRecord | undefined {
    const record = this.records.get(key);
    this.records.delete(key);
    const ledger = this.ledger.get(key);
    if (ledger !== undefined) ledger.state = "Removed";
    return record;
  }

  clear(): readonly ThreeResourceRecord[] {
    const records = this.residentRecords();
    this.records.clear();
    this.ledger.clear();
    return records;
  }
}
