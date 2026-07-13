# Browser Persistence, Universe Time and Event Core v1

## Decision

The browser mainline now has a pure TypeScript boundary for deterministic Universe time, stable persistence identity, strict V1 save data, schema migration mechanics, persistent domain events, simulation-mode transitions, and canonical JSON signatures. The public surface is `apps/weltraum-browser/src/persistence/index.ts`.

The core owns contracts only. It does not connect them to the live flight loop, renderer, UI, browser storage, offline progression, or multiplayer transport.

## Universe time contract

Universe time uses exactly 120 ticks per game epoch second. Tick `0` is game-owned epoch second `0`; it is not Unix time and never comes from a system clock. `UniverseTime` stores the safe-integer tick and its exactly derived `epochSeconds` value.

The 120 Hz grid is a persistence and future network-ready quantum. It is deliberately separate from the current 30 Hz runtime stepping; a 30 Hz step corresponds to four Universe ticks, but this feature does not change or import the runtime loop.

`MissionTime` is an independent tick counter. Advancing Universe time does not advance mission time. Warp, offline elapsed time, and automatic clock progression are not part of V1.

Second-to-tick conversion always names its rounding policy:

- `exact` rejects a value that does not map to a whole safe tick.
- `floor` rounds down.
- `ceil` rounds up.
- `nearest` rounds to the closest tick, with exact half-tick ties upward.

Negative, nonfinite, unsafe, overflowing, and internally inconsistent time values fail closed.

## Stable identity

Stable IDs are ASCII strings no longer than 128 characters. Their nonempty suffix is lowercase `[a-z0-9._-]+`.

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

Fixture identity depends only on explicit kind, seed, and sequence inputs. Display names, clocks, randomness, UUID generators, and process-global counters are not identity authorities.

## SaveGameEnvelopeV1

The only production save schema in this slice is `SaveGameEnvelopeV1`:

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

The validator rejects unknown fields and future schema versions. It requires JSON-safe data, stable identities, internally resolvable player references, valid Universe time, and explicit definition snapshots. Metadata uses Universe ticks rather than wall-clock timestamps.

Definitions remain outside the mutable save. Neutral mutable records carry a `DefinitionReference` with domain, stable definition ID, and definitions-version binding. A mobile object has the exact bare `definitionId` wire field and no `definitionRef`. Its ID must resolve in one supplied definition snapshot, and that snapshot must match one top-level version reference. Definition bodies, display names, localized text, and catalog data are never embedded into mutable state.

The mobile record persists identity, frame reference, finite transform and velocity values, finite nonnegative epoch/mass/fuel values, cargo-container IDs, nullable damage/power/plan/mission references, and simulation mode. It does not calculate trajectories, mass balances, cargo behavior, damage, power, or mission behavior.

## Migration boundary

The generic migration registry accepts only unique, consecutive steps. Each stage has a stable migration ID, a source and target version, a pure transform, and source/target validators. Migration clones and freezes its input and validates the result after every stage. Missing paths, gaps, downgrades, duplicate registrations, invalid stages, and out-of-range versions fail closed.

The included `v1 -> v2` example is a neutral fixture migration with ID `fixture.neutral.v1-to-v2`. It proves the registry only. It is not a `SaveGameEnvelopeV2`, does not authorize product schema version 2, and is not a game-save migration.

## Persistent domain events

Events contain a stable event ID, explicit Universe time, machine type and severity, optional stable source/target IDs, `actionRequired`, JSON-safe machine facts, and `Pending` or `Acknowledged` status. Presentation-truth keys such as `title`, `summary`, `message`, `displayText`, and `localizedText` are rejected recursively from payloads.

Queues sort by `(universeTime.tick, eventId)`. Enqueuing identical canonical data under an existing ID is an idempotent no-op; different data under that ID is a conflict. Acknowledgement requires an explicit Universe time, retains the event and `actionRequired`, and is idempotent only for the same acknowledgement time. A different second time conflicts.

Events do not change simulation modes implicitly, and mode transitions do not create events.

## Simulation-mode matrix

Self-transitions are idempotent. The allowed non-self transitions are exact:

| From | Allowed targets |
| --- | --- |
| `Active` | `Background`, `NeedsReplan`, `NeedsPlayerAttention`, `Destroyed` |
| `Background` | `Active`, `Dormant`, `NeedsReplan`, `NeedsPlayerAttention`, `Destroyed` |
| `Dormant` | `Background`, `NeedsPlayerAttention`, `Destroyed` |
| `NeedsReplan` | `Active`, `Background`, `NeedsPlayerAttention`, `Destroyed` |
| `NeedsPlayerAttention` | `Active`, `Background`, `Dormant`, `NeedsReplan`, `Destroyed` |
| `Destroyed` | none |

`Destroyed -> Destroyed` is the idempotent self-edge. Every other transition from `Destroyed` is rejected.

## Canonical JSON and signatures

The persistence canonicalizer accepts only null, booleans, strings, finite numbers, dense plain arrays, and plain objects. It normalizes negative zero, sorts object keys lexically, preserves semantically ordered arrays, and rejects unsupported prototypes, sparse arrays, cycles, nonfinite values, functions, symbols, and bigint.

Save serialization first normalizes schema-declared unordered collections by stable identity, then produces whitespace-free canonical JSON. Public results are defensive deeply frozen clones. Signatures are `fnv1a32:<eight lowercase hex digits>` computed with the existing direct `fnv1aHash` primitive over canonical persistence JSON bytes. The envelope is not self-signing.

## Browser evidence

The normal-route Playwright scenario loads `/`, proves `TestBridge` is absent, imports `/src/persistence/index.ts` through Vite, and runs the same scenario twice from fresh fixtures. It covers 120 Hz time advancement, independent mission time, save validation, event ordering and acknowledgement retention, valid and terminal mode transitions, neutral migration, canonical roundtrip, signatures, immutability, and unfiltered browser health checks.

- [Deterministic JSON evidence](../../apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1-summary.json)
- [Readable Markdown evidence](../../apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1.md)

The evidence is written only after all functional and browser-health assertions pass. It contains no generated time, random value, machine-specific path, or environment-dependent ordering.

The normal app shell now references `public/favicon.png`, a generated transparent low-poly spaceship. This real asset prevents the browser's default `/favicon.ico` request from producing a hidden 404 during the unfiltered normal-route health check.

## Verification

Focused verification from `apps/weltraum-browser`:

```powershell
npx tsc -p tsconfig.json
npm run test -- tests/unit/persistenceUniverseTime.test.ts
npm run test -- tests/unit/persistenceSaveSchema.test.ts
npm run test -- tests/unit/persistenceMigrations.test.ts
npm run test -- tests/unit/persistenceEvents.test.ts
npm run test -- tests/unit/persistenceSimulationMode.test.ts
npm run test -- tests/unit/persistenceCanonical.test.ts
npx playwright test tests/e2e/persistence-universe-time-event-core.spec.ts --reporter=line
```

Full browser regression:

```powershell
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
npm run test:e2e
```

Repository checks include `git diff --check`, allowlist and forbidden-path audits, deterministic evidence hash comparison across two focused E2E runs, and package/lockfile inspection.

## Boundaries and known limitations

This slice implements no storage backend, autosave, save slots, load/menu UI, cloud sync, game catalogs, runtime materialization, background simulation, offline advancement, timewarp, multiplayer synchronization, or production V2 save schema. It does not persist DOM, renderer, mesh, Three.js, scene, or live runtime objects.

DevToolbox was not run because its restricted workspace root excludes this Temp worktree. The change tasks remain unchecked and must not be represented as DevToolbox-complete until an eligible workspace performs evidence ingestion and completion preflight.
