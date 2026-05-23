# Design

## Audit Model

The audit treats `docs/player-facing-ui-concept-v0.md` as the source of truth. Each requirement is classified as:

- `Proven`: direct code/test/runtime evidence covers the requirement.
- `Partial`: implementation exists but evidence is narrower than the requirement.
- `Deferred`: the concept explicitly marks it as non-v0 or later work.
- `Missing`: no current implementation/evidence.
- `Contradicted`: runtime or tests show the requirement is not currently true.

## Runtime Matrix

The GameView evidence must cover these player-facing surfaces:

1. Cruise/objective baseline: flight HUD, objective panel, radar, systems, no debug windows.
2. Navigation/autopilot context: nav target/route/trajectory/radar target evidence.
3. Combat context: combat panel, weapon controls, target bracket/indicator and AutoFire state.
4. Docking context: docking director, soft-capture/hard-lock-safe wording and no false docked claim.
5. Warning/low-resource context: warning strip/chips and ship status mapping.
6. Help overlay: Basic F1/player help excludes debug-only controls.
7. Aspect-ratio layout: at least one non-16:9 probe verifies fixed HUD panels do not overlap.

## Verification Strategy

- Use shell reads/searches for the document and code/tests.
- Use Unity MCP for script validation, focused EditMode tests, PlayMode probes and GameView screenshots.
- Use `dotnet build "Weltraum Spiel.sln" --no-restore` as the explicit solution build because generic root `dotnet build` is known to fail with MSB1011 in this workspace.
- Store all generated evidence under `.devtoolbox/specs/changes/player-ui-concept-runtime-audit-v1/tests/`.

## Dirty Worktree Boundaries

Existing unrelated changes must remain unstaged:

- `Packages/manifest.json`
- `Packages/packages-lock.json`
- `uam/README.txt`
- `.devtoolbox/specs/changes/player-target-indicators-v1/tests/screenshots/player-target-indicators-v1-gameview.png`
