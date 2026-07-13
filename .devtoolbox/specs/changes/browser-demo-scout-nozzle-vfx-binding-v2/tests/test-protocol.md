# Test Protocol: Browser Demo Scout Nozzle VFX Binding v2

## Context

- Date: 2026-07-13
- Branch: `feature/browser-demo-scout-nozzle-vfx-binding-v2`
- Base head: `639f2e11ee98814b92ad2abb2ec0f0847483e498`
- Evidence source: this commit's source tree; the immutable commit SHA is
  recorded by the pull request and its exact-head CI run.
- DevToolbox MCP: unavailable for this nested worktree because the configured
  workspace authorization rejects it; spec/tasks/evidence are maintained here.

## Asset preflight

- `apps/weltraum-browser/public/ships/demo_scout_mk1.glb` is a real GLB, not an
  LFS pointer: 127108 bytes, glTF 2, 155 nodes.
- Read-only inventory on 2026-07-13 found exactly twenty named
  `RCS_Nozzle_*` nodes, one occurrence each, plus the expected main nozzle node.
- The GLB is test input and must remain byte-identical in the diff.

## Phase 1 - non-browser verification

```text
npm run test -- tests/unit/simulation.test.ts tests/unit/flightController.test.ts tests/unit/nozzleVfx.test.ts
npm run test
npm run build
git diff --check
git status --short -- Assets package.json package-lock.json apps/weltraum-browser/package.json apps/weltraum-browser/package-lock.json apps/weltraum-browser/public/ships/demo_scout_mk1.glb
```

## Phase 2 - browser evidence

```text
npm run test:e2e -- tests/e2e/debug-scene.spec.ts --project=chromium
npm run test:e2e -- tests/e2e/autopilot-lifecycle-render-smoothing.spec.ts tests/e2e/flight-ui-foundation.spec.ts --project=chromium
```

## Superseded pre-review results

The following results were fresh on 2026-07-13 for the initial implementation,
but do not complete any task after the independent review reopened all boxes:

- `npm ci` - exit 0; 59 locked packages installed, 0 vulnerabilities. Existing
  npm user-config deprecation warnings only.
- Focused unit command - exit 0; 3 files and 57 tests passed, including a
  read-only parse of the checked-in GLB through the real Three.js loader with all
  21 main-plus-RCS nozzle bindings resolved uniquely.
- `npm run test` - exit 0; 40 files and 457 tests passed.
- `npm run build` - exit 0; TypeScript 7.0.2 compile and Vite production build
  passed. The already-documented greater-than-500-kB chunk warning remains.
- `git diff --check` - exit 0. A separate trailing-whitespace scan of all new
  files found none.
- Package/asset guardrail status was empty for `Assets`, root/app package files,
  lockfiles, and the Demo Scout GLB.
- Demo Scout GLB worktree/base blob hashes both equal
  `8a6bc50e71aa23d136c082fa814e5629825aad3a`.

These results were superseded by the review-fix and final browser verification
below.

## Review-fix verification

Fresh final-worktree results on 2026-07-13, based on
`639f2e11ee98814b92ad2abb2ec0f0847483e498`:

- Focused unit command - exit 0; 3 files and 66 tests passed. Coverage includes
  six legacy bindings, exact positive/negative roll/yaw/pitch nozzle sets,
  cancelled manual-plus-SAS visibility, non-finite binding fallback, and the
  real 6-to-20-to-6 mesh-pool lifecycle with fourteen removed geometry and
  material disposal events.
- `npm run test` - exit 0; 40 files and 466 tests passed.
- `npm run build` - exit 0; TypeScript compile and Vite production build passed.
  The pre-existing greater-than-500-kB chunk warning remains.
- `git diff --check` - exit 0; Git emitted only its configured LF-to-CRLF working
  copy notices. A separate trailing-whitespace scan of all untracked spec,
  nozzle-helper, and nozzle-test files found no matches.
- Package/asset guardrail status was empty for `Assets`, root/app package files,
  lockfiles, and the Demo Scout GLB.
- Demo Scout GLB worktree/base blob hashes remain identical at
  `8a6bc50e71aa23d136c082fa814e5629825aad3a`.
- The local implementation and static-verification task boxes are complete.

## Final browser verification

The host policy blocks Playwright's downloaded Chromium before application
launch. Both authoritative browser commands therefore used the repository's
supported `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH` override with the installed
`C:\Program Files\Google\Chrome\Application\chrome.exe`. The fixed port 5173
was held exclusively and the commands ran serially.

| Command | Result |
| --- | --- |
| `npm run test:e2e -- tests/e2e/debug-scene.spec.ts --project=chromium` | PASS on the final test source: 9/9 tests in 24.6s. |
| `npm run test:e2e -- tests/e2e/autopilot-lifecycle-render-smoothing.spec.ts tests/e2e/flight-ui-foundation.spec.ts --project=chromium` | PASS: 4/4 tests in 16.9s. |

The final debug-scene run covers main-thrust, rotation-command, and
translation-command states; exact six procedural fallback bindings; exact signed roll/yaw/pitch
oracles; cancellation; deterministic invalid-position fallback; and a
6-to-20-to-6 pool lifecycle. The rotation evidence is written from one
truthful screenshot buffer to both required evidence paths, avoiding a
back-to-back Chrome raster-capture race without changing product state.

Fresh visual inspection found the main, rotation, and translation screenshots
clean and readable. The snapshot JSON parsed successfully and recorded 21
initial GLB bindings, main visibility, eight rotation puffs, twelve translation
puffs, eight translation-compatible puffs, and zero non-Resolved or
fallback-error diagnostics; all 21 initial GLB bindings were `Resolved`. During the
successful run, both required rotation paths were written from one buffer and
were byte-identical. The pre-existing historical rotation path was then
restored to HEAD as required; the remaining new scoped rotation evidence has
SHA-256
`43c1f3cee25c87ed338992bb731bde3ca888874e5e90a07b89953bb63e6b7bd5`.

Test-generated changes to pre-existing evidence files were restored exactly to
HEAD after the successful runs. The four new scoped evidence files are:

- `apps/weltraum-browser/evidence/demo-scout-nozzle-vfx-main.png`
- `apps/weltraum-browser/evidence/demo-scout-nozzle-vfx-rotation.png`
- `apps/weltraum-browser/evidence/demo-scout-nozzle-vfx-translation.png`
- `apps/weltraum-browser/evidence/demo-scout-nozzle-vfx-snapshot.json`

The DevToolbox MCP remained unavailable for this nested worktree. Independent
implementation review passed with no findings. A manual equivalent completion
preflight uses the fresh commands, diff review, asset/package guardrails, and a
final independent verification review. Exact-head pull-request CI remains the
external merge gate and must pass before merge.
