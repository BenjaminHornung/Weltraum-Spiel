# Browser Worker Streaming Telemetry Spine V1 Specification

## Worker job contract

### Requirement: immutable validated jobs

The system SHALL accept only stable ASCII identities, finite diagnostics, non-negative safe-integer epochs/revisions/deadlines/byte estimates, and schema-valid payloads. It SHALL snapshot and deep-freeze caller input before enqueue.

#### Scenario: caller mutation

Given a caller mutates a request or payload after submission, the queued and dispatched snapshot remains unchanged.

### Requirement: deterministic bounded queue

The system SHALL implement exactly Urgent, High, and Normal lanes; within each lane it SHALL sort by logical deadline, target key, and job ID. Capacity and duplicate rejection SHALL fail closed. Four Urgent dispatches SHALL force High (or Normal if no High), and eight non-Normal dispatches SHALL force Normal when waiting. Only successful dispatches count.

#### Scenario: input permutation

Given the same jobs inserted in any order and identical dispatch/cancel operations, the queue produces identical dispatches and canonical snapshots.

## Worker messaging and transfer

### Requirement: separate planes

Control messages SHALL contain only small metadata. Large inputs/results SHALL be separate ArrayBuffer bundles sent with explicit transfer lists, ownership, view descriptors, revisions, layouts, and optional byte hashes. SharedArrayBuffer SHALL be rejected.

#### Scenario: transferable input

When a valid buffer is submitted to a real module Worker, the sender buffer becomes detached and the deterministic transformed result returns with the declared layout and revision.

### Requirement: cooperative cancellation

Queued cancellation SHALL settle `CancelledBeforeStart`. Running cancellation SHALL be observed at chunk yield points, settle `CancelledDuringExecution`, and publish no partial or late result.

## Worker lifecycle

### Requirement: terminal settlement and replacement

Every accepted ticket SHALL settle exactly once as Completed, Cancelled, or Failed. Worker faults SHALL explicitly settle affected tickets, terminate the instance, advance WorkerEpoch, and start a replacement unless shutdown is active. Active jobs SHALL NOT retry silently.

#### Scenario: late old-worker response

Given a Worker was replaced, a response bearing the previous WorkerEpoch is rejected and cannot settle or integrate a current job.

### Requirement: shutdown

Shutdown SHALL reject new jobs, settle queued and running tickets deterministically, stop/terminate Workers, and leave no pending ticket promises.

## Result integration

### Requirement: fixed stale-result gate

Before publication the gate SHALL validate known job, cancellation, planning epoch, worker epoch, target, input/output revision, algorithm version, layout, byte budget, and optional hash in that order. A rejection SHALL never update cache or consumer state.

## Streaming loader and cache

### Requirement: generic async loading

The loader SHALL check cache first, deduplicate exact concurrent requests, support subscriber cancellation, preserve revisions, reject stale/malformed provider results, and propagate failures without fabricating empty content.

### Requirement: reconstructable cache

The cache SHALL use a fully revisioned canonical key, exact byte budget, deterministic LRU eviction, independent pin/lease counts, idempotent release, immutable snapshots, and same-key/hash consistency. Pinned or leased entries SHALL not be evicted. Clearing or eviction SHALL not change world truth.

### Requirement: residency validation

Residency SHALL use only NotRequested, Queued, Loading, Ready, Failed, Evicted, and Cancelled with the explicit transition graph in design.md. It SHALL not represent visibility or authority.

## Telemetry

### Requirement: versioned machine-readable snapshots

Snapshots SHALL expose workerCount, activeWorkers, workerRestarts, queuedJobs, runningJobs, completedJobs, failedJobs, cancelledJobs, staleResultsRejected, inputBytesTransferred, outputBytesTransferred, queueLatencyMs, executionLatencyMs, integrationLatencyMs, cacheEntries, cacheBytes, cacheHits, cacheMisses, cacheEvictions, pinnedEntries, loaderRequests, loaderDeduplications, and largestObservedQueueDepth. Optional browser observations SHALL remain diagnostic.

### Requirement: canonical isolation

Canonical snapshots SHALL be deterministic and exclude performance timestamps, heap estimates, long-task counts, and timing observations. Reset SHALL clear cumulative counters/timing while preserving current gauges and advancing a reset epoch.

## Browser proof

The E2E SHALL load normal `/`, prove TestBridge absent, dynamically import the three public indexes, use a real module Worker and 256 KiB/1 MiB/4 MiB transferable payloads, prove detachment and deterministic results, cancel queued/running jobs, reject a stale PlanningEpoch result, replace a Worker with a higher epoch, exercise cache miss/hit/pin/release/eviction, validate telemetry, repeat the semantic scenario, compare canonical output, reject console/page/request/HTTP errors, and write JSON/Markdown evidence without hardware-dependent latency gates.

## Non-goals

This specification grants no planet, voxel, terrain, GPU, gameplay, visibility, persistence, network, service worker, savegame, UI, SharedArrayBuffer, WASM, Comlink, or Three.js behavior.
