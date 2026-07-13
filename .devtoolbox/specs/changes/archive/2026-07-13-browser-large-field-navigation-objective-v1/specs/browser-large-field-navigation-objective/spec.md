# Browser Large-Field Navigation Objective

## Requirements

- The normal browser runtime SHALL expose a current large-field navigation objective.
- The player HUD SHALL show objective label, target, distance, status, next action, and hint text.
- The objective model SHALL support `inactive`, `active`, `route-ready`, `enroute`, `complete`, and `blocked` statuses.
- Objective target focus SHALL use normal browser runtime commands and selected-target route preview.
- Objective completion SHALL be derived from runtime/autopilot telemetry and the engaged route target.
- Objective runtime logic SHALL NOT depend on renderer-only markers or TestBridge.
- The default product URL SHALL keep `window.TestBridge` hidden.
