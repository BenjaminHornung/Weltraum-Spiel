# RD-02 bounded safety repair — terminal handoff

The sole confirmed finding is fixed at `exporters/stage-source.mjs:34`: `lstatSync`
with `throwIfNoEntry:false` examines dangling junctions before any `realpathSync`.
Only absent entries are tolerated; there is no catch, guard relaxation or algorithm
change. FX10 permanently checks dangling/live junction rejection, existing/nonexistent
normal own paths and foreign-prefix rejection. Tests create new additive own-run
directories; no link is followed for a write or deleted/recreated.

Parent: `e6d41867f0fd3257428132c6463ff7d1f80f91af`, tree
`e5f710fe72eb9cd05c1895ddac31bc27dbe826fa`. Original START:
`63e52eea0f2afbde03ab83b8d66f62941097b314`, tree
`addf696048a320b9739fc1dc901047600d52e51c`. Product read base remains
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. One local child commit only;
the actual full candidate SHA/tree and full file-byte/Git-blob mapping are provided
post-commit by the uniquely named external receipt below, not a self-referential
hash in this tracked document. No merge/push/PR. ProductIntegrated=false.

## Exact tracked repair delta (relative to the Lab)

- `exporters/stage-source.mjs` — the two-line owning-boundary fix.
- `tests/RD-02/unit.test.ts` — one new FX10; FX01–FX09 unchanged.
- `fixtures/F00-CONTROL/recipe.json`
- `fixtures/F01-HVP-COAST/recipe.json`
- `fixtures/F02-ROOT-GROVE/recipe.json`
- `fixtures/F03-SHELTER/recipe.json`
- `fixtures/F03-SHELTER/snapshots/r1-opening/recipe.json`
- `fixtures/F04-DETACH/recipe.json`
- `fixtures/F04-DETACH/snapshots/r1-detach/recipe.json`
- `fixtures/F04-DETACH/snapshots/r2-rotate/recipe.json`
- `fixtures/F04-DETACH/snapshots/r3-remove/recipe.json`
- `fixtures/F04-DETACH/snapshots/r4-reload/recipe.json`
- `fixtures/F05-CUTOUT/recipe.json`
- `fixtures/F06-MATERIAL/recipe.json`
- `fixtures/F06-MATERIAL/snapshots/r1-opening/recipe.json`
- `fixtures/F07-SCALE/recipe.json`
- `fixtures/F07-SCALE/snapshots/r1-2x/recipe.json`
- `fixtures/F07-SCALE/snapshots/r2-4x/recipe.json`
- `fixtures/inventory.json` — only the sixteen changed recipe SHA fields.
- `reports/RD-02/REPAIR-PLAN.md` — bounded plan.
- `reports/RD-02/repair-refresh.mjs` — validates every required invariance before
  updating the seventeen annotations and retains their old bytes externally.
- `reports/RD-02/repair-receipt.mjs` — post-commit exact candidate/parent/byte receipt.
- `reports/RD-02/REPAIR-HANDOFF.md` — this report.

The sixteen recipes change exactly one `generatorFiles` SHA each, for stage-source:
`b8941441aa8a3ce66db4fa3daf99fa7b79434423ffa306e64fd15cc692b17ecb` →
`0b37d37f96153066a59e1a3d626bfed6d491e20b14d41c2cbab250f3274b8f32`.
New inventory SHA:
`cc802f0d9044f7d7ee3c3a251870c6ae2fce926ad5785fc0bb82ab93be54723f`.
Old inventory SHA stays recorded as
`9ada4198596705053bcaecb68b5a5926bf6792e335feb6cc0cb4cd79fbc7a5f0`.
All 412 manifest/payload/scenario files are exactly the parent bytes; all other
recipe/inventory values are unchanged. Static/normal/reverse 429-file exports
match. Sixteen snapshots, eight scenarios, payload 41,370,324 B, manifests
160,204 B, largest fixture payload 23,150,628 B. Caps remain 1 MiB / 128 MiB.

All loadable fixture IDs, manifest paths/digests, payload types/endian/length/SHA,
SourceRefs and F04 replay revision/tick mapping are unchanged from the original
`HANDOFF.md` and are reproduced completely in the new receipt/inventory. F04 is
still presentation SNAPSHOTREPLAY r0 intact → r1 detach → r2 rotate → r3 remove →
r4 reload at ticks 0/360/720/1080/1440; never a native CutApplied/Receipt.

Native 8 MiB source SHA before/after remains
`cf21b909845a2a037643f6e8fd8ec80faafbe37a3387d12515e6ce70fee84f13`;
crop slot SHA remains
`561b1ea853ee6377ec78337016725d6771f178e734925dd0d6d3a33ec7056c0a`.
Native original/erased/adapted modules and proof bytes are also compared against
the retained parent stage. SourceMutation=false, SourceDetached=false. No profiles,
material roles, quantum, erasure/import/native logic, thresholds or fixture-quality
changes. No new dependencies/frameworks.

## Fresh verification and raw byte bindings

`RUN` = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02`.
Every exact binary/argv/cwd/environment, exit code, raw log path/length/SHA is
recorded in append-only `RUN/commands.jsonl`, copied for repair commands into the
new receipt. Existing producer logs, receipts and freeze inputs are retained.

| Check | Result | Raw log (relative to RUN/logs), SHA256 |
|---|---|---|
| HEAD genuine dangling RED | expected FAIL, exit 1 | `head-dangling-path-red-1790967702845.log`, `8a4f658d7b0498499ceac7df2c14d9da9f136da72972ce6177b1bfe0b771f557` |
| New FX10 before fix | expected FAIL, exit 1, 1 failed / 9 skipped | `repair-fx10-red-1790967940729.log`, `e705280991952475ebe15f9ee4e005c4593f9a112d1451ffcc3b53113d89483c` |
| FX10 after fix | PASS, exit 0, 1 passed / 9 skipped | `repair-fx10-green-1790967998818.log`, `668da30fd174f4a2d95b1c53fd3bba43dd84f8c5fd05cc70aba8f6ec3818799b` |
| Existing HEAD link read-only counterprobe | PASS, exit 0 | `repair-head-existing-green-1790968035237.log`, `c97ab71e4e3be5dd5794cd2204bcc9aab7e3337c8a2bae65382d987064a60237` |
| Actual normal export/import/re-export | PASS, exit 0 | `repair-export-normal-1790968082432.log`, `01ea647adddd032da5e35463dbf49c9baae9bcb00a9c123614ada11c384cb351` |
| Reverse export/import/re-export | PASS, exit 0 | `repair-export-reverse-1790968108433.log`, `f3dea115c12988675ed231f37966cb4c7414697a09537c611533dd159215e218` |
| Only required annotation rebinding | PASS, exit 0 | `repair-annotations-1790968235198.log`, `8b000cd5b19bdac909ed6f727bdd588c306e3900a4764138f4cbe67da4e0ebd0` |
| Complete focused units | PASS, exit 0, **10/10** | `repair-final-unit-1790968424810.log`, `340eb11dd1865574b8f6ce1528e588e12fff89c9b4ab190427a7a9fe22bb0cf4` |
| Lab/root typecheck | PASS, exit 0 | `repair-final-check-1790968434583.log`, `55c814d0e096397f099fe6af3df4cb48543573b7821b3361bbbe5963f2045252` |
| Own supplemental RD-02 typecheck | PASS, exit 0 | `repair-final-rd02-typecheck-1790968445169.log`, `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Lab build | PASS, exit 0, 13 modules | `repair-final-build-1790968454933.log`, `6321ace822b17c82ff7b52a4fc9f41251fe16372c294c7c8cc88945e517a1e9a` |
| All 40 native stage files, actual bytes vs parent | PASS, exit 0 | `repair-native-stage-equality-1790969035721.log`, `cc64dd3a4a8abacda063c889c49e24bf5085872196b5b0707cdc552450ce2a6a` |
| Original exact task/start/base boundary | PASS, exit 0 | `repair-final-boundary-1790969049204.log`, `da3f56e306281bf89c1aada46bfb00cf4ee76a9d8d54d11863ccc036aa1ee49b` |

Concrete original-boundary and post-commit evidence is captured under
`repair-final-boundary` / `repair-post-commit-boundary`; terminal receipt refuses
success without the exact committed candidate, task RD-02, START63e, base b3,
52 verified input hashes, unchanged 18-file freeze and zero violations/links.
The original AllFilesGate remains **FAIL_ACCEPTED_NARROW_EXCEPTION**, not PASS:
only automatic untracked contained regular root `.opencode/throughput.jsonl` and
`throughput.md`; never authored, moved, removed, staged, committed or published.

## Reproduction, cost and retained evidence

Use pinned Node `C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe`
and cwd this own Lab. Existing pinned installation is reused; no install or lock
change in this repair. All commands run through `reports/RD-02/run-command.mjs`:

```text
<node> reports/RD-02/run-command.mjs repair-fx10-green npm run test:unit -- tests/RD-02 -t FX10
<node> reports/RD-02/run-command.mjs repair-final-unit npm run test:unit -- tests/RD-02
<node> reports/RD-02/run-command.mjs repair-final-check npm run check
<node> reports/RD-02/run-command.mjs repair-final-rd02-typecheck node node_modules/typescript/bin/tsc --project reports/RD-02/tsconfig.json
<node> reports/RD-02/run-command.mjs repair-final-build npm run build
<node> reports/RD-02/run-command.mjs repair-final-boundary npm run verify:boundary -- --task RD-02 --start 63e52eea0f2afbde03ab83b8d66f62941097b314 --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e
<node> reports/RD-02/run-command.mjs repair-export-normal node exporters/export-fixtures.mjs --source-ref b3c6523a94cd050f5a9a22dc27f4777fcc03363e --out <RUN>/repair-dangling-v1/export-normal --stage <RUN>/repair-dangling-v1/stage
<node> reports/RD-02/run-command.mjs repair-export-reverse node exporters/export-fixtures.mjs --source-ref b3c6523a94cd050f5a9a22dc27f4777fcc03363e --out <RUN>/repair-dangling-v1/export-reverse --stage <RUN>/repair-dangling-v1/stage --reverse-order
```

Do not rerun the historical RED probe script: it creates the already-existing
HEAD junction. Read its existing lstat/ownedPath counterprobe or use FX10's new
unique retained path. `repair-refresh.mjs` is the recorded one-shot parent
annotation transition, not a repeatable overwrite of historical evidence.

Normal wall 12,547.4567 ms, CPU user/system 9,813/1,375 ms, peak RSS 309,096 KiB;
reverse wall 13,086.1306 ms, CPU 9,860/1,484 ms, peak RSS 295,968 KiB. Actual
source export diagnostics only, **not** game runtime/performance/capacity evidence.
Cost files: `RUN/export-1790968082402-normal.json` and
`RUN/export-1790968108405-reverse.json`. Browser NOT_APPLICABLE (no UI/render
change); GPU/game-runtime performance, product build and art acceptance NOT_RUN.
Self-review PASS: complete staged source/test/report diff, exact 23-path scope,
all annotation differences and `git diff --cached --check`; no unexpected changes.
Independent/human repair review NOT_RUN; HEAD's repeated acceptance remains pending.
No delegation or services. DevToolbox NOT_RUN by explicit scope/authorization;
local freeze, tests, types, build, byte comparison and exact boundary are equivalents.

Preserved e6 receipt: `RUN/final-receipt.json`, SHA
`bd054767f38180191cc6b47eaa18b707a76f9ef133b3ab51f978fb3244c91f0f`.
New unique receipt: `RUN/repair-dangling-v1/repair-receipt.json` (full candidate
SHA/tree, parent mapping, exact 23-path repair/449-path full-candidate byte bindings,
all fixture/scenario/payload digests, raw log lengths/SHAs and fresh boundary).
Retained RED source bytes: `repair-dangling-v1/red/` and its `bindings.json`.
Old sixteen recipes/inventory are retained at `repair-dangling-v1/parent-annotations/`;
old/new bindings at `repair-dangling-v1/annotation-bindings.json`.
All parent e6/HEAD evidence and the original probe link remain untouched; additive
own probes, new source stage/export roots, install/build artifacts and logs remain.
No cleanup deletion, foreign process/tab operations, global changes or publication.
Smallest adoption targets remain the existing Lab exporters/fixtures, not a product
integration authorization. Sole finding fixed; no new product authority.
