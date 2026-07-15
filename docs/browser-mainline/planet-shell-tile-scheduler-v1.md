# Planet Shell Tile Scheduler V1

## Status and boundary

The V1 planet-shell core is deterministic TypeScript under
`apps/weltraum-browser/src/planet/`. It owns cube-sphere tile identity,
conservative bounds, screen-space-error selection, frustum and horizon culling,
revisioned readiness, load intent, and atomic parent/child coverage. It does not
own Three.js objects, browser state, floating-origin state, local voxels, terrain
streaming, collision, or product geology.

`planetPresentationAdapter.ts` remains the only boundary from planet-core output
to the existing presentation contracts. It maps accepted, render-ready core
coverage to `VisibilityPlan`, converts explicit core load requests to load jobs,
and does not infer additional work from visibility.

## Hestia orbit diagnostic harness

The separate harness is exported from:

`/src/planet/harness/hestiaOrbitHarness.ts`

The browser test first loads normal `/` and proves that `window.TestBridge` is
absent. It then dynamically imports the module through Vite and calls
`mountHestiaOrbitHarness(document.body)`. The E2E viewport is fixed at
`1920x1080`, and the harness canvas fills that viewport. The harness exposes
explicit synchronous controller methods for every state. There is no animation,
timer, random input, main-route wiring, or TestBridge dependency.

The visible shell uses generated root and `+Z` child meshes, the existing Three
render backend, and the single planet presentation adapter. Body radius, bounds,
camera inputs, tile IDs, and readiness remain in physical core units. The
smaller visual radius is applied only through frame-projection transforms.

## Deterministic state sequence

| State | Selection / readiness revisions | Core evidence | Visible outcome | Screenshot |
|---|---:|---|---|---|
| `far-orbit` | `101 / 201` | coarse root selection and `culled-horizon` for the `-Z` root | cyan coarse shell at far visual scale | `planet-shell-far-orbit.png` |
| `near-orbit` | `102 / 202` | `primary-max-level` at fixed level zero | cyan coarse shell at near visual scale | not captured |
| `parent-fallback` | `103 / 203` | one `+Z` child is loading; `fallback-incomplete-child-coverage` | cyan parent remains visible; all four children remain hidden | `planet-shell-near-orbit-parent-fallback.png` |
| `child-ready` | `104 / 204` | all required `+Z` children are render-ready; `parent-hidden-complete-child-coverage` | four green children appear atomically and the parent is hidden but resident | `planet-shell-near-orbit-child-ready.png` |
| `evicted` | `105 / 205` | one active child becomes `evicted`; `requested-child-evicted` | all children hide and the cyan parent reactivates without a hole | not captured |

The E2E resets the backend, rehydrates the same deterministic artifacts, repeats
all five states, and deep-compares IDs, reasons, revisions, requests, coverage,
and visible keys. It also requires empty console-error, page-error, failed-request,
and HTTP-error collections.

## Evidence and verification

The focused browser spec is
`apps/weltraum-browser/tests/e2e/planet-shell-tile-scheduler.spec.ts`. Its three
baseline PNGs live beside the spec in
`planet-shell-tile-scheduler.spec.ts-snapshots/`; the same exact filenames are
written to `apps/weltraum-browser/evidence/`.

Run from `apps/weltraum-browser`:

```powershell
npx tsc -p tsconfig.json
$env:UPDATE_PLANET_SHELL_SNAPSHOTS = "1"
npm run test:e2e -- tests/e2e/planet-shell-tile-scheduler.spec.ts
Remove-Item Env:UPDATE_PLANET_SHELL_SNAPSHOTS
npm run test:e2e -- tests/e2e/planet-shell-tile-scheduler.spec.ts
```

Only the explicit `UPDATE_PLANET_SHELL_SNAPSHOTS=1` run may replace baselines.
The normal focused command reads and compares existing baselines; a missing
baseline fails instead of being generated implicitly.

The initial change deliberately does not edit package scripts, lockfiles, CI
groups, `main.ts`, `style.css`, or render-backend/presentation core. Assigning the
new spec to a package-level E2E group remains deferred until the documented
post-Surface-Lab synchronization gate.
