# Behavioral Spec: Browser Demo Scout GLB Visual Parity v1

## Purpose
Render the scout ship from the GLB when available, preserve the procedural fallback, and surface deterministic evidence for the active visual source without changing simulation truth.

## Required behaviors

### 1) GLB load path
- The visual layer attempts to load `demo_scout_mk1.glb`.
- While the asset is loading, the visual source state is `loading`.
- If the GLB loads successfully, the state becomes `glbReady` and the ship renders from the GLB-backed mesh.
- If the GLB cannot be loaded, the system falls back to the procedural ship and records the fallback reason.

### 2) Fallback behavior
- Fallback must not block the scene or suppress the ship.
- The procedural path remains available as the safety net.
- A failed or missing GLB does not change simulation state, camera behavior, or input handling.

### 3) Visual source states
- The active visual source is observable and stable enough for tests to wait on.
- Valid states are at least: `loading`, `glbReady`, `fallback`, and `error`.
- The HUD and TestBridge expose the same active visual-source value.

### 4) Markers
- Marker resolution is explicit and deterministic.
- Each logical marker resolves from the GLB first, then from the manifest fallback map.
- If a marker is still unavailable, the state is reported as missing rather than silently substituted with unrelated geometry.

### 5) Axis and scale metadata
- The active visual state exposes the imported axis/scale metadata used for correction.
- Visual correction is render-only and does not alter flight truth.
- The coordinate convention reported for the visual layer is `+X` forward, `+Y` up, and `±Z` lateral.

### 6) VFX marker binding
- VFX anchor binding uses the resolved marker registry.
- The chosen binding source is visible to tests and evidence output.
- A missing marker falls back predictably; it must not cause a silent success path.

### 7) ChaseLocked anchor
- The ChaseLocked anchor remains available as a stable visual attachment point.
- The anchor follows the visual ship representation, not the other way around.
- Its resolved source is included in evidence metadata.

### 8) HUD visual-source line
- The HUD shows one concise line for the active visual source.
- The line includes whether the ship is GLB-backed, procedural fallback, or still loading.
- The line must remain visible whenever the HUD is visible.

### 9) TestBridge / evidence metadata
- TestBridge exposes the active visual source, marker readiness, axis correction metadata, scale metadata, and fallback reason.
- Evidence consumers can wait on these fields before taking screenshots.
- The metadata must remain stable across identical runs.

### 10) Existing invariants
- Renderer output does not become flight truth.
- No silent replan is introduced.
- Stable planHash behavior is preserved.
- Snap/drift preservation semantics remain unchanged.
- Procedural fallback remains available.

## Acceptance criteria
- A successful GLB load visibly changes the ship source to GLB-backed mode without changing the ship's flight behavior.
- A GLB failure visibly and deterministically falls back to the procedural ship.
- Marker and anchor metadata are available for both the HUD and TestBridge.
- Tests can wait on explicit state instead of arbitrary timing.
