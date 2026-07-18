export type SuitValidationErrorCode =
  | "InvalidId" | "InvalidSafeInteger" | "OutOfRange" | "InvalidEnum" | "InvalidShape"
  | "DuplicateId" | "MissingDefinition" | "SignatureMismatch" | "InvalidCanonicalValue";

export type SuitTransitionErrorCode =
  | "DefinitionMismatch" | "ActorMismatch" | "StateMismatch" | "RevisionMismatch"
  | "ResultingRevisionMismatch" | "DuplicateCommand" | "BackwardTick" | "FutureTick"
  | "SubsystemNotFound" | "ModeNotAllowed" | "ArithmeticOverflow" | "InvalidCommand";

export class SuitValidationError extends Error {
  public constructor(
    public readonly code: SuitValidationErrorCode,
    public readonly path: string,
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "SuitValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SuitTransitionError extends Error {
  public constructor(
    public readonly code: SuitTransitionErrorCode,
    public readonly path: string,
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "SuitTransitionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const failSuitValidation = (
  code: SuitValidationErrorCode,
  path: string,
  message: string,
  cause?: unknown
): never => { throw new SuitValidationError(code, path, message, cause); };

export const failSuitTransition = (
  code: SuitTransitionErrorCode,
  path: string,
  message: string,
  cause?: unknown
): never => { throw new SuitTransitionError(code, path, message, cause); };
