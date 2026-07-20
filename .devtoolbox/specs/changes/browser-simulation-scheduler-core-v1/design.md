# Design: Deterministic Simulation Scheduler Core V1

## Boundary

The scheduler is a pure data planner. It consumes a validated snapshot and returns plans or updated snapshots. It never advances UniverseTime, invokes jobs, mutates event queues, imports runtime/renderer/DOM modules, or owns callbacks.

## File structure

- `types.ts`: public branded aliases and readonly contract unions/interfaces.
- `validation.ts`: fail-closed parsers built from public persistence validators.
- `planner.ts`: bounded due-count arithmetic, fairness ranking, budget selection, canonical plan bytes/signature.
- `state.ts`: explicit commands and CAS/idempotent result application.
- `fixtures.ts`: eight neutral deterministic fixture definitions/instances/snapshot helpers.
- `index.ts`: the only public scheduler export surface.

Tests remain in the exact `simulationScheduler*.test.ts` allowlist. Browser proof imports only `index.ts`.

## Persistence reuse

Scheduler/job IDs are constrained `ExternalReferenceId` values with `simulation-job:` and `simulation-job-definition:` namespaces, parsed by the public persistence external-reference parser. Owners remain public `StableInstanceId`. Ticks are `SimulationTick`/UniverseTime. Modes and transitions are persistence-owned. Canonical clone/serialization/signature and deep-freeze are persistence-owned. Event intents use validated `DomainEvent`.

## Deterministic planning

1. Validate and snapshot all input.
2. Compute due counts with safe integer arithmetic and cap before allocation.
3. Exclude terminal/blocked modes with explicit diagnostics.
4. Compute effective priority by deterministic universe-tick aging.
5. Sort candidates by effective class, next due tick, last planned tick (null first), ASCII job ID.
6. Select whole execution requests while total cost fits; per-job scheduled ticks are ascending and catch-up is capped.
7. Derive deferred/blocked records and the minimum next wake tick.
8. Canonicalize the unsigned plan, create its persistence signature, then deep-freeze the final plan. Canonical bytes omit their own bytes/signature fields to avoid recursion.

Budget selection never partially charges an execution. If no eligible execution fits, the plan remains empty and records budget deferrals.

## Fairness proof

Priority ranks are Critical=0, High=1, Normal=2, Low=3. Effective rank is `max(0, baseRank - floor(waitAge/fairnessWindowTicks))`. A continuously due Low job therefore reaches effective Critical after three windows. Recently planned higher-priority recurring jobs have their waiting origin reset by accepted results; equal effective rank uses stable age/due/job-ID ordering. No wall clock, randomness, or hidden counter is involved.

## Result receipts

The snapshot stores canonical receipts keyed by job ID and expected revision. Reapplying the same result signature returns an idempotent decision and the unchanged snapshot. A different signature for the same key returns Conflict. Receipts make the rule independent of how far the job revision has advanced.

## Retry backoff invariant

Retry intent validation that depends only on envelope shape remains in `validation.ts`. Snapshot-relative `AtTick` validation belongs in `applyJobExecutionResult`, after the scheduler snapshot and result have been validated but before revisions, job fields, receipts, or event intents are constructed. The accepted tick must be greater than both `completionTick` and `snapshot.universeTime.tick`; the existing Persistence UniverseTime remains the only time authority.

## Verification and rollback

Verification runs under Node 22.23.1 via an explicit Node-22 executable. Focused tests run during implementation; final gates are TypeScript, focused Vitest, full Vitest, build, focused Playwright twice, byte/hash comparison, diff/scope/secret/package audits, independent review, and completion preflight. Rollback is one feature commit; no mainline integration occurs in this task.
