# Proposal: Browser WorkerPool Replacement Atomicity V1

## Motivation

`WorkerPool.replaceWorker` currently retires the admitted worker before its replacement has reached `WorkerReady`. A replacement start failure can therefore destroy active work and queue continuity and can advance observable lifecycle counters before replacement admission.

## Outcome

Explicit worker replacement becomes a two-phase operation. The candidate starts outside the admitted pool and only replaces the old handle after readiness and a final admission check. A pre-admission failure discards only the candidate and leaves the running pool unchanged.

## Scope

- Explicit `WorkerPool.replaceWorker` internals.
- Real WorkerPool and WorkerHandle lifecycle tests.
- Shutdown handling for an in-flight replacement candidate.
- Narrow verification evidence for PR #32.

## Non-goals

No change to automatic recovery after an admitted worker fault, job retry policy, Surface Lab Scenario 5, renderer, game/runtime authority, presentation, Unity assets, packages, lockfiles, assertions, or timeouts.
