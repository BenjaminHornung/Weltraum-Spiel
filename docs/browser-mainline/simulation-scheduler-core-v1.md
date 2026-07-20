# Simulation Scheduler Core V1

## Purpose and boundary

The browser scheduler is a pure deterministic planner for background, dormant, deadline, outpost, and later offline-simulation work. It decides which execution requests are due at an explicit UniverseTime snapshot. It does not execute gameplay, advance time, enqueue events, or own runtime, renderer, scene, DOM, worker, network, or save-envelope authority.

All cross-module imports come from the public Persistence index. UniverseTime and SimulationTick, stable instance/external-reference IDs, SimulationMode transitions, canonical JSON/signatures, DomainEvent intents, strict JSON validation, cloning, and deep freeze remain Persistence-owned.

## Public API

The public entry point is `apps/weltraum-browser/src/simulation-scheduler/index.ts` and exports:

- readonly contracts for job definitions/instances, snapshots, plans, requests/results, diagnostics, receipts, commands, and decisions;
- `validateSimulationJobDefinition`, `validateSimulationJobInstance`, `validateSchedulerSnapshot`, `validateSchedulerCommand`, and `validateJobExecutionResult`;
- `planSimulationScheduler`;
- `applySchedulerCommand` and `applyJobExecutionResult`;
- eight neutral scheduler fixtures and `createSimulationSchedulerFixtureSnapshot`.

Scheduler job and definition identities are public Persistence `ExternalReferenceId` values constrained to the `simulation-job:` and `simulation-job-definition:` namespaces. Owners use Persistence `StableInstanceId`.

## Determinism, budget, and fairness

Planning reads only the validated snapshot's explicit UniverseTime. No wall clock, random source, callback, implicit global, or insertion order participates. Canonical persistence serialization produces the plan bytes and FNV-1a persistence signature; both omit themselves from the signed structure.

Priority order is `Critical`, `High`, `Normal`, `Low`. A due job is promoted by one effective class for each complete fairness window since its last planned tick or initial due tick. A continuously waiting Low job therefore reaches effective Critical after at most three windows. Equal effective priorities sort by due tick, prior planned tick with null first, and ASCII job ID.

Catch-up count is calculated arithmetically and capped at 1,024 globally plus the smaller per-definition maximum. Candidate arrays are never expanded by the raw size of a time jump. Every request consumes whole cost units, and selection stops before the explicit snapshot budget would be exceeded.

## Lifecycle and CAS

Pause, Resume, Cancel, and Wake are explicit revision-checked commands. Dormant jobs cannot run until Wake transitions them to Background with an explicit next-due tick. Cancel and Destroyed are terminal. NeedsReplan and NeedsPlayerAttention remain blocked until an external explicit transition; the scheduler performs no hidden replan or continuation.

Execution results use job-revision CAS. Accepted results advance job and scheduler revisions and store a canonical receipt keyed by job ID and expected revision. Repeating the identical result is an idempotent no-op; a different repeat for the same key is a conflict. Persistent events are returned as intents and never inserted into an event queue by this module.

A `RetryableFailure` may use `KeepCadence` or an explicit `AtTick`, but `AtTick` must be strictly later than both the result completion tick and the validated snapshot's UniverseTime tick. Invalid retry intents fail closed before scheduler/job revisions, next-due/history fields, failure counts, receipts, event intents, or modes can change.

## Verification boundary

Vitest covers validation, deterministic bytes/signatures, due and budget selection, priority/fairness, catch-up/large jumps, commands and modes, result CAS/receipts, input immutability, frozen outputs, unsafe values, unknown fields, and forbidden dependencies.

The focused Playwright proof uses normal `/` on port 5231 without TestBridge, imports only `/src/simulation-scheduler/index.ts`, runs the same scheduler case twice, compares canonical bytes/signatures, asserts browser health 0/0/0/0, and writes deterministic JSON/Markdown evidence without screenshots.

The focused spec is assigned exactly once to `test:e2e:core`. The repository's static E2E-group inventory must continue to report every discovered spec exactly once, with no unassigned, duplicate, or stale paths.

## Explicit limits

V1 includes no drone or mission implementation, objectives, economy, wall-clock offline progress, automatic UniverseTime progression, threads or Web Workers, runtime service container, SaveGameEnvelope V2, UI, networking, or multiplayer.
