# Locked Route Segment Handoff Execution

## Requirements

### Deterministic diagnosis

The 2500 m multi-rock course MUST reproduce deterministically before behavior changes. Evidence MUST identify the first incorrect state transition or geometry evaluation and record the required focused telemetry around the terminal handoff and divergence.

### Legitimate locked-route handoff

A ship that physically crosses or legitimately acquires the next segment of an unchanged locked route MUST advance or validate against that bounded handoff without a false `OffLockedRoute`.

### Strict departure detection

A real lateral departure, including one near a segment handoff, MUST still fail closed as `Diverged / OffLockedRoute`, set `replanRequired=true`, and preserve the original `planHash`.

### Locked plan and physics truth

Execution MUST NOT call the planner, replace the plan, silently replan, snap position/waypoints, zero or clamp velocity directly, increase global acceleration, or weaken terminal arrival gates. Terminal capture remains FlightController-owned unless trace evidence proves a controller defect.

### Scenario acceptance

After the implementation is proven:

- `multi-rock-field-1000m` remains Pass.
- `multi-rock-field-2500m` becomes Pass and Arrived with finalDistance <= 3, finalSpeed <= terminalSpeedLimit, positive obstacle clearance, no failure/invalidation reasons, no replan, and stable planHash.
- a blocked corridor remains PlanningRejected.
- direct 2500 m Safe/Balanced/Fast terminal capture remains unchanged.
- the query-gated TestBridge case passes on `/?testBridge=1`, while normal `/` does not expose TestBridge.
- an existing live normal-runtime flight spec still passes.
