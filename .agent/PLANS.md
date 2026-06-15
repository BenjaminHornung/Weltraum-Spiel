# PLANS.md - ExecPlans für Weltraum-Spiel

Ein ExecPlan ist ein lebendes Implementierungsdokument für große Refactors oder
mehrstufige Features. Er muss so geschrieben sein, dass ein Agent ohne
vorherige Erinnerung damit arbeiten kann.

## Wann verwenden?

```text
- Autopilot V2
- Clean-Core Architektur
- UI Redesign
- Scene Management
- Data Contract Migration
- große Spec-Reconciliation
```

## Pflichtstruktur

```markdown
# ExecPlan: <Name>

## Ziel
Was soll am Ende wahr sein?

## Kontext
Welche Dateien, Docs, Specs, Tests und Szenen sind relevant?

## Nicht-Ziele
Was darf nicht nebenbei passieren?

## Architekturentscheidung
Welche Grenzen, Module und Datenverträge gelten?

## Implementierungsphasen
Kleine Schritte mit überprüfbarem Ergebnis.

## Tests und Evidence
Welche Build-/Unity-/MCP-/Screenshot-/CSV-/JSON-Beweise sind nötig?

## Risiken
Was kann kaputt gehen?

## Rollback / Safe Stop
Wie erkennt ein Agent, dass er stoppen soll?

## Fortschrittslog
- [ ] Phase 1 ...
- [ ] Phase 2 ...

## Definition of Done
Konkrete Gates.
```

## Regel

Ein Agent darf den Plan aktualisieren, wenn er neue Fakten findet. Er muss
Änderungen im Fortschrittslog erklären.
