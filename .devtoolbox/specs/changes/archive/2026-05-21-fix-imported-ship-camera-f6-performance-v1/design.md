# Design

## Problem Shape

The generated primitive ship has a small renderer/transform surface, so repeated hierarchy scans are tolerable. Imported Blender visuals are not the same scale of object: the validation report describes 473 objects, 266 meshes, and 101 connector/nozzle/muzzle empties. A design that treats those hierarchies as cheap transient lookup targets will regress immediately when F6 activates an imported visual.

The current hotpaths are:

- `SimpleFollowCamera.LateUpdate()` recalculates visual bounds by scanning all child renderers.
- `RcsThrusterController.ApplyControls()` refreshes nozzles in the physics loop and can scan the imported transform hierarchy.
- `PrototypeShipVisualSwitcher` destroys and instantiates imported visuals during repeated F6 cycles.

Unity local docs confirm that `Component.GetComponentsInChildren` recurses down all child GameObjects and can allocate arrays unless the list overload is used. `Renderer.bounds` is world-space and valid for rough framing, while `Rigidbody.worldCenterOfMass` is the world-space COM. The fix should therefore cache expensive discovery and keep camera/physics anchors explicit.

## Chosen Approach

### Camera Bounds Cache

`SimpleFollowCamera` will keep cached visual bounds and a dirty flag. Bound calculation may still use Unity renderers, but only on explicit invalidation points: target bind, reframe, F6 visual change, ship rebuild, or test/debug refresh. `LateUpdate()` uses cached values and refreshes only if dirty.

A small bounds participant/ignore marker can be introduced so VFX, muzzle flash, weapon clearance markers, debug rings, hidden generated primitive renderers, and labels do not inflate ship bounds. Name-based fallback filters cover existing imported/debug object names without requiring every prefab to be edited.

### Camera Focus Anchor

ChaseLocked must not chase the raw visual bounds center. The default flight pivot will be an explicit camera anchor if present, then rigidbody `worldCenterOfMass`, then `target.position`. Visual bounds can still influence fit distance and zoom safety. OrbitInspect, Side, and FreeInspect may use visual center for inspection framing.

Diagnostics will expose the focus source, visual radius, offset from COM, and effective distance so imported asset issues can be seen without profiling.

### F6 Visual Pooling

Imported Scout and Cargo visuals will be lazy-instantiated once and reused. Stripping physics/colliders from visual-only imports happens at first instantiate. F6 then toggles active state and generated renderer visibility, marks camera bounds dirty, and only marks functional socket caches dirty when imported functional sockets are explicitly enabled.

### RCS Nozzle Cache

`RcsThrusterController` will use an explicit dirty flag and cached nozzle root. The physics loop must be O(1) when nozzles are clean. F6 visual-only mode should not automatically replace the functional generated nozzle root. Functional imported sockets are opt-in via a mode/bool, then a dirty refresh binds them once.

## Reuse And New Code Justification

Existing camera, switcher, RCS, and ship socket classes remain the integration points. New helper components are justified only where the current project lacks explicit markers for camera focus or bounds participation. They avoid a parallel runtime system and make imported asset intent inspectable in the scene/prefab hierarchy.

## Risks

- Existing tests that expected visual center as the ChaseLocked focus must be updated to the new explicit COM/anchor rule.
- Cached bounds can become stale if future systems animate renderer enablement without marking dirty; this change documents and exposes `MarkVisualBoundsDirty()` for that path.
- Functional imported sockets remain possible, but defaulting to visual-only may reveal assumptions in tests that tied imported visuals to RCS roots.
