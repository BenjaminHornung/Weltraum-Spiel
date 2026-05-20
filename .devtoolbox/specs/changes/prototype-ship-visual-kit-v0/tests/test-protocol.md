# Test Protocol: prototype-ship-visual-kit-v0

## Verification evidence
- `specs_validate` passed after spec creation; will be rerun after this protocol update.
- `unity validate_script` passed for:
  - `PrototypeBootstrap.cs`
  - `PrototypeShipPartVisualFactory.cs`
  - `PrototypeShipVisualSwitcher.cs` *(3 analyzer warnings remain: existing `GameObject.Find`, `FixedUpdate`, and string concatenation patterns)*
  - `PrototypeModuleColorPalette.cs`
  - `PrototypeTestEnvironment.cs`
  - `PrototypeShipVisualSwitcherValidationTests.cs`
  - `PrototypeTestEnvironmentValidationTests.cs`
- `refresh_unity` + `read_console`: compile requested; final PlayMode console ended with **0 warnings, 0 errors**.
- `dotnet build 'Weltraum Spiel.sln' --no-restore` succeeded with only known Unity/MCP reference and obsolete API warnings.

## Test run results
- Unity **EditMode** tests:
  - `PrototypeShipVisualSwitcherValidationTests` **6/6**
  - `PrototypeTestEnvironmentValidationTests` **8/8**
  - `PrototypePhysicsValidationTests` **27/27**
- Earlier full EditMode suite contained failures in unrelated autopilot/waypoint tests, outside visual-kit scope:
  - `PrototypeAutopilotMomentumStartupStateTests` final approach state
  - `PrototypeWaypointAutopilotValidationTests` (multiple `NullReferenceException`, fuel, waypoint failures)
  - Likely due to existing/parallel autopilot worktree drift.

## Runtime probe (post-final patch)
- `ship=True`, `rootEnabled=0`, `kitEnabled=37`, `importedRenderers=0`, `activeDemo=0`, `orientationMarkers=False`, `worldAxes=False`, `mainNozzle=True`, `rcsNozzles=20`, `muzzle=True`, `components=True/True/True/True`, `dirLight=1.20`.

## Screenshots
- `.../tests/screenshots/playmode-baseline-ship-generated-kit-readable-close.png` (final close readable baseline)
- Optional: earlier exploratory screenshots are available in the same `screenshots/` folder.

## Sichtprüfung
- Dark hull.
- Orange/red cockpit/canopy cue.
- Green/cyan RCS pods.
- Blue main engine bell/nozzle.
- Yellow gun barrel/muzzle.
- No large debug axes/markers in final baseline.
- Generated kit active; imported visuals inactive.

## Verification coverage
- RCS nozzles remain **20** and components are present.
- Muzzle is present.
- `MainThrusterNozzle` is present.
- `EngineVfxController` is present.

## Known limitations
- Baseline variant has no visible cargo/utility block.
- Heavy Cargo metadata/test covers cargo and hardpoint-marker behavior.
- Full suite remains blocked by unrelated autopilot failures (outside the visual-kit scope).
