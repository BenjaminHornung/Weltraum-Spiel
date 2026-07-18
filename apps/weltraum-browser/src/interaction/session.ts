import { canonicalInteractionJson, cloneAndFreezeInteractionValue } from "./canonical";
import {
  type InteractionCandidate,
  type InteractionInterruptionReason,
  type InteractionMovementToleranceClass,
  type InteractionProgress,
  type InteractionResult,
  type InteractionResultCode,
  type InteractionSession,
  type InteractionSessionAdvanceRequest,
  type InteractionSessionCancelRequest,
  type InteractionSessionStartRequest,
  type InteractionSessionTransition,
  type InteractionTick
} from "./contracts";
import { evaluateInteraction } from "./evaluation";
import {
  INTERACTION_STABLE_ID_PATTERN,
  createInteractionActorContext,
  createInteractionCandidate,
  createInteractionTick,
  isInteractionRecord
} from "./validation";

const MOVEMENT_CLASS_RANK: Readonly<Record<InteractionMovementToleranceClass, number>> = Object.freeze({
  Stationary: 0,
  Limited: 1,
  Mobile: 2
});

const frozenNoOpResult = (
  sessionId: string,
  status: InteractionResult["status"],
  resultCode: InteractionResultCode,
  nextAction: InteractionResult["nextAction"]
): InteractionResult => cloneAndFreezeInteractionValue({
  status,
  sessionId,
  mutation: null,
  resultCode,
  nextAction
});

const progressFor = (session: InteractionSession): InteractionProgress => cloneAndFreezeInteractionValue({
  sessionId: session.sessionId,
  tick: session.currentTick,
  progressTicks: session.progressTicks,
  requiredHoldTicks: session.requiredHoldTicks,
  readyToComplete: session.status === "Active" && session.progressTicks >= session.requiredHoldTicks
});

const transition = (
  status: InteractionSessionTransition["status"],
  session: InteractionSession | null,
  result: InteractionResult | null
): InteractionSessionTransition => cloneAndFreezeInteractionValue({
  status,
  session,
  progress: session === null ? null : progressFor(session),
  result
});

const validSessionId = (value: unknown): value is string =>
  typeof value === "string" && INTERACTION_STABLE_ID_PATTERN.test(value);

const decisionMatches = (candidate: InteractionCandidate, context: unknown, decision: unknown): boolean => {
  if (!isInteractionRecord(decision)) {
    return false;
  }
  const evaluated = evaluateInteraction(candidate, context);
  try {
    return evaluated.status === "Allowed" && canonicalInteractionJson(evaluated) === canonicalInteractionJson(decision);
  } catch {
    return false;
  }
};

export const startInteractionSession = (request: InteractionSessionStartRequest): InteractionSessionTransition => {
  const sessionId = isInteractionRecord(request) && validSessionId(request.sessionId)
    ? request.sessionId
    : "invalid-session";
  if (!isInteractionRecord(request) || !validSessionId(request.sessionId)) {
    return transition("Rejected", null, frozenNoOpResult(sessionId, "Rejected", "DecisionNotAllowed", "RetryEvaluation"));
  }

  try {
    const candidate = createInteractionCandidate(request.candidate);
    const context = createInteractionActorContext(request.context);
    if (!decisionMatches(candidate, context, request.decision) || request.decision.status !== "Allowed") {
      return transition(
        "Rejected",
        null,
        frozenNoOpResult(request.sessionId, "Rejected", "DecisionNotAllowed", "RetryEvaluation")
      );
    }

    const zero = createInteractionTick(0);
    const session: InteractionSession = cloneAndFreezeInteractionValue({
      sessionId: request.sessionId,
      actorId: candidate.actorId,
      actorRevision: candidate.actorRevision,
      targetId: candidate.target.targetId,
      targetRevision: candidate.target.revision,
      verb: candidate.verb,
      decisionHash: request.decision.decisionHash,
      startTick: zero,
      currentTick: zero,
      progressTicks: zero,
      requiredHoldTicks: request.decision.requiredHoldTicks,
      costs: request.decision.costs,
      interruptPolicy: request.decision.interruptPolicy,
      movementToleranceClass: request.decision.movementToleranceClass,
      damageInterrupts: request.decision.damageInterrupts,
      focusLossInterrupts: request.decision.focusLossInterrupts,
      status: "Active",
      interruptionReason: null
    });
    return transition("Started", session, null);
  } catch {
    return transition(
      "Rejected",
      null,
      frozenNoOpResult(request.sessionId, "Rejected", "DecisionNotAllowed", "RetryEvaluation")
    );
  }
};

const interruptionFor = (
  session: InteractionSession,
  request: InteractionSessionAdvanceRequest
): InteractionInterruptionReason | null => {
  if (session.interruptPolicy === "Committed") {
    return null;
  }
  if (MOVEMENT_CLASS_RANK[request.movementClass] > MOVEMENT_CLASS_RANK[session.movementToleranceClass]) {
    return "MovementToleranceExceeded";
  }
  if (request.damageOccurred && session.damageInterrupts) {
    return "Damage";
  }
  if (!request.focusMaintained && session.focusLossInterrupts) {
    return "FocusLoss";
  }
  return request.modeConflict ? "ModeConflict" : null;
};

const interruptionCode = (reason: InteractionInterruptionReason): InteractionResultCode => {
  switch (reason) {
    case "MovementToleranceExceeded": return "MovementToleranceExceeded";
    case "Damage": return "DamageInterrupted";
    case "FocusLoss": return "FocusLossInterrupted";
    case "ModeConflict": return "ModeConflictInterrupted";
  }
};

const isMovementClass = (value: unknown): value is InteractionMovementToleranceClass =>
  value === "Stationary" || value === "Limited" || value === "Mobile";

const isAdvanceRequest = (value: unknown): value is InteractionSessionAdvanceRequest =>
  isInteractionRecord(value) &&
  isMovementClass(value.movementClass) &&
  typeof value.damageOccurred === "boolean" &&
  typeof value.focusMaintained === "boolean" &&
  typeof value.modeConflict === "boolean";

export const advanceInteractionSession = (
  session: InteractionSession,
  request: InteractionSessionAdvanceRequest
): InteractionSessionTransition => {
  if (session.status !== "Active") {
    const status = session.status === "Cancelled" ? "Cancelled" : "Interrupted";
    const code = session.status === "Cancelled"
      ? "SessionCancelled"
      : interruptionCode(session.interruptionReason ?? "ModeConflict");
    return transition(status, session, frozenNoOpResult(session.sessionId, status, code, "RetryEvaluation"));
  }

  let tick: InteractionTick;
  try {
    tick = createInteractionTick(isInteractionRecord(request) ? request.tick : undefined, "advance.tick");
  } catch {
    return transition(
      "Rejected",
      session,
      frozenNoOpResult(session.sessionId, "Rejected", "InvalidTick", "ContinueHold")
    );
  }
  if (!isAdvanceRequest(request) || tick <= session.currentTick) {
    return transition(
      "Rejected",
      session,
      frozenNoOpResult(session.sessionId, "Rejected", "InvalidTick", "ContinueHold")
    );
  }

  const interruptionReason = interruptionFor(session, request);
  if (interruptionReason !== null) {
    const interruptedSession: InteractionSession = cloneAndFreezeInteractionValue({
      ...session,
      currentTick: tick,
      status: "Interrupted",
      interruptionReason
    });
    return transition(
      "Interrupted",
      interruptedSession,
      frozenNoOpResult(session.sessionId, "Interrupted", interruptionCode(interruptionReason), "RetryEvaluation")
    );
  }

  const elapsedTicks = tick - session.startTick;
  const progressedSession: InteractionSession = cloneAndFreezeInteractionValue({
    ...session,
    currentTick: tick,
    progressTicks: createInteractionTick(Math.min(elapsedTicks, session.requiredHoldTicks), "progressTicks")
  });
  return transition("Advanced", progressedSession, null);
};

export const cancelInteractionSession = (
  session: InteractionSession,
  request: InteractionSessionCancelRequest
): InteractionSessionTransition => {
  let cancellationTick: InteractionTick;
  try {
    cancellationTick = createInteractionTick(
      isInteractionRecord(request) ? request.cancellationTick : undefined,
      "cancel.cancellationTick"
    );
  } catch {
    return transition(
      "Rejected",
      session,
      frozenNoOpResult(session.sessionId, "Rejected", "InvalidTick", "ContinueHold")
    );
  }
  if (session.status !== "Active" || cancellationTick !== session.currentTick) {
    return transition(
      "Rejected",
      session,
      frozenNoOpResult(session.sessionId, "Rejected", "InvalidTick", "ContinueHold")
    );
  }
  const cancelledSession: InteractionSession = cloneAndFreezeInteractionValue({
    ...session,
    status: "Cancelled",
    interruptionReason: null
  });
  return transition(
    "Cancelled",
    cancelledSession,
    frozenNoOpResult(session.sessionId, "Cancelled", "SessionCancelled", "RetryEvaluation")
  );
};
