# Browser UI Concept Parity V2 Visual Audit

## V3 Correction

This audit remains a visual-reference record, but its flight verdict is not a
valid normal-`/` product acceptance. The captured flight state came from
`/?uiScenario=flight-cruise-concept`, whose presentation pipeline hides live
scene layers and substitutes fixed content. The V3 result is blocked until
normal `/` passes equivalent live-runtime and functional-planner evidence.

Generated from branch `feature/browser-ui-concept-parity-v2-visual-rework`.

## Scope

- V1 is the rejected first attempt; V2 uses the supplied concept images as visual truth with no intentional reinterpretation.
- The only authorized major visual exception is the 3D player ship model.
- Correction: the V2 flight screenshot was not captured from the authoritative
  normal `/` product surface. It came from the flight concept query pipeline and
  is therefore invalid for live-runtime acceptance.
- The V2 planner and combat captures remain useful visual references, but this
  file must not be cited as a product pass.

## Visual Verdicts

| Screen | Concept | Rejected V1 | Final V2 | Full comparison | Similarity | Verdict |
| --- | --- | --- | --- | --- | ---: | --- |
| Flight HUD | `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-flight-hud.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v2-flight-hud.png` | `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-flight.png` | historical only | Invalid for acceptance: captured through the static flight concept query, not live normal `/`. |
| Navigation planner | `docs/UI-Screenshots/03-navigationsplaner-sternenkarte-route.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-navigation-planner.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v2-navigation-planner.png` | `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-planner.png` | historical only | Invalid for final workflow acceptance: visual chrome did not prove all controls were functional. |
| Combat contact | `docs/UI-Screenshots/07-kampf-hud-asteroidenfeld-feindkontakt.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-combat-contact.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v2-combat-contact.png` | `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-combat.png` | historical only | Useful combat visual baseline only; superseded by V3 live-runtime evidence. |

## Remaining Differences

### Flight HUD

1. The 3D player ship model differs, as explicitly allowed.
2. Several radar contacts are offset by a few pixels.
3. Gauge fill endpoints vary slightly from the concept.
4. The right navigation panel is marginally wider at 1640x900.
5. Browser font rasterization differs subtly from the concept export.

### Navigation Planner

1. The destination label at the right map edge is slightly clipped.
2. Map route and asteroid positions differ by several pixels after responsive scaling.
3. Header metric column widths are not pixel-identical to the concept export.
4. Legend item spacing is slightly tighter.
5. Detail-panel line heights remain marginally denser.

### Combat Contact

1. Enemy wireframe scale and line weight differ slightly despite using the source silhouette.
2. Radar metadata and several contacts are offset by a few pixels.
3. Weapon subsection heights are marginally different.
4. Hostile contact marker details are slightly simplified.
5. Several gauge fills and compass labels differ by a few pixels.

The previous statement that all listed differences were only P3 is superseded.
The V2 QA pass is invalid for product acceptance because it did not judge the
live normal `/` flight surface and did not prove the planner as a fully
functional runtime workflow.

## Layout Evidence

Source: `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-layout-report.json`

| Entry | Viewport | Center overlap | Pixel delta from rejected V1 |
| --- | ---: | ---: | ---: |
| `flight-hud-v2-1640x900` | 1640x900 | 0% for left/radar/right panels | 0.1776 |
| `flight-hud-v2-1280x720` | 1280x720 | 0% for left/radar/right panels | 0.1977 |
| `navigation-planner-v2` | 1640x900 | full-screen planner intentionally owns center | 0.1751 |
| `combat-contact-v2` | 1640x900 | 0% for panels; reticle/marker intentionally use targeting area | 0.1932 |

## Intentional Constraints

- The combat view remains a presentation shell; it does not claim combat gameplay, weapon simulation, or hit resolution.
- The planner map presents runtime-owned route data; it does not replace planner/executor truth.
- No position snapping, fake distance reduction, velocity zeroing, silent replan, or TestBridge progression was introduced.

## Verdict

**Historical visual baseline only, not a pass.** The authoritative result is the
V3 live-runtime QA and regression evidence.
