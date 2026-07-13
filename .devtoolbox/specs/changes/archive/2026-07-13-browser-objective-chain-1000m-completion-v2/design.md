# Design

## HUD Display and Admission Rules

`RoutePreviewPresentation` separates two contracts:

- `displayPlan` is route context that may be rendered but never authorizes
  engagement.
- `admittedPlan` is the exact route identity that may authorize engagement.

A route preview is player-actionable and becomes `admittedPlan` only when all
of the following are true:

1. no route is currently locked;
2. preview state is `Ready` and a plan exists;
3. the preview is not stale;
4. `lockAdmission.ok` is true and its plan hash matches the preview plan;
5. the preview plan hash differs from `executor.completedPlanHash`.

Only the typed current-state rejection codes `VelocityMismatch` and
`FlightAdmissionRejected` may retain the same Ready preview as `displayPlan`,
and only when the rejection hash still equals the preview plan hash and the
hash differs from `completedPlanHash`. These states show route geometry, hash,
distance, progress, radar, timeline, and metrics as blocked context. They never
become `admittedPlan`; both Engage controls remain disabled and dispatch no
hash. Replanning is the path back to admission.

All stale, missing, unavailable, validation-rejected, hash-invalid or
hash-mismatched, identity/provenance/target/profile/planner-mismatched,
invalid/discontinuous, and same-as-completed previews hide their route content
and identity. An existing locked plan remains authoritative if incompatible raw
preview or navigation-map route data coexists. The planner map always derives
route geometry and route hash from the same locked-or-display plan while
preserving independent target, obstacle, and world contacts. Rejected player
messaging comes from typed deterministic mappings, never raw `playerMessage`;
`FlightAdmissionRejected` retains the exact safety wording from the lock
contract.

`completedPlanHash` is historical completion truth, so the plan label remains
`Plan completed` when no genuinely new route exists. When the locked plan has
cleared but `stationKeepingActive` is true, the target distance remains the
executor's live `distanceToTarget`; the completed raw preview route and hash
stay hidden. Without station keeping, historical completion alone does not
manufacture holding state.

## Objective Proof

The deterministic simulation test uses the existing runtime controller and
fixed-step loop. The browser proof uses only visible player controls on `/` and
condition-based waits. Completion remains executor-owned Arrival/Holding truth;
no TestBridge, position snap, velocity reset, or synthetic stepping is allowed.
