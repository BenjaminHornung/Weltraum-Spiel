# Player-Facing UI Concept v0

**Zielpfad im Repository:** `.devtoolbox/specs/drafts/player-facing-ui-concept-v0.md`  
**Status:** Draft / Konzept, keine Implementierung, keine Task-Toggles  
**Basis:** GitHub-Repository `BenjaminHornung/Weltraum-Spiel`, Branch `main`, gelesen über die verfügbare GitHub-Anbindung. DevToolbox- und Unity-MCP-Tools waren in dieser Umgebung nicht als ausführbare Workspace-Tools verfügbar; deshalb wurde diese Datei lokal als Draft-Artefakt erstellt und nicht in das Remote-Repository geschrieben oder validiert.

## Executive Summary

Das aktuelle Projekt hat bereits eine ungewöhnlich gute Grundlage für ein späteres echtes Player-HUD: Viele spielrelevante Informationen sind nicht nur als Debug-Text vorhanden, sondern liegen bereits in ViewModel-/Snapshot-ähnlichen Strukturen, Controller-Diagnosen und klaren Gameplay-Komponenten vor. Besonders wiederverwendbar sind `PrototypeUiViewModels.cs`, `PlayerShipController.FlightControlDiagnostics`, `PrototypeWaypointAutopilot`, `PrototypeMomentumAssist`, `DockingPort`, `PrototypeWeaponComputer` und `ShipStats`.

Die vorhandene UI ist aber noch keine finale Spieler-UI. Sie ist überwiegend IMGUI, draggable, testfreundlich und für Prototyp-Diagnose gedacht. Die README beschreibt `PrototypeFlightHud`, `PrototypeDebugOverlay`, `PrototypeFlightDebugConsole`, `PrototypeKeybindOverlay` und `PrototypeMinimapOverlay` ausdrücklich als temporäre IMGUI-Prototypflächen und nicht als finale HUD-Art. Das UI-Konzept sollte deshalb nicht „mehr IMGUI hübscher machen“, sondern die vorhandenen Daten in eine klar getrennte Player-UI-Architektur überführen.

Der zentrale Vorschlag lautet:

- **v0:** ein kompaktes, spielbares Flight-HUD mit Navigation-/Autopilot-Strip, Ziel-/Combat-Kontext, Fuel/RCS/SAS/Modes, Warnchips und Radar-Minimap. Keine großen Debug-Fenster im normalen Spielbild.
- **v1:** getrennte Spezialmodi für Docking, Combat und Ship Status; bessere Panel-Hierarchie; erste UI-Toolkit/uGUI-Hybrid-Migration; lokalisierbare Labels; Controller-fähige Interaktionen.
- **v2:** Ship Builder, Mission/Reward UI, Loadout, modulare Damage-/Power-/Cargo-Panels, Cockpit-/diegetische Varianten und größere Map-/Navigation-Funktionen.

Wichtig: Der Spieler braucht im Moment-to-Moment-Flug nicht die Rohdaten des Physiksystems. Er braucht Zustand, Absicht und Handlungssicherheit: „Was macht mein Schiff gerade?“, „Wer hat Kontrolle — ich, Autopilot, Momentum Assist oder Docking Assist?“, „Was verhindert den nächsten Schritt?“, „Wie weit/schnell bin ich relativ zum Ziel?“, „Kann ich schießen/docken/bremsen?“. Raw wrench telemetry, allocator residuals, Testpuls-Buttons, Candidate Scores, Recoil-Impulse und Debug-Reset/Refuel-Aktionen bleiben Developer Layer.

---

## 1. Codebase-Audit

### 1.1 Existierende UI-Komponenten

#### `Assets/Scripts/Prototype/PrototypeFlightHud.cs`

`PrototypeFlightHud` ist aktuell die stärkste Brücke zwischen Debug-Prototyp und echter Player-UI. Es ist noch ein IMGUI-Fenster, zeichnet aber schon eine HUD/Navball-Fläche mit Forward-, Prograde-, Retrograde-, SAS-, Target- und optionalen Debug-Force-Markern. Zusätzlich enthält es eine Quick-Action-Leiste für Zielwechsel, Autopilot, Kill Momentum, Control Mode und SAS sowie eine kompakte Navigation-Computer-Zusammenfassung. Das ist **Prototype-UI**, aber viele Inhalte sind player-facing verwertbar.

Wiederverwendbare Daten/Funktionen:

- `PrototypeHudViewModelBuilder.Build(...)` als Snapshot-Quelle.
- `LastModeLabel`, `LastControlModeHint`, `LastSasLabel`.
- Target-/Velocity-/SAS-Markerprojektion.
- `BuildNavigationComputerSummary()` als Hinweis, welche Autopilot-Daten schon darstellbar sind.
- Quick Actions als Beleg für heute schon steuerbare Gameplay-Aktionen.

Nicht final übernehmen:

- IMGUI-Fensterchrome.
- Dauerhafte Textblöcke innerhalb/unter der Navball-Fläche.
- Debug-Force-Marker DES/ACT/RES als Standard.
- Rohformatierte Autopilot-Planwerte im Moment-to-Moment-HUD.

Quelle: `PrototypeFlightHud` zeichnet HUD/Navball, Quick Actions, Autopilot-/Target-Zusammenfassung und Debug-Force-Marker aus Gameplay-/Debug-Daten. fileciteturn7file0

#### `Assets/Scripts/Prototype/PrototypeUiViewModels.cs`

Diese Datei ist für eine echte UI-Architektur am wichtigsten. Sie trennt bereits Status, Autopilot, Momentum Assist, Marker und Debugdaten in ViewModel-Strukturen. `PrototypeHudStatusViewModel` enthält Speed, Throttle, Fuel und Warning; `PrototypeAutopilotViewModel` enthält Verfügbarkeit, Engagement, Ziel, State, Status, Arrival Phase und Failure Reason; `PrototypeMomentumAssistViewModel` enthält Active/State/Status/Speed/AngularSpeed; `PrototypeHudViewModel` fasst Marker und Moduslabels zusammen. Das ist die beste Grundlage für einen Player-UI-Data-Layer.

Wiederverwendbar:

- Snapshot-Building außerhalb von `OnGUI`.
- Warnungsaggregation: `NO RCS`, `AUTOPILOT FUEL`, `AUTOPILOT ABORTED`, `NO AUTHORITY`, `LOW FUEL`.
- Marker-Flags statt direktes UI-Abfragen von Komponenten.
- klare Trennung zwischen HUD-Daten und Debug-Daten.

Ausbauen:

- eigener `PlayerFlightHudSnapshot` statt „Prototype“-Name.
- stabilere semantische Labels und Lokalisierungs-Keys.
- getrennte Snapshots für Navigation, Combat, Docking, Ship Status.

Quelle: `PrototypeUiViewModels.cs` stellt Status-, Autopilot-, Momentum- und HUD-Marker-ViewModels bereit und baut diese aus Rigidbody, ShipStats, Controller, Autopilot und MomentumAssist. fileciteturn5file0

#### `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`

Das Debug Overlay ist eindeutig Developer Layer. Es zeigt Flight Diagnostics, Propulsion, RCS, SAS, Physics Core, Damage, Atmosphere/Gravity und Navigation/Floating Origin. Es enthält player-relevante Rohsignale, aber in einer Form, die nicht dauerhaft in ein Spiel-HUD gehört: RCS-Allocator-Residuals, Wrench-Telemetry, COM/Inertia, SAS-Gains, Active Nozzle IDs, PhysicsCore Net Force/Torque, Gravity Diagnostics usw.

Behalten:

- als F2 Developer Diagnostics.
- als Test-/Tuning-Oberfläche.
- als Quelle für QA/Dev-Evidence.

Nicht ins Player-HUD:

- Raw force/torque vectors.
- Allocator residuals.
- SAS PID internals.
- Debug damage counters in voller Tiefe.
- Floating-Origin internals.

Quelle: `PrototypeDebugOverlay` ist ein IMGUI Flight Diagnostics Window mit umfangreichen Propulsion/RCS/SAS/PhysicsCore/Damage/Gravity/Floating-Origin-Diagnosen. fileciteturn8file0

#### `Assets/Scripts/Prototype/PrototypeFlightDebugConsole.cs`

Die Debug Console ist keine Player-UI. Sie wird nur im Editor oder Debug Build gezeichnet, bietet UI-Presets, Refuel, Reset, Damage-Aktionen, Variant-Spawning, Test Environment, Debug Assist, RCS/Main/Gimbal-Testpulse und detaillierte Autopilot-/Momentum-/RCS-Diagnosen. Viele Buttons sind absichtlich Entwicklungswerkzeuge.

Behalten:

- F3 Developer Console.
- UI-Presets für Testläufe.
- Testpuls-/Refuel-/Reset-/Spawn-Aktionen.
- tiefe Autopilot-/Navigation-Computer-Diagnose.

Nicht ins Player-HUD:

- Refuel/Reset/Spawn/Testpulse.
- Candidate Scores.
- Plan-Refresh-Controls.
- Debug-only vector toggles.
- Variante/BuildMode-Kontrollen.

Quelle: `PrototypeFlightDebugConsole` zeigt Debug Actions, UI Presets, Calibration, Navigation/Autopilot, Momentum Assist und RCS-Testpulse und ist auf Editor/Debug Build begrenzt. fileciteturn9file0 fileciteturn10file0 fileciteturn11file0

#### `Assets/Scripts/Prototype/PrototypeKeybindOverlay.cs` und `PrototypeInputBindingCatalog.cs`

Das Keybind Overlay ist prototype-facing, aber näher an echter Player-UI als DebugOverlay/Console. Der InputBindingCatalog bildet bereits Common Sections und die drei Flight-Modes Cruise/Precision/Translation ab. Für ein echtes Spiel braucht daraus ein Pause-/Settings-/Help-System, aber v0 kann die Inhalte weiterverwenden.

Wiederverwendbar:

- Mode-spezifische Unterschiede.
- Common Sections für UI, Navigation/Autopilot, Momentum Assist, SAS, Camera, Weapons.
- DebugOnly-Kennzeichnung für Debug-Bindings.

Ausbauen:

- Action-basierte Anzeige statt harter Tastenstrings.
- Controller-/Keyboard-Umschaltung.
- Lokalisierung.
- später Remapping.

Quelle: `PrototypeInputBindingCatalog` trennt Common Controls, mode-spezifische Cruise/Precision/Translation-Bindings und Debug-only Einträge; `PrototypeKeybindOverlay` rendert daraus eine scrollbare Hilfe. fileciteturn12file0 fileciteturn68file0

#### `Assets/Scripts/Prototype/PrototypeMinimapOverlay.cs`

Die Minimap ist ein guter v0-Radar-/Situational-Awareness-Prototyp. Sie zeichnet ship-zentrierte XZ-Darstellung, Range Rings, Ship Heading, Velocity Vector, Targets, Beacons, Gates, Station, Obstacles und Autopilot-Route inkl. Avoidance/Predicted Route. Die vielen Filter und Labels sind prototype/debug-lastig, aber die Kernidee ist spielbar.

Wiederverwendbar:

- Range-Rings.
- Ship-centered Radar.
- target/station/beacon/gate/obstacle symbols.
- route/avoidance/predicted path from Autopilot.
- label limiting.

Nicht final übernehmen:

- draggable IMGUI window.
- sichtbare Debug-Filter als Default.
- zu viele Weltlabels.
- direkte Plan-/Obstacle-Debugwerte im normalen Radar.

Quelle: `PrototypeMinimapOverlay` zeichnet Radar/Minimap mit Zoomringen, Test-Environment-Objekten, Ship Heading/Velocity und Autopilot-Routen inklusive Avoidance. fileciteturn15file0 fileciteturn16file0

#### `Assets/Scripts/Prototype/PrototypeWeaponComputerPanel.cs`

Das Weapon Computer Panel ist eine Mischung aus Player- und Debug-UI. Es enthält echte Spielerinformationen: Target-Auswahl, Active Target, Auto Fire, Priority Mode, Target Health, Turret Status und Cooldown. Es enthält aber auch Debugwerte: HitChance, Projectile Tuning, Yaw/Pitch requested/applied und Recoil-Impulse.

Player-facing übernehmen:

- Active target.
- target health label.
- Auto Fire status.
- priority mode.
- turret status: no target, aligning, in arc, out of arc, cooldown, out of range, no muzzle/no authority.

Debug-only behalten:

- HitChance tuning.
- Projectile speed/diameter/fire-rate tuning text.
- requested/applied yaw/pitch als Zahlen.
- recoil impulse/position.

Quelle: `PrototypeWeaponComputerPanel` rendert Auto Fire, Priority, Target List, Active Target, Turret Status/Cooldown und Debugwerte wie Range/HitChance/Projectile/Recoil. fileciteturn30file0

#### `Assets/Scripts/Prototype/PrototypeUiLayoutManager.cs` und `PrototypeUiStyle.cs`

`PrototypeUiLayoutManager` ist eine gute Test- und Übergangsschicht, aber nicht finaler UI-Stack. Es verwaltet Window States, Presets und F1/F2/F3/F4/F5/F7-Toggles. Es zeigt, welche Ebenen bereits getrennt sind: Keybinds, Diagnostics, Console, HUD/Navball, Minimap, Weapon Computer. `PrototypeUiStyle` ist eine einfache IMGUI-Palette.

Wiederverwendbar als Konzept:

- UI-Layer-Toggles.
- Preset-Idee: Basic, Flight Test, RCS Test, Full Diagnostics.
- window-state tests.
- Trennung von normaler UI und Diagnostics.

Nicht final übernehmen:

- IMGUI-style system.
- PlayerPrefs-Fensterlayout als Haupt-UX.
- Presets als Game UI; eher Dev/QA Tool.

Quelle: `PrototypeUiLayoutManager` enthält Window IDs/Preset-Logik und Toggles für Diagnostics, Console, HUD, Minimap und Weapon Computer. fileciteturn13file0

### 1.2 Gameplay-Datenquellen für echtes UI

#### Flight / Controls

`PlayerShipController` liefert die wichtigste Runtime-Quelle für Flight UI. `PrototypeFlightControlDiagnostics` enthält RCS-Verfügbarkeit, RCS-Status, SAS enabled/effective/authority, Control Mode, Main Throttle, Main Thruster/Gimbal erlaubt, Autopilot-/Momentum-Status. Außerdem existieren public properties für MainThrottle, MainThrottleScale, RCS Translation Force, SAS, Gimbal, LastManualFlightInput und FlightAssistRequest-Ownership.

Quelle: `PlayerShipController` definiert `FlightControlMode`, `SasControlMode`, `GimbalAssistMode`, `PrototypeFlightControlDiagnostics` und erzwingt Precision/Translation als RCS-Modi ohne Main/Gimbal. fileciteturn17file0 fileciteturn18file0

#### Fuel / Ship Stats / Weapons

`ShipStats` liefert Fuel Current/Max, FuelConsumption, CurrentMass, Thrust, Projectile/Weapon-Settings, Turret Limits, AutoFire und LeadTarget flags. Für v0 sind fuel current/max, has fuel, throttle telemetry, engagement range, projectile cooldown-relevante FireRate, target range und turret limits relevant. Für Builder/Status später sind CurrentMass und MassProperties wichtig.

Quelle: `ShipStats` enthält Fuel, Mass, Thrust, Projectile/Gun/Turret-Werte, AutoFire/LeadTarget und Fuel-Telemetrie. fileciteturn35file0

#### Navigation / Autopilot

`PrototypeWaypointAutopilot` ist bereits reich an player-facing Daten: TargetName, Distance, ClosingSpeed, LateralSpeed, RelativeSpeed, StoppingDistance, ETA, FuelEstimate, CurrentState, ArrivalPhase, NavigationPhase, Obstacle/Avoidance, Planned ETA, Requested Throttle/RCS, Warning Chips und FailureReason. Diese Daten sollten nicht roh gezeigt werden, sondern in menschliche Statuslabels übersetzt werden.

Quelle: `PrototypeWaypointAutopilot` expose't Metrics, FuelEstimate, State, TargetName, Distance/Closing/Lateral/ETA, Obstacle/Avoidance, Planned ETA, RequestedThrottle/RCS und Warning Chips. fileciteturn21file0 fileciteturn22file0

#### Momentum Assist

`PrototypeMomentumAssist` ist ein echtes gameplay-nahes Assistenzsystem. Es arbeitet physisch über Main/RCS/SAS/FlightAssistRequest und hat klare Zustände: Idle, AlignForBrake, MainBrake, RcsDamp, Complete, Aborted, NoAuthority, FuelInsufficient. Für UI sind Active, State, Status, Speed, AngularSpeed und Failure relevant; raw requested force/torque bleibt Debug.

Quelle: `PrototypeMomentumAssist` expose't IsActive, CurrentState, StatusLabel, Speed, AngularSpeed, LastRequestedForce/Torque, BrakeDirection und MainThrottleRequest. fileciteturn25file0

#### Docking

`DockingPort` liefert Relative State und Eligibility: distance, angle error, relative speed, closing speed, local offset, soft/hard capture eligibility und diagnostic reason. Soft Capture baut einen physischen `FlightAssistRequest`; Hard Lock ist aktuell nur ein Placeholder und darf im UI nicht als fertige Docking-Verbindung verkauft werden.

Quelle: `DockingPort` definiert RelativeState, Eligibility, SoftCaptureRequest und HardLockResult; HardLock erstellt aktuell keinen Joint und meldet Placeholder/NotYetImplemented. fileciteturn26file0 fileciteturn27file0

#### Combat / Weapon Computer

`PrototypeWeaponComputer` und `PrototypeTurretWeapon` liefern target selection, priority, active target, AutoFire, turret status, range/arc/cooldown/alignment/no muzzle/no authority. `PrototypeTurretFireStatus` hat block reasons und cooldown/distance. `PrototypeWeaponTarget`-Daten werden in Tests über health fallback und registry snapshots abgesichert.

Quelle: `PrototypeWeaponComputer` verwaltet Target Discovery, Selection, Priority, ActiveTarget, AutoFire und TurretStatusLabel; `PrototypeTurretWeapon` blockt Fire bei no muzzle/no authority/out of range/out of arc/aligning/cooldown. fileciteturn31file0 fileciteturn32file0 fileciteturn34file0

### 1.3 Specs und Tests, die die UI-Richtung einschränken

Die vorhandene Spec-Lage sagt klar: Die bisherigen UI-Changes zielten auf Lesbarkeit/Testbarkeit, nicht auf finale Player-UI. `prototype-ui-readability-testability-pass` will IMGUI-Fenster draggable/collapsible machen, HUD lesbarer machen und Debug-Marker standardmäßig leise halten; UI Toolkit, final game HUD, main menu, settings und remapping sind ausdrücklich out of scope. fileciteturn43file0 fileciteturn44file0

`prototype-test-environment-ui-pass` ergänzt Orientierung, Minimap/Radar und Test-Range, aber ebenfalls ohne final map/router/docking mechanics. fileciteturn45file0

`fix-prototype-usability-flight-feel` priorisiert eine ruhigere Standardansicht, explizite Normal/Precision/Translation-Modes, sichtbaren Autopilot und physischen Kill Momentum Assist, aber keine Builder/Combat/Docking/Mission/UI-Finalisierung. fileciteturn46file0

`prototype-waypoint-navigation-autopilot-v0` und `prototype-autopilot-arrival-tuning-v1` definieren den Autopilot als physisches, nicht-teleportierendes System mit Target, Distance, Closing/Lateral, FuelEstimate, State, ETA und ArrivalStatus. fileciteturn47file0 fileciteturn48file0 fileciteturn49file0

`docking-physics-system` ist bewusst klein: DockingPorts, relative state, soft capture, hard-lock placeholder, Diagnostics; keine UI-heavy Docking Computer und kein final constraint solver. fileciteturn50file0 fileciteturn51file0

`combat-weapon-computer-turret-mode-v0` definiert Weapon Computer/Turret Mode als IMGUI-Prototyp mit target selection, priority, auto-fire, arc/range/cooldown/status und data-driven projectile/recoil values, aber keine finale UI-Art. fileciteturn52file0 fileciteturn53file0

Die Tests unterstützen die spätere Player-UI-Architektur: `PrototypeUiArchitectureValidationTests` beweist, dass HUD-ViewModels ohne `OnGUI` gebaut werden, dass Keybind-ViewModels mode-spezifisch sind, dass UI-Presets keine Flight-Control-Werte mutieren und dass FlightTest-Preset Debug Console / Weapon Computer geschlossen hält. fileciteturn57file0 `PrototypeFlightHudValidationTests` testet Markerprojektion, HUD-Binding nach Bootstrap und Debug-Force-Marker-Gating. fileciteturn56file0 `PrototypeControlModeValidationTests` deckt explicit Control Modes, Translation mapping und Diagnostics Snapshot als Single Source ab. fileciteturn67file0 Combat- und Docking-Tests sichern Target/Priority/Arc/Cooldown/SoftCapture/HardLock-Gating. fileciteturn64file0 fileciteturn63file0

---

## 2. Player UI Design Goals

1. **State clarity over raw telemetry.** Der Spieler soll Zustände und Konsequenzen sehen: „RCS limitiert“, „Autopilot bremst“, „Ziel außerhalb Feuerwinkel“, nicht `desiredForce=(...)`, `residual=(...)`.

2. **Minimal während Flight, erweiterbar beim Planen.** Normaler Flug zeigt Speed, Throttle, Fuel, Mode, RCS/SAS, Ziel/Assist-Warnungen. Details wie ETA, Lateral Speed, Route, Module Status und Weapon Priority erscheinen kontextuell oder auf Wunsch.

3. **Assist-Ownership sichtbar machen.** Wenn Autopilot, Momentum Assist, Docking Assist oder SAS gerade physisch Kontrolle anfordert, muss das sofort sichtbar sein. Manual Override/Abort muss verständlich sein.

4. **Physische Schiffssysteme lesbar machen.** Fuel, Main Thruster, RCS, SAS, Weapon, Docking und Module Damage sind nicht Kosmetik; sie beeinflussen Flight. UI muss diese Systeme als Ship-Status verständlich machen.

5. **Mode-Wechsel müssen eindeutig sein.** Cruise/Normal, Precision und Translation sind im Code funktional unterschiedlich. Das HUD muss zeigen, was W/S/A/D gerade bedeuten und ob Main/Gimbal aktiv sind.

6. **Kontext statt Mega-HUD.** Navigation, Docking und Combat teilen Zentrum/Target-Kontext. Nicht alle Panels gleichzeitig. Docking UI nur bei Docking-Kontext, Weapon UI nur bei Combat-Kontext, Nav Details nur bei Target/Autopilot.

7. **Debug bleibt erreichbar, aber getrennt.** F2/F3/F7 Developer-Fenster bleiben. Player UI darf nicht direkt von DebugConsole-Actions abhängen.

8. **Testbarer Datenfluss.** Gameplay Components → Snapshot/ViewModel → UI Renderer. Die bestehenden Tests zeigen, dass das bereits begonnen wurde; die neue Player UI sollte diese Trennung ausbauen.

9. **Funktional Sci-Fi, keine Asset-Pack-Abhängigkeit.** Klare Hierarchie, kurze Labels, sinnvolle Warnfarben, wenige Texte während Flight. Stil kann cockpit-/diegetisch wirken, aber muss zuerst spielbar sein.

10. **Controller-/Keyboard-tauglich und lokalisierbar.** Labels sollen als semantische Keys gedacht werden, nicht als harte englische Debugstrings. Keyboard/Controller sollen dieselben Actions anzeigen können.

---

## 3. UI Information Architecture

### 3.1 Flight HUD

**Zweck:** Permanente Moment-to-Moment-Fluginformation: Orientierung, Geschwindigkeit, Schub, Fuel, Control Mode, RCS/SAS, Warnungen und aktive Assist-Systeme.

**Datenquellen aus aktueller Codebase:**

- `PrototypeHudViewModelBuilder` für Speed/Throttle/Fuel/Warnings/Markers.
- `PlayerShipController.FlightControlDiagnostics` für RCS/SAS/Mode/Main/Gimbal/Assist.
- `ShipStats` für Fuel und Throttle/Fuel-Telemetrie.
- `Rigidbody.linearVelocity` für Speed/Prograde/Retrograde.
- `PrototypeMomentumAssist` und `PrototypeWaypointAutopilot` für Assist-Status.

**v0 Umfang:**

- Center reticle/Navball-lite: FWD, PRO, RET, Target marker.
- Bottom/left: Speed, Throttle, Fuel.
- Mode chips: Cruise/Precision/Translation.
- RCS/SAS status chips.
- top warning strip.
- active assist chip: Autopilot/Momentum/Docking.

**Spätere Erweiterungen:**

- echter 3D-/screen-space Navball.
- cockpit-/diegetische Instrumente.
- configurable HUD density.
- orbital/gravity mode, if gameplay exists.

**Nicht anzeigen:**

- raw RCS desired/actual/residual.
- SAS PID / angular error.
- PhysicsCore net force/torque.
- Debug pulse state.

### 3.2 Nav / Autopilot

**Zweck:** Zielauswahl, Zielzustand, Autopilot-Absicht, Distanz/Relativbewegung, ETA/Fuel-Feasibility, Hindernisse und Failures verständlich machen.

**Datenquellen:**

- `PrototypeWaypointAutopilot.CurrentTarget`, `TargetName`, `CurrentState`, `ArrivalPhase`, `NavigationPhase`, `LastMetrics`, `LastFuelEstimate`, `LastTrajectoryPlan`, `BuildNavigationWarningChips()`.
- `PrototypeWaypointManager` / `PrototypeNavigationTarget` für Ziele.
- `PrototypeMinimapOverlay` route/radar data.

**v0 Umfang:**

- selected target name.
- distance, relative speed/closing speed.
- lateral speed nur bei Autopilot/Approach.
- ETA nur wenn sinnvoll/finit.
- human-friendly phase label.
- warning chips.
- route line/radar marker.

**Spätere Erweiterungen:**

- route planner/map.
- multi-leg routes.
- gravity/orbit planner.
- mission waypoint integration.

**Nicht anzeigen:**

- candidate scores.
- raw selectedCandidateReason except in Dev Detail.
- planned force vectors.
- internal segment table im normalen HUD.

### 3.3 Targeting / Combat

**Zweck:** Aktives Ziel, Feuerstatus, AutoFire, Turret/Arc/Range/Cooldown, Target Health und Priorität anzeigen.

**Datenquellen:**

- `PrototypeWeaponComputer.AvailableTargets`, `ActiveTarget`, `PriorityMode`, `AutoFireEnabled`, `TurretStatusLabel`, `LastTurretStatus`.
- `PrototypeTurretWeapon.EvaluateFireStatus` / `LastFireStatus`.
- `PrototypeTurretFireStatus` for block reason, canFire, cooldown, distance.
- `PrototypeWeaponTarget` für Health/Label.
- `ShipStats` for EngagementRange and weapon config.

**v0 Umfang:**

- combat reticle/target bracket.
- active target label + health.
- range + in/out-of-range.
- fire status: Ready, Aligning, Out of Arc, Cooldown, No Muzzle, No Authority.
- AutoFire armed/blocked indicator.
- compact target cycling/selection hint.

**Spätere Erweiterungen:**

- ammo/energy/heat if implemented.
- lead indicator if ballistic lead implemented.
- multi-weapon groups.
- threat/faction markers.

**Nicht anzeigen:**

- hit chance tuning.
- projectile diameter/speed tuning.
- raw yaw/pitch degrees by default.
- recoil impulse vectors.

### 3.4 Docking

**Zweck:** Approach, Alignment, Relative Speed, Capture Eligibility und Docking-Status übersetzen.

**Datenquellen:**

- `DockingPort.TryCalculateRelativeState` → distance, offset, angle error, relative/closing speed.
- `DockingPort.EvaluateEligibility` → canSoftCapture/canHardLock + diagnostic.
- `DockingPort.BuildSoftCaptureRequest` for soft-capture availability.
- `DockingHardLockResult` for placeholder only.

**v0 Umfang:**

- nur anzeigen, wenn Docking-Kontext existiert/gewählt ist.
- distance to port.
- relative speed + closing speed.
- alignment angle.
- lateral offset indicator.
- „Soft Capture bereit“ / „zu schnell“ / „zu schräg“ / „außer Reichweite“.
- Hard Lock nur als „Lock-Kriterien erfüllt“ oder „Prototype placeholder“, solange kein echter Joint implementiert ist.

**Spätere Erweiterungen:**

- dock target selection.
- port-specific approach corridor.
- soft capture integration through controller/RCS path.
- actual joint/connection and station services.

**Nicht anzeigen:**

- `forceWorld`/`torqueLocal`.
- raw diagnostic strings ohne Übersetzung.
- Hard lock als fertige Verbindung, solange nur placeholder.

### 3.5 Ship Status / Damage

**Zweck:** Zustand des modularen Schiffs verständlich machen: Fuel, Main Thruster, RCS, SAS, Weapon, Cargo, Damage, später Power/Heat.

**Datenquellen:**

- `ShipStats`: fuel, mass, thrust, weapon settings.
- `PrototypeModuleDamageState` through generated modules / debug overlay.
- `RcsThrusterController` / `MainThrusterBank` status.
- `PrototypeThermalModule` exists for optional heat/power.
- `PrototypeShipConfig` / built-in variants for loadout data.

**v0 Umfang:**

- fuel bar and low/no fuel warnings.
- RCS/Main/Weapon availability chips.
- simple module damage summary when damage exists: „RCS beschädigt“, „Waffe beschädigt“, „Modul kritisch“.
- optional expanded status panel opened outside intense flight.

**Spätere Erweiterungen:**

- module list/ship schematic.
- heat/power/cargo.
- repair UI.
- builder-integrated module details.

**Nicht anzeigen:**

- raw COM/inertia values.
- raw module mass table in flight HUD.
- thermal debug fields unless player heat gameplay exists.

### 3.6 Builder / Loadout

**Zweck:** Späteres UI für modulare selbstgebaute Schiffe, Part Selection, validity, fuel/engine/RCS/weapon/cargo tradeoffs.

**Datenquellen:**

- `PrototypeShipConfig` and structs for Mass/Fuel/MainThruster/RCS/Gun/Camera.
- `PrototypeShipVariant.BuiltIns()`.
- `PrototypeBootstrap.BuildBuiltInVariant`.
- generated part metadata / module visual factory.

**v0 Umfang:**

- kein echter Builder.
- optional nur „Current Prototype Variant / Loadout Summary“ in dev/player status, wenn nötig.

**Spätere Erweiterungen:**

- part palette.
- ship validation.
- mass/COM/fuel/thrust previews.
- hardpoint/socket visualization.
- save/load blueprints.

**Nicht anzeigen:**

- editor-like generated primitive internals in normal gameplay.

### 3.7 Mission / Rewards

**Zweck:** Mission briefing, objectives, reward/currency, unlocks.

**Datenquellen:**

- aktuell keine belastbaren Gameplay-Systeme im Code für Mission/Rewards.

**v0 Umfang:**

- nicht implementieren.
- nur Platz in UI-Architektur reservieren.

**Spätere Erweiterungen:**

- mission tracker.
- reward screen.
- part unlocks.
- route/objective integration.

**Nicht anzeigen:**

- Fake mission UI ohne System.

### 3.8 Settings / Keybinds

**Zweck:** Controls erklären, Settings/Pause, später Remapping.

**Datenquellen:**

- `PrototypeInputBindingCatalog`.
- `PrototypeKeybindViewModelBuilder`.
- `PrototypeKeybindOverlay`.

**v0 Umfang:**

- player help overlay derived from InputBindingCatalog.
- Debug-only keybinds klar getrennt.
- current mode explanations.

**Spätere Erweiterungen:**

- Action-based input display.
- controller glyphs.
- remapping/settings.
- localization.

**Nicht anzeigen:**

- Debug-only controls in player help unless in Dev Mode.

---

## 4. Moment-to-Moment Flight HUD v0

### 4.1 Layout-Zonen

**Center / Flight Reticle**

- FWD marker / ship-forward reticle.
- PRO/RET velocity marker.
- Target marker if selected.
- Contextual reticle changes for docking/combat.
- No large text blocks inside the center.

**Top center / Alert + Assist Strip**

- Warnings: LOW FUEL, NO RCS, AUTOPILOT ABORTED, NO AUTHORITY, OBSTACLE, DOCKING TOO FAST, OUT OF ARC.
- Active assist: Autopilot, Momentum Assist, Docking Soft Capture, AutoFire.
- Use one primary warning and up to two chips; overflow goes into status panel.

**Bottom center / Flight Status Bar**

- Speed.
- Throttle bar/percent.
- Fuel bar/percent.
- Control mode: Cruise / Precision / Translation.
- RCS / SAS chips.

**Left lower / Ship Systems**

- Fuel.
- Main engine ready/disabled/overheated if available.
- RCS ready/limited/off.
- SAS on/effective/unavailable.
- simple module damage warning.

**Right lower / Context Panel**

- Navigation target by default.
- switches to docking approach when docking target/context active.
- switches to combat target when weapon target selected.
- only one context expanded at a time.

**Top right / Radar-Minimap**

- compact ship-centered radar.
- range rings and essential target/route icons.
- expanded map is not v0.

**Pause / Help Layer**

- keybind overlay from catalog.
- settings/remap deferred.

### 4.2 Pflichtanzeigen

Always-on in flight:

- Speed.
- Fuel current/percent and low/no fuel warning.
- Throttle command or actual throttle; ideally show actual if spool is enabled, command as ghost if needed.
- Control Mode.
- RCS state.
- SAS state.
- Target marker/name if selected.
- Warning strip.

Contextual required:

- Autopilot target/state/distance when engaged or target selected.
- Closing speed / lateral speed during Autopilot final approach or Docking.
- Weapon ready/cooldown/arc/range when combat target selected.
- Docking distance/angle/relative speed when docking target selected.

### 4.3 Optionale Anzeigen

- ETA.
- Stopping distance.
- route line / avoidance route.
- module status list.
- target health.
- weapon priority.
- detailed keybinds.
- detailed nav details outside center HUD.

### 4.4 Warnungen

Recommended player-facing warning mapping:

- `LOW FUEL` → „Treibstoff niedrig“.
- `NO RCS` → „RCS nicht verfügbar“.
- `NO AUTHORITY` → „Keine Steuerautorität“.
- `AUTOPILOT FUEL` / `FuelInsufficient` → „Autopilot: zu wenig Treibstoff“.
- `Aborted` + manual override → „Autopilot abgebrochen: manuelle Eingabe“.
- `LimitedRcsAuthority` → „RCS limitiert“.
- `LimitedHoldAuthority` → „Halten limitiert“.
- `Obstacle` / `Avoidance` → „Hindernis / Ausweichkurs“.
- `OutOfArc` → „Ziel außerhalb Feuerwinkel“.
- `OutOfRange` → „Ziel außer Reichweite“.
- `Cooldown` → „Waffe lädt“.
- `NoMuzzle` → „Waffe: keine Mündung gebunden“; dev-facing warning but player can see as weapon offline.
- Docking diagnostics:
  - `outside-capture-radius` → „Außer Docking-Reichweite“.
  - `angle-too-large` → „Ausrichtung zu schräg“.
  - `relative-velocity-too-high` → „Anflug zu schnell“.
  - `soft-capture-eligible` → „Soft Capture bereit“.
  - `hard-lock-eligible` → „Lock-Kriterien erfüllt“.

### 4.5 Interaktionen

Use current action basis, not direct DebugConsole coupling:

- `G`: Autopilot toggle.
- `Tab` / `B`: next/previous nav target.
- HUD button: Kill Momentum → `PrototypeMomentumAssist.ActivateFromUi()`.
- `Caps Lock`: cycle Cruise/Precision/Translation.
- `T`: SAS.
- `R`: RCS.
- `Space`: fire.
- F1 help; F2/F3/F7 remain dev/prototype layers, not player default.

Controller support should be designed as actions first. Current code has keyboard-centric InputSystem polling; controller mappings should not be claimed as verified until implemented/tested.

### 4.6 Beispielzustände

#### Normaler Cruise

Center: FWD, PRO/RET.  
Bottom: `Cruise`, Speed, Throttle, Fuel.  
System chips: RCS On/Off, SAS On/Off.  
Right context: no target or selected target compact.

No debug vectors, no allocator text.

#### Precision Mode

Mode chip: `Precision`.  
Main/Gimbal chips: disabled/locked.  
RCS/SAS emphasized.  
Hint: „RCS attitude control“.  
If RCS off/missing: top warning „RCS nicht verfügbar“.

#### Translation Mode

Mode chip: `Translation`.  
Axis indicators or small mode hint: forward/back, left/right, up/down.  
Main/Gimbal disabled.  
If SAS auto-stop requests opposing force, show a small „Auto-stop“ or „SAS damping“ chip only if it affects flight; not raw force.

#### Autopilot aktiv

Top strip: `Autopilot: Zum Schub ausrichten / Beschleunigen / Bremsen / Endanflug`.  
Right Nav Panel: Target, Dist, Closing, Lateral, ETA.  
Warnings: Fuel, No Authority, Obstacle, Limited RCS.

Manual override hint only when active: „Manuelle Eingabe bricht ab“.

#### Momentum Assist aktiv

Top strip: `Kill Momentum: Ausrichten / Haupttriebwerk bremst / RCS dämpft`.  
Bottom: speed trend emphasized.  
If no authority/fuel: warning.

#### Low Fuel

Fuel bar enters warning state.  
If autopilot target exists, show `Burn remaining / required` only in Nav details; normal HUD says „Autopilot möglicherweise nicht möglich“.

#### Target selected

Center target marker.  
Right context shows target name, distance, relative speed.  
If target is weapon-capable/combat target, show health and weapon status; if waypoint, show nav fields.

#### Docking approach

Center reticle becomes docking director.  
Show lateral offset cross, angle ring, relative/closing speed, distance.  
Warnings: „zu schnell“, „zu schräg“, „außer Reichweite“.  
Soft Capture Ready only when code says `canSoftCapture`.

#### Combat target

Target bracket / combat reticle.  
Right context: active target, health, range, fire status, cooldown.  
AutoFire indicator: Armed / Blocked by range/arc/cooldown.  
No hit chance/recoil debug values.

---

## 5. Navigation / Autopilot UI

### 5.1 Zielauswahl sichtbar machen

Current code supports selected target and next/previous controls. v0 should show:

- Target marker in HUD.
- Target name.
- Distance.
- Target type icon: waypoint/station/beacon/combat/docking if available.
- selected target on radar/minimap.
- target cycling hint only when no target or keybind overlay active.

Avoid clutter: if no target, show a subtle „Kein Navigationsziel“ only in Nav context, not as a permanent center warning unless Autopilot is requested.

### 5.2 Autopilot-Status menschenfreundlich formulieren

Internal states should be translated:

| Internal | Player Label |
| --- | --- |
| `Idle` | Autopilot aus |
| `TargetSelected` | Ziel gewählt |
| `FuelCheck` | Treibstoff prüfen |
| `AlignForBurn` | Zum Schub ausrichten |
| `Accelerate` | Beschleunigen |
| `ObstacleAvoidance` | Hindernis umgehen |
| `FlipForBrake` | Zum Bremsen drehen |
| `Brake` | Bremsen |
| `FinalApproach` | Endanflug |
| `HoldPosition` | Position halten |
| `Complete` | Angekommen |
| `Aborted` | Abgebrochen |
| `FuelInsufficient` | Zu wenig Treibstoff |
| `Failed` | Autopilot nicht möglich |

Arrival phases:

| Internal | Player Label |
| --- | --- |
| `LongRangeBurn` | Reiseflug-Burn |
| `Brake` | Bremsphase |
| `LateralCorrection` | Seitendrift korrigieren |
| `FinalApproach` | Endanflug |
| `Hold` | Halten |

Navigation phases:

| Internal | Player Label |
| --- | --- |
| `Direct` | Direkter Kurs |
| `AvoidancePlanning` | Ausweichkurs planen |
| `Avoiding` | Ausweichen |
| `ReacquireDirectPath` | Direktkurs wieder aufnehmen |
| `Brake` | Bremsen |
| `FinalApproach` | Endanflug |
| `Hold` | Halten |

### 5.3 Warnungen

Autopilot warnings should be chips, not paragraphs:

- No Target.
- No Authority.
- Fuel Insufficient.
- Obstacle.
- Avoidance.
- Limited RCS.
- Limited Hold.
- Holding.

The code already builds chips with these concepts, so v0 can consume a translated version of `BuildNavigationWarningChips()`.

### 5.4 Wie viel ETA/Distance/Closing/Lateral Speed?

Recommended v0 hierarchy:

- **Always for selected target:** distance.
- **Autopilot active:** distance, ETA, closing speed, phase.
- **Final approach / docking:** lateral speed and relative speed become more important than ETA.
- **Debug details:** stopping distance, planned stopping distance, requested acceleration, requested RCS, candidate scores.

ETA should be hidden or shown as `--` if non-finite or not meaningful. The code computes ETA from positive closing speed; if not closing, UI should say „nicht auf Kurs“ rather than showing infinity.

---

## 6. Combat / Weapon Computer UI

### 6.1 Ableitung aus aktuellem Code

The current combat slice supports:

- Manual Space fire through `GunModule.TryFire()`.
- Turret-compatible fire through `PrototypeTurretWeapon`.
- Weapon Computer target discovery and selection.
- priority modes: ManualOrder, Nearest, HighestHealth, LowestHealth.
- AutoFire toggle.
- Active target transform.
- Target health/fallback labels.
- fire blocking reasons: no muzzle, no authority, out of arc, cooldown, out of range, aligning, safety/missing marker cases.
- projectile/recoil/hit chance settings, but those are tuning/debug except when they produce a gameplay status.

### 6.2 Targeting aussehen

v0 targeting should have:

- target bracket around active combat target.
- range number if active target selected.
- health bar / integrity text.
- weapon readiness indicator.
- reticle color/state for ready/blocked.
- small `AUTO` chip if auto-fire enabled.

If no target is selected:

- show minimal „No target“ in Weapon context.
- manual fire still allowed as boresight if `PrototypeTurretWeapon` reports `boresight`/ready; do not force a target.

### 6.3 Auto-fire / Turret Mode kommunizieren

AutoFire should be communicated as:

- `Auto Fire: Armed` when enabled and target selected.
- `Auto Fire: Waiting - Aligning / Cooldown / Out of Range / Out of Arc` when blocked.
- `Auto Fire: No target` when enabled but no active target.

Turret mode should not show requested/applied yaw/pitch by default. It should show:

- `Ausrichten` if aligning.
- `Im Feuerwinkel` / `Bereit` if can fire.
- `Außerhalb Feuerwinkel`.
- `Außer Reichweite`.
- `Cooldown 0.4s`.
- `Waffe offline` for no muzzle/no authority.

### 6.4 Spielerinfos vs Debuginfos

Player info:

- active target.
- target health/integrity.
- range.
- fire status.
- cooldown.
- auto fire.
- priority mode if target list panel open.

Debug info:

- hit chance value.
- projectile speed/diameter/mass/lifetime/fire rate tuning.
- recoil impulse/position.
- requested/applied yaw/pitch degrees.
- deterministic roll/miss state.
- binder warnings except as high-level weapon offline.

---

## 7. Docking UI

### 7.1 DockingPort-Diagnostik übersetzen

`DockingPort` gives enough for a first docking approach UI, but not enough for a full docking system. It can measure port-relative state and eligibility. UI should translate diagnostics:

| Diagnostic | Player Label |
| --- | --- |
| `outside-capture-radius` | Außer Docking-Reichweite |
| `angle-too-large` | Ausrichtung zu schräg |
| `relative-velocity-too-high` | Anflug zu schnell |
| `soft-capture-disabled` | Soft Capture deaktiviert |
| `soft-capture-eligible` | Soft Capture bereit |
| `outside-hard-lock-radius` | Für Lock zu weit entfernt |
| `hard-lock-angle-too-large` | Für Lock zu schräg |
| `hard-lock-velocity-too-high` | Für Lock zu schnell |
| `hard-lock-eligible` | Lock-Kriterien erfüllt |
| `hard-lock-placeholder` | Prototype: Lock noch nicht final |

### 7.2 Visuelle Hilfen

Docking approach needs a dedicated context overlay:

- Center docking reticle around target port direction.
- lateral offset cross: target port center relative to ship port.
- angle ring or alignment chevrons for port forward alignment.
- relative speed gauge with safe threshold.
- distance ladder: capture radius, hard-lock radius.
- closing speed indicator: positive approach vs drifting away.
- soft capture readiness chip.

### 7.3 Soft capture / hard lock

Soft Capture can be shown only when `canSoftCapture` is true and `BuildSoftCaptureRequest(...).requested` is true. The UI can label it „Soft Capture bereit/aktiv“, but actual activation path still needs integration if not currently wired as player action.

Hard Lock must not be represented as a completed dock until real joint/constraint behavior exists. Current code/test evidence says hard lock is a placeholder and `jointCreated=false`. The safe v0 wording is:

- „Lock-Kriterien erfüllt“.
- „Prototype: Hard Lock noch nicht verbunden“.

No „Docked“ state unless a later system creates and confirms the physical/logic connection.

---

## 8. Ship Status / Damage / Modules

### 8.1 Fuel

Fuel is fully present in `ShipStats` and should be the first-class status element:

- fuel bar current/max.
- low fuel warning threshold.
- no fuel warning.
- optional burn time remaining when Autopilot target exists.

Avoid always showing kg in the center HUD; use percent/bar for moment-to-moment and details in expanded panel.

### 8.2 RCS / Main Thruster / SAS

Use chips:

- Main: Ready / Disabled by Mode / Overheated / No Authority.
- RCS: Ready / Off / Limited / No Authority / No Fuel.
- SAS: On / Off / Ineffective / Hold Attitude / Kill Rotation.

Current code already exposes enough through diagnostics and controller properties. The UI should not display allocator internal status permanently, but it can map severe statuses into warnings.

### 8.3 Weapon

Weapon status in ship panel:

- Weapon ready/offline.
- Active target if selected.
- Cooldown/arc/range.
- AutoFire state.

No ammo because ammo does not exist in code. Do not invent magazine UI.

### 8.4 Cargo

Cargo exists only as module role / future concept, not gameplay loop. v0 should not show cargo inventory. Builder/mission v2 can add it.

### 8.5 Damage

Damage exists through module damage states and affects RCS capability through damaged RCS blocks. Player UI should start simple:

- „Modules damaged“ summary.
- worst module health/integrity if known.
- capability warning: „RCS thrust reduced“ when relevant.
- expanded ship schematic later.

### 8.6 Verbindung zum Ship Builder

The future builder should use the same module categories as status UI:

- Cockpit.
- Hull.
- Fuel Tank.
- Engine/Main Thruster.
- RCS.
- Weapon.
- Cargo/Utility.
- Docking Port.

This keeps flight HUD, damage panel and builder semantically aligned.

---

## 9. Technical UI Architecture Proposal

### 9.1 Empfohlener UI Stack

**v0 recommendation: Hybrid migration.**

- Keep existing IMGUI debug windows untouched for Developer Layer.
- Add/extend snapshot/viewmodel layer first.
- Build a new Player UI renderer separately from Debug Console.
- Use uGUI or UI Toolkit only once data contracts are stable.

**UI Toolkit strengths:** menus, panels, settings, builder, lists, localizable text, CSS-like styling, testable visual hierarchy.

**uGUI strengths:** runtime HUD overlays, reticles, canvas/world-space markers, controller-friendly simple widgets, mature game-HUD workflows.

**Recommended split:**

- Flight HUD / reticles / radar: uGUI or a lightweight runtime canvas first, because markers/reticles and world/screen-space overlays are core.
- Menus, settings, builder, mission/reward, detailed ship status: UI Toolkit.
- Debug IMGUI: remain as Dev Layer until replacement is justified.

This avoids a risky big-bang UI Toolkit rewrite while making player UI independent from debug IMGUI.

### 9.2 Datenfluss

Proposed data path:

```text
Gameplay Components
  PlayerShipController
  ShipStats
  PrototypeWaypointAutopilot
  PrototypeMomentumAssist
  PrototypeWeaponComputer
  DockingPort
  ModuleDamage/Thermal/etc.
        ↓
Snapshot / ViewModel Layer
  PlayerFlightHudSnapshot
  PlayerNavigationSnapshot
  PlayerCombatSnapshot
  PlayerDockingSnapshot
  PlayerShipStatusSnapshot
        ↓
Presenter / Translator
  localization keys
  severity
  priority
  contextual visibility
        ↓
Player UI Renderer
  Flight HUD
  Radar
  Context Panel
  Warning Strip
  Pause/Help
```

### 9.3 Trennung Debug UI vs Player UI

**Developer Layer:**

- `PrototypeDebugOverlay`.
- `PrototypeFlightDebugConsole`.
- debug force vectors.
- test pulses.
- reset/refuel/spawn/damage buttons.
- candidate scores, allocator, wrench, PID, recoil impulse.

**Player Layer:**

- Flight HUD.
- radar/minimap.
- nav/autopilot strip.
- combat target UI.
- docking approach UI.
- ship status.
- help/settings.

The Player UI should never call DebugConsole methods. It should call gameplay actions or controller APIs only.

### 9.4 Teststrategie

Continue the existing pattern:

- Snapshot builders testable without `OnGUI`.
- UI state tests verify visibility/preset does not mutate gameplay values.
- mode-specific input labels tested against InputBindingCatalog.
- warning mapping unit tests for Autopilot/Weapon/Docking diagnostics.
- PlayMode scene smoke test: Bootstrap creates Player UI renderer and binds snapshots.
- screenshot/manual protocol for readability.

Existing tests already prove this is feasible: HUD ViewModel without OnGUI, layout reset, preset non-mutation, HUD marker projection, control mode mapping, docking gating, weapon priority/arc/cooldown.

### 9.5 Migration vom aktuellen PrototypeFlightHud/DebugOverlay

Step-by-step:

1. Freeze existing IMGUI as Dev/Prototype layer.
2. Extract/rename snapshot builders without changing behavior.
3. Add player-facing label translator for control/autopilot/combat/docking diagnostics.
4. Create Player HUD renderer that consumes snapshots.
5. Move only player-safe HUD elements into new renderer.
6. Leave DebugOverlay/Console intact and independently toggleable.
7. After v0 validation, reduce default IMGUI windows in normal play; keep F2/F3/F7.

### 9.6 Risiken

- Too much UI too early: combat, docking, nav, status can overwhelm if all shown simultaneously.
- Unstable names: many classes are `Prototype*`; avoid hard-coding final architecture around prototype names.
- Ambiguous target context: nav target vs weapon target vs docking port target need unified target model later.
- UI stack split can duplicate styling unless a shared design token layer exists.
- Controller input not fully validated; do not design only for mouse windows.
- Localization later becomes harder if debug strings are reused directly.

---

## 10. Proposed Spec Changes / Tasks

These are next Spec proposals, not completed tasks.

### 10.1 `player-facing-flight-hud-v0`

**Ziel:** Build first real player HUD layer from existing flight data, separate from IMGUI debug windows.

**Scope:**

- PlayerFlightHudSnapshot from existing ViewModel/diagnostics.
- compact speed/throttle/fuel/control-mode/RCS/SAS/warnings.
- center marker rendering for FWD/PRO/RET/TGT.
- active assist strip for Autopilot/Momentum.
- no debug console dependency.

**Non-goals:**

- no final art pass.
- no settings/remap.
- no full orbit/docking/combat UI.
- no removal of existing debug UI.

**Betroffene Dateien:**

- `PrototypeUiViewModels.cs` or new `PlayerFlightHudSnapshots.cs`.
- `PrototypeFlightHud.cs` as reference only.
- `PlayerShipController.cs` diagnostics only if missing semantic fields.
- new Player UI renderer scripts/prefab.
- tests under `Assets/Tests/Editor/`.

**Grobe Tasks:**

- define snapshot contract.
- define warning severity/priority.
- implement player HUD renderer.
- bind in `PrototypeBootstrap` without replacing Debug UI.
- update README/docs with Player UI vs Debug UI separation.
- add tests for snapshot values, warning mapping, no direct DebugConsole dependency.

**Verification-Ideen:**

- EditMode tests for snapshot from generated ship.
- test mode chips for Cruise/Precision/Translation.
- test low fuel / no RCS warning mapping.
- PlayMode/bootstrap smoke if Unity MCP available.
- manual screenshot protocol: Cruise, Precision, Translation, Low Fuel.

### 10.2 `player-navigation-autopilot-ui-v0`

**Ziel:** Translate existing Autopilot/Nav Computer data into a player-friendly nav panel/strip and radar route layer.

**Scope:**

- selected target display.
- distance, ETA, closing speed, lateral speed contextually.
- friendly labels for AutopilotState, ArrivalPhase, NavigationPhase.
- warning chips from `BuildNavigationWarningChips`.
- radar route/avoidance compact view.

**Non-goals:**

- no new autopilot physics.
- no orbital planner.
- no mission routing.
- no candidate score UI except dev layer.

**Betroffene Dateien:**

- `PrototypeWaypointAutopilot.cs`.
- `PrototypeFlightHud.cs` reference.
- `PrototypeMinimapOverlay.cs` reference.
- new nav snapshot/translator/player panel.
- tests for label mapping.

**Grobe Tasks:**

- build `PlayerNavigationSnapshot`.
- add internal-to-player label mapping.
- add nav context panel.
- add route overlay from predicted/avoidance data.
- ensure no raw candidate scores in player layer.

**Verification-Ideen:**

- tests for every AutopilotState label.
- tests for no target/fuel/no authority chips.
- synthetic states: direct, obstacle, avoidance, final approach, hold.
- screenshot protocol.

### 10.3 `player-combat-weapon-computer-ui-v0`

**Ziel:** Convert current Weapon Computer panel into a player-facing combat context UI while preserving debug panel.

**Scope:**

- active target, health, range.
- fire status from `PrototypeTurretFireStatus`.
- cooldown/arc/range/alignment labels.
- AutoFire armed/blocked states.
- target list/priority in expanded combat panel.

**Non-goals:**

- no ammo/energy/heat unless implemented.
- no lead indicator beyond current flag.
- no final enemy AI.
- no removal of IMGUI weapon panel.

**Betroffene Dateien:**

- `PrototypeWeaponComputer.cs`.
- `PrototypeWeaponComputerPanel.cs` reference.
- `PrototypeTurretFireStatus.cs`.
- `PrototypeTurretWeapon.cs`.
- new combat snapshot/translator/player UI.
- weapon tests.

**Grobe Tasks:**

- define `PlayerCombatSnapshot`.
- map block reasons to player labels/severity.
- render target bracket/context panel.
- expose AutoFire status.
- keep debug fields in F7/Dev panel only.

**Verification-Ideen:**

- tests: no target, ready, aligning, out of arc, out of range, cooldown, no muzzle.
- tests: priority modes select expected active target.
- screenshot: target selected, autofire blocked, ready to fire.

### 10.4 `player-docking-ui-v0`

**Ziel:** Create a first docking approach UI from `DockingPort` relative state and eligibility without claiming final hard lock.

**Scope:**

- docking target/port context.
- distance, angle, relative/closing speed, lateral offset.
- soft capture readiness.
- hard-lock criteria label as placeholder-safe.
- warning mapping for docking diagnostics.

**Non-goals:**

- no docking physics changes.
- no joint/constraint implementation.
- no station service UI.
- no fake docked state.

**Betroffene Dateien:**

- `DockingPort.cs`.
- new docking snapshot/translator/UI.
- future target selection integration.
- `DockingPortValidationTests.cs` plus UI tests.

**Grobe Tasks:**

- define docking target selection assumption or minimal binding.
- build `PlayerDockingSnapshot`.
- translate eligibility diagnostics.
- render docking director overlay.
- document hard-lock placeholder boundary.

**Verification-Ideen:**

- tests for outside range, angle too large, velocity too high, soft capture ready, hard lock placeholder.
- screenshot protocol for approach states.

### 10.5 Optional: `ui-architecture-toolkit-migration-v0`

**Ziel:** Decide and implement first stable player UI stack boundary while preserving IMGUI Developer Layer.

**Scope:**

- choose Player HUD renderer stack for v0.
- define design tokens: typography, spacing, warning severities, icon semantics.
- common snapshot/presenter pattern.
- separate Debug UI toggles and Player UI toggles.
- set up UI tests/smoke scene.

**Non-goals:**

- no complete UI Toolkit rewrite.
- no final art/assets.
- no menu/settings/builder implementation unless scoped.

**Betroffene Dateien:**

- new UI architecture scripts.
- `PrototypeBootstrap` binding.
- `PrototypeUiViewModels.cs` migration path.
- README/docs.
- tests.

**Grobe Tasks:**

- decide uGUI/UI Toolkit hybrid boundary.
- create snapshot/presenter contracts.
- implement one renderer for Flight HUD.
- keep debug IMGUI untouched.
- verify no direct debug dependencies.

**Verification-Ideen:**

- compile/validate scripts.
- EditMode snapshot/presenter tests.
- Bootstrap smoke test.
- manual screenshot protocol.
- compare Basic/FlightTest Dev presets do not mutate Player UI data.

---

## 11. Open Questions For Benjamin

1. **Visuelle Grundrichtung:** eher clean NASA/industrial, cockpit-instrumental, holographic sci-fi, oder minimal tactical?

2. **HUD-Perspektive:** Soll die finale UI primär external chase-camera HUD bleiben, cockpit/diegetisch werden, oder beide Modi unterstützen?

3. **UI Stack:** Für Flight HUD eher uGUI/Canvas zuerst und UI Toolkit für Menüs/Builder, oder soll früh ein UI Toolkit Runtime-HUD erprobt werden?

4. **Sim-Detailgrad:** Soll das normale HUD eher minimal bleiben oder darf es KSP-/Elite-artig viele Zahlen zeigen?

5. **Zielplattform:** Keyboard/Mouse zuerst, Controller gleichwertig, oder Controller später?

6. **Sprache:** Deutsch zuerst, Englisch zuerst, oder direkt Lokalisierungs-Keys ohne harte Sprache?

7. **Targeting-Modell:** Sollen Navigation Target, Combat Target und Docking Target ein gemeinsames Target-System werden oder bewusst getrennt bleiben?

8. **Docking-Härte:** Soll Docking später real physikalisch/joint-basiert sein, oder eher gameplay-stabil mit sanfter Snap-/State-Machine nach erfüllten Kriterien?

9. **Ship Builder UI-Relevanz:** Soll v1 schon einen Loadout/Builder-Preview bekommen, oder erst Flight/Navigation/Combat stabilisieren?

10. **Debug Layer Policy:** Soll Debug UI im Release-Build komplett ausblendbar/kompilierbar getrennt werden, oder als dev build feature bleiben?

---

## Draft-Ablage / Validierungsstatus

Dieser Draft wurde lokal erstellt und ist dafür gedacht, im Repository unter folgendem Pfad abgelegt zu werden:

```text
.devtoolbox/specs/drafts/player-facing-ui-concept-v0.md
```

In dieser Umgebung waren keine DevToolbox-Workspace-Tools und keine Unity-MCP-Instanz über die verfügbare Toolliste erreichbar. Deshalb wurden weder `specs_validate` noch Unity-Scene-/PlayMode-Inspection ausgeführt. Es wurden keine Implementierungen gestartet, keine bestehenden Debug-Features geändert oder gelöscht und keine Tasks als erledigt markiert.
