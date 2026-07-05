# browser-large-field-objective-chain-live-v1

## Summary

Add a focused browser-only large-field objective chain that proves progression from Range 500m completion into Range 1000m availability and live route execution.

## Scope

- Keep objective state runtime-owned and based on executor Arrival/Holding truth.
- Keep the chain small: Range 500m, Range 1000m, Range 2500m.
- Keep HUD controls player-facing and avoid TestBridge or renderer-owned completion.
- Capture live Playwright evidence against the normal `/` runtime.

## Non-Goals

- No full mission, economy, reward, or planner framework.
- No Assets, Unity, package, planner, executor physics, snapping, velocity reset, or acceleration tuning changes.
