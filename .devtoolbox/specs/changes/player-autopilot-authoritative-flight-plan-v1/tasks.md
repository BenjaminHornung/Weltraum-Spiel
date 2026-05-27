# Tasks

- [x] Add authoritative flight-plan data model and pure validation tests.
- [ ] Add real ship planning snapshot builder for generated and imported-functional ships.
- [ ] Extend trajectory planner to emit an executable flight plan while preserving legacy diagnostic plan compatibility.
- [x] Add Navigation Planner maneuver rows, total ETA/fuel, active segment, and replan/abort status to HUD snapshots and UI.
- [ ] Add flight-plan executor behind a migration flag and route basic accelerate/coast/flip/brake sequencing through active segments.
- [ ] Add imported-functional Blender/GLB PlayMode regression that proves runtime flip/brake cannot occur before planned segment start without visible safety reason.
- [ ] Add divergence monitor for obstacle/target/fuel/actuator/state mismatch and surface bounded replan/abort reasons.
- [ ] Quarantine old live accelerate/brake/flip/hold gates to legacy fallback or safety abort only.
- [ ] Run Unity/.NET verification, capture GUI/Unity MCP evidence, and document results.
- [ ] Commit and push each completed checkpoint.
