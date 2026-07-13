# Browser UI Concept Parity V3 Test Protocol

## Source of truth

- `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png`
- `docs/UI-Screenshots/03-navigationsplaner-sternenkarte-route.png`
- `docs/UI-Screenshots/07-kampf-hud-asteroidenfeld-feindkontakt.png`

## Required behavior

- Flight and planner evidence use normal `/` with live WebGL.
- Combat evidence uses only `/?uiScenario=combat-contact`.
- Normal `/` exposes neither TestBridge nor raw debug HUD.
- Planner flow: target -> profile -> preview -> replan -> Engage.
- Visible preview hash equals locked/executor hash after Engage.
- Escape/Close preserve route state; failed Engage remains visible and focused.
- Runtime map controls are keyboard-operable and measurably change view state.

## Verification commands

Run from `apps/weltraum-browser`:

```powershell
npm run test
npm run build
npm run test:e2e -- <focused and required regression specs>
git diff --check
```

## Visual evidence

- Normal `/`: 1640x900 and 1280x720.
- Functional planner: 1640x900 beside concept 03.
- Combat regression: 1640x900 beside concept 07.
- Full-view and focused comparisons are required for every P0/P1/P2 iteration.
- `docs/browser-mainline/design-qa-v3.md` remains `blocked` until fresh browser evidence has no actionable
  P0/P1/P2 finding.

## Repository safety

The initial worktree is dirty with unrelated Unity/spec/evidence changes. V3
must compare its final path delta to `baseline-worktree.md`, must not modify
`unity-legacy-final-2026-07:Assets/**`, `package.json`, or lockfiles, and must not stage, commit, or push.
