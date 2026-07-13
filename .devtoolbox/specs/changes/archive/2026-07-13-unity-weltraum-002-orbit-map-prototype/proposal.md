# Proposal

## Goal
Implement the planning artifact for weltraum-002 as the next development slice after weltraum-001: a prototype orbit map/runtime slice that visualizes analytical OrbitDefinition data for `star.aurelia`, `planet.hestia`, `moon.hestia.luma`, and `asteroid.eber`.

## Motivation
weltraum-001 establishes the physical and catalog contracts. The next slice is to prove how those contracts appear in map space by rendering debug orbit lines and state readouts from real orbital definitions, while keeping runtime and visual scales explicit and separate.

## Scope
- Create and execute DevToolbox scaffolding for weltraum-002 only.
- Define implementation scope for runtime map-prototype behavior and debug visibility.
- Keep implementation bounded to a minimal prototype viewer without final Player HUD or full System Map UX integration.
- Reuse existing starter catalog asset source and preserve weltraum-001 data contracts.
- Document verification and review gates, including required Z.AI lanes.

## Non-goals
- No final Player HUD/System Map UX integration.
- No autopilot execution wiring.
- No timewarp.
- No drone behavior.
- No route execution or travel system coupling.

## Preserved weltraum-001 contracts and constraints
- Use existing `CelestialBodyCatalog`, `CelestialBodyRegistry`, `CelestialBodyDefinition`, `OrbitDefinition`, `AbsoluteState`, `LargeWorldVector3d`, `GravityDefinition`, and `VisualScaleProfile`.
- Use `Assets/Resources/Prototype/Celestial/AureliaSystemCelestialCatalog.asset` as the single catalog source.
- Keep runtime implementation in `Assets/Scripts/Prototype/Celestial/`.
- Keep tests under `Assets/Tests/Editor/`.
- Avoid `PrototypePlayerHudRenderer` and avoid final HUD route/autopilot/timewarp integration.
- Keep debug UI self-contained, where needed.

## Success criteria
- The plan is scoped as weltraum-002, with clear requirements, design decisions, and ordered tasks.
- Requirements explicitly cover analytical orbit positions from `OrbitDefinition`, real-meter data, scale separation, debug orbit lines, and debug readouts.
- A concrete execution path is documented for Z.AI reviews, verification commands, and evidence locations.
- `specs_validate` passes on this scaffold.

## Notes
- weltraum-002 is intentionally a prototype slice and does not include user-visible shipping polish.
