# Test Protocol

## Zweck

Verifizieren, dass der Research-Change vollständig, reproduzierbar und strikt auf Dokumentation begrenzt ist.

## Checks

- [x] `specs_validate` für `research-planet-lod-streaming-reference-audit-v1` ist versucht und Ergebnis protokolliert.
- [x] `tasks_load` sowie Completion-Preflights sind versucht; blockierende Ergebnisse werden nicht umgangen.
- [x] Alle Pflichtprojekte und Zusatzquellen sind im Research-Dokument vorhanden.
- [x] Alle Projektsteckbriefe enthalten Commit-, Lizenz-, Pfad- und Statusfelder.
- [x] Evidenzarten und Bewertungsmodell sind sichtbar angewandt.
- [x] Alle vierzehn Ergebnisanforderungen sind vorhanden.
- [x] Browser-Captures liegen nicht im Repository.
- [x] Geänderte Pfade entsprechen der Allowlist.
- [x] `git diff --check` besteht.

## Ergebnisse

| Check | Ergebnis |
| --- | --- |
| `workspace_prepare_for_agent`, `specs_get_status`, `specs_validate` | BLOCKED: DevToolbox-MCP lehnte den isolierten Worktree jeweils mit `unauthorized_path` ab |
| `tasks_load`, `tasks_completion_preflight` für Task-Zeile 3 | BLOCKED: derselbe `unauthorized_path`; Preflight wurde nicht umgangen |
| `execution_create` | BLOCKED: `unauthorized_path`; daher entstand keine Execution-ID |
| `execution_add_notes` | NOT APPLICABLE: ohne Execution-ID nicht aufrufbar |
| `tasks_toggle` | NOT RUN: wegen blockierendem Completion-Preflight absichtlich nicht aufgerufen; `tasks.md` bleibt offen |
| Inhalts-/Pin-/Browser-Evidence-Prüfung | PASS |
| Pfad-Allowlist | PASS: exakt die Research-Datei und fünf Dateien des eigenen DevToolbox-Changes |
| `git diff --check` und `git diff --cached --check` | PASS nach vollständigem Staging des finalen Stands |
| Runtime-/Solution-/Unity-Tests | NOT APPLICABLE: reiner Dokumentationschange |

## Nicht anwendbare Runtime-Verifikation

Solution-Build, Unity EditMode/PlayMode und Runtime-Tests sind für diesen reinen Dokumentationschange `NOT APPLICABLE`. Externe Builds/Demos werden pro Projekt separat im Research-Dokument mit `PASS`, `FAIL`, `NOT RUN`, `NOT APPLICABLE`, `BLOCKED`, `PARTIAL`, `INCONCLUSIVE` oder `UNKNOWN` ausgewiesen.
