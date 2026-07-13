# Weltraum-Spiel

Weltraum-Spiel is developed as a browser-native TypeScript/Three.js game. The
product mainline lives in [`apps/weltraum-browser`](apps/weltraum-browser).

Unity is not present as an active project on this branch. The final historical
Unity snapshot is available through the tag `unity-legacy-final-2026-07` and
the branch `archive/unity-legacy-final-2026-07`.

## Prerequisites

- Node.js 22 (the version used by CI)
- npm
- Chromium support for Playwright E2E runs

## Install

```bash
cd apps/weltraum-browser
npm ci
```

Package and lockfile changes are intentionally avoided unless a product change
requires them.

## Development

```bash
npm run dev
```

Vite prints the local URL. The normal `/` route must not expose `TestBridge`;
automation-only access is explicitly gated by `?testBridge=1`.

## Verification

Run unit tests and the production build:

```bash
npm run test
npm run build
```

Install Playwright's Chromium runtime when needed, then run the three CI groups:

```bash
npx playwright install chromium
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

The aggregate `npm run test:e2e` command runs every Playwright spec. CI also
checks that every E2E spec belongs to exactly one of the three named groups.

## Architecture principles

- Deterministic core/simulation state owns gameplay truth; Three.js renders
  snapshots.
- UI renders ViewModels/owner snapshots and sends commands. It does not derive
  hidden planner, fuel, authority or route truth.
- Autopilot separates target resolution, planner, immutable plan, executor and
  diagnostics.
- The executor runs exactly the locked plan. There is no silent replan, and the
  plan keeps a stable `planHash`.
- There is no fake progression, target/waypoint/position snap or velocity-zero
  shortcut.
- The Demo Scout GLB and `ProceduralFallback` are both supported render paths;
  neither renderer path owns simulation state.

Start with [`docs/current-mainline-state.md`](docs/current-mainline-state.md)
and [`docs/browser-mainline`](docs/browser-mainline) for the current product
state, architecture decision, feature-intent index, bug traps, testing strategy
and port roadmap.

Neutral art sources and exports live under [`art`](art). Historical Unity
intent and source evidence live under
[`docs/legacy-unity`](docs/legacy-unity); they are reference material, not a
second implementation target.
