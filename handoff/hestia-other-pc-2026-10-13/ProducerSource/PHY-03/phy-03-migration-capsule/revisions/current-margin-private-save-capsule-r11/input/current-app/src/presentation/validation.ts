export interface ValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly issues: readonly ValidationIssue[] };

export class PresentationValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[]) {
    super(message);
    this.name = "PresentationValidationError";
    this.issues = Object.freeze([...issues]);
  }
}

export const validResult = (): ValidationResult => Object.freeze({ valid: true });

export const invalidResult = (issues: readonly ValidationIssue[]): ValidationResult =>
  Object.freeze({ valid: false, issues: Object.freeze([...issues]) });

export const issue = (code: string, path: string, message: string): ValidationIssue =>
  Object.freeze({ code, path, message });

export const throwIfInvalid = (name: string, result: ValidationResult): void => {
  if (!result.valid) {
    throw new PresentationValidationError(`${name} is invalid`, result.issues);
  }
};

export const isFiniteFloat32 = (value: number): boolean =>
  Number.isFinite(value) && Math.abs(value) <= 3.4028234663852886e38;

export const deepFreezeMetadata = <T>(value: T): T => {
  if (value === null || typeof value !== "object" || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const child of Object.values(record)) {
    deepFreezeMetadata(child);
  }
  return Object.freeze(value);
};
