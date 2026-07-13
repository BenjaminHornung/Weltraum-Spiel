# Browser Vertical Slice v1

## Motivation

M4 established browser-native navigation/autopilot contracts, M5 established the snapshot-driven HUD/input foundation, and M6 established frame/world-scale projection contracts. The next mainline step is to prove these foundations together in one browser-facing vertical slice.

## User Outcome

The browser app should demonstrate a complete local-space loop: the player selects an existing target, sees the selected target and route preview, starts autopilot, and either arrives or receives a clear fail-closed explanation from the same telemetry/HUD path used by tests.

## Scope

- Add explicit browser runtime target-selection and route-preview behavior using existing proving-ground targets.
- Keep route planning and locked-plan state in runtime/core, not in UI rendering code.
- Extend the Basic HUD with compact target/route/radar-style status that is derived from snapshots/ViewModels.
- Extend gated Playwright/TestBridge evidence for target selection, route preview, autopilot result/failure state, and screenshot capture.
- Update browser-mainline documentation and evidence for M7 v1.

## Non-Goals

- No Unity startup/install/MCP and no `unity-legacy-final-2026-07:Assets/**` edits.
- No full radar/minimap/map navigation UI.
- No terrain streaming, orbital mechanics, surface runtime, ship builder, economy, cargo/resource runtime, missions, drones, mining, docking, landing, or broad open-world gameplay.
- No executor-side silent replan and no replacement of locked `RoutePlan` or `planHash`.
- No raw TestBridge/debug/JSON telemetry leakage into player HUD.

## Success Criteria

- Browser runtime exposes explicit target-selection and autopilot commands that fail closed for invalid input.
- Player HUD shows selected target, route preview/status, warning/failure explanation, and compact radar-style state from snapshots only.
- Browser E2E proves default TestBridge absence and gated evidence for selecting a target, seeing a route preview, engaging autopilot, and observing arrival or a player-facing failure.
- Unit/build/E2E verification passes, with the known local Playwright launcher fallback documented if needed.

## Tooling Note

DevToolbox MCP `workspace_discover` is unavailable for this repository path in this session with `unauthorized_path`. These artifacts are maintained directly in `.devtoolbox/specs/changes/browser-vertical-slice-v1/` as the approved fallback.
