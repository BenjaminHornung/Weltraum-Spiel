# Design: First-Person Surface Expedition UI Prototype

## Context

This is an isolated presentation fixture, not a product-runtime feature. DevToolbox MCP/CLI is unavailable, so direct-file fallback tracking applies and all checkboxes remain open pending fresh evidence and completion preflight.

## Technical decisions

### Isolated prototype source

Place prototype files only under `apps/weltraum-browser/prototypes/first-person-surface-expedition-v1/**` and expose `/prototypes/first-person-surface-expedition-v1/` through the repository's existing setup. Do not place them in Vite's public static directory or edit routes, `src/**`, package/lock files, or Vite/Playwright configuration.

### Deterministic fixture and state reducer

Use immutable local fixture constants and one small reducer for the six primary states, selected tool slot, separate detail-panel toggle, and transient overlays. Q selects Scanner; E starts/shows Interaction/Hold; I selects InventoryDetail; Tab toggles Detail Panels without becoming a primary state; 1–5 select Toolbelt slots; H toggles MinimalHud; R deterministically activates/resets the Hazard Scenario so HazardWarning is directly repeatable; Escape closes overlays. No random values, wall-clock effects, persistence, network input, or TestBridge are allowed.

### HUD composition and visual language

Use edge-anchored, readable dark translucent hard-sci-fi rails and reserve a structural center-clear safe zone. Avoid dashboard, glass-card, and MMO clutter. Keep the restrained crosshair, Context Prompt, Hold Progress, and Scan Reveal compact. Render the decorative world with deterministic CSS/canvas and keep meaningful information in semantic DOM.

### Accessibility and responsive behavior

Use semantic landmarks and controls, explicit names, appropriate ARIA state/live regions, logical focus order, and clearly visible focus. Pair color with text and icon/shape/pattern redundancy. Reduced-motion removes nonessential motion. At 200% zoom and 1280×720, rails reflow and required content remains reachable without horizontal overflow or loss of the center target. `Prototype Fixture` stays visibly persistent, including MinimalHud.

### Focused test and evidence strategy

Use exactly `apps/weltraum-browser/tests/e2e/first-person-surface-expedition-ui-prototype.spec.ts` against port 5202 via existing configuration. Verify route isolation, six states, every key/button pair, ARIA/focus order, 1280×720 no horizontal overflow, deterministic behavior, absent `window.TestBridge`, visible `Prototype Fixture`, and zero console errors, uncaught page errors, failed requests, or HTTP responses >=400.

Capture exactly six required screenshots under `apps/weltraum-browser/evidence/`: four 1920×1080 state images, one 1280×720 responsive image, and one 1920×1080 keyboard-focus image. InventoryDetail, MinimalHud, reduced-motion, and 200% zoom remain behavior tests but require no additional PNG.

## Integration boundaries and finalization

- Final allowed scope is the change folder, prototype folder, focused E2E file, approved evidence prefix, and `docs/design-audits/first-person-surface-expedition-ui-prototype-v1.md`.
- Forbid `src/**`, package/lock/Vite/Playwright config, routes, Hestia/Voxel/Worker code, existing UI/concepts, and all Unity content including `Assets/`, `Packages/`, `ProjectSettings/`, scenes, prefabs, asmdefs, and `.meta`.
- Final review includes focused E2E, `git diff --check`, focused UI review, independent reviewer review, and human visual review.
- The authorized final commit message is `#WELTRAUM-000 Add first-person surface expedition UI prototype`; push normally without force. Do not open a PR, merge, or archive.
