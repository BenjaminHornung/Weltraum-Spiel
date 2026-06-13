# Design: Stabilize Autopilot Obstacle Replan Chatter v1

## Current Chatter Pattern

`PrototypeBootstrapHost` replan logic reacts directly to obstacle risk callbacks. In launch-corridor scenarios, rapid false-edge transitions between obstacle-blocked and obstacle-clear can happen over consecutive FixedUpdates and each transition can call immediate replan pathways. This causes visible status flapping and repeated `SafetyReplan` scheduling.

## Minimal Design

We keep current hazard detection but gate repeated transitions with a local, small stability layer in the host:

1. Add `ObstacleRiskDebounce` state for launch-corridor risk handling.
2. Classify each new signal as `no_change`, `persistent_risk`, `new_risk`, or `near_collision_urgent`.
3. Apply a short hold time for repeated non-urgent signals before re-issuing `SafetyReplan`.
4. Preserve direct immediate replan for:
   - first sighting of a genuinely new obstacle risk,
   - any risk crossing a near-collision urgency boundary,
   - existing hard emergency branches already enforced by planner/executor semantics.
5. Add symmetrical clear-time logic to avoid immediate next-frame replan as the event disappears.

## Data and State

- `lastObstacleRiskState` (enum): `Unknown`, `Clear`, `AtRisk`, `Urgent`.
- `lastRiskChangeTime` (float, fixed-time domain).
- `pendingRiskStableWindowSeconds` (config, default short, e.g. 0.15-0.25).
- `minimumReplanGapSeconds` (config, optional anti-chatter floor).

## Rules

- New non-urgent risk event within stable window: accept but do not force a new `SafetyReplan` unless there is no recent replan and state changed from clear to risky.
- Repeated non-urgent same-state events within the window: log but ignore replan trigger.
- Risk state change from clear to urgent or blocked-for-new-obstacle: immediate replan.
- Risk clears: record clear time; allow transition to clear once clear stability window is reached.

## Risk and Correctness

- Conservative behavior remains: urgent risks still force quick recovery.
- Non-urgent launch-corridor flicker is filtered to reduce churn, not to suppress safety.
- No change to planner meaning, just trigger hygiene at the host bridge.

## Constraints

- No global change to obstacle event meaning or immediate semantics.
- No arrival terminal overshoot logic changes.
- No Phase-7 extraction work.
- No code edits outside scaffold in this change step.

