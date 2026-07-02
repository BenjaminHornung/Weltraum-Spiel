# browser-autopilot-lifecycle-render-smoothing-v1

Fix the browser autopilot lifecycle after terminal capture so completed Holding does not keep an active route lock, while preserving no-silent-replan and no-snap invariants. Add presentation-only fixed-step interpolation and dt-corrected camera smoothing to reduce visible browser jitter without mutating flight truth.

## Constraints

- Browser app only; no Unity startup and no `Assets/**` edits.
- No silent replan, no target/waypoint snap, no velocity-zero shortcut.
- Renderer and camera are presentation consumers only; TestBridge/HUD/route/target/VFX remain owner-truth consumers.
