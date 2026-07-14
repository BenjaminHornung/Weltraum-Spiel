# Worker, Streaming, and Telemetry Spine V1

## Purpose

This change adds a browser-native infrastructure core for deterministic background jobs, reconstructable content residency, and machine-readable runtime telemetry. It is deliberately neutral to planets, meshing, terrain, rendering, simulation, and gameplay authority.

## Worker protocol

Jobs use validated printable-ASCII identities and non-negative safe-integer epochs, revisions, deadlines, and byte estimates. Requests are defensively snapshotted before entering the queue. Planning epochs identify caller plan generations; worker epochs identify concrete Worker instances and advance on replacement.

The control plane carries only small lifecycle and job metadata. Large inputs and outputs use separate `ArrayBuffer` bundles, frozen typed-view descriptors, explicit ownership declarations, and `postMessage` transfer lists. Shared buffers are rejected. The neutral V1 proof job performs a deterministic chunked byte transform and yields between chunks so running cancellation can be observed.

## Queue policy

There are exactly three priority classes: Urgent, High, and Normal. Each class sorts by logical deadline, stable target key, and stable job ID. Ordering never reads a clock, insertion sequence, object identity, worker completion timing, or implicit retry position.

After four successful Urgent dispatches, a waiting High job is forced, or a Normal job when High is empty. After eight successful non-Normal dispatches, a waiting Normal job is forced. Empty lower lanes never cause idling. Rejected, cancelled, and pre-dispatch removals do not count as dispatches.

## Cancellation and lifecycle

Queued cancellation removes the job immediately and resolves it as `CancelledBeforeStart`. Running cancellation signals the Worker, which checks between chunks and resolves `CancelledDuringExecution` without publishing partial or late output. Every accepted ticket resolves exactly once to Completed, Cancelled, or Failed.

Worker errors, message errors, protocol violations, wrong epochs, and unknown results explicitly settle affected work. Replacement terminates the old instance, advances the worker epoch, and creates a fresh instance. Active jobs are not silently retried. Shutdown prevents admission and settles all outstanding tickets.

## Result gate

Before integration, results are checked in a fixed order: known job, cancellation state, planning epoch, worker epoch, target key, input/output revisions, algorithm version, buffer layout, output byte budget, and optional content hash. A rejected result never reaches cache or consumers.

## Streaming and cache

Content identity includes namespace, content ID, input revision, algorithm version, and output revision. `AsyncContentLoader` checks cache first and deduplicates exact in-flight requests while retaining independent subscriber cancellation. Provider failures and stale or malformed results remain explicit failures.

`MemoryContentCache` is disposable and reconstructable. It enforces an exact byte budget with deterministic LRU eviction, independent pin and lease counts, idempotent release, and same-key/hash consistency. Leased or pinned entries are not eviction candidates. A lease exposes the backing buffer without a per-hit copy under a contractually readonly API. Cache eviction or clearing never changes world truth.

Residency states are generic (`NotRequested`, `Queued`, `Loading`, `Ready`, `Failed`, `Evicted`, `Cancelled`) and follow a closed transition graph. Residency is not visibility and is not simulation authority.

## Telemetry

The versioned snapshot records worker, queue, job, transfer-byte, cache, loader, and queue-depth counters plus latency summaries. Updates are constant-time for the fixed schema. Reset clears cumulative counters and timing observations while preserving current gauges.

Browser timestamps, heap estimates, long-task counts, and latency observations are diagnostic only. Canonical telemetry excludes all of them, so observation cannot change queue decisions or repeat signatures. Observer callbacks are isolated so exceptions cannot affect domain behavior.

## Verification boundary

Vitest covers protocol validation, deterministic ordering and fairness, cancellation, lifecycle faults/replacement, stale-result decisions, loader/cache behavior, residency, telemetry, canonical determinism, prohibited dependencies, and caller immutability. Playwright uses normal `/` without `TestBridge`, dynamically imports the three public indexes, starts a real module Worker, proves transfer detachment at 256 KiB, 1 MiB, and 4 MiB, and repeats the semantic scenario before writing JSON and Markdown evidence.

## Explicit limits

V1 includes no planet tile scheduler, voxel mesher, terrain generation, GPU upload, Three.js worker dependency, Comlink, SharedArrayBuffer, WASM, IndexedDB, Service Worker, networking, persistent cache, savegame, or UI.
