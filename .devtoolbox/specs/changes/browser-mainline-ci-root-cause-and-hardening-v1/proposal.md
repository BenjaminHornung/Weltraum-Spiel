# Proposal

## Change

`browser-mainline-ci-root-cause-and-hardening-v1`

## Problem

Browser Mainline CI is red on four consecutive `main` pushes. The latest failed run, [29118782519](https://github.com/BenjaminHornung/Weltraum-Spiel/actions/runs/29118782519), passes checkout, selective Demo Scout GLB restoration, dependency installation, unit tests, and the browser build, then fails in the aggregate Playwright step.

The exact failing assertion is `tests/e2e/debug-scene.spec.ts:273`: the test expects six low-poly render instances while the intended proving-ground world now contains the original six asteroids plus eight large-field visual landmarks. Runtime correctly reports fourteen.

The single aggregate E2E step makes failures slower to locate, and the uploaded artifact set is broad enough that the relevant trace/report is not obvious.

## Goal

- Restore Browser Mainline CI by aligning the stale E2E rendering-contract assertion with the intended world registry without changing production behavior.
- Keep every tracked Playwright spec mandatory.
- Split CI E2E execution into named, complete groups with isolated Playwright output.
- Preserve trace, screenshot, HTML report, and JSON evidence on failure.
- Make environment, GLB, and evidence diagnostics explicit.
- Prove the fix locally and in a new GitHub Actions run.

## Scope

- `.github/workflows/browser-mainline-ci.yml`
- `apps/weltraum-browser/playwright.config.ts`
- `apps/weltraum-browser/package.json` and lockfile only if package metadata legitimately changes
- Browser E2E tests only for the proven stale contract or CI diagnostics
- Browser CI documentation and this change's test evidence

## Non-goals

- No production world, flight, planner, executor, objective, HUD, render, or UI behavior changes.
- No edits under `Assets/**`.
- No skipped/optional Playwright checks and no `continue-on-error`.
- No weakening of TestBridge isolation or normal-runtime coverage.
- No broad timeout inflation or speculative LFS changes.
- No edits to parallel UI/HUD or world-streaming implementation scopes.
