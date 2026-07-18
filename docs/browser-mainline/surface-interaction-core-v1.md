# Browser Surface Interaction Core v1

## Scope

`apps/weltraum-browser/src/interaction/index.ts` exports a pure, renderer-independent interaction foundation for surface and interior targets. It validates explicit actor, target, candidate, decision, session, progress, completion, result, mutation-intent, and event data. It does not raycast, select scene objects, read renderer state, update inventory or world state, animate targets, or expose player UI.

The closed V1 verb set is `Inspect`, `Scan`, `Extract`, `Repair`, `Open`, `Close`, `Activate`, `Deactivate`, `Pickup`, `Place`, and `Transfer`. Decisions are exactly `Allowed`, `Blocked`, or `Unavailable`.

## Public Contracts And Functions

- Stable branded identities and counters: `InteractionActorId`, `InteractionTargetId`, `InteractionCapabilityId`, `InteractionToolId`, `InteractionRevision`, and `InteractionTick`.
- Admission data: `InteractionTargetSnapshot`, `InteractionVerbRule`, `InteractionActorContext`, `InteractionCandidate`, `InteractionDecision`, `InteractionBlockReason`, and `InteractionCandidateSelection`.
- Progress and completion data: `InteractionSession`, `InteractionProgress`, `InteractionCompletionRequest`, `InteractionSessionTransition`, `InteractionResult`, `InteractionMutationIntent`, and `InteractionEvent`.
- Closed constants: `INTERACTION_VERBS`, `INTERACTION_DECISION_STATUSES`, `INTERACTION_BLOCK_REASONS`, and `INTERACTION_UNAVAILABLE_REASONS`.
- Validated constructors: `createInteractionActorId`, `createInteractionTargetId`, `createInteractionCapabilityId`, `createInteractionToolId`, `createInteractionRevision`, `createInteractionTick`, `createInteractionActorContext`, `createInteractionTargetSnapshot`, and `createInteractionCandidate`.
- Evaluation and focus: `evaluateInteraction`, `orderInteractionCandidates`, `selectInteractionCandidate`, and `selectFocusedInteractionCandidate`.
- Session lifecycle: `startInteractionSession`, `advanceInteractionSession`, `cancelInteractionSession`, and `completeInteractionSession`.
- Canonical support: `canonicalizeInteractionValue`, `canonicalInteractionJson`, `cloneAndFreezeInteractionValue`, and `interactionHash`.

Constructors clone, validate, canonicalize, and deeply freeze public values. Invalid identities, revisions, ticks, enum values, duplicate unordered values, and non-finite or negative costs fail closed. Unknown verbs cannot become actionable, and required capabilities must belong to the actor adapter's explicit `knownCapabilities` vocabulary.

## Deterministic Admission And Focus

`evaluateInteraction(candidate, context)` applies one fixed precedence:

1. target identity and exact expected revision;
2. actor identity, revision, supported action, known-capability vocabulary, and incapacity;
3. range, line of sight, and reachability;
4. required capability and required tool;
5. energy and resource sufficiency;
6. hazard tolerance, permission, and legality;
7. target-busy and actor-mode rules.

The closed blocked reasons are `OutOfRange`, `NoLineOfSight`, `NotReachable`, `MissingCapability`, `MissingTool`, `InsufficientEnergy`, `InsufficientResource`, `HazardTooHigh`, `PermissionDenied`, `IllegalWithoutOverride`, `TargetBusy`, `TargetStale`, `ActorIncapacitated`, and `ModeConflict`. Earlier checks win when several conditions fail. Permission remains independent from legal override: override never invents a missing permission. A hazard above its warning threshold but at or below actor tolerance produces `HazardWarning`; a hazard above tolerance blocks.

Candidate ordering is `Allowed` before `Blocked` before `Unavailable`, then explicit focus rank, distance, maximum distance, verb order, and finally lexical stable target ID. Input order does not decide focus and is not mutated.

## Hold And Completion Semantics

Sessions start at integer tick `0` and lock actor ID/revision, target ID/revision, verb, decision hash, costs, hold requirement, and interruption policy. A zero-tick hold is eligible immediately, but completion still requires an explicit request. `advanceInteractionSession` accepts only strictly increasing non-negative safe-integer ticks. Progress is visible, monotonic, and capped at `requiredHoldTicks`; reaching the cap does not apply a mutation.

For `Interruptible` sessions, movement beyond the locked tolerance, enabled damage interruption, enabled focus-loss interruption, or mode conflict ends progress with a typed no-op result. `Committed` sessions ignore those advance signals. Cancellation is explicit at the current tick. Completion before the hold is ready returns `HoldIncomplete` with no mutation.

`completeInteractionSession` requires the exact session, actor identity/revision, target identity/revision, and current completion tick. A stale actor or target fails closed before any intent is emitted. Successful completion returns one immutable atomic intent containing expected revisions, canonical costs, generated capability/discovery arrays, semantic events, result code, and next action. The core does not apply that intent.

## Integration And Mutation Ownership

World, physics, runtime, and UI adapters remain outside this module. They own target discovery, distance, line of sight, reachability, focus rank, actor mode, energy/resources, permissions, legal state, hazard values, and authoritative revisions. They must create a new snapshot and re-evaluate whenever that authority changes.

External state owners alone may atomically validate and apply a successful `InteractionMutationIntent`. Resource stores, Cargo, target state, discovery/capability persistence, and semantic-event publication are not implemented by this core. Rejected, blocked, unavailable, cancelled, interrupted, early, and stale outcomes carry no mutation intent. Renderer objects, DOM state, animation, raycasts, wall clocks, randomness, hidden registries, and presentation state are never authority.

This is a domain foundation only. There is no normal-runtime target adapter, interaction UI, Cargo/resource transfer implementation, repair implementation, door animation, persistence handoff, Surface Lab, voxel, worker, Combat, or Ship Builder integration in this slice.

## Browser Proof And Evidence

`apps/weltraum-browser/tests/e2e/surface-interaction-core.spec.ts` opens normal `/` with an empty query, proves `window.TestBridge` is absent before and after the scenario, and dynamically imports `/src/interaction/index.ts` in page context. Its deterministic fixture validates a scanner-and-cutter actor, a permission-locked Cargo door, a resource node, and a repair terminal. It proves allowed `Scan`, `Extract` blocked by `InsufficientEnergy`, allowed terminal `Repair`, integer hold-to-`Open` progress from tick `0` through tick `3`, and `TargetRevisionStale` completion with no mutation.

The scenario runs twice and compares canonical bytes and the interaction proof hash. It writes only:

- `apps/weltraum-browser/evidence/browser-surface-interaction-core-v1.json`
- `apps/weltraum-browser/evidence/browser-surface-interaction-core-v1.md`

Both artifacts contain deterministic fixture, status, result-code, decision-hash, progress, and proof-hash facts. They contain no wall-clock fields or image artifact because the module makes no visible UI or render change. The focused spec intentionally remains outside the configured E2E CI groups.

## Verification

Run from `apps/weltraum-browser`:

```text
npm run test -- tests/unit/interaction*.test.ts --maxWorkers=1
npx tsc -p tsconfig.json
npx playwright test --config <temporary-5201-config> tests/e2e/surface-interaction-core.spec.ts
```

The repository Playwright configuration fixes both its web server and `baseURL` to port `5173` and exposes no environment override. A test runner verifying the required port `5201` must supply a temporary external Playwright configuration that sets `testDir` to this app's `tests/e2e`, sets `use.baseURL` to `http://127.0.0.1:5201`, and starts or reuses Vite at that same URL. No repository configuration or CI-group edit is part of this change.

From `apps/weltraum-browser`, the complete PowerShell verification command is:

```powershell
$root = (Resolve-Path ".").Path
$rootForConfig = $root.Replace("\", "/")
$temporaryConfig = Join-Path $env:TEMP "weltraum-surface-interaction-5201.config.ts"
@"
export default {
  testDir: "$rootForConfig/tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5201",
    launchOptions: process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5201 --strictPort",
    cwd: "$rootForConfig",
    url: "http://127.0.0.1:5201",
    reuseExistingServer: true,
    timeout: 120000
  }
};
"@ | Set-Content -LiteralPath $temporaryConfig -Encoding utf8
try {
  npx playwright test --config $temporaryConfig surface-interaction-core.spec.ts
} finally {
  Remove-Item -LiteralPath $temporaryConfig -ErrorAction SilentlyContinue
}
```

The external file is removed in `finally`; no app or repository configuration is changed.
