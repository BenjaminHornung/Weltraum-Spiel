import { findResourceDefinition, validateResourceStackForCatalog, type ResourceCatalog } from "./catalog";
import { clampNearCapacity } from "./capacityMath";
import { createResourceCategoryId, failResourceValidation, isSaveSafeResourceId } from "./ids";
import { canonicalJson, canonicalSignature } from "./serialization";
import {
  cloneResourceExtensions,
  createResourceStack,
  type ResourceExtensions,
  type ResourceLegalStatus,
  type ResourceStack
} from "./types";

export type ResourceContainerKind =
  | "Suit"
  | "ShipCargo"
  | "DroneCargo"
  | "OutpostStorage"
  | "CargoModule"
  | "ExternalRack"
  | "MissionCargo"
  | "MiningNodeReservoir";

export type ContainerPortDirection = "Inbound" | "Outbound" | "Bidirectional";
export type PartialTransferPolicy = "Allowed" | "Forbidden";
export type OwnershipPolicy = "Any" | "OwnerOnly";

export interface ContainerTransferPortInput {
  readonly portId: string;
  readonly direction: ContainerPortDirection;
  readonly allowedActorIds?: readonly string[];
  readonly extensions?: ResourceExtensions;
}

export interface ContainerTransferPort {
  readonly portId: string;
  readonly direction: ContainerPortDirection;
  readonly allowedActorIds: readonly string[];
  readonly extensions: ResourceExtensions;
}

export interface ResourceContainerPolicyInput {
  readonly allowedCategoryIds?: readonly string[];
  readonly blockedCategoryIds?: readonly string[];
  readonly allowedTags?: readonly string[];
  readonly blockedTags?: readonly string[];
  readonly allowedHazards?: readonly string[];
  readonly blockedHazards?: readonly string[];
  readonly allowedActorIds?: readonly string[];
  readonly allowedOwnerIds?: readonly string[];
  readonly ownershipPolicy?: OwnershipPolicy;
  readonly partialTransferPolicy?: PartialTransferPolicy;
  readonly extensions?: ResourceExtensions;
}

export interface ResourceContainerPolicy {
  readonly allowedCategoryIds: readonly string[];
  readonly blockedCategoryIds: readonly string[];
  readonly allowedTags: readonly string[];
  readonly blockedTags: readonly string[];
  readonly allowedHazards: readonly string[];
  readonly blockedHazards: readonly string[];
  readonly allowedActorIds: readonly string[];
  readonly allowedOwnerIds: readonly string[];
  readonly ownershipPolicy: OwnershipPolicy;
  readonly partialTransferPolicy: PartialTransferPolicy;
  readonly extensions: ResourceExtensions;
}

export interface ResourceContainerDefinitionInput {
  readonly containerId: string;
  readonly kind: ResourceContainerKind;
  readonly maxMassKg: number;
  readonly maxVolumeM3: number;
  readonly maxStackCount: number;
  readonly policy?: ResourceContainerPolicyInput;
  readonly transferPorts?: readonly ContainerTransferPortInput[];
  readonly extensions?: ResourceExtensions;
}

export interface ResourceContainerDefinition {
  readonly containerId: string;
  readonly kind: ResourceContainerKind;
  readonly maxMassKg: number;
  readonly maxVolumeM3: number;
  readonly maxStackCount: number;
  readonly policy: ResourceContainerPolicy;
  readonly transferPorts: readonly ContainerTransferPort[];
  readonly extensions: ResourceExtensions;
  readonly canonicalJson: string;
  readonly signature: string;
}

export interface ResourceContainerStateInput {
  readonly containerId: string;
  readonly revision?: number;
  readonly contents: readonly ResourceStack[];
  readonly initialContents?: readonly ResourceStack[];
  readonly ownerId?: string;
  readonly missionId?: string;
  readonly sealed?: boolean;
  readonly legalStatus?: ResourceLegalStatus;
  readonly extensions?: ResourceExtensions;
}

export interface ResourceContainerState {
  readonly containerId: string;
  readonly revision: number;
  readonly contents: readonly ResourceStack[];
  readonly initialContents: readonly ResourceStack[];
  readonly ownerId?: string;
  readonly missionId?: string;
  readonly sealed: boolean;
  readonly legalStatus?: ResourceLegalStatus;
  readonly extensions: ResourceExtensions;
  readonly canonicalJson: string;
  readonly signature: string;
}

export interface ResourceContainerEligibility {
  readonly eligible: boolean;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
}

export interface ResourceContainerSnapshot {
  readonly definition: ResourceContainerDefinition;
  readonly state: ResourceContainerState;
  readonly currentMassKg: number;
  readonly currentVolumeM3: number;
  readonly remainingMassKg: number;
  readonly remainingVolumeM3: number;
  readonly stackCount: number;
  readonly resourceTotals: readonly { readonly resourceId: string; readonly quantity: number }[];
  readonly hazardSummary: readonly { readonly hazardFlag: string; readonly quantity: number }[];
  readonly legalSummary: readonly { readonly legalStatus: ResourceLegalStatus; readonly quantity: number }[];
  readonly depletion: { readonly initialQuantity: number; readonly remainingQuantity: number; readonly depletedQuantity: number; readonly fractionDepleted: number } | undefined;
  readonly canonicalJson: string;
  readonly signature: string;
}

const kinds = new Set<ResourceContainerKind>([
  "Suit", "ShipCargo", "DroneCargo", "OutpostStorage", "CargoModule", "ExternalRack", "MissionCargo", "MiningNodeReservoir"
]);
const legalStatuses = new Set<ResourceLegalStatus>(["Legal", "Restricted", "Illegal", "ProtectedSample"]);
const directions = new Set<ContainerPortDirection>(["Inbound", "Outbound", "Bidirectional"]);
const codeUnitCompare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) return failResourceValidation("INVALID_CATALOG", `${label} must be a non-empty string`);
  return value.trim();
};
const finiteNonNegative = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return failResourceValidation("INVALID_NUMERIC_VALUE", `${label} must be finite and non-negative`);
  return Object.is(value, -0) ? 0 : value;
};
const finiteNonNegativeInteger = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return failResourceValidation("INVALID_CATALOG", `${label} must be a non-negative safe integer`);
  return value;
};
const saveSafeIdentity = (value: unknown, label: string): string => {
  if (!isSaveSafeResourceId(value)) return failResourceValidation("INVALID_CATALOG", `${label} must be lowercase and save-safe`);
  return value;
};
const tokenList = (value: unknown, label: string, category = false): readonly string[] => {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) return failResourceValidation("INVALID_CATALOG", `${label} must be an array`);
  const values = value.map((entry) => category ? createResourceCategoryId(entry) : isSaveSafeResourceId(entry) ? entry : failResourceValidation("INVALID_CATALOG", `${label} must contain save-safe identifiers`));
  return Object.freeze([...new Set(values)].sort(codeUnitCompare));
};

const createPolicy = (value: unknown): ResourceContainerPolicy => {
  if (value !== undefined && !isRecord(value)) return failResourceValidation("INVALID_CATALOG", "Container policy must be an object when provided");
  const input = value ?? {};
  const ownershipPolicy = input.ownershipPolicy ?? "Any";
  const partialTransferPolicy = input.partialTransferPolicy ?? "Forbidden";
  if (ownershipPolicy !== "Any" && ownershipPolicy !== "OwnerOnly") return failResourceValidation("INVALID_CATALOG", "Unsupported container ownership policy");
  if (partialTransferPolicy !== "Allowed" && partialTransferPolicy !== "Forbidden") return failResourceValidation("INVALID_CATALOG", "Unsupported partial transfer policy");
  return Object.freeze({
    allowedCategoryIds: tokenList(input.allowedCategoryIds, "Allowed category ids", true),
    blockedCategoryIds: tokenList(input.blockedCategoryIds, "Blocked category ids", true),
    allowedTags: tokenList(input.allowedTags, "Allowed tags"),
    blockedTags: tokenList(input.blockedTags, "Blocked tags"),
    allowedHazards: tokenList(input.allowedHazards, "Allowed hazards"),
    blockedHazards: tokenList(input.blockedHazards, "Blocked hazards"),
    allowedActorIds: tokenList(input.allowedActorIds, "Allowed actor ids"),
    allowedOwnerIds: tokenList(input.allowedOwnerIds, "Allowed owner ids"),
    ownershipPolicy,
    partialTransferPolicy,
    extensions: cloneResourceExtensions(input.extensions)
  });
};

const createPorts = (value: unknown): readonly ContainerTransferPort[] => {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) return failResourceValidation("INVALID_CATALOG", "Container transfer ports must be an array");
  const ids = new Set<string>();
  const ports = value.map((entry) => {
    if (!isRecord(entry) || !isSaveSafeResourceId(entry.portId) || typeof entry.direction !== "string" || !directions.has(entry.direction as ContainerPortDirection)) {
      return failResourceValidation("INVALID_CATALOG", "Container transfer port is invalid");
    }
    if (ids.has(entry.portId)) return failResourceValidation("INVALID_CATALOG", `Duplicate container transfer port: ${entry.portId}`);
    ids.add(entry.portId);
    return Object.freeze({ portId: entry.portId, direction: entry.direction as ContainerPortDirection, allowedActorIds: tokenList(entry.allowedActorIds, "Port allowed actor ids"), extensions: cloneResourceExtensions(entry.extensions) });
  });
  return Object.freeze(ports.sort((a, b) => codeUnitCompare(a.portId, b.portId)));
};

const definitionPayload = (definition: Omit<ResourceContainerDefinition, "canonicalJson" | "signature">) => definition;
const statePayload = (state: Omit<ResourceContainerState, "canonicalJson" | "signature">) => state;

export const createResourceContainerDefinition = (value: unknown): ResourceContainerDefinition => {
  if (!isRecord(value) || !isSaveSafeResourceId(value.containerId) || typeof value.kind !== "string" || !kinds.has(value.kind as ResourceContainerKind)) {
    return failResourceValidation("INVALID_CATALOG", "Container definition requires a save-safe id and supported kind");
  }
  const definition = {
    containerId: value.containerId,
    kind: value.kind as ResourceContainerKind,
    maxMassKg: finiteNonNegative(value.maxMassKg, "Container maxMassKg"),
    maxVolumeM3: finiteNonNegative(value.maxVolumeM3, "Container maxVolumeM3"),
    maxStackCount: finiteNonNegativeInteger(value.maxStackCount, "Container maxStackCount"),
    policy: createPolicy(value.policy),
    transferPorts: createPorts(value.transferPorts),
    extensions: cloneResourceExtensions(value.extensions)
  };
  const payload = definitionPayload(definition);
  return Object.freeze({ ...definition, canonicalJson: canonicalJson(payload), signature: canonicalSignature(payload) });
};

const normalizeStacks = (value: unknown, catalog: ResourceCatalog, label: string): readonly ResourceStack[] => {
  if (!Array.isArray(value)) return failResourceValidation("INVALID_STACK", `${label} must be an array`);
  const ids = new Set<string>();
  const stacks: ResourceStack[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return failResourceValidation("INVALID_STACK", `${label} entries must be objects`);
    if (entry.quantity === 0) {
      // Zero quantities are intentionally omitted, but still validate the catalog resource and sealed rule.
      const parsed = createResourceStack({ ...entry, quantity: 1 });
      const resource = findResourceDefinition(catalog, parsed.resourceId);
      if (!resource) return failResourceValidation("UNKNOWN_RESOURCE", `Resource stack references unknown id: ${parsed.resourceId}`);
      const validationQuantity = resource.stackRule.kind === "Bulk" ? Math.min(1, resource.stackRule.maxQuantity) : 1;
      validateResourceStackForCatalog({ ...entry, quantity: validationQuantity }, catalog);
      continue;
    }
    const stack = validateResourceStackForCatalog(entry, catalog);
    if (ids.has(stack.stackId)) return failResourceValidation("INVALID_STACK", `Duplicate container stack id: ${stack.stackId}`);
    ids.add(stack.stackId);
    stacks.push(stack);
  }
  return Object.freeze(stacks.sort((a, b) => codeUnitCompare(a.stackId, b.stackId)));
};

export const createResourceContainerState = (value: unknown, catalog: ResourceCatalog): ResourceContainerState => {
  if (!isRecord(value) || !isSaveSafeResourceId(value.containerId)) return failResourceValidation("INVALID_CATALOG", "Container state requires a save-safe container id");
  const revision = value.revision === undefined ? 0 : finiteNonNegativeInteger(value.revision, "Container revision");
  const contents = normalizeStacks(value.contents, catalog, "Container contents");
  const initialContents = normalizeStacks(value.initialContents ?? value.contents, catalog, "Container initial contents");
  const sealed = value.sealed === undefined ? false : typeof value.sealed === "boolean" ? value.sealed : failResourceValidation("INVALID_CATALOG", "Container sealed must be boolean");
  const legalStatus = value.legalStatus === undefined ? undefined : typeof value.legalStatus === "string" && legalStatuses.has(value.legalStatus as ResourceLegalStatus) ? value.legalStatus as ResourceLegalStatus : failResourceValidation("INVALID_CATALOG", "Container legal status is invalid");
  const state = {
    containerId: value.containerId,
    revision,
    contents,
    initialContents,
    ...(value.ownerId === undefined ? {} : { ownerId: saveSafeIdentity(value.ownerId, "Container ownerId") }),
    ...(value.missionId === undefined ? {} : { missionId: text(value.missionId, "Container missionId") }),
    sealed,
    ...(legalStatus === undefined ? {} : { legalStatus }),
    extensions: cloneResourceExtensions(value.extensions)
  };
  const payload = statePayload(state);
  return Object.freeze({ ...state, canonicalJson: canonicalJson(payload), signature: canonicalSignature(payload) });
};

export const evaluateContainerEligibility = (definition: ResourceContainerDefinition, catalog: ResourceCatalog, stack: ResourceStack, actorId?: string): ResourceContainerEligibility => {
  const resource = findResourceDefinition(catalog, stack.resourceId);
  if (!resource) return Object.freeze({ eligible: false, issues: Object.freeze(["UnknownResource"]), warnings: Object.freeze([]) });
  const policy = definition.policy;
  const issues: string[] = [];
  const warnings: string[] = [];
  if (policy.allowedCategoryIds.length > 0 && !policy.allowedCategoryIds.includes(resource.categoryId)) issues.push("ResourceCategoryNotAllowed");
  if (policy.blockedCategoryIds.includes(resource.categoryId)) issues.push("ResourceCategoryBlocked");
  if (policy.allowedTags.length > 0 && !resource.tags.some((tag) => policy.allowedTags.includes(tag))) issues.push("ResourceTagNotAllowed");
  if (resource.tags.some((tag) => policy.blockedTags.includes(tag))) issues.push("ResourceTagBlocked");
  if (policy.allowedHazards.length > 0 && !resource.hazardFlags.every((hazard) => policy.allowedHazards.includes(hazard))) issues.push("HazardNotAllowed");
  if (resource.hazardFlags.some((hazard) => policy.blockedHazards.includes(hazard))) issues.push("HazardBlocked");
  if (policy.allowedActorIds.length > 0 && (actorId === undefined || !policy.allowedActorIds.includes(actorId))) issues.push("AccessDenied");
  if (policy.allowedOwnerIds.length > 0 && (stack.ownerId === undefined || !policy.allowedOwnerIds.includes(stack.ownerId))) issues.push("OwnershipDenied");
  for (const hazard of resource.hazardFlags) if (!policy.blockedHazards.includes(hazard)) warnings.push(`HazardWarning:${hazard}`);
  return Object.freeze({ eligible: issues.length === 0, issues: Object.freeze(issues), warnings: Object.freeze(warnings.sort(codeUnitCompare)) });
};

export const createResourceContainerSnapshot = (definition: ResourceContainerDefinition, state: ResourceContainerState, catalog: ResourceCatalog): ResourceContainerSnapshot => {
  if (definition.containerId !== state.containerId) return failResourceValidation("INVALID_CATALOG", "Container definition and state ids must match");
  let currentMassKg = 0;
  let currentVolumeM3 = 0;
  const resources = new Map<string, number>();
  const hazards = new Map<string, number>();
  const legal = new Map<ResourceLegalStatus, number>();
  for (const stack of state.contents) {
    const resource = findResourceDefinition(catalog, stack.resourceId);
    if (!resource) return failResourceValidation("UNKNOWN_RESOURCE", `Container stack references unknown resource: ${stack.resourceId}`);
    currentMassKg += resource.massPerUnitKg * stack.quantity;
    currentVolumeM3 += resource.volumePerUnitM3 * stack.quantity;
    resources.set(resource.resourceId, (resources.get(resource.resourceId) ?? 0) + stack.quantity);
    for (const hazard of resource.hazardFlags) hazards.set(hazard, (hazards.get(hazard) ?? 0) + stack.quantity);
    const status = stack.legalStatus ?? resource.legalStatus;
    legal.set(status, (legal.get(status) ?? 0) + stack.quantity);
  }
  // Accept only a bounded ULP-scale overflow from non-binary bulk arithmetic, then clamp to capacity.
  currentMassKg = clampNearCapacity(currentMassKg, definition.maxMassKg);
  currentVolumeM3 = clampNearCapacity(currentVolumeM3, definition.maxVolumeM3);
  const initialQuantity = state.initialContents.reduce((sum, stack) => sum + stack.quantity, 0);
  const remainingQuantity = state.contents.reduce((sum, stack) => sum + stack.quantity, 0);
  const depletion = definition.kind === "MiningNodeReservoir"
    ? Object.freeze({ initialQuantity, remainingQuantity, depletedQuantity: initialQuantity - remainingQuantity, fractionDepleted: initialQuantity === 0 ? 0 : (initialQuantity - remainingQuantity) / initialQuantity })
    : undefined;
  if (state.contents.length > definition.maxStackCount) return failResourceValidation("INVALID_STACK", "Container stack count exceeds maxStackCount");
  if (currentMassKg > definition.maxMassKg) return failResourceValidation("INVALID_NUMERIC_VALUE", "Container mass exceeds maxMassKg");
  if (currentVolumeM3 > definition.maxVolumeM3) return failResourceValidation("INVALID_NUMERIC_VALUE", "Container volume exceeds maxVolumeM3");
  if (depletion !== undefined && depletion.depletedQuantity < 0) return failResourceValidation("INVALID_STACK", "Reservoir contents cannot exceed initial contents");
  const snapshot = {
    definition,
    state,
    currentMassKg,
    currentVolumeM3,
    remainingMassKg: definition.maxMassKg - currentMassKg,
    remainingVolumeM3: definition.maxVolumeM3 - currentVolumeM3,
    stackCount: state.contents.length,
    resourceTotals: Object.freeze([...resources.entries()].sort(([a], [b]) => codeUnitCompare(a, b)).map(([resourceId, quantity]) => Object.freeze({ resourceId, quantity }))),
    hazardSummary: Object.freeze([...hazards.entries()].sort(([a], [b]) => codeUnitCompare(a, b)).map(([hazardFlag, quantity]) => Object.freeze({ hazardFlag, quantity }))),
    legalSummary: Object.freeze([...legal.entries()].sort(([a], [b]) => codeUnitCompare(a, b)).map(([legalStatus, quantity]) => Object.freeze({ legalStatus, quantity }))),
    depletion
  };
  const payload: Record<string, unknown> = { ...snapshot };
  if (depletion === undefined) {
    delete payload.depletion;
  }
  return Object.freeze({ ...snapshot, canonicalJson: canonicalJson(payload), signature: canonicalSignature(payload) });
};
