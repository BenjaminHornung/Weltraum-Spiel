# Browser Vertical Slice v1 Evidence

Date: 2026-06-30

## Scope

- Worktree: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Browser-IFIWELTRAUM-000-vertical-slice-v1`
- Branch: `feature/browser-vertical-slice-v1`
- Spec fallback: DevToolbox MCP was unavailable for this repo path with `unauthorized_path`; direct files under `.devtoolbox/specs/changes/browser-vertical-slice-v1/` were used.
- Unity/Assets constraint: no Unity startup, Unity MCP, or `Assets/**` edits were used for this browser-only slice.

## Implemented Behavior

- Runtime commands now support explicit `SelectTarget`, `EngageAutopilot`, and `CancelAutopilot` actions.
- Runtime snapshots include selectable proving-ground targets, selected target, route preview state, and player-facing runtime messages.
- Invalid target IDs or malformed commands leave selected target, route preview, active plan, and locked `planHash` stable; they do not fall back to root/zero/default targets.
- Route preview is owned by runtime/core and remains separate from executor locked-plan state until explicit engage.
- Engage uses the selected preview and fails closed when another plan is already locked instead of silently replacing it.
- HUD renders selected target, route preview/locked route status, compact radar-style route contact, warnings, authority/fuel/brake state, and player-facing autopilot labels from telemetry/ViewModels only.
- Three.js renders selected target and preview/locked route from runtime snapshots; TestBridge render snapshots expose selected target and route-preview alignment only behind `?testBridge=1`.

## Evidence Artifacts

- `debug-scene.png` - desktop selected-target/route/autopilot evidence screenshot.
- `debug-scene-mobile.png` - mobile viewport evidence screenshot.
- `telemetry.json` - fail-closed off-route telemetry after preserving locked plan hash.
- `vertical-slice-telemetry.json` - initial preview, selected target preview, arrival, and failure telemetry snapshots.
- `scenario-matrix.json` - proving-ground matrix including locked-plan preservation and failure cases.

## Verification

| Command | Result | Notes |
| --- | --- | --- |
| `npm ci` | PASS | Installed 58 packages; npm warned about local `always-auth`/`email` config deprecation. |
| `npm run test -- tests/unit/statusHud.test.ts tests/unit/simulation.test.ts` | PASS | 2 files, 16 tests after review fixes. |
| `npm run test` | PASS | 8 files, 57 tests after review fixes. |
| `npm run build` | PASS | TypeScript and Vite build passed; existing Vite chunk-size warning remains. |
| `npm run test:e2e` | FAIL (known local launcher) | Default bundled Chromium failed with `browserType.launch: spawn UNKNOWN`. |
| `$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run test:e2e` | PASS | 7/7 Playwright tests passed with documented Chrome fallback. |
| `git diff --check` | PASS | No whitespace errors. |
| `git status --short -- Assets` | PASS | No `Assets/**` changes. |

## Requirement Mapping

- VSL-001: Covered by runtime command unit tests for target selection, malformed command ignore, unknown target fail-closed behavior, and E2E target selection through HUD buttons.
- VSL-002: Covered by route-preview snapshot fields, HUD route/radar labels, render snapshot alignment assertions, and `vertical-slice-telemetry.json`.
- VSL-003: Covered by engage/arrival E2E, off-route fail-closed explanation, insufficient-fuel/no-authority HUD tests, and locked-plan hash preservation checks.
- VSL-004: Covered by `StatusHudViewModel` tests and E2E assertions that player HUD shows translated labels without raw failure codes/TestBridge/debug telemetry.
- VSL-005: Covered by default bootstrap TestBridge absence test and gated `?testBridge=1` telemetry/render/screenshot evidence.

## Review

- Primary reviewer re-review accepted the locked-plan guard, locked-plan retarget prevention, telemetry serialization, and canvas label fixes.
- Independent GLM re-review accepted the slice as merge-ready with only low non-blocking cleanup notes.
- UI spot re-review accepted the `Flight viewport` aria-label fix and left only non-blocking accessibility/mobile follow-ups.

## Residual Risks

- Full radar/minimap/map UI remains intentionally deferred; current scope is a compact radar-style status readout.
- Route-mode selection remains limited to the current obstacle-avoidance engage action; richer mode selection is deferred.
- Default bundled Chromium still fails locally with `browserType.launch: spawn UNKNOWN`; Chrome executable fallback is the verified E2E path.
