# Current Browser Mainline State

Stand: 2026-07-20
Status snapshot: browser mainline after the objective-chain,
celestial-gravity-core, combat-weapon-damage-core, Persistence/Universe-Time/
Event core, Ship Builder full-stats/readiness, Graphics Settings and Demo Scout
nozzle-VFX merges, plus the query-gated Hestia Microvoxel Surface Lab

## Product Mainline

The product mainline is the browser application under
`apps/weltraum-browser` using Three.js `0.185.0`, TypeScript `7.0.2`, Vite
`8.1.0`, Vitest `4.1.9` and Playwright `1.61.1`.

The final Unity implementation is immutable archive/reference material. Its
repository snapshot is preserved by tag `unity-legacy-final-2026-07` and branch
`archive/unity-legacy-final-2026-07`; archived source paths can be addressed as
`unity-legacy-final-2026-07:Assets/**`. No Unity project is active on this
branch.

## Playable Browser State

The normal route `/` boots a playable local-space flight slice with:

- Demo Scout GLB plus deterministic procedural fallback;
- telemetry-driven main-engine and RCS nozzle VFX bound to the visible ship;
- Cruise, Precision and Translation control modes;
- persistent throttle, main thrust, RCS, SAS, fuel, mass and braking authority;
- ChaseLocked, OrbitInspect, Side and FreeInspect cameras;
- fixed-step simulation with interpolated ship/camera presentation;
- runtime-owned targets, obstacles, routes and world contacts;
- player HUD, local radar and navigation planner;
- player-facing Graphics dialog with Low/Medium/High/Ultra presets and Custom state;
- explicit target selection, route preview, Engage and Cancel actions;
- local obstacle-aware planning, immutable route identity and typed fail-closed
  rejection states;
- terminal braking, capture, Arrival/Holding truth and continued station
  keeping.

The normal player runtime does not expose TestBridge. `window.TestBridge` is
available only on the explicit test route `/?testBridge=1`.

## Current Objective Chain

Current normal-runtime evidence proves through visible UI on `/`:

1. Range 500 m produces an admitted route preview and completes physically.
2. Range 1000 m unlocks and completes through the same runtime path.
3. Range 2500 m then becomes available with a distinct admitted preview hash.

The latest recorded evidence completed Range 500 m at approximately 1.3 m
final distance and Range 1000 m at approximately 1.0 m. Range 2500 m is
currently proven as an admitted preview, not as a required completed arrival.

Primary evidence:

- `apps/weltraum-browser/evidence/browser-objective-chain-1000m-completion-v2.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-browser-objective-chain-1000m-completion-v2/tests/test-protocol.md`
- `apps/weltraum-browser/tests/e2e/large-field-objective-chain-live.spec.ts`

## Navigation And Autopilot Truth

- The planner creates a `RoutePlan` before execution.
- A preview is display context until the exact route passes admission.
- Engage dispatches the exact admitted `planHash`.
- The executor consumes one immutable locked plan and never silently replaces
  it.
- Divergence, invalidation or current-state mismatch requires explicit
  replanning.
- Fuel, braking reserve and flight authority fail closed.
- Terminal capture and station keeping use the shared
  FlightController/actuator path.
- Completion preserves `completedPlanHash` as history without reusing it as a
  new route.
- Renderer and HUD projections cannot authorize execution or manufacture
  Arrival/Holding.

The implemented planner remains local-space. It is not an orbital navigator,
patched-conics planner, SOI planner, maneuver-node system or gravity-assist
planner.

## Browser Controls

| Input | Current behavior |
| --- | --- |
| `W/S` | Pitch in Cruise/Precision; forward/back translation in Translation |
| `A/D` | Yaw in Cruise/Precision; lateral translation in Translation |
| `Q/E` | Roll |
| `H/N` | Vertical translation in Translation |
| `Left Shift` / `Left Control` | Increase/decrease persistent main throttle |
| `X` | Cut throttle |
| `Y` or `Z` | Full throttle |
| `R` | Toggle RCS |
| `T` | Toggle SAS |
| `Caps Lock` | Cycle Cruise, Precision and Translation |
| `V` | Cycle camera mode |
| RMB + mouse | Orbit/look |
| Mouse wheel | Adjust inspection distance |

The navigation planner owns target and route actions. While it is open, held
flight keys are cleared and manual flight input is suppressed.

## Implemented Foundations

### Hestia Microvoxel Surface Lab

The exact query route `/?surfaceLab=1` starts a full-screen technical proving
ground outside the normal player runtime. It derives a fixed SurfaceLocalFrame
from the canonical Hestia celestial definition, generates exactly 16
deterministic voxel bricks through the existing WorkerPool, meshes them with
Surface Nets, and publishes validated MeshArtifacts through ThreeRenderBackend.
Same canonical input preserves brick and mesh identity; changed seed or
resolution produces distinct deterministic content. Cache, cancellation,
stale-result, worker-replacement, budget and disposal paths remain fail closed.

This route is not player-facing voxel terrain or gameplay. It does not provide
a planet shell, surface streaming, collision/player integration, seamless
space-to-surface transitions, production hydrology, destruction or accepted
final visual fidelity. The normal `/` flight runtime remains unchanged when
the exact query gate is absent.

Evidence:

- [Surface Lab behavior specification](../.devtoolbox/specs/changes/browser-hestia-microvoxel-surface-lab-v1/specs/default/spec.md)
- [Technical runtime evidence](../apps/weltraum-browser/evidence/browser-hestia-microvoxel-surface-lab-v1.md)
- [Deterministic evidence summary](../apps/weltraum-browser/evidence/browser-hestia-microvoxel-surface-lab-v1-summary.json)
- [Live browser E2E](../apps/weltraum-browser/tests/e2e/hestia-microvoxel-surface-lab.spec.ts)

### Celestial And Gravity Core

`apps/weltraum-browser/src/celestial` now provides a deterministic pure-data
and pure-math seam for the documented Aurelia starter system:

- validated stable body/catalog identities;
- canonical serialization and deterministic signatures;
- explicit reference frames;
- bound elliptic Kepler propagation at explicit times;
- local inverse-square gravity queries and deterministic dominant-source
  selection.

This core is deliberately not connected to flight, navigation, renderer, UI,
world bootstrap, SOI transitions, patched conics, terrain, atmosphere or
landing gameplay. It must not be described as playable orbital mechanics.

Evidence:

- `docs/browser-mainline/celestial-gravity-core-v1.md`
- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1.md`
- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1-summary.json`

### Combat Weapon And Damage Core

`apps/weltraum-browser/src/combat` provides a deterministic,
renderer-independent domain core for target selection, fire permission,
Projectile/Beam delivery, authoritative hit resolution, layered
Armor/Hull/Module damage and canonical semantic events.

The core is not connected to Browser Runtime, player/debug UI, renderer/VFX,
Flight, Navigation, enemy encounters, Ship Builder, Resources or persistence.
It must not be described as a complete playable combat loop.

Evidence:

- `docs/browser-mainline/combat-weapon-damage-core-v1.md`
- `apps/weltraum-browser/evidence/browser-combat-weapon-damage-core-v1.md`
- `apps/weltraum-browser/evidence/browser-combat-weapon-damage-core-v1-summary.json`

### Persistence, Universe Time And Event Core

`apps/weltraum-browser/src/persistence` provides a deterministic pure-TypeScript
contract boundary for 120 Hz Universe time, stable persistence identities,
strict V1 save envelopes, validated migration mechanics, persistent domain
events, simulation-mode transitions and canonical JSON signatures.

The core is not connected to the live flight loop, renderer, UI, Browser
storage, offline progression or multiplayer transport. It must not be described
as a playable save/load system, timewarp, background simulation or persistent
universe authority.

Evidence:

- `docs/browser-mainline/persistence-universe-time-event-core-v1.md`
- `apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1.md`
- `apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1-summary.json`

### World And Streaming

Implemented foundations include absolute/local frames, floating-origin
invariants, simulation-bubble membership, chunk registry, deterministic
residency and LOD, streaming transition/budget plans, and render-only instanced
asteroid presentation from runtime-backed descriptors.

Production chunk IO, terrain, voxel data, surface transitions and persistent
generated universe content remain unimplemented.

### Resource And Cargo Core

Stable resource IDs, catalog entries, stacks, capacity rules, containers,
transfers, ownership/legality/provenance and canonical serialization exist as
browser domain contracts.

Active ship cargo, loaded-mass integration, mining, trading, inventory UI and
persistence remain unimplemented.

### Ship Builder Analysis Foundations

Part categories, definitions, components, sockets, blueprints, compatibility,
structural graphs, dry/loaded mass, center of mass, footprint bounds, signed
stat reports, handling diagnostics and static Draft/TestFlight/Active readiness
exist as deterministic domain foundations.

Placement/edit UI, dynamic runtime resources, completed-test-flight tracking,
test-flight/runtime handoff, active-ship replacement, production art binding
and save/load remain unimplemented.

Evidence:

- `docs/browser-mainline/ship-builder-full-stats-flight-readiness-v1.md`
- `apps/weltraum-browser/evidence/browser-ship-builder-full-stats-flight-readiness-v1.md`
- `apps/weltraum-browser/evidence/browser-ship-builder-full-stats-flight-readiness-v1-summary.json`

## UI And Presentation State

- Flight and planner state are runtime-driven.
- Debug/TestBridge details are absent from the normal player HUD.
- Route geometry and identity come from the same locked/display plan.
- Blocked previews may remain visible only as typed context and cannot enable
  Engage.
- Demo Scout nozzle VFX derive from actuator telemetry and resolved visual
  bindings.
- Combat presentation is a bounded UI/presentation slice, not a complete
  browser combat loop.
- Graphics settings use strict versioned local preference storage and a narrow
  Three.js adapter. Render scale, FOV, presentation FPS, exposure, anisotropy
  and render-only decor remain presentation concerns; they cannot change
  simulation cadence, world residency, route identity or telemetry truth.
- Concept screenshots under `docs/UI-Screenshots/` are design references, not
  runtime evidence.

Graphics Settings evidence:

- `docs/browser-mainline/graphics-settings-foundation-v1.md`
- `apps/weltraum-browser/evidence/browser-graphics-settings-foundation-v1.md`
- `apps/weltraum-browser/evidence/browser-graphics-settings-foundation-v1-summary.json`

## Verification Contract

Run from `apps/weltraum-browser`:

```bash
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

Use `npm run test:e2e` for complete local Playwright discovery. CI additionally
checks exact E2E group membership, required browser LFS binaries and evidence
JSON validity.

Visible gameplay claims should use normal `/` Playwright flows and visible
controls. Use `?testBridge=1` only for explicitly synthetic deterministic
harness scenarios.

## Repository And Evidence Boundary

- `apps/weltraum-browser/public/ships/demo_scout_mk1.glb` is the unchanged
  runtime Demo Scout asset; its neutral source export lives under
  `art/source/ships/prototype-ship-kit`.
- The four `ui-concept-parity-v1-rejected-*.png` files under
  `apps/weltraum-browser/evidence` are required comparison baselines.
- `apps/weltraum-browser/public/favicon.png` is the low-poly app-shell icon used
  by the synchronized normal route.
- Current Browser Markdown, JSON and screenshot evidence remains under
  `apps/weltraum-browser/evidence`.
- The historical Unity status report is
  [`legacy-unity/current-prototype-state-2026-06-15.md`](legacy-unity/current-prototype-state-2026-06-15.md).

## Accepted Limits

The project is not yet:

- a seamless planet-to-planet or space-to-surface game;
- a voxel planet/terrain runtime;
- integrated orbital flight, SOI, patched conics or timewarp;
- a persistent or multiplayer universe authority;
- a complete ship builder;
- a complete cargo/mining/economy loop;
- a complete combat/damage/loot/repair loop;
- a mission, faction, reputation or outpost runtime.

## Unity Legacy Boundary

Unity archive material may be read for intended behavior, vocabulary, source
assets, historical bug traps and archived evidence. Do not copy MonoBehaviour
lifecycle, scene wiring, Rigidbody state, IMGUI or prototype fallback behavior
into browser domain authority.

Do not start or mutate a restored Unity archive during normal browser work
unless a task explicitly grants that scope. The active branch contains no Unity
project.

## Current Planning Priorities

The detailed ordering remains in
[`roadmap/living-master-plan.md`](roadmap/living-master-plan.md). Near-term gaps
are:

1. keep project truth, active specs and evidence indexes reconciled with
   `main`;
2. define how the celestial core integrates with shared trajectory prediction
   before calling it orbital gameplay;
3. connect resource/cargo contracts to loaded ship mass and flight authority;
4. build a player-facing Ship Builder MVP with validation and test-flight
   handoff;
5. specify surface target/local-frame transitions before surface gameplay;
6. design the planetary/voxel streaming and asset-conversion pipeline before
   creating large content volumes.
