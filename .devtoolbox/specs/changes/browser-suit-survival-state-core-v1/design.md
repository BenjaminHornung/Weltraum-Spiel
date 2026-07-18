# Design

## Authority and boundaries

`src/suit` is a pure TypeScript domain module. Adapters may submit only a simulation tick, evaluated exposure, actor workload, activated subsystems, and explicit external damage/repair/resupply commands. World, atmosphere, combat, resources, inventory, UI, renderer, input, and persistence retain their own authority. `SuitEnvironmentExposure` is a value object, not a physics API. The core contains no DOM, Three.js, clock, random, animation, collision, raycast, or `TestBridge` dependency.

## Deterministic time and arithmetic

Export `SUIT_SIMULATION_HZ = 10`; one tick is exactly 100 ms. `SuitTick` is a nonnegative safe integer and `SuitStepCount` a positive safe integer. APIs accept neither wall-clock milliseconds nor variable delta and never call `Date.now`/`performance.now`. `advanceSuitState(state, input, steps)` applies the normative per-tick transition N times so an aggregate of N ticks has the same canonical state and semantic event signatures as N one-step calls; a mandatory 100-versus-100 test proves this.

All authoritative quantities are canonical safe integers: `healthMilliPoints`/maximum, `oxygenMilligrams`/capacity, `energyMillijoules`/capacity, `sealIntegrityBasisPoints` in 0..10000, `internalTemperatureMilliKelvin`, monotonic `radiationMicrosieverts`, and `contaminationMicroUnits`. Validation rejects NaN, infinities, `-0`, unsafe integers, and values requiring implicit rounding. Per-second or fractional configured rates use named deterministic quotient/remainder accumulators persisted in the snapshot; no slow rate is silently lost.

## Identity, construction, and immutability

Public branded identities include `SuitDefinitionId`, `SuitStateId`, `SuitActorId`, `SuitSubsystemId`, `SuitInterfaceId`, `SuitEventId`, `SuitCommandId`, `SuitRevision`, and `SuitTick`. IDs match exactly `^[a-z0-9][a-z0-9._:-]{0,127}$`; factories do not trim or normalize. Revisions are nonnegative safe integers. Factories validate all nested values, defensive-copy collections, canonical-sort keyed data, and recursively freeze outputs.

`SuitDefinition` contains ID/schema, channel maxima, nominal and safe temperature ranges, warning/critical thresholds, subsystem/interface definitions, allowed modes, immutable validated `SuitRecoveryRules` with per-command health and seal repair limits, damage rules, and registry/algorithm version. `SuitStateSnapshot` contains state/actor/definition IDs, revision/tick, every channel, immutable initial repair ceilings, mode/workload, subsystem states that match their definition IDs/revisions, remainder accumulators, canonical derived alerts, incapacitation state, and content signature. State-owned `healthRepairCeilingMilliPoints` captures the initial-state health repair cap, remains at or below the definition maximum, and is not a separate definition-level ceiling. Repair is bounded by the per-command recovery limit, definition maximum, and initial-state ceiling and cannot create capacity.

`SuitEnvironmentExposure` contains evaluated per-tick oxygen loss, energy draw/gain, temperature delta, seal damage, radiation, contamination, health damage, canonical hazard tags, and source ID/revision. It never calculates atmosphere physics.

## Closed registries

Workload is closed to `Rest`, `Walk`, `Sprint`, `HeavyWork`, `Incapacitated`, each with definition-configured oxygen, energy, and thermal rates. Life-support mode is closed to `Nominal`, `Conserve`, `Emergency`, `Offline`; mode changes require a validated command except an explicitly documented definition-driven fail-safe—never a secret auto-switch.

Subsystem roles include `oxygen-regulator`, `thermal-control`, `seal-monitor`, `radiation-monitor`, `contamination-filter`, `equipment-bus`, and `emergency-beacon`. Each definition has stable ID, continuous draw, optional oxygen/thermal/filter effect, priority, required interface, and revision; state is `Enabled`, `Disabled`, or `Faulted`. Enabling never heals `Faulted`. Unknown modes or roles fail closed.

## Command model

Commands are `SetWorkload`, `SetLifeSupportMode`, `SetSubsystemEnabled`, `ApplyExposure`, `ApplyExternalDamage`, `ApplyRepair`, `ResupplyOxygen`, `RechargeEnergy`, and `Decontaminate`. Every command carries command ID, actor/state IDs, expected and resulting revision, tick, payload, source ID, and optional reason. Transitions use exact CAS, reject duplicate command IDs anywhere in a submitted aggregate schedule before any mutation as well as previously accepted IDs and backward ticks, and publish immutable rejection results. Caller inputs are never mutated. Every accepted command increments revision exactly once. A valid command with no domain change returns explicit `NoChange`. Resupply/recharge report actual accepted quantity and typed result. Faulted remains immutable under enable/disable commands until an explicit repair; repair emits canonical subsystem state events and is bounded by per-command recovery limits, the definition maximum, and immutable initial-state ceilings.

## Tick pipeline

Each tick has fixed phases and canonical collection traversal:

1. validation;
2. command transitions;
3. workload baseline;
4. active subsystem draws/effects;
5. exposure;
6. seal/oxygen consequences;
7. energy under-supply/fail-safe;
8. temperature/radiation/contamination consequences;
9. health damage;
10. incapacitation;
11. alert derivation;
12. canonical events/signature;
13. immutable publication.

No result depends on object, map, set, or caller insertion order. Signed quotient/remainder arithmetic preserves the sign of sub-tick rates without ever publishing `-0`; bounded additions/subtractions saturate rather than overflow. Oxygen and thermal consequences use the composed/net workload, mode, subsystem, exposure, and damage rates. Phase 4 applies subsystem power allocation and effects before phase 5 applies exposure energy.

For an aggregate call, in-window commands execute exactly once immediately before their designated tick; following ticks do not replay them. Commands earlier than the aggregate start or at/after its exclusive end reject deterministically. Given equivalent schedules, one aggregate call and repeated one-tick calls produce byte-identical canonical state, events, and command results.

## Power, oxygen, and hazards

Energy never becomes negative and the core never invents proportional draws. If insufficient, lower-priority subsystems become deterministically `Disabled` or `PowerStarved`, with stable subsystem ID as tie-break. Emergency/Offline state is visible; the equipment bus may go offline; semantic event lists describe starvation and state transitions rather than a separate persistent subsystem state.

Seal and oxygen are separate. Explicit exposure oxygen loss is combined with a deterministic definition-configured damaged-suit leak multiplier. Oxygen clamps at zero and raises `OxygenDepleted`; configured damage then affects health. Health zero incapacitates. Depletion recovery requires actual resupply, not elapsed time or mode change.

Temperature uses definition thresholds. Critical temperature alerts are inclusive at either critical bound, while health damage occurs only strictly outside those bounds; there is no magic return to nominal. Thermal control works only when Enabled, Powered, and not Faulted. Radiation is cumulative and monotonic; alerts/damage occur only where definition thresholds/rules exist. Contamination accumulates exposure; filtering changes incoming contamination only, explicit `Decontaminate` removes it, and it never becomes negative.

## Alerts, events, and signatures

Alert severity is `Info`, `Caution`, `Warning`, `Critical`. Codes include `OxygenLow`, `OxygenCritical`, `OxygenDepleted`, `EnergyLow`, `EnergyCritical`, `EquipmentBusOffline`, `SealDamaged`, `SealCritical`, `TemperatureLow`, `TemperatureHigh`, `TemperatureCritical`, `RadiationElevated`, `RadiationCritical`, `ContaminationElevated`, `ContaminationCritical`, `SubsystemFault`, and `ActorIncapacitated`. Alerts are canonically derived from the validated resulting state; factories either derive them or validate an exact caller-supplied set, so stale or forged alerts cannot become authority. `SubsystemFault` is binary with measurement/threshold `1/1`. Sort by severity descending, fixed code priority, source ID, then alert ID. Authority is structured `code`, `severity`, `measurement`, `threshold`, `source`, `suggestedAction`; UI wording is not authoritative.

Events include `SuitCommandAccepted`, `SuitCommandRejected`, `SuitChannelChanged`, `SuitAlertRaised`, `SuitAlertCleared`, `SuitSubsystemStateChanged`, `SuitLifeSupportModeChanged`, `SuitPowerStarved`, and `SuitActorIncapacitated`. Public direct accepted commands emit canonical alert raise/clear deltas. Aggregate execution suppresses those direct duplicates and derives consolidated transitions in phase 11. Stable IDs derive from canonical input. Derived alert IDs and remainder keys use stable bounded canonical hashing when composing full-length public IDs would exceed the public ID grammar, and always remain regex-valid within 128 characters. Sort by tick, fixed phase, actor, source, event ID. Canonical serialization yields byte-identical JSON plus state/event signatures for identical input.

## Equipment interface

`SuitEquipmentInterfaceSnapshot` is a read-only projection for Agent O containing state/definition/revision, sorted interface IDs, `continuousPowerBudgetMilliwatts`, `pulseEnergyAvailableMillijoules`, `thermalDissipationBudgetMilliwatts`, `equipmentBusOnline`, `actorIncapacitated`, and canonical signature. It never mutates suit state or authorizes energy use.

## Errors

Public `SuitValidationError` and `SuitTransitionError` expose machine code, canonical path, message, and optional cause. Expected boundary errors are normalized into these types. Programmer errors are never caught or masked.

## Browser proof and evidence

The E2E opens normal `/`, installs console-error, page-error, request-failure, and HTTP >=400 collectors before navigation, proves `window.TestBridge` is absent, then dynamically imports only `/src/suit/index.ts`. It executes twice: Nominal → Walk → damaged seal → high equipment draw/starvation → radiation plus contamination → oxygen critical → Emergency → recharge/resupply, proving correct raise/clear transitions and identical signatures. JSON/Markdown evidence has no timestamps or screenshots; two regenerations must be byte-identical. The exact focused command is `npm run test:e2e -- tests/e2e/suit-survival-state-core.spec.ts --workers=1 --retries=0`.

## Tradeoffs

Safe integers plus remainder accumulators are more verbose than floating-point deltas but make cross-runtime replay exact. A closed registry limits extension but prevents silent semantic drift in V1. Replaying aggregate steps rather than algebraically collapsing them costs CPU but preserves phase/event equivalence and keeps one authoritative transition path.

The existing shared deterministic FNV hash is reused, including stable bounded canonical derivation for overlong composed identities. Canonicalization and recursive freezing remain strict and local because nearby helpers permit floating-point values or normalize `-0`, while importing other domain ownership would create unwanted coupling.
