# Browser Flight HUD Polish v1 Design

## Current foundation

The browser HUD already has the correct architecture on `main`:

- `apps/weltraum-browser/index.html` defines `#flight-hud`, `#hud-top-strip`, `#hud-left-panel`, `#hud-right-panel`, `#hud-bottom-strip`, `.hud-center-safe-area`, and hidden `#debug-hud`.
- `apps/weltraum-browser/src/ui/statusHud.ts` provides a `StatusHudViewModel` split into `flightStatus`, `navigation`, `warnings`, `actions`, and `debug` panels.
- `apps/weltraum-browser/src/style.css` already implements edge-strip layout and responsive safe-area rules.

## Design decision

Use the existing HUD structure and ViewModel boundary. Improve composition, labeling, state treatment, spacing, meters, and screenshot evidence rather than redesigning the app shell or touching flight truth.

## Layout intent

- **Top strip**: high-level mode, autopilot state, and concise ship visual/status identity.
- **Left panel**: ship systems/readouts such as control mode, throttle, speed, RCS/SAS, and fuel.
- **Right panel**: navigation, target, route, compact radar status, target selection, and autopilot/route state.
- **Bottom strip**: warnings, cockpit/runtime message, and one primary contextual action.
- **Center safe area**: remains a clear flight viewport. Only lightweight reticle/corridor chrome is allowed; no text panels.
- **Diagnostics**: remain in `#debug-hud`, hidden by default and visually secondary.

## Presentation rules

- Add or refine CSS classes/state attributes for manual, autopilot-active, holding, blocked, warning, and neutral states.
- Add compact meter/bar treatment for fuel and throttle when supported by existing snapshot fields.
- Use warning severity accents; critical/high warnings must be easy to scan.
- Avoid raw codes in player text; use existing player-facing labels/actions.
- Keep existing DOM IDs and `data-testid` selectors whenever possible to preserve tests.

## Invariants

- Renderer/UI is not flight truth.
- No planner/executor route mutation or silent replan.
- No TestBridge leak into default player mode.
- No player-facing completed route hash clutter.
- No `Assets/**` changes.

## Review strategy

- `ui-designer` reviews concept alignment, hierarchy, readability, and center safety.
- `reviewer` and `reviewer-glm` review correctness/regression/test gaps in parallel.
- Use `debugger` + `debugger-glm` only if a hard/ambiguous failure appears.
