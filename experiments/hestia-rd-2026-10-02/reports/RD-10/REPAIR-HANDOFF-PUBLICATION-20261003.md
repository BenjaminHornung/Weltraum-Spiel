# RD10 Phase2 tooling P2 repair

Status: REPAIRED_READY_FOR_HEAD_TOOLING_RECHECK. Same leaf, no delegation;
sole writer and one sequential heavy job. No new native/browser qualification.
ProductIntegrated=false. Full child SHA/tree and postcommit boundary are in the
new external repair receipt, avoiding a commit-self-reference.

## Scope and diagnosis

Parent `f8fcd37681333bfe8d02a453cfdf8154bfae11d9`, tree
`421bf0be36afeb249855b6a0f666e5984f6a8357`, branch
`feature/hestia-rd-rd10-phase2-2026-10-02`. Task boundary START remains
`84aeadb11a2cf49acf83c8326f7eeac1898c6da9`, source
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.

Confirmed owning line 227 compared parsed JSON against a raw object containing
optional `admission: undefined` on SDK attachment copies. JSON omits those
properties. The minimal fix compares each expected publication section's JSON
representation, using `JSON.parse(JSON.stringify(proof[key]))`. All seven bound
sections, strict deep equality, upstream hash/byte/admission checks and error
messages remain intact. This is the established publication serialization
boundary, not a new value-rewriting helper.

Exactly three changed paths, relative to the lab:

- `reports/RD-10/phase2-evidence.mjs`: one comparison expression changed.
- `tests/RD-10/phase2-publication/unit.test.ts`: one permanent regression.
- `reports/RD-10/REPAIR-HANDOFF-PUBLICATION-20261003.md`: this repair handoff.

## Actual owning-block RED/GREEN

The regression reads the owning candidate-mode comparison between its actual
`const published = json(report)` and candidate-write statements, requires one
unique block, and executes only that block with Node's strict assertion API.
It neither imports/runs the full producer nor duplicates the comparison. It
does not run historical candidate preconditions or create any candidate output.

Original committed comparison: one observed test, one assertion failure,
zero skipped; failure explicitly shows `Published browser binding` and absent
undefined SDK-copy/nested admission properties. After the one-line fix, the
unchanged oracle passes, including nine rejection assertions for changed shared,
graph and SDK image hashes, image byte count, admission point, first-failure
reason, oracle hash, profile availability and target qualification.

```text
Oracle SHA256: 0231f6c8384f8a60e4e380dbf7194b3de23e841d3da209820ca7a2b881fefcce
RED owner:     ba5aa712c70fbfa02cfbec617089283e35c1b9a5bc0c6cb5643963ecf15c8a2d
GREEN owner:   d7c650a636a50aac6e1f0e8a4767efb1b33347926b863666dbf57321cb9ee4f8
RED raw:       2bb24f4369175b7bb200fd7ff8b5bd9798773dc6101390e6bf5e85126b13a2b9
GREEN raw:     259b04f1fbbad3b376166cfe59e5f8fbacb6dfe9d6150f8d1a45a1b7358a280a
```

## Fresh repair verification and commands

All commands use working directory
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees/Hestia-RD-RD10/experiments/hestia-rd-2026-10-02`.
Run wrapper prefix:

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/repair-publication-f8fcd376-20261003/run.mjs'
```

Append `label operation`; child binary/argv, cwd, exit, source/test bindings and
raw log SHA are retained in each new `commands/<label>/receipt.json`:

| Label / operation | Actual check | Exit |
| --- | --- | --- |
| `preflight-02 baseline` | f8/tree/branch;29 originals, shared18 and retained evidence bindings | 0 |
| `regression-red regression` | original owning block, one genuine behavioral assertion failure | 1 |
| `regression-green regression` | same oracle, JSON publication plus strict mismatch rejection | 0 |
| `unit-final unit` | only `vitest run tests/RD-10`; original18 + new1, 19/19, zero skipped | 0 |
| `check-final check` | `tsc --noEmit -p tsconfig.json` | 0 |
| `types-final types` | `tsc --noEmit -p tests/RD-10/tsconfig.json` | 0 |
| `bindings-final verify` | preserved originals/media/dist/HEAD facts + RED/GREEN hashes | 0 |

Closing guard/commit/postcommit/port/receipt commands and their actual exits
belong to the external receipt, not a prospective PASS here. The explicit
guard arguments are `--task RD-10 --start 84aeadb11a2cf49acf83c8326f7eeac1898c6da9 --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
Process-local PATH contains only C-tree Node/Git/PowerShell; TMP/cache are in
the new repair root and npm script shell is the pinned C-tree PowerShell.
Initial external-wrapper ESM import startup failed before its logger; the
observed error and file-URI correction are retained in `setup-01-note.txt`.
That setup failure is NOT behavioral RED.

## Preservation, skipped checks and cleanup

Fresh hash checks preserve the other 28 original owned files, all runtime
factory/main/HTML, original16 factory oracles, original Phase2 browser/admission
oracles, shared18/lock/inventory, reference cards, public429, existing optimized
five-file graph and all selected retained media/producer/HEAD command artifacts.
No source refetch, original report/receipt/`built.json`/candidate/CLOSEOUT-NOTE
or external workaround rewrite. Original failed `candidate-final` and successful
workaround remain historical evidence for f8, not silently relabelled success.

HEAD's immutable `HEAD/rd10-phase2-head-f8fcd376.json` was independently hashed:
`26cf03733519ad7cabb0a252f122048dfab18ab28d7a7746e8de65a75224c5eb`.
Its fresh f8 18/18 unit/type/build,6/6 browser and434 served-byte checks are prior
HEAD facts. Leaf's f8 native/browser PASS is historical f8 evidence. Neither is
a new repair browser execution, GPU timing, art or product acceptance.

Browser/HTTP/rebuild: NOT_RUN for this tooling-only repair; unchanged runtime,
config, pins and retained optimized graph support proportionate reuse. Candidate
writer: NOT_RUN; its original exact-parent84/branch/source/evidence/write-once
preconditions remain explicit and unchanged. Do not replay it on this child or
overwrite existing candidate outputs. GPU/Q1/Q2/performance/art/product: NOT_RUN.

Self-diff review performed. No independent repair review run by this leaf;
HEAD recheck/review/serial integration remain pending. No services or browser
contexts started, no foreign cleanup, no publication, no global writes. Artifacts
retained. Automatic untracked throughput logs are untouched narrow exceptions,
not an all-files-clean assertion. Source/profile/effect APIs are unchanged.

New output root:
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/repair-publication-f8fcd376-20261003`.
The one-time new `repair-receipt.json` carries full child SHA/tree/parent/paths,
fresh postcommit boundary, command exits/raw hashes, same oracle hash and
unchanged source/shared/media bindings. It is separate from every old receipt.
