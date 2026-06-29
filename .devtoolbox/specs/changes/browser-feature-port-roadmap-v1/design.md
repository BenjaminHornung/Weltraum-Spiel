# Design: Browser Feature Port Roadmap v1


## Roadmap inputs

- Feature Intent Cards.
- Known Unity Bug Traps.
- Existing browser spike evidence.
- Old/open/archived specs.
- Browser test matrix.

## Required output

```text
docs/browser-mainline/port-roadmap.md
analysis/threejs-mainline/next-specs.md
```


## Cross-cutting rules

- Browser code must be runnable with Node/Vitest/Playwright gates.
- Gameplay truth must not live in Three.js scene objects.
- Core logic must be deterministic where tests depend on it.
- Legacy Unity behavior must be converted into feature intent before implementation.
- Known Unity bugs and documentation drift must be captured as bug traps.
