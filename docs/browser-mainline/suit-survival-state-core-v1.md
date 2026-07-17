# Suit Survival State Core V1

## Purpose and authority boundary

`apps/weltraum-browser/src/suit` is the implemented, renderer- and UI-independent TypeScript authority for a suit's health, oxygen, energy, seal, internal temperature, cumulative radiation, contamination, life-support mode, workload, subsystem state and power, alerts, critical state, incapacitation, and canonical semantic events.

Adapters may supply only:

- a simulation tick/step count;
- evaluated `SuitEnvironmentExposure` values;
- actor workload and activated-subsystem choices through commands; and
- explicit external damage, repair, oxygen resupply, energy recharge, and decontamination commands.

The core does **not** evaluate atmosphere, fluid or body physics, collision, raycasts, combat hits, inventory/resource transfers, or world conditions. It does not own world, combat, resources, cargo, UI, rendering, audio, input, persistence, frame rate, or wall-clock time. Those future or separate adapters must evaluate their own truth and pass explicit canonical inputs; UI and render code may only project suit snapshots and results.

## Deterministic time and arithmetic

`SUIT_SIMULATION_HZ` is exactly `10`: one suit tick is 100 ms. `SuitTick` is a nonnegative safe integer and `SuitStepCount` is a positive safe integer. The API accepts no variable delta or wall-clock milliseconds and has no `Date.now` or `performance.now` dependency.

`advanceSuitState(state, input, stepsValue = 1)` replays the same per-tick transition `stepsValue` times. In-window commands execute exactly once immediately before their designated tick and are not replayed on following aggregate ticks. Commands before the aggregate start or at/after its exclusive end reject deterministically, and duplicate IDs anywhere in the submitted schedule pre-reject before mutation. Equivalent aggregate and repeated one-tick schedules therefore produce byte-identical canonical state, events, and command results.

Authoritative quantities use safe-integer scaled units:

- `healthMilliPoints`
- `oxygenMilligrams`
- `energyMillijoules`
- `sealIntegrityBasisPoints` (bounded to `0..10000` and the definition maximum)
- `internalTemperatureMilliKelvin`
- monotonic `radiationMicrosieverts`
- `contaminationMicroUnits`

Factories reject `NaN`, infinities, `-0`, unsafe integers, and values that would need implicit rounding. Named signed quotient/remainder entries in `rateRemainders` preserve fractional per-second effects across ticks without publishing `-0`; a remainder's magnitude must remain below its positive denominator. Bounded arithmetic saturates safely rather than overflowing. Canonical operations do not erase slow rates or depend on collection insertion order.

## Identity, factories, errors, and immutability

Canonical IDs match `^[a-z0-9][a-z0-9._:-]{0,127}$` exactly; there is no trimming or normalization. Exported branded identities include `SuitDefinitionId`, `SuitStateId`, `SuitActorId`, `SuitSubsystemId`, `SuitInterfaceId`, `SuitEventId`, `SuitCommandId`, `SuitAlertId`, `SuitSourceId`, `SuitRevision`, `SuitTick`, and `SuitStepCount`. Revisions are nonnegative safe integers.

Use the exported canonical factories rather than constructing authoritative objects by assertion. Confirmed public entry points are:

```ts
createSuitDefinition(value: unknown, path = "/definition"): SuitDefinition
createSuitEnvironmentExposure(value: unknown, path = "/exposure"): SuitEnvironmentExposure
createSuitStateSnapshot(value: unknown, definition: SuitDefinition, path = "/state"): SuitStateSnapshot
createSuitCommand(value: unknown, path = "/command"): SuitCommand
applySuitCommand(stateValue: SuitStateSnapshot, definition: SuitDefinition, commandValue: SuitCommand): SuitCommandResult
advanceSuitState(stateValue: SuitStateSnapshot, input: SuitAdvanceInput, stepsValue: number = 1): SuitAdvanceResult
canonicalSuitCommandResultsJson(results: readonly SuitCommandResult[]): string
createSuitEquipmentInterfaceSnapshot(state: SuitStateSnapshot, definition: SuitDefinition): SuitEquipmentInterfaceSnapshot
```

The barrel also exports the canonical, validation, model, command, event, alert, equipment, simulation, type, and error capabilities. Factories validate nested values, defensive-copy and canonical-sort keyed collections, calculate signatures, and recursively freeze published values. `SuitValidationError` and `SuitTransitionError` expose a machine `code`, canonical `path`, message, and optional cause. Expected boundary failures use these types; programmer failures are not masked.

## Definition, state, exposure, workloads, modes, and subsystems

`SuitDefinition` carries schema and definition identity; health, oxygen, energy, and seal maxima; nominal/safe/warning/critical temperature boundaries; alert thresholds; immutable validated `SuitRecoveryRules` containing `healthRepairLimitMilliPointsPerCommand` and `sealRepairLimitBasisPointsPerCommand`; damage rules; complete workload and mode profiles; allowed modes; subsystem and equipment-interface registries; an optional equipment-bus-loss fail-safe; registry/algorithm versions; and a content signature. There is no separate definition-level health repair ceiling.

`SuitStateSnapshot` carries state, actor, and definition IDs; revision and tick; all authoritative channels; immutable initial `sealRepairCeilingBasisPoints` and `healthRepairCeilingMilliPoints`; mode and workload; subsystem states matched to their definitions; persisted rate remainders; active canonically derived alerts and derived `criticalState`; incapacitation; accepted command IDs; and a content signature.

`SuitEnvironmentExposure` is already-evaluated per-tick input: oxygen loss, energy draw and gain, temperature delta, seal damage, radiation, contamination, direct health damage, canonical hazard tags, source ID, and source revision. It is a value object, not an atmosphere or hazard-physics API.

The five closed workloads are `Rest`, `Walk`, `Sprint`, `HeavyWork`, and `Incapacitated`, with definition-owned oxygen, energy, and thermal rates. The four closed life-support modes are `Nominal`, `Conserve`, `Emergency`, and `Offline`, with definition-owned rate adjustments. Mode changes require a validated command except for the explicit definition-configured equipment-bus-loss fail-safe.

Subsystem roles are `oxygen-regulator`, `thermal-control`, `seal-monitor`, `radiation-monitor`, `contamination-filter`, `equipment-bus`, and `emergency-beacon`. A subsystem definition has stable ID and revision, role, continuous power draw, optional oxygen/thermal/filter effect, priority, and required interface. Runtime status is `Enabled`, `Disabled`, or `Faulted`; power state is `Powered`, `Unpowered`, or `PowerStarved`. Enabling a faulted subsystem does not repair it. Unknown roles, modes, statuses, and power states fail closed.

## Commands, CAS, and accepted results

The closed command kinds are:

- `SetWorkload`
- `SetLifeSupportMode`
- `SetSubsystemEnabled`
- `ApplyExposure`
- `ApplyExternalDamage`
- `ApplyRepair`
- `ResupplyOxygen`
- `RechargeEnergy`
- `Decontaminate`

Every command contains command, actor, state, and source IDs; `expectedRevision`; `resultingRevision`; tick; a kind-specific payload; and an optional reason. CAS is exact at execution: state and actor must match, command tick must equal the current state tick, expected revision must equal the current revision, and resulting revision must be exactly expected revision plus one. Duplicate command IDs anywhere in an aggregate schedule pre-reject before any mutation. Previously accepted command IDs, backward ticks, out-of-window future ticks, and invalid targets reject without mutating state or caller inputs.

Every accepted command increments revision exactly once and records its command ID, even when its valid payload has no domain effect. Such acceptance returns `status: "Accepted"` with `outcome: "NoChange"`; a real effect returns `"Changed"`. Rejections return `status: "Rejected"`, the original state, a typed transition error, canonical rejection events, and no applied exposure. `canonicalSuitCommandResultsJson` is the deterministic byte representation for aggregate/repeated command-result schedules: it projects every result field, including Changed/NoChange, and normalizes rejected errors to `code`, canonical `path`, and `message`; optional diagnostic `cause` is deliberately excluded from canonical bytes. Resupply and recharge report the actual accepted amount (`actualAcceptedMilligrams` or `actualAcceptedMillijoules`), and decontamination reports `actualRemovedMicroUnits`; capacities and zero are never crossed. Repair is bounded by definition-owned per-command limits, definition maxima, and the state's immutable initial seal and health repair ceilings. `healthRepairCeilingMilliPoints` captures the initial-state health repair cap and remains at or below `healthMaximumMilliPoints`. Faulted remains unchanged under enable/disable until explicit repair; repairing it moves it to disabled/unpowered and emits canonical subsystem state events.

## Exact simulation pipeline

Each tick follows these 13 phases, with canonical collection traversal:

1. Validation
2. Command transitions
3. Workload baseline
4. Active subsystem power, draws, and effects
5. Exposure, including exposure energy
6. Seal and oxygen consequences
7. Energy under-supply and fail-safe
8. Temperature, radiation, and contamination consequences
9. Health damage
10. Incapacitation
11. Alert derivation
12. Canonical events and signature
13. Immutable publication

Commands are canonical-sorted before application; exposures and output events are also canonically ordered. Caller object, array, map, or set insertion order cannot become authority. Oxygen and thermal behavior use composed/net workload, mode, subsystem, exposure, and damage rates.

## Power, survival, and hazard behavior

Energy clamps within capacity and never becomes negative. The core does not invent proportional power allocation. Enabled subsystems are considered by priority (higher first), with stable subsystem ID as the deterministic tie-break. A subsystem whose full per-tick demand cannot be met becomes `PowerStarved`; state-change and starvation event lists describe transitions, not a separate persistent subsystem state. Equipment-bus loss makes its projection offline and may select only the definition's explicit `Emergency` or `Offline` fail-safe mode.

Explicit exposure oxygen loss and damaged-seal leakage are separate contributors. Seal damage lowers integrity; the definition's zero-integrity leak rate is scaled deterministically by missing seal integrity. Oxygen clamps at zero, raises `OxygenDepleted`, and applies configured health damage. Elapsed time or a mode change cannot recover depleted oxygen: an actual resupply is required.

Temperature changes only through configured workload/mode rates, powered thermal-control effects, and exposure. There is no automatic return to nominal. Thermal control requires an enabled, powered, non-faulted subsystem. Critical alerts are inclusive at either critical bound, while configured health damage applies only strictly outside those bounds. Radiation only accumulates and is monotonic; configured thresholds drive alerts and critical damage. Contamination accumulates, never becomes negative, and filters reduce only incoming contamination while powered; removal requires `Decontaminate`.

Direct and configured oxygen, temperature, radiation, and contamination damage reduce health without crossing zero. Health zero sets `actorIncapacitated`, forces workload `Incapacitated`, raises the canonical alert, and emits incapacitation semantics. A successful explicit repair can restore health; the command transition then returns workload to `Rest` when recovering from incapacitation.

## Alerts, events, and canonical order

Alert severities are `Info`, `Caution`, `Warning`, and `Critical`. Codes are `OxygenLow`, `OxygenCritical`, `OxygenDepleted`, `EnergyLow`, `EnergyCritical`, `EquipmentBusOffline`, `SealDamaged`, `SealCritical`, `TemperatureLow`, `TemperatureHigh`, `TemperatureCritical`, `RadiationElevated`, `RadiationCritical`, `ContaminationElevated`, `ContaminationCritical`, `SubsystemFault`, and `ActorIncapacitated`.

Alerts are canonically derived from validated resulting state; an exact caller-supplied alert set must match that derivation, so stale or forged alerts reject. `SubsystemFault` uses binary measurement/threshold `1/1`, not subsystem revision history. Alerts sort by severity descending, then fixed code priority, source ID, and alert ID. The implemented fixed code priority is: `ActorIncapacitated`, `OxygenDepleted`, `OxygenCritical`, `EnergyCritical`, `TemperatureCritical`, `RadiationCritical`, `ContaminationCritical`, `SealCritical`, `EquipmentBusOffline`, `SubsystemFault`, `OxygenLow`, `EnergyLow`, `TemperatureLow`, `TemperatureHigh`, `RadiationElevated`, `ContaminationElevated`, `SealDamaged`. Structured code, severity, measurement, threshold, source, and suggested action are authoritative; UI prose is not.

Event kinds are `SuitCommandAccepted`, `SuitCommandRejected`, `SuitChannelChanged`, `SuitAlertRaised`, `SuitAlertCleared`, `SuitSubsystemStateChanged`, `SuitLifeSupportModeChanged`, `SuitPowerStarved`, and `SuitActorIncapacitated`. Public direct accepted commands emit canonical alert raise/clear deltas. Aggregate execution suppresses those direct-command duplicates and derives consolidated alert transitions in phase 11. Stable event IDs derive from canonical input. Derived alert IDs and remainder keys use stable bounded canonical hashing when concatenating maximum-length public IDs would exceed the grammar; they remain regex-valid and at most 128 characters. Events sort by tick, fixed event phase, actor ID, source ID, and event ID. Identical canonical input produces byte-identical serialization, state signatures, and event signatures.

## Read-only equipment projection

`SuitEquipmentInterfaceSnapshot` is the read-only Agent O integration projection. It contains `stateId`, `definitionId`, `revision`, sorted `interfaceIds`, `continuousPowerBudgetMilliwatts`, `pulseEnergyAvailableMillijoules`, `thermalDissipationBudgetMilliwatts`, `equipmentBusOnline`, `actorIncapacitated`, and `canonicalSignature`. Offline bus projections expose zero budgets. This snapshot neither mutates suit state nor reserves, spends, or authorizes energy; an equipment adapter must use its own command/admission contract.

## Integration and browser proof

Browser consumers must import the canonical barrel only:

```ts
const suit = await import("/src/suit/index.ts");
```

Do not import implementation files as competing contracts or reproduce suit authority in UI/render adapters. The focused browser proof is `apps/weltraum-browser/tests/e2e/suit-survival-state-core.spec.ts`. It is expected to open normal `/`, install failure collectors before navigation, prove `window.TestBridge` is absent, dynamically import only `/src/suit/index.ts`, and run the normative Nominal → Walk → damaged seal → high draw/starvation → radiation and contamination → oxygen critical → Emergency → recharge/resupply flow twice. Run it exactly with `npm run test:e2e -- tests/e2e/suit-survival-state-core.spec.ts --workers=1 --retries=0`. The expected browser health counters, in reporting order, are console errors/page errors/request failures/HTTP >=400 failures = `0/0/0/0`; there is no warnings counter. Correct alert transitions and byte-identical evidence are required across both runs.

Normative evidence paths are:

- `apps/weltraum-browser/evidence/browser-suit-survival-state-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-suit-survival-state-core-v1.md`

Evidence is expected to be timestamp-free and screenshot-free because this slice has no UI/render change. These paths identify the proof artifacts; this document does not substitute for rerunning or independently verifying them.

The normative verification matrix has exactly 32 user checks: unit checks 1–30 cover the deterministic contract, browser check 31 covers byte-identical repetition, and browser check 32 covers the four health counters. These identifiers are not claims about test-runner case numbering. The focused suit unit suite currently contains 64 behavior tests as freshly reported. Final completion preflight and human review remain pending.

## Reuse rationale

The implementation reuses the shared deterministic FNV hash, including stable bounded canonical derivation for overlong composed identities. Strict canonicalization and recursive freezing stay local because nearby helpers permit floating-point values or normalize `-0`, and importing other domain helpers would couple suit authority to unrelated owners.

## Known V1 limits

- The module is a pure core and equipment projection, not a wired player UI, renderer, input flow, persistence format, or save migration.
- World/atmosphere, combat, resource/inventory, and equipment consumers are not implemented by this contract; they remain separate authorities and must provide explicit adapters.
- There is no automatic mode optimization, hidden replan, implicit resupply, passive decontamination, magic thermal normalization, proportional brownout, or capacity creation.
- Workloads, modes, subsystem roles, alert codes, event kinds, scaled units, and algorithm/registry versions are closed V1 registries; extension requires a new versioned contract rather than unknown-value fallback.
- The equipment snapshot reports availability only. It is not a transaction, reservation, or authorization API.
