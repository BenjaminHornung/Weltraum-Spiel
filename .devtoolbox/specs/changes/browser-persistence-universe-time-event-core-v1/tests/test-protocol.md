# Test Protocol: browser-persistence-universe-time-event-core-v1

## Scope and immutable baseline

- Branch: `feature/browser-persistence-universe-time-event-core-v1`
- Recorded `origin/main` base SHA: `7e1d0237cdf272bfb759f26e2be8cdb3a760e15c`
- Product schema under test: `SaveGameEnvelopeV1` only.
- Generic migration test contract: isolated neutral fixture `v1 -> v2`, not a product V2 save schema.
- Canonical time quantum: 120 Universe ticks per game epoch second; no runtime-loop change.
- Scope exception: only append the new E2E spec to `apps/weltraum-browser/package.json` `test:e2e:core`; dependencies, lockfiles, and every other script remain unchanged.

Run npm/TypeScript/Vitest/Playwright commands from `apps/weltraum-browser` in the isolated worktree. Run Git and evidence-integrity commands from repository root. Inspect every exit code and retain command-level evidence.

## DevToolbox state

DevToolbox MCP calls are intentionally `NOT RUN` by user choice because the MCP's restricted workspace root excludes this Temp worktree. Therefore:

- `workspace_prepare_for_agent`, `specs_get_status`, `tasks_load`, `execution_create`, `verify_run`, `tasks_completion_preflight`, and `tasks_toggle` have not run here;
- all entries in `tasks.md` remain unchecked;
- no task may be represented as DevToolbox-complete or toggled closed until an eligible workspace completes evidence ingestion and completion preflight.

## Required commands

```powershell
# From apps/weltraum-browser
npm ci
npx tsc -p tsconfig.json

# Six focused unit suites
npm run test -- tests/unit/persistenceUniverseTime.test.ts
npm run test -- tests/unit/persistenceSaveSchema.test.ts
npm run test -- tests/unit/persistenceMigrations.test.ts
npm run test -- tests/unit/persistenceEvents.test.ts
npm run test -- tests/unit/persistenceSimulationMode.test.ts
npm run test -- tests/unit/persistenceCanonical.test.ts

# Focused normal-route browser scenario; run twice
npm run test:e2e -- tests/e2e/persistence-universe-time-event-core.spec.ts
npm run test:e2e -- tests/e2e/persistence-universe-time-event-core.spec.ts

# Full browser regression
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
npm run test:e2e
```

```powershell
# From repository root
git diff --check
git diff --cached --check

# Evidence parses and contains no forbidden nondeterministic/reporting fields.
$summaryPath = 'apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1-summary.json'
$markdownPath = 'apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1.md'
$summaryText = Get-Content -LiteralPath $summaryPath -Raw
$summary = $summaryText | ConvertFrom-Json
$markdown = Get-Content -LiteralPath $markdownPath -Raw
if ($summary.schemaVersion -ne 1) { throw 'Evidence schemaVersion must be 1' }
if (-not $summary.roundtrip.byteStable) { throw 'Roundtrip bytes are not stable' }
if (-not $summary.roundtrip.signatureStable) { throw 'Roundtrip signature is not stable' }
$forbiddenEvidencePattern = '(?i)timestamp|wall.?clock|durationMs|machinePath|screenshot'
if ($summaryText -match $forbiddenEvidencePattern -or $markdown -match $forbiddenEvidencePattern) {
  throw 'Evidence contains forbidden nondeterministic/reporting fields'
}

# Capture a hash after the first successful focused E2E, rerun it, then compare.
$firstSummaryHash = (Get-FileHash -LiteralPath $summaryPath -Algorithm SHA256).Hash
$firstMarkdownHash = (Get-FileHash -LiteralPath $markdownPath -Algorithm SHA256).Hash
Push-Location 'apps/weltraum-browser'
try { npm run test:e2e -- tests/e2e/persistence-universe-time-event-core.spec.ts } finally { Pop-Location }
$secondSummaryHash = (Get-FileHash -LiteralPath $summaryPath -Algorithm SHA256).Hash
$secondMarkdownHash = (Get-FileHash -LiteralPath $markdownPath -Algorithm SHA256).Hash
if ($firstSummaryHash -ne $secondSummaryHash -or $firstMarkdownHash -ne $secondMarkdownHash) {
  throw 'Repeated browser evidence is not byte-identical'
}

# Original allowlist plus the approved package script exception only.
$allowedPatterns = @(
  '^\.devtoolbox/specs/changes/browser-persistence-universe-time-event-core-v1/',
  '^apps/weltraum-browser/src/persistence/',
  '^apps/weltraum-browser/tests/unit/persistence[^/]*\.test\.ts$',
  '^apps/weltraum-browser/tests/e2e/persistence-universe-time-event-core\.spec\.ts$',
  '^apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1',
  '^docs/browser-mainline/persistence-universe-time-event-core-v1\.md$',
  '^apps/weltraum-browser/package\.json$'
)
$changed = @(git diff --name-only 7e1d0237cdf272bfb759f26e2be8cdb3a760e15c...HEAD) + @(git status --short | ForEach-Object { $_.Substring(3) })
$changed = @($changed | ForEach-Object { $_ -replace '\\','/' } | Sort-Object -Unique)
$outside = @($changed | Where-Object {
  $path = $_
  -not ($allowedPatterns | Where-Object { $path -match $_ })
})
if ($outside.Count -ne 0) { throw "Out-of-scope paths: $($outside -join ', ')" }

# Package exception is script-only; lockfiles and dependencies must not drift.
git diff --exit-code 7e1d0237cdf272bfb759f26e2be8cdb3a760e15c -- package.json package-lock.json apps/weltraum-browser/package-lock.json
$packageDiff = git diff --unified=0 7e1d0237cdf272bfb759f26e2be8cdb3a760e15c -- apps/weltraum-browser/package.json
if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect package exception' }
if ($packageDiff -match '^[+-]\s*"(dependencies|devDependencies|optionalDependencies|peerDependencies)"') {
  throw 'Package dependency drift detected'
}

# Forbidden-path audit must print no path.
git diff --name-only 7e1d0237cdf272bfb759f26e2be8cdb3a760e15c -- Assets apps/weltraum-browser/src/flight apps/weltraum-browser/src/navigation apps/weltraum-browser/src/runtime apps/weltraum-browser/src/render apps/weltraum-browser/src/ui apps/weltraum-browser/src/settings apps/weltraum-browser/src/combat apps/weltraum-browser/src/celestial apps/weltraum-browser/src/ship-builder apps/weltraum-browser/src/resources apps/weltraum-browser/src/world apps/weltraum-browser/src/test-harness docs/roadmap/living-master-plan.md docs/browser-mainline/feature-intent-index.md docs/browser-mainline/port-roadmap.md

# Source dependency/side-effect audit must produce no match.
rg -n "Date\.now|new Date|performance\.now|Math\.random|crypto\.randomUUID|localStorage|indexedDB|from ['\"]three['\"]|from ['\"][^'\"]*(flight|navigation|runtime|render|ui|combat|celestial|settings|resources|ship-builder|world)" apps/weltraum-browser/src/persistence
```

For the final `rg` command, exit code `1` with no output is the expected clean result. Any matching line is a failure requiring review; do not add blanket exclusions.

## Mandatory unit coverage

The six suites SHALL jointly implement every numbered Scenario 01-30 in `specs/default/spec.md`:

- Clock: deterministic start; exact tick advance; repeatability; invalid/overflow/rounding rejection; no system time.
- Identity/schema: full prefix grammar and classification; deterministic seeded fixtures; duplicate rejection; byte-stable envelope roundtrip; insertion-order invariance; definition references/version resolution; mutable-state separation; finite mobile acceptance; NaN/Infinity rejection; future-version rejection.
- Migration: neutral V1-to-V2 success; missing path/downgrade/gap rejection; immutable input and per-stage validation.
- Events: tick/ID ordering; exact duplicate no-op versus conflict; explicit deterministic acknowledgement; retained `actionRequired`; forbidden UI-truth payload keys.
- Modes: all allowed edges, all forbidden edges, idempotent self-edges, terminal Destroyed.
- Canonical/isolation: deep immutability; stable signatures; plain/dense/finite JSON rejection; no Three.js/DOM/renderer/storage/time/random dependency; unchanged other domain cores.

## Browser acceptance and evidence contract

The Playwright spec SHALL:

1. register `console` error, `pageerror`, `requestfailed`, and response-status-`>=400` listeners before navigation;
2. load normal `/` and prove `window.TestBridge` is absent;
3. dynamically import `/src/persistence/index.ts` through Vite;
4. create and explicitly advance a 120 Hz Universe clock while leaving Mission Time separate;
5. construct and validate a minimal strict V1 save against explicit definition snapshots;
6. enqueue events, prove deterministic ordering/idempotency, and acknowledge with explicit Universe Time;
7. perform an allowed simulation-mode transition without implicit event behavior;
8. run the neutral generic migration fixture and prove immutable input/per-stage validation;
9. canonicalize, serialize, parse, revalidate, and reserialize the save;
10. execute the scenario twice and assert identical canonical bytes and signatures; and
11. write the two approved evidence files only after every assertion and browser-health check passes.

Expected evidence paths:

- `apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1.md`

Evidence SHALL be deterministic, JSON-safe where applicable, machine-path-free, screenshot-free, and contain no generated timestamp, system time, duration, UUID, or random value.

## Results to fill after fresh execution

| Check | Result | Command evidence / notes |
| --- | --- | --- |
| `npm ci` | `NOT RUN` | Pending implementation verification. |
| TypeScript | `NOT RUN` | Pending. |
| Six focused unit suites / 30 cases | `NOT RUN` | Pending. |
| Focused E2E run 1 | `NOT RUN` | Pending. |
| Focused E2E run 2 / byte comparison | `NOT RUN` | Pending. |
| Full unit suite | `NOT RUN` | Pending. |
| Build | `NOT RUN` | Pending. |
| E2E core/live/ui/aggregate | `NOT RUN` | Pending. |
| Evidence integrity | `NOT RUN` | Pending. |
| Scope/forbidden-path/package audit | `NOT RUN` | Pending. |
| `git diff --check` | `NOT RUN` | Pending final diff. |
| Independent read-only review | `NOT RUN` | Pending. |
| DevToolbox completion preflight/task toggles | `NOT RUN` | Restricted-root limitation; tasks remain unchecked. |

## Completion rule

Do not replace a placeholder with `PASS` without a fresh command, inspected exit code, and recorded evidence. Any unrun item remains explicit. DevToolbox tasks may be toggled only after evidence is ingested and `tasks_completion_preflight` succeeds in an eligible workspace. The branch may be pushed after verification and review but SHALL NOT be merged to `main` by this change.
