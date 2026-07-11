# Browser Mainline CI Verification

## Purpose

`browser-mainline-ci.yml` provides GitHub Actions verification for the browser mainline without changing browser gameplay, GLB/ShipVisual code, Unity assets, or checked-in evidence images. It is intended to protect the current browser path that includes Demo Scout GLB visual parity, playable flight, Playwright E2E, and runtime evidence.

## Triggers and scope

The workflow runs for:

- pull requests that touch browser-mainline paths
- pushes to `main` that touch browser-mainline paths
- manual `workflow_dispatch` runs

The path filters include:

- `apps/weltraum-browser/**`
- `.github/workflows/browser-mainline-ci.yml`
- `docs/browser-mainline/**`
- `.devtoolbox/specs/changes/browser-*/**`

## Commands

The job runs on `ubuntu-latest` with Node.js 22 and uses the npm cache keyed by `apps/weltraum-browser/package-lock.json`. All npm commands run from `apps/weltraum-browser`:

```text
npm ci
npx playwright install --with-deps chromium
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

`npm run test` executes Vitest and `npm run build` executes the TypeScript/Vite browser build. The three required Chromium Playwright groups separate core/autopilot, live runtime/objectives, and UI/layout failures while retaining the aggregate `npm run test:e2e` command for local full-suite verification.

CI runs Playwright with one worker and rejects committed `test.only` calls. Each E2E group writes automatic output and its HTML report beneath a group-specific folder in `evidence/playwright-output` and `evidence/playwright-report`, so a later group cannot replace an earlier failure trace or screenshot.

Before launching Playwright, CI compares every `tests/e2e/*.spec.ts` file with the three group scripts. Missing, duplicate, or stale entries fail the job, so new E2E specs cannot be silently omitted during parallel feature integration.

The workflow also prints Node, npm, and Playwright versions, reports the resolved Demo Scout GLB file type and byte size, and parses every top-level `evidence/*.json` file in a named required step.

## Demo Scout GLB / LFS strategy

The current checkout stores `apps/weltraum-browser/public/ships/demo_scout_mk1.glb` as a normal GLB binary with `glTF` magic bytes, so a broad Git LFS pull is not required.

The workflow still uses a guarded restore step for safety:

1. Checkout runs with `lfs: false`, avoiding a full historical LFS download.
2. The job checks whether the Demo Scout GLB file is an LFS pointer.
3. Only if that exact file is a pointer, the job runs:

```text
git lfs pull --include="apps/weltraum-browser/public/ships/demo_scout_mk1.glb" --exclude=""
```

This avoids pulling old Unity/test/evidence LFS objects that are unrelated to the browser CI path and have caused missing-object problems in previous full LFS checkouts.

## Local Windows caveat

Previous local verification on Windows observed that bundled Playwright Chromium can fail with `spawn UNKNOWN`. That is treated as a local environment issue, not as the CI baseline. The GitHub Actions job runs on Ubuntu and installs the Playwright Chromium browser with:

```text
npx playwright install --with-deps chromium
```

Local Windows runs may still use `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH` to point at an installed Chrome/Chromium executable when the bundled browser cannot be spawned.

## Uploaded artifacts

The workflow uploads available test artifacts with `if: always()` and `if-no-files-found: ignore`. It does not commit generated evidence back to the repository.

Uploaded paths are:

- `apps/weltraum-browser/playwright-report/**`
- `apps/weltraum-browser/test-results/**`
- `apps/weltraum-browser/evidence/playwright-report/**`
- `apps/weltraum-browser/evidence/playwright-output/**`
- `apps/weltraum-browser/evidence/*.png`
- `apps/weltraum-browser/evidence/*.json`
- `apps/weltraum-browser/evidence/*.md`

## What this CI does not prove

This workflow is browser-mainline verification only. It does not prove:

- Unity EditMode/PlayMode behavior
- any change under `Assets/**`
- full gameplay parity with the Unity prototype
- full GLB/ShipVisual implementation quality beyond what browser unit tests, build checks, and Playwright E2E cover
- Flight-feel, RCS/SAS, or gameplay behavior that has not been implemented in browser source and covered by the browser tests
