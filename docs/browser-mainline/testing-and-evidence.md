# Browser Mainline Testing And Evidence

## Principle

Mainline browser features are not complete by feel. They need deterministic tests and recorded evidence that can be inspected without Unity.

Source paths:

- `docs/legacy-unity/current-prototype-state-2026-06-15.md`
- `docs/legacy-unity/architecture/autopilot-v2-test-harness.md`
- `docs/legacy-unity/architecture/prototype-legacy-boundary-audit-2026-06-15.md`
- `docs/legacy-unity/source-evidence/current-core-inventory.md`
- `docs/legacy-unity/source-evidence/unity-to-threejs-port-map.json`
- `docs/legacy-unity/source-evidence/threejs-spike-test-summary.md`
- `docs/legacy-unity/source-evidence/threejs-spike-decision-report.md`
- historical external package input "docs/testing-and-evidence-strategy.md" (not a live repo path in this worktree)

## Evidence Levels

```text
Unit tests
  Core, math, frame conversion, planner, executor, fuel, authority.

Integration/scenario tests
  Renderer-free scenario runner using fixed-step simulation and scenario fixtures.

Browser E2E tests
  Playwright, TestBridge, telemetry JSON, screenshots, mobile/desktop smoke.

Visual smoke tests
  Canvas nonblank, expected route/ship/target/obstacle/HUD elements visible.

Performance smoke tests
  Bundle size note, object counts, scenario runtime, obvious world-loop budget checks.
```

## Required Proving-Ground Matrix

| Scenario | Proves | Minimum assertions |
| --- | --- | --- |
| Direct local arrival | Exact local target arrival remains stable. | final distance/speed/hold gates pass; plan hash deterministic. |
| Obstacle avoidance route | Planner can avoid a blocking obstacle without executor replans. | route includes avoidance/terminal segments; minimum clearance recorded. |
| Insufficient fuel | Fuel policy fails closed. | route invalid or execution blocked with visible `FuelInsufficient`/warning reason. |
| No authority | Authority honesty is preserved. | no false completion; `NoAuthority` or equivalent status visible. |
| Off-route divergence | Divergence does not mutate locked plan. | status `Diverged`/invalidated; `replanRequired === true`; plan hash unchanged. |
| Locked plan hash preservation | Executor consumes a locked immutable plan. | initial, active and final locked plan hashes match unless player explicitly replans. |
| Explicit replan-required signal | Player/UI can tell what action is needed. | telemetry contains replan flag and invalidation reasons; HUD can show player-facing chip. |

## Evidence Artifact Shape

Recommended per-scenario output:

```text
evidence/scenarios/<scenario-id>.json
evidence/scenarios/<scenario-id>.md
evidence/screenshots/<scenario-id>.png
```

Recommended JSON fields:

```json
{
  "scenarioId": "direct-local-arrival-500m",
  "status": "Passed",
  "ticks": 0,
  "fixedStepSeconds": 0.0333333333,
  "target": {
    "kind": "TargetPoint",
    "frameId": "LocalPhysicsFrame:test",
    "arrivalEnvelope": {
      "maxPositionErrorMeters": 0,
      "maxRelativeSpeedMetersPerSecond": 0,
      "holdDurationSeconds": 0
    }
  },
  "finalDistanceMeters": 0,
  "finalRelativeSpeedMetersPerSecond": 0,
  "fuelUsed": 0,
  "authorityState": "Nominal",
  "planHashInitial": "",
  "planHashFinal": "",
  "replanRequired": false,
  "invalidationReasons": []
}
```

## Browser Evidence Rules

- Use `window.TestBridge`/equivalent only as a test harness API, not as player UI.
- Browser screenshots should be captured through Playwright-rendered output. Do not rely only on WebGL backbuffer reads.
- Record desktop and mobile smoke evidence when visible UI/layout is involved.
- Store telemetry JSON with the screenshot so visual evidence can be tied to core state.
- Record command, status, date, branch/commit when available, and artifact paths.

## Feature Readiness Gate

A feature is browser-mainline-ready only when:

1. its feature-intent card exists;
2. non-goals and Unity bug traps are documented;
3. at least one core test covers its domain rule;
4. at least one scenario/evidence artifact covers the user-visible behavior;
5. UI-visible features include screenshot or browser evidence;
6. known traps for silent replan, authority/fuel, target taxonomy, frame conversion and UI status ownership are either tested or explicitly deferred.

## Documentation Slice And Later Evidence

The original documentation slice did not run Unity, npm, build, Vitest, Playwright or browser evidence commands. The later Three.js browser-mainline implementation under `apps/weltraum-browser` records direct browser evidence in `apps/weltraum-browser/evidence/` and is summarized by `docs/browser-mainline/threejs-mainline-final-report.md`.
