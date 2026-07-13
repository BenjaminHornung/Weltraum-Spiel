# player-target-indicators-v1

## Problem

The Player HUD now has real context panels and a radar/minimap, but the play space itself still feels blind. The current center marker only shows a generic target direction near the navball-style reticle. It does not put brackets, diamonds, distance labels, or offscreen arrows on the actual world targets the player is expected to fly to, fight, or dock with.

## Outcome

Selected navigation, combat, docking, and active objective targets become visible directly in the player view. The player should be able to connect a context panel or radar blip to a visible object without reading debug windows.

## Scope

- Add a player-facing target-indicator snapshot built from existing HUD/radar/navigation/combat/docking/arena data.
- Render onscreen brackets/diamonds and offscreen edge arrows in the existing Player HUD overlay canvas.
- Add compact labels for target name, distance, and combat/docking status where relevant.
- Keep the center flight reticle clean and avoid overlapping fixed panels across the tested aspect ratios.
- Add validation tests and Unity MCP screenshot evidence.

## Non-goals

- No interactive target selection menu in this change.
- No Navigation Computer or Weapon Computer control panel work in this change.
- No TextMeshPro migration in this change.
- No world-space GameObject marker prefabs; this remains a Screen Space Overlay HUD feature.
