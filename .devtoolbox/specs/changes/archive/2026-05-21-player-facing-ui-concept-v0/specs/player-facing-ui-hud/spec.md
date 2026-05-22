# Capability: player-facing-ui-hud

## Requirement
The prototype SHALL expose a player-facing HUD that summarizes flight, navigation, combat, docking, ship-status, and help information without showing debug-only tuning internals by default.

## Scenarios
- During normal flight, the HUD displays speed, throttle, fuel, maneuver mode, RCS/SAS states, and useful warnings.
- When navigation or combat systems provide active targets, the HUD displays player-readable state, range, and readiness labels.
- When docking diagnostics exist, the HUD displays player-readable approach information without claiming a final docked hard-lock state while hard lock is only a placeholder.
- The HUD remains responsive and avoids duplicate canvas instances after reloads.
- Existing debug/prototype windows remain available but hidden by default.

## Constraints
- This capability is a concept/prototype UI slice.
- It does not add cargo, economy, mission reward, or builder UX.
