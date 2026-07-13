# Spec: PlayMode Bootstrap Contamination

## Requirements

- The editor must be recoverable from ignored `Assets/InitTestScene*.unity` artifacts without touching tracked `_Recovery` scenes.
- Runtime auto-bootstrap must not create normal game state inside Unity TestRunner scenes.
- With domain reload disabled, bootstrap session state must reset on subsystem registration.
- In real game scenes, missing runtime roots after startup must trigger at most one guarded rebuild.
- Required runtime roots are `PrototypeShip`, `Main Camera`, `PrototypeNavigationWaypoints`, `PrototypeEnvironment`, and `PrototypePveArenaLoop`.
- HUD may display explicit unbound diagnostics if runtime roots are genuinely absent, but normal game startup should self-repair before settling into an unbound state.

## Scenarios

- Starting Play from `SampleScene` keeps ship, environment, arena targets, waypoints, camera, and HUD binding alive through early frames.
- Starting a PlayMode test in `InitTestScene*` does not auto-create a game `PrototypeBootstrap`.
- If a root disappears shortly after bootstrap, one rebuild restores the runtime state and records the reason.
- Runtime HUD/camera tests do not delete scene-global roots after completion.
