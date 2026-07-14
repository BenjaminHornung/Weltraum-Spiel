# Design: Browser Worker Streaming Telemetry Spine V1

## Deterministic contracts

### Worker lifecycle

`WorkerPool` owns a fixed number of `WorkerHandle` slots. `start` creates one module Worker per slot and assigns a globally monotonic safe-integer `WorkerEpoch` to each instance. A slot moves through `Starting`, `Ready`, `Busy`, `Stopping`, and `Stopped`. Worker `error`, `messageerror`, unexpected exit, invalid protocol, wrong epoch, and unknown result are faults. Fault handling has a fixed order: mark the handle failed, reject/invalidate inbound messages, settle all affected tickets as `Failed`, terminate the instance, advance the epoch, create a replacement unless shutdown has started, then resume dispatch. Active work is never silently retried; retries are new explicit jobs.

### Job identity and immutable snapshots

`WorkerJobId`, `jobKind`, and `targetKey` are non-empty bounded stable ASCII identifiers. `PlanningEpoch`, `WorkerEpoch`, input/output revisions, algorithm version numbers, deadlines, and byte counts are non-negative safe integers. Caller requests are schema-validated, defensively cloned, and deeply frozen before enqueue. Duplicate job IDs are rejected for the pool session, including after a terminal outcome.

### Planning and worker epochs

`PlanningEpoch` identifies the caller's current plan generation. Raising it invalidates older results but does not derive gameplay authority. `WorkerEpoch` identifies one concrete Worker instance and is bound at dispatch. Replacement always receives a larger epoch. Messages from prior epochs are rejected and cannot settle or integrate current work.

### Input and output revisions

The request carries `inputRevision`; results retain it and add an expected `outputRevision`. Revisions are exact safe integers and are checked before content integration. No failure is repaired as an empty result.

### Priority and deadline

Priority has exactly `Urgent`, `High`, and `Normal`. Deadline is an explicit logical safe-integer tick; it is not read from a clock. Within a class jobs sort by deadline, then ordinal ASCII target key, then ordinal ASCII job ID. No insertion order, object identity, wall clock, performance clock, completion timing, or hidden retry position participates.

The queue counts only successful dispatches. After four consecutive Urgent dispatches it forces one waiting High, or one Normal if High is empty. After eight consecutive non-Normal dispatches it forces one waiting Normal. It never idles merely because the forced lower lane is empty. The relevant burst counter resets after the forced lower dispatch. Cancellation, rejection, and removal before dispatch do not increment counters.

### Cancellation

Queued cancellation removes the job immediately and settles it as `CancelledBeforeStart`. Running cancellation sends `CancelJob`; the neutral transform processes chunks, yields to the browser task queue, and checks a cancellation token between chunks. A confirmed cancellation settles as `CancelledDuringExecution`, publishes no result, and ignores later output. Cancel is idempotent and every ticket resolves exactly once to a `Completed | Cancelled | Failed` terminal union. Only synchronous API misuse throws.

## Control plane and data plane

The control plane contains small metadata messages only: `InitializeWorker`, `EnqueueJob`, `CancelJob`, `ReleaseResult`, `ReadStatus`, and `ShutdownWorker`, with `WorkerReady`, `JobAccepted`, `JobCancelled`, `JobCompleted`, `JobFailed`, `WorkerStatus`, and `WorkerStopped` responses.

Large payloads use separate `JobInputData`/`JobOutputData` bundles of `ArrayBuffer` plus frozen `TypedArrayViewDescriptor` metadata and explicit `TransferOwnership`. Buffers are always listed in `postMessage` transfer lists. Shared buffers are rejected. Descriptors validate supported element type, alignment, byte offset, element count, overflow, exact byte range, and declared total length before work begins. Input/output revisions survive transfer. Output bundles may contain multiple buffers and name their layout and content hash. Ownership moves caller to pool to Worker, then Worker to pool/consumer; a sender must not reuse a detached buffer.

The V1 proof job is `TransformBuffer`: bytewise XOR with an explicit byte mask, processed in chunks with task yields. It is neutral, deterministic, and is not a mesher. Content hashes use byte-oriented FNV-1a over the declared output layout.

## Result integration gate

`WorkerResultExpectation` is registered before dispatch. The fixed validation order is:

1. known job;
2. not cancelled;
3. planning epoch;
4. worker epoch;
5. target key;
6. input revision;
7. output revision;
8. algorithm version;
9. buffer layout;
10. output byte budget;
11. content hash when declared.

The decision union includes `Accepted`, `RejectedUnknownJob`, `RejectedCancelled`, `RejectedStalePlanningEpoch`, `RejectedStaleWorkerEpoch`, `RejectedTargetMismatch`, `RejectedRevisionMismatch`, `RejectedAlgorithmMismatch`, `RejectedInvalidLayout`, `RejectedOverBudget`, and `RejectedContentHashMismatch`. Rejected output is never published or cached.

## Queue policy

`StableWorkerJobQueue` owns three sorted lanes and a configurable total capacity. Full queues fail closed. Duplicate IDs fail closed. Snapshots sort by the same domain comparator and expose capacity, lane depths, burst counters, and immutable job metadata. Diagnostics never alter dispatch decisions.

## Streaming and cache

### Cache identity

`ContentKey` contains stable namespace, content ID, input revision, algorithm version, and output revision. Its canonical string is the cache identity. The loader deduplicates only exact canonical requests.

### Async loader

`AsyncContentLoader` checks the cache first, otherwise invokes a generic `ContentProvider`. Exact concurrent requests share one provider operation while each subscriber retains independent cancellation. A cancelled subscriber receives `Cancelled`; remaining subscribers continue. The provider result must match key and revisions and pass layout/hash validation before publication. Cache hits do not invoke the provider.

### Byte budget, pinning, leases, and eviction

`MemoryContentCache` is reconstructable and contains no dirty or authoritative state. It enforces an exact byte budget with deterministic least-recently-used eviction. Recency is a cache-local monotonic access sequence; equal sequence values break by canonical key. Admission evicts unpinned entries with zero leases until the budget fits, otherwise rejects. Entries expose contractually readonly leases; lease `release` is idempotent. Pin and lease counts are independent. Pinned or leased entries are not evicted. Releasing/unpinning permits later eviction. Same key with a different hash is rejected. `clear` drops all entries and invalidates outstanding handles without changing world truth.

### Residency

Residency values are `NotRequested`, `Queued`, `Loading`, `Ready`, `Failed`, `Evicted`, and `Cancelled`. Allowed transitions are explicit: `NotRequested -> Queued`; `Queued -> Loading|Cancelled|Failed`; `Loading -> Ready|Cancelled|Failed`; `Ready -> Evicted|Queued`; `Failed -> Queued`; `Evicted -> Queued`; `Cancelled -> Queued`. Same-state and all other transitions fail closed. Residency is neither visibility nor simulation/gameplay authority.

## Telemetry

`PerformanceTelemetrySnapshot` is versioned and contains all required job, worker, transfer, cache, loader, queue-depth, and latency fields. Counters update in O(1), remain finite non-negative safe values, and saturate at `Number.MAX_SAFE_INTEGER`. Byte counters count host/Worker transfer boundaries once per transferred byte. Reset increments a reset epoch, clears cumulative counters and timing samples, and preserves current gauges such as live worker, queue, running, cache, and pin state.

`performanceNowTimestamp`, heap estimate, long-task count, and latency observations are diagnostics only. Canonical snapshots exclude browser timestamps, heap/long-task observations, and latency samples so they cannot change queue choices or semantic signatures. Observer overhead is constant per event plus snapshot serialization and does not scan payload bytes except when a required content hash is computed by the protocol.

## Error ordering

Validation reports the first error in documented field/gate order. Worker fault settlement is ordered by stable job ID. Shutdown first prevents new work, cancels queued tickets in queue order, fails/cancels running tickets in stable job order, requests Worker stop, force-terminates at the safety boundary, then resolves shutdown. No promise remains open.

## Non-goals

No planet scheduling/generation, voxel meshing, terrain, rendering/GPU upload, visibility policy, simulation authority, Three.js, Comlink, SharedArrayBuffer, WASM, IndexedDB, Service Worker, networking, persistence, savegame, or UI.
