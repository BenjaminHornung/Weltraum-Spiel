# 01 - Empfohlene Projektstruktur

## Ziel

Das Projekt braucht eine Struktur, die für Unity, AI-Agents und langfristige
Feature-Entwicklung stabil bleibt. Der aktuelle Prototyp soll nicht gelöscht,
aber vom zukünftigen Produktkern getrennt werden.

## Root-Konzept

```text
Assets/
  _Weltraum/
    Runtime/
      Core/
      Simulation/
      Flight/
      Navigation/
      UI/
      Map/
      ShipBuilder/
      CargoResources/
      World/
      Combat/
      Missions/
      FactionsEconomy/
      Drones/
      Persistence/
    Content/
      ScriptableObjects/
      Prefabs/
      Materials/
      VFX/
      UI/
      Ships/
      Celestial/
    Scenes/
      Product/
      VerticalSlices/
      TestRanges/
      UIShowroom/
      Archive/
    Tests/
      EditMode/
      PlayMode/
      Fixtures/
    Editor/
      AgentTools/
      Validation/
      SceneTemplates/
```

Der alte Stand bleibt zunächst hier:

```text
Assets/Scripts/Prototype/
Assets/Scenes/PrototypeBootstrapHost.unity
```

Diese Pfade werden als Legacy-/Adapter-/Referenzbereich markiert. Neue
Produktfeatures werden nicht mehr direkt in `Prototype` implementiert.

## Assembly-Grenzen

```text
Weltraum.Core
  Keine Unity-Scene-Abhängigkeit.
  Enthält IDs, Zeit, Events, Logging, deterministische Math-Helfer, Result-Typen.

Weltraum.Simulation
  Absolute/relative Koordinaten, Floating Origin, Celestial Bodies, Gravity,
  Obstacle Snapshots, Frame-Konvertierung.

Weltraum.Flight
  ShipState, Thruster/RCS/SAS, Fuel, Mass, Authority, ShipController-Abstraktionen.

Weltraum.Navigation
  TargetDescriptor, RoutePlanner, RoutePlan, AutopilotExecutor, ObstacleAvoidance,
  GravityAssist-Kandidaten, RouteDiagnostics.

Weltraum.UI
  ViewModels, UI-State, HUD/Panel-Presenter, Input-Mode-Anbindung.
  Kein direkter Zugriff auf Planner-Interna außer über Commands/ViewModels.

Weltraum.Map
  SystemMap, LocalMap, Radar/Minimap, route preview rendering.

Weltraum.ShipBuilder
  Parts, sockets, validation, test-flight integration.

Weltraum.CargoResources
  ResourceDefinition, ResourceStack, CargoContainer, Inventory, transfer commands,
  mass/volume/legal/ownership.

Weltraum.World
  SurfaceLocalFrame, PlanetSurface, LandingZone, SurfaceSite, Outposts.

Weltraum.Combat
  Weapons, target locks, ammo/heat/damage.

Weltraum.Persistence
  Save/load DTOs, migration, deterministic IDs.
```

## Dependency-Regel

```text
Core -> niemand
Simulation -> Core
Flight -> Core, Simulation
Navigation -> Core, Simulation, Flight
UI -> Core, Navigation contracts, Flight contracts, Cargo contracts
Map -> Core, Simulation, Navigation contracts
ShipBuilder -> Core, Flight contracts, Cargo contracts
World -> Core, Simulation, Navigation contracts, Cargo contracts
Combat -> Core, Flight contracts, Cargo contracts
Persistence -> DTOs/Contracts, aber nicht direkt Scene-MonoBehaviours
```

Regel: Abhängigkeiten gehen nach innen, nicht seitlich kreuz und quer. Scenes
dürfen Systeme zusammensetzen, aber keine Geschäftslogik enthalten.

## Namespace-Konvention

```csharp
Weltraum.Core
Weltraum.Simulation
Weltraum.Flight
Weltraum.Navigation
Weltraum.UI
Weltraum.Map
Weltraum.ShipBuilder
Weltraum.CargoResources
Weltraum.World
Weltraum.Combat
Weltraum.Persistence
Weltraum.Editor
```

## ScriptableObject-Verträge

ScriptableObjects sind gut für Konfiguration, nicht für unkontrollierten
Laufzeitstatus.

```text
Assets/_Weltraum/Content/ScriptableObjects/
  Navigation/
    RoutePlannerProfile.asset
    AutopilotTuningProfile.asset
  Flight/
    ShipAuthorityProfile.asset
    ThrusterProfile.asset
  CargoResources/
    ResourceDefinitionCatalog.asset
  UI/
    HudLayoutProfile.asset
    InputHintCatalog.asset
  World/
    CelestialBodyCatalog.asset
```

## Migrationsregeln

### Behalten

- funktionale Blender Demo Scout Assets,
- bestehende Evidence-/Screenshot-Matrizen,
- Proving-Ground-Tests als Baseline,
- bewährte PlayMode/EditMode Fixtures,
- aktuelle Gameplay-Erkenntnisse aus Prototype.

### Migrieren

- `TargetDescriptor`- und Route-Preview-Konzepte,
- Autopilot-Harness-Szenarien,
- HUD/Navigation/Weapon Computer View-Daten,
- Ship Builder Datenmodelle, falls getestet.

### Neu bauen

- Autopilot-Kern,
- Produkt-UI-Struktur,
- Scene-Management,
- Data Contracts für Cargo/Resource/Surface Target/Frames,
- Agentenregeln und Spec-Lifecycle.

### Archivieren

- Legacy IMGUI als Diagnostics-only,
- alte prototype-only scenes,
- superseded DevToolbox changes,
- stale evidence folders nach expliziter Audit-/Archive-Phase.

## Agentenfreundliche Dateigrößen

Für AI-Agents sind kleine, scharf abgegrenzte Dateien besser als riesige
MonoBehaviours.

Richtwerte:

```text
< 250 Zeilen: gut
250-500 Zeilen: akzeptabel für Unity-Presenter/Editor Tools
> 500 Zeilen: nur bei generierten Daten oder bewusstem Orchestrator
> 800 Zeilen: Refactor prüfen
```

## Wichtige Architekturentscheidung

Der neue Produktkern soll nicht versuchen, `PrototypeWaypointAutopilot` direkt
zu verschönern. Er soll die funktionierenden Semantiken übernehmen, aber als
sauberes `RoutePlanner + RoutePlan + Executor + Diagnostics`-System neu
geschnitten werden.
