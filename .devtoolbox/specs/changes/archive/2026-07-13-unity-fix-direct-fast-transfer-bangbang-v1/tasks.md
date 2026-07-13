# Tasks

- [x] 1. Add DirectFastTransfer profile data to the FlightPlan/planner model, preserving existing heuristic, obstacle, final-only, and limited-authority fallback behavior.
- [x] 2. Implement the analytical DirectFastTransfer solver and route selection gates in `PrototypeTrajectoryPlanner`.
- [x] 3. Generate DirectFastTransfer segments and predicted samples that align with executor phases and contain no arbitrary Coast segment.
- [x] 4. Update `PrototypeFlightPlanTracker` so DirectFastTransfer full burn/brake segments command full main throttle while aligned, with RCS-only cross-track correction.
- [x] 5. Update `PrototypeWaypointAutopilot` terminal handling so DirectFastTransfer brake commitment remains authoritative until the brake-end envelope, then transitions to RCS-only hold.
- [x] 6. Unify DirectFastTransfer arrival-point/stop-point handling and expose enough debug/evidence data to inspect COM, target, planned stop point, and final stop error.
- [x] 7. Add focused EditMode tests for solver math, segment sequence, no-Coast behavior, switch distance, velocity edge cases, near-target fallback, sample mapping, and arrival-point sampling.
- [x] 8. Add focused PlayMode coverage for full burn/brake execution, no thruster flapping, no arbitrary Coast, analytical brake switch, correct final COM stop, overshoot behavior, high initial velocity, no-RCS limited final hold, and obstacle fallback.
- [x] 9. Update `README.md`, `docs/physics-flight-model.md`, and `tests/test-protocol.md` with behavior, constraints, and evidence paths.
- [x] 10. Run verification, save logs/traces/screenshots or documented fallback artifacts under `tests/`, validate the DevToolbox change, and commit with `#FIX-DIRECT-FAST-TRANSFER-BANGBANG stabilize waypoint burn profile`.
