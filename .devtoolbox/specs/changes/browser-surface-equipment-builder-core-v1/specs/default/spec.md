# Surface Equipment Builder Core V1 Specification

## Identity and authority requirements

The core SHALL expose `SurfaceEquipmentCatalogId`, `SurfaceEquipmentModuleId`, `SurfaceEquipmentBlueprintId`, `SurfaceEquipmentRevision`, `SurfaceEquipmentSlotId`, `SurfaceEquipmentCommandId`, `SurfaceEquipmentTagId`, and `SurfaceEquipmentLegalClassId`. IDs SHALL match `^[a-z0-9][a-z0-9._:-]{0,127}$`; display and file names SHALL NOT be identity.

The core SHALL import and reuse public `InteractionCapabilityId`, `SuitInterfaceId`, `SuitEquipmentInterfaceSnapshot`, `DamageType`, and `ResourceRequirement` authorities. It SHALL NOT define equivalent capability, suit budget/bus, damage, or resource authorities.

## Closed V1 vocabularies

Categories SHALL be exactly `Scanner`, `ExtractionTool`, `RepairTool`, `BreachingTool`, `Sidearm`, `Longarm`, `UtilityDevice`.

Module roles SHALL be exactly `Frame`, `ToolHead`, `DeliveryAssembly`, `PowerPack`, `ThermalSink`, `FeedSystem`, `Magazine`, `Optic`, `Scanner`, `Control`, `Safety`, `LegalTransponder`, `Grip`, `Stock`, `Utility`. Each module SHALL have exactly one primary role.

Legal classes SHALL be exactly `Unrestricted`, `Licensed`, `Restricted`, `Prohibited`, `IndustrialOnly`, `MissionAuthorized`. Legal and safety metadata SHALL remain separate.

## Catalog and module behavior

A slot definition SHALL include stable slot identity/order, slot type, required/optional state, allowed roles/tags, excluded tags, required Suit interfaces, safe-integer mass/bulk limits, exact count, and optional parent. A module SHALL explicitly list compatible slot-type IDs. Compatibility SHALL enforce slot type, role, tags, required interfaces, mass, and bulk and SHALL never use display names. An optional slot with `exactCount: N` SHALL accept either zero modules or exactly N modules, not a partial count.

A module definition SHALL include identity/version, separate display metadata, role/tags, compatible slot-type IDs, safe-integer mass grams, bulk micro-units, continuous milliwatts, pulse millijoules, heat/action millijoules, active thermal load milliwatts, passive dissipation milliwatts, imported Interaction capabilities, imported Suit interfaces, imported ResourceRequirements, optional imported DamageType, optional delivery/range/cycle/capacity data, signature, and explicit `provisional-v0` balance metadata.

Heat/action and continuous thermal facts SHALL retain their units. Net thermal burden SHALL be derived only from milliwatt active load and milliwatt passive dissipation; no tick-duration assumption or millijoule/milliwatt subtraction is allowed. Inputs and outputs SHALL be strict plain JSON compatible, deeply frozen, duplicate-safe, canonical, accessor-free, unknown-field-free, and invariant to unordered input order.

## Blueprint and command behavior

A blueprint SHALL include ID, catalog ID/version, revision, category, display-only name, slot assignments, stable module instances, optional discrete calibration choices, ordered tags, processed command IDs, and content signature.

The core SHALL implement `CreateBlueprint`, `InstallModule`, `RemoveModule`, `ReplaceModule`, `MoveModule`, `SetCalibration`, and `RenameDisplayLabel`. Each command SHALL carry command ID, blueprint ID, expected/resulting revision, payload, source, and sequence.

Command input SHALL be validated as strict plain runtime data before property access. Null, accessors, sparse arrays, non-plain objects, and unknown fields SHALL reject deterministically and SHALL NOT execute getters. Commands SHALL enforce exact CAS, reject duplicates, be atomic, and preserve the input blueprint on rejection. Move SHALL preserve module-instance ID. Replace SHALL preserve the targeted instance ID while replacing the definition. Calibration SHALL accept only catalog-defined discrete options. Rename SHALL not change module, catalog, or blueprint gameplay/content signatures because display metadata is excluded from those hashes. Installing or moving into a different full destination slot SHALL reject in preflight with `SlotCapacityExceeded`; a same-slot move SHALL exclude its own instance from the capacity count.

## Derived stats, provenance, and diagnostics

`deriveSurfaceEquipmentStats` SHALL validate blueprint catalog ID/version and SHALL return blueprint ID/revision and catalog ID/version provenance, total mass, bulk, continuous power, pulse/peak energy, heat/action, active thermal load, passive dissipation, net thermal burden, effective range, cycle ticks, ammo/charge capacity, imported Interaction capabilities, imported required Suit interfaces, imported ResourceRequirements, optional DamageType, signature, and diagnostics. No value may derive from a render mesh. Aggregate safe-integer overflow SHALL produce a deterministic blocking `AggregateOverflow` diagnostic and SHALL NOT silently saturate.

Readiness SHALL validate stats provenance against the blueprint, and projections SHALL validate blueprint/stats/readiness provenance. A stale revision or different catalog SHALL be rejected deterministically rather than relabeled with current identity.

Diagnostics SHALL use a fixed priority and canonical tie-breakers and SHALL include at least: `InvalidCommand`, `MissingRequiredSlot`, `SlotCountMismatch`, `SlotCapacityExceeded`, `SlotTypeMismatch`, `SlotRoleMismatch`, `TagIncompatible`, `InterfaceMissing`, `MassLimitExceeded`, `BulkLimitExceeded`, `ContinuousPowerExceeded`, `PulseEnergyExceeded`, `ThermalBudgetExceeded`, `AmmoFeedMissing`, `MagazineMissing`, `ControlMissing`, `SafetyMissing`, `SafetyCertificationInvalid`, `DamageDeliveryIncomplete`, `CapabilityUnsatisfied`, `ResourceRequirementInvalid`, `AggregateOverflow`, `SuitActorIncapacitated`, `SuitEquipmentBusOffline`, `LegalConfigurationInvalid`, `DuplicateModuleInstance`, and `RevisionConflict`. A slot-required interface omitted by the module SHALL remain a blocking configuration diagnostic even if the Suit exposes that interface.

## Suit readiness

`evaluateEquipmentSuitReadiness` SHALL consume blueprint, derived stats, and imported Suit snapshot; SHALL check actor incapacitation, equipment bus, all interfaces, continuous power, pulse reserve, thermal dissipation, optional grip/handedness, safety certification, and category-specific requirements in fixed order; and SHALL return `Ready`, `Limited`, or `Blocked` with canonical blockers. It SHALL NOT consume or mutate energy/state. A zero available budget or a safety-critical Sidearm/Longarm/BreachingTool shortfall SHALL block; a positive-but-insufficient budget for other categories SHALL be Limited.

## Interaction and Combat projections

`createInteractionCapabilityProjection` SHALL validate provenance, return an immutable equipment/revision/tool/capability/range/energy-intent/resource/safety/legal/readiness snapshot, and SHALL NOT complete an interaction.

Combat projection SHALL validate provenance and SHALL only exist for Sidearm, Longarm, or BreachingTool with DamageType and complete delivery data. It SHALL expose stable equipment ID, imported DamageType, range, cycle, ammo/energy/heat requirements, delivery class (`Projectile`, `Beam`, `ToolContact`), and fire-permission metadata. It SHALL NOT expose/create runtime weapon state or execute fire/hit/damage.

## Built-in fixtures

Exactly six provisional fixtures SHALL ship. Interaction verbs SHALL remain target-rule-owned and SHALL NOT be represented as equipment capability IDs. Survey Scanner SHALL project `capability.access` and `capability.scan` with no damage. Mining Cutter SHALL project `capability.extract` with Cutting/ToolContact and energy/thermal facts. Repair Tool SHALL project `capability.repair` and repair-material requirements. EMP Breacher SHALL use the established public `capability.access` mapping used by Interaction Open operations, ElectricalEmp, and Restricted metadata; no separate Open/Activate capability authority SHALL be invented. Ballistic Sidearm SHALL use Kinetic/Projectile with feed/magazine/control/safety. Laser Cutter SHALL project `capability.extract` with Cutting/Beam and energy/thermal facts. All fixtures SHALL explicitly declare compatible slot types, validate nominally, and use explicit active/passive thermal facts. Deliberately broken variants SHALL produce exact ordered diagnostics.

## Determinism, proof, and non-goals

No core module SHALL depend on DOM, Three.js, Date, or Random. Same inputs SHALL produce same canonical signatures and byte-identical browser output. The browser proof SHALL use normal `/`, assert TestBridge absent, dynamically import `/src/surface-equipment/index.ts`, exercise six fixtures/readiness/projections twice, directly prove Laser Cutter is imported `DamageType` Cutting with Beam delivery, and produce timestamp-free JSON/Markdown evidence without screenshots.

V1 SHALL NOT fire, simulate projectiles/hits, apply damage, mutate suit energy, reserve/consume/transfer inventory, add UI, integrate product runtime, or spawn/render models.
