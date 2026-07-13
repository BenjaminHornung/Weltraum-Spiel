# Proposal: Browser Ship Builder Full Stats and Flight Readiness V1

## Change

`browser-ship-builder-full-stats-flight-readiness-v1`

## Problem

The browser Ship Builder already has immutable catalog, blueprint, compatibility,
structure, and dry-mass foundations, but no single metadata-backed contract for
loaded mass, propulsion, RCS authority, cargo, weapons, handling, or flight
readiness. Consumers would otherwise need to duplicate formulas or infer gameplay
truth from renderer assets.

## Goal

Add a deterministic, deeply immutable, canonically signed TypeScript core that:

- aggregates the complete requested stat surface with explicit availability and units;
- evaluates stable handling diagnostics and machine-readable suggested fixes;
- returns `DraftValid`, `TestFlightReady`, and statically defined `ActiveShipReady` results;
- preserves caller input and existing dry-mass/catalog contracts;
- proves behavior in Vitest and through the real Vite browser module graph.

## Scope

- Optional typed propulsion-supply metadata for Main Thruster and RCS components.
- Fuel/cargo preview, loaded COM, thrust, acceleration, RCS force/torque,
  delta-v, burn time, cargo, weapon, power/heat placeholder, and braking stats.
- Gameplay-AABB hard-overlap evaluation using a signed policy threshold.
- Stable availability, diagnostic, error/warning, suggested-fix, and signature contracts.
- Unit, browser, deterministic JSON/Markdown evidence, and browser-mainline documentation.
- One normal-route infrastructure fix in `apps/weltraum-browser/index.html`: declare an
  empty data-URL favicon so Chrome does not generate an unrelated `/favicon.ico` 404.

## Non-Goals

No Builder UI, placement workflow, test-flight runtime, Active-Ship handoff,
runtime assembly, real cargo contents, economy, Combat Core, FlightController,
renderer/Three.js derivation, or final balancing. Unity and `Assets/**` are untouched.

## Compatibility

`STARTER_CATALOG` remains byte/signature stable at `5aaa27fd`. The new propulsion
metadata is optional; legacy components remain valid and their fuel-dependent
results become explicitly unavailable. Complete and fuel-free behavior is proven
with synthetic test catalogs rather than changing starter data or existing E2E pins.

## Success

All 30 required scenarios, focused browser evidence, full unit/build/E2E regression,
DevToolbox verification, and the strict path allowlist pass from base
`7e1d0237cdf272bfb759f26e2be8cdb3a760e15c`.
