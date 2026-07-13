# Design

## Why this change
weltraum-002 is a prototype-only execution map and debug view slice. It needs to prove data-to-visual workflows from weltraum-001 contracts without changing player-facing navigation or control systems.

## Design choices

### 1) Orbital math and map generation
There are two implementation paths: precomputed map points at runtime or dynamic sampling from `OrbitDefinition` each frame. This plan chooses runtime sampling during debug view refresh so that visual artifacts directly reflect current catalog values and scale constraints.

The key boundary is that computed map coordinates use a scaled map-space coordinate system while orbit parameters and positions remain stored in SI real values (meters). The map system must keep both outputs explicit:

- analytical position: derived from `OrbitDefinition` and reported in real units for calculations and debug lines
- map points: derived transform from real units to display space using a map scale profile that is clearly separate

### 2) Data contracts and reuse
Existing weltraum-001 contracts are mandatory:

- `OrbitDefinition` remains source for analytical orbit values and parent/body linkage
- `CelestialBodyDefinition` + catalog + registry remain source of truth for body list and IDs
- `AbsoluteState` stays the canonical state data shape using `LargeWorldVector3d`
- `VisualScaleProfile` is used only for display scaling

No new catalog source should be introduced.

### 3) Runtime reuse and layering
Runtime files stay in `Assets/Scripts/Prototype/Celestial/`. If a lightweight helper is needed, it should live beside that runtime, consume existing types, and avoid shared service coupling to HUD/autopilot.

### 4) Debug viewer pattern
If UI is needed, this plan uses a self-contained `MonoBehaviour` and IMGUI window pattern similar to other prototype debug overlays, with `PrototypeUiWindowState` and `PrototypeUiLayoutManager` for persistence and layout.

Constraints:
- no dependency on `PrototypePlayerHudRenderer`
- no route execution controls
- no integration to final System Map interaction model

This approach lets reviewers compare real values and map values while keeping this slice removable for later production UI.

## Test and verification placement
- New EditMode tests for orbit map behavior and projection/scale assertions under `Assets/Tests/Editor/`.
- Existing regression anchors:
  - `FloatingOriginValidationTests`
  - `CelestialRuntimeValidationTests` (or the relevant existing baseline test group in the workspace)
- Optional visible UI evidence collection under `.devtoolbox/specs/changes/weltraum-002-orbit-map-prototype/tests/`.

## Risks and tradeoffs
- Orbit sampling and line rendering can hide scale confusion if the relationship between real meters and map units is not explicitly surfaced in readouts.
- Prototype map visuals can accidentally become a de-facto shipping UI if not explicitly bounded.
- Any route/UI control work added early can conflict with non-goals and should be deferred.

## Z.AI gate plan
- `zai-review-glm51` must review runtime boundary and map data separation before implementation begins.
- `zai-ui-glm51` must review debug viewer/readout approach before UI implementation.
- `zai-ui-glm51` must review again after first visible UI evidence is captured.
