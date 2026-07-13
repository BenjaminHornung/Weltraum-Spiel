# Test Protocol: Browser Ship Builder Full Stats and Flight Readiness V1

## Baseline and scope

- Original implementation base SHA: `7e1d0237cdf272bfb759f26e2be8cdb3a760e15c`.
- Final PR audit target: current `origin/main`, integrated into the feature branch
  before the final verification run.
- Branch: `feature/browser-ship-builder-full-stats-flight-readiness-v1`.
- `STARTER_CATALOG_SIGNATURE` remains `5aaa27fd`.
- Only the request allowlist and the exact `package.json` `test:e2e:core` registration
  may differ from the current target branch.
- Mainline integration dependency: `apps/weltraum-browser/index.html` retains the
  user-approved `/favicon.png` declaration that prevents Chrome's automatic 404 request.
- Unity and .NET are not applicable to this browser-only checkout.

## Required commands

From `apps/weltraum-browser`:

```text
npm ci
npx tsc -p tsconfig.json
npm run test -- tests/unit/shipBuilderFullStats.test.ts
npm run test -- tests/unit/shipBuilderRcsAuthority.test.ts
npm run test -- tests/unit/shipBuilderHandlingDiagnostics.test.ts
npm run test -- tests/unit/shipBuilderFlightReadiness.test.ts
npm run test:e2e -- tests/e2e/ship-builder-full-stats-flight-readiness.spec.ts
npm run test
npm run build
$env:CI='true'; npm run test:e2e
```

From repository root:

```text
git diff --check
```

## Mandatory unit scenarios

1. Scout deterministic stats. 2. Cargo larger capacity. 3. Weapon summary.
4. Dry mass unchanged. 5. Fuel raises loaded mass. 6. Cargo raises loaded mass.
7. Fuel/cargo positions shift COM. 8. Only enabled usable main thrust counts.
9. Acceleration falls with mass. 10. Missing thrust is unavailable/readiness error.
11. RCS axes derive from directions. 12. Asymmetry is preserved.
13. Torque uses lever arm. 14. Missing direction fails closed.
15. Complete delta-v is finite. 16. Missing mass flow is unavailable.
17. Missing fuel never yields infinity. 18/19. Cargo mass/volume over-capacity.
20. COM/thrust offset. 21. Weak braking. 22. Draft permits incomplete ship.
23. TestFlight blocks missing core systems. 24. Active is stricter.
25. Insertion order does not alter signatures. 26. Outputs are immutable.
27. Inputs are unchanged. 28. No Three.js/renderer imports.
29. No Combat Core dependency. 30. No NaN/Infinity output.

Also cover fuel-free propulsion, mixed-mode unsupported behavior, exact 75% overlap
boundary, unique/ambiguous camera authority, policy-enabled low acceleration/RCS
asymmetry, diagnostic/fix ordering, and legacy starter signatures.

## Browser protocol

- Attach console-error, request-failed, and HTTP `>=400` listeners before `goto("/")`.
- Assert the real document declares `link[rel="icon"][type="image/png"][href="/favicon.png"]`;
  do not filter or intercept favicon failures in the test.
- Load normal `/` without query parameters and assert both own-property and `in window`
  checks show no `TestBridge`.
- Dynamically import `/src/ship-builder/index.ts` through Vite.
- Evaluate Scout, Cargo, Weapon, and a complete synthetic propulsion scenario twice.
- Assert pinned stats/readiness/signatures, deep freeze, JSON safety, and repeat equality.
- Assert the three failure collections are empty.
- Write only:
  - `evidence/browser-ship-builder-full-stats-flight-readiness-v1-summary.json`
  - `evidence/browser-ship-builder-full-stats-flight-readiness-v1.md`

Evidence must have stable key/row ordering, one trailing newline, and no timestamp,
duration, absolute path, random value, screenshot, NaN, or Infinity.

## Scope and dependency audit

- Fetch and integrate current `origin/main`, then compare
  `git diff --name-only origin/main...HEAD` to the exact final PR allowlist.
- Assert `starterCatalog.ts`, package lockfiles, `Assets/**`, and every forbidden
  subsystem are unchanged; `package.json` may differ only by the single Ship Builder
  spec token appended to `test:e2e:core`.
- Search new Ship Builder modules for Three.js, render, combat, runtime, flight,
  navigation, resources, celestial, settings, UI, and test-harness imports.
- Run full E2E through the repository's stable CI Playwright configuration (one worker
  and the existing CI timeouts). It may regenerate legacy evidence during execution;
  retain none of those unrelated rewrites or failure artifacts, then confirm the final
  pre-existing-evidence manifest is byte-identical.

## Completion gate

Record command, exit code, and concise evidence in the DevToolbox execution. Run
`specs_validate`, `verify_run`, inspect results, then call completion preflight for
each task before toggling it. A worker report alone is not completion evidence.
