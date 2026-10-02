# HEAD takeover after RD-00

RD-00 is accepted as an implemented, locally verified **lab foundation**. It is not a Three renderer, a native Cut test, a performance result, or art acceptance. `ProductIntegrated=false`.

## Reviewed and integrated identities

| Role | Leaf commit | Integration commit | Identical tree |
|---|---|---|---|
| Code/config/tests | `94b5e17ee13bfca27607c515bb1b37c8cdea6d28` | `905d37140328d9f6f9546181ecfcbaafe66f3fe0` | `b0075bfedbe3590b0c2f4fbe2fb368d193ea4d65` |
| Report-only receipt | `63f28c99d3a8dc319c01e80da8369fdb55e35d57` | `e2f91eca63344d9285e50dc84c2e02215435be93` | `32bbf857c06460db7bc6c3e415f12b79b8c6db99` |

Product read base remains `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. The original input commit remains `807e8b4cc4528bd9d02122109e08e2e869305047`. Original package bytes, `RUN.json`, and the initial `EXECPLAN.md` are unchanged; this file records subsequent progress.

HEAD read the full fixture/frame/scenario/result/lifecycle contracts, registration, focused tests, configuration, guard, and freeze answers. Fresh HEAD checks on the leaf worktree passed: type check, 13/13 unit tests, production build, boundary, and 1/1 browser diagnostic. Screenshot and actual served asset bindings agree; final registered mounts and console errors are zero. The task-owned preview was stopped and port 5280 verified free afterward. This is HEAD self-review, not independent or human review.

## Narrow guard takeover

Only HEAD may change shared contracts, package/config/lock, registration, or the guard after the terminal RD-00 handoff. Leaf profiles now use the unchanged package taskboard's exact allowlists; SO profiles only allow their own report root. Non-RD-00 profiles require the actual full task-start SHA. HEAD can coordinate inside the lab root, never outside it.

The guard remains strict for committed, staged, unstaged, untracked, ignored outside-root files, and link/reparse escapes. Immutable inputs are compared against the original input commit, not a newer leaf start. The two automatic untracked regular throughput filenames are reported as an accepted deviation, not an all-files-clean PASS. The HEAD location change also produced those same filenames inside the lab location; neither repository-root nor lab-location logs may be authored, staged, committed, moved, deleted, or published. Their scope requires this independent repository/common Git directory or a bounded synthetic oracle. There is no broad `.opencode` ignore or global plugin/config change.

The runnable `tests/RD-00/program-boundary.mjs` proves card isolation, shared-file ownership, explicit start/known profile requirements, allowed own-file revisions, rejected tracked automatic logs even after start changes, and unchanged outside-root protection. The prior frozen guard fails its first positive RD-02 case (baseline RED); the HEAD guard passes (GREEN). Existing 13 tests also still pass.

## Fresh evidence

Raw commands, exit codes, pinned executable paths, working directories, and raw log paths are append-only in `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/commands.jsonl`. Evidence is outside Git and outside product saves.

| Check | Evidence label | Result |
|---|---|---|
| Fresh original candidate type/unit/build/boundary | `head-check`, `head-unit`, `head-build`, `head-boundary` | PASS |
| Fresh original candidate browser | `head-browser` (run `head-browser-1790960690279`) | PASS, diagnostic only |
| Preview cleanup | `head-port-after` | PASS |
| Frozen old guard reproduction | `head-profile-red` | EXPECTED FAIL, exit 1 |
| New program profile check | `head-profile-green` | PASS |
| Own integration install | `head-own-ci` | PASS, lab-only `ci --legacy-peer-deps --no-audit --no-fund` |
| Integration type/unit/build | `head-takeover-check`, `head-takeover-unit`, `head-takeover-build` | PASS; 13/13 unit tests |
| Integration boundary | `head-takeover-boundary` | PASS scoped; 52 inputs verified; accepted automatic-log deviation |

Example profile verification from the task's own lab directory, using the real full start supplied in its brief:

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/verify-boundary.mjs' --task RD-02 --start '<actual-full-task-start-SHA>'
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './tests/RD-00/program-boundary.mjs'
```

The literal placeholder is documentation, not a runnable grant. Each new leaf receives an actual SHA and checks its frozen lock/contract hashes before writing.

## Capacity and next gate

SO-01 finished read-only preparation and supplied real RD-01/RD-02/RD-03 briefs. No nested spawning quota was proven; HEAD starts the leaves and routes results to SO-01. Start RD-02 first after the committed takeover freeze, then RD-01, then RD-03 after accepted RD-02 fixtures. No early implementation of downstream dependencies.

Until new host evidence justifies an increase: at most three open children, one writer, one heavy RD job, and a reserved review/recovery slot. GPU selection measurements have no lease. Reddit text/media access and concept image bytes remain unavailable; those gates do not block honest fixture/export or synthetic experiments.

No DevToolbox change/execution was created: tracking was not requested and its writes are outside the authorized lab root. Equivalent local spec, scope, fresh test, and completion checks are recorded here and in the raw evidence. No product install/test/save write, push, PR, main merge, global configuration change, release, or deployment occurred. Remaining cards are OPEN; the full program is not complete.
