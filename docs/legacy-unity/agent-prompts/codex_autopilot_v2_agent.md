# Prompt: Autopilot V2 Core Agent

Goal:
Implement the first pure-code Autopilot V2 planner/executor core with
deterministic tests, without replacing the current prototype runtime yet.

Context:
- Read AGENTS.md.
- Read 02_autopilot_v2_design.md.
- Read 03_autopilot_test_harness.md.
- Inspect `PrototypeWaypointAutopilot`, `PrototypeTrajectoryPlanner`,
  current Proving Ground tests, and exact-arrival evidence.
- Read `navigation-route-preview-and-status-contract-v1` if present.

Constraints:
- No silent replan during execution.
- Do not mix gravity/slingshot into the first production core.
- Do not edit UI except minimal DTO exposure if required.
- Do not delete the legacy Proving Ground.

Tasks:
1. Add DTOs: TargetDescriptor, ArrivalEnvelope, AutopilotRequest, RoutePlan,
   RouteSegment, RouteCandidate, AutopilotTelemetry.
2. Add DirectLocal planner.
3. Add ObstacleSnapshot and simple obstacle clearance planner.
4. Add Fastest/FuelSaver/Balanced scoring.
5. Add immutable PlanHash.
6. Add Executor that follows locked plan and reports PlanInvalidated instead of
   replanning.
7. Add EditMode tests for determinism, direct arrival, obstacle, invalid target,
   fuel scoring, no-authority and no-silent-replan.

Verification:
- dotnet build
- focused EditMode tests
- Unity script validation if available

Done when:
- Same input produces same PlanHash.
- Direct and obstacle scenarios pass pure tests.
- Divergence does not trigger silent replanning.
