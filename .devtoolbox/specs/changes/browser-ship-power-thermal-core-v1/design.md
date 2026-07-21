# Design: Browser Ship Power/Thermal Core V1

## Architecture Boundary
The new domain is self-contained in apps/weltraum-browser/src/ship-power-thermal. It consumes plain definitions, requests, prior state, tick, and positive delta time, and returns a new immutable state/result. Existing domains are read-only references and are not imported except narrowly reusable hash behavior if exact semantics match. V1 does not mutate or command Flight, Combat, Ship Builder, Persistence, Runtime, UI, renderer, or scenes.

## Units
- Power: watt (W).
- Energy: joule (J).
- Temperature: kelvin (K); Celsius never appears in authoritative state.
- Heat capacity: joule per kelvin (J/K).
- Time: seconds.
- Efficiency: finite ratio in [0, 1].
- Battery state stores joules, never percentage as source truth.

All values must be finite. Capacities, limits, temperatures, and time are validated according to their semantics. An operational source or battery direction with positive power and zero efficiency is rejected fail-closed because its loss would be undefined/infinite. Zero-capability disabled definitions may use zero efficiency without producing output.

## IDs and Referential Integrity
Use domain-owned branded string IDs for PowerBus, Source, Consumer, Battery, ThermalNode, Cooling, Event, and optional HeatContribution identities. IDs are non-empty stable printable ASCII and may not depend on display text or array position. Arrays are normalized lexically by ID. Duplicate IDs, missing definitions/states, unknown references, duplicate requests, and bus/node mismatches are hard validation errors. Invalid per-tick consumer numeric requests are represented as RejectedInvalidRequest without copying NaN or Infinity into output.

## Power-Bus Model
Multiple buses are evaluated independently in stable bus-ID order. Each source, battery, and consumer belongs to exactly one bus. A cooling definition refers to an explicit power consumer instead of receiving an invented priority. There is no transfer between buses and no dynamic switching, voltage, amperage, resistance, shorts, or physical wiring graph.

## Source Dispatch and Ramp
Each source state contains currentOutputW. For each bus, demand is calculated from valid consumer requests in canonical priority/ID order. Sources are considered in source-ID order. A source target is the remaining bus demand, capped by maxOutputW * availableFraction. Its next output moves toward that target by at most rampLimitWPerSecond * deltaTimeSeconds. Existing excess output may therefore ramp down gradually and become chargeable surplus. Electrical output is bus-side power. For efficiency greater than zero, source loss heat is outputW / efficiency - outputW and is routed to the source thermal node. No fuel/resource behavior exists.

## Allocation Policy
Priority order is Critical, Flight, Safety, Mission, Utility, Comfort. Each class receives only the pool left by higher classes. When a class is fully affordable, every request receives requestedPowerW. Otherwise raw shares are proportional to requestedPowerW in stable consumer-ID order. The floating remainder between the class pool and summed raw shares is assigned to the first still-capable consumer in that same stable order. No quantization or product balance precision is invented.

State interpretation:
- Powered: allocated power satisfies the request.
- Throttled: canThrottle is true and a positive allocation meets minimumOperationalPowerW but is below requested power.
- Shed: the request cannot operate and canShed is true; its final allocation is zero.
- Unavailable: the request cannot safely operate and neither valid throttling nor shedding can be applied; final allocation is zero.
- RejectedInvalidRequest: the individual request is invalid and receives zero without non-finite payload data.

If a provisional proportional share is removed by Shed or Unavailable classification, it is not redistributed to another consumer. It may become post-allocation surplus for battery charging. This enforces the no-hidden-second-allocation rule.

## Battery Discharge
Before consumer allocation, each bus computes source supply and total deficit. Batteries are traversed in battery-ID order. Normal discharge may only consume stored energy above reserveEnergyJ. Delivered bus power is limited by maxDischargePowerW and by (availableStoredEnergyJ * dischargeEfficiency / deltaTimeSeconds). Stored energy decreases by deliveredPowerW / dischargeEfficiency * deltaTimeSeconds. Loss power is internal draw minus delivered bus power and becomes heat.

For AllowCriticalReserveUse, the step first computes the remaining Critical demand after source supply and normal above-reserve discharge. Reserve energy may add only that amount, in stable battery order, and may not be used for lower classes. PreserveReserve never crosses reserve. Energy is bounded to [0, capacityJ]. No battery charges and discharges in the same step.

## Battery Charge
After final consumer allocation, remaining bus surplus charges batteries in battery-ID order. Accepted bus input is limited by maxChargePowerW and by remaining capacity divided by chargeEfficiency and delta time. Stored energy increases by acceptedPowerW * chargeEfficiency * deltaTimeSeconds. Charge loss is accepted input minus stored power and becomes heat. BatteryFull, BatteryEmpty, and BatteryReserveLow derive from canonical post-step state and transition/context rules specified in the implementation.

## Thermal Nodes and Heat
Each node has heatCapacityJPerK, current temperatureK, strict warning/critical/shutdown thresholds, minimumTemperatureK, and maximumTemperatureK. Required ordering is minimum <= warning < critical < shutdown <= maximum. Heat inputs are source losses, battery losses, and explicit HeatSourceContribution values. Consumer electrical allocation is not automatically treated as heat because V1 has no consumer efficiency contract.

A CoolingDefinition references one thermal node and one explicit power consumer. CoolingState records allocatedOperatingPowerW derived from that consumer's final allocation. Cooling is zero at or below sinkTemperatureK. Above the sink, effective removal is bounded by maxCoolingPowerW, available thermal gradient, and the deterministic ratio of allocatedOperatingPowerW to minimumOperatingPowerW, capped to [0,1]. A positive-capability cooling definition with non-positive minimumOperatingPowerW is invalid.

Temperature integration is:
nextTemperatureK = temperatureK + (heatInputW - heatRemovedW) * deltaTimeSeconds / heatCapacityJPerK.

The raw integrated value is retained in result metadata. If it exceeds validated minimum/maximum bounds, state temperature is held at the reached boundary, protection state becomes Invalid, and a deterministic issue/action/event records attempted temperature and boundary. There is no silent clamping.

## Protection State and Actions
Threshold classification is descending: Invalid boundary/validation outcome, Shutdown at or above shutdownTemperatureK, Critical at or above criticalTemperatureK, Warning at or above warningTemperatureK, otherwise Nominal. The core emits semantic actions only, including RequestConsumerThrottle, RequestConsumerShutdown, CoolingInsufficient, BatteryReserveLow, PowerBusBrownout, ThermalNodeCritical, and a boundary-rejection action where applicable. Actions contain codes and IDs, never UI text.

## Step Order
1. Validate and canonicalize definitions, state, tick, and positive delta time.
2. Determine source outputs within ramp limits.
3. Determine normal battery discharge and Critical-only emergency reserve discharge.
4. Allocate consumers by fixed priority.
5. Distribute an undersupplied class proportionally with stable-ID remainder.
6. Finalize Powered, Throttled, Shed, Unavailable, and Rejected results without consumer reallocation.
7. Charge batteries from final surplus.
8. Build source/battery loss heat plus explicit heat contributions, apply cooling, and integrate temperature.
9. Derive protection actions and canonical events.
10. Return recursively frozen next state, ordered results, canonical JSON, and signature.

## Event and Result Ordering
Required events include PowerAllocationCompleted, PowerConsumerThrottled, PowerConsumerShed, PowerBusBrownout, BatteryReserveLow, BatteryEmpty, BatteryFull, ThermalWarning, ThermalCritical, ThermalShutdown, and CoolingInsufficient. Additional boundary metadata events are permitted for fail-closed temperature handling.

Events are generated in semantic phases Power, Battery, Thermal, Protection, then ordered by tick, phase rank, bus/node ID, source ID, target ID, code, and stable ordinal. eventId is derived from tick, phase, source/target IDs, code, ordinal, and canonical payload. No random/time source participates. Payload keys are canonical and values are finite.

## Canonical Serialization and Immutability
Canonical JSON recursively sorts object keys, normalizes negative zero, preserves finite IEEE-754 numbers without arbitrary rounding, rejects cycles, sparse arrays, undefined, functions, symbols, BigInt, and non-plain objects, and uses domain-ID ordering for result collections. Signatures use a deterministic local hash over canonical JSON. Public inputs are never mutated. Returned definitions/state/results/actions/events are defensively cloned and recursively frozen.

## Error Model
Hard topology/configuration errors reject the step with structured issue code and path. Per-request invalid numeric data yields RejectedInvalidRequest so one malformed transient load does not create non-finite output or silently receive power. Any arithmetic that would produce NaN or Infinity fails closed before a next state is claimed.

## Non-Goals and Future Integration
V1 does not define product balance values, fuel consumption, source resources, consumer efficiency, automatic consumer heat, bus switching, wiring physics, UI text, runtime commands, persistence format, offline progression, or integration adapters. Any later integration requires its own contract and change.