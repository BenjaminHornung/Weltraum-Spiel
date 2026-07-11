# Test Protocol: browser-live-world-presentation-truth-v1

## Scope

This protocol captures evidence for deterministic live-world presentation truth projection and renderer decoupling:

- pure telemetry-to-presentation adapter behavior,
- route identity + segment order integrity,
- non-authoritative rendering with explicit truth/decorative separation,
- `/` vs query-gated tooling behavior,
- full regression and forbidden-path guardrails.

## Required command set (mandatory)

```powershell
# 1) Spec validation
mcp__servicerunner__.specs_validate `
  -workspaceRoot "C:\IFI_SourceCode\WT\weltraum-spiel-browser-live-world-presentation-truth-v1" `
  -changeName "browser-live-world-presentation-truth-v1"

# 2) Implementation task checkpoints
mcp__servicerunner__.execution_create -workspaceRoot "C:\IFI_SourceCode\WT\weltraum-spiel-browser-live-world-presentation-truth-v1" -changeName "browser-live-world-presentation-truth-v1" -taskName "task1-pure-contract"
mcp__servicerunner__.verify_plan
mcp__servicerunner__.verify_run
npm run test -- tests/unit/worldPresentation.test.ts
# Reload tasks.md and use Task 1's current sourceLine.
mcp__servicerunner__.tasks_completion_preflight
mcp__servicerunner__.tasks_toggle
git commit -m "Define telemetry presentation contracts and unit coverage"

mcp__servicerunner__.execution_create -workspaceRoot "C:\IFI_SourceCode\WT\weltraum-spiel-browser-live-world-presentation-truth-v1" -changeName "browser-live-world-presentation-truth-v1" -taskName "task2-renderer-seam"
mcp__servicerunner__.verify_plan
mcp__servicerunner__.verify_run
npm run test -- tests/unit/worldPresentation.test.ts tests/unit/worldPresentationRenderer.test.ts
# Reload tasks.md and use Task 2's current sourceLine.
mcp__servicerunner__.tasks_completion_preflight
mcp__servicerunner__.tasks_toggle
git commit -m "Add world presentation renderer and debug scene contract"

# 3) Unit, build, and full app sanity
npm run test -- tests/unit/worldPresentation.test.ts
npm run test -- tests/unit/worldPresentationRenderer.test.ts
npm run test
npm run build

# 4) Playwright evidence set
mcp__servicerunner__.execution_create -workspaceRoot "C:\IFI_SourceCode\WT\weltraum-spiel-browser-live-world-presentation-truth-v1" -changeName "browser-live-world-presentation-truth-v1" -taskName "task3-evidence"
mcp__servicerunner__.verify_plan
mcp__servicerunner__.verify_run
npm run test:e2e -- tests/e2e/live-world-presentation-truth.spec.ts
# Reload tasks.md and use Task 3's current sourceLine.
mcp__servicerunner__.tasks_completion_preflight
mcp__servicerunner__.tasks_toggle
git commit -m "Add live-world presentation truth E2E evidence coverage"
npm run test:e2e -- tests/e2e/playable-large-field-live-flight.spec.ts
npm run test:e2e -- tests/e2e/playable-large-proving-ground.spec.ts
npm run test:e2e -- tests/e2e/normal-runtime-functional-planner.spec.ts
npm run test:e2e -- tests/e2e/debug-scene.spec.ts
npm run test:e2e -- tests/e2e/flight-ui-foundation.spec.ts
npm run test:e2e -- tests/e2e/world-chunk-streaming.spec.ts
npm run test:e2e -- tests/e2e/multi-obstacle-planner.spec.ts

# 5) Evidence and regression checks
git diff --check

# 6) Final task verification (completion follows the audit below)
mcp__servicerunner__.execution_create -workspaceRoot "C:\IFI_SourceCode\WT\weltraum-spiel-browser-live-world-presentation-truth-v1" -changeName "browser-live-world-presentation-truth-v1" -taskName "task4-full-regression"
mcp__servicerunner__.verify_plan
mcp__servicerunner__.verify_run
git fetch origin main
git rebase origin/main
npm run test
Get-ChildItem "apps/weltraum-browser/evidence" -Filter "*.json" | ForEach-Object { Get-Content $_.FullName | ConvertFrom-Json | Out-Null }
```

## Forbidden-path audit (allowlist, not blanket deny)

```powershell
$allowPatterns = @(
  '^\.devtoolbox/specs/changes/browser-live-world-presentation-truth-v1/',
  '^docs/browser-mainline/live-world-presentation-truth-v1\.md$',
  '^apps/weltraum-browser/src/world/worldPresentation\.ts$',
  '^apps/weltraum-browser/src/render/three/worldPresentationRenderer\.ts$',
  '^apps/weltraum-browser/src/render/three/debugScene\.ts$',
  '^apps/weltraum-browser/src/world/provingGroundWorld\.ts$',
  '^apps/weltraum-browser/tests/unit/worldPresentation\.test\.ts$',
  '^apps/weltraum-browser/tests/unit/worldPresentationRenderer\.test\.ts$',
  '^apps/weltraum-browser/tests/e2e/live-world-presentation-truth\.spec\.ts$',
  '^apps/weltraum-browser/evidence/browser-live-world-presentation-truth-v1.*',
  '^apps/weltraum-browser/evidence/live-world-.*\.png$'
)

$diff = git diff --name-only origin/main -- .
$violations = @()
foreach ($file in $diff) {
  $allowed = $false
  foreach ($pattern in $allowPatterns) {
    if ($file -match $pattern) { $allowed = $true; break }
  }
  if (-not $allowed) {
    if ($file -match '^Assets/' -or
        $file -match 'package(-lock)?\.json$' -or
        $file -match '^apps/weltraum-browser/src/main\.ts$' -or
        $file -match '^apps/weltraum-browser/src/ui/' -or
        $file -match '^apps/weltraum-browser/src/runtime/' -or
        $file -match '/planner' -or
        $file -match '/plannerMap\.ts$' -or
        $file -match '/flight/planner/') {
      $violations += $file
    }
  }
}

if ($violations.Count -gt 0) { throw "Forbidden-path audit failed: $($violations -join ', ')" }
```

## Task 4 completion checkpoint

Run only after every command above, JSON parsing, and the forbidden-path audit succeed.

```powershell
# Reload tasks.md and use Task 4's current sourceLine.
mcp__servicerunner__.tasks_completion_preflight
mcp__servicerunner__.tasks_toggle
git commit -m "Run full regression and complete task evidence"
```

## Evidence matrix

1. Snapshot determinism
   - `frameId` is the stable semantic-frame identity.
   - `WorldPresentationSnapshot` signature changes with semantic snapshot changes.
   - `renderFrameRevision` changes with local projection updates and does not change signature.
   - floating-origin-only transform-only updates may change `renderFrameRevision` while keeping absolute semantic relationships unchanged.
2. Route + segment integrity
   - `sourcePlanHash` controls route identity; `activeSegmentId` may remain null in preview and progress on executor-owned completion for the same route.
   - exact segment order equals source route order.
   - same hash + changed geometry is blocked.
   - route-relative distances (`distanceToTarget`, `offRouteDistance`) are null/absent unless the preview route is linked to current `planHash` or executor `completedPlanHash`.
   - when both preview and locked routes are absent for the current target context, route-relative distance fields are null/absent.
   - when neither a preview plan nor a locked plan exists, `route` is `null`.
   - when a preview source plan remains, its visibility is `hidden` if it is stale, completed, current selection is null, or its `sourceTargetId` mismatches current selection.
   - preview same-target non-admissible transitions are `blocked`.
   - executor lifecycle/progress visibility inherits when either executor `sourcePlanHash` or completed-route hash matches.
3. Target and focus
   - `selectedTarget` remains distinct from `navigationFocusTarget`.
   - `selectedTarget` uses exact source-projected coordinates with no target-specific render offsets.
   - preview-to-locked transition keeps equal hash/geometry when source input is equal.
   - at most one beacon is produced from `navigationFocusTarget`, and that beacon is truth-backed.
4. Obstacle truth/decor
   - `truthBackedObstacleProxyCount` is based on render-eligible truth proxies.
   - in fixed proving-ground v1 evidence, `truthBackedObstacleProxyCount` equals `runtimeTruthObstacleCount`; otherwise strict subset is accepted.
   - decor counts are separate and excluded from collision/radar.
5. Renderer contract
   - add/update/remove/dispose operations recorded only through renderer lifecycle.
   - runtime states never mutated (`rendererOwnsWorldTruth = false`).
6. Mode behavior
   - `/` path has no TestBridge and retains target/route/obstacle visibility.
   - `?testBridge=1` shows additional evidence-only state.
   - visibility state and reason are reported for route proxies (`routeProxyVisibility`) and focus beacon count (`navigationFocusBeaconCount`).

## Result capture template

- `mcp__servicerunner__.specs_validate`: status
- `tests/unit/worldPresentation.test.ts`: pass/fail + count
- `tests/unit/worldPresentationRenderer.test.ts`: pass/fail + count
- `npm run test`: pass/fail + count
- `npm run build`: pass/fail
- each `test:e2e` command above: pass/fail + count
- `git diff --check`: pass/fail
- JSON parse checks: pass/fail for each new evidence JSON
- `forbidden-path audit`: pass/fail + violation list

## Required evidence artifacts

- `apps/weltraum-browser/evidence/browser-live-world-presentation-truth-v1.md`
- `apps/weltraum-browser/evidence/browser-live-world-presentation-truth-v1-summary.json`
- `apps/weltraum-browser/evidence/live-world-preview-route.png`
- `apps/weltraum-browser/evidence/live-world-locked-route.png`
- `apps/weltraum-browser/evidence/live-world-obstacle-proxies.png`
