# Proposal: Browser Planetary Environment Core v1

## Change
`browser-planetary-environment-core-v1`

## Motivation
The browser runtime needs deterministic planetary and lunar atmosphere samples for Suit Exposure, Scanner, Landing Readiness, Surface Movement, Vegetation/Biome Selection, Outposts, and Mission Hazard systems. Those systems cannot rely on runtime-render or UI authority and need a pure, testable, replay-safe data contract first.

## Expected Outcome
- Introduce a new pure TypeScript planetary/environment domain core under `apps/weltraum-browser/src/planetary-environment/**`.
- Produce deterministic `PlanetaryEnvironmentSample` outputs from explicit inputs only.
- Preserve a narrow contract: environment is consumed by later systems but does not own Suit/Oxygen, flight, renderer, weather visuals, or any landing decision authority.
- Provide stable fixtures and a normal-route evidence proof that executes the new index entry and proves deterministic byte-equivalence.
- Keep all runtime-facing behavior unchanged for this slice.

## Source and verification plan
- Start from a new isolated worktree on `feature/browser-planetary-environment-core-v1`.
- Branch base SHA: `75d78d4c8d12e2d85a8fb70864feb19dbe8d9c8f` (`origin/main` after `git fetch --all --prune`).
- Scope includes only:
  - `.devtoolbox/specs/changes/browser-planetary-environment-core-v1/**`
  - `apps/weltraum-browser/src/planetary-environment/**`
  - `apps/weltraum-browser/tests/unit/planetaryEnvironment*.test.ts`
  - `apps/weltraum-browser/tests/e2e/planetary-environment-core.spec.ts`
  - `apps/weltraum-browser/tests/e2e/configs/planetary-environment-core.playwright.config.ts`
  - `apps/weltraum-browser/evidence/browser-planetary-environment-core-v1-summary.json`
  - `apps/weltraum-browser/evidence/browser-planetary-environment-core-v1.md`
  - `docs/browser-mainline/planetary-environment-core-v1.md`
- Exclusions remain hard:
  - No changes in forbidden runtime/path domains and no package-lock or root-config updates.
  - No Main-merge during implementation.
  - No TestBridge usage on normal `/` flow.

## Boundaries carried from upstream acceptance brief
- Reuse/adapt deterministic patterns from `apps/weltraum-browser/src/resources/serialization.ts` and `apps/weltraum-browser/src/ship-builder/validation.ts` (precision-preserving canonical signature + strict fail-closed validation style), without editing those files.
- Preserve "no authority" for suit, flight, terrain, renderer, weather visual, or survival outcomes inside this change.
