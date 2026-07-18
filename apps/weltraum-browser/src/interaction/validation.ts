import { cloneAndFreezeInteractionValue } from "./canonical";
import {
  INTERACTION_VERBS,
  InteractionContractError,
  type InteractionActorContext,
  type InteractionActorContextInput,
  type InteractionActorId,
  type InteractionCandidate,
  type InteractionCandidateInput,
  type InteractionCapabilityId,
  type InteractionMovementToleranceClass,
  type InteractionRevision,
  type InteractionTargetId,
  type InteractionTargetSnapshot,
  type InteractionTargetSnapshotInput,
  type InteractionTick,
  type InteractionToolId,
  type InteractionVerb,
  type InteractionVerbRule,
  type InteractionVerbRuleInput
} from "./contracts";

export const INTERACTION_STABLE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

const fail = (code: string, path: string, message: string): never => {
  throw new InteractionContractError(code, path, message);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const requireRecord = (value: unknown, path: string): Record<string, unknown> =>
  isRecord(value) ? value : fail("InvalidContract", path, "must be a plain object.");

export const isInteractionVerb = (value: unknown): value is InteractionVerb =>
  typeof value === "string" && (INTERACTION_VERBS as readonly string[]).includes(value);

const parseVerb = (value: unknown, path: string): InteractionVerb =>
  isInteractionVerb(value) ? value : fail("UnknownVerb", path, "is not a V1 interaction verb.");

const parseStableId = (value: unknown, path: string): string =>
  typeof value === "string" && INTERACTION_STABLE_ID_PATTERN.test(value)
    ? value
    : fail("InvalidId", path, "must be a stable lowercase ASCII identifier.");

const parseNullableId = (value: unknown, path: string): string | null =>
  value === null ? null : parseStableId(value, path);

const finiteNonNegative = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fail("InvalidNumber", path, "must be finite and non-negative.");
  }
  return Object.is(value, -0) ? 0 : value;
};

const nonNegativeSafeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return fail("InvalidInteger", path, "must be a non-negative safe integer.");
  }
  return value;
};

const booleanValue = (value: unknown, path: string): boolean =>
  typeof value === "boolean" ? value : fail("InvalidBoolean", path, "must be boolean.");

const enumValue = <T extends string>(value: unknown, allowed: readonly T[], path: string): T =>
  typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fail("InvalidEnum", path, `must be one of ${allowed.join(", ")}.`);

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const sortedUniqueIds = <T extends string>(values: unknown, path: string): readonly T[] => {
  if (!Array.isArray(values)) {
    return fail("InvalidCollection", path, "must be an array.");
  }
  const result = values.map((value, index) => parseStableId(value, `${path}[${index}]`) as T).sort();
  if (new Set(result).size !== result.length) {
    return fail("DuplicateValue", path, "must not contain duplicates.");
  }
  return Object.freeze(result);
};

const parseRevision = (value: unknown, path: string): InteractionRevision =>
  nonNegativeSafeInteger(value, path) as InteractionRevision;

export const createInteractionRevision = (value: unknown, path = "revision"): InteractionRevision =>
  parseRevision(value, path);

export const createInteractionTick = (value: unknown, path = "tick"): InteractionTick =>
  nonNegativeSafeInteger(value, path) as InteractionTick;

export const createInteractionActorId = (value: unknown, path = "actorId"): InteractionActorId =>
  parseStableId(value, path) as InteractionActorId;

export const createInteractionTargetId = (value: unknown, path = "targetId"): InteractionTargetId =>
  parseStableId(value, path) as InteractionTargetId;

export const createInteractionCapabilityId = (
  value: unknown,
  path = "capabilityId"
): InteractionCapabilityId => parseStableId(value, path) as InteractionCapabilityId;

export const createInteractionToolId = (value: unknown, path = "toolId"): InteractionToolId =>
  parseStableId(value, path) as InteractionToolId;

const parseCosts = (value: unknown, path: string): InteractionVerbRule["costs"] => {
  const record = requireRecord(value, path);
  if (!Array.isArray(record.resources)) {
    return fail("InvalidCollection", `${path}.resources`, "must be an array.");
  }
  const resources = record.resources
    .map((entry, index) => {
      const cost = requireRecord(entry, `${path}.resources[${index}]`);
      return {
        resourceId: parseStableId(cost.resourceId, `${path}.resources[${index}].resourceId`),
        amount: finiteNonNegative(cost.amount, `${path}.resources[${index}].amount`)
      };
    })
    .sort((left, right) => compareText(left.resourceId, right.resourceId));
  if (new Set(resources.map((cost) => cost.resourceId)).size !== resources.length) {
    return fail("DuplicateValue", `${path}.resources`, "must not repeat a resource ID.");
  }
  return cloneAndFreezeInteractionValue({
    energy: finiteNonNegative(record.energy, `${path}.energy`),
    resources
  });
};

const parseVerbRule = (value: unknown, path: string): InteractionVerbRule => {
  const input = requireRecord(value, path) as unknown as InteractionVerbRuleInput;
  return cloneAndFreezeInteractionValue({
    verb: parseVerb(input.verb, `${path}.verb`),
    requiredCapabilities: sortedUniqueIds<InteractionCapabilityId>(
      input.requiredCapabilities,
      `${path}.requiredCapabilities`
    ),
    requiredTools: sortedUniqueIds<InteractionToolId>(input.requiredTools, `${path}.requiredTools`),
    costs: parseCosts(input.costs, `${path}.costs`),
    requiredPermissionId: parseNullableId(input.requiredPermissionId, `${path}.requiredPermissionId`),
    requiredHoldTicks: createInteractionTick(input.requiredHoldTicks, `${path}.requiredHoldTicks`),
    interruptPolicy: enumValue(input.interruptPolicy, ["Interruptible", "Committed"] as const, `${path}.interruptPolicy`),
    movementToleranceClass: enumValue<InteractionMovementToleranceClass>(
      input.movementToleranceClass,
      ["Stationary", "Limited", "Mobile"] as const,
      `${path}.movementToleranceClass`
    ),
    damageInterrupts: booleanValue(input.damageInterrupts, `${path}.damageInterrupts`),
    focusLossInterrupts: booleanValue(input.focusLossInterrupts, `${path}.focusLossInterrupts`),
    allowedActorModes: sortedUniqueIds<string>(input.allowedActorModes, `${path}.allowedActorModes`),
    targetBusy: booleanValue(input.targetBusy, `${path}.targetBusy`)
  });
};

export const createInteractionTargetSnapshot = (value: InteractionTargetSnapshotInput | unknown): InteractionTargetSnapshot => {
  const input = requireRecord(value, "target") as unknown as InteractionTargetSnapshotInput;
  if (!Array.isArray(input.supportedVerbs) || !Array.isArray(input.verbRules)) {
    return fail("InvalidCollection", "target", "supportedVerbs and verbRules must be arrays.");
  }
  const supportedVerbs = input.supportedVerbs.map((verb, index) => parseVerb(verb, `target.supportedVerbs[${index}]`));
  supportedVerbs.sort((left, right) => INTERACTION_VERBS.indexOf(left) - INTERACTION_VERBS.indexOf(right));
  if (new Set(supportedVerbs).size !== supportedVerbs.length) {
    return fail("DuplicateValue", "target.supportedVerbs", "must not contain duplicates.");
  }
  const verbRules = input.verbRules.map((rule, index) => parseVerbRule(rule, `target.verbRules[${index}]`));
  verbRules.sort((left, right) => INTERACTION_VERBS.indexOf(left.verb) - INTERACTION_VERBS.indexOf(right.verb));
  if (new Set(verbRules.map((rule) => rule.verb)).size !== verbRules.length) {
    return fail("DuplicateValue", "target.verbRules", "must contain one rule per verb.");
  }
  if (
    supportedVerbs.length !== verbRules.length ||
    supportedVerbs.some((verb, index) => verb !== verbRules[index]?.verb)
  ) {
    return fail("RuleMismatch", "target.verbRules", "must exactly match supportedVerbs.");
  }
  const hazard = requireRecord(input.hazard, "target.hazard");
  const requiredCapabilities = [...new Set(verbRules.flatMap((rule) => rule.requiredCapabilities))].sort();
  const requiredTools = [...new Set(verbRules.flatMap((rule) => rule.requiredTools))].sort();
  return cloneAndFreezeInteractionValue({
    targetId: createInteractionTargetId(input.targetId, "target.targetId"),
    revision: createInteractionRevision(input.revision, "target.revision"),
    ownerId: parseNullableId(input.ownerId, "target.ownerId"),
    claimId: parseNullableId(input.claimId, "target.claimId"),
    legalState: enumValue(input.legalState, ["Legal", "Restricted", "Illegal"] as const, "target.legalState"),
    hazard: {
      level: finiteNonNegative(hazard.level, "target.hazard.level"),
      warningThreshold: finiteNonNegative(hazard.warningThreshold, "target.hazard.warningThreshold")
    },
    supportedVerbs,
    requiredCapabilities,
    requiredTools,
    verbRules
  });
};

const parseAmounts = (values: unknown, path: string): readonly { readonly resourceId: string; readonly amount: number }[] => {
  if (!Array.isArray(values)) {
    return fail("InvalidCollection", path, "must be an array.");
  }
  const result = values
    .map((entry, index) => {
      const record = requireRecord(entry, `${path}[${index}]`);
      return {
        resourceId: parseStableId(record.resourceId, `${path}[${index}].resourceId`),
        amount: finiteNonNegative(record.amount, `${path}[${index}].amount`)
      };
    })
    .sort((left, right) => compareText(left.resourceId, right.resourceId));
  if (new Set(result.map((entry) => entry.resourceId)).size !== result.length) {
    return fail("DuplicateValue", path, "must not repeat a resource ID.");
  }
  return Object.freeze(result);
};

export const createInteractionActorContext = (value: InteractionActorContextInput | unknown): InteractionActorContext => {
  const input = requireRecord(value, "context") as unknown as InteractionActorContextInput;
  const knownCapabilities = sortedUniqueIds<InteractionCapabilityId>(
    input.knownCapabilities,
    "context.knownCapabilities"
  );
  const capabilities = sortedUniqueIds<InteractionCapabilityId>(input.capabilities, "context.capabilities");
  if (capabilities.some((capability) => !knownCapabilities.includes(capability))) {
    return fail("UnknownCapability", "context.capabilities", "must be a subset of knownCapabilities.");
  }
  return cloneAndFreezeInteractionValue({
    actorId: createInteractionActorId(input.actorId, "context.actorId"),
    revision: createInteractionRevision(input.revision, "context.revision"),
    knownCapabilities,
    capabilities,
    tools: sortedUniqueIds<InteractionToolId>(input.tools, "context.tools"),
    energyAvailable: finiteNonNegative(input.energyAvailable, "context.energyAvailable"),
    resources: parseAmounts(input.resources, "context.resources"),
    permissions: sortedUniqueIds<string>(input.permissions, "context.permissions"),
    legalOverride: booleanValue(input.legalOverride, "context.legalOverride"),
    hazardTolerance: finiteNonNegative(input.hazardTolerance, "context.hazardTolerance"),
    incapacitated: booleanValue(input.incapacitated, "context.incapacitated"),
    mode: parseStableId(input.mode, "context.mode")
  });
};

export const createInteractionCandidate = (value: InteractionCandidateInput | unknown): InteractionCandidate => {
  const input = requireRecord(value, "candidate") as unknown as InteractionCandidateInput;
  return cloneAndFreezeInteractionValue({
    actorId: createInteractionActorId(input.actorId, "candidate.actorId"),
    actorRevision: createInteractionRevision(input.actorRevision, "candidate.actorRevision"),
    target: createInteractionTargetSnapshot(input.target),
    expectedTargetRevision: createInteractionRevision(
      input.expectedTargetRevision,
      "candidate.expectedTargetRevision"
    ),
    verb: parseVerb(input.verb, "candidate.verb"),
    distanceMeters: finiteNonNegative(input.distanceMeters, "candidate.distanceMeters"),
    maximumDistanceMeters: finiteNonNegative(input.maximumDistanceMeters, "candidate.maximumDistanceMeters"),
    lineOfSight: booleanValue(input.lineOfSight, "candidate.lineOfSight"),
    reachable: booleanValue(input.reachable, "candidate.reachable"),
    focusRank: nonNegativeSafeInteger(input.focusRank, "candidate.focusRank")
  });
};

export const isInteractionRecord = isRecord;
