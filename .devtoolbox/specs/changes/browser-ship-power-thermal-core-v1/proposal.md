# Proposal: Browser Ship Power/Thermal Core V1

## Motivation
The browser mainline has deterministic Ship Builder and Combat domain cores, but it has no authoritative renderer-independent model for electrical power allocation, battery energy, thermal integration, cooling, protection states, or their domain events. Existing power and heat values are reservation metadata only and must not be promoted into runtime truth by implication.

## Outcome
Add a pure TypeScript domain core under apps/weltraum-browser/src/ship-power-thermal that evaluates explicit fixed steps for isolated power buses and thermal nodes. Equal canonical inputs produce equal immutable states, events, protection actions, canonical JSON, and signatures.

## In Scope
- Stable IDs and strict validation for buses, sources, consumers, requests, batteries, thermal nodes, heat sources, and cooling definitions/state.
- Deterministic source ramping, priority allocation, proportional sharing, stable-ID remainder handling, brownouts, throttling, and load shedding.
- Energy-conserving battery charge/discharge with PreserveReserve and AllowCriticalReserveUse.
- Source and battery loss heat, explicit heat contributions, cooling constrained by allocated power, and fixed-step Kelvin integration.
- Nominal, Warning, Critical, Shutdown, and Invalid protection states plus semantic actions.
- Canonical ordered events, serialization, signatures, fixtures, unit tests, one focused real-browser Playwright test, evidence, and a browser-mainline domain document.

## Non-Goals
No integration with Ship Builder, Combat, Flight, Navigation, Persistence, Runtime, UI, renderer, scenes, resources, fuel, offline simulation, or other existing product domains. V1 has no bus switching, cable graph, resistance, voltage, current, shorts, fuel consumption, physical line graph, dynamic balancing, or invented production balance values.

## Constraints
- Base: origin/main at 5ff47aeef3c42c0b933e8480dafa5680759a40df.
- Node 22 is the verification baseline.
- Only prompt-allowlisted paths may change. Package files, main.ts, style.css, existing domains, agent-owned paths, .github, infra, and living-master-plan remain unchanged.
- Public results are deterministic, canonical, recursively immutable, finite, and insertion-order independent.
- No Date.now, Math.random, Three.js, mesh, scene, browser-global, or TestBridge dependency.
- No PR or merge. Completion is one feature-branch commit and non-force push.

## Success Criteria
All required focused tests, full unit tests, build, focused E2E, full E2E, diff hygiene, scope audit, DevToolbox validation, task preflight, review, commit, and push succeed with evidence recorded.