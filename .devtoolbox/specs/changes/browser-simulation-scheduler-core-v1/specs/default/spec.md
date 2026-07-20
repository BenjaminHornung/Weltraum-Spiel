# Capability: Deterministic Simulation Scheduler Core V1

## Public domain contracts

The module MUST expose validated, JSON-safe, deeply frozen contracts for:

- `SimulationJobDefinition`: stable definition reference ID, kind, allowed persistence `SimulationMode` values, cadence in universe ticks, execution cost units, priority class, bounded maximum catch-up executions, deterministic payload schema/version, explicit result-contract version, and explicit dormant wake policy.
- `SimulationJobInstance`: stable job reference ID, definition ID, owner `StableInstanceId`, revision, mode, next due tick, last planned/completed ticks, failure count, pause/cancel state, immutable job facts.
- `SchedulerSnapshot`: schema version, scheduler revision, definitions/jobs, budget and deterministic fairness policy, explicit current `UniverseTime`, result receipts required for idempotence, and no implicit/global or wall-clock state.
- `SchedulerPlan`: source revision/tick, selected requests, deferred and blocked executions, next wake tick, deterministic persistence signature, canonical bytes, and diagnostics with no side effects.
- `JobExecutionRequest`: job ID, expected revision, scheduled tick, sequence, reason, cost, canonical payload, and no callbacks.
- `JobExecutionResult`: job ID, expected revision, completion tick, one of Completed/RetryableFailure/TerminalFailure/NeedsReplan/NeedsPlayerAttention/Cancelled, next-due intent, persistent event intents, and machine-readable facts.
- Explicit Pause, Resume, Cancel, and Wake commands plus CAS-protected result application decisions.

## Authorities and validation

All imports outside the scheduler module MUST come from `/src/persistence/index.ts`. The scheduler MUST reuse Persistence UniverseTime, stable IDs/references, SimulationMode and transition rules, canonical JSON/signatures, JSON cloning/validation, persistent DomainEvent contracts, and deep-freeze helpers. It MUST NOT introduce a second time, stable-ID, mode, event-queue, or save-envelope authority.

Every public ingress MUST reject unknown fields, accessors/symbols/sparse arrays, non-JSON values, NaN, Infinity, negative zero where numeric identity matters, negative values, unsafe ticks/revisions/costs, duplicate IDs, unknown definition references, invalid modes/transitions, and inconsistent state. Invalid values fail closed with deterministic machine-readable errors. Caller inputs remain unchanged. Every public returned object is deeply frozen.

## Planning behavior

Planning is invoked only with the explicit UniverseTime embedded in a validated snapshot. Production code MUST NOT reference `Date`, `performance.now`, `setTimeout`, random APIs, DOM, renderer, Three.js, runtime service containers, or gameplay implementations.

Eligible executions are due, active for their definition, not paused/cancelled/destroyed, and not in Dormant/NeedsReplan/NeedsPlayerAttention unless an explicit command has transitioned them. Dormant jobs require an `ExplicitWake` policy and a Wake command. Destroyed and cancelled jobs are permanently blocked.

Catch-up count is calculated arithmetically from cadence and tick delta, capped per definition and by budget; large jumps MUST NOT materialize unbounded candidate arrays. Total selected cost MUST never exceed the snapshot budget. Deferred/blocked records explain why work did not run.

Priority order is canonically `Critical > High > Normal > Low`. Fairness uses only universe ticks: a due job's waiting age is measured from its last planned tick or first due tick, and each full configured fairness window promotes one effective class, capped at Critical. Therefore a continuously due Low job reaches Critical after at most three fairness windows; within equal effective priority, earlier due tick, earlier prior-planned tick, then ASCII job ID are stable tie-breakers. This bound assumes planning/result application continues at explicit universe snapshots and at least one execution fits the budget.

For each eligible job, selected catch-up requests use ascending scheduled tick and sequence. Anticipated expected revisions advance per request. Identical validated inputs produce byte-identical canonical plan bytes and signatures.

## Result and command behavior

Result application uses expected job revision CAS. Accepted results increment scheduler/job revisions, update planned/completed/failure/mode/next-due state only as explicitly described by the result, and record a canonical result receipt. An identical result repeated for the same expected revision is an idempotent no-op. A different result repeated for that revision is a conflict. Other stale/future revisions are rejected without mutation.

A `RetryableFailure` MUST NOT use `nextDue: None`. When it uses `nextDue: AtTick`, that tick MUST be strictly later than both the result `completionTick` and the validated scheduler snapshot's current UniverseTime tick. An earlier or equal tick fails closed with a deterministic validation error before any snapshot, revision, job history, failure count, receipt, event intent, or mode can change. `KeepCadence` continues to use the existing cadence authority.

`NeedsReplan` and `NeedsPlayerAttention` transition only to their matching persistence modes; they do not execute a replan or continue automatically. `TerminalFailure` and destroyed state prevent later execution. Persistent events remain output intents and are never enqueued by the scheduler.

Pause, Resume, Cancel, and Wake are explicit commands with job-revision CAS. Cancel is terminal. Resume does not bypass NeedsReplan/NeedsPlayerAttention/Destroyed. Wake is the only scheduler command that may transition Dormant to Background, and it requires an explicit next-due tick.

## Required neutral fixtures

Export deterministic fixtures for mining background, cargo transfer, drone survey, repair, mission deadline check, NeedsPlayerAttention, destroyed, and dormant outpost jobs. They are scheduler-only data and contain no gameplay implementation.

## Verification and browser evidence

Unit tests MUST cover validation, byte/signature determinism, due selection, budget, stable ordering, priority/fairness bound, catch-up and huge jumps, pause/resume/cancel/wake, destroyed terminal behavior, NeedsReplan/NeedsPlayerAttention, CAS, idempotence/conflicting repeats, immutability/frozen outputs, unknown fields, nonfinite/unsafe ticks, and forbidden runtime/browser dependencies.

The focused Playwright proof MUST use its own config on port 5231, one worker, no retries, load normal `/`, prove `window.TestBridge` absent, dynamically import only `/src/simulation-scheduler/index.ts`, run the same case twice, compare canonical bytes and signature, and assert browser health 0 page errors / 0 console errors / 0 failed requests / 0 unhandled rejections. It writes JSON and Markdown evidence without screenshots. The final focused E2E is run twice and evidence hashes must match.
