# Capability: Atomic Explicit Worker Replacement

## Requirement: candidate readiness precedes admission

When `WorkerPool.replaceWorker(slot)` is called on a running pool, the replacement candidate SHALL be fully started and reach `WorkerReady` before the admitted slot handle, committed WorkerEpoch, restart count, queue, or ticket state is changed.

### Scenario: successful replacement

Given an admitted worker and a pending replacement candidate, the old worker remains admitted until the candidate is ready. Once ready and still admissible, the pool swaps exactly once, advances WorkerEpoch and restart count exactly once, terminates the old worker, preserves the no-silent-retry rule for active work, and resumes queued dispatch.

## Requirement: pre-admission failure is inert

If candidate construction, initialization, or readiness fails before admission, `replaceWorker` SHALL reject and discard only the candidate. The old worker, its active job, the queue, PlanningEpoch, committed WorkerEpoch, restart count, and `Running` lifecycle SHALL remain unchanged.

### Scenario: candidate start failure

Given a busy old worker and queued work, when the candidate emits a startup fault, the before/after WorkerPool snapshot is identical and the old transport remains live.

## Requirement: shutdown prevents late admission

If shutdown begins while a candidate is starting, shutdown SHALL terminate the candidate and admitted workers, settle queued and running tickets under the existing shutdown contract, and leave the pool `Stopped`. The candidate SHALL NOT commit its epoch, increment restart count, emit a replacement, or re-enter the pool afterward.

## Compatibility constraints

Automatic recovery after an admitted worker fault retains its existing fail-closed behavior. Surface Lab async rejection and disposal Scenario 5 remain unchanged. Tests SHALL exercise the real `WorkerPool` and `WorkerHandle` lifecycle rather than relying only on a fake pool.
