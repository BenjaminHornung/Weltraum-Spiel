# Design: Prototype Ship Blueprint v0

Stand: 2026-06-12. Zeilen-/Dateiangaben = Commit `a68333b`. Die UI ist separat und verbindlich in `ui-spec.md` spezifiziert.

## 1. Vorhandene Basis (nicht neu bauen!)

- **Datenmodell:** `Assets/Scripts/Prototype/PrototypeShipBlueprint.cs` — `PrototypeShipModuleDefinition` (Kategorie, Masse, Fuel, Thrust, RCS, GunSettings, Groesse), `PrototypeShipModuleInstance` (InstanceId, DefinitionId, LocalPosition/Euler/ScaleOverride), `Validate()` mit Fehler-/Warnungs-Report, `BuildVariant()` → `PrototypeShipVariant` inkl. Mass-/Fuel-/Main-/RCS-Settings-Aggregation.
- **Katalog:** `PrototypeShipBlueprintCatalog.BuiltInBlueprints()` (Scout, Hauler) mit fertigen Definition-Saetzen.
- **Spawn-Pfad:** `PrototypeBootstrap.BuildPrototype(PrototypeShipVariant)` (`PrototypeBootstrap.cs:102`) baut das komplette fliegbare Schiff (Thruster, RCS, Gun, Stats); `PrototypeShipVariant.FromBlueprint` (`PrototypeShipVariant.cs:91`).
- **Tests:** `Assets/Tests/Editor/PrototypeShipBlueprintBuilderValidationTests.cs`.
- **Alles ist `[Serializable]`/`SerializeField`** → JsonUtility-kompatibel ohne Umbau.

v0 ergaenzt: Session-Logik, Persistenz, raeumliche Zusatzvalidierung, Statistik, UI, Modus-Flow.

## 2. Architektur

```
PrototypeShipBuilderSession (pure C#, kein MonoBehaviour, EditMode-testbar)
  - DraftBlueprint (Arbeitskopie: List<Definition>, List<InstanceDraft>)
  - Kommandos: AddModule, MoveModule, RotateModuleYaw90/Pitch90, DuplicateModule,
               RemoveModule, RenameBlueprint, SelectModule, SetMirrorX
  - UndoStack (Kommando-Snapshots des Instanz-Arrays, Tiefe 32)
  - Validate(): kombiniert PrototypeShipBlueprint.Validate() + SpatialValidation (Abschnitt 4)
  - BuildStats(): Kennzahlen (Abschnitt 5) aus BuildVariant()-Ergebnis
  - IsDirty (ungespeicherte Aenderungen)

PrototypeShipBlueprintStore (pure C#)
  - Save(blueprint) -> persistentDataPath/blueprints/<blueprintId>.json
  - LoadAll() -> Built-ins (read-only) + Spieler-Dateien
  - Delete, Exists, SanitizeId (kebab-case, Dateiname-sicher)
  - JSON-Wrapper mit schemaVersion:1 fuer spaetere Migration

PrototypeShipBuilderMode (MonoBehaviour, Szenen-/Modus-Integration)
  - Enter/Exit Hangar (Abschnitt 6)
  - besitzt Session + Store, baut Modul-Visuals (Ghost/Platziert) ueber
    PrototypeShipPartVisualFactory-Pfad, COM-/Thrust-Gizmos
  - Maus-Raycasts auf Arbeitsebene, Grid-Snap, Auswahl-Highlight

PrototypeShipBuilderHud (uGUI-Renderer, nach ui-spec.md)
  - konsumiert nur PrototypeShipBuilderViewModel-Snapshots (gleiches Muster wie Player-HUD:
    Gameplay -> Snapshot -> Renderer; kein direkter Session-Zugriff aus Widgets)
```

Datenfluss pro Frame: Session/Mode bauen `PrototypeShipBuilderViewModel` (Palette, Auswahl, Validierung, Stats, Hints, Buttons-Zustaende) → HUD rendert. Buttons/Inputs rufen Mode-Methoden, Mode ruft Session-Kommandos. Keine UI-Logik in der Session, keine Spiel-Logik im HUD.

## 3. Editier-Modell

- **Raster:** Grid-Snap 0,25 m auf allen Achsen; Rotation nur in 90°-Schritten (Yaw via `R`, Pitch via `T`). Keine freien Winkel in v0 — haelt Validierung, RCS-Richtungen und UI einfach.
- **Arbeitsebene:** Platzierung erfolgt per Maus-Raycast auf eine horizontale XZ-Ebene durch den aktuellen **Hoehen-Level** (Y, in Grid-Schritten; `Q`/`E` senkt/hebt den Level). Die Ebene wird als Gitter gerendert (ui-spec.md §4).
- **Ghost-Vorschau:** Nach Palette-Klick haengt eine halbtransparente Box (LocalSize der Definition) am Cursor; gruen = platzierbar, rot = Fehler (Ueberlappung-Hard, siehe §4). Linksklick platziert, `Esc`/Rechtsklick bricht ab. Ghost bleibt aktiv fuer Mehrfachplatzierung, bis abgebrochen.
- **Mirror-X-Modus (Toggle `M`):** Beim Platzieren mit X != 0 wird automatisch eine gespiegelte zweite Instanz (−X) erzeugt — primaer fuer RCS-Pods. Gespiegelte Instanz bekommt eigenen InstanceId-Suffix `-mirror`.
- **Auswahl:** Klick auf platziertes Modul selektiert (Highlight-Outline + Eintrag im Inspektor-Bereich, ui-spec.md §6). Drag verschiebt auf der Arbeitsebene (snapped). `Entf` loescht, `Ctrl+D` dupliziert (Ghost am Cursor), `Ctrl+Z` Undo.
- **InstanceIds:** automatisch `<definitionId>-<n>` (fortlaufend, eindeutig); nicht editierbar in v0.

## 4. Raeumliche Zusatzvalidierung (neu, in Session.Validate())

Ergaenzt den bestehenden Report (Fehler bleiben dort: Pflichtkategorien, IDs, Finite):

| Pruefung | Typ | Regel |
| --- | --- | --- |
| Ueberlappung hart | **Error** | Achsen-AABB zweier Instanzen ueberlappen > 75 % des kleineren Volumens (Module ineinander) |
| Ueberlappung weich | Warnung | AABB-Ueberlappung > 0 %, ≤ 75 % (Beruehrung/Verschachtelung ist in v0 erlaubt — Module duerfen buendig stecken) |
| Freischwebend | Warnung | Instanz-AABB (um 0,05 m expandiert) beruehrt keine andere Instanz |
| Schub-Versatz | Warnung | Lateraler Versatz der gemittelten Main-Thruster-Achse zum Massenschwerpunkt > 0,35 m ("Schiff wird beim Burn drehen") |
| RCS-Abdeckung | Warnung | Pro Achsenrichtung (±X, ±Y) kein RCS-Pod vorhanden ("Translation eingeschraenkt") — Heuristik ueber Pod-Positionen relativ zum COM |
| Cockpit-Blickrichtung | Warnung | Cockpit liegt nicht im vorderen Drittel der Schiffs-AABB (+Z) |

Schwerpunkt-Berechnung: massegewichtetes Mittel der Instanz-Positionen (DryMass; Fuel zaehlt zur Tank-Position) — dieselbe Logik, die `BuildStats()` fuer das COM-Gizmo nutzt. Alle Schwellwerte als Konstanten mit Kommentar, keine Magic Numbers im Code verstreut.

Wichtig: **Warnungen blockieren Testflug/Speichern nicht**, nur Errors blockieren den Testflug (Speichern ist immer erlaubt, auch invalide Drafts — Spieler darf Baustellen sichern).

## 5. Statistik (BuildStats)

Quelle: `BuildVariant()`-Ergebnis + Settings; Anzeigen (Formeln dokumentieren, nicht raten):

- Trockenmasse `TotalDryMassKg`, Fuel-Kapazitaet `TotalFuelCapacityKg`, Startmasse = beide summiert.
- Gesamtschub `TotalMainThrustForce` (N) und Beschleunigung voll/leer = Schub / Masse (m/s²).
- Delta-v = `ve * ln(m0 / m1)` mit `ve = TotalMainThrustForce / fullThrottleFuelKgPerSecond` (aus den erzeugten `PrototypeShipFuelSettings`; nicht hartkodieren), `m0` = Startmasse, `m1` = Trockenmasse.
- RCS: Pod-Anzahl, `translationForce`/`attitudeForce` aus den erzeugten `PrototypeRcsSettings`.
- COM-Position (lokal) + lateraler Schub-Versatz (fuer Gizmo und Warnung aus §4).
- Modul-/Kategorie-Zaehler aus dem Validation-Report.

## 6. Modus-Flow (Hangar)

- **Einstieg:** HUD-Button `Hangar` (Systems-Panel) und Taste `F8`; nur erlaubt, wenn Schiff nahezu still (relSpeed < 1 m/s) oder direkt nach Bootstrap. Beim Einstieg: Flug-HUD aus, Autopilot/Assists abgebrochen (`Abort("hangar")`), Schiff wird ausgeblendet/geparkt, Builder-Szene-Root aktiviert (eigene Kamera, Grid, Licht), `PrototypeUiLayoutManager` bekommt neuen Window-State `ShipBuilder`.
- **Initialer Draft:** zuletzt bearbeitetes Spieler-Blueprint, sonst Scout-Built-in als Kopie ("scout-copy-1").
- **Testflug:** Button validiert; bei Errors → Fehlerliste blinkt/scrollt (ui-spec.md §7), kein Spawn. Sonst: `BuildVariant()` → `PrototypeBootstrap.BuildPrototype(variant)`, Hangar zu, Flugmodus an, Spawn an Hangar-Position mit v=0. Ungespeicherte Aenderungen: Testflug erlaubt (Draft bleibt im Speicher), aber Hinweis-Chip "Nicht gespeichert".
- **Verlassen ohne Testflug:** `F8`/`Esc`-Dialogzeile bei IsDirty ("Aenderungen verwerfen? [Speichern] [Verwerfen] [Abbrechen]", ui-spec.md §8); zurueck zum vorherigen Schiff.
- **Builder-Kamera:** Orbit um Schiffs-AABB-Zentrum (RMB-Drag), Pan (MMB-Drag), Zoom (Mausrad, 3-40 m Distanz), `F` = auf Auswahl/AABB framen. Eigene Kamera, nicht `SimpleFollowCamera`.

## 7. Persistenz

- Pfad: `Application.persistentDataPath/blueprints/<id>.json`; Dateiname == BlueprintId (sanitisiert: lowercase, `a-z0-9-`).
- Format: `{ "schemaVersion": 1, "blueprint": { ...JsonUtility-Dump von PrototypeShipBlueprint... } }`.
- Built-ins erscheinen in der Lade-Liste als read-only Vorlagen; "Bearbeiten" erzeugt immer eine Kopie mit neuem Namen (`<id>-copy-<n>`).
- Laden validiert sofort; nicht parsebare Dateien erscheinen als Eintrag "beschaedigt" (nicht crashen, nicht stillschweigend ueberspringen).
- Kein Auto-Save in v0; Dirty-Flag + expliziter Save-Button (Ctrl+S).

## 8. Tests

- **EditMode (Session, ohne UI):** Add/Move/Rotate/Remove/Duplicate/Mirror inkl. Grid-Snap; Undo-Stack (32 Schritte, Reihenfolge); InstanceId-Vergabe; SpatialValidation-Faelle (je Regel ein Positiv-/Negativfall); Stats-Formeln (Delta-v gegen Handrechnung); Store Save/Load-Roundtrip (Blueprint == Blueprint), SanitizeId, beschaedigte Datei.
- **EditMode (ViewModel):** Snapshot-Bau ohne `OnGUI`/Szene (bestehendes Muster `PrototypeUiArchitectureValidationTests`).
- **PlayMode:** `blueprint-spawn-fly` (Harness-Szenario): Scout-Blueprint → Testflug → 10 s Vorwaertsschub → Geschwindigkeit > 0, Masse/Fuel == Blueprint-Summen, keine Console-Errors. Hangar-Roundtrip: Enter → Modul platzieren → Save → Exit → Enter → Modul vorhanden.
- **Screenshots:** Matrix nach ui-spec.md §10.

## 9. Risiken / Abgrenzung

- `PrototypeBootstrap.BuildPrototype` erwartet bestimmte Layout-Konventionen (Nozzle-Namen, RCS-Block-Richtungen) — vor UI-Bau mit einem Spike pruefen, dass ein per Session erzeugtes Custom-Blueprint (nicht nur die Built-ins) korrekt fliegt; Abweichungen zuerst im `BuildVariant()`-Pfad fixen.
- `PrototypeShipBlueprint.Validate()` verlangt heute zwingend Gun + RCS + FuelTank + MainThruster + Cockpit — fuer v0 beibehalten (klare Regeln), in der UI als Pflichtliste anzeigen statt nur Fehlertext.
- Scale-Override pro Instanz existiert im Datenmodell; die UI von v0 exponiert es **nicht** (nur Definitionsgroesse) — weniger Freiheitsgrade, weniger Edge-Cases. Datenmodell bleibt kompatibel.
- Performance unkritisch (Dutzende Module); Validate/Stats pro Edit-Vorgang berechnen, nicht pro Frame.
