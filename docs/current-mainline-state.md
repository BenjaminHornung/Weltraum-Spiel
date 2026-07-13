# Current Browser Mainline State

Date: 2026-07-13

## Product mainline

The active product is the TypeScript/Three.js browser application under
`apps/weltraum-browser`. Unity is no longer a second product architecture on
the active branch; its final repository snapshot is preserved by
`unity-legacy-final-2026-07` and
`archive/unity-legacy-final-2026-07`.

## Runtime state

The browser mainline currently provides:

- a deterministic fixed-step simulation with explicit ship, flight, fuel,
  mass, authority and actuator snapshots;
- desktop manual flight with Cruise, Precision and Translation control modes,
  RCS/SAS state and a chase-locked camera presentation;
- target resolution, deterministic route planning, stable `planHash`, locked-
  plan execution, explicit invalidation/replan-required state and terminal
  capture without target/position snap or velocity-zero shortcuts;
- local obstacle routing, proving-ground/long-range scenarios and explicit
  known-stress/expected-fail evidence;
- browser world/chunk/objective foundations, navigation-map world truth,
  resource/cargo contracts, ship-builder domain/compatibility contracts,
  celestial/gravity foundations, combat/damage contracts and persistence/time
  foundations;
- a Demo Scout GLB render adapter with marker validation and an explicit
  `ProceduralFallback`; renderer objects never own gameplay truth;
- player HUD and UI snapshots separated from diagnostics and a TestBridge that
  is available only with `?testBridge=1`.

The feature-intent inventory and port boundaries are maintained in
[`browser-mainline/feature-intent-index.md`](browser-mainline/feature-intent-index.md)
and [`browser-mainline/port-roadmap.md`](browser-mainline/port-roadmap.md).

## Authoritative verification surfaces

Unit coverage is under `apps/weltraum-browser/tests/unit`; Playwright coverage
is under `apps/weltraum-browser/tests/e2e`. The package exposes these gates:

```text
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

The workflow
[`browser-mainline-ci.yml`](../.github/workflows/browser-mainline-ci.yml)
enforces exact, unique membership of every `tests/e2e/**/*.spec.ts` file in one
of the three E2E groups. It also validates top-level evidence JSON and restores
and checks the required browser baselines.

## Required runtime and evidence assets

- `apps/weltraum-browser/public/ships/demo_scout_mk1.glb` is the unchanged
  runtime Demo Scout asset; the source export lives under
  `art/source/ships/prototype-ship-kit`.
- The four `ui-concept-parity-v1-rejected-*.png` files under browser evidence
  are required comparison baselines.
- Current Markdown, JSON and screenshot evidence remains under
  `apps/weltraum-browser/evidence`.

## Architectural invariants

- Simulation/core state is authoritative; Three.js renders snapshots.
- UI renders owner snapshots/ViewModels and sends commands.
- Planner, immutable plan, executor and diagnostics remain separate.
- The executor executes exactly the locked plan and never silently replans.
- A plan keeps its stable `planHash` throughout execution.
- No fake progression, target/waypoint/position snap or velocity-zero shortcut.
- No Package/lockfile changes are needed for repository cleanup.

## Historical Unity state

The last detailed Unity prototype report moved to
[`legacy-unity/current-prototype-state-2026-06-15.md`](legacy-unity/current-prototype-state-2026-06-15.md).
It is historical evidence only and must not be read as current product status.
