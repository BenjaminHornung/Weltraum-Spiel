# Test Findings — First-Person Surface Expedition UI Prototype V1

## Final finding

The authoritative focused rerun against `http://127.0.0.1:5202/prototypes/first-person-surface-expedition-v1/` returned HTTP 200 and completed 5 discovered tests with 5 passed and 0 failed. Instrumentation recorded 0 console errors, page errors, failed requests, HTTP responses with status 400 or greater, or unexpected requests.

Node syntax, tracked `git diff --check`, explicit untracked-file whitespace/final-newline checks, package/lock unchanged checks, and the final changed-path allowlist all passed.

## Resolved first-run findings

The first run identified three bounded issues that were resolved before the authoritative rerun:

1. The direct prototype had to satisfy the exact Vite `env.mjs` allowlist.
2. The decorative canvas needed pointer events disabled so it did not intercept controls.
3. The page-scale keyboard-activation test needed to exercise the intended keyboard path.

These are recorded as resolved first-run findings, not as evidence of broader runtime or integration changes.

## Review findings

- Correctness reviewer: no correctness blocker.
- Primary screenshot-capable UI review: **PASS**. Non-blocking caveats are small text near the readability floor at 1280×720, the fixture-only state-control rail, and no explicit scale/orientation on the radar.
- GLM deterministic/source cross-check: no blocker, but pixel inspection was unavailable.

## Accepted gate and residual risk

**Human Visual Review: ACCEPTED 2026-07-18.** The user inspected all six attached PNGs and selected `Accept visual gate (Recommended)`. Tasks remain open, and completion/preflight success is not claimed.

The exact Playwright spec is not assigned to the `package.json` CI UI group. Existing Playwright configuration manages port 5173, whereas focused verification used an externally started server on port 5202 with `WELTRAUM_SURFACE_PROTOTYPE_BASE_URL=http://127.0.0.1:5202`. Package and configuration edits were explicitly forbidden. This is therefore documented as an accepted, unresolved integration risk, not a fixed or hidden defect.
