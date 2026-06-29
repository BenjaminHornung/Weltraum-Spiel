# Navigation Autopilot V2 V1 Evidence Summary

Date: 2026-06-29

## Branch / Commit

- Worktree: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Threejs-Mainline-Transition-v1`
- Branch: `feature/browser-navigation-autopilot-v2-v1`
- Analyzed baseline SHA: `2f1f68b`
- Pending commit: `<orchestrator-to-fill-after-review>`

## Implemented V1 Contracts

- `TargetDescriptor` now carries explicit `kind` and `arrivalEnvelope` data; executable runtime kinds are `Waypoint` and `Point`.
- Future target-kind vocabulary (`Landing`, `Docking`, `Cargo`, `Orbit`) is type-reserved only and rejected by the v1 planner runtime until separate specs implement those flows.
- `ArrivalEnvelope` includes radius plus optional terminal-speed/stop-behavior metadata.
- `RouteValidationResult` and `RouteValidationIssue` describe invalid target, unsupported kind, unsafe obstacle overlap, impossible arrival envelope, and operational warning constraints.
- `RouteCandidate` and `RouteScore` provide deterministic candidate/scoring skeleton metadata.
- `RoutePlanningResult` returns either a `RoutePlan` or structured `PlannerRejection`.

## Planner / Executor Invariants

- Direct and obstacle planners expose `planResult()` as the safe planning API; existing `plan()` adapters throw on structured rejection instead of hiding invalid input.
- Deterministic `RoutePlan.planHash` remains stable for equal inputs and includes validation/scoring metadata.
- `AutopilotExecutor` still consumes one locked `RoutePlan`, does not call planners, and does not replace the locked plan or `planHash` after route invalidation.
- Terminal execution now captures the locked target arrival envelope and clamps arrival to the locked target point when a fixed step starts inside, enters, or intersects that envelope, preventing the browser ship from overshooting/diverging past the visible green target marker.
- Intermediate route waypoints are captured explicitly before continuing to the terminal segment, so obstacle-avoidance routes remain aligned with the locked route instead of switching early from a broad clearance radius.
- Route invalidation remains explicit telemetry through `replanRequired`, `invalidationReasons`, `failureReasonCodes`, and `routeValid=false`.

## Green Target Arrival Evidence

- Unit coverage: `AutopilotExecutor` captures a high-speed terminal crossing at the locked target envelope, clamps an already-inside-envelope arrival to the visible target, honors `NoStopRequired` terminal velocity, rejects tangential swings outside the envelope, leaves the locked plan hash unchanged, and reports `Arrived` with `distanceToTarget=0` for true arrivals.
- E2E/TestBridge coverage: the live browser runtime steps until `executor.status === "Arrived"`, asserts the ship position equals the locked plan target position used by the green target marker, asserts the final distance is inside `lockedPlan.target.arrivalEnvelope.radius`, then reads the gated render snapshot and verifies the browser-rendered ship position, green target position, and locked target position are the same point.

## Scenario Evidence

Evidence file: `apps/weltraum-browser/evidence/scenario-matrix.json`

The scenario matrix remains the same 9 browser proving-ground records. Each record now also includes:

- `targetKind`,
- `arrivalEnvelope`,
- `routeValidation`,
- `routeScore`,
- `finalPosition`,
- `targetPosition`.

Current field check after E2E evidence refresh:

- records: 9
- missing required v2 fields: none
- all records: `PASS`
- target kinds present: `Waypoint`, `Point`
- route validation/scoring fields present for every record
- direct-local-arrival records `finalPosition == targetPosition` and `distanceToTarget=0`
- locked-plan hash preservation remains asserted for every scenario

## Verification Results

- `npm ci`: pass, 58 packages added / 59 audited, 0 vulnerabilities; npmrc warnings only.
- `npx playwright install chromium`: pass, exit code 0; npmrc warnings only.
- `npm run test`: pass, Vitest 5 files / 38 tests.
- `npm run build`: pass, TypeScript + Vite build completed; Vite chunk-size warning only.
- `npm run test:e2e`: default bundled Chromium failed locally with `browserType.launch: spawn UNKNOWN`.
- `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:e2e`: pass, Playwright 6/6 tests.
- Scenario evidence field check: pass, `records=9`, `missing=none` for `targetKind`, `arrivalEnvelope`, `routeValidation`, and `routeScore`.
- Browser-visible arrival proof: pass in E2E fallback run through the gated render snapshot (`?testBridge=1` only); rendered ship position, rendered green target position, and `lockedPlan.target.position` match after `Arrived`.

## Non-Goals Confirmed

- No Unity files were edited for this browser v1 slice.
- No Unity runtime/MCP/dotnet verification is claimed.
- No Open-World, Surface-FPS, Ship Builder, Economy, Missions, Drones, route modes, orbital, landing, docking, or cargo runtime behavior was implemented.
