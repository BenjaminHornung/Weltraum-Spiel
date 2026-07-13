# Design: DevToolbox Change Reconciliation v1

## Approach

This is a docs/spec reconciliation task. The implementation consists entirely of
reading change folders, grouping them, and writing summary documents. No runtime
code is generated.

## Data Sources

- `.devtoolbox/specs/changes/<change>/proposal.md` - intent and scope.
- `.devtoolbox/specs/changes/<change>/tasks.md` - checked and open task counts.
- `.devtoolbox/specs/changes/<change>/tests/test-protocol.md` - evidence presence.
- `.devtoolbox/specs/changes/<change>/specs/*/spec.md` - formal requirements.
- `docs/legacy-unity/devtoolbox-audits/change-audit-2026-06-14.md` - prior audit classifications.
- `docs/legacy-unity/current-prototype-state-2026-06-15.md` - documentation truth.
- `docs/design-audits/2026-06-14-planning-consistency-audit.md` - design gaps.
- `docs/legacy-unity/roadmap/milestones.md` - milestone ordering.
- `docs/legacy-unity/roadmap/spec-sorting-backlog.md` - prior backlog grouping.

## Classification Logic

Each change is classified into one of six groups:

| Group | Includes |
| --- | --- |
| A Architecture/Hygiene | Core runtime structure, performance, test harness, project backbone |
| B Navigation/Autopilot | All autopilot, flight plan, navigation computer, proving ground |
| C UI/Input/Map | All player HUD, input mode, radar, minimap, target indicators, map |
| D Data Contracts | Resource/cargo model, ship-builder data, socket/metadata contracts |
| E Gameplay Slices | Ship builder UX, planet, drones, weapons, combat |
| F Archive/Reconcile | Superseded, residual evidence, audit, evidence manifest |

Each change row receives:

- **Status**: Complete / Reconcile-First / Active / Draft / Superseded
- **Evidence**: Yes (test-protocol present) / No / Partial
- **Blocker**: stale tasks / missing validation / prerequisite / none
- **Recommendation**: Keep Active / Reconcile First / Archive Candidate / Superseded
- **Next Action**: concrete step

## Exact-Arrival Contradiction Resolution

Evidence from `fix-autopilot-exact-point-arrival-v1/tests/test-protocol.md`
(2026-06-14) is unambiguous:

- Unity MCP script validation: PASS, 0 errors.
- Focused EditMode tests: 46/46 PASS.
- Proving Ground evidence generator: PASS.
- Proving Ground acceptance gate: PASS.
- PlayMode nominal-reacquire regression: PASS.
- `dotnet build`: PASS.
- `specs_validate`: PASS.
- All scenarios PASS with final distances 0.20m to 0.52m, 0 disallowed profiles,
  0 post-brake Accelerate transitions.
- No-RCS negative case correctly reports `Failed` (no false completion).

The prior `docs/legacy-unity/current-prototype-state-2026-06-15.md` "Known Current Autopilot Blocker"
section lists these as failing/expected failures. That is stale. The doc is
updated directly because the evidence is clear.

## Risk

- Misclassifying a planning-only change as stale. Mitigation: planning-only
  proposals with intentionally open tasks are classified as "Keep Active" or
  "Blocked by prerequisite", not as stale.
- Archiving prematurely. Mitigation: this change does not archive anything.

## Non-Goals

- No runtime code.
- No Unity assets.
- No Prototype changes.
- No archiving.
- No task toggling.
