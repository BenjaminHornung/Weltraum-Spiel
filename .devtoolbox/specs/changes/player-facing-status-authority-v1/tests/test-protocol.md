# Test Protocol: Player-Facing Status Authority v1 Setup

Date: 2026-06-15

## Scope

This was a docs/spec setup task only. No runtime UI implementation, scene, prefab,
asset, or prototype script change was made.

## Files Added

UX document:

- `docs/ux/player-facing-status-authority-v1.md`

Spec change scaffold:

- `.devtoolbox/specs/changes/player-facing-status-authority-v1/proposal.md`
- `.devtoolbox/specs/changes/player-facing-status-authority-v1/design.md`
- `.devtoolbox/specs/changes/player-facing-status-authority-v1/tasks.md`
- `.devtoolbox/specs/changes/player-facing-status-authority-v1/specs/player-facing-status-authority/spec.md`
- `.devtoolbox/specs/changes/player-facing-status-authority-v1/tests/test-protocol.md`

## Context Read

The following mandatory context was read before writing:

- `AGENTS.md`
- `.agent/PLANS.md`
- `docs/ux/player-ui-redesign-foundation-v1.md`
- `docs/ux/unified-ui-input-mode-architecture.md`
- `docs/ux/player-hud-map-builder-surface-flow.md`
- `docs/ux/debug-vs-player-ui-policy.md`
- `docs/architecture/autopilot-v2-design.md`
- `docs/roadmap/spec-sorting-backlog.md`
- `docs/roadmap/spec-sorting-2026-06-15.md`

Existing spec-change scaffold patterns were reviewed:

- `.devtoolbox/specs/changes/clean-core-runtime-architecture-v1/` (full scaffold
  with proposal/design/tasks/spec/test-protocol)

## Content Coverage Checklist

The design and UX document cover all required topics:

- [x] Status ownership matrix (Navigation, Cargo, Scanner, Faction/Legal, Ship
  Authority, Suit/Vitals).
- [x] Navigation Computer owns: route validity, ETA, fuel estimate, brake reserve,
  arrival state, authority warnings, plan invalidated/needs replan.
- [x] Cargo Service owns: mass/volume, transfer feasibility, containment, cargo
  too heavy.
- [x] Scanner owns: detection confidence, local hazard observations, observed
  ownership hints.
- [x] Faction/Legal Service owns: license/permit, action legality, enforcement
  risk.
- [x] HUD/Map/Suit/Terminal are Views: no own truth, show status/reasons/next
  action.
- [x] Warning chip taxonomy (code, owner, severity, player action).
- [x] Failure reason taxonomy (code, owner, player text, next action).
- [x] UI display rules for Ship HUD, System Map, Local Map, Suit HUD, Terminal.
- [x] Debug vs Player UI boundaries for status data.
- [x] Screenshot/Evidence Matrix for future UI runtime work.
- [x] Next derivable runtime tasks documented.

## Runtime/Asset Scope Check

Command:

```text
git diff --cached --name-only -- Assets ProjectSettings Packages
```

Result: no output after staging this change (no runtime/asset files in this
commit).

Command:

```text
git status --short
```

Result: includes this change's untracked additions under `docs/ux/` and
`.devtoolbox/specs/changes/player-facing-status-authority-v1/`, plus unrelated
untracked work outside this change (for example `Assets/_Weltraum/` and other
spec folders). Those unrelated files are not part of this setup task and are not
staged.

Conclusion: this change stages no runtime code, Unity scene, prefab, package,
project setting, asset, or `Assets/Scripts/Prototype` file.

## DevToolbox Validation

DevToolbox MCP `specs_validate` was not invoked to avoid side effects on task
checkboxes, per scope constraint ("Keine Task-Checkboxen toggeln"). The scaffold
follows the established pattern from `clean-core-runtime-architecture-v1`.
