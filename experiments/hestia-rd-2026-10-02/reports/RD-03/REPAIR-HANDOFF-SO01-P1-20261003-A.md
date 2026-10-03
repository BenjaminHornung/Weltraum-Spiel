# RD03 capture-admission repair — READY_FOR_HEAD_WIRING

The reported SO01 P1 is confirmed and repaired. RUN03 and RUN04 now create
their parent separately and require a fresh, non-recursively created final
directory. RUN03 checks screenshot ancestry and rejects every existing
destination (including a directory or dangling junction) before its capture
callback. Existing path-isolation and exclusive JSON writes remain intact.
The CLI already creates an exclusive directory and is unchanged.

This is one bounded test-side repair, not whole-RD03 completion. No runtime,
CPU logic, shared contracts/configuration, registration, lock, exporters,
fixtures or product code changed. `productIntegrated` remains false.

## Identity and exact scope

- Reviewed parent: `e4f52161e75400f10c9bc3cf0d95f455219fba2a`;
  tree `a7fb3926323e689d60c1d3f12dd518313e851d00`.
- Original implementation: `0857c4ce1232c66d7e7b4f4dbad20f6249d2e677`;
  tree `0a2199440b65b43580fd545aab29c87c232b596e`.
- Original START: `16faf55a9782fb12d2f30df4547a619957792089`.
- Read-only product base: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
- Branch: `feature/hestia-rd-rd03-2026-10-02`.

Exactly five lab-relative repair paths:

1. `tests/RD-03/browser.spec.ts` — use actual shared test-side admission code.
2. `tests/RD-03/capture-admission.mjs` — fresh directory and pre-capture checks.
3. `tests/RD-03/capture-admission-regression.mjs` — one native regression.
4. `reports/RD-03/REPAIR-HANDOFF-SO01-P1-20261003-A.md` — this additive handoff.
5. `reports/RD-03/REPAIR-RECEIPT-SO01-P1-20261003-A.json` — verified source/log bindings.

The new local repair commit must be a direct child of the reviewed parent.
Its full SHA/tree/parent and final boundary are recorded **after commit** in
the additive external `checks/repair-so01-p1-20261003-a/TERMINAL-RECEIPT.json`.
The tracked repair receipt binds tested content without a circular self-commit
identity. Old receipts and their code-0857 evidence bindings are not rebound.

## Genuine RED, unchanged regression GREEN

The original browser source was copied before any edit. The unsafe directory
and capture behavior was then extracted without fixing it; the permanent
native regression used that same code through a fenced callback. RED exited
1 on `Reused RUN03 must be rejected before screenshot callback` (`1 !== 0`).
The callback refused all existing destinations before writing, so even RED
preserved the retained image and JSON. This is an assertion RED, not an
import/preflight failure and not a screenshot overwrite reproduction.

Only the admission implementation changed for GREEN. The identical regression
source SHA-256 is `c3190fcc26fba1fc10650a9490b90d5626a75af9ca7820833ca970d78856e542`.
GREEN covers fresh RUN03; reused RUN03 with retained image/JSON and zero
callbacks; fresh/reused RUN04; existing regular file, directory, junction and
dangling-junction screenshot targets; and linked/non-directory run ancestry.
All probes and junction targets are inside a fresh owned RD03 checks directory.
No browser, screenshot follow-write, foreign path, deletion or global symlink
setting was used. Sentinel bytes are explicitly not rendering evidence.

## Fresh verification

All commands use lab cwd and the existing RD03 `run-check.mjs`, pinned Node
`C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe`,
C:-only process PATH, owned TMP/cache, and sequential execution.

| Check | Result | Raw log SHA-256 |
|---|---|---|
| Native admission RED | expected exit 1 | `0d3888f4bd3a36dde656a07e5a390a9854160667c89c5f41237592bca8e2dd8e` |
| Same native admission GREEN | PASS, exit 0, eight case records | `09ff72cef6545bd919822a05a55523cd7ab549053795ec1e830bdcf38e285048` |
| Pinned Vitest `run tests/RD-03` | PASS, exit 0, 13 tests/two files | `1831cfaa568c75635471251ab4167dcaba4da9705625b8cf29b2b733e595c30b` |
| `npm run check` | PASS, exit 0 | `55c814d0e096397f099fe6af3df4cb48543573b7821b3361bbbe5963f2045252` |
| Explicit RD03 boundary before reports | PASS, exit 0, 52 input files, no violations | `64c69a9f481b4d6ec74befb1bdfe9efbe24bd4710e6cc51e01bc4b3d58c20325` |
| Retained-byte verification | PASS, exit 0 | `6d0483f9bb434b45f8f9f4a3b009e70042333adb37a4e748766746a498070758` |

Native command: `tests/RD-03/capture-admission-regression.mjs <fresh-run-id>`.
RED/GREEN IDs are `repair-so01-p1-a-admission-red` and
`repair-so01-p1-a-admission-green`. Raw full binaries/arguments/cwd/environment,
exits and hashes are in the append-only `commands.jsonl` and new receipt.
Boundary arguments remain `--task RD-03 --start 16faf55a9782fb12d2f30df4547a619957792089 --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
Code diff self-review found no additional confirmed findings. Final whole
repair diff/whitespace and post-commit boundary are bound in the external
terminal receipt. No new independent or human repair review was run.

CLI inspect/abort: NOT_RUN for this repair; unchanged CLI and CPU paths.
Build: NOT_RUN for this test-side repair; the prior root build remains
Canvas2D-only, never optimized RD03 proof. Optimized RUN03/RUN04 and GPU,
product, performance and art acceptance remain **NOT_RUN**, not NOT_APPLICABLE.

## Retention, deviation and HEAD wiring

`checks/repair-so01-p1-20261003-a/before.json` records pre-repair hashes;
`retained-verification.json` proves 18/18 shared files, all 429 fixture files,
seven runtime/CLI files, three old RD03 reports, 1,209 existing owned evidence
files, six old helpers, and the previous command-ledger prefix unchanged.
Four existing owned links were checked as link metadata only, never followed.
The new raw logs and probe directories are additive and retained.

Unchanged old bindings: `CODE-RECEIPT.json`
`f5c9bce2ee1014435c0ca0831d289dc692bc843996af8edea02d1aeb49774118`;
`checks/evidence-index.json`
`71f6d2ba982060f6e084255fa3e24865401fa0f52e3003705347a5b87dd78d8a`;
`checks/FINAL-RECEIPT.json`
`8add12adb7017114ec496617de5ad2704b5cfe6b418d9ceea692923011a3e02a`.
The lock and inventory remain respectively
`9dc112529df87daa8a3d92a913932d2b0bad131055d8d684d86736bd4409b60c`
and `26bf86bba1cbd1955d069ab2eac8d491b6cade59d16a004f1d094cc117ebc9c6`.

The earlier broad-unit-run scope deviation remains recorded and retained;
it is not retroactively PASS. HEAD inspected bounded metadata and retains
the ten additive program-oracle directories; that is not proof of complete
historical mutation freedom. No broad inherited unit suite was rerun.

HEAD wiring is unchanged from `HANDOFF.md`: static control registration,
Vite8 `build.rolldownOptions.input` for root diagnostic and the actual
`src/runner/index.html`, and desired explicit CLI aliases. Actual URL remains
`/src/runner/index.html`, public assets `/inventory.json` and `/Fxx-.../...`.
HEAD remains accepted at START16, not integrated. A new immutable phase-two
snapshot is required before optimized browser/lifecycle verification.

No services/browsers were started, and no foreign process/tab cleanup occurred.
No delegation, DevToolbox writes, publication, deployment or database writes.
Automatic untracked `.opencode/throughput.jsonl` and `.md` remain untouched.
Admission relies on the granted sole writer and fresh owned directory; it is
not a general concurrent/adversarial filesystem capture protocol.
