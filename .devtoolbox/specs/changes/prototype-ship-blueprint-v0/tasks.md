# Tasks: Prototype Ship Blueprint v0

Referenz: `design.md` (Architektur/Logik) und `ui-spec.md` (verbindliche UI-Anleitung — bei UI-Fragen IMMER zuerst dort nachsehen). Voraussetzung: Button-State-/Typografie-Tokens aus dem HUD-UI-Slice; falls nicht vorhanden, minimal anlegen (ui-spec.md §0).

## Phase 0 — Spike: Spawn-Pfad verifizieren
- [ ] Per EditMode-/PlayMode-Spike pruefen, dass ein **programmatisch zusammengestelltes** Custom-Blueprint (nicht Scout/Hauler) ueber `BuildVariant()` + `PrototypeBootstrap.BuildPrototype()` korrekt fliegt (Main/RCS/Gun gebunden, Masse stimmt). Abweichungen im `BuildVariant()`-Pfad fixen, bevor UI-Arbeit beginnt.

## Phase 1 — Session-Logik (pure C#, ohne UI)
- [ ] `PrototypeShipBuilderSession`: Draft, Kommandos (Add/Move/RotateYaw90/RotatePitch90/Duplicate/Remove/Rename/Select/SetMirrorX), Grid-Snap 0,25 m, InstanceId-Vergabe `<definitionId>-<n>`, IsDirty.
- [ ] Undo-Stack (Tiefe 32, Snapshot des Instanz-Arrays pro Kommando).
- [ ] Raeumliche Zusatzvalidierung nach design.md §4 (Ueberlappung hart/weich, freischwebend, Schub-Versatz, RCS-Abdeckung, Cockpit-Lage) — integriert in `Validate()`-Ergebnis.
- [ ] `BuildStats()` nach design.md §5 (inkl. Delta-v aus erzeugten FuelSettings, COM, Schub-Versatz).
- [ ] EditMode-Tests fuer alle Kommandos, Snap, Undo, Validierungsregeln (je Positiv/Negativ), Stats-Formeln gegen Handrechnung.

## Phase 2 — Persistenz
- [ ] `PrototypeShipBlueprintStore`: Save/LoadAll/Delete, `persistentDataPath/blueprints/`, JSON-Wrapper `schemaVersion:1`, SanitizeId, Built-ins read-only, beschaedigte Dateien als Eintrag markieren.
- [ ] EditMode-Tests: Roundtrip, Sanitize, beschaedigte Datei, Kopie-Namensvergabe `<id>-copy-<n>`.

## Phase 3 — Hangar-Modus & Viewport
- [ ] `PrototypeShipBuilderMode`: Enter/Exit (F8 + HUD-Button, nur bei relSpeed < 1 m/s), Flug-HUD/Assists deaktivieren, Builder-Root (Kamera, Licht, Grid) aktivieren; `PrototypeUiLayoutManager`-Window-State `ShipBuilder`.
- [ ] Grid-Rendering (0,25-m-Raster, 1-m-Hauptlinien, Hoehen-Level via Q/E), Maus-Raycast auf Arbeitsebene.
- [ ] Modul-Visuals (Primitive-Pfad + Kategoriefarben), Ghost (gruen/rot, Mirror-X), Auswahl-Highlight, COM- und Schubachsen-Gizmo.
- [ ] Builder-Kamera: Orbit/Pan/Zoom/F-Framing nach ui-spec.md §4.
- [ ] Testflug-Flow: Validieren → bei Errors blockieren (Fehler anzeigen) → `BuildVariant()` → `BuildPrototype()` → Flugmodus; Verlassen-Flow mit Dirty-Dialog.

## Phase 4 — Builder-UI (strikt nach ui-spec.md)
- [ ] Zonen-Layout mit exakten Ankern/Groessen (ui-spec.md §1), alle Elemente mit Pflicht-Namen aus §2, Bindings-Check analog `HasCompleteHudBindings`.
- [ ] TopBar (§3): Name-Input, Dirty-Chip, Buttons mit allen Zustaenden inkl. Disabled-Grund unter `Testflug`.
- [ ] Palette (§5): Kategorie-Tabs, Modulkarten mit Kennzahlen-Zeile, Mirror-Toggle, Footer-Hinweis.
- [ ] InfoPanel (§6): Stats-Tabelle (exakte Zeilen/Formatierung), Validierungsliste mit deutschem Mapping und Klick-zu-Modul, Auswahl-Inspektor.
- [ ] HintBar (§7) mit den exakten Kontexttexten; Dialoge Laden/Verwerfen (§8).
- [ ] Eingabetabelle (§9) vollstaendig, inkl. Shortcut-Sperre bei fokussiertem Input-Feld.
- [ ] ViewModel-Schicht (`PrototypeShipBuilderViewModel`) — UI liest nur Snapshots; EditMode-Test, dass Snapshot ohne Szene/OnGUI baubar ist.

## Phase 5 — Tests & Evidence
- [ ] PlayMode `blueprint-spawn-fly` (Harness-Szenario aus `prototype-regression-test-harness-v1` verwenden, sonst lokal anlegen): Scout-Blueprint → Testflug → Schub → Bewegung, Masse/Fuel == Blueprint-Summen, keine Console-Errors.
- [ ] PlayMode Hangar-Roundtrip: Enter → platzieren → Save → Exit → Enter → vorhanden.
- [ ] Layout-/Overlap-Tests fuer 1280x720/1920x1080/2560x1080; Bindings-Test fuer alle §2-Namen.
- [ ] Screenshot-Matrix nach ui-spec.md §10 + manuelles Protokoll unter `tests/`.
