# Design: Browser Worker Streaming Pinned Telemetry Fix V1

## Change
`browser-worker-streaming-pinned-telemetry-fix-v1`

## Contract boundary

`MemoryContentCache` remains the owner of pin-count truth. Its exported
`MemoryContentCacheObserver` event union retains `Hit`, `Miss`, `Admitted`,
`Evicted`, and `Cleared`, and adds these frozen events:

```ts
{ readonly kind: "Pinned"; readonly canonicalKey: ContentKeyCanonical }
{ readonly kind: "Unpinned"; readonly canonicalKey: ContentKeyCanonical }
```

The event is emitted after the corresponding count mutation and only when the
distinct entry changes state:

| Mutation | Event |
| --- | --- |
| existing entry `pinCount: 0 -> 1` | one `Pinned` |
| existing entry `pinCount: 1 -> 2+` | none |
| valid release `pinCount: 2+ -> 1+` | none |
| valid final release `pinCount: 1 -> 0` | one `Unpinned` |
| duplicate/repeated release | none |
| stale release after clear/eviction or invalid handle | none |
| `clear()` | one existing `Cleared` reset only; never per-entry `Unpinned` |

All observer payloads remain frozen. Observer exceptions remain isolated and must
not change cache mutation, release idempotence, eviction, or clear behavior.

## Projection

`createMemoryContentCacheTelemetryObserver` keeps its existing O(1) event-driven
`entries` and `bytes` projection and adds an O(1) `pinnedEntries` counter. `Admitted`
and `Evicted` update entry/byte state, `Pinned` increments the gauge, `Unpinned`
decrements it, and `Cleared` resets all three values to zero. It does not call
`snapshot()`, scan entries, inspect payload bytes, or infer pin state from leases.

The existing `PerformanceTelemetry.setCacheState` API is not redesigned. The real
browser spine instead wires the exported cache observer into the projection and
proves the pin gauge through cache mutations, without a manual `setCacheState`
call in that scenario.

## Compatibility scenarios

- A cache constructed without an observer behaves exactly as before.
- Existing cache events retain their kind and fields; cache hits/misses and
  admission/eviction/clear semantics are unchanged.
- A key pinned more than once produces one `Pinned`; releasing only some handles
  produces no `Unpinned`; releasing the final valid handle produces one.
- Handles invalidated by `clear()` remain safely releasable and emit nothing.
- An observer that throws cannot affect cache decisions or the caller operation.
- Consumers of the exported observer must handle the additive event kinds; the
  production projection and all in-scope tests do so explicitly.

## Risks and controls

- Incorrect emission before mutation could expose a transient gauge; tests require
  post-mutation `0 -> 1` and `1 -> 0` semantics.
- Counting pin calls instead of distinct-entry transitions would drift the gauge;
  tests cover duplicate pins, non-final releases, repeated releases, and stale
  handles.
- A projection scan would violate the fixed-cost contract; the unit test and code
  review must verify event-only O(1) updates.
- Evidence drift could hide manual state injection; the focused browser test must
  use the exported observer and assert the transition without `setCacheState`.

## Explicit exclusions

Leases, admission failure/`BUDGET_EXHAUSTED` telemetry, snapshot optimization,
Hestia, `WorkerPool`, `resultGate`, render/UI behavior, package/lock/config/CI
changes, and screenshots are outside this design.
