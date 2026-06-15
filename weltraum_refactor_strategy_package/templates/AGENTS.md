# AGENTS.md - Weltraum-Spiel

## Projektregel

Dieses Unity-Projekt wird agentengestützt entwickelt. Arbeite spec-first,
klein, überprüfbar und mit Evidence. Keine großen opportunistischen Refactors.

## Wichtige Pfade

```text
Assets/_Weltraum/            Neuer Produktkern
Assets/Scripts/Prototype/    Legacy-Prototyp, nur Adapter/Fixes
Assets/Scenes/               Alte Szenen und Legacy Bootstrap
docs/architecture/           Architekturentscheidungen
docs/ux/                     UI/Input/Flow-Dokumente
docs/roadmap/                Planung und Meilensteine
.devtoolbox/specs/changes/   Spec Changes, Tasks, Evidence
.agent/PLANS.md              ExecPlan-Regeln
```

## Vor jeder Aufgabe

1. Lies diese Datei.
2. Lies die relevante Spec.
3. Prüfe docs/current-prototype-state.md und relevante design-audits.
4. Schreibe einen kurzen Plan.
5. Arbeite nur am vereinbarten Scope.

## Code-Regeln

- Neue Produktfeatures gehören unter `Assets/_Weltraum`.
- `Assets/Scripts/Prototype` ist Legacy. Nicht erweitern, außer der Task sagt es.
- Autopilot-Kern: Planner, Plan, Executor, Diagnostics trennen.
- UI spricht über ViewModels/Commands, nicht direkt mit Planner-Interna.
- Scenes enthalten Wiring, keine Geschäftslogik.
- Keine stillen Replans im Autopilot Executor.
- Keine Cargo/Surface/Economy Features ohne Datenvertrag.

## Tests

Für Codeänderungen:

```text
dotnet build "Weltraum Spiel.sln" --no-restore
dotnet test "Weltraum Spiel.sln" --no-build
```

Für Unity-Arbeit zusätzlich:

```text
- Unity MCP validate_script oder console check
- relevante EditMode/PlayMode Tests
- Screenshot/Evidence bei UI/Scene Änderungen
```

## DevToolbox

Nutze den Spec-Workflow:

```text
workspace_prepare_for_agent
specs_get_status
tasks_load
execution_create
verify_run
tasks_completion_preflight
tasks_toggle
```

Tasks werden erst nach Evidence und Completion Preflight geschlossen.

## UI-Regeln

- Player UI und Debug UI trennen.
- Modus immer sichtbar.
- Eine primäre Aktion pro Kontext.
- Keine generischen AI-UI-Muster: übertriebene Glass Panels, Gradient-Dashboards,
  Unicode-Icon-Suppe, unnötige Floating Cards.
- Screenshot-Matrix für sichtbare UI-Änderungen.

## Scene-Regeln

- Neue Scenes brauchen Manifest.
- Keine Missing Scripts.
- Genau eine aktive MainCamera, außer dokumentiert.
- Keine Produktlogik als Scene-only Script.
- Scene validation und Screenshot/Evidence bei Änderungen.

## Wenn Aufgabe komplex ist

Nutze einen ExecPlan nach `.agent/PLANS.md`.
