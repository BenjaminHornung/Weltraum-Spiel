# 08 - Granulare Meilensteine

## M0 - Projektwahrheit stabilisieren

Ziel: Die Dokumentation darf dem Code/Evidence nicht widersprechen.

Tasks:

```text
- Current Prototype State aktualisieren.
- Exact-arrival Widerspruch auflösen.
- Change Audit aktualisieren.
- Archive-Kandidaten markieren.
- Stale Metadata Backlog anlegen.
```

Done when:

```text
- docs/current-prototype-state.md spiegelt aktuelle Evidence.
- Autopilot exact-arrival Status ist eindeutig.
- Ein Spec-Sorting-Dokument existiert.
```

## M1 - Clean-Core Skeleton

Tasks:

```text
- Assets/_Weltraum Struktur anlegen.
- Assembly Definitions anlegen.
- Root AGENTS.md und .agent/PLANS.md anlegen.
- Legacy Prototype Boundary dokumentieren.
- Scene Manifest Vorlage anlegen.
```

Done when:

```text
- Build läuft.
- Keine Produktfeatures hängen vom neuen Skeleton ab.
- Agents haben klare Regeln.
```

## M2 - Autopilot V2 Pure Core

Tasks:

```text
- TargetDescriptor/ArrivalEnvelope/RoutePlan DTOs.
- Direct planner.
- Fuel/Authority snapshot.
- Obstacle snapshot.
- Route scoring Fastest/FuelSaver/Balanced.
- Executor ohne Unity Scene.
- Determinism/NoSilentReplan Tests.
```

Done when:

```text
- EditMode tests für Direct/Obstacle/Fuel/InvalidTarget grün.
- gleicher Input erzeugt gleichen PlanHash.
```

## M3 - Autopilot V2 Unity TestRange

Tasks:

```text
- AutopilotTestRange.unity.
- ScenarioCatalog.
- EvidenceRecorder.
- Gizmo/Telemetry overlay.
- PlayMode tests mit CSV/JSON/Screenshot.
```

Done when:

```text
- MCP/CI kann TestRange headless ausführen.
- Evidence wird bei PASS und FAIL geschrieben.
```

## M4 - Navigation UI und Route Status Contract

Tasks:

```text
- navigation-route-preview-and-status-contract-v1.
- ViewModels für PlanReady/Executing/Invalidated/Complete/Failed.
- HUD compact navigation panel.
- Route candidate comparison UI.
- Failure reason display.
```

Done when:

```text
- Spieler sieht ETA/Fuel/Risk/Authority.
- Kein UI liest Autopilot-Interna direkt.
```

## M5 - Space Vertical Slice

Tasks:

```text
- Bootstrap.unity.
- SpaceVerticalSlice.unity.
- funktionales Schiff.
- Zielauswahl.
- Autopilot V2 Direct/Obstacle.
- Radar/Minimap v1.
- Screenshot matrix.
```

Done when:

```text
- Spieler kann Ziel setzen, Route sehen, Autopilot starten,
  ankommen oder Failure verstehen.
```

## M6 - UI/Input Mode Foundation

Tasks:

```text
- InputModeController.
- ShipFlight/Navigation/SystemMap/Builder/Surface/Debug modes.
- modal focus gating.
- hint/help bar.
- debug/player UI separation.
```

Done when:

```text
- Fluginput leakt nicht in Map/Builder/Textfelder.
- F2-F6 sind debug-only.
```

## M7 - Cargo/Resource/Ship Mass Contracts

Tasks:

```text
- resource-cargo-inventory-model-v1 finalisieren.
- CargoContainer und ResourceStack.
- ship-cargo-mass-authority-integration-v1.
- Route planner liest cargo mass.
```

Done when:

```text
- Cargo-Mass beeinflusst Fuel/Brake/Authority/Route validity.
```

## M8 - Ship Builder Metadata und Test Flight

Tasks:

```text
- socket alias contract.
- ship builder metadata.
- draft validation.
- temporary test flight.
- Set Active getrennt von Test Flight.
```

Done when:

```text
- ungültiger Draft blockiert Test Flight mit Grund.
- gültiger Draft fliegt temporär.
```

## M9 - Surface Target und Local Frame

Tasks:

```text
- surface-target-descriptor-and-map-handoff-v1.
- surface-local-frame-architecture-v1.
- LandingZone -> LandingTargetPoint.
- SurfaceSite -> target points.
```

Done when:

```text
- keine Surface-Route benutzt vage Zone als Autopilot-Completion.
```

## M10 - Surface First-Person Slice

Tasks:

```text
- isolierte Surface test range.
- player exits ship.
- suit HUD.
- scanner.
- one resource node.
- mining tool.
- inventory -> ship cargo transfer.
```

Done when:

```text
- Surface Loop liefert etwas zurück in Space/Cargo/Ship loop.
```

## M11 - Outposts, Missions, Factions, Drones

Tasks:

```text
- settlement-service-model-v1.
- mission-contract-framework-v1.
- faction legality.
- surface drone logistics.
```

Done when:

```text
- Outpost ist kein isoliertes UI, sondern nutzt Cargo/Resource/Mission/Faction contracts.
```

## M12 - Gravity/Orbit/Timewarp Erweiterung

Tasks:

```text
- timewarp locked execution.
- gravity perturbation harness.
- patched conics research.
- optional slingshot candidate scoring.
```

Done when:

```text
- Slingshot wird nur gewählt, wenn Score/Safety besser ist.
- Timewarp führt locked plan deterministisch aus oder invalidiert sichtbar.
```
