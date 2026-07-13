# Browser Flight HUD Polish Specification

## Requirements

### Requirement: Player HUD hierarchy is readable and game-like

The browser flight HUD SHALL present player-facing information in compact, grouped regions rather than an undifferentiated debug list.

#### Scenario: Default flight view

- Given the browser app loads without `?testBridge=1`
- When the flight HUD is visible
- Then mode, autopilot state, ship state, navigation/target/route, warnings, and route action are grouped into readable HUD regions
- And the center flight path remains clear of large text blocks or opaque panels
- And debug-only text such as TestBridge, raw plan hashes, raw failure codes, and solver internals is absent from the player HUD

### Requirement: Debug surfaces remain separate

Diagnostics SHALL stay hidden, clearly labeled, and structurally separate from the player HUD by default.

#### Scenario: Default product bootstrap

- Given the app loads at `/`
- Then `window.TestBridge` is not present
- And `#debug-hud` is hidden
- And normal player actions do not require a debug panel or F2-F6 debug controls

### Requirement: HUD consumes existing authority-owned snapshots

The HUD SHALL render from existing telemetry and ViewModels only. It SHALL NOT recompute or own route validity, ETA, fuel feasibility, brake reserve, authority, target legality, autopilot lifecycle, or executor state.

#### Scenario: Owner snapshot values differ from raw ship fields

- Given telemetry contains owner `FlightSnapshot` values
- When the HUD renders fuel, warnings, route state, or autopilot action state
- Then displayed values come from the snapshot/ViewModel contract
- And no renderer calculation changes planner/executor behavior or dispatches hidden route mutation

### Requirement: Important flight/autopilot states are visually distinct

The HUD SHALL make manual, autopilot-active, holding/arrived, blocked, and invalid route states easier to scan through labels, grouping, and visual state treatment.

#### Scenario: Autopilot active

- Given a route is engaged and executor telemetry reports executing/terminal-capture behavior
- Then the player HUD shows a distinct active autopilot state
- And the primary action clearly becomes cancel/hold-related instead of a second engage action
- And the center safe area remains protected

#### Scenario: Blocked route action

- Given fuel, authority, brake reserve, or route validity produces critical warnings
- Then the primary engage action is disabled
- And a player-facing blocked reason is visible
- And raw warning codes are not required player language

### Requirement: Screenshot concepts inform style without broad feature creep

The HUD polish SHALL use the existing screenshot concept audit as style/layout intent, especially:

- `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png`
- `docs/UI-Screenshots/06-ui-konzeptuebersicht-cockpit-navigation-systeme.png`
- `docs/UI-Screenshots/10-autopilot-route-asteroidenfeld.png`
- `docs/UI-Screenshots/27-drohnenwarnung-konvoi-route.png`
- `docs/UI-Screenshots/33-autopilot-plan-ungueltig-route.png`

#### Scenario: Concept adaptation

- Given concept imagery suggests edge instruments, route/target emphasis, and warning accents
- Then the browser HUD adapts those ideas using existing browser DOM/ViewModel/test patterns
- And it does not copy Unity IMGUI or introduce unscoped menu/planner/builder/cargo/surface systems

### Requirement: Responsive and accessibility contracts remain intact

The HUD SHALL remain usable at typical browser aspect ratios and preserve existing keyboard/focus and `aria-live` contracts.

#### Scenario: Responsive screenshot matrix

- Given viewports including 1280x720, 1440x900, 1024x768, 1920x800, and 760x640
- Then mode remains visible
- And edge panels do not meaningfully cover the `.hud-center-safe-area`
- And the primary route action remains reachable
