# Design: Three.js Mainline Transition v1


## Architecture decision

Create an ADR declaring the browser/Three.js mainline. The previous spike recommendation was conservative, but the owner decision for this package is to continue with Three.js as the primary path, while avoiding a reckless full-feature rewrite.

## Required documents

```text
docs/browser-mainline/adr-0001-threejs-mainline.md
docs/browser-mainline/browser-architecture.md
docs/browser-mainline/feature-intent-policy.md
docs/browser-mainline/port-roadmap.md
```

## Legacy stance

Unity remains in-repo for reference and comparison. No Unity source deletion is part of this change.


## Cross-cutting rules

- Browser code must be runnable with Node/Vitest/Playwright gates.
- Gameplay truth must not live in Three.js scene objects.
- Core logic must be deterministic where tests depend on it.
- Legacy Unity behavior must be converted into feature intent before implementation.
- Known Unity bugs and documentation drift must be captured as bug traps.
