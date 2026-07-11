# Capability: Browser Ship Builder Domain Catalog

## Requirement: Stable identity and version contracts

The module SHALL expose runtime-validated, internally branded concepts for `PartCategoryId`, `PartDefinitionId`, `PartInstanceId`, `SocketId`, `ComponentId`, `BlueprintId`, `ConnectionId`, `CatalogId`, `CatalogVersion`, and `BlueprintSchemaVersion`.

IDs SHALL use a documented stable ASCII grammar beginning with a lowercase letter and permitting ASCII letters/digits plus namespace-safe separators; malformed values SHALL fail with stable structured error codes and paths. IDs SHALL be caller-supplied and SHALL NOT depend on timestamps, random UUIDs, display names, localization, registration order, position, or rotation. Versions SHALL be positive supported integers.

### Scenario: Instance transform changes

Given a valid part instance, when its grid position or supported yaw changes, its `stableInstanceId` remains byte-identical.

### Scenario: Unsupported identity or schema

Malformed IDs and future unsupported catalog/blueprint schema versions fail before domain use with a stable error code, offending path, and deterministic ordering.

## Requirement: Extensible categories do not grant capability

The catalog SHALL support data-defined category records containing ID, display/description key or fallback text, sort order, optional presentation key, palette tags, optional required-system role, optional allowed/recommended component kinds, and namespaced extension metadata.

The built-in v1 constants SHALL be `cockpit`, `hullFrame`, `mainThruster`, `rcs`, `fuelPower`, `cargoStorage`, `weapon`, and `utility`. Category ordering SHALL be sort order then ID, independent of registration order. The category set SHALL remain open to future validated IDs.

No gameplay capability SHALL be inferred from category. Only explicit components contribute capability.

### Scenario: Future category

A catalog containing a valid custom category and a part assigned to it parses and indexes without changing the base `PartDefinition` shape.

### Scenario: Empty propulsion category part

A part categorized as `mainThruster` but containing no `MainThruster` component has no thrust capability in component indexes.

## Requirement: Serializable part definition and components

A `PartDefinition` SHALL contain ID, schema version, display name, description, category ID, tags, positive finite meter dimensions, positive integer grid footprint, non-negative finite dry mass, allowed mount sides, explicit sockets, explicit typed components, and optional build-cost references, visual/collider references, variant group, balance tier, and JSON-safe namespaced extensions.

The primary gameplay model SHALL NOT be an untyped numeric stats record.

The discriminated component union SHALL include `ControlCore`, `Structural`, `MainThruster`, `RcsCluster`, `FuelTank`, `CargoStorage`, `FixedWeapon`, `TurretWeapon`, `SensorUtility`, `DockingConnector`, `Armor`, and `PowerHeatReserved`. Every component SHALL contain `componentId`, `kind`, schema version, optional tags, optional namespaced extensions, and its component-specific typed fields defined by the approved task. Socket-dependent fields SHALL contain validated socket IDs.

A non-serialized handler interface/registry seam keyed by component kind MAY hold future behavior; serialized components SHALL never contain functions.

### Scenario: Multi-component part

A part containing multiple distinct typed components serializes and parses without loss, and component indexes include it under every explicit kind only.

### Scenario: Invalid numeric data

Negative or non-finite mass, dimensions, thrust, capacity, burn, range, damage, speed, rate, recoil, rating, seat, or component-specific numeric values fail with stable codes and precise paths according to whether zero is meaningful for that field.

## Requirement: Explicit sockets and references

Each socket SHALL contain socket ID/type, finite local position and rotation, direction role/vector, compatible category IDs, compatible component kinds, capacity class, mount side, required component IDs, compatibility aliases, optional arc metadata, optional VFX role, and camera-bounds exclusion state.

Required socket type constants SHALL include `structural`, `hardpoint`, `mainThrusterNozzle`, `rcsNozzle`, `turretBase`, `turretYawPivot`, `turretPitchPivot`, `muzzle`, `muzzleFlash`, `cargoAttach`, `dockingConnector`, and `cameraAnchor`.

Duplicate socket IDs in a part SHALL fail. Every component socket reference and `requiredForComponentIds` entry SHALL resolve within the same definition. Functional direction vectors SHALL be finite and nonzero; no missing socket or invalid direction may fall back to part origin, world origin, identity direction, or zero vector. Full mount/socket compatibility evaluation is deferred.

### Scenario: Missing component socket

A thruster, RCS, cargo, weapon, sensor, docking, or control component that references a missing socket fails catalog construction with a stable missing-socket code.

### Scenario: Zero direction

A direction-required functional socket with `{x:0,y:0,z:0}` fails rather than being normalized or replaced silently.

## Requirement: Authoritative instances and first-class connections

A `PartInstance` SHALL contain stable instance ID, part definition ID, integer local grid position, local rotation with yaw/pitch/roll fields, enabled state, and optional mirror group, custom name, and JSON-safe namespaced extension state.

V1 SHALL accept deterministic yaw values in 90-degree steps and preserve pitch/roll fields as zero; unsupported pitch, roll, or yaw values SHALL fail parsing.

A `PartConnection` SHALL contain stable connection ID, two endpoints containing instance/socket IDs, connection type, enabled state, and optional JSON-safe metadata. Connections SHALL be authoritative blueprint data and SHALL NOT be inferred from mesh overlap.

### Scenario: Connection roundtrip

Blueprint serialization and parse preserve every connection ID and endpoint exactly after canonical ordering.

## Requirement: Versioned blueprints and layout hashes

A `ShipBlueprint` SHALL contain blueprint ID, display name, schema version, catalog ID/version, positive finite grid meters, authoritative instances/connections, referenced part-definition IDs, optional mirror groups, optional draft metadata, optional cached validation/stats metadata, and optional namespaced extensions.

Referenced part-definition IDs SHALL be deterministically derived or checked against instances. Duplicate instance/connection IDs, missing endpoint instances, malformed transforms, and catalog mismatches SHALL fail. When a catalog is supplied, definition and endpoint socket references SHALL resolve.

Canonical blueprint JSON SHALL preserve all supported serialized fields and be byte-equivalent after parse/serialize. The canonical layout hash projection SHALL include schema/catalog/grid and authoritative layout/connection/mirror/extension state, but SHALL exclude blueprint identity/name, custom labels, timestamps/draft metadata, active-ship state, and validation/stat caches.

### Scenario: Cache independence

Two blueprints with identical authoritative layout and different cached validation/stat data produce the same layout hash.

## Requirement: Immutable deterministic catalog snapshots

`ShipPartCatalogSnapshot` SHALL contain catalog ID/version/schema, canonical category/part data, deterministic summary, and signature. Construction SHALL deep-freeze exposed serializable data and generated immutable index views for part by ID, category by ID, parts by category, parts by component kind, and parts by tag. Indexes SHALL NOT be duplicated into serialized catalog data.

Catalog canonical ordering SHALL use category sort order then ID and stable part/component/socket/tag identifiers. Construction SHALL reject duplicate category IDs, duplicate part IDs, unknown part categories, duplicate local socket/component IDs, missing references, malformed extensions, unsupported schema versions, and invalid numeric data with deterministic first-error behavior.

### Scenario: Insertion-order independence

Two semantically equal catalogs supplied in different category/part/property insertion orders produce identical canonical catalog JSON and signature.

### Scenario: Runtime immutability

Attempts to mutate exposed arrays, records, definitions, summaries, or index lists cannot alter the snapshot or its signature.

## Requirement: Runtime parse, canonical serialization, and migration seams

Catalog and blueprint parse functions SHALL accept JSON text/unknown decoded data, validate every required field without blind type assertions, and emit stable structured errors for malformed JSON/data. Serialize functions SHALL emit canonical compact JSON with stable property and domain-array ordering and no `undefined`, functions, symbols, BigInts, cycles, or non-finite numbers.

Separate catalog and blueprint migration registry interfaces SHALL define the future version-to-version seam. V1 SHALL have no historical migrations and SHALL reject unsupported future versions clearly.

## Requirement: Starter catalog and fixtures

The starter catalog SHALL contain all eight built-in categories and at least sixteen fully typed definitions, with at least one part per category and enough explicit components/sockets to support fixed scout, cargo-oriented, and weapon-capable blueprint fixtures.

The v1 starter set SHALL implement two concept definitions per category from `ship-builder-modular-parts.md`: Scout cockpit small; Industrial cockpit box; Small spine frame; Medium rectangular frame; Small chemical bell; Twin medium engine; 4-way corner RCS; 6-way cube RCS; Small tank; Medium side tank; Small storage box; Medium cargo bay; Small single gun turret; Fixed forward cannon mount; Sensor dish/module; Docking connector.

Published concept IDs SHALL be preserved; remaining IDs SHALL be frozen deterministic English concept IDs. Required numeric component values SHALL be explicitly marked provisional in namespaced metadata. Final economy costs SHALL be absent.

### Scenario: Fixture integrity

Scout, cargo, and weapon fixtures construct through public APIs and reference only existing part definitions, component sockets, instance endpoints, and catalog versions.

## Requirement: Browser smoke evidence and documentation

The Playwright smoke SHALL load normal `/`, verify TestBridge is absent, dynamically import `/src/ship-builder/index.ts` through Vite, create the starter catalog, verify eight categories and at least sixteen parts plus a pinned stable signature, and roundtrip the scout blueprint.

The test SHALL write deterministic Markdown and JSON evidence. No Builder UI, HUD, runtime, renderer, screenshot, or TestBridge path is required because this capability has no visual behavior.

Documentation SHALL summarize the schema, category/capability separation, hash projections, non-goals, fixture coverage, and all 32 planned concept parts, clearly marking sixteen implemented and sixteen future.