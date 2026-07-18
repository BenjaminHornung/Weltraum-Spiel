import { failSuitTransition, failSuitValidation } from "./errors";
import {
  SUIT_ALERT_CODES, SUIT_ALERT_SEVERITIES, SUIT_COMMAND_KINDS, SUIT_LIFE_SUPPORT_MODES,
  SUIT_SUBSYSTEM_POWER_STATES, SUIT_SUBSYSTEM_ROLES, SUIT_SUBSYSTEM_STATUSES, SUIT_WORKLOADS,
  type SuitActorId, type SuitAlertCode, type SuitAlertId, type SuitAlertSeverity, type SuitCommandId,
  type SuitCommandKind, type SuitDefinitionId, type SuitEventId, type SuitInterfaceId,
  type SuitLifeSupportMode, type SuitRevision, type SuitSourceId, type SuitStateId, type SuitStepCount,
  type SuitSubsystemId, type SuitSubsystemPowerState, type SuitSubsystemRole, type SuitSubsystemStatus,
  type SuitTick, type SuitWorkload
} from "./types";

const SUIT_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

export const requireSuitId = <T extends string>(value: unknown, path: string): T => {
  if (typeof value !== "string" || !SUIT_ID_PATTERN.test(value)) {
    return failSuitValidation("InvalidId", path, "Suit IDs must match ^[a-z0-9][a-z0-9._:-]{0,127}$ exactly.");
  }
  return value as T;
};

export const createSuitDefinitionId = (value: unknown, path = "/definitionId"): SuitDefinitionId => requireSuitId(value, path);
export const createSuitStateId = (value: unknown, path = "/stateId"): SuitStateId => requireSuitId(value, path);
export const createSuitActorId = (value: unknown, path = "/actorId"): SuitActorId => requireSuitId(value, path);
export const createSuitSubsystemId = (value: unknown, path = "/subsystemId"): SuitSubsystemId => requireSuitId(value, path);
export const createSuitInterfaceId = (value: unknown, path = "/interfaceId"): SuitInterfaceId => requireSuitId(value, path);
export const createSuitEventId = (value: unknown, path = "/eventId"): SuitEventId => requireSuitId(value, path);
export const createSuitCommandId = (value: unknown, path = "/commandId"): SuitCommandId => requireSuitId(value, path);
export const createSuitAlertId = (value: unknown, path = "/alertId"): SuitAlertId => requireSuitId(value, path);
export const createSuitSourceId = (value: unknown, path = "/sourceId"): SuitSourceId => requireSuitId(value, path);

export const requireSafeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0)) {
    return failSuitValidation("InvalidSafeInteger", path, "Value must be a safe integer and cannot be -0.");
  }
  return value;
};

export const requireNonNegativeInteger = (value: unknown, path: string): number => {
  const parsed = requireSafeInteger(value, path);
  if (parsed < 0) return failSuitValidation("OutOfRange", path, "Value must be nonnegative.");
  return parsed;
};

export const requirePositiveInteger = (value: unknown, path: string): number => {
  const parsed = requireSafeInteger(value, path);
  if (parsed <= 0) return failSuitValidation("OutOfRange", path, "Value must be positive.");
  return parsed;
};

export const requireBasisPoints = (value: unknown, path: string): number => {
  const parsed = requireNonNegativeInteger(value, path);
  if (parsed > 10_000) return failSuitValidation("OutOfRange", path, "Basis points must be within 0..10000.");
  return parsed;
};

export const createSuitRevision = (value: unknown, path = "/revision"): SuitRevision =>
  requireNonNegativeInteger(value, path) as SuitRevision;
export const createSuitTick = (value: unknown, path = "/tick"): SuitTick =>
  requireNonNegativeInteger(value, path) as SuitTick;
export const createSuitStepCount = (value: unknown, path = "/steps"): SuitStepCount =>
  requirePositiveInteger(value, path) as SuitStepCount;

export const requireRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failSuitValidation("InvalidShape", path, "Value must be an object.");
  }
  return value as Record<string, unknown>;
};

export const requireBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== "boolean") return failSuitValidation("InvalidShape", path, "Value must be boolean.");
  return value;
};

export const requireOptionalReason = (value: unknown, path: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.length > 256) {
    return failSuitValidation("InvalidShape", path, "Reason must be a nonempty string of at most 256 characters.");
  }
  return value;
};

export const requireVersionText = (value: unknown, path: string): string => {
  if (typeof value !== "string" || !SUIT_ID_PATTERN.test(value)) {
    return failSuitValidation("InvalidId", path, "Version must be a stable lowercase identifier.");
  }
  return value;
};

const choice = <T extends string>(value: unknown, choices: readonly T[], path: string): T => {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    return failSuitValidation("InvalidEnum", path, "Value is not supported by this closed registry.");
  }
  return value as T;
};

export const requireWorkload = (value: unknown, path: string): SuitWorkload => choice(value, SUIT_WORKLOADS, path);
export const requireLifeSupportMode = (value: unknown, path: string): SuitLifeSupportMode => choice(value, SUIT_LIFE_SUPPORT_MODES, path);
export const requireSubsystemRole = (value: unknown, path: string): SuitSubsystemRole => choice(value, SUIT_SUBSYSTEM_ROLES, path);
export const requireSubsystemStatus = (value: unknown, path: string): SuitSubsystemStatus => choice(value, SUIT_SUBSYSTEM_STATUSES, path);
export const requireSubsystemPowerState = (value: unknown, path: string): SuitSubsystemPowerState => choice(value, SUIT_SUBSYSTEM_POWER_STATES, path);
export const requireAlertCode = (value: unknown, path: string): SuitAlertCode => choice(value, SUIT_ALERT_CODES, path);
export const requireAlertSeverity = (value: unknown, path: string): SuitAlertSeverity => choice(value, SUIT_ALERT_SEVERITIES, path);
export const requireCommandKind = (value: unknown, path: string): SuitCommandKind => choice(value, SUIT_COMMAND_KINDS, path);

export const safeAdd = (left: number, right: number, path: string): number => {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || Object.is(left, -0) || Object.is(right, -0)
      || (right > 0 && left > Number.MAX_SAFE_INTEGER - right)
      || (right < 0 && left < Number.MIN_SAFE_INTEGER - right)) {
    return failSuitTransition("ArithmeticOverflow", path, "Suit arithmetic exceeded safe-integer range.");
  }
  const result = left + right;
  return result === 0 ? 0 : result;
};

export const safeMultiply = (left: number, right: number, path: string): number => {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || Object.is(left, -0) || Object.is(right, -0)) {
    return failSuitTransition("ArithmeticOverflow", path, "Suit arithmetic exceeded safe-integer range.");
  }
  if (left === 0 || right === 0) return 0;
  if (Math.abs(left) > Number.MAX_SAFE_INTEGER / Math.abs(right)) {
    return failSuitTransition("ArithmeticOverflow", path, "Suit arithmetic exceeded safe-integer range.");
  }
  const result = left * right;
  return result;
};

export const saturatingAdd = (
  value: number,
  delta: number,
  minimum: number,
  maximum: number,
  path: string
): number => {
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(delta)
      || !Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)
      || Object.is(value, -0) || Object.is(delta, -0) || Object.is(minimum, -0) || Object.is(maximum, -0)
      || minimum > maximum || value < minimum || value > maximum) {
    return failSuitTransition("ArithmeticOverflow", path, "Saturating suit arithmetic received invalid bounds or operands.");
  }
  const exact = BigInt(value) + BigInt(delta);
  if (exact >= BigInt(maximum)) return maximum;
  if (exact <= BigInt(minimum)) return minimum;
  const result = Number(exact);
  return result === 0 ? 0 : result;
};

export const saturatingIncrease = (value: number, amount: number, maximum: number, path: string): number => {
  if (!Number.isSafeInteger(amount) || Object.is(amount, -0) || amount < 0) {
    return failSuitTransition("ArithmeticOverflow", path, "Saturating increase requires a nonnegative safe-integer amount.");
  }
  return saturatingAdd(value, amount, 0, maximum, path);
};

export const saturatingDecrease = (value: number, amount: number, path: string): number => {
  if (!Number.isSafeInteger(amount) || Object.is(amount, -0) || amount < 0) {
    return failSuitTransition("ArithmeticOverflow", path, "Saturating decrease requires a nonnegative safe-integer amount.");
  }
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < 0) {
    return failSuitTransition("ArithmeticOverflow", path, "Saturating decrease requires a nonnegative safe-integer channel.");
  }
  return amount >= value ? 0 : value - amount;
};
