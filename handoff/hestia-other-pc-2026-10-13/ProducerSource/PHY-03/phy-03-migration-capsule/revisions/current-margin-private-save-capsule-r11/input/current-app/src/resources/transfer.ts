import { findResourceDefinition, hasResourceDefinition, type ResourceCatalog } from "./catalog";
import { clampNearCapacity, fitsWithinCapacity } from "./capacityMath";
import {
  createResourceStackId,
  isSaveSafeResourceId,
  type ResourceId,
  type ResourceStackId
} from "./ids";
import {
  createResourceContainerSnapshot,
  createResourceContainerState,
  evaluateContainerEligibility,
  type ResourceContainerSnapshot
} from "./containers";
import { canonicalJson, canonicalSignature } from "./serialization";
import type { ResourceDefinition, ResourceStack } from "./types";

export const RESOURCE_TRANSFER_STATUSES = Object.freeze([
  "Accepted",
  "PartiallyAccepted",
  "Rejected"
] as const);

export type ResourceTransferStatus = (typeof RESOURCE_TRANSFER_STATUSES)[number];

/**
 * Stable transfer diagnostics. The engine does not invent legal, economic, or
 * gameplay consequences beyond these local container/transfer outcomes.
 */
export const RESOURCE_TRANSFER_REJECTION_CODES = Object.freeze([
  "UnknownResource",
  "UnknownSourceStack",
  "QuantityInvalid",
  "InsufficientQuantity",
  "SourceRevisionConflict",
  "TargetRevisionConflict",
  "TargetMassExceeded",
  "TargetVolumeExceeded",
  "TargetStackLimitExceeded",
  "ResourceCategoryBlocked",
  "ResourceTagBlocked",
  "HazardBlocked",
  "AccessDenied",
  "OwnershipDenied",
  "MissionLocked",
  "SealedStackCannotSplit",
  "PartialTransferNotAllowed",
  "SameContainerTransfer"
] as const);

export type ResourceTransferRejectionCode = (typeof RESOURCE_TRANSFER_REJECTION_CODES)[number];

/**
 * The fixed evaluation precedence used whenever more than one condition is
 * present. It is intentionally separate from the vocabulary declaration so
 * callers can rely on deterministic diagnostics rather than object ordering.
 */
export const RESOURCE_TRANSFER_VALIDATION_ORDER = Object.freeze([
  "QuantityInvalid",
  "UnknownResource",
  "SameContainerTransfer",
  "SourceRevisionConflict",
  "TargetRevisionConflict",
  "UnknownSourceStack",
  "InsufficientQuantity",
  "AccessDenied",
  "OwnershipDenied",
  "MissionLocked",
  "ResourceCategoryBlocked",
  "ResourceTagBlocked",
  "HazardBlocked",
  "TargetMassExceeded",
  "TargetVolumeExceeded",
  "TargetStackLimitExceeded",
  "SealedStackCannotSplit",
  "PartialTransferNotAllowed"
] as const satisfies readonly ResourceTransferRejectionCode[]);

export interface ResourceTransferEndpointInput {
  readonly containerId: string;
  readonly expectedRevision: number;
  /** If supplied, this endpoint must use this explicit compatible transfer port. */
  readonly portId?: string;
}

export interface ResourceTransferContextInput {
  /** Optional for open containers; required by actor-restricted policies or ports. */
  readonly actorId?: string;
  /** Required when a mission-bound container or stack is involved. */
  readonly missionId?: string;
}

/** Explicit command data; every accepted transfer is completely replayable from these values. */
export interface ResourceTransferCommandInput {
  readonly source: ResourceTransferEndpointInput;
  readonly target: ResourceTransferEndpointInput;
  readonly resourceId: ResourceId | string;
  readonly quantity: number;
  /** Selects exactly one source stack; omitted commands consume canonical stack-id candidates. */
  readonly sourceStackId?: ResourceStackId | string;
  /** Uses this id for the first compatible target stack, otherwise target ids are derived deterministically. */
  readonly targetStackId?: ResourceStackId | string;
  /** Must be explicit. False is atomic mode; true still requires both container policies to allow partials. */
  readonly allowPartial: boolean;
  readonly context?: ResourceTransferContextInput;
}

export interface ResourceTransferEndpoint {
  readonly containerId: string;
  readonly expectedRevision: number;
  readonly portId?: string;
}

export interface ResourceTransferContext {
  readonly actorId?: string;
  readonly missionId?: string;
}

export interface ResourceTransferCommand {
  readonly source: ResourceTransferEndpoint;
  readonly target: ResourceTransferEndpoint;
  readonly resourceId: ResourceId;
  readonly quantity: number;
  readonly sourceStackId?: ResourceStackId;
  readonly targetStackId?: ResourceStackId;
  readonly allowPartial: boolean;
  readonly context: ResourceTransferContext;
}

export interface ResourceTransferDelta {
  readonly sourceQuantity: number;
  readonly targetQuantity: number;
  readonly massKg: number;
  readonly volumeM3: number;
}

export interface ResourceTransferResult {
  readonly status: ResourceTransferStatus;
  /** Present only on rejected results. Partial capacity/source limits are reported through ordered issues. */
  readonly code?: ResourceTransferRejectionCode;
  readonly requestedQuantity: number;
  readonly acceptedQuantity: number;
  readonly rejectedQuantity: number;
  readonly source: ResourceContainerSnapshot;
  readonly target: ResourceContainerSnapshot;
  readonly sourceState: ResourceContainerSnapshot["state"];
  readonly targetState: ResourceContainerSnapshot["state"];
  readonly sourceRevisionBefore: number;
  readonly sourceRevisionAfter: number;
  readonly targetRevisionBefore: number;
  readonly targetRevisionAfter: number;
  readonly sourceSignatureBefore: string;
  readonly sourceSignatureAfter: string;
  readonly targetSignatureBefore: string;
  readonly targetSignatureAfter: string;
  readonly sourceStackIds: readonly string[];
  readonly targetStackIds: readonly string[];
  readonly issues: readonly ResourceTransferRejectionCode[];
  readonly warnings: readonly string[];
  readonly delta: ResourceTransferDelta;
}

interface ParsedCommand {
  readonly command: ResourceTransferCommand;
  readonly resource: ResourceDefinition;
}

interface CommandFailure {
  readonly code: ResourceTransferRejectionCode;
  readonly requestedQuantity: number;
}

interface TransferPlan {
  readonly acceptedQuantity: number;
  readonly sourceMoved: ReadonlyMap<string, number>;
  readonly targetContents: readonly ResourceStack[];
  readonly sourceStackIds: readonly string[];
  readonly targetStackIds: readonly string[];
  readonly capacityIssues: readonly ResourceTransferRejectionCode[];
}

const codeUnitCompare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const validationOrder = new Map<string, number>(
  RESOURCE_TRANSFER_VALIDATION_ORDER.map((code, index) => [code, index])
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const requestedQuantityFrom = (value: unknown): number =>
  isRecord(value) && isPositiveFinite(value.quantity) ? value.quantity : 0;

const orderedCodes = (values: readonly ResourceTransferRejectionCode[]): readonly ResourceTransferRejectionCode[] =>
  Object.freeze(
    [...new Set(values)].sort(
      (left, right) =>
        (validationOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (validationOrder.get(right) ?? Number.MAX_SAFE_INTEGER) ||
        codeUnitCompare(left, right)
    )
  );

const orderedStrings = (values: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(values)].sort(codeUnitCompare));

const parseEndpoint = (value: unknown): ResourceTransferEndpoint | undefined => {
  if (!isRecord(value) || !isSaveSafeResourceId(value.containerId) || !isNonNegativeSafeInteger(value.expectedRevision)) {
    return undefined;
  }

  if (value.portId !== undefined && !isSaveSafeResourceId(value.portId)) {
    return undefined;
  }

  return Object.freeze({
    containerId: value.containerId,
    expectedRevision: value.expectedRevision,
    ...(value.portId === undefined ? {} : { portId: value.portId })
  });
};

const parseContext = (value: unknown): ResourceTransferContext | undefined => {
  if (value === undefined) {
    return Object.freeze({});
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const actorId = value.actorId;
  const missionId = value.missionId;
  if (actorId !== undefined && !isSaveSafeResourceId(actorId)) {
    return undefined;
  }
  if (missionId !== undefined && (typeof missionId !== "string" || !missionId.trim())) {
    return undefined;
  }

  return Object.freeze({
    ...(actorId === undefined ? {} : { actorId }),
    ...(missionId === undefined ? {} : { missionId: missionId.trim() })
  });
};

const parseCommand = (value: unknown, catalog: ResourceCatalog): ParsedCommand | CommandFailure => {
  const requestedQuantity = requestedQuantityFrom(value);
  if (!isRecord(value)) {
    return { code: "QuantityInvalid", requestedQuantity };
  }

  const source = parseEndpoint(value.source);
  const target = parseEndpoint(value.target);
  const context = parseContext(value.context);
  if (source === undefined || target === undefined || context === undefined || typeof value.allowPartial !== "boolean") {
    return { code: "QuantityInvalid", requestedQuantity };
  }

  if (!isPositiveFinite(value.quantity)) {
    return { code: "QuantityInvalid", requestedQuantity };
  }

  if (!isSaveSafeResourceId(value.resourceId) || !hasResourceDefinition(catalog, value.resourceId)) {
    return { code: "UnknownResource", requestedQuantity };
  }

  const resource = findResourceDefinition(catalog, value.resourceId);
  if (!resource) {
    return { code: "UnknownResource", requestedQuantity };
  }

  if (resource.stackRule.kind !== "Bulk" && !Number.isSafeInteger(value.quantity)) {
    return { code: "QuantityInvalid", requestedQuantity };
  }

  if (value.sourceStackId !== undefined && !isSaveSafeResourceId(value.sourceStackId)) {
    return { code: "UnknownSourceStack", requestedQuantity };
  }
  if (value.targetStackId !== undefined && !isSaveSafeResourceId(value.targetStackId)) {
    return { code: "QuantityInvalid", requestedQuantity };
  }

  return {
    command: Object.freeze({
      source,
      target,
      resourceId: resource.resourceId,
      quantity: value.quantity,
      ...(value.sourceStackId === undefined ? {} : { sourceStackId: createResourceStackId(value.sourceStackId) }),
      ...(value.targetStackId === undefined ? {} : { targetStackId: createResourceStackId(value.targetStackId) }),
      allowPartial: value.allowPartial,
      context
    }),
    resource
  };
};

const isCommandFailure = (value: ParsedCommand | CommandFailure): value is CommandFailure => "code" in value;

const stackMetadataPayload = (stack: ResourceStack): Record<string, unknown> => ({
  resourceId: stack.resourceId,
  ...(stack.grade === undefined ? {} : { grade: stack.grade }),
  ...(stack.condition === undefined ? {} : { condition: stack.condition }),
  ...(stack.ownerId === undefined ? {} : { ownerId: stack.ownerId }),
  ...(stack.legalStatus === undefined ? {} : { legalStatus: stack.legalStatus }),
  ...(stack.missionId === undefined ? {} : { missionId: stack.missionId }),
  sealed: stack.sealed,
  extensions: stack.extensions
});

const hasCompatibleMetadata = (left: ResourceStack, right: ResourceStack): boolean =>
  canonicalJson(stackMetadataPayload(left)) === canonicalJson(stackMetadataPayload(right));

const directionalPortAllowed = (
  endpoint: ResourceTransferEndpoint,
  snapshot: ResourceContainerSnapshot,
  direction: "Inbound" | "Outbound",
  actorId: string | undefined
): boolean => {
  const matchingDirection = snapshot.definition.transferPorts.filter(
    (port) => port.direction === "Bidirectional" || port.direction === direction
  );

  if (endpoint.portId !== undefined) {
    const port = matchingDirection.find((candidate) => candidate.portId === endpoint.portId);
    return port !== undefined && (port.allowedActorIds.length === 0 || (actorId !== undefined && port.allowedActorIds.includes(actorId)));
  }

  if (snapshot.definition.transferPorts.length === 0) {
    return true;
  }

  return matchingDirection.some(
    (port) => port.allowedActorIds.length === 0 || (actorId !== undefined && port.allowedActorIds.includes(actorId))
  );
};

const hasOwnershipViolation = (
  snapshot: ResourceContainerSnapshot,
  stack: ResourceStack,
  actorId: string | undefined,
  isTarget: boolean
): boolean => {
  if (snapshot.definition.policy.ownershipPolicy !== "OwnerOnly") {
    return false;
  }

  const stackOwner = stack.ownerId ?? snapshot.state.ownerId;
  if (!stackOwner || actorId !== stackOwner) {
    return true;
  }

  return isTarget && snapshot.state.ownerId !== undefined && stackOwner !== snapshot.state.ownerId;
};

const hasMissionViolation = (
  source: ResourceContainerSnapshot,
  target: ResourceContainerSnapshot,
  stack: ResourceStack,
  context: ResourceTransferContext
): boolean => {
  if (source.state.sealed || target.state.sealed) {
    return true;
  }

  if (source.state.missionId !== undefined && source.state.missionId !== context.missionId) {
    return true;
  }
  if (target.state.missionId !== undefined && target.state.missionId !== context.missionId) {
    return true;
  }
  if (stack.missionId !== undefined && stack.missionId !== context.missionId) {
    return true;
  }

  return target.state.missionId !== undefined && stack.missionId !== target.state.missionId;
};

const eligibilityCodes = (
  source: ResourceContainerSnapshot,
  target: ResourceContainerSnapshot,
  catalog: ResourceCatalog,
  stack: ResourceStack,
  actorId: string | undefined
): readonly ResourceTransferRejectionCode[] => {
  const sourceEligibility = evaluateContainerEligibility(source.definition, catalog, stack, actorId);
  const targetEligibility = evaluateContainerEligibility(target.definition, catalog, stack, actorId);
  const codes: ResourceTransferRejectionCode[] = [];
  const sourceEndpointIssues = sourceEligibility.issues.filter(
    (issue) => issue === "AccessDenied" || issue === "OwnershipDenied"
  );
  for (const issue of [...sourceEndpointIssues, ...targetEligibility.issues]) {
    switch (issue) {
      case "AccessDenied":
        codes.push("AccessDenied");
        break;
      case "OwnershipDenied":
        codes.push("OwnershipDenied");
        break;
      case "ResourceCategoryNotAllowed":
      case "ResourceCategoryBlocked":
        codes.push("ResourceCategoryBlocked");
        break;
      case "ResourceTagNotAllowed":
      case "ResourceTagBlocked":
        codes.push("ResourceTagBlocked");
        break;
      case "HazardNotAllowed":
      case "HazardBlocked":
        codes.push("HazardBlocked");
        break;
      default:
        break;
    }
  }
  return orderedCodes(codes);
};

const eligibilityWarnings = (
  target: ResourceContainerSnapshot,
  catalog: ResourceCatalog,
  stacks: readonly ResourceStack[],
  actorId: string | undefined
): readonly string[] => {
  const warnings: string[] = [];
  for (const stack of stacks) {
    warnings.push(...evaluateContainerEligibility(target.definition, catalog, stack, actorId).warnings);
  }
  return orderedStrings(warnings);
};

const capacityIssuesInOrder = (issues: ReadonlySet<ResourceTransferRejectionCode>): readonly ResourceTransferRejectionCode[] =>
  orderedCodes(
    ["TargetMassExceeded", "TargetVolumeExceeded", "TargetStackLimitExceeded"].filter((code) =>
      issues.has(code as ResourceTransferRejectionCode)
    ) as ResourceTransferRejectionCode[]
  );

const normalizeTransferQuantity = (quantity: number, resource: ResourceDefinition): number => {
  if (resource.stackRule.kind === "Bulk") {
    return quantity;
  }

  return Math.floor(quantity);
};

const createDerivedTargetStackId = (
  command: ResourceTransferCommand,
  sourceStack: ResourceStack,
  sequence: number,
  claimedIds: ReadonlySet<string>
): ResourceStackId => {
  const hash = canonicalSignature({
    version: "resource_transfer_v1",
    sourceContainerId: command.source.containerId,
    targetContainerId: command.target.containerId,
    resourceId: command.resourceId,
    sourceStackId: sourceStack.stackId,
    sequence,
    metadata: stackMetadataPayload(sourceStack)
  }).replace(/[^a-z0-9]/g, "");
  const base = `transfer_${hash || "0"}`;
  let candidate = base;
  let suffix = 1;
  while (claimedIds.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return createResourceStackId(candidate);
};

const planTransfer = (
  command: ResourceTransferCommand,
  resource: ResourceDefinition,
  sourceCandidates: readonly ResourceStack[],
  target: ResourceContainerSnapshot
): TransferPlan => {
  const targetContents = target.state.contents.map((stack) => ({ ...stack }));
  const claimedIds = new Set(targetContents.map((stack) => stack.stackId));
  const sourceMoved = new Map<string, number>();
  const targetStackIds = new Set<string>();
  const capacityIssues = new Set<ResourceTransferRejectionCode>();
  let currentMassKg = target.currentMassKg;
  let currentVolumeM3 = target.currentVolumeM3;
  let remainingRequested = command.quantity;
  let derivationSequence = 0;
  let explicitTargetIdUsed = false;

  const availableForTargetStack = (desired: number, stackSpace: number): number => {
    const desiredQuantity = normalizeTransferQuantity(Math.min(desired, stackSpace), resource);
    const availableCapacity = (capacity: number, current: number, perUnit: number): number => {
      if (perUnit === 0 || fitsWithinCapacity(current + desiredQuantity * perUnit, capacity)) {
        return desiredQuantity;
      }

      return Math.max(0, (capacity - current) / perUnit);
    };
    const massLimit = availableCapacity(target.definition.maxMassKg, currentMassKg, resource.massPerUnitKg);
    const volumeLimit = availableCapacity(target.definition.maxVolumeM3, currentVolumeM3, resource.volumePerUnitM3);
    const quantity = normalizeTransferQuantity(Math.min(desiredQuantity, massLimit, volumeLimit), resource);

    if (massLimit < desiredQuantity) {
      capacityIssues.add("TargetMassExceeded");
    }
    if (volumeLimit < desiredQuantity) {
      capacityIssues.add("TargetVolumeExceeded");
    }

    return quantity > 0 ? quantity : 0;
  };

  const addQuantity = (targetIndex: number, quantity: number): void => {
    const existing = targetContents[targetIndex];
    targetContents[targetIndex] = { ...existing, quantity: existing.quantity + quantity };
    currentMassKg = clampNearCapacity(
      currentMassKg + quantity * resource.massPerUnitKg,
      target.definition.maxMassKg
    );
    currentVolumeM3 = clampNearCapacity(
      currentVolumeM3 + quantity * resource.volumePerUnitM3,
      target.definition.maxVolumeM3
    );
    targetStackIds.add(existing.stackId);
  };

  const addNewStack = (sourceStack: ResourceStack, stackId: ResourceStackId, desired: number): number => {
    if (targetContents.length >= target.definition.maxStackCount) {
      capacityIssues.add("TargetStackLimitExceeded");
      return 0;
    }

    const quantity = availableForTargetStack(desired, resource.stackRule.maxQuantity);
    if (quantity <= 0) {
      return 0;
    }

    targetContents.push({ ...sourceStack, stackId, quantity });
    claimedIds.add(stackId);
    targetStackIds.add(stackId);
    currentMassKg = clampNearCapacity(
      currentMassKg + quantity * resource.massPerUnitKg,
      target.definition.maxMassKg
    );
    currentVolumeM3 = clampNearCapacity(
      currentVolumeM3 + quantity * resource.volumePerUnitM3,
      target.definition.maxVolumeM3
    );
    return quantity;
  };

  for (const sourceStack of sourceCandidates) {
    if (remainingRequested <= 0) {
      break;
    }

    let remainingForStack = Math.min(sourceStack.quantity, remainingRequested);
    const wantedFromStack = remainingForStack;
    let movedFromStack = 0;

    const useExisting = (targetIndex: number): void => {
      if (remainingForStack <= 0) {
        return;
      }
      const targetStack = targetContents[targetIndex];
      if (!hasCompatibleMetadata(targetStack, sourceStack)) {
        return;
      }
      const stackSpace = resource.stackRule.maxQuantity - targetStack.quantity;
      if (stackSpace <= 0) {
        return;
      }
      const quantity = availableForTargetStack(remainingForStack, stackSpace);
      if (quantity <= 0) {
        return;
      }
      addQuantity(targetIndex, quantity);
      movedFromStack += quantity;
      remainingForStack -= quantity;
    };

    if (command.targetStackId !== undefined && !explicitTargetIdUsed) {
      const explicitIndex = targetContents.findIndex((stack) => stack.stackId === command.targetStackId);
      if (explicitIndex >= 0) {
        useExisting(explicitIndex);
        explicitTargetIdUsed = true;
      } else {
        const quantity = addNewStack(sourceStack, command.targetStackId, remainingForStack);
        if (quantity > 0) {
          explicitTargetIdUsed = true;
          movedFromStack += quantity;
          remainingForStack -= quantity;
        }
      }
    }

    for (const [targetIndex, targetStack] of targetContents.entries()) {
      if (remainingForStack <= 0) {
        break;
      }
      if (command.targetStackId !== undefined && targetStack.stackId === command.targetStackId) {
        continue;
      }
      useExisting(targetIndex);
    }

    while (remainingForStack > 0) {
      const stackId = createDerivedTargetStackId(command, sourceStack, derivationSequence, claimedIds);
      derivationSequence += 1;
      const quantity = addNewStack(sourceStack, stackId, remainingForStack);
      if (quantity <= 0) {
        break;
      }
      movedFromStack += quantity;
      remainingForStack -= quantity;
    }

    if (movedFromStack > 0) {
      sourceMoved.set(sourceStack.stackId, movedFromStack);
      remainingRequested -= movedFromStack;
    }

    if (movedFromStack < wantedFromStack) {
      if (targetContents.length >= target.definition.maxStackCount && remainingForStack > 0) {
        capacityIssues.add("TargetStackLimitExceeded");
      }
      break;
    }
  }

  return {
    acceptedQuantity: command.quantity - remainingRequested,
    sourceMoved,
    targetContents: Object.freeze(targetContents),
    sourceStackIds: orderedStrings([...sourceMoved.keys()]),
    targetStackIds: orderedStrings([...targetStackIds]),
    capacityIssues: capacityIssuesInOrder(capacityIssues)
  };
};

const stateInputWithContents = (
  snapshot: ResourceContainerSnapshot,
  contents: readonly ResourceStack[],
  revision: number
): Record<string, unknown> => ({
  containerId: snapshot.state.containerId,
  revision,
  contents,
  initialContents: snapshot.state.initialContents,
  ...(snapshot.state.ownerId === undefined ? {} : { ownerId: snapshot.state.ownerId }),
  ...(snapshot.state.missionId === undefined ? {} : { missionId: snapshot.state.missionId }),
  sealed: snapshot.state.sealed,
  ...(snapshot.state.legalStatus === undefined ? {} : { legalStatus: snapshot.state.legalStatus }),
  extensions: snapshot.state.extensions
});

const createTransferResult = (
  status: ResourceTransferStatus,
  sourceBefore: ResourceContainerSnapshot,
  targetBefore: ResourceContainerSnapshot,
  sourceAfter: ResourceContainerSnapshot,
  targetAfter: ResourceContainerSnapshot,
  requestedQuantity: number,
  acceptedQuantity: number,
  issues: readonly ResourceTransferRejectionCode[],
  warnings: readonly string[],
  sourceStackIds: readonly string[],
  targetStackIds: readonly string[],
  resource?: ResourceDefinition,
  code?: ResourceTransferRejectionCode
): ResourceTransferResult => {
  const delta = Object.freeze({
    sourceQuantity: -acceptedQuantity,
    targetQuantity: acceptedQuantity,
    massKg: resource === undefined ? 0 : acceptedQuantity * resource.massPerUnitKg,
    volumeM3: resource === undefined ? 0 : acceptedQuantity * resource.volumePerUnitM3
  });
  const result: ResourceTransferResult = {
    status,
    ...(code === undefined ? {} : { code }),
    requestedQuantity,
    acceptedQuantity,
    rejectedQuantity: Math.max(0, requestedQuantity - acceptedQuantity),
    source: sourceAfter,
    target: targetAfter,
    sourceState: sourceAfter.state,
    targetState: targetAfter.state,
    sourceRevisionBefore: sourceBefore.state.revision,
    sourceRevisionAfter: sourceAfter.state.revision,
    targetRevisionBefore: targetBefore.state.revision,
    targetRevisionAfter: targetAfter.state.revision,
    sourceSignatureBefore: sourceBefore.state.signature,
    sourceSignatureAfter: sourceAfter.state.signature,
    targetSignatureBefore: targetBefore.state.signature,
    targetSignatureAfter: targetAfter.state.signature,
    sourceStackIds: orderedStrings(sourceStackIds),
    targetStackIds: orderedStrings(targetStackIds),
    issues: orderedCodes(issues),
    warnings: orderedStrings(warnings),
    delta
  };
  return Object.freeze(result);
};

const rejected = (
  source: ResourceContainerSnapshot,
  target: ResourceContainerSnapshot,
  code: ResourceTransferRejectionCode,
  requestedQuantity: number,
  issues: readonly ResourceTransferRejectionCode[] = [code],
  warnings: readonly string[] = []
): ResourceTransferResult =>
  createTransferResult(
    "Rejected",
    source,
    target,
    source,
    target,
    requestedQuantity,
    0,
    issues,
    warnings,
    [],
    [],
    undefined,
    code
  );

const primaryIssue = (issues: readonly ResourceTransferRejectionCode[], fallback: ResourceTransferRejectionCode): ResourceTransferRejectionCode =>
  orderedCodes(issues)[0] ?? fallback;

const splitIntegrityViolation = (
  source: ResourceContainerSnapshot,
  resource: ResourceDefinition,
  sourceMoved: ReadonlyMap<string, number>
): ResourceTransferRejectionCode | undefined => {
  const splitStacks = source.state.contents.filter((stack) => {
    const moved = sourceMoved.get(stack.stackId) ?? 0;
    return moved > 0 && moved < stack.quantity;
  });
  if (splitStacks.length === 0) {
    return undefined;
  }
  if (splitStacks.some((stack) => stack.sealed || resource.stackRule.kind === "Sealed")) {
    return "SealedStackCannotSplit";
  }
  if (source.state.missionId !== undefined || splitStacks.some((stack) => stack.missionId !== undefined)) {
    return "MissionLocked";
  }
  return resource.stackRule.splitAllowed === true ? undefined : "PartialTransferNotAllowed";
};

/**
 * Moves resource stacks without mutation, hidden registries, clocks, or random ids.
 * Snapshots supply the canonical definitions and derived capacity data required for
 * validation; rejected results retain the exact input snapshot objects.
 */
export function transferResource(
  input: ResourceTransferCommandInput,
  catalog: ResourceCatalog,
  source: ResourceContainerSnapshot,
  target: ResourceContainerSnapshot
): ResourceTransferResult;
export function transferResource(
  input: unknown,
  catalog: ResourceCatalog,
  source: ResourceContainerSnapshot,
  target: ResourceContainerSnapshot
): ResourceTransferResult {
  const parsed = parseCommand(input, catalog);
  if (isCommandFailure(parsed)) {
    return rejected(source, target, parsed.code, parsed.requestedQuantity);
  }

  const { command, resource } = parsed;
  if (command.source.containerId === command.target.containerId) {
    return rejected(source, target, "SameContainerTransfer", command.quantity);
  }
  if (
    source.definition.containerId !== command.source.containerId ||
    source.state.containerId !== command.source.containerId
  ) {
    return rejected(source, target, "SourceRevisionConflict", command.quantity);
  }
  if (
    target.definition.containerId !== command.target.containerId ||
    target.state.containerId !== command.target.containerId
  ) {
    return rejected(source, target, "TargetRevisionConflict", command.quantity);
  }
  if (source.state.revision !== command.source.expectedRevision) {
    return rejected(source, target, "SourceRevisionConflict", command.quantity);
  }
  if (target.state.revision !== command.target.expectedRevision) {
    return rejected(source, target, "TargetRevisionConflict", command.quantity);
  }
  if (source.state.revision >= Number.MAX_SAFE_INTEGER) {
    return rejected(source, target, "SourceRevisionConflict", command.quantity);
  }
  if (target.state.revision >= Number.MAX_SAFE_INTEGER) {
    return rejected(source, target, "TargetRevisionConflict", command.quantity);
  }

  const orderedSourceContents = [...source.state.contents].sort((left, right) =>
    codeUnitCompare(left.stackId, right.stackId)
  );
  let candidates: readonly ResourceStack[];
  if (command.sourceStackId !== undefined) {
    const sourceStack = orderedSourceContents.find((stack) => stack.stackId === command.sourceStackId);
    if (!sourceStack || sourceStack.resourceId !== command.resourceId) {
      return rejected(source, target, "UnknownSourceStack", command.quantity);
    }
    candidates = Object.freeze([sourceStack]);
  } else {
    candidates = Object.freeze(
      orderedSourceContents.filter((stack) => stack.resourceId === command.resourceId)
    );
  }

  const availableQuantity = candidates.reduce((total, stack) => total + stack.quantity, 0);
  if (candidates.length === 0 || availableQuantity === 0) {
    return rejected(source, target, "InsufficientQuantity", command.quantity);
  }
  if (!command.allowPartial && availableQuantity < command.quantity) {
    return rejected(source, target, "InsufficientQuantity", command.quantity);
  }

  const validationCandidates: ResourceStack[] = [];
  let quantityForCandidates = command.quantity;
  for (const stack of candidates) {
    validationCandidates.push(stack);
    quantityForCandidates -= stack.quantity;
    if (quantityForCandidates <= 0) {
      break;
    }
  }

  if (
    !directionalPortAllowed(command.source, source, "Outbound", command.context.actorId) ||
    !directionalPortAllowed(command.target, target, "Inbound", command.context.actorId)
  ) {
    return rejected(source, target, "AccessDenied", command.quantity);
  }

  const policyCodes = new Set<ResourceTransferRejectionCode>();
  let ownershipDenied = false;
  let missionLocked = false;
  for (const stack of validationCandidates) {
    for (const code of eligibilityCodes(source, target, catalog, stack, command.context.actorId)) {
      policyCodes.add(code);
    }
    ownershipDenied ||= hasOwnershipViolation(source, stack, command.context.actorId, false);
    ownershipDenied ||= hasOwnershipViolation(target, stack, command.context.actorId, true);
    missionLocked ||= hasMissionViolation(source, target, stack, command.context);
  }
  const warnings = eligibilityWarnings(target, catalog, validationCandidates, command.context.actorId);

  if (policyCodes.has("AccessDenied")) {
    return rejected(source, target, "AccessDenied", command.quantity, ["AccessDenied"], warnings);
  }
  if (ownershipDenied || policyCodes.has("OwnershipDenied")) {
    return rejected(source, target, "OwnershipDenied", command.quantity, ["OwnershipDenied"], warnings);
  }
  if (missionLocked) {
    return rejected(source, target, "MissionLocked", command.quantity, ["MissionLocked"], warnings);
  }
  const policyBlockers = orderedCodes(
    [...policyCodes].filter(
      (code): code is "ResourceCategoryBlocked" | "ResourceTagBlocked" | "HazardBlocked" =>
        code === "ResourceCategoryBlocked" || code === "ResourceTagBlocked" || code === "HazardBlocked"
    )
  );
  if (policyBlockers.length > 0) {
    return rejected(source, target, primaryIssue(policyBlockers, "ResourceCategoryBlocked"), command.quantity, policyBlockers, warnings);
  }

  if (command.targetStackId !== undefined) {
    const existingTargetStack = target.state.contents.find((stack) => stack.stackId === command.targetStackId);
    if (existingTargetStack !== undefined && !hasCompatibleMetadata(existingTargetStack, validationCandidates[0])) {
      return rejected(source, target, "QuantityInvalid", command.quantity);
    }
  }

  const plan = planTransfer(command, resource, validationCandidates, target);
  const sourceShortfall = availableQuantity < command.quantity;
  const limitIssues = orderedCodes([
    ...(sourceShortfall ? ["InsufficientQuantity" as const] : []),
    ...plan.capacityIssues
  ]);
  const splitViolation = splitIntegrityViolation(source, resource, plan.sourceMoved);

  if (plan.acceptedQuantity === command.quantity) {
    if (splitViolation !== undefined) {
      return rejected(source, target, splitViolation, command.quantity, [splitViolation], warnings);
    }
    const sourceContents = source.state.contents
      .map((stack) => {
        const moved = plan.sourceMoved.get(stack.stackId) ?? 0;
        return moved === 0 ? stack : { ...stack, quantity: stack.quantity - moved };
      })
      .filter((stack) => stack.quantity > 0);
    const sourceState = createResourceContainerState(
      stateInputWithContents(source, sourceContents, source.state.revision + 1),
      catalog
    );
    const targetState = createResourceContainerState(
      stateInputWithContents(target, plan.targetContents, target.state.revision + 1),
      catalog
    );
    const sourceAfter = createResourceContainerSnapshot(source.definition, sourceState, catalog);
    const targetAfter = createResourceContainerSnapshot(target.definition, targetState, catalog);
    return createTransferResult(
      "Accepted",
      source,
      target,
      sourceAfter,
      targetAfter,
      command.quantity,
      plan.acceptedQuantity,
      [],
      warnings,
      plan.sourceStackIds,
      plan.targetStackIds,
      resource
    );
  }

  if (plan.acceptedQuantity === 0) {
    const code = primaryIssue(limitIssues, "TargetStackLimitExceeded");
    return rejected(source, target, code, command.quantity, limitIssues, warnings);
  }

  if (!command.allowPartial) {
    const code = primaryIssue(limitIssues, "InsufficientQuantity");
    return rejected(source, target, code, command.quantity, limitIssues, warnings);
  }

  if (splitViolation !== undefined) {
    return rejected(source, target, splitViolation, command.quantity, [splitViolation], warnings);
  }
  if (
    source.definition.policy.partialTransferPolicy !== "Allowed" ||
    target.definition.policy.partialTransferPolicy !== "Allowed"
  ) {
    return rejected(source, target, "PartialTransferNotAllowed", command.quantity, ["PartialTransferNotAllowed"], warnings);
  }

  const sourceContents = source.state.contents
    .map((stack) => {
      const moved = plan.sourceMoved.get(stack.stackId) ?? 0;
      return moved === 0 ? stack : { ...stack, quantity: stack.quantity - moved };
    })
    .filter((stack) => stack.quantity > 0);
  const sourceState = createResourceContainerState(
    stateInputWithContents(source, sourceContents, source.state.revision + 1),
    catalog
  );
  const targetState = createResourceContainerState(
    stateInputWithContents(target, plan.targetContents, target.state.revision + 1),
    catalog
  );
  const sourceAfter = createResourceContainerSnapshot(source.definition, sourceState, catalog);
  const targetAfter = createResourceContainerSnapshot(target.definition, targetState, catalog);
  return createTransferResult(
    "PartiallyAccepted",
    source,
    target,
    sourceAfter,
    targetAfter,
    command.quantity,
    plan.acceptedQuantity,
    limitIssues,
    warnings,
    plan.sourceStackIds,
    plan.targetStackIds,
    resource
  );
}

/**
 * Extraction is intentionally only a transfer seam: it preserves the reservoir's
 * initial contents so its existing snapshot derives deterministic remainder and depletion.
 */
export function extractFromMiningReservoir(
  input: ResourceTransferCommandInput,
  catalog: ResourceCatalog,
  reservoir: ResourceContainerSnapshot,
  target: ResourceContainerSnapshot
): ResourceTransferResult;
export function extractFromMiningReservoir(
  input: unknown,
  catalog: ResourceCatalog,
  reservoir: ResourceContainerSnapshot,
  target: ResourceContainerSnapshot
): ResourceTransferResult {
  if (reservoir.definition.kind !== "MiningNodeReservoir") {
    return rejected(reservoir, target, "QuantityInvalid", requestedQuantityFrom(input));
  }
  return transferResource(input as ResourceTransferCommandInput, catalog, reservoir, target);
}
