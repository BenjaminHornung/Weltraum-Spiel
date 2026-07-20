# Design: Browser WorkerPool Replacement Atomicity V1

## Two-phase replacement

The current admitted handle remains in `handles` while a candidate starts. The candidate receives the next possible WorkerEpoch without committing it to the pool. Candidate callbacks are inert until the handle is admitted, so a startup fault cannot trigger normal admitted-worker fault recovery.

After `WorkerReady`, replacement revalidates that the pool is still `Running`, the same old handle still owns the slot, and the pool WorkerEpoch still equals the captured base epoch. The synchronous admission step then swaps the handle, commits the candidate epoch, increments restart count exactly once, settles any active old job through the existing explicit-replacement failure contract, terminates the old handle, emits lifecycle events, and resumes dispatch.

## Failure and concurrency

If construction, initialization, readiness, or final admission fails, only the candidate is terminated and removed from pending replacement state. The old handle, active ticket, queue, PlanningEpoch, committed WorkerEpoch, restart count, and pool lifecycle are not mutated by that failed attempt.

A competing lifecycle change invalidates admission through the captured handle/epoch checks. A candidate never becomes dispatchable before admission.

## Shutdown race

Pending candidates are tracked separately from admitted handles. `shutdown` changes lifecycle first, terminates all pending candidates so their readiness promises reject, then performs the existing deterministic queue/running-ticket settlement and admitted-handle termination. Candidate continuation cannot swap after shutdown.

## Compatibility

The public `WorkerPool` API and automatic replacement of an already faulted worker remain unchanged. Active work is never silently retried.
