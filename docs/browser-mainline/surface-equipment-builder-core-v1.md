# Browser Surface Equipment Builder Core v1

## Scope And Public Contracts

`apps/weltraum-browser/src/surface-equipment/index.ts` is the public barrel for a pure, deterministic Surface Equipment domain seam. It owns catalog and blueprint assembly, atomic commands, derived stats and diagnostics, Suit-readiness evaluation, and immutable Interaction/Combat projections. It has no DOM, Three.js, clock, random, UI, renderer, or product-runtime authority.

The public contracts cover stable catalog/module/slot/blueprint/instance/command identities; closed V1 categories, module roles, legal classes, delivery classes, readiness states, and diagnostics; immutable catalog and blueprint snapshots; and the seven commands `CreateBlueprint`, `InstallModule`, `RemoveModule`, `ReplaceModule`, `MoveModule`, `SetCalibration`, and `RenameDisplayLabel`.

`deriveSurfaceEquipmentStats` aggregates only explicit catalog/module facts. Its output carries blueprint ID/revision and catalog ID/version provenance. `evaluateEquipmentSuitReadiness` validates that provenance before consuming the stats plus a public Suit equipment-interface snapshot; its output carries the same blueprint/catalog provenance, the exact stats signature, and Suit state ID/revision. Both projections validate stats and readiness provenance before publishing adapter facts and intent, without taking over their destination domain.

## Reused Authorities

The package imports authority through existing subsystem barrels rather than declaring parallel types:

- Interaction owns `InteractionCapabilityId`, capability validation, and tool-ID construction.
- Suit owns `SuitInterfaceId`, `SuitEquipmentInterfaceSnapshot`, actor incapacity, equipment-bus state, and power/pulse/thermal budgets.
- Combat owns `DamageType`.
- Resources owns `ResourceRequirement` and requirement construction.

Surface Equipment never completes an Interaction, mutates or consumes Suit state/energy, creates or fires Combat runtime state, resolves hits/damage, or reserves/consumes/transfers Resources.

## Six Provisional Fixtures

All built-ins are deterministic `provisional-v0` contract fixtures, not final balance.

| Fixture | Category | V1 decision |
| --- | --- | --- |
| Survey Scanner | Scanner | Frame, Scanner, and Control; public Access/Scan capabilities; no damage delivery. |
| Mining Cutter | ExtractionTool | Cutting with `ToolContact`; Access/Extract capabilities; explicit continuous/pulse energy, heat, thermal sink, and discrete output calibration. |
| Repair Tool | RepairTool | Access/Repair capability plus a projected electronics-scrap requirement; no resource transfer. |
| EMP Breacher | BreachingTool | ElectricalEmp with `ToolContact`, Restricted legal metadata, Safety, and complete delivery facts. |
| Ballistic Sidearm | Sidearm | Kinetic with `Projectile`; FeedSystem, Magazine, Control, and Safety are mandatory. |
| Laser Cutter | ExtractionTool | **Cutting with `Beam`** is the explicit V1 choice; it has Access/Extract capabilities, energy/heat facts, and discrete output calibration. |

Catalog compatibility uses stable slot type, role, tag, interface, mass, and bulk facts only. Every module explicitly declares `compatibleSlotTypeIds`; installation and validation require the assigned slot's `slotTypeId` to be present in that list. A required slot must contain exactly `exactCount` modules. An optional slot may be empty, but once populated it must also contain exactly `exactCount`; partial optional occupancy produces `SlotCountMismatch`. Display labels and render assets never decide compatibility or identity.

Thermal quantities are deliberately unit-safe and separate. `activeThermalLoadMilliwatts`, `passiveDissipationMilliwatts`, and derived `netThermalBurdenMilliwatts` are rates in milliwatts (mW). `heatPerActionMillijoules` is discrete energy per action in millijoules (mJ); it is not added to or compared directly with the Suit thermal-dissipation rate. Readiness compares only the net active thermal burden in mW with the Suit thermal-dissipation budget in mW.

## Commands, Readiness, And Diagnostic Ordering

Commands apply envelope validation, exact compare-and-swap revision checks, duplicate-command checks, operation preflight, immutable candidate creation, and configuration validation in that order. Accepted commands return a new frozen snapshot. A rejection preserves the original blueprint and applies no partial mutation. `MoveModule` preserves instance identity; `ReplaceModule` preserves the targeted instance ID while changing its module definition and clearing calibration for that instance. `RenameDisplayLabel` increments revision but does not change the gameplay/content signature. Calibration accepts only catalog-defined discrete options.

Configuration and command diagnostics use the closed `SURFACE_EQUIPMENT_DIAGNOSTIC_CODE_ORDER`. The complete V1 registry is `MissingRequiredSlot`, `SlotCountMismatch`, `SlotTypeMismatch`, `SlotRoleMismatch`, `TagIncompatible`, `InterfaceMissing`, `MassLimitExceeded`, `BulkLimitExceeded`, `ContinuousPowerExceeded`, `PulseEnergyExceeded`, `ThermalBudgetExceeded`, `AmmoFeedMissing`, `MagazineMissing`, `ControlMissing`, `SafetyMissing`, `SafetyCertificationInvalid`, `DamageDeliveryIncomplete`, `CapabilityUnsatisfied`, `ResourceRequirementInvalid`, `AggregateOverflow`, `SuitActorIncapacitated`, `SuitEquipmentBusOffline`, `LegalConfigurationInvalid`, `DuplicateModuleInstance`, `RevisionConflict`, `DuplicateCommand`, `BlueprintMismatch`, `UnknownModuleInstance`, `UnknownModule`, `UnknownSlot`, `SlotCapacityExceeded`, `CalibrationInvalid`, `GripRequirementUnsatisfied`, and `InvalidCommand`. `SafetyCertificationInvalid` rejects an installed required interlock that is not certified, `AggregateOverflow` prevents unsafe aggregate totals, and malformed command envelopes fail as `InvalidCommand` rather than escaping uncontrolled exceptions. Ordering first follows the registry, then canonical phase, severity, path, module-instance ID, slot ID, and canonical diagnostic bytes. This makes the broken Sidearm order `MissingRequiredSlot` before `SafetyMissing`.

Suit readiness evaluates in fixed authority order:

1. actor incapacity;
2. equipment bus;
3. required interfaces;
4. structural and safety errors;
5. continuous-power budget;
6. pulse-energy reserve;
7. thermal-dissipation budget;
8. optional grip/handedness.

Any blocked condition yields `Blocked`; otherwise a positive utility budget shortfall yields `Limited`; otherwise the result is `Ready`. Zero available budget always blocks, and Sidearm/Longarm/BreachingTool budget shortfalls are safety-critical and block. Readiness is an immutable assessment only: it does not reserve or consume energy.

## Projections

The Interaction projection contains equipment ID/revision, imported capability IDs, stable tool ID, range class/range, energy intent, ResourceRequirements, safety/legal metadata, and current readiness. It cannot evaluate a target, start a session, complete an interaction, or mutate resources. Interaction verbs and equipment capabilities remain separate authorities: targets may request the established `Open` or `Activate` verbs, while equipment that can satisfy those access operations publishes the existing imported `capability.access`. Surface Equipment does not invent parallel `capability.open` or `capability.activate` IDs.

The Combat projection is available only for Sidearm, Longarm, and BreachingTool blueprints with complete damage/delivery facts and a valid configuration. It contains imported DamageType, delivery class, range, cycle, ammo/resource/energy/heat facts, and fire-permission metadata. `readinessRequired: Ready` is metadata for the Combat adapter; the projection does not create `WeaponRuntimeState`, execute fire, spawn projectiles, resolve hits, or apply damage.

## Browser Evidence

`apps/weltraum-browser/tests/e2e/surface-equipment-builder-core.spec.ts` registers page-error, console-error, failed-response, and request-failure collectors before navigation, loads normal `/`, proves `window.TestBridge` absent before and after, and dynamically imports `/src/surface-equipment/index.ts` in Browser context. It uses the real public Suit definition/state/equipment-snapshot constructors.

The in-page scenario loads exactly six built-ins and their fixture catalogs; proves every assigned module explicitly supports its slot type; records active-thermal mW separately from heat/action mJ; and proves stats/readiness provenance and signatures for every fixture. It proves all six nominally `Ready`, proves a nominal Mining Cutter `Ready`, proves the same Cutter `Limited` with a positive insufficient pulse reserve, removes Ballistic Sidearm Safety to produce deterministic blocking diagnostics, reinstalls Safety through public `InstallModule`, and proves the repaired Sidearm `Ready`. Interaction and Combat projections are then created from the repaired Sidearm. A separate direct Browser assertion derives the Laser Cutter's imported Combat `DamageType` as `Cutting`, verifies it against the Combat public registry, and proves delivery class `Beam`; this is not inferred from the fixture ID. The complete scenario runs twice and requires identical canonical JSON and signatures.

The test overwrites exactly these timestamp-free evidence files with stable ordering and no absolute paths:

- `apps/weltraum-browser/evidence/browser-surface-equipment-builder-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-surface-equipment-builder-core-v1.md`

The evidence records dependency SHAs, fixture thermal/compatibility facts, stats/readiness provenance, complete diagnostic ordering, the Laser Cutter authority proof, repaired-Sidearm projections, canonical/signature repeatability, and browser health in page/console/failed-response/request-failure order as `0/0/0/0`. No screenshot is captured because this slice changes no visible UI or render behavior.

Focused verification from `apps/weltraum-browser`:

```powershell
npx tsc -p tsconfig.json
npm run test:e2e -- tests/e2e/surface-equipment-builder-core.spec.ts --workers=1 --retries=0
```

Run the focused E2E twice and compare SHA-256 plus bytes for both evidence files. Equal inputs must rewrite byte-identical JSON and Markdown.

## Explicit Non-goals

- No `main.ts`, Browser Runtime, TestBridge, route, UI, HUD, renderer, Three.js, VFX, mesh, collider, or screenshot integration.
- No Interaction evaluation/completion, Suit mutation or energy consumption, Combat runtime/fire/projectile/hit/damage behavior, or Resource inventory transfer.
- No save/load or migration, economy, legal/faction enforcement, progression, production balance, audio, animation, networking, or multiplayer authority.
- No package, lockfile, Vite, Playwright-config, CI-group, infrastructure, or dependency-core changes.
