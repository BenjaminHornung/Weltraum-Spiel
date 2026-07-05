# Browser Large-Field Navigation Objective v1

Add a thin player-facing objective loop to the browser large proving ground. The slice keeps objective truth in the browser runtime and HUD telemetry, not in renderer markers or TestBridge.

## Scope

- Present a current navigation objective in the player HUD.
- Allow the player to focus a large-field objective target through normal HUD controls.
- Use route preview and autopilot engage as the objective progression path.
- Record live Playwright evidence from the normal `/` URL.

## Non-Goals

- No full mission framework.
- No planner, executor, or flight-physics changes.
- No Unity `Assets/**` changes.
- No TestBridge-dependent runtime logic.
