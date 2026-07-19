# browser-outpost-operations-console-ui-prototype-v1

## Motivation

Create a visible, interactive outpost operations console prototype for UX and art-direction review. The prototype must make the operating model of a single functional V0 outpost understandable without claiming gameplay, economy, mission, cargo, drone, legal, or outpost authority.

## Outcome

A standalone browser prototype at `/prototypes/outpost-operations-console-v1/` presents Aurelia Frontier Service Post 07 across pad control, cargo/storage, refuel, repair, market, mission board, drone control, and legal/access views. All data and commands are explicitly local mock state.

## Scope

- Prototype-only HTML, CSS, JavaScript, and prototype-local Playwright configuration.
- Focused Playwright coverage and required screenshots.
- DevToolbox artifacts, prototype evidence, and a design audit.
- Responsive desktop and 1280x720 operation.
- Accessibility behavior including keyboard navigation, visible focus, live regions, Escape dismissal, and focus return.

## Non-goals

- No edits to `src/**`, package manifests, root configs, CI, Unity, Hestia, existing prototypes, first-person showcase surfaces, Agent-E paths, or mission/resource/cargo cores.
- No real gameplay, economy, mission, cargo, scheduler, drone, legal, persistence, or outpost authority.
- No merge, pull request, or archive operation.
