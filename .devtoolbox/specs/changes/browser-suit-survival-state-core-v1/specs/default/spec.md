# Capability: Deterministic Suit Survival State Core V1

## Requirement: Domain authority and inputs

The system SHALL be a renderer/UI-independent TypeScript authority for health, oxygen stock/supply, suit energy, seal basis points, internal mK, cumulative radiation µSv, contamination micro-units, mode, workload, subsystems, alerts/critical state, incapacitation, and canonical semantic events. It SHALL accept only evaluated exposure, actor workload, activated subsystems, external damage/repair/resupply commands, and simulation ticks.

It SHALL NOT own UI/render/audio/input/persistence/FPS, world/atmosphere/fluid/body physics, collision/raycast, inventory transfer, combat hits, or any world/combat/resource/UI decision.

## Requirement: Fixed deterministic time

`SUIT_SIMULATION_HZ` SHALL equal 10 and each tick exactly 100 ms. `SuitTick` SHALL be a nonnegative safe integer; `SuitStepCount` SHALL be a positive safe integer. Wall-clock milliseconds, variable delta, `Date.now`, and `performance.now` are forbidden. Advancing N aggregated ticks SHALL produce the same canonical state and semantic event signatures as N single steps, including a required 100-versus-100 scenario.

## Requirement: Exact canonical data

Authoritative channels SHALL be safe integers named `healthMilliPoints`, `oxygenMilligrams`, `energyMillijoules`, `sealIntegrityBasisPoints` (0..10000), `internalTemperatureMilliKelvin`, monotonic `radiationMicrosieverts`, and `contaminationMicroUnits`, with configured health/oxygen/energy maxima. Factories SHALL reject NaN, Infinity, `-0`, unsafe integers, and implicit rounding. Deterministic quotient/remainder accumulators SHALL preserve slow configured rates.

IDs SHALL include at least `SuitDefinitionId`, `SuitStateId`, `SuitActorId`, `SuitSubsystemId`, `SuitInterfaceId`, `SuitEventId`, `SuitCommandId`, `SuitRevision`, and `SuitTick`. IDs SHALL match exactly `^[a-z0-9][a-z0-9._:-]{0,127}$` without trimming/normalization; revisions SHALL be nonnegative safe integers. Factories SHALL validate, defensive-copy, canonical-sort, and recursive-freeze.

## Requirement: Definition, state, and exposure

`SuitDefinition` SHALL contain ID/schema, channel maxima, nominal/safe temperature ranges, warn/critical thresholds, subsystem/interface definitions, allowed modes, immutable validated `SuitRecoveryRules` containing per-command health and seal repair limits, damage rules, and registry/algorithm version. It SHALL NOT define a separate health repair ceiling.

`SuitStateSnapshot` SHALL contain state/actor/definition IDs, revision/tick, all channels, immutable `healthRepairCeilingMilliPoints` capturing the initial-state health repair cap and remaining at or below the definition health maximum, mode/workload, subsystem states, remainder accumulators, prior canonical alerts, incapacitation state, and content signature.

`SuitEnvironmentExposure` SHALL contain evaluated per-tick oxygen loss, energy draw/gain, temperature delta, seal damage, radiation, contamination, health damage, hazard tags, and source ID/revision. It SHALL never calculate atmosphere physics.

## Requirement: Closed workloads, modes, and subsystems

Workload SHALL be closed to `Rest`, `Walk`, `Sprint`, `HeavyWork`, `Incapacitated`, with configured oxygen/energy/thermal rates. Mode SHALL be closed to `Nominal`, `Conserve`, `Emergency`, `Offline`; no mode auto-switch is permitted except a validated command or explicit definition-documented fail-safe.

Subsystem roles SHALL include `oxygen-regulator`, `thermal-control`, `seal-monitor`, `radiation-monitor`, `contamination-filter`, `equipment-bus`, `emergency-beacon`. Each SHALL have stable ID, `Enabled`/`Disabled`/`Faulted` state, continuous draw, optional oxygen/thermal/filter effect, priority, required interface, and revision. State entries SHALL match their subsystem definitions. A Faulted subsystem SHALL remain Faulted under enable/disable until explicit repair, which SHALL emit canonical subsystem events. Unknown modes/roles SHALL fail closed.

## Requirement: Commands and CAS

The system SHALL support `SetWorkload`, `SetLifeSupportMode`, `SetSubsystemEnabled`, `ApplyExposure`, `ApplyExternalDamage`, `ApplyRepair`, `ResupplyOxygen`, `RechargeEnergy`, `Decontaminate`. Each SHALL carry command ID, actor/state IDs, expected/resulting revision, tick, payload, source ID, optional reason. CAS SHALL be exact; duplicate IDs anywhere in a submitted aggregate schedule SHALL pre-reject before mutation, and previously accepted duplicates and backward ticks SHALL reject immutably. Caller inputs SHALL NOT be mutated. Accepted commands SHALL increment revision exactly once. No-effect acceptance SHALL return explicit `NoChange`. Resupply/recharge SHALL return actual accepted amount and typed result. Repair SHALL be bounded by immutable definition-owned per-command limits, the definition maximum, and immutable initial-state seal and health repair ceilings.

## Requirement: Ordered transition

`advanceSuitState` SHALL process each tick in this exact order: validation; command transitions; workload baseline; active subsystem power/draws/effects; exposure including exposure energy; seal/oxygen consequences; energy under-supply/fail-safe; temperature/radiation/contamination consequences; health damage; incapacitation; alert derivation; canonical events/signature; immutable publication. Collection iteration order SHALL NOT affect output. Signed quotient/remainder arithmetic SHALL preserve sign without `-0`, bounded arithmetic SHALL saturate safely, and oxygen/thermal rates SHALL compose to their deterministic net values. In-window commands SHALL execute exactly once immediately before their designated tick and SHALL NOT replay on following aggregate ticks. Commands before the aggregate start or at/after its exclusive end SHALL reject deterministically. Equivalent aggregate and repeated schedules SHALL produce byte-identical canonical state, events, and command results.

## Requirement: Power and survival consequences

Energy SHALL never be negative. The core SHALL NOT invent proportional draws. Insufficient energy SHALL deterministically disable or mark lower-priority subsystems `PowerStarved`, tie-breaking by stable subsystem ID, exposing Emergency/Offline, equipment bus loss, and transition events. Power-starvation event lists SHALL describe transitions, not establish a separate persistent subsystem state.

Explicit exposure oxygen loss and a definition-configured deterministic damaged-seal leak multiplier SHALL remain distinct inputs to oxygen loss. Oxygen SHALL clamp at zero, raise `OxygenDepleted`, apply configured health damage, and cause incapacitation at health zero. Recovery from depletion SHALL require actual resupply.

Temperature thresholds SHALL come from the definition; critical alerts SHALL be inclusive at critical bounds, damage SHALL occur only strictly outside those bounds, and there SHALL be no magic nominal return. Thermal control SHALL require Enabled, Powered, and non-Faulted. Radiation SHALL be cumulative and monotonic, with threshold alerts/damage only when defined. Contamination SHALL accumulate; filters affect incoming rate only; `Decontaminate` is explicit; contamination SHALL never be negative.

## Requirement: Canonical alerts and events

Severity SHALL be `Info`, `Caution`, `Warning`, `Critical`. Alert codes SHALL include `OxygenLow`, `OxygenCritical`, `OxygenDepleted`, `EnergyLow`, `EnergyCritical`, `EquipmentBusOffline`, `SealDamaged`, `SealCritical`, `TemperatureLow`, `TemperatureHigh`, `TemperatureCritical`, `RadiationElevated`, `RadiationCritical`, `ContaminationElevated`, `ContaminationCritical`, `SubsystemFault`, `ActorIncapacitated`. Alerts SHALL be canonically derived from resulting state, or an exact caller-supplied set SHALL be validated against that derivation; stale or forged alerts SHALL reject. `SubsystemFault` SHALL use binary measurement and threshold `1/1`. Alerts SHALL sort severity descending, fixed code priority, source ID, alert ID. Authority SHALL be code, severity, measurement, threshold, source, suggested action—not UI text.

Events SHALL include `SuitCommandAccepted`, `SuitCommandRejected`, `SuitChannelChanged`, `SuitAlertRaised`, `SuitAlertCleared`, `SuitSubsystemStateChanged`, `SuitLifeSupportModeChanged`, `SuitPowerStarved`, `SuitActorIncapacitated`. Public direct accepted commands SHALL emit canonical alert raise/clear deltas. Aggregate execution SHALL suppress those direct duplicates and derive consolidated alert transitions in phase 11. IDs SHALL derive from canonical input; derived alert IDs and remainder keys SHALL use stable bounded canonical hashing when needed and SHALL remain regex-valid and at most 128 characters for maximum-length public IDs. Events SHALL sort tick, phase, actor, source, event ID. Identical input SHALL produce byte-identical JSON and event/state signatures.

## Requirement: Equipment projection and errors

The read-only `SuitEquipmentInterfaceSnapshot` for Agent O SHALL contain state/definition/revision, interface IDs, continuous power budget mW, pulse energy available mJ, thermal dissipation budget mW, equipment bus online, actor incapacitated, and canonical signature. It SHALL neither mutate nor authorize energy.

Public `SuitValidationError`/`SuitTransitionError` SHALL contain machine code, canonical path, message, optional cause. Expected boundary failures SHALL normalize to these errors; programmer failures SHALL not be masked.

## Requirement: Verification scenarios

The verification matrix SHALL contain exactly 32 user checks. Unit checks 1–30 SHALL cover: (1) ID validation; (2) scalar/safe-int bounds; (3) `-0`; (4) frozen/nonmutation; (5) same signatures; (6) input-order invariance; (7) aggregate 100; (8) all five workloads; (9) mode CAS; (10) duplicate rejection; (11) backward tick; (12) oxygen/energy >=0; (13) no silent capacity excess; (14) deterministic starvation; (15) bus-offline snapshot; (16) leak/oxygen; (17) oxygen-depleted health; (18) temperature warning/critical/recovery; (19) radiation monotonic; (20) filter affects only incoming contamination; (21) decontaminate; (22) bounded repair; (23) faulted-enable/repair events; (24) deterministic alert sort; (25) raise/clear and canonical alert validation; (26) incapacitation; (27) `NoChange`; (28) unknown mode/roles fail closed; (29) forbidden APIs/imports; and (30) signed remainder, saturation, phase order, schedule equivalence, definition matching, and caller non-mutation. Browser check 31 SHALL prove byte-identical repetition. Browser check 32 SHALL prove health counters `0/0/0/0`. These are user-check identifiers, not claims about test-runner case numbering.

The browser SHALL use normal `/`, install collectors in the reporting order console errors, page errors, request failures, HTTP >=400 failures before navigation, prove no `window.TestBridge`, dynamically import only `/src/suit/index.ts`, and twice run Nominal→Walk→damaged seal→high equipment draw/starvation→radiation+contamination→oxygen critical→Emergency→recharge/resupply with correct alert transitions and identical signatures. The exact command SHALL be `npm run test:e2e -- tests/e2e/suit-survival-state-core.spec.ts --workers=1 --retries=0`. Evidence SHALL be timestamp-free JSON/Markdown, regenerate twice byte-identically, and contain no screenshots.

## Requirement: Change boundary

Implementation changes SHALL be limited to this change directory, `src/suit/**`, `tests/unit/suit*.test.ts`, the single suit E2E, two named evidence files, and the named browser-mainline document. `main.ts`, `style.css`, other gameplay owners, package/lock/config, CI, infra, and Unity are forbidden. The E2E SHALL remain outside package grouping.
