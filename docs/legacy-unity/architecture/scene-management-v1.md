# 05 - Scene Management Design

## Ziel

Scenes sollen Komposition und Evidence ermöglichen, nicht Geschäftslogik
verstecken. Jede Scene bekommt einen klaren Zweck.

## Scene-Kategorien

```text
Product
  Produktfähige Einstiegsszenen.

VerticalSlices
  Kleine spielbare Schnitte, die mehrere Systeme beweisen.

TestRanges
  Reproduzierbare Testumgebungen für Autopilot, Flight, Combat, Builder, Surface.

UIShowroom
  UI-Zustände ohne Gameplay-Chaos.

Archive
  Alte Prototype Scenes, nicht mehr Default.
```

## Empfohlene Struktur

```text
Assets/_Weltraum/Scenes/
  Product/
    Bootstrap.unity
    SpaceSandbox.unity
  VerticalSlices/
    SpaceVerticalSlice.unity
    ShipBuilderTestFlightSlice.unity
    SurfaceMiningSlice.unity
  TestRanges/
    AutopilotTestRange.unity
    FlightAuthorityTestRange.unity
    CombatTargetingTestRange.unity
    ShipBuilderValidationRange.unity
    CargoTransferTestRange.unity
  UIShowroom/
    HudShowroom.unity
    NavigationMapShowroom.unity
    SettingsShowroom.unity
  Archive/
    PrototypeBootstrapHost_Legacy.unity
```

## Bootstrap.unity

Enthält nur langlebige Infrastruktur:

```text
GameRoot
  ServiceRegistry
  SceneLoader
  InputModeController
  TimeService
  FloatingOriginService
  SaveGameService
  AudioRoot
  UIRoot
  DiagnosticsRoot
```

Nicht enthalten:

```text
- konkrete Mission
- konkrete Autopilot-Testobjekte
- Debug-Wildwuchs
- hart verdrahtete Feature-Prototypen
```

## SpaceVerticalSlice.unity

Der erste Produkt-Slice:

```text
- ein funktionales Schiff
- eine Zielauswahl
- Navigation UI
- Autopilot V2 Direct/Obstacle
- Radar/Minimap
- ein kleiner Combat-/Target Dummy Kontext
- Evidence-ready camera
```

Definition of Done:

```text
Spieler startet, sieht klares HUD, wählt Ziel, sieht Route, startet Autopilot,
kommt exakt an oder bekommt sichtbaren Failure-Grund.
```

## AutopilotTestRange.unity

Siehe `03_autopilot_test_harness.md`.

## UIShowroom

UIShowroom darf Zustände simulieren:

```text
- kein echtes Physics nötig
- ViewModels mit Sample-Daten
- Screenshot-Matrix
- Settings/Keybinds/Warnings/Planner States
```

## Scene Manifest

Jede neue Scene bekommt ein Markdown-Manifest:

```text
Assets/_Weltraum/Scenes/<Category>/<SceneName>.manifest.md
```

Inhalt:

```text
# Scene Manifest

Purpose:
Owner systems:
Allowed runtime roots:
Required prefabs:
Input mode:
Test category:
Screenshots:
Validation checklist:
Known limits:
```

## Validierungsregeln

```text
- genau ein EventSystem
- genau eine aktive MainCamera, außer bewusst dokumentiert
- keine Missing Scripts
- keine null-critical serialized fields
- keine Prototype-Abhängigkeit ohne Adapter
- keine Debug-Only UI im Player Basic Preset
- Szenen laden ohne Console Errors
- TestRange kann headless laufen
```

## Umgang mit alter Scene

`Assets/Scenes/PrototypeBootstrapHost.unity` bleibt zunächst spielbar und dient
als Legacy-Vergleich. Sie wird aber nicht mehr als Ort für Produktarchitektur
behandelt.

Migration:

```text
1. Legacy Scene einfrieren.
2. Manifest hinzufügen: Prototype/Legacy/Diagnostics.
3. SpaceVerticalSlice parallel bauen.
4. Features nur nach Tests/Evidence migrieren.
5. Nach Stabilisierung legacy Scene in Archive verschieben oder als
   RegressionScene behalten.
```

## Additive Scene Loading

Später sinnvoll:

```text
Bootstrap.unity permanent
SpaceSystemContent additive
UIRoot additive/persistent
SurfaceSite additive
OutpostInterior additive
TestRange additive für Harness
```

Regel: Additive Scenes enthalten Content und lokale Spawner, nicht globale
Services.

## AI-Agent-Regeln für Scenes

```text
- Scene-Änderung immer mit Manifest/Checklist.
- Keine Scene-Änderung ohne Screenshot oder automated validation.
- Keine Business-Logik als Scene-only Script.
- Prefab-Änderung und Scene-Änderung in getrennten Tasks, wenn möglich.
- MCP manage_scene / scene validation nutzen.
- RunTests nach Script-/Scene-Änderung.
```
