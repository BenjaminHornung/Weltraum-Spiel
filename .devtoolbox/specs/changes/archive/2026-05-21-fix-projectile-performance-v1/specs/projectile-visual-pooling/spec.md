# Projectile Visual Pooling

## ADDED Requirements

### Requirement: Projectile visuals are pooled

Muzzle flash, tracer, impact, and simulated projectile visuals SHALL be pooled and reused instead of instantiated and destroyed for every shot.

#### Scenario: Tracer objects are reused

- GIVEN a visual pool has already created a tracer object
- WHEN later shots request tracers after the first tracer expires
- THEN the pool reuses the existing tracer object
- AND total created tracer objects does not grow with total shots when active demand is bounded.

#### Scenario: Visuals are optional by cadence

- GIVEN `TracerEveryNthShot` is greater than one
- WHEN sequential shots are fired
- THEN tracer visuals are emitted only for the configured cadence
- AND hit simulation still runs for every shot.

### Requirement: Visual materials are shared

Runtime projectile visuals SHALL use shared material instances owned by the pool.

#### Scenario: Repeated shots do not create repeated materials

- GIVEN many shots are fired
- WHEN visual objects are activated
- THEN renderer `sharedMaterial` references come from the pool
- AND per-shot `new Material` creation is not required.

### Requirement: Lights are optional debug visuals

Projectile runtime visuals SHALL NOT add or enable point lights by default.

#### Scenario: Default visual pool has no point-light projectiles

- GIVEN default projectile visuals are created
- WHEN pooled tracer/projectile/impact objects are active
- THEN they do not include default point-light components.

### Requirement: Runtime visuals cannot become targets

Runtime projectile visual GameObjects SHALL be marked so weapon target discovery excludes them.

#### Scenario: Visual pool objects are ignored by target discovery

- GIVEN pooled projectile visuals are active
- WHEN `PrototypeWeaponTarget.Discover` runs
- THEN those visual objects are not returned as weapon targets.
