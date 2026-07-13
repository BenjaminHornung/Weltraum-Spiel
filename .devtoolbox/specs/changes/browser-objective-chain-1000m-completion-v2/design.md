# Design

## HUD Admission Rule

A route preview is player-actionable only when all of the following are true:

1. no route is currently locked;
2. preview state is `Ready` and a plan exists;
3. the preview is not stale;
4. `lockAdmission.ok` is true and its plan hash matches the preview plan;
5. the preview plan hash differs from `executor.completedPlanHash`.

The same predicate drives route tone, plan label, HUD action enablement, and
planner-visible preview content, player messaging, and Engage enablement. A raw
preview may contribute its plan or `playerMessage` only after that admission
rule succeeds. Every rejected variant instead presents a deterministic safe
reason; an existing locked plan remains authoritative even if incompatible raw
preview or navigation-map route data coexists. The planner map derives route
geometry and route hash from the same admitted-or-locked visible plan while
preserving independent target, obstacle, and world contacts. `completedPlanHash`
is historical completion truth, so
the plan label remains `Plan completed` when no genuinely new admissible
preview exists. It does not imply active holding after a planning mutation:
route tone remains `manual` for executor `Idle` without station keeping,
becomes `holding` only for executor Arrival/station-keeping truth, and becomes
`blocked` only for an actual owner/warning blocker.

## Objective Proof

The deterministic simulation test uses the existing runtime controller and
fixed-step loop. The browser proof uses only visible player controls on `/` and
condition-based waits. Completion remains executor-owned Arrival/Holding truth;
no TestBridge, position snap, velocity reset, or synthetic stepping is allowed.
