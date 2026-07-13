# Design

## Approach
Build a narrow `Prototype/Celestial` runtime slice that defines serializable celestial data, one starter catalog asset, a validation service, and a registry facade for ID lookup and debug summaries.

The first implementation should prefer Unity-friendly serialized data for this slice while keeping the definitions as plain serializable types. That gives the project an inspector-editable catalog now and leaves room for later JSON/YAML import without changing consuming code.

## Data source choice
Use one catalog source for the starter data:

- `CelestialBodyCatalog` as a `ScriptableObject` containing definitions for Aurelia, Hestia, Luma, and Eber.
- Store the starter asset at `Assets/Resources/Prototype/Celestial/AureliaSystemCelestialCatalog.asset` so tests and optional runtime components can load the same asset deterministically during the prototype phase.
- Plain serializable classes/structs for `CelestialBodyDefinition`, `OrbitDefinition`, `GravityDefinition`, `VisualScaleProfile`, and `AbsoluteState`/frame identity.
- A small deterministic builder may exist for tests, but tests must also validate the actual `.asset` file so the asset cannot drift from the code path.

This chooses ScriptableObject first because the current project is Unity-first and has no existing JSON import path for gameplay data. The data shapes should remain import/export friendly so JSON can become canonical later.

## Explicit implementation decisions
- `AbsoluteState` should be a `[Serializable]` struct or equivalent plain data shape with `string referenceFrameId`, `LargeWorldVector3d positionMeters`, `LargeWorldVector3d velocityMetersPerSecond`, and `double epochSeconds`. It should not perform orbital propagation in this slice.
- `CelestialBodyType` should include the concept contract values from `celestial-runtime-data-contract.md`: `Star`, `RockyPlanet`, `SuperEarth`, `GasGiant`, `IceGiant`, `Moon`, `Asteroid`, `Comet`, `Station`, and `ArtificialStructure`.
- Gravity validation should use `G = 6.67430e-11 m^3 kg^-1 s^-2` and a `1%` relative tolerance for comparing rounded concept `mu` values against `G * massKg`.
- It is acceptable to add tiny pure math helpers/operators to `LargeWorldVector3d` if `AbsoluteState` tests or validation need them. Do not change `FloatingOriginManager` or `FloatingOriginBody` behavior for this slice.
- Do not add a new `.asmdef` for the celestial folder unless inspection finds an existing project convention that requires one.

## Integration points
- Place runtime scripts under `Assets/Scripts/Prototype/Celestial/` or an equivalent narrow prototype folder.
- Place focused EditMode tests under `Assets/Tests/Editor/`.
- Reuse `LargeWorldVector3d` for double-precision absolute positions and velocities where practical.
- Keep `FloatingOriginManager` and `FloatingOriginBody` unchanged unless a tiny additive reference-frame type is needed.
- Keep `PrototypeTrajectoryPlanner`, `PrototypeWaypointAutopilot`, HUD, and weapon systems isolated from the new catalog in this first slice.

## Starter data
Seed only the minimal bodies needed for the backbone:

| ID | Type | Parent | Source |
| --- | --- | --- | --- |
| `star.aurelia` | Star | none | `startsystem.md` section 4 |
| `planet.hestia` | SuperEarth | `star.aurelia` | `startsystem.md` sections 5 and 6 |
| `moon.hestia.luma` | Moon | `planet.hestia` | `startsystem.md` section 6.7 |
| `asteroid.eber` | Asteroid | `star.aurelia` | `startsystem.md` section 8 |

The implementation should store real units as meters, kilograms, seconds, and `m^3/s^2`. Visual scale fields may be approximate because this slice validates separation, not final map art.

## Validation strategy
`CelestialBodyCatalogValidator` should return structured validation results instead of logging-only failures. Tests should cover at least:

- duplicate IDs
- invalid ID format
- missing parent
- invalid radius
- missing mass and `mu`
- inconsistent mass/`mu`
- missing or invalid visual scale
- starter catalog asset loads and validates cleanly
- debug summary order is deterministic

Use the explicit gravitational constant and tolerance from the implementation decisions so validation is reproducible.

## Debug visibility
Add a small debug summary API and optional placeholder visualizer/registry component. Debug output should make the distinction between real values and visual scale obvious, but this change should not build a final player-facing map panel.

## Baseline and verification
Before implementation changes, capture a current baseline for the relevant Unity test surface if feasible. At minimum, record `specs_validate` status and the availability/status of the existing EditMode and PlayMode smoke suites used for comparison.

Final verification should include Unity MCP script validation or compile/console checks, targeted new EditMode tests, catalog asset load validation, relevant existing large-world tests such as `FloatingOriginValidationTests`, a PlayMode smoke suite such as `PrototypeAutopilotNavigationPlayModeTests` when available, `dotnet build "Weltraum Spiel.sln" --no-restore`, and DevToolbox spec validation.

## Reuse decision
The existing floating-origin large-world infrastructure already proves absolute/local state separation. This change should extend that idea with body/frame identity and catalog-backed celestial data instead of creating another coordinate foundation.

## Risks
- Concept values are rounded, so validation tolerance must avoid false failures while still catching bad data.
- ScriptableObject assets can drift if tests construct a separate seed; tests must validate the actual catalog asset or a single shared seed path where possible.
- Adding catalog references to flight or autopilot code too early would increase regression risk. Keep this slice opt-in.
