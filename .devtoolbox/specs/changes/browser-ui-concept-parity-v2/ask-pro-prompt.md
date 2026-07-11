Return final markdown only. Do not answer with a preamble. Treat attached files and screenshots as authoritative. Call out uncertainty.

You are advising on a browser-based space game UI rework in the repository `BenjaminHornung/Weltraum-Spiel`.

Task: `browser-ui-concept-parity-v2-visual-rework`.

Context:
- `browser-ui-concept-parity-v1` was merged, but the result is considered insufficient.
- The current screenshots still look like web/debug panels over a debug-grid scene.
- The user explicitly wants a visible rework, not another tiny CSS iteration.
- The implementation must remain a real browser runtime verified with Playwright screenshots. It must not use TestBridge for normal screenshots.
- It must not edit Unity `Assets/**`, start Unity, change packages/lockfiles, alter planner/executor/FlightController truth, fake flight progression, snap position, zero velocity, weaken planHash/no-silent-replan/objective behavior, or claim real combat when only a UI shell exists.

Visual targets:
- Flight HUD concept: `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png`
- Navigation planner concept: `docs/UI-Screenshots/03-navigationsplaner-sternenkarte-route.png`
- Combat/contact concept: `docs/UI-Screenshots/07-kampf-hud-asteroidenfeld-feindkontakt.png`

Current v1 actuals:
- `apps/weltraum-browser/evidence/ui-concept-parity-flight-hud.png`
- `apps/weltraum-browser/evidence/ui-concept-parity-navigation-planner.png`
- `apps/weltraum-browser/evidence/ui-concept-parity-combat-contact.png`

Files attached include the current evidence docs, HTML/CSS/HUD binding, runtime entry point, render/world code, and Playwright specs.

Please return:
1. The five biggest visual mismatches to fix first, ranked by impact.
2. A concrete implementation strategy that moves the flight HUD toward the concept at first glance without breaking runtime truth.
3. Specific safe edit points in the Browser code if inferable from the attached files.
4. A Playwright screenshot-comparison loop and acceptance bar that prevents shipping another web-debug-panel result.
5. Risks or traps that would accidentally weaken gameplay/test truth.

Be direct and practical. Prefer changes that can be implemented in one branch without touching Unity assets or package files.
