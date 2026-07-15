# Capability: Deterministic Ship Power and Thermal Core V1

## ADDED Requirements

### Requirement: Explicit Units and Stable Identity
The core SHALL use W, J, K, J/K, seconds, and finite [0,1] efficiencies. Every bus, source, consumer, battery, cooling device, thermal node, and event SHALL have stable validated identity.

#### Scenario: Invalid identity or numeric definition
- GIVEN duplicate IDs, unknown references, non-finite values, invalid ranges, or inconsistent definition/state pairs
- WHEN a step is requested
- THEN the core rejects the configuration with deterministic structured issues and produces no authoritative next state.

### Requirement: Isolated Power Buses
Each source, battery, and consumer SHALL belong to exactly one bus. Supply and demand SHALL never cross bus boundaries.

#### Scenario: Two independent buses
- GIVEN one powered bus and one undersupplied bus
- WHEN one step runs
- THEN surplus from the powered bus does not satisfy or charge anything on the undersupplied bus.

### Requirement: Deterministic Source Ramping
Source output SHALL remain within available capacity and change by no more than rampLimitWPerSecond multiplied by deltaTimeSeconds. Source selection SHALL be stable-ID deterministic.

#### Scenario: Demand step change
- GIVEN a previous source output and a new demand target
- WHEN a fixed step runs
- THEN output moves toward the target only within its ramp limit and reports deterministic loss heat.

### Requirement: Fixed Priority Allocation
The only V1 order SHALL be Critical, Flight, Safety, Mission, Utility, Comfort. Higher priorities SHALL receive power first.

#### Scenario: Critical and lower priority compete
- GIVEN insufficient supply for all requests
- WHEN allocation runs
- THEN Critical is considered before Flight and Flight before Utility regardless of insertion order.

### Requirement: Proportional Same-Class Sharing
Undersupplied consumers in one class SHALL share power proportionally to requestedPowerW. Floating remainder SHALL follow stable consumer-ID order.

#### Scenario: Same inputs in different insertion order
- GIVEN equal definitions and requests in different array orders
- WHEN allocation runs twice
- THEN allocations, states, events, canonical JSON, and signatures are identical.

### Requirement: Consumer Outcome States
Every request SHALL yield allocatedPowerW, satisfactionFraction, and exactly one of Powered, Throttled, Shed, Unavailable, or RejectedInvalidRequest.

#### Scenario: Insufficient allocation
- GIVEN throttleable and non-throttleable requests
- WHEN their available shares are below requested power
- THEN an operable throttleable request is Throttled, an allowed non-operable request is Shed, and no invalid request introduces NaN or Infinity.

### Requirement: Battery Energy Conservation
Battery charge/discharge SHALL respect capacity, stored joules, power limits, efficiencies, reserve, and positive step duration. Energy SHALL remain in [0, capacityJ]. Losses SHALL become heat.

#### Scenario: Preserve reserve
- GIVEN a battery at or above reserve with a bus deficit
- WHEN PreserveReserve is active
- THEN discharge never reduces energy below reserveEnergyJ.

#### Scenario: Critical emergency reserve
- GIVEN AllowCriticalReserveUse and Critical demand remaining after normal supply
- WHEN the step runs
- THEN reserve energy may serve only that Critical deficit and never a lower-priority load.

#### Scenario: Surplus charge
- GIVEN post-allocation bus surplus
- WHEN batteries have capacity
- THEN they charge in stable battery-ID order within input power, efficiency, and energy limits.

### Requirement: No Hidden Second Allocation
The core SHALL perform one consumer allocation pass. Power removed by final shedding SHALL not be redistributed to other consumers in that step.

#### Scenario: Provisional share cannot operate
- GIVEN a consumer whose proportional share is below its operating rules
- WHEN it is shed
- THEN its final allocation is zero and the freed power may only become battery-charge surplus.

### Requirement: Thermal Fixed-Step Integration
Each thermal node SHALL integrate temperature with (heatInputW - heatRemovedW) * deltaTimeSeconds / heatCapacityJPerK.

#### Scenario: Repeated identical steps
- GIVEN identical definitions, state, heat, cooling allocation, tick, and delta time
- WHEN the same step is evaluated twice
- THEN temperatures and canonical results are identical.

### Requirement: Power-Constrained Cooling
Cooling SHALL be zero at/below sink temperature, bounded by maxCoolingPowerW, and reduced deterministically when its referenced consumer lacks operating power.

#### Scenario: Cooling loses power
- GIVEN a hot node and an undersupplied cooling consumer
- WHEN the step runs
- THEN cooling removes less than maximum heat and CoolingInsufficient is emitted when applicable.

### Requirement: Thermal Protection
Thresholds SHALL be strictly warning < critical < shutdown and bounded by validated minimum/maximum temperatures. Node state SHALL be Nominal, Warning, Critical, Shutdown, or Invalid.

#### Scenario: Threshold progression
- GIVEN a node heated through warning, critical, and shutdown thresholds
- WHEN fixed steps run
- THEN each resulting protection state and required transition event is deterministic.

#### Scenario: Temperature exceeds validated bounds
- GIVEN a raw integration outside minimum/maximum
- WHEN the step runs
- THEN no out-of-range state is exposed, the attempted value and boundary are reported, and the node becomes Invalid rather than silently clamped.

### Requirement: Semantic Protection Actions
The core SHALL emit structured actions such as RequestConsumerThrottle, RequestConsumerShutdown, CoolingInsufficient, BatteryReserveLow, PowerBusBrownout, and ThermalNodeCritical without UI text or direct side effects.

#### Scenario: Brownout and overheating
- GIVEN unmet load and a node at a protection threshold
- WHEN a step runs
- THEN ordered semantic actions identify affected buses, consumers, batteries, and nodes but mutate no external component.

### Requirement: Canonical Events
The core SHALL support at least PowerAllocationCompleted, PowerConsumerThrottled, PowerConsumerShed, PowerBusBrownout, BatteryReserveLow, BatteryEmpty, BatteryFull, ThermalWarning, ThermalCritical, ThermalShutdown, and CoolingInsufficient. Events SHALL contain eventId, tick, sourceId, targetId, code, severity, and canonical payload.

#### Scenario: Deterministic event stream
- GIVEN equal canonical inputs
- WHEN two runs produce events
- THEN event ordering, IDs, payloads, and signatures are byte-identical.

### Requirement: Immutable Canonical Results
Caller inputs SHALL remain unchanged. Public results SHALL be recursively frozen. Canonical serialization SHALL sort keys/domain arrays, normalize -0, reject unsupported/non-finite data, and use no arbitrary numeric rounding.

#### Scenario: Mutation attempt
- GIVEN a completed result
- WHEN a caller attempts to mutate nested state or events
- THEN frozen data remains unchanged and repeating the canonical input yields the same signature.

### Requirement: Renderer and Runtime Independence
The new domain SHALL have no Three.js, mesh, scene, DOM, wall-clock, random, Ship Builder implementation, Combat implementation, Persistence implementation, Flight, Navigation, or Runtime dependency.

#### Scenario: Source audit
- GIVEN the complete new domain
- WHEN imports and nondeterministic APIs are scanned
- THEN no forbidden dependency, Date.now, or Math.random is present.

### Requirement: Browser-Level Proof
A focused Playwright spec SHALL load the normal route, prove window.TestBridge absent, dynamically import /src/ship-power-thermal/index.ts, exercise generator, battery, Critical, Flight, Weapon/Mission load, cooling, brownout, shedding, discharge, heating thresholds, cooling recovery, and duplicate-run canonical equality.

#### Scenario: Real browser execution
- GIVEN the normal Vite application route
- WHEN the focused core scenario executes twice
- THEN canonical outputs are identical and console, page, request, and HTTP error collections are empty.