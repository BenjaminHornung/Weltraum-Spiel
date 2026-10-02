import { parseEphemeralRepresentationKey } from "../../../presentation";
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

interface EphemeralRepresentationRegistration {
  readonly epoch: number;
  readonly serial: number;
  readonly uncertainRecords: ThreeResourceRecord[];
  uploaded: boolean;
  releaseUncertain: boolean;
}

export class ThreeResourceRegistry {
  private readonly records = new Map<RepresentationKey, ThreeResourceRecord>();
  private readonly ledger = new Map<RepresentationKey, ResourceLedgerEntry>();
  private readonly ephemeralRegistrations = new Map<RepresentationKey, EphemeralRepresentationRegistration>();
  private issuedSerialHighWater = 0;
  private currentEpoch = 0;

  get(key: RepresentationKey): ThreeResourceRecord | undefined {
    return this.records.get(key);
  }

  getLedger(key: RepresentationKey): ResourceLedgerEntry | undefined {
    return this.ledger.get(key);
  }

  getEphemeralRegistration(key: RepresentationKey): Readonly<EphemeralRepresentationRegistration> | undefined {
    return this.ephemeralRegistrations.get(key);
  }

  hasEphemeralReleaseUncertainty(): boolean {
    for (const registration of this.ephemeralRegistrations.values()) {
      if (registration.releaseUncertain) {
        return true;
      }
    }
    return false;
  }

  registerEphemeral(key: RepresentationKey, serial: number, epoch: number): "Accepted" | "InvalidKey" | "SerialMismatch" | "EpochMismatch" | "KeyAlreadyIssued" {
    const identity = parseEphemeralRepresentationKey(key);
    if (identity === undefined || identity.serial !== serial || identity.epoch !== epoch) {
      return "InvalidKey";
    }
    if (this.issuedSerialHighWater >= Number.MAX_SAFE_INTEGER || serial !== this.issuedSerialHighWater + 1) {
      return "SerialMismatch";
    }
    if (epoch !== this.currentEpoch
      && (this.currentEpoch >= Number.MAX_SAFE_INTEGER || epoch !== this.currentEpoch + 1)) {
      return "EpochMismatch";
    }
    if (this.ephemeralRegistrations.has(key) || this.records.has(key) || this.ledger.has(key)) {
      return "KeyAlreadyIssued";
    }
    this.ephemeralRegistrations.set(key, { epoch, serial, uncertainRecords: [], uploaded: false, releaseUncertain: false });
    this.issuedSerialHighWater = serial;
    return "Accepted";
  }

  cancelEphemeral(key: RepresentationKey, serial: number): "Accepted" | "NotRegistered" | "AlreadyUploaded" | "ReleaseUncertain" {
    const registration = this.ephemeralRegistrations.get(key);
    if (registration === undefined || registration.serial !== serial) {
      return "NotRegistered";
    }
    if (registration.releaseUncertain) {
      return "ReleaseUncertain";
    }
    if (registration.uploaded || this.records.has(key) || this.ledger.has(key)) {
      return "AlreadyUploaded";
    }
    this.ephemeralRegistrations.delete(key);
    return "Accepted";
  }

  advanceEphemeralEpoch(nextEpoch: number): boolean {
    if (this.currentEpoch >= Number.MAX_SAFE_INTEGER || nextEpoch !== this.currentEpoch + 1) {
      return false;
    }
    this.currentEpoch = nextEpoch;
    return true;
  }

  markEphemeralReleaseUncertain(key: RepresentationKey): boolean {
    const registration = this.ephemeralRegistrations.get(key);
    if (registration === undefined) {
      return false;
    }
    registration.releaseUncertain = true;
    return true;
  }

  preserveUncertainEphemeralRecord(key: RepresentationKey, record: ThreeResourceRecord): void {
    const registration = this.ephemeralRegistrations.get(key);
    if (registration === undefined) {
      return;
    }
    if (this.records.get(key) === record) {
      this.records.delete(key);
    }
    if (!registration.uncertainRecords.includes(record)) {
      registration.uncertainRecords.push(record);
    }
    registration.releaseUncertain = true;
  }

  expireEphemeral(key: RepresentationKey): boolean {
    const registration = this.ephemeralRegistrations.get(key);
    if (registration === undefined || !registration.uploaded || registration.releaseUncertain || this.records.has(key)) {
      return false;
    }
    this.ephemeralRegistrations.delete(key);
    this.ledger.delete(key);
    return true;
  }

  residentRecords(): readonly ThreeResourceRecord[] {
    return [...this.records.values()];
  }

  ownedRecords(): readonly ThreeResourceRecord[] {
    const records = [...this.records.values()];
    const seen = new Set(records);
    for (const registration of this.ephemeralRegistrations.values()) {
      for (const record of registration.uncertainRecords) {
        if (!seen.has(record)) {
          seen.add(record);
          records.push(record);
        }
      }
    }
    return records;
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
    const registration = this.ephemeralRegistrations.get(record.representationKey);
    if (registration !== undefined) {
      registration.uploaded = true;
    }
    return previous;
  }

  forgetReleasedRecord(record: ThreeResourceRecord): void {
    const key = record.representationKey;
    if (this.records.get(key) === record) {
      this.records.delete(key);
    }
    if (!this.records.has(key)) {
      this.ledger.delete(key);
      const registration = this.ephemeralRegistrations.get(key);
      if (registration !== undefined && !registration.releaseUncertain) {
        this.ephemeralRegistrations.delete(key);
      }
    }
  }

  pruneTerminalCleanState(): void {
    for (const [key, registration] of this.ephemeralRegistrations) {
      if (!registration.releaseUncertain) {
        this.ephemeralRegistrations.delete(key);
      }
    }
    for (const key of this.ledger.keys()) {
      if (!this.records.has(key) && !this.ephemeralRegistrations.get(key)?.releaseUncertain) {
        this.ledger.delete(key);
      }
    }
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
    this.ephemeralRegistrations.clear();
    return records;
  }
}
