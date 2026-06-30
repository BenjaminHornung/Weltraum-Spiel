# Tasks: Browser Playable Ship Flight Polish v1

## Task 1 — Spec and worktree setup

- [x] Create dedicated worktree and branch from latest `origin/main`.
- [x] Add direct DevToolbox-style proposal, design, spec, and tasks artifacts because DevToolbox MCP is blocked for this repo path.

## Task 2 — Ship visual source and marker validation

- [x] Validate `Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb` read-only.
- [x] Either copy/use it safely under `apps/weltraum-browser/public/ships/` or document fallback if loader/marker risk is too high.
- [x] Ensure ship visual snapshot includes visual source state.
- [x] Add marker/socket descriptor validation for hull/body, cockpit/front, main engine, at least four RCS markers, muzzle placeholder, and camera anchor.
- Verification: focused unit/E2E assertions and `git status --short -- Assets` clean.

## Task 3 — HUD/help polish

- [x] Remove raw `(x, y, z)` velocity component triple from default player HUD while keeping vector telemetry available to TestBridge/evidence.
- [x] Update help/evidence wording: desktop keyboard/mouse manual flight; mobile target/autopilot-only.
- [x] Preserve player/debug separation and TestBridge gating.
- Verification: status HUD unit tests and default-page E2E leak checks.

## Task 4 — VFX/naming polish

- [x] Scale main thruster flame by acceleration magnitude instead of only `lastAppliedAcceleration.x`.
- [x] Rename misleading `stoppedShip`-style local variables in drift-preserving cancel code when present.
- Verification: unit or E2E render snapshot coverage where practical.

## Task 5 — Evidence, review, verification, commit

- [x] Add/update `apps/weltraum-browser/evidence/browser-playable-ship-flight-polish-v1.md`.
- [x] Update `docs/browser-mainline/port-roadmap.md`, `feature-intent-index.md`, and `known-unity-bug-traps.md` as needed.
- [x] Run `npm ci`, `npm run test`, `npm run build`, `npm run test:e2e`, Chrome fallback E2E if default fails only with known spawn issue, and `git status --short -- Assets`.
- [ ] Run `reviewer`, `reviewer-glm`, and `ui-designer` for meaningful review.
- [ ] Commit feature branch with `#WELTRAUM-000 Polish playable browser ship flight`, merge to `main` with `#WELTRAUM-000 Merge playable browser ship flight polish`, and push `main` after gates pass.

Note: review/commit/push remain unchecked because this bounded implementation handoff explicitly forbids commits, merges and pushes; review handoff is left for the parent flow.
