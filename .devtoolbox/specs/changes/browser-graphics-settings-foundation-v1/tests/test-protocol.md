# Test Protocol: Browser Graphics Settings Foundation V1

## Environment note

The current DevToolbox MCP session returned `unauthorized_path` for the isolated worktree. This does not waive `workspace_prepare_for_agent`, `specs_get_status`, `tasks_load`, `execution_create`, `verify_run`, `tasks_completion_preflight`, or `tasks_toggle`; they must be rerun after the server is rebound, and the failure must be reported if rebinding remains unavailable.

## Focused commands

From `apps/weltraum-browser`:

```text
npm ci
npx tsc -p tsconfig.json
npm run test -- tests/unit/graphicsSettingsSchema.test.ts
npm run test -- tests/unit/graphicsSettingsPresets.test.ts
npm run test -- tests/unit/graphicsSettingsStorage.test.ts
npm run test -- tests/unit/graphicsSettingsCapabilities.test.ts
npm run test -- tests/unit/graphicsSettingsAdapter.test.ts
npm run test:e2e -- tests/e2e/graphics-settings.spec.ts
npm run test
npm run build
npm run test:e2e
```

From repository root:

```text
dotnet build "Weltraum Spiel.sln" --no-restore
dotnet test "Weltraum Spiel.sln" --no-build
git diff --check
```

Unity SHALL NOT be started.

## Mandatory unit matrix

1. Defaults validate.
2. Every preset validates.
3. Presets are deterministic.
4. A preset-owned single change derives Custom.
5. Invalid values are rejected.
6. NaN and Infinity are rejected.
7. Future versions fail closed.
8. Corrupt storage falls back to defaults without throwing.
9. Apply persists.
10. Cancel does not persist.
11. Reset stages defaults.
12. Render scale is bounded.
13. Pixel ratio is bounded by schema and renderer limits.
14. FOV bounds are enforced.
15. Render distance is finite and positive.
16. Shadow policies are stable.
17. Unsupported settings are never reported as applied.
18. AA reports restart required when desired differs from actual.
19. VSync is never reported as live-controllable.
20. Adapter application leaves the exact gameplay snapshot unchanged.
21. FPS limiting leaves simulation tick count unchanged.
22. Public snapshots are deeply immutable.

## Normal Playwright flow

1. Open `/` at 1920x1080 and assert `window.TestBridge` is absent.
2. Open the visible Graphics Settings action and capture the baseline panel.
3. Select Low, Apply, assert Applied state, backing resolution, scale/DPR, FOV/far metadata, and capability labels.
4. Reload and assert Low persisted and actual AA now matches the startup preference.
5. Stage Reset Defaults, assert the renderer/storage remain Low, then Cancel and assert Low is restored.
6. Select High, Apply, assert live values and AA restart-required when the active context differs.
7. Change one preset-owned field, assert Custom, then Cancel and assert High returns without persistence.
8. Assert BrowserManaged VSync/Fullscreen and Planned/Unsupported controls are truthful and disabled where appropriate.
9. While the dialog is open, send flight input and assert idle speed/fuel/status do not change; after close, input resumes.
10. In a separate normal planner flow, preserve the visible locked plan hash across a live graphics Apply. Exact position/velocity/fuel/route equality is covered by unit snapshot comparison.
11. Fail on unexpected console errors, page errors, failed requests, or HTTP error responses.

## Evidence

```text
apps/weltraum-browser/evidence/graphics-settings-panel-1920x1080.png
apps/weltraum-browser/evidence/graphics-settings-low-preset-1920x1080.png
apps/weltraum-browser/evidence/graphics-settings-high-preset-1920x1080.png
apps/weltraum-browser/evidence/browser-graphics-settings-foundation-v1-summary.json
apps/weltraum-browser/evidence/browser-graphics-settings-foundation-v1.md
```

Visually inspect readable labels, no clipping, no HUD collision, visible keyboard focus, correct disabled/restart states, and an unobstructed central scene after closing. Do not use a whole-page pixel comparison for the animated WebGL scene.

## Scope audit

- Diff paths SHALL match the user-provided allowlist.
- `Assets/**`, lockfiles, flight/navigation/resources/ship-builder/combat/celestial/test-harness domains, and protected roadmap/index files SHALL be unchanged. By explicit user authorization after review, `apps/weltraum-browser/package.json` may register `tests/e2e/graphics-settings.spec.ts` in the UI group. The integrated current mainline owns the Combat and Persistence core-group assignments.
- Evidence SHALL come from the real runtime, not static reference images.
- Tasks SHALL be checked only after fresh evidence and completion preflight.
