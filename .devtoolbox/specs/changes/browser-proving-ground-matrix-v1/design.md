# Design: Browser Proving Ground Matrix v1


## Scenario matrix

Required scenarios:

```text
direct-local-arrival
obstacle-avoidance-route
insufficient-fuel
no-authority
off-route-divergence
locked-plan-hash-preservation
explicit-replan-required-signal
```

Each scenario should produce JSON evidence and, where meaningful, a screenshot.


## Cross-cutting rules

- Browser code must be runnable with Node/Vitest/Playwright gates.
- Gameplay truth must not live in Three.js scene objects.
- Core logic must be deterministic where tests depend on it.
- Legacy Unity behavior must be converted into feature intent before implementation.
- Known Unity bugs and documentation drift must be captured as bug traps.
