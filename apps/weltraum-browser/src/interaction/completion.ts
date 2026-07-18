import { cloneAndFreezeInteractionValue } from "./canonical";
import {
  type InteractionCompletionRequest,
  type InteractionEvent,
  type InteractionMutationIntent,
  type InteractionResult,
  type InteractionResultCode,
  type InteractionSession,
  type InteractionTick
} from "./contracts";
import { createInteractionActorId, createInteractionRevision, createInteractionTargetId, createInteractionTick, isInteractionRecord } from "./validation";

const noOp = (
  session: InteractionSession,
  status: InteractionResult["status"],
  resultCode: InteractionResultCode,
  nextAction: InteractionResult["nextAction"]
): InteractionResult => cloneAndFreezeInteractionValue({
  status,
  sessionId: session.sessionId,
  mutation: null,
  resultCode,
  nextAction
});

const terminalNoOp = (session: InteractionSession): InteractionResult => {
  if (session.status === "Cancelled") {
    return noOp(session, "Cancelled", "SessionCancelled", "RetryEvaluation");
  }
  switch (session.interruptionReason) {
    case "MovementToleranceExceeded":
      return noOp(session, "Interrupted", "MovementToleranceExceeded", "RetryEvaluation");
    case "Damage":
      return noOp(session, "Interrupted", "DamageInterrupted", "RetryEvaluation");
    case "FocusLoss":
      return noOp(session, "Interrupted", "FocusLossInterrupted", "RetryEvaluation");
    case "ModeConflict":
    default:
      return noOp(session, "Interrupted", "ModeConflictInterrupted", "RetryEvaluation");
  }
};

interface ValidCompletionRequest {
  readonly sessionId: string;
  readonly actorId: InteractionCompletionRequest["actorId"];
  readonly actorRevision: InteractionCompletionRequest["actorRevision"];
  readonly targetId: InteractionCompletionRequest["targetId"];
  readonly targetRevision: InteractionCompletionRequest["targetRevision"];
  readonly completionTick: InteractionTick;
}

const validateRequest = (request: InteractionCompletionRequest): ValidCompletionRequest | null => {
  if (!isInteractionRecord(request) || typeof request.sessionId !== "string") {
    return null;
  }
  try {
    return {
      sessionId: request.sessionId,
      actorId: createInteractionActorId(request.actorId, "completion.actorId"),
      actorRevision: createInteractionRevision(request.actorRevision, "completion.actorRevision"),
      targetId: createInteractionTargetId(request.targetId, "completion.targetId"),
      targetRevision: createInteractionRevision(request.targetRevision, "completion.targetRevision"),
      completionTick: createInteractionTick(request.completionTick, "completion.completionTick")
    };
  } catch {
    return null;
  }
};

export const completeInteractionSession = (
  session: InteractionSession,
  request: InteractionCompletionRequest
): InteractionResult => {
  if (session.status !== "Active") {
    return terminalNoOp(session);
  }

  const validated = validateRequest(request);
  if (validated === null || validated.sessionId !== session.sessionId) {
    return noOp(session, "Rejected", "InvalidTick", "RetryEvaluation");
  }
  if (validated.actorId !== session.actorId) {
    return noOp(session, "Rejected", "ActorIdentityMismatch", "RetryEvaluation");
  }
  if (validated.actorRevision !== session.actorRevision) {
    return noOp(session, "Rejected", "ActorRevisionStale", "RetryEvaluation");
  }
  if (validated.targetId !== session.targetId) {
    return noOp(session, "Rejected", "TargetIdentityMismatch", "RetryEvaluation");
  }
  if (validated.targetRevision !== session.targetRevision) {
    return noOp(session, "Rejected", "TargetRevisionStale", "RetryEvaluation");
  }
  if (validated.completionTick !== session.currentTick) {
    return noOp(session, "Rejected", "InvalidTick", "ContinueHold");
  }
  if (session.progressTicks < session.requiredHoldTicks) {
    return noOp(session, "Rejected", "HoldIncomplete", "ContinueHold");
  }

  const resultCode: InteractionResultCode = "InteractionCompleted";
  const event: InteractionEvent = cloneAndFreezeInteractionValue({
    eventId: `interaction.${session.sessionId}.completed.${validated.completionTick}`,
    sessionId: session.sessionId,
    phase: "Completed",
    tick: validated.completionTick,
    actorId: session.actorId,
    targetId: session.targetId,
    verb: session.verb,
    resultCode
  });
  const mutation: InteractionMutationIntent = cloneAndFreezeInteractionValue({
    expectedActorRevision: session.actorRevision,
    expectedTargetRevision: session.targetRevision,
    consumedCosts: session.costs,
    generatedCapabilities: [],
    discoveryFacts: [],
    events: [event],
    resultCode,
    nextAction: "AwaitExternalApplication"
  });
  return cloneAndFreezeInteractionValue({
    status: "Completed",
    sessionId: session.sessionId,
    mutation,
    resultCode,
    nextAction: "AwaitExternalApplication"
  });
};
