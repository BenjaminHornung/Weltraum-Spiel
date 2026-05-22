# F6 Variant Switch Regression

## Requirements

### Requirement: Built-in and imported modes preserve controls

Generated, imported Scout visual-only, and imported Cargo visual-only modes MUST preserve ship controls and generated functional modules unless a functional imported mode is selected.

#### Scenario: Visual cycle while flying

- Given the player is flying with generated ship controls
- When F6 cycles to imported Scout, imported Cargo, and back
- Then RCS/main controls remain available
- And the camera remains centered and usable

### Requirement: First-load spike is bounded and repeated cycles are stable

The first activation of an imported visual MAY instantiate and prepare the prefab. Later F6 cycles MUST reuse prepared instances and avoid repeated material/collider/rigidbody setup work.

### Requirement: Regression evidence is captured

The change MUST include focused EditMode tests for camera caching/pivot, switcher pooling, and RCS cache behavior. Manual or PlayMode evidence SHOULD be recorded when Unity Editor is available.
