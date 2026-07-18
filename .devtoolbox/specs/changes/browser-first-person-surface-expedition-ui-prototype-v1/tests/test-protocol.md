# Test Protocol — First-Person Surface Expedition UI Prototype V1

## Status

Final focused automated verification passed. **Human Visual Review: ACCEPTED 2026-07-18.** The user inspected all six attached PNGs and selected `Accept visual gate (Recommended)`. Tasks remain open; this record does not claim completion-preflight success.

## Target and command

- Start URL: `http://127.0.0.1:5202/prototypes/first-person-surface-expedition-v1/`
- Working directory: `apps/weltraum-browser`
- Environment: `WELTRAUM_SURFACE_PROTOTYPE_BASE_URL=http://127.0.0.1:5202`
- Command: `npx playwright test tests/e2e/first-person-surface-expedition-ui-prototype.spec.ts --config=playwright.config.ts --workers=1 --reporter=line`

## Authoritative final rerun

- Exact route returned HTTP 200.
- Playwright discovered 5 tests: 5 passed, 0 failed.
- Observed 0 console errors, 0 uncaught page errors, 0 failed requests, 0 HTTP responses with status 400 or greater, and 0 unexpected requests.
- Node syntax checks passed.
- Tracked-file `git diff --check` passed.
- Explicit whitespace/final-newline checks for untracked files passed.
- `package.json` and the lockfile were unchanged.
- Final changed-path allowlist passed.

The final rerun supersedes first-run observations. The first run exposed and the bounded implementation resolved: the exact Vite `env.mjs` allowlist requirement, decorative canvas pointer-event interception, and the page-scale keyboard-activation test behavior.

## Required screenshots

| Evidence path | Dimensions | Bytes |
| --- | ---: | ---: |
| `apps/weltraum-browser/evidence/first-person-surface-expedition-ui-prototype-v1-exploration-1920x1080.png` | 1920×1080 | 119569 |
| `apps/weltraum-browser/evidence/first-person-surface-expedition-ui-prototype-v1-scanner-1920x1080.png` | 1920×1080 | 122917 |
| `apps/weltraum-browser/evidence/first-person-surface-expedition-ui-prototype-v1-interaction-hold-1920x1080.png` | 1920×1080 | 124929 |
| `apps/weltraum-browser/evidence/first-person-surface-expedition-ui-prototype-v1-hazard-warning-1920x1080.png` | 1920×1080 | 125917 |
| `apps/weltraum-browser/evidence/first-person-surface-expedition-ui-prototype-v1-responsive-1280x720.png` | 1280×720 | 108143 |
| `apps/weltraum-browser/evidence/first-person-surface-expedition-ui-prototype-v1-keyboard-focus-1920x1080.png` | 1920×1080 | 131378 |

## Review and integration notes

- Correctness reviewer found no correctness blocker.
- Primary screenshot-capable UI review passed with non-blocking caveats: small 1280 text is near the readability floor; the state-control rail is fixture-only; the radar lacks explicit scale/orientation.
- GLM deterministic/source cross-check found no blocker but could not inspect pixels.
- The focused spec is not assigned to a `package.json` CI UI group, and existing Playwright configuration manages port 5173 while this externally started focused run used 5202. Package/config edits were forbidden; this is an accepted, unresolved integration risk.
