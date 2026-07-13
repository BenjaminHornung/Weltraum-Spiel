# Design: Browser Persistence, Universe Time & Event Core v1

## Design principles

The module is a deterministic, pure TypeScript boundary. Public snapshots are plain JSON-safe data, validated fail-closed, canonically ordered, defensively cloned, and deeply frozen. State changes occur only through explicit pure functions or commands. Domain logic must not read system time, render frames, random state, browser storage, DOM, Three.js, or runtime objects.

The public API is exported only from `src/persistence/index.ts`. Internal files are `ids.ts`, `time.ts`, `types.ts`, `saveSchema.ts`, `validation.ts`, `migrations.ts`, `events.ts`, `simulationMode.ts`, `canonical.ts`, and `fixtures.ts`.

## Universe time

### Timebase and epoch

- `UNIVERSE_TICKS_PER_SECOND` is exactly `120`.
- `SimulationTick` is a branded nonnegative JavaScript safe integer.
- Tick `0` is Universe epoch second `0`, owned by the game. It is neither Unix time nor system time.
- `EpochSeconds` is the derived finite nonnegative numeric value `tick / 120`.
- The 120 Hz quantum is a canonical persistence/network-ready grid, not a required update loop. Existing 30 Hz physics would correspond to four Universe ticks; this change neither imports nor modifies that runtime.
- `UniverseTime` stores the canonical tick and its derived epoch seconds. Validation rejects disagreement between the fields.
- `MissionTime` has its own nonnegative safe-integer tick counter. Advancing Universe Time never advances Mission Time.
- Warp and offline time remain absent. The separate type boundary leaves room for an explicitly specified future channel without overloading Universe Time.

### Pure operations and rounding

`createUniverseClock`, `advanceUniverseTicks`, `advanceUniverseSeconds`, `convertTicksToSeconds`, and `convertSecondsToTicks` are pure and have no clock/frame dependency. Tick advances accept nonnegative safe integers. Second advances accept finite nonnegative seconds plus a mandatory rounding mode:

- `exact`: reject unless seconds map to an exact safe-integer tick;
- `floor`: round fractional ticks toward negative infinity;
- `ceil`: round fractional ticks toward positive infinity;
- `nearest`: nearest tick, with exact half-tick ties rounded upward.

All operations reject negative/nonfinite inputs, unsafe results, overflow beyond `Number.MAX_SAFE_INTEGER`, and any output that would violate the clock invariant. No floating epsilon silently converts a non-exact input in `exact` mode.

## Stable identifiers

IDs are branded strings, at most 128 ASCII characters including prefix. The complete grammar is `<prefix><suffix>`, where the nonempty suffix is lowercase `[a-z0-9._-]+`.

| Kind | Prefix | Classification |
| --- | --- | --- |
| Save | `save:` | Instance |
| Player | `player:` | Instance |
| Ship | `ship:` | Instance |
| Drone | `drone:` | Instance |
| Station | `station:` | Instance |
| Base | `base:` | Instance |
| Mission | `mission:` | Instance |
| Encounter | `encounter:` | Instance |
| Event | `event:` | Instance |
| Container | `container:` | Instance |
| Site | `site:` | Instance |
| Resource node | `resource-node:` | Instance |
| Ship variant | `ship-variant:` | Definition |

IDs are not display names. `createStableFixtureId(kind, seed, sequence)` is pure: it validates an explicit normalized seed and nonnegative safe-integer sequence and returns the same ID for the same arguments. An optional fixture factory owns only an explicit seed and explicit starting sequence; it has no process-global counter, clock, UUID, or random source.

Every envelope collection with instance identity is validated for duplicate IDs across all relevant collections and fails closed with a stable issue. Definition IDs may repeat as references.

## Definitions and mutable state

`DefinitionReference` contains an explicit definition domain, stable definition ID, and definitions-version reference. `DefinitionsVersionReference` contains a domain and a nonempty version string. An envelope has one canonical entry per domain.

`MutableInstanceState<TId, TDefinitionId, TData>` contains only instance ID, `DefinitionReference`, and JSON-safe mutable data. Definition bodies, display names, localized labels, resource catalogs, part catalogs, and celestial definitions are never copied into a save.

Validation receives an explicit `DefinitionSnapshotResolver`/snapshot containing domain, version, and the known stable definition IDs. A reference is valid only when its domain-version pair exists in the envelope and supplied snapshot and its definition ID resolves in that exact snapshot. Missing definitions, missing version references, and version mismatch produce deterministic issue codes and JSON-pointer paths. A display-name change outside the save therefore does not affect save identity or canonical bytes.

## SaveGameEnvelopeV1

The production schema is exactly V1:

```text
SaveGameEnvelopeV1 {
  schemaVersion: 1
  gameVersion
  saveId
  universeTime
  definitionsVersionRefs
  player
  ships
  drones
  stations
  bases
  missions
  encounters
  discoveries
  worldEvents
  metadata
}
```

`player` is a minimal mutable instance record with stable `playerId`, optional internally resolvable `activeShipId`, and optional `activeMissionRef`. Ships and drones carry `MobileObjectPersistentState`; station, base, mission, encounter, and discovery records remain neutral, versioned, JSON-safe mutable records with stable IDs and definition references where applicable. `worldEvents` is an `EventQueueSnapshot`. Metadata contains created/updated Universe ticks and optional JSON-safe provenance; it contains no wall-clock timestamp.

Unknown fields are rejected at every schema-owned record. Arrays are accepted in arbitrary insertion order only where declared semantically unordered, then canonicalized. `schemaVersion > 1`, unsupported lower versions at the V1 validator, malformed values, unknown fields, duplicate IDs, unresolved `activeShipId`, unresolved `activeMissionRef`, or unresolved definition references fail closed. Issues contain stable codes and JSON-pointer paths, not localized UI text.

The V1 validator syntactically validates external frame, container, damage, power, plan, and mission reference IDs. Apart from player active ship/mission and the owned collections/definition snapshots described above, it does not invent referential authority for contracts outside this slice.

## Mobile object persistent state

`MobileObjectPersistentState` contains:

- stable `objectId`, `ownerId`, and `definitionId`/definition reference;
- stable `frameId` reference;
- finite three-component `positionMeters`, `velocityMetersPerSecond`, and `angularVelocity` vectors;
- finite four-component quaternion `orientation` (nonzero magnitude; normalization is not performed by this persistence slice);
- finite nonnegative `epochSeconds`, `currentMassKg`, `dryMassKg`, and `fuelMassKg`;
- canonical stable `cargoContainerIds`;
- syntactically validated nullable `damageStateRef`, `powerStateRef`, `activePlanRef`, and `activeMissionRef`;
- `simulationMode`.

Persistence validation does not calculate trajectories, frames, mass sums, fuel consumption, damage, power, cargo, plans, or missions. It does not require `currentMassKg = dryMassKg + fuelMassKg`; those are authoritative runtime/domain concerns outside the change.

## Migration registry

The generic registry exposes `registerMigration`, `validateMigrationPath`, and `migrateSave` without redefining the product V1 schema.

Each step has a unique stable migration ID, integer `sourceVersion`, exactly consecutive `targetVersion = sourceVersion + 1`, a migration function, and a validator registered for its target version. Registration rejects duplicate IDs, duplicate source versions, invalid versions, gaps, and nonconsecutive steps. Path validation rejects downgrades, future source/target versions, unknown steps, and missing paths with stable errors.

`migrateSave` deep-clones and deep-freezes input before invoking each step, never mutates the caller's object, and validates the returned JSON-safe record after each stage. The registry produces a fresh immutable result and stable applied-migration IDs.

`fixtures.ts` supplies a neutral generic V1 record, a generic V2 record with a harmless test-only field, validators, and a `v1 -> v2` step. It is not a `SaveGameEnvelopeV2`, is not registered as a product migration, and cannot make schema version 2 valid for `SaveGameEnvelopeV1` APIs.

## Persistent domain events

### Types and records

`EventType` contains at least `MissionComplete`, `FuelReserveLow`, `WarpExited`, `CargoFull`, `ContactLost`, `NeedsReplan`, `NeedsPlayerAttention`, `DefinitionMissing`, and `MigrationApplied`. `EventSeverity` is `Info | Warning | Critical`; `EventStatus` is `Pending | Acknowledged`.

A `DomainEvent` includes stable `eventId`, type, explicit `UniverseTime`, optional stable source/target IDs, severity, `actionRequired`, JSON-safe payload, status, and nullable acknowledgement Universe Time. Pending events have no acknowledgement time. Acknowledged events retain all original event data and `actionRequired`.

Payloads are plain JSON values and reject UI-truth keys `title`, `summary`, `message`, `displayText`, and `localizedText` at any nesting depth. The domain exposes machine facts only.

### Queue operations

`EnqueueEventCommand` contains the complete event. `AcknowledgeEventCommand` contains event ID and explicit acknowledgement Universe Time. No operation derives time.

The queue is sorted by `(event.universeTime.tick, eventId)`. Enqueuing a new ID inserts in that order. Enqueuing the same ID with byte-identical canonical event data is an idempotent no-op; the same ID with any different data is a stable conflict. Acknowledging a pending event changes only status and acknowledgement time. Repeating with the identical acknowledgement time is idempotent; repeating with a different time conflicts. Acknowledging an absent event fails. Event enqueue/acknowledge never causes a simulation-mode transition, and mode changes never enqueue an event.

## Simulation modes

Self-transitions are idempotent. `Destroyed` is terminal. The exact non-self transition matrix is:

| From | Allowed targets |
| --- | --- |
| `Active` | `Background`, `NeedsReplan`, `NeedsPlayerAttention`, `Destroyed` |
| `Background` | `Active`, `Dormant`, `NeedsReplan`, `NeedsPlayerAttention`, `Destroyed` |
| `Dormant` | `Background`, `NeedsPlayerAttention`, `Destroyed` |
| `NeedsReplan` | `Active`, `Background`, `NeedsPlayerAttention`, `Destroyed` |
| `NeedsPlayerAttention` | `Active`, `Background`, `Dormant`, `NeedsReplan`, `Destroyed` |
| `Destroyed` | none |

Invalid transitions fail with a stable structured error and do not return changed state. No transition executes background simulation, replanning, events, or runtime side effects.

## Canonical JSON, immutability, and signatures

The independent persistence canonicalizer accepts null, booleans, strings, finite numbers, dense arrays, and plain objects only. It rejects `undefined`, sparse arrays, holes, nonfinite numbers, bigint, symbol, functions, cycles, Date, Map, Set, class instances, and other non-plain prototypes. It normalizes `-0` to `0` and sorts object keys lexically.

Schema-declared unordered collections are sorted by their stable identity before generic canonicalization. Arrays with semantic order remain in their supplied order. Canonical APIs never guess whether an arbitrary array is a set.

Canonical output is a defensive deep clone and deeply frozen. Serialization produces stable UTF-8 JSON text without whitespace variance. Signatures use the existing `fnv1aHash` primitive directly from `src/core/hash.ts` over the canonical persistence JSON bytes and render as `fnv1a32:<eight-lowercase-hex-digits>`. They do not use the existing number-rounding `stableStringify`. A signature is a derived wrapper value over the payload excluding the signature field; the envelope is never self-signing.

## Browser scenario and evidence

Playwright loads normal `/`, registers console error, page error, failed-request, and HTTP `>= 400` listeners before navigation, and proves `window.TestBridge` is absent. It dynamically imports `/src/persistence/index.ts` through Vite and performs a small in-page scenario: clock creation/advance, V1 save validation, event enqueue/acknowledge, valid mode change, generic fixture migration, canonical serialization/deserialization, and revalidation.

The scenario runs twice and requires identical canonical bytes and signatures. Only after all assertions pass does the test write deterministic JSON and Markdown evidence. Evidence contains no timestamp, wall-clock duration, screenshot, environment-random value, or machine-specific path. Console/network failures are not filtered generically.

## Scope and parallel-work protection

Owned paths are the new persistence source directory, named persistence unit/E2E/evidence files, the single browser-mainline contract document, and this change directory. The sole exception outside the original allowlist is the precise `test:e2e:core` command append in `apps/weltraum-browser/package.json`; dependencies and lockfiles remain unchanged.

Any required edit to Flight, Navigation, Runtime, Render, UI, Combat, Celestial, Settings, Resources, Ship Builder, World, Test Harness, Unity/Assets, roadmap/index documents, another package script, or any existing domain-core behavior is a stop condition.
