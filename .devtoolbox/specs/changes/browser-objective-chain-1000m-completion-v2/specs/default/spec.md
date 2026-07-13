# Browser Objective Chain 1000m Completion v2

## Requirements

- After an old route completes, a new route preview shall be promoted in the
  HUD only when it is Ready, non-stale, admitted for the exact preview hash, and
  distinct from the completed plan hash.
- The promoted state shall show `Route preview ready`, use route tone `ready`,
  and dispatch `EngageRoutePreview` with the exact visible preview hash.
- Unavailable, stale, missing-plan, missing-admission, admission-rejected,
  hash-mismatched, validation-rejected, and same-as-completed previews shall not
  be promoted or expose their raw `playerMessage`, Ready claim, plan hash,
  timeline, metrics, route progress, planner-map route geometry, or planner-map
  route hash in the player HUD and planner. Each rejected state shall expose
  only its deterministic safe reason. Independent target, obstacle, and world
  contacts shall remain visible on the planner map.
- `completedPlanHash` shall remain historical completion truth. It shall not
  manufacture a holding route tone while the executor is `Idle` and station
  keeping is inactive; owner executor/warning state remains authoritative.
- Completing Range 500m and Range 1000m from executor Arrival/Holding truth
  shall make Range 2500m available.
- Selecting Range 2500m shall produce a stable admitted preview with a new hash
  and approximately 1.5 km remaining from the Range 1000m hold position.
- The normal browser proof shall run at `/`, use visible player UI only, and
  prove TestBridge absent.

## Guardrails

- Preserve locked immutable plan hashes and explicit engagement.
- No silent replan, synthetic completion, position snap, velocity reset, or
  renderer-owned gameplay truth.
- No `Assets/**`, Unity, package, dependency, planner, executor, physics, or
  control changes.
