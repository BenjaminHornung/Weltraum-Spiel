# 07 - Spec Sorting und Backlog-Gruppierung

## Ziel

Die bestehenden Specs sind wertvoll, aber zu viele aktive/stale Changes machen
die Projektwahrheit unklar. Wir brauchen Gruppen, Reihenfolge und klare
Entscheidungen.

## Gruppe A - Sofortige Hygiene und Architektur

```text
clean-core-runtime-architecture-v1
prototype-freeze-and-legacy-adapter-v1
agent-workflow-and-agents-md-v1
scene-registry-and-manifest-v1
devtoolbox-change-reconciliation-v1
```

Ziel: Arbeitsbasis stabilisieren, bevor weitere Features wachsen.

## Gruppe B - Navigation und Autopilot

```text
autopilot-v2-core-planner-executor-v1
autopilot-v2-test-harness-v1
navigation-route-preview-and-status-contract-v1
autopilot-large-local-test-range-v1
timewarp-locked-plan-execution-v1
gravity-assist-research-harness-v1
gravity-assisted-route-candidates-v1
surface-target-descriptor-and-map-handoff-v1
```

Reihenfolge:

```text
1. V2 pure core
2. V2 test harness
3. route/status contract
4. large local range
5. timewarp locked execution
6. gravity research
7. gravity-assisted route candidates
```

## Gruppe C - UI/Input/Map

```text
unified-ui-input-mode-architecture-v1
player-facing-status-authority-v1
player-hud-redesign-v1
player-radar-minimap-v2
system-map-navigation-planner-v1
settings-keybinds-graphics-v1
debug-vs-player-ui-policy-v1
ui-screenshot-evidence-matrix-v1
```

Reihenfolge:

```text
1. Input mode state machine
2. Status authority
3. HUD ViewModels
4. HUD visual redesign
5. Minimap/Radar
6. System Map + Navigation Planner
7. Settings/Keybinds
```

## Gruppe D - Data Contracts

```text
resource-cargo-inventory-model-v1
player-ship-drone-cargo-transfer-v1
ship-cargo-mass-authority-integration-v1
surface-local-frame-architecture-v1
ship-part-socket-alias-and-metadata-contract-v1
ship-builder-gameplay-metadata-contract-v1
weapon-ammo-material-taxonomy-v1
faction-reputation-legality-rules-v1
```

Diese Specs sind Voraussetzung für Surface/Outpost/Economy/ShipBuilder
Runtime-Arbeit.

## Gruppe E - Gameplay Vertical Slices

```text
space-vertical-slice-v1
ship-builder-testflight-validation-v1
surface-mining-first-person-slice-v1
basic-combat-surface-slice-v1
settlement-service-model-v1
mission-contract-framework-v1
surface-drone-logistics-and-background-simulation-v1
faction-location-placement-and-ownership-v1
```

## Gruppe F - Archivieren/Reconcile

```text
archive-candidates-2026-06
stale-verification-metadata-reconciliation-v1
superseded-change-cleanup-v1
prototype-evidence-index-v1
```

Tasks:

```text
- Archive-Kandidaten nach Preflight archivieren.
- Stale task checkboxes gegen tatsächliche Evidence reconciliieren.
- Superseded Changes nicht als aktive Arbeit behandeln.
- Einen Evidence Index schreiben: welche Tests/Screenshots beweisen was?
```

## Codex-Agent Auftrag: Spec Sorting

```text
Goal:
Sortiere alle aktiven .devtoolbox/specs/changes in Gruppen:
A Architecture/Hygiene, B Navigation/Autopilot, C UI/Input/Map,
D Data Contracts, E Gameplay Slices, F Archive/Reconcile.

Context:
- docs/legacy-unity/current-prototype-state-2026-06-15.md
- docs/design-audits/2026-06-14-planning-consistency-audit.md
- docs/legacy-unity/devtoolbox-audits/change-audit-2026-06-14.md
- exact arrival test protocol
- docs/ux/unified-ui-input-mode-architecture.md
- docs/ux/player-hud-map-builder-surface-flow.md

Constraints:
- Read-only first pass.
- Do not archive or toggle tasks.
- Do not edit runtime code.
- Preserve evidence.
- Flag stale contradictions explicitly.

Output:
docs/roadmap/spec-sorting-YYYY-MM-DD.md with:
- change name
- group
- status
- evidence present
- blocker
- recommendation
- next action
```

## Spec-Entscheidungsregeln

```text
Keep Active
  Wenn echte offene Implementierung/Evidence fehlt.

Archive Candidate
  Wenn tasks grün, verification vorhanden, keine stale blocker.

Reconcile First
  Wenn Evidence grün, tasks aber offen oder docs widersprechen.

Superseded
  Wenn neuerer Change canonical ist.

Split
  Wenn Scope zu groß oder mehrere Systeme vermischt.

Merge Conceptually
  Wenn mehrere Specs dieselbe Datenwahrheit beschreiben, aber nicht Dateien
  blind zusammenführen.
```
