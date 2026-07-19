# Outpost Operations Console UI V1 Design Audit

## Scope and authority

The prototype is isolated at `/prototypes/outpost-operations-console-v1/` and uses only mock service fixtures plus in-memory command intents. It does not import product `src/**` modules and does not claim gameplay, economy, mission, cargo, drone, legal, or outpost authority.

The persistent authority banner is:

`OUTPOST OPERATIONS PROTOTYPE · MOCK SERVICE DATA · NO GAMEPLAY AUTHORITY`

## Information architecture

- Desktop: narrow top status strip, fixed left section navigation, central operations workspace, and right context/status column.
- 1280×720: explicit horizontal section tabs replace the left rail; the central action and right status column remain visible.
- Narrow mobile: the context column becomes an explicit status/warnings drawer instead of forcing every section into one unstructured page.
- Only the selected operations section is rendered in the main workspace.

## Art direction

- Restrained graphite and metal surfaces.
- Hard one-pixel separators and low-radius controls.
- Amber is reserved for caution/attention, red for blocked states, and desaturated green for available/complete states.
- Status always includes text and shape, not color alone.
- No gradients, glass, large glow fields, fantasy rarity colors, fighter-cockpit framing, decorative charts, or generic KPI-card grids.

## Interaction and accessibility

- Semantic `header`, `nav`, `main`, `aside`, `footer`, tables, definition lists, and native controls.
- Visible `:focus-visible` outline and skip link.
- Section shortcuts `1–8` do not fire while focus is inside editable controls.
- Live regions announce local command results and assert blocked scenario changes.
- Dialogs use native `dialog`, close with Escape, and return focus to the invoking button.
- Hazardous or foreign-custody cargo requires hold-to-confirm; illegal cargo displays an explicit blocked reason and disables transfer.
- Warnings use text plus a visible exclamation marker.

## Required scenario matrix

| Scenario | Primary proof |
| --- | --- |
| Nominal service overview | Three pads, connection checklist, visible authority boundary |
| Pad conflict | Reservation conflict warning and blocked approach confirmation |
| Refuel unavailable | Restricted manifold and disabled start command |
| Illegal cargo blocks transfer | Mock permit reason and disabled transfer |
| Repair queue | Queue position, materials, duration, blockers |
| Mission accepted | Five cards and local Accepted state |
| Drone link lost | Link Lost / Needs Attention and warning acknowledgement |
| Outpost lockdown | Impound/access effects across services |
| Responsive layout | Section tabs, primary action, context status, and authority banner at 1280×720 |

## Evidence contract

The prototype-local Playwright config uses port 5234, one worker, zero retries, an exact single-spec match, isolated output/report paths, and a dedicated Vite process. The focused spec captures the seven required screenshots and writes browser-health JSON plus Markdown under the allowed `outpost-operations-console-ui-v1-*` evidence prefix.

Browser Health is unfiltered and must remain:

- console errors: 0;
- page errors: 0;
- failed requests: 0;
- HTTP errors: 0;
- missing assets: 0.

## Known mock limits

- Estimates, prices, stock, demand, rewards, fees, legality, faction access, and permits are static UX fixtures.
- Cargo containers, ownership, hazards, mass, and volume do not read or update the Resource/Cargo core.
- Missions do not create product mission state.
- Drone actions do not use a scheduler, navigation, simulation, or persistence owner.
- Refuel and repair simulations do not modify ship resources, damage, materials, or service queues.
- No state survives a page reload.
