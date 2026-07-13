# Weltraum Browser Mainline: Living Master Plan
Stand: 2026-07-13
Letzter Abgleich: `main` @ `051239d9dbb7761c74a52ac8b65743343ec43f18`
Dokumenttyp: laufender Planungsindex, keine Implementierungsspezifikation
Produkt-Mainline: Browser, Three.js und TypeScript
Legacy/Referenz: Unity-Prototyp, historische Specs und Runtime-Evidence

## 1. Zweck

Dieses Dokument ist die gemeinsame, laufend gepflegte Übersicht über bereits umgesetzte Grundlagen, offene Fähigkeiten, Abhängigkeiten und spätere Ausbaustufen. Es ersetzt keine fachliche Spec: Ein Arbeitspaket wird vor Umsetzung in einen eigenen DevToolbox-Change mit Ziel, Nicht-Zielen, Design, Tasks, Acceptance und Evidence überführt.

Die IDs der Arbeitspakete bleiben stabil. Status, Reihenfolge, Beschreibung und Querverweise dürfen sich ändern, wenn neue Evidence, bessere Architekturentscheidungen oder geänderte Produktziele vorliegen.

## 2. Statusmodell

- **`[DONE]`**: Im Browser-Mainline-Code umgesetzt, verifiziert und auf `main` vorhanden.
- **`[FOUNDATION]`**: Ein belastbarer Kern oder Vertrag ist umgesetzt, aber noch kein vollständiger Spieler-Loop.
- **`[OPEN]`**: Fachlich sinnvoll und noch nicht umgesetzt; vor Arbeit ist eine eigene Spec nötig.
- **`[RESEARCH]`**: Erst Prototyp, Messung oder Architekturentscheidung nötig; noch nicht direkt implementieren.
- **`[BLOCKED]`**: Bekannte Abhängigkeit fehlt. Der Blocker steht in der Kurzbeschreibung.
- **`[DEFERRED]`**: Bewusst später, auch wenn das Konzept bereits beschrieben ist.
- **`[LEGACY]`**: Nur Unity-/Prototype-/Evidence-Referenz, nicht Produkt-Mainline.

Statusregeln:

1. `[DONE]` wird nur mit aktueller Code- und Test-Evidence vergeben.
2. Ein vorhandenes Konzept allein ist nicht `[DONE]`.
3. `[FOUNDATION]` darf nicht als vollständiger Gameplay-Loop beworben werden.
4. Ein Paket darf erst umgesetzt werden, wenn seine Blocker entweder erledigt oder ausdrücklich neu bewertet wurden.
5. Veraltete Specs und Screenshots werden nicht als aktuelle Produktwahrheit behandelt.

## 3. Nicht verhandelbare Projektregeln

- Browser/Three.js/TypeScript ist die Produkt-Mainline; Unity bleibt Referenz und Legacy-Evidence.
- Gameplay-Zustand gehört Runtime-/Domain-Ownern. Renderer, CSS, Szene und UI sind Projektionen und keine zweite World Truth.
- Persistente Identitäten sind stabile IDs, nicht Anzeigenamen, Dateinamen oder visuelle Hierarchien.
- Physikalische Quelldaten bleiben real; visuelle Skalierung, Kartenprojektion und lokale Floating Origins verändern keine Autorität.
- Navigation erstellt zuerst einen Plan. Der Executor führt den gelockten Plan aus und replanned nicht still.
- Keine Positions-Snaps, keine versteckten Velocity-Zero-Abkürzungen und keine gefälschte Ankunft.
- Karte, Autopilot, Timewarp und Intercepts müssen langfristig denselben Trajectory Predictor verwenden.
- Ressourcen, Cargo und Inventar verwenden dieselben Resource IDs, Kapazitätsregeln und expliziten Transfers.
- Surface-Gameplay ist kein isoliertes Nebenspiel. Ergebnisse müssen in Schiff, Cargo, Kartenwissen, Missionen, Reputation, Reparatur, Fuel, Upgrades oder neue Routen zurückfließen.
- Player UI zeigt Zustand, Absicht, Risiko und nächste Handlung. Raw Diagnostics bleiben Debug-/Evidence-Layer.
- Concept Art darf Art Direction führen, aber niemals Runtime-Evidence ersetzen.
- Die visuelle Schiffsrichtung bevorzugt funktionale Workships, Utility Craft, Pods, Lander, Drohnen und Rover statt Fighter-/Spaceplane-Defaults.

## 4. Aktuelle Projektwahrheit

### 4.1 Bereits tragfähige Browser-Mainline

- **[DONE] Toolchain und CI**: TypeScript `7.0.2`, Vite, Vitest, Playwright und Browser Mainline CI laufen auf `main`; LFS-relevante Browser-Artefakte werden im CI gezielt validiert.
- **[DONE] Spielbarer lokaler Raumflug**: Flight State V2, Cruise/Precision/Translation, Hauptschub, RCS/SAS, Chase-Kamera, Interpolation, VFX und Demo Scout GLB mit Procedural Fallback sind vorhanden.
- **[DONE] Lokaler Autopilot**: Gelockte Route, stabiler `planHash`, Bang-Bang-Transitprofile, Terminal Brake/Capture/Hold, Fail-Closed Authority/Fuel/Brake Gates und No-Silent-Replan-Evidence sind vorhanden.
- **[DONE] Player-HUD und lokaler Planner**: Flight HUD, Warnungen, Ziel-/Route-/Autopilot-Status, lokales Radar, ein runtime-getriebener lokaler Navigation Planner und evidence-seitig erfasste Route Profiles sind vorhanden.
- **[DONE] Lokale World Presentation Truth**: Schiff, Ziel, Route, Hindernisse und residente World Entities werden aus Runtime-Snapshots projiziert; der Renderer besitzt keine eigene semantische Welt.
- **[FOUNDATION] Real-Scale World Core**: Absolute/local Frames, Floating-Origin-Invarianten, Chunk Registry, Residency, LOD und World-Streaming-Planung sind implementiert; dynamisches Content Streaming und echte Planeten fehlen.
- **[DONE] Resource/Cargo Contract Core**: Resource IDs, Katalog, Stack-Regeln, Container, Kapazitäten, Transfers, Ownership-/Legality-Metadaten und kanonische Serialisierung sind als unabhängiger Browser-Core vorhanden.
- **[DONE] Ship Builder Domain Foundations**: Part-Katalog, Kategorien, Komponenten, Sockets, Blueprints, kanonische Serialisierung, Kompatibilität, Strukturgraph, Dry Mass, COM und Bounds sind implementiert.
- **[FOUNDATION] Ship Builder Stats/Readiness Core**: Loaded Mass, Thrust, RCS, Delta-v, Cargo, Weapons, reservierte Power/Heat-Werte, Handling Diagnostics und statische Readiness-Level sind implementiert. Builder UI, Test-Flight-Nachweis, Runtime Assembly, dynamische Ressourcen sowie vollständige Power-/Heat-Bilanzen fehlen.
- **[FOUNDATION] Persistence/Universe-Time/Event Core**: Ein striktes `SaveGameEnvelopeV1`, stabile Persistence-IDs, 120-Hz-Universe-Time, unabhängige Mission Time, eine generische Migration Registry, persistente Domain Events und Simulation-Mode-Transitions sind implementiert. Browser Storage, Save/Load UI, automatische Zeitfortschreibung, Gameplay-Kopplung, Offline Progression und produktive Save-Migrationen fehlen.
- **[FOUNDATION] Graphics Settings Core**: Versionierte Graphics Preferences, Presets, FOV, FPS-Limit, Render Scale, player-facing Dialog und ein rendererbegrenzter Apply-Adapter sind implementiert. Audio-/Gameplay-Settings, Camera Shake, Autopilot Defaults sowie browserverwaltetes VSync/Fullscreen bleiben offen.
- **[FOUNDATION] Celestial/Gravity Domain Core**: Kanonischer Aurelia-Katalog, analytische Kepler-Ephemeriden, explizite Reference Frames und reine Gravity Queries sind implementiert. Ein reiner Universe-Time-Vertrag existiert separat; automatische Zeitfortschreibung, aktive Flight-/Navigation-Integration, SOI und System Map fehlen.
- **[FOUNDATION] Combat Weapon/Damage Domain Core**: Fire Permission, Projectile-/Beam-Delivery, Hit Resolution, Damage und kanonische Combat Events sind implementiert. Spielbare Combat Runtime, Gegner, Flight-Folgen, Loot, Repair und echte Weapon UI fehlen.

### 4.2 Größte offene Produktlücken

- Der Celestial/Gravity Domain Core existiert. Ein reiner Universe-Time-Vertrag ist vorhanden; es fehlen noch seine aktive Runtime-/Flight-/Navigation-Kopplung, SOI, Patched Conics, System-Map-Truth sowie planetare Darstellung und Übergänge.
- Kein objektgebundener Timewarp, keine Intercept-/Encounter-Simulation und keine persistente Langstreckenreise.
- Kein Runtime-Cargo im aktiven Schiff und keine Cargo-Mass-Integration in Flight/Autopilot.
- Kein spielbarer Ship Builder mit Placement, Save Variant, Test Flight und Active-Ship-Handoff.
- Kein implementierter SurfaceLocalFrame-Übergang, keine planetare Lauf-/Scanner-/Mining-Schicht und kein Schiff-zu-Surface-State-Handoff.
- Kein player-facing Save/Load mit Browser Storage, Slots oder Autosave, keine Offline Progression und keine Gameplay-Produzenten/-Konsumenten für persistente Domain Events. Die vorhandenen Save-, Time-, Event- und Simulation-Mode-Verträge sind noch nicht mit einer spielbaren Runtime verbunden.
- Keine vollständige Economy, Missions-, Faction-, Reputation-, Legality- oder Outpost-Runtime.
- Der Combat Weapon/Damage Domain Core existiert. Es fehlen noch eine spielbare Space-/Surface-Combat-Runtime, Gegner und Encounters, Flight-/Navigation-Folgen, Ammo-/Resource-Integration, Loot, Repair und player-facing Combat Controls.

## 5. Empfohlene Umsetzungswellen

Die Wellen sind Abhängigkeitsgruppen, keine starren Releases. Pakete innerhalb einer Welle können parallel laufen, wenn ihre Dateipfade und Verträge getrennt sind.

### Welle 0: Projektwahrheit und Planbarkeit

Living Plan einchecken, alte aktive Specs gegen `main` reconciliieren, Evidence indexieren und stabile Begriffe/IDs festhalten. Diese Welle verhindert, dass neue Features auf widersprüchlichen Legacy-Annahmen aufbauen.

### Welle 1: Gemeinsame Runtime-Verträge

Runtime-Cargo plus Loaded-Mass-Authority, Surface Target/Local Frame und verbleibende Builder Gameplay Metadata spezifizieren. Die vorhandenen Save-/Time-/Event-Verträge werden um Browser Storage, Runtime-Kopplung und domänenübergreifende Migrationsregeln ergänzt; diese Integrationen sind die Brücke zwischen den bereits vorhandenen Cores und echten Gameplay-Loops.

### Welle 2: Zwei produktnahe Vertical Slices

Ship Builder MVP mit Test Flight sowie eine kleine Surface Expedition mit Scanner, einem Resource Node und Cargo-Rücktransfer implementieren. Beide Slices müssen dieselben Ship-, Resource-, Target- und Persistence-Verträge nutzen.

### Welle 3: Outpost, Mission und autonome Logistik

Ein V0-Outpost mit Storage/Market/Refuel, ein Mission-Contract-Framework und eine einfache Mining-/Hauler-Drohnenmission ergänzen. Background Simulation und Event Queue werden damit erstmals spielerisch genutzt.

### Welle 4: Combat, Damage und Economy

Space-/Surface-Combat-Grundlagen, Damage/Repair, Ammo/Fuel als Ressourcen, Loot/Salvage, Reputation und Legalität verbinden. Economy bleibt klein und lesbar, bevor dynamische Produktionsketten entstehen.

### Welle 5: Aurelia-System und Langstreckennavigation

Celestial Runtime Data, analytische Orbits, gemeinsame Trajectory Prediction, lokale Gravitation, SOI, Patched Conics und objektgebundenen Timewarp schrittweise einführen. Intercepts und Encounters folgen erst auf derselben Vorhersagebasis.

### Welle 6: Skalierung und Content-Ausbau

Planeten-/Terrain-Streaming, mehrere Biome und Sites, Multi-Drone-Operationen, Faction-Netze, Produktionsketten, größere Stations-/Outpost-Systeme und seltene Langzeitinhalte ausbauen.

## 6. Arbeitspaket-Katalog

## P00. Planung, Governance und Evidence

### P00.01 Produktwahrheit

- **[DONE] P00.01.01 Browser-Mainline-Entscheidung**
  Browser/Three.js ist die Produkt-Mainline; Unity bleibt Legacy-, Vergleichs- und Evidence-Quelle.

- **[DONE] P00.01.02 TypeScript-7- und CI-Baseline**
  TypeScript 7.0.2 sowie die vollständige Unit-/Build-/Playwright-Gate-Fläche sind auf `main` verifiziert.

- **[FOUNDATION] P00.01.03 Living Master Plan Governance**
  Dieses Dokument als kanonischen Planungsindex etablieren und bei jedem größeren Merge Status, Abhängigkeiten und nächste Wellen aktualisieren.

- **[OPEN] P00.01.04 Begriffsglossar und Naming Authority**
  Resource/Cargo/Inventory, Part/Module/Socket, Waypoint/Target/LandingZone/Site sowie Ownership/Legality/Reputation eindeutig definieren.

### P00.02 Specs und Backlog

- **[FOUNDATION] P00.02.01 Feature-Intent-Index**
  Browser-Feature-Intent ist dokumentiert; neue Slices müssen Intent, Source Paths, Nicht-Ziele und Evidence-Gates ergänzen.

- **[OPEN] P00.02.02 Aktive-Change-Reconciliation**
  Alle `.devtoolbox/specs/changes` gegen aktuellen Browser-Code, Tasks und Evidence als Active, Reconcile, Archive Candidate, Superseded oder Split klassifizieren.

- **[OPEN] P00.02.03 Superseded- und Legacy-Index**
  Alte Unity-/Prototype-Changes sichtbar als Referenz markieren, ohne sie als offene Browser-Produktarbeit mitzuzählen.

- **[OPEN] P00.02.04 Spec-Erzeugung aus Arbeitspaketen**
  Für ein ausgewähltes `Pxx.yy.zz` einen kleinen, isolierten DevToolbox-Change erzeugen; keine Mega-Specs aus ganzen Pillars erstellen.

### P00.03 Evidence und Qualitätssignale

- **[FOUNDATION] P00.03.01 Browser Evidence Matrix**
  Unit-, Playwright-, JSON-, Markdown- und Screenshot-Evidence existiert; ihre fachliche Abdeckung soll in einem zentralen Evidence Index auffindbar werden.

- **[OPEN] P00.03.02 Evidence-Provenance-Index**
  Dokumentieren, welches Artefakt welche Spielerregel beweist und ob es Runtime-, synthetische, Concept- oder Legacy-Evidence ist.

- **[OPEN] P00.03.03 Screenshot- und LFS-Lifecycle**
  Materialisierung, CI-Validierung, Regeneration, Retention und Pointer-/Binary-Prüfung für alle relevanten Bildgruppen standardisieren.

- **[OPEN] P00.03.04 Architektur-Entscheidungslog**
  Neue irreversible Entscheidungen als kleine ADRs festhalten, besonders für Persistence, Orbitmodell, Surface-Übergang, Builder-Runtime und Multiplayer-Authority.

### P00.04 External Reference Governance

- **[OPEN] P00.04.01 External Reference Governance**
  Externe Referenzen über eine versionierte Adoption-Matrix mit Entscheidung, Pin, Lizenz und Provenance führen; README-Aussagen und Code-Evidence bleiben getrennt. Es besitzt keine harte Vorbedingung, schließt aber an P00.03.02/P00.03.04 an; Acceptance sind vollständige Referenzeinträge ohne fremde Sourcefragmente oder unbelegte Adoptionsentscheidung.

## P01. Core Runtime, Determinismus und Datenautorität

### P01.01 Deterministischer Kern

- **[DONE] P01.01.01 Core IDs, Result Types und Hashing**
  Deterministische Utilities und Signaturen sind vorhanden; neue Domain-Cores sollen dieselben Prinzipien statt eigener Hash-/Fehlerlogik verwenden.

- **[FOUNDATION] P01.01.02 Immutable Snapshot Contracts**
  Flight, Navigation, World, Resource und Builder verwenden Snapshot-/Readonly-Muster; ein gemeinsamer Stil für Versionierung und Provenance bleibt offen.

- **[FOUNDATION] P01.01.03 Globale Schema- und Migrationskonvention**
  Strikte Schema-Versionierung, Stable Persistence IDs, Future-Version-Rejection und eine generische, lückenlose Migration Registry sind im Persistence Core implementiert. Domänenübergreifende Konventionen, produktive Save-Migrationen sowie Missing-/Renamed-Definition-Policies fehlen.

- **[OPEN] P01.01.04 Deterministische Seeds und Content IDs**
  Seed-basierte Weltinhalte und rekonstruierbare Deko von persistenten, semantischen Objekten klar trennen.

### P01.02 Zeit, Ticks und Ereignisse

- **[FOUNDATION] P01.02.01 Universe Time Contract**
  Ein speicherbarer Universe-Time-Vertrag mit 120 Ticks pro Game-Epoch-Sekunde und unabhängiger Mission Time ist implementiert. Realtime-/Runtime-Kopplung, automatische Progression, Warp-/Offline-Zeit und gemeinsame Flight-/Navigation-Nutzung fehlen.

- **[OPEN] P01.02.02 Simulation Scheduler**
  Active Scene, Background und Dormant Jobs deterministisch takten, ohne dass geladene Renderobjekte Autorität übernehmen.

- **[FOUNDATION] P01.02.03 Domain Event Queue**
  Persistente, zeitgestempelte Domain Events mit stabiler ID, deterministischer Queue-Reihenfolge und Acknowledgement sind implementiert. Konkrete Mission-, Flight-, Economy- und Encounter-Produzenten/-Konsumenten sowie player-facing Folgen fehlen.

- **[OPEN] P01.02.04 Command/Result Audit Trail**
  Spieler- und Agentenaktionen mit Actor, Source, Result, Reject Reason und State Delta speicherbar und testbar machen.

### P01.03 Autoritätsgrenzen

- **[DONE] P01.03.01 Runtime-owned World Presentation**
  NavigationMap-/WorldPresentation-Snapshots sind semantische Quelle; Three.js projiziert und dekoriert nur.

- **[OPEN] P01.03.02 Runtime Service Composition**
  Eigentümer von Ship, World, Navigation, Cargo, Missions und Persistence explizit verdrahten, ohne globalen God-Runtime-Container.

- **[DEFERRED] P01.03.03 Multiplayer Authority Interfaces**
  Lokale Singleplayer-Owner so kapseln, dass später Host/Server dieselben Contracts autoritativ ausführen kann.

## P02. Schiff, Flight und physische Systeme

### P02.01 Aktueller Flight Core

- **[DONE] P02.01.01 Flight State V2 und manuelle Steuerung**
  Pitch/Yaw/Roll, Throttle, Translation, RCS/SAS und Controller Modes laufen über einen gemeinsamen FlightController-/Actuator-Pfad.

- **[DONE] P02.01.02 Cruise, Precision und Translation**
  Die drei Modi besitzen explizite Authority- und HUD-Effekte statt nur kosmetischer Labels.

- **[DONE] P02.01.03 Demo Scout Visual Adapter**
  GLB-Loading, Marker-Bindings, Kameraanker und Procedural Fallback sind vorhanden; Renderkorrekturen verändern keine Ship Truth.

- **[DONE] P02.01.04 Kamera und Presentation Smoothing**
  ChaseLocked, Inspection-Modes und interpolierte Render-Pose sind von owner-seitiger Telemetry getrennt.

### P02.02 Propulsion und Handling

- **[DONE] P02.02.01 Mass/Fuel/Authority/Braking v1**
  Erste explizite Contracts versorgen Flight, Autopilot, HUD und Evidence; Cargo-Masse ist noch nicht verbunden.

- **[DONE] P02.02.02 Bang-Bang Transit Policies**
  Lokale Beschleunigungs-, Flip-, Brems- und Handoff-Regeln inklusive Crew-/Drone-Policies sind getestet.

- **[OPEN] P02.02.03 Main-Thruster-Kurven und Gimbal**
  Schubkurven, Gimbal-Grenzen, Rampen, Ausfälle und physische Einzeltriebwerk-Autorität statt vereinfachter Aggregate modellieren.

- **[OPEN] P02.02.04 Per-Nozzle RCS Allocation**
  Translation und Torque aus realen Nozzle-Positionen/-Richtungen berechnen und Fehlachsen, Schäden sowie asymmetrische Layouts berücksichtigen.

- **[OPEN] P02.02.05 SAS/Attitude Controller v2**
  Stabilisierung, Zielausrichtung, Prograde/Retrograde und kontrollierte Manual Overrides auf derselben physischen Authority aufbauen.

- **[OPEN] P02.02.06 Loaded-Mass Flight Integration**
  Dry Mass, Fuel, Cargo, Ammo, Crew und später Damage-/External-Load-Masse in Acceleration, RCS, Braking und Autopilot-Schätzungen übernehmen.

### P02.03 Ship Systems

- **[OPEN] P02.03.01 Fuel als Resource-backed State**
  Flight-Fuel mit gemeinsamen Resource IDs, Tanks, Transfer, Verbrauch und Reserve verbinden.

- **[OPEN] P02.03.02 Power und Heat Core**
  Erzeugung, Verbraucher, Batterien, Kühlung und thermische Limits zunächst als deterministischen Domain-Core aufbauen.

- **[OPEN] P02.03.03 Damage und Repair State**
  Hull-/Module-Schaden, Funktionsverlust, Reparaturkosten und sichere Failure States unabhängig vom Renderer modellieren.

- **[OPEN] P02.03.04 Docking- und Connector-Runtime**
  Docking Ports, Approach Axis, Safety Zone, Capture/Hold und Cargo-/Service-Verbindung als gemeinsames Ziel- und Ship-System umsetzen.

- **[OPEN] P02.03.05 Landing Gear und Surface Readiness**
  Lander-/Surface-rated Capability, sichere Bodenauflage, Ausstiegszone und Engine-Plume-Risiken datengetrieben prüfen.

- **[DEFERRED] P02.03.06 Ship Interiors und Crew Simulation**
  Innenräume, Crewrollen und detaillierte Life-Support-Simulation erst nach stabilen Ship-, Persistence- und Surface-Verträgen.

## P03. Navigation, Autopilot, Timewarp und Encounters

### P03.01 Lokale Navigation

- **[DONE] P03.01.01 TargetDescriptor und ArrivalEnvelope v1**
  Lokale Waypoints/Points besitzen exakte Ziel- und Ankunftsverträge mit Fail-Closed Validation.

- **[DONE] P03.01.02 Immutable RoutePlan und Preview Lock**
  Preview, Engage und Executor verwenden dieselbe kanonische Route und denselben stabilen `planHash`.

- **[DONE] P03.01.03 Terminal Brake, Capture und Hold**
  Ankunft läuft physisch über den FlightController und räumt die aktive Route nach erfolgreichem Hold korrekt frei.

- **[FOUNDATION] P03.01.04 Lokale Candidate Scoring/Validation**
  Deterministische Candidate-/Score-Metadaten existieren; mehrere fachlich unterschiedliche echte Routenalternativen fehlen noch.

- **[FOUNDATION] P03.01.05 Single-Obstacle Avoidance**
  Lokale Umfahrung und Reacquire sind nachgewiesen; komplexe Corridor-/Multi-Obstacle-Fälle bleiben Known Stress.

- **[OPEN] P03.01.06 Globaler Multi-Obstacle Route Solver**
  Mehrere Hindernisse, Korridore und Long-Range-Alternativen als globale, deterministische Planungsaufgabe lösen.

- **[FOUNDATION] P03.01.07 Player Route Profiles**
  Safe/Balanced/Fast sind für lokale Transitprofile in Runtime/Evidence vorhanden; ein player-facing Selector, Fuel Saver, echte Candidate-Auswahl und vollständige Spielererklärung fehlen.

- **[OPEN] P03.01.08 Manual Override und Plan-Stale Contract**
  Kleine Inputs, Pause/Resume, starke Abweichung, Replan Required und Abort als explizite Player-/Runtime-Zustände vereinheitlichen.

- **[OPEN] P03.01.09 Emergency Return und Safe Abort Routes**
  Rückkehr, Hold, Safe Point und minimale Restautorität als eigene Planmodi statt ad-hoc Cancel-Verhalten definieren.

### P03.02 Ziel- und Approach-Taxonomie

- **[OPEN] P03.02.01 Frame-aware TargetDescriptor v2**
  Himmelskörper, Orbit, Station, Schiff, Drohne, Landing Zone, Surface Target, Docking Port und Mission Target sauber unterscheiden.

- **[OPEN] P03.02.02 Moving Rendezvous Targets**
  Bewegte Schiffe/Drohnen mit Desired Velocity, Intercept Time, Relative State und neu validierbaren Arrival Envelopes unterstützen.

- **[OPEN] P03.02.03 Docking Approach Planner**
  Staged Gates, Approach Axis, Relative Velocity, Safety Bubble und finalen Docking-Capture-Übergang planen.

- **[BLOCKED] P03.02.04 Surface Approach Planner**
  Benötigt SurfaceLocalFrame, Landing-Zone- und Surface-Target-Handoff aus P04/P08.

### P03.03 Orbital Navigation

- **[OPEN] P03.03.01 Gemeinsamer Trajectory Predictor**
  Map, Planner, Executor, Timewarp und Intercept Solver müssen dieselbe Vorhersage für Position, Velocity, Burns und Gefahren nutzen.

- **[FOUNDATION] P03.03.02 Lokale Gravitation und dominante Source**
  Pure inverse-square Gravity Queries und deterministische dominante Source-Auswahl sind implementiert. Aktive Schiffskraft, lokale Integrationsschritte und Frame-Handoffs fehlen.

- **[FOUNDATION] P03.03.03 Analytische Kepler-Ephemeriden**
  Katalogkörper können aus expliziter Epoch und Requested Time analytisch fortgeschrieben werden. Ein gemeinsamer, aktiv fortgeschriebener Universe-Time-Service und die Runtime-/Map-Kopplung fehlen.

- **[OPEN] P03.03.04 Sphere-of-Influence Transitions**
  Frame-Wechsel als explizite, validierte Plansegmente mit plausibler Energie-/Velocity-Erhaltung umsetzen.

- **[OPEN] P03.03.05 Patched-Conics Route Planning**
  Burn, Coast, SOI Entry, Correction und Brake für planetare Transfers auf dem gemeinsamen Predictor aufbauen.

- **[RESEARCH] P03.03.06 Integrator- und Toleranz-Benchmark**
  Semi-implicit Euler, Verlet, Runge-Kutta und analytische Coast-Segmente gegen Genauigkeit, Determinismus und Performance vergleichen.

- **[DEFERRED] P03.03.07 Gravity Assist Candidates**
  Slingshots erst nach stabilen Patched Conics als optionalen Candidate mit klarer Zeit-/Fuel-/Risk-Verbesserung aufnehmen.

### P03.04 Objektgebundener Timewarp

- **[BLOCKED] P03.04.01 Warp Authority und State Machine**
  Der reine Universe-Time- und ein generischer persistenter Mobile-State-Vertrag existieren; es fehlen aktive Zeitautorität, vollständige warp-fähige Domainzustände, Runtime-Materialisierung und -Roundtrips, Predictor-Kopplung sowie Warp-spezifische Runtime-Regeln.

- **[BLOCKED] P03.04.02 Warp-eligible Plan Segments**
  Coast-/Correction-Segmente, Abbruchpunkte, Safety Checks und Exit-Zustände auf dem gemeinsamen Predictor markieren.

- **[BLOCKED] P03.04.03 Warp Safety Bubbles**
  Planeten, Stationen, Spieler, aktive Zonen, Asteroidenfelder und Intercepts in echten Metern prüfen.

- **[BLOCKED] P03.04.04 Warp Presentation und Player Controls**
  Faktor, Objekt, Segment, Exit-Grund, nächste Validierung und Manual Abort in HUD/Map darstellen.

### P03.05 Encounters und Interception

- **[BLOCKED] P03.05.01 EncounterCandidate Core**
  Benötigt Predictor, Sensorwissen, AbsoluteState und Event Queue; Kandidaten dürfen noch keine aktiven Encounters sein.

- **[BLOCKED] P03.05.02 Intercept Solver**
  Zeit, Position, Delta-v, Fuel, Sensor Confidence und Safety für plausible Abfangpunkte berechnen.

- **[BLOCKED] P03.05.03 Warp Exit und Real-Time Encounter Handoff**
  Beide Objekte rechtzeitig in normale Simulation überführen, ohne Teleport, Ramming oder unsichtbaren Schaden.

- **[OPEN] P03.05.04 Encounter Actions und Resolution**
  Track, Scan, Hail, Dock, Escort, Evade, Attack, Retreat und Lost Contact als datengetriebene Ergebnisse definieren.

## P04. Celestial World, Real Scale und Streaming

### P04.01 Celestial Data

- **[FOUNDATION] P04.01.01 Canonical Celestial Catalog**
  Aurelia, sieben Planeten, vier benannte Hestia-Monde und drei spezifizierte Asteroiden besitzen einen kanonischen Katalog. Stationen und weitere unvollständig dokumentierte Körper bleiben offen.

- **[DONE] P04.01.02 Celestial Schema Validation**
  Schema-Version, IDs, Zahlen, Masse/`mu`, Parent-Graph, Orbits, Rotation, Atmosphäre, Visual Scale und Access Profiles werden fail-closed validiert.

- **[FOUNDATION] P04.01.03 Definition/Runtime/Visual Separation**
  Celestial Definitions, zeitabhängige Runtime States und render-only Visual Profiles sind getrennt. Die echte Renderer-/Map-Projektion fehlt.

- **[OPEN] P04.01.04 Discovery und Knowledge State**
  Bekannte, vermutete, gescannte und freigeschaltete Himmelskörper-/Site-Daten getrennt von den kanonischen Definitionen speichern.

### P04.02 Frames und Floating Origin

- **[FOUNDATION] P04.02.01 Absolute/Local Frame Contracts**
  WorldCoordinate, LocalCoordinate, FramedVelocity und Floating-Origin-Projektion sind vorhanden; Rotation und nicht-identische Frame-Transformationen fehlen.

- **[OPEN] P04.02.02 Planet-/Moon-/Asteroid-Centered Frames**
  Hierarchische Frame-Transformationen mit Position, Velocity, Epoch und Rotation implementieren.

- **[OPEN] P04.02.03 SurfaceLocalFrame**
  Geodätische/planetenzentrierte Positionen in eine stabile lokale Surface-Szene mit Origin, Up, North und Body Rotation projizieren.

- **[OPEN] P04.02.04 Frame Transition Events**
  System, SOI, Local Space, High Orbit, Low Orbit, Surface und Interior als explizite Übergänge mit Revalidation behandeln.

### P04.03 World Streaming

- **[DONE] P04.03.01 Chunk Registry und Residency Core**
  Deterministische Chunk IDs, Full/Snapshot/Dormant und unabhängige Render-LOD-/Budget-Regeln sind vorhanden.

- **[DONE] P04.03.02 Runtime Navigation Map Adapter**
  Residente World Entities werden mit stabilen IDs und absoluten Positionen in die lokale Map projiziert.

- **[OPEN] P04.03.03 Dynamic Chunk Source Discovery**
  Chunks aus Content-Katalogen und Seeds laden statt aus einer fest verdrahteten Proving-Ground-Liste.

- **[OPEN] P04.03.04 Async Content Loader und Cache**
  Daten, GLBs, Texturen, Collision Proxies und Simulation Snapshots budgetiert laden, freigeben und wiederherstellen.

- **[OPEN] P04.03.05 Persistent World Entity Registry**
  Bedeutende Entities, Besitzer, Discovery, Damage und Depletion unabhängig von geladenen Chunks verwalten.

### P04.04 Planeten- und Surface-Darstellung

- **[OPEN] P04.04.01 Planet Impostor und Orbit LOD**
  System Map, Far Approach, High Orbit und Low Orbit mit getrennten visuellen Maßstäben und echter Datenanzeige unterstützen.

- **[OPEN] P04.04.02 Atmosphere/Cloud/Lighting Foundation**
  Atmosphären-Shell, Tagesseite, Wolken und Sternlicht zunächst datengetrieben, ohne vollständige Wetter-/Aero-Simulation.

- **[OPEN] P04.04.03 Surface Chunk Terrain v0**
  Eine kleine lokale, streambare Surface-Testregion mit Höhen-/Material-/Hazard-Daten erzeugen.

- **[DEFERRED] P04.04.04 Planetweite Terrain- und Biome-Generierung**
  Globale LOD, Millionen Sites, Klima-/Geologie- und Biome-Verteilung erst nach einem bewiesenen Surface Vertical Slice.

### P04.05 Prozedurale Voxel-Planet-Runtime

- **[RESEARCH] P04.05.01 Voxel Runtime Architecture Benchmark**
  P00.04.01 und P14.02.01 liefern Governance und Messbasis; astronomische Makrodaten verwenden hierarchische Double-Precision-Frames, die globale Planetenrepräsentation bleibt nicht vollständig volumetrisch und nur das Near Field darf echte Microvoxels bei 0,25 m Qualitätsziel sowie 0,50 m Fallback verwenden. Acceptance sind reproduzierbare CPU-, GPU-, Memory- und Worker-Budgets für Macro Planet Data, Surface Tiles und lokale Bricks; World State und Voxel State bleiben Three.js-unabhängig, Three.js ist ausschließlich Renderer-Adapter und keine Research-Bibliothek gilt ohne weitere Evidence als beschlossen.

- **[BLOCKED] P04.05.02 Planet Tile Scheduler**
  Benötigt P04.02.02/P04.02.03, P04.03.04 und P04.05.01; Tile-Prioritäten berücksichtigen Geschwindigkeit, Route und Deadline. Deterministische Scheduler-Traces müssen Budgets, Cancellation und den aktiven Parent-Fallback bis zur Bereitschaft feinerer Repräsentationen belegen.

- **[BLOCKED] P04.05.03 Representation Handoff**
  Benötigt P04.05.02, P04.02.03 und P04.03.04; globale Shell, Surface Tile und editierbarer Voxel-Brick behalten stabile IDs und Revisionen. Acceptance sind lückenfreie Handoff-Tests, bei denen grobe Repräsentationen bis zur vollständigen Bereitschaft der feineren aktiv bleiben.

- **[RESEARCH] P04.05.04 Takram Atmosphere Adapter Spike**
  Benötigt P00.04.01 und den Vertrag aus P04.04.02; Takram three-geospatial wird ausschließlich hinter einem Atmosphere-/Render-Adapter auf Koordinatenfit, API, Lizenz und Performance geprüft. Erst gemessene Evidence darf eine spätere Adoption begründen.

- **[RESEARCH] P04.05.05 Microvoxel Mesher Benchmark**
  Benötigt P04.05.01 und den Golden Corpus aus P13.05.02; Terrain und Gebäude dürfen getrennte Mesher verwenden. Acceptance vergleicht 0,25 m und 0,50 m für Topologie, Seams, Durchsatz, Speicher und Edit-Latenz, ohne WASM vor einem Benchmark festzuschreiben.

### P04.06 Galaxie, Sektoren und Birth Clusters

- **[RESEARCH] P04.06.01 Birth Cluster Allocation**
  Benötigt P01.01.04, P04.01.01 und P12.01.02; uncommitted oder unobserved bezeichnen zunächst getrennte Kandidatenklassifikationen für die spätere Platzierung eines privaten Hestia-Heimatsystems, während das formale AND/OR-Eignungsprädikat im Birth-Cluster-Allocation-Paket durch eine fail-closed Authority-Entscheidung festzulegen bleibt. Property Tests müssen deterministische Allokation, eine temporäre Pufferzone aus unentdeckten Nachbarsystemen und spätere normale Entdeckung durch andere Spieler belegen.

- **[OPEN] P04.06.02 Story Normalization**
  Baut auf der Allocation-Policy aus P04.06.01 und der Hestia-Richtung aus P13.03.02 auf; der Spieler beginnt auf Hestia ohne eigenes Schiff, authored Städte und Story-Hotspots überlagern die prozedurale Basis und referenzieren stabile Template-/Semantic-IDs statt absoluter Galaxiekoordinaten. Acceptance ist eine Normalisierungsmatrix, in der Ground-Origin, Progression und spätere Cluster-Überführung keine kanonische Storywahrheit verändern.

- **[DEFERRED] P04.06.03 Hidden Sector Interest Management**
  Benötigt P04.06.01 und P12.04.03; temporär gepufferte Sektoren dürfen vor Freigabe weder beobachtet noch durch fremde Simulation committed werden. Eine spätere Mehrclient-Evidence muss Geheimhaltung, Pufferabbau und anschließende normale Discovery belegen; ein vollständig bidirektionaler Offline-/Online-Merge bleibt eigenständige Research-Arbeit.

### P04.07 Destructible Bodies, Mass and Dynamics

- **[RESEARCH] P04.07.01 Destructible Asteroid Research**
  Benötigt P04.05.05 und P12.03.05; lokale Voxelzerstörung, Persistenz und Runtime-Budgets werden zunächst an Asteroiden untersucht. Acceptance trennt sichtbare lokale Destruktion ausdrücklich von automatischen Änderungen eines Körperorbits.

- **[RESEARCH] P04.07.02 Body Mass Properties**
  Benötigt P04.07.01 und P03.03.02; Masse, Schwerpunkt und Trägheit werden revisionsfähig aus tatsächlich bilanzierten Material- und Massentransfers abgeleitet. Deterministische Delta-Evidence muss lokale Geometrieänderung und echte Masseneigenschaftsänderung unterscheiden.

- **[DEFERRED] P04.07.03 Rotation/Orbit Coupling**
  Benötigt P04.07.02, P03.03.01 bis P03.03.04 und P12.01.03; nur separat bilanzierte Massentransfers und Impulsübertragung dürfen Rotation oder Orbit beeinflussen. Langfristige Conservation- und Schwellwerttests bleiben Voraussetzung für jede Kopplung.

## P05. Player UI, Input, Maps und Accessibility

### P05.01 Visuelle Sprache und UI Authority

- **[DONE] P05.01.01 Flight-HUD Visual Foundation**
  Dark-Navy/Cyan-Chrome, grüne Ready-Zustände, amber/rote Warnungen, Edge Panels und freie zentrale Sicht sind in der Browser-HUD-Fläche umgesetzt.

- **[DONE] P05.01.02 Player-/Debug-Layer-Trennung**
  Normale UI bleibt frei von Raw TestBridge-/Physics-Diagnostics; TestBridge ist query-gated.

- **[OPEN] P05.01.03 Semantische UI Tokens**
  Spacing, Typography, Severity, Focus, Disabled, Ownership und Risk als wiederverwendbare Tokens statt screen-spezifischer CSS-Sonderfälle definieren.

- **[OPEN] P05.01.04 Localization-ready Labels**
  Player-Texte, Failure Reasons und Units von internen Codes trennen und lokalisierbare Message IDs einführen.

### P05.02 Flight und Navigation UI

- **[DONE] P05.02.01 Basic Flight HUD**
  Mode, Speed, Throttle, Fuel, RCS/SAS, Target, Route, Autopilot und Warnungen sind player-facing vorhanden.

- **[FOUNDATION] P05.02.02 Lokales Radar/Minimap**
  Schiff, Kontakte, Ziele und lokale Route sind sichtbar; Filter, Layer, Discovery und reale Sensorregeln fehlen.

- **[FOUNDATION] P05.02.03 Local Navigation Planner**
  Runtime-Map, Route Preview, Profile, Timeline, Fuel/Brake/Status und Engage existieren für lokale Ziele.

- **[OPEN] P05.02.04 Full System Map**
  Aurelia, Planeten, Monde, Asteroiden, Stationen, Schiffe, Drohnen, Orbits, Discovery und Langstreckenrouten darstellen.

- **[OPEN] P05.02.05 Navigation Detail und Route Comparison**
  Fast/Fuel/Safe/Balanced Candidates, Delta-v, ETA, Reserve, Risk, Accuracy und Why-not-Reason vergleichbar machen.

- **[OPEN] P05.02.06 Docking/Approach HUD**
  Alignment, Relative Velocity, Gate, Capture Range, Permission und Safety klar zeigen.

- **[BLOCKED] P05.02.07 Timewarp UI**
  Benötigt P03.04; Faktor, Objekt, Segment, Exit-Grund und nächste Safety-Prüfung sichtbar machen.

### P05.03 Spezialoberflächen

- **[FOUNDATION] P05.03.01 Combat Presentation Shell**
  Concept-parity-Chrome und Kontaktbereich existieren; echte Weapon-/Damage-/Targeting-Authority fehlt.

- **[OPEN] P05.03.02 Ship Builder Screen**
  Palette, Viewport, Ghost, Stats, Validation, Save/Test/Exit und Variantenmanagement als eigener Input Mode.

- **[OPEN] P05.03.03 Cargo und Inventory Screen**
  Source/Target, Masse, Volumen, Ownership, Legality, Hazard und Partial Transfer ohne doppelte Ressourcenlogik darstellen.

- **[OPEN] P05.03.04 Surface Suit/Scanner HUD**
  Suit State, Interaction, Tool, Node, Hazard, Owner, Cargo und Return-to-Ship-Status zeigen.

- **[OPEN] P05.03.05 Drone Operations Console**
  Rolle, Mission, Route, ETA, Fuel/Energy, Cargo, Risiko, Events, Recall und Recovery für alle eigenen Drohnen bündeln.

- **[OPEN] P05.03.06 Outpost/Market/Mission UI**
  Services, Storage, Prices, Access, Reputation, Contracts und Landing Permission als kompakte Terminal-Flows bereitstellen.

- **[OPEN] P05.03.07 Main Menu, Hangar und Save Selection**
  Start, Continue, Ship Context, Builder Entry, Settings und Save Slots als produktfähige Shell ergänzen.

### P05.04 Input und Accessibility

- **[FOUNDATION] P05.04.01 Ship Input Modes**
  Cruise/Precision/Translation sind vorhanden; ein allgemeiner InputModeController für Map, Builder, Surface, Drone, Terminal und Debug fehlt.

- **[OPEN] P05.04.02 Rebinding und Device Presentation**
  Action-basierte Keyboard/Mouse-/Controller-Bindings, Remapping und geräteabhängige Hilfetexte implementieren.

- **[FOUNDATION] P05.04.03 Graphics/Audio/Gameplay Settings**
  Versionierte Graphics Preferences für Presets, Render Scale, FOV, FPS-Limit und weitere Presentation-Werte samt player-facing Dialog sind implementiert. Audio-/Gameplay-Settings, Camera Shake, Autopilot Defaults sowie browserverwaltetes VSync/Fullscreen fehlen.

- **[OPEN] P05.04.04 Accessibility Baseline**
  Text Scale, Contrast, Color-safe Markers, Reticle Scale, Motion Reduction, Hold-to-confirm und Untertitel-/Audiohinweise definieren.

- **[DEFERRED] P05.04.05 Mobile Manual Flight**
  Mobile bleibt bis zu eigener Touch-/Accessibility-Spec auf Target Selection und Autopilot begrenzt.

## P06. Resources, Cargo, Inventory und Economy

### P06.01 Gemeinsamer Resource Core

- **[DONE] P06.01.01 Stable Resource Identity und Catalog**
  Resource IDs, Kategorien, Rarity, Legality, Ownership, Hazard, Stack Rules und JSON-safe Extensions sind implementiert.

- **[DONE] P06.01.02 Container und Capacity Core**
  Mass, Volume, Allowed/Blocked Tags, Contents, Ownership und immutable Snapshots sind vorhanden.

- **[DONE] P06.01.03 Explicit Transfer Core**
  Accepted/Rejected Quantity, Capacity Delta, Reason, Ownership und Mission-/Sealed-Regeln sind deterministisch testbar.

- **[DONE] P06.01.04 Canonical Serialization und Evidence**
  Katalog, Container und Transfers besitzen kanonische Serialisierung, Signaturen und Browser-Smoke-Evidence.

### P06.02 Runtime Cargo

- **[OPEN] P06.02.01 Runtime Container Registry**
  Suit, Ship, Drone, Outpost, Node und Mission Containers als persistente Instanzen mit Location/Owner verwalten.

- **[OPEN] P06.02.02 Ship Cargo Aggregation**
  Builder-Cargo-Module in verfügbare Mass-/Volume-Kapazität und konkrete Runtime-Container überführen.

- **[OPEN] P06.02.03 Cargo-Mass-to-Flight Contract**
  Geladene Cargo-Masse atomar in Ship Total Mass, Authority, Fuel, Braking, ETA und Route Validity einspeisen.

- **[OPEN] P06.02.04 Transfer Ports und Proximity Rules**
  Cargo Ports, Docking, gelandetes Schiff, Drone Bay und Outpost Intake als physische/semantische Transferberechtigung definieren.

- **[OPEN] P06.02.05 Suit Inventory Runtime**
  Kleine Proben, Tools, Ammo und Komponenten mit Mass/Volume/Hazard-Regeln in den Surface Player State integrieren.

- **[OPEN] P06.02.06 Drone und Outpost Containers**
  Autonome Partial Transfers, Full/Blocked States, Fees, Access und Mission Cargo auf dem gemeinsamen Core aufbauen.

### P06.03 Resource Nodes und Verbrauch

- **[OPEN] P06.03.01 Mining Node Reservoir und Depletion**
  Resource ID, Quantity, Grade, Hardness, Hazard, Owner, Surface Location und persistente Depletion modellieren.

- **[OPEN] P06.03.02 Fuel Consumption Integration**
  Refined Propellant und Tanks mit Flight-Verbrauch, Refuel, Reserve und Outpost Services verbinden.

- **[OPEN] P06.03.03 Ammo/Cell Consumption Integration**
  Ballistic, Energy, Coil, EMP und Explosive Feeds als resource-backed Weapon State definieren.

- **[OPEN] P06.03.04 Repair Material Consumption**
  Structural Plates, Electronics und Spezialteile für Hull-/Module-/Drone-/Suit-Reparaturen verbrauchen.

### P06.04 Economy und Crafting

- **[OPEN] P06.04.01 Minimal Market und Price Formula**
  Base Value, Location Demand, Faction Relation, Legality und Condition für wenige Starter-Ressourcen anwenden.

- **[OPEN] P06.04.02 Buy/Sell/Storage Transactions**
  Credits, Fees, Ownership Transfer, Capacity, Reputation und Mission Delivery in einem atomaren Result bündeln.

- **[OPEN] P06.04.03 Simple Refining Recipes**
  Ore zu Structural Plate, Ice zu Propellant/Life Support und Salvage zu Components als kleine, datengetriebene Transformationen.

- **[OPEN] P06.04.04 Ship Builder Costs und Unlocks**
  Parts referenzieren Resource IDs, Mengen, License/Faction/Research-Anforderungen und keine Display-Strings.

- **[OPEN] P06.04.05 Legality und Inspection Hooks**
  Legal, Claimed, Restricted, Protected, Illegal und MissionLocked zunächst als Warn-/Transfer-/Service-Regeln wirksam machen.

- **[DEFERRED] P06.04.06 Dynamische Supply Chains**
  Produktionsnetz, volle Nachfrage-Simulation und systemweite Marktdynamik erst nach stabilen V0-Transaktionen und Sinks.

## P07. Ship Builder, Varianten und Ship Runtime

### P07.01 Vorhandene Domain Foundations

- **[DONE] P07.01.01 Part-/Category-/Component-/Socket Schemas**
  Stable IDs, typed Components, Socket Metadata und schema-first Validation sind vorhanden.

- **[DONE] P07.01.02 Catalog und Starter Parts**
  Acht Kategorien, sechzehn Starter-Definitionen und Scout/Cargo/Weapon-Fixtures sind kanonisch testbar.

- **[DONE] P07.01.03 Blueprint und Serialization**
  Instances, Transforms, Connections, Mirror Metadata, Layout Hash und Migration Seams sind vorhanden.

- **[DONE] P07.01.04 Compatibility und Structural Graph**
  Socket/Endpoint Policy, Occupancy, Graph Components, Roots, Disconnects und Diagnostics sind implementiert.

- **[DONE] P07.01.05 Dry Mass, COM und Bounds**
  Enabled-only Mass Contributions, massgewichteter COM und yaw-aware Footprint Bounds sind implementiert.

### P07.02 Gameplay Metadata und Validation

- **[FOUNDATION] P07.02.01 Full Ship Stat Aggregator**
  Fuel/Loaded Mass, Main Thrust, RCS Force/Torque, Delta-v, Burn Time, Cargo, Weapons sowie reservierte Power- und Heat-Werte werden deterministisch berechnet. Power Generation, Cooling und autoritative Power-/Heat-Bilanzen fehlen.

- **[FOUNDATION] P07.02.02 Thrust Axis und Handling Diagnostics**
  COM/Thrust Offset, Weak Braking, RCS-Axis-/Torque-Gaps, Hard Overlap und optionale Acceleration-/Symmetry-Diagnostics sind implementiert. Inertia Estimates und die finale Gameplay-/Balance-Policy fehlen.

- **[FOUNDATION] P07.02.03 Spatial Overlap und Arc Validation**
  Strikte Hard-Overlap- und Camera-Authority-Prüfungen sind implementiert. Soft Overlap, Physical-/Plume-/Turret-Arcs, Cargo Exposure und vollständiges Camera Framing fehlen.

- **[FOUNDATION] P07.02.04 Flight-ready Validation Policy**
  Statische `DraftValid`-, `TestFlightReady`- und `ActiveShipReady`-Policies verbinden Control Core, Structure, Thrust, Fuel, RCS, Cargo, Overlap, Camera und finite Stats. Runtime Handoff, abgeschlossene Test Flights und dynamische Ressourcen fehlen.

- **[OPEN] P07.02.05 Marker Alias und Art Metadata Contract**
  Blender/GLB Nodes, Sockets, Helpers, VFX, Muzzles, Nozzles, Cargo, Docking, Camera, Landing und Drone Bay über stabile Rollen binden.

### P07.03 Builder MVP

- **[OPEN] P07.03.01 Builder Session und Input Mode**
  Flight, Hangar Entry, Builder Edit, Test Flight und Variant Management als explizite Zustände verwalten.

- **[OPEN] P07.03.02 Palette und Part Discovery**
  Kategorien, Suche, Filter, Verfügbarkeit, Stats und Requirements aus dem echten Catalog anzeigen.

- **[OPEN] P07.03.03 Placement, Ghost und Editing**
  Snap, Yaw Rotate, Move, Delete, Duplicate, Mirror, Undo und Redo auf Blueprint-Commands abbilden.

- **[OPEN] P07.03.04 Live Stats und Validation UI**
  Nach jedem Edit deterministische Stats, Errors, Warnings, Suggested Fix und betroffene Parts aktualisieren.

- **[OPEN] P07.03.05 Draft und Named Variant Persistence**
  Invalid Drafts speichern, Built-ins kopieren, Dirty State verwalten und Varianten schema-versioniert laden.

- **[OPEN] P07.03.06 Test Flight Loop**
  Validierten Draft temporär spawnen, normal fliegen, Evidence/Warnings sammeln und ohne automatische Save-Mutation zum Builder zurückkehren.

- **[OPEN] P07.03.07 Set Active Ship Handoff**
  Nur validierte, gespeicherte Varianten atomar zum aktiven Player Ship machen und normal spawn-/savebar halten.

### P07.04 Runtime und Content

- **[OPEN] P07.04.01 Blueprint-to-Ship Runtime Assembly**
  Parts, Stats, Thrusters, RCS, Cargo, Weapons, Camera und Visuals aus einem Blueprint deterministisch erzeugen.

- **[OPEN] P07.04.02 Renderer-/Art-Binding**
  Primitive Fallbacks und GLB-Part-Visuals von Gameplay Metadata trennen; fehlende Art darf Domain-Validierung nicht verändern.

- **[OPEN] P07.04.03 Production Modular Part Kit**
  Hard-Sci-Fi-Workship-Parts mit funktionalen Silhouetten, konsistenten Sockets, LODs und Marker-Audits erstellen.

- **[OPEN] P07.04.04 Remaining Starter Catalog Variants**
  Die noch geplanten Part-Varianten ergänzen, ohne Kosten oder Balance als final zu behaupten.

- **[OPEN] P07.04.05 Drone Bay, Landing und Utility Parts**
  Bay Size, Launch Axis, Cargo Link, Recharge/Repair, Landing Gear und Surface Capability in Metadata und Runtime aufnehmen.

- **[OPEN] P07.04.06 Hangar/Shipyard Service Integration**
  Builder Entry, Part Inventory, Repair/Refit, Costs, Licenses und Production Queue an sichere Locations binden.

## P08. Surface, Exploration, Mining und Survival

### P08.01 Surface-Ziele und Übergang

- **[OPEN] P08.01.01 LandingZone/Site/TargetPoint Taxonomy**
  Grobe Zone, entdeckter Site, exakter Landing Point, Pickup Point und Cargo Port als getrennte IDs/Contracts definieren.

- **[BLOCKED] P08.01.02 System-/Map-to-Surface Target Handoff**
  Benötigt P03.02 und P04.02; ein Karten-/Mission-Ziel muss denselben exakten Surface Target State erzeugen.

- **[OPEN] P08.01.03 Ship/Lander/Pod Surface Transition**
  Klar entscheiden, welche Craft landen, wann Pods/Lander genutzt werden und wie Player/Ship/Drone State übergeben wird.

- **[OPEN] P08.01.04 Safe Landing und Exit Validation**
  Slope, Terrain, Hazard, Plume, Clearance, Permission, Weather und Ausstiegszone prüfen und verständlich erklären.

### P08.02 First-Person Core

- **[BLOCKED] P08.02.01 SurfaceLocalFrame Runtime**
  Voraussetzung für Player, Ship, Sites, Terrain, Drones und Persistenz auf der Oberfläche.

- **[OPEN] P08.02.02 First-Person Controller und Camera**
  Walk, Sprint, Crouch, Jump, Gravity, Traction und familiar Controls in einer kleinen Testregion umsetzen.

- **[OPEN] P08.02.03 Suit State**
  Oxygen, Energy, Health, Seal, Thermal, Radiation und Contamination als kleine, lesbare Survival-Schicht modellieren.

- **[OPEN] P08.02.04 Consistent Interaction Core**
  Focus, Action Name, Required Tool, Hold-to-confirm, Block Reason, Owner, Hazard und Result für Terminals, Nodes, Cargo und Doors vereinheitlichen.

- **[OPEN] P08.02.05 Surface Scanner**
  Resource, Hazard, Ownership, Site, Mission Relevance und Hidden Detail in klaren Scan-Stufen aufdecken.

- **[OPEN] P08.02.06 Player/Ship/Drone State Handoff**
  Kontrollbesitz, Kamera, Input, Position, Cargo, Mission und Return-to-body/ship sicher zwischen den Modi übertragen.

### P08.03 Erste Surface Expedition

- **[BLOCKED] P08.03.01 One-Site Surface Test Range**
  Benötigt SurfaceLocalFrame und Target Handoff; enthält Landing/Pickup, einen Node, eine Gefahr und Rückweg.

- **[BLOCKED] P08.03.02 Hand Mining v0**
  Scanner bestätigt Resource/Owner/Hazard, Tool extrahiert über Zeit/Energy und schreibt in Suit Container.

- **[BLOCKED] P08.03.03 Suit-to-Ship Cargo Return**
  Material über einen echten Cargo Port und Transfer Result ins Runtime-Ship-Cargo überführen.

- **[OPEN] P08.03.04 Expedition Pressure Event**
  Kleiner Timer, Weather Shift, Drone Threat, Claim Warning oder Suit Resource Pressure erzeugt lesbare Entscheidung statt billiger Überraschung.

- **[OPEN] P08.03.05 Expedition Completion und Reward Hook**
  Cargo, Discovery, Repair, Fuel, Upgrade, Mission oder Reputation als Rückfluss in den Space Loop verbuchen.

### P08.04 Surface Content

- **[OPEN] P08.04.01 Site Discovery State Machine**
  Unknown, Rumored, Detected, Surveyed, Landing Confirmed, Visited, Depleted, Secured, Contested und Restricted persistieren.

- **[OPEN] P08.04.02 Wreck/Salvage Site v0**
  Ein kleines Wrack mit Ownership, fragilem Component, Data Core und Cargo/Repair-Entscheidung erstellen.

- **[OPEN] P08.04.03 Outpost Surface Site**
  Landing/Pickup, Terminal, Cargo Port, Owner, Service und Return Route in derselben Surface-Architektur beweisen.

- **[OPEN] P08.04.04 Environmental Hazards v0**
  Eine oder zwei datengetriebene Gefahren wie Dust, Radiation, Volatile Pocket, Storm oder Biohazard mit Scanner-Warnung umsetzen.

- **[DEFERRED] P08.04.05 Caves und Underground Streaming**
  Enclosed Spaces, Signalloss, Rooms und Subsurface Streaming erst nach stabiler Surface-/Interior-Transition.

- **[DEFERRED] P08.04.06 Planetweite Biome und Procedural Sites**
  Wiederholbare Felder und hand-authored Hero Sites erst nach einem bewiesenen kleinen Loop skalieren.

## P09. Drones, Remote Operations und Logistics

### P09.01 Drone Domain

- **[OPEN] P09.01.01 Drone Definition und Runtime State**
  Stable ID, Owner, Role, Frame, Mass, Cargo, Power/Fuel, Sensor, Tool, Mobility, Damage und Current Mission definieren.

- **[OPEN] P09.01.02 Drone Roles und Capability Matrix**
  Scout, Mining, Hauler, Security, Repair und Probe über explizite Components statt Klassennamen-only abbilden.

- **[OPEN] P09.01.03 Drone Bay/Deployment Contract**
  Ship Bay, Surface Crate und Outpost Pad mit Size, Launch Zone, Cargo Link, Recharge, Recovery und Permissions verbinden.

- **[OPEN] P09.01.04 Drone Progression und Modules**
  Sensor, Tool, Cargo, Power, Mobility, Weapon, Repair, Signal und Armor als neue Missionsmöglichkeiten statt nur größere Zahlen nutzen.

### P09.02 Remote Mission Core

- **[OPEN] P09.02.01 RemoteMission Record**
  Drone IDs, Target, Route, Cargo Plan, Risk, Time, Energy, Equipment, Legal Context, Progress, Notifications und Recall Policy speichern.

- **[OPEN] P09.02.02 Mission State Machine**
  Planned, Active, Suspended, RecallRequested, Completed, Failed, Aborted und Recoverable deterministisch behandeln.

- **[OPEN] P09.02.03 Deterministic Background Tick**
  Travel, Work, Energy, Cargo, Depletion, Hazard und Events ohne geladenes GameObject fortschreiben.

- **[OPEN] P09.02.04 Recall/Abort/Hold Policies**
  Safe Return, Cargo Priority, Drone Priority, Hold Position, Self Preserve und Contract Strict als erklärbare Policies implementieren.

- **[OPEN] P09.02.05 Drone Event/Notification Integration**
  Threat, Cargo Full, Power Low, Lost Link, Mission Complete und Recovery als priorisierte Events mit Spieleraktionen ausgeben.

### P09.03 Erste Missionsarten

- **[BLOCKED] P09.03.01 Scout/Survey Mission v0**
  Benötigt Map Discovery und Surface/World Target Contracts; soll einen Site markieren und Partial Data liefern können.

- **[BLOCKED] P09.03.02 Single Hybrid Mining Mission v0**
  Benötigt Runtime Cargo, Resource Node und Background Tick; mine, fill, return, transfer oder report blocked.

- **[BLOCKED] P09.03.03 Hauler Mission v0**
  Source/Target Containers, Route, Partial Transfer und Full Destination auf dem gemeinsamen Cargo Core ausführen.

- **[OPEN] P09.03.04 Repair/Recovery Mission v0**
  Repair Parts, Connector, Hazard und Recoverable Drone/Wreck als datengetriebene Aufgabe umsetzen.

- **[OPEN] P09.03.05 Security/Escort Mission v0**
  Rules of Engagement, Ammo/Energy, Encounter Risk und Legalität vor automatischem Combat prüfen.

- **[DEFERRED] P09.03.06 Probe und Orbital/Surface Hybrid**
  Long-range/one-way Probes nach Celestial-, Predictor- und Persistence-Grundlagen.

### P09.04 Multi-Drone und Remote Control

- **[DEFERRED] P09.04.01 Multi-Drone Operation**
  Mining + Hauler + Security + Repair erst nach stabilen Einzelmissionen, Cargo Reservations und Event Handling.

- **[DEFERRED] P09.04.02 Remote Camera/Manual Control**
  Explicit Control Transfer, Link Loss und Return-to-body nach Drone State/Persistence und InputModeController.

- **[DEFERRED] P09.04.03 Offline Mission Progression**
  Erst nach sicherer In-Session Background Simulation und klarer Offline-Zeit-Policy.

## P10. Combat, Damage, Weapons und Loot

### P10.01 Space Combat

- **[FOUNDATION] P10.01.01 Combat HUD/Contact Presentation**
  Combat Presentation existiert, und ein eigenständiger Combat Core ist vorhanden. Die sichtbare UI ist aber noch nicht mit einer spielbaren Combat Runtime verbunden.

- **[DONE] P10.01.02 Space Targeting und Weapon Computer Core**
  Target Snapshots, Range, Arc, Alignment, Tracking, Cooldown, Ammo/Energy/Heat, Fire Permission und Line-of-Fire Blocker sind deterministisch implementiert.

- **[DONE] P10.01.03 Projectile/Beam/Hit Resolution**
  Projectile Advancement, Swept Collision, Beam Rays, stabile Tie-Breaks und authoritative Hit Results sind implementiert.

- **[FOUNDATION] P10.01.04 Ship Damage und Module Effects**
  Armor, Hull, Module Damage, Damage Types und semantische Module Effects existieren. Die Effects sind noch nicht mit Flight, Navigation, Weapons, Cargo oder Runtime verbunden.

- **[OPEN] P10.01.05 Space PvE Encounter v0**
  Ein plausibel gespawnter/übergebener Gegner, klarer Combat Start, Flucht/Abbruch und Reward/Repair-Rückfluss.

- **[OPEN] P10.01.06 Salvage und Loot Transfer**
  Wreck Ownership, Cargo, Components, Ammo/Fuel und Legalität über den gemeinsamen Transfer Core abwickeln.

### P10.02 Surface Combat

- **[OPEN] P10.02.01 On-foot Weapon/Ammo Taxonomy**
  Cutter, Ballistic, Laser, Coil/Rail, Explosive und EMP mit Damage, Resource Cost, Heat, Signature und Legal Flags definieren.

- **[OPEN] P10.02.02 Player Health/Armor/Damage Core**
  Kinetic, Thermal, EMP, Explosive, Cutting und Environmental Damage mit Suit State verbinden.

- **[OPEN] P10.02.03 Enemy Drone v0**
  Readable Patrol, Detect, Warn/Attack, Damage, Disable und Loot/Ownership als erste Surface-Combat-Gegenkraft.

- **[OPEN] P10.02.04 Combat AI und Tactical Space v0**
  Cover, Range, Line of Sight, Retreat und Call-for-help zunächst klein und deterministisch halten.

- **[OPEN] P10.02.05 Tool-as-Weapon Integration**
  Mining Cutter, EMP und Breacher sowohl für Interaktion als auch begrenzten Combat verwenden.

- **[OPEN] P10.02.06 Legal Escalation und Collateral**
  Restricted Weapons, Protected Sites, Outpost Security und Faction Response vor/bei Eskalation sichtbar machen.

- **[DEFERRED] P10.02.07 Ship-to-Surface Fire Support**
  Erst nach Surface, Targeting, Law, Collateral und Ship Weapon Authority; niemals universelle Problemlösung.

### P10.03 Repair und Recovery

- **[OPEN] P10.03.01 Field Repair Loop**
  Damage diagnostizieren, passende Resource/Tool verbrauchen, Funktion teilweise wiederherstellen und Risiken melden.

- **[OPEN] P10.03.02 Destroyed/Disabled/Recoverable States**
  Schiffe, Drones, Turrets und Equipment nicht binär löschen, sondern bergbare Zustände und Last-known-location erzeugen.

## P11. Outposts, Missions, Factions und Reputation

### P11.01 Faction und Ownership Core

- **[OPEN] P11.01.01 Stable Faction Catalog**
  Extraction Combine, Frontier Settlers, Salvagers, Security, Pirates, Science und Old Infrastructure als IDs, Policies und Content Tags erfassen.

- **[OPEN] P11.01.02 Reputation/Relation State**
  Relation, Trust, Hostility, License, Bounty und Service Access als kleine, persistente Zustände definieren.

- **[OPEN] P11.01.03 Ownership/Claim/Legality Rules**
  Unclaimed, Player/Faction Owned, Abandoned, Protected, Restricted, Illegal, Evidence und MissionLocked einheitlich auswerten.

- **[OPEN] P11.01.04 Security Escalation Policy**
  Warn, Scan, Fine, Deny, Impound, Target und Attack als nachvollziehbare Stufen statt sofortiger Feindseligkeit modellieren.

### P11.02 Outpost Runtime

- **[OPEN] P11.02.01 Settlement/Outpost Definition**
  Owner, Location, Landing/Pickup, Services, Storage, Market, Missions, Defense und Discovery als stabile Daten erfassen.

- **[OPEN] P11.02.02 Service Framework**
  Refuel, Repair, Storage, Market, Mission Board, Drone Service, Scanner Relay und Shipyard als capability-basierte Services.

- **[BLOCKED] P11.02.03 V0 Mining/Trade Outpost**
  Benötigt Surface Target/Frame und Runtime Cargo; ein Pad, Terminal, Transfer, Buy/Sell, Refuel und Owner Label beweisen.

- **[OPEN] P11.02.04 Access, Fees und Inspection**
  Permission, Reputation, License, Contraband, Storage Fee und Service Rejection in klare Transaction Results überführen.

- **[OPEN] P11.02.05 Outpost Background Events**
  Restock, Production Complete, Mission Expired, Raid Threat, Storage Fee und Relation Change über Event Queue simulieren.

### P11.03 Mission Framework

- **[OPEN] P11.03.01 Mission Contract Core**
  Issuer, Objectives, Targets, Requirements, Rewards, Failure, Time, Cargo, Legal Context und State als persistente Daten definieren.

- **[OPEN] P11.03.02 Objective Vocabulary**
  Deliver, Mine, Scan, Salvage, Repair, Escort, Defend, Investigate, Recover und Return als kombinierbare, testbare Schritte.

- **[OPEN] P11.03.03 Reward/Cost Settlement**
  Credits, Resources, Reputation, License, Blueprint, Map Discovery, Repair/Fuel und Follow-up Mission atomar verbuchen.

- **[OPEN] P11.03.04 Mission Board und Filters**
  Risiko, Ort, Dauer, Cargo, Tool, Faction und Reward lesbar filtern, ohne bereits eine Voll-RPG-Dialogschicht zu benötigen.

- **[OPEN] P11.03.05 Mission/Navigation Handoff**
  Mission Targets erzeugen echte TargetDescriptors, Route Preview und Return/Pickup Points statt UI-only Marker.

### P11.04 Economy und Worldbuilding Ausbau

- **[OPEN] P11.04.01 Location Demand Profiles**
  Wenige nachvollziehbare Preisunterschiede aus Standort, Versorgung und Faction Identity ableiten.

- **[OPEN] P11.04.02 Black Market v0**
  Restricted/Illegal Cargo mit höherem Wert, höherem Scan-/Reputation-Risiko und begrenzten Services handeln.

- **[OPEN] P11.04.03 Environmental Storytelling Kit**
  Manifests, Beacons, Crates, Warning Signs, Damage, Logs und Faction Markings als wiederverwendbare Content-Bausteine.

- **[DEFERRED] P11.04.04 Dynamic Settlement Growth und Faction Wars**
  Erst nach stabilen Services, Missionen, Economy, Persistence und Content-Produktion.

## P12. Persistence, Background Simulation und Offline State

### P12.01 Savegame Foundation

- **[FOUNDATION] P12.01.01 Domain-local Canonical Serialization**
  Resource und Builder besitzen stabile Serialisierung; zusätzlich existieren kanonisches Persistence JSON, Signaturen, ein striktes `SaveGameEnvelopeV1` und eine generische Migration Boundary. Storage, Runtime-Integration und produktive Save-Migrationen fehlen.

- **[FOUNDATION] P12.01.02 Global SaveGame Schema**
  `SaveGameEnvelopeV1` versioniert Universe Time, Definition References, Player, Ships, Drones, Stations, Bases, Missions, Encounters, Discoveries und World Events fail-closed. Economy, Seeds, vollständige Domainzustände, Storage und Save/Load-Flows fehlen.

- **[FOUNDATION] P12.01.03 MobileObject AbsoluteState**
  Ein generischer Mobile Record persistiert Identität, Frame, Transform, Velocity, Epoch, Mass, Fuel, Cargo-IDs sowie Damage-/Power-/Plan-/Mission-Referenzen. Vollständige domänenspezifische Zustände, Materialisierung und Runtime-Roundtrips fehlen.

- **[FOUNDATION] P12.01.04 Definitions vs Mutable State**
  Mutable Records referenzieren versionierte Definitions-Snapshots über stabile IDs; Definition Bodies und Presentation Truth werden nicht ins Save eingebettet. WorldTemplate-/Voxel-Definitionen und die Integration weiterer Domains fehlen.

- **[FOUNDATION] P12.01.05 Save Migration Registry**
  Eine generische Registry validiert eindeutige, lückenlose, reine Version-to-Version-Schritte fail-closed. Es gibt noch keine produktive Game-Save-Migration, kein `SaveGameEnvelopeV2` und keine Missing-/Renamed-Definition-Policy.

### P12.02 Simulation Modes

- **[FOUNDATION] P12.02.01 Active/Background/Dormant State Machine**
  Eine deterministische Transition Matrix für `Active`, `Background`, `Dormant`, Replan-/Attention-Zustände und `Destroyed` ist implementiert. Tatsächliche Scene Materialization, Background Progression und Runtime-Handoffs fehlen.

- **[OPEN] P12.02.02 Background Mobile Simulation**
  Analytical Orbit, Autopilot Coast/Burn, Mission Step, Fuel/Cargo und Events ohne Renderobjekt fortschreiben.

- **[OPEN] P12.02.03 Scene Materialization/Dematerialization**
  GameObjects aus persistentem State erzeugen und beim Entladen den autoritativen State ohne Snap/Verlust zurückschreiben.

- **[OPEN] P12.02.04 Plan/Warp Revalidation on Load**
  Ziel, Frame, Fuel, Safety, Segment, Encounter und Warp Exit prüfen; bei Unsicherheit `NeedsReplan`/`NeedsPlayerAttention`.

### P12.03 World Persistence

- **[OPEN] P12.03.01 Discovery/Site/Node Persistence**
  Map Knowledge, Site State, Resource Depletion, Ownership, Damage und Last Contact dauerhaft speichern.

- **[OPEN] P12.03.02 Ship Variant und Active Ship Persistence**
  Drafts, Variants, Active Ship, Runtime State und Builder Catalog Version konsistent laden.

- **[OPEN] P12.03.03 Outpost/Mission/Faction Persistence**
  Services, Storage, Jobs, Reputation, Hostility und Background Events über Szenenwechsel erhalten.

- **[FOUNDATION] P12.03.04 Deterministic Save/Load Regression Harness**
  Fokussierte Unit- und Browser-Evidence deckt kanonischen Roundtrip, Signaturen, Migration Registry, Event Queue und Mode Transitions ab. Der integrierte Save/Load-Harness für Frame Shift, Plan Hash, Cargo, Missionen und echte Runtimezustände fehlt.

- **[BLOCKED] P12.03.05 Persistent Voxel Deltas**
  Die generischen Save-/Definitions-/Migration-Foundations aus P12.01 existieren; es fehlen P04.05.03 sowie WorldTemplate-/WorldInstance-Schemas und produktive Voxel-Delta-Integration. Ein WorldTemplate liefert Seeds und Versionen, während eine WorldInstance nur Semantic State und lokale Deltas statt Mesh- oder Three.js-Zustand speichert. Acceptance sind deterministische Roundtrip-, Replay- und Migrationstests über Versionswechsel.

### P12.04 Offline und Multiplayer

- **[OPEN] P12.04.01 Offline-Time Policy**
  Zunächst keine unbegrenzte Realzeit-Simulation; geplante Missionen und Caps ausdrücklich festlegen.

- **[DEFERRED] P12.04.02 Cloud Sync und Multi-device Saves**
  Erst nach lokal stabilen Save-/Migration-Verträgen.

- **[DEFERRED] P12.04.03 Persistent Multiplayer World**
  Server-authoritative World State, Client Projections und Online/Offline Player-Regeln als eigenes Programm.

## P13. Content, Art Direction, Assets, Audio und Worldbuilding

### P13.01 Art Direction

- **[FOUNDATION] P13.01.01 UI Visual Vocabulary**
  Dark Navy/Black, Cyan/Blue Structure, Green Ready, Amber/Red Risk und center-clear Cockpit/Planner-Komposition sind dokumentiert und in der Flight-HUD-/Combat-Shell-Grundlage teilweise umgesetzt; größere Oberflächen bleiben offen.

- **[FOUNDATION] P13.01.02 Hard-Sci-Fi Ship Language**
  Workships, Utility Craft, Pods, Lander, Drones, Tanks, RCS, Radiators und funktionale Silhouetten sind Ziel; Fighter-coded Referenzen bleiben zu ersetzen.

- **[OPEN] P13.01.03 Concept Image Classification**
  Jede Referenz als Approved, Follow-up, Replace-needed, Legacy oder Runtime Evidence führen und LFS-Inhalt vor visueller Freigabe materialisieren.

- **[OPEN] P13.01.04 Shared Iconography und Typography**
  Navigation, Warning, Cargo, Builder, Surface, Drone, Faction und Combat mit konsistenten, lizenzklaren Assets versorgen.

### P13.02 Ship und Vehicle Assets

- **[DONE] P13.02.01 Demo Scout Browser Visual**
  Ein validiertes GLB plus Fallback beweist den Visual Adapter, ist aber noch keine modulare Production Fleet.

- **[OPEN] P13.02.02 Modular Workship Part Kit**
  Cockpit, Frames, Thrusters, RCS, Tanks, Cargo, Weapons und Utility Parts mit korrekten Sockets und LODs produzieren.

- **[OPEN] P13.02.03 Surface Transfer Pod/Lander**
  Planetenzugang visuell und technisch über surface-rated Craft statt pauschal landende Hauptschiffe erklären.

- **[OPEN] P13.02.04 Drone Family Kit**
  Scout, Mining, Hauler, Security, Repair und Probe durch klare Silhouette und Tool/Cargo-Funktion unterscheiden.

- **[DEFERRED] P13.02.05 Rover und Surface Vehicles**
  Nach Surface Movement, Cargo und Drone Logistics.

### P13.03 World Content

- **[OPEN] P13.03.01 Aurelia Celestial Visual Profiles**
  Star, Planets, Moons, Belt und Stationen mit realen Daten, abstrahierten Map Icons und LOD-/Materialprofilen verbinden.

- **[OPEN] P13.03.02 Hestia Hero Biome Direction**
  Archipel, flache Meere, dunkle Vegetation, Nebelwald, hohe biologische Aktivität und Schutzkonflikte in kleine Hero Sites übersetzen.

- **[OPEN] P13.03.03 Tharos Frontier Kit**
  Kalte Wüste, Eis, Mining Camps, Depots, Dust Hazards und einfache Outposts als erstes robustes Surface-Content-Set prüfen.

- **[OPEN] P13.03.04 Outpost Modular Kit**
  Pad, Terminal, Cargo Port, Storage, Generator, Beacon, Defense und Faction Markings wiederverwendbar bauen.

- **[OPEN] P13.03.05 Resource/Wreck/Site Prop Kit**
  Nodes, Containers, Drills, Salvage, Data Cores, Claims und Hazards mit stabilen Entity-/Interaction-IDs liefern.

- **[DEFERRED] P13.03.06 Large Procedural Content Pipeline**
  Erst nach kleinen authored/procedural Slices, Persistence und Performance-Budgets.

### P13.04 VFX und Audio

- **[FOUNDATION] P13.04.01 Ship Thruster/RCS VFX**
  Actuator-getriebene Main-/RCS-/SAS-Effekte existieren; Production Particles, Damage und Environment Interaction fehlen.

- **[OPEN] P13.04.02 Weapon/Impact/Explosion VFX**
  VFX aus autoritativen Fire/Hit/Damage Events ableiten und nicht als Trefferlogik verwenden.

- **[OPEN] P13.04.03 Cockpit/Ship Audio Foundation**
  Engine, RCS, SAS, Warning, UI, Hull und Environment aus semantischen States steuern.

- **[OPEN] P13.04.04 Surface Ambience und Hazard Audio**
  Wind, Atmosphere, Suit, Scanner, Wildlife, Mining und Outpost Signatures für Lesbarkeit nutzen.

- **[DEFERRED] P13.04.05 Musik und adaptive Score**
  Nach stabilen Gameplay States und Encounter-/Location-Vokabular.

### P13.05 Voxel Asset Authoring und Compilation

- **[OPEN] P13.05.01 GLB-to-Voxel Compiler**
  Benötigt P07.02.05 und P00.04.01; GLB/glTF ist der kanonische Input für einen deterministischen, Three.js-unabhängigen Asset-Compiler. Acceptance sind gepinnte Inputs mit reproduzierbaren Voxel-/Semantik-Artefakten, Hashes, Bounds und verständlichen Reject-Diagnostics.

- **[OPEN] P13.05.02 Voxel Golden Asset Corpus**
  Baut auf dem Compiler-Vertrag aus P13.05.01 und der Lizenzprüfung aus P00.04.01 auf. Lizenzklare Golden Cases für dünne Wände, Diagonalen, Terrain, Gebäude, authored Hotspots und Damage müssen erwartete Hashes, Bounds und Qualitätsdiagnosen besitzen.

## P14. Tooling, Performance, Release und langfristige Plattform

### P14.01 Test- und CI-Plattform

- **[DONE] P14.01.01 TypeScript/Vitest/Playwright Main Gate**
  Typecheck, 444 Unit Tests, Build und 44 E2E-Szenarien sind im aktuellen Merge-Gate nachgewiesen.

- **[DONE] P14.01.02 Targeted Browser LFS Restore**
  Erforderliche GLB-/PNG-Artefakte werden selektiv materialisiert und Signaturen im CI geprüft.

- **[FOUNDATION] P14.01.03 Deterministic Proving Grounds**
  Local Flight, Long Range, Bang-Bang, Known Stress, World Streaming, Builder und Resource Cores besitzen reproduzierbare Tests.

- **[OPEN] P14.01.04 Test Group Ownership und Runtime Budget**
  E2E-Gruppen, maximale Laufzeit, Worker-Isolation, Evidence Output und Flake Policy dauerhaft festlegen.

- **[OPEN] P14.01.05 Save/Load/Background Test Harness**
  Neue persistente Systeme benötigen Time Advance, Scene Materialization, Migration und Event Queue Evidence.

### P14.02 Performance und Packaging

- **[OPEN] P14.02.01 Browser Performance Baseline**
  CPU Tick, Three.js Render, Memory, GC, Asset Load, Chunk Streaming und Input Latency auf repräsentativen Geräten messen.

- **[FOUNDATION] P14.02.02 World/Render Budgets**
  Chunk-/Entity-/LOD-Budgets existieren im Core; reale Content- und GPU-Budgets fehlen.

- **[OPEN] P14.02.03 Code Splitting und Initial Load**
  Große Planner/Builder/Surface/Content-Flächen lazy laden und die bestehende Main-Chunk-Warnung gezielt reduzieren.

- **[OPEN] P14.02.04 Asset Compression und Caching**
  GLB, Textures, Audio, Evidence und Runtime Content mit klaren Build-/Cache-/Invalidation-Regeln ausliefern.

- **[OPEN] P14.02.05 Browser Compatibility Matrix**
  Chromium-Baseline um Firefox/WebKit oder eine ausdrücklich eingeschränkte Support Policy ergänzen.

### P14.03 Release und Betrieb

- **[OPEN] P14.03.01 Deployable Browser Build**
  Versionierte statische Builds, Base Path, Cache Busting, Error Page und reproduzierbaren Release-Artifact-Export einrichten.

- **[OPEN] P14.03.02 Runtime Error/Crash Reporting**
  Player-safe Error IDs, Logs, Build Version und Privacy-konforme Diagnostics bereitstellen.

- **[OPEN] P14.03.03 Release Checklist und Versioning**
  Schema-/Save-Migration, Assets, CI, Evidence, Performance und Known Issues vor jedem Release prüfen.

- **[OPEN] P14.03.04 Telemetry und Privacy Policy**
  Nur klar definierte, opt-in oder notwendige technische Daten erfassen; keine versteckte Gameplay-/Code-Erfassung.

- **[DEFERRED] P14.03.05 Multiplayer/Backend/Anti-cheat**
  Nach stabiler Singleplayer-Domain, Persistence, Authority und Encounter-Grundlage als separates Programm planen.

### P14.04 WebGL Observability und Performance Evidence

- **[RESEARCH] P14.04.01 Worker Data/Control Plane Benchmark**
  Benötigt P04.05.01 und P14.02.01; große Worker-Payloads verwenden Transferables, während RPC nur die Control Plane vereinfachen darf. Acceptance vergleicht Transfer, Clone und Control-Overhead; WASM folgt nur aus Benchmarks, Shared Memory bleibt optional und erhält eine eigene Deploymentprüfung.

- **[OPEN] P14.04.02 Spector WebGL Capture**
  Baut auf P14.02.01 auf und definiert reproduzierbare, anlassbezogene Captures für Draw Calls, Programme, Buffer und GPU-State. Acceptance dokumentiert Capture-Rezept und Observer-Effekt; Spector bleibt WebGL-Capture, Chrome DevTools CPU-/Network-/Heap-Diagnostik, stats-gl Dev-only-Indikator und MemLab Leak-/Retainer-Harness.

- **[OPEN] P14.04.03 Runtime Performance Telemetry**
  Baut auf P14.02.01 auf und erfasst kontinuierlich CPU-, GPU-, Frame-, Streaming- und Memory-Signale mit klarer stats-gl-Rolle. Acceptance sind versionierte Budgets, repräsentative Szenarien und ein gemessener Telemetrie-Overhead, getrennt von Spector-Captures.

- **[BLOCKED] P14.04.04 Streaming Memory Leak Harness**
  Benötigt P04.03.04 und P14.04.03; wiederholte Tile-/Brick-Load-Unload-Zyklen werden mit MemLab-orientierten Retainer- und Heap-Prüfungen untersucht. Acceptance sind stabile Speicherbudgets und reproduzierbare Leak-Failures, nicht einzelne Momentaufnahmen.

## 7. Kritische Abhängigkeiten

- `P06.02.03 Cargo-Mass-to-Flight` benötigt Runtime Container und Ship Cargo Aggregation.
- `P07.03 Ship Builder MVP` nutzt die vorhandenen statischen Full-Stats-/Readiness-Foundations; es benötigt verbleibende Gameplay Metadata und eine Blueprint-to-Ship Runtime Assembly.
- `P08 Surface` benötigt SurfaceLocalFrame, Target Handoff, Player/Ship/Drone State Handoff und Runtime Cargo.
- `P09 Drone Mining` benötigt Drone Domain, Mission Core, Background Tick, Resource Node und Runtime Cargo.
- `P11 V0 Outpost` benötigt Surface/Location Target, Runtime Cargo, Transaction Core und Faction/Access State.
- `P03 Timewarp` nutzt den vorhandenen Universe-Time-Vertrag; es benötigt aktive Zeitautorität, vollständige AbsoluteState Persistence und den gemeinsamen Trajectory Predictor.
- `P03 Encounters` nutzt den vorhandenen Event-Queue-Vertrag; es benötigt Gameplay-Produzenten/-Konsumenten, Predictor, Sensor Knowledge und Timewarp/Real-Time Handoff.
- `P10 Combat Economy` benötigt Ammo/Fuel/Repair Resources, Damage State und Legal/Faction Hooks.
- `P04 große Planetenskalierung` benötigt nachgewiesene lokale Surface-/Streaming-/Persistence-Budgets.
- `P04.05 Planetare Voxel-Runtime` benötigt Frame-, Loader- und Benchmark-Evidence; Representation Handoffs behalten grobe Parents bis zur Bereitschaft feinerer Daten aktiv.
- `P04.06 Birth Clusters` benötigt deterministische Seeds, Celestial IDs und Save-Schemas; Hidden-Sector-Interest bleibt bis zu einer Online-Authority deferred.
- `P12.03.05 Persistent Voxel Deltas` nutzt die generischen Save-/Migration-Foundations; es benötigt WorldTemplate-/WorldInstance-Schemas, produktive Voxel-Migrationen und stabile Representation-Handoff-IDs.
- `P04.07 Destructible Bodies` benötigt Mesher-, Delta- und Orbitverträge; lokale Zerstörung verändert nicht automatisch Rotation oder Orbit.
- `P14.04.04 Streaming Memory Leak Harness` benötigt einen realen Async Loader sowie kontinuierliche Runtime-Telemetrie.

## 8. Nächste empfohlene Spec-Pakete

Diese Reihenfolge maximiert Wiederverwendung und reduziert parallele Doppelwahrheiten:

1. **`runtime-cargo-and-loaded-mass-authority-v1`**
   Verbindet den vorhandenen Resource Core mit Ship Cargo, Total Mass, Flight und Autopilot.

2. **`surface-target-local-frame-and-state-handoff-v1`**
   Definiert LandingZone, Surface Target, SurfaceLocalFrame und Player/Ship/Drone Übergänge als gemeinsame Basis.

3. **`persistence-browser-storage-save-load-runtime-integration-v1`**
   Verbindet das vorhandene V1-Envelope, Universe Time, Domain Events und Simulation Modes mit Browser Storage, Save/Load-Flows und expliziter Runtime-Autorität.

4. **`ship-builder-mvp-edit-save-testflight-v1`**
   Erstellt den ersten vollständigen Builder-Loop auf den bereits vorhandenen Domain- und Stat-Grundlagen.

5. **`surface-mining-cargo-return-vertical-slice-v1`**
   Beweist Map Target, Land/Transition, Exit, Scan, Mine, Suit Cargo, Ship Transfer und Reward Hook in einer kleinen Region.

6. **`outpost-services-and-mission-contract-v1`**
   Verbindet Surface, Cargo, Market, Refuel, Owner/Faction und einen Mine-and-deliver-Vertrag.

7. **`drone-remote-mission-background-v1`**
   Fügt eine einfache Scout/Mining-Hybrid-Drohne mit Datenmission, Background Tick und Ship-Cargo-Transfer hinzu.

Danach werden Combat/Economy oder Celestial/Orbit je nach gewünschtem nächsten Produktziel priorisiert.

## 9. Pflegeprozess

Bei jedem größeren Merge:

1. `origin/main` und aktuelle CI bestimmen.
2. Betroffene Arbeitspakete von `[OPEN]` zu `[FOUNDATION]` oder `[DONE]` aktualisieren.
3. Evidence-Pfade und bekannte Limits in den zugehörigen Detaildokumenten aktualisieren.
4. Neue Arbeit nur als neues Paket mit stabiler ID ergänzen.
5. Erledigte Pakete nicht löschen; ihre Kurzbeschreibung bleibt als Projektgeschichte erhalten.
6. Abhängigkeiten neu prüfen, wenn ein Contract anders geschnitten wurde.
7. Alte Specs separat reconciliieren; das Living Plan-Dokument toggelt keine DevToolbox-Tasks.

## 10. Quellenregister

### 10.1 Aktueller Browser-Stand

- `docs/browser-mainline/adr-0001-threejs-mainline.md`
- `docs/browser-mainline/browser-architecture.md`
- `docs/browser-mainline/known-unity-bug-traps.md`
- `docs/browser-mainline/feature-intent-index.md`
- `docs/browser-mainline/port-roadmap.md`
- `docs/browser-mainline/testing-and-evidence.md`
- `docs/browser-mainline/ci-verification.md`
- `docs/current-mainline-state.md`
- `docs/browser-mainline/live-world-presentation-truth-v1.md`
- `docs/browser-mainline/celestial-gravity-core-v1.md`
- `docs/browser-mainline/combat-weapon-damage-core-v1.md`
- `docs/browser-mainline/persistence-universe-time-event-core-v1.md`
- `docs/browser-mainline/graphics-settings-foundation-v1.md`
- `docs/browser-mainline/resource-cargo-inventory-core-v1.md`
- `docs/browser-mainline/ship-builder-domain-catalog-v1.md`
- `docs/browser-mainline/ship-builder-compatibility-mass-core-v1.md`
- `docs/browser-mainline/ship-builder-full-stats-flight-readiness-v1.md`
- `apps/weltraum-browser/evidence/**`

### 10.2 Architektur und Audits

- `docs/legacy-unity/current-prototype-state-2026-06-15.md`
- `docs/design-audits/2026-06-14-planning-consistency-audit.md`
- `docs/legacy-unity/architecture/prototype-legacy-boundary-audit-2026-06-15.md`
- `docs/legacy-unity/devtoolbox-audits/change-audit-2026-06-14.md`
- `docs/legacy-unity/roadmap/spec-sorting-2026-06-15.md`
- `docs/legacy-unity/roadmap/stale-metadata-backlog-2026-06-15.md`
- `docs/legacy-unity/roadmap/spec-sorting-backlog.md`
- `docs/architecture/**`
- `docs/ux/**`

### 10.3 Spielkonzept

- `docs/spielkonzept/startsystem.md`
- `docs/spielkonzept/celestial-runtime-data-contract.md`
- `docs/spielkonzept/real-scale-world-architecture.md`
- `docs/spielkonzept/orbital-simulation-model.md`
- `docs/spielkonzept/navigation-computer.md`
- `docs/spielkonzept/autopilot-player-experience.md`
- `docs/spielkonzept/autopilot-timewarp.md`
- `docs/spielkonzept/player-map-and-hud.md`
- `docs/spielkonzept/encounters-and-interception.md`
- `docs/spielkonzept/resource-cargo-inventory-model.md`
- `docs/spielkonzept/resources-mining-crafting.md`
- `docs/spielkonzept/resource-economy-balancing-v0.md`
- `docs/spielkonzept/ship-builder-*.md`
- `docs/spielkonzept/on-planet-first-person-mode.md`
- `docs/spielkonzept/planetary-exploration-loop.md`
- `docs/spielkonzept/planetary-settlements-outposts.md`
- `docs/spielkonzept/drones-*.md`
- `docs/spielkonzept/drone-*.md`
- `docs/spielkonzept/weapons-combat-progression.md`
- `docs/spielkonzept/worldbuilding-factions-economy.md`
- `docs/spielkonzept/persistence-and-offline-simulation.md`

### 10.4 Visuelle Referenzen

- `docs/UI-Screenshots/*.png`
- `docs/browser-mainline/ui-screenshot-audit.md`
- `docs/legacy-unity/ux/player-facing-ui-concept-v0.md`
- `docs/concept-art/ship-image-audit.md`
- `docs/concept-art/hard-sci-fi-ships/**`
- `docs/concept-art/planetary-operations/**`
- `apps/weltraum-browser/evidence/ui-concept-parity-*.png`

Visuelle Referenzen sind Guidance. Vor einer visuellen Freigabe müssen LFS-Dateien materialisiert und Concept Art, Runtime Evidence sowie Legacy Screenshots korrekt unterschieden werden.
