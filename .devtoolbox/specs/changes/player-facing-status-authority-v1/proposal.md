# Proposal: Player-Facing Status Authority v1

## Problem

Weltraum-Spiel hat mehrere Gameplay-Systeme, die Status produzieren, und mehrere
UI-Oberflächen, die ihn anzeigen: Ship HUD, System Map, Local Map/Radar, Suit HUD,
Navigation Computer, Terminal/Outpost Service und Cargo/Inventory.

Aktuell ist nicht dokumentiert, **welches System die Wahrheit besitzt** und welche
UI nur eine View ist. Das führt zu:

- UI, die eigene Berechnungen durchführt (ETA, Fuel, Risk) statt Authoritative
  Services zu fragen.
- Widersprüchliche Statusanzeige zwischen HUD, Map und Navigation Computer.
- Warnchips ohne klaren Owner, so dass verschiedene Panels unterschiedliche Gründe
  zeigen.
- Debug-Werte, die in die Player-UI durchsickern, weil es keine Grenzdefinition gibt.
- Keine Failure-Reason-Taxonomy, wodurch blockierte Aktionen nicht konsistent
  erklärt werden.

Die Folge: Der Spieler weiß nicht, warum eine Aktion blockiert ist, welche
Information verlässlich ist und welche nächste Aktion sinnvoll ist.

## Outcome

Dieser Change definiert eine kanonische **Status Ownership Matrix**: welches
System welchen Status besitzt und wie Views ihn anzeigen dürfen. Er definiert
zusätzlich eine **Warning Chip Taxonomy**, eine **Failure Reason Taxonomy**,
**UI Display Rules** pro Surface und eine **Debug-vs-Player-UI-Grenze**.

Nach diesem Change können spätere UI-Runtime-Aufgaben (HUD ViewModels, Map, Suit
HUD, Terminal) direkt ableiten: welche Services sie fragen, welche Codes sie
übersetzen und welche Warnungen sie zeigen dürfen.

## Scope

In scope:

- Status Ownership Matrix für Navigation Computer, Cargo Service, Scanner,
  Faction/Legal Service, Ship Authority/Flight Assist, Suit/Vitals Service.
- Warning Chip Taxonomy mit Owner, Severity, Spieleraktion.
- Failure Reason Taxonomy mit Code, Player-Text, nächster Aktion.
- UI Display Rules für Ship HUD, System Map, Local Map, Suit HUD, Terminal.
- Debug vs Player UI Grenze für Statusdaten.
- Screenshot/Evidence Matrix für spätere UI-Arbeit.
- UX-Dokument `docs/ux/player-facing-status-authority-v1.md`.

Out of scope:

- Runtime UI Implementierung (ViewModels, Prefabs, Panels).
- Scene-/Prefab-/Asset-Änderung.
- Prototype-Änderung.
- Autopilot-Planner-Neuimplementierung.
- Cargo-Datenmodell-Implementierung.
- Faction-Reputation-Runtime.
- Task-Checkboxen toggeln bestehender Changes.

## Source Context

- `AGENTS.md` — Projektregeln, UI-Regeln.
- `.agent/PLANS.md` — ExecPlan-Regeln.
- `docs/ux/player-ui-redesign-foundation-v1.md` — UI-Hierarchie, Warnchips,
  Informations-Level.
- `docs/ux/unified-ui-input-mode-architecture.md` — Modus-Besitz, HUD-Layer-Modell,
  Debug-vs-Player-Policy.
- `docs/ux/player-hud-map-builder-surface-flow.md` — Flow zwischen Surfaces,
  Context-Panel-Priorität.
- `docs/ux/debug-vs-player-ui-policy.md` — Debug-Grenze, Basic-Mode-Contract.
- `docs/architecture/autopilot-v2-design.md` — Autopilot-Telemetry-Codes,
  Zustandsmaschine, Failure-Reasons.
- `docs/roadmap/spec-sorting-backlog.md` — Gruppe C UI/Input/Map, Reihenfolge:
  Input Mode → Status Authority → HUD ViewModels.

## Success Criteria

- Der DevToolbox-Change existiert mit `proposal.md`, `design.md`, `tasks.md`,
  `specs/player-facing-status-authority/spec.md` und `tests/test-protocol.md`.
- Das UX-Dokument `docs/ux/player-facing-status-authority-v1.md` existiert und
  enthält die Status Ownership Matrix, Warning Chip Taxonomy, Failure Reason
  Taxonomy, UI Display Rules, Debug-vs-Player-Grenze und Screenshot Matrix.
- Keine Runtime-, Scene-, Prefab-, Asset- oder Prototype-Datei wurde geändert.
- Nächste UI-Runtime-Aufgaben (HUD ViewModels, Map, Suit HUD, Terminal) sind aus
  dem Dokument direkt ableitbar.
