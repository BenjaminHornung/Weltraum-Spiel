# Browser Flight HUD Polish v1

## Motivation

The browser/Three.js mainline already has a functional Browser Flight UI foundation with separated edge HUD regions, hidden diagnostics, TestBridge gating, and screenshot-informed evidence. The next step is to polish the player-facing HUD so the normal flight view feels closer to the intended space-sim presentation while remaining functional, readable, and testable.

## Desired outcome

- Player HUD hierarchy is clearer at a glance: flight/control mode, ship state, navigation/target/route/autopilot state, warnings, and one contextual route action.
- Debug and diagnostic details stay visually and structurally separate from the player HUD.
- Center flight path visibility remains protected; no large text blocks or opaque panels cover the ship/target/route view.
- Screenshot concepts guide the style without copying Unity UI or changing browser flight truth.

## Scope

Allowed implementation is limited to browser HUD/presentation files, HUD-related tests, HUD evidence, and small HUD docs/evidence references if necessary:

- `apps/weltraum-browser/index.html`
- `apps/weltraum-browser/src/ui/statusHud.ts`
- `apps/weltraum-browser/src/style.css`
- `apps/weltraum-browser/src/main.ts` only if needed for HUD wiring
- `apps/weltraum-browser/tests/e2e/**` HUD/UI related tests
- `apps/weltraum-browser/tests/unit/**` HUD/UI related tests
- `apps/weltraum-browser/evidence/**` HUD evidence only
- `docs/browser-mainline/**` only for HUD documentation/evidence link refreshes

## Non-goals

- No `Assets/**` edits and no Unity startup.
- No autopilot planner, executor, route-truth, terminal-capture, lifecycle, long-range testfield, or flight-core behavior changes.
- No TestBridge exposure by default.
- No player-facing completed route hash or raw internal solver/debug clutter.
- No removal or weakening of Demo Scout GLB or ProceduralFallback support.
- No full app-shell redesign, new map/planner UI, cargo/economy/surface/builder features, or large refactors.

## Evidence expectations

Verification must include `npm run test`, `npm run build`, focused HUD/browser E2E, and full browser E2E unless an environment blocker is documented. Screenshot evidence should include normal in-flight HUD, autopilot-active HUD, arrival/holding if stable, and optionally debug-vs-player separation.
