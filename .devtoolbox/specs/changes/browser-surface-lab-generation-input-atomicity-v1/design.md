# Design: Surface Lab Generation Input Atomicity V1

## Boundary
The controller owns candidate input admission. `regenerate(seed)` and `setResolution(voxelSizeMeters)` validate into local candidates and pure candidate/request staging. They must not assign candidate seed/resolution or mutate any generation-visible state until the running/disposal preflight succeeds and `WorkerPool.setPlanningEpoch(candidatePlan)` succeeds; that successful call is the generation admission point. Admission does not alter WorkerPool or public contracts.

## Atomicity
For any rejected/non-admitted start—including invalid or stopped/disposed state, a candidate preparation exception, or a thrown/rejected `WorkerPool.setPlanningEpoch(candidatePlan)`—return or reject without changing: seed, resolution, planning/generation/worker epochs, lifecycle or failure counters, settled promise, tickets, published artifacts/removals, Presentation revision mapping, hashes, geometry/timing/cache metrics, or cache contents/metadata. The prior generation remains authoritative and visible.

After successful `setPlanningEpoch` admission, commit the candidate input once, create the normal generation epoch/tickets, and attempt individual chunk enqueues. Those enqueue attempts retain the existing tested per-chunk partial-failure semantics: a failed enqueue or rejected ticket promise is a post-admission failed chunk, does not roll back the admitted generation, and is handled without swallowing the error or creating an unhandled rejection. All existing clear-first, stale, cancellation, partial/failure, artifact, hash, metric, cache, and Presentation mapping semantics remain in force. No rollback or alternate lifecycle is invented.

## Errors
Synchronous exceptions from validation, candidate preparation, running/disposal preflight, or `setPlanningEpoch` are pre-admission and are not converted into chunk failures or swallowed. Asynchronous start/replacement failures before admission reject their public promise; rejection handlers must not create an unhandled rejection or mutate disposed state. After admission, individual enqueue failures and rejected ticket promises follow the existing failed-chunk/public-promise contract. A genuine admitted-generation terminal failure retains the existing lifecycle failure accounting rather than being mistaken for a pre-admission rejection.
