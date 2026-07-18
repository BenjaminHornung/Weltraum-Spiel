# Design: Surface Equipment Builder Core V1

## Context and boundaries

The core is a deterministic adapter seam between four existing authorities. It owns equipment catalog/blueprint assembly and projections only. Interaction owns interaction evaluation/completion; Suit owns actor state, power/thermal budgets, incapacitation, and equipment-bus readiness; Combat owns fire/hit/damage runtime; Resources owns requirements, containers, and transfers.

## Package shape

Use a small barrel-based package under `apps/weltraum-browser/src/surface-equipment/`. Keep responsibilities separated: identities/types, canonicalization/signatures, catalog/module validation and fixtures, blueprint commands, diagnostics/derived stats, suit readiness, and projections. All exports flow through `index.ts`; no DOM/Three.js/Date/Random dependency is allowed.

## Deterministic identity and canonicalization

Equipment IDs match `^[a-z0-9][a-z0-9._:-]{0,127}$` without deriving identity from display/file names. Inputs are copied, validated as plain JSON, duplicate-rejected, canonically ordered where order is semantic-neutral, and deeply frozen. Reject non-finite/unsafe numeric values, sparse arrays, accessors, cycles, unsupported values, unknown fields, and duplicate stable identities. Signatures use repository hash/canonical patterns and never clocks or randomness.

Display metadata is excluded from gameplay/content signatures at module, catalog, and blueprint levels. `RenameDisplayLabel` changes revision/display metadata but not the fachliche signature. Stable module-instance IDs survive `MoveModule`; `ReplaceModule` preserves the targeted instance identity while replacing its definition.

## Catalog, slots, and modules

Catalogs provide schema/versioned immutable slot/module definitions. Slot compatibility is explicit from slot type, required/optional state, exact count, allowed roles/tags, excluded tags, required Suit interfaces, mass/bulk caps, optional parent slot, and stable order. Modules explicitly list compatible slot-type IDs; compatibility is never inferred from display names or meshes. An optional slot with `exactCount: N` accepts either zero assignments or exactly N, never a partial count.

A module has exactly one primary role, ordered unique tags and compatible slot types, safe-integer mass/bulk/power/energy/thermal values, Interaction capabilities, Suit interface requirements, ResourceRequirements, optional imported DamageType and delivery/range/cycle/capacity facts, content signature, and `provisional-v0` balance metadata. Heat/action remains millijoules. Continuous active thermal load and passive dissipation are separate milliwatt facts; net thermal burden is `max(0, activeThermalLoadMilliwatts - passiveDissipationMilliwatts)`. No tick-duration assumption or mJ/mW subtraction is permitted.

Calibration options are catalog-defined discrete choices; arbitrary float sliders are rejected.

## Command model

`CreateBlueprint`, `InstallModule`, `RemoveModule`, `ReplaceModule`, `MoveModule`, `SetCalibration`, and `RenameDisplayLabel` carry command ID, blueprint ID, expected/resulting revision, source, sequence, and payload. Commands enter as unknown runtime data and pass strict descriptor-based plain-data/allowed-field validation before property access or CAS checks. Malformed commands reject deterministically without getter execution.

Apply exact CAS and duplicate-command detection before mutation. Every accepted command returns a new frozen snapshot; every rejection returns the original snapshot reference/value with deterministic diagnostics and no partial installation. Installing or moving into a different full destination slot rejects in preflight with `SlotCapacityExceeded`; a same-slot move excludes its own instance from the capacity count. Command receipts remain bounded to the blueprint contract and deterministic.

## Validation, provenance, and derived stats

Aggregate only explicit module/catalog data. Aggregate safe-integer overflow emits `AggregateOverflow`; totals never silently saturate. `deriveSurfaceEquipmentStats` validates blueprint catalog identity/version and returns explicit blueprint ID/revision and catalog ID/version provenance, mass, bulk, continuous power, pulse energy, heat/action, active thermal load, passive dissipation, net thermal burden, effective range, cycle ticks, capacity, canonical capabilities/interfaces/requirements, optional DamageType, signature, and fixed-order diagnostics.

Readiness validates stats provenance against the blueprint/catalog facts and records the stats signature. Interaction and Combat projections validate blueprint/stats/readiness provenance before exposing facts, preventing stale revisions or another catalog from being relabeled as current.

Diagnostics use a closed priority registry and canonical tie-breakers. Configuration interface omissions remain blockers even when the Suit itself exposes that interface. Required uncertified safety interlocks emit `SafetyCertificationInvalid`; missing interlocks remain `SafetyMissing`.

## Suit readiness

`evaluateEquipmentSuitReadiness(blueprint, stats, suitInterfaceSnapshot)` consumes the imported snapshot as authority and never reserves/consumes energy. Evaluate in fixed order: actor incapacitation, equipment bus, required interfaces, category structure/safety, continuous power, pulse reserve, thermal dissipation, and optional grip/handedness. Return `Ready`, `Limited`, or `Blocked` plus ordered blockers. Missing authority, provenance mismatch, or unsafe configuration blocks. A zero budget or a safety-critical Sidearm/Longarm/BreachingTool shortfall blocks; a positive-but-insufficient budget for other tools is Limited.

## Projections

Interaction projection is a frozen snapshot containing equipment blueprint/revision, imported capability IDs, stable tool ID, range class, energy-cost intent, ResourceRequirements, safety/legal metadata, and readiness. It performs no evaluation, completion, or mutation.

Combat projection exists only for Sidearm, Longarm, or BreachingTool with imported DamageType and complete delivery data. It contains stable equipment ID, damage type, range, cycle, ammo/energy/heat requirements, `Projectile | Beam | ToolContact`, and fire-permission metadata. It never creates `WeaponRuntimeState`, fires, resolves hits, or applies damage.

Safety and legal class are separate metadata. Legal classes are `Unrestricted`, `Licensed`, `Restricted`, `Prohibited`, `IndustrialOnly`, and `MissionAuthorized`.

## Fixture decisions

All six fixtures are `provisional-v0`; Interaction verbs remain target-rule-owned and are not represented as equipment capability IDs. Survey Scanner projects `capability.access` and `capability.scan` with no damage. Mining Cutter projects `capability.extract` and uses Cutting with ToolContact plus energy/thermal facts. Repair Tool projects `capability.repair` and repair-material requirements but transfers nothing. EMP Breacher uses the established public `capability.access` mapping used by Interaction Open operations, ElectricalEmp, Restricted metadata, and complete delivery; no Open/Activate capability authority is invented. Ballistic Sidearm uses Kinetic/Projectile and requires feed, magazine, control, and safety. Laser Cutter uses `capability.extract`, Cutting with Beam, and explicit energy/thermal facts.

## Browser proof and evidence

On normal `/`, assert TestBridge absent, dynamically import `/src/surface-equipment/index.ts`, run the required scenario twice, and compare canonical JSON/signatures. Directly prove Laser Cutter is imported `DamageType` Cutting with Beam delivery. Evidence JSON/Markdown contain no timestamps and are generated deterministically; no screenshots or product/UI integration claims.

## Risks and controls

- Contract drift: import through subsystem barrels and scan for duplicate authority declarations.
- Provenance drift: validate catalog/blueprint/stats/readiness identities and revisions at every projection seam.
- Ordering/signature drift: canonical helpers, shuffled-input tests, repeat browser proof, and byte hashes.
- Numeric/unit drift: safe-integer overflow diagnostics and explicit mJ versus mW facts.
- Scope creep: exclusive paths only and exact diff/forbidden-import scans.
- Readiness confusion: projections are facts/intents, never runtime mutation or permission enforcement.
