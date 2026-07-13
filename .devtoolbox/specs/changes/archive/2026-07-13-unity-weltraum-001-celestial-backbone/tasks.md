# Tasks

- [x] Inspect existing runtime, large-world, bootstrap, test, and assembly-definition patterns; confirm the target folder, no-new-asmdef decision, baseline test status, and catalog loading approach before implementation.
- [x] Record the implementation constants/decisions in code or tests: `G = 6.67430e-11`, `1%` mass/`mu` relative tolerance, full concept `CelestialBodyType` enum scope, and `[Serializable]` `AbsoluteState` shape.
- [x] Add the celestial data model types for body definitions, body type, orbit data, gravity data, visual scale data, frame identity, and absolute state; add only tiny tested `LargeWorldVector3d` math helpers if needed.
- [x] Add the `CelestialBodyCatalog` ScriptableObject type and create the starter catalog asset at `Assets/Resources/Prototype/Celestial/AureliaSystemCelestialCatalog.asset`.
- [x] Seed the starter Aurelia-system catalog asset for `star.aurelia`, `planet.hestia`, `moon.hestia.luma`, and `asteroid.eber` using real units from the concept docs.
- [x] Implement catalog validation for ID format/uniqueness, parent existence, radius, mass or `mu`, mass/`mu` tolerance, orbit plausibility, and visual scale availability.
- [x] Implement deterministic registry lookup and debug summary output without wiring existing autopilot, flight, HUD, or weapon systems to the catalog.
- [x] Add minimal placeholder debug visualization or registry component so loaded bodies can be inspected in Unity without becoming final System Map UI.
- [x] Add focused EditMode tests for the actual catalog asset load, starter catalog validity, validation failures, body type coverage, registry lookup, deterministic debug summaries, and absolute-state double precision.
- [x] Record test evidence under `.devtoolbox/specs/changes/weltraum-001-celestial-backbone/tests/` and update any narrow concept/readme reference needed for discoverability.
- [x] Run verification: Unity MCP script validation/compile/console check, targeted new EditMode tests, `FloatingOriginValidationTests`, a PlayMode smoke suite such as `PrototypeAutopilotNavigationPlayModeTests` when available, `dotnet build "Weltraum Spiel.sln" --no-restore`, and DevToolbox spec validation.
