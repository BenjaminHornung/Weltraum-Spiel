# Hestia First-Person Combat Slice V1

Status: implemented and under verification on feature branch
`feature/browser-hestia-first-person-combat-integration-v1`; not merged to
`main`.

## Scope

`/?surfacePlay=1` is a bounded player-facing integration slice for grounded
first-person locomotion, Pulse Cutter combat, a Survey Drone, authoritative
terrain edits and a Suit HUD on Hestia. It is deliberately independent of the
normal flight route and the technical `/?surfaceLab=1` proving ground.

The route owns one stable configuration:

- body `planet.hestia`;
- frame `frame:surface_hestia_surface_play_v1`;
- region `region:hestia.surface-play.v1`;
- seed `hestia-surface-play-v1`;
- two canonical resident bricks at `0.50 m` voxel size.

Startup resolves the player pose through the same authority-backed collision
path used during play. Failure to find valid ground fails closed; there is no
runtime snap, velocity-zero recovery or presentation-authored fallback.

## Route and controls

Surface Play requires exactly one `surfacePlay=1` value. Duplicate or different
values fall through to the existing routing behavior. A valid Surface Play
query wins over simultaneous `surfaceLab=1` and `testBridge=1`; the route never
installs `window.TestBridge`.

Use the visible **CLICK TO ENGAGE SUIT CONTROL** action before gameplay input:

| Input | Behavior |
| --- | --- |
| `W/A/S/D` | View-relative grounded movement |
| `Left Shift` | Sprint |
| `Space` | Jump |
| Mouse | First-person look while pointer-locked |
| Left mouse button | Fire the Pulse Cutter |
| `Escape` | Release control and clear held input |

UI focus and lost pointer lock neutralize gameplay commands. Surface Play does
not construct flight, planner or terminal input owners.

## Authority boundaries

- The fixed-step runtime owns ordering and immutable snapshots.
- The revision-bound voxel collision port owns terrain contact answers.
- Combat Core owns fire permission, damage and semantic combat events.
- The voxel authority owns edit validation, revisions, hashes and receipts.
- Three.js, effects and the Suit HUD are projections only.

Each fixed tick consumes one command, advances locomotion, advances weapon
state, resolves fire, and only then submits an accepted terrain impact as an
edit. An accepted authority transition replaces the authority/collision binding
before the next tick. Presentation consumes ordered transition snapshots,
removes superseded content-addressed representations and publishes only the
canonical remesh keys.

## Quantization and visible-resolution limit

Continuous impact positions remain available for effects. Only the
authoritative `SubtractSphere` center crosses the edit protocol boundary:
coordinates are independently quantized to `0.125 m` using symmetric
round-half-to-even, and negative zero is canonicalized to positive zero. The
edit radius, capsule, movement, collision and damage values remain SI metres.

Resident terrain is materialized at `0.50 m`. The `0.125 m` command quantum is
therefore not a claim of visible `0.125 m` terrain detail.

## Lifecycle

Bootstrap constructs route identity, authority, grounded spawn, renderer,
runtime, presentation, input, pointer-lock and UI ownership before starting the
RAF loop. Resize updates the renderer and camera together. Explicit disposal,
`pagehide` and partial startup failure cancel RAF first and release owned
resources exactly once in reverse order.

## Verification and evidence

The verification contract combines:

- focused quantization, route, runtime, collision, presentation and bootstrap
  Vitest suites;
- the complete browser unit suite and production TypeScript/Vite build;
- real Chromium E2E through visible DOM, pointer, mouse and keyboard without
  TestBridge;
- a 1920x1080 screenshot matrix under
  `apps/weltraum-browser/evidence/playwright-output/hestia-first-person-combat-slice-v1/`;
- contract immutability, forbidden-import, scope, diff and secret checks.

See:

- `apps/weltraum-browser/evidence/browser-hestia-first-person-combat-slice-v1.md`
- `apps/weltraum-browser/evidence/browser-hestia-first-person-combat-slice-v1-summary.json`
- `apps/weltraum-browser/tests/e2e/hestia-first-person-combat-slice.spec.ts`
- `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/`

## Explicit non-goals

V1 does not provide a global Hestia shell, terrain streaming, orbital or
space-to-surface transitions, persistence, economy, cargo, multiplayer, more
biomes, a generalized weapon framework, or production encounter AI. Surface
Lab remains independently reachable and the normal flight route remains
unchanged when the exact Surface Play gate is absent.
