# Outpost Operations Console UI Prototype

## Capability

A standalone, accessible, responsive prototype for operating Aurelia Frontier Service Post 07 using mock service data and local-only command simulation.

## Global requirements

1. Every viewport shows the exact authority banner: `OUTPOST OPERATIONS PROTOTYPE · MOCK SERVICE DATA · NO GAMEPLAY AUTHORITY`.
2. The prototype is served at `/prototypes/outpost-operations-console-v1/`.
3. Every operational status, estimate, warning, and command is labeled or contextually presented as mock/prototype data.
4. Commands mutate only in-memory local prototype state and never import or claim product domain authority.
5. Desktop uses a left navigation rail, central operations workspace, right context/status column, and narrow top status bar.
6. At 1280x720, explicit section tabs keep the primary action visible while status and warnings remain reachable; the layout must not degrade into an unstructured long page.
7. Visual direction is restrained graphite/metal utility infrastructure with hard lines and technical separation. No glass, gradients, rarity palette, excessive neon/glow, fighter-cockpit styling, or generic KPI-card grid.

## Operational views

### Approach and Pad Control

Show Pad A occupied by the player's ship, Pad B reserved, Pad C under maintenance, approach clearance, service connection, cargo-port alignment, landing restrictions, impound/legal warning, and a local Release Pad command.

### Cargo and Storage

Show Outpost Storage, Ship Cargo, and Suit Cargo with mass, volume, ownership, hazard, direction, and blocked reasons. Dangerous or foreign goods require hold-to-confirm. Illegal cargo must block transfer. No real resource/cargo authority is permitted.

### Refuel and Consumables

Show main propellant, RCS propellant, suit oxygen, suit power cell, and coolant with available/requested/capacity values, mock estimate, restricted/unavailable state, and start/cancel/complete local simulation.

### Repair Bay

Show hull inspection, external sensor, landing gear, thermal system, and drone repair with mock materials, duration, blockers, and queue.

### Market Exchange

Provide readable buy/sell controls, available quantity, outpost demand, legality, and storage destination. Never claim a global dynamic economy.

### Mission Board

Provide Geological Survey, Relay Repair, Cargo Courier, Hazard Sample, and Salvage Recovery mock offers with issuer, objective, destination/site, risk, duration, reward descriptors, legality, and local accept/decline state.

### Drone Control

Provide Scout, Mining, and Cargo Drone fixtures and the states Docked, Assigned, Active, Returning, Link Lost, and Needs Attention. Provide assign, launch, recall, pause, telemetry, and acknowledge-warning commands. No scheduler or drone authority is permitted.

### Legal and Access

Show mock docking permit, cargo inspection, restricted goods, outstanding fee, impound risk, faction access, and service-availability effects. Every legality claim remains explicitly mock.

## Required scenarios

The scenario selector must deterministically present: nominal service overview, pad conflict, refuel unavailable, illegal cargo blocks transfer, repair queue, mission accepted, drone link lost, outpost lockdown, and responsive layout.

## Accessibility

- Use native buttons, inputs, selects, and semantic landmarks.
- All interactive controls are keyboard-operable and have visible focus.
- Status changes are announced through live regions.
- Warnings communicate text/icons in addition to color.
- Escape closes modal/transient UI and returns focus to its invoker.
- Typing in editable controls must not trigger prototype shortcuts.

## Playwright and evidence

- Prototype-local config uses port 5234, one worker, zero retries, only `outpost-operations-console-ui.spec.ts`, its own output/report paths, and its own Vite process.
- Cleanup is limited to that process.
- Required screenshots: overview, pad conflict, cargo blocked, mission board, drone link lost, responsive 1280x720, and keyboard focus.
- Browser health is unfiltered: zero console errors, page errors, failed requests, HTTP errors, and missing assets.
- Verification includes JS syntax, DOM/ID audit, CSS overflow audit, `npm ci` without manifest changes, `npm run build`, focused Playwright twice, screenshot review, accessibility review, scope audit, reviews, and completion preflight.
