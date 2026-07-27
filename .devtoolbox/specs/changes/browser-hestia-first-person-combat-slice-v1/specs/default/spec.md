# Capability: Hestia First-Person Combat Slice V1

## Requirement: Surface play identity
The system SHALL identify the bounded authoritative SurfaceRegion with stable body, surface-frame, and region IDs, generator version, seed, and a safe monotonically increasing region revision.

### Scenario: Deterministic region identity
- GIVEN equal validated identity inputs
- WHEN two identities are created
- THEN their immutable values and canonical identity are equal
- AND no renderer or browser type participates.

### Scenario: Bounded scope
- GIVEN V1 surface play
- THEN the identity describes one SurfaceRegion
- AND it does not claim a global planet shell or orbit-to-surface transition.

## Requirement: Player state and commands
The system SHALL exchange immutable player snapshots and commands in SI units with a stable player ID, frame ID, local position, velocity, yaw/pitch, grounded state, movement mode, capsule dimensions, simulation tick, movement/look axes, sprint, optional crouch, jump, fire, pointer-lock intent, and explicit recovery-only reset.

### Scenario: Valid movement command
- GIVEN finite axes and look deltas plus explicit digital intents
- WHEN a command is created
- THEN a defensive immutable command with stable canonical identity is returned.

### Scenario: Invalid motion data
- GIVEN non-finite values, unsafe ticks, invalid IDs, or malformed vectors
- WHEN a snapshot or command is created
- THEN creation fails closed
- AND no position snap or velocity-zero fallback is applied.

## Requirement: Collision queries
The system SHALL define renderer-independent ports for ground/contact query, deterministic capsule sweep, and combat line/ray query, each explicitly bound to body/region/frame identity, region revision, and simulation tick.

### Scenario: Stale terrain query
- GIVEN a query bound to a different region revision or frame
- WHEN collision authority evaluates it
- THEN it returns a typed rejection rather than silently querying current render geometry.

## Requirement: Surface combat projection
The system SHALL expose active weapon, energy, heat, cooldown, target state, latest accepted or rejected fire result, and an ordered Combat Event summary while preserving the existing Combat Core as damage authority.

### Scenario: Accepted Pulse Cutter hit
- GIVEN fire permission, sufficient energy, acceptable heat, completed cooldown, and a valid drone ray hit
- WHEN the existing Combat Core accepts and resolves the hit
- THEN the surface snapshot projects resource changes, target damage/destruction, and combat-event summaries
- AND presentation cannot author damage.

### Scenario: Rejected fire
- GIVEN cooldown, energy, heat, target, frame, or revision prevents firing
- WHEN fire is requested
- THEN the latest fire result contains a player-readable typed rejection
- AND no damage or terrain edit is inferred.

## Requirement: Revisioned voxel impact
The system SHALL represent a `SubtractSphere` request with stable command ID, expected region revision, simulation tick, unambiguous quantized local center, SI radius, and explicit operation. The result SHALL discriminate applied, no-change, and rejected outcomes and expose changed brick IDs plus resulting revision/hash only where authoritative.

### Scenario: Applied subtract sphere
- GIVEN a current frame/revision and a valid cutter terrain hit
- WHEN voxel authority applies the command
- THEN the result lists deterministically ordered changed brick IDs and the resulting revision/hash.

### Scenario: Stale or invalid edit
- GIVEN stale revision, mismatched frame/region, invalid radius/quantum, duplicate command, or authority refusal
- WHEN the request is evaluated
- THEN a typed rejection is returned
- AND no success revision/hash is fabricated.

## Requirement: Player-facing Suit HUD
The system SHALL expose only player-facing mode, movement, suit/resource, weapon, target, and latest action/block information.

### Scenario: HUD projection
- GIVEN current player and combat authority snapshots
- WHEN the HUD snapshot is created
- THEN it is immutable and contains no worker, queue, hash, brick, internal revision, or debug telemetry.

## Requirement: Presentation authority boundary
The system SHALL define narrow ports that present derived player, terrain, target, weapon, and impact snapshots. Presentation SHALL have no world, collision, damage, or edit mutation authority.

### Scenario: Renderer independence
- GIVEN contract source and public exports
- THEN they contain no Three.js, DOM, browser-global, or TestBridge dependency.

## Requirement: Future route and mode ownership
The later playable slice SHALL be enabled only by exactly `?surfacePlay=1`; `?surfaceLab=1` remains unchanged. SurfaceFirstPerson owns movement/look/fire input and blocks ship/planner flight input while active.

### Scenario: Normal route
- GIVEN the browser opens with `?surfacePlay=1`
- WHEN integration is complete
- THEN the player enters the deterministic bounded Hestia slice through the normal player path without TestBridge.

### Scenario: Mode isolation
- GIVEN SurfaceFirstPerson is active
- WHEN movement or fire input occurs
- THEN no ship flight, RCS, planner, terminal, or Surface Lab command is emitted.

## Requirement: Complete playable evidence
The eventual slice SHALL prove deterministic Hestia generation, walk/sprint/jump, terrain collision and Hestia gravity, visible Pulse Cutter, drone damage/destruction through Combat Core, energy/heat/cooldown consumption, revisioned terrain subtraction, player-facing Suit HUD, and Hestia-style low-poly/microvoxel presentation.

### Scenario: End-to-end acceptance
- GIVEN the normal `?surfacePlay=1` route
- WHEN the player traverses terrain, fires at the drone, and fires at terrain
- THEN screenshots, runtime evidence, and authority receipts agree
- AND no debug bridge or presentation state supplies gameplay truth.