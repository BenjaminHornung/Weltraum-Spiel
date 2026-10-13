# Factory ceramic / petrol design QA — 2026-10-13

final result: blocked

This is a current implementation review, not full prototype acceptance. The remaining important differences depend on actual World/asset/map integration; they must not be filled with a generated background or fabricated state.

**Comparison inputs**

- Source visual truth: `art/factory/visual-reference/2026-10-13/01-fracht-transport.png`; approved HUD baseline in the same directory. Source: 1672 × 941 pixels, normalized in the browser to width 1280 (height 720.4, no warp).
- Implementation: `apps/weltraum-browser/evidence/factory/ui-ceramic-2026-10-13/cargo-post-qa-1280.png`, actual built `/factory.html`, 1280 × 720 CSS/pixels, deviceScaleFactor 1. Source and implementation cargo inspectors share selected Former and published 341 kg / 2984.4 kg values. The reference depicts a first-person heavy-transport stage in an imagined scene; runtime is a fresh, confirmed paused source state with its actual world camera. Copy intentionally changes German to English. Camera, terrain and gameplay-stage differences prevent a pixel-fidelity score.
- Full side-by-side: `apps/weltraum-browser/evidence/factory/ui-ceramic-2026-10-13/qa-full-cargo.png` (2600 × 800).
- Focused inspector comparison: `apps/weltraum-browser/evidence/factory/ui-ceramic-2026-10-13/qa-focused-cargo.png` (900 × 570), source and actual right-side crops at the same normalized width. Both combined inputs were opened and visually inspected after the final density correction.
- Other actual production states: `production-complete/` (1280, 1920, 375); final narrow cargo `cargo-post-qa-375.png`; keyboard `focus-objective-final.png`; original `before/` preserved. No TestBridge, pose injection or invented material was used.

**Findings**

- [P1] The reference's spatial minimap is still a confirmed start-site/path diagram. Actual screen has native pad footprints and a location dot, not a coastline or heading triangle. The producer publishes `heading: null`. Impact: significantly weaker orientation than the selected design. Fix: add a separately bounded read-only canonical terrain/map projection and confirmed heading in the actual producer; keep known/unknown bounds and budgets honest. Do not paint fake coast geometry in CSS.
- [P1] Actual in-game wreck remains the technical cargo-access segment. The new 14.75 m Blender hull has no native admission. The full-view scene consequently lacks the design's readable crashsite. Fix: concrete native hull pose/support/collision/LOS/route/depot/exit proof before integrating its mesh. The approved native candidate and three real renders are supplied for human visual review; they are cleaner/coarser than the reference and not automatically accepted art.
- [P2] Cargo transfer imagery is simplified: native machine/kit images and confirmed mass replace the source's crate-to-carrier illustration. Current finite intent and actual handling/deposit controls work through published facts, but this still gives less pictorial transport guidance. Fix: a further display-only composition using actual admitted package/carrier views, reviewed in the carrying/deposited states. No new World state or static claim of a safe starting area.

**Fidelity surfaces**

- Fonts/typography: system Segoe UI with system-ui fallback; measured 16 px base, 13 px secondary, 15 px cargo rows, 21 px inspector heading. Real labels wrap at 375 rather than clip; no unverified display font installed. The concept's larger illustrated transfer detail is intentionally not claimed to match.
- Spacing/layout: 20 px outer desktop inset, 420 px inspector (460 on large desktop), 224 × 160 minimap upper right; 8 px cut corners, restrained shadows. The original pane grid is replaced by one inspector. Narrow viewport moves map below objective and keeps explicit pause/resume reachable. Actual package targets measure 45 px or more; header utility controls remain smaller secondary targets.
- Colors/tokens: cream `#f6f0e3`, ink `#182b38`, muted `#55636a`, petrol `#216780`, selection `#e0edf0`. Selection also has an inset edge and aria-pressed; blocked/disabled states use text and native reasons. Visible keyboard focus uses a 3 px inset petrol ring where clip-path would hide an outside outline.
- Images: fourteen actual 192 × 192 transparent Blender PNGs are loaded in the real panels; hashes match source/output manifest. New wreck previews are Blender renders, not runtime evidence. Existing minimal line symbols remain for secondary controls and fallbacks; native map SVG is a data visualization, not a replacement for the reference terrain imagery.
- Copy/content: English player surfaces and legacy-source display translations; 212 technology mappings checked independently. Immutable IDs/recipes and user labels are preserved. Requested/nominal/allocated power and retained job work are distinct; missing/suspended source is visible. Theme customizers and actual turret defense are not exposed as available features.

**Comparison history / fixes**

1. Original source: generic dense pane navigation and debug-like overlays. Implemented cream/petrol single context inspector, upper-right minimap, quiet key strip; post-fix production screen matrix supplied.
2. Review/test failures: choose-another-build cache, power consumer ID, nominal versus allocated projection and German composed strings. Corrected against source facts; red/green logs and final 110-test green run preserved. These are functional fixes, not a claimed screenshot-fidelity pass.
3. Visual review: package silhouettes too small and cut corners absent. Added actual native Blender thumbnails, 34 px cargo silhouettes and 8 px clipped corners; new production screenshots captured.
4. Accessibility review: clipped outside objective outline. Added inset focus ring; actual Tab-focused screenshot and computed style prove it is visible.
5. Side-by-side review: selected package mass could be covered by the sticky pickup action. Reduced cargo-row vertical padding while retaining at least 44 px targets. Recaptured 1280/375; actual 341 kg text is above the button, measured minimum target height 45 px. Latest full/focused comparison shows this fix.

**Interactions and console**

Normal production input exercised start/cargo/build rejection/views/Tab/Escape/pause and explicit Play/recovery. Normal `/` Graphics dialog open/Escape also checked. Page and HTTP error lists are empty in the final capture runs. The final session is captured in SimulationHold at tick 27 on this software-GPU cloud; recovery returns confirmed Paused. Its harness start enum overstates the recorded evidence, as documented in HARNESS_LABEL_AUDIT.json. Full 16 kg playthrough, save after browser restart, installed machine visuals and enjoyment judgement remain unaccepted.

**Implementation checklist**

- Preserve passing English/projection/input/focus checks.
- Supply a canonical map and native wreck admission diff, then recapture actual carrying/installed states against the selected references.
- Complete W09/W10 source gates and a stable ordinary-input run before visual/gameplay/performance acceptance.
- Human judgement: OWNER_REVIEW_PENDING. No fidelity score or fun claim is inferred from build/tests/images.

**Follow-up polish**

Native wear/damage and contextual feedback can be refined after the remaining source gates. Shared tokens are the starting point for later UI and whole-facility themes, not a shipped customizer.
