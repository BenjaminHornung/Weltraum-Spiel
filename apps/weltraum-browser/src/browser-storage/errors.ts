export const SAVE_REPOSITORY_ERROR_CODES = Object.freeze([
  "RepositoryUnavailable",
  "DatabaseOpenFailed",
  "TransactionFailed",
  "QuotaExceeded",
  "SlotNotFound",
  "SlotAlreadyExists",
  "RevisionConflict",
  "CorruptRecord",
  "ChecksumMismatch",
  "UnsupportedRepositoryVersion",
  "UnsupportedSaveVersion",
  "InvalidEnvelope",
  "ImportConflict",
  "ClosedRepository"
] as const);

export type SaveRepositoryErrorCode = (typeof SAVE_REPOSITORY_ERROR_CODES)[number];

export class SaveRepositoryError extends Error {
  public constructor(
    public readonly code: SaveRepositoryErrorCode,
    public readonly operation: string,
    message: string,
    public readonly slotId?: string
  ) {
    super(message);
    this.name = "SaveRepositoryError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const isSaveRepositoryError = (value: unknown): value is SaveRepositoryError =>
  value instanceof SaveRepositoryError;
