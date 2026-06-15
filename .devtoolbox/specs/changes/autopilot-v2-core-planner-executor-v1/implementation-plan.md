# ExecPlan: Autopilot V2 Core Planner Executor v1

> Status: **Planungsdokument** — keine Runtime-Änderungen, kein Prototyp-Code,
> keine Szenen/Prefabs, keine Tests implementiert. Dieses Dokument definiert den
> Contract Map und Implementierungspfad für die V2-Core Phase.

Stand: 2026-06-15

---

## Ziel

Am Ende der Implementierung existiert unter `Assets/_Weltraum/` ein Autopilot
V2-Core mit getrennter Planner/Plan/Executor/Diagnostics-Architektur:

- Der Planner erzeugt deterministische RoutePlan-Objekte mit PlanHash.
- Der Executor führt einen gelockten Plan aus, ohne stilles Replan.
- Invalidation ist explizit und sichtbar (`PlanInvalidated`, `NeedsNewPlan`).
- Alle DTOs sind immutable und testenbar ohne MonoBehaviour/Scene.
- Pure EditMode-Tests decken Planung, Determinismus, Ablehnungsfälle und
  Executor-Invarianten ab.

## Kontext

### Architektur-Docs

| Dokument | Relevante Abschnitte |
|---|---|
| `docs/architecture/autopilot-v2-design.md` L1-90 | Kernmodule, Zustandsmaschine |
| `docs/architecture/autopilot-v2-design.md` L92-124 | TargetDescriptor, ArrivalEnvelope |
| `docs/architecture/autopilot-v2-design.md` L126-168 | Planungsphasen 1-9 |
| `docs/architecture/autopilot-v2-design.md` L187-215 | ObstacleSnapshot-Form |
| `docs/architecture/autopilot-v2-design.md` L247-259 | Timewarp-Regel |
| `docs/architecture/autopilot-v2-design.md` L261-298 | Zustandsmaschine, Completion Gates |
| `docs/architecture/autopilot-v2-design.md` L330-339 | DoD V2-Core |
| `docs/architecture/autopilot-v2-test-harness.md` L15-25 | Testpfade |
| `docs/architecture/autopilot-v2-test-harness.md` L47-64 | Pflichtfälle |
| `docs/architecture/autopilot-v2-test-harness.md` L66-81 | Evaluierte Metriken |
| `docs/architecture/autopilot-v2-test-harness.md` L122-136 | Evidence-Format |
| `docs/architecture/autopilot-v2-test-harness.md` L188-199 | Migration aus Proving Ground |

### Prototype-Referenzdateien (nur Konzepte, keine 1:1-Namenskopie)

```text
Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs
Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs
Assets/Scripts/Prototype/PrototypeFlightPlan.cs
Assets/Scripts/Prototype/PrototypeObstacleDetector.cs
Assets/Scripts/Prototype/PrototypeNavigationObstacle.cs
Assets/Scripts/Prototype/TrajectoryPredictor.cs
Assets/Scripts/Prototype/TrajectoryPredictionState.cs
Assets/Scripts/Prototype/TrajectoryBurnPlan.cs
Assets/Scripts/Prototype/PrototypeTrajectoryPreviewNavMap.cs
Assets/Scripts/Prototype/TrajectoryPreviewDebugGizmo.cs
```

### Bestehende Vergleichstests (als Baseline wiederverwendbar)

```text
PrototypeFlightPlanValidationTests.cs
TrajectoryPreviewPredictionTests.cs
PrototypeWaypointAutopilotObstacleReplanStabilityTests.cs
PrototypeAutopilotProvingGroundPlayModeTests.cs
PrototypeAutopilotNavigationPlayModeTests.cs
```

### Exact-Arrival-Baseline (fix-autopilot-exact-point-arrival-v1)

| Szenario | Distanz (m) | Status |
|---|---|---|
| Direct_Short_100m_NoObstacle | 0.243416 | PASS |
| Direct_Medium_500m_NoObstacle | 0.240253 | PASS |
| Direct_Long_2400m_NoObstacle | 0.227089 | PASS |
| LateralVelocity_500m_NoObstacle | 0.515857 | PASS |
| OffAxisRotation_500m_NoObstacle | 0.485552 | PASS |
| ObstacleCorridor_500m_Reacquire | 0.504097 (85.49461m Clearance) | PASS |
| NearTarget_Overshoot_InitialVelocity | 0.515906 | PASS |
| LowRcsAuthority_TerminalCorrection | 0.202228 | PASS |
| NoRcsAuthority_Negative_NoFalseComplete | Failed / kein False Complete | PASS |

### Regelwerke

- `AGENTS.md`: Spec-first, klein, verifizierbar, Evidence-Gates.
- `.agent/PLANS.md`: ExecPlan-Pflichtstruktur (Ziel, Kontext, Nicht-Ziele, ...).

## Nicht-Ziele

- **Keine** Runtime-Implementierung in diesem Slice.
- **Keine** Änderung an `Assets/Scripts/Prototype/*`.
- **Keine** Szenen-, Prefab- oder Asset-Änderungen.
- **Keine** MonoBehaviour-Bindung in V2-Core-DTOs oder Services.
- **Kein** Gravitation/Slingshot-Planner (nur Research-Harness später).
- **Kein** Surface Landing, Docking Lock, Multiplayer.
- **Kein** Live-Replan im Executor.
- **Keine** 1:1-Namenskopie aus Prototype (`Prototype*`, `DirectFastTransfer`,
  `ReplanNow`, Safety-Replan-Counter, UI-Labels als Verträge).

## Architekturentscheidung

### Namespace-Struktur und Zielpfade

```
Assets/_Weltraum/Runtime/
  Navigation/
    TargetDescriptor.cs                    # Weltraum.Navigation
    ArrivalEnvelope.cs                     # Weltraum.Navigation
    RoutePlan.cs                           # Weltraum.Navigation
    RouteSegment.cs                        # Weltraum.Navigation
    RouteCandidate.cs                      # Weltraum.Navigation
    RouteScore.cs                          # Weltraum.Navigation
    NavigationEnvironmentSnapshot.cs       # Weltraum.Navigation
    ShipAuthoritySnapshot.cs               # Weltraum.Navigation
    ObstacleSnapshot.cs                    # Weltraum.Navigation
    PlanInvalidationReason.cs              # Weltraum.Navigation
  Flight/
    FuelBudget.cs                          # Weltraum.Flight
    BrakeReserve.cs                        # Weltraum.Flight
  Navigation/Planning/
    IRoutePlanner.cs                       # Weltraum.Navigation.Planning
    DirectLocalPlanner.cs                  # Weltraum.Navigation.Planning
    ObstacleAvoidancePlanner.cs            # Weltraum.Navigation.Planning
    FuelAuthorityValidator.cs             # Weltraum.Navigation.Planning
    RouteScorer.cs                         # Weltraum.Navigation.Planning
    RouteValidator.cs                      # Weltraum.Navigation.Planning
    PlanHashService.cs                     # Weltraum.Navigation.Planning
  Navigation/Execution/
    IAutopilotExecutor.cs                  # Weltraum.Navigation.Execution
    AutopilotExecutor.cs                   # Weltraum.Navigation.Execution
    AutopilotSupervisor.cs                 # Weltraum.Navigation.Execution
  Navigation/Diagnostics/
    IAutopilotTelemetryProvider.cs         # Weltraum.Navigation.Diagnostics
    AutopilotTelemetryRecorder.cs          # Weltraum.Navigation.Diagnostics
  Simulation/
    ISimulationClock.cs                    # Weltraum.Simulation
    FixedStepSimulationClock.cs            # Weltraum.Simulation

Assets/_Weltraum/Tests/EditMode/
  Navigation/
    TargetDescriptorTests.cs
    ArrivalEnvelopeTests.cs
    RoutePlanTests.cs
    RouteSegmentTests.cs
    RouteCandidateTests.cs
    RouteScoreTests.cs
    NavigationEnvironmentSnapshotTests.cs
    ShipAuthoritySnapshotTests.cs
    ObstacleSnapshotTests.cs
    PlanInvalidationReasonTests.cs
  Flight/
    FuelBudgetTests.cs
    BrakeReserveTests.cs
  Navigation/Execution/
    AutopilotExecutionStateTests.cs
  Navigation/Diagnostics/
    AutopilotTelemetryTests.cs
  Navigation/Planning/
    DirectLocalPlannerTests.cs
    ObstacleAvoidancePlannerTests.cs
    FuelAuthorityValidatorTests.cs
    RouteScorerTests.cs
    RouteValidatorTests.cs
    PlanHashServiceTests.cs
    PlanDeterminismTests.cs
  Navigation/Execution/
    AutopilotExecutorNoReplanTests.cs
    AutopilotExecutorInvalidationTests.cs
    AutopilotSupervisorTests.cs
  Navigation/Diagnostics/
    AutopilotTelemetryRecorderTests.cs
```

### DTO Contract Map

#### TargetDescriptor

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/TargetDescriptor.cs` |
| Typ | `readonly struct` (immutable, value-type) |
| Besitzer | Planner-Eingang; wird von `NavigationTargetService` erzeugt |
| Felder | `TargetKind Kind`, `FrameId Frame`, `Vector3d Position`, `Vector3d? DesiredVelocity`, `QuaternionD? DesiredAttitude`, `ArrivalEnvelope Envelope`, `TargetSafetyMetadata Safety` |
| Invarianten | Position darf nicht NaN/Infinity sein; Frame muss bekannt sein; Envelope-Werte >= 0; `DesiredVelocity` ist null-bare, null bedeutet „keine Geschwindigkeitsvorgabe" |
| Produzenten | `NavigationTargetService` (zukünftig), Test-Fixtures |
| Konsumenten | `DirectLocalPlanner`, `ObstacleAvoidancePlanner`, `RouteValidator` |
| Tests | `TargetDescriptorTests`: Konstruktion, Default-Werte, NaN-Rejektion, Envelope-Gültigkeit, Equality-Semantik |

#### ArrivalEnvelope

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/ArrivalEnvelope.cs` |
| Typ | `readonly struct` |
| Besitzer | Komponente von TargetDescriptor |
| Felder | `double MaxPositionErrorMeters`, `double MaxRelativeSpeedMetersPerSecond`, `double MaxAngularSpeedRadiansPerSecond`, `double HoldDurationSeconds` |
| Invarianten | Alle Werte >= 0; MaxPositionError >= 0.01m (minimale Envelope); HoldDuration >= 0 |
| Produzenten | TargetDescriptor-Konstruktion, Test-Fixtures |
| Konsumenten | `RouteValidator`, `AutopilotSupervisor` (Completion Gate) |
| Tests | `ArrivalEnvelopeTests`: Konstruktion, Negativwert-Rejektion, Default-Werte, Equality |

#### RoutePlan

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/RoutePlan.cs` |
| Typ | `class`, immutable nach Konstruktion (Properties get-only) |
| Besitzer | Planner-Ausgang, Executor-Eingang |
| Felder | `IReadOnlyList<RouteSegment> Segments`, `string PlanHash`, `int PlanRevision`, `RouteCandidate SourceCandidate`, `double EstimatedDurationSeconds`, `double EstimatedFuelKg`, `double EstimatedDeltaV`, `RouteRiskLevel RiskLevel`, `double CreatedAtSimulationTimeSeconds` |
| Invarianten | Segments.Count >= 1; PlanHash ist nicht leer und deterministisch; PlanRevision >= 1; SourceCandidate != null |
| Produzenten | `DirectLocalPlanner`, `ObstacleAvoidancePlanner` (via RouteScorer-Auswahl) |
| Konsumenten | `AutopilotExecutor`, `AutopilotSupervisor`, `AutopilotTelemetryRecorder` |
| Tests | `RoutePlanTests`: Konstruktion, Hash-Nicht-Leer, Segments-Nicht-Leer, Immutable-Check |

#### RouteSegment

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/RouteSegment.cs` |
| Typ | `readonly struct` |
| Besitzer | Komponente von RoutePlan |
| Felder | `SegmentKind Kind`, `Vector3d StartPosition`, `Vector3d EndPosition`, `QuaternionD StartAttitude`, `QuaternionD EndAttitude`, `Vector3d StartVelocity`, `Vector3d EndVelocity`, `double DurationSeconds`, `double EstimatedFuelKg`, `double ClearanceMeters`, `int Index` |
| Invarianten | DurationSeconds > 0 (Ausnahme: Hold); ClearanceMeters >= 0; Index >= 0 und fortlaufend |
| Produzenten | Planner bei Kandidatenerzeugung |
| Konsumenten | `AutopilotExecutor` (Segment-Folge), `AutopilotTelemetryRecorder` |
| Tests | `RouteSegmentTests`: Konstruktion, SegmentKind-Gültigkeit, Duration >= 0, Equality |

#### RouteCandidate

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/RouteCandidate.cs` |
| Typ | `class`, immutable nach Konstruktion |
| Besitzer | Zwischenergebnis der Planung |
| Felder | `string CandidateName`, `IReadOnlyList<RouteSegment> Segments`, `RouteScore Score`, `double EstimatedDurationSeconds`, `double EstimatedFuelKg`, `double EstimatedDeltaV`, `double MinimumClearanceMeters`, `IReadOnlyList<string> ValidationWarnings` |
| Invarianten | CandidateName nicht leer; Segments.Count >= 1; Score ist gültig und vollständig berechnet |
| Produzenten | `DirectLocalPlanner`, `ObstacleAvoidancePlanner` |
| Konsumenten | `RouteScorer` (bewertet), `RouteValidator` (harte Gates) |
| Tests | `RouteCandidateTests`: Konstruktion, Score-Zugänglichkeit, Warnings-Liste |

#### RouteScore

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/RouteScore.cs` |
| Typ | `readonly struct` |
| Besitzer | Bewertungsresultat |
| Felder | `double DurationScore`, `double FuelScore`, `double RiskScore`, `double ClearanceScore`, `double CompositeScore`, `RouteOptimizationMode OptimizationMode` |
| Invarianten | Alle Scores in [0.0, 1.0] (0 = schlechtest, 1 = bestes); CompositeScore >= 0 |
| Produzenten | `RouteScorer` |
| Konsumenten | `RouteCandidate`, `AutopilotTelemetry` |
| Tests | `RouteScoreTests`: Bereichsprüfung, CompositeScore-Berechnung, Mode-Zuordnung |

#### NavigationEnvironmentSnapshot

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/NavigationEnvironmentSnapshot.cs` |
| Typ | `class`, immutable nach Konstruktion |
| Besitzer | Eingabedaten für Planner (eingefrorene Umgebung) |
| Felder | `FrameId ReferenceFrame`, `IReadOnlyList<ObstacleSnapshot> Obstacles`, `IReadOnlyList<ObstacleSnapshot> NoGoVolumes`, `double ReferenceTimestampSeconds`, `Vector3d Origin` |
| Invarianten | Obstacles und NoGoVolumes nie null (leere Liste erlaubt); ReferenceTimestamp >= 0; Planeten/Mondkörper/Atmosphären-No-Go werden in V1 als `ObstacleSnapshot`/`NoGoVolumes` modelliert, nicht als zusätzliches DTO |
| Produzenten | `NavigationTargetService` / `EnvironmentSnapshotProvider` (zukünftig) |
| Konsumenten | `DirectLocalPlanner`, `ObstacleAvoidancePlanner`, `RouteValidator` |
| Tests | `NavigationEnvironmentSnapshotTests`: Konstruktion, leere Listen, Frame-Gültigkeit |

#### ShipAuthoritySnapshot

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/ShipAuthoritySnapshot.cs` |
| Typ | `readonly struct` |
| Besitzer | Schiffszustand zum Planungszeitpunkt |
| Felder | `double MassKg`, `Vector3d Position`, `Vector3d Velocity`, `QuaternionD Attitude`, `Vector3d AngularVelocity`, `double MainThrustNewtons`, `double RcsThrustNewtons`, `double CurrentFuelKg`, `double MaxFuelKg`, `bool HasRcsAuthority`, `bool HasMainAuthority`, `AuthorityLevel AuthorityLevel` |
| Invarianten | MassKg > 0; Thrust-Werte >= 0; Fuel-Werte >= 0; MaxFuel >= CurrentFuel |
| Produzenten | Ship-State-Abfrage (zukünftig), Test-Fixtures |
| Konsumenten | `FuelAuthorityValidator`, `DirectLocalPlanner` |
| Tests | `ShipAuthoritySnapshotTests`: Authority-Flags, Fuel-Grenzen, Mass-Positivität |

#### ObstacleSnapshot

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/ObstacleSnapshot.cs` |
| Typ | `readonly struct` |
| Besitzer | Einzelnes Hindernis im Environment Snapshot |
| Felder | `string Id`, `ObstacleShape Shape`, `Vector3d Position`, `Vector3d Velocity`, `Vector3d PredictedPosition`, `double HardRadius`, `double ClearanceRadius`, `ObstacleHazardType HazardType`, `double Confidence` |
| Invarianten | HardRadius > 0; ClearanceRadius >= HardRadius; Confidence in [0.0, 1.0]; Shape ist Enum-Wert |
| Produzenten | `NavigationEnvironmentSnapshot`-Erstellung |
| Konsumenten | `ObstacleAvoidancePlanner`, `RouteValidator` |
| Tests | `ObstacleSnapshotTests`: Shape-Enum, Radius-Ordnung (Clearance >= Hard), Confidence-Bereich |

#### FuelBudget

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Flight` |
| Datei | `Assets/_Weltraum/Runtime/Flight/FuelBudget.cs` |
| Typ | `readonly struct` |
| Besitzer | Kraftstoffvorgabe für Planung |
| Felder | `double AvailableKg`, `double ReservedKg`, `double MinimumReserveKg` |
| Invarianten | AvailableKg >= ReservedKg + MinimumReserveKg; alle Werte >= 0 |
| Produzenten | ShipAuthoritySnapshot-Ableitung, Test-Fixtures |
| Konsumenten | `FuelAuthorityValidator`, `RouteScorer` |
| Tests | `FuelBudgetTests`: Reservierung nicht überschritten, Negativwert-Rejektion |

#### BrakeReserve

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Flight` |
| Datei | `Assets/_Weltraum/Runtime/Flight/BrakeReserve.cs` |
| Typ | `readonly struct` |
| Besitzer | Bremsreserve für Planung |
| Felder | `double DeltaVAvailable`, `double DeltaVRequired`, `double SafetyMargin` |
| Invarianten | DeltaVAvailable >= 0; DeltaVRequired >= 0; SafetyMargin >= 0; DeltaVAvailable >= DeltaVRequired + SafetyMargin (sonst Rejektion) |
| Produzenten | Berechnung aus ShipAuthoritySnapshot + RouteCandidate |
| Konsumenten | `RouteValidator`, `RouteScorer` |
| Tests | `BrakeReserveTests`: Sicherheitsmarge-Berechnung, Unterschreitung erkennt |

#### PlanInvalidationReason

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/PlanInvalidationReason.cs` |
| Typ | `enum` (oder readonly struct mit Code + Message) |
| Besitzer | Executor-Invalidierungsgrund |
| Werte | `None`, `ObstacleDetected`, `FuelExhausted`, `AuthorityLost`, `TargetMoved`, `TimewarpInstability`, `SupervisorAbort`, `ManualOverride`, `ShipDamaged`, `EnvironmentChanged` |
| Invarianten | `None` bedeutet „nicht invalidiert"; alle anderen Werte sind explizite Gründe |
| Produzenten | `AutopilotExecutor`, `AutopilotSupervisor` |
| Konsumenten | `AutopilotExecutionState`, `AutopilotTelemetryRecorder` |
| Tests | `PlanInvalidationReasonTests`: Enum-Vollständigkeit, `None`-Default |

#### AutopilotExecutionState

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation.Execution` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/Execution/AutopilotExecutionState.cs` |
| Typ | `readonly struct` |
| Besitzer | Zustand des Executors zu einem gegebenen Tick |
| Felder | `ExecutionPhase Phase`, `int CurrentSegmentIndex`, `double ElapsedTimeSeconds`, `double RemainingTimeSeconds`, `PlanInvalidationReason InvalidationReason`, `bool HasActivePlan`, `string ActivePlanHash` |
| Invarianten | Phase ist Enum; CurrentSegmentIndex >= -1 (-1 = kein Plan); HasActivePlan konsistent mit ActivePlanHash |
| Produzenten | `AutopilotExecutor` |
| Konsumenten | `AutopilotTelemetryRecorder`, UI-ViewModel (zukünftig) |
| Tests | `AutopilotExecutionStateTests`: Phasenübergänge, Invalidation-Setzung, Hash-Konsistenz |

#### AutopilotTelemetry

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation.Diagnostics` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/Diagnostics/AutopilotTelemetry.cs` |
| Typ | `class`, immutable Snapshot nach Tick |
| Besitzer | Diagnostik-Ausgang für UI und Tests |
| Felder | `AutopilotExecutionState ExecutionState`, `TargetDescriptor ActiveTarget`, `RouteScore SelectedCandidateScore`, `int CandidateCount`, `string ActivePlanHash`, `int ReplanCount`, `double FuelRemainingKg`, `double FuelUsedKg`, `double MinimumObstacleClearanceMeters`, `IReadOnlyList<string> Warnings`, `IReadOnlyList<string> Errors`, `PlanInvalidationReason? Invalidation` |
| Invarianten | Wenn HasActivePlan, dann ActivePlanHash nicht leer; FuelRemaining >= 0; `ReplanCount == 0` während gelockter Execution |
| Produzenten | `AutopilotTelemetryRecorder` |
| Konsumenten | UI (via ViewModel), Test-Harness |
| Tests | `AutopilotTelemetryTests`: Snapshot-Konstruktion, Plan-Hash-Übergabe, Fuel-Konsistenz |

### Planner Service Map

#### IRoutePlanner (Interface)

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation.Planning` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/Planning/IRoutePlanner.cs` |
| Methode | `IReadOnlyList<RouteCandidate> PlanCandidates(TargetDescriptor target, ShipAuthoritySnapshot ship, NavigationEnvironmentSnapshot environment, FuelBudget fuelBudget, RouteOptimizationMode optimizationMode)` |
| Verhalten | Erzeugt 0..N Kandidaten. Liefert leere Liste wenn kein Kandidat möglich. Darf niemals null zurückgeben. |
| Harte Ablehnung | Ziel im Planeten, Clearance-Verletzung, Fuel insufficient, No Authority → leere Liste (nicht Exception). |

#### DirectLocalPlanner

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation.Planning` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/Planning/DirectLocalPlanner.cs` |
| Input | `TargetDescriptor`, `ShipAuthoritySnapshot`, `NavigationEnvironmentSnapshot`, `FuelBudget`, `RouteOptimizationMode` |
| Output | 1 RouteCandidate (Orient → Burn → Coast → Brake → TerminalCapture) |
| Harte Ablehnung | Target im Hindernis, Clearance < HardRadius, Fuel nicht ausreichend für Brake, No Authority |
| Fehlerverhalten | Wirft nicht; liefert leere Liste bei harten Gates. |
| Tests | `DirectLocalPlannerTests`: Straight-Line, Lateral-Velocity, Off-Axis-Rotation, Target-in-Planet, No-Fuel, No-Authority |

#### ObstacleAvoidancePlanner

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation.Planning` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/Planning/ObstacleAvoidancePlanner.cs` |
| Input | `TargetDescriptor`, `ShipAuthoritySnapshot`, `NavigationEnvironmentSnapshot`, `FuelBudget`, `RouteOptimizationMode` |
| Output | 1..N RouteCandidate (mit AvoidanceArc-Segment) |
| Harte Ablehnung | Kein valides Avoidance-Manöver gefunden (Clearance- oder Fuel-Gate) → leere Liste |
| Fehlerverhalten | Wirft nicht; liefert leere Liste. |
| Tests | `ObstacleAvoidancePlannerTests`: Corridor-Clearance, No-Corridor-Found, Moving-Obstacle-Prediction, Fuel-Gate-Rejektion |

#### FuelAuthorityValidator

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation.Planning` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/Planning/FuelAuthorityValidator.cs` |
| Input | `RouteCandidate`, `ShipAuthoritySnapshot`, `FuelBudget` |
| Output | `ValidationResult` (Accepted / Rejected mit Grund) |
| Harte Ablehnung | Fuel < Required + Reserve; BrakeReserve unterschritten; No Authority für RCS- oder Main-Thruster |
| Fehlerverhalten | Returns `Rejected`, nie Exception. |
| Tests | `FuelAuthorityValidatorTests`: Sufficient-Fuel, Insufficient-Fuel, Brake-Reserve-Underschritten, No-Rcs-Accepted (manövrierbar), No-Main-Accepted (RCS-only), No-Authority-Rejected |

#### RouteScorer

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation.Planning` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/Planning/RouteScorer.cs` |
| Input | `IReadOnlyList<RouteCandidate>`, `RouteOptimizationMode` |
| Output | `RouteScore` pro Kandidat; Methode `SelectBest()` → `RouteCandidate` |
| Modi | `Fastest` (Duration hoch gewichtet), `FuelSaver` (DeltaV/Fuel hoch gewichtet), `Balanced` (gemischt) |
| Harte Ablehnung | Keine – Scorer bewertet nur; Validator lehnt hart ab |
| Tests | `RouteScorerTests`: Fastest-wählt-schnellsten, FuelSaver-wählt-sparsamsten, Balanced-Kompromiss, Leere-Liste → null |

#### RouteValidator

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation.Planning` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/Planning/RouteValidator.cs` |
| Input | `RouteCandidate`, `NavigationEnvironmentSnapshot`, `ShipAuthoritySnapshot` |
| Output | `ValidationResult` (Accepted / Rejected mit Grund + Detail) |
| Harte Gates | Target nicht in Planet/Atmosphäre-No-Go, Clearance >= HardRadius für alle Segmente, Fuel + Reserve ausreichend, BrakeReserve ausreichend, Authority für benötigte Manöver vorhanden, Timewarp-Stabilität |
| Fehlerverhalten | Returns `Rejected`, nie Exception. |
| Tests | `RouteValidatorTests`: All-Clear, Target-in-Planet, Clearance-Verletzung, Fuel-Insufficient, Brake-Insufficient, No-Authority, Timewarp-Instability |

#### PlanHashService

| Attribut | Wert |
|---|---|
| Namespace | `Weltraum.Navigation.Planning` |
| Datei | `Assets/_Weltraum/Runtime/Navigation/Planning/PlanHashService.cs` |
| Input | `RoutePlan` (oder serialisierbare Plan-Darstellung) |
| Output | `string` (deterministischer Hash, z.B. SHA256 hex) |
| Verhalten | Gleicher Plan → gleicher Hash. Unterschiedlicher Plan → anderer Hash. |
| Tests | `PlanHashServiceTests`: Same-Input-Same-Hash, Different-Input-Different-Hash, Empty-Plan-Rejektion, Round-Trip |

### Executor-Regeln

#### Locked Plan Execution

```text
1. Executor empfängt RoutePlan über SetPlan(RoutePlan plan).
2. Executor folgt Segments sequentiell von Index 0 bis Segments.Count-1.
3. Executor erzeugt AutopilotCommand pro FixedStep (oder SimStep).
4. Executor darf Segmente nicht überspringen, hinzufügen oder umsortieren.
5. Executor darf keine neuen RouteCandidates erzeugen oder bewerten.
```

#### No Silent Replan

```text
6. Wenn Divergenz erkannt wird (Position/Velocity außerhalb Plan-Korridor),
   meldet Executor PlanInvalidated, nie automatisches Replan.
7. Supervisor darf aborten oder invalidieren, aber nicht replanen.
8. replanCount in Telemetry muss immer 0 sein.
```

#### Explicit Invalidation

```text
9. Executor setzt AutopilotExecutionState.InvalidationReason auf konkreten Wert:
   ObstacleDetected | FuelExhausted | AuthorityLost | TargetMoved |
   TimewarpInstability | SupervisorAbort | ShipDamaged | EnvironmentChanged
10. Executor geht in ExecutionPhase.PlanInvalidated.
11. Telemetry zeigt Invalidierung mit Grund für UI und Tests.
```

#### Manual Override

```text
12. Externaler Aufruf von Abort() oder ClearPlan() setzt
    ExecutionPhase.Aborted bzw. ExecutionPhase.Idle.
13. PlanHash wird in Telemetry als "cleared" markiert.
```

#### Timewarp Readiness

```text
14. RoutePlan enthält Zeitachse (ElapsedTime pro Segment).
15. Executor hängt an planElapsedTime, nicht an Frame-Zufall.
16. Executor kann mit größeren Zeitschritten simulieren (konfigurierbares Max).
17. Dynamische Hindernisse müssen als Vorhersage im Plan enthalten sein.
18. Unvorhersehbare neue Hindernisse → PlanInvalidated (nicht stilles Replan).
```

#### Failure States

```text
ExecutionPhase:
  Idle → TargetSelected → Planning → PlanReady → Executing → Complete
                                                     ↓
                                               PlanInvalidated → NeedsNewPlan
                                                     ↓
                                                 Aborted / Failed
                                                     ↓
                                           FuelInsufficient / LimitedAuthority
                                                     ↓
                                               NoAuthority / UnsafeTarget

Alle Transitions sind explizit. Keine impliziten State-Changes.
```

## Implementierungsphasen

### Phase 1: DTO-Contracts

```text
1.1 TargetDescriptor, ArrivalEnvelope, TargetKind Enum anlegen.
1.2 RouteSegment, SegmentKind Enum anlegen.
1.3 RoutePlan, RouteCandidate, RouteScore anlegen.
1.4 RouteOptimizationMode Enum anlegen.
1.5 NavigationEnvironmentSnapshot, ObstacleSnapshot, ObstacleShape Enum anlegen.
1.6 ShipAuthoritySnapshot, AuthorityLevel Enum anlegen.
1.7 FuelBudget, BrakeReserve anlegen.
1.8 PlanInvalidationReason Enum anlegen.
1.9 AutopilotExecutionState, ExecutionPhase Enum anlegen.
1.10 AutopilotTelemetry anlegen.

Ergebnis: Alle 14 Pflicht-DTOs kompilieren, sind immutable, haben Tests.
```

### Phase 2: Planner-Services

```text
2.1 IRoutePlanner Interface anlegen.
2.2 DirectLocalPlanner implementieren (Straight-Line Planner).
2.3 ObstacleAvoidancePlanner implementieren (AvoidanceArc-Erzeugung).
2.4 FuelAuthorityValidator implementieren.
2.5 RouteScorer implementieren (Fastest/FuelSaver/Balanced).
2.6 RouteValidator implementieren (harte Gates).
2.7 PlanHashService implementieren.

Ergebnis: Planner erzeugt Kandidaten, bewertet, validiert, liefert RoutePlan.
Determinismus-Tests grün.
```

### Phase 3: Executor + Supervisor

```text
3.1 IAutopilotExecutor Interface anlegen.
3.2 AutopilotExecutor implementieren (Locked Plan Execution).
3.3 AutopilotSupervisor implementieren (Divergenz-Erkennung, Abort-Recht).
3.4 IAutopilotTelemetryProvider Interface anlegen.
3.5 AutopilotTelemetryRecorder implementieren.

Ergebnis: Executor folgt Plan, invalidiert explizit, replant nie still.
NoReplan-Tests grün.
```

### Phase 4: Simulation Clock

```text
4.1 ISimulationClock Interface anlegen.
4.2 FixedStepSimulationClock implementieren.

Ergebnis: Deterministische Simulation für Timewarp-Vorbereitung.
```

## Tests und Evidence

### Pure EditMode Testliste

| # | Test-Datei | Fälle | Priorität |
|---|---|---|---|
| 1 | `TargetDescriptorTests.cs` | Konstruktion, NaN/Infinity, Envelope-Gültigkeit, Equality | P0 |
| 2 | `ArrivalEnvelopeTests.cs` | Konstruktion, Negativwert, Default, Equality | P0 |
| 3 | `RoutePlanTests.cs` | Konstruktion, Hash-Nicht-Leer, Segments-Nicht-Leer, Immutable | P0 |
| 4 | `RouteSegmentTests.cs` | Konstruktion, SegmentKind, Duration >= 0, Equality | P0 |
| 5 | `RouteCandidateTests.cs` | Konstruktion, Score, Warnings | P0 |
| 6 | `RouteScoreTests.cs` | Bereichsprüfung, Composite, Mode | P0 |
| 7 | `NavigationEnvironmentSnapshotTests.cs` | Konstruktion, leere Listen, Frame | P0 |
| 8 | `ShipAuthoritySnapshotTests.cs` | Authority-Flags, Fuel-Grenzen, Mass-Positivität | P0 |
| 9 | `ObstacleSnapshotTests.cs` | Shape, Radius-Ordnung, Confidence | P0 |
| 10 | `FuelBudgetTests.cs` | Reservierung, Negativwert | P0 |
| 11 | `BrakeReserveTests.cs` | Sicherheitsmarge, Unterschreitung | P0 |
| 12 | `PlanInvalidationReasonTests.cs` | Enum-Vollständigkeit, None-Default | P0 |
| 13 | `AutopilotExecutionStateTests.cs` | Phasen, Invalidation, Hash-Konsistenz | P0 |
| 14 | `AutopilotTelemetryTests.cs` | Snapshot, Fuel-Konsistenz | P0 |
| 15 | `DirectLocalPlannerTests.cs` | Straight-Line, Lateral, Off-Axis, Target-in-Planet, No-Fuel, No-Authority | P0 |
| 16 | `ObstacleAvoidancePlannerTests.cs` | Corridor, No-Corridor, Moving-Obstacle, Fuel-Gate | P0 |
| 17 | `FuelAuthorityValidatorTests.cs` | Sufficient, Insufficient, Brake-Underschritten, No-Rcs, No-Main, No-Authority | P0 |
| 18 | `RouteScorerTests.cs` | Fastest, FuelSaver, Balanced, Leere-Liste | P1 |
| 19 | `RouteValidatorTests.cs` | All-Clear, Target-in-Planet, Clearance, Fuel, Brake, Authority, Timewarp | P0 |
| 20 | `PlanHashServiceTests.cs` | Same-Input, Different-Input, Empty-Rejektion | P0 |
| 21 | `PlanDeterminismTests.cs` | Same-Input-Same-PlanHash × 100 Iterationen | P0 |
| 22 | `AutopilotExecutorNoReplanTests.cs` | replanCount=0, Divergenz → Invalidated, kein stilles Replan | P0 |
| 23 | `AutopilotExecutorInvalidationTests.cs` | Alle PlanInvalidationReason-Werte erzeugen | P0 |
| 24 | `AutopilotSupervisorTests.cs` | Divergenz-Erkennung, Abort, keine Planänderung | P1 |
| 25 | `AutopilotTelemetryRecorderTests.cs` | Snapshot-Kette, Fuel-Verbrauch, Warnings | P1 |

### Required Evidence (nur für Implementierungsphase)

```text
- dotnet build "Weltraum Spiel.sln" --no-restore PASS
- dotnet test "Weltraum Spiel.sln" --no-build PASS
- Unity validate_script PASS für alle neuen .cs-Dateien
- EditMode-Tests: 25/25 (oder mehr) PASS
- PlanDeterminism: 100× gleicher Input → 100× gleicher PlanHash
- NoSilentReplan: replanCount == 0 in allen Executor-Tests
- specs_validate PASS für diese Change
```

## Migration

### Regel: Konzepte referenzieren, nicht 1:1 kopieren

```text
NICHT kopieren (Namensverbote):
  Prototype*, DirectFastTransfer, ReplanNow, safety replan counters,
  UI Labels als Datenverträge, MonoBehaviour-Abhängigkeiten in DTOs.

REFERENZIEREN (Konzept-Übernahme):
  - Arrival-Stabilität: terminal capture, brake/flip, hold duration
  - Obstacle-Clearance: corridor, hard radius, clearance radius
  - Authority: RCS vs Main, no-authority negative case
  - Proving-Ground-Akzeptanzgates: final distance, relative speed, clearance
  - Scoring-Modi: analog zu bestehendem Fastest/FuelSaver/Balanced
```

### Bestehende Vergleichstests als Baseline

```text
- PrototypeFlightPlanValidationTests → Konzept-Referenz für Plan-Validierung
- TrajectoryPreviewPredictionTests → Konzept-Referenz für Trajectory-Simulation
- PrototypeWaypointAutopilotObstacleReplanStabilityTests →
    NEGATIVBEISPIEL für stilles Replan (V2 darf dies NICHT tun)
- PrototypeAutopilotProvingGroundPlayModeTests →
    Baseline-Scenarios für V2 TestRange (Phase 2 Migration)
- PrototypeAutopilotNavigationPlayModeTests →
    Baseline-Scenarios für Navigation-Tests
```

### Migrationspfad (aus autopilot-v2-test-harness.md L188-199)

```text
Phase 1: Aktuelle Proving-Ground-Szenarien als V2-Szenario-DTOs nachbauen.
Phase 2: Aktuelle Gates exakt übernehmen (Arrival-Envelope, Clearance, Fuel).
Phase 3: Zusätzlich PlanHash, No-Silent-Replan, Fuel-Scoring, Timewarp-Gates.
Phase 4: Legacy-Harness nur noch als Regression-Referenz nutzen.
```

## Risiken

| Risiko | Eintrittswahrscheinlichkeit | Mitigation |
|---|---|---|
| DTO-Design zu früh fixiert, muss später erweitert werden | Mittel | readonly struct + additive Erweiterung; Breaking-Changes nur mit PlanHash-Versioning |
| PlanHash-Kollision bei gleichem Input | Niedrig | SHA256; PlanHash-Service testbar isoliert |
| Executor simuliert nicht genug Schritte für Arrival-Präzision | Mittel | Integration mit FixedStepSimulationClock; Arrival-Toleranz aus Envelope ableiten |
| Naming-Kollision mit Prototype-Namespace | Niedrig | Separate Namespace `Weltraum.Navigation.*` vs `Prototype.*` |
| Test-Fixtures sind zu stark an Prototype-Parametern gekoppelt | Mittel | TestShipFactory/TestWorldFactory abstrahieren; keine Prototype-Klassen importieren |

## Rollback / Safe Stop

```text
- Phase 1 (DTOs): Löschen der neuen Dateien unter Assets/_Weltraum/Runtime/Navigation/
  und Assets/_Weltraum/Runtime/Flight/. Kein Einfluss auf Prototype.
- Phase 2 (Planner): Löschen der Planner-Dateien. DTOs bleiben als reine
  Datenstrukturen bestehen.
- Phase 3 (Executor): Löschen der Executor-Dateien. Planner + DTOs bleiben.
- Jede Phase ist isoliert rollbackbar.
- Stop-Kriterium: Ein Test schlägt fehl und kann innerhalb von 30 Minuten nicht
  behoben werden → Phase pausieren, Fortschritt im Log dokumentieren.
```

## Fortschrittslog

- [ ] Phase 0: Planungsdokument erstellt (dieses Dokument)
- [ ] Phase 1: DTO-Contracts implementiert + Tests
- [ ] Phase 2: Planner-Services implementiert + Tests
- [ ] Phase 3: Executor + Supervisor implementiert + Tests
- [ ] Phase 4: Simulation Clock implementiert + Tests

## Definition of Done

```text
□ Alle 14 Pflicht-DTOs unter Assets/_Weltraum/Runtime/Navigation/ und Assets/_Weltraum/Runtime/Flight/ existieren und kompilieren.
□ Alle DTOs sind immutable (readonly struct oder immutable class).
□ Alle DTOs haben jeweilige EditMode-Tests (14 DTO-/Enum-Test-Dateien).
□ DirectLocalPlanner und ObstacleAvoidancePlanner existieren mit Tests.
□ FuelAuthorityValidator und RouteValidator existieren mit Tests.
□ RouteScorer unterstützt alle 3 Modi mit Tests.
□ PlanHashService liefert deterministische Hashes mit Tests.
□ AutopilotExecutor existiert mit Locked-Plan und No-Silent-Replan-Tests.
□ AutopilotSupervisor existiert mit Divergenz- und Abort-Tests.
□ AutopilotTelemetryRecorder existiert mit Snapshot-Tests.
□ PlanDeterminismTests: 100× gleicher Input → 100× gleicher PlanHash PASS.
□ replanCount == 0 in allen Executor-Tests.
□ dotnet build PASS.
□ dotnet test PASS.
□ Unity validate_script PASS für alle neuen Dateien.
□ specs_validate PASS für diese Change.
□ Kein Prototype-Code, keine Scene, kein Prefab wurde geändert.
```

## Runtime-Agent-Handoff-Checkliste

Für den Implementierungs-Agenten:

```text
□ implementation-plan.md gelesen und verstanden.
□ contract-map-test-protocol.md gelesen.
□ AGENTS.md gelesen.
□ .agent/PLANS.md gelesen.
□ docs/architecture/autopilot-v2-design.md gelesen.
□ Exact-Arrival-Baseline als Referenz-Target bekannt.
□ Namespace- und Pfadkonventionen aus diesem Plan übernehmen.
□ DTO-Contract-Map als Minimalanforderung akzeptiert.
□ Executor-Regeln (No Silent Replan, Locked Plan) als harte Anforderung akzeptiert.
□ Naming-Verbote (Prototype*, DirectFastTransfer, etc.) beachtet.
□ Alle neuen Dateien nur unter Assets/_Weltraum/.
□ Tests nur als pure EditMode unter Assets/_Weltraum/Tests/EditMode/.
```
