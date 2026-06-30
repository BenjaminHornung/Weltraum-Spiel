# Browser Vertical Slice Capability

## Requirements

### VSL-001 Target selection via explicit commands

The browser runtime MUST allow selecting among existing browser proving-ground targets through explicit runtime commands. Unknown target IDs, malformed commands, or unsupported payloads MUST fail closed without silently changing target state, canceling an active plan, or falling back to a root/zero/default target.

### VSL-002 Snapshot-backed target and route preview

The selected target and route preview MUST be visible in the browser and derived from runtime/core snapshots or ViewModels. UI/render code MUST NOT recompute planner internals or own route truth. The preview terminal point MUST align with the selected target descriptor and any locked route plan.

### VSL-003 Autopilot arrival or fail-closed explanation

When the player engages autopilot for the selected target, the runtime MUST either lock and execute the selected route to arrival or fail closed with explicit telemetry and player-facing explanation. The executor MUST NOT silently replan or replace the locked `RoutePlan`/`planHash`.

### VSL-004 HUD and compact radar-style status from snapshots

The player HUD MUST show mode, selected target, route/preview state, autopilot state, and failure/warning state from telemetry snapshots or ViewModels only. It MUST NOT expose raw TestBridge/debug terms, raw JSON telemetry, raw internal failure codes, planner candidate internals, or route computations in the player layer.

### VSL-005 Playwright/TestBridge evidence

Default browser bootstrap MUST NOT expose `window.TestBridge` or debug-only UI. With `?testBridge=1`, Playwright evidence MUST record selected target, route preview/plan hash, autopilot result or failure state, player-facing status, and screenshot evidence. Evidence MUST document the known local Playwright launcher fallback if default bundled Chromium fails with `browserType.launch: spawn UNKNOWN`.

## Important Scenarios

- Select an alternate existing target, verify the HUD and route preview update, engage autopilot, and observe arrival or continued execution with a stable locked plan.
- Select or dispatch an invalid target command and verify runtime state remains stable with no root fallback.
- Use an existing negative flight case such as insufficient fuel or no authority to verify player-facing failure explanation without debug leakage.
- Confirm TestBridge remains hidden on the default page and appears only with `?testBridge=1`.

## Constraints

- Use existing proving-ground target data and planner/executor contracts.
- Keep browser work under `apps/weltraum-browser`, `docs/browser-mainline`, evidence, and this spec package.
- Do not implement deferred gameplay systems listed in the proposal non-goals.
