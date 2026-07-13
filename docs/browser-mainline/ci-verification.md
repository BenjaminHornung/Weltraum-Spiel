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

## Current baseline and commands

The current browser package uses TypeScript `7.0.2`. The current suite contains 25 Playwright spec files and 48 tests. The job runs on `ubuntu-latest` with Node.js 22, has a finite 45-minute timeout, and uses the npm cache keyed by `apps/weltraum-browser/package-lock.json`. All npm commands run from `apps/weltraum-browser`:

```text
npm ci
npx playwright install --with-deps chromium
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

`npm run test` executes Vitest and `npm run build` executes the TypeScript/Vite browser build. The three required Chromium Playwright groups separate core/autopilot/domain coverage (14 specs), live runtime/objectives (8 specs), and UI/layout (3 specs). The aggregate `npm run test:e2e` command remains unchanged and discovers the complete suite for local full-suite verification.

## E2E failure isolation and guardrails

CI keeps one Playwright worker and enables `forbidOnly` only when `CI=true`. Before browser execution, an inline Node preflight recursively discovers every `tests/e2e/**/*.spec.ts` file and compares that inventory with the actual file arguments in the three package scripts. Each script is tokenized completely: it must start with the exact tokens `playwright test`, contain at least one spec, and contain no flags, shell operators, redirections, comments, quoted extras, commands, or other non-spec tokens. Every remaining token must be a normalized discovered spec path. Embedded parser assertions cover one valid command plus shell-suffix and `--grep` mutations. Missing/unassigned, duplicate, and stale entries fail closed; the package scripts are the only maintained group membership list.

All three group steps are required. Each later group uses an explicit `!cancelled()` condition with successful prerequisite checks, so a failed earlier group does not suppress independent diagnostics while its failure still fails the job. No group uses `continue-on-error`.

The workflow sets `WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP` to `core-autopilot`, `live-runtime`, or `ui-layout`. Playwright accepts only lowercase letters, digits, and single hyphen separators for this value. It isolates automatic output and HTML reports beneath the matching group folder. When the variable is unset, the existing aggregate paths remain `evidence/playwright-output` and `evidence/playwright-report`.

The bounded `playable-large-field-live-flight.spec.ts` runner keeps automatic
trace and screenshot capture disabled in every environment. It already writes
three explicit product-evidence screenshots plus Markdown after its live wait,
and the grouped job log/report still identifies a timeout or failing assertion.
This exception preserves the previously green Linux runtime margin; it does not
change assertions, retries, workers, or the 95-second test timeout. Other specs
retain the global Playwright failure-artifact behavior.

After installation, CI prints compact Node, npm, Playwright, and Demo Scout GLB type/size diagnostics. After the E2E groups, it parses every top-level `evidence/*.json` file and fails on invalid JSON.

## Demo Scout GLB / LFS strategy

The current checkout needs the Demo Scout GLB, the runtime favicon and four checked-in UI reference PNGs as real binaries. A broad Git LFS pull is not required.

The workflow still uses a guarded restore step for safety:

1. Checkout runs with `lfs: false`, avoiding a full historical LFS download.
2. The job checks the Demo Scout GLB, `apps/weltraum-browser/public/favicon.png` and these four reference images for LFS pointers:
   - `evidence/ui-concept-parity-v1-rejected-flight-hud.png`
   - `evidence/ui-concept-parity-v1-rejected-flight-hud-1280x720.png`
   - `evidence/ui-concept-parity-v1-rejected-navigation-planner.png`
   - `evidence/ui-concept-parity-v1-rejected-combat-contact.png`
3. Only if one of those six exact files is a pointer, the job runs an include-limited pull for those paths.
4. The step verifies `glTF` magic bytes for the GLB and PNG signatures for the favicon and all four reference images.

```text
git lfs pull --include="apps/weltraum-browser/public/ships/demo_scout_mk1.glb,apps/weltraum-browser/public/favicon.png,apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-flight-hud.png,apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-flight-hud-1280x720.png,apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-navigation-planner.png,apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-combat-contact.png" --exclude=""
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
- group-specific `core-autopilot`, `live-runtime`, and `ui-layout` report/output folders beneath those two paths
- `apps/weltraum-browser/evidence/*.png`
- `apps/weltraum-browser/evidence/*.json`
- `apps/weltraum-browser/evidence/*.md`

## What this CI does not prove

This workflow is browser-mainline verification only. It does not prove:

- Unity EditMode/PlayMode behavior
- any change under `unity-legacy-final-2026-07:Assets/**`
- full gameplay parity with the Unity prototype
- full GLB/ShipVisual implementation quality beyond what browser unit tests, build checks, and Playwright E2E cover
- Flight-feel, RCS/SAS, or gameplay behavior that has not been implemented in browser source and covered by the browser tests
