import { describe, expect, it } from "vitest";
import {
  advanceInteractionSession,
  cancelInteractionSession,
  canonicalInteractionJson,
  completeInteractionSession,
  createInteractionActorContext,
  createInteractionCandidate,
  createInteractionTargetSnapshot,
  evaluateInteraction,
  interactionHash,
  startInteractionSession,
  type AllowedInteractionDecision,
  type InteractionActorContextInput,
  type InteractionCandidateInput,
  type InteractionCompletionRequest,
  type InteractionResultCode,
  type InteractionSession,
  type InteractionSessionAdvanceRequest,
  type InteractionTargetSnapshotInput,
  type InteractionTick,
  type InteractionVerbRuleInput
} from "../../src/interaction";

const ruleInput = (overrides: Partial<InteractionVerbRuleInput> = {}): InteractionVerbRuleInput => ({
  verb: "Open",
  requiredCapabilities: ["cap.access"],
  requiredTools: ["tool.multitool"],
  costs: {
    energy: 3,
    resources: [
      { resourceId: "resource.zinc", amount: 2 },
      { resourceId: "resource.parts", amount: 1 }
    ]
  },
  requiredPermissionId: "permission.open",
  requiredHoldTicks: 3,
  interruptPolicy: "Interruptible",
  movementToleranceClass: "Stationary",
  damageInterrupts: true,
  focusLossInterrupts: true,
  allowedActorModes: ["mode.surface"],
  targetBusy: false,
  ...overrides
});

const targetInput = (
  ruleOverrides: Partial<InteractionVerbRuleInput> = {},
  overrides: Partial<InteractionTargetSnapshotInput> = {}
): InteractionTargetSnapshotInput => ({
  targetId: "target.cargo-door",
  revision: 4,
  ownerId: "owner.station",
  claimId: "claim.station",
  legalState: "Legal",
  hazard: { level: 1, warningThreshold: 2 },
  supportedVerbs: ["Open"],
  verbRules: [ruleInput(ruleOverrides)],
  ...overrides
});

const actorInput = (overrides: Partial<InteractionActorContextInput> = {}): InteractionActorContextInput => ({
  actorId: "actor.player",
  revision: 7,
  knownCapabilities: ["cap.access"],
  capabilities: ["cap.access"],
  tools: ["tool.multitool"],
  energyAvailable: 10,
  resources: [
    { resourceId: "resource.zinc", amount: 5 },
    { resourceId: "resource.parts", amount: 4 }
  ],
  permissions: ["permission.open"],
  legalOverride: false,
  hazardTolerance: 5,
  incapacitated: false,
  mode: "mode.surface",
  ...overrides
});

const candidateInput = (
  target: InteractionTargetSnapshotInput = targetInput(),
  overrides: Partial<InteractionCandidateInput> = {}
): InteractionCandidateInput => ({
  actorId: "actor.player",
  actorRevision: 7,
  target,
  expectedTargetRevision: 4,
  verb: "Open",
  distanceMeters: 1,
  maximumDistanceMeters: 2,
  lineOfSight: true,
  reachable: true,
  focusRank: 0,
  ...overrides
});

const start = (
  ruleOverrides: Partial<InteractionVerbRuleInput> = {},
  actorOverrides: Partial<InteractionActorContextInput> = {}
) => {
  const candidate = createInteractionCandidate(candidateInput(targetInput(ruleOverrides)));
  const context = createInteractionActorContext(actorInput(actorOverrides));
  const decision = evaluateInteraction(candidate, context) as AllowedInteractionDecision;
  const started = startInteractionSession({
    sessionId: "session.cargo-door.open",
    candidate,
    context,
    decision
  });
  expect(started.status).toBe("Started");
  expect(started.session).not.toBeNull();
  return {
    candidate,
    context,
    decision,
    started,
    session: started.session as InteractionSession
  };
};

const completionRequest = (
  session: InteractionSession,
  overrides: Partial<InteractionCompletionRequest> = {}
): InteractionCompletionRequest => ({
  sessionId: session.sessionId,
  actorId: session.actorId,
  actorRevision: session.actorRevision,
  targetId: session.targetId,
  targetRevision: session.targetRevision,
  completionTick: session.currentTick,
  ...overrides
});

const advance = (
  session: InteractionSession,
  tick: number,
  overrides: Partial<Parameters<typeof advanceInteractionSession>[1]> = {}
) => advanceInteractionSession(session, {
  tick: tick as InteractionTick,
  movementClass: "Stationary",
  damageOccurred: false,
  focusMaintained: true,
  modeConflict: false,
  ...overrides
});

describe("integer-tick interaction sessions and atomic completion", () => {
  it("starts at tick zero and explicitly completes a zero-hold interaction", () => {
    const { session } = start({ requiredHoldTicks: 0 });
    expect(session).toMatchObject({ startTick: 0, currentTick: 0, progressTicks: 0, requiredHoldTicks: 0 });
    const result = completeInteractionSession(session, completionRequest(session));
    expect(result).toMatchObject({
      status: "Completed",
      resultCode: "InteractionCompleted",
      nextAction: "AwaitExternalApplication"
    });
    expect(result.mutation?.expectedActorRevision).toBe(7);
    expect(result.mutation?.expectedTargetRevision).toBe(4);
  });

  it("advances by explicit monotonic integer ticks, caps progress, and rejects invalid ticks without state change", () => {
    const { session } = start();
    const atOne = advance(session, 1);
    const atThree = advance(atOne.session as InteractionSession, 3);
    const atEight = advance(atThree.session as InteractionSession, 8);
    expect([atOne.progress?.progressTicks, atThree.progress?.progressTicks, atEight.progress?.progressTicks])
      .toEqual([1, 3, 3]);
    expect(atEight.progress?.readyToComplete).toBe(true);

    for (const invalidTick of [8, 2, 8.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const before = canonicalInteractionJson(atEight.session);
      const rejected = advance(atEight.session as InteractionSession, invalidTick);
      expect(rejected).toMatchObject({
        status: "Rejected",
        result: { status: "Rejected", mutation: null, resultCode: "InvalidTick" }
      });
      expect(canonicalInteractionJson(rejected.session)).toBe(before);
    }
  });

  it.each([
    ["movement", { movementClass: "Limited" }, "MovementToleranceExceeded"],
    ["damage", { damageOccurred: true }, "DamageInterrupted"],
    ["focus loss", { focusMaintained: false }, "FocusLossInterrupted"],
    ["mode conflict", { modeConflict: true }, "ModeConflictInterrupted"]
  ] as const)("interrupts for enabled %s policy", (
    _name: string,
    signal: Partial<InteractionSessionAdvanceRequest>,
    resultCode: InteractionResultCode
  ) => {
    const { session } = start();
    const interrupted = advance(session, 1, signal);
    expect(interrupted).toMatchObject({
      status: "Interrupted",
      session: { status: "Interrupted", progressTicks: 0 },
      result: { status: "Interrupted", mutation: null, resultCode }
    });
    expect(completeInteractionSession(
      interrupted.session as InteractionSession,
      completionRequest(interrupted.session as InteractionSession)
    )).toMatchObject({ status: "Interrupted", mutation: null, resultCode });
  });

  it("honors committed, damage, and focus non-interruption policy", () => {
    const committed = start({ interruptPolicy: "Committed" }).session;
    const committedAdvance = advance(committed, 1, {
      movementClass: "Mobile",
      damageOccurred: true,
      focusMaintained: false,
      modeConflict: true
    });
    expect(committedAdvance).toMatchObject({ status: "Advanced", session: { progressTicks: 1, status: "Active" } });

    const tolerant = start({
      movementToleranceClass: "Mobile",
      damageInterrupts: false,
      focusLossInterrupts: false
    }).session;
    const tolerantAdvance = advance(tolerant, 1, {
      movementClass: "Mobile",
      damageOccurred: true,
      focusMaintained: false
    });
    expect(tolerantAdvance).toMatchObject({ status: "Advanced", session: { progressTicks: 1, status: "Active" } });
  });

  it("rejects completion before the required hold without mutation", () => {
    const { session } = start();
    const atTwo = advance(session, 2).session as InteractionSession;
    expect(completeInteractionSession(atTwo, completionRequest(atTwo))).toEqual({
      status: "Rejected",
      sessionId: session.sessionId,
      mutation: null,
      resultCode: "HoldIncomplete",
      nextAction: "ContinueHold"
    });
  });

  it("fails closed for stale actor and target revisions independently", () => {
    const { session } = start({ requiredHoldTicks: 0 });
    expect(completeInteractionSession(session, completionRequest(session, {
      actorRevision: 8 as InteractionCompletionRequest["actorRevision"]
    }))).toMatchObject({ status: "Rejected", mutation: null, resultCode: "ActorRevisionStale" });
    expect(completeInteractionSession(session, completionRequest(session, {
      targetRevision: 5 as InteractionCompletionRequest["targetRevision"]
    }))).toMatchObject({ status: "Rejected", mutation: null, resultCode: "TargetRevisionStale" });
  });

  it("cancels explicitly at the current tick and keeps all no-op outcomes mutation-free", () => {
    const { session, candidate } = start();
    const cancelled = cancelInteractionSession(session, { cancellationTick: session.currentTick });
    expect(cancelled).toMatchObject({
      status: "Cancelled",
      session: { status: "Cancelled" },
      result: { status: "Cancelled", mutation: null, resultCode: "SessionCancelled" }
    });
    const cancelledCompletion = completeInteractionSession(
      cancelled.session as InteractionSession,
      completionRequest(cancelled.session as InteractionSession)
    );
    expect(cancelledCompletion).toMatchObject({ status: "Cancelled", mutation: null });

    const blockedContext = createInteractionActorContext(actorInput({ energyAvailable: 0 }));
    const blockedDecision = evaluateInteraction(candidate, blockedContext);
    const blockedStart = startInteractionSession({
      sessionId: "session.blocked",
      candidate,
      context: blockedContext,
      decision: blockedDecision
    });
    expect(blockedStart).toMatchObject({
      status: "Rejected",
      session: null,
      progress: null,
      result: { mutation: null, resultCode: "DecisionNotAllowed" }
    });
    for (const value of [cancelled.result, cancelledCompletion, blockedStart.result]) {
      const bytes = canonicalInteractionJson(value);
      expect(bytes).not.toContain("consumedCosts");
      expect(bytes).not.toContain("events");
      expect(bytes).not.toContain("generatedCapabilities");
      expect(bytes).not.toContain("discoveryFacts");
    }
  });

  it("gives an Unavailable decision no start or completion mutation authority", () => {
    const candidate = createInteractionCandidate(candidateInput(targetInput({
      requiredCapabilities: ["cap.future"]
    })));
    const context = createInteractionActorContext(actorInput());
    const decision = evaluateInteraction(candidate, context);
    expect(decision).toMatchObject({ status: "Unavailable", unavailableReason: "UnknownCapability" });

    const rejected = startInteractionSession({
      sessionId: "session.unavailable",
      candidate,
      context,
      decision
    });
    expect(rejected).toMatchObject({
      status: "Rejected",
      session: null,
      progress: null,
      result: { status: "Rejected", mutation: null, resultCode: "DecisionNotAllowed" }
    });
    expect(rejected.session).toBeNull();
    const completion = rejected.session === null
      ? null
      : completeInteractionSession(rejected.session, completionRequest(rejected.session));
    expect(completion).toBeNull();
    expect("costs" in decision).toBe(false);
    const bytes = canonicalInteractionJson(rejected);
    expect(bytes).not.toContain('"costs"');
    expect(bytes).not.toContain("consumedCosts");
    expect(bytes).not.toContain("events");
    expect(bytes).not.toContain("generatedCapabilities");
    expect(bytes).not.toContain("discoveryFacts");
  });

  it("emits one canonical frozen atomic intent with sorted finite costs and a deterministic semantic event", () => {
    const { session } = start({ requiredHoldTicks: 1 });
    const ready = advance(session, 1).session as InteractionSession;
    const result = completeInteractionSession(ready, completionRequest(ready));
    expect(result.mutation).toEqual({
      expectedActorRevision: 7,
      expectedTargetRevision: 4,
      consumedCosts: {
        energy: 3,
        resources: [
          { resourceId: "resource.parts", amount: 1 },
          { resourceId: "resource.zinc", amount: 2 }
        ]
      },
      generatedCapabilities: [],
      discoveryFacts: [],
      events: [{
        eventId: "interaction.session.cargo-door.open.completed.1",
        sessionId: "session.cargo-door.open",
        phase: "Completed",
        tick: 1,
        actorId: "actor.player",
        targetId: "target.cargo-door",
        verb: "Open",
        resultCode: "InteractionCompleted"
      }],
      resultCode: "InteractionCompleted",
      nextAction: "AwaitExternalApplication"
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.mutation)).toBe(true);
    expect(Object.isFrozen(result.mutation?.consumedCosts.resources)).toBe(true);
    expect(Object.isFrozen(result.mutation?.events[0])).toBe(true);
  });

  it("does not mutate inputs and deeply freezes every produced transition", () => {
    const target = createInteractionTargetSnapshot(targetInput());
    const candidate = createInteractionCandidate(candidateInput(target));
    const context = createInteractionActorContext(actorInput());
    const decision = evaluateInteraction(candidate, context);
    const request = { sessionId: "session.immutable", candidate, context, decision };
    const before = canonicalInteractionJson(request);
    const started = startInteractionSession(request);
    expect(canonicalInteractionJson(request)).toBe(before);
    expect(Object.isFrozen(started)).toBe(true);
    expect(Object.isFrozen(started.session)).toBe(true);
    expect(Object.isFrozen(started.progress)).toBe(true);

    const advanceRequest = {
      tick: 1 as InteractionTick,
      movementClass: "Stationary" as const,
      damageOccurred: false,
      focusMaintained: true,
      modeConflict: false
    };
    const advanceBefore = canonicalInteractionJson({ session: started.session, advanceRequest });
    const advanced = advanceInteractionSession(started.session as InteractionSession, advanceRequest);
    expect(canonicalInteractionJson({ session: started.session, advanceRequest })).toBe(advanceBefore);
    expect(Object.isFrozen(advanced)).toBe(true);
    expect(Object.isFrozen(advanced.session)).toBe(true);
    expect(Object.isFrozen(advanced.progress)).toBe(true);
  });

  it("replays to byte-identical transitions, results, and hashes", () => {
    const first = start({ requiredHoldTicks: 2 });
    const second = start({ requiredHoldTicks: 2 });
    const firstReady = advance(first.session, 2).session as InteractionSession;
    const secondReady = advance(second.session, 2).session as InteractionSession;
    const firstResult = completeInteractionSession(firstReady, completionRequest(firstReady));
    const secondResult = completeInteractionSession(secondReady, completionRequest(secondReady));
    expect(canonicalInteractionJson(first.started)).toBe(canonicalInteractionJson(second.started));
    expect(canonicalInteractionJson(firstResult)).toBe(canonicalInteractionJson(secondResult));
    expect(interactionHash(firstResult)).toBe(interactionHash(secondResult));
  });
});
