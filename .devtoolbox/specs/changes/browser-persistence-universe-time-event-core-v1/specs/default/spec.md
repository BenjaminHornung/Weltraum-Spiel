# Capability: Browser Persistence, Universe Time and Event Core v1

## Requirement: Explicit Universe Time

The module SHALL model Universe Time as explicit immutable state on a fixed 120-tick-per-second grid. Tick zero SHALL equal game Universe epoch second zero and SHALL NOT represent Unix/system time. `epochSeconds` SHALL be derived from the tick and SHALL remain finite and nonnegative. This timebase SHALL NOT mandate or change any runtime, physics, render, background, or network loop.

`MissionTime` SHALL own an independent tick counter and SHALL NOT advance when Universe Time advances. System time, render frames, offline elapsed time, and implicit warp SHALL NOT influence either clock.

### Scenario 01: Universe Clock starts deterministically

Creating two clocks without hidden inputs returns equal frozen values at tick `0` and epoch second `0`.

### Scenario 02: Tick advance produces exact time

Advancing by `120` ticks returns tick `120` and epoch second `1`; advancing by four ticks returns exactly the canonical time represented by `4 / 120` seconds.

### Scenario 03: Equal advances produce equal results

Applying the same explicit tick or second advance to equivalent clocks produces byte-equivalent results, while the input clock and independent Mission Time remain unchanged.

### Scenario 04: Invalid time values are rejected

Negative, NaN, infinite, unsafe-integer, overflow, inconsistent tick/epoch, and inexact values under `exact` conversion fail with stable errors. `floor`, `ceil`, and `nearest` are explicit; `nearest` rounds half-tick ties upward.

### Scenario 05: No system time is used

The persistence source contains no `Date.now`, `new Date`, `performance.now`, timer, render-frame, or implicit current-time dependency, and repeated execution does not depend on wall-clock state.

## Requirement: Stable identifiers

The module SHALL validate at-most-128-character ASCII identifiers with nonempty lowercase `[a-z0-9._-]+` suffixes and the fixed prefixes `save:`, `player:`, `ship:`, `drone:`, `station:`, `base:`, `mission:`, `encounter:`, `event:`, `container:`, `site:`, `resource-node:`, and `ship-variant:`. `ship-variant:` SHALL be classified as a definition ID; all other listed kinds SHALL be instance IDs.

Fixture IDs SHALL be derived only from explicit kind, seed, and sequence inputs. No display name, UUID generator, random source, clock, or process-global counter SHALL be identity authority.

### Scenario 06: Stable IDs are validated

Every declared prefix accepts a valid canonical fixture ID and rejects wrong prefixes, uppercase/non-ASCII/invalid suffix characters, empty suffixes, and strings longer than 128 ASCII characters. Equal explicit fixture inputs return equal IDs.

### Scenario 07: Duplicate IDs are rejected

Duplicate instance identity in any owned envelope collection, including cross-collection conflicts where the ID contract overlaps, fails closed with a stable issue code and JSON-pointer path.

## Requirement: Strict V1 save envelope

The production validator SHALL accept only `SaveGameEnvelopeV1` with `schemaVersion: 1`, explicit game/save/Universe time/definition-version/player/mobile/static/mission/encounter/discovery/event/metadata fields, strict known keys, JSON-safe values, and internally resolvable active player references. Metadata time SHALL use Universe ticks and SHALL NOT contain a generated wall-clock timestamp.

Definition bodies, renderer state, runtime objects, functions, Maps, Sets, Dates, and class instances SHALL NOT be serializable save data. Frame, container, damage, power, plan, and external mission references SHALL be syntactically validated without inventing ownership outside this slice.

### Scenario 08: Save envelope roundtrips byte-stably

A valid V1 envelope canonicalizes, serializes, parses, revalidates, and reserializes to identical UTF-8 JSON bytes and the same signature.

### Scenario 09: Insertion order does not change signature

Equivalent envelopes with differently inserted object keys and differently ordered schema-declared unordered collections produce identical canonical bytes and signatures; semantically ordered arrays preserve their order.

## Requirement: Definitions remain separate from mutable state

The save SHALL store `DefinitionReference`, `DefinitionsVersionReference`, and `MutableInstanceState` records. Definition references used by neutral mutable records SHALL carry a stable definition ID and explicit domain-version binding. A mobile object SHALL instead contain exactly the bare `definitionId` field and SHALL NOT contain `definitionRef`. Validation SHALL resolve all definition identities only against explicitly supplied definition snapshots and top-level version references. Definition bodies and display metadata SHALL NOT be duplicated into mutable save state.

### Scenario 10: Definitions are referenced only

A valid envelope contains stable definition IDs/references but none of the referenced definition's display name or body; changing the external display name leaves save identity, canonical bytes, and signature unchanged.

### Scenario 11: Missing definition produces a stable error

When a referenced ID is absent from the explicitly supplied matching snapshot, validation reports `MISSING_DEFINITION` at a deterministic JSON-pointer path. A mobile `/definitionId` must occur in exactly one supplied snapshot; more than one match reports `DUPLICATE_ID` at that path. The matching snapshot's domain/version must have exactly one matching top-level `definitionsVersionRefs` entry; a missing or mismatched version is separately and deterministically reported.

### Scenario 12: Mutable state remains separate

Changing valid instance-owned mutable data changes only that instance state and save signature; it does not mutate or embed the immutable definition snapshot.

## Requirement: Mobile object persistent state

Mobile object state SHALL contain stable `objectId`, `ownerId`, bare `definitionId`, and `frameId` fields; finite position/velocity/angular-velocity vectors; a finite nonzero quaternion; finite nonnegative epoch and mass values; canonical container references; nullable syntactically valid damage/power/plan/mission references; and a valid simulation mode. Its strict wire schema SHALL reject `definitionRef` as unknown rather than accept both definition shapes.

The validator SHALL NOT compute flight, celestial frames, trajectories, mass sums, fuel, cargo, damage, power, plan, or mission behavior.

### Scenario 13: Finite mobile state is valid

A complete mobile record with the exact bare `definitionId` field, finite vectors/quaternion, nonnegative finite masses/time, stable references, and an allowed mode validates and canonicalizes without invoking another domain core.

### Scenario 14: NaN and Infinity are rejected

NaN, positive/negative Infinity, and invalid quaternion components anywhere in mobile numeric state fail closed and never reach canonical JSON or a signature.

## Requirement: Schema versions fail closed

The production save schema SHALL remain V1. The V1 validator SHALL reject all future schema versions and SHALL NOT treat the generic migration fixture as a product V2 schema.

### Scenario 15: Future save version is rejected

An otherwise valid envelope with `schemaVersion: 2` fails with a stable unsupported-future-version issue before domain state is returned.

## Requirement: Immutable consecutive migration registry

Each migration SHALL have a unique ID, nonnegative integer source version, exactly consecutive target version, pure transform, and target validator. Registration/path validation SHALL reject duplicate IDs/source versions, gaps, downgrades, unknown steps, and future bounds. Migration SHALL receive a deeply frozen clone, SHALL leave caller input unchanged, and SHALL validate every produced stage.

The supplied `v1 -> v2` migration SHALL operate only on neutral generic fixture records and SHALL NOT define or register a product `SaveGameEnvelopeV2`.

### Scenario 16: Generic fixture migrates v1 to v2

The explicit neutral V1 fixture follows the registered single consecutive step, passes its V2 fixture validator, and returns the stable applied migration ID.

### Scenario 17: Missing migration path is rejected

A requested target whose consecutive registered path is incomplete fails with a stable missing-path error; steps are never skipped and downgrades are never attempted.

### Scenario 18: Migration does not mutate input

The input record and its nested data remain byte-equivalent after migration, a transform cannot mutate the deeply frozen argument, and the returned V2 fixture is a distinct deeply frozen value validated after the stage.

## Requirement: Deterministic persistent event queue

Events SHALL use the required type vocabulary, stable event IDs, explicit Universe Time, optional stable source/target IDs, `Info | Warning | Critical` severity, `Pending | Acknowledged` status, `actionRequired`, and JSON-safe machine payloads. Payloads SHALL reject the UI-truth keys `title`, `summary`, `message`, `displayText`, and `localizedText` at any nesting depth.

The queue SHALL order by `(universeTime.tick, eventId)`. Event operations SHALL NOT implicitly change simulation modes; mode operations SHALL NOT implicitly create events.

### Scenario 19: Event order is stable

Enqueuing equal valid events in different input orders produces the same tick-then-ID order, canonical bytes, and queue signature.

### Scenario 20: Duplicate event policy is deterministic

Enqueuing an existing event ID with byte-identical event data is an idempotent no-op; reusing the ID with any different canonical event data fails with a stable conflict.

### Scenario 21: Acknowledge is deterministic

Acknowledging a pending event with an explicit Universe Time retains the event and records `Acknowledged` plus that time. Repeating the identical command is a no-op; a different second acknowledgement time conflicts; an absent event ID fails.

### Scenario 22: ActionRequired remains visible

Acknowledgement preserves the original `actionRequired` value and all machine payload/source/target facts rather than deleting the event.

## Requirement: Explicit simulation-mode transitions

Self-transitions SHALL be idempotent. The only non-self transitions SHALL be:

- `Active -> Background | NeedsReplan | NeedsPlayerAttention | Destroyed`;
- `Background -> Active | Dormant | NeedsReplan | NeedsPlayerAttention | Destroyed`;
- `Dormant -> Background | NeedsPlayerAttention | Destroyed`;
- `NeedsReplan -> Active | Background | NeedsPlayerAttention | Destroyed`;
- `NeedsPlayerAttention -> Active | Background | Dormant | NeedsReplan | Destroyed`;
- no transition from `Destroyed`.

Transition validation SHALL have no simulation, replanning, event, or runtime side effect.

### Scenario 23: Allowed mode transition succeeds

Every edge in the documented matrix succeeds, including `Active -> Background`, `Background -> Dormant`, `Dormant -> Background`, and intervention-state exits; self-transitions return unchanged canonical state.

### Scenario 24: Forbidden mode transition is rejected

Every non-self edge absent from the documented matrix fails with a stable structured error and leaves the source value unchanged.

### Scenario 25: Destroyed is terminal

`Destroyed -> Destroyed` is an idempotent self-transition and every transition from `Destroyed` to another mode is rejected.

## Requirement: Canonical JSON and immutable public results

Canonicalization SHALL accept only JSON primitives, dense arrays, and plain objects; normalize `-0`; sort object keys; preserve semantically ordered arrays; and reject `undefined`, holes, bigint, symbols, functions, cycles, nonfinite numbers, Dates, Maps, Sets, and class instances. Schema-declared set-like collections SHALL be sorted by stable identity before canonicalization.

Every public snapshot SHALL be a defensive deeply frozen clone. Signatures SHALL be `fnv1a32:<eight-lowercase-hex-digits>` computed with direct `fnv1aHash` over persistence canonical JSON bytes excluding the derived signature wrapper field. The number-rounding core `stableStringify` SHALL NOT be used.

### Scenario 26: Results are immutable

Mutation attempts against returned clocks, envelopes, migration results, event queues, canonical values, and nested arrays/objects fail or have no effect, and caller-owned input remains unchanged.

### Scenario 27: Canonical signature remains stable

Repeated canonicalization and parse/serialize roundtrips of equivalent data produce byte-identical JSON and identical lowercase `fnv1a32` signatures, while a semantic state change changes the signature.

## Requirement: Persistence core remains isolated

The source SHALL NOT import or use Three.js, DOM, renderer, flight/runtime/UI cores, browser storage, system time, random state, or another domain's calculations. The implementation SHALL remain inside its allowlist, except for the approved exact `test:e2e:core` script append.

### Scenario 28: No Three.js, DOM, or renderer dependency

A source/import audit and typecheck show no Three.js, DOM-global, renderer, scene, canvas, CSS, TestBridge, or forbidden domain-core import or usage in `src/persistence`.

### Scenario 29: No LocalStorage dependency

A source audit and normal-route browser scenario show no LocalStorage, IndexedDB, storage event, or production persistence adapter usage in the domain core.

### Scenario 30: Other domain cores remain unchanged

The final diff against the recorded base changes no Flight, Navigation, Runtime, Render, UI, Combat, Celestial, Settings, Resources, Ship Builder, World, Test Harness, Unity/Assets, roadmap, intent-index, or port-roadmap path; package dependencies and lockfiles remain byte-identical.

## Requirement: Normal-route browser evidence

Playwright SHALL install error listeners before loading normal `/`, verify `window.TestBridge` is absent, dynamically import `/src/persistence/index.ts`, and execute a small clock/save/event/mode/migration/roundtrip scenario twice. It SHALL fail on console errors, page errors, failed requests, and HTTP status `>= 400` without generic suppression.

Only after all assertions pass SHALL it write deterministic JSON and Markdown evidence under the approved task-specific paths. Both runs SHALL produce identical canonical bytes and signatures. Evidence SHALL contain no screenshots, system timestamps, wall-clock durations, random values, or machine-specific paths.

### Scenario: Browser persistence roundtrip

The normal page remains healthy while the dynamically imported core advances explicit Universe Time, validates a V1 save, enqueues and acknowledges events, performs an allowed mode transition, runs the neutral migration fixture, serializes/deserializes the save, and proves identical revalidated bytes and signatures across two executions.
