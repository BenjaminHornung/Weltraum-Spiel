# Flight Authority Fuel Braking v1 Evidence

Date: 2026-06-29

## Branch / SHA Context

- Worktree: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Threejs-Mainline-Transition-v1`
- Branch: `feature/browser-flight-authority-fuel-braking-v1`
- Analyzed base SHA before implementation: `f1c886755e4bb46085b5d393598f0e16d0128113`

## Implemented Browser Contracts

- `ShipMass`: dry mass, stubbed/deferred cargo mass, fuel mass and computed total mass in kilograms.
- `FuelState`: capacity/current/reserve in kilograms, burn rate in kilograms per kilonewton-second, fail-closed status and reason codes.
- `AuthorityState`: autopilot, main-thruster, RCS and SAS availability plus translation/rotation authority and reason codes.
- `BrakingReserve`: first-approximation required/available delta-v, `canBrake` and reason codes.
- `FlightSnapshot`: executor-owned central snapshot consumed by executor telemetry, HUD, TestBridge and evidence, including route validity and failure reasons.

## Fail-Closed Coverage

- Fuel depleted/reserve violations block execution before movement with `OutOfFuel`, `FuelDepleted` and `FuelInsufficient`/`FuelReserveViolated` reasons.
- Missing autopilot authority blocks execution with `NoAuthority`, `AutopilotUnavailable` and `AuthorityInsufficient`.
- Missing main thrusters blocks execution/braking with `NoAuthority`, `MainThrustersUnavailable` and `AuthorityInsufficient`.
- Insufficient brake reserve blocks execution with `FuelInsufficient`, `BrakeReserveInsufficient` and stable locked `planHash` when usable fuel cannot cover required delta-v.
- Off-route divergence fails closed with `Diverged`, `OffLockedRoute`, `routeValid=false`, unchanged ship/fuel for the invalidated step, and an explicit `replanRequired` signal without plan replacement.

## Scenario Evidence

Evidence file: `apps/weltraum-browser/evidence/scenario-matrix.json`

Required field check passed for every scenario record: `initialMass`, `finalMass`, `initialFuel`, `finalFuel`, `fuelUsed`, `authority`, `brakingReserve`, `failureReasonCodes`, `routeValid`, `planHashBefore`, `planHashAfter`, `replanRequired`, `invalidationReasons`.

Scenarios recorded:

1. `direct-local-arrival`
2. `obstacle-avoidance-route`
3. `insufficient-fuel`
4. `no-authority`
5. `no-main-thrusters`
6. `brake-reserve-insufficient`
7. `off-route-divergence`
8. `locked-plan-hash-preservation`
9. `explicit-replan-required-signal`

## Verification Results

- `npm run test`: PASS, Vitest 5 files / 26 tests after final-review blocker fixes, including pre-step browser runtime telemetry coverage.
- `npm run build`: PASS, Vite build completed; existing chunk-size warning only.
- `npm run test:e2e`: default Playwright Chromium launch failed in this local environment with `spawn UNKNOWN`.
- `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:e2e`: PASS, Playwright 6/6 tests.
- Scenario evidence field check: PASS, 9 records, no missing required fields. `off-route-divergence` records `routeValid=false`, `failureReasonCodes=[OffLockedRoute]`, `fuelUsed=0`, `finalFuel=100`, `finalSpeed=0`; `brake-reserve-insufficient` records both `FuelInsufficient` and `BrakeReserveInsufficient`.

## Unity / Scope Confirmation

No Unity editor, Unity MCP, dotnet, asset migration, branch switching, staging, commit, push, reset, clean or destructive Git action was used for this implementation.
