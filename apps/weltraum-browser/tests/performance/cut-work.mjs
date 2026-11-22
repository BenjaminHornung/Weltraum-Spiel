// A stage is the input handler or a delivered message/task on the acknowledged command.
// Promise continuations in the same task do not add a stage.
export function cutWork(phases, commandId, planner = "indexed") {
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
  const stages = 1 + dispatches + replies + recoveryMessages + collisionResumes + copyResumes + planResumes;
  return {
    scope:"Indexed terrain cut, client/physics transport envelopes, main & native plan pump resumes",
    complete, handler:1, dispatches, replies, recoveryMessages, collisionResumes, copyResumes, planResumes,
    observedStages:stages, targetStages:3, withinStageBudget:complete && stages <= 3,
    activeElapsedMs:{
      index:sumMs("cutComponentIndexMs"), staticCollision:sumMs("cutStaticCollisionWorkMs"),
      nativePlan:plans.reduce((n,p) => n + (p.detail.data.activeMs ?? 0),0),
    },
  };
}
