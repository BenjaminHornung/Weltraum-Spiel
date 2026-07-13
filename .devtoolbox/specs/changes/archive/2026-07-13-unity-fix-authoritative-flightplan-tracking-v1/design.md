# Design

## Decision

Keep `useFlightPlanExecutor` enabled as the target architecture and add `strictFlightPlanExecution` enabled by default. Strict mode means normal waypoint navigation does not silently fall back to `RunAutopilotStep()` when an executable plan exists or a plan command fails. Instead it records a visible reason, clears unsafe thrust, marks the plan dirty, and replans from the current Rigidbody state.

## Tracker Contract

`PrototypeFlightPlanTracker` is a pure/static tracker helper around the existing `PrototypeFlightPlan` model. It does not write Rigidbody state. It accepts the active plan, elapsed executor time, actual position/velocity/rotation/angular velocity/fuel, target, mass, main acceleration and RCS authority. It returns:

- interpolated reference sample and active segment metadata
- position, velocity, cross-track, along-track, attitude, angular velocity and fuel errors
- desired world acceleration from sample feedforward plus PD feedback
- split main-throttle direction/amount and RCS correction vector
- replan/abort reasons when the plan cannot be safely tracked

The first implementation intentionally uses the existing `PrototypeTrajectoryPredictedSample.expectedMainThrottle` and `expectedRcsForceWorld` fields as feedforward and adds bounded PD correction from actual error. This keeps the change compatible with the current planner while making execution closed-loop.

## Executor Integration

`TryRunFlightPlanExecutor()` still chooses the active segment by elapsed time. Before applying thrust it asks the tracker to validate and compute a command. `ApplyFlightPlanSegment()` becomes a phase/status adapter: it sets navigation/autopilot state, then applies tracker-derived command through the existing `ApplyAutopilotRequest()` and RCS request paths.

If tracker validation fails, executor output is zeroed, the divergence report records `InvalidPlanDirection`, `TrackingDiverged`, `PlanExpired`, or another existing replan reason where possible, and `forceNextFlightPlanRevision` plus `MarkNavigationPlanDirty()` ensure the next plan starts from live state.

## UI/Data Flow

`CurrentFlightPlan.predictedSamples` remains the route preview source. The executor exposes the same plan id/revision plus tracker sample index and error metrics so HUD, debug console, and tests can prove preview and execution are using the same plan.

## Tuning Defaults

Use conservative tracker gains and tolerances derived from current plan tolerance and ship authority. Main throttle is clamped to the component along the active planned tangent/brake direction. RCS handles cross-track and terminal corrections. FinalApproach/Hold stay RCS-first and suppress main throttle for small corrections.
