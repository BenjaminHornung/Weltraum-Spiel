# Design

## Approach

Use the existing Browser/Three.js runtime as the source of truth and reshape only the player-facing DOM/CSS presentation. The HUD remains driven by `TelemetrySnapshot`, route previews, objective state, and existing runtime commands.

## Reuse

- Keep `statusHud.ts` as the HUD/view-model bridge so existing E2E specs continue to find stable selectors.
- Keep runtime command ownership in `commands.ts`/`browserRuntime.ts`; add only player-facing UI commands if needed for opening planner/contact presentation modes.
- Use current target, route preview, autopilot, radar, and objective data. The UI may include placeholder labels for unsupported route profiles or combat systems, but those labels must identify the unsupported or presentation-only nature clearly.

## UI Decisions

- Flight HUD uses named regions: left ship status, bottom-left radar, right navigation/autopilot/objective stack, top mode strip, and a clear center safe area.
- Navigation planner is a normal-runtime overlay with a large route map, waypoint/target markers from current large-field target data, a top target strip, right route details, profile controls, and Engage action wired to the existing engage flow.
- Combat/contact presentation uses a query-scoped UI scenario (`?uiScenario=combat-contact`) when no real combat data exists. It must not be shown as default combat truth on `/`.
- Major HUD regions get stable selectors/data attributes for Playwright layout checks without introducing heavy visual-diff dependencies.

## Verification Design

Playwright `ui-concept-parity.spec.ts` captures screenshots and checks measurable layout structure: region bounding boxes, center safe-area overlap, radar placement, right panel placement, navigation planner dominance, contact shell visibility, TestBridge absence, Demo Scout visibility, and CSS concept tokens.

The written audit and final evidence compare real browser screenshots against the concept screenshots and record remaining gaps, especially the lack of real combat systems.
