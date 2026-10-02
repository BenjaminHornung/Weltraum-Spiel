# RD-01 P1 repair handoff

The Windows case-variant output-guard defect is repaired. This is a bounded child-of-32985659 repair, **not integration or acceptance**. Original candidate `3298565993c01ad0c27d101674f25b1b581791b2` remains the held baseline; its tree is `29209cd06b0fbe903597e2d5caf45e158649f8ef`. The final repair SHA, tree, parent and every changed path/blob/byte digest are recorded after the local commit in:

`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-01/repair-receipt-32985659.json`

Precommit evidence: `reports/RD-01/repair-verification-32985659.json`. Collector: `reports/RD-01/repair-receipt.mjs` (`--prepare` writes that new report once; no arguments writes the new postcommit external receipt once). Neither mode overwrites the original receipt.

## Exact delta and invariant bytes

- `src/tools/reference-index/cli.mjs`: native `lstatSync(target, { throwIfNoEntry: false })` replaces the case-sensitive directory-entry admission test. Live/dangling links and nonregular targets are rejected before the writer; parent containment and existing-target realpath checks remain. No normalization, caller fix, dependency or registry change.
- `tests/RD-01/unit.test.ts`: one added permanent `REF05` regression. The original REF01–REF04 file bytes remain an unchanged prefix. The production `--write` block is extracted directly from the actual CLI, with native filesystem reads and a nonwriting, admission-recording sink — not a copied guard implementation.
- New repair-only collector, this handoff and precommit machine report; no old report is rewritten.

CLI SHA256: `1c1aa2824a5583d273b8d54af25d18f33633d5916e0955d458c0d6272ef49e8b` → `5c709aa13a12e0c0004d467484254dff6f341b5d2ed6e9672d404f1466ffb714`.

Permanent test SHA256 is identical for RED, GREEN and fresh final units: `353c73b507e11230afa48fd47ae42035c379e659bcbc715ae54ed61f85ca6048`.

All 23 original candidate files other than the CLI and test are byte-compared with their immutable 32985659 Git blobs. This includes all seven cards, concepts, index, `catalog.mjs`, source/access metadata and all original reports/helpers. Index remains 46,512 bytes, SHA256 `b7804d1a80aa4b23d9ad7ced016a51d78c571a88b23ce93488d09edd8ef281a1`. Original external `final-receipt.json` remains SHA256 `1a88d9db98e9a1a3956b5703cab6757633dbade521f695a10ac558151c3a6d07`. No refetch, claim reclassification, media viewing or source replacement.

## Genuine RED and GREEN

All raw logs below are under `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-01/logs/`; exact pinned binary, argv, C-only environment, working directory, UTC dates, exit codes and raw byte/hash bindings are in the new receipts and appended command journal. Original producer records are retained.

| Check | Actual result | Raw log | SHA256 |
|---|---|---|---|
| HEAD producer RED | exit 1, missing expected exception; real uppercase junction admitted, no sink executed | `head-case-link-guard-red-1790974865018.log` | `913ac445e5ae6c9f129f6478bf22b15086ed46e06e4cf3d714cf7e5af755ed30` |
| Permanent pre-fix RED | exit 1; 4 original tests pass, REF05 fails on live-junction admission; dangling junction and directory also admitted to the fenced callback | `repair-red-1790975503985.log` | `20f7fe02282cfabcacf12313355d03125768839a23d7361ec27c6e111135da7e` |
| Same permanent test GREEN | exit 0; 5/5 | `repair-green-1790975582390.log` | `99e27ed22774385b5172c0ce98a5595daaf0108d99869d0a63a399dbe6579283` |
| Original reproduction, retained HEAD fixture | exit 0; exact current guard rejects original junction before any sink | `repair-head-retained-green-1790975648692.log` | `4313381b01938bf1ac65d409614acf31821e8de473931901006a39bab8f39c79` |

Permanent case evidence is retained in the own runroot at `repair-output-guard-tIs6D3/evidence.json` (RED), `repair-output-guard-gGz3Sj/evidence.json` (GREEN), and `repair-output-guard-kBRrcE/evidence.json` (fresh final units). It records real native Windows `INDEX.JSON`/`index.json` aliasing, source/guard/test hashes, live/dangling junction rejection, linked-parent rejection, nonregular-directory rejection, absent/regular admission and unchanged destinations. No filesystem write sink was executed; callback admission in RED is not a foreign-write exploit.

Native **file** symlink creation returned `EPERM`, errno `-4048`, syscall `symlink`; exact paths/messages are in each case record. Therefore file-symlink cases were NOT RUN. No global Windows setting changed. Actual live/dangling Windows junctions cover the native case-variant link guard semantics. HEAD's retained junction/destination remain untouched; only its helper's `--retained` mode was invoked, never `--setup`.

## Fresh verification

| Check | Result | Raw log SHA256 |
|---|---|---|
| Prework freeze/source audit, before repair edits | PASS, all 18 frozen files | `f6caa4cd006539e9ce93196c2fa79aaad874c7f38fee951585f744e18b2a0e87` |
| Own Lab `npm run check` | PASS, exit 0 | `55c814d0e096397f099fe6af3df4cb48543573b7821b3361bbbe5963f2045252` |
| Focused RD01 `tsc --noEmit --project reports/RD-01/tsconfig.json` | PASS, exit 0; TS tests, `checkJs=false`, not strict JS coverage | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Own Lab `npm run test:unit -- tests/RD-01` | PASS, fresh 5/5, exit 0 | `17c77ed60fb29eb4df484b54299030808ddfe52e8865348d80ccc1b749571b0f` |
| Own Lab `npm run build` | PASS, exit 0; not a product acceptance build | `5f7946a360a0374d42a6b0b93ed09863cbb827d144aa5ac2968a97b7f11450bb` |
| Fresh source/freeze audit | PASS, original inputs/assets/controls/frozen bytes match | `cda01c20584bbe4fe1991010b918eb84aa5e6f8ea04ddb3801e27728276ed08d` |
| Fresh CLI normal/reverse/tracked index and source-body/input binding equality | PASS, exit 0; 7 source bodies, 14 inputs | `1d4ceff9d86d2a10e304b62cebdbffb2267623549000cf51b88de786b5553032` |
| Explicit RD01 boundary, staged diff check and postcommit boundary | Required exit 0; exact commands/logs and final graph are bound in the postcommit receipt | postcommit receipt |

Immutable task START: `89b55315fa7800a7a417c49e5e5a272f17410b4b`; read-only product base: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. Boundary argv uses separate values: `npm run verify:boundary -- --task RD-01 --start 89b55315fa7800a7a417c49e5e5a272f17410b4b --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e`, never the default RD00 gate.

Recorded verification/commit invocations use unchanged `reports/RD-01/run-command.mjs`, explicit `C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe`, its `node_modules/npm/bin/npm-cli.js`, `C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe` and process-local `C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe`. Their cwd is the own Lab; TMP/TEMP/npm cache stay in the own RD01 runroot. Direct read-only Git inspection and initial literal-path staging used the same explicit C-Git with the own checkout cwd; final staging also uses the wrapper's C-only environment. Heavy jobs ran sequentially. No install was needed for this repair.

## Review, acceptance and residual limits

Scoped code/test/report diff self-reviewed. The one SO-01 P1 reported by HEAD is reproduced and repaired; **no new independent review or acceptance is claimed**. HEAD/SO-01 recheck remains pending. Browser: NOT APPLICABLE (pure CLI, no UI). GPU/performance/product acceptance: NOT AUTHORIZED. Media/art: NOT RUN; ProductIntegrated=false.

The original all-files gate is `FAIL_ACCEPTED_NARROW_EXCEPTION`, not clean PASS: only the automatic untracked regular `.opencode/throughput.jsonl` and `.opencode/throughput.md` remain. No tool logs are authored, copied, deleted, ignored, staged or published. Shared freeze/lock/contracts/registration/config/guard and RD02 bytes remain unchanged. No merge, push, PR, delegation, service, browser or GPU job.

RD40 import remains `import text from '../reference-cards/index.json?raw'; const catalog = JSON.parse(text);`; no HEAD registration delta. `verify-catalog.mjs --generate` still calls the single corrected CLI; no caller patch or original index rewrite was needed. Open visual questions remain the original `OPEN-VISUAL-QUESTIONS.md`, not a new Visual Bible.

Cleanup: no owned background process, service or tab exists to stop. Original HEAD fixture and new isolated fenced fixtures, logs, receipts, Lab dependencies/build and own cache are retained; no deletion was performed. Sources remain seven unreadable JS challenges, six missing concept targets and five unavailable LFS image payloads. This preexisting-target guard is not atomic protection against a concurrent target replacement; no wider hardening is claimed.
