# Design: Browser Demo Scout GLB Visual Parity v1

## Decisions

### 1) Adapter boundary
`shipVisual.ts` remains the boundary that chooses between GLB-backed visuals and the procedural fallback. It consumes simulation state and visual metadata, but never becomes a source of flight truth.

### 2) Async deterministic state
The visual pipeline uses explicit, monotonic states: `Loading`, `GLBLoaded`, `GLBFailedFallback`, and `ProceduralFallback`. State transitions are deterministic and observable so tests can wait for a known condition instead of timing guesses.

### 3) Marker fallback via manifest
Marker lookup prefers GLB node names first. If a marker is absent or invalid, the visual layer falls back to a manifest-defined marker mapping so VFX binding remains stable even when the asset is incomplete.

### 4) Axis and scale convention
Authoring convention is normalized in render space only: `+X` forward, `+Y` up, `±Z` lateral. Any axis correction and scale adjustment happens in the visual adapter; physics, pathing, and serialized flight state stay untouched.

### 5) Flight truth isolation
The renderer may correct orientation and scale for display, but it must not write those corrections back into the planner, executor, or movement truth. The visual layer is a projection of state, not the state itself.

### 6) E2E wait strategy
End-to-end tests wait on explicit visual-source / marker-ready metadata and a stable scene identifier instead of sleeps or pixel timing. This keeps screenshots and assertions deterministic across GLB and fallback modes.

### 7) Evidence surface
HUD and TestBridge expose the same visual-source summary so the user-facing line and automated checks agree on the active ship visual path.
