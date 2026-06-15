# Tasks: Autopilot V2 Core Planner Executor v1

## Phase 0: Planning Scaffold

- [x] Create DevToolbox proposal, design, tasks and spec scaffold.
- [x] Mark runtime implementation as future work.

## Phase 1: Planner Contracts Later

- [ ] Define `TargetDescriptor` in the approved Clean-Core runtime location.
- [ ] Define `ArrivalEnvelope`.
- [ ] Define route plan and segment data contracts.
- [ ] Add pure tests for stable serialization or equality semantics where
  needed.

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
