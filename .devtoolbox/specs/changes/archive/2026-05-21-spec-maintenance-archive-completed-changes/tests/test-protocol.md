# Test Protocol: spec-maintenance-archive-completed-changes

Date: 2026-05-21
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

## Goal Contract Source

- Requested source: `docs/codex-goals/WELTRAUM_CODEX_GOALS.md`.
- Result: file not found in the working tree, git history, fetched remote refs, or nearby `E:\Unity` paths.
- Fallback input used for this maintenance run: the explicit `/goal` text from the conversation plus local DevToolbox drafts and changes.

## Baseline

- `workspace_discover`: passed; internal specs root found at `.devtoolbox/specs`.
- `mcp_self_check`: passed with warning that `SERVICERUNNER_WORKSPACE_ROOT` is not set.
- Whole-workspace `specs_validate`: failed before archive due to missing proposal/spec/tasks in:
  - `fix-flight-control-jitter-regression-v1`
  - `player-facing-ui-concept-v0`

## Archive Results

### Archived Through DevToolbox

All entries below were moved with `specs_archive_change` on 2026-05-21. Each call returned success with the standard warnings: the folder was moved into the internal archive and no main-spec synchronization was performed.

- `architecture-flight-assist-layer`
- `architecture-fuel-mass-flow`
- `architecture-main-thrust-modes`
- `architecture-module-mass-com-inertia`
- `architecture-sas-pd-control`
- `architecture-thruster-response-model`
- `combat-impact-damage-physics`
- `combat-projectile-recoil-sweep`
- `docking-physics-system`
- `environment-atmosphere-layer`
- `fix-autopilot-momentum-startup-state`
- `fix-blender-ship-kit-unity-import-vfx`
- `fix-chase-camera-stability`
- `fix-flight-control-jitter-regression-v1`
- `fix-imported-ship-camera-f6-performance-v1`
- `fix-physics-consistency-regressions`
- `fix-projectile-performance-v1`
- `fix-rcs-spool-status-velocitychange`
- `fix-reset-flight-state`
- `infrastructure-floating-origin-large-world`
- `performance-job-system-runtime-phases-v2`
- `performance-stability-hotpath-cleanup-v1`
- `physics-gravity-orbits`
- `player-facing-ui-concept-v0`
- `power-heat-thermal-architecture`
- `prototype-autopilot-arrival-tuning-v1`
- `prototype-autopilot-navigation-computer-v2`
- `prototype-blender-low-poly-module-kit-v0`
- `prototype-camera-anchor-framing-v1`
- `prototype-camera-control-framing-v0`
- `prototype-debug-console-navball-ship-variants`
- `prototype-flight-tuning-diagnostics`
- `prototype-module-configs`
- `prototype-navigation-computer-obstacle-trajectory-v1`
- `prototype-ship-physics-core`
- `prototype-ship-visual-kit-v0`
- `prototype-target-hit-feedback`
- `prototype-test-environment-ui-pass`
- `prototype-ui-readability-testability-pass`
- `prototype-waypoint-navigation-autopilot-v0`
- `thruster-rcs-flight-controls`
- `trajectory-preview-burn-planner`
- `validation-physics-test-suite`

### Skipped Active Changes

- `combat-weapon-computer-turret-mode-v0`: completed and archive-ready, but intentionally left active for the selected combat continuation checkpoint and fresh Unity/DevToolbox verification.
- `spec-maintenance-archive-completed-changes`: this protocol is still being updated.

### Blocked Or In-Progress Changes

These were not archived because their tasks are incomplete or their status is in progress:

- `add-autopilot-obstacle-avoidance-v1`: 0/4 tasks.
- `fix-functional-blender-ship-vfx-turret-v1`: 0/20 tasks.
- `fix-prototype-ui-performance-v1`: 15/16 tasks.
- `fix-prototype-usability-flight-feel`: 39/64 tasks.
- `fix-weapon-targeting-and-recoil-stability-v1`: 0/8 tasks.
- `performance-data-oriented-runtime-architecture-v1`: 30/32 tasks.
- `prototype-functional-ship-part-sockets-v0`: 10/70 tasks.

## Post-Archive Validation

- Whole-workspace `specs_validate`: passed.
- `specs_list_changes`: active top-level changes now consist of the maintenance change, the selected completed combat change, and incomplete/in-progress changes only.
- DevToolbox `verify_run` for execution `8cab6d94993041128db90941bf1d29b0`: spec validation step passed; generic Build/Test/Lint steps failed because they run `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` in a Unity root with multiple solution/project files.
- Explicit solution verification:
  - `dotnet build "Weltraum Spiel.sln" --no-restore`: passed with existing warnings.
  - `dotnet test "Weltraum Spiel.sln" --no-build`: exited 0.
  - Unity MCP editor state: ready for tools, not compiling.
- Explicit `dotnet format "Weltraum Spiel.sln" --verify-no-changes --no-restore`: failed on pre-existing whitespace findings in `PrototypeShipLayout.cs`, `PrototypeFlightHud.cs`, `PrototypeMomentumAssist.cs`, `PrototypeWaypointAutopilot.cs`, and `Assets/TutorialInfo/Scripts/Editor/ReadmeEditor.cs`; these were not introduced or modified by this maintenance checkpoint.
- No Unity gameplay scripts, scenes, prefabs, materials, generated visuals, or imported art were changed by this maintenance checkpoint.
