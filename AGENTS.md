# AGENTS.md - Weltraum-Spiel

## Product rule

The product mainline is the browser-native TypeScript/Three.js application.
Work spec-first, in small verifiable slices, and record evidence. Do not create
a second runtime architecture from historical Unity material.

Unity exists only in `unity-legacy-final-2026-07` and
`archive/unity-legacy-final-2026-07`. Files under `docs/legacy-unity` are
behavior/art/evidence references, not implementation targets.

## Main paths

```text
apps/weltraum-browser/        Product runtime, tests and browser evidence
docs/browser-mainline/        Architecture, intent, testing and roadmap
docs/current-mainline-state.md Current product status
docs/spielkonzept/            Product and game-design concepts
docs/legacy-unity/            Historical reference only
art/                          Neutral source art, exports and validation
.devtoolbox/specs/changes/    Active browser/cross-platform specs and archives
.agent/PLANS.md               ExecPlan rules
```

## Before each task

1. Read this file and the relevant spec.
2. Read `docs/current-mainline-state.md` and relevant browser design audits.
3. Write a short plan; use an ExecPlan for cross-layer or high-risk work.
4. Work only in the agreed scope and keep browser evidence attributable.

## Architecture invariants

- Core/simulation state is gameplay truth; Three.js is a render adapter.
- UI renders owner snapshots/ViewModels and sends commands; it does not inspect
  planner internals or recompute route/fuel/authority truth.
- Keep planner, immutable plan, executor and diagnostics separate.
- `planHash` is stable and the executor runs exactly the locked plan.
- No silent replan and no hidden plan replacement.
- No fake progression, target/waypoint/position snap or velocity-zero shortcut.
- `TestBridge` is available only with the explicit `?testBridge=1` query gate.
- Keep Demo Scout GLB and `ProceduralFallback`; neither owns gameplay state.
- Do not change Planner, Executor, FlightController, rendering truth or UI
  behavior in repository-only cleanup work.
- Do not change package manifests or lockfiles without a necessary product or
  tooling reason.

## Standard verification

Run from `apps/weltraum-browser`:

```text
npm ci
npm run test
npm run build
```

Run the Playwright groups relevant to the change. For mainline, shared runtime,
CI or repository-wide changes, run all three:

```text
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

Also run the Playwright group-membership validation from
`.github/workflows/browser-mainline-ci.yml` when test files or group scripts
change. Visible UI/runtime changes require an attributable screenshot matrix;
repository-only cleanup must not refresh runtime screenshots.

## DevToolbox workflow

When available for the active workspace, use:

```text
workspace_prepare_for_agent
specs_get_status
tasks_load
execution_create
verify_run
tasks_completion_preflight
tasks_toggle
```

Never close a task checkbox without evidence and completion preflight. Preserve
open browser and cross-platform work; archive historical Unity records without
presenting them as current product work.

## UI and evidence rules

- Keep player UI and diagnostics/TestBridge surfaces separate.
- Keep the current mode visible and one primary action per context.
- Avoid generic glass/gradient dashboards, icon soup and unnecessary floating
  cards.
- Do not delete browser screenshots, JSON, Markdown evidence or CI baselines
  merely because they are currently unreferenced. Only clearly generated,
  unreferenced logs are cleanup candidates.

## Complex work

Use a living ExecPlan following `.agent/PLANS.md` for repository cleanup, world
streaming, Ship Builder, planet runtime and other multi-step work.
