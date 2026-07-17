# Capability: browser-worker-streaming-pinned-telemetry-fix-v1

## Requirement

The exported `MemoryContentCacheObserver` SHALL include frozen `Pinned` and
`Unpinned` events, each carrying the canonical cache identity in
`canonicalKey`. `MemoryContentCache` SHALL emit exactly one `Pinned` after a
distinct existing entry changes from `pinCount === 0` to `1`, and exactly one
`Unpinned` after a valid final release changes it from `1` to `0`. Duplicate pin
acquisition, non-final release, repeated release, stale release, invalidated
handle release, and clear-time per-entry release SHALL emit no such transition
event. `clear()` SHALL continue to emit exactly one `Cleared` reset event.

Observer exceptions SHALL remain isolated from cache behavior. The memory-cache
telemetry projection SHALL update the existing `pinnedEntries` gauge from these
events in O(1), without snapshots, entry scans, or payload inspection.

The real browser worker-streaming telemetry spine SHALL use the exported observer
and prove the truthful `0 -> 1 -> 0` gauge transition without manually calling
`setCacheState`. Existing JSON/Markdown evidence may be regenerated; no screenshot
is required.

## Public contract

```ts
type MemoryContentCacheObserverEvent =
  | { readonly kind: "Pinned"; readonly canonicalKey: ContentKeyCanonical }
  | { readonly kind: "Unpinned"; readonly canonicalKey: ContentKeyCanonical }
  // existing Hit | Miss | Admitted | Evicted | Cleared events remain unchanged
```

The callback receives a frozen event object. `canonicalKey` is the exact
`canonicalizeContentKey` result for the affected entry. No lease, admission
failure, or `BUDGET_EXHAUSTED` event is added.

## Scenarios

### Scenario: first pin publishes one canonical transition

- Given an admitted entry with `pinCount === 0`
- When its first valid pin is acquired
- Then one frozen `Pinned` event is published after mutation with that entry's
  `canonicalKey`
- And the projected `pinnedEntries` gauge is `1`

### Scenario: duplicate pin acquisition is not a second entry transition

- Given an entry already represented by `pinCount === 1`
- When another valid pin is acquired
- Then no additional `Pinned` event is published
- And the projected gauge remains `1`

### Scenario: only the final valid release publishes unpinning

- Given an entry with two valid pin handles
- When one handle is released
- Then no `Unpinned` event is published
- When the remaining handle is released once
- Then one frozen `Unpinned` event is published after mutation with the same
  `canonicalKey`
- And the projected gauge is `0`

### Scenario: repeated or stale releases are silent

- Given a released handle, an invalidated handle, or a handle from before
  `clear()`
- When that handle is released again
- Then no `Unpinned` event is published and no gauge underflow occurs

### Scenario: clear remains one reset

- Given zero or more entries, including pinned entries
- When `clear()` is called
- Then exactly one existing `Cleared` event is published with the existing reset
  fields
- And no `Unpinned` event is synthesized for individual entries
- And all cache gauges are zero

### Scenario: observer failure is isolated

- Given an observer that throws for a pin, unpin, or clear event
- When the cache mutation is performed
- Then the mutation and handle idempotence still complete normally
- And the cache remains internally consistent

### Scenario: real browser telemetry uses the public spine

- Given the normal `/` route and the real worker-streaming telemetry scenario
- When the exported cache observer is passed to the projection and the content is
  pinned and finally released
- Then telemetry proves `pinnedEntries` `0 -> 1 -> 0`
- And the scenario contains no manual `setCacheState` call
- And existing browser health guards and deterministic evidence remain passing

## Compatibility scenarios

- A cache without an observer preserves all prior behavior.
- Existing `Hit`, `Miss`, `Admitted`, `Evicted`, and `Cleared` event consumers retain
  their previous fields and semantics while accepting the additive event kinds.
- Leases and cache admission failures remain behaviorally unchanged and produce no
  new telemetry events.
