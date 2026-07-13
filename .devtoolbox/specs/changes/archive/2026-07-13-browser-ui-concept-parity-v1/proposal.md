# browser-ui-concept-parity-v1

## Motivation

The Browser/Three.js runtime has become playable and evidence-backed, but the player-facing HUD still reads as a functional debug/gameplay overlay. The concept screenshots in `docs/UI-Screenshots` define a stronger hard-sci-fi direction for flight, navigation planning, and combat/contact presentation.

## Outcome

Move the real browser UI closer to the concept targets while preserving normal runtime behavior, live flight acceptance, navigation objectives, objective chain progress, and the existing autopilot invariants.

## Scope

- Redesign the browser flight HUD presentation around concept 02 structure: left ship status stack, bottom-left radar, right target/autopilot/navigation stack, cyan translucent angular panel language, and clear center flight space.
- Add or polish a player-facing navigation planner screen inspired by concept 03 using existing runtime route preview/target data.
- Add a combat/contact HUD presentation shell inspired by concept 07 without claiming real combat gameplay in default runtime.
- Add Playwright evidence and structural layout checks that run against normal product URLs and generated screenshots.
- Record visual audit and parity evidence under `apps/weltraum-browser/evidence`.

## Non-Goals

- No Unity scene, `Assets/**`, package, or lockfile changes.
- No full combat, economy, mining, mission, or renderer-truth systems.
- No TestBridge exposure by default and no TestBridge use for the UI parity test.
- No changes that fake distance reduction, snap ship position, zero velocity, globally raise acceleration, or weaken route lock, terminal capture, planHash, no-silent-replan, or objective progression behavior.
