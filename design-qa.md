# Design QA - Browser UI Concept Parity V3

> Authoritative acceptance is the live normal product URL `/`. The historical
> `/?uiScenario=flight-cruise-concept` review path is not used as flight
> acceptance evidence.

**Findings**

- No actionable P0/P1/P2 findings remain after the FHD/QHD responsive pass.
- [P3] `/favicon.ico` still returns 404. This is minor polish and does not
  affect player HUD, planner, combat, runtime ownership, or accessibility.

## Comparison Target

- Source visual truth:
  - `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png`
  - `docs/UI-Screenshots/03-navigationsplaner-sternenkarte-route.png`
  - `docs/UI-Screenshots/07-kampf-hud-asteroidenfeld-feindkontakt.png`
- Browser implementation:
  - `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-normal-1920x1080.png`
  - `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-normal-2560x1440.png`
  - `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-planner-1920x1080.png`
  - `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-planner-2560x1440.png`
  - `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-combat-1920x1080.png`
- Viewports: 1920x1080 primary, 2560x1440 large-desktop check.
- States:
  - normal bare `/`, live WebGL, `data-ui-surface="flight"`, no TestBridge or debug HUD;
  - normal `/`, `range-2500m`, Balanced preview, planner open before Engage;
  - `/?uiScenario=combat-contact`, runtime-owned combat/contact HUD.

## Full-View Comparison Evidence

- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-comparison-flight-1920x1080.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-comparison-planner-1920x1080.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-comparison-combat-1920x1080.png`

Focused region comparison was not repeated as a separate crop because the final
FHD full-view comparison is readable for the previously blocked surfaces: right
flight cards, planner route details, planner map/actions, and combat right
panel. Earlier focused evidence remains historical only.

## Fidelity Surfaces

- Fonts and typography: Rajdhani hierarchy is preserved. FHD/QHD desktop
  strings now fit without clipping or one-character wrapping in the visible
  flight and planner panels.
- Spacing and layout rhythm: normal `/` uses larger desktop proportions at
  1920x1080 and 2560x1440. The right rail wrapper is transparent; compact
  target/autopilot cards and the wider navigation action card now match the
  concept structure more closely.
- Colors and visual tokens: thin cyan frame language, dark translucent cards,
  green ready/Engage state, and orange combat/warning tokens remain aligned.
- Image quality and asset fidelity: live Three.js/WebGL remains visible and
  nonblank. The live 3D player ship is the only intentional major visual
  exception from the supplied images.
- Copy and content: visible target, route, fuel, speed, ETA, objective,
  autopilot, radar, warnings, and planner values are runtime-owned. Credits and
  reputation remain hidden.
- Icons and controls: Safe/Balanced/Fast, Preview, Replan, Focus, Orbit, Zoom,
  Engage, Close, and Escape are semantic controls. Planner map route, target,
  ship, and obstacles come from runtime geometry.
- Accessibility and interaction: modal focus trap/restoration, inert
  background, Escape/Close preservation, typed Engage errors, keyboard map
  controls, and focus return are covered by E2E.

## Comparison History

| Iteration | Blocking findings | Fixes | Post-fix evidence |
| --- | --- | --- | --- |
| V2 correction | The previous pass judged a static review pipeline, not normal `/`. | Moved acceptance to live `data-ui-surface="flight"` on `/`; kept the old query as compatibility only. | V3 normal-flight captures and live-canvas E2E. |
| Functional planner pass | Planner chrome was partly inert; Engage could diverge from the visible preview. | Added typed route commands, preview hash locking, visible errors, modal semantics, real profile/map/action buttons, and runtime map geometry. | `normal-runtime-functional-planner.spec.ts` and requested regressions. |
| Visual pass 1 | Target/route text collisions, stale/fake values, planner route-detail collapse, combat density gaps. | Reworked live HUD cards, truthful runtime values, route detail layout, combat runtime sections, and compact fallbacks. | V3 1640/1280 evidence and parity/foundation specs. |
| FHD/QHD pass | At 1920+ the UI still felt too small/tight; QHD planner did not use available width; the transparent right rail fix had to be preserved. | Added desktop-only FHD/QHD sizing, widened planner/details, restored broad navigation card, and fixed planner metric grid wrapping. | Final FHD/QHD captures and comparison boards listed above. |

## Browser Checks

- Normal `/` has no TestBridge and keeps a visible, opaque, nonblank live
  Three.js canvas.
- FHD/QHD measurements: no document overflow; right rail wrapper background is
  transparent; planner details and route metrics have no visible overflow.
- Primary interactions tested: target -> profile -> Preview -> Replan -> exact
  hash Engage; locked reopen; Cancel; Escape/Close; focus trap/inert; map
  Focus/Orbit/Zoom; stale/hash-mismatch error focus.
- `npm run test`: 15 files, 169 tests passed.
- `npm run build`: passed; known Vite chunk-size warning only.
- Requested Playwright regression run: 22/22 passed with one worker.

**Follow-up Polish**

- Add a favicon when convenient.

final result: passed
