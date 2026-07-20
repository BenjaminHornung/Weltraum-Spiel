# Proposal: Browser Worker Streaming Pinned Telemetry Fix V1

## Change
`browser-worker-streaming-pinned-telemetry-fix-v1`

## Problem
PR #32 Codex P2 discussion `r3598839302` identified that cache pin transitions are not
observable as a truthful `pinnedEntries` gauge. The cache observer currently has no
distinct-entry `Pinned`/`Unpinned` contract, while the projection falls back to a
manual cache-state write. That permits duplicate, non-final, repeated, or stale
release paths to be represented incorrectly.

## Goal
Make the smallest compatible correction: extend the exported
`MemoryContentCacheObserver` with frozen `Pinned` and `Unpinned` events carrying
`canonicalKey`; emit them only for distinct-entry `0 -> 1` and `1 -> 0` pin-count
transitions after the mutation; and have `streamingProjection` maintain the
existing `pinnedEntries` gauge from those events in O(1).

The normal browser worker-streaming telemetry spine must use the exported observer
and prove `0 -> 1 -> 0` without a manual `setCacheState` call. Existing JSON/Markdown
evidence is regenerated only; no screenshot is required.

## In scope

- `src/streaming/memoryContentCache.ts`: public observer event union and transition
  emission.
- `src/diagnostics/performance/streamingProjection.ts`: truthful pinned-entry
  projection.
- `tests/unit/streamingMemoryCache.test.ts` and new
  `tests/unit/streamingProjection.test.ts`.
- Existing `tests/unit/voxelWorkerProtocol.test.ts` regression coverage.
- Existing `tests/e2e/worker-streaming-telemetry-spine.spec.ts` and its existing JSON
  and Markdown evidence files.
- Runtime documentation at `docs/browser-mainline/worker-streaming-telemetry-spine-v1.md`.

## Non-goals

No leases, admission-failure or `BUDGET_EXHAUSTED` telemetry, snapshot optimization,
Hestia, `WorkerPool`, `resultGate`, rendering, UI, package files, lockfiles, runtime
configuration, CI configuration, screenshots, test-data mutation, or unrelated
refactoring.
