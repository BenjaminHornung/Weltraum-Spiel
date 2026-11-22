// A stage is the input handler or a delivered message/task on the acknowledged command.
// Promise continuations in the same task do not add a stage.
export function cutWork(phases, commandId, planner = "indexed", placement = "worker") {
  const own = phases.filter(p => p.detail?.data?.commandId === commandId);
  const named = name => own.filter(p => p.name === "hvp." + name);
  const count = name => named(name).reduce((n, p) => n + p.detail.data.count, 0);
  const sumMs = name => named(name).reduce((n, p) => n + p.duration, 0);
  const dispatches = count("cutPhysicsDispatch");
  const replies = count("cutPhysicsReply");
  const recoveryMessages = count("cutRecoverySideband");
  const collisionResumes = count("cutCollisionTaskResume");
  const copyResumes = count("cutInputCopyTaskResume");
  const plans = named("cutPhysicsPlanTaskResumes");
  const planResumes = count("cutPhysicsPlanTaskResumes");
  const complete = planner === "indexed" && dispatches > 0 && dispatches === replies
    && plans.length === 1 && named("cutStaticCollisionWorkMs").length > 0
    && [dispatches,replies,recoveryMessages,collisionResumes,copyResumes,planResumes].every(Number.isSafeInteger);
  // The placement probe delivers DTOs inline in the same JS task, preserving their copy/validation cost.
  const crossThreadDeliveries = placement === "worker" ? dispatches + replies + recoveryMessages : 0;
  const stages = 1 + crossThreadDeliveries + collisionResumes + copyResumes + planResumes;
  const activationDispatches = count("cutActivationDispatch");
  const activationReplies = count("cutActivationReply");
  return {
    scope:"Indexed terrain cut, client/physics transport envelopes, main & native plan pump resumes",
    complete, placement, handler:1, crossThreadDeliveries, dispatches, replies, recoveryMessages, collisionResumes, copyResumes, planResumes,
    recoveryMailbox:{writes:count("cutRecoveryMailboxWrite"),timedWrites:named("cutRecoveryMailboxWrite").filter(p=>Number.isFinite(p.detail.data.activeMs)).length,bodies:count("cutRecoveryMotionBodies"),
      captureAndCloneMs:named("cutRecoveryMailboxWrite").reduce((n,p)=>n+(p.detail.data.activeMs??0),0)},
    activationDispatches, activationReplies,
    observedStagesThroughRelease:activationDispatches === 1 ? stages + (placement === "worker" ? 1 : 0) : null,
    observedStages:stages, targetStages:3, withinStageBudget:complete && stages <= 3,
    activeElapsedMs:{
      index:sumMs("cutComponentIndexMs"), staticCollision:sumMs("cutStaticCollisionWorkMs"),
      nativePlan:plans.reduce((n,p) => n + (p.detail.data.activeMs ?? 0),0),
    },
  };
}

// A query can already see the new generation while the solver still waits for its release message.
export function cutGameplayTiming(state) {
  const activation = state.compactActivation;
  const input = state.documentTimeOrigin + state.eventTimeStamp;
  const ack = state.metrics?.["hvp.cutDomInputToPhysicsPublishedMs"];
  if (!ack || !Number.isFinite(ack.duration) || !Number.isFinite(input) || !activation
      || activation.commandId !== state.result?.commandId || !Number.isSafeInteger(activation.releaseRequestId)
      || !Number.isFinite(activation.publishedEpochMs) || !Number.isFinite(activation.releasedEpochMs)
      || activation.publishedEpochMs < input || activation.releasedEpochMs < activation.publishedEpochMs) return null;
  const inputToReleaseMs = activation.releasedEpochMs - input;
  const inputToFirstStepMs = Number.isFinite(activation.firstStepEpochMs) && activation.firstStepEpochMs >= activation.releasedEpochMs
    ? activation.firstStepEpochMs - input : null;
  return {inputToReleaseMs, inputToFirstStepMs, inputToGameplayReadyMs:Math.max(ack.duration,inputToReleaseMs)};
}

// Compute percentiles from the pooled raw samples in the series runner.
// A completed browser process alone says nothing about its frame or solver budget.
export function cutSeriesChecks(attempts, frames, steps) {
  const complete = attempts.length > 0 && attempts.every(row => row.exit === 0);
  const everyCutUnderLimit = complete && attempts.every(row =>
    Number.isFinite(row.physicsMs) && row.physicsMs >= 0 && row.physicsMs <= 10);
  const everySolverReleasedUnderLimit = complete && attempts.every(row =>
    Number.isFinite(row.gameplay?.inputToGameplayReadyMs) && row.gameplay.inputToGameplayReadyMs <= 10);
  const everyCutWithinStageBudget = complete && attempts.every(row => row.criticalPath?.withinStageBudget === true);
  const solverWithinBudget = Number.isFinite(steps.p95) && steps.n > 0 && steps.p95 <= 4;
  const framesWithinBudget = frames.n > 0 && Number.isFinite(frames.p95) && Number.isFinite(frames.p99)
    && frames.p95 <= 20 && frames.p99 <= 33.34;
  return {complete, everyCutUnderLimit, everySolverReleasedUnderLimit, everyCutWithinStageBudget, solverWithinBudget, framesWithinBudget,
    passed: everyCutUnderLimit && everySolverReleasedUnderLimit && everyCutWithinStageBudget && solverWithinBudget && framesWithinBudget};
}
