# trajectory-preview-burn-planner

## Why

Precise spaceflight becomes more playable when the player can preview where the ship will go and what a burn will do. Prediction must use the same physics assumptions as actual simulation to avoid lying to the player.

## What

Define a future trajectory preview and burn planner that simulates future state for a bounded number of steps using the same gravity/thrust/environment formulas as the ship physics model.

## Out of Scope

- No orbital map UI in this first spec.
- No maneuver-node editor.
- No multiplayer prediction.
- No final rendering style.
- No implementation before gravity/floating-origin foundations are ready unless limited to local debug.

## Success Criteria

- Prediction reuses shared physics formulas.
- Preview can simulate future position/velocity for fixed steps.
- Burn preview can show approximate delta from planned thrust input.
- Diagnostics show prediction assumptions and error checks.
- The feature can remain debug-only until UI is designed.
