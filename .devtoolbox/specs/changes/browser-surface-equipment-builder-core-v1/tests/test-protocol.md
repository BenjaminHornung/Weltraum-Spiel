# Test Protocol: Surface Equipment Builder Core V1

## Baseline

- Interaction SHA: `291c7d49e79d9a075a8ff6c50e7ddb578a8f1217`
- Suit SHA: `f8d257aeec17e8a6bd22400925ee816fc524b566`
- Dependency merge SHA: `ffb858ba661ae2d30f1e8c331ef5e6c163e9cd97`
- Worktree branch: `feature/browser-surface-equipment-builder-core-v1`

## Pre-implementation dependency gates

From `apps/weltraum-browser`:

```powershell
npx tsc -p tsconfig.json
npx vitest run tests/unit/interactionEvaluation.test.ts tests/unit/interactionSession.test.ts --maxWorkers=1
npx vitest run tests/unit/suitCore.test.ts --maxWorkers=1
```

Recorded baseline: TypeScript passed; Interaction 2 files/52 tests passed; Suit 1 file/64 tests passed after user-approved `npm ci` in the isolated worktree.

## Targeted and full verification

The current Surface Equipment unit inventory is exactly 3 files / 40 tests, including full-destination and same-slot `MoveModule` capacity regressions added during review closure:

- `tests/unit/surfaceEquipmentCatalog.test.ts`
- `tests/unit/surfaceEquipmentCommands.test.ts`
- `tests/unit/surfaceEquipmentScenarios.test.ts`

```powershell
npx vitest run "tests/unit/surfaceEquipmentCatalog.test.ts" "tests/unit/surfaceEquipmentCommands.test.ts" "tests/unit/surfaceEquipmentScenarios.test.ts" --maxWorkers=1
npx tsc -p tsconfig.json
npm run test -- --maxWorkers=4
npm run build
npm run test:e2e -- "tests/e2e/surface-equipment-builder-core.spec.ts" --workers=1 --retries=0
git diff --check
```

## Static/scope checks

- Diff exactly from dependency merge SHA and list every changed path, including untracked deliverables.
- Assert no changes under interaction, suit, combat, resources, ship-builder, main/style/package/lock/config, `.github`, or `infra`.
- Scan `src/surface-equipment` for DOM, Three.js, Date, Random, runtime fire/hit/damage/completion/mutation APIs, forbidden private imports, and duplicate declarations of `InteractionCapabilityId`, `SuitInterfaceId`, `DamageType`, or `ResourceRequirement`.
- Run secret scan on changed text files.
- Confirm only allowed evidence/docs/spec/test/source paths changed.
- Because deliverables remain untracked until human approval, supplement `git diff --check` with an untracked-aware trailing-whitespace scan.

## Browser proof

On normal `/`, require TestBridge absent and dynamic import `/src/surface-equipment/index.ts`. Run the six-fixture/readiness/projection scenario twice. Assert module-to-slot type compatibility, active thermal load in mW separately from heat/action in mJ, stats/readiness provenance, the complete diagnostic order, and exact signatures. Directly prove that Laser Cutter derives imported Combat `DamageType` `Cutting` from the Combat public registry with delivery `Beam`, rather than relying on its fixture ID. Compare canonical JSON and signatures byte-for-byte. Record page errors, console errors, failed network responses, and request failures as `0/0/0/0`. Do not capture screenshots.

Implemented focused procedure from `apps/weltraum-browser`:

```powershell
npm run test:e2e -- "tests/e2e/surface-equipment-builder-core.spec.ts" --workers=1 --retries=0
```

The focused spec registers all four browser-health collectors before navigation, uses the actual public Suit fixture/snapshot constructors, loads exactly six built-ins, and proves nominal/insufficient-energy Mining Cutter readiness plus blocked/repaired Ballistic Sidearm readiness. Safety is restored through public `InstallModule`; both Interaction and Combat projections are produced after the accepted command. The same in-page scenario runs twice before evidence is written.

## Evidence stability

Generate the JSON and Markdown evidence twice using the same scenario and compare bytes/hashes. Files must contain no timestamp or environment-specific absolute path.

Concrete Windows repeat procedure from `apps/weltraum-browser`:

```powershell
$summary = Join-Path (Get-Location) "evidence\browser-surface-equipment-builder-core-v1-summary.json"
$markdown = Join-Path (Get-Location) "evidence\browser-surface-equipment-builder-core-v1.md"
$firstSummary = Join-Path ([IO.Path]::GetTempPath()) "surface-equipment-summary-first.json"
$firstMarkdown = Join-Path ([IO.Path]::GetTempPath()) "surface-equipment-evidence-first.md"
npm run test:e2e -- "tests/e2e/surface-equipment-builder-core.spec.ts" --workers=1 --retries=0
Copy-Item -LiteralPath $summary -Destination $firstSummary -Force
Copy-Item -LiteralPath $markdown -Destination $firstMarkdown -Force
$firstJsonHash = (Get-FileHash -LiteralPath $firstSummary -Algorithm SHA256).Hash
$firstMarkdownHash = (Get-FileHash -LiteralPath $firstMarkdown -Algorithm SHA256).Hash
npm run test:e2e -- "tests/e2e/surface-equipment-builder-core.spec.ts" --workers=1 --retries=0
$secondJsonHash = (Get-FileHash -LiteralPath $summary -Algorithm SHA256).Hash
$secondMarkdownHash = (Get-FileHash -LiteralPath $markdown -Algorithm SHA256).Hash
if ($firstJsonHash -ne $secondJsonHash) { throw "Surface Equipment JSON evidence hash changed between focused runs." }
if ($firstMarkdownHash -ne $secondMarkdownHash) { throw "Surface Equipment Markdown evidence hash changed between focused runs." }
if ([Convert]::ToBase64String([IO.File]::ReadAllBytes($firstSummary)) -cne [Convert]::ToBase64String([IO.File]::ReadAllBytes($summary))) { throw "Surface Equipment JSON evidence bytes changed." }
if ([Convert]::ToBase64String([IO.File]::ReadAllBytes($firstMarkdown)) -cne [Convert]::ToBase64String([IO.File]::ReadAllBytes($markdown))) { throw "Surface Equipment Markdown evidence bytes changed." }
$secondJsonHash
$secondMarkdownHash
```

Final verification commands for the complete change, run from `apps/weltraum-browser`, are the quoted targeted 40-test command, `npx tsc -p tsconfig.json`, `npm run test -- --maxWorkers=4`, `npm run build`, the focused E2E command above, the repeated hash/byte procedure, and `git diff --check` plus untracked-aware scans.

Observed proof refresh after the accepted review fixes:

- Both focused E2E runs passed with 1 test / 1 worker / 0 retries and Browser health `0/0/0/0`.
- Scenario signature: `5688993b`; canonical scenario length: `13403` bytes.
- JSON evidence SHA-256: `cea49b3f22bd95d6d5b4d16af247b7cdbcedc21a66a00f264c7c0a7d7b989e52` (`57292` bytes).
- Markdown evidence SHA-256: `bbf89867111557d34aca49b964ad6e3e5db641e623e3cfd0442542ea43356b1a` (`5315` bytes).
- Both second-run hashes and full byte sequences matched their first-run copies.

## Reviews and completion

Primary reviewer and reviewer-GLM found material issues; focused fixes and rereviews closed every finding. The final narrow primary rereview passed with no findings. Run fresh complete verification, DevToolbox verification evidence, and task completion preflight before toggling tasks. Present the final human-review package before commit/push. No PR, merge, or archive.
