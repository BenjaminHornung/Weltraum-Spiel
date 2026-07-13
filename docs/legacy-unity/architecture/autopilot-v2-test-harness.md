# 03 - Autopilot Test Harness

## Ziel

Der Autopilot darf nie wieder nur über manuelles Playmode-Gefühl validiert
werden. Es braucht zwei Ebenen:

1. Reines Code-Harness für deterministische Planner-/Executor-Tests.
2. Unity-Testscene für sichtbare, reproduzierbare PlayMode- und MCP-Evidence.

## Ebene 1: Pure Code Harness

### Testpfade

```text
Assets/_Weltraum/Tests/EditMode/Navigation/
  RoutePlannerDirectTests.cs
  RoutePlannerObstacleTests.cs
  RoutePlannerFuelTests.cs
  RoutePlannerTargetValidationTests.cs
  RoutePlanDeterminismTests.cs
  AutopilotExecutorArrivalTests.cs
  AutopilotExecutorNoReplanTests.cs
  GravityCandidateResearchTests.cs
```

### Test-Fixtures

```text
TestShipFactory
  LightScout()
  HeavyCargo()
  LowRcsAuthority()
  NoRcsAuthority()
  HighFuelLowThrust()
  LowFuelHighThrust()

TestWorldFactory
  EmptyLocalSpace()
  SinglePlanet()
  MoonWithNoGoRadius()
  AsteroidField()
  StaticStationCorridor()
  MovingObstacleCrossing()
```

### Pflichtfälle

```text
Direct_100m_NoObstacle_CompletesExact
Direct_500m_LateralVelocity_CompletesExact
Direct_2400m_OffAxisRotation_CompletesExact
TargetInsidePlanet_RejectedBeforePlan
TargetInsideAtmosphereNoGo_RejectedBeforePlan
ObstacleCorridor_CreatesClearanceRoute
ObstacleCorridor_NoLiveReplanDuringExecution
LowFuel_FuelSaverBeatsFastestWhenAllowed
Fastest_BeatsFuelSaverWhenUserChoosesFastest
NoRcsAuthority_DoesNotFalseComplete
PlanDeterminism_SameInputSamePlanHash
PlanSerialization_RoundTripPreservesHash
Execution_NoSilentReplan_WhenDiverged
Execution_ReturnsPlanInvalidated_WhenUnexpectedObstacleAppears
```

### Evaluierte Metriken

```text
finalPositionErrorMeters
finalRelativeSpeedMetersPerSecond
finalAngularSpeedRadiansPerSecond
fuelUsedKg
deltaVUsed
durationSeconds
minimumObstacleClearanceMeters
candidateCount
selectedCandidate
planHash
replanCountMustBeZero
failureReason
```

## Ebene 2: Unity TestRange Scene

### Scene

```text
Assets/_Weltraum/Scenes/TestRanges/AutopilotTestRange.unity
```

### Enthaltene Objekte

```text
AutopilotTestRangeRoot
  TestHarnessRunner
  ScenarioSpawner
  EvidenceRecorder
  AutopilotGizmoRenderer
  TelemetryOverlay
  CameraRig
  ScenarioCatalog
  PhysicsSettingsOverride
```

### Runner-Modi

```text
HeadlessBatch
  Für CI, MCP, Unity -batchmode.

InteractivePlayback
  Für Editor-Inspektion mit Pause/Step/Speed.

VisualDebug
  Route, Korridor, Hindernisse, Ziel-Envelope, Velocity, Brake Window,
  candidate scores, PlanHash sichtbar.

RegressionReplay
  Lädt JSON/CSV eines früheren Fehlschlags und reproduziert ihn.
```

## Evidence-Format

```text
.devtoolbox/specs/changes/<change>/tests/
  autopilot-v2-summary.json
  test-protocol.md
  performance/
    <scenario>.csv
  screenshots/
    <scenario>-start.png
    <scenario>-route.png
    <scenario>-final.png
  failures/
    <scenario>-failure.json
```

### Summary JSON

```json
{
  "change": "autopilot-v2-core",
  "generatedUtc": "...",
  "unityVersion": "...",
  "planVersion": "v2",
  "scenarios": [
    {
      "name": "Direct_500m_LateralVelocity",
      "classification": "PASS",
      "planHash": "...",
      "selectedCandidate": "DirectLocal",
      "finalDistance": 0.31,
      "finalRelativeSpeed": 0.04,
      "minimumObstacleClearance": null,
      "fuelUsed": 1.72,
      "safetyInvalidations": 0,
      "silentReplans": 0
    }
  ]
}
```

## MCP-/CI-Ablauf

```text
1. Unity öffnen oder via CI starten.
2. Scene AutopilotTestRange laden.
3. run_tests PlayMode category: AutopilotV2.
4. read_console auf Errors.
5. Evidence files prüfen.
6. Optional Screenshot Matrix erzeugen.
7. DevToolbox verify_run oder specs_validate ausführen.
8. Task erst nach Completion Preflight schließen.
```

## Unity-Harness-Akzeptanzkriterien

```text
- Harness läuft ohne manuelles Klicken.
- Harness löscht Testobjekte vor/nach jedem Szenario.
- Scenarios sind datengetrieben.
- Kein Szenario verwendet magische Scene-Referenzen ohne Validierung.
- CSV/JSON wird auch bei Failures geschrieben.
- Failures sind reproduzierbar: ScenarioSeed + PlanHash + EnvironmentSnapshot.
- Die Scene ist für Menschen lesbar: Route/Korridor/Ziel/Status sichtbar.
```

## Migration aus aktuellem Proving Ground

Der bestehende Proving-Ground-Harness ist wertvoll und wird nicht gelöscht.

Migrationsweg:

```text
Phase 1: aktuelle Szenarien als V2-Szenario-DTOs nachbauen.
Phase 2: aktuelle Gates exakt übernehmen.
Phase 3: zusätzlich PlanHash, no-silent-replan, fuel scoring und timewarp gates.
Phase 4: Legacy-Harness nur noch als Regression-Referenz nutzen.
```

## Neue spezielle Szenarien

```text
FastestVsFuelSaver_EmptySpace
  Beide Pläne gültig, Auswahl hängt am User-Modus.

FuelSaver_HeavyCargo
  Cargo-Mass erhöht Brake/Fuel-Anforderungen.

PlanetNoGo_TargetRejected
  UI kann Ziel nicht setzen, Planner bekommt keine ungültige Route.

MovingObstacle_PredictedCrossing
  Route nimmt prognostizierte Bewegung in Plan auf.

UnexpectedObstacle_AbortNoReplan
  Während Execution taucht neues Objekt auf; PlanInvalidated, kein stilles Replan.

Timewarp_ExecuteLockedPlan
  Großer Step simuliert denselben Plan wie kleine Steps innerhalb Toleranz.

GravityCandidate_NotChosenWhenRisky
  Slingshot-Kandidat existiert, aber Direct/Balanced gewinnt.

GravityCandidate_ChosenWhenBeneficial
  Nur im Research-Harness; zeigt Score- und Safety-Grund.
```
