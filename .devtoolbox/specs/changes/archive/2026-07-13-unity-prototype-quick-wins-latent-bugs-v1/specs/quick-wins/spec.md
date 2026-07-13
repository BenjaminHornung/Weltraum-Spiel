# Capability: Prototype quick wins and latent bug fixes

## Requirements

### Fixed timestep correctness
- The waypoint autopilot shall advance autopilot and flight-plan clocks by the current Unity fixed timestep when `Time.fixedDeltaTime` is positive.
- The waypoint autopilot may fall back to `0.02` seconds only when `Time.fixedDeltaTime` is not positive.
- All existing autopilot behavior shall remain otherwise unchanged.

### Planner dead branch cleanup
- The trajectory planner shall not contain duplicated avoidance/non-avoidance branches when both branches produce identical segment arrays.
- Existing obstacle avoidance behavior shall remain unchanged unless the prior avoidance spec proves a missing behavior difference.

### HUD resource and per-frame performance
- The player HUD shall not repeatedly call `Resources.Load<CelestialBodyCatalog>` every frame after an unsuccessful automatic catalog lookup.
- The player HUD radar shall prefer registered waypoint-manager targets and shall not scan all loaded resources for navigation targets each frame.
- The player HUD shall avoid rebuilding text-heavy snapshots and assigning TMP text every rendered frame while preserving per-frame marker, reticle, and radar positioning.

### Floating origin shift safety
- Floating-origin shifts shall publish the applied shift vector to interested systems.
- During an active or prepared autopilot plan, a floating-origin shift shall force the autopilot to invalidate/replan world-space route data rather than continuing stale absolute positions.
- Avoidance waypoint state shall be corrected or cleared so it cannot steer toward pre-shift world coordinates.

### Autopilot component caching
- The waypoint autopilot shall cache `RcsThrusterController` and `MainThrusterBank` lookups for the current `PlayerShipController`.
- The cache shall be invalidated and refreshed when the resolved ship controller changes.

### Housekeeping and audit
- Unity recovery artifacts under `Assets/_Recovery/` shall not remain imported as project assets.
- Repository ignores shall cover local IDE, upgrade-log, recovery, and artifact output folders.
- Remaining `Find*` call sites listed in `design.md` shall be classified by frequency, and only confirmed hot-path cases shall be changed.

## Expected Behavior

- Lowering `Time.fixedDeltaTime` below `0.02` shall not make autopilot or flight-plan timers expire faster than physics time.
- Existing obstacle avoidance tests shall continue to pass after planner cleanup.
- Missing optional HUD catalog assets shall cause at most one automatic load attempt per bind cycle.
- HUD text may refresh at a sampled cadence, but target indicators and radar/marker positions shall remain responsive per frame.
- After an origin shift, the autopilot shall mark plan data dirty and request a fresh plan instead of following stale world-space data.
- The fixes shall be covered by focused tests where practical and by evidence notes under this change's `tests/` directory.

## Constraints

- Keep fixes local to the concrete files and behaviors described in `design.md`.
- Do not fold in the broader autopilot fidelity change, planner UI overhaul, or regression harness work.
- Preserve existing public behavior unless a requirement above explicitly changes it.
