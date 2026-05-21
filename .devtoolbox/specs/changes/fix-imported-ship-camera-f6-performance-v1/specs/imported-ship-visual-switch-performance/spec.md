# Imported Ship Visual Switch Performance

## Requirements

### Requirement: Imported visuals are pooled after first load

F6 visual switching MUST lazy-instantiate each imported demo visual at most once per ship instance during normal play, then reuse that instance for later switches.

#### Scenario: Repeated imported switch

- Given a ship has Scout and Cargo imported visual prefabs available
- When the user cycles visual modes repeatedly with F6
- Then Scout and Cargo visual instances are reused
- And the switcher does not accumulate unbounded `ImportedShipVisual` child hierarchies
- And collider/rigidbody cleanup is not repeated for an already pooled visual

### Requirement: Visual switch emits cache invalidation once per switch

A visual switch MUST notify camera bounds caches and RCS nozzle caches through explicit dirty/refresh hooks rather than relying on per-frame/per-physics polling.

#### Scenario: Generated to imported visual-only

- Given generated functional sockets are active
- When the user switches to an imported visual-only mode
- Then generated renderer visibility changes
- And the selected imported visual becomes active
- And camera bounds are marked dirty
- And functional RCS root remains generated unless functional imported sockets are explicitly enabled

### Requirement: Runtime asset loading is not repeated in the hot path

Prefab reference lookup and fallback editor asset loading SHOULD be cached per switcher instance or occur once at setup/first use, not on every F6 cycle.
