# Final Verification - 2026-07-11

## Result

passed

## Scope

- Authoritative flight URL: normal `/`
- Flight surface: live `data-ui-surface="flight"` with real WebGL canvas
- Combat surface: `/?uiScenario=combat-contact`
- Planner state: normal `/`, `range-2500m`, Balanced preview, visible preview hash before Engage
- Desktop visual target: 1920x1080 primary, 2560x1440 large desktop

## Final visual evidence

- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-normal-1920x1080.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-normal-2560x1440.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-planner-1920x1080.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-planner-2560x1440.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-combat-1920x1080.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-comparison-flight-1920x1080.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-comparison-planner-1920x1080.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v3-fhd-final-comparison-combat-1920x1080.png`

## Browser QA facts

- Normal `/` exposes no `window.TestBridge`.
- Normal `/` keeps the live Three.js/WebGL canvas visible and full viewport.
- The right flight rail wrapper is transparent; the visible cards retain their translucent surfaces.
- FHD/QHD flight and planner captures have no document overflow.
- Planner route metrics and details have no visible overflow after the final FHD/QHD pass.
- Planner map route, target, ship, and obstacle marks are runtime-derived.
- Escape/Close, focus trap/restoration, map controls, profile buttons, Preview, Replan, Engage, and visible lock errors are covered by E2E.

## FHD/QHD layout measurement

Measured with Chromium against `http://127.0.0.1:4173/` after the final CSS pass.

```json
[
  {
    "case": "normal-1920",
    "viewport": "1920x1080",
    "documentOverflowX": 0,
    "documentOverflowY": 0,
    "rightPanel": { "width": 500, "height": 1032, "backgroundColor": "rgba(0, 0, 0, 0)", "overflowX": 0, "overflowY": 0 },
    "testBridge": false
  },
  {
    "case": "normal-2560",
    "viewport": "2560x1440",
    "documentOverflowX": 0,
    "documentOverflowY": 0,
    "rightPanel": { "width": 580, "height": 1384, "backgroundColor": "rgba(0, 0, 0, 0)", "overflowX": 0, "overflowY": 0 },
    "testBridge": false
  },
  {
    "case": "planner-1920",
    "viewport": "1920x1080",
    "documentOverflowX": 0,
    "documentOverflowY": 0,
    "rightPanel": { "width": 500, "height": 1032, "backgroundColor": "rgba(0, 0, 0, 0)", "overflowX": 0, "overflowY": 0 },
    "planner": { "width": 1884, "height": 1044, "overflowX": 0, "overflowY": 2 },
    "plannerDetails": { "width": 595, "height": 886, "overflowX": 0, "overflowY": 0 },
    "routeMetrics": { "width": 550, "height": 122, "overflowX": 0, "overflowY": 0 },
    "testBridge": false
  },
  {
    "case": "planner-2560",
    "viewport": "2560x1440",
    "documentOverflowX": 0,
    "documentOverflowY": 0,
    "rightPanel": { "width": 580, "height": 1384, "backgroundColor": "rgba(0, 0, 0, 0)", "overflowX": 0, "overflowY": 0 },
    "planner": { "width": 2516, "height": 1396, "overflowX": 0, "overflowY": 0 },
    "plannerDetails": { "width": 691, "height": 1228, "overflowX": 0, "overflowY": 0 },
    "routeMetrics": { "width": 642, "height": 130, "overflowX": 0, "overflowY": 0 },
    "testBridge": false
  }
]
```

## Commands

From `apps/weltraum-browser`:

```text
npm run test
npm run build
npx playwright test --workers=1 tests/e2e/normal-runtime-functional-planner.spec.ts tests/e2e/ui-concept-parity-v2.spec.ts tests/e2e/ui-concept-parity.spec.ts tests/e2e/playable-large-field-live-flight.spec.ts tests/e2e/large-field-navigation-objective.spec.ts tests/e2e/large-field-objective-chain-live.spec.ts tests/e2e/playable-large-proving-ground.spec.ts tests/e2e/flight-ui-foundation.spec.ts tests/e2e/autopilot-proving-ground-v2.spec.ts tests/e2e/multi-obstacle-planner.spec.ts
```

## Verification output

- `npm run test`: 15 files, 169 tests passed.
- `npm run build`: passed; known Vite warning only for chunks larger than 500 kB after minification.
- Requested Playwright run: 22/22 tests passed with one worker in about 4.4 minutes.
- Playwright `.last-run.json`: `status: passed`, `failedTests: []`.

## Notes

- The previous V2 pass is historical only and must not be used as normal-`/`
  acceptance because it judged the flight concept query path.
- No commit or push was made.
- Remaining P3 polish: `/favicon.ico` returns 404.
