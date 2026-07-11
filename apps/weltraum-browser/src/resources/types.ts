import {
  createResourceCategoryId,
  createResourceId,
  createResourceStackId,
  failResourceValidation,
  isSaveSafeResourceId,
  type ResourceCategoryId,
  type ResourceId,
  type ResourceStackId
} from "./ids";

export type ResourceRarityTier = "Common" | "Uncommon" | "Rare" | "Exotic";
export type ResourceLegalStatus = "Legal" | "Restricted" | "Illegal" | "ProtectedSample";
export type ResourceOwnershipImplication = "None" | "ClaimedCargo" | "SalvageOwned" | "FactionEvidence" | "MissionOwned";

export interface BulkStackRule {
  readonly kind: "Bulk";
  readonly maxQuantity: number;
  readonly splitAllowed: true;
}

export interface DiscreteStackRule {
  readonly kind: "Discrete";
  readonly maxQuantity: number;
  readonly splitAllowed: false;
}

export interface SealedStackRule {
  readonly kind: "Sealed";
  readonly maxQuantity: 1;
  readonly splitAllowed: false;
}

/** Stack behavior is explicit so later transfer logic never infers splitting from a category. */
export type ResourceStackRule = BulkStackRule | DiscreteStackRule | SealedStackRule;

export interface ResourceExtensionArray extends ReadonlyArray<ResourceExtensionValue> {}

export interface ResourceExtensionObject {
  readonly [key: string]: ResourceExtensionValue;
}

export type ResourceExtensionValue = null | boolean | number | string | ResourceExtensionArray | ResourceExtensionObject;

/** Optional extension data must use a dotted namespace, for example `weltraum.balance`. */
export type ResourceExtensions = Readonly<Record<string, ResourceExtensionValue>>;

export interface ResourceDefinitionInput {
  readonly resourceId: ResourceId | string;
  readonly displayName: string;
  readonly categoryId: ResourceCategoryId | string;
  readonly massPerUnitKg: number;
  readonly volumePerUnitM3: number;
  readonly baseValueCredits: number;
  readonly stackRule: ResourceStackRule;
  readonly rarityTier: ResourceRarityTier;
  readonly tags: readonly string[];
  readonly hazardFlags: readonly string[];
  readonly legalStatus: ResourceLegalStatus;
  readonly ownershipImplication: ResourceOwnershipImplication;
  readonly defaultUse: string;
  readonly extensions?: ResourceExtensions;
}

export interface ResourceDefinition {
  readonly resourceId: ResourceId;
  readonly displayName: string;
  readonly categoryId: ResourceCategoryId;
  readonly massPerUnitKg: number;
  readonly volumePerUnitM3: number;
  readonly baseValueCredits: number;
  readonly stackRule: ResourceStackRule;
  readonly rarityTier: ResourceRarityTier;
  readonly tags: readonly string[];
  readonly hazardFlags: readonly string[];
  readonly legalStatus: ResourceLegalStatus;
  readonly ownershipImplication: ResourceOwnershipImplication;
  readonly defaultUse: string;
  readonly extensions: ResourceExtensions;
}

export interface ResourceStackInput {
  readonly stackId: ResourceStackId | string;
  readonly resourceId: ResourceId | string;
  readonly quantity: number;
  readonly grade?: string;
  readonly condition?: number;
  readonly ownerId?: string;
  readonly legalStatus?: ResourceLegalStatus;
  readonly missionId?: string;
  readonly sealed?: boolean;
  readonly extensions?: ResourceExtensions;
}

/** Immutable resource quantity plus context that must survive later transfers. */
export interface ResourceStack {
  readonly stackId: ResourceStackId;
  readonly resourceId: ResourceId;
  readonly quantity: number;
  readonly grade?: string;
  readonly condition?: number;
  readonly ownerId?: string;
  readonly legalStatus?: ResourceLegalStatus;
  readonly missionId?: string;
  readonly sealed: boolean;
  readonly extensions: ResourceExtensions;
}

export interface ResourceRequirementInput {
  readonly resourceId: ResourceId | string;
  readonly quantity: number;
}

/** Ship Builder and recipes can consume this neutral validation seam without importing their implementations. */
export interface ResourceRequirement {
  readonly resourceId: ResourceId;
  readonly quantity: number;
}

const rarityTiers = new Set<ResourceRarityTier>(["Common", "Uncommon", "Rare", "Exotic"]);
const legalStatuses = new Set<ResourceLegalStatus>(["Legal", "Restricted", "Illegal", "ProtectedSample"]);
const ownershipImplications = new Set<ResourceOwnershipImplication>([
  "None",
  "ClaimedCargo",
  "SalvageOwned",
  "FactionEvidence",
  "MissionOwned"
]);
const extensionKeyPattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;

const codeUnitCompare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const requireNonEmptyText = (value: unknown, label: string, code: "INVALID_RESOURCE" | "INVALID_STACK" = "INVALID_RESOURCE"): string => {
  if (typeof value !== "string" || !value.trim()) {
    return failResourceValidation(code, `${label} must be a non-empty string`);
  }

  return value.trim();
};

const requireFiniteNonNegative = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return failResourceValidation("INVALID_NUMERIC_VALUE", `${label} must be finite and non-negative`);
  }

  return Object.is(value, -0) ? 0 : value;
};

const requireFinitePositive = (value: unknown, label: string, code: "INVALID_STACK" | "INVALID_REQUIREMENT"): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return failResourceValidation(code, `${label} must be finite and greater than zero`);
  }

  return value;
};

const requireDenseExtensionArray = (value: readonly unknown[]): void => {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      return failResourceValidation("INVALID_EXTENSION", "Resource extensions must not contain sparse arrays");
    }
  }
};

const createExtensionRecord = (): Record<string, ResourceExtensionValue> =>
  Object.create(null) as Record<string, ResourceExtensionValue>;

const defineExtensionProperty = (
  target: Record<string, ResourceExtensionValue>,
  key: string,
  value: ResourceExtensionValue
): void => {
  Object.defineProperty(target, key, {
    configurable: false,
    enumerable: true,
    value,
    writable: false
  });
};

const cloneExtensionValue = (value: unknown, parents: WeakSet<object>): ResourceExtensionValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return failResourceValidation("INVALID_EXTENSION", "Resource extension numbers must be finite");
    }

    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    if (parents.has(value)) {
      return failResourceValidation("INVALID_EXTENSION", "Resource extensions must not contain cycles");
    }

    requireDenseExtensionArray(value);
    parents.add(value);
    const result: ResourceExtensionValue[] = [];
    for (const entry of value) {
      result.push(cloneExtensionValue(entry, parents));
    }
    parents.delete(value);
    return Object.freeze(result);
  }

  if (!isPlainRecord(value)) {
    return failResourceValidation("INVALID_EXTENSION", "Resource extensions must contain JSON-compatible values");
  }

  if (parents.has(value)) {
    return failResourceValidation("INVALID_EXTENSION", "Resource extensions must not contain cycles");
  }

  parents.add(value);
  const result = createExtensionRecord();
  for (const key of Object.keys(value).sort(codeUnitCompare)) {
    defineExtensionProperty(result, key, cloneExtensionValue(value[key], parents));
  }
  parents.delete(value);
  return Object.freeze(result);
};

export const cloneResourceExtensions = (value: unknown): ResourceExtensions => {
  if (value === undefined) {
    return Object.freeze(createExtensionRecord());
  }

  if (!isPlainRecord(value)) {
    return failResourceValidation("INVALID_EXTENSION", "Resource extensions must be a plain object when provided");
  }

  const result = createExtensionRecord();
  for (const key of Object.keys(value).sort(codeUnitCompare)) {
    if (!extensionKeyPattern.test(key)) {
      return failResourceValidation("INVALID_EXTENSION", `Resource extension key must be namespaced: ${key}`);
    }

    defineExtensionProperty(result, key, cloneExtensionValue(value[key], new WeakSet<object>()));
  }

  return Object.freeze(result);
};

const canonicalTokenList = (value: unknown, label: string): readonly string[] => {
  if (!Array.isArray(value) || value.some((entry) => !isSaveSafeResourceId(entry))) {
    return failResourceValidation("INVALID_RESOURCE", `${label} must contain lowercase save-safe identifiers`);
  }

  return Object.freeze([...new Set(value)].sort(codeUnitCompare));
};

const requireChoice = <T extends string>(value: unknown, choices: ReadonlySet<T>, label: string, code: "INVALID_RESOURCE" | "INVALID_STACK"): T => {
  if (typeof value !== "string" || !choices.has(value as T)) {
    return failResourceValidation(code, `${label} is not a supported value`);
  }

  return value as T;
};

export const createResourceStackRule = (value: unknown): ResourceStackRule => {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return failResourceValidation("INVALID_STACK_RULE", "Resource stack rule must be a discriminated object");
  }

  switch (value.kind) {
    case "Bulk": {
      const maxQuantity = requireFinitePositive(value.maxQuantity, "Bulk stack maxQuantity", "INVALID_STACK");
      if (value.splitAllowed !== true) {
        return failResourceValidation("INVALID_STACK_RULE", "Bulk stacks must explicitly allow splitting");
      }

      return Object.freeze({ kind: "Bulk", maxQuantity, splitAllowed: true });
    }
    case "Discrete": {
      const maxQuantity = value.maxQuantity;
      if (
        typeof maxQuantity !== "number" ||
        !Number.isSafeInteger(maxQuantity) ||
        maxQuantity <= 0 ||
        value.splitAllowed !== false
      ) {
        return failResourceValidation(
          "INVALID_STACK_RULE",
          "Discrete stacks require a positive safe-integer maxQuantity and disabled splitting"
        );
      }

      return Object.freeze({ kind: "Discrete", maxQuantity, splitAllowed: false });
    }
    case "Sealed": {
      if (value.maxQuantity !== 1 || value.splitAllowed !== false) {
        return failResourceValidation("INVALID_STACK_RULE", "Sealed stacks must have maxQuantity 1 and disabled splitting");
      }

      return Object.freeze({ kind: "Sealed", maxQuantity: 1, splitAllowed: false });
    }
    default:
      return failResourceValidation("INVALID_STACK_RULE", `Unsupported resource stack rule kind: ${value.kind}`);
  }
};

export const createResourceDefinition = (value: unknown): ResourceDefinition => {
  if (!isRecord(value)) {
    return failResourceValidation("INVALID_RESOURCE", "Resource definition must be an object");
  }

  const resourceId = createResourceId(value.resourceId);
  const categoryId = createResourceCategoryId(value.categoryId);

  const rarityTier = requireChoice(value.rarityTier, rarityTiers, "Resource rarity tier", "INVALID_RESOURCE");
  const legalStatus = requireChoice(value.legalStatus, legalStatuses, "Resource legal status", "INVALID_RESOURCE");
  const ownershipImplication = requireChoice(
    value.ownershipImplication,
    ownershipImplications,
    "Resource ownership implication",
    "INVALID_RESOURCE"
  );

  return Object.freeze({
    resourceId,
    displayName: requireNonEmptyText(value.displayName, "Resource displayName"),
    categoryId,
    massPerUnitKg: requireFiniteNonNegative(value.massPerUnitKg, "Resource massPerUnitKg"),
    volumePerUnitM3: requireFiniteNonNegative(value.volumePerUnitM3, "Resource volumePerUnitM3"),
    baseValueCredits: requireFiniteNonNegative(value.baseValueCredits, "Resource baseValueCredits"),
    stackRule: createResourceStackRule(value.stackRule),
    rarityTier,
    tags: canonicalTokenList(value.tags, "Resource tags"),
    hazardFlags: canonicalTokenList(value.hazardFlags, "Resource hazardFlags"),
    legalStatus,
    ownershipImplication,
    defaultUse: isSaveSafeResourceId(value.defaultUse)
      ? value.defaultUse
      : failResourceValidation("INVALID_RESOURCE", "Resource defaultUse must be lowercase and save-safe"),
    extensions: cloneResourceExtensions(value.extensions)
  });
};

export const createResourceStack = (value: unknown): ResourceStack => {
  if (!isRecord(value)) {
    return failResourceValidation("INVALID_STACK", "Resource stack must be an object");
  }

  const condition = value.condition;
  const normalizedCondition =
    condition === undefined
      ? undefined
      : typeof condition === "number" && Number.isFinite(condition) && condition >= 0 && condition <= 1
        ? Object.is(condition, -0)
          ? 0
          : condition
        : failResourceValidation("INVALID_STACK", "Resource stack condition must be a finite value from zero through one");

  const grade = value.grade;
  const normalizedGrade =
    grade === undefined
      ? undefined
      : isSaveSafeResourceId(grade)
        ? grade
        : failResourceValidation("INVALID_STACK", "Resource stack grade must be lowercase and save-safe when provided");

  const legalStatus = value.legalStatus;
  const ownerId = value.ownerId;
  const missionId = value.missionId;
  const normalizedOwnerId =
    ownerId === undefined
      ? undefined
      : isSaveSafeResourceId(ownerId)
        ? ownerId
        : failResourceValidation("INVALID_STACK", "Resource stack ownerId must be lowercase and save-safe when provided");
  const normalizedMissionId =
    missionId === undefined ? undefined : requireNonEmptyText(missionId, "Resource stack missionId", "INVALID_STACK");
  const normalizedLegalStatus =
    legalStatus === undefined
      ? undefined
      : requireChoice(legalStatus, legalStatuses, "Resource stack legal status", "INVALID_STACK");
  const sealed = value.sealed;
  const normalizedSealed =
    sealed === undefined
      ? false
      : typeof sealed === "boolean"
        ? sealed
        : failResourceValidation("INVALID_STACK", "Resource stack sealed must be boolean when provided");

  return Object.freeze({
    stackId: createResourceStackId(value.stackId),
    resourceId: createResourceId(value.resourceId),
    quantity: requireFinitePositive(value.quantity, "Resource stack quantity", "INVALID_STACK"),
    ...(normalizedGrade === undefined ? {} : { grade: normalizedGrade }),
    ...(normalizedCondition === undefined ? {} : { condition: normalizedCondition }),
    ...(normalizedOwnerId === undefined ? {} : { ownerId: normalizedOwnerId }),
    ...(normalizedLegalStatus === undefined ? {} : { legalStatus: normalizedLegalStatus }),
    ...(normalizedMissionId === undefined ? {} : { missionId: normalizedMissionId }),
    sealed: normalizedSealed,
    extensions: cloneResourceExtensions(value.extensions)
  });
};

export const createResourceRequirement = (value: unknown): ResourceRequirement => {
  if (!isRecord(value)) {
    return failResourceValidation("INVALID_REQUIREMENT", "Resource requirement must be an object");
  }

  return Object.freeze({
    resourceId: createResourceId(value.resourceId),
    quantity: requireFinitePositive(value.quantity, "Resource requirement quantity", "INVALID_REQUIREMENT")
  });
};
