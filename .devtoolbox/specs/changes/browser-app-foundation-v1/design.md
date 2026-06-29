# Design: Browser App Foundation v1


## Target layout

```text
apps/weltraum-browser/
  package.json
  src/core
  src/math
  src/sim
  src/flight
  src/navigation
  src/world
  src/render/three
  src/ui
  src/test-harness
  tests/unit
  tests/e2e
  evidence
```

The first pass may preserve existing spike files and incrementally refactor them into the target layout.


## Cross-cutting rules

- Browser code must be runnable with Node/Vitest/Playwright gates.
- Gameplay truth must not live in Three.js scene objects.
- Core logic must be deterministic where tests depend on it.
- Legacy Unity behavior must be converted into feature intent before implementation.
- Known Unity bugs and documentation drift must be captured as bug traps.
