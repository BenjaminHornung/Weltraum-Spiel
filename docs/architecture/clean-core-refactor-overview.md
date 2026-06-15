# Weltraum-Spiel: Clean-Core-Refactor Strategiepaket

Stand: 2026-06-15

Dieses Paket fasst eine empfohlene nachhaltige Richtung für das Unity-Projekt
`BenjaminHornung/Weltraum-Spiel` zusammen. Es ist als Arbeitsgrundlage für
Codex/AI-Agents, Unity-MCP, DevToolbox-Specs und die weitere Projektplanung
gedacht.

## Kernaussage

Nicht einfach weiterpatchen. Nicht blind alles wegwerfen. Der beste Weg ist ein
kontrollierter Clean-Core-Refactor:

1. Das bestehende `Prototype`-System bleibt als Referenz, Legacy-Adapter,
   Testdatenquelle und Beweismaterial erhalten.
2. Neue Produktarchitektur entsteht parallel unter einem klaren Root wie
   `Assets/_Weltraum`.
3. Stabile Tests, Proving-Ground-Harness, Assets und fachliche Erkenntnisse
   werden migriert.
4. Autopilot, UI, Scenes, Data Contracts und Agenten-Workflow werden als
   eigenständige Systeme neu geschnitten.

## Enthaltene Dateien

- `01_project_structure.md` - Zielstruktur, Assembly-Grenzen, Module und
  Migrationsregeln.
- `02_autopilot_v2_design.md` - Autopilot-V2-Konzept von Planung bis Ausführung.
- `03_autopilot_test_harness.md` - reines Code-Harness, Unity-Testscene,
  Evidence-Format und MCP-Ablauf.
- `04_ui_ux_design_system.md` - Space-HUD, Minimap/Radar, 3D-Systemkarte,
  First-Person-HUD, Settings/Keybinds und UI-Regeln.
- `05_scene_management.md` - Scene-Strategie, Bootstrap, Vertical Slices,
  Test-Ranges und Validierung.
- `06_ai_agent_codex_workflow.md` - Codex-, DevToolbox-, MCP- und Subagent-Regeln.
- `07_specs_sorting_backlog.md` - Sortierung geplanter/offener Specs.
- `08_milestones.md` - granulare Meilensteine mit Definition of Done.
- `templates/AGENTS.md` - Vorschlag für ein Repo-weites Agentenregelwerk.
- `templates/PLANS.md` - ExecPlan-/Langaufgaben-Vorlage.
- `prompts/*.md` - direkte Arbeitsaufträge für Codex-/Unity-/Spec-Agents.
- `spec_drafts/*.md` - Startpunkte für neue DevToolbox-Spec-Changes.

## Empfohlene Ablage im Repo

```text
docs/architecture/clean-core-refactor-plan.md
docs/architecture/autopilot-v2-design.md
docs/architecture/scene-management-v1.md
docs/ux/player-ui-redesign-v1.md
docs/ai/agent-workflow-v1.md
docs/roadmap/milestones.md
AGENTS.md
.agent/PLANS.md
.devtoolbox/specs/changes/<change-name>/
```

## Arbeitsprinzip

Jede AI-Umsetzung bekommt eine kleine, überprüfbare Zielscheibe:

```text
Spec lesen -> Plan schreiben -> kleine Änderung -> Tests/Evidence -> Review ->
Docs/Evidence aktualisieren -> Task erst nach Preflight schließen
```
