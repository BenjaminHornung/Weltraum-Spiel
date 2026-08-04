import {
  PREPARED_STRUCTURAL_FIRE_PAGE_BYTES,
  type PreparedStructuralFireDirection,
  type PreparedStructuralFireLogicalViewName,
  type PreparedStructuralFirePageEnvelope,
  type PreparedStructuralFirePageHeader,
  type PreparedStructuralFireRequest
} from "./preparedStructuralFireWire";
import {
  createPreparedStructuralFirePageEnvelope,
  preparedStructuralFireBackpressureDecision,
  validatePreparedStructuralFireRequest
} from "./preparedStructuralFireWireCodec";

const ROOT_JOB_PATTERN = /^psf-root-v1:[0-9a-f]{16}$/;

export interface PreparedStructuralFireStoredPageKey {
  readonly workerEpoch: number;
  readonly rootJobId: string;
  readonly direction: PreparedStructuralFireDirection;
  readonly logicalViewName: PreparedStructuralFireLogicalViewName;
  readonly pageIndex: number;
}

export type PreparedStructuralFirePageStoreDecision =
  | Readonly<{ readonly kind: "Accepted"; readonly retainedBytes: number }>
  | Readonly<{ readonly kind: "AlreadyPresent"; readonly retainedBytes: number }>
  | Readonly<{ readonly kind: "Deferred"; readonly reason: "RetainedInFlightBackpressure" }>
  | Readonly<{ readonly kind: "Cancelled" }>
  | Readonly<{ readonly kind: "Stale" }>
  | Readonly<{
      readonly kind: "Refused";
      readonly reason: "PageConflict" | "InvalidPage" | "Refused" | "Disposed";
    }>;

type TerminalDecision = Extract<
  PreparedStructuralFirePageStoreDecision,
  { readonly kind: "Cancelled" | "Stale" | "Refused" }
>;

interface StoredPage {
  readonly rootKey: string;
  readonly envelope: PreparedStructuralFirePageEnvelope;
}

const safeEpoch = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("workerEpoch must be a non-negative safe integer.");
  }
  return value;
};

const requireRootJobId = (value: string): string => {
  if (!ROOT_JOB_PATTERN.test(value)) throw new RangeError("rootJobId is invalid.");
  return value;
};

const rootKey = (workerEpoch: number, rootJobId: string): string =>
  `${workerEpoch}\0${rootJobId}`;

const pageKey = (key: Readonly<PreparedStructuralFireStoredPageKey>): string =>
  `${rootKey(key.workerEpoch, key.rootJobId)}\0${key.direction}\0${key.logicalViewName}\0${key.pageIndex}`;

const sameHeader = (
  left: Readonly<PreparedStructuralFirePageHeader>,
  right: Readonly<PreparedStructuralFirePageHeader>
): boolean =>
  left.schemaVersion === right.schemaVersion
  && left.direction === right.direction
  && left.logicalViewName === right.logicalViewName
  && left.pageIndex === right.pageIndex
  && left.byteOffset === right.byteOffset
  && left.byteLength === right.byteLength
  && left.logicalViewRoot === right.logicalViewRoot
  && left.pageBytesHash === right.pageBytesHash
  && left.pageHash === right.pageHash;

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const sameEnvelope = (
  left: Readonly<PreparedStructuralFirePageEnvelope>,
  right: Readonly<PreparedStructuralFirePageEnvelope>
): boolean =>
  left.workerEpoch === right.workerEpoch
  && left.rootJobId === right.rootJobId
  && left.requestHash === right.requestHash
  && left.pageEnvelopeHash === right.pageEnvelopeHash
  && sameHeader(left.header, right.header)
  && sameBytes(left.bytes, right.bytes);

export class PreparedStructuralFirePageStore {
  readonly #pages = new Map<string, StoredPage>();
  readonly #requestHashes = new Map<string, string>();
  readonly #terminals = new Map<string, TerminalDecision>();
  #workerEpoch: number;
  #retainedBytes = 0;
  #disposed = false;

  constructor(workerEpoch: number) {
    this.#workerEpoch = safeEpoch(workerEpoch);
  }

  accept(
    requestValue: Readonly<PreparedStructuralFireRequest>,
    envelope: Readonly<PreparedStructuralFirePageEnvelope>
  ): PreparedStructuralFirePageStoreDecision {
    if (this.#disposed) return Object.freeze({ kind: "Refused", reason: "Disposed" });
    const incomingEpoch = safeEpoch(envelope.workerEpoch);
    if (incomingEpoch !== this.#workerEpoch) return Object.freeze({ kind: "Stale" });

    const request = validatePreparedStructuralFireRequest(requestValue);
    const currentRootKey = rootKey(this.#workerEpoch, request.rootJobId);
    const terminal = this.#terminals.get(currentRootKey);
    if (terminal !== undefined) return terminal;
    if (envelope.rootJobId !== request.rootJobId
        || envelope.requestHash !== request.requestHash
        || !(envelope.bytes instanceof Uint8Array)
        || !Number.isSafeInteger(envelope.header.pageIndex)
        || envelope.header.pageIndex < 0
        || envelope.bytes.byteLength <= 0
        || envelope.bytes.byteLength > PREPARED_STRUCTURAL_FIRE_PAGE_BYTES) {
      return this.terminate(request.rootJobId, {
        kind: "Refused",
        reason: "InvalidPage"
      });
    }

    const key = pageKey({
      workerEpoch: this.#workerEpoch,
      rootJobId: request.rootJobId,
      direction: envelope.header.direction,
      logicalViewName: envelope.header.logicalViewName,
      pageIndex: envelope.header.pageIndex
    });
    const existing = this.#pages.get(key);
    if (existing !== undefined) {
      if (sameEnvelope(existing.envelope, envelope)) {
        return Object.freeze({ kind: "AlreadyPresent", retainedBytes: this.#retainedBytes });
      }
      return this.terminate(request.rootJobId, {
        kind: "Refused",
        reason: "PageConflict"
      });
    }
    const boundRequestHash = this.#requestHashes.get(currentRootKey);
    if (boundRequestHash !== undefined && boundRequestHash !== request.requestHash) {
      return this.terminate(request.rootJobId, {
        kind: "Refused",
        reason: "PageConflict"
      });
    }

    const capacity = preparedStructuralFireBackpressureDecision(
      this.#retainedBytes,
      envelope.bytes.byteLength
    );
    if (capacity.kind === "Deferred") return capacity;

    let owned: PreparedStructuralFirePageEnvelope;
    try {
      owned = createPreparedStructuralFirePageEnvelope(
        request,
        this.#workerEpoch,
        envelope.header,
        envelope.bytes
      );
      if (owned.pageEnvelopeHash !== envelope.pageEnvelopeHash) {
        throw new RangeError("Page envelope commitment is invalid.");
      }
    } catch {
      return this.terminate(request.rootJobId, {
        kind: "Refused",
        reason: "InvalidPage"
      });
    }

    this.#pages.set(key, { rootKey: currentRootKey, envelope: owned });
    this.#requestHashes.set(currentRootKey, request.requestHash);
    this.#retainedBytes = capacity.retainedBytesAfterAcceptance;
    return Object.freeze({ kind: "Accepted", retainedBytes: this.#retainedBytes });
  }

  consume(
    key: Readonly<PreparedStructuralFireStoredPageKey>
  ): PreparedStructuralFirePageEnvelope | undefined {
    const storedKey = pageKey({
      workerEpoch: safeEpoch(key.workerEpoch),
      rootJobId: requireRootJobId(key.rootJobId),
      direction: key.direction,
      logicalViewName: key.logicalViewName,
      pageIndex: key.pageIndex
    });
    const stored = this.#pages.get(storedKey);
    if (stored === undefined) return undefined;
    this.#pages.delete(storedKey);
    this.#retainedBytes -= stored.envelope.bytes.byteLength;
    let rootRetained = false;
    for (const page of this.#pages.values()) {
      if (page.rootKey !== stored.rootKey) continue;
      rootRetained = true;
      break;
    }
    if (!rootRetained) {
      this.#requestHashes.delete(stored.rootKey);
    }
    return stored.envelope;
  }

  cancel(rootJobId: string): void {
    if (this.#disposed) return;
    this.terminate(rootJobId, { kind: "Cancelled" });
  }

  markStale(rootJobId: string): void {
    if (this.#disposed) return;
    this.terminate(rootJobId, { kind: "Stale" });
  }

  refuse(rootJobId: string): void {
    if (this.#disposed) return;
    this.terminate(rootJobId, { kind: "Refused", reason: "Refused" });
  }

  restart(workerEpoch: number): boolean {
    const nextEpoch = safeEpoch(workerEpoch);
    if (this.#disposed || nextEpoch === this.#workerEpoch) return false;
    if (nextEpoch < this.#workerEpoch) {
      throw new RangeError("workerEpoch must advance on restart.");
    }
    this.releaseAll();
    this.#terminals.clear();
    this.#workerEpoch = nextEpoch;
    return true;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.releaseAll();
    this.#terminals.clear();
    this.#disposed = true;
  }

  readState(): Readonly<{
    readonly workerEpoch: number;
    readonly retainedBytes: number;
    readonly retainedPageCount: number;
    readonly terminalRootCount: number;
    readonly disposed: boolean;
  }> {
    return Object.freeze({
      workerEpoch: this.#workerEpoch,
      retainedBytes: this.#retainedBytes,
      retainedPageCount: this.#pages.size,
      terminalRootCount: this.#terminals.size,
      disposed: this.#disposed
    });
  }

  private terminate(rootJobIdValue: string, decision: TerminalDecision): TerminalDecision {
    const key = rootKey(this.#workerEpoch, requireRootJobId(rootJobIdValue));
    const existing = this.#terminals.get(key);
    if (existing !== undefined) return existing;
    for (const [storedKey, stored] of this.#pages) {
      if (stored.rootKey !== key) continue;
      this.#retainedBytes -= stored.envelope.bytes.byteLength;
      this.#pages.delete(storedKey);
    }
    this.#requestHashes.delete(key);
    const terminal = Object.freeze(decision);
    this.#terminals.set(key, terminal);
    return terminal;
  }

  private releaseAll(): void {
    this.#pages.clear();
    this.#requestHashes.clear();
    this.#retainedBytes = 0;
  }
}
