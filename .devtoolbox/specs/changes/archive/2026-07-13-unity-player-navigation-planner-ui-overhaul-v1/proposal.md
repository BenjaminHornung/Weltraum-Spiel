# Proposal: Navigation Planner UI Overhaul (+ Weapon Computer UI, Minimap, Flip-Kamera)

## Problem

Der Waypoint-/Navigation-Planner ist funktional, aber als Spieler-UI ungeeignet:

1. **Planner-Fenster ist ein Debug-Dump.** Der Body besteht aus ~11 Zeilen Rohtelemetrie ("Authority: Flight plan emitted | executor pending | rev 122", "Plan: trajectory--520--120-3000-Burn rev 122 | Samples 470", "Track: pos 0.0m | cross 0.0m | sample 36", "Cmd: accel 0.01m/s2 | dot 0.00"). Das verletzt die eigenen Konzept-Docs (`docs/legacy-unity/ux/player-facing-ui-concept-v0.md` §3.2 "Nicht anzeigen", `docs/spielkonzept/navigation-computer.md` §16).
2. **Die Manoever-Sequenz ist eine Textliste**, obwohl die Segmentdaten (T+Start/Ende, Phase, Aktuator, ΔV, Fuel) perfekt fuer eine visuelle Timeline mit Fortschrittsmarker waeren.
3. **Die Planner-Map ist nicht route-first**: Schiff klebt am Kartenrand, keine Burn-/Flip-/Brake-Marker auf der Route, Route/Preview/Avoidance kaum unterscheidbar. Die eigenen Guidelines (`docs/player-hud-minimap-design-guidelines.md`) sind nur teilweise umgesetzt.
4. **Widerspruechliche/kryptische Status:** Top-Strip "HOLDING | No target" gleichzeitig mit Nav-Panel "Target 2/3 ... Angekommen"; "ETA nicht auf Kurs | Closing -57.8 m/s"; im Haupt-HUD sind "Route"/"Preview" nur bedeutungslose Farbbalken.
5. **Buttons ohne Semantik und Zustand:** "Plan" (HUD) vs "Replan" (Planner) fuer dieselbe Aktion, Engage ohne Engaged/Abort-Zustand, kein Planning-/Busy-Feedback, keine Disabled-Begruendung.
6. **Kein ΔV-/Fuel-Margin-Block**, obwohl das Konzept (navigation-computer.md §11) genau das fordert (benoetigt/verfuegbar, Bremsreserve, Reserve nach Ankunft).
7. **Weapon Computer hat keine Spieler-UI** — `PrototypeWeaponComputerPanel` ist reines IMGUI-Debugfenster.
8. **Chase-Kamera macht "komische Sachen" bei Flips:** Der Flip-Assist in `SimpleFollowCamera` triggert nur auf Autopilot-States `FlipForBrake`/`Brake`; Kill-Momentum-Flips (`PrototypeMomentumAssist`) und Align-Drehungen des Flugplan-Executors sind gar nicht abgedeckt.

## Outcome

- Der Navigation Planner wird ein lesbares Spieler-Werkzeug: Header mit Ziel + klarem Planstatus, Kennzahlenzeile (Dist/ETA/Closing/ΔV/Fuel-Margin), **visuelle Segment-Timeline** mit Live-Fortschritt, route-first Map mit Manoever-Markern, eindeutige Buttons mit Zustaenden. Entwickler-Telemetrie wandert in einen einklappbaren Details-Bereich bzw. Debug-Preset.
- Haupt-HUD-Navigationskontext zeigt eine kompakte, widerspruchsfreie Version derselben Daten (eine Statusquelle, uebersetzte Labels, Mini-Timeline statt Farbbalken).
- Minimap/Radar setzt die bestehenden Design-Guidelines um (Range-Modi, Prioritaetsfilter, unterscheidbare Routenarten, Edge-Indikatoren).
- Ein uGUI Weapon-Computer-Panel nach Konzept §6 (Ziel, Health, Range, Fire-Status, AutoFire, Priority); Tuning-/Recoil-Werte bleiben im IMGUI-Debugfenster.
- Die Chase-Kamera behandelt alle assist-getriebenen 180°-Drehungen (Autopilot-Flip, Executor-Align, Kill Momentum) mit demselben stabilen Manoever-Kameramodus.

## Scope

- `Assets/Scripts/Prototype/PrototypePlayerHud.cs` (Planner-Panel, Nav-Kontext, Radar/Planner-Map, neue Timeline-/Gauge-Widgets)
- `Assets/Scripts/Prototype/PrototypeUiViewModels.cs` + Snapshot-Builder (semantischer Planner-Snapshot, Uebersetzungs-/Severity-Schicht)
- Neues uGUI-Combat-Panel (Daten aus `PrototypeWeaponComputer`/`PrototypeTurretWeapon`)
- `Assets/Scripts/Prototype/SimpleFollowCamera.cs` (generischer Manoever-Kameramodus)
- `Assets/Scripts/Prototype/PrototypeUiStyle.cs` (Typo-/Severity-Token, gemeinsam mit dem parallel vorgeschlagenen Slice "Warnungen + Typografie")

## Non-Goals

- Keine Orbit-Map-/Timewarp-UI (eigene Konzepte), kein Settings/Remapping, keine Lokalisierungs-Infrastruktur (nur deutsche/uebersetzte Labels ueber den bestehenden Translator-Ansatz).
- Keine Migration der reinen Debug-IMGUI-Fenster (DebugOverlay, DebugConsole) — die bleiben Developer-Layer.
- Kein Redesign der Autopilot-Logik; das laeuft separat in `fix-autopilot-plan-execution-fidelity-v1`. Achtung Abhaengigkeit: Der Dauer-REPLAN-Status ist dort ein echter Bug — die UI soll ihn ehrlich anzeigen, nicht kosmetisch verstecken.
