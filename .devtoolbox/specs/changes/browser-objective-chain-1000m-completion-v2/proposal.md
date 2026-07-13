# browser-objective-chain-1000m-completion-v2

## Summary

Finish the current-main browser objective-chain proof through real Range 1000m
arrival, then expose an admitted Range 2500m route preview through the normal
player UI.

## Base And Supersession

- Branch: `feature/browser-objective-chain-1000m-completion-v2`
- Base: `origin/main` at `639f2e11ee98814b92ad2abb2ec0f0847483e498`
- Supersedes only the unfinished evidence intent of
  `browser-large-field-objective-chain-live-v1`; it does not rewrite that
  historical change or import the stale feature branch.

## Scope

- Prefer a genuinely new admitted route preview over an older completed-plan
  label in the player HUD.
- Add deterministic unit proof that completing Range 1000m unlocks an admitted
  Range 2500m preview with a stable, distinct hash.
- Extend the existing normal-runtime Playwright flow through real 1000m
  Arrival/Holding and visible Range 2500m preview selection.
- Record fresh current-main evidence and verification results.

## Non-Goals

- No Range 2500m flight or arrival requirement.
- No planner, executor, physics, control, renderer, TestBridge, package, Unity,
  or `Assets/**` changes.
- No route-state redesign or broad HUD refactor.
