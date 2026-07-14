# Proposal: Browser Worker Streaming Telemetry Spine V1

## Motivation

The browser runtime needs a deterministic, planet-neutral infrastructure core for asynchronous CPU work, reconstructable content residency, and machine-readable performance evidence before any planet tile scheduler, voxel mesher, terrain system, or GPU integration is introduced.

## Scope

- Define a versioned worker job protocol with separate control and transferable data planes.
- Add a deterministic three-class queue, cooperative cancellation, worker lifecycle/replacement, epochs, and stale-result rejection.
- Add a generic asynchronous content loader, reconstructable byte-budgeted memory cache, pinning, leases, eviction, and residency validation.
- Add versioned runtime telemetry whose diagnostic timing fields cannot affect domain decisions or canonical signatures.
- Prove the protocol with Vitest and a real browser module Worker on the normal `/` route.

## Outcomes

Large buffers cross worker boundaries only through explicit transfer lists and named ownership. Every accepted request reaches exactly one terminal outcome. Worker failure cannot leave promises pending, replacement always advances the worker epoch, and stale results never integrate. Cache state remains disposable and never becomes world truth.

## Compatibility and rollout

This change is additive under new worker, streaming, and diagnostics paths. It changes no package or lockfile, main bootstrap, rendering, gameplay, world, or persistence behavior. The focused E2E remains intentionally unassigned to an npm E2E group until the integration branch adds it exactly once.

## Risks

- Browser task scheduling can make cooperative cancellation timing variable; semantic outcomes therefore use explicit worker yield points and safety timeouts, not millisecond performance gates.
- Transfer detachment makes caller ownership mistakes irreversible; the API validates descriptors before transfer and documents the ownership transition.
- Cache leases expose buffers without copying; consumers receive a contractually readonly view and release handles idempotently.

## Non-goals

No planet tile scheduler, voxel mesher, terrain, GPU integration, gameplay authority, Three.js worker dependency, Comlink, SharedArrayBuffer, WASM, IndexedDB, Service Worker, network download, persistent cache, savegame, UI, or package change is part of V1.
