# Tasks: Navigation Planner UI Overhaul

Referenz: `design.md` (Zeilennummern = Commit `a68333b`). Voraussetzung: Typografie-/Severity-Token und Button-States aus den parallelen UI-Slices (Slice 1+2 des HUD-Reviews) — falls noch nicht vorhanden, zuerst minimal in `PrototypeUiStyle`/`CreateButton` anlegen.

## Phase 1 — Datenlayer & Statusquelle
- [ ] `PrototypePlayerNavigationSnapshot` erweitern: `PlanStateBadge` (enum/Text/Severity nach navigation-computer.md §17), `DeltaVRequired/Available`, `FuelAfterArrivalFraction`, `BrakeReserveOk`, `TimelineSegments[]`, `TimelineProgress01`, `ActiveSegmentIndex`, `ManeuverMarkersWorld[]`, `ClosingTowardsTarget`.
- [ ] Eine Statusquelle fuer Top-Strip + Nav-Kontext + Planner (Widerspruch "HOLDING | No target" vs "Angekommen" beheben; Quelle des Top-Strip-Status identifizieren und auf den Autopilot-/Planner-Snapshot umstellen).
- [ ] Uebersetzungs-Mapping (deutsche Labels) gemaess ui-concept-v0 §5.2-Tabellen zentralisieren.
- [ ] EditMode-Tests fuer Badge-/Margin-/Timeline-Mapping.

## Phase 2 — Planner-Fenster Grundumbau (`PrototypePlayerHud.cs`)
- [ ] `BuildNavigationPlannerBody` (`:5157`) ersetzen: Header (Ziel + Badge), Kennzahlenzeile (Dist/ETA/Closing mit Richtungspfeil), Margin-Block (ΔV-Balken, Fuel nach Ankunft, Bremsreserve-Ampel).
- [ ] Debug-Zeilen (`PlanIdentityLabel` `:1391`, `TrackingErrorLabel` `:1409`, `TrackingCommandLabel` `:1428`, `PlanAuthorityLabel` `:1447`) in einklappbaren "Details"-Bereich; in Basic-Preset zu, in Debug-Presets offen (`PrototypeUiLayoutManager`).
- [ ] "Burn x / avail y | Schedule z" durch verstaendliche Angaben ersetzen (Plandauer, groesster Burn, Burnzeit verfuegbar).

## Phase 3 — Segment-Timeline-Widget
- [ ] Neues uGUI-Widget (eigene Datei, `MaskableGraphic` oder Image-Pool): Segmentbreite ∝ Dauer, Phasenfarben aus Style-Token, Mindestbreite, Live-Fortschrittsmarker, aktives Segment hervorgehoben.
- [ ] Detailzeile fuer aktives/gewaehltes Segment ("Hauptburn — 100% Schub, 2.9s, ΔV 34.3 m/s") statt Roh-Stepliste (`BuildNavigationManeuverRows` `:1241/:1264` nur noch fuer Details-Bereich).
- [ ] Mini-Variante im Haupt-HUD-Nav-Kontext; "Route"/"Preview"-Farbbalken entfernen.

## Phase 4 — Planner-Map & Radar
- [ ] Planner-Map-Framing: fit Route+Schiff+Ziel statt ship-zentriert (`CreateNavigationPlannerMapLayer` `:4139` + Update-Pfad); Spieler-Range-Override behalten.
- [ ] Manoever-Marker auf der Route (Burn-Start/Flip/Brake-Start aus `expectedStartPosition` der Segmente), Ziel mit Arrival-Radius-Ring, Edge-Indikator fuer Off-Range-Ziel.
- [ ] Route/Preview/Avoidance visuell unterscheidbar + Mini-Legende im Fenster; Map-Label (`BuildNavigationPlannerMapLabel` `:5223`) entlasten.
- [ ] Radar-Backlog aus `docs/player-hud-minimap-design-guidelines.md`: Range-Modi sichtbar, Prioritaetsfilter/Kontakt-Cap, Heading-Keil, Zoom-Buttons aus der Map-Flaeche.

## Phase 5 — Buttons & Haupt-HUD-Kontext
- [ ] "Plan"/"Replan" → einheitlich "Neu planen"; Engage als Toggle (Engage/Abbrechen) mit Engaged-Zustand; Disabled-Grund als Untertext/Tooltip; Busy-Feedback bei Planung.
- [ ] Haupt-HUD-Nav-Kontext auf 3 Zeilen + Mini-Timeline + `Prev/Next/Engage` reduzieren.

## Phase 6 — Weapon-Computer-Panel (uGUI)
- [ ] `PrototypePlayerCombatSnapshot` (ActiveTarget, Health, Range, FireStatus-Mapping, AutoFire-Status, PriorityMode, Zielliste gecappt).
- [ ] uGUI-Panel nach ui-concept-v0 §6 in den Kontext-Mechanismus (`CreateCombatComputerPanel` `:4197` ausbauen); Combat-Kontext ersetzt Nav-Kontext bei selektiertem Weapon-Target.
- [ ] IMGUI-`PrototypeWeaponComputerPanel` bleibt Debug-Preset (Tuning/Recoil/HitChance).

## Phase 7 — Manoever-Kameramodus (`SimpleFollowCamera.cs`)
- [ ] Gemeinsames Signal "assistgesteuerte Drehung" (z. B. ueber `PlayerShipController`): gespeist von Autopilot (`FlipForBrake`, `AlignForBurn` > 60° Soll-Ist, `Brake` + Drehrate) UND `PrototypeMomentumAssist` (`AlignForBrake`/`MainBrake`); `UpdateAutopilotFlipAssistState` (`:1139`) darauf umstellen.
- [ ] Referenzrichtung: Assist-geliefert → Velocity (nur |v| > Schwelle) → letzte stabile Kamerarichtung; kein Degenerate-Fallback bei v≈0.
- [ ] Hysterese pro Quelle; kein Modus-Flattern bei Replan-Ketten.
- [ ] PlayMode-Smoke: Kill Momentum aus Fahrt → kein Kamerasprung, Schiff bleibt im Viewport (ViewportSafety `:359` als Assertion nutzen).

## Phase 8 — Evidence
- [ ] Screenshot-Matrix (1280x720, 1024x768, 2560x1080, Hochformat) x Zustaende (kein Ziel, Plan bereit, Ausfuehrung, Replan, Combat) unter `tests/screenshots/`.
- [ ] Layout-/Overlap-Tests fuer neue Panels erweitern; Bindungs-Checks (`HasCompleteHudBindings` `:3752`) fuer alle neuen Elemente.
