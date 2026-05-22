# Proposal: Runtime ShipKit Hardpoint Binding v1

## Problem

The functional ShipKit socket layer already binds imported engines, RCS nozzles, weapon muzzles, and turret pivots, but builder-facing hardpoints are only implicit socket metadata. Runtime systems and tests need a stable way to see which imported or generated connector/hardpoint sockets exist, which were bound, and which were skipped or duplicated.

## Goal

Add a small idempotent runtime hardpoint binding layer that turns imported ShipKit hardpoint sockets and generated fallback connector sockets into explicit `PrototypeShipHardpoint` records with diagnostics. The layer must reuse `PrototypeShipSocket` metadata, avoid hardcoded demo hierarchy paths, preserve generated fallback ships, and produce deterministic test and Unity evidence.

## Non-Goals

- No modular ship editor UI.
- No attachment solver or part snapping behavior.
- No changes to combat, flight physics allocation, or generated fallback availability.
