# Proposal

## Change
`fix-autopilot-exact-point-arrival-v1`

## Problem
The Proving Ground harness shows the waypoint autopilot can declare player waypoint navigation complete while still several meters from the requested exact point. Terminal overshoot can also enter the precise envelope, drift far away, and settle in a loose hold state. Lateral, off-axis, low-RCS, and obstacle corridor scenarios expose related state-machine issues: post-brake acceleration flapping, false Reacquire planner profiles without obstacles, excessive replans, and unsafe obstacle clearance.

## Goal
Make player waypoint navigation finish only at the exact target envelope required by the Proving Ground harness, while preserving physical force routing through existing ship controller and RCS paths. Terminal point capture must own control after final brake ownership begins until exact arrival succeeds or authority is explicitly reported as limited or unavailable.

## Scope
- Tighten Complete gating for player waypoint point arrival to the strict target distance, relative speed, and angular speed thresholds used by the harness.
- Add or refine terminal point-capture control that damps position and velocity with RCS-only control after main braking.
- Block nominal post-brake transitions into Accelerate and nominal positive-prograde reacquire near terminal capture.
- Restrict Reacquire planner profile classification to real avoidance route loss or explicit terminal recovery conditions.
- Preserve obstacle avoidance while fixing the obstacle corridor route execution and clearance regression.
- Handle low translation-RCS terminal correction without false Complete or replan spam.
- Refresh Proving Ground evidence and add focused regression tests around terminal arrival and transition/profile gates.

## Non-goals
- Do not relax Proving Ground thresholds or classify failing behavior as PASS.
- Do not directly write `Rigidbody.velocity` for arrival correction.
- Do not replace the obstacle avoidance planner wholesale.
- Do not add gravity, orbital, or slingshot behavior.
- Do not modify unrelated UI, ship-builder, TextMeshPro assets, scene screenshots, or unrelated gameplay systems.
