## Decision

Use a new authoritative `PrototypeFlightPlan` route model. The planner should produce that model, the HUD should display that model, and the runtime autopilot should execute that same model segment by segment. Do **not** make `PrototypeTrajectoryPlanner` itself directly command actuators every frame.

Uncertainty: the attached bundle contains the relevant autopilot, planner, HUD, physics, thruster, RCS, binder, and tests, but not enough scene/prefab evidence to prove the exact imported Blender/GLB GUI reproduction path by asset name. The architectural issue is clear from the code; the exact failing scene setup still needs to be captured in a PlayMode or Unity MCP regression.

## 1. Likely root architectural bug

The root bug is that the project currently has **two competing authorities**:

1. `PrototypeTrajectoryPlanner` computes diagnostic route data.
2. `PrototypeWaypointAutopilot.RunAutopilotStep()` still decides the actual maneuver live every physics tick.

That means the HUD can show something that looks like a planned route while the ship is actually controlled by a separate live heuristic state machine.

Concrete evidence from the attached code:

* `PrototypeTrajectoryPlanner` emits `PrototypeTrajectoryPlan` with segments, ETA, fuel, candidate scores, predicted path, and burn plan, but those segments are not treated as executable commands.
* `PrototypeWaypointAutopilot.RunAutopilotStep()` still decides accelerate, brake, flip, lateral correction, final approach, hold, and avoidance through live gates such as brake request, terminal capture, settle-after-brake, lateral correction, hold damping, and obstacle logic.
* `ApplyAutopilotRequest()`, `ApplyLateralCorrection()`, and `ApplyHoldDamping()` mutate `LastTrajectoryPlan` after runtime commands are chosen. That makes the “plan” partly post-hoc telemetry rather than a source of truth.
* `PrototypeTrajectoryPlanner.BuildSegments()` currently creates placeholder-style segments such as burn, coast, brake, final approach, and hold. The brake segment is based on the current snapshot rather than a fully simulated future burn/coast state.
* The planner uses simplified scalar acceleration and fuel estimates, while the imported GLB path can use real nozzle locations, gimbal behavior, spool rates, RCS socket layout, inertia tensor, and module mass descriptors.

So the likely failure mode is not “brake threshold is still wrong”. The more likely bug is:

> The preview/planner says one thing, but the runtime autopilot is still free to brake or flip early based on live heuristics that were never derived from the displayed route.

The existing PlayMode tests can pass because they test focused terminal/deadzone behavior under the current harness assumptions. They likely do not reproduce the imported-ship inertia, nozzle layout, gimbal/spool behavior, binder setup, HUD preview route, and player-facing execution path together.

## 2. Recommended authority model

Use this structure:

```text
Planner builds PrototypeFlightPlan
        ↓
HUD renders PrototypeFlightPlan
        ↓
Autopilot executor executes PrototypeFlightPlan
        ↓
Safety monitor may abort or request bounded replan
```

Do **not** make `PrototypeTrajectoryPlanner` itself the direct runtime command source.

Reason:

* A planner should be pure-ish, testable, and reproducible from a snapshot.
* An executor should own elapsed time, current segment, progress, command output, and segment transitions.
* A safety monitor should own abort and replan decisions.
* Mixing all three inside `PrototypeTrajectoryPlanner` would recreate the current problem in a different file.

Recommended split:

| Component                              | Responsibility                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `PrototypeTrajectoryPlanner`           | Generate candidate routes and return an executable `PrototypeFlightPlan` plus diagnostics. |
| `PrototypeFlightPlan`                  | Immutable-ish route contract used by preview, HUD, and executor.                           |
| `PrototypeFlightPlanExecutor`          | Execute one active segment at a time. No route sequencing guesses.                         |
| `PrototypeFlightPlanDivergenceMonitor` | Detect obstacle, target movement, actuator failure, fuel mismatch, or physics divergence.  |
| `PrototypeWaypointAutopilot`           | Orchestrate planner, executor, safety monitor, and legacy fallback during migration.       |
| `PrototypePlayerHud`                   | Render the same `PrototypeFlightPlan` that the executor is following.                      |

`PrototypeTrajectoryPlan` can remain temporarily as a compatibility/debug DTO, but it should no longer be treated as the runtime route contract.

## 3. Data model to introduce

Introduce a new model rather than overloading the existing diagnostic `PrototypeTrajectoryPlan`.

Suggested files:

```text
PrototypeFlightPlan.cs
PrototypeManeuverSegment.cs
PrototypeFlightPlanExecutionState.cs
PrototypeFlightPlanTolerance.cs
PrototypeShipPlanningSnapshot.cs
PrototypeFlightPlanAbortReplanReason.cs
PrototypeTrajectoryPredictedSample.cs
```

Suggested core shape:

```csharp
public enum PrototypeManeuverPhase
{
    None,
    AlignForBurn,
    ProgradeBurn,
    Coast,
    FlipToRetrograde,
    RetrogradeBurn,
    LateralCorrection,
    AvoidanceBurn,
    ReacquireRoute,
    FinalApproach,
    Hold,
    Abort
}

public enum PrototypeManeuverCommandMode
{
    None,
    AttitudeOnly,
    MainThrottle,
    RcsTranslation,
    RcsAttitude,
    CombinedMainAndRcs
}

[Flags]
public enum PrototypeFlightPlanAbortReplanReason
{
    None = 0,
    ManualOverride = 1 << 0,
    MissingDependency = 1 << 1,
    NonFiniteState = 1 << 2,
    TargetMoved = 1 << 3,
    ObstacleDetected = 1 << 4,
    CollisionPredicted = 1 << 5,
    PositionDivergence = 1 << 6,
    VelocityDivergence = 1 << 7,
    AttitudeDivergence = 1 << 8,
    TimeSlip = 1 << 9,
    FuelMismatch = 1 << 10,
    FuelStarved = 1 << 11,
    ActuatorLimited = 1 << 12,
    RcsAllocatorResidual = 1 << 13,
    NoMainThrustAuthority = 1 << 14,
    NoRcsAuthority = 1 << 15,
    PlanExpired = 1 << 16
}

public readonly struct PrototypeFlightPlan
{
    public readonly string PlanId;
    public readonly int Revision;
    public readonly double CreatedAtTimeSeconds;
    public readonly float FixedDeltaTimeSeconds;

    public readonly Vector3 TargetPositionWorld;
    public readonly float TargetArrivalRadiusMeters;
    public readonly float TargetArrivalSpeedMetersPerSecond;

    public readonly PrototypeShipPlanningSnapshot ShipSnapshot;

    public readonly IReadOnlyList<PrototypeManeuverSegment> Segments;
    public readonly IReadOnlyList<PrototypeTrajectoryPredictedSample> PredictedSamples;

    public readonly float TotalDurationSeconds;
    public readonly float TotalMainBurnSeconds;
    public readonly float TotalRcsBurnSeconds;
    public readonly float TotalExpectedDeltaV;
    public readonly float TotalExpectedFuelKg;
    public readonly float ExpectedRemainingFuelKg;

    public readonly bool IsExecutable;
    public readonly PrototypeFlightPlanAbortReplanReason NonExecutableReasons;
    public readonly string StatusLabel;
}

public readonly struct PrototypeManeuverSegment
{
    public readonly int Index;
    public readonly PrototypeManeuverPhase Phase;
    public readonly PrototypeManeuverCommandMode CommandMode;

    public readonly float StartTimeSeconds;
    public readonly float EndTimeSeconds;
    public readonly float DurationSeconds;

    public readonly Vector3 BurnDirectionWorld;
    public readonly Vector3 ExpectedForwardWorld;
    public readonly Vector3 RcsForceWorld;
    public readonly Vector3 TargetAngularVelocityWorld;

    public readonly float MainThrottle;
    public readonly float ExpectedDeltaV;
    public readonly float ExpectedMainFuelKg;
    public readonly float ExpectedRcsFuelKg;

    public readonly Vector3 ExpectedStartPositionWorld;
    public readonly Vector3 ExpectedStartVelocityWorld;
    public readonly Quaternion ExpectedStartRotationWorld;
    public readonly Vector3 ExpectedStartAngularVelocityWorld;

    public readonly Vector3 ExpectedEndPositionWorld;
    public readonly Vector3 ExpectedEndVelocityWorld;
    public readonly Quaternion ExpectedEndRotationWorld;
    public readonly Vector3 ExpectedEndAngularVelocityWorld;

    public readonly PrototypeFlightPlanTolerance StartTolerance;
    public readonly PrototypeFlightPlanTolerance EndTolerance;

    public readonly PrototypeFlightPlanAbortReplanReason ReplanOn;
    public readonly string Reason;
}

public readonly struct PrototypeFlightPlanTolerance
{
    public readonly float PositionMeters;
    public readonly float VelocityMetersPerSecond;
    public readonly float AngleDegrees;
    public readonly float AngularSpeedRadPerSecond;
    public readonly float TimeSeconds;
    public readonly float FuelKg;
    public readonly float ObstacleClearanceMeters;
}

public readonly struct PrototypeTrajectoryPredictedSample
{
    public readonly float TimeSeconds;
    public readonly int SegmentIndex;
    public readonly PrototypeManeuverPhase Phase;

    public readonly Vector3 PositionWorld;
    public readonly Vector3 VelocityWorld;
    public readonly Quaternion RotationWorld;
    public readonly Vector3 AngularVelocityWorld;

    public readonly float RemainingFuelKg;
    public readonly float ExpectedMainThrottle;
    public readonly Vector3 ExpectedRcsForceWorld;
}

public readonly struct PrototypeFlightPlanExecutionState
{
    public readonly string PlanId;
    public readonly int PlanRevision;

    public readonly int ActiveSegmentIndex;
    public readonly PrototypeManeuverPhase ActivePhase;

    public readonly float ElapsedSeconds;
    public readonly float ActiveSegmentElapsedSeconds;
    public readonly float ActiveSegmentProgress01;

    public readonly Vector3 PositionErrorWorld;
    public readonly Vector3 VelocityErrorWorld;
    public readonly float AngleErrorDegrees;
    public readonly float AngularSpeedErrorRadPerSecond;
    public readonly float FuelErrorKg;

    public readonly bool RequiresReplan;
    public readonly PrototypeFlightPlanAbortReplanReason ActiveReasons;
}
```

`PrototypeShipPlanningSnapshot` should include the real inputs needed to reproduce the route:

```csharp
public readonly struct PrototypeShipPlanningSnapshot
{
    public readonly Vector3 PositionWorld;
    public readonly Vector3 VelocityWorld;
    public readonly Quaternion RotationWorld;
    public readonly Vector3 AngularVelocityWorld;

    public readonly Vector3 WorldCenterOfMass;
    public readonly float RigidbodyMassKg;
    public readonly Vector3 LocalCenterOfMass;
    public readonly Vector3 InertiaTensor;
    public readonly Quaternion InertiaTensorRotation;

    public readonly float CurrentFuelKg;
    public readonly float MaxFuelKg;
    public readonly float MainFuelKgPerSecond;
    public readonly float RcsFuelKgPerSecondEquivalent;

    public readonly float MainThrustNewton;
    public readonly float ReverseThrustMultiplier;

    public readonly IReadOnlyList<PrototypeMainThrusterPlanningNozzle> MainNozzles;
    public readonly IReadOnlyList<PrototypeRcsPlanningNozzle> RcsNozzles;

    public readonly bool UsesImportedFunctionalSockets;
    public readonly bool UsesPhysicalMainNozzleForces;
    public readonly bool UsesExperimentalPhysicalRcsNozzles;

    public readonly float MainThrottleSpoolUpRate;
    public readonly float MainThrottleSpoolDownRate;
    public readonly float MainGimbalLimitDegrees;
    public readonly float MainGimbalSlewRateDegreesPerSecond;

    public readonly float RcsTranslationForceNewton;
    public readonly float RcsAttitudeForceNewton;
    public readonly float RcsNozzleSpoolUpRate;
    public readonly float RcsNozzleSpoolDownRate;

    public readonly bool CentralGravityEnabled;
    public readonly bool AtmosphereEnabled;
}
```

The important point is not the exact names. The important point is that the route contract must contain absolute maneuver timing, expected states, tolerances, and explicit reasons for abort or replan.

## 4. How the planner should calculate with real ship data

The planner should stop relying on only scalar estimates such as “max acceleration”, “fuel rate”, and “current mass”. Those are useful as a first pass, but not enough for the imported Blender/GLB ship path.

### Sample these attached components

| Source                                               | Data to sample                                                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Rigidbody`                                          | Position, rotation, linear velocity, angular velocity, mass, world center of mass, local center of mass, inertia tensor, inertia tensor rotation.                |
| `ShipStats`                                          | Current fuel, max fuel, fuel kg/s, thrust, reverse thrust multiplier, current mass, recalculated mass properties.                                                |
| `ShipPhysicsCore`                                    | Central gravity acceleration, atmosphere/drag settings if enabled, force application semantics.                                                                  |
| `MainThrusterBank`                                   | Active thruster modules, aggregate thrust behavior, multiple nozzles.                                                                                            |
| `MainThrusterModule`                                 | Throttle scale, spool rates, thrust mode, physical nozzle force mode, gimbal support, gimbal limits, gimbal slew, thermal efficiency.                            |
| `RcsThrusterController`                              | Translation force, attitude force, solver mode, imported functional socket mode, nozzle snapshot, spool rates, allocator diagnostics, fuel consumption behavior. |
| `ModuleMassDescriptor` / `PrototypeModuleMassLayout` | Imported functional mass descriptors, dry/fuel mass, COM, inertia.                                                                                               |
| `PrototypeImportedShipBinder`                        | Whether imported sockets/nozzles/gimbals/RCS were actually bound, and how many were found.                                                                       |

### Runtime actuator effects that must be modeled before trusting the plan

At minimum:

1. **Main throttle spool**

   * The planned burn cannot assume instant full throttle if `MainThrusterModule` ramps throttle over time.

2. **Main gimbal slew**

   * If the real module slews gimbal direction gradually, the predicted thrust direction cannot jump instantly.

3. **Thermal efficiency**

   * If the real thrust is reduced by thermal state, the plan must either sample current efficiency or add a conservative derate.

4. **Fuel consumption and mass change**

   * Plan fuel must reduce available fuel and, if mass properties change with fuel, update expected mass.

5. **Physical nozzle force location**

   * In fully physical mode, force at nozzle position can create torque. The planner cannot treat all thrust as force at center of mass unless the runtime does.

6. **RCS torque and translation authority**

   * Imported functional sockets and physical nozzles can produce less clean translation/torque than the scalar `TranslationForce` estimate suggests.

7. **RCS allocator residual**

   * If `RcsThrusterController` cannot produce the requested force/torque exactly, the plan must know that and either derate authority or mark the route non-executable.

8. **Flip/alignment duration**

   * Flip timing should be based on current inertia, angular velocity, and RCS torque authority, not a fixed “brake flip” heuristic.

9. **Reverse/brake authority**

   * The planner must use the same deceleration authority as runtime. The current code has a mismatch risk because runtime uses `GetMaxDeceleration()` with `ReverseThrustMultiplier`, while planner estimates often use max main acceleration.

10. **Gravity and atmosphere**

    * If `ShipPhysicsCore` applies central gravity or drag, the route simulation must include it.

A safe first implementation can still be conservative. It does not need perfect PhysX duplication immediately. But it must be honest:

* Use the real sampled actuator profile.
* Simulate at `Time.fixedDeltaTime`.
* Produce expected state at every segment boundary.
* Mark the plan non-executable when authority is missing or uncertainty is too large.
* Replan or abort when actual physics drifts beyond tolerance.

## 5. GUI exposure

The HUD should display the exact `PrototypeFlightPlan` that the executor is currently following.

Extend `PrototypePlayerNavigationSnapshot` with something like:

```csharp
public readonly struct PrototypePlayerNavigationManeuverRow
{
    public readonly int Index;
    public readonly bool IsActive;

    public readonly string PhaseLabel;
    public readonly string CommandLabel;

    public readonly float StartTimeSeconds;
    public readonly float DurationSeconds;
    public readonly float EndTimeSeconds;

    public readonly float MainThrottle;
    public readonly float ExpectedDeltaV;
    public readonly float ExpectedFuelKg;

    public readonly float ExpectedStartDistanceMeters;
    public readonly float ExpectedEndDistanceMeters;
    public readonly float ExpectedEndSpeedMetersPerSecond;

    public readonly float Progress01;
    public readonly string StatusLabel;
}
```

Add these fields to the navigation snapshot:

```csharp
public readonly string PlanId;
public readonly int PlanRevision;
public readonly bool PlanExecutable;
public readonly string PlanStatusLabel;

public readonly float PlanTotalEtaSeconds;
public readonly float PlanTotalExpectedFuelKg;
public readonly float PlanExpectedRemainingFuelKg;

public readonly int ActiveSegmentIndex;
public readonly float ActiveSegmentProgress01;
public readonly PrototypeFlightPlanAbortReplanReason ActiveReplanReasons;

public readonly IReadOnlyList<PrototypePlayerNavigationManeuverRow> ManeuverRows;
public readonly IReadOnlyList<Vector3> PlannedRouteWorldPoints;
```

The Navigation Planner panel should show:

```text
Plan #12 | executable | T+8.4 / 31.2s | fuel 2.8 kg planned | remaining 17.4 kg
Active: #03 FlipToRetrograde | 64%

#  Start   Phase              Duration  Command       Δv       Fuel    Status
0  T+0.0   AlignForBurn        1.2s      RCS attitude  0.0 m/s  0.1 kg  done
1  T+1.2   ProgradeBurn        6.5s      Main 100%     42 m/s   1.4 kg  done
2  T+7.7   Coast               2.0s      none          0 m/s    0.0 kg  active
3  T+9.7   FlipToRetrograde    1.8s      RCS attitude  0 m/s    0.2 kg  queued
4  T+11.5  RetrogradeBurn      5.2s      Main 100%     38 m/s   1.1 kg  queued
5  T+16.7  FinalApproach       8.0s      RCS/main mix  4 m/s    0.3 kg  queued
6  T+24.7  Hold                6.5s      RCS damp      0 m/s    0.1 kg  queued
```

Important GUI rule:

> The route line, preview samples, maneuver table, total ETA, total fuel, and active segment must all come from `PrototypeFlightPlan`, not from a separate live heuristic estimate.

The existing “stop distance”, “burn required”, and “available burn seconds” can remain as diagnostics during migration, but they should be clearly labeled as diagnostics or removed from the main route panel once the flight plan is authoritative.

## 6. What remains live versus what must stop being ad hoc

### Live safety logic that should remain

These should still be evaluated live:

* Manual player input override.
* Non-finite position, velocity, rotation, or fuel state.
* Missing target or missing required components.
* Fuel starvation.
* Main thruster unavailable, overheated, or authority reduced beyond tolerance.
* RCS allocator residual above tolerance.
* New obstacle detected on the planned path.
* Collision predicted inside safety clearance.
* Target moved beyond tolerance.
* Actual position, velocity, attitude, angular speed, or fuel diverged from expected segment state.
* Plan expired or too many missed segment boundaries.
* Emergency damping after abort.

### Decisions that must stop being ad hoc for the core route

These should come from the precomputed flight plan:

* When to accelerate.
* When to stop accelerating.
* When to coast.
* When to flip.
* When to begin retrograde braking.
* Which direction to brake.
* How long to brake.
* When to enter final approach.
* When to enter hold.
* Ordinary lateral correction during the planned route.
* Ordinary reacquire route behavior after a planned avoidance segment.

Obstacle avoidance is the main exception. A newly detected obstacle can trigger abort or replan. It should not silently inject a different maneuver while the HUD still displays the old route as if nothing changed.

`RunAutopilotStep()` should eventually shrink to this shape:

```text
1. Ensure an active PrototypeFlightPlan exists.
2. Check safety monitor.
3. Abort or replan if required.
4. Get active segment from executor.
5. Emit commands from that segment.
6. Advance segment by time and boundary tolerances.
7. Publish execution state to HUD.
```

It should not independently decide that it feels like braking early unless that is surfaced as a safety abort or replan.

## 7. Staged implementation plan

### Commit 1: Add the flight-plan model only

Add:

```text
PrototypeFlightPlan
PrototypeManeuverSegment
PrototypeFlightPlanTolerance
PrototypeFlightPlanExecutionState
PrototypeFlightPlanAbortReplanReason
PrototypeTrajectoryPredictedSample
```

No behavior change.

Tests:

* Segment start/end times are ordered.
* Total ETA equals last segment end time.
* Total fuel equals sum of segment fuel.
* Non-executable plans preserve explicit reasons.
* Empty plan is invalid and safe.

### Commit 2: Add real ship planning snapshot builder

Add `PrototypeShipPlanningSnapshotBuilder`.

It should sample:

* `Rigidbody`
* `ShipStats`
* `ShipPhysicsCore`
* `MainThrusterBank`
* `MainThrusterModule`
* `RcsThrusterController`
* `ModuleMassDescriptor`
* `PrototypeModuleMassLayout`
* `PrototypeImportedShipBinder` report/status if available

Tests:

* Generated prototype ship snapshot includes mass, fuel, thrust, and RCS authority.
* Imported-functional-style ship snapshot includes nozzle count, imported socket mode, COM, inertia, and RCS mode.
* Snapshot fails safely when required components are missing.

### Commit 3: Make planner emit `PrototypeFlightPlan`

Extend `PrototypeTrajectoryPlanner` so it can return a `PrototypeFlightPlan`.

Initial route can still use conservative existing estimates, but it must produce:

* Absolute segment start/end times.
* Expected start/end pose and velocity per segment.
* Expected fuel per segment.
* Total ETA and fuel.
* Predicted route samples.

Keep `PrototypeTrajectoryPlan` as a legacy adapter for current HUD/tests.

Tests:

* Direct route emits ordered maneuver segments.
* Predicted samples reference valid segment indices.
* HUD route points and planner route samples are the same source.
* Brake segment starts at the planned time, not at a live gate.

### Commit 4: Add `PrototypeFlightPlanExecutor`

Add an executor used by `PrototypeWaypointAutopilot`.

Initial behavior:

* On engage, request a flight plan.
* Execute only the active segment.
* Convert the active segment to main throttle, attitude, and RCS commands.
* Advance by elapsed fixed time and segment tolerances.
* Publish `PrototypeFlightPlanExecutionState`.

Keep old `RunAutopilotStep()` behind a legacy flag, for example:

```csharp
[SerializeField] private bool useLegacyLiveAutopilot;
```

Tests:

* If active segment is `ProgradeBurn`, runtime does not enter brake state early.
* If active segment is `Coast`, main throttle remains zero unless safety abort occurs.
* If active segment is `FlipToRetrograde`, runtime aligns but does not apply main brake until the following planned brake segment.
* Active segment index and HUD active row match.

### Commit 5: Move brake and flip timing into the plan

Update planning logic to calculate:

* Align duration from attitude error, inertia, and RCS torque authority.
* Flip duration from current orientation, target retrograde direction, inertia, and RCS authority.
* Brake start time from predicted future state, reverse/brake authority, and arrival tolerance.
* Brake duration from actual deceleration authority, not only current scalar max acceleration.

Tests:

* No `FlipToRetrograde` before the planned segment start unless safety replan reason is set.
* No `RetrogradeBurn` before the planned segment start unless safety replan reason is set.
* Planner uses reverse/brake authority consistently with runtime.
* Current terminal/deadzone PlayMode tests still pass.

### Commit 6: Replace HUD planner panel with flight-plan rows

Update `PrototypePlayerHud`:

* Add maneuver table.
* Show plan revision, executable status, total ETA, total planned fuel, expected remaining fuel.
* Show active segment and progress.
* Show abort/replan reason when safety monitor intervenes.
* Use `PrototypeFlightPlan.PredictedSamples` for route/preview lines.

Tests:

* Snapshot contains maneuver rows.
* Active row matches executor active segment.
* Total ETA and total fuel match the plan.
* Legacy stop-distance fields are not presented as authoritative route data.

### Commit 7: Upgrade planner actuator simulation

Incrementally model:

1. Main throttle spool.
2. Main gimbal slew or conservative zero-gimbal alignment.
3. Fuel burn and mass change.
4. Thermal derate if active.
5. Physical nozzle force mode.
6. RCS translation and torque authority.
7. RCS imported socket allocation residuals or conservative derate.
8. Gravity and atmosphere if enabled.

Tests:

* Predicted fuel use versus PlayMode run stays within configured tolerance.
* Predicted end velocity versus PlayMode run stays within configured tolerance.
* Imported-functional-style ship does not brake earlier than the planned segment.
* Plan marks itself non-executable when actuator authority is insufficient.

### Commit 8: Add safety monitor and bounded replanning

Add `PrototypeFlightPlanDivergenceMonitor`.

It should compare actual state against expected segment state:

* Position error.
* Velocity error.
* Attitude error.
* Angular velocity error.
* Fuel error.
* Obstacle clearance.
* Target movement.
* Actuator availability.

Behavior:

* Small drift: continue.
* Medium drift: request bounded replan.
* Large drift or collision risk: abort to safe damping.
* Replans are rate-limited.
* Every replan gets a new plan revision and visible reason.

Tests:

* New obstacle on route triggers replan or abort.
* Tiny tolerated drift does not replan.
* Target movement beyond tolerance replans.
* Fuel mismatch beyond tolerance aborts or replans with visible reason.
* Replan reason appears in HUD snapshot.

### Commit 9: Quarantine old live gates

Move old brake/flip/final-approach gates out of the core route path.

Keep them only as:

* Legacy mode.
* Emergency abort damping.
* Test comparison diagnostics.

Remove or disable route-changing behavior from:

* `ShouldRequestBrake()`
* terminal brake commit gates
* brake direction smoothing as a route decision
* live final approach switching
* live hold capture switching

Tests:

* Core route tests fail if the old live gate changes phase before the active plan segment allows it.
* Legacy mode still passes old tests until removed.

### Commit 10: Reproduce imported Blender/GLB GUI issue in PlayMode or Unity MCP

Because the exact imported asset/scene is uncertain from the bundle, the safest reproducible test is to create an imported-functional-style fixture that uses the same binding path.

PlayMode fixture:

1. Instantiate a ship root.
2. Add imported-style main nozzle transforms and optional gimbal pivots.
3. Add RCS socket transforms with non-trivial layout.
4. Add `ModuleMassDescriptor` entries with asymmetric COM/inertia.
5. Add or invoke `PrototypeImportedShipBinder`.
6. Ensure `ShipStats.ApplyMassProperties()` has been applied to the Rigidbody.
7. Ensure `RcsThrusterController.SetUseImportedFunctionalSockets(true)` is active through binder setup.
8. Place a target at the failing GUI-style distance.
9. Give the ship an initial closing velocity similar to the reported case.
10. Engage autopilot.
11. Step fixed physics.
12. Log:

    * plan id/revision
    * active segment
    * runtime autopilot state
    * distance
    * closing speed
    * requested throttle
    * requested RCS force
    * brake/flip start time
    * replan reasons
    * HUD active row

Core assertions:

```text
firstRuntimeFlipTime >= plannedFlipStartTime - tolerance
firstRuntimeBrakeTime >= plannedBrakeStartTime - tolerance
HUD active row == executor active segment
route preview points == active flight plan predicted samples
early brake/flip is allowed only when safety replan or abort reason is non-zero
```

Unity MCP/manual scene scenario:

* Open the demo scene with the imported Blender/GLB ship.
* Confirm binder report shows main nozzles and RCS nozzles.
* Engage the same target route from the GUI.
* Capture HUD screenshot showing the maneuver table.
* Capture log showing planned segment timings and actual segment transitions.
* Verify any early flip/brake has an explicit replan/abort reason. If not, it is a failing regression.

## 8. Risks in trying to make the route “fully exact”

Do not promise exact Unity physics determinism. That would be misleading.

Main risks:

* PhysX integration is not bit-perfect deterministic across machines, frame timing, solver settings, and Unity versions.
* `FixedUpdate` timing and render-frame HUD timing can differ.
* Force application order matters.
* Gimbal, throttle spool, RCS spool, thermal efficiency, and fuel burn introduce stateful actuator behavior.
* Fuel burn can change mass and inertia.
* Physical nozzle force-at-position can create torque that a simple linear predictor misses.
* RCS allocator residuals can make requested force/torque differ from actual force/torque.
* Imported socket orientation and COM can differ from generated test ships.
* Gravity and atmosphere sampling can make long predictions drift.
* Dynamic obstacles and moving targets invalidate precomputed routes.

The honest target should be:

> Deterministic route generation from a captured planning snapshot, with bounded execution tolerances and explicit replan/abort reasons when Unity physics diverges.

Verification should use tolerance-based acceptance, not exact equality.

Recommended acceptance examples:

* Plan creation logs a stable snapshot hash or summary.
* Segment times are deterministic for the same snapshot and settings.
* Actual segment boundary state is within configured position, velocity, attitude, angular-speed, and fuel tolerances.
* Brake and flip do not occur before their planned segment start unless an explicit safety reason is recorded.
* HUD always displays the same plan revision that the executor is following.
* Replans are visible, rate-limited, and reasoned.
* Imported-functional-style PlayMode test passes separately from the simplified harness tests.

## Practical final architecture

The smallest safe path is not a rewrite. It is this migration:

```text
Existing planner diagnostics
        ↓
Add executable PrototypeFlightPlan beside them
        ↓
HUD displays PrototypeFlightPlan
        ↓
Autopilot executes PrototypeFlightPlan
        ↓
Old live gates remain only in legacy mode or safety abort
        ↓
Planner becomes more physically accurate in small steps
```

The key change is semantic:

> A maneuver displayed in the GUI must be the maneuver the ship is executing. If the ship does something else, that must be shown as a replan or abort, not hidden behind live heuristic state changes.
