# Task 14 Execution

- Scope: `ToggleAutopilot` adopts a freshly user-requested valid preview plan instead of discarding it and forcing a new plan on engage.
- Started: 2026-06-13.
- Implementation note: keep `ReplanNow()` as the single preview-plan producer; adoption is decided in `ToggleAutopilot` before clearing `LastTrajectoryPlan`.
- Completed implementation:
  - `ReplanNow()` stamps the latest user-requested plan time before synchronously refreshing the navigation plan.
  - `ToggleAutopilot()` adopts a fresh preview flight plan inside an 8 second UX window when executor mode is enabled, target/arrival settings match, and the current ship snapshot still matches the plan snapshot.
  - Adopted plans preserve plan id and revision accounting, clear `forceNextFlightPlanRevision`, keep `LastTrajectoryPlan`, and set refresh timers instead of marking the plan dirty.
  - Fallback behavior remains unchanged when no preview exists, the preview is stale, fuel/position/attitude drifted, or target arrival settings changed.
  - Snapshot parity checks cover position, velocity, attitude, angular velocity, COM/inertia, fuel, mass, thrust/RCS/spool settings, simulation flags, nozzle counts, and mass descriptor count.
