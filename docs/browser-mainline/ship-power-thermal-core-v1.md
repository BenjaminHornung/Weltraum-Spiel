# Browser Ship Power/Thermal Core v1

## Scope

`apps/weltraum-browser/src/ship-power-thermal/index.ts` exports a standalone deterministic TypeScript core for isolated power buses, ramp-limited generators, priority-based consumers, batteries, thermal nodes, cooling units, protection actions, and canonical events. Callers provide every definition, prior state, request, heat contribution, simulation tick, and fixed-step duration.

The core is not integrated with Browser Runtime, Flight, Combat, Ship Builder, Resources, Persistence, UI, renderer, Three.js, or TestBridge. Its outcomes are domain evidence, not a claim that the playable ship currently consumes power or accumulates heat.

## Public Contract

- Stable branded IDs identify buses, generators, consumers, batteries, thermal nodes, cooling units, heat contributions, and events.
- Power uses watts, battery energy uses joules, temperature uses kelvin, heat capacity uses joules per kelvin, and time uses seconds.
- Consumer priority is fixed as `Critical`, `Flight`, `Safety`, `Mission`, `Utility`, then `Comfort`.
- Source dispatch follows explicit availability and ramp limits. Batteries discharge above reserve first and may charge only from final surplus.
- Consumer allocation is one pass. A provisional share removed by shedding is not reassigned to another consumer.
- Thermal integration uses only source/battery loss heat plus explicit heat contributions. Cooling requires an explicit consumer allocation and is bounded by power, capacity, and sink gradient.
- Warning, Critical, Shutdown, invalid-boundary metadata, semantic protection actions, canonical events, canonical JSON, and deterministic signatures are returned without mutating caller input.

## Deterministic Step Order

1. Validate and canonicalize definitions, state, tick, and positive fixed-step duration.
2. Ramp sources toward demand within explicit availability.
3. Apply reserve-aware battery discharge.
4. Allocate consumers by fixed priority and stable ID.
5. Finalize Powered, Throttled, Shed, Unavailable, or Rejected outcomes without a second allocation round.
6. Charge non-discharging batteries from final surplus.
7. Accumulate source loss, battery loss, and explicit heat; apply powered cooling; integrate temperature.
8. Derive protection actions and canonical events.
9. Publish a recursively frozen next state, canonical JSON, and signature.

## Normal-Route Browser Evidence

`apps/weltraum-browser/tests/e2e/ship-power-thermal-core.spec.ts` opens the normal `/` route through the existing Playwright/Vite web server and proves `window.TestBridge` is absent before and after the scenario. Browser context dynamically imports only `/src/ship-power-thermal/index.ts`.

The reproducible fixture contains a generator, battery, Critical consumer, Flight consumer, Weapon/Mission consumer, and Cooling consumer/unit. It proves:

1. normal operation with all requested consumers powered;
2. reduced generator availability with battery discharge, Critical/Flight/Safety priority preservation, Weapon/Mission shedding, and a brownout event;
3. two explicit fixed heat steps crossing Warning and then Critical;
4. a powered cooling step returning the node to Nominal;
5. two independent runs with equal serializable results, canonical JSON, signatures, event IDs, and event streams.

Console errors, uncaught page errors, failed requests, and non-success HTTP responses are collected from before navigation and asserted as four empty arrays without route interception or network exclusion. The test also proves that the normal document declares its existing PNG favicon at `/favicon.png`. No screenshot is required because this core has no UI or renderer integration.

Evidence:

- `apps/weltraum-browser/evidence/browser-ship-power-thermal-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-ship-power-thermal-core-v1.md`

## Focused Verification

Run from `apps/weltraum-browser` under Node 22:

```text
npm run test:e2e -- tests/e2e/ship-power-thermal-core.spec.ts
```

The existing Playwright configuration owns Vite startup. The spec is assigned exactly once to the existing `test:e2e:core` group.

## Explicitly Deferred

- Live ship/runtime, Flight, Combat, Ship Builder, Resources, Persistence, UI, HUD, renderer, or VFX integration.
- Product balance values, generator fuel, wiring/voltage physics, consumer efficiency/implicit heat, automatic protection command execution, save/load, offline progression, and multiplayer authority.
