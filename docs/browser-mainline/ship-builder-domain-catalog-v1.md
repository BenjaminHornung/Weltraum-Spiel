# Ship Builder Domain Catalog v1

## Scope

This browser-mainline slice implements a JSON-safe, browser-importable Ship Builder domain/catalog foundation. It deliberately stops before a Builder UI, gameplay stat engine, flight runtime integration, test-flight flow, economy, or production-art import pipeline.

The source surface is `apps/weltraum-browser/src/ship-builder/`. The normal-route browser smoke imports that barrel directly through Vite; it does not add a route, a `TestBridge` hook, or a runtime/UI dependency.

## Stable identity and schemas

All persisted identity is caller-supplied and validated through stable ASCII ID and positive-version contracts. IDs start with a lowercase ASCII letter, may then use ASCII letters/digits and single namespace separators, and reject whitespace or non-ASCII/localized input. Catalogs, part definitions, part instances, sockets, components, blueprints, and connections retain their own stable IDs. Transform updates preserve a part instance's stable ID rather than synthesizing a new one.

Catalog and blueprint documents carry independent schema versions. Parsers accept decoded `unknown` data, validate it before construction, reject unsupported future schemas, and expose separate catalog/blueprint migration-registry interfaces for later version-to-version work. V1 has no historical migration.

## Categories are not capability

The eight built-in categories are palette/search metadata: `cockpit`, `hullFrame`, `mainThruster`, `rcs`, `fuelPower`, `cargoStorage`, `weapon`, and `utility`. Custom category records remain structurally valid. Socket compatibility category IDs resolve against this normalized category set. A category name neither grants a component nor changes runtime behavior; behavior comes only from explicit typed components on a part definition.

The built-in component union is:

- `ControlCore`
- `Structural`
- `MainThruster`
- `RcsCluster`
- `FuelTank`
- `CargoStorage`
- `FixedWeapon`
- `TurretWeapon`
- `SensorUtility`
- `DockingConnector`
- `Armor`
- `PowerHeatReserved`

Executable handlers/registries are code-side seams, not serialized component fields. There is no untyped primary `stats` bag.

## Parts, sockets, and connections

Part definitions serialize dimensions, grid footprint, dry mass, mount sides, explicit sockets, explicit components, and namespaced JSON-safe extension metadata. Nested part/component/socket schema versions are validated before field allowlists, dispatch, sorting, or reconstruction. Socket references are checked locally against declared socket IDs, and socket compatibility categories must resolve in the catalog. Functional directions must be finite and nonzero; vectors/quaternions reject unknown keys; no origin, identity, or zero-vector fallback is synthesized.

The built-in socket vocabulary is `structural`, `hardpoint`, `mainThrusterNozzle`, `rcsNozzle`, `turretBase`, `turretYawPivot`, `turretPitchPivot`, `muzzle`, `muzzleFlash`, `cargoAttach`, `dockingConnector`, and `cameraAnchor`. Socket metadata records role, direction role, nonzero-direction requirement, and permitted mount sides.

Blueprint instances use ship-local grid position with V1 yaw steps of 0/90/180/270 degrees and preserved zero pitch/roll. Connections are first-class records with stable connection IDs and explicit from/to part-instance/socket endpoints; they are never inferred from meshes or visual proximity.

## Immutable catalog, canonical JSON, and hashes

Catalog construction validates and deterministically orders persisted domain arrays, then returns frozen records and arrays. Generated indexes (`partById`, `categoryById`, `partsByCategory`, `partsByComponentKind`, `partsByTag`) are immutable snapshot conveniences and are excluded from persisted serialization.

Canonical serialization sorts object keys and domain arrays, normalizes negative zero, and rejects cycles, non-finite values, functions, symbols, BigInts, and non-plain JSON values. Catalog signatures use canonical persisted catalog data and FNV-1a only. Blueprint serialization likewise preserves canonical persisted data while omitting generated catalog fields.

The blueprint layout hash uses a separate authority projection. It excludes blueprint identity/display name, per-instance custom labels, draft metadata, cache metadata, and unsupported active state. It includes schema/catalog/grid inputs, stable instance IDs/transforms/definitions/enabled-mirror-extension state, explicit connections/metadata, mirror groups, and root extensions.

## Starter catalog and fixtures

The V1 starter catalog contains eight categories and sixteen fully typed parts, two per category. Its data carries namespaced provisional balance/source metadata and intentionally omits final build costs. `SCOUT_BLUEPRINT`, `CARGO_BLUEPRINT`, and `WEAPON_BLUEPRINT` are catalog-validated schema-integrity fixtures with explicit stable instances and connections; they are not flight-readiness claims.

| Fixture | Instances | Connections |
| --- | ---: | ---: |
| Scout | 5 | 4 |
| Cargo | 6 | 5 |
| Weapon | 7 | 6 |

## V0 concept coverage

The planning document has 32 V0 concepts: exactly 16 are implemented in this catalog foundation and 16 remain future work. “Implemented” means a typed catalog definition exists; it does not claim final balance, UI exposure, production art, or gameplay validation.

| Category | Planning concept | Status | Catalog ID |
| --- | --- | --- | --- |
| Cockpit / command | Scout cockpit small | Implemented | `cockpit_scout_small_v0` |
| Cockpit / command | Industrial cockpit box | Implemented | `cockpit_industrial_box_v0` |
| Cockpit / command | Long-range cockpit | Future | — |
| Cockpit / command | Armored bridge cockpit | Future | — |
| Hull / frame | Small spine frame | Implemented | `hull_small_spine_v0` |
| Hull / frame | Medium rectangular frame | Implemented | `hull_medium_rectangular_frame_v0` |
| Hull / frame | Cross-frame connector | Future | — |
| Hull / frame | Armor wedge frame | Future | — |
| Main thruster | Small chemical bell | Implemented | `thruster_small_chemical_bell_v0` |
| Main thruster | Twin medium engine | Implemented | `thruster_twin_medium_engine_v0` |
| Main thruster | Heavy block engine | Future | — |
| Main thruster | Compact maneuver engine | Future | — |
| RCS | 2-way side RCS | Future | — |
| RCS | 4-way corner RCS | Implemented | `rcs_4way_corner_v0` |
| RCS | 6-way cube RCS | Implemented | `rcs_6way_cube_v0` |
| RCS | Heavy precision RCS cluster | Future | — |
| Fuel / power | Small tank | Implemented | `fuel_small_tank_v0` |
| Fuel / power | Medium side tank | Implemented | `fuel_medium_side_tank_v0` |
| Fuel / power | Long cylinder tank | Future | — |
| Fuel / power | Protected internal tank | Future | — |
| Cargo / storage | Small storage box | Implemented | `cargo_small_storage_box_v0` |
| Cargo / storage | Medium cargo bay | Implemented | `cargo_medium_bay_v0` |
| Cargo / storage | External container rack | Future | — |
| Cargo / storage | Heavy cargo block | Future | — |
| Weapon | Small single gun turret | Implemented | `weapon_small_single_gun_turret_v0` |
| Weapon | Dual light turret | Future | — |
| Weapon | Heavy slow turret | Future | — |
| Weapon | Fixed forward cannon mount | Implemented | `weapon_fixed_forward_cannon_mount_v0` |
| Utility | Sensor dish/module | Implemented | `utility_sensor_dish_module_v0` |
| Utility | Docking connector | Implemented | `utility_docking_connector_v0` |
| Utility | Shield/armor plate | Future | — |
| Utility | Landing/maintenance hardpoint | Future | — |

## Browser evidence

`apps/weltraum-browser/tests/e2e/ship-builder-domain-catalog.spec.ts` loads normal `/`, confirms `window.TestBridge` is absent, then dynamically imports `/src/ship-builder/index.ts` in browser context through Vite. It creates the starter catalog, verifies 8 categories and at least 16 parts, pins the catalog signature, and canonical-roundtrips the scout fixture while checking stable instance/connection IDs and layout hash.

The test writes deterministic evidence without timestamps:

- `apps/weltraum-browser/evidence/browser-ship-builder-domain-catalog-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-ship-builder-domain-catalog-v1.md`

No screenshot is produced because this is a domain module smoke with no visual contract.

## Explicit non-goals

- Builder palette, placement, edit, mirror, save, or player-facing UI.
- Full compatibility, validity, mass/COM, thrust, RCS, cargo, weapon, or stat aggregation engines.
- Test-flight spawning, active-ship mutation, runtime binding, or renderer integration.
- Economy, recipes, resource unlocks, final part costs, and final balance.
- Production Blender/Unity asset import, marker alias resolution, or flight-ready validation.
