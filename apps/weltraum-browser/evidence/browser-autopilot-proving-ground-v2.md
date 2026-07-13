# Browser Autopilot Proving Ground v2 Evidence

## Initial Baseline

- Change: `browser-autopilot-proving-ground-v2`
- Branch: `feature/browser-autopilot-proving-ground-v2`
- Base: `origin/main` at `3baa6b93669e9fb546dd49cc8254b04ce50c11c6`
- Baseline context: terminal capture v1 is the preserved safety baseline for no snap, no velocity-zero shortcut, no silent replan, stable `planHash`, and HUD snapshot/ViewModel consumer behavior.

> Repository cleanup note (2026-07-13): `Assets/**` below is the original
> capture-time path. The immutable Unity snapshot is available at
> `unity-legacy-final-2026-07:Assets/**`; retained reusable art is under `art/`.

## Planned Evidence Paths

- Spec artifacts: `.devtoolbox/specs/changes/browser-autopilot-proving-ground-v2/`
- Browser evidence summary: `apps/weltraum-browser/evidence/browser-autopilot-proving-ground-v2.md`
- Planned browser E2E/TestBridge evidence: record course ID, speed profile, scenario classification, terminal envelope result, obstacle clearance, and `planHash` stability.
- Planned verification status: include exact unit/E2E command results once implementation exists.

## Implementation Evidence - 2026-07-02

- Browser-only implementation. Unity was not started and no `Assets/**` files were intentionally edited.
- Course catalog added with 11 local-space courses: `direct-long`, `s-curve-obstacles`, `narrow-corridor`, `offset-gates`, `target-behind-obstacle`, `target-near-obstacle`, `high-initial-speed`, `lateral-initial-velocity`, `low-authority-terminal`, `low-fuel-long-route`, `off-route-disturbance-midcourse`.
- Speed profiles: `Safe`, `Balanced`, `Fast`. Profiles only change desired route speeds and non-terminal brake-margin metadata; executor `maxAcceleration`, `StopWithinEnvelope`, `terminalSpeed`, no-snap, no-zero, no-silent-replan and stable `planHash` gates remain tested.
- Obstacle clearance formula in v2 results: closest sampled ship position distance to obstacle center minus `(obstacle.radius + obstacle.padding)`. Empty-obstacle courses report the sentinel clearance `999999`.
- Matrix classification summary from `apps/weltraum-browser/evidence/autopilot-proving-ground-v2-summary.json`: `Pass=7`, `KnownStress=2`, `ExpectedFail=2`.
- `KnownStress`: `s-curve-obstacles`, `narrow-corridor` document the current one-blocking-obstacle planner limit instead of pretending multi-obstacle corridors are solved.
- `ExpectedFail`: `low-fuel-long-route`, `off-route-disturbance-midcourse` document fuel/invalidation contracts and explicit `replanRequired` without silent replans.

## Speed Profile Measurement

`direct-long` was measured in browser via the gated TestBridge E2E harness:

| Profile | Ticks to arrival | Peak speed | Final speed | Classification |
| --- | ---: | ---: | ---: | --- |
| Safe | 769 | 12 | <= 0.5 | Pass |
| Balanced | 620 | 18 | 0.4951 | Pass |

Balanced is therefore measurably faster than Safe on the same course while still satisfying the 0.5 m/s terminal-speed gate.

## Verification Run

- `npm ci` from `apps/weltraum-browser`: passed; installed local browser dependencies for this worktree.
- First `npm run test` attempt before `npm ci`: failed because `vitest` was not installed in this worktree.
- `npm run test` from `apps/weltraum-browser`: passed, 9 files / 99 tests.
- Focused E2E with Chrome fallback initially blocked on port `5173` because another worktree's Vite server was already listening there and the project config has `reuseExistingServer:false`.
- Focused E2E was then run with a temporary local Playwright config on port `5174`, using `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"`; passed, 2/2 tests. The temporary config was deleted after the run.

## Evidence Artifacts

- `apps/weltraum-browser/evidence/autopilot-proving-ground-v2-summary.json`
- `apps/weltraum-browser/evidence/autopilot-proving-ground-v2-direct-long.png`
- `apps/weltraum-browser/evidence/autopilot-proving-ground-v2-corridor.png`
- `apps/weltraum-browser/evidence/autopilot-proving-ground-v2-speed-profile.png`
- E2E trace/report output under `apps/weltraum-browser/evidence/playwright-output/` and `apps/weltraum-browser/evidence/playwright-report/`.

## Guardrails For Future Evidence

- Do not use Unity or modify `Assets/**` for this browser proving-ground change.
- Preserve GLBLoaded/procedural fallback/TestBridge query gating.
- Preserve terminal capture v1 invariants.
- Record any `KnownStress` scenario as a documented current planner limit, not as a hidden pass.
