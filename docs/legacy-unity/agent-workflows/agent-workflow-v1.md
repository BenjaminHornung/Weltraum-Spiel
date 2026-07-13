# Legacy: AI-Agent, Codex, MCP und DevToolbox Workflow

> **[LEGACY]** Dieses Dokument beschreibt den entfernten Unity-/Unity-MCP-
> Arbeitsablauf. Aktive Browser-Arbeit folgt dem Root-`AGENTS.md`,
> `.agent/PLANS.md` und den aktuellen Browser-Specs. Die folgenden Unity-Regeln
> sind ausschließlich historische Referenz.

## Ziel

Das Projekt wird hauptsächlich von AI-Modellen und Agents entwickelt. Deshalb
muss der Prozess so gebaut sein, dass Agents nicht “irgendwie” patchen, sondern
wiederholbar, testbar und mit Evidence arbeiten.

## Repo-Regeln

```text
- Root AGENTS.md ist Pflicht.
- Subfolder-AGENTS.md für Navigation, UI, Scenes, Tests, Editor Tools.
- .codex/config.toml für repo-spezifische Tools/Permissions/MCP.
- .agent/PLANS.md für große Refactors.
- Jede größere Änderung läuft über DevToolbox Spec Change.
```

## Agenten-Bootstrap

```text
1. Lies AGENTS.md.
2. Lies relevante docs/architecture, docs/ux, docs/design-audits.
3. Nutze DevToolbox workspace_prepare_for_agent.
4. Lies Spec proposal/design/tasks/spec.
5. Lade aktuelle Tasks.
6. Erstelle einen Plan.
7. Implementiere nur die ausgewählte kleine Phase.
8. Verifiziere.
9. Schreibe Evidence.
10. Markiere Tasks erst nach Completion Preflight.
```

## Subagents

### Gute Subagent-Rollen

```text
Spec-Audit-Agent
  Read-only. Sortiert offene/stale Specs und schlägt Reconciliation vor.

Architecture-Agent
  Read-only oder docs-only. Prüft Dependency-Richtung, Assembly-Grenzen,
  Namenskonventionen, Migrationsrisiken.

Autopilot-Agent
  Implementiert nur Navigation/Autopilot-Contracts, Planner, Executor,
  Tests. Kein UI-Polish nebenbei.

Physics-Simulation-Agent
  Prüft Frames, Gravity, Floating Origin, Mass/Fuel/Authority.

UI-Agent
  Bearbeitet ViewModels, Presenter, Screenshots, Layout. Keine Planner-Logik.

Scene-Harness-Agent
  Baut/validiert TestRanges und UIShowrooms. Keine Gameplay-Algorithmen.

Verification-Agent
  Führt Builds, Unity Tests, MCP validation, screenshots und Evidence aus.

Cleanup-Agent
  Archiviert nur nach Preflight und nur mit klarer Benutzerabsicht.
```

### Was parallel laufen darf

```text
- Read-only Exploration.
- Tests/Logs auswerten.
- Screenshot-Audit.
- Spec-Klassifikation.
- Documentation consistency audit.
```

### Was nicht parallel geschrieben werden darf

```text
- dieselben C# Runtime-Dateien
- dieselben Scenes/Prefabs
- dieselben Spec tasks.md
- dieselben UI layout assets
```

## Prompt-Format

Jeder Codex-Auftrag enthält:

```text
Goal:
Context:
Files/Specs:
Constraints:
Implementation boundary:
Verification:
Done when:
Do not:
```

## Definition of Done für Code

```text
- compile/build grün oder klar dokumentierter externer Blocker
- relevante EditMode/PlayMode Tests grün
- Unity console/script validation ohne neue Errors
- Evidence in .devtoolbox/specs/changes/<change>/tests/
- docs aktualisiert, falls Verhalten/Architektur geändert
- keine stillen Regressionen in Autopilot/UI/Scene Bootstrap
```

## Definition of Done für UI

```text
- Screenshot vor/nach oder Matrix
- relevante Auflösungen geprüft
- kein Debug-only Zugriff für Player-Aufgabe
- Modus/Owner/Nächste Aktion sichtbar
- keine Überlappung
- Player UI und Debug UI getrennt
```

## Definition of Done für Specs

```text
- proposal.md
- design.md bei Architektur/Autopilot/UI/Scene/Data Contracts
- specs/<capability>/spec.md
- tasks.md mit Phasen
- tests/test-protocol.md nach Umsetzung
- tasks erst nach Verifikation schließen
```

## Goals / ExecPlans

Für Autopilot V2, UI Redesign und Clean-Core-Refactor sind normale
Einzelprompts zu klein. Nutzt:

```text
/goal Autopilot V2 pure planner and executor pass deterministic direct, obstacle,
fuel, invalid-target and no-silent-replan tests without modifying legacy
Prototype runtime except adapters.
```

Oder:

```text
ExecPlan: Implementiere Clean-Core Skeleton und AGENTS.md-Regeln.
```

## Unity MCP Nutzung

```text
- manage_scene: Scene laden/validieren.
- validate_script: nach C# Änderungen.
- run_tests: EditMode/PlayMode Kategorien.
- read_console: neue Errors/Warnings prüfen.
- unity_docs/unity_reflect: API-Fragen verifizieren.
- manage_build: Build-/Scene-Konfiguration prüfen.
- manage_physics: TestRange-Physics validieren.
- manage_profiler: Performance-Spikes untersuchen.
```

## DevToolbox Nutzung

```text
- workspace_prepare_for_agent
- specs_get_status
- specs_validate
- tasks_load
- launch_build_package
- execution_create
- execution_add_notes
- verify_run / verify_get_results
- tasks_completion_preflight
- tasks_toggle
- specs_archive_preflight
- specs_archive_change nur nach expliziter Archiv-Phase
```

## Anti-Pfusch-Regeln

```text
- Keine neuen Features ohne Spec oder klaren Fix-Scope.
- Keine großen “while here” Änderungen.
- Kein Autopilot-Fix ohne Proving-Ground/Evidence.
- Keine UI-Änderung ohne Screenshot.
- Keine Scene-Änderung ohne Scene validation.
- Keine stillen Replans im Autopilot Executor.
- Keine Cargo-/Resource-/Surface-Features ohne gemeinsamen Datenvertrag.
- Keine Player-Aufgabe darf Debug-Funktionstasten benötigen.
```
