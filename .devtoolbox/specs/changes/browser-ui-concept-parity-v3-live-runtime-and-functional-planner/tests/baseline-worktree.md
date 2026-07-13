# V3 Dirty-Worktree Baseline

Captured on 2026-07-11 before V3 implementation.

## Branch

`feature/browser-ui-concept-parity-v2-visual-rework`

## Protected pre-existing changes

- Unrelated Unity, ProjectSettings, and older DevToolbox evidence/task changes
  were already modified or untracked. V3 must not alter, revert, stage, or move
  them.
- Existing V2 browser work was already present in `index.html`, `src/main.ts`,
  `src/style.css`, `src/render/three/debugScene.ts`, `src/render/three/shipVisual.ts`,
  `tests/e2e/ui-concept-parity.spec.ts`, V2 evidence, concept assets, and fonts.
- `.devtoolbox/specs/changes/browser-ui-concept-parity-v2/`,
  `apps/weltraum-browser/public/concept/`,
  `apps/weltraum-browser/public/fonts/`, `docs/browser-mainline/design-qa-v3.md`, `.playwright-mcp/`, and
  `nul` were already untracked.

## V3 allowed mutation surface

- `.devtoolbox/specs/changes/browser-ui-concept-parity-v3-live-runtime-and-functional-planner/**`
- `docs/browser-mainline/design-qa-v3.md` and the two V2 evidence reports only for explicit correction.
- `apps/weltraum-browser/index.html`
- `apps/weltraum-browser/src/**`
- `apps/weltraum-browser/tests/**`
- New V3 evidence under `apps/weltraum-browser/evidence/`

`unity-legacy-final-2026-07:Assets/**`, `package.json`, and lockfiles are forbidden. Final verification
must use `git status --short`, `git diff --name-status`, and a baseline-aware
forbidden-path comparison rather than assuming those paths began clean.
