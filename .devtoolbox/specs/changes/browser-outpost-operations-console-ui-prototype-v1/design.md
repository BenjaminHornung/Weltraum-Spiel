# Design

## Architecture decision

Implement a standalone static Vite entry under the owned prototype directory. Keep three explicit layers inside prototype-local JavaScript:

1. immutable fixture/scenario definitions;
2. a local mutable view-model for the selected section and transient command state;
3. render/event adapters that project state into semantic DOM and dispatch local command intents.

No product `src/**` imports and no domain-core APIs are used. The authority banner and mock qualifiers are part of the persistent application shell.

## Information architecture

Desktop uses a fixed application grid: narrow status bar, 232px section navigation, flexible operations workspace, and 296px context column. The central workspace changes by selected section rather than rendering all sections in one scroll.

At 1280x720 the left navigation becomes a horizontally scrollable tab row and the context column becomes an on-demand status drawer. The primary action area remains in the central viewport.

## Interaction model

- Section navigation and scenario selection are direct local view-state changes.
- Service commands update deterministic mock command records and live-region messages.
- Hold-to-confirm uses pointer/keyboard press duration with explicit progress text and cancellation.
- Telemetry/details use one accessible dialog. Escape closes it and restores focus.
- Optional section shortcuts are ignored while focus is in an input, select, textarea, or contenteditable element.

## Visual system

Use square/low-radius utility surfaces, one-pixel metal separators, graphite backgrounds, warm off-white text, amber for caution, red for blocks, and desaturated green for available/complete states. Color never carries status alone. Typography uses a compact technical sans/monospace pairing from local/system availability without remote assets.

## Test strategy

Playwright drives the standalone route through visible controls and scenario selection. The spec captures the seven required screenshots, validates deterministic scenario states, keyboard focus/dialog return, authority text, responsive structure, browser health, unique IDs, and viewport overflow. Evidence markdown/JSON records commands, counts, health totals, and screenshot paths.

## Scope and rollback

All writes stay inside the explicit allowlist. If the implementation requires a package/root-config/product-core edit or finds unexpected dirty files outside the allowlist, stop. Rollback is a single branch commit because no product runtime contracts are changed.
