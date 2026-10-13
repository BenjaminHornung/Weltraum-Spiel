export interface CacheBudget {
  readonly maxBytes: number;
}

export type StreamingBudgetErrorCode = "INVALID_BYTE_BUDGET" | "INVALID_BYTE_LENGTH";

export class StreamingBudgetError extends Error {
  public constructor(
    public readonly code: StreamingBudgetErrorCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "StreamingBudgetError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const parseByteLength = (value: unknown, path = "/byteLength"): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new StreamingBudgetError("INVALID_BYTE_LENGTH", path, "Expected a nonnegative safe-integer byte length.");
  }
  return value as number;
};

export const createCacheBudget = (value: CacheBudget | number): CacheBudget => {
  const maxBytes = typeof value === "number" ? value : value.maxBytes;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new StreamingBudgetError("INVALID_BYTE_BUDGET", "/maxBytes", "Expected a nonnegative safe-integer byte budget.");
  }
  return Object.freeze({ maxBytes });
};
