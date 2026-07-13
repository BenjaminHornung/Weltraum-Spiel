# Current Project State

> The historical file name is retained because many specs and agent instructions link to it.

Stand: 2026-07-13  
Status snapshot: browser mainline after `8383487f89f6eb6e63140def564052ac86de259a`

## Product Mainline

The product mainline is the browser application under `apps/weltraum-browser`:

- Three.js `0.185.0`
- TypeScript `7.0.2`
- Vite `8.1.0`
- Vitest `4.1.9`
- Playwright `1.61.1`

The Unity implementation under `Assets/**` is legacy/reference/evidence. It remains useful for feature intent, terminology, assets, historical defects and scenario ideas, but it is not the default product runtime or verification path.

## Playable Browser State

The normal browser route `/` boots a playable local-space flight slice with:

- the Demo Scout GLB as the player-facing ship visual;
- a deterministic procedural fallback when the GLB cannot load;
- Cruise, Precision and Translation control modes;
- persistent throttle, main thrust, RCS, SAS, fuel, mass and braking authority;
- ChaseLocked, OrbitInspect, Side and FreeInspect camera modes;
- fixed-step runtime state with interpolated ship/camera presentation;
- runtime-owned targets, obstacles, routes and world contacts;
- a player HUD, local radar and navigation planner;
- explicit target selection, route preview, Engage and Cancel actions;
- local obstacle-aware planning, immutable route identity and typed fail-closed rejection states;
- terminal braking, capture, Arrival/Holding truth and continued station keeping.

The player runtime does not expose TestBridge. `window.TestBridge` is available only on the explicit test route `/?testBridge=1`.

## Current Objective Chain

The current live player-flow evidence proves the following through visible UI on `/`:

1. Range 500 m becomes available and produces an admitted route preview.
2. The player engages the exact visible preview hash.
3. The ship physically reaches Arrival/Holding without snap or velocity reset.
4. Range 1000 m unlocks and completes through the same runtime path.
5. Range 2500 m becomes available and exposes a new admitted preview with a distinct stable hash.

The latest recorded evidence completed Range 500 m at approximately 1.3 m final distance and Range 1000 m at approximately 1.0 m final distance. The Range 2500 m route is currently proven as a visible admitted preview, not as a required completed 2500 m arrival.

Primary evidence:

- `apps/weltraum-browser/evidence/browser-objective-chain-1000m-completion-v2.md`
- `.devtoolbox/specs/changes/browser-objective-chain-1000m-completion-v2/tests/test-protocol.md`
- `apps/weltraum-browser/tests/e2e/large-field-objective-chain-live.spec.ts`

## Navigation And Autopilot Truth

Current browser navigation follows these rules:

- A planner creates a `RoutePlan` before execution.
- A preview is display context until the exact route passes admission.
- Engage dispatches the exact visible/admitted `planHash`.
- The executor consumes one immutable locked plan.
- Equal planning inputs produce a stable route identity.
- The executor does not silently replace a route.
- Divergence, invalidation or current-state mismatch requires an explicit new plan.
- Fuel, braking reserve and flight authority fail closed.
- Arrival is based on runtime distance and relative-motion envelopes.
- Terminal capture and station keeping use the shared FlightController/actuator path.
- Completion moves the active route identity into historical `completedPlanHash` truth without re-exposing a completed preview as a new route.
- Renderer and HUD projections cannot authorize execution or manufacture Arrival/Holding.

The implemented planner remains local-space. It is not an orbital navigator, patched-conics planner, SOI planner, maneuver-node system or gravity-assist planner.

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

The navigation planner owns target/route actions. While it is open, held flight keys are cleared and manual flight input is suppressed.

## Implemented Foundations Beyond The Flight Slice

### World And Streaming

Implemented as deterministic foundations:

- absolute and local frame descriptors;
- floating-origin projection invariants;
- simulation-bubble membership;
- chunk registry and canonical signatures;
- Full/Snapshot/Dormant simulation residency;
- Near/Medium/Far/Culled render LOD;
- deterministic world-streaming transition and budget planning;
- render-only instanced asteroid presentation from runtime-owned descriptors.

Not implemented yet:

- production chunk IO or asset streaming;
- planet terrain or voxel terrain;
- surface-local runtime transitions;
- non-identity planetary frame conversion;
- persistent generated universe content.

### Resource And Cargo Core

Implemented as browser domain contracts:

- stable resource IDs and catalog entries;
- stack and capacity rules;
- containers, transfers and ownership metadata;
- legality/provenance fields;
- deterministic validation and canonical serialization.

Not implemented yet:

- active player-ship cargo runtime;
- cargo mass feeding flight/autopilot authority;
- mining, trading, inventory UI or persistence loop.

### Ship Builder Foundations

Implemented as domain and validation foundations:

- part categories and starter definitions;
- typed components and sockets;
- blueprint instances, connections and stable transforms;
- canonical serialization and migration seams;
- compatibility, occupancy and structural graph validation;
- dry-mass, center-of-mass and footprint bounds calculations.

Not implemented yet:

- player-facing placement/edit/mirror UI;
- complete propulsion, fuel, cargo, weapons, crew and gameplay-stat calculation;
- test-flight handoff or active-ship replacement;
- production art binding and save/load gameplay.

## UI State

The player-facing browser UI now uses the runtime flight HUD, local radar and navigation planner. Concept screenshots under `docs/UI-Screenshots/` guide visual direction but are not runtime truth.

Current UI boundaries:

- Flight and planner state are runtime-driven.
- Debug/TestBridge details are not part of the normal player HUD.
- Route geometry and route identity must come from the same locked/display plan.
- Blocked previews may remain visible as context only when typed admission rules allow it; they cannot enable Engage.
- Combat presentation exists only as a bounded UI/presentation slice. Do not claim a complete browser combat loop.

## Verification Contract

Run from `apps/weltraum-browser`:

```bash
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

The complete local Playwright discovery command is:

```bash
npm run test:e2e
```

Current CI also checks that every `tests/e2e/**/*.spec.ts` belongs to exactly one required E2E group and validates the required Demo Scout GLB and UI-reference binaries without pulling unrelated historical LFS content.

For visible runtime claims, prefer normal `/` Playwright flows using visible player controls. Use `?testBridge=1` only for explicitly synthetic or deterministic harness scenarios.

## Accepted Limits

The current project is not yet:

- a seamless planet-to-planet or space-to-surface game;
- a voxel planet/terrain runtime;
- an orbital mechanics or gravity simulation;
- a persistent open universe;
- a multiplayer universe authority/server implementation;
- a complete ship builder;
- a complete cargo/mining/economy loop;
- a complete combat/damage/loot/repair loop;
- a mission, faction, reputation or outpost runtime;
- a savegame/background-simulation product slice.

Long-term concepts such as voxelizing imported 3D assets, seamless planetary streaming and placing a new multiplayer player system into an unexplored region with a protected discovery buffer require dedicated architecture/spec work before implementation.

## Unity Legacy Boundary

Unity may be read for:

- intended player-visible behavior;
- vocabulary and edge cases;
- archived test scenarios and evidence;
- reusable asset sources such as the Demo Scout;
- historical bug traps.

Do not copy Unity architecture directly into the browser runtime. MonoBehaviour lifecycle, scene wiring, Rigidbody state, IMGUI and prototype fallbacks are not browser domain authority.

Do not start Unity or change `Assets/**` during normal browser work unless the task explicitly grants that scope.

## Current Planning Priorities

The detailed ordering remains in `docs/roadmap/living-master-plan.md`. The nearest high-value gaps are:

1. keep project truth, active specs and evidence indexes reconciled with `main`;
2. connect resource/cargo contracts to loaded ship mass and flight authority;
3. build a player-facing Ship Builder MVP with validation and test-flight handoff;
4. specify and implement surface target/local-frame transitions before surface gameplay;
5. design the real-scale planetary/voxel streaming and asset-conversion pipeline before creating large content volumes;
6. introduce orbit, gravity, SOI and timewarp only on a shared deterministic trajectory-prediction foundation.
