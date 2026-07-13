# Proposal: Fix PlayMode TestScene Bootstrap Contamination

## Motivation

After recent PlayMode verification the Unity Editor can remain in an ignored `Assets/InitTestScene*.unity` scene with a `Code-based tests runner`. In that state the game briefly shows the correct bootstrap output and then loses the runtime ship, environment, arena, and bound HUD values.

## Outcome

Normal game startup must return to `SampleScene` and keep the runtime roots alive after the first frames. PlayMode tests must not leave stale scene or cleanup state that makes the next manual Play run appear empty.

## Scope

- Recover the editor from TestRunner scenes.
- Make `PrototypeBootstrap` robust with disabled domain reload.
- Prevent runtime auto-bootstrap inside Unity TestRunner scenes.
- Add a bounded watchdog that can rebuild missing runtime roots once in real game scenes.
- Narrow the runtime HUD/camera PlayMode test cleanup so it cannot delete global game roots in the TestRunner scene.

## Non-Goals

- No FlightPlan/autopilot behavior changes.
- No new gameplay UI.
- No changes to tracked `_Recovery` scenes or unrelated dirty evidence files.
