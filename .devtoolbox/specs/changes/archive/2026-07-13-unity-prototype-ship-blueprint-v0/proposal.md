# Proposal: Prototype Ship Blueprint v0 — Datengetriebene modulare Schiffskonstruktion

## Problem

Das Spiel soll modulare, selbstgebaute Schiffe unterstuetzen. Das **Datenmodell existiert bereits**: `PrototypeShipBlueprint` (Definitionen + Instanzen + `Validate()` + `BuildVariant()` → `PrototypeShipVariant`), ein Built-in-Katalog (Scout, Hauler) und der Spawn-Pfad `PrototypeBootstrap.BuildPrototype(variant)` inkl. Mass/Fuel/Thruster/RCS/Gun-Verdrahtung. Es fehlt alles, womit ein Spieler das benutzen kann:

1. **Kein Builder-UI** — Blueprints sind nur Code-Konstanten.
2. **Keine Persistenz** — Spieler-Blueprints koennen nicht gespeichert/geladen werden.
3. **Kein Build-Modus-Flow** — kein Hangar-Zustand, kein "Bauen → Validieren → Testfliegen"-Loop.
4. **Keine Bau-Statistik** — Masse, Schub, Beschleunigung, Delta-v, Schwerpunkt sind beim Bauen unsichtbar, obwohl genau diese Tradeoffs das Gameplay sind.
5. Validierung prueft nur Kategorien-Minima, keine raeumlichen Probleme (Ueberlappung, Schub durch Schwerpunkt, RCS-Abdeckung).

## Outcome

- Ein **Hangar-/Builder-Modus** (getrennt vom Flug): Module aus einer Palette auf einem Snap-Raster platzieren, drehen, verschieben, loeschen; Geist-Vorschau mit Gueltigkeits-Farben; Undo.
- **Live-Panel** mit Validierungsstatus und Kennzahlen: Trockenmasse, Fuel, Gesamtmasse, Schub, Beschleunigung, Delta-v, RCS-Autoritaet; Schwerpunkt- und Schubachsen-Gizmo im Viewport; Warnung bei Schub-Versatz zum Schwerpunkt.
- **Speichern/Laden** von Spieler-Blueprints als JSON unter `persistentDataPath/blueprints/`; Built-ins (Scout/Hauler) als Startvorlagen ("Als Kopie bearbeiten").
- **Testflug-Loop:** Button validiert, baut die Variant ueber den bestehenden `BuildVariant()`/`BuildPrototype()`-Pfad, spawnt das Schiff und wechselt in den Flug; Rueckkehr in den Hangar moeglich.
- Die UI ist in `ui-spec.md` **bis auf Komponentennamen, Anker, Groessen, Zustaende und Interaktionen** ausgeschrieben, damit UI-schwache Agents sie 1:1 umsetzen koennen.
- Harness-Anbindung: Szenario `blueprint-spawn-fly` (siehe `prototype-regression-test-harness-v1`) schuetzt den Pfad Blueprint → Variant → Spawn → Flug.

## Scope

- Neuer reiner Logik-Layer `PrototypeShipBuilderSession` (testbar ohne UI): Draft-Blueprint, Edit-Kommandos, Undo, Validierung, Statistik.
- Persistenz `PrototypeShipBlueprintStore` (JSON via JsonUtility, IDs/Versionsfeld).
- Raeumliche v0-Zusatzvalidierung (Ueberlappung, Schubachsen-Versatz, RCS-Achsenabdeckung) als Warnungen.
- Builder-UI (uGUI, gleicher Stack wie Player-HUD, `PrototypeUiStyle`-Token) nach `ui-spec.md`.
- Hangar-Modus-Integration in `PrototypeBootstrap`/`PrototypeUiLayoutManager` + Testflug-Flow.
- EditMode-/PlayMode-Tests + Screenshot-Evidence.

## Non-Goals

- Keine Socket-/Verbindungsphysik (Module sind starre Layout-Eintraege wie bisher), kein Schadensmodell pro gebautem Modul ueber das Bestehende hinaus.
- Keine importierten Mesh-Teile: v0 nutzt die vorhandene Primitive-Visualisierung (`PrototypeShipPartVisualFactory`-Pfad); Imported-Functional-Schiffe bleiben separat.
- Kein In-Flight-Editing, keine Wirtschaft/Unlocks/Part-Kosten, kein Multiplayer.
- Keine neuen Modul-Kategorien (es bleiben die 8 bestehenden aus `PrototypeShipModuleCategory`); Cargo/Utility bleiben reine Masse-Module.
- Kein finales Art-Pass; funktionaler Sci-Fi-Stil mit bestehenden Style-Tokens.
