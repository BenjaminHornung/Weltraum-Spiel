# Capability: Camera Anchor Framing

## Requirements

### Requirement: Prefer Semantic Focus
The follow camera must prefer semantic focus points before renderer bounds.

#### Scenario: Anchor exists
- GIVEN a target ship has a `PrototypeCameraAnchor`
- WHEN the camera computes its focus point
- THEN it uses the highest-priority anchor
- AND reports focus source `Anchor`.

#### Scenario: No anchor with Rigidbody
- GIVEN a target ship has no camera anchor but has a Rigidbody
- WHEN the camera computes its focus point
- THEN it uses `Rigidbody.worldCenterOfMass`
- AND reports focus source `CenterOfMass`.

#### Scenario: No anchor or Rigidbody
- GIVEN a target has renderers but no anchor or Rigidbody
- WHEN the camera computes its focus point
- THEN it may fall back to visual bounds center.

### Requirement: Keep Visual Bounds for Distance
Visual bounds must influence fit distance without moving semantic focus when anchor or center of mass exists.

#### Scenario: Off-center renderer with anchor
- GIVEN an off-center visual renderer and a centered camera anchor
- WHEN the camera reframes visual bounds
- THEN base/effective distance may change for fit
- BUT focus remains on the anchor.

#### Scenario: Zoom along focus ray
- GIVEN an off-center renderer and semantic focus
- WHEN zoom changes
- THEN the camera preserves the view ray to the semantic focus point.

### Requirement: Bootstrap Camera Correctly
Prototype bootstrap must reliably bind the camera to the gameplay ship.

#### Scenario: Exactly one active Main Camera
- GIVEN bootstrap builds the prototype scene
- WHEN camera setup completes
- THEN exactly one active camera is tagged `MainCamera`.

#### Scenario: Stale target overwritten
- GIVEN an existing Main Camera has a stale follow target
- WHEN bootstrap sets up the scene
- THEN the follow camera is bound to the current `PrototypeShip`.

### Requirement: Visual Switching Must Not Break Focus
Imported visuals must remain gameplay-ship children and must not redefine the semantic focus.

#### Scenario: Imported visual child
- GIVEN visual switching selects an imported ship visual
- WHEN the visual is instantiated
- THEN it is a child of `PrototypeShip/ImportedShipVisual`
- AND it moves when the ship moves.

#### Scenario: Manager object remains invisible and nonphysical
- GIVEN the runtime visual switcher manager exists
- WHEN it is inspected
- THEN it is named `PrototypeShipVisualSwitcher_Manager`
- AND has no Renderer, Collider, or Rigidbody components.

### Requirement: Report Camera Diagnostics
Camera debug surfaces must expose focus and bounds state.

#### Scenario: Diagnostics
- GIVEN the follow camera is bound to a target
- WHEN diagnostics are refreshed
- THEN they report camera mode, focus source, focus point, visual bounds center, visual bounds radius, effective distance, zoom, and target name.

