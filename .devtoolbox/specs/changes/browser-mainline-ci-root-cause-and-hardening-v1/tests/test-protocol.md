# Browser Mainline CI Root Cause and Hardening Test Protocol

## Baseline

- Branch base: `origin/main` at `a410152b75e49c4be0a4b27f5eed6a1d0e5995d4`
- Latest failed run: [29118782519](https://github.com/BenjaminHornung/Weltraum-Spiel/actions/runs/29118782519)
- Event / branch / SHA: `push` / `main` / `a410152b75e49c4be0a4b27f5eed6a1d0e5995d4`
- Failed job: `Browser mainline verification`
- Failed step: `Run Playwright E2E`
- Exact command: `npm run test:e2e` -> `playwright test`
- Exact test: `tests/e2e/debug-scene.spec.ts:156:1` — `browser vertical slice selects a target, previews a route, engages autopilot, and writes evidence`
- Exact assertion: `tests/e2e/debug-scene.spec.ts:273:47`
- Failure: expected `lowPolyInstanceBatch.count` 6; received 14
- Result: 1 failed, 26 passed in approximately 5.2 minutes

The same assertion failed in four consecutive main runs:

| Run | Head SHA | Result |
| --- | --- | --- |
| [29118782519](https://github.com/BenjaminHornung/Weltraum-Spiel/actions/runs/29118782519) | `a410152b75e49c4be0a4b27f5eed6a1d0e5995d4` | failed |
| [28750818330](https://github.com/BenjaminHornung/Weltraum-Spiel/actions/runs/28750818330) | `471f6807de98c6976fb9246d04dd127325dcb8fa` | failed |
| [28746666576](https://github.com/BenjaminHornung/Weltraum-Spiel/actions/runs/28746666576) | `68e47eab6707bbbfc3be8448e3333c15539c9393` | failed |
| [28740264459](https://github.com/BenjaminHornung/Weltraum-Spiel/actions/runs/28740264459) | `52eccfbcaa21aef1f5ddef027d9bd3bd0f3dc2b0` | failed |

Last green: [28654066622](https://github.com/BenjaminHornung/Weltraum-Spiel/actions/runs/28654066622), SHA `a301569f078b33f03fef3422bb129e55a273d527`.

## Annotations and artifacts

All four failed runs report two annotations:

1. Warning: Node.js 20 is deprecated for the v4 GitHub actions and the actions are forced to Node.js 24.
2. Error: the Playwright E2E step exited with code 1.

The Node warning is not causal. Checkout, selective GLB restoration, Node setup, `npm ci`, Playwright install, unit tests, and build all passed.

The latest `browser-mainline-ci-artifacts` artifact contains the Playwright failure screenshot, `error-context.md`, `trace.zip`, HTML report, and JSON/PNG evidence. Artifact ID: `8237803411`; size: `23885943` bytes; digest: `sha256:694503981e9dd638f52890dda6e72f3cd57b78b91a782693439301d02eaf0d22`.

## Root cause

The first failing mainline added eight `playableLargeFieldVisualLandmarks` to the existing six base asteroids and spread them into `provingGroundAsteroidField`. `createProvingGroundLowPolyRenderBatch()` renders that complete registry, so the correct runtime count is fourteen. The E2E spec was unchanged across the last-green and first-red commits and retained a stale literal count of six.

This is deterministic test-contract drift after an intentional world expansion. It is not a timeout, LFS restore failure, browser startup failure, parallelism race, layout/font difference, browser crash, or intermittent resource problem.

## Before-fix local reproduction

Working directory: `apps/weltraum-browser`

| Command | Result |
| --- | --- |
| `npm ci` | passed; 58 packages installed, 0 vulnerabilities |
| `npx playwright test tests/e2e/debug-scene.spec.ts --grep "browser vertical slice selects a target"` | failed in 2.2s with the same expected 6 / received 14 assertion at line 273; screenshot, error context, and trace produced |

## Fix

The stale literal was replaced with `provingGroundAsteroidField.length`. The test still verifies that the renderer publishes exactly one instance for every authoritative proving-ground field entity, but it no longer duplicates a count that becomes stale when the registry changes intentionally. No production world or rendering file changed.

CI hardening adds explicit core/autopilot, live runtime/objectives, and UI/layout Playwright groups; a required exact-membership preflight for all discovered E2E specs; group-specific automatic output/report directories; one CI worker; `forbidOnly`; CI failure diagnostics for the long live-flight spec; tool/GLB diagnostics; evidence JSON parsing; a 30-minute job limit; and Markdown evidence upload. No retry or `continue-on-error` was added.

## Workflow shape

### Before

1. Unit tests
2. Build
3. One aggregate Playwright E2E step
4. One broad artifact upload

### After

1. Unit tests
2. Build
3. Required exact-membership validation for all Playwright group scripts
4. Required Playwright core/autopilot group
5. Required Playwright live runtime/objectives group
6. Required Playwright UI/layout group
7. Required top-level evidence JSON parsing
8. Always-run artifact upload with isolated automatic diagnostics per E2E group

## After-fix local verification

| Command | Result |
| --- | --- |
| `npx playwright test tests/e2e/debug-scene.spec.ts --grep "browser vertical slice selects a target"` (run 1) | passed; 1/1 in 4.7s |
| `npx playwright test tests/e2e/debug-scene.spec.ts --grep "browser vertical slice selects a target"` (run 2) | passed; 1/1 in 3.9s |
| `npm run test` | passed; 14 files, 147/147 tests |
| `npm run build` | passed; TypeScript and Vite build completed; existing bundle-size warning only |
| `CI=true`, artifact group `core-autopilot`, `npm run test:e2e:core` | passed; 18/18 with one worker in 24.2s |
| `CI=true`, artifact group `live-runtime`, `npm run test:e2e:live` | passed; 4/4 with one worker in 2.5m |
| `CI=true`, artifact group `ui-layout`, `npm run test:e2e:ui` | passed; 5/5 with one worker in 17.7s |
| `npm run test:e2e` | passed; 27/27 in 55.5s |
| Parse `.github/workflows/browser-mainline-ci.yml` with PyYAML | passed |
| Parse top-level `evidence/*.json` | passed; 14 files |
| Run the same exact-membership logic as the workflow against `tests/e2e/*.spec.ts` and the three package scripts | passed; 12/12 specs exactly once, no missing/duplicate/stale entries |
| Search for focused Playwright tests and workflow `continue-on-error` | passed; neither found |
| `git diff --check` | passed; line-ending conversion warnings only |
| Package/lockfile scope | passed; `package.json` scripts changed and `package-lock.json` remained unchanged |
| Production/parallel-agent scope status | passed; no changes under `Assets/**`, browser `src/world/**`, `src/ui/**`, `src/render/**`, `index.html`, `src/main.ts`, or `src/style.css` |

An independent reviewer found that explicit group lists could silently omit specs introduced by the parallel UI/world branches. The required exact-membership workflow preflight was added in response and then passed against all 12 current specs. A follow-up finding noted that the groups initially did not depend on the new preflight outcome; the validator now has an explicit step ID required by all three E2E conditions. Final re-review reported no remaining findings and confirmed that later groups still run after an earlier E2E failure.

Normal `/` TestBridge isolation is covered by passing tests in all three relevant areas, including `product bootstrap does not expose the E2E TestBridge by default`, `keeps TestBridge absent from the normal product URL`, `normal player HUD flies ...`, and `default product URL exposes player HUD without TestBridge/debug text`.

## Remote verification

- New run ID / URL: pending
- Final conclusion: pending

## Remaining CI risks

- Explicit file lists require deliberate group classification when new E2E specs are added; the required coverage preflight prevents silent omission.
- GitHub action v4 Node deprecation annotations remain non-causal unless action majors are upgraded separately.
- Checked-in fixed evidence filenames can still be overwritten by local or retry runs; automatic Playwright diagnostics will be isolated per CI group.
