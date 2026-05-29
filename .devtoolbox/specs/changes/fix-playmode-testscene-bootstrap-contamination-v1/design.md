# Design: PlayMode TestScene Bootstrap Contamination

## Root Cause

The editor was observed in `Assets/InitTestSceneeddf73b2-278d-4020-84b3-62a0d4d68df8.unity` while Play Mode was active/changing. The scene contained `Code-based tests runner`, `Main Camera`, waypoints, and a test target, but no `PrototypeBootstrap`, `PrototypeShip`, `PrototypeEnvironment`, or `PrototypePveArena`. Project settings also use Enter Play Mode Options with domain reload disabled, so stale static/runtime state can survive across Play starts.

## Approach

`PrototypeBootstrap` remains the single runtime construction point. The fix adds guardrails around when automatic bootstrapping is allowed and a small post-build integrity check for real game scenes.

- Reset static bootstrap state on `SubsystemRegistration`.
- Treat `InitTestScene*` and active `PlaymodeTestsController` scenes as TestRunner contexts.
- Skip automatic runtime bootstrap in TestRunner contexts.
- After a real build, check required roots after short frame delays.
- If roots disappeared, log the missing roots and run one guarded rebuild.
- Keep PlayMode test cleanup limited to test-owned objects.

## Tradeoffs

A one-time watchdog is safer than a permanent repair loop: it catches the flicker/disappearing-root failure without masking repeated destruction bugs. TestRunner scenes are excluded so automated tests can intentionally create and destroy temporary roots.
