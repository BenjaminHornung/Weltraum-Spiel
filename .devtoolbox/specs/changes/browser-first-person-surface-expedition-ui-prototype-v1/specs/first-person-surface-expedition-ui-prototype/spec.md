# First-Person Surface Expedition UI Prototype

## Capability

A deterministic, accessible browser-only Hestia surface-expedition HUD fixture for evaluating first-person information and interaction presentation without gameplay authority.

## Requirements and scenarios

### Direct route and isolation

- Source MUST live under `apps/weltraum-browser/prototypes/first-person-surface-expedition-v1/**` and MUST NOT use Vite's public static directory.
- The prototype MUST load at `/prototypes/first-person-surface-expedition-v1/` through the existing configuration and MUST NOT alter `/` or another normal route.
- A visible `Prototype Fixture` notice MUST persist in every state and MUST make clear that values are mock data, not live world truth.
- The prototype MUST use no external assets, runtime data, network dependency, or `window.TestBridge`.

**Scenario:** The direct URL returns HTTP 200, remains isolated from normal routes, shows `Prototype Fixture`, makes no unexpected request, and has no `window.TestBridge`.

### Deterministic presentation and visual structure

- Fixture labels, IDs, values, state, selected tool, overlays, and decorative CSS/canvas world MUST be deterministic across reloads.
- Readable dark translucent hard-sci-fi rails MUST frame a structural center-clear safe zone; dashboard, glass-card, and MMO clutter are forbidden.
- Meaningful information MUST remain in semantic DOM; decorative canvas content MUST be hidden from assistive technology.
- Color meanings MUST include explicit text and an icon, shape, or pattern; keyboard focus MUST always be visibly distinct.

### Exact HUD zones and fields

- Top-left MUST show `Health`, `Suit Integrity`, `Oxygen`, `Energy`, and `Hazard Level`.
- Top-center MUST show `Compass`, `Heading`, and `Site/Biome`.
- Right MUST show `Objective`, `Distance`, `Next Action`, `Mission Context`, and `Ownership/Legality`.
- Bottom-left MUST show local map/radar, `Ship Return Marker`, and `Site Marker`.
- Bottom-center MUST show toolbelt 1–5, active tool, and `Cooldown/Energy`.
- Bottom-right MUST show active tool, `Range`, `Condition`, and `Ammo/Charge/Heat`.
- Center MUST show only a restrained crosshair, `Context Prompt`, `Hold Progress`, and `Scan Reveal` as relevant.

**Scenario:** Each state preserves the center-clear composition while mode, risk, objective, next action, essential suit status, and Prototype Fixture honesty remain understandable.

### Primary states and detail toggle

- Exactly six primary states MUST exist: `Exploration`, `Scanner`, `InteractionHold`, `HazardWarning`, `InventoryDetail`, and `MinimalHud`.
- `Exploration` MUST show the baseline HUD; `Scanner` MUST emphasize Scan Reveal; `InteractionHold` MUST expose deterministic Hold Progress; `HazardWarning` MUST show warning text plus non-color redundancy; `InventoryDetail` MUST expose mock detail without authority; `MinimalHud` MUST reduce optional information while retaining fixture honesty and essentials.
- Tab Detail Panels MUST be a separate expanded/collapsed detail toggle, not Scanner and not a seventh primary state.
- State changes MUST be local deterministic projections and MUST NOT mutate or imply gameplay state.

### Exact inputs and visible-button parity

- Q MUST select `Scanner`.
- E MUST activate `InteractionHold` and its deterministic hold presentation.
- I MUST select `InventoryDetail`.
- Tab MUST toggle Detail Panels separately from the six primary states.
- 1–5 MUST select the corresponding Toolbelt slot.
- H MUST toggle `MinimalHud`.
- R MUST deterministically activate/reset the Hazard Scenario so `HazardWarning` is directly repeatable.
- Escape MUST close overlays; it MUST NOT be specified as a state-cycle mechanism.
- Every action MUST have a visible focusable button whose accessible name or description includes its key and action. Keyboard and button activation MUST produce equivalent visible results.
- Inputs MUST be ignored for a text-editable event target if one is introduced.

### Accessibility and responsive behavior

- Controls MUST be semantic, programmatically named, and expose suitable ARIA state/live status. Focus order MUST be logical and visible.
- `prefers-reduced-motion: reduce` MUST remove nonessential motion.
- At 200% browser zoom, content MUST reflow and remain reachable.
- At 1280×720 there MUST be no horizontal page overflow, clipped primary action, or overlap obscuring the center target.

## Focused E2E contract

Exactly `apps/weltraum-browser/tests/e2e/first-person-surface-expedition-ui-prototype.spec.ts` MUST run on port 5202 through existing configuration and verify:

- route isolation, persistent visible `Prototype Fixture`, deterministic fixture behavior, and absent `window.TestBridge`;
- all six primary states, separate Detail Panels toggle, all exact keys, and every visible-button equivalent;
- ARIA state, accessible names, logical focus order, and visible keyboard focus;
- reduced-motion behavior, 200% zoom reflow, and 1280×720 with no horizontal overflow;
- exact required screenshot paths and dimensions;
- zero console errors, uncaught page errors, failed requests, and HTTP responses with status 400 or greater.

## Required screenshot evidence

Exactly these six PNGs MUST be written under `apps/weltraum-browser/evidence/`:

1. `first-person-surface-expedition-ui-prototype-v1-exploration-1920x1080.png` — 1920×1080.
2. `first-person-surface-expedition-ui-prototype-v1-scanner-1920x1080.png` — 1920×1080.
3. `first-person-surface-expedition-ui-prototype-v1-interaction-hold-1920x1080.png` — 1920×1080.
4. `first-person-surface-expedition-ui-prototype-v1-hazard-warning-1920x1080.png` — 1920×1080.
5. `first-person-surface-expedition-ui-prototype-v1-responsive-1280x720.png` — 1280×720.
6. `first-person-surface-expedition-ui-prototype-v1-keyboard-focus-1920x1080.png` — 1920×1080.

InventoryDetail, MinimalHud, reduced-motion, and 200% zoom MUST remain behavior tests but require no additional PNG evidence.
