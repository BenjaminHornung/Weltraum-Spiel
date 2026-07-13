# Design: Browser Autopilot Bang-Bang Transit Profiles v1

## Baseline
On main, planners lock per-segment `desiredSpeed`; the executor chases that speed and computes braking from immediately available reverse acceleration. `FlightController` uses local +X as forward, but an executor-supplied `desiredAcceleration` bypasses orientation and becomes world-space main acceleration. Motion-defining constants are not all hashed.

## 1. Serializable physical capability
Add a versioned `ShipPropulsionCapability` snapshot with main and effective braking thrust in newtons, structural/thermal/peak linear limits, angular acceleration/velocity limits, optional cruise cap, optional fuel/heat metadata, and optional namespaced extensions. `createShipStateV2` supplies a deterministic normal-scout fixture for legacy callers. Additional fixtures represent high-thrust crew, underpowered cargo, and high-g drone behavior without naming engine technology.

Live usable acceleration is derived per tick from current mass and the minimum applicable capability, thermal, structure, policy, and occupant constraints. Main and braking directions are derived separately. The old global max-acceleration option may remain only as a compatibility clamp during migration; it cannot be final authority.

## 2. Occupants and policies
Use standard gravity 9.80665 m/s². Human defaults are preferred 1.0 g, comfort floor 0.8 g, and sustained/peak maxima 1.5 g. Drone mode does not apply biological limits; all serialized numbers remain finite and physical capability remains authoritative.

Store requested and resolved policy identity. Legacy aliases resolve deterministically: Safe to CrewComfort near 0.8 g with conservative jerk, Balanced to CrewComfort near 1.0 g, Fast to CrewSprint up to physical/human limits. Economy uses lower acceleration plus a finite peak-speed cap and permitted coast. DroneSprint requests physically available acceleration. Custom accepts only finite validated values.

## 3. Locked motion profile
`RoutePlan` owns a versioned locked motion profile containing the resolved policy snapshot, occupant envelope, capability snapshot, jerk/alignment/flip/braking constraints, phase vocabulary, and per-segment motion constraints. The planner hashes the complete object with `planHashFor`. Policy changes require a new plan. Fuel burn and live mass affect execution availability but do not mutate the plan or hash.

Per-segment constraints include entry, exit/terminal, and optional peak speed. For obstacle routes, corner speed is derived deterministically from turn angle, angular/lateral authority, clearance radius, and next-segment braking ability. A forward pass enforces acceleration reachability; a backward pass enforces braking reachability. Route points are never changed during execution.

## 4. Physical actuation
The controller always computes actual main acceleration as actual ship-forward (+X rotated by orientation) multiplied by aligned effective throttle and live usable acceleration. Requested burn direction drives RCS/SAS attitude guidance. Main throttle is blocked or reduced outside a locked alignment tolerance. Angular acceleration and velocity are finite capability-clamped. Flip is physical rotation over multiple ticks with no orientation assignment.

## 5. Executor phases and braking switch
The executor persists one of `AlignForBurn`, `Accelerate`, `Coast`, `Flip`, `Brake`, `TerminalCapture`, or `Holding`. Minimum-time policies accelerate until the remaining distance reaches dynamic stopping reserve. Reserve uses projected along-route speed, locked exit velocity, usable braking acceleration, estimated flip time/drift, and margin. This naturally moves the switch for initial velocity, asymmetric thrust, mass changes, and waypoint constraints; no midpoint is hardcoded.

Coast occurs only for locked peak-speed, thermal, turn, or geometry constraints. A jerk limiter ramps powered acceleration. The final handoff keeps existing physical Terminal Capture and Holding through `FlightController` and retains distance/speed gates.

## 6. Fail-closed and determinism
The executor retains the locked plan/hash on divergence, fuel, braking reserve, or authority failure and reports explicit reasons/replan requirement. It never substitutes a route. Existing no-snap and no-zero shortcuts remain forbidden. Repeated fixed-step inputs must produce identical phase timelines and metrics.

## 7. Telemetry and evidence
Physical telemetry includes requested burn direction, actual main-thrust direction, alignment, flip state/angle, phase, proper acceleration, peak/average powered g, comfort/maximum durations, phase durations, coast fraction, gravity coverage, delta-v/fuel, occupant mode, and physical limits. Renderer/UI are consumers only. TestBridge remains installed only for `?testBridge=1`.

## 8. Economy limitation
The Browser v1 fuel model burns fuel from thrust impulse and has no engine-specific Isp, throttle-efficiency, or heat-soak curve. Economy therefore saves modeled fuel by lowering peak velocity and total delta-v/impulse, not by asserting a low-throttle efficiency bonus.

## 9. Evidence harness boundary
The existing `scenarioRunner.ts` remains the compatibility proving-ground classifier for the established catalog and its stable summary result. The bang-bang acceptance artifacts additionally require per-fixed-step actuator truth, physical phase transitions, proper-acceleration coverage, impulse accumulation, exact policy comparisons, and full timelines. Adding those mandatory samples and result fields to the generic runner would change its public TestBridge payload and risk invalidating existing proving-ground baselines outside this change.

For v1, `autopilotBangBangMetrics.ts` is therefore a feature-local evidence adapter with its own scenario/result schema. It reuses the production planner, locked route/hash, `AutopilotExecutor`, `FlightController`, fixed 30 Hz semantics, and existing TestBridge query gate; it must not become a second product physics implementation. Duplication of deterministic stepping, clearance, settling, finite-value rejection, terminal acceptance, and hash/replan checks is intentionally limited to preserving the existing runner contract while producing the three required artifacts. A later harness-normalization change may extract callback-based shared primitives only after both result contracts have characterization coverage; that refactor is explicitly outside this physical-control change because it would expand regression scope without changing product behavior.