# Proposal: Autopilot Plan Execution Fidelity

## Problem

Der Waypoint-Autopilot soll einen vorab berechneten Flugplan (Align, Burn, Flip, Brake, Hold) exakt abfliegen. Stattdessen:

1. Der Flip kommt gefuehlt viel zu frueh, der Deceleration-Burn ebenfalls; das Schiff bremst auf null, lange bevor das Ziel erreicht ist, und muss dann erneut beschleunigen (mehrfache Flips pro Transfer).
2. Die UI zeigt fast dauerhaft `REPLAN` / Divergenz-Status, statt dass der Plan einfach abgearbeitet wird.
3. Der ueber den Plan-Knopf erzeugte Plan wird beim Start des Autopiloten verworfen und neu gerechnet.

Die Ursachenanalyse (siehe `design.md`) zeigt: Der Plan ist physikalisch nicht treu (kein Spool-Up, falsche Drehzeit-Schaetzung), und der Executor manipuliert die Plan-Uhr (Clock-Holds und Clock-Skips), wodurch die zeitindizierte Referenztrajektorie systematisch von der echten Schiffsposition abweicht. Der Divergenz-Monitor meldet dann "korrekt" permanente Abweichungen, erzwingt Replans im 0,5-s-Takt, und jeder Replan nach dem energetischen Mittelpunkt erzeugt einen Sofort-Brems-Plan — daraus entsteht die beobachtete Burn/Flip/Brake-Oszillation.

## Outcome

- Ein einmal berechneter DirectFastTransfer-Plan wird bei nominaler Ausfuehrung ohne einen einzigen erzwungenen Replan abgeflogen: genau 1 Align, 1 Burn, 1 Flip, 1 Brake, Ankunft innerhalb von Arrival-Radius und Arrival-Speed.
- Plan-Zeit == Physik-Zeit. Keine Clock-Holds/Skips mehr; wenn das Schiff dem Plan nicht folgen kann, ist das eine ehrliche Divergenz mit ehrlichem Replan.
- Der Planner benutzt dasselbe Drehraten- und Schubmodell wie die Ausfuehrung (Spool-Up/Down, SAS-Drehratenlimits), sodass der Plan tatsaechlich fliegbar ist.
- `REPLAN`-Chip erscheint nur noch bei echten erzwungenen Replans.
- Der ueber den Plan-Knopf erzeugte Plan wird beim Engage uebernommen, wenn er noch gueltig ist.

## Scope

- `Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs` (Solver, Attitude-Schaetzung, Segment-/Sample-Erzeugung)
- `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs` (Executor-Uhr, Skip/Hold-Logik, Brems-Metriken, Replan-Hygiene, Engage-Pfad)
- `Assets/Scripts/Prototype/PrototypeFlightPlan.cs` (Tracker-Toleranzen, geschwindigkeitsabhaengige Toleranz)
- EditMode-/PlayMode-Tests inkl. Regression "nominaler Transfer ohne Replan"

## Non-Goals

- Kein neues UI (nur Status-Korrektheit), kein Timewarp (separates Konzept `docs/spielkonzept/autopilot-timewarp.md`).
- Keine Orbital-/Gravitationsplanung; es bleibt beim geradlinigen Bang-Bang-Profil.
- Die grosse strukturelle Zerlegung des 5500-Zeilen-Autopiloten ist als optionale Phase 7 beschrieben, aber nicht Pflichtteil dieses Changes.
