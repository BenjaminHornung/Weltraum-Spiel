# 02 - Autopilot V2 Design

## Zielbild

Der Autopilot navigiert ein Schiff von einem Startzustand zu einem Zielpunkt,
der später in UI/Map/Navigation Computer gesetzt wird. Er muss Hindernisse,
Planeten, Monde, Bauwerke, Asteroiden, Fuel, Schiffsautorität, Gravitation und
später Timewarp beachten.

Zentrale Regel:

```text
Plan first, then execute locked plan.
Kein stilles Replan während der Ausführung.
```

Wenn der Plan während der Ausführung ungültig wird, wird nicht heimlich neu
geplant. Der Executor geht in einen sichtbaren Zustand:

```text
PlanInvalidated
NeedsNewPlan
EmergencyAbort
LimitedAuthority
NoAuthority
FuelInsufficient
UnsafeTarget
```

## Warum neu bauen?

Der vorhandene Autopilot enthält wertvolle Erkenntnisse und Tests, aber zu viele
Verantwortlichkeiten in einem prototypischen MonoBehaviour:

```text
Target-Auswahl
Plan-Erstellung
Plan-Ausführung
Legacy-Fallbacks
RCS/Main-Throttle Requests
Obstacle-Reacquire
Terminal Capture
Debug Diagnostics
UI-readable Labels
Test-Seams
```

V2 trennt diese Verantwortlichkeiten.

## Kernmodule

```text
NavigationTargetService
  Nimmt UI-/Map-/World-Ziele entgegen.
  Validiert, ob aus einem Marker ein exakter TargetDescriptor werden kann.

NavigationEnvironmentSnapshot
  Statische und prognostizierte Umgebung zum Planungszeitpunkt:
  Planeten, Monde, Asteroiden, Bauwerke, Sperrzonen, bewegte Hindernisse,
  Gravitation, atmosphärische No-Go-Zonen, Floating-Origin-Frame.

RoutePlanner
  Erzeugt mehrere RouteCandidate-Objekte.

RouteScorer
  Bewertet Kandidaten nach Modus:
  Fastest, FuelSaver, Balanced, SafeDebug.

RouteValidator
  Prüft harte Gates:
  Ziel nicht im Planeten, Clearance, Fuel Reserve, Brake Reserve,
  RCS/Thruster Authority, Timewarp-Stabilität, keine verbotenen Zonen.

RoutePlan
  Immutable Plan mit Segmenten, Zeitachse, Zielzustand, Sicherheitskorridor,
  Fuel-/Risk-/ETA-Angaben und PlanHash.

AutopilotExecutor
  Führt exakt diesen Plan aus.
  Erzeugt AutopilotCommand pro FixedStep.
  Darf nicht still replanen.

AutopilotSupervisor
  Beobachtet Divergenz, Safety, Fuel, Planzeit, Timewarp.
  Darf aborten oder PlanInvalidated melden, aber nicht die Route ändern.

AutopilotTelemetry
  Eine UI- und Test-freundliche Wahrheit:
  State, Segment, ETA, Fuel, Error, Warnings, reason codes, candidate scores.
```

## Datenverträge

```csharp
public readonly struct AutopilotRequest
{
    public AbsoluteState Start;
    public TargetDescriptor Target;
    public RouteOptimizationMode OptimizationMode; // Fastest, FuelSaver, Balanced
    public ShipAuthoritySnapshot ShipAuthority;
    public FuelPolicy FuelPolicy;
    public TimewarpPolicy TimewarpPolicy;
    public SafetyPolicy SafetyPolicy;
}

public readonly struct TargetDescriptor
{
    public TargetKind Kind; // Waypoint, LandingTargetPoint, DockingPort, OrbitPoint, CargoPort
    public FrameId Frame;
    public Vector3d Position;
    public Vector3d? DesiredVelocity;
    public QuaternionD? DesiredAttitude;
    public ArrivalEnvelope Envelope;
    public TargetSafetyMetadata Safety;
}

public readonly struct ArrivalEnvelope
{
    public double MaxPositionErrorMeters;
    public double MaxRelativeSpeedMetersPerSecond;
    public double MaxAngularSpeedRadiansPerSecond;
    public double HoldDurationSeconds;
}
```

## Planungsphasen

```text
1. Target Resolve
   Marker/Map/World selection -> TargetDescriptor.
   Eine Zone ist kein Ziel. Eine LandingZone muss einen LandingTargetPoint liefern.

2. Target Safety Validation
   Nicht innerhalb von Planet/Mond/Asteroid/Atmosphären-No-Go.
   Nicht in Bauwerk, nicht in Sperrzone, nicht außerhalb erlaubter Frames.

3. Environment Snapshot
   Statische Hindernisse und bewegte Objekte werden für die Planzeit eingefroren
   oder mit prognostizierten Trajektorien aufgenommen.

4. Candidate Generation
   - DirectLocal
   - ObstacleAvoidanceLocal
   - LowFuelCoast
   - GravityAssistedCandidate später
   - SurfaceApproach später
   - DockingApproach später

5. Candidate Simulation
   Jeder Kandidat wird mit diskreten Samples und Korridorprüfung simuliert.

6. Hard Validation
   Clearance, Fuel, Authority, Brake Reserve, Timewarp determinism.

7. Scoring
   Fastest: Dauer hoch gewichten.
   FuelSaver: Δv/Fuel hoch gewichten.
   Balanced: Dauer, Fuel, Risiko, Lesbarkeit.
   DebugSafe: Risiko/Einfachheit hoch gewichten.

8. Plan Lock
   Der beste Kandidat wird als immutable RoutePlan gespeichert.
   PlanHash und PlanRevision werden in Telemetry/Evidence sichtbar.

9. Execution
   Executor folgt Segmenten.
   Kein Live-Replan.
```

## RouteSegment-Typen

```text
Orient
Burn
Coast
Brake
AvoidanceArc
ReacquireLine
TerminalCapture
Hold
GravityCoast            // später
GravityAssistFlyby      // später, nur wenn als Kandidat sinnvoll
SurfaceApproach         // später
DockingAlign            // später
```

## Hindernisvermeidung

Hindernisse werden nicht als Ad-hoc-Raycast im Executor behandelt, sondern als
Planungsdaten.

```text
ObstacleSnapshot:
  id
  shape: Sphere, Capsule, Box, MeshApproximation, CorridorVolume
  position/velocity prediction
  hardRadius
  clearanceRadius
  hazardType
  confidence
```

Planeten/Mondkörper verwenden mindestens:

```text
solidBodyRadius
atmosphereNoGoRadius
gravityInfluenceRadius
safeApproachAltitude
terrainUncertaintyMargin
```

Bauwerke/Stationen verwenden bevorzugt vereinfachte Volumes und DockingPorts.
Asteroiden verwenden Sphere/Capsule/Convex approximations.

## Gravitation und Slingshot

Nicht in V2-Minimum direkt produktiv erzwingen. Stattdessen als eigener
Planner-Mode und Research-Harness.

Regel:

```text
Slingshot ist ein Kandidat, keine Pflichtregel.
```

Ein GravityAssist-Kandidat darf nur gewählt werden, wenn:

```text
- harte Safety-Gates erfüllt sind,
- Ziel-ETA oder Fuel signifikant besser ist,
- Flyby-Clearance stabil ist,
- Planzeit im Timewarp deterministisch bleibt,
- UI den Grund erklären kann,
- Risiko unter Profilgrenze bleibt.
```

Für erste Implementierung:

```text
Phase A: Local inertial planner ohne Gravitation.
Phase B: Gravitation als Störkraft im Simulator/Harness, aber nicht optimierend.
Phase C: Patched-conics/SoI-Research nur im Harness.
Phase D: GravityAssistCandidate in Planner, erst nach Score-basierter Validation.
```

## Timewarp-Regel

Der Autopilot muss timewarp-fähig geplant werden:

```text
- RoutePlan enthält Zeitachse.
- ExecutionCursor hängt an planElapsedTime, nicht an Frame-Zufall.
- Executor kann mit größeren Zeitschritten simulieren, solange numerische
  Stabilitätsgrenzen eingehalten werden.
- Dynamische Hindernisse müssen als Vorhersage im Plan enthalten sein.
- Unvorhersehbare neue Hindernisse invalidieren den Plan, sie erzeugen kein
  stilles Replan während Warp.
```

## Zustandsmaschine

```text
Idle
TargetSelected
Planning
PlanReady
Executing
  Orient
  Burn
  Coast
  Brake
  Avoidance
  Reacquire
  TerminalCapture
  Hold
Complete
PlanInvalidated
Aborted
Failed
FuelInsufficient
LimitedAuthority
NoAuthority
UnsafeTarget
```

## Completion-Gates

Ein Ziel gilt nur als erreicht, wenn alle Gates über die Hold-Dauer erfüllt sind:

```text
position error <= envelope.position
relative speed <= envelope.speed
angular speed <= envelope.angular
state stable for holdDuration
no active collision/safety violation
executor segment == TerminalCapture or Hold
```

## UI-Status

Der Autopilot gibt keine UI-Strings als Hauptvertrag aus, sondern Codes:

```text
AutopilotState
NavigationPhase
ActiveSegmentKind
TargetKind
OptimizationMode
RouteRiskLevel
FailureReasonCode
WarningCode[]
PlanHash
CandidateSummary[]
```

UI übersetzt Codes in Spielertexte.

## Nicht-Ziele von V2-Minimum

```text
- keine perfekte Orbitalmechanik im ersten V2-Schritt
- keine automatische Landung auf Terrain
- kein Docking-Lock
- kein Multiplayer
- keine prozedurale Planetenroutenoptimierung
- kein Live-Replan im Executor
```

## Definition of Done für V2-Core

```text
- Pure planner tests grün.
- Determinismus: gleicher Input -> gleicher PlanHash.
- Direct, obstacle, fuel, invalid target und no-authority Fälle abgedeckt.
- Executor erreicht Ziel innerhalb Envelope ohne stilles Replan.
- Unity TestRange erzeugt CSV/JSON/Screenshot Evidence.
- UI kann PlanReady, Executing, Invalidated, Complete und Failure erklären.
```
