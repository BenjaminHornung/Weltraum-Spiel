# Tasks: Autopilot V2 Core Planner Executor v1

## Phase 0: Planning Scaffold

- [x] Create DevToolbox proposal, design, tasks and spec scaffold.
- [x] Mark runtime implementation as future work.

## Phase 1: Planner Contracts Later

- [x] Define `TargetDescriptor` in the approved Clean-Core runtime location.
- [x] Define `ArrivalEnvelope`.
- [x] Define route plan and segment data contracts.
- [x] Add pure tests for stable serialization or equality semantics where
  needed.

Evidence: current HEAD contains immutable Clean-Core contract types in
`Assets/_Weltraum/Runtime/Navigation/AutopilotContracts.cs`,
`Assets/_Weltraum/Runtime/Flight/FlightContracts.cs` and
`Assets/_Weltraum/Runtime/Simulation/SpatialVector3.cs`, with focused EditMode
coverage for `TargetDescriptor`, `ArrivalEnvelope`, `RoutePlan`,
`RouteSegment`, `RouteCandidate`, `RouteScore`,
`NavigationEnvironmentSnapshot`, `ShipAuthoritySnapshot`, `ObstacleSnapshot`,
`FuelBudget` and `BrakeReserve`. Planner and executor implementation tasks below
remain open.

## Phase 2: Deterministic Planning Later

- [ ] Implement direct local planning.
- [ ] Implement simple obstacle-avoidance local planning.
- [ ] Add same-input/same-plan-hash tests.
- [ ] Add invalid target, no authority and fuel rejection tests.

## Phase 3: Executor Later

- [ ] Implement locked-plan execution state.
- [ ] Implement explicit plan invalidation diagnostics.
- [ ] Add tests proving the executor never silently replans.

## Phase 4: Integration Later

- [ ] Connect V2 planner/executor to player UI only through explicit
  ViewModel/diagnostic contracts.
- [ ] Keep legacy autopilot behavior available until replacement criteria are
  separately defined and verified.
