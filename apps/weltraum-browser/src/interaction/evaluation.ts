import { cloneAndFreezeInteractionValue, interactionHash } from "./canonical";
import {
  INTERACTION_VERBS,
  InteractionContractError,
  type AllowedInteractionDecision,
  type BlockedInteractionDecision,
  type InteractionActorContext,
  type InteractionCandidate,
  type InteractionCandidateSelection,
  type InteractionDecision,
  type InteractionUnavailableReason,
  type InteractionVerbRule,
  type UnavailableInteractionDecision
} from "./contracts";
import {
  INTERACTION_STABLE_ID_PATTERN,
  createInteractionActorContext,
  createInteractionActorId,
  createInteractionCandidate,
  createInteractionCapabilityId,
  createInteractionRevision,
  createInteractionTargetId,
  createInteractionToolId,
  isInteractionRecord,
  isInteractionVerb
} from "./validation";

type DecisionWithoutHash = Omit<AllowedInteractionDecision, "decisionHash"> |
  Omit<BlockedInteractionDecision, "decisionHash"> |
  Omit<UnavailableInteractionDecision, "decisionHash">;

const finalizeDecision = (decision: DecisionWithoutHash): InteractionDecision =>
  cloneAndFreezeInteractionValue({ ...decision, decisionHash: interactionHash(decision) }) as InteractionDecision;

const blocked = (reason: BlockedInteractionDecision["reason"]): BlockedInteractionDecision =>
  finalizeDecision({ status: "Blocked", reason, unavailableReason: null, warnings: [] }) as BlockedInteractionDecision;

const unavailable = (reason: InteractionUnavailableReason): UnavailableInteractionDecision =>
  finalizeDecision({ status: "Unavailable", reason: null, unavailableReason: reason, warnings: [] }) as UnavailableInteractionDecision;

const unavailableForInvalidInput = (error: unknown): UnavailableInteractionDecision => {
  if (error instanceof InteractionContractError) {
    if (error.path.startsWith("target.targetId") || error.path.startsWith("target.revision")) {
      return unavailable("InvalidTarget");
    }
    if (
      error.path.startsWith("candidate.actorId") ||
      error.path.startsWith("candidate.actorRevision") ||
      error.path.startsWith("context.actorId") ||
      error.path.startsWith("context.revision")
    ) {
      return unavailable("InvalidActor");
    }
    if (error.path === "candidate.verb") {
      return unavailable("UnsupportedVerb");
    }
  }
  return unavailable("InvalidContract");
};

const failEvaluationContract = (code: string, path: string, message: string): never => {
  throw new InteractionContractError(code, path, message);
};

const requireEvaluationRecord = (value: unknown, path: string): Record<string, unknown> =>
  isInteractionRecord(value) ? value : failEvaluationContract("InvalidContract", path, "must be a plain object.");

const finiteNonNegative = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return failEvaluationContract("InvalidNumber", path, "must be finite and non-negative.");
  }
  return Object.is(value, -0) ? 0 : value;
};

const booleanValue = (value: unknown, path: string): boolean =>
  typeof value === "boolean" ? value : failEvaluationContract("InvalidBoolean", path, "must be boolean.");

const stableId = (value: unknown, path: string): string =>
  typeof value === "string" && INTERACTION_STABLE_ID_PATTERN.test(value)
    ? value
    : failEvaluationContract("InvalidId", path, "must be a stable lowercase ASCII identifier.");

const sortedUnique = <T extends string>(
  value: unknown,
  path: string,
  parse: (entry: unknown, entryPath: string) => T
): readonly T[] => {
  if (!Array.isArray(value)) {
    return failEvaluationContract("InvalidCollection", path, "must be an array.");
  }
  const result = value.map((entry, index) => parse(entry, `${path}[${index}]`)).sort();
  if (new Set(result).size !== result.length) {
    return failEvaluationContract("DuplicateValue", path, "must not contain duplicates.");
  }
  return result;
};

interface EvaluationAmount {
  readonly resourceId: string;
  readonly amount: number;
}

const parseAmounts = (value: unknown, path: string): readonly EvaluationAmount[] => {
  if (!Array.isArray(value)) {
    return failEvaluationContract("InvalidCollection", path, "must be an array.");
  }
  const result = value.map((entry, index) => {
    const record = requireEvaluationRecord(entry, `${path}[${index}]`);
    return {
      resourceId: stableId(record.resourceId, `${path}[${index}].resourceId`),
      amount: finiteNonNegative(record.amount, `${path}[${index}].amount`)
    };
  });
  if (new Set(result.map((entry) => entry.resourceId)).size !== result.length) {
    return failEvaluationContract("DuplicateValue", path, "must not repeat a resource ID.");
  }
  return result;
};

const matchingRawRule = (
  candidate: Record<string, unknown>,
  target: Record<string, unknown>
): Record<string, unknown> | null => {
  if (!Array.isArray(target.verbRules)) {
    return null;
  }
  for (const value of target.verbRules) {
    if (isInteractionRecord(value) && value.verb === candidate.verb) {
      return value;
    }
  }
  return null;
};

interface AdmissionInputs {
  readonly targetIdentity: () => {
    readonly actualRevision: number;
    readonly expectedRevision: number;
  };
  readonly actorIdentity: () => {
    readonly candidateActorId: string;
    readonly candidateActorRevision: number;
    readonly contextActorId: string;
    readonly contextActorRevision: number;
  };
  readonly actorIncapacitated: () => boolean;
  readonly range: () => {
    readonly distanceMeters: number;
    readonly maximumDistanceMeters: number;
  };
  readonly lineOfSight: () => boolean;
  readonly reachable: () => boolean;
  readonly capabilities: () => {
    readonly available: readonly string[];
    readonly known: readonly string[];
    readonly required: readonly string[];
  };
  readonly tools: () => {
    readonly available: readonly string[];
    readonly required: readonly string[];
  };
  readonly energy: () => {
    readonly available: number;
    readonly required: number;
  };
  readonly resources: () => {
    readonly available: readonly EvaluationAmount[];
    readonly required: readonly EvaluationAmount[];
  };
  readonly hazard: () => {
    readonly level: number;
    readonly tolerance: number;
    readonly validateWarningThreshold: () => void;
  };
  readonly permission: () => {
    readonly available: readonly string[];
    readonly required: string | null;
  };
  readonly legal: () => {
    readonly legalOverride: boolean;
    readonly state: "Legal" | "Restricted" | "Illegal";
  };
  readonly verbIsSupported: () => boolean;
  readonly targetActionability: () => {
    readonly hasRule: boolean;
    readonly supportsVerb: boolean;
  };
  readonly targetBusy: () => boolean;
  readonly actorMode: () => {
    readonly actorMode: string;
    readonly allowedModes: readonly string[];
  };
}

const evaluateAdmission = (inputs: AdmissionInputs): InteractionDecision | null => {
  const targetIdentity = inputs.targetIdentity();
  if (targetIdentity.expectedRevision !== targetIdentity.actualRevision) {
    return blocked("TargetStale");
  }

  const actorIdentity = inputs.actorIdentity();
  if (actorIdentity.candidateActorId !== actorIdentity.contextActorId ||
      actorIdentity.candidateActorRevision !== actorIdentity.contextActorRevision) {
    return unavailable("InvalidActor");
  }
  if (inputs.actorIncapacitated()) {
    return blocked("ActorIncapacitated");
  }

  const range = inputs.range();
  if (range.distanceMeters > range.maximumDistanceMeters) {
    return blocked("OutOfRange");
  }
  if (!inputs.lineOfSight()) {
    return blocked("NoLineOfSight");
  }
  if (!inputs.reachable()) {
    return blocked("NotReachable");
  }

  const capabilities = inputs.capabilities();
  if (capabilities.available.some((capability) => !capabilities.known.includes(capability))) {
    return failEvaluationContract(
      "UnknownCapability",
      "context.capabilities",
      "must be a subset of knownCapabilities."
    );
  }
  if (capabilities.required.some((capability) => !capabilities.known.includes(capability))) {
    return unavailable("UnknownCapability");
  }
  if (capabilities.required.some((capability) => !capabilities.available.includes(capability))) {
    return blocked("MissingCapability");
  }

  const tools = inputs.tools();
  if (tools.required.some((tool) => !tools.available.includes(tool))) {
    return blocked("MissingTool");
  }

  const energy = inputs.energy();
  if (energy.available < energy.required) {
    return blocked("InsufficientEnergy");
  }

  const resources = inputs.resources();
  const availableResources = new Map(resources.available.map((entry) => [entry.resourceId, entry.amount]));
  if (resources.required.some((cost) => (availableResources.get(cost.resourceId) ?? 0) < cost.amount)) {
    return blocked("InsufficientResource");
  }

  const hazard = inputs.hazard();
  if (hazard.level > hazard.tolerance) {
    return blocked("HazardTooHigh");
  }
  hazard.validateWarningThreshold();

  const permission = inputs.permission();
  if (permission.required !== null && !permission.available.includes(permission.required)) {
    return blocked("PermissionDenied");
  }

  const legal = inputs.legal();
  if (legal.state === "Illegal" && !legal.legalOverride) {
    return blocked("IllegalWithoutOverride");
  }

  if (!inputs.verbIsSupported()) {
    return unavailable("UnsupportedVerb");
  }
  const targetActionability = inputs.targetActionability();
  if (!targetActionability.supportsVerb || !targetActionability.hasRule) {
    return unavailable("TargetNotActionable");
  }
  if (inputs.targetBusy()) {
    return blocked("TargetBusy");
  }

  const actorMode = inputs.actorMode();
  if (actorMode.allowedModes.length > 0 && !actorMode.allowedModes.includes(actorMode.actorMode)) {
    return blocked("ModeConflict");
  }
  return null;
};

const createRawAdmissionInputs = (candidateValue: unknown, contextValue: unknown): AdmissionInputs => {
  const candidate = requireEvaluationRecord(candidateValue, "candidate");
  const target = requireEvaluationRecord(candidate.target, "target");
  const rule = matchingRawRule(candidate, target);
  let context: Record<string, unknown> | undefined;
  let costs: Record<string, unknown> | null | undefined;
  const contextRecord = (): Record<string, unknown> => {
    context ??= requireEvaluationRecord(contextValue, "context");
    return context;
  };
  const ruleCosts = (): Record<string, unknown> | null => {
    if (rule === null) {
      return null;
    }
    costs ??= requireEvaluationRecord(rule.costs, "target.verbRules.costs");
    return costs;
  };

  return {
    targetIdentity: () => {
      createInteractionTargetId(target.targetId, "target.targetId");
      return {
        actualRevision: createInteractionRevision(target.revision, "target.revision"),
        expectedRevision: createInteractionRevision(candidate.expectedTargetRevision, "candidate.expectedTargetRevision")
      };
    },
    actorIdentity: () => {
      const actorContext = contextRecord();
      return {
        candidateActorId: createInteractionActorId(candidate.actorId, "candidate.actorId"),
        candidateActorRevision: createInteractionRevision(candidate.actorRevision, "candidate.actorRevision"),
        contextActorId: createInteractionActorId(actorContext.actorId, "context.actorId"),
        contextActorRevision: createInteractionRevision(actorContext.revision, "context.revision")
      };
    },
    actorIncapacitated: () => booleanValue(contextRecord().incapacitated, "context.incapacitated"),
    range: () => ({
      distanceMeters: finiteNonNegative(candidate.distanceMeters, "candidate.distanceMeters"),
      maximumDistanceMeters: finiteNonNegative(candidate.maximumDistanceMeters, "candidate.maximumDistanceMeters")
    }),
    lineOfSight: () => booleanValue(candidate.lineOfSight, "candidate.lineOfSight"),
    reachable: () => booleanValue(candidate.reachable, "candidate.reachable"),
    capabilities: () => {
      const actorContext = contextRecord();
      return {
        known: sortedUnique(actorContext.knownCapabilities, "context.knownCapabilities", createInteractionCapabilityId),
        available: sortedUnique(actorContext.capabilities, "context.capabilities", createInteractionCapabilityId),
        required: rule === null
          ? []
          : sortedUnique(
            rule.requiredCapabilities,
            "target.verbRules.requiredCapabilities",
            createInteractionCapabilityId
          )
      };
    },
    tools: () => {
      const actorContext = contextRecord();
      return {
        available: sortedUnique(actorContext.tools, "context.tools", createInteractionToolId),
        required: rule === null
          ? []
          : sortedUnique(rule.requiredTools, "target.verbRules.requiredTools", createInteractionToolId)
      };
    },
    energy: () => {
      const actorContext = contextRecord();
      const parsedCosts = ruleCosts();
      return {
        available: finiteNonNegative(actorContext.energyAvailable, "context.energyAvailable"),
        required: parsedCosts === null ? 0 : finiteNonNegative(parsedCosts.energy, "target.verbRules.costs.energy")
      };
    },
    resources: () => {
      const actorContext = contextRecord();
      const parsedCosts = ruleCosts();
      return {
        available: parseAmounts(actorContext.resources, "context.resources"),
        required: parsedCosts === null ? [] : parseAmounts(parsedCosts.resources, "target.verbRules.costs.resources")
      };
    },
    hazard: () => {
      const actorContext = contextRecord();
      const hazard = requireEvaluationRecord(target.hazard, "target.hazard");
      return {
        level: finiteNonNegative(hazard.level, "target.hazard.level"),
        tolerance: finiteNonNegative(actorContext.hazardTolerance, "context.hazardTolerance"),
        validateWarningThreshold: () => {
          finiteNonNegative(hazard.warningThreshold, "target.hazard.warningThreshold");
        }
      };
    },
    permission: () => {
      const actorContext = contextRecord();
      return {
        available: sortedUnique(actorContext.permissions, "context.permissions", stableId),
        required: rule === null || rule.requiredPermissionId === null
          ? null
          : stableId(rule.requiredPermissionId, "target.verbRules.requiredPermissionId")
      };
    },
    legal: () => {
      const actorContext = contextRecord();
      if (target.legalState !== "Legal" && target.legalState !== "Restricted" && target.legalState !== "Illegal") {
        return failEvaluationContract("InvalidEnum", "target.legalState", "must be a supported legal state.");
      }
      return {
        legalOverride: booleanValue(actorContext.legalOverride, "context.legalOverride"),
        state: target.legalState
      };
    },
    verbIsSupported: () => isInteractionVerb(candidate.verb),
    targetActionability: () => {
      const supportedVerbs = sortedUnique(target.supportedVerbs, "target.supportedVerbs", (value, path) =>
        isInteractionVerb(value)
          ? value
          : failEvaluationContract("UnknownVerb", path, "is not a V1 interaction verb."));
      return {
        hasRule: rule !== null,
        supportsVerb: isInteractionVerb(candidate.verb) && supportedVerbs.includes(candidate.verb)
      };
    },
    targetBusy: () => rule !== null && booleanValue(rule.targetBusy, "target.verbRules.targetBusy"),
    actorMode: () => {
      const actorContext = contextRecord();
      return {
        actorMode: stableId(actorContext.mode, "context.mode"),
        allowedModes: rule === null
          ? []
          : sortedUnique(rule.allowedActorModes, "target.verbRules.allowedActorModes", stableId)
      };
    }
  };
};

const ruleFor = (candidate: InteractionCandidate): InteractionVerbRule | undefined =>
  candidate.target.verbRules.find((rule) => rule.verb === candidate.verb);

const createValidatedAdmissionInputs = (
  candidate: InteractionCandidate,
  context: InteractionActorContext
): AdmissionInputs => {
  const rule = ruleFor(candidate);
  return {
    targetIdentity: () => ({
      actualRevision: candidate.target.revision,
      expectedRevision: candidate.expectedTargetRevision
    }),
    actorIdentity: () => ({
      candidateActorId: candidate.actorId,
      candidateActorRevision: candidate.actorRevision,
      contextActorId: context.actorId,
      contextActorRevision: context.revision
    }),
    actorIncapacitated: () => context.incapacitated,
    range: () => ({
      distanceMeters: candidate.distanceMeters,
      maximumDistanceMeters: candidate.maximumDistanceMeters
    }),
    lineOfSight: () => candidate.lineOfSight,
    reachable: () => candidate.reachable,
    capabilities: () => ({
      known: context.knownCapabilities,
      available: context.capabilities,
      required: rule?.requiredCapabilities ?? []
    }),
    tools: () => ({ available: context.tools, required: rule?.requiredTools ?? [] }),
    energy: () => ({ available: context.energyAvailable, required: rule?.costs.energy ?? 0 }),
    resources: () => ({ available: context.resources, required: rule?.costs.resources ?? [] }),
    hazard: () => ({
      level: candidate.target.hazard.level,
      tolerance: context.hazardTolerance,
      validateWarningThreshold: () => undefined
    }),
    permission: () => ({ available: context.permissions, required: rule?.requiredPermissionId ?? null }),
    legal: () => ({ legalOverride: context.legalOverride, state: candidate.target.legalState }),
    verbIsSupported: () => true,
    targetActionability: () => ({
      hasRule: rule !== undefined,
      supportsVerb: candidate.target.supportedVerbs.includes(candidate.verb)
    }),
    targetBusy: () => rule?.targetBusy ?? false,
    actorMode: () => ({ actorMode: context.mode, allowedModes: rule?.allowedActorModes ?? [] })
  };
};

const allowedDecision = (candidate: InteractionCandidate): InteractionDecision => {
  const rule = ruleFor(candidate);
  if (rule === undefined) {
    return failEvaluationContract(
      "InvalidContract",
      "candidate",
      "admission pipeline accepted a candidate without a matching verb rule."
    );
  }
  const warnings = candidate.target.hazard.level > candidate.target.hazard.warningThreshold
    ? (["HazardWarning"] as const)
    : ([] as const);
  return finalizeDecision({
    status: "Allowed",
    reason: null,
    unavailableReason: null,
    warnings,
    costs: rule.costs,
    requiredHoldTicks: rule.requiredHoldTicks,
    interruptPolicy: rule.interruptPolicy,
    movementToleranceClass: rule.movementToleranceClass,
    damageInterrupts: rule.damageInterrupts,
    focusLossInterrupts: rule.focusLossInterrupts
  });
};

const evaluateValidated = (
  candidate: InteractionCandidate,
  context: InteractionActorContext
): InteractionDecision => {
  const admissionDecision = evaluateAdmission(createValidatedAdmissionInputs(candidate, context));
  if (admissionDecision !== null) {
    return admissionDecision;
  }
  return allowedDecision(candidate);
};

export function evaluateInteraction(
  candidate: InteractionCandidate,
  context: InteractionActorContext
): InteractionDecision;
export function evaluateInteraction(candidate: unknown, context: unknown): InteractionDecision;
export function evaluateInteraction(candidate: unknown, context: unknown): InteractionDecision {
  try {
    const precedenceDecision = evaluateAdmission(createRawAdmissionInputs(candidate, context));
    if (precedenceDecision !== null) {
      return precedenceDecision;
    }
    const validatedCandidate = createInteractionCandidate(candidate);
    createInteractionActorContext(context);
    return allowedDecision(validatedCandidate);
  } catch (error: unknown) {
    return unavailableForInvalidInput(error);
  }
}

const statusRank = (decision: InteractionDecision): number =>
  decision.status === "Allowed" ? 0 : decision.status === "Blocked" ? 1 : 2;

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const compareSelections = (left: InteractionCandidateSelection, right: InteractionCandidateSelection): number =>
  statusRank(left.decision) - statusRank(right.decision) ||
  left.candidate.focusRank - right.candidate.focusRank ||
  left.candidate.distanceMeters - right.candidate.distanceMeters ||
  left.candidate.maximumDistanceMeters - right.candidate.maximumDistanceMeters ||
  INTERACTION_VERBS.indexOf(left.candidate.verb) - INTERACTION_VERBS.indexOf(right.candidate.verb) ||
  compareText(left.candidate.target.targetId, right.candidate.target.targetId);

export const orderInteractionCandidates = (
  candidates: readonly InteractionCandidate[],
  context: InteractionActorContext
): readonly InteractionCandidateSelection[] => {
  const validatedContext = createInteractionActorContext(context);
  const selections = candidates.map((candidate) => {
    const validatedCandidate = createInteractionCandidate(candidate);
    return {
      candidate: validatedCandidate,
      decision: evaluateValidated(validatedCandidate, validatedContext)
    };
  });
  selections.sort(compareSelections);
  return cloneAndFreezeInteractionValue(selections);
};

export const selectInteractionCandidate = (
  candidates: readonly InteractionCandidate[],
  context: InteractionActorContext
): InteractionCandidateSelection | null => orderInteractionCandidates(candidates, context)[0] ?? null;

export const selectFocusedInteractionCandidate = selectInteractionCandidate;
