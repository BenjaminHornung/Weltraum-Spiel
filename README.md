# Weltraum-Spiel

Browser-based low-poly spaceflight prototype with deterministic flight, navigation and evidence-driven development.

> **Product mainline:** `apps/weltraum-browser` using Three.js, TypeScript, Vite, Vitest and Playwright.
> **Legacy/reference:** the immutable Unity snapshot at tag `unity-legacy-final-2026-07` and branch `archive/unity-legacy-final-2026-07`. No active Unity project exists on this branch.

> [!IMPORTANT]
> This repository is **source-available, not open source**. Original project code and assets may be used, modified and redistributed only for noncommercial purposes under the [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use, sale, monetized distribution, paid hosting, integration into a commercial product, or use with an anticipated commercial application requires a separate written license from Benjamin Hornung.

## Current State

The current browser runtime provides a playable local-space flight slice:

- Demo Scout GLB as the player-facing ship visual, with a procedural fallback if loading fails.
- Runtime-bound main-engine and RCS nozzle VFX driven by actuator telemetry rather than raw input.
- Cruise, Precision and Translation control modes.
- Main thrust, RCS, SAS, fuel, mass, braking reserve and flight-authority contracts.
- Chase, orbit, side and free-inspection camera modes with interpolated presentation.
- Runtime-owned targets, obstacles, route previews and world contacts rendered through Three.js.
- A local navigation planner with explicit route preview and engage/cancel actions.
- Immutable locked plans, stable `planHash`, no silent executor replan, bang-bang transit profiles, terminal capture and station keeping.
- Fail-closed fuel, braking and authority admission gates.
- Player HUD, local radar and navigation-planner presentation based on runtime snapshots rather than renderer state.
- A live objective chain that completes real Range 500 m and Range 1000 m arrivals and then exposes an admitted Range 2500 m preview.
- Deterministic world/chunk/LOD/floating-origin foundations.
- A pure browser celestial/gravity core with validated Aurelia-system identities, deterministic elliptic Kepler propagation and local inverse-square gravity queries. It is not yet connected to flight, navigation, rendering or UI.
- Pure Combat and Persistence/Universe-Time/Event domain cores with deterministic contracts and normal-route Browser evidence. They are not yet playable combat or save/load systems.
- Resource/cargo domain foundations. These are data and validation cores, not complete player-facing gameplay systems.
- Ship Builder part/blueprint foundations plus deterministic stats, handling diagnostics and static flight-readiness reports. There is still no player-facing Builder UI, runtime handoff or active-ship replacement.
- A player-facing Graphics dialog with versioned presets, strict local preference storage and a presentation-only Three.js adapter. Graphics choices do not alter simulation, navigation or world truth.

The delivered `surfaceLab=1` route is a technical voxel/worker/mesh/render proving ground only. It is not player-facing voxel terrain or surface gameplay; no player-facing voxel terrain/gameplay is delivered by this route.

The browser runtime does **not** yet provide full planets, player-facing voxel terrain/gameplay, orbital flight, SOI or patched-conics navigation, seamless surface transitions, production multiplayer, a playable ship-builder UI, persistent cargo gameplay, full combat, economy or missions.

For the detailed snapshot, see [docs/current-mainline-state.md](docs/current-mainline-state.md). The longer planning index is [docs/roadmap/living-master-plan.md](docs/roadmap/living-master-plan.md).

## Quick Start

Requirements:

- Node.js 22
- npm
- A current Chromium-based browser or Firefox for local use

```bash
cd apps/weltraum-browser
npm ci
npm run dev
```

Vite prints the local development URL. The normal player runtime is `/`.

`window.TestBridge` is intentionally unavailable on the normal route. Test-only deterministic APIs are exposed only when the application is opened with `?testBridge=1`.

## Browser Controls

| Input | Action |
| --- | --- |
| `W` / `S` | Pitch in Cruise/Precision; forward/back translation in Translation mode |
| `A` / `D` | Yaw in Cruise/Precision; lateral translation in Translation mode |
| `Q` / `E` | Roll |
| `H` / `N` | Vertical translation in Translation mode |
| `Left Shift` / `Left Control` | Increase/decrease persistent main throttle |
| `X` | Cut throttle |
| `Y` or `Z` | Full throttle |
| `R` | Toggle RCS |
| `T` | Toggle SAS |
| `Caps Lock` | Cycle Cruise, Precision and Translation modes |
| `V` | Cycle camera mode |
| Right mouse button | Orbit/look around the ship |
| Mouse wheel | Change inspection distance |

Target selection, route preview, engagement and cancellation are performed through the visible navigation-planner UI. Opening the planner suppresses held flight input so UI interaction does not continue commanding the ship.

## Verification

Run commands from `apps/weltraum-browser`:

```bash
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

For a complete local Playwright discovery run:

```bash
npm run test:e2e
```

The grouped E2E scripts are also the required GitHub Actions gates. Current toolchain versions are pinned in `apps/weltraum-browser/package.json`, including TypeScript 7.0.2, Three.js 0.185.0, Vite 8.1.0, Vitest 4.1.9 and Playwright 1.61.1.

On Windows, Playwright may need an installed Chrome/Chromium executable when the bundled browser cannot start:

```powershell
$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

## Runtime Guardrails

These rules define browser-mainline correctness:

- No fake flight progression, target snap, waypoint snap or velocity-zero shortcut.
- A planner creates a route first; the executor runs exactly the admitted locked plan.
- No silent replan. Divergence or invalidation must remain visible and require an explicit new plan.
- `planHash` must remain stable for equal plan inputs and immutable during execution.
- Terminal capture and holding remain FlightController/runtime-owned.
- Three.js, CSS and HUD rendering are projections, never gameplay or world truth.
- Celestial ephemeris and gravity truth remain deterministic pure data/math until an explicit runtime integration owns their use.
- The Demo Scout GLB path and procedural fallback must both remain functional.
- TestBridge is evidence infrastructure only and must remain query-gated.

## Repository Map

```text
apps/weltraum-browser/          Browser product mainline
  src/                          Runtime, flight, navigation, celestial, world, UI and Three.js adapter
  tests/unit/                   Vitest domain and integration coverage
  tests/e2e/                    Playwright player-flow and harness coverage
  evidence/                     Markdown, JSON and screenshot evidence
  public/ships/                 Browser ship assets

docs/browser-mainline/          Browser architecture, testing, CI and transition docs
docs/current-mainline-state.md  Current browser product status
docs/roadmap/                   Living plan and milestone planning
docs/architecture/              Cross-cutting architecture contracts
docs/ux/                        Player UI, input and flow contracts
docs/legacy-unity/              Historical Unity intent and evidence references
art/                            Neutral reusable source art and exports
.devtoolbox/specs/changes/       Change specs, tasks and verification records
```

## Evidence

Player-facing and domain claims should be backed by tests and inspectable artifacts. Important current evidence includes:

- `apps/weltraum-browser/evidence/browser-objective-chain-1000m-completion-v2.md`
- `apps/weltraum-browser/evidence/browser-live-large-field-flight-acceptance-v1.md`
- `apps/weltraum-browser/evidence/browser-autopilot-terminal-capture-v1.md`
- `apps/weltraum-browser/evidence/browser-world-chunk-registry-streaming-v1.md`
- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1.md`
- `apps/weltraum-browser/evidence/browser-combat-weapon-damage-core-v1.md`
- `apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1.md`
- `apps/weltraum-browser/evidence/browser-ship-builder-full-stats-flight-readiness-v1.md`
- `apps/weltraum-browser/evidence/demo-scout-nozzle-vfx-snapshot.json`
- `.devtoolbox/specs/changes/archive/2026-07-13-browser-objective-chain-1000m-completion-v2/tests/test-protocol.md`

Concept images under `docs/UI-Screenshots/` are design references. They do not prove runtime behavior.

## Unity Legacy Boundary

The archived Unity prototype remains useful for feature intent, terminology, historical behavior, assets and regression scenarios. Read it through `unity-legacy-final-2026-07:<path>` or the curated records under `docs/legacy-unity`; reusable retained sources live under `art/`.

The old Unity-specific setup, controls and implementation notes remain available through the immutable archive refs, repository history and legacy documentation. They are no longer the root README or product onboarding path.

## Contributions and Security

All changes must arrive through a pull request. The current PR head must pass Browser Mainline CI, the Codex gate where applicable, and the exact-head owner approval gate. See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution contract and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Original project code and assets are licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). This license permits noncommercial study, experimentation, modification and redistribution subject to its terms. It does **not** permit commercial use. Third-party packages, tools and separately identified materials remain subject to their own licenses.
